## Goal
Redesign spike and blade obstacles so they read as smooth, polished shapes and stay highly visible against every background (day, sunset, night, void, exotic colors).

## Approach

Move away from the current wood/iron detail work (grain lines, bolts, small band details) toward clean, high-contrast silhouettes with a bright outer halo that works on any theme.

### Universal visibility system (in `src/game/engine.ts`)
- Add a helper that picks a guaranteed-contrast "signal" color per frame based on the current background luminance:
  - Bright backgrounds (day/sunset) → deep charcoal core with a warm white/gold rim.
  - Dark backgrounds (night/void/exotic) → soft white core with a cyan/magenta glow rim.
- Apply this system to both obstacle types so they always pop, replacing the current darkness-only rim boost.

### Spikes — smooth crystal shard
- Replace the tapered wooden stake + grain lines with a smooth 4-point crystal/shard silhouette drawn as a single filled path.
- Add a soft inner gradient (light tip → darker base) for depth, no strokes inside.
- Single crisp outer stroke plus a soft outer glow halo (2–3 px, alpha ~0.5) using the signal color.
- Small elliptical shadow "socket" at the base where it meets the wall for grounding.

### Blades — smooth saw disc
- Replace the wooden wheel + individual bolts with a smooth metallic disc:
  - Radial gradient body (light center → darker rim).
  - 6 evenly spaced rounded teeth generated with a smooth path (quadratic curves), not sharp triangles.
  - Single hub dot in the center, no bolt ring.
- Spin animation preserved (existing `phase` value).
- Outer glow halo in the signal color, scaled with darkness so it's visible on day themes too but subtle.

### Consistency polish
- Both obstacles share the same halo thickness and stroke width so they feel like one family.
- Keep collision math, sizes, and side positioning identical — this is purely visual.

## Technical details
- Only `renderSpike` and `renderBlade` inside `src/game/engine.ts` change, plus a small new `signalColors(theme, darkness)` helper near the existing theme utilities.
- No changes to obstacle spawn logic, collision, physics, types, or audio.
- No new assets or dependencies.

## Not changing
- Spawn spacing, speed, difficulty.
- Player, rope, clouds, stars, background.
- Obstacle sizes and hitboxes.

## Verification
Run `bun run build:dev`, then Playwright screenshots on day, night, and void themes to confirm the obstacles are clearly visible on all three.
