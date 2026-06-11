# Handoff — Slice 3.1: Platformer Core

**From:** Slice 2.5 session (2026-06-11)
**For:** the next session, starting cold. You have no memory of previous sessions — everything you need is linked here.

## ⚠️ This slice is a mode switch

Everything built so far lives in the deckbuilder half of the game. Slice 3.1 starts the
**action-platformer half**: `src/game/surface/` is *untouched scaffolding* — empty or
near-empty files (`physics.ts`, `clone.ts`, `pod.ts`, `mining.ts`, `tilemap.ts`) named in
CLAUDE.md's module map but never implemented. There is no fixed-timestep loop, no
surface renderer, no input handling. You are not extending combat; you are standing up a
second game.

## Read first, in order

1. `CLAUDE.md` — the pre-session checklist is mandatory: orient → clarify → **plan file
   → user confirmation** → branch. No application code before the plan is confirmed.
2. `docs/roadmap.md` — **Phase 3, Slice 3.1**: fixed-timestep loop, AABB physics,
   run/jump/melee, tilemap collision + render (one hand-made Rocky test level),
   keyboard **+ touch** controls (mobile is a launch requirement).
3. `docs/game-design.md` §6 (Surface Operations) — especially §6.1 (philosophy: short,
   tight runs) and §6.2–6.3 for what 3.2/3.3 will need from your foundations (pod timer,
   clone items projected from ship modules — don't paint them into a corner).
4. `docs/decisions/001-stack-and-architecture.md` (React owns UI, Pixi owns world,
   sim is React/Pixi-free) and `002` (pixel scale: integer zoom in *device* pixels —
   `src/renderer/pixel-scale.ts`, don't "fix" it).
5. `docs/work/2026-06-11-enemy-roster.md` — what 2.5 did; combat is feature-stable
   until Phase 4.

## Phase 2 exit state

- All five GDD §5.7 archetypes live: Lamprey, Parasite, Carapace (armor 5/regen 2,
  pool model, piercing bypasses, `strip-armor` works), Sporecaster (injects Spore
  Cluster — unplayable, on-draw lose 1 shield layer, `moduleIndex: null`), Anchormaw.
- Intent *kind + name* always telegraphed in the HUD; exact numbers behind Deep Scan.
- 184 tests green. Fun checkpoint passed at bot level (see the 2.5 work log); **human
  hand-play of a few lanes is still recommended** — if the user wants tuning, every
  knob is in `src/game/data/`.

## Architecture rails for 3.1 (same rules, new half)

- `src/game/surface/` follows the same law as `sim/`: no React, no PixiJS, no DOM.
  Fixed-timestep `update(dt)` mutates state; a `surface-renderer.ts` `sync()` draws it.
  If it can't run in Vitest, it doesn't belong there.
- All randomness through `rng.ts` streams — `RunState.rng` already has named streams;
  add a surface/level stream rather than reusing combat's.
- React gets events through `main.ts` callbacks only — never per-frame state updates.
  The 60fps loop lives entirely on the game side (the combat side never needed one;
  you're building the first real game loop in the project).
- Pointer events only, never mouse events. Touch controls are primary (GDD: virtual
  buttons / zones), keyboard is the desktop convenience.
- Tunables (gravity, jump velocity, move speed, timestep) go in `data/` or a surface
  constants module — never inline in physics code.

## Gotchas (will cost you time if skipped)

- **Node 22 first:** `source ~/.nvm/nvm.sh && nvm use 22` before
  `pnpm install`/`test`/`git commit` — Husky/lint-staged break on Node 20. Each Bash
  call is a fresh shell. Fresh worktrees need `pnpm install`.
- **Pushing 403s with the default gh account** (work account is active; repo belongs to
  `peteroomen`). Don't switch the global account — scope per command:
  - push: `git -c credential.helper= -c 'credential.helper=!f() { echo username=peteroomen; echo password=$(gh auth token --user peteroomen); }; f' push …`
  - gh: `GH_TOKEN=$(gh auth token --user peteroomen) gh pr create …`
- **Preview server cwd matters:** check `preview_list` before `preview_start` — a
  server rooted in the main repo serves *main's* code, not your worktree.
- **Snapshots race `location.assign` navigations** (bit two sessions in a row): after
  navigating the preview, re-read state before believing it; get node ground truth
  before chasing "nondeterminism".
- **Integer zoom is computed in device pixels** (`src/renderer/pixel-scale.ts`) — reuse
  it for the surface renderer; don't reinvent in CSS pixels.
- How the player *enters* the surface mode is open: there's no sector map until 4.1.
  Cheapest credible wiring is a dev knob (`?mode=surface`, like `?enemy=`) +
  `main.ts` switching which loop it runs — decide in the plan, with the user.
- The GDD's platformer feel bar is high ("tight," Celeste-adjacent). Slice 3.1 is the
  *foundation* — physics correctness over juice, but leave hooks (coyote time,
  jump buffering) as named constants from day one; they're brutal to retrofit.
