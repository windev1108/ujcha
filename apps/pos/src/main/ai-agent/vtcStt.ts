async function transcribeWithViettel(audioBuffer: Buffer, token: string): Promise<string | null> {
  const boundary = `----ViettelSTT${Date.now().toString(36)}`
  const CRLF = '\r\n'

  const filePart =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="audio.wav"${CRLF}` +
    `Content-Type: audio/wav${CRLF}${CRLF}`

  const tokenPart =
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="token"${CRLF}${CRLF}` +
    `${token}${CRLF}--${boundary}--${CRLF}`

  const body = Buffer.concat([Buffer.from(filePart), audioBuffer, Buffer.from(tokenPart)])
  console.log(`[Viettel STT] Sending ${audioBuffer.byteLength} bytes, token: ${token.slice(0, 8)}...`)

  const res = await fetch('https://viettelai.vn/asr/recognize', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'accept': '*/*',
    },
    body,
  })

  const text = await res.text()
  console.log(`[Viettel STT] HTTP ${res.status} response:`, text.slice(0, 300))

  if (!res.ok) throw new Error(`Viettel STT HTTP ${res.status}: ${text.slice(0, 120)}`)

  try {
    const json = JSON.parse(text) as Record<string, unknown>

    const code = json['code'] as number | undefined
    if (code !== undefined && code !== 200) {
      const msg = (json['message'] ?? json['error'] ?? code) as string
      throw new Error(`Viettel STT lỗi ${code}: ${msg}`)
    }

    // response.result is an array of segment objects: [{ transcript, ... }, ...]
    const r = (json['response'] ?? json) as Record<string, unknown>
    let raw: unknown =
      r['result'] ?? r['text'] ?? r['transcript'] ?? r['recognized_text'] ??
      json['result'] ?? json['text']

    if (Array.isArray(raw)) {
      raw = (raw as Array<Record<string, unknown>>)
        .map((seg) => seg['transcript'])
        .filter((t) => typeof t === 'string' && t.trim())
        .join(' ')
        .trim()
    }

    console.log('[Viettel STT] Transcript:', raw)
    return typeof raw === 'string' ? raw.trim() || null : null
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Viettel STT')) throw e
    console.warn('[Viettel STT] Non-JSON response:', text.slice(0, 80))
    throw new Error(`Viettel STT: không parse được response — ${text.slice(0, 80)}`)
  }
}

export async function transcribeAudio(audioBuffer: Buffer, token?: string): Promise<string | null> {
  const viettelToken = token || process.env['VIETTEL_TTS_TOKEN'] || ''
  if (!viettelToken) throw new Error('VIETTEL_TTS_TOKEN chưa được cấu hình trong .env')
  return transcribeWithViettel(audioBuffer, viettelToken)
}
