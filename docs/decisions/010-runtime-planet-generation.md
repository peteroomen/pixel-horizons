# ADR 010: Runtime Planet Generation (revises ADR 002)

Date: 2026-06-16
Status: Accepted

## Context

ADR 002 chose Deep-Fold's generators as the procedural art backbone but, because Deep-Fold is
a Godot-shader tool, decided to **consume pre-exported spritesheets** and explicitly ruled a
runtime WebGL port "out of scope" — "If runtime planet generation is ever wanted, the shaders
would need a WebGL port (explicitly out of scope; pre-generated/exported assets only)."

Three facts found 2026-06-16 reopen that decision:

1. **Deep-Fold/PixelPlanets is MIT-licensed** — source for 8 planet types plus stars,
   galaxies, asteroids, and a space-background generator. Credit appreciated, not required.
2. **A JS/Three.js port already exists** (Timur310/PixelPlanets), so the Godot-shader →
   web-GLSL translation is largely done by the ecosystem.
3. We already render with **PixiJS v8, which natively runs custom GLSL shaders**.

A feasibility spike (`docs/work/2026-06-16-planet-shader-spike.md`,
`src/renderer/planet-spike.ts`, `/planet-spike`) generated seven pixel planets at runtime from
one fragment shader and verified, at the pixel level:

- the shader compiles in Pixi v8's WebGL2 path;
- output is **byte-deterministic** as a pure function of a `uSeed` uniform (+ cosmetic
  `uTime`) — a baked still at fixed time is reproducible;
- multiple animated planets perform fine and read as chunky pixel art.

The determinism result is the decisive point: a seed uniform sourced from our existing seeded
RNG keeps the "same seed = same run" contract that powers shareable URLs and daily runs
(ADR 003) — without a finite, pre-rendered pool.

## Decision

**Generate planets (and space/atmosphere backdrops) at runtime via ported Deep-Fold GLSL
shaders run through PixiJS v8, instead of consuming pre-exported spritesheets.** This revises
ADR 002 §1 / §15 and removes the "pre-generated/exported assets only" constraint and the
"runtime out of scope" consequence.

- **Determinism:** the planet's seed uniform is derived from the run seed via the seeded RNG
  (`rng.ts`). Planet identity is computed, never stored as pixels; statics are baked to a
  `RenderTexture` once per planet for stable, cheap reuse.
- **Palette lock unchanged in intent (ADR 002 §2):** Resurrect 64 is enforced by **feeding
  R64 colour ramps into the shaders as uniforms**, replacing the planned post-hoc LUT recolor.
  `palette.ts` becomes "supply/validate R64 ramps" rather than "LUT-swap exported sprites."
- **Biome-matches-planet (ADR 002 §3) gets simpler:** the surface tileset is recoloured from
  the *same ramp* we generated the planet with — a direct read, not a sample-the-sprite step.
- **Attribution:** Deep-Fold (MIT) — and Timur310's port if its GLSL is lifted — credited in
  the credits screen; keep the MIT notices with any ported shader source.
- **Scope guard:** WebGL/GLSL path only for now (Pixi v8 WebGL2 is GLSL ES 300); the WGSL/
  WebGPU path is deferred. Ship base/module sprites stay hand-built per ADR 002 §1b — this ADR
  covers planets and backdrops only.

### PixiJS v8 integration constraints (from the spike — load-bearing for 6.1)

- Custom GLSL must contain a literal `#version 300 es` header or `in`/`out` won't compile
  (`GlProgram.from` greps for it).
- `Shader.from` resource uniforms are uploaded as **loose** uniforms in the GL path — declare
  loose `uniform float ...`, never a UBO interface block (a block leaves an active UBO unbound
  → silent `gl INVALID_OPERATION`, skipped draw).
- Pixi reliably feeds its camera/transform UBOs only to its own mesh shader; custom shaders
  either declare Pixi's exact `globalUniforms` block + loose `uTransformMatrix`, or bypass the
  scene transform (clip-space quads / render-to-texture). 6.1 picks one.

## Consequences

- **No finite planet pool / no asset export pipeline** to build or store; planet variety is
  unbounded and free. Removes ADR 002's spritesheet-export and LUT-swap work.
- **`palette.ts` is still load-bearing and still needs tests**, but as ramp generation/
  validation feeding shader uniforms (degenerate/low-contrast ramps) rather than sprite LUTs.
- **Couples planet visuals to a shader pipeline** — Pixi-v8/WebGL2-specific shader code,
  plus a small library of ported planet-type shaders to maintain. The spike documents the v8
  pitfalls so this is a known cost.
- **Determinism is strengthened, not weakened** — identity is a pure function of the seed
  uniform; reproducible across map/orbit/surface views.
- **WebGPU is a future port risk** if Pixi's WebGL2 path is ever dropped; shaders would need
  WGSL equivalents. Accepted as deferred.
- Bloom enemy art (ADR 002 §4) and the audio decisions are untouched.
