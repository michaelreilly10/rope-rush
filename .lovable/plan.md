## Goal

Repaint the game to look like a 90s Saturday-morning cartoon: thick black outlines, bright saturated flat fills, halftone/comic shading, no neon glows or gradients. All rendering changes stay in the canvas draw code — no gameplay changes.

## Visual language

- **Outlines**: every drawn shape gets a solid black stroke, 2–3 px, on top of a flat fill. Use `lineJoin: "round"` for chunky feel.
- **Fills**: flat, saturated cartoon colors. No radial gradients, no glow/shadowBlur.
- **Shading**: one lighter "highlight" wedge and one darker "shadow" wedge per major shape (cel-shading), plus tiny halftone dot clusters on large shapes (ninja body, big obstacles) for the comic-print texture.
- **Motion accents**: comic speed lines behind the ninja at high speed instead of the current motion blur alpha trail.

## Palette (bright cartoon, replaces neon)

Redefine the 3 `THEMES` in `src/game/engine.ts`:

- **Sunny Rooftops**: sky `#8ec7ff`, far `#5aa8ff`, near `#f6c744`, beam `#c76b2a`, accent `#ff5d5d`, lantern `#ffd23f`
- **Jungle Cartoon**: sky `#b7e86a`, far `#5aa84a`, near `#2f6b2a`, beam `#7a4a1a`, accent `#ff8a3d`, lantern `#ffe14a`
- **Comic Sunset**: sky `#ffd06a`, far `#ff8a3d`, near `#c74a6b`, beam `#5a2a5a`, accent `#3ac0ff`, lantern `#fff2a8`

Background draw: solid sky band + big flat cloud shapes (rounded blobs with black outlines) parallax-scrolling, plus a distant flat silhouette skyline. Remove the current gradient/star field.

## Ninja restyle (canvas)

- Body: round-cornered rectangle torso + round head, both filled with `char.body`, stroked black 2.5px.
- Face: white eye-patch strip with two big pupils; mouth a small curved line. Big cartoon eyes are what sells "90s cartoon".
- Sash: `char.sash` flat band with black outline, small trailing tail that wobbles with a sine.
- Trim/headband color = `char.trim`, plain flat.
- Remove any glow / shadowBlur currently used on the ninja.
- Add halftone dots (2 px, low-alpha black) inside the torso for print texture.

## Rope restyle (canvas)

- Draw as a thick flat colored stroke (`rope.color`, 8 px) with a black outline stroke (11 px) underneath — instant "inked" look.
- Chain style: alternating black-outlined pill links. Vine: same base + small leaf triangles every N pixels. Neon: stays bright fill but with black outline (no blur).
- Remove `shadowBlur` glow on all rope styles.

## Obstacles restyle

Same recipe — flat fill + thick black outline + one cel highlight:
- **Spike**: bright red-orange triangle, black outline, white highlight sliver on left edge.
- **Blade**: yellow disc with black gear teeth outline, dark center hub, spinning as today.
- **Arrow**: cartoon arrow with feather fletching, black outline.
- **Fire**: layered orange/yellow flame blobs with outlines instead of additive glow.
- **Coin**: flat gold disc, black outline, small "$"-style shine mark.

## Motion & effects

- Replace the trailing-alpha motion blur with **speed lines**: 4–6 short black lines drawn behind the ninja whose count/length scale with `speed / MAX_SPEED`.
- Particles (smoke, sparkle, hit burst): keep positions, but render as outlined puffs (small black-stroked circles) instead of soft blurred dots. Hit burst becomes a comic "POW"-style starburst polygon.
- Remove all `ctx.shadowBlur` usage across draw calls.

## HUD / menu tone alignment

- Swap display font utility in `src/styles.css` `@utility font-display` from `Archivo Black` to a chunky cartoon face (`"Bangers", "Luckiest Guy", "Archivo Black", system-ui`) and install `@fontsource/bangers` + `@fontsource/luckiest-guy`, imported in `src/router.tsx` (or wherever fonts are loaded).
- Body font: keep Hind (already cartoony-friendly) or switch to `Fredoka`. I'll keep Hind unless you say otherwise.
- No component/layout changes to HUD, MainMenu, GameOver, Leaderboard — just the font swap flows through.

## Files touched

- `src/game/engine.ts` — themes array, all draw functions (ninja, rope, obstacles, coins, particles, background, motion effect).
- `src/styles.css` — `font-display` utility stack.
- `src/router.tsx` (or `src/routes/__root.tsx`) — `@fontsource/bangers` import.
- `package.json` via `bun add @fontsource/bangers` — new dep.

## Out of scope

- No changes to game logic, physics, spawner, difficulty, leaderboard, or UI structure.
- No new obstacle types; existing ones are just repainted.
- Cosmetic shop entries in `src/game/cosmetics.ts` keep their IDs and prices; only their rendering changes via the new draw code.

## Technical notes

- Canvas outlines: draw fill first, then `ctx.strokeStyle = "#0a0a0a"; ctx.lineWidth = 2.5; ctx.stroke()` — cheap and pixel-consistent.
- Halftone: precompute a small offscreen pattern canvas once and reuse via `ctx.createPattern` to avoid per-frame cost.
- Speed lines: short `moveTo/lineTo` segments seeded off the RNG, alpha 0.5, black — no additional pool needed.
- All changes stay inside the existing draw functions; no new modules.
