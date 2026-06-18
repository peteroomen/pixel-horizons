# Pixel Horizons — Claude Code Instructions

This file is read automatically by Claude Code at the start of every session.
**Do not skip it. Do not start writing code before completing the pre-session checklist below.**

---

## What This Project Is

A browser-based dual-loop roguelite: turn-based deckbuilder space combat fused with action-platformer planet mining runs. You build a ship from modules; the modules ARE your card deck in space and your clone's equipment on planets. Slay the Spire-style sector maps, FTL-style shields, a biological enemy (the Bloom) living in hyperspace lanes.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · PixiJS v8 (game rendering) · 8bitcn/ui + Tailwind CSS v4 (UI shell) · Motion (card/UI animation) · Vitest (sim core tests) · pnpm · Vercel deploy · Supabase (Phase 7 — auth + cloud saves).

**Ship small slices. One roadmap item = one plan = one branch = one PR = one session.**

---

## Key Docs

| Doc         | Path                  | Purpose                                                         |
| ----------- | --------------------- | --------------------------------------------------------------- |
| Roadmap     | `docs/roadmap.md`     | Phases, slices, build order — source of truth for what to build |
| Game Design | `docs/game-design.md` | Full GDD: ship/modules, combat, platformer, map, meta           |
| Work logs   | `docs/work/`          | Per-session plan files — read the most recent before starting   |
| Decisions   | `docs/decisions/`     | Architecture decision records (ADRs)                            |

---

## Current State

> **Update this section at the end of every session.**

