# CB.3 module→ball projection + CB.4 renderer & playable route

**Date:** 2026-06-20
**Branch:** feature/cb3-cb4-bag-and-renderer (off the CB.1/CB.2 branch)
**Roadmap item:** Phase CB — CB.3 (module→ball) + CB.4 (renderer + playable)

## Goal

CB.3: installed modules project to the Core Breaker **bag** (alongside `deck.ts`), with reactor =
shots/drop and Clone Bay/Shield → surface passives. CB.4: a real Pixi renderer that plays the
deterministic sim, themed from the planet ramp, reachable as a playable route for testing.

## What was built

**CB.3 — `src/game/surface/ball-projection.ts` (+ `data/core-breaker.ts` tunables)**
- `projectSurfaceBag(modules, reactorLevel) → { balls, shotsPerDrop, passives }`, the surface twin
  of `generateCombatDeck`: module-list order, module count = ball copies.
- Ball role by module identity (§6.4): mining/light-laser/railgun → pierce, missile/flak/autocannon
  → bouncy, phase-shifter → phase, cargo-scanner → homing; unmapped weapon/utility → bouncy.
- Reactor level + Engine bonus shots + Repair-Matrix bonus → `shotsPerDrop`. Clone Bay matrices →
  surface passives (§6.9: Scavenger yield%, Enforcer extra-hit, Assault aim-assist, Repair shots,
  Standard baseline). Shield → survive-bloom.
- Mk tier buffs both faces: the ball carries `tier` + a tier-scaled `yieldMultiplier`
  (`BALL_TIER_YIELD`), while the card face already changes via `deck.ts`.
- **10 tests** incl. "Mk II yields a richer ball AND different cards than Mk I" (asserts both faces).

**CB.4 — `src/renderer/core-breaker-renderer.ts` + `src/app/core-breaker/page.tsx`**
- The renderer drives the **CB.1 sim** every sub-step (`step(ball, pegs, cfg)`) — the carom isn't
  re-implemented, so what's drawn matches the headless sim. Banks from the sim's authoritative
  `ev.drops` (× the flying ball's `yieldMultiplier`).
- Themed from the planet's R64 land ramp (`surfaceRampFor`): crust/hopper/mineral/hardrock pegs use
  ramp steps; ore/bloom/crystal get fixed distinct R64 hues so they read by colour **and** shape.
- Drag-to-aim/release-to-fire (pointer only, `touch-action: none` host), gravity-projected aim
  guide, shatter bursts, shots + banked (Scrap/Bio/Crystal) HUD, "tap to re-drop" on completion.
- Playable route `/core-breaker` composes the real pieces: `planetForNode` → `generateField`
  (CB.2) → `projectSurfaceBag` (CB.3) → renderer, deterministic from `?seed=`. Knobs:
  `?seed=`, `?modules=`, `?reactor=`, `?difficulty=`.

## What actually happened

- Caught that CB.1's `step` takes no `dt` (it uses `cfg.step`); fixed the renderer's accumulator to
  drive at `cfg.step` and call `step(ball, pegs, cfg)`.
- Switched banking to the sim's `ev.drops` instead of recomputing peg→resource in the renderer —
  removes duplication and keeps the renderer honest to the sim.
- Kept everything **additive**: did not touch `main.ts`/orbit. The orbit DROP → Core Breaker swap
  is deferred to land with the CB.7 platformer cleanup; `/core-breaker` is the playtest surface for
  now (the throwaway `/core-breaker-spike` still exists until then).

Verified: 561 tests green (10 new), `pnpm type-check` + `eslint src` clean, `pnpm build` generates
`/core-breaker`, dev route serves 200 (default + knobs). Browser/phone feel verification is a human
step (no GPU here).

## Files

- `src/game/data/core-breaker.ts`, `src/game/surface/ball-projection.ts` (+ test) — CB.3
- `src/renderer/core-breaker-renderer.ts`, `src/app/core-breaker/page.tsx` — CB.4
- `docs/design/core-breaker-ui-prompt.md` — the design-handoff prompt
- `docs/work/2026-06-20-cb3-cb4-bag-and-renderer.md`, `CLAUDE.md`

## Deferred

- Orbit DROP → Core Breaker wiring + `?mode=core-breaker` in `main.ts` (with CB.7 cleanup).
- Surface passives are projected but not yet consumed by the renderer (extra-peg-hit, aim-assist,
  survive-bloom, yield-percent) — wire when the design pass lands.
- Ball glyph grammar + dual-face `<ModuleCard>` (CB.5); Bloom spread soft-fail (CB.6).
- The design prompt's output (wireframes, peg/ball visual language) feeds a CB.4/CB.5 polish pass.

## Status

- [x] Complete — CB.3 + CB.4 landed; Core Breaker is playable end-to-end at `/core-breaker`.
