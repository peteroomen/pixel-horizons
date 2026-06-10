# Data Catalog + Deck Generation

**Date:** 2026-06-10
**Branch:** feature/data-catalog
**Roadmap item:** Phase 1 — Slice 1.3 Data catalog + deck generation

## Goal

A pure-data catalog in `src/game/data/` covering every hull, module, Clone Bay matrix, and card named in GDD §4–5, plus deterministic module→deck generation in `src/game/sim/deck.ts`, with Vitest proving each hull produces its documented starting deck.

## Approach

**Id scheme (canonical from here on):** kebab-case with a type prefix — `hull-scout`, `mod-light-laser`, `mod-standard-print-matrix`, `card-laser-burst`. Matches the existing `'hull-scout'` placeholder in `createRunState`, so `RunState` shape does **not** change and no version bump is needed. Clone Bay matrices are modules with slot `clone-bay` (they live in a slot, contribute a card, and can malfunction — same lifecycle as any module).

**Data shapes (`src/game/data/types.ts`):**

- `CardDef`: `{ id, name, apCost, exhaust?, retain?, effects: CardEffect[] }`. `CardEffect` is a discriminated union of declarative effects — `damage` (amount, piercing?), `travel`, `restore-shield-layer`, `temp-shield-layer`, `dodge-chance`, `buff-next-attack` (flat or multiplier), `debuff-target-vulnerable`, `strip-armor`, `reveal-intent`, `draw`, `gain-scrap`, `repair-all-modules` — enough to express every card in §4.2 + §5.8. **No interpreter is built** (Slice 2.1); the union just has to be expressive enough that combat can interpret it later without reshaping the data.
- `ModuleDef`: `{ id, slot: 'weapon' | 'utility' | 'engine' | 'clone-bay', name, tiers: { mk1: ModuleTier, mk2?: ModuleTier } }`. `ModuleTier`: `{ cards: CardId[] (1–4, duplicates = copies), passive? (e.g. Shield Generator's 2 layers / 2-turn recharge), planetItem? (inert name/description metadata — projection logic is Slice 3.3) }`. Mk II populated only where the GDD specifies it; "TBD" stays absent.
- `HullDef`: `{ id, name, slots: { weapon, utility, engine }, startingModules: ModuleId[], innateAbility: { id, name, description }, playstyle }`. Every hull implicitly has 1 clone-bay slot; `mod-standard-print-matrix` is included in `startingModules` (§4.1: all hulls start with it). Innate abilities are inert data — they're abilities, not cards (§4.1), interpreted in 2.1.

