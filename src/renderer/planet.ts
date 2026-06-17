import { Application, Geometry, Mesh, RenderTexture, Shader, type Texture } from 'pixi.js';

import type { PlanetDescriptor } from '@/game/sim/planet';
import { type Ramp, planetRamps, rampToFloats } from './palette';

/**
 * Runtime planet generation (ADR 010). Bakes a Deep-Fold-style pixel planet to a
 * `RenderTexture` from a sim `PlanetDescriptor`, so callers compose it as a plain nearest-
 * sampled `Sprite` in the normal scene graph. Colours come from the planet's Resurrect 64
 * ramps (`palette.ts`) fed in as shader uniforms, keeping the palette lock.
 *
 * Determinism: every pixel is a pure function of `descriptor.seed` (the bake is at a fixed
 * time), so the same node renders the same planet across map / orbit / surface. PixiJS v8
 * shader gotchas observed in the spike are baked in here: the `#version 300 es` header is
 * mandatory, resource uniforms are declared **loose** (never a UBO block), and the quad is
 * emitted in clip space so no camera matrix is needed (it fills the render-texture target).
 */

const vertex = /* glsl */ `#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vUV = aUV;
}
`;

const fragment = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uOffset;   // bounded noise-domain offset derived from the seed (keeps float precision)
uniform float uPixels;
uniform vec3 uOcean[6];
uniform vec3 uLand[6];

float hash(vec2 p) {
    p += uOffset;
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
        v += amp * vnoise(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return v;
}

// Sample a 6-step ramp (index 0 = lightest .. 5 = darkest) at t in [0,1].
vec3 rampAt(vec3 ramp[6], float t) {
    int idx = int(clamp(floor(t * 6.0), 0.0, 5.0));
    return ramp[idx];
}

void main() {
    // Chunky pixels: snap UV to a low-res grid (the whole pixel-art read).
    vec2 uv = (floor(vUV * uPixels) + 0.5) / uPixels;
    vec2 p = uv * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) {
        discard;   // hard cut to transparency — no blended halo on the disc edge
    }

    float z = sqrt(1.0 - r2);
    float lon = atan(p.x, z) + uTime * 0.25;
    float lat = asin(clamp(p.y, -1.0, 1.0));
    vec2 sph = vec2(lon, lat);

    float h = clamp(fbm(sph * 2.3 + uOffset) * 1.15, 0.0, 1.0);

    float sea = 0.48;
    // lightest ramp step = shallow water / lowland, darkest = deep / highland
    vec3 col = h < sea
        ? rampAt(uOcean, 1.0 - h / sea)
        : rampAt(uLand, (h - sea) / (1.0 - sea));

    // Light from upper-left + limb darkening, quantised into 3 cel bands.
    vec3 n = vec3(p, z);
    float light = clamp(dot(n, normalize(vec3(-0.5, 0.6, 0.6))), 0.0, 1.0);
    light = mix(light, z, 0.35);
    float band = floor(light * 3.0 + 0.5) / 3.0;
    col *= 0.5 + 0.5 * band;

    fragColor = vec4(col, 1.0);
}
`;

const FULLSCREEN_QUAD = {
  aPosition: [-1, -1, 1, -1, 1, 1, -1, 1],
  aUV: [0, 1, 1, 1, 1, 0, 0, 0],
  index: [0, 1, 2, 0, 2, 3],
};

function rampUniform(ramp: Ramp): Float32Array {
  return new Float32Array(rampToFloats(ramp));
}

const fract = (x: number): number => x - Math.floor(x);

/**
 * A bounded (0..100) 2D noise-domain offset from the planet seed. The seed itself can be ~1e6;
 * multiplying that inside the shader's hash overflows float32 precision and flattens the
 * terrain, so the variety is moved into a small, precision-safe offset computed here.
 */
function seedOffset(seed: number): [number, number] {
  return [fract(seed * 0.1031) * 100, fract(seed * 0.1357) * 100];
}

interface PlanetMeshBuild {
  mesh: Mesh<Geometry, Shader>;
  geometry: Geometry;
  shader: Shader;
  uniforms: { uniforms: { uTime: number } };
}

/** Build the planet mesh + shader (caller owns disposal). Shared by the static + animated paths. */
function buildPlanetMesh(descriptor: PlanetDescriptor, pixels: number): PlanetMeshBuild {
  const { ocean, land } = planetRamps(descriptor.seed);

  const geometry = new Geometry({
    attributes: { aPosition: FULLSCREEN_QUAD.aPosition, aUV: FULLSCREEN_QUAD.aUV },
    indexBuffer: FULLSCREEN_QUAD.index,
  });

  const shader = Shader.from({
    gl: { vertex, fragment },
    resources: {
      planetUniforms: {
        uTime: { value: 0, type: 'f32' },
        uOffset: { value: seedOffset(descriptor.seed), type: 'vec2<f32>' },
        uPixels: { value: pixels, type: 'f32' },
        uOcean: { value: rampUniform(ocean), type: 'vec3<f32>', size: 6 },
        uLand: { value: rampUniform(land), type: 'vec3<f32>', size: 6 },
      },
    },
  });

  const mesh = new Mesh({ geometry, shader });
  return {
    mesh,
    geometry,
    shader,
    uniforms: shader.resources.planetUniforms as PlanetMeshBuild['uniforms'],
  };
}

/**
 * Render `descriptor` to a fresh nearest-sampled `RenderTexture` of `size`×`size` virtual
 * pixels — a static snapshot. The caller owns the texture (destroy it with the sprite that
 * holds it). `pixels` is the planet's internal resolution — fewer = chunkier.
 */
export function renderPlanetTexture(
  app: Application,
  descriptor: PlanetDescriptor,
  size = 128,
  pixels = Math.round(size * 0.75),
): Texture {
  const { mesh, geometry, shader } = buildPlanetMesh(descriptor, pixels);
  const texture = RenderTexture.create({ width: size, height: size });
  texture.source.scaleMode = 'nearest';
  app.renderer.render({ container: mesh, target: texture });

  mesh.destroy();
  geometry.destroy();
  shader.destroy();

  return texture;
}

/** A planet whose render-texture re-bakes each `update` so the planet spins (for orbit). */
export interface AnimatedPlanet {
  texture: Texture;
  /** Advance rotation by `dtSeconds` and re-bake. */
  update(dtSeconds: number): void;
  destroy(): void;
}

/**
 * Like {@link renderPlanetTexture} but keeps the mesh alive so `update(dt)` advances the
 * planet's longitude (`uTime`) and re-bakes — a live, rotating planet behind a `Sprite`.
 * Re-baking one small texture per frame is cheap; use the static bake for many-planet views.
 */
export function createAnimatedPlanet(
  app: Application,
  descriptor: PlanetDescriptor,
  size = 128,
  pixels = Math.round(size * 0.75),
): AnimatedPlanet {
  const { mesh, geometry, shader, uniforms } = buildPlanetMesh(descriptor, pixels);
  const texture = RenderTexture.create({ width: size, height: size });
  texture.source.scaleMode = 'nearest';
  const bake = (): void => app.renderer.render({ container: mesh, target: texture });
  bake();

  return {
    texture,
    update(dtSeconds: number): void {
      uniforms.uniforms.uTime += dtSeconds;
      bake();
    },
    destroy(): void {
      mesh.destroy();
      geometry.destroy();
      shader.destroy();
      texture.destroy(true);
    },
  };
}
