# Slice 3.2 — Mining + Drop Pod: Implementation Plan

**Date:** 2026-06-12
**Branch:** `feature/mining-drop-pod`
**Roadmap item:** Phase 3 — Slice 3.2 Mining + drop pod
**For:** an implementing session starting cold. This plan makes all architectural
decisions; follow it step by step. Where a judgment call was possible, the decision is
recorded inline with its reason — do not re-litigate, just flag in the work log if
something proves wrong in practice.

> **Process notes for the implementer (CLAUDE.md applies in full):**
>
> - `source ~/.nvm/nvm.sh && nvm use 22` before any `pnpm` or `git commit` — Husky
>   breaks on Node 20. Every Bash call is a fresh shell.
> - This file is the session plan file. Confirm it with the user before writing code,
>   then fill in the "What actually happened" sections at the end of the session.
> - Push/PR needs `peteroomen`-scoped credentials (origin 403s on the default gh
>   account):
>   `GH_TOKEN=$(gh auth token --user peteroomen) gh pr create …` and
>   `git -c credential.helper= -c 'credential.helper=!f() { echo username=peteroomen; echo password=$(gh auth token --user peteroomen); }; f' push …`
> - One slice = one PR is the project precedent (3.1 shipped sim + renderer + UI in
>   one PR); the "don't mix sim and renderer" rule yields to the slice rule here.
> - No new library, so no ADR is required. The surface-view emission pattern (step 8)
>   is an extension of the existing once-per-event callback convention (ADR 004), not
>   a new decision.

## 1. Summary

Slice 3.2 makes the platformer loop mean something. Breakable deposit tiles (Biomineral
deposits, Scrap caches — Rocky is Biomineral-rich per GDD §6.5) yield resources into a
capacity-limited backpack on the clone when meleed. A drop pod sits in the level on a
sim-time countdown (~5 min baseline, GDD §6.2); walking onto the pod auto-deposits the
backpack into the pod, where resources are safe no matter what. When the window closes
the pod auto-launches — with or without you: clone aboard means everything is banked;
clone elsewhere means the backpack is lost and consciousness snaps to orbit (GDD §6.4).
A surface HUD (pod timer, backpack, deposited totals) and an end-of-run overlay
(aboard/stranded result + Drop Again restart) surface all of it in React via a new
once-per-change callback. Run-state integration (banked resources flowing into
`RunState.resources`) is **deferred to 4.1** — this slice ends at a typed
`SurfaceView` result screen.

