# Handoff — Slice 3.2: Mining + Drop Pod

**From:** Slice 3.1 session (2026-06-11)
**For:** the next session, starting cold. You have no memory of previous sessions — everything you need is linked here.

## Where you are

The platformer core exists and works: a clone runs, jumps (coyote time, jump buffering,
jump-cut all live), and melees breakable rock tiles through one hand-made Rocky test
level at `/?mode=surface`. Slice 3.2 makes the loop *mean* something: broken deposits
yield resources into a backpack, a drop pod sits in the level on a timer, depositing at
the pod banks resources, and the pod auto-launches when the window closes — with or
without you (GDD §6.2).

## Read first, in order

1. `CLAUDE.md` — pre-session checklist is mandatory: orient → clarify → **plan file →
   user confirmation** → branch. No application code before the plan is confirmed.
2. `docs/roadmap.md` — **Phase 3, Slice 3.2**: deposits, backpack, deposit-at-pod, pod
   timer + auto-launch, miss-the-window consequence.
3. `docs/game-design.md` §6.2 (pod mechanics), §6.5 (resource table — Rocky =
   Biomineral-rich), §6.4 (what "miss the window" means: deposited safe, backpack lost,
   consciousness snaps to orbit).
4. `docs/work/2026-06-11-platformer-core.md` — what 3.1 built, the physics bug story,
   and what was deliberately left out.
5. `docs/decisions/004-fixed-timestep-and-mode-switch.md` — the loop + mode-switch
   architecture you are extending.

## What 3.1 gives you (the integration points)

- **`src/game/surface/tilemap.ts`** — `TILE_BREAKABLE` + `breakTile(map, tx, ty)`,
  which bumps `map.version` (the renderer's redraw signal). **This is the mining hook:**
  3.2 likely wants `breakTile` to *report* what broke (or a deposit-type tile layer) so
  yields can flow to the backpack. `parseLevel` legend is `# * P .` — extend it for
  deposit tiles and a pod marker.
- **`src/game/surface/clone.ts`** — `updateClone` already breaks tiles overlapping the
  active attack hitbox. `CloneState` is plain data; add `backpack` there (or on
  `SurfaceState` — decide in the plan). **3.3 warning:** items will be *projected from
  ship modules* — don't hardcode ability or capacity assumptions into clone.ts; keep
  them data-driven.
- **`src/game/surface/surface.ts`** — `SurfaceState { map, clone }` + `updateSurface`,
  the single sim entry point. Pod state and its timer belong here (`pod.ts` is named in
  CLAUDE.md's module map and still empty). The pod timer ticks in sim time (`dtMs`
  accumulation), NOT wall-clock — determinism and pause-correctness depend on it.
- **`src/game/data/surface.ts`** — every tunable lives here with a justification
  comment. Pod window (~5 min baseline, GDD §6.2), yields, backpack size → same file.
- **`src/game/data/levels.ts`** — `ROCKY_TEST_LEVEL` (60×20 ASCII). Comment block maps
  the layout. You'll need to place a pod and deposit clusters.
- **`src/renderer/surface-renderer.ts`** — tile layer redraws only when `map.version`
  changes; clone + slash are per-frame syncs; camera is clamped/integer-rounded. Pod
  sprite + timer visualization slot in the same `sync(state)`.
- **`src/game/main.ts`** — fixed-timestep accumulator (ADR 004), keyboard, and
  `surfaceInput(action, pressed)` on the handle. React gets `onModeChange` once at
  init. The pod timer / backpack HUD needs a *new* event-driven callback (e.g.
  `onSurfaceEvent` once per discrete change, or a per-second timer event) — **never**
  per-frame React state (the existing combat HUD pattern is the model).
- **`RunState`** (`src/game/sim/run-state.ts`) already has `resources` (scrap,
  biominerals, coreCrystals, blueprints) and an unused `surface` RNG stream. Surface
  mode currently never touches RunState — "pod launches with deposited resources" is
  where surface results should start flowing back (decide scope in the plan; full run
  integration is 4.1).

## Gotchas (will cost you time if skipped)

- **Node 22 first:** `source ~/.nvm/nvm.sh && nvm use 22` before
  `pnpm install`/`test`/`git commit` — Husky/lint-staged break on Node 20. Each Bash
  call is a fresh shell. Fresh worktrees need `pnpm install`.
- **Pushing 403s with the default gh account** (repo belongs to `peteroomen`):
  - push: `git -c credential.helper= -c 'credential.helper=!f() { echo username=peteroomen; echo password=$(gh auth token --user peteroomen); }; f' push …`
  - gh: `GH_TOKEN=$(gh auth token --user peteroomen) gh pr create …`
- **Preview server cwd matters:** `preview_list` before `preview_start` — a server
  rooted in the main repo serves main's code, not your worktree.
- **Preview tab throttling:** when the preview tab is backgrounded, rAF stops — the
  game advances ~250 ms of sim (`MAX_FRAME_MS`) per screenshot capture. Held-input
  tests via eval look frozen; the stuck-key trap is real (a timed-out eval that
  dispatched `keydown` but never `keyup` cost this session several confusing
  screenshots). Dispatch all keyups defensively; prefer end-state assertions over
  mid-motion ones.
- **The sub-pixel collision convention:** tile scans for an AABB max edge use
  `maxEdgeTileIndex(edge) = ceil(edge / TILE_SIZE) - 1` (`tilemap.ts`), NOT
  `floor((edge - 1) / TILE_SIZE)`. The latter misses sub-pixel penetrations and lets
  resting bodies sink through floors (3.1's one real bug — see the work log). If you
  write any new tile-range query, use the helper, and test *resting* contact, not just
  fast impacts.
- **Sim purity:** `src/game/surface/` imports nothing from React/PixiJS/DOM. The pod
  timer is sim state, the renderer draws it, React hears about it via events.
- Keyboard: ←/→/A/D move, Space/W/↑ jump, X/J attack. Touch: `TouchControls.tsx`
  overlay calls `handle.surfaceInput()` — extend the same component if the pod needs a
  "deposit" interaction (or make deposit automatic on overlap — GDD reads as walk-up;
  decide in the plan).

## Open feel items (not blockers for 3.2)

Human hand-play of 3.1 hasn't happened yet: jump arc, coyote (80 ms) / buffer (100 ms)
windows, move speed, and multi-touch on a real phone. All knobs in
`src/game/data/surface.ts`. If the user wants a feel pass first, it's a legitimate
session opener before 3.2 — ask.
