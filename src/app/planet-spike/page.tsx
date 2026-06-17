'use client';

import { useEffect, useRef } from 'react';

import { Application, Container, Sprite, TextureSource } from 'pixi.js';

import { planetForNode } from '@/game/sim/planet';
import { renderPlanetTexture } from '@/renderer/planet';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, computeScale } from '@/renderer/pixel-scale';

/**
 * Dev harness for runtime planets (`/planet-spike`). Drives the real sim→renderer flow:
 * `planetForNode` derives a descriptor per fake node id, `renderPlanetTexture` bakes each to a
 * RenderTexture, shown as nearest-sampled sprites. Verifies determinism + the Resurrect 64
 * ramp uniforms in the browser before the in-game orbit wiring lands. Throwaway; delete with
 * the page once planets render at a real planet node.
 */
export default function PlanetSpikePage() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;

    let cancelled = false;
    let app: Application | null = null;
    let resize: (() => void) | null = null;

    void (async () => {
      TextureSource.defaultOptions.scaleMode = 'nearest';
      const created = new Application();
      await created.init({
        width: VIRTUAL_WIDTH,
        height: VIRTUAL_HEIGHT,
        background: 0x0a0a12,
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

      const scene = new Container();
      created.stage.addChild(scene);

      // Hero — one node, larger, so the pixel grid reads.
      const hero = new Sprite(renderPlanetTexture(created, planetForNode('demo', 'hero'), 240));
      hero.position.set(28, VIRTUAL_HEIGHT / 2 - 120);
      scene.addChild(hero);

      // A grid of distinct fake node ids → distinct planets (variety + determinism).
      ['n1-0', 'n2-0', 'n2-1', 'n3-0', 'n3-1', 'n4-0'].forEach((nodeId, i) => {
        const sprite = new Sprite(renderPlanetTexture(created, planetForNode('demo', nodeId), 104));
        sprite.position.set(300 + (i % 3) * 116, 30 + Math.floor(i / 3) * 168);
        scene.addChild(sprite);
      });
    })();

    return () => {
      cancelled = true;
      if (resize !== null) window.removeEventListener('resize', resize);
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
      }}
    />
  );
}