**Decisions made here (per the 3.1 handoff's open questions):**

- **Deposit is automatic on overlap** with the pod — GDD reads as walk-up; no new
  button, no touch-control changes.
- **Backpack lives on `CloneState`** — GDD §6.4 (3.4 will drop it at the death
  point), so it is clone-carried data. Capacity stays a data constant consumed by
  `surface.ts`/`mining.ts`, **never read inside `clone.ts`** (3.3 will make capacity
  module-driven).
- **No RNG** — yields are fixed data; determinism untouched, `surface` RNG stream
  stays unconsumed.
- **No early/manual launch** — the timer is the only exit (roadmap scope). Out of
  scope list below.
- **Yield-table location:** yield *amounts* are named constants in
  `src/game/data/surface.ts`; the tile-type → amount mapping lives in
  `surface/mining.ts`. (A `Record<TILE_*, …>` in the data file would import tile
  constants from `surface/tilemap.ts`, which already imports `TILE_SIZE` from the data
  file — a require cycle. Numbers in data, interpretation in logic.)

## 2. Files to create

### `src/game/surface/mining.ts`

Yield interpretation + backpack arithmetic. Pure, React/Pixi-free.

```ts
import type { Resources } from '@/game/sim/run-state';

/** Partial resource bundle produced by breaking one tile. */
export type ResourceDelta = Partial<Resources>;

/** Yield for a broken tile type, or null if the tile yields nothing (plain rock). */
export function tileYield(tile: number): ResourceDelta | null;

/** Total units carried (sum of all four resource counts). */
export function backpackUsed(backpack: Resources): number;

/**
 * Add a yield to the backpack, clamped to capacity. Mutates backpack.
 * Resources are added in fixed order (scrap, biominerals, coreCrystals, blueprints)
 * until capacity is hit; overflow is lost (the tile still broke).
 * Returns true if at least one unit was added.
 */
export function addYield(backpack: Resources, delta: ResourceDelta, capacity: number): boolean;
```

`tileYield` maps `TILE_DEPOSIT_BIOMINERAL → { biominerals: BIOMINERAL_DEPOSIT_YIELD }`,
`TILE_SCRAP_CACHE → { scrap: SCRAP_CACHE_YIELD }`, everything else (including
`TILE_BREAKABLE`) → `null`.

### `src/game/surface/pod.ts`

Pod state + timer + deposit + launch resolution. Pure.

```ts
import type { Resources } from '@/game/sim/run-state';
import type { Body } from './physics';
import type { CloneState } from './clone';
import type { Tilemap } from './tilemap';

export interface PodState {
  /** World-space AABB, anchored at the 'D' marker's top-left tile corner. */
  x: number;
  y: number;
  w: number; // POD_WIDTH
  h: number; // POD_HEIGHT
  /** Total launch window (ms, sim time) — kept for HUD progress display. */
  windowMs: number;
  /** Sim-time remaining until auto-launch. Clamped at 0. */
  remainingMs: number;
  /** Resources banked in the pod — safe no matter what (GDD §6.2). */
  deposited: Resources;
  launched: boolean;
}

/** Build the pod from the level's 'D' marker, or null if the level has none. */
export function createPod(map: Tilemap, windowMs: number): PodState | null;

/** Strict AABB intersection between pod and clone body (flush edges don't overlap). */
export function podOverlapsClone(pod: PodState, body: Body): boolean;

/**
 * Move the entire backpack into pod.deposited and zero the backpack.
 * Returns true if anything moved (future SFX/event hook).
 */
export function depositBackpack(clone: CloneState, pod: PodState): boolean;

/**
 * Tick the countdown by dtMs of sim time. Returns true on exactly the step where
 * remainingMs reaches 0 (the launch step). Sets launched; further ticks return false.
 */
export function tickPod(pod: PodState, dtMs: number): boolean;
```

`createPod` returns `{ x: map.podX, y: map.podY, w: POD_WIDTH, h: POD_HEIGHT, … }`
with `deposited: { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 }`.

### `src/game/surface/mining.test.ts`, `pod.test.ts`, `surface.test.ts`

See §6 Test plan.

### `src/game/surface-view.ts`

The React-facing snapshot, sibling to `combat-view.ts` (it lives in `src/game/`, not
`surface/` — it is boundary plumbing, not sim).

```ts
import type { Resources } from '@/game/sim/run-state';
import type { SurfaceOutcome, SurfaceState } from './surface/surface';

export interface SurfaceView {
  /** ceil(remainingMs / 1000) — shows the starting number immediately, 0 only at launch. Null = level has no pod. */
  podSecondsLeft: number | null;
  podWindowSeconds: number | null;
  backpack: Resources;
  backpackUsed: number;
  backpackCapacity: number;
  deposited: Resources;
  outcome: SurfaceOutcome;
  /** Backpack contents lost at a stranded launch — for the result overlay. Null otherwise. */
  lostBackpack: Resources | null;
}

export function buildSurfaceView(state: SurfaceState): SurfaceView;

/** Field-wise equality — main.ts emits onSurfaceUpdate only when this is false. */
export function surfaceViewEquals(a: SurfaceView, b: SurfaceView): boolean;
```

`buildSurfaceView` returns fresh objects every call (copies of the Resources records,
never references into sim state) so React state is never aliased to mutable sim data.

### `src/components/SurfaceHUD.tsx`

Pure presentation, props-only (model: `HUD.tsx`). No imports from `src/game/` except
the `SurfaceView` type re-exported through `@/game/main`.

```tsx
interface SurfaceHUDProps {
  view: SurfaceView;
}
export default function SurfaceHUD({ view }: SurfaceHUDProps);
```

Layout (same `retro` text style and absolute-positioning conventions as `HUD.tsx`,
`pointer-events-none` throughout):

- **Top-left:** `POD T-M:SS` (e.g. `POD T-4:37`), derived from `podSecondsLeft`.
  Text turns warning-colored (`#e94560`) when `podSecondsLeft * 1000 <= POD_WARNING_MS`
  — pass the threshold as seconds via the view? No: hardcoding a color flip in the
  component would need the constant. Add `podWarning: boolean` to `SurfaceView`
  instead (computed in `buildSurfaceView` from `POD_WARNING_MS`) — components never
  import game data.
- **Top-right:** `PACK {backpackUsed}/{backpackCapacity}` plus one line per non-zero
  backpack resource (`BIO 4`, `SCRAP 3`), then `BANKED` lines for non-zero deposited
  resources.
- Render nothing pod-related when `podSecondsLeft === null`.

(Add the `podWarning: boolean` field to the `SurfaceView` interface above — it is part
of the view contract.)

## 3. Files to modify

### `src/game/data/surface.ts`

Append, each with a one-line justification comment (existing house style):

```ts
/** Pod launch window in sim-time ms — GDD §6.2 baseline (~5 min); Engine quality extends it in 3.3+. */
export const POD_WINDOW_MS = 5 * 60 * 1000;

/** Remaining-time threshold for the HUD/pod urgency cue. */
export const POD_WARNING_MS = 30 * 1000;

/** Pod AABB footprint — 2×3 tiles, big enough to overlap-deposit without precision walking. */
export const POD_WIDTH = 32;
export const POD_HEIGHT = 48;

/** Total resource units the clone can carry — forces return trips within one window. */
export const BACKPACK_CAPACITY = 20;

/** Biominerals per deposit tile — Rocky worlds are Biomineral-rich (GDD §6.5). */
export const BIOMINERAL_DEPOSIT_YIELD = 2;

/** Scrap per surface cache tile (GDD §6.5: Scrap found everywhere). */
export const SCRAP_CACHE_YIELD = 3;
```

### `src/game/surface/tilemap.ts`

- New tile constants:

  ```ts
  export const TILE_DEPOSIT_BIOMINERAL = 3;
  export const TILE_SCRAP_CACHE = 4;
  ```

- `Tilemap` gains `podX: number | null; podY: number | null;` (top-left px of the 'D'
  marker tile, like spawn; null when the level has no pod — physics-only test levels
  stay valid).
- `parseLevel` legend grows: `'b'` → `TILE_DEPOSIT_BIOMINERAL`, `'s'` →
  `TILE_SCRAP_CACHE`, `'D'` → pod marker (tile itself parses as `TILE_EMPTY`, position
  recorded ×`TILE_SIZE`). **More than one `'D'` throws** (loud-failure, same policy as
  spawn); zero is allowed (`podX/podY = null`). Update the legend doc comment.
- `isSolid` returns true for the two new types as well — deposits are rock you can
  stand on until broken.
- `breakTile` signature change: `breakTile(map, tx, ty): number | null` — returns the
  tile type that was broken, or null if nothing broke (not breakable / OOB). Breaks
  all three breakable types (`TILE_BREAKABLE`, `TILE_DEPOSIT_BIOMINERAL`,
  `TILE_SCRAP_CACHE`); `map.version` bumps only on an actual break, exactly as today.

### `src/game/surface/clone.ts`

- `CloneState` gains `backpack: Resources` (import the type from
  `@/game/sim/run-state` — sim is pure, the import direction is fine).
  `createClone` initializes it to all-zeros.
- `updateClone` return type changes from `void` to `{ brokenTiles: number[] }` — the
  tile-type values of every tile broken this step (the attack-hitbox loop collects
  non-null `breakTile` returns). Clone.ts does **not** read yields, capacity, or
  anything mining-related — it reports what broke; `surface.ts` owns the economy
  (the 3.3 module-projection warning from the handoff).

### `src/game/surface/surface.ts`

The orchestrator grows pod + outcome:

```ts
export type SurfaceOutcome = 'ongoing' | 'aboard' | 'stranded';

export interface SurfaceState {
  map: Tilemap;
  clone: CloneState;
  pod: PodState | null;
  outcome: SurfaceOutcome;
  /** Snapshot of the backpack lost at a stranded launch; null otherwise. */
  lostBackpack: Resources | null;
}

export interface CreateSurfaceOptions {
  /** Override the pod window (dev knob / tests). Defaults to POD_WINDOW_MS. */
  podWindowMs?: number;
}

export function createSurface(rows: string[], options?: CreateSurfaceOptions): SurfaceState;
export function updateSurface(state: SurfaceState, input: InputState, dtMs: number): void;
```

`updateSurface` per fixed step, in this exact order:

1. If `state.outcome !== 'ongoing'`, return immediately — the run is over, the sim
   freezes (consciousness snapped / clone aboard).
2. `const { brokenTiles } = updateClone(state.clone, state.map, input, dtMs)`.
3. For each broken tile: `const y = tileYield(t); if (y) addYield(state.clone.backpack, y, BACKPACK_CAPACITY)`.
4. If `state.pod && podOverlapsClone(state.pod, state.clone.body)` →
   `depositBackpack(state.clone, state.pod)`. (Deposit **before** the tick so a clone
   standing on the pod at expiry banks everything — "aboard with a full backpack" is
   impossible by construction.)
5. If `state.pod` and `tickPod(state.pod, dtMs)` returns true (the launch step):
   - overlap → `state.outcome = 'aboard'` (backpack already empty via step 4);
   - no overlap → `state.outcome = 'stranded'`,
     `state.lostBackpack = { ...state.clone.backpack }`, zero the backpack.

### `src/game/data/levels.ts`

Place the pod and deposits in `ROCKY_TEST_LEVEL`. Requirements (exact cell choices are
the implementer's, validated by the parse tests and a browser pass — keep every row at
60 chars and update the comment block):

- **Pod:** `'D'` at column 3, row 15 — pod AABB occupies cols 3–4 × rows 15–17
  (48–80 px × 240–288 px), resting on the solid row 18, a step right of spawn. The
  three `'.'` cells below/beside it (cols 3–4, rows 16–17) stay empty — the pod is
  **not** tiles, it's an entity; the clone walks through it.
- **Near cluster (tutorializes mining):** convert the existing `**` at row 17,
  cols 6–7 to `bb` — first thing the player meleed in 3.1 now visibly pays.
- **Mid:** convert the `*` at row 14, col 32 (atop the step-2 platform) to `b`; add an
  `s` cache at standing height somewhere in the cols 24–35 floor stretch.
- **Far cluster (risk/reward vs the timer):** 4–5 `b` + 1–2 `s` at standing/jump
  height in the cols 44–55 stretch beyond the wall — the trip there and back is the
  miss-the-window tension.
- **Keep at least one plain `*`** (e.g. the existing one at row 17 col 47 — note the
  level file's comment block says col 50, which is wrong; fix the comment while
  you're in there) so "plain rock yields nothing" stays manually testable.

### `src/game/main.ts`

- New dev knob, documented like `?enemy=` / `?hull=`:

  ```ts
  /** Dev/test knob: `?pod=20` sets the launch window in seconds (manual testing
   *  shouldn't take 5 minutes). Invalid values fall back to POD_WINDOW_MS. */
  function resolvePodWindowMs(): number;
  ```

  (Parse positive integer seconds from `?pod=`; anything else → `POD_WINDOW_MS`.)
- Surface branch: `let surfaceState = createSurface(ROCKY_TEST_LEVEL, { podWindowMs: resolvePodWindowMs() })`
  (was `const`).
- `GameCallbacks` gains `onSurfaceUpdate?(view: SurfaceView): void`. Re-export the
  `SurfaceView` type from main.ts (React imports types only from `@/game/main`).
- In `tickFn`, after the accumulator while-loop: build the view, compare to the last
  emitted one, emit only on change:

  ```ts
  const view = buildSurfaceView(surfaceState);
  if (lastView === null || !surfaceViewEquals(lastView, view)) {
    lastView = view;
    callbacks.onSurfaceUpdate?.(view);
  }
  ```

  This is once-per-discrete-change (≈1/sec for the timer tick, plus mining/deposit
  moments), honoring the never-per-frame React rule. Emit once right after init too,
  so the HUD has data before the first second elapses.
- Surface-mode `restartRun()` stops being a no-op: rebuild
  `surfaceState = createSurface(…same options…)`, reset `lastView = null` (forces an
  emit next tick). Guard: only when `surfaceState.outcome !== 'ongoing'` (same
  guard-not-throw convention as combat's `restartRun`). Held `input` keys persist
  deliberately — same as a combat restart, no stuck-state risk.

### `src/renderer/surface-renderer.ts`

- Tile redraw loop: two new cases —
  - `TILE_DEPOSIT_BIOMINERAL`: base fill teal-green `0x3a8a6a` with 2–3 small lighter
    flecks (`0x6fd0a8`) — reads as crystal at 16 px;
  - `TILE_SCRAP_CACHE`: metallic gray `0x8a8a92` with a darker seam line.
    (Placeholder palette, consistent with 3.1's hand-picked colors.)
- Pod sprite: a Graphics capsule built once (hull `0xb0b8c0`, viewport window
  `0x4fc3f7`, darker base skids), positioned at `pod.x/pod.y` in `sync`. Hidden when
  `state.pod === null` or `pod.launched`. Urgency cue, derived from **sim time** so it
  is pause-correct and deterministic: when `pod.remainingMs <= POD_WARNING_MS`,
  alternate the hull tint every 250 ms of remaining time
  (`Math.floor(pod.remainingMs / 250) % 2`).
- No other changes — tile version gating, camera, clone, slash all stay as is.

### `src/components/GameCanvas.tsx`

Thread `onSurfaceUpdate?: (view: SurfaceView) => void` through props →
`callbacksRef` → `initGame` callbacks, exactly like `onModeChange`.

### `src/app/page.tsx`

- `const [surfaceView, setSurfaceView] = useState<SurfaceView | null>(null)` and a
  memoized `onSurfaceUpdate` callback.
- Surface branch renders `SurfaceHUD` (when view non-null) alongside `TouchControls`,
  plus an outcome overlay when `surfaceView.outcome !== 'ongoing'`, styled exactly
  like the combat outcome overlay (`bg-black/70`, `retro` heading, 8bit `Button`):
  - heading `POD LAUNCHED`; subline `CLONE ABOARD` (`#4fc3f7`) or
    `CLONE STRANDED — CONSCIOUSNESS RECALLED` (`#e94560`);
  - banked totals from `view.deposited`; for stranded, a `LOST` block from
    `view.lostBackpack`;
  - `Button` "Drop Again" → `handleRef.current?.restartRun()`.

## 4. Implementation order

Each step compiles and its tests pass before moving on. Steps 1–7 are sim-only
(Vitest-verifiable, no browser); 8–11 are wiring/renderer/UI.

1. **Constants** — extend `src/game/data/surface.ts`.
2. **Tilemap** — new tile types, legend (`b`/`s`/`D`), `podX/podY`, `breakTile`
   return value, `isSolid`. Extend `tilemap.test.ts`.
3. **Mining** — `surface/mining.ts` + `mining.test.ts`.
4. **Clone** — `backpack` field, `brokenTiles` return. Update `clone.test.ts`
   (existing tests get the new field via `createClone`; attack tests now also assert
   the return value).
5. **Pod** — `surface/pod.ts` + `pod.test.ts`.
6. **Orchestrator** — `surface.ts` state shape + update order + outcome; new
   `surface.test.ts` integration suite (scripted-input runs, see §6).
7. **Level** — `ROCKY_TEST_LEVEL` pod + deposits; parse test asserts the real level
   has exactly one pod and ≥1 of each deposit type.
8. **Surface view** — `src/game/surface-view.ts` (+ unit test for `ceil` seconds,
   equality, and no-aliasing of Resources objects).
9. **main.ts** — `?pod=` knob, `onSurfaceUpdate` emission with change detection,
   surface `restartRun`.
10. **Renderer** — deposit tile drawing, pod sprite + warning flash.
11. **React** — `SurfaceHUD.tsx`, `GameCanvas` threading, `page.tsx` HUD + overlay.
12. **Verify + close out** — `pnpm lint`, `pnpm type-check`, `pnpm test`; manual
    browser pass (§7); update CLAUDE.md Current State; write
    `docs/work/2026-06-12-handoff-slice-3.3.md`; commit, push, PR.

## 5. Data structures (consolidated)

```ts
// tilemap.ts
export const TILE_EMPTY = 0;
export const TILE_SOLID = 1;
export const TILE_BREAKABLE = 2;
export const TILE_DEPOSIT_BIOMINERAL = 3; // 'b' — yields biominerals
export const TILE_SCRAP_CACHE = 4;        // 's' — yields scrap
export interface Tilemap {
  width: number; height: number; tiles: number[];
  spawnX: number; spawnY: number;
  podX: number | null; podY: number | null; // 'D' marker top-left px, if present
  version: number;
}
export function breakTile(map: Tilemap, tx: number, ty: number): number | null;

// clone.ts
export interface CloneState {
  /* …all 3.1 fields unchanged… */
  backpack: Resources; // carried, lost on stranded launch (and dropped on death in 3.4)
}
export function updateClone(clone, map, input, dtMs): { brokenTiles: number[] };

// mining.ts
export type ResourceDelta = Partial<Resources>;
export function tileYield(tile: number): ResourceDelta | null;
export function backpackUsed(backpack: Resources): number;
export function addYield(backpack: Resources, delta: ResourceDelta, capacity: number): boolean;

// pod.ts
export interface PodState {
  x: number; y: number; w: number; h: number;
  windowMs: number; remainingMs: number;
  deposited: Resources; launched: boolean;
}
export function createPod(map: Tilemap, windowMs: number): PodState | null;
export function podOverlapsClone(pod: PodState, body: Body): boolean;
export function depositBackpack(clone: CloneState, pod: PodState): boolean;
export function tickPod(pod: PodState, dtMs: number): boolean;

// surface.ts
export type SurfaceOutcome = 'ongoing' | 'aboard' | 'stranded';
export interface SurfaceState {
  map: Tilemap; clone: CloneState;
  pod: PodState | null;
  outcome: SurfaceOutcome;
  lostBackpack: Resources | null;
}
export function createSurface(rows: string[], options?: { podWindowMs?: number }): SurfaceState;

// surface-view.ts
export interface SurfaceView {
  podSecondsLeft: number | null;   // ceil(remainingMs / 1000)
  podWindowSeconds: number | null;
  podWarning: boolean;             // remainingMs <= POD_WARNING_MS
  backpack: Resources;
  backpackUsed: number;
  backpackCapacity: number;
  deposited: Resources;
  outcome: SurfaceOutcome;
  lostBackpack: Resources | null;
}
```

`Resources` is reused from `src/game/sim/run-state.ts`
(`{ scrap, biominerals, coreCrystals, blueprints }`) — no new bundle type; 4.1's
RunState integration becomes a plain object merge.

## 6. Test plan

All in Vitest, all pure-sim. Drive integration tests through `updateSurface` with
scripted `InputState` frames at `FIXED_DT_MS` (the 3.1 pattern — input scripts are
pure data).

**`tilemap.test.ts` (extend):**

- `'b'`/`'s'` parse to their tile types; `isSolid` true for both.
- `'D'` parses to `TILE_EMPTY` with `podX/podY = col*16 / row*16`; level without `'D'`
  → both null; two `'D'`s → throws.
- `breakTile` returns the broken type for each of the three breakable kinds; returns
  null for solid, empty, and OOB; `version` increments only when a tile actually broke.
- `ROCKY_TEST_LEVEL` parses with exactly one pod marker and contains ≥1
  `TILE_DEPOSIT_BIOMINERAL`, ≥1 `TILE_SCRAP_CACHE`, ≥1 plain `TILE_BREAKABLE`.

**`mining.test.ts` (new):**

- `tileYield`: biomineral deposit → `{ biominerals: BIOMINERAL_DEPOSIT_YIELD }`; scrap
  cache → `{ scrap: SCRAP_CACHE_YIELD }`; plain breakable / solid / empty → null.
- `addYield`: adds into an empty backpack (returns true); partial add at the capacity
  boundary (e.g. capacity 20, used 19, delta 2 → exactly 1 added, returns true); full
  backpack → nothing added, returns false; `backpackUsed` sums all four fields.

**`pod.test.ts` (new):**

- `createPod` from a level with `'D'` → AABB at the marker, `remainingMs === windowMs`,
  zeroed `deposited`; level without → null.
- `tickPod`: counts down by `dtMs`; returns true exactly once, on the step that hits 0
  (drive `windowMs = 100`, tick at 16.67 ms — assert the 6 leading falses, one true,
  then false again with `remainingMs` pinned at 0 and `launched === true`).
- `podOverlapsClone`: strict overlap true; flush-edge contact (clone right edge ==
  pod left edge) false — matches the physics convention that flush edges don't
  intersect.
- `depositBackpack`: moves everything, zeroes backpack, returns true; second call on
  the now-empty backpack returns false; two deposits accumulate in `deposited`.

**`clone.test.ts` (update):**

- Existing attack test extended: breaking a deposit tile returns it in `brokenTiles`;
  swings that hit nothing return `[]`.
- A swing overlapping two breakable tiles returns both in one step's `brokenTiles`.

**`surface.test.ts` (new — the slice's core scenarios):**

- **Mine → backpack:** script walks the spawn-adjacent clone to the `bb` cluster,
  attacks; assert `clone.backpack.biominerals` rises by the data yield and
  `map.version` bumped.
- **Auto-deposit:** with a non-empty backpack, script walks onto the pod; assert
  backpack zeroed, `pod.deposited` got it all, in the overlap frame.
- **Aboard:** short window (`podWindowMs: 2000`), clone stays standing on the pod;
  run updates past expiry → `outcome === 'aboard'`, backpack empty, deposited intact,
  `lostBackpack === null`.
- **Stranded:** clone mines but stays away from the pod past expiry →
  `outcome === 'stranded'`, `lostBackpack` equals the pre-launch backpack, backpack
  zeroed, `pod.deposited` (anything banked earlier) untouched.
- **Frozen after launch:** after an outcome is set, further `updateSurface` calls with
  movement input change nothing (deep-equal state before/after).
- **Capacity clamp end-to-end:** tiny capacity via mining many deposits → backpack
  never exceeds `BACKPACK_CAPACITY` total units.
- **Determinism:** run the same scripted input sequence twice from two
  `createSurface` calls → final `SurfaceState`s deep-equal.
- **No-pod level:** physics-style level without `'D'` → `pod === null`, outcome stays
  `'ongoing'` forever, no throw.

**`surface-view` test (new, small):**

- `podSecondsLeft` is `ceil` (299001 ms → 300); `podWarning` flips at the threshold;
  `surfaceViewEquals` detects each field; returned `backpack`/`deposited` are copies
  (mutating the view does not touch sim state).

Renderer, main.ts wiring, and React components are browser-verified (§7), not
unit-tested — project convention.

## 7. Manual test steps

- [ ] `nvm use 22 && pnpm dev` → `http://localhost:3000/?mode=surface&pod=25` — pod
      capsule sits right of spawn, HUD shows `POD T-0:25` counting down, backpack
      `PACK 0/20`.
- [ ] Melee the two deposit tiles by spawn — flecked tiles break, `BIO` count rises,
      `PACK` rises. Melee the plain far rock later — breaks, yields nothing.
- [ ] Walk onto the pod — backpack zeroes, `BANKED` totals appear.
- [ ] Run to the far cluster, mine, return, deposit; then stand clear and let the
      timer expire → overlay `POD LAUNCHED / CLONE STRANDED`, banked totals shown,
      `LOST` block shows whatever was still carried.
- [ ] "Drop Again" → fresh level, full timer, zeroed totals.
- [ ] Stand on the pod at expiry → `CLONE ABOARD`, everything banked, no `LOST` block.
- [ ] Edge — backpack cap: with `?pod=300`, mine more than 20 units worth → `PACK`
      pins at 20/20, overflow lost, tiles still break.
- [ ] Pod flash: in the last 30 s the pod visibly pulses.
- [ ] `?mode=surface` without `pod=` → timer starts at 5:00.
- [ ] 375 px responsive: HUD readable, mine + deposit entirely via touch buttons.
- [ ] Background the tab ~10 s, return — timer advanced only ~250 ms (sim-time
      clamp working; this is expected, not a bug).
- [ ] Plain `http://localhost:3000/` — combat regression: full fight unchanged, no
      surface HUD anywhere.

## 8. Edge cases for the implementer

- **Deposit-before-tick ordering** (updateSurface steps 4→5) is what makes "aboard"
  clean — don't reorder. A clone overlapping the pod at the launch step has, by
  definition, already banked its backpack that same step.
- **`breakTile` callers:** clone.ts is the only caller today. Its attack loop must
  collect return values *without* changing the scan bounds — keep
  `maxEdgeTileIndex` for the hitbox edges (the 3.1 sub-pixel convention; see the
  work-log bug story). Any new tile-range query you write must use the helper too.
- **`updateClone` return-type ripple:** TypeScript will not force test updates for an
  ignored return value — grep `updateClone(` in tests and update deliberately.
- **Capacity is summed units, not per-resource** — `backpackUsed` sums all four
  fields; the clamp applies to the total.
- **Partial-fill order is part of determinism:** `addYield` fills in declared
  Resources order. Single-resource deltas make this invisible today, but the test
  pins it so 3.3+ multi-resource yields stay deterministic.
- **Timer is sim time only.** Never `Date.now()`/wall clock; the accumulator already
  feeds `dtMs`. Backgrounded tabs effectively pause the run (MAX_FRAME_MS clamp) —
  acceptable and deterministic; pod-defense events (later phases) will revisit.
- **`remainingMs` exactly 0 on a step boundary** must launch on that step, not the
  next; `tickPod` returns true when crossing *to* 0 (`remainingMs <= 0` after
  decrement, clamp to 0, fire once).
- **Pod is an entity, not tiles** — it must never appear in the tile grid or
  `isSolid`; the clone walks through it. Don't accidentally make 'D' parse to a solid.
- **Resources object aliasing:** `lostBackpack` and every `SurfaceView` field must be
  copies (`{ ...x }`), or React state will mutate under the sim (and the stranded
  overlay would show zeros).
- **Emission loop guard:** `surfaceViewEquals` must compare `Resources` field-by-field
  (no reference equality), or you'll emit every frame and violate the
  no-React-at-60fps rule. Conversely, don't memoize `buildSurfaceView` on object
  identity — sim state mutates in place.
- **Preview-tab testing gotcha (from the 3.1 session):** backgrounded preview tabs
  advance ~250 ms of sim per screenshot; dispatch keyups defensively in any
  eval-driven input and prefer end-state assertions. Use `?pod=` small values rather
  than waiting on real timers.
- **StrictMode double-mount:** `GameCanvas` already handles init/destroy racing;
  `onSurfaceUpdate` goes through `callbacksRef` like every other callback — don't
  capture the prop directly in `initGame`'s closure.

## 9. Dependencies on prior slices

- **3.1 platformer core:** `tilemap.ts` (`breakTile` + `version` redraw signal,
  `maxEdgeTileIndex`), `physics.ts` (`Body`, flush-edge AABB convention), `clone.ts`
  (attack hitbox loop = the mining hook), the fixed-timestep accumulator + `?mode=`
  knob in `main.ts` (ADR 004), `TouchControls` input pipeline, `surface-renderer.ts`
  version-gated tile layer.
- **1.2 sim skeleton:** `Resources` type from `run-state.ts` (reused verbatim so 4.1
  can merge pod `deposited` straight into `RunState.resources`); serializable
  plain-JSON state discipline.
- **Conventions:** ADR 001 (cards/UI in DOM — the HUD/overlay are React),
  ADR 003 (determinism — no RNG consumed this slice), ADR 004 (loop + mode switch,
  extended not changed).

## 10. Out of scope for this session

- RunState integration — banked resources do **not** touch `RunState.resources` yet
  (4.1 wires surface results into the run when the sector map drives mode entry).
- Early/manual pod launch; item swap at the pod; pod-defense events (GDD §6.2, later).
- Module→item projection, module-driven backpack capacity / Engine-extended window (3.3).
- Clone death, backpack drop at death point, corpse runs, re-prints (3.4).
- Core Crystal / Blueprint deposit tiles (deep caves — no such depth in the test level;
  the tile-type + yield pattern extends trivially when 3.4/5.3 levels need them).
- Mining SFX/juice, pod launch animation (6.x) — `addYield`/`depositBackpack` boolean
  returns are the future hook points.
- Save/resume of mid-run surface state.

---

<!-- Fill in below during/after the implementation session -->

## What actually happened

Implemented to plan with no architectural deviations. Notables:

- **Mid-session worktree split:** a parallel session (foundry UI) took over the main
  working tree mid-implementation — it stashed this slice's tracked edits (stash@{0},
  mixed with that session's own `layout.tsx`/`HUD.tsx`/etc. edits) and switched the
  tree to `feature/foundry-ui`. Slice 3.2 moved to a dedicated worktree
  (`../pixel-horizons-slice-3.2` on `feature/mining-drop-pod`); only this slice's nine
  files were restored from the stash, and the stash entry was left intact because it
  still holds the foundry session's work.
- The plan's level-geometry quirk turned out helpful in testing and worth knowing for
  3.3: both walk-pins near the pod (left wall at x=32, deposit cluster at x=84) stop
  the clone 4 px outside the pod AABB (48..80) — overlap requires actually stopping on
  it, never just holding a direction. Good for avoiding accidental deposits; slightly
  awkward for scripted browser tests.
- Browser verification ran against a worktree-rooted dev server on port 3001 (config
  added to the main repo's `.claude/launch.json` as `dev-slice-3.2`). Verified:
  render (pod, deposits, caches), timer countdown + warning color + pod flash,
  mining → `PACK 4/20` `BIO 4` (both cluster tiles in one swing), walk-up deposit →
  `BANKED BIO 4`, stranded overlay + Drop Again restart, 375 px touch layout, combat
  regression on plain `/`, zero console errors/warnings. The **aboard** overlay
  variant was not reproduced in-browser (rAF throttling in the hidden preview tab
  makes timed walk-stop-wait sequences impractical — the eval stuck-key trap from the
  3.1 log is real; a dead-man keyup was used defensively). Aboard semantics are pinned
  by the `surface.test.ts` integration test; the overlay branch is symmetric JSX to
  the verified stranded branch.
- `pnpm lint`, `pnpm type-check`, `pnpm test` all green: 272 tests (233 → +39).

## Files created / modified

Created: `src/game/surface/mining.ts` + `.test.ts`, `src/game/surface/pod.ts` +
`.test.ts`, `src/game/surface/surface.test.ts`, `src/game/surface-view.ts` +
`.test.ts`, `src/components/SurfaceHUD.tsx`.
Modified: `src/game/data/surface.ts` (pod/backpack/yield constants),
`src/game/data/levels.ts` (pod marker + deposit clusters; fixed the stale col-50
comment), `src/game/surface/tilemap.ts` (+2 tile types, 'D' marker, breakTile returns
type), `src/game/surface/clone.ts` (backpack field, brokenTiles return),
`src/game/surface/surface.ts` (pod + outcome orchestration), `src/game/main.ts`
(`?pod=` knob, change-detected onSurfaceUpdate, surface restartRun),
`src/renderer/surface-renderer.ts` (deposit/cache tiles, pod sprite + flash),
`src/components/GameCanvas.tsx`, `src/app/page.tsx` (SurfaceHUD + outcome overlay),
plus test updates in `tilemap.test.ts` / `clone.test.ts`.

## Deferred to next session

- RunState integration (banked resources → `RunState.resources`) — 4.1 as planned.
- Human hand-play: pod-window pressure at the real 5:00, the far-cluster trip
  risk/reward, the aboard overlay variant on a real run, plus the still-open 3.1 feel
  pass (jump arc, coyote/buffer, multi-touch on a phone).
- Everything in "Out of scope" above (early launch, item swap, pod-defense, 3.3/3.4
  features, SFX/animation).

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
