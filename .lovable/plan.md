Restyle the three obstacle types in `src/game/engine.ts` to look like natural wooden traps while keeping gameplay hitboxes identical. Colors will be driven by the active theme's `accent` color so obstacles stay cohesive across day, sunset, night, and exotic palettes.

**Spikes**
- Replace the bright orange triangle with a tapered wooden stake.
- Body: natural wood browns (`#8a5a3a` base, `#5c3a22` shadow side, `#c9a86c` highlight).
- Danger tip: use the theme `accent` color for the sharpened point so it reads as a hazard in every palette.
- Add subtle wood-grain lines and a dark iron band near the base.
- Keep the same triangular collision shape; only the fill/stroke visuals change.

**Blades**
- Replace the yellow gear disc with a wooden spinning wheel that has metal blades bolted to it.
- Wheel: wooden disc with a darker rim and a central iron hub.
- Blades: theme `accent` color with a dark iron edge; rotate with `o.phase` as before.
- Add a small dark center bolt.
- Maintain the same circular hit area.

**Arrow warning marker**
- Replace the flat yellow warning triangle with a cracked wooden floor panel or a small wooden stake marker.
- Use the theme `accent` color for the warning glow/crack lines so the danger signal still pops.
- Keep the same bottom-screen warning timing and position.

**Flying arrow**
- Replace the cartoon arrow with a natural wooden arrow.
- Shaft: wood brown with a subtle grain line.
- Tip: theme `accent` stone/obsidian or metal tip.
- Fletching: natural feather tones (off-white / tan) instead of bright orange.
- Keep the same flight path and hitbox.

**Theme integration**
- Read the active theme's `accent` field (already stored on `this.theme`) and use it for all danger accents.
- Keep dark-background rim/glow behavior for readability against night/void themes, but tint the glow with `accent` instead of generic warm yellow.

**Verification**
- Run `build:dev` to confirm no TypeScript or runtime errors.
- Use Playwright to capture gameplay screenshots showing each obstacle type under at least two themes (e.g., day and night) to confirm the natural look and theme-tied accents read clearly.