- **Current phase:** Phase 6 identity work (3.4, 4.7, 4.8, 6.6, combat + surface world-art all merged). **RUNTIME PLANETS (6.1 slice 1) merged (PR #21)** (`docs/work/2026-06-16-6.1-runtime-planets.md`, ADR 010) — planets are now **generated at runtime** via a ported Deep-Fold GLSL shader through PixiJS v8, deterministic from the run seed and palette-locked to Resurrect 64 (`renderer/palette.ts`). A planet node arrives into an **orbit screen** (`'orbit'` phase + `orbit-mode`/`orbit-renderer` — a **rotating** `RenderTexture` planet via `createAnimatedPlanet` + the player's **ship** composited from its modules on an idle bob + starfield + DROP) → surface. Sim descriptor `planetForNode(seed, nodeId)` is **derived, not stored** (no `RUN_STATE_VERSION` bump). `?mode=orbit` dev knob; `/planet-spike` is a throwaway dev harness. **SURFACE RECOLOR (6.1 slice 2) built (branch `feature/surface-recolor`, PR pending)** — the surface now recolours to the planet's `land` ramp via `surfaceRampFor` (`palette.ts`): rock tiles, deposit-tile rock hosts, rock-debris FX, **and the cave-mouth backdrop rock** (`midLayer`/`nearLayer`) all match the orbit planet; bedrock + sky/sun stay fixed. `currentPlanet` carried `enterOrbit → enterSurface` (`main.ts`). 516 tests green; browser-verified (verdant→green cave, tundra→grey-green, `?mode=surface` fallback, 375px). **Next: 4.9 deckbuilding audit, 5.5 balance.** (Atmosphere/sky recolor, Volcanic/Ice planet types + rock-heavy biome levels = later 6.1 / 5.3 slices.)
- **Last session:** 2026-06-19 — **HULL VARIETY SPRITES** (`docs/work/2026-06-18-ship-sprites.md`, **PR #24 open** on `feature/ship-sprites`): three new 64×32 pixel-art hulls (Gunship, Scout, Freighter) + Tactical placeholder ported from `docs/design/foundry-transitions-ships.dc.html`'s `_sprites()` method; four module sprite types (weapon barrel, dorsal turret, thruster engine, utility dish) + empty bracket; per-hull `HULL_MOUNTS` config; `compositeShipForHull(hullId, slotCounts)` builds a 72×40 composite; `hullId` added to `CombatView`; Freighter slots fixed to 1W/2E/1U; `muzzleFlash` updated to 72×40. 516 tests green; lint/type-check/build clean. Browser verification (happy path + 375px + hull switching via `?hull=`) pending as human manual step.
- **All merged to main:** Scaffold, Slices 1.2–1.3 (PRs #1–2), 2.1–2.5 (PRs #3–7), 3.1 (PR #8), FOUNDRY Combat UI (PR #9), 3.2 (PR #10), THE RUN (PR #11), THE FORGE (PR #12), THE ARSENAL (PR #13), WORLD ART DIRECTION combat renderer (PR #14), POWERS & STATUS 4.7 (PR #15), STATION UX 4.8 (PR #16), CLONE DEATH 3.4 (PR #17), ECONOMY & SHIP-SLOTS (PR #18), COMBAT JUICE 6.6 (PR #19), SURFACE OVERWORLD ART (PR #20), RUNTIME PLANETS 6.1 slice 1 + orbit screen (PR #21), shield/AP pip-visibility fix (PR #22), SURFACE RECOLOR 6.1 slice 2 (PR #23).
- **Open PRs:** [#24 Hull variety sprites](https://github.com/peteroomen/pixel-horizons/pull/24) (`feature/ship-sprites`) — browser verify pending.
- **Playtest follow-ups (PR #13, in the roadmap):** #2 STS-style Powers/status system + Exhaust-on-buff + targeted-debuff skills + keyword tooltips → **4.7 shipped** (this session); #3 full module-management UX + #7 workbench access from stations → **4.8 built** (this session, branch `claude/sharp-wright-iv37l2` — 375px browser check pending); "too easy" combat + first-try boss kill → 5.5 / 5.2 boss tuning (re-tune the now-Exhaust buff economy then). Phone-verify still pending for the buy-block label and the engineer-repair tap (the touch bug never reproduced on desktop).
- **Deferred:** human hand-play of the 2.5 fun checkpoint and of 3.1 platformer feel (knobs in `data/surface.ts`); pod-defense events + lane modifiers incl. infested/elite lanes (4.1+/5.1 — `encounterCount` is the only danger axis today); pit-death/OOB semantics (3.4 shipped HP/contact death; falling out of bounds is still solid and ABANDON remains the pit escape valve); render interpolation + acceleration curves (only if the feel pass demands); anchor escape valve (re-judge with human play); more Infestation variants / on-draw kinds when an enemy needs them; Kinetic Shred (strip-armor) unreachable in play until Mk II decks (4.2); abandon-mid-lane resume (4.5 — resume lands at the last node per ADR 003); retain-with-choice API; planetside item offline-while-malfunctioning; item swap at pod; Mk II deck generation + tier tracking in RunState (4.2); economy sinks — banked resources currently buy nothing (4.2/4.3); sector boss at the gate (5.2 — the gate today is a sign-post); hull select UI (Phase 5 — `?hull=` knob is the only path); suppress "—" LOST/BANKED rows on the empty-backpack abandon overlay (cosmetic); card-flip animation (6.6); physical-phone check of production URL; `motion` installed but unused until 6.6. **From THE ARSENAL:** starting-deck-size audit (A5 — pure data in `hulls.ts`, deferred to the 5.5 balance pass — it shifts module indices and churns tuned combat tests); `starts-in-hand` module modifier (needs opening-hand seeding in `createCombat`); the cosmetic Pixi organ-targeting indicator (DOM organ bars carry the function today); `amplify-attacks` organ ability (typed-out, no enemy uses it); event/shop/engineer **resume lands on the map at the node, not back in the screen** (existing convention — re-judge if it confuses); a "resolved outcome" overlay before an event returns to the map (currently resolves straight to map).
- **Known issues:** Node 22 required (`nvm use 22`) before `pnpm install`/`dev`/`git commit` — Husky/lint-staged break on Node 20. `next lint` removed in Next 16 — use `eslint src`. shadcn CLI fails on v5 components.json schema — write base components manually, port 8bit variants from Perihelion or fetch `https://8bitcn.com/r/{name}.json`. esbuild build script needs `onlyBuiltDependencies` in `pnpm-workspace.yaml` (done). `docs/` is in `.prettierignore` on purpose — don't reformat hand-written docs. Integer zoom is computed in _device_ pixels (see `src/renderer/pixel-scale.ts`) — don't "fix" it to CSS pixels. `touch-none` (touch-action: none) lives on the **canvas host** (`GameCanvas`), not on `<main>` — keep it there so DOM menu overlays keep native touch scroll/tap; tappable buttons use `touch-manipulation` (`FoundryButton`). Vercel: only the canonical `pixel-horizons.vercel.app` is public (built from `main`); per-deployment/branch preview URLs are behind Vercel Authentication (401 expected) — so feature branches like `feature/the-arsenal` are not phone-testable on a public URL until merged.

---

## Dev Knobs (URL params)

Dev/test-only, parsed in `src/game/main.ts`; invalid values fall back quietly. They combine freely (e.g. `?mode=surface&modules=phase-shifter,thruster&reactor=1&pod=45`).

| Param       | Example                               | Effect                                                                                                                                                                                                                        |
| ----------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?seed=`    | `?seed=abc123`                        | Pins the run seed; otherwise a fresh seed is generated and written back into the URL                                                                                                                                          |
| `?hull=`    | `?hull=hull-scout`                    | Hull override (default `hull-gunship`) until hull select lands (Phase 5)                                                                                                                                                      |
| `?modules=` | `?modules=mining-laser,phase-shifter` | Replaces the hull's installed modules (comma-separated ids, `mod-` prefix optional, unknown entries dropped). Whole-ship override — combat deck **and** surface items both project from it. Stopgap until the Workbench (4.2) |
| `?reactor=` | `?reactor=2`                          | Overrides the reactor level driving the surface item cap (0 is valid — everything inactive). Combat AP stays at `BASELINE_AP` until reactor level lives on RunState                                                           |
| `?enemy=`   | `?enemy=enemy-anchormaw`              | Forces every lane encounter to one enemy                                                                                                                                                                                      |
| `?pod=`     | `?pod=45`                             | Base pod launch window in seconds (engine bonuses still apply on top)                                                                                                                                                         |
| `?mode=`    | `?mode=surface`                       | Skips the run loop and drops straight onto the test planet with the resolved loadout; no save interaction. `?mode=orbit` drops straight into the orbit screen (generated planet + DROP → surface) for the 6.1 planet check    |

---

## ⚠️ Pre-Session Checklist — Complete Before Writing Any Code

You must complete every step in order. Do not proceed to code until the plan file exists and has been confirmed.

**1. Orient**

- [ ] Read `docs/roadmap.md` — identify the current phase and the specific slice being worked on today
- [ ] Read the most recent file in `docs/work/` — understand what was done last session and what was deferred
- [ ] Read the relevant sections of `docs/game-design.md` if touching mechanics, modules, cards, or biomes

**2. Clarify**

- [ ] If the task is ambiguous, ask one focused clarifying question before proceeding. Do not make assumptions and build the wrong thing.

**3. Plan**

- [ ] Write a plan file to `docs/work/YYYY-MM-DD-{slug}.md` using the format below
- [ ] Plan must include a **Manual test steps** section — happy path + at least one edge/failure case
- [ ] Present the plan as a summary to the user and get explicit confirmation before writing code
- [ ] **Do not write a single line of application code until the plan is confirmed**

**4. Branch**

- [ ] `git checkout -b feature/{name}` (unless this is the very first scaffold commit to main)

---

## Plan File Format

Filename: `docs/work/YYYY-MM-DD-{short-slug}.md`
Example: `docs/work/2026-06-12-scaffold.md`

```markdown
# {Feature / Task Name}

**Date:** YYYY-MM-DD
**Branch:** feature/{name}
**Roadmap item:** Phase N — {slice name}

## Goal

One sentence: what does "done" look like for this session?

## Approach

How will this be built? Key technical decisions made upfront.
Call out anything non-obvious or where multiple approaches were considered.

## Steps

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3
      (Be specific — vague steps lead to vague output)

## Manual test steps

How to verify this works end-to-end in the browser.
Cover the happy path and at least one failure/edge case.

- [ ] Test step 1 (e.g. open localhost:3000, do X, expect Y)
- [ ] Test step 2
- [ ] Edge case: what happens if …

## Out of scope for this session

Explicitly list anything related but not being done today.

---

<!-- Fill in below during/after the session -->

## What actually happened

(decisions made, approaches changed, surprises)

## Files created / modified

(list key files)

## Deferred to next session

(anything punted — be specific so next session picks it up cleanly)

## Status

- [ ] In progress
- [ ] Complete
- [ ] Partial — see deferred
```

---

## Post-Session Checklist

Do not close the session without completing these steps:

- [ ] Fill in the "What actually happened", "Files changed", and "Deferred" sections of the plan file
- [ ] Update the **Current State** section of this file (`CLAUDE.md`)
- [ ] Add an ADR to `docs/decisions/` if a significant architectural decision was made
- [ ] Run `pnpm lint` — fix any errors before committing
- [ ] Run `pnpm type-check` — fix any type errors before committing
- [ ] Run `pnpm test` — sim core tests must pass
- [ ] Commit with a conventional commit message and push the branch
- [ ] Open a PR — even for small slices, always go through PR review
- [ ] Write a handoff doc for the next slice at `docs/work/YYYY-MM-DD-handoff-{next-slice}.md` (state, pointers, gotchas — assume the reader starts cold)

---

## Module Architecture

```
src/
  game/                 ← Pure game logic. No React imports. No PixiJS imports.
    sim/                ← Deterministic core — every function unit-testable
      rng.ts            ← Seeded PRNG. ALL randomness flows through this. No Math.random anywhere else.
      run-state.ts      ← Single source of truth for a run. Serializable to plain JSON.
      deck.ts           ← Module → card deck generation
      combat.ts         ← Turn resolution: AP, draw/discard, shields, damage, win/lose
      malfunction.ts    ← Module damage, card flipping, play-to-repair
      travel.ts         ← Hyperspace runs: lane distance, encounter triggers, escape-by-arrival
      economy.ts        ← Scrap/Biomineral transactions, repair costs, clone prints
      map-gen.ts        ← Sector map generation from seed
    surface/            ← Platformer logic (fixed timestep; also React/Pixi-free)
      physics.ts        ← AABB collision, gravity, movement
      clone.ts          ← Clone entity: HP, items projected from modules
      pod.ts            ← Pod timer, deposits, launch window
      mining.ts         ← Deposit types, yields
      tilemap.ts        ← Level data, biome tile logic
    data/               ← Pure data, no logic: hulls, modules, cards, enemies, biomes, events
    main.ts             ← initGame(), destroyGame(), callback hooks to React
  renderer/
    space-renderer.ts   ← PixiJS: lane backdrop, ships, combat effects
    surface-renderer.ts ← PixiJS: tilemap, clone, parallax, pod
    palette.ts          ← Palette-lock utilities; planet-color → tileset recolor
  components/           ← React shell. Must NOT import from src/game/ internals — callbacks only.
    GameCanvas.tsx      ← Mounts PixiJS app, wires callbacks to React state
    CombatHand.tsx      ← Card hand UI (DOM, not Pixi — see ADR 001)
    SectorMap.tsx       ← Node map screen
    Workbench.tsx       ← Module install/swap/craft
    DeckViewer.tsx      ← Deck inspection
    HUD.tsx             ← Overlays: hull HP, AP, pod timer, resources
  lib/
    supabase/           ← Phase 7 only
```

---

## Coding Conventions

- **TypeScript strict mode** — no `any`, no `@ts-ignore` without a comment explaining why
- **React owns the UI shell, PixiJS owns the world** — React components must not import from `src/game/` directly; communicate through `main.ts` callbacks only
- **The sim is sacred:** `src/game/sim/` and `src/game/surface/` import nothing from React, PixiJS, or the DOM. If it can't run in a Vitest test, it doesn't belong there.
- **Determinism is a feature:** all randomness goes through the seeded RNG in `rng.ts`. Same seed = same run. This powers shareable URLs, daily runs, and reproducible tests. Never call `Math.random()`.
- **Never update React state at 60fps** — event callbacks update React state once per event, not per frame
- **`update(dt)` modifies state, `renderer.sync()` draws** — never mix the two
- **Run state is the single source of truth** — modules, hull HP, resources, map position live in `run-state.ts`, never duplicated in component state
- **Modules/cards/enemies are data, not code** — definitions live in `src/game/data/`; combat logic interprets them. Never hardcode a card effect inline in combat logic.
- **Touch events are primary, mouse is secondary** — pointer events only, never mouse-specific events. Mobile-friendly is a launch requirement, not a port.
- **`const` by default** — `let` only when mutation is needed
- **No comments unless the WHY is non-obvious** — physics tuning constants, collision edge cases, workarounds
- **No `console.log` in committed code** — `console.error` for genuine errors only

---

## Git Conventions

- **Never commit directly to `main`** after the initial scaffold commit
- Feature branches: `feature/`, `fix/`, `chore/`, `docs/`
- Conventional commit messages: `feat:`, `fix:`, `chore:`, `docs:`
- One roadmap slice = one branch = one PR
- Keep PRs small and reviewable — sim + renderer + UI in one PR is too big; split it

---

## ADR Format

Create at `docs/decisions/NNN-{title}.md`:

```markdown
# ADR NNN: {Title}

Date: YYYY-MM-DD
Status: Accepted

## Context

Why did this decision need to be made?

## Decision

What was decided?

## Consequences

What are the trade-offs? What does this make easier or harder?
```

---

## Things Not To Do

- Don't start writing code before the plan file exists and is confirmed
- Don't add a library without writing an ADR
- Don't build features outside the current phase — check the roadmap
- Don't mix sim changes and renderer changes in the same PR
- Don't add Supabase until Phase 7 — localStorage for saves and meta-progression until then
- Don't skip the PR step — every slice gets a PR, no matter how small
- Don't import from `src/game/` in React components — use callbacks only
- Don't bypass Husky hooks (`--no-verify`)
- Don't update React state inside the game loop tick — callbacks only, once per event
- Don't call `Math.random()` — seeded RNG only, everywhere
- Don't render card UI in PixiJS — cards are DOM (ADR 001)
- Don't hand-balance numbers inside logic — all tunables live in data files
