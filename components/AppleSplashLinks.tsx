// iOS standalone (Add to Home Screen) launch images. Each entry maps a device
// class to a generated splash at its exact pixel resolution. React hoists these
// <link> tags into <head>. Portrait only — the manifest pins portrait-primary.

type Device = { w: number; h: number; cw: number; ch: number; r: number }

// w/h = pixel resolution (for the generated image); cw/ch = CSS px; r = DPR.
const DEVICES: Device[] = [
  { w: 1290, h: 2796, cw: 430, ch: 932, r: 3 }, // 15/16 Pro Max, 14 Pro Max
  { w: 1179, h: 2556, cw: 393, ch: 852, r: 3 }, // 15/16, 14 Pro
  { w: 1284, h: 2778, cw: 428, ch: 926, r: 3 }, // 12/13 Pro Max
  { w: 1170, h: 2532, cw: 390, ch: 844, r: 3 }, // 12/13/14
  { w: 1125, h: 2436, cw: 375, ch: 812, r: 3 }, // X/XS/11 Pro
  { w: 1242, h: 2688, cw: 414, ch: 896, r: 3 }, // XS Max/11 Pro Max
  { w: 828, h: 1792, cw: 414, ch: 896, r: 2 },  // XR/11
  { w: 1242, h: 2208, cw: 414, ch: 736, r: 3 }, // 8 Plus
  { w: 750, h: 1334, cw: 375, ch: 667, r: 2 },  // 8/SE2/SE3
  { w: 2048, h: 2732, cw: 1024, ch: 1366, r: 2 }, // iPad Pro 12.9"
  { w: 1668, h: 2388, cw: 834, ch: 1194, r: 2 },  // iPad Pro 11"
  { w: 1640, h: 2360, cw: 820, ch: 1180, r: 2 },  // iPad Air
  { w: 1620, h: 2160, cw: 810, ch: 1080, r: 2 },  // iPad 10.2"
  { w: 1488, h: 2266, cw: 744, ch: 1133, r: 2 },  // iPad mini
]

export function AppleSplashLinks() {
  return (
    <>
      {DEVICES.map((d) => (
        <link
          key={`${d.w}x${d.h}`}
          rel="apple-touch-startup-image"
          href={`/apple-splash?w=${d.w}&h=${d.h}`}
          media={`(device-width: ${d.cw}px) and (device-height: ${d.ch}px) and (-webkit-device-pixel-ratio: ${d.r}) and (orientation: portrait)`}
        />
      ))}
    </>
  )
}
