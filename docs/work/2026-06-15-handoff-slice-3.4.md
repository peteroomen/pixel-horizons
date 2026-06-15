# Handoff — Slice 3.4: Clone death + hazards + surface enemies

**From:** THE ARSENAL (mega-slice 4, `feature/the-arsenal`) — 2026-06-15
**For:** the next session. Assume you start cold.

## Where things stand

THE ARSENAL is done and on `feature/the-arsenal` (PR opening). 419 tests green. It was
combat/deck identity only — it **does not touch the surface code at all**, on purpose, so
3.4 drops in without collision. The run loop, economy, and Clone Bay re-prints are all
live, so clone death finally has real stakes.

Branch from `main` **after THE ARSENAL merges**.

## What 3.4 is

GDD §6.3, §6.7–6.10 (design is complete — read those first):

- Clone HP, death, backpack drop on death, corpse run to recover it.
- Free first print + Scrap re-prints (economy is live — `economy.ts`).
- Basic surface enemies + Rocky-biome hazards.

This is a new real-time AI/damage system and the GDD's thinnest mechanical area — it was
**deliberately split out of THE ARSENAL** for a design-led session. Do a GDD §6.7
surface-threat design pass up front before coding.

## Pointers

- Surface sim lives in `src/game/surface/` (`physics.ts`, `clone.ts`, `pod.ts`,
  `mining.ts`, `tilemap.ts`) — fixed-timestep, React/Pixi-free, all Vitest-covered.
- `clone.ts` is intentionally economy-free (the 3.2 invariant) — re-prints/Scrap belong in
  the orchestrator (`main.ts` / a surface mode), not in `clone.ts`.
- The `shield-bubble` planet item (from Shield Generator) is projected and shown in the HUD
  but **mechanically inert until damage sources exist** — 3.4 is when it turns on.
- Clone-matrix HP / melee-damage stats are recorded in data but inert until 3.4.
- OOB is solid; ABANDON (two-tap, `abandonSurface`) is the current pit escape valve —
  decide pit-death vs OOB semantics here.

## Gotchas

- **Node 22** (`nvm use 22`) before `pnpm install`/`dev`/commit, and `pnpm install` in a
  fresh worktree (node_modules isn't shared).
- **RunState is v3** now (`RUN_STATE_VERSION = 3`) — testers' old saves deserialize to null
  (expected). If 3.4 adds clone state to RunState, bump to v4 and add validation +
  round-trip tests in `run-state.test.ts`.
- **ADR 005 is missing** — code (`map-gen.ts`, `sim/events.ts`) cites "ADR 005" for the
  derived-stream determinism keystone, but the file was never written by THE RUN. Either
  write it retroactively or leave the citations; don't be confused by the gap.
- Push/PR with the `peteroomen`-scoped token (per memory) — origin pushes 403 otherwise.
- `next lint` is gone in Next 16 — use `eslint src` (already what `pnpm lint` runs).

## Knobs that help

`?mode=surface` drops straight onto the test planet with the resolved loadout (no run/save).
`?modules=` / `?reactor=` / `?hull=` to project specific clone items. `?pod=45` to keep the
pod loop short.
