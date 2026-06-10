# Sim Skeleton — Seeded RNG, RunState, Save/Load, Seed-in-URL

**Date:** 2026-06-10
**Branch:** feature/sim-skeleton
**Roadmap item:** Phase 1 — Slice 1.2 Sim skeleton

## Goal

A fully unit-tested deterministic sim foundation: seeded PRNG, serializable `RunState` with save/load behind a storage interface, and seed-in-URL parsing — same seed ⇒ identical state streams. No UI.

## Approach

Everything in `src/game/sim/` is pure TypeScript — no React, no PixiJS, no DOM globals. The localStorage adapter lives one level up and receives the storage backend by injection so the sim stays Vitest-pure.

- **`sim/rng.ts` — seeded PRNG.** String seed (human-shareable, e.g. `?seed=crimson-lamprey`) hashed to 32-bit state (xmur3-style hash → mulberry32 generator — tiny, fast, well-distributed, no dependency). The generator's full state is a plain serializable object `{ seed, state }`, so a deserialized run continues its random sequence exactly where it left off. API: `createRng(seed)`, `next()` (float [0,1)), `int(min, max)`, `pick(array)`, `shuffle(array)` (returns new array).
- **Named sub-streams.** `deriveRng(seed, label)` creates independent streams (`"map-gen"`, `"combat"`, `"surface"`, …) by hashing `seed + ":" + label`. This is the load-bearing determinism decision: consuming randomness in combat must not desync map-gen, otherwise replays/daily seeds break the moment systems interleave differently.
- **Seed generation entropy:** `newSeed()` uses `crypto.getRandomValues` (available in Node 22 and all target browsers) to pick readable base36 seeds. This is the *single* place true randomness enters the game; everything downstream flows through the seeded PRNG. (`Math.random` stays banned.)
- **`sim/run-state.ts` — `RunState` type + (de)serialization.** Versioned plain-JSON shape: `{ version, seed, hullId, hullHp, resources: { scrap, biominerals, coreCrystals, blueprints }, modules: string[], position: { sector, nodeId }, rng: { [stream]: RngState } }`. Module/hull IDs are plain strings for now — the data catalog is Slice 1.3. `createRunState(seed)`, `serializeRunState(state): string`, `deserializeRunState(json): RunState | null` — returns `null` (never throws) on corrupt JSON, wrong version, or missing/mistyped fields, so a bad save degrades to "no save" instead of crashing the app.
- **`src/game/save.ts` — save/load behind an interface.** `SaveStore` over an injected `StringStorage` (`getItem/setItem/removeItem` — the subset of the Web Storage API we need). Browser code will pass `window.localStorage`; tests pass an in-memory map; Phase 7 swaps in a Supabase-backed implementation behind the same interface (per roadmap 7.1). Single save slot under one namespaced key.
- **`sim/seed-url.ts` — seed-in-URL parsing.** Pure functions: `parseSeedParam(search: string): string | null` (validates/normalizes `?seed=...`) and `seedToSearchParam(seed): string`. No `window` access — the caller passes the search string. Wiring it into the page is out of scope (no UI this slice).

## Steps

- [x] Branch `feature/sim-skeleton`
- [x] `sim/rng.ts`: hash + mulberry32 PRNG, serializable state, `next/int/pick/shuffle`, `deriveRng`, `newSeed`
- [x] `sim/rng.test.ts`: same seed ⇒ identical long sequences; different seeds/labels diverge; mid-stream serialize → restore → identical continuation; `int` bounds inclusive-exclusive correctness; `shuffle` is a permutation and deterministic
- [x] `sim/run-state.ts`: `RunState` type, `createRunState`, `serializeRunState`, `deserializeRunState` with validation
- [x] `sim/run-state.test.ts`: round-trip deep-equality; rejects corrupt JSON, wrong version, missing fields; fresh state from same seed is identical
- [x] `src/game/save.ts` + `save.test.ts`: save/load round-trip via memory backend; `load()` with nothing saved ⇒ null; corrupt stored payload ⇒ null, store untouched until next save
- [x] `sim/seed-url.ts` + `seed-url.test.ts`: present/absent/empty/garbage params; round-trip through `seedToSearchParam`
- [x] Remove `src/game/sim/.gitkeep`; `pnpm lint` + `type-check` + `test` green
- [x] Post-session: fill in outcome sections, update CLAUDE.md Current State, PR

## Manual test steps

This slice has no UI by design, so verification is test-suite-driven plus a determinism spot-check:

- [x] `pnpm test` — full suite green (new RNG/RunState/save/seed-url tests + existing scaffold tests): 41 tests, 5 files
- [x] `pnpm type-check` and `pnpm lint` — clean
- [x] Determinism spot-check across processes: temp test printed the first 10 values for seed `"test-seed"` in two separate `vitest run` invocations — byte-identical output (guards against accidental ambient state/`Math.random` leakage)
- [x] Edge case: in the same script, deserialize a hand-mangled RunState JSON (truncated string) — returns `null`, no throw
- [x] Grep check: `grep -rn "Math.random" src/` — only hit is the doc comment in `rng.ts` stating the ban; no calls

## Out of scope for this session

- Data catalog, hulls/modules/cards content, deck generation (Slice 1.3) — IDs are placeholder strings
- Any UI: wiring seed-url into the page, save/resume screens (Phase 4.5)
- `src/game/main.ts` integration with React/GameCanvas
- Map generation, combat, travel — `rng.ts` consumers come later
- Supabase storage backend (Phase 7) — interface shape only
- Save migrations between versions — wrong version simply invalidates (acceptable pre-release)

---

<!-- Fill in below during/after the session -->

## What actually happened

Went to plan; no approach changes. Details worth recording:

- `int(min, max)` is exclusive-upper `[min, max)` and throws on empty/inverted ranges; `pick` throws on empty arrays (programming errors should fail loudly in the sim, unlike save corruption which degrades to null).
- `deserializeRunState` rebuilds the object field-by-field, so unknown extra properties in a stored payload are dropped rather than carried along — tested.
- `getState()` snapshots by value; restoring the same snapshot twice yields identical streams (aliasing bug guarded by test).
- `createRunState` defaults `hullId` to `'hull-scout'` as a placeholder until the Slice 1.3 catalog defines real hull ids.
- Seed charset locked to `/^[a-z0-9-]{1,64}$/` (lowercased on parse); `newSeed()` emits two base36 words joined by `-` from `crypto.getRandomValues`.
- Worktree needed its own `pnpm install` before tests would run (vitest not hoisted from main checkout) — expected, noting for future worktree sessions.
- ADR 003 written (determinism model & persistence).

## Files created / modified

- `src/game/sim/rng.ts` + `rng.test.ts` — PRNG, sub-streams, serializable state, `newSeed`
- `src/game/sim/run-state.ts` + `run-state.test.ts` — versioned RunState, (de)serialization + validation
- `src/game/sim/seed-url.ts` + `seed-url.test.ts` — pure seed param parse/format
- `src/game/save.ts` + `save.test.ts` — `SaveStore` over injected `StringStorage`
- `src/game/sim/.gitkeep` removed
- `docs/decisions/003-determinism-and-persistence.md`
- `CLAUDE.md` Current State updated

## Deferred to next session

- Wiring `parseSeedParam`/`newSeed` into the page and passing `window.localStorage` into `createSaveStore` — lands with the first UI consumer (no UI this slice by design).
- Still outstanding from 1.1: physical-phone check of production URL; sprite-motion smoothness by eye.

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
