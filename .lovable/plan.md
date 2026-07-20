## Goal
Let players pick a background-music vibe (Calm, Tense, Arcade, Cinematic, Dark) from the pause menu. The choice persists across sessions via `localStorage` and is applied live to the procedural music engine.

## Changes

### 1. `src/game/audio.ts` — vibe-aware music engine
- Add a `MusicVibe` type: `'calm' | 'tense' | 'arcade' | 'cinematic' | 'dark'`.
- Add a `vibePresets` table mapping each vibe to a set of tunable parameters that the existing layers already use:
  - Base pad: root frequency, detune spread, oscillator types (sine/triangle/sawtooth), target gain range.
  - Pulse layer: tempo multiplier, note pattern, waveform, gain range.
  - Filter: base cutoff, cutoff swing.
  - Master tint: subtle EQ/gain bias.
  - LFO periods (keep slow, incommensurate) tuned per vibe (calm slower, arcade faster).
- Persist the current vibe on the engine and expose:
  - `setVibe(vibe: MusicVibe)` — updates preset, retunes oscillators/tempo, saves to `localStorage` under key `roperush:musicVibe`.
  - `getVibe(): MusicVibe`.
- On engine construction, read `localStorage` (default `'arcade'` to match today's feel) and initialize oscillators from that preset.
- `updateMusicLayers` keeps the smoothstep + slow LFO drift logic, but reads its target gains/cutoff from the active preset instead of hard-coded numbers.
- No change to `musicGain`, hit ducking, mute, or ambient/void noise paths.

### 2. `src/game/ui/PauseOverlay.tsx` — vibe picker UI
- Add a compact segmented control (5 buttons) under the existing mute toggle: Calm / Tense / Arcade / Cinematic / Dark.
- Read initial value from `audio.getVibe()`, call `audio.setVibe(next)` on select, and keep local state so the active pill is highlighted.
- Style matches existing pause-menu buttons; no layout changes elsewhere.

### 3. Persistence
- Single `localStorage` key `roperush:musicVibe`. Guard reads with a try/catch so SSR/native WebView without storage falls back to default.

## Out of scope
- No new files, no new dependencies.
- No changes to gameplay, obstacles, background, ads, or leaderboard.
- Web/native parity unchanged — everything runs through the existing `AudioEngine`.

## Verification
- Pick each vibe from the pause menu → mix audibly changes within ~1s (smoothstep ramps).
- Reload the page / relaunch the app → last selected vibe is active from the first frame of the next run.
- Mute + unmute and hit-ducking still behave correctly across vibes.
