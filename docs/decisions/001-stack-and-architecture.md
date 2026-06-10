# ADR 001: Stack & Core Architecture

Date: 2026-06-10
Status: Accepted

## Context

Pixel Horizons is a web-first, mobile-friendly dual-loop roguelite: a turn-based card combat mode, an action platformer mode, and a sector map — all driven by one shared ship/module state. We need a stack and a top-level architecture before writing any code. The same developer maintains breakout-roguelite and Perihelion on an established stack with documented workarounds.

## Decision

**1. Reuse the house stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · PixiJS v8 · 8bitcn/ui + Tailwind CSS v4 · pnpm · Vercel. Supabase deferred to Phase 7 (localStorage until then). Consistency across projects beats marginal gains from alternatives (Vite/Phaser were considered); known issues and workarounds carry over, and 8bitcn/ui's pixel-styled components fit the game's aesthetic natively.

**2. React/DOM renders all information-dense UI — including the card hand.** PixiJS renders the *world*: battle viewport, platformer level, map backdrop. Cards, workbench, deck viewer, shops, and HUD are DOM components. Rationale: cards are interactive, text-heavy UI — DOM gives free hit-testing, accessibility, text layout, and touch ergonomics. Drawing card UI in Pixi would re-implement all of that for no gain.

**3. Deterministic, pure simulation core.** `src/game/sim/` (card combat, travel, economy, map-gen) and `src/game/surface/` (platformer logic) import nothing from React/Pixi/DOM. All randomness flows through one seeded PRNG; the seed lives in the URL.

**4. Three top-level modes as a state machine** — MAP / SPACE / SURFACE — each pairing a Pixi scene with a React overlay set. Mode transitions go through `main.ts`; React learns about game events via callbacks only (never per-frame).

**5. Save = serialized RunState JSON** to localStorage at node boundaries (mid-run save/resume is a launch requirement for web). RunState is the single source of truth: modules, hull HP, resources, map position, seed, RNG cursor.

**6. Vitest for the sim core.** New addition relative to breakout-roguelite: because the sim is pure and seeded, combat resolution, deck generation, travel math, and economy are cheap to unit-test, and balance regressions become testable.

**7. Mobile-first input:** pointer events only. Card mode and map are naturally touch-friendly; the platformer gets on-screen touch controls (designed alongside the HUD from day one, not retrofitted).

## Consequences

- One stack across all personal projects — shared mental model, shared workarounds (Node 22/Husky, `eslint src`, shadcn CLI quirks).
- The sim purity rule costs some discipline (no reaching for DOM/Pixi conveniences in game logic) but buys: deterministic shareable/daily runs, fast headless tests, and a clean seam if rendering tech ever changes.
- DOM card UI means combat visuals are split across two render trees (Pixi viewport + DOM overlay); transitions/animations crossing that boundary need care.
- Next.js is heavier than a Vite SPA for a game, but the game is effectively one route; App Router overhead is negligible and Vercel deploy is zero-config.
- URL-encoded seeds force deterministic generation from the first slice — this is deliberate; retrofitting determinism later is far harder.
