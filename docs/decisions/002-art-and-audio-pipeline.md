# ADR 002: Art & Audio Pipeline

Date: 2026-06-10
Status: Accepted

## Context

No dedicated 2D artist. The game needs: procedural planets, multi-biome platformer tilesets that *visually match* the generated planets, modular ship sprites, biological (Bloom) enemy sprites, space backdrops, and a cohesive audio identity — all achievable placeholder-first by one developer with off-the-shelf and generated assets.

## Decision

### Art

**1. Deep-Fold generators as the procedural backbone** (itch.io, free — donate + attribute in credits):
- **Pixel Planet Generator** — planet sprites (map view, orbit view, pod-descent backdrop)
- **Pixel Space Background Generator** — space/hyperspace lane backdrops

(Deep-Fold's Spaceship Generator was considered but rejected — its output is not pixel art and would break the aesthetic.)

**1b. Ship sprites are hand-built modular layers in Aseprite:** one base hull silhouette per chassis (Scout/Gunship/Freighter/Tactical) + per-slot module overlay sprites, so installed modules are visibly composited on the ship (a GDD requirement anyway — generators couldn't have delivered the slot-overlay system regardless). Only 4 hulls + a module sprite set are needed; placeholder geometric versions first.

**2. Palette lock.** One master palette for the entire game — **Resurrect 64** (Lospec) as the working choice: big enough for six biomes plus the mechanical-vs-organic faction contrast, widely used for exactly this look. Every asset — generator output, Kenney packs, hand-edits — is color-mapped through it. Palette consistency, more than drawing skill, is what makes mixed-source pixel art read as one game.

**3. Biome variety via recoloring, not unique tilesets.** One base terrain autotile set (starting from Kenney's *Pixel Platformer* pack, CC0) palette-swapped per biome, plus a small per-biome overlay decoration set (vines, ice shine, lava glow, spores). The key trick: **sample the dominant colors of the generated planet sprite at landing time and recolor the terrain tileset from them** (`renderer/palette.ts`, LUT-based swap). The surface always matches the planet you saw from orbit — which is the entire "biomes match the generated planets" requirement, solved programmatically instead of with N hand-made tilesets.

**4. Bloom enemies are the one true custom-art cost.** Five archetypes + bosses. Placeholder recolored blobs first; hand-drawn in Aseprite or commissioned once the game proves out. Their organic look should deliberately break the clean mechanical grid of player assets.

**5. Placeholder-first, art passes as roadmap slices** (same discipline as breakout-roguelite): every gameplay slice ships with programmer art; dedicated visual-identity slices land in Phase 6.

### Audio

**6. SFX: generated retro.** jsfxr / ChipTone for one-off retro SFX (free, instant, inherently matches pixel art); Kenney audio packs (CC0) for UI sounds. Sound design rule reinforcing the factions: **clean/mechanical** sounds for Collective ship, UI, and clone; **wet/organic** sounds for everything Bloom.

**7. Music: adaptive, placeholder-first.** Direction: dark ambient/synth for hyperspace lanes, brighter chiptune-leaning tracks for planets, tense layer for combat. Implementation: a small WebAudio bus (music + SFX channels) with crossfade on mode transitions, built early with CC0/CC-BY itch.io placeholder tracks; commissioned or licensed music is a post-validation decision.

## Consequences

- Total art budget until validation: ~$0 plus Deep-Fold donations; attribution section required in credits (Deep-Fold, Kenney, Lospec palette author, any CC-BY audio).
- Runtime tileset recoloring couples surface visuals to planet generation — `palette.ts` becomes load-bearing and needs tests (degenerate palettes, low-contrast planets).
- Palette lock constrains future asset purchases — anything bought must survive color-mapping to Resurrect 64.
- The Pixel Planet Generator is a Godot-shader tool; we consume *exported spritesheets*, not the shaders. If runtime planet generation is ever wanted, the shaders would need a WebGL port (explicitly out of scope; pre-generated/exported assets only).
- Bloom enemy art is the schedule risk to flag early if commissioning.
