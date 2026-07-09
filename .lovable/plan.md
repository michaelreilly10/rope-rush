Update the starting/default rope in `src/game/cosmetics.ts` so it looks like natural rope instead of neon cyan.

Changes:
- Change the `rope` skin's `color` from `#00d9ff` (neon cyan) to a natural hemp/tan color such as `#c9a86c`.
- Rename the skin from `"Neon Cable"` to `"Hemp Rope"` so the UI matches the new look.
- Remove the unused `glow` property from that skin since natural rope should not glow.
- Leave the `style` as `"neon"` (which currently falls through to the braided tick-mark renderer shared with the base rope style).

Verification:
- Run the typecheck/build to ensure no errors.
- Confirm in the live preview that the rope now appears as a natural tan/brown rope.