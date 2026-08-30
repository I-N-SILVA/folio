/**
 * Zero-dependency procedural sound synthesizer for tactile page flips
 * Uses the Web Audio API to create a gentle, realistic paper rustle sound.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function playPageFlipSound(volume = 0.22) {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const bufferSize = Math.floor(ctx.sampleRate * 0.075) // 75ms duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    // Generate gentle filtered noise with envelope
    let b0 = 0
    let b1 = 0
    let b2 = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      const pink = b0 + b1 + b2 + white * 0.5362
      const progress = i / bufferSize
      const envelope = Math.sin(progress * Math.PI) * (1 - progress * 0.4)
      data[i] = pink * envelope * 0.12
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    // Low-pass filter for soft paper rustle texture
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(950, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.075)

    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.075)

    source.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(ctx.destination)

    source.start(ctx.currentTime)
  } catch {
    // Audio playback blocked or not supported on this platform
  }
}
