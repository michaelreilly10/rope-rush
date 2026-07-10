## Goal
Make Rope Rush harder via faster acceleration, denser obstacles, and trickier patterns — without making it feel unfair (still guarantee a reaction window).

## Changes (all in `src/game/engine.ts`)

### 1. Faster acceleration & higher top speed
- `SPEED_ACCEL`: `0.18` → `0.28` (ramps up ~55% faster).
- `MAX_SPEED`: `28` → `32`.
- `BASE_SPEED`: unchanged (6) so the start still feels fair.

### 2. More obstacles (denser spawn bands)
Tighten `bandSpawnGap` thresholds and shrink the reaction window slightly:
- `reactionWindow`: `0.9` → `0.75` seconds (still enough time to tap).
- `base` gaps by score band:
  - `<300`: `8` → `6.5`
  - `<800`: `6.5` → `5`
  - `<1500`: `5.5` → `4.2`
  - `<2500`: `5` → `3.6`
  - `≥2500`: `4.5` → `3.2`

### 3. Trickier patterns
Introduce blade obstacles earlier and weight them more heavily as score grows in `bandKinds`:
- `<200`: `["spike"]`
- `<450`: `["spike", "spike", "blade"]`
- `<900`: `["spike", "blade", "blade"]`
- `≥900`: `["spike", "blade", "blade", "blade"]`

Add same-side clustering in `spawnObstacle`: with a score-scaled probability (0 → 0.55), the newly spawned obstacle reuses the previous obstacle's side, forcing the player to hold rather than always alternate. Track `lastSpawnSide` on the `Game` class. To keep it dodgeable, cap the streak at 3 consecutive same-side spawns.

### 4. Small safety net
Since obstacles are tighter, keep the `minBySpeed` floor in `bandSpawnGap` so obstacles can never be closer than `speed * reactionWindow` meters apart — this preserves the "always dodgeable" guarantee at max speed.

## Not changing
- Lives, shield, coin behavior, visuals, audio.
- Theme progression / void logic.

## Verification
Run `bun run build:dev`; briefly playtest via Playwright to confirm the game still starts and obstacles spawn at reasonable initial pacing.