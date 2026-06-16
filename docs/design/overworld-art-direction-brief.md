# Overworld Art Direction — Claude Design brief (Rocky/Desert, first pass)

**Date:** 2026-06-16
**Purpose:** Hand-off prompt for Claude Design to produce the surface/Overworld art
direction, mirroring the combat-screen pass (`docs/design/foundry-world-art-direction.dc.html`).
**Roadmap:** Phase 6 — 6.1 visual identity, surface scope (companion to the combat pass).
**Deliverable expected back:** one self-contained `docs/design/foundry-overworld-art-direction.dc.html`.

---

## Brief: FOUNDRY Overworld — Rocky/Desert surface art direction (first pass)

### Product
Pixel Horizons is a browser dual-loop roguelite: turn-based deckbuilder space combat
fused with an action-platformer planet-mining mode. You build a ship from modules; those
modules ARE your card deck in space AND your clone's equipment on planets. This brief is
the **Overworld** — the side-scrolling planet surface where a printed clone drops via pod,
mines deposits against a launch-window timer, fights fauna, and dies/re-prints. Enemy
faction is the Bloom (biological). The space-combat screen already has a shipped art
direction; THIS surface must read as the same game.

### The deliverable
One self-contained `.dc.html` file — same format, helper style, and design law as the
existing combat doc `foundry-world-art-direction.dc.html`: literal canvas-2D pixel-art
draw functions (integer-scaled, nearest-neighbor, `fillRect`-level), each factory
returning an `HTMLCanvasElement`, plus a live preview gallery and the exact hex palette.
No external assets, fonts, or libraries — it must port verbatim into our PixiJS renderer.

### Non-negotiable design law (inherit from combat)
- **Two palettes, one law:** the world is **Resurrect 64** (Lospec), muted and ramped;
  FOUNDRY's five pure accents are HUD-only and the ONLY fully-saturated pixels allowed in
  the world (used sparingly for FX/cores — muzzle, shield, crystal glints, corpse beacon).
- **Palette-swappable terrain:** the Rocky tileset must be drawn so its dominant colors can
  be LUT-recolored at runtime per planet (we sample the orbital planet sprite at landing) —
  so build it as one ramped base set, not baked-in hues.
- **UI = same as ship battles, not a redesign:** reuse the FOUNDRY HUD plates, the edge
  vignette, and the 1px world-only scanline framing. Surface just swaps the *readouts*.

### Grid & sizes (so sprites fit our collision/render path)
- Tile = 16px. Clone body = 12×20. Drop pod = 32×48 (2×3 tiles). Camera follows the clone;
  levels scroll horizontally and vertically.

### Scope — sprites/atmosphere to deliver (Rocky/Desert biome only)
1. **Terrain tileset (Rocky):** solid bedrock, breakable rock, biomineral deposit, scrap
   cache, hidden deposit (unscanned = looks like plain rock; scanned = revealed vein),
   core crystal (rare), plus the two solid-state hazards below. Autotile-friendly edges.
2. **Parallax backdrop:** a 2–3 layer Rocky/Desert depth set (sky/horizon mesas → mid
   silhouettes → near cave wall) that reads as claustrophobic mining cave AND open surface.
3. **Drop pod** (idle + a "landed/base camp" read) and its launch state.
4. **The clone** — printed humanoid, visor-lit; needs clear idle / run / jump / mid-air /
   melee-swing reads and an i-frame blink state. (Module-driven silhouette variants are a
   nice-to-have, not required this pass.)
5. **Three Bloom-fauna enemies, each instantly distinguishable in motion:**
   - Bloom Hopper — ground patroller that leaps at you.
   - Scrap Grubber — slow armored scavenger, passive until provoked.
   - Ceiling Dropper — clings to the ceiling, drops when you pass beneath.
6. **Three hazards — must be self-explanatory at a glance:**
   - Spike Bramble (non-solid spiky bed), Crumbling Sandstone (cracked, load-bearing-but-not),
     and **Sandstorm Vent** — a floor grate, rooted on the ground, puffing a telegraphed dust
     plume that pushes you (it previously read as a stray "!" — make it unmistakably a vent).
7. **Death/economy props:** corpse marker (neon-green, with an off-screen edge beacon),
   dropped resource "world items," and the Shield Bubble in its 3 states (ready ring /
   pop ripple / recharging meter).
8. **Core FX (first pass, static frames are fine):** mining-break shatter, melee slash,
   hit red-flash + shake cue, death pixel-collapse fade, dust/landing puff, pickup magnetism.
9. **HUD framing:** reuse combat's vignette + scanlines + FOUNDRY plates; lay out the
   surface readouts — pod launch countdown, clone HP pips, shield status, backpack/banked
   resources — and the **Cloning Bay** death overlay (Re-print / Abandon).

### Room for big ideas (bounded — direction + a few sample frames, not full systems)
Pitch the surface's mood and identity: lighting model (cave gloom vs surface daylight),
depth/parallax language, how "the Bloom is here too" infects the rock, and 1–2 "it lives"
motion cues (heat shimmer, drifting motes, breathing flora). Show enough to set direction;
don't build full animation rigs.

### Out of scope
Other biomes (Volcanic/Ice/Jungle/Ocean/Gas — recolor/overlay later), full animation
state machines, audio, and any sim/gameplay changes. Rocky/Desert only.

### Acceptance
A single portable `.dc.html` with: the hex palette, helper fns + sprite factories returning
canvases, a preview gallery grouping the above, and short notes mapping each sprite to its
in-game entity and to the "two palettes, one law" rule.
