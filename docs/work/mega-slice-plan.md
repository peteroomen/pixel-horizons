# Mega-Slice: THE RUN — Item Projection + Sector Map + Resume

**Date:** 2026-06-12
**Branch:** feature/the-run (not created yet — plan pending confirmation)
**Roadmap items:** Phase 3 — Slice 3.3 (module item projection) + Phase 4 — Slice 4.1 (sector map) + Phase 4 — Slice 4.5-lite (save/resume at node boundaries)

> ⚠️ This deliberately violates "one slice = one PR" and "don't mix sim + renderer in one
> PR" — explicitly sanctioned for this session. Mitigation: layer-ordered commits, each
> one green (`lint` + `type-check` + `test`), so the PR reviews as a sequence of slices.

---

## 1. The pitch

Today, Pixel Horizons is two excellent demos behind dev knobs: `?mode=` picks combat or
surface, lanes chain forever, mined resources evaporate at a result screen, and nothing
you do persists. **After this PR it is a game.**

Open the page → a seeded sector map → choose a path → fly the lane (combat, your hull's
deck) → arrive at a planet → drop pod → mine **with items projected from your actual ship
modules** → bank the deposit into the run → back to the map → push to the gate → run
summary. Ship destroyed = run over. Close the tab mid-run, reopen → RESUME RUN.

Why this combination and not, say, 3.3 + 3.4:

- **3.3 is the north-star slice** ("your ship build creates your platformer experience" —
  GDD §1, §6.3). It's the single highest-identity feature in the backlog.
- **But 3.3 alone has a wiring problem anyway:** surface mode has no RunState, so the
  module list has to come from *somewhere*. 4.1 is the honest answer — the sector map is
  what's supposed to carry RunState into both modes. Building 3.3's plumbing twice
  (knob now, map later) is wasted motion; building them together is *synergy, not just
  volume*.
- **4.1 is the moment the two verticals become one game.** Resources banking into
  `RunState.resources` (deferred from 3.2), lane danger, node choice — all of it lands
  here.
- **4.5-lite is nearly free once 4.1 exists:** `SaveStore` is already built and tested;
  the sector map will be a pure function of the seed (see §4), so a save is just the
  RunState we already serialize. ~80 lines of wiring buys "close the tab, come back
  tomorrow."
