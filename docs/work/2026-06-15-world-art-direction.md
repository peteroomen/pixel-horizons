# World Art Direction — combat screen pixel art

**Date:** 2026-06-15
**Branch:** feature/world-art (off `feature/the-arsenal` — merge PR #13 first)
**Roadmap item:** Phase 6 — Slice 6.1 (visual identity pass), combat-screen scope
**Design source:** `docs/design/foundry-world-art-direction.dc.html` (from Claude Design;
README intent: recreate the look pixel-perfectly in the target tech, match visual output).

## Goal

Replace the placeholder programmer art in the space/combat renderer with the design's
actual pixel-art — Gunship hull + composited module overlays, the Bloom grunt and the
Anchormaw boss with visible Spore-Sac / Armor-Node organs, and the infested lane backdrop
— and add the HUD framing (edge vignette + world-only CRT scanlines). Pure renderer +
DOM-overlay work; **no sim changes**.

## Approach

The design ships literal pixel-art draw functions (canvas-2D `fillRect`, integer-scaled,
nearest-neighbor) — exactly our render path. Port them near-verbatim into a new
`src/renderer/sprites.ts` (helpers `R/hx/mix/rng/blob/dither/outline/make` + factories),
then feed each sprite canvas to PixiJS as a `Texture` with `scaleMode: 'nearest'` and
draw it as a `Sprite`. This keeps the art pixel-perfect to the spec and reuses its code.

**Two palettes, one law** (the design's thesis): the world is Resurrect 64, muted and
ramped; FOUNDRY's five pure accents stay in the HUD and are the *only* fully-saturated
pixels allowed in the world (muzzle, shield, organ cores). We honor it by porting the
spec's exact hexes and keeping pure accents to FX/organ-cores only.

**Module compositing** (the core fantasy — "what you install is what you see"): the player
ship is a base hull + per-category overlay sprites stamped on mount slots. Map
`CombatView.modules` names → overlay kind (weapon→cannon, Shield Generator→shield,
engine→drive pod, else→armor) and composite one overlay per present category. Build-
reactive silhouette, no new art per build.

**Framing:** DOM overlays between the canvas and the FOUNDRY plates — a radial-gradient
vignette and a 1px repeating-linear-gradient scanline layer, both `pointer-events:none`,
matching the spec's section 6 values. HUD plates paint on top and stay razor-sharp.

**Motion:** light and cheap this slice — player idle bob, Bloom breathing pulse, muzzle
flash on the turn the player lands damage. Heavier "it lives" motion (breathing coral,
drifting motes) deferred to the 6.6 juice pass.

## Steps

- [ ] `src/renderer/sprites.ts` — port spec helpers + factories: `gunshipHull()`,
      `moduleOverlay(kind)`, `compositeShip(kinds)`, `bloomGrunt()`, `anchormawBoss()`,
      `laneBackdrop(w, h, seed)`, `muzzleFlash()`. Each returns an `HTMLCanvasElement`.
- [ ] `src/renderer/textures.ts` (or inline) — canvas → nearest-neighbor PixiJS `Texture`.
- [ ] Rewrite `space-renderer.ts` to use Sprites: full-scene lane backdrop, composited
      player ship, grunt/boss enemy with organs. Preserve hit-flash, shield ring, boss
      scale, death fade. Add idle bob, breathing, muzzle-on-hit.
- [ ] `WorldFraming.tsx` (or inline divs in `page.tsx`) — vignette + scanline overlays
      between `GameCanvas` and the HUD.
- [ ] Keep the cyan shield ring but restyle toward the spec's shield-bubble cue.

## Manual test steps

- [ ] `?hull=hull-gunship&enemy=enemy-gatemaw` → enter a lane: player shows a Gunship hull
      with composited overlays; the Anchormaw boss shows green Spore-Sac + amber Armor-Node
      organs fused to the body; lane backdrop is infested (beacon, current, coral, motes),
      not an empty starfield; vignette + scanlines frame it under the FOUNDRY plates.
- [ ] A normal lane enemy shows the Mawling grunt, not a magenta blob.
- [ ] Play a damage card → muzzle flash + enemy hit-flash; take damage → player hit-flash.
- [ ] Shields up → shield cue visible; enemy at 0 HP → fades.
- [ ] 375px mobile: sprites + framing still read; HUD plates stay sharp on top.
- [ ] Edge case: a hull with few modules composites fewer overlays (no crash); a
      non-boss enemy has no organs.

## Out of scope for this session

Sim/gameplay changes; the sector-map and surface-mode art (the language extends there
later); heavy motion/juice (6.6); production-final sprite sheets (these are the design's
direction sprites ported faithfully); Deep-Fold planet/real generated backdrops (the lane
is the coded backdrop from the spec).

---

<!-- Fill in below during/after the session -->

## What actually happened

Ported the design's pixel-art faithfully and dropped it into the PixiJS space renderer.
The design's canvas-2D draw functions transferred almost verbatim into `sprites.ts`; each
sprite canvas becomes a nearest-neighbor PixiJS texture. Browser-verified desktop + 375px:
the composited Gunship (cyan shield ring), the Anchormaw boss with visible green Spore-Sac
+ amber Armor-Node organs, the Mawling grunt for normal enemies, the infested lane (coral
edges, motes, realspace beacon, diagonal current), and the vignette + scanline framing all
read as one game under the sharp FOUNDRY plates. No console errors. 419 tests still green
(renderer-only; no sim touched).

Module compositing is live and build-reactive: `CombatView.modules` names map to overlay
categories (weapon→cannon, Shield Generator→shield, engine→drive pod, else→armor) and the
ship sprite rebuilds when the category set changes. Gunship shows cannon+shield+armor; the
Scout shows cannon+engine+armor with no shield ring (it has no Shield Generator).

Motion kept light per plan: rigid player idle bob, Bloom breathing pulse, muzzle flash on
the turn the player lands damage, red hit-flash both sides, pink phase-2 boss tint.

## Files created / modified

**New:** `src/renderer/sprites.ts` (the port), `src/renderer/textures.ts` (nearest-neighbor
texture helper), `docs/design/foundry-world-art-direction.dc.html` (design provenance).
**Modified:** `src/renderer/space-renderer.ts` (full rewrite — sprites instead of Graphics
placeholders), `src/app/page.tsx` (vignette + scanline framing during lane/surface).

## Deferred to next session

Heavier "it lives" motion (breathing coral, drifting motes, node pulse) → 6.6 juice pass;
the surface/mining-mode and sector-map art (the language extends there — design §"NEXT");
production-final sprite sheets / Deep-Fold-generated planets & real backdrops; per-enemy
distinct Bloom bodies beyond the one grunt (all non-boss enemies share the Mawling sprite
today); tuning sprite scale/positions if a feel pass wants it.

## Status

- [ ] In progress
- [x] Complete
- [ ] Partial — see deferred
