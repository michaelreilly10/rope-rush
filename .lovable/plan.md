## Goal
Make the music's speed-driven intensity ramp feel smooth from start to top speed and stay interesting over multi-minute runs, without changing sfx, ambient void noise, or the layer architecture.

## Problems with the current mapping (`updateMusicLayers` in `src/game/audio.ts`)
- `easeSlow = s^4` keeps the pulse layer near-silent until very high speeds, then lifts abruptly — feels binary rather than smooth.
- `easeMid = s^3` on both filter cutoff and base pad means they move in lockstep, so intensity has one axis and repeats identically every run.
- No time-based variation: at a fixed speed the mix is numerically constant, which is what makes long runs feel repetitive.

## Changes (single file: `src/game/audio.ts`)

1. Smoother speed curve
   - Replace `easeSlow` (quartic) and `easeMid` (cubic) with a shared smoothstep `sCurve = s*s*(3 - 2*s)` plus a gentle `sSlow = sCurve * s` for the pulse layer. Result: pulse starts lifting earlier and more gradually; base pad and filter still bias toward higher speeds but without the flat "dead zone" at low speed.

2. Slow evolving modulation (breaks repetition on long runs)
   - Add a private `musicT0` timestamp captured on first `updateMusicLayers` call.
   - Compute `elapsed = now - musicT0` and derive two slow sines at incommensurate periods (~23s and ~37s) with small amplitudes:
     - `filterMod` ±350 Hz on the shared low-pass cutoff.
     - `pulseMod` ±0.05 on pulse gain.
     - `baseMod` ±0.02 on base gain.
   - These are tiny per-frame deltas but keep the mix drifting so it never sits on the exact same values for long.

3. Keep the "changed()" gate but widen its tolerance slightly (0.02 → 0.015) so the slow modulation actually reaches the audio graph instead of being filtered out as "no change".

4. Preserve everything else
   - Ducking on hit, `musicGain` ownership by `setMusic/startMusic/sfx('hit')`, void layer behavior, and ambient noise path all stay identical.

## Technical notes
- Modulation uses `Math.sin(2π * elapsed / period)`; cheap, deterministic, no extra nodes.
- Filter target becomes `1200 + sCurve * 4300 + filterMod`, clamped to `[500, 6500]` so ducking still wins.
- Pulse target: `sSlow * 0.30 + sCurve * pulseMod` (modulation scaled by `sCurve` so it doesn't ripple at rest).
- Base target: `0.18 + sCurve * 0.17 + sCurve * baseMod`.
- No new nodes, no re-init on retry — `musicT0` persists across runs so the drift keeps evolving.

## Out of scope
No changes to layer count, instrument voices, sfx, void ambient noise, or UI. This is purely a mapping/curve tweak inside `updateMusicLayers`.
