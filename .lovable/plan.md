Plan: Add multiple procedural music layers to Rope Rush

Current state: The game has one synthesized pentatonic drone pad in `src/game/audio.ts`. Its lowpass filter opens and volume rises as the player falls faster. It sounds the same regardless of background theme.

Goal: Replace the single music bed with several procedural Web Audio layers that fade in/out based on speed and theme, creating a richer, evolving soundtrack.

What I'll build

1. Layered music architecture in `src/game/audio.ts`
   - Define 3 simultaneous procedural layers:
     - Base pad: A slower, deeper drone (similar to the current pentatonic bed) that is always audible when music is on.
     - Pulse layer: A subtle rhythmic pulse/arp that fades in as speed increases, adding tension during fast falls.
     - Void layer: A dark, sparse ambient layer that fades in during the "void" and late-night themes, complementing the existing void ambient SFX.
   - Each layer gets its own `GainNode` and its own small oscillator/buffer set so volume can be crossfaded independently.

2. Dynamic mixing
   - Introduce one new method: `updateMusicLayers(speedPct, themeDarkness, voidAmt)`.
   - Base pad stays at a moderate level throughout.
   - Pulse layer gain rises from 0 to full as `speedPct` goes from 0.2 to 1.0.
   - Void layer gain rises as `voidAmt` increases and also blends with background darkness.
   - Keep the existing `musicOn` / `setMusic` / `setMuted` behavior intact; all layers respect the same mute toggles.

3. Hook it into the game loop
   - In `src/game/engine.ts`, replace the existing `audio.updateMusic(...)` call with `audio.updateMusicLayers(...)` and pass:
     - speed ratio
     - current theme's darkness value
     - computed void amount
   - Keep the existing SFX and ambient void drone code unchanged.

4. Verify
   - Test the game in the preview: music should start on the menu, remain a calm drone at low speed, grow more energetic as speed increases, and turn darker in the void.
   - Confirm muting from the pause overlay and settings panel still silences all layers.

Technical notes
- No external audio files or CDN assets will be used; everything stays generated via Web Audio API to keep the project lightweight and avoid binary assets.
- The existing `AudioEngine` class remains the single owner of music state; settings in `storage.ts` and toggles in `SettingsPanel`/`PauseOverlay` work without changes.

Files to modify
- `src/game/audio.ts` — add layer oscillators, gains, and `updateMusicLayers`.
- `src/game/engine.ts` — call the new mixer with speed + theme data.

No new dependencies or backend changes needed.