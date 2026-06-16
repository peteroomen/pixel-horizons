# Surface (Overworld) Art Direction — World Render Pass

**Date:** 2026-06-16
**Branch:** feature/surface-overworld-art (worktree off `main`)
**Roadmap item:** Phase 6.1 (surface) — visual identity pass, pulled forward (mirrors PR #14 "World Art Direction combat renderer")
**Design:** `Foundry - Overworld Art Direction.dc.html` (companion to the combat doc)

## Goal

Replace the surface renderer's flat-colour `Graphics` placeholders with the design's
Resurrect-64 ramped pixel-art, following the established combat pattern
(`sprites.ts` → `textures.ts` → nearest-neighbour `Sprite`). The dirt must read as the
**same game** as the space above it: two palettes, one law — terrain/creatures in muted
R64 ramps, the five pure FOUNDRY accents reserved for signals (mining spark, melee arc,
shield, corpse beacon, core-crystal glint). No sim changes.

## Approach

The surface mode is already functionally complete on `main` (3.4 merged, #17): clone
poses, pod, enemies, hazards, corpse, shield, drops all exist in the sim and are drawn
as flat rects. This slice is **renderer-only** — it swaps the look, derives every
sprite/pose from existing `SurfaceState`, and touches no `src/game/` logic.

Key decisions:
- **Extract shared primitives** (`R`/`mix`/`rng`/`blob`/`dither`/`outline`/`make`/`OUTLINE`)
  from `sprites.ts` into `sprite-primitives.ts`; both combat and surface sprite modules
  import them. The design's `support.js` uses these exact helpers, so its drawing code
  ports verbatim. `sprites.ts`'s public exports are unchanged → combat renderer untouched.
- **`surface-sprites.ts`** — one factory per sprite, ported from the design's `_draw()`:
  terrain (rock fill + rock surface-crust + bedrock + biomineral + scrap + scanned +
  hidden + core), clone poses (idle/run/jump/air/melee), pod (camp/launch), fauna
  (hopper/grubber/dropper), hazards (bramble/crumble/vent grate), corpse, dropped items
  (bio/scrap/core), and coded FX (mining shatter, melee slash crescent, landing puff).
- **Terrain** built once as textures; tile layer rebuilt as a `Sprite` container on
  `map.version` change (same trigger as today). Autotile-lite: a breakable/hidden tile
  with `TILE_EMPTY` above uses the sunlit **surface** variant, else the **fill** variant
  (the design's "top-light surface row").
- **Pod**: render the **camp** (open, ramp down, cloning-bay lit) sprite as the default —
  it *is* the respawn point (3.4 re-print drops the clone here); **launch** burn when
  `pod.launched`. Near-expiry urgency stays an amber sprite-tint pulse (the HUD countdown
  is the primary clock; the DOM HUD restyle is a separate slice).
- **Parallax cave-mouth backdrop** (§3): three coded layers (far sky+mesas, mid rock
  columns, near cave-wall frame) on a stage-space container behind the world, scrolled at
  fractions of the camera. Heat-shimmer on the sky gap + drifting spore motes + an
  ambient descent-tint, animated by a cosmetic `app.ticker` (the `space-renderer` flash
  precedent — renderer-local, no sim coupling, deterministic mote placement).
- **FX**: melee slash → cyan crescent; mining shatter burst on `map.version` change at
  the attack hitbox; landing puff on the grounded false→true transition. Short-lived,
  decayed by the FX ticker. Hit-flash / death-fade / beacon / shield already exist —
  recolour to the design's accents.

## Steps

- [ ] Extract `sprite-primitives.ts`; refactor `sprites.ts` imports (combat unchanged)
- [ ] `surface-sprites.ts`: terrain tile factories + autotile-lite surface/fill variants
- [ ] `surface-sprites.ts`: clone pose factories (idle/run/jump/air/melee) + flip handling
- [ ] `surface-sprites.ts`: pod camp/launch, fauna ×3, hazards ×3, corpse, items ×3, FX
- [ ] Rewrite `surface-renderer.ts`: build textures, sprite-based tile layer, parallax
      container + shimmer/motes/ambient ticker, pose/pod/fauna selection, FX ticker
- [ ] lint + type-check + test + build all green
- [ ] Update `CLAUDE.md` Current State; commit; PR

## Manual test steps

Run `pnpm dev` (Node 22), open `localhost:3000/?mode=surface`:

- [ ] Happy: terrain reads in warm R64 ramps — cool-slate bedrock = unbreakable, warm
      grain = breakable; biomineral veins, scrap caches; exactly **one** pure-cyan glint
      on a core-crystal tile and nowhere else on the dirt.
- [ ] Scanner: `?mode=surface&modules=mining-laser,scanner` — hidden veins reveal with a
      cyan scanner tint; without `scanner` they're indistinguishable from rock.
- [ ] Clone: run/jump/fall/melee swap poses; the cyan visor is the only saturated body
      pixel; i-frame blink + death fade still work after taking a hit.
- [ ] Pod reads as open base-camp; on launch (stand on pod + LAUNCH, or window expiry)
      the orange thruster burn shows; amber pulse in the final 30 s.
- [ ] Fauna read by silhouette (hopper / grubber / dropper), flip with facing; enemy
      drops appear tinted; corpse husk + green beacon after a death, edge arrow when off-screen.
- [ ] Parallax: cave-mouth framing scrolls in depth; heat-shimmer over the sky gap; motes
      drift; no per-frame React churn, no console errors; crisp at 375 px.
- [ ] Edge: mine out a vein → shatter spark + dust; land from height → dust puff; vent
      shows amber chevrons + tan plume while active and pushes the clone.

## Out of scope for this session (→ roadmap)

- **FOUNDRY HUD frames the surface (§10)** — DOM/React restyle of `SurfaceHUD` to plate
  chrome + edge vignette + world scanline + Cloning-Bay overlay polish. Different layer
  (React, not Pixi); own slice.
- **Live LUT biome pipeline (§1 demo)** — sample the orbital planet colour → recolor the
  ramp at landing; Volcanic/Ice. Needs planet-colour on map nodes → folds into 5.3
  (Biomes 2–3). The ramps land here as ordered arrays so the LUT is a future free recolor.
- **Production autotile atlas (47-rule)** — this slice keeps the per-tile draw with
  surface/fill variants; a real packed atlas is a later art task.
- Shield pop ripple frame; module-driven clone silhouette overlay (§4 nice-to-have);
  pickup-magnetism trail FX.

---

## What actually happened

- Discovered `main` is well ahead of `feature/the-forge`: **3.4 is merged (#17)**, so the
  surface sim already has clone death, fauna, hazards, corpse, shield, drops — and PR #14
  had already brought `sprites.ts`/`textures.ts` to combat. This slice is the **surface
  twin** of that combat art pass, so it could be far more complete than first scoped
  (fauna/hazards/death props all buildable now, not blocked on 3.4).
- Worked in an **isolated worktree off `main`** (`feature/the-forge` had a live dev server
  + uncommitted `roadmap.md`/`game-design.md`; never touched it).
- Extracted the shared pixel-art primitives so combat and surface share one render path;
  `sprites.ts` public API unchanged → combat renderer untouched (proven by 490 green tests).
- Ported the design's `_draw()` verbatim into `surface-sprites.ts` (same `R`/`blob`/
  `dither`/`make` helpers the doc's `support.js` uses), then rewired the renderer.
- **Parallax**: shipped the cave-mouth backdrop as a screen-fixed composed scene (sky +
  mid columns + near wall frame) + animated spore motes + ambient descent gloom. Decided
  against multi-rate scrolling this pass (non-tileable layers seam); the framing is
  screen-relative by design ("always looking out of a cave mouth"). Heat-shimmer + true
  per-layer parallax scroll left as polish.
- **Pod**: render the open base-camp sprite as the default (it *is* the re-print/respawn
  point) and the orange-burn launch sprite when `pod.launched`; amber tint pulse in the
  final window keeps the in-world urgency tell.
- All gates green: type-check, `eslint src`, 490 tests, `pnpm build`.

## Files created / modified

- **new** `src/renderer/sprite-primitives.ts` — shared `R`/`mix`/`rng`/`blob`/`dither`/
  `outline`/`make` (extracted from `sprites.ts`)
- **new** `src/renderer/surface-sprites.ts` — terrain ×10, clone poses ×5, pod camp/launch,
  fauna ×3, hazards ×2 tiles, corpse, items ×3, FX (shatter/dust), parallax backdrop, motes
- **mod** `src/renderer/sprites.ts` — imports the shared primitives (combat art unchanged)
- **mod** `src/renderer/surface-renderer.ts` — texture/sprite render path, sprite tile
  layer with autotile-lite surface/fill, parallax + FX ticker, pose/pod/fauna derivation

## Deferred to next session (→ roadmap)

- FOUNDRY HUD frames the surface (§10) — DOM/React `SurfaceHUD` restyle (plate chrome,
  edge vignette, world scanline, Cloning-Bay overlay polish). Different layer; own slice.
- Live LUT biome pipeline + Volcanic/Ice (§1) — sample orbital planet colour → recolor the
  ramp at landing. Ramps already land as ordered arrays; folds into 5.3 (Biomes 2–3).
- Production 47-rule autotile atlas; heat-shimmer + true multi-rate parallax scroll;
  shield pop-ripple frame; module-driven clone silhouette overlay; pickup-magnetism trail.

## Status

- [x] Complete (automated gates green; **visual/feel/375 px = pending human step** per the
      repo's established convention for renderer slices)
</content>
