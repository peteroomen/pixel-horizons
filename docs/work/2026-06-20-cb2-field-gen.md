# CB.2 — Core Breaker field generation

**Date:** 2026-06-20
**Branch:** claude/brave-hamilton-yds2fo (stacked on CB.1)
**Roadmap item:** Phase CB — CB.2 (field generation, sim-only)

## Goal

`src/game/surface/field-gen.ts`: a deterministic `Peg[]` from the `PlanetDescriptor` (run seed +
node id, ADR 010) + difficulty, with §6.7 peg-type weighting (Bloom guarding ore/crystal) and the
invariant that every emitted peg is reachable by at least one launch trajectory. Replaces the
platformer's `tilemap.ts` chunk grammar.

## Approach

- **Seeded from the descriptor:** `createRng('core-breaker-field:{seed}:{type}:{difficulty}')` —
  same descriptor + difficulty ⇒ identical field.
- **Funnel layout:** a jittered grid that is **narrow at the top** (only the centre is reachable
  from the launch point) and **widens to full width by the floor** — matching the reachable zone
  so pegs aren't generated where no shot can land. Off-row offset + gaps break up the lattice.
- **Weighting (§6.7):** mostly mineral, then hardrock/ore, crystal rare and **deep only**
  (shallow crystal rolls fall back to ore). Ore/crystal richness scales with difficulty.
- **Bloom as guards:** after layout, convert a plain peg sitting just above an ore/crystal reward
  into a Bloom growth (risk gates reward), probability scaling with difficulty.
- **Reachability invariant via CB.1:** `isReachable(peg, cfg)` fans pierce shots (9 angles × 4
  powers) at a lone copy of the peg using `simulateShot`; field-gen filters out anything no
  trajectory can touch (a cheap safety net now that the funnel matches the reachable region).

## What actually happened

Built to plan. Caught two things via tests:

1. **Rectangular layout wasted ~half the pegs.** A plain rectangle put pegs in the upper corners
   that are physically unreachable (too far horizontally for the small vertical drop near the
   launch), so the reachability filter dropped them and the peg count fell below the sane floor.
   Replaced the rectangle with the **funnel** (narrow top → wide bottom) so pegs live in the
   reachable zone; counts stabilised (~34 at difficulty 0, ~60 at difficulty 4) with minimal
   filtering. Also reads better — a Peglin field naturally funnels.
2. **A dead `PROBE_ANGLES === 1` guard** tripped the strict-TS no-overlap check (it's a literal
   9). Removed it.

Measured distributions (probe, removed after): d0 ≈ 34–36 pegs (mostly mineral, ~7–9 ore, a few
Bloom, crystal absent/rare); d4 ≈ 59–63 pegs (more ore, ~12 Bloom guards, occasional crystal) —
matches the §6.7/§6.6 "crystal extremely rare" intent.

Verified: 7 new tests green, full suite **551 green**, `pnpm type-check` + `eslint src` + build
clean.

## Files created / modified

- `src/game/surface/field-gen.ts` (new — seeded layout + reachability)
- `src/game/surface/field-gen.test.ts` (new — 7 tests: determinism, reachability invariant,
  bounds/unique ids, sane count, difficulty density, Bloom-guards-a-reward)
- `docs/work/2026-06-20-cb2-field-gen.md` (this plan)
- `CLAUDE.md` (Current State)

## Out of scope

Biome-specific layouts/physics modifiers (only `terran` exists today — §6.8 Ice/Volcanic/etc. are
later), module→ball/bag (CB.3), renderer (CB.4), Bloom spread over time (CB.6), wiring field-gen
into the live drop / `?mode=` knob (CB.4).

## Status

- [x] Complete — CB.2 field-gen landed, stacked on CB.1. Next: CB.3 module→ball projection.
