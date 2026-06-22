'use client';

import { useEffect, useRef, useState } from 'react';

import { Application, TextureSource } from 'pixi.js';

import CoreBreakerHud from '@/components/CoreBreakerHud';
import { getModule } from '@/game/data';
import type { ModuleInstance } from '@/game/data';
import { planetForNode } from '@/game/sim/planet';
import { portraitConfig } from '@/game/surface/core-breaker';
import type { CoreBreakerHandle, CoreBreakerHudState } from '@/renderer/core-breaker-renderer';
import { coreBreakerViewport } from '@/renderer/core-breaker/layout';
import { startCoreBreaker } from '@/renderer/core-breaker/session';

/**
 * Playable Core Breaker dev route — one of two entry paths to the *same* Core Breaker run
 * (`startCoreBreaker`); the other is the in-game mining phase. This route just owns its own Pixi
 * app + scaling and feeds the run from URL knobs. Deterministic from `?seed=`. Dev knobs:
 * `?seed=`, `?modules=mining-laser,missile-pod`, `?difficulty=3`.
 */

const DEFAULT_MODULES = [
  'mod-mining-laser',
  'mod-missile-pod',
  'mod-cargo-scanner',
  'mod-phase-shifter',
];

export default function CoreBreakerPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<CoreBreakerHandle | null>(null);
  const [hudState, setHudState] = useState<CoreBreakerHudState | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;

    const params = new URLSearchParams(window.location.search);
    const seed = params.get('seed') ?? 'cb-demo';
    const difficulty = clampInt(params.get('difficulty'), 0, 0, 4);
    const modules = parseModules(params.get('modules'));

    const planet = planetForNode(seed, 'cb');
    // Portrait stage sized to fill the device (shared with the in-game path via coreBreakerViewport).
    const view = coreBreakerViewport(window.innerWidth, window.innerHeight, portraitConfig().width);
    const stageW = view.width;
    const stageH = view.height;

    let cancelled = false;
    let app: Application | null = null;
    let resize: (() => void) | null = null;
    let handle: CoreBreakerHandle | null = null;

    void (async () => {
      TextureSource.defaultOptions.scaleMode = 'nearest';
      const created = new Application();
      await created.init({
        width: stageW,
        height: stageH,
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
        const availW = window.innerWidth * dpr;
        const availH = window.innerHeight * dpr;
        const zoom = Math.max(Math.min(availW / stageW, availH / stageH), 0.1);
        const backingWidth = Math.round(stageW * zoom);
        const backingHeight = Math.round(stageH * zoom);
        created.renderer.resize(backingWidth, backingHeight);
        created.stage.scale.set(zoom);
        created.canvas.style.width = `${backingWidth / dpr}px`;
        created.canvas.style.height = `${backingHeight / dpr}px`;
      };
      applyScale();
      window.addEventListener('resize', applyScale);
      resize = applyScale;

      handle = startCoreBreaker(created, {
        fieldSeed: seed,
        difficulty,
        modules,
        planet,
        viewport: view,
        onHud: setHudState,
      });
      handleRef.current = handle;
    })();

    return () => {
      cancelled = true;
      if (resize !== null) window.removeEventListener('resize', resize);
      handle?.destroy();
      handleRef.current = null;
      app?.destroy(true);
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#06060c', touchAction: 'none' }}>
      <div ref={hostRef} className="grid h-full w-full place-items-center" />
      {hudState !== null && (
        <CoreBreakerHud
          state={hudState}
          onReprint={() => handleRef.current?.reprint()}
          onReturn={() => handleRef.current?.endRun()}
        />
      )}
    </div>
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
