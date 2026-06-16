# Handoff — after Slice 3.4 (clone death + surface threats)

**From:** Slice 3.4 (`claude/tender-allen-kgp133`) — 2026-06-15. Assume you start cold.

## Where things stand

3.4 is **built** (not yet pushed — origin push 403s with the current env token;
the work is committed locally on the branch). 490 tests green; lint/type-check/
`pnpm build` clean; dev server serves `?mode=surface` 200. ADR 009 records the
design calls. Roadmap 3.4 can be checked off once merged.

The surface mode now has real stakes: clone HP, three enemies, three Rocky
hazards, the Shield Bubble live, death → corpse → corpse-run, free-first/Scrap
re-prints. All sim logic is in `src/game/surface/` and fully Vitest-covered.

## First thing to do

**A human browser/feel pass.** None of 3.4 has been played by a person yet.
`?mode=surface&modules=...&pod=45` drops you straight in. Things to feel out and
likely re-tune (all knobs in `data/surface.ts`):

- Enemy aggression/damage vs. the 1.5s i-frames — is it fair? Too easy?
- Knockback distance (`KNOCKBACK_VX/VY`) vs. pits — does it ever feel cheap?
- Crumble timings (`CRUMBLE_BREAK_MS`/`REFORM_MS`) and vent push (`VENT_PUSH_*`).
- Re-print cost (`REPRINT_SCRAP_COST = 15`) vs. how much Scrap a run actually has.
- 375px layout of the new HUD HP pips + the Cloning Bay overlay.

The threats live in `ROCKY_TEST_LEVEL` (`data/levels.ts`): a Hopper/Grubber/
Dropper on row 13, a bramble + vent on row 16, a floating crumbling ledge on
row 14. Treat the test level as a sandbox — re-place threats to exercise cases.

## Gotchas / pointers

- **Node 22** + `pnpm install` in a fresh worktree (node_modules isn't shared).
- Shield Bubble recharges on **cooldown**, not the GDD's "no passive recharge"
  (documented deviation, ADR 009). If you implement charge-by-movement, it's
  isolated to `clone.ts` `shield` + the `damageClone` absorb branch.
- Re-print economy is **only** in `main.ts` (`reprintClone` handle +
  `enrichSurfaceView`). The surface sim never reads `run.resources` — keep it that way.
- Vents push the clone via `updateClone(..., externalVx)` so collisions still
  resolve. Don't move the clone with a raw position offset.
- `RUN_STATE_VERSION` stayed at **3** — clone/re-print state is per-drop, never saved.
- **ADR 005 is still missing** (cited by `map-gen.ts`/`sim/events.ts` — pre-existing gap).

## Deferred from 3.4 (pick up explicitly)

- Assault Matrix **ranged clone attack** (2 HP only today — needs a projectile system).
- Procedural chunk-spawn density + flood-fill validation (map-gen, Phase 4/5).
- Volcanic/Ice hazards (5.3); corpse beacon polish; surface SFX (6.2).

## Likely next slices

- **4.9** deckbuilding acquisition & starting-deck audit, or
- **5.5** balance (now that surface threats + the 4.7 buff economy both exist to tune).
