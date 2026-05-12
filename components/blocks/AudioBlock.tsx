'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'
import { trackEvent } from '@/lib/tracking'
import type { AudioBlock } from '@/lib/book-schema'

export function AudioBlock({ block, bookId }: { block: AudioBlock; bookId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [tracked, setTracked] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      setProgress(audio.currentTime)
      if (!tracked && audio.currentTime > 2) {
        trackEvent(bookId, 'audio_play', { block_id: block.id })
        setTracked(true)
      }
    }
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [bookId, block.id, tracked])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play()
    }
    setPlaying(!playing)
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    audio.currentTime = (x / rect.width) * duration
  }

  function formatTime(s: number) {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center gap-3 w-full p-3 rounded-lg bg-black/10 backdrop-blur-sm">
      <audio ref={audioRef} src={block.src} preload="metadata" />

      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-current/20 flex items-center justify-center hover:bg-current/30 transition-colors"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <Pause size={18} className="text-current" fill="currentColor" />
        ) : (
          <Play size={18} className="text-current ml-0.5" fill="currentColor" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate opacity-90">{block.title}</p>
        <div
          className="mt-1 h-1.5 bg-current/20 rounded-full cursor-pointer"
          onClick={seek}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={progress}
        >
          <div
            className="h-full bg-current rounded-full transition-all"
            style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }}
          />
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-1 text-xs opacity-60">
        <Volume2 size={12} />
        <span>{formatTime(duration - progress)}</span>
      </div>
    </div>
  )
}
