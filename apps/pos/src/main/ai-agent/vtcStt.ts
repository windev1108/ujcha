async function transcribeWithGroq(audioBuffer: Buffer, apiKey: string, prompt?: string): Promise<string | null> {
  const boundary = `----GroqSTT${Date.now().toString(36)}`
  const CRLF = '\r\n'

  const filePart =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="audio.wav"${CRLF}` +
    `Content-Type: audio/wav${CRLF}${CRLF}`

  const promptPart = prompt
    ? `${CRLF}--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="prompt"${CRLF}${CRLF}` +
      prompt
    : ''

  const tail =
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
    `whisper-large-v3-turbo` +
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="language"${CRLF}${CRLF}` +
    `vi` +
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="response_format"${CRLF}${CRLF}` +
    `json` +
    `${CRLF}--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="temperature"${CRLF}${CRLF}` +
    `0` +
    promptPart +
    `${CRLF}--${boundary}--${CRLF}`

  const body = Buffer.concat([Buffer.from(filePart), audioBuffer, Buffer.from(tail)])
  console.log(`[Groq STT] Sending ${audioBuffer.byteLength} bytes, prompt: ${prompt?.slice(0, 60) ?? 'none'}`)

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })

  const text = await res.text()
  console.log(`[Groq STT] HTTP ${res.status}:`, text.slice(0, 200))

  if (!res.ok) throw new Error(`Groq STT HTTP ${res.status}: ${text.slice(0, 120)}`)

  const json = JSON.parse(text) as { text?: string }
  const transcript = json.text?.trim() || null
  console.log('[Groq STT] Transcript:', transcript)
  return transcript
}

export async function transcribeAudio(audioBuffer: Buffer, prompt?: string): Promise<string | null> {
  const apiKey = process.env['GROQ_API_KEY'] ?? ''
  if (!apiKey) throw new Error('GROQ_API_KEY chưa được cấu hình trong .env')
  return transcribeWithGroq(audioBuffer, apiKey, prompt)
}
