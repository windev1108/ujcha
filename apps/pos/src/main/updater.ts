import { net, app, ipcMain, shell, type BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'

interface VersionInfo {
  version: string
  downloadUrl: string
  releaseNotes?: string
}

let getWinRef: (() => BrowserWindow | null) | null = null
let downloadedInstallerPath: string | null = null

function send(channel: string, data?: unknown) {
  getWinRef?.()?.webContents.send(channel, data)
}

function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

function getCheckUrl(): string | null {
  const base = process.env.VITE_API_URL
  if (!base) return null
  return `${base.replace(/\/$/, '')}/kun-pos/version`
}

async function doCheck(): Promise<void> {
  const checkUrl = getCheckUrl()
  if (!checkUrl) return
  try {
    const res = await fetch(checkUrl, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return
    const info = (await res.json()) as VersionInfo
    if (!info.version || !info.downloadUrl) return
    const current = app.getVersion()
    if (semverGt(info.version, current)) {
      console.log(`[Updater] New version: ${info.version} (current: ${current})`)
      send('updater:available', {
        version: info.version,
        downloadUrl: info.downloadUrl,
        releaseNotes: info.releaseNotes ?? null,
      })
    } else {
      console.log(`[Updater] Up to date (${current})`)
    }
  } catch (e) {
    console.warn('[Updater] Check failed:', (e as Error).message)
  }
}

async function downloadUpdate(url: string, version: string): Promise<void> {
  const dest = path.join(app.getPath('temp'), `UjCha-POS-Setup-${version}.exe`)
  try { fs.unlinkSync(dest) } catch { /* ignore */ }

  return new Promise((resolve, reject) => {
    const request = net.request({ url, redirect: 'follow' })

    request.on('response', (response) => {
      // electron net follows redirects but in case of manual redirect
      if (response.statusCode >= 300 && response.statusCode < 400) {
        const location = Array.isArray(response.headers['location'])
          ? response.headers['location'][0]
          : response.headers['location']
        if (location) {
          downloadUpdate(location, version).then(resolve).catch(reject)
          return
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }

      const contentLength = response.headers['content-length']
      const total = contentLength ? parseInt(Array.isArray(contentLength) ? contentLength[0] : contentLength, 10) : 0
      let downloaded = 0

      const fileStream = fs.createWriteStream(dest)

      response.on('data', (chunk: Buffer) => {
        downloaded += chunk.length
        fileStream.write(chunk)
        if (total > 0) {
          send('updater:progress', Math.round((downloaded / total) * 100))
        } else {
          // unknown size — pulse every ~1MB
          if (downloaded % (1024 * 1024) < chunk.length) {
            send('updater:progress', -1)
          }
        }
      })

      response.on('end', () => {
        fileStream.end(() => {
          downloadedInstallerPath = dest
          send('updater:downloaded')
          console.log('[Updater] Download complete:', dest)
          resolve()
        })
      })

      response.on('error', (err: Error) => {
        fileStream.destroy()
        try { fs.unlinkSync(dest) } catch { /* ignore */ }
        reject(err)
      })
    })

    request.on('error', (err: Error) => {
      try { fs.unlinkSync(dest) } catch { /* ignore */ }
      reject(err)
    })

    request.end()
  })
}

function installUpdate(): void {
  const installerPath = downloadedInstallerPath
  if (!installerPath || !fs.existsSync(installerPath)) {
    console.warn('[Updater] Installer not found:', installerPath)
    return
  }
  send('updater:installing')
  // Short delay so renderer can show "installing" stage before window closes
  setTimeout(() => {
    console.log('[Updater] Launching installer:', installerPath)
    spawn(installerPath, ['/S'], { detached: true, stdio: 'ignore' }).unref()
    app.quit()
  }, 800)
}

export function setupUpdater(getWin: () => BrowserWindow | null): void {
  getWinRef = getWin

  if (!app.isPackaged) {
    console.log('[Updater] Dev mode — auto-check skipped')
    return
  }

  if (!getCheckUrl()) {
    console.warn('[Updater] VITE_API_URL not set — update check disabled')
    return
  }

  setTimeout(() => void doCheck(), 10_000)
  setInterval(() => void doCheck(), 4 * 60 * 60 * 1_000)
}

export function registerUpdaterHandlers(): void {
  ipcMain.on('updater:check', () => void doCheck())

  ipcMain.on('updater:startDownload', (_, url: string, version: string) => {
    downloadUpdate(url, version).catch((e) => {
      console.error('[Updater] Download failed:', e)
      send('updater:downloadError', (e as Error).message)
    })
  })

  ipcMain.on('updater:install', () => installUpdate())

  ipcMain.on('updater:openDownload', (_, url: string) => {
    shell.openExternal(url).catch(() => { })
  })
}
