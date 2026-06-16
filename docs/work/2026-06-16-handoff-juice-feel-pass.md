# Handoff → 6.6 continued (feel tuning + surface juice)

**Written:** 2026-06-16 (end of Slice 6.6 first cut, branch `feature/combat-juice`)
**For:** the next single-slice session — assume you start cold.
**Roadmap:** Phase 6 — 6.6 Game feel & juice pass (combat cut shipped; this is what's left).

## Where things stand

- **6.6 combat juice (first cut) is built** on `feature/combat-juice`
  (`docs/work/2026-06-16-slice-6.6-combat-juice.md`). Renderer/UI-only, no sim change. 497
  tests green, lint/type-check/build clean, browser-verified desktop + 375px vs Gatemaw.
  **Not yet committed/pushed** as of writing — check `git log` / `git status` first.
- **Runs parallel to** the economy/shield-slot branch
  (`docs/work/2026-06-16-handoff-economy-shield-slot.md`) — zero file overlap by design.
  If both have merged, nothing to reconcile.

## The seam (where the juice lives now)

- `src/components/combat-fx-core.ts` — pure `hpDrop` / `shakeAmplitude` (node-tested).
- `src/components/combat-fx.tsx` — `useDamageFloaters`, `DamageFloaters`, `HitFlash`,
  `PopPip`, `usePrefersReducedMotion`. All fx derive from the change in one HP/pip value
  between renders; combat emits one `CombatView` per event (never per frame).
- `EnemyPlate.tsx` (core + `OrganRow`), `PlayerPlate.tsx` (hull + AP/shield pips),
  `CombatCard.tsx` (hover/tap), `CombatHand.tsx` (`AnimatePresence` deal-in/play-out),
  `space-renderer.ts` (viewport shake + backdrop overscan).

## What's left (pick a coherent slice)

1. **Feel tuning (human-led, small):** shake intensity (`MIN_SHAKE`/`MAX_SHAKE`/`SHAKE_MS`
   in `space-renderer.ts` + `combat-fx-core.ts`), flash brightness/`FLASH_MS`, floater
   rise/duration (`combat-fx.tsx`). Values are first-cut. **Reduced-motion is code-verified
   only** — the preview can't emulate `prefers-reduced-motion`; exercise it on a device.
2. **Surface/platformer juice** — clone hit reactions, mining/deposit pops, pod-launch
   feedback. The surface renderer already has flash/shake/death-fade hooks (3.4); mirror
   the combat approach (derive from `SurfaceView` deltas).
3. **Malfunction card-flip** — the flip seam exists from 2.3; animate the DOM→Malfunction
   transition. Its own coherent piece.
4. **SFX hooks (6.2)** — wire audio triggers at the same fx fire points; leave comments
   already mark intent.

## Gotchas

- **Keep deriving from view deltas — don't touch the sim or `CombatView`.** That's the
  invariant that kept this conflict-free and the sim pure.
- **No `Math.random` in the renderer** — it'd consume the sim's deterministic RNG stream.
  The shake is a damped sinusoid; keep that pattern.
- **Card identity:** `CombatHand` keys on id + occurrence ordinal (the view's own key
  embeds the hand index and shifts the whole tail). Fly-to-discard is approximate for
  duplicate-heavy hands; the clean fix is a stable per-instance id on `CardView` — do it if
  you're already touching hand identity.
- **Backdrop overscan:** if you raise `MAX_SHAKE`, the overscan tiles scale with it
  (`OVERSCAN_TILES = ceil(MAX_SHAKE/PX)`) — no void edge, but re-check at the new amplitude.
- **No jsdom** in the vitest config (`environment: 'node'`) — only pure helpers are
  unit-testable; keep new fx math in `combat-fx-core.ts` if you want coverage.
- Node 22 (`nvm use 22`) before `pnpm install`/`dev`/`commit`; lint is `eslint src`;
  `docs/` is `.prettierignore`d. Fresh worktree needs `pnpm install` (node_modules isn't
  shared from root).
