## Goal
Make the player and obstacles visually pop when the background is dark (night/void themes) without changing their core colors or art style.

## What I’ll change

### 1. Compute a background darkness factor
In `src/game/engine.ts` I’ll derive a `darkness` value (0..1) from the current crossfaded theme using the existing `night` theme property plus a luminance check on the mixed `bg` color. This gives a smooth scalar that is 0 in bright day themes and ~1 in void.

### 2. Obstacle contrast boost
- Keep the existing cartoon shapes, fills, and black `INK` outlines exactly as-is.
- When `darkness > 0.3`, draw an extra outer rim behind each obstacle:
  - A slightly thicker, semi-bright stroke (white/cyan-tinted) whose opacity scales with `darkness`.
  - For blades, a faint radial glow behind the spinning disc.
  - For arrows, the warning indicator and flying arrow already use bright yellow/orange; I’ll add a subtle dark-background-only glow so they don’t disappear against void.

### 3. Player contrast boost
- Keep the ninja body/sash/trim colors and black outline.
- When `darkness > 0.3`, render a soft outer aura behind the player:
  - A blurred white/cyan ellipse shadow beneath the ninja.
  - A thin bright rim stroke around the body/head that scales with darkness.
  - This makes the player readable against the void gradient without changing the character art.

### 4. Optional rope tweak
- The rope already has a thick black outline; in dark themes that outline vanishes. I’ll add a faint bright inner/outer stroke only when `darkness` is high so the central rope remains visible.

## What I won’t change
- No new assets, sprites, or shaders.
- No gameplay/collision changes.
- Theme progression, audio, particles, and UI stay the same.

## Files
- `src/game/engine.ts` — all rendering changes.

## Verification
- Typecheck with `tsgo`.
- Smoke test the preview in menu, playing, and void state to confirm player and obstacles remain visible against dark backgrounds.