**Catalog content:** 4 hulls (§4.1) · 9 §5.8 modules + **Missile Pod and Autocannon invented** (named in Gunship's loadout but absent from §5.8 — flagged to user in plan review; numbers tunable like all catalog data) · 5 Clone Bay matrices (§4.2). All balance numbers live only in these data files.

**Deck generation (`src/game/sim/deck.ts`):** `generateDeck(moduleIds: string[]): CardId[]` — flat-maps each module's Mk I card list, in module-list order. Pure, deterministic, no RNG (shuffling is combat's job, per handoff). Duplicate module ids (Scout's Thruster ×2) naturally yield duplicate card sets. Unknown module id throws (programming error — loud failure, same policy as `rng.int`). Tier-aware generation (Mk II) is deferred to the Workbench slice (4.2) since `RunState` doesn't track tiers yet. `sim/` may import from `data/` (both pure); the reverse stays banned.

**Invented Mk I cards (need user sign-off):**

- **Missile Pod** (weapon): 1× Missile Salvo (2 AP, 8 dmg), 1× Lock-On (1 AP, next attack +3 dmg)
- **Autocannon** (weapon): 2× Cannon Burst (1 AP, 3 dmg ×2 hits → modeled as two damage effects)

## Steps

- [x] Branch `feature/data-catalog` from updated `main` (PR #1 merged)
- [x] `src/game/data/types.ts` — `CardDef`/`CardEffect` union, `ModuleDef`/`ModuleTier`, `HullDef`
- [x] `src/game/data/cards.ts` — every card from §4.2 + §5.8 + the two invented modules, keyed by id
- [x] `src/game/data/modules.ts` — 11 modules + 5 matrices with tier→card mappings, passives, inert planet-item metadata
- [x] `src/game/data/hulls.ts` — 4 hulls with slot profiles, starting modules, innate abilities
- [x] `src/game/data/index.ts` — typed lookup helpers (`getModule`, `getHull`, `getCard`) that throw on unknown ids
- [x] `src/game/sim/deck.ts` — `generateDeck(moduleIds): CardId[]`
- [x] Catalog integrity tests (`data/catalog.test.ts`): all ids unique and prefix-conventioned; every card referenced by a module exists; every module contributes 1–4 cards per tier (§5.3); every hull's starting modules exist, fit its slot profile, and include exactly one clone-bay module
- [x] Deck tests (`sim/deck.test.ts`): each of the 4 hulls produces its exact documented starting deck (multiset match against §4.1 + §5.8 + Standard Print Matrix's Telemetry Sync); deck size = sum of contributions; same input ⇒ identical output order; unknown module id throws
- [x] Add handoff step to CLAUDE.md Post-Session Checklist (user instruction from 1.2 handoff)
- [x] Post-session: fill outcome sections, update CLAUDE.md Current State, write Slice 2.1 handoff (`docs/work/2026-06-10-handoff-slice-2.1.md`), lint + type-check + test, PR

## Manual test steps

No UI this slice by design — verification is test-suite-driven plus spot checks:

- [x] `pnpm test` — full suite green: 61 tests, 7 files (41 existing + 10 catalog + 10 deck)
- [x] `pnpm type-check` && `pnpm lint` — clean
- [x] Spot-check vs GDD by hand: Scout = Light Laser + Phase Shifter + 2× Thruster + Standard Print Matrix ⇒ 2× Laser Burst, 2× Ghost Shift, 1× Desync Hull, 2× (2× Burn + 1× Afterburner), 1× Telemetry Sync = 12 cards — matches the Scout deck test exactly
- [x] Edge case: `generateDeck(['mod-nonexistent'])` throws with the offending id in the message (covered by test)
- [x] Grep check: no balance numbers outside `src/game/data/` (deck.ts contains no card/AP/damage literals); `Math.random` grep still only hits the ban comment in rng.ts

## Out of scope for this session

- Effect interpreter / any combat logic (Slice 2.1) — effect data shape only
- Mk II deck generation & module tier tracking in RunState (Workbench, 4.2)
- Planet-item projection logic (3.3) — inert metadata only
- Enemy/biome/event data (later slices add to `data/`)
- Wiring starting modules into `createRunState` — decided at review: deferred until a consumer exists (first combat slice), to avoid touching RunState twice
- UI of any kind

---

<!-- Fill in below during/after the session -->

## What actually happened

Went to plan. User approved the invented Missile Pod / Autocannon cards, including adding them to GDD §5.8 so the doc stays the source of truth. Decisions worth recording:

- Definitions live in plain arrays (`CARD_DEFS`/`MODULE_DEFS`/`HULL_DEFS`); `data/index.ts` builds `Map`s and exposes `getCard`/`getModule`/`getHull` that throw on unknown ids (loud-failure policy, same as `rng.int`).
- Mining Laser Mk II's "Slag Shot (4 dmg)" is a distinct card id (`card-slag-shot-mk2`) sharing the display name — card ids are unique, names need not be.
- `card-burn` is shared by Thruster and Hauler Engine (GDD lists the same Burn card for both) — cards are referenced, not owned.
- Shield Generator Mk II omitted entirely: the GDD specifies its passive (3 layers) but its cards are TBD, and a tier must contribute 1–4 cards (§5.3). Restoring it = defining its cards in data later.
- Effect union got two next-attack variants: `buff-next-attack` (flat bonus: Charge Capacitor, Lock-On, Combat Sim) and `amplify-next-attack` (multiplier: Overcharge).
- "Cannon Burst (3 dmg ×2 hits)" is modeled as two `damage` effects on one card, so per-hit interactions (shield layers absorb one hit each) work naturally in 2.1.
- `generateDeck` copies each tier's card array (`[...]`) so callers mutating a deck can't corrupt the catalog — tested.
- Orphan-card integrity test added (every card must be referenced by some module) — keeps dead data out of the catalog as it grows.

## Files created / modified

- `src/game/data/types.ts` — `CardEffect` union, `CardDef`, `ModuleDef`/`ModuleTier`/`ModulePassive`/`PlanetItem`, `HullDef`
- `src/game/data/cards.ts` — 30 cards
- `src/game/data/modules.ts` — 16 modules (11 slot modules + 5 Clone Bay matrices)
- `src/game/data/hulls.ts` — 4 hulls
- `src/game/data/index.ts` — lookups + re-exports
- `src/game/data/catalog.test.ts`, `src/game/sim/deck.test.ts` — 20 tests
- `src/game/sim/deck.ts` — `generateDeck`
- `docs/game-design.md` — Missile Pod + Autocannon rows added to §5.8
- `CLAUDE.md` — handoff step added to Post-Session Checklist; Current State updated
- `docs/work/2026-06-10-handoff-slice-2.1.md` — handoff for next session

## Deferred to next session

- Wiring hull starting modules into `createRunState` (currently `modules: []`) — land it with the first consumer (combat, 2.1), deciding then whether `createRunState` takes a `HullDef` or `sim/run-state.ts` imports `data/`.
- Mk II tier tracking in `RunState` + tier-aware `generateDeck` — Workbench slice (4.2); will need a `RUN_STATE_VERSION` bump.
- Shield Generator Mk II cards (GDD TBD), Kinetic Railgun / Cargo Scanner / Hauler Engine Mk II (GDD TBD), Missile Pod / Autocannon Mk II (invented modules, TBD by us).
- Still outstanding from earlier slices: seed-url/SaveStore page wiring; physical-phone check of production URL.

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
