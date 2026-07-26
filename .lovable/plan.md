Make the procedural music less "goofy" by improving tone and melody.

### Current state
`src/game/audio.ts` generates a single A-minor loop on a 16-step sequencer:
- Lead: square wave at 0.16 gain, large melodic jumps and an octave sparkle on downbeats
- Bass: sawtooth at 0.28 gain
- Low-pass filter opens with speed

The square-wave lead + bouncy melody is what usually reads as toy-like or circus-like.

### Plan

1. Warm up the tone
   - Change lead oscillator from `square` to `triangle` with a second, slightly detuned `sine` layer for body.
   - Change bass from `sawtooth` to `triangle` (or a quieter sawtooth + sub-sine) to remove buzziness.
   - Add a short attack-sustain-release envelope on the lead and bass so notes don’t snap on instantly.
   - Slightly raise the base filter cutoff so the sound is less muffled, but keep the speed-driven opening.

2. Rewrite the melody to feel more serious and less bouncy
   - Replace the current lead pattern with a slower, more atmospheric line:
     - Smaller interval jumps (mostly stepwise or small thirds)
     - Fewer octave doublings / remove the sparkle effect
     - Longer sustained notes on strong beats, shorter passing notes on weak beats
     - Keep the key in A minor but lean on the lower/mid register, avoiding the high "nursery rhyme" range
   - Make the bass line simpler and more grounded (root-fifth movement, less busy).

3. Add subtle note-to-note legato
   - Use a small portamento/slide on lead notes so the melody flows instead of jumping.

4. Keep the existing speed-response logic intact
   - Tempo still ramps 60 → 108 BPM with current easing.
   - Filter, energy, and layer mix still scale with `speedPct` and `voidAmt`.
   - The single-tune architecture and `musicOn`/`muted` controls remain unchanged.

5. Verify
   - Build the project to confirm no TypeScript errors.
   - Optionally run the preview to confirm the new loop plays and the mute/pause behavior still works.

### Files to change
- `src/game/audio.ts` (tone: oscillator choices, envelopes, detuning; melody: new note arrays, simpler rhythm, legato)

### Out of scope
- No new UI changes; the pause menu already has a mute toggle.
- No new music layer system; we keep the single catchy tune architecture.
- No new audio assets; everything stays procedural Web Audio.