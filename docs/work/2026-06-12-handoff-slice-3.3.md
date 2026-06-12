# Handoff — Slice 3.3: Module Item Projection

**From:** Slice 3.2 session (2026-06-12)
**For:** the next session, starting cold. You have no memory of previous sessions —
everything you need is linked here.

## Where you are

The surface loop is complete end-to-end: mine deposits → backpack → walk-up deposit
at the pod → auto-launch with aboard/stranded consequences. 3.3 is **the north-star
slice**: clone items are projected from the ship's installed modules (no Engine
module = no double jump; a Gunship clone fights well but barely jumps), plus the
reactor item cap. Test with multiple loadouts — this is where "your ship build
creates your platformer experience" becomes real or doesn't (GDD §6.3).

## Read first, in order

1. `CLAUDE.md` — pre-session checklist is mandatory: orient → clarify → **plan file →
   user confirmation** → branch. No application code before the plan is confirmed.
2. `docs/roadmap.md` — **Phase 3, Slice 3.3**: items derived from installed ship
   modules (double jump, phase dash, scanner, shield bubble…), reactor item cap.
3. `docs/game-design.md` §6.3 (clone system — baseline vs projected items), §4.2–4.3
   (module slots, reactor core / item cap), §6.2 (item swap at the pod — decide if
   it's in 3.3 scope or deferred).
4. `docs/work/slice-3.2-plan.md` — what 3.2 built (read "What actually happened").
5. `docs/decisions/004-fixed-timestep-and-mode-switch.md`.

## What 3.2 left you (the integration points)

- **`CloneState.backpack`** (`surface/clone.ts`) is plain data; capacity is enforced
  **only** in `surface.ts` via `BACKPACK_CAPACITY` — deliberately, so 3.3 can derive
  capacity from modules without touching clone.ts. Same pattern for the pod window:
  `createSurface(rows, { podWindowMs })` already takes an override — Engine-quality
  extension is a caller-side concern.
- **`updateClone` returns `{ brokenTiles }`**; `surface.ts` maps tile types → yields
  via `surface/mining.ts`. New item effects that break tiles (dash-through? ranged?)
  should report breaks the same way, never resolve yields inside clone.ts.
- **`surface/surface.ts`** orchestrates per step: clone update → yields → pod
  deposit-on-overlap → pod tick → outcome. Read the order comment before inserting
  item logic; deposit-before-tick is a correctness invariant, not style.
- **`SurfaceView` / `onSurfaceUpdate`** (`src/game/surface-view.ts`, emitted from
  `main.ts` only on field-wise change): extend this for item/cooldown HUD state —
  never add per-frame React updates. `SurfaceHUD.tsx` is the pure-presentation HUD.
- **Surface mode has no RunState.** `main.ts` builds `SurfaceState` directly from
  `ROCKY_TEST_LEVEL`. 3.3 needs the module list — either create a `RunState` in
  surface mode (hull via the existing `?hull=` knob) or pass a module list into
  `createSurface`. Decide in the plan; remember modules/items are **data**
  (`src/game/data/`), logic only interprets them.
- **Touch controls** (`components/TouchControls.tsx`): items likely need at least one
  more button. Pointer events only; pointer-up/leave/cancel must release.

## Gotchas (will cost you time if skipped)

- **Worktree split:** 3.2 was implemented in `../pixel-horizons-slice-3.2` because a
  parallel foundry-UI session owned the main tree. Check `git worktree list` and
  where `feature/foundry-ui` stands before assuming the main tree is yours. The main
  tree may still hold `stash@{0}` (foundry WIP + superseded 3.2 edits — do not pop it
  onto a 3.3 branch).
- **Node 22 first:** `source ~/.nvm/nvm.sh && nvm use 22` before
  `pnpm install`/`test`/`git commit`. Fresh worktrees need `pnpm install`.
- **Pushing 403s with the default gh account** (repo belongs to `peteroomen`):
  - push: `git -c credential.helper= -c 'credential.helper=!f() { echo username=peteroomen; echo password=$(gh auth token --user peteroomen); }; f' push …`
  - gh: `GH_TOKEN=$(gh auth token --user peteroomen) gh pr create …`
- **Preview server cwd matters:** `preview_list` before `preview_start`. The main
  repo's `.claude/launch.json` has a `dev-slice-3.2` config (port 3001) that cd's
  into the 3.2 worktree — copy the pattern for a new worktree, don't reuse it
  blindly.
- **Preview-tab rAF throttling:** the hidden preview tab advances sim time only
  ~250 ms per capture, and timed multi-call input sequences are unreliable (sim runs
  in real time between some calls, frozen between others). Dispatch all keyups
  defensively (dead-man `setTimeout` keyup saved this session); prefer end-state
  assertions; use the `?pod=` (and `?hull=`) knobs to shorten scenarios.
- **Sub-pixel tile scans:** any new tile-range query uses
  `maxEdgeTileIndex(edge) = ceil(edge / TILE_SIZE) - 1` (`tilemap.ts`), and test
  *resting* contact (the 3.1 floor-sink bug).
- **Pod-adjacent geometry quirk** (useful for tests): both walk-pins near the pod
  stop the clone 4 px outside the pod AABB — holding a direction never ends in
  overlap; you must stop on the pod deliberately.
- **Sim purity:** `src/game/surface/` imports nothing from React/PixiJS/DOM. Items
  tick in sim time; the renderer draws them; React hears about them via events.

## Open feel items (not blockers)

Human hand-play is now two slices behind: the 2.5 combat fun checkpoint, the 3.1
platformer feel (jump arc, coyote 80 ms / buffer 100 ms, multi-touch on a real
phone), and the 3.2 pod pressure (is 5:00 right? is the far cluster worth it? knobs:
`POD_WINDOW_MS`, yields, `BACKPACK_CAPACITY` in `data/surface.ts`). The aboard
overlay variant has also only been seen by tests, never by a human. If the user wants
a feel pass first, it's a legitimate session opener — ask.
