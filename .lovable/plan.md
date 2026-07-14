## Why music is silent

Reading `src/game/audio.ts` carefully after the last change:

- `musicGain` is set directly to `1` in `startMusic`, which is correct.
- But the actual **oscillator → layer-gain → filter → master** chain now produces almost no audible signal:
  - Per-oscillator gain is `0.05`, and `baseGain` starts at `0` and only creeps toward `0.05` via `setTargetAtTime(τ=0.8s)`, which is re-anchored every frame (each frame restarts the approach, so it lags badly).
  - `musicFilter` is a lowpass at `600 Hz` at rest and drops to `340 Hz` at low speed, which is exactly where the melodic content lives — the pulse layer (220–494 Hz) is heavily attenuated and the base pad is barely above the noise floor.
  - The separate "void ambient" path connects straight to `master` and uses much higher per-oscillator gains (`0.22–0.25`) plus a noise buffer, so it's the only thing loud enough to hear.
- Net effect: the graph is technically running, but the music mix is ~30 dB quieter than the ambient path, so the player perceives "no music".

There's also a small robustness issue: `musicGain.gain.value = ...` is a direct-value assignment done while the `AudioContext` can still be suspended. On iOS this occasionally doesn't take. It should be a scheduled event after `ctx.resume()`.

## Fix

Edit `src/game/audio.ts` only. No UI or engine changes.

1. **Make the audio actually loud enough.**
   - Bump per-oscillator gains in the base pad from `0.05` to ~`0.14`, and in the pulse layer from `0.028` to ~`0.06`.
   - Bump layer-gain targets in `updateMusicLayers`: base target range `0.18 → 0.35`, pulse target range `0 → 0.30`.
   - Initialize `baseGain.gain.value` to a small non-zero level (e.g. `0.15`) so the pad is audible from the very first frame — no waiting for `setTargetAtTime` to creep up.

2. **Open the shared lowpass filter.**
   - Start the `musicFilter` cutoff at `1200 Hz` (was `600`) and let `updateMusicLayers` open it further with speed (`1200 → 5500 Hz`). This lets the mid/high harmonics of both layers through so the music is actually recognisable at rest.

3. **Schedule `musicGain` properly.**
   - In `startMusic`, after calling `ctx.resume()`, use `musicGain.gain.setValueAtTime(musicOn ? 1 : 0, ctx.currentTime)` instead of a raw `.value = ...` assignment. Same in the repeat-run branch. This is what iOS Safari expects and it also avoids clashing with any lingering automation from a previous `sfx('hit')` duck ramp.

4. **Stop re-anchoring `setTargetAtTime` every frame.**
   - In `updateMusicLayers`, keep the same target math but only re-call `setTargetAtTime` when the target has changed meaningfully (e.g. by more than ~2%). This lets each ramp actually reach its target instead of restarting the exponential approach 60 times a second.

5. **Sanity-check the hit duck.**
   - Leave the ducking behavior intact, but after the ramp back to `musicOn ? 1 : 0`, ensure `duckUntil` is used only for the layer volume compression path (it already is). Nothing else changes here.

## Verification

- Load the preview, tap to start a run, listen for the base pad within the first second (should be immediately audible, not a slow crescendo).
- Ride into the void — the void music layer plus the existing ambient noise should stack on top of the base, but the base pad should not disappear.
- Trigger a crash — music should duck briefly and come back to full volume after ~1 s.
- Retry — music should resume from the very first frame of the new run.

## Out of scope

- No changes to `engine.ts`, `RopeRush.tsx`, `PauseOverlay.tsx`, or storage.
- No change to the mute-toggle behavior or saved settings.
- No new SFX; the "beeping" removal from earlier stays as-is.