- **3.4 (clone death + hazards) is deliberately excluded:** surface enemies + AI + damage
  is a whole new sim system *and* renderer work, and it's the GDD's thinnest section
  (Open Question #4). It deserves its own design-minded session, and it drops cleanly
  into the run loop this PR creates.

---

## 2. Scope

### Part A — Module item projection (Slice 3.3)

**A1. Data: structured item effects** (`data/types.ts`, `data/modules.ts`, `data/surface.ts`)

`PlanetItem` grows an `effects: PlanetItemEffect[]` array (data, not code — logic only
interprets). Effect union:

| Effect kind | Carried by (Mk I) | Behavior |
|---|---|---|
| `double-jump` | Thruster | One extra mid-air jump |
| `high-jump { multiplier }` | Hauler Engine | Taller single jump, no double |
| `phase-dash { distancePx, cooldownMs }` | Phase Shifter | Horizontal blink **through walls** to first free spot, facing direction |
| `mining-yield { multiplier }` | Mining Laser | ×2 on tile yields |
| `yield-bonus { percent }` | Scavenger Matrix | +15% yields (stacks multiplicatively) |
| `deposit-scanner` | Cargo Scanner | Reveals hidden `h` deposit tiles (renderer tint) |
| `backpack-capacity { bonus }` | Hauler Engine (2nd effect) | + carry capacity |
| `move-speed { multiplier }` | Enforcer Matrix | −10% run speed |
| `shield-bubble { cooldownMs }` | Shield Generator | **Projected + shown in HUD, mechanically inert until 3.4** (no damage sources exist yet) — documented in code |

Clone-matrix HP / melee-damage stats are recorded in data but inert until 3.4.

New constants in `data/surface.ts`: `POD_WINDOW_PER_ENGINE_MS` (Engine-quality window
extension — the 3.2 hook point), dash distance/cooldown, capacity bonus, hidden/crystal
tile yields.

**A2. Projection** (`surface/items.ts` — new, pure, Vitest-covered)

`projectLoadout(moduleIds, reactorLevel): SurfaceLoadout` —

- Walks installed modules in install order; each item-bearing module projects its item.
- **Reactor item cap (GDD §4.3):** only the first `reactorLevel` items are *active*;
  the rest are listed as inactive (item-swap-at-pod UI deferred per GDD §6.2 — install
  order is the priority rule for now).
- Engines extend the pod window: `+POD_WINDOW_PER_ENGINE_MS` per engine module.
- Returns capabilities consumed by the sim (`maxAirJumps`, `jumpVelocityMult`, dash
  config, `yieldMult`, `backpackCapacity`, `podWindowBonusMs`, `scanner`) plus an
  `items` list (name, active flag, cooldown handle) for the HUD.

Per-hull outcomes (this is the demo): **Scout** = phase dash + double jump, agile;
**Gunship** = nothing but boots (exactly the GDD fantasy — fights well, barely jumps);
**Freighter** = 2× mining, scanner, high jump, big backpack; **Tactical** = double jump
+ scanner + (inert) shield bubble — and at reactor 3 with 4 item-bearing modules, the
**item cap actually bites** on Tactical.

**A3. Clone capabilities** (`surface/clone.ts`, `surface/physics.ts` untouched)

`createClone`/`updateClone` take a `CloneCapabilities` param (clone.ts stays
economy-free per the 3.2 invariant): air-jump counter reset on ground, jump velocity
multiplier, dash state (rising-edge input, tile-scan teleport through solids up to
`distancePx`, no-op if no free spot, cooldown timer).

**A4. Surface integration** (`surface/surface.ts`, `surface-view.ts`, `main.ts`)

- `createSurface(rows, { podWindowMs, loadout })`; yields multiplied in surface.ts
  (clone.ts still knows nothing about economy); capacity from loadout.
- `SurfaceView` gains `items` (name, active, cooldown **rounded to whole seconds** so
  the change-only emission contract holds — no per-frame React updates).
- New input action `dash` in `InputState`; keyboard `Shift`/`K`.

**A5. UI + renderer touches**

- `TouchControls.tsx`: DASH button, rendered only when a dash is projected (pointer
  events, release on up/leave/cancel).
- `SurfaceHUD.tsx`: item chips with active/inactive + cooldown state.
- `surface-renderer.ts`: dash afterimage (brief ghost rect — cheap), hidden `h` tiles
  drawn as plain rock unless scanner active → deposit tint pulse.
- `levels.ts`: ROCKY_TEST_LEVEL gains hidden `h` tiles, a dash-gated 2-tile wall hiding
  a **core crystal `c` tile** (first Core Crystal in the game — GDD §6.5 "deep on
  high-difficulty planets", here gated by build instead), and tilemap support for both.

### Part B — Sector map + run loop (Slice 4.1)

**B1. Map generation** (`sim/map-gen.ts` — new, pure, Vitest-covered)

`generateSectorMap(seed, sector): SectorMap` — **pure function of (seed, sector)** on a
fresh derived stream (`sector-map-1`), *not* the run's mutated `map-gen` stream. This is
the keystone decision: the map never needs serializing — a save is just the RunState,
and resume regenerates the identical map. (Lane rolls keep consuming the run's `map-gen`
stream as today.)

Structure (StS-lite): column 0 = START; columns 1–4 = 2–3 nodes each; column 5 = GATE.
Node types rolled per column: `planet` | `combat` | `cache` (instant scrap find —
placeholder for events/shops, trivially cheap, cuttable). Edges connect each node to
1–2 next-column nodes with full reachability (every node reachable from START, every
node reaches GATE). Each edge carries lane params `{ distance, encounterCount }` —
rolled per-edge, so "safe planet behind a nasty lane" exists from day one (GDD §7.1).

**B2. Edge-driven lanes** (`sim/travel.ts`)

`createLane(run, laneParams, enemyPool?)` — distance and encounter count come from the
chosen edge instead of global constants. `LANE_DISTANCE_*`/`LANE_ENCOUNTER_COUNT`
become map-gen rolling bands. Existing tests updated.

**B3. The phase machine** (`main.ts` refactor — the structural heart of the PR)

`main.ts` is currently an init-time `if (mode === 'surface')` fork. It becomes an
orchestrator over phases: `'map' | 'lane' | 'surface' | 'run-over' | 'sector-complete'`.

- Extract `src/game/modes/combat-mode.ts` and `src/game/modes/surface-mode.ts` — each
  owns its renderer + loop wiring, created on phase entry, destroyed on exit (one Pixi
  `Application` persists; ADR 004's accumulator pattern moves into surface-mode.ts
  unchanged).
- `GameHandle` gains `selectNode(nodeId)` (guarded: must be an edge from the current
  node) and `continueFromNode()`; existing commands route to the active mode controller
  (no-op guards preserved — established convention per ADR 004).
- New callbacks: `onPhaseChange(phase)`, `onMapUpdate(view: MapView)` (nodes, edges,
  current, reachable — plain view data, React never imports game internals).
- **Resource banking (deferred from 3.2):** surface outcome `aboard`/`stranded` →
  `run.resources += pod.deposited`. Combat scrap already flows via
  `applyCombatResult`.
- Combat defeat → `run-over` (ship destroyed = run over, GDD §6.4) with run stats +
  New Run. GATE arrival → `sector-complete` with run stats (boss is 5.2's job).
- `?mode=` knob retired (ADR 004 marked it temporary); `?hull=`, `?enemy=`, `?pod=`,
  `?seed=` knobs survive.

**B4. Map screen** (`components/SectorMap.tsx` — new, DOM-only, FOUNDRY-styled)

Columns of node plates, SVG edge lines, reachable nodes highlighted/pulsing, current
node marked, node-type labels (PLANET / COMBAT / CACHE / GATE). Touch-first hit areas.
`page.tsx` becomes phase-driven (map screen / combat UI / surface UI / end screens).

### Part C — Save/resume at node boundaries (Slice 4.5-lite)

- Save `RunState` (with `position.nodeId`) on every `map` phase entry — exactly ADR
  003's "save at node boundaries". Uses the existing tested `SaveStore` +
  `localStorage`.
- Boot with an existing save → title overlay: **RESUME RUN / NEW RUN**. Resume restores
  seed (written back to URL), regenerates map from seed, places you at the saved node.
  New Run clears the save.
- Explicitly still deferred: abandon-mid-lane resume (a lane is *between* nodes — you
  resume at the last node, which is the ADR 003 contract anyway).

### Explicitly out of scope

3.4 (clone death, hazards, surface enemies, pit semantics — OOB stays solid), 4.2
workbench, 4.3 shops/economy pricing, pod-defense events, early/manual pod launch
(stretch only), lane modifiers beyond distance/encounter-count, Mk II anything, boss,
render interpolation, item swap at pod, second biome.

---

## 3. Files to create / modify

**New files**

| Path | What |
|---|---|
| `src/game/surface/items.ts` (+ `.test.ts`) | Loadout projection, reactor cap, window extension |
| `src/game/sim/map-gen.ts` (+ `.test.ts`) | Seeded sector map generation |
| `src/game/modes/combat-mode.ts` | Extracted combat controller |
| `src/game/modes/surface-mode.ts` | Extracted surface controller (accumulator loop) |
| `src/game/map-view.ts` (+ `.test.ts`) | React-facing map snapshot |
| `src/components/SectorMap.tsx` | Map screen |
| `src/components/TitleOverlay.tsx` | Resume/new-run choice |
| `docs/decisions/005-run-phase-machine.md` | ADR: phase machine + map-as-pure-function-of-seed |

**Modified files**

| Path | What |
|---|---|
| `src/game/data/types.ts` | `PlanetItemEffect` union, `PlanetItem.effects` |
| `src/game/data/modules.ts` | Effects on every Mk I planet item |
| `src/game/data/surface.ts` | New tunables (dash, window-per-engine, capacity bonus, yields) |
| `src/game/data/constants.ts` | Lane bands become map-gen rolling bands |
| `src/game/data/levels.ts` | `h` hidden tiles, `c` crystal tile, dash-gated pocket |
| `src/game/surface/tilemap.ts` (+ test) | New tile types |
| `src/game/surface/clone.ts` (+ test) | Capabilities: double jump, high jump, dash |
| `src/game/surface/surface.ts` (+ test) | Loadout integration, yield mult, capacity |
| `src/game/surface/mining.ts` (+ test) | Multiplied yields, crystal yield |
| `src/game/surface-view.ts` (+ test) | Item/cooldown view fields |
| `src/game/sim/travel.ts` (+ test) | Edge-driven lane params |
| `src/game/main.ts` | Phase machine orchestrator (large) |
| `src/components/{SurfaceHUD,TouchControls,GameCanvas}.tsx` | Item chips, dash button, new callbacks |
| `src/app/page.tsx` | Phase-driven shell |
| `src/renderer/surface-renderer.ts` | Dash ghost, scanner tint, crystal tile |
| `CLAUDE.md`, this plan, new handoff | Docs |

Estimate: ~2,500–3,500 added lines incl. tests. Biggest PR in the repo by some margin.

---

## 4. Implementation order

Sim-first, every step ends green (`pnpm lint && pnpm type-check && pnpm test`), one
conventional commit per step — the PR reads as stacked slices:

1. **Data layer** — `PlanetItemEffect` + module effects + constants. No behavior change; catalog tests extended.
2. **`surface/items.ts`** — projection + per-hull snapshot tests (Scout/Gunship/Freighter/Tactical, reactor cap on Tactical).
3. **Clone capabilities** — double jump, high jump multiplier, phase dash (tile-scan blink, cooldown). Tests incl. dash-into-solid no-op and resting-contact edges (`maxEdgeTileIndex` per the 3.1 floor-sink lesson).
4. **Tilemap + levels** — `h`/`c` tiles, dash pocket; mining yields with multipliers.
5. **Surface integration** — loadout through `createSurface`, capacity/window/yields; `SurfaceView` items (second-rounded cooldowns).
6. **`sim/map-gen.ts`** — generation + property tests over many seeds (determinism, reachability both directions, edge-param bands, node-type mix).
7. **`travel.ts`** — edge-driven lanes; update existing tests.
8. **`main.ts` refactor, two sub-steps:** (a) mechanical extraction into `modes/` with zero behavior change — verify combat + surface still work as today; (b) phase machine + map flow + banking + end screens. *This is the riskiest step; it happens only when the entire sim layer is green.*
9. **React shell** — `SectorMap.tsx`, `TitleOverlay.tsx`, phase-driven `page.tsx`, SurfaceHUD items, TouchControls dash.
10. **Renderer touches** — dash ghost, scanner tint, crystal tile color.
11. **Save/resume** — save on map entry, boot prompt, clear on new run.
12. **Browser verification** (see §5), then docs: ADR 005, CLAUDE.md Current State, handoff for 3.4.

---

## 5. Test plan

**Unit (Vitest, deterministic):** all of the above per-step tests; key properties —
same seed ⇒ identical map across two generations; every node reachable from START and
reaching GATE over ≥200 seeds; projection caps at reactor level; dash never ends inside
a solid; yields = base × mining × scavenger; aboard banks `deposited` into
`RunState.resources`; serialize→deserialize round-trips `position.nodeId`.

**Manual (browser, `?pod=45` to keep loops short; preview-tab rAF throttling noted —
prefer end-state assertions):**

- [ ] Happy path: load → map renders → pick planet → lane combat → win → arrive →
      surface drops with pod → mine (incl. a hidden tile with Freighter) → deposit →
      aboard → resources visible in run HUD on the map → continue to GATE → sector
      complete with correct totals.
- [ ] `?hull=hull-scout`: dash button present, blink through the dash wall, grab the
      crystal, double jump works. `?hull=hull-gunship`: no dash button, single jump
      only, base pod window (no engine modules). `?hull=hull-freighter`: 2× yields
      observed, hidden tiles glow, high jump (no double), bigger backpack cap in HUD.
- [ ] Item cap: `?hull=hull-tactical` shows 4 items, only first 3 active.
- [ ] Edge case — stranded: miss the window on purpose; backpack lost, deposits banked
      into the run, run continues from the map (not a dead end).
- [ ] Edge case — run over: lose a combat; run-over screen, New Run resets and clears save.
- [ ] Resume: mid-run at a node, reload → RESUME RUN → same map, same node, same
      resources. NEW RUN → fresh seed, save gone.
- [ ] Combat regression: full Lamprey/Anchormaw fight unchanged; 375 px mobile pass on
      map screen + dash button reachability.

---

## 6. What it unlocks

- **The game is demoable end-to-end** — shareable seeded runs already work (`?seed=` +
  pure-function map = the whole run is the URL). 6.5 daily runs become trivial.
- **3.4** drops hazards/death into a live run loop with real stakes (lost backpack
  already matters because resources persist).
- **4.2 Workbench** becomes "add a screen + a node type" — RunState, map nodes, and
  module-driven decks/items are all live; installing a module visibly changes both
  modes the moment it lands.
- **4.3 shops / 4.4 events** are new node types on an existing map.
- **4.5** is mostly done; only mid-lane abandonment semantics remain.
- **5.4 meta shell** inherits a working run summary and title screen seam.

## 7. Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| `main.ts` phase-machine refactor breaks combat or surface wiring | High | Two-step refactor (mechanical extraction first, verified, then phases); sim untouched by it; full combat regression in §5 |
| Renderer lifecycle leaks on phase switches (textures, tickers, listeners) | Medium | Mode controllers own create/destroy symmetrically; switch phases repeatedly in verification incl. `destroy()` |
| Map-gen reachability/determinism bugs | Medium | Property tests over hundreds of seeds before any UI exists |
| Determinism trap: map generated from the *consumed* map-gen stream would break resume | High if missed | Keystone decision: fresh derived `sector-map-{sector}` stream; covered by a regenerate-after-lane test |
| Item cooldowns spam React via change-only emission | Low | Cooldowns rounded to whole seconds in the view |
| Dash-through-walls physics edge cases | Medium | Pure tile-scan teleport (no swept motion), no-op fallback, dedicated tests |
| Scope overrun | High (it's a mega-slice) | **Cut order, cheapest identity loss first:** 1) save/resume (Part C), 2) scanner + hidden tiles, 3) cache nodes, 4) dash ghost visual, 5) Scavenger/Enforcer matrix stats, 6) crystal pocket. **The floor** — item projection + map with planet/combat/gate + banking — is still both roadmap slices' cores. |
| PR is large to review | Accepted | Layer-ordered commits, each green; PR description maps commits → slices |

**Logistics:** work happens in the main tree (foundry-ui and 3.2 are merged; `stash@{0}`
remains untouched per the 3.2 handoff). Node 22 before anything (`nvm use 22`). Push/PR
with the `peteroomen`-scoped token per memory.

---

<!-- Fill in below during/after the session -->

## What actually happened

## Files created / modified

## Deferred to next session

## Status

- [ ] In progress
- [ ] Complete
- [ ] Partial — see deferred
