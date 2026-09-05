'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * Point at the part of the image that must survive the crop.
 *
 * The control this replaces was a five-option dropdown — center, top, bottom,
 * left, right — which cannot express "the face is a third of the way in and
 * near the top", and that is most photographs in a lookbook. Worse, it asked
 * the author to reason about the crop in the abstract: you picked "top", looked
 * at the page, and picked again.
 *
 * Here the image is on screen with the point on it, and dragging moves it. The
 * five presets are still underneath as quick jumps, because "dead centre" is
 * one click and should not need a drag.
 */
export function FocalPointPicker({
  src,
  x,
  y,
  onChange,
}: {
  src: string
  x: number
  y: number
  onChange: (x: number, y: number) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [broken, setBroken] = useState(false)

  const pointFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const rect = frameRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return
      // Clamped, because a pointer capture keeps sending moves after the
      // cursor has left the frame — without this a drag off the top edge
      // stores a negative percentage that CSS then ignores entirely.
      const nx = Math.round(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)))
      const ny = Math.round(Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)))
      onChange(nx, ny)
    },
    [onChange]
  )

  if (broken) return null

  return (
    <div className="space-y-1.5">
      <div
        ref={frameRef}
        role="application"
        aria-label="Focal point"
        className="relative w-full cursor-crosshair overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 select-none"
        style={{ aspectRatio: '16 / 9' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          setDragging(true)
          pointFromEvent(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (dragging) pointFromEvent(e.clientX, e.clientY)
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId)
          setDragging(false)
        }}
        onPointerCancel={() => setDragging(false)}
      >
        {/* Deliberately a plain img: this is a UI thumbnail of a URL the author
            just typed, which may be any host, and next/image would need every
            one of them in the remote pattern list to render at all. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          className="pointer-events-none h-full w-full object-cover opacity-90"
        />
        {/* The crosshair, drawn over a dimmed image so it stays visible on a
            light photograph as well as a dark one. */}
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <div className="h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]" />
          <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>
      </div>
      <p className="text-[10px] text-neutral-500">
        Drag to choose what stays in frame when the image is cropped. {x}% × {y}%
      </p>
    </div>
  )
}
