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

- **Current phase:** Phase 0 complete (design). Phase 1 not started. Next: Slice 1.1 — scaffold.
- **Last session:** 2026-06-10 — GDD v0.2 finalized, architecture decided (ADRs 001–002), roadmap written, repo initialized. No application code exists yet.
- **All merged to main:** Nothing yet.
- **Open PRs:** None.
- **Deferred:** None.
- **Known issues:** None yet. (Refer to breakout-roguelite and Perihelion CLAUDE.md known-issues sections — same stack, same workarounds likely apply: Node 22 for Husky/lint-staged, `eslint src` not `next lint`, 8bitcn/ui + shadcn CLI quirks, Vercel CLI env vars.)

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
