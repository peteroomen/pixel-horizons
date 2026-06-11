# ADR 004: Fixed-Timestep Accumulator Loop and Mode Switch

Date: 2026-06-11
Status: Accepted

## Context

Combat (Phase 2) was turn-based: the game loop only ran when the player pressed a
button, so the Pixi ticker was idle except for hit-flash decay. The surface platformer
(Phase 3) needs a real 60 Hz simulation loop: physics integrate every fixed 1/60 s
step regardless of display refresh rate or frame timing variance.

Two design choices needed documenting:

1. **How to run a fixed-timestep loop without blocking React.**
2. **How to switch between combat and surface modes until the sector map (Slice 4.1)
   drives mode entry.**

## Decision

### Fixed-timestep accumulator (combat equivalent: none)

`main.ts` runs a classic accumulator loop on the Pixi ticker:

```ts
acc += Math.min(ticker.deltaMS, MAX_FRAME_MS); // spiral-of-death guard
while (acc >= FIXED_DT_MS) {
  updateSurface(state, input, FIXED_DT_MS);
  acc -= FIXED_DT_MS;
}
surfaceRenderer.sync(state);  // draw once per rAF — correct for Pixi
```

- `FIXED_DT_MS = 1000/60` ms — 60 sim steps per second regardless of display Hz.
- `MAX_FRAME_MS = 250` ms — caps elapsed time consumed in one rAF; the loop never
  "catches up" more than ~15 steps, preventing the spiral of death when the tab
  backgrounds.
- `surfaceRenderer.sync()` is called **once per rAF frame** (not once per sim step) —
  this is correct because Pixi's ticker already fires once per `requestAnimationFrame`.
  Render interpolation is deferred; at 60 Hz display it is invisible.
- React is never updated inside the game loop — the `onCombatUpdate` callback pattern
  (one call per discrete event) is preserved. Surface mode fires `onModeChange` once
  at init; React state never changes at 60 fps.

### Mode switch via `?mode=` query param

Until the sector map (Slice 4.1) drives mode entry, `resolveMode()` reads
`?mode=surface` from the URL. This mirrors the existing `?enemy=` and `?hull=` knobs.
`GameHandle.mode` is a readonly field so React can gate UI rendering.

The `GameCallbacks.onModeChange` optional callback fires once after init. React's
`page.tsx` stores the mode in state and renders `TouchControls` in surface mode or
the HUD/hand in combat mode — switching at the component level, not mid-session.

Surface combat commands (`playCard`, `useInnate`, etc.) are no-ops on the handle.
Combat mode's `surfaceInput` is a no-op. This avoids any cross-mode state leak.

## Consequences

**Easier:**
- Physics determinism is trivially preserved: same `FIXED_DT_MS` everywhere, no
  floating-point variance from variable dt.
- Replay/test scripts work: the same `InputState[]` produces identical `CloneState`
  regardless of display frame rate.
- Adding a second mode (Sector Map, Workbench) in Phase 4 follows the same pattern.

**Harder / trade-offs:**
- No render interpolation this slice: at display rates above 60 Hz the clone moves
  in discrete steps. Acceptable for an 8-bit aesthetic; retrofit is additive.
- The `?mode=` knob is temporary scaffolding — must be replaced by proper mode entry
  from the sector map in Slice 4.1 (see Deferred in the plan file).
- Two separate handle shapes (surface / combat) share one `GameHandle` interface via
  no-op methods. A discriminated union would be cleaner but requires a larger React
  refactor; the guard pattern is the established project convention.
