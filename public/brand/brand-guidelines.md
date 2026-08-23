# QLICO Brand Guidelines

## The Core Concept
**"Liquid Chrome & Obsidian"** 
QLICO is not just a SaaS tool; it is a luxury editorial platform. The brand identity is built on stark contrasts, brutalist minimalism, and highly polished "liquid chrome" aesthetics. 

## 1. Typography
Typography is the primary vehicle for the brand identity. We do not rely on loud colors; we rely on exquisite kerning and tracking.

- **Primary Display (Headers & Logos):** `Bodoni Moda` (or Didot as a fallback). 
  - Weight: 400 (Regular) to 600 (SemiBold).
  - Tracking: Tightly kerned (`tracking-tight` or `-0.03em`).
- **Secondary Display:** `Fraunces` (used sparingly for secondary editorial accents).
- **Body & UI:** `Outfit` (or `Inter`).
  - Weight: 300 to 500.
  - Usage: Kept small, highly legible, and often colored in soft grays (e.g., `text-zinc-400`).

## 2. Color Palette
The palette is monochromatic, relying heavily on transparency, blurs, and shadows to create depth rather than color.

- **Background (The Void):** `#050505` (A near-black obsidian, never `#000000`).
- **Primary Text:** `#ffffff` (Pure white for high contrast).
- **Secondary Text:** `#a1a1aa` (Zinc 400).
- **Accents:** `#27272a` (Zinc 800) for borders and subtle backgrounds.

## 3. The Logo Suite
The official logos are located in `public/brand/`:
- `logo-light.svg`: For use on light backgrounds (black text).
- `logo-dark.svg`: For use on dark backgrounds (white text).
- `icon.svg`: The standalone 'Q' monogram, used for favicons and avatars.

**Usage Rules:**
- The logo is purely typographic. Do not stretch, skew, or apply artificial drop shadows to the SVG itself.
- Ensure at least `32px` of breathing room (padding) around the logo in all applications.

## 4. UI Elements & Materials
- **Glassmorphism:** Overlays should use heavy backdrop blurs (e.g., `backdrop-blur-2xl`) over black backgrounds with low opacity (`bg-black/40`) to simulate frosted glass.
- **Chrome:** Interactive elements should have subtle inset shadows (`shadow-[inset_0_2px_10px_rgba(255,255,255,0.2)]`) to simulate a metallic edge.
- **Imagery:** Marketing materials should utilize abstract, high-resolution 3D liquid metal/chrome floating in a black void. These are stored as `marketing_asset_1.jpg` in the brand folder.
