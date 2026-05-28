import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

const configDir = app.getPath('userData')
const configFile = join(configDir, 'pos-config.json')

export function readConfig(): Record<string, unknown> {
    try {
        if (existsSync(configFile)) return JSON.parse(readFileSync(configFile, 'utf-8'))
    } catch { /* ignore */ }
    return {}
}

export function writeConfig(data: Record<string, unknown>) {
    try {
        mkdirSync(configDir, { recursive: true })
        writeFileSync(configFile, JSON.stringify(data, null, 2))
        console.log('💾 Written to:', configFile)
    } catch (e) {
        console.error('❌ writeConfig failed:', e)
    }
}

export function readSubConfig(key: string): unknown {
    return readConfig()[key] ?? null
}

export function writeSubConfig(key: string, value: unknown): void {
    writeConfig({ ...readConfig(), [key]: value })
}