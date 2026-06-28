# Rope Rush — Build Plan

A polished portrait mobile web game built as a single-page TanStack Start route. Pure client-side, no backend needed for v1 (coins/best score/unlocks persisted to `localStorage`). Ads are stubbed with a clean interface so a real ad SDK can drop in later.

## Scope for v1

In:
- Core loop: tap to switch sides, scrolling fortress, speed ramp + partial reset on hit, 3 lives, distance score, coins, combos with the 4 milestone rewards.
- Obstacle types: spikes, rotating blades, fire traps, crossbow arrows (the four needed to cover all difficulty bands). Swinging axes, broken rope, falling rocks, explosive barrels stubbed in the obstacle registry as TODO variants so they're trivial to add.
- Difficulty bands exactly as specified (0–300 spikes only, etc.).
- Environment themes: Castle, Temple, Bamboo Forest (3 of the listed 7 fully styled; the rest registered as theme presets so adding them is a config change).
- Cosmetics: full shop UI + unlock/equip for characters, rope skins, trails. Visuals shipped for ~3 of each; rest defined as locked entries with price + unlock flow.
- Audio: Web Audio sfx + adaptive music intensity (single track with low-pass filter that opens as speed rises; calms briefly after a hit).
- UI: HUD, pause, game over with Continue (rewarded-ad stub, once per run) / Retry / Home, main menu, shop.
- Polish: screen shake, particles (smoke on swap, sparkle on coin, hit burst), motion blur at high speed, 60fps target via `requestAnimationFrame` + object pooling.

Out (call out explicitly so the user can confirm):
- Real ad network integration — stubbed behind `AdService` interface.
- Native iOS packaging — this is a mobile-web PWA; can be wrapped in Capacitor later.
- Online leaderboards / accounts.

## User flow

```text
Main Menu  ──►  Game  ──►  Game Over  ──►  (Continue ad | Retry | Home)
   │                                              │
   ├──► Shop (characters / ropes / trails)        │
   └──► Settings (sfx, music, haptics)  ◄─────────┘
```

## Architecture

Single route `src/routes/index.tsx` renders `<RopeRush />`. All game code lives under `src/game/`.

```text
src/game/
  RopeRush.tsx              # mounts canvas + React HUD overlay, owns GameLoop
  engine/
    GameLoop.ts             # rAF loop, fixed-timestep update + render
    Camera.ts               # vertical scroll, shake
    Input.ts                # pointerdown → swap side
    Pool.ts                 # generic object pool
    Rng.ts                  # seeded RNG for fair runs
    Audio.ts                # Web Audio: sfx bank + music intensity
    Storage.ts              # localStorage wrapper (best, coins, unlocks, settings)
    AdService.ts            # interface + stub impl (resolve after fake delay)
  state/
    GameState.ts            # run state machine: menu | playing | hit | gameover | paused
    Progression.ts          # speed curve, partial-reset table, combo milestones
    Difficulty.ts           # band → allowed obstacle types + spawn weights
  entities/
    Ninja.ts                # side (L/R), anim state, invuln timer
    Rope.ts                 # rope render + skin
    Obstacle.ts             # base + Spike, Blade, Fire, Arrow (registry)
    Coin.ts
    Particle.ts             # smoke, sparkle, hit burst
  world/
    Spawner.ts              # pattern generator per difficulty band
    Theme.ts                # palette + decor (lanterns, beams, petals) per area
    Decor.ts                # background parallax layers
  cosmetics/
    catalog.ts              # characters, ropes, trails (id, price, render hooks)
  ui/
    HUD.tsx                 # score, coins, hearts, pause btn, combo meter
    MainMenu.tsx
    Shop.tsx                # tabs: Characters | Ropes | Trails
    GameOver.tsx
    PauseOverlay.tsx
    Settings.tsx
  hooks/
    useGame.ts              # React ↔ engine bridge (subscribe to state)
```

Rendering: HTML5 Canvas 2D for the game world (cheap, hits 60fps on iOS Safari, easy particles and motion blur via alpha-fill trails). React renders only the HUD/menus on top — keeps UI ergonomic without re-rendering the game.

## Key systems

- **Speed**: `speed = clamp(base + t * accel, base, max)`. On hit: `speed = max * resetPct(score)` using the spec's table.
- **Spawner**: emits obstacle "patterns" (hand-authored templates) chosen by current difficulty band, scaled by speed. Templates encode side(s), spacing, and required gap so runs stay fair.
- **Combo**: increments on each obstacle passed without hit; thresholds 10/25/50/100 trigger coin x2, slow-mo (0.6x for 3s), shield (absorbs next hit), golden rope (visual only). Reset on hit.
- **Pooling**: `Pool<Obstacle>`, `Pool<Coin>`, `Pool<Particle>` — no GC churn during runs.
- **Themes**: every 500–1000m, crossfade `Theme` palette + decor set. Gameplay unaffected.
- **Audio**: one base music loop; speed maps to a low-pass cutoff and gain on a percussion layer. Hit triggers a 1.2s duck.
- **Persistence**: `{ bestScore, coins, unlocked: {chars,ropes,trails}, equipped: {...}, settings }` in `localStorage` under a versioned key.
- **Ads**: `AdService.showRewarded(): Promise<'completed'|'dismissed'>`. Stub resolves `'completed'` after 1.5s with a fake overlay so the Continue flow is fully playable.

## Visuals

Distinct hand-drawn-feeling aesthetic — not generic neon. Dark indigo castle interior, warm lantern orange, ink-brush silhouettes for beams/banners, soft falling sakura petals. Ninja is a chunky silhouette with a colored sash (sash color = equipped skin accent). Rope is a thick braided stroke; skins swap stroke style + glow.

Design tokens (palette, fonts) added to `src/styles.css` so HUD/menus stay consistent with the canvas art. Display font: a brush/serif display face (e.g. Shippori Mincho) paired with a clean sans for HUD numerals.

## Build order

1. Scaffold `RopeRush` route + canvas mount + GameLoop + Input + Camera scroll.
2. Ninja + Rope + side-switch with spin/smoke; HUD with score/hearts/coins.
3. Spawner + Spike obstacles + collision + lives/invuln + partial-speed reset.
4. Coins + combo system + milestone rewards.
5. Remaining obstacle types gated by difficulty bands.
6. Themes + parallax decor + area transitions.
7. Audio (sfx + adaptive music).
8. Main menu, pause, game over, rewarded-ad stub, settings.
9. Shop + cosmetics catalog + equip/unlock + persistence.
10. Polish pass: screen shake, particles, motion blur, haptics (`navigator.vibrate`), perf check.

## Open question

Should I proceed with the stubbed `AdService` (real ad SDK wired in later) and `localStorage` persistence (no account/cloud sync), or do you want Lovable Cloud enabled now for cross-device coin/unlock sync?
