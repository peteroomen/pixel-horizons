'use client';

import { useEffect, useRef } from 'react';

import { Application, TextureSource } from 'pixi.js';

import { getModule } from '@/game/data';
import type { ModuleInstance } from '@/game/data';
import { planetForNode } from '@/game/sim/planet';
import { projectSurfaceBag } from '@/game/surface/ball-projection';
import { defaultConfig } from '@/game/surface/core-breaker';
import { generateField } from '@/game/surface/field-gen';
import { createCoreBreakerRenderer } from '@/renderer/core-breaker-renderer';
import { surfaceRampFor } from '@/renderer/palette';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, computeScale } from '@/renderer/pixel-scale';

/**
 * Playable Core Breaker (CB.4) — composes the real deterministic pieces: a runtime planet
 * (`planetForNode`, recoloured via `surfaceRampFor`), a seeded field (`generateField`), and a bag
 * projected from the loadout (`projectSurfaceBag`). Deterministic from `?seed=`. Dev knobs:
 * `?seed=`, `?modules=mining-laser,missile-pod`, `?reactor=2`, `?difficulty=3`. The orbit DROP →
 * Core Breaker wiring lands with the CB.7 platformer cleanup; this route is the playtest surface.
 */

const DEFAULT_MODULES = [
  'mod-mining-laser',
  'mod-missile-pod',
  'mod-cargo-scanner',
  'mod-phase-shifter',
];

export default function CoreBreakerPage() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;

    const params = new URLSearchParams(window.location.search);
    const seed = params.get('seed') ?? 'cb-demo';
    const reactor = clampInt(params.get('reactor'), 1, 0, 8);
    const difficulty = clampInt(params.get('difficulty'), 0, 0, 4);
    const modules = parseModules(params.get('modules'));

    const planet = planetForNode(seed, 'cb');
    const cfg = defaultConfig();
    const pegs = generateField(planet, cfg, { difficulty });
    const bag = projectSurfaceBag(modules, reactor);
    const landRamp = surfaceRampFor(planet);

    let cancelled = false;
    let app: Application | null = null;
    let resize: (() => void) | null = null;
    let handle: { destroy(): void } | null = null;

    void (async () => {
      TextureSource.defaultOptions.scaleMode = 'nearest';
      const created = new Application();
      await created.init({
        width: VIRTUAL_WIDTH,
        height: VIRTUAL_HEIGHT,
        background: 0x06060c,
        antialias: false,
        roundPixels: true,
        resolution: 1,
        autoDensity: false,
        preference: 'webgl',
      });
      if (cancelled) {
        created.destroy(true);
        return;
      }
      app = created;
      host.appendChild(created.canvas);

      const applyScale = (): void => {
        const dpr = window.devicePixelRatio || 1;
        const scale = computeScale(window.innerWidth, window.innerHeight, dpr);
        created.renderer.resize(scale.backingWidth, scale.backingHeight);
        created.stage.scale.set(scale.zoom);
        created.canvas.style.width = `${scale.cssWidth}px`;
        created.canvas.style.height = `${scale.cssHeight}px`;
      };
      applyScale();
      window.addEventListener('resize', applyScale);
      resize = applyScale;

      handle = createCoreBreakerRenderer(created, {
        pegs,
        bag: bag.balls,
        shotsPerDrop: bag.shotsPerDrop,
        landRamp,
        cfg,
      });
    })();

    return () => {
      cancelled = true;
      if (resize !== null) window.removeEventListener('resize', resize);
      handle?.destroy();
      app?.destroy(true);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: '#06060c',
        touchAction: 'none',
      }}
    />
  );
}

function parseModules(raw: string | null): ModuleInstance[] {
  const ids = (raw === null || raw.trim() === '' ? DEFAULT_MODULES : raw.split(',')).map((s) => {
    const t = s.trim();
    return t.startsWith('mod-') ? t : `mod-${t}`;
  });
  const out: ModuleInstance[] = [];
  for (const id of ids) {
    try {
      getModule(id);
      out.push({ id, tier: 1 });
    } catch {
      // unknown module id — drop it (dev knob is permissive)
    }
  }
  return out;
}

function clampInt(raw: string | null, fallback: number, lo: number, hi: number): number {
  const n = raw === null ? NaN : Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}
