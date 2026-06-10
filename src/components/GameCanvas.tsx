'use client';

import { useEffect, useRef } from 'react';
import { Application, TextureSource } from 'pixi.js';

import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, computeScale } from '@/renderer/pixel-scale';
import { buildTestScene } from '@/renderer/test-scene';

interface GameCanvasProps {
  onScaleChange?: (zoom: number) => void;
}

/**
 * Owns the PixiJS Application lifecycle. StrictMode double-mount safe: the async init
 * races against unmount via the `cancelled` flag — if the effect is cleaned up before
 * init resolves, the app is destroyed instead of mounted, so there is never a duplicate
 * canvas or a leaked WebGL context.
 */
export default function GameCanvas({ onScaleChange }: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onScaleChangeRef = useRef(onScaleChange);

  useEffect(() => {
    onScaleChangeRef.current = onScaleChange;
  }, [onScaleChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let app: Application | null = null;
    let observer: ResizeObserver | null = null;

    (async () => {
      TextureSource.defaultOptions.scaleMode = 'nearest';
      const candidate = new Application();
      await candidate.init({
        width: VIRTUAL_WIDTH,
        height: VIRTUAL_HEIGHT,
        background: 0x0f0f1a,
        antialias: false,
        roundPixels: true,
        resolution: 1,
        autoDensity: false,
      });

      if (cancelled) {
        candidate.destroy(true, { children: true, texture: true });
        return;
      }

      app = candidate;
      host.appendChild(app.canvas);
      buildTestScene(app);

      const applyScale = () => {
        if (!app) return;
        const rect = host.getBoundingClientRect();
        const scale = computeScale(rect.width, rect.height, window.devicePixelRatio);
        app.renderer.resize(scale.backingWidth, scale.backingHeight);
        app.stage.scale.set(scale.zoom);
        app.canvas.style.width = `${scale.cssWidth}px`;
        app.canvas.style.height = `${scale.cssHeight}px`;
        onScaleChangeRef.current?.(scale.zoom);
      };

      applyScale();
      observer = new ResizeObserver(applyScale);
      observer.observe(host);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (app) {
        app.destroy(true, { children: true, texture: true });
        app = null;
      }
    };
  }, []);

  return <div ref={hostRef} className="flex h-full w-full items-center justify-center" />;
}
