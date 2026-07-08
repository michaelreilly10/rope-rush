## Goal
Make the void background more atmospheric by adding a constantly shifting vertical color gradient that fades from the bottom of the screen to the top, while keeping the existing starfield and gameplay layers intact.

## What will change

1. **Void-only vertical gradient**
   - In `renderBackground()`, when the current blended theme is the void, draw a full-screen vertical gradient behind the stars.
   - The gradient will start with one color at the bottom and fade to another color at the top.

2. **Constantly shifting colors**
   - The bottom and top colors will cycle smoothly through deep space hues (purple, blue, crimson, teal, magenta, indigo) using a slow time-based oscillator.
   - The cycle will be continuous so the background never looks static during a void run.

3. **Blend with existing theme crossfade**
   - The gradient opacity/strength will scale with the void amount (`voidAmt`) so it fades in as the player enters the void and stays at full strength once locked there.
   - Non-void themes will keep their current flat background behavior.

## Files to edit
- `src/game/engine.ts` — add the animated gradient draw inside `renderBackground()`.

## Out of scope
- No changes to obstacles, rope, coins, particles, or audio.
- No changes to theme progression logic (void remains permanent once reached).
- No new assets or dependencies.