/** Real-time audio amplitude (0–1) fed by the TTS playback analyser. */
let _vol = 0
export const getAudioVolume = () => _vol
export const setAudioVolume = (v: number) => { _vol = v }
