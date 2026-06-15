# THE ARSENAL — playtest fixes (PR #13)

**Date:** 2026-06-15
**Branch:** `feature/the-arsenal` (commits added to the open PR #13)
**Roadmap item:** Phase 4/5 — playtest fixes on THE ARSENAL mega-slice

## Goal

Fix the bounded bugs from Peter's PR #13 playtest so the run loop is coherent end to
end: the boss only appears at the gate (one fight), Spore Clusters can be cleared,
the engineer Repair button is reliably tappable, organ targeting is legible on mobile,
and a blocked module purchase says *why*. Larger design items (status/Power system,
shop/workbench UX, difficulty tuning) are explicitly deferred to their own slices.

## Scope decision

Peter chose **"bug-fix pass first"**, committed **onto `feature/the-arsenal` (PR #13)**.
So this session does items **1, 3-repair, 3-buy-reason, 4, 5, 6**, and answers the
Vercel-deploy question. Items **2** (Powers/status), **3-UX** (full module UX),
**7** (workbench at stations), and the **"too easy" balance** are NOT in this session.

## Findings (root causes)

- **#1 boss on first travel + #5 boss re-fights "while traveling" — same root cause.**
  `DEFAULT_ENEMY_POOL` in `src/game/sim/travel.ts:42` is *every* enemy
  (`ENEMY_DEFS.map(e => e.id)`), including `enemy-gatemaw` (the gate boss). So normal
  lane encounters can roll the boss, repeatedly. The dedicated gate fight
  (`startBossFight`, `main.ts:469`, `lane: null`) is already a correct single encounter
  ending in `boss-reward`. Fix is to keep the boss out of the lane pool.
  - "Engine cards weaker vs boss" is already handled by THE ARSENAL (engine cards are
    dual-mode travel + Draw 1 / Jettison; the travel effect is inert with no lane). No
    change needed there. "Too easy" (won the boss) is balance → deferred to 5.5.
- **#3 "could afford but couldn't buy."** `canBuyModule` (`economy.ts:84`) requires
  `scrap >= price` **and** `hasSlotRoom`. Peter was blocked on **slots, not Scrap**, but
  the UI gives no reason — the button is just disabled. Fix: surface the reason.
- **#3 engineer Repair "wild clicking."** Leading hypothesis: the `chamfer` clip-path on
  `FoundryButton` (`secondary` variant) clips the corners of an already-small button, so
  taps near the chamfered corners miss the hit area on mobile. Verify in the 375px
  preview; fix the touch target (enlarge / make the row hit-area reliable) rather than
  guessing.
- **#4 Spore Cluster soft-lock.** `card-spore-cluster` (`cards.ts:217`) is
  `unplayable: true` with `onDraw: lose-shield-layer` and **no removal path** — it
  recycles forever and can fill the hand. Fix: give it the existing `jettison` keyword so
  the player can clear it with the cyan ⤓ button (added in THE ARSENAL), and `exhaust`
  it so a cleared cluster doesn't recycle. Keep the on-draw shield pressure (that's the
  Sporecaster's point). Verify hand-cap behavior doesn't throw when the hand is full.
- **#6 mobile organ targeting.** Organ tap-targets exist (`EnemyPlate.tsx:64`) but aren't
  legible/understandable on a phone. Fix: make organ rows obviously tappable + labeled,
  show the selected/core focus clearly, and add a one-line hint that single-target fire
  hits the focused organ. Verify at 375px.
- **#6 deploy question (answer, no code):** the arsenal branch is **not** on the public
  URL. Only `pixel-horizons.vercel.app` (built from `main`) is public; per-branch preview
  deploys sit behind Vercel Authentication (401 unless logged into Vercel). Phone-testing
  the arsenal branch needs either a Vercel login on the preview URL or merging to `main`.

## Approach

Sim-first, smallest diffs, each layer green (`lint` + `type-check` + `test`). Group as:
1. **Sim:** lane pool excludes bosses (data flag on `EnemyDef`, filter in `travel.ts`).
2. **Data:** Spore Cluster gains `jettison` + `exhaust`.
3. **View/UI:** merchant buy-blocked reason; engineer Repair touch target; organ
   targeting legibility.
Each gets/extends a Vitest where it's sim/data; UI is browser-verified at desktop + 375px.

## Steps

- [ ] **Boss out of lanes (#1/#5).** Add `boss?: boolean` to `EnemyDef`
      (`data/types.ts`), set it on `enemy-gatemaw` (`data/enemies.ts`). Filter
      `DEFAULT_ENEMY_POOL` in `travel.ts` to non-boss enemies. Vitest: `createLane` never
      yields a boss enemy across many seeds; `enemy-gatemaw` still reachable via the gate
      path / `?enemy=` knob.
- [ ] **Spore Cluster clearable (#4).** Add `jettison` (no benefit or tiny) + `exhaust`
      to `card-spore-cluster` (`data/cards.ts`). Confirm jettison/exhaust removes it from
      the combat for good. Vitest: an injected Spore Cluster is jettisonable and does not
      return to the draw pile after exhaust. Check hand-cap path doesn't throw.
- [ ] **Buy-blocked reason (#3-buy).** In the merchant view builder + `StationScreen`,
      when an offer isn't buyable, show why (`NEED SLOT` vs `NEED SCRAP`). Minimal — no
      full slot UI (that's the deferred UX slice).
- [ ] **Engineer Repair tappable (#3-repair).** Reproduce at 375px, confirm the
      chamfer-clip hit-area hypothesis, fix the touch target on the `secondary`
      `FoundryButton` (and apply to the other station buttons if they share the flaw).
- [ ] **Organ targeting legible on mobile (#6).** `EnemyPlate` organ rows: clearer tap
      affordance + selected/core state + one-line "single-target hits focused organ" hint.
- [ ] Run `pnpm lint`, `pnpm type-check`, `pnpm test`; browser-verify desktop + 375px.
- [ ] Update CLAUDE.md Current State + this plan's post-session sections; commit and push
      to `feature/the-arsenal`; reply on PR #13 with what changed + the deploy answer.

## Manual test steps

- [ ] Start a run (`?seed=` pinned). Travel several lanes — **no Gatemaw encounters**;
      only standard enemies appear. Reach the gate node → Gatemaw boss fight → win/lose
      resolves once to `boss-reward`/`run-over` (no re-fight).
- [ ] `?enemy=enemy-gatemaw` still forces the boss into a lane (dev knob unaffected).
- [ ] Fight a Sporecaster (or `?enemy=enemy-sporecaster`): Spore Clusters appear, can be
      cleared with the ⤓ Jettison button, and **don't come back** after the shuffle.
      Edge: spam-inject until the hand is near full — no crash, clusters still clearable.
- [ ] At a merchant with enough Scrap but full slots: the module shows **NEED SLOT** (not
      a silently dead button). With slots free but too little Scrap: **NEED SCRAP**.
- [ ] At the engineer on a 375px viewport: a single tap on **Repair** works first time
      (no wild clicking). Repeat several taps to confirm reliability.
- [ ] In the Gatemaw fight on 375px: organs are clearly tappable, the focused organ/core
      is visibly selected, and single-target fire hits the focused organ.

## Out of scope for this session

- **#2** STS-style Powers/status system, exhaust-on-buff, targeted-debuff "skill" cards,
  keyword tooltips (own design slice).
- **#3-UX** full module-management UX (equipped/slot map, spare slots, comparisons).
- **#7** workbench access from engineer/shop nodes (4.2/4.3 integration slice).
- **Difficulty/balance** ("too easy", boss tuning) → 5.5 balance pass.
- Vercel deploy/auth changes — answering the question only.

---

<!-- Fill in below during/after the session -->

## What actually happened

Worked the bug-fix pass and committed onto `feature/the-arsenal` (PR #13), per Peter's choices.

- **#1/#5 (one root cause):** `DEFAULT_ENEMY_POOL` included `enemy-gatemaw`, so lanes rolled the
  boss as a random encounter (and repeatedly). Added a `boss` flag to `EnemyDef`, set it on the
  Gatemaw, and filtered the boss out of the default lane pool. The dedicated gate fight was already
  a correct single encounter — no change needed there. Test: 200 seeds × 5 encounters, never a boss.
- **#4:** `jettisonCard` always pushed to the discard pile, so even a "cleared" Spore Cluster
  reshuffled back. Made jettison route `exhaust` cards to the exhaust pile, then gave Spore Cluster
  `exhaust` + a zero-benefit `jettison` ("Jettison to clear"). The on-draw shield drain stays as the
  Sporecaster's pressure. Verified live: the ⤓ button cleared the card from hand for good.
- **#3 buy reason:** added `ShopOfferView.blockReason` (`need-slot` | `need-scrap` | null) and a
  `NEED SLOT` / `NEED SCRAP` caption under the Buy button. (The user was blocked on slots, not Scrap.)
- **#3 repair tap:** the "wild clicking" is physical-phone-only and didn't reproduce on desktop.
  Hardened mobile tapping generally: scoped `touch-none` to the canvas host (off `<main>`, so DOM
  menu overlays scroll/tap natively) and added `touch-manipulation` to `FoundryButton`. Needs Peter's
  on-device confirmation.
- **#6 organ targeting:** rewrote the `EnemyPlate` organ/core section — "TAP A TARGET TO FOCUS FIRE"
  hint, bordered tappable rows, larger text (6px→8px), and a `◎ TARGET` focus badge that moves with
  selection. Verified live at 375px: tapping Spore-Sac moved the badge off the core onto the organ.
- **#6 deploy question (no code):** the arsenal branch isn't on the public URL — only
  `pixel-horizons.vercel.app` (from `main`) is public; branch previews are behind Vercel auth.
- **Deferred items roadmapped** per Peter's ask: 4.7 (Powers & status), 4.8 (Station UX & workbench
  access), boss/combat balance into 5.2/5.5; GDD §5.10 direction + lane-pool note added.

Could not browser-verify the merchant buy-reason or the engineer screen live this session — the test
run was stuck behind the anchored Gatemaw lane, and reaching a station means grinding combat. Those
changes are simple, type-checked view code; flagged for Peter's phone pass.

## Files created / modified

- Sim/data: `src/game/data/types.ts` (`EnemyDef.boss`), `src/game/data/enemies.ts` (Gatemaw `boss`),
  `src/game/sim/travel.ts` (filter pool), `src/game/data/cards.ts` (Spore Cluster jettison/exhaust),
  `src/game/sim/combat.ts` (`jettisonCard` → exhaust pile), `src/game/combat-view.ts` ("Jettison to
  clear" text), `src/game/station-view.ts` (`blockReason`).
- UI: `src/components/StationScreen.tsx` (buy reason), `src/components/foundry/FoundryButton.tsx`
  (`touch-manipulation`), `src/app/page.tsx` + `src/components/GameCanvas.tsx` (`touch-none` moved to
  canvas host), `src/components/EnemyPlate.tsx` (organ/core legibility + `FocusTag`).
- Tests: `src/game/sim/travel.test.ts`, `src/game/sim/combat.test.ts`, `src/game/combat-view.test.ts`.
- Docs: `docs/roadmap.md` (4.7, 4.8, 5.2/5.5 notes), `docs/game-design.md` (§5.10, lane-pool note),
  `CLAUDE.md` (Current State, known issues), this plan.

## Deferred to next session

- Phone verification of the buy-block label + engineer-repair tap (the touch fix is unprovable on
  desktop).
- The roadmapped slices: **4.7 Powers & status effects** (feedback #2) and **4.8 Station UX &
  workbench access** (feedback #3 UX + #7). Boss/combat difficulty → 5.2/5.5.

## Status

- [ ] In progress
- [x] Complete (bug-fix pass; larger items roadmapped, not built)
- [ ] Partial — see deferred
