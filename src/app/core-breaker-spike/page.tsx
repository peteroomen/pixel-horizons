'use client';

import { useEffect, useRef } from 'react';

import { Application, Container, Graphics, Rectangle, Text, TextureSource } from 'pixi.js';

import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, computeScale } from '@/renderer/pixel-scale';

import {
  type Ball,
  type BallType,
  type Knobs,
  type Peg,
  LAUNCH,
  buildField,
  defaultKnobs,
  spawnBall,
  stepPhysics,
} from './core-breaker-spike';

/**
 * THROWAWAY — CB.0 Core Breaker feel prototype. Drag from the launch point to aim, release to
 * fire one ball into the peg field; watch it carom and shatter pegs. Pure feel test on desktop +
 * phone (375px). Non-deterministic (see core-breaker-spike.ts). Delete this folder at CB.4.
 *
 * Controls: drag = aim/power · 1/2/3 (or the buttons) = ball type · R = reset drop ·
 * Q/A gravity · W/S restitution · E/D power.
 */

const STEP = 1 / 240; // sub-step seconds — small to avoid fast-ball tunneling
const MAX_FRAME = 0.05; // clamp dt to avoid spiral-of-death

const BALL_TYPES: BallType[] = ['pierce', 'bouncy', 'homing'];
const BALL_LABEL: Record<BallType, string> = {
  pierce: '1 PIERCE',
  bouncy: '2 BOUNCY',
  homing: '3 HOMING',
};

const COL = {
  bg: 0x0a0a12,
  peg: 0x8a9bb8,
  hard: 0xb8a06a,
  ore: 0x6ad19b,
  ball: 0xf4e9d8,
  aim: 0xf4e9d8,
  hopper: 0x2a2f45,
};

export default function CoreBreakerSpikePage() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;

    let cancelled = false;
    let app: Application | null = null;
    let resize: (() => void) | null = null;
    let keyHandler: ((ev: KeyboardEvent) => void) | null = null;

    void (async () => {
      TextureSource.defaultOptions.scaleMode = 'nearest';
      const created = new Application();
      await created.init({
        width: VIRTUAL_WIDTH,
        height: VIRTUAL_HEIGHT,
        background: COL.bg,
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

      // ---- State -------------------------------------------------------------
      const knobs: Knobs = defaultKnobs();
      let pegs: Peg[] = buildField(knobs);
      let ball: Ball | null = null;
      let activeType: BallType = 'pierce';
      let shotsLeft = knobs.shotsPerDrop;
      let banked = 0;
      let acc = 0;
      let aiming = false;
      const aimPoint = { x: LAUNCH.x, y: 160 };
      const bursts: { g: Graphics; life: number }[] = [];

      const reset = (): void => {
        pegs = buildField(knobs);
        ball = null;
        shotsLeft = knobs.shotsPerDrop;
        banked = 0;
        for (const b of bursts) b.g.destroy();
        bursts.length = 0;
      };

      // ---- Scene graph -------------------------------------------------------
      const scene = new Container();
      created.stage.addChild(scene);

      const hopper = new Graphics();
      scene.addChild(hopper);

      const fieldGfx = new Graphics();
      scene.addChild(fieldGfx);

      const burstLayer = new Container();
      scene.addChild(burstLayer);

      const aimGfx = new Graphics();
      scene.addChild(aimGfx);

      const ballGfx = new Graphics();
      scene.addChild(ballGfx);

      const launchGfx = new Graphics();
      launchGfx.circle(LAUNCH.x, LAUNCH.y, 4).fill(0xf4e9d8).stroke({ color: 0x222232, width: 1 });
      scene.addChild(launchGfx);

      const hud = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 9, fill: 0xc8d0e0, lineHeight: 11 },
      });
      hud.position.set(6, 4);
      scene.addChild(hud);

      const banner = new Text({
        text: '',
        style: {
          fontFamily: 'monospace',
          fontSize: 14,
          fill: 0xf4e9d8,
          align: 'center',
        },
      });
      banner.anchor.set(0.5);
      banner.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
      scene.addChild(banner);

      // Ball-type buttons (touch-friendly).
      const buttons: { type: BallType; g: Graphics; label: Text }[] = [];
      BALL_TYPES.forEach((type, i) => {
        const bx = VIRTUAL_WIDTH - 132 + i * 44;
        const g = new Graphics();
        g.position.set(bx, 4);
        g.eventMode = 'static';
        g.cursor = 'pointer';
        g.hitArea = new Rectangle(0, 0, 40, 16);
        g.on('pointertap', () => {
          activeType = type;
        });
        const label = new Text({
          text: type.slice(0, 4).toUpperCase(),
          style: { fontFamily: 'monospace', fontSize: 8, fill: 0x0a0a12 },
        });
        label.position.set(bx + 4, 8);
        scene.addChild(g);
        scene.addChild(label);
        buttons.push({ type, g, label });
      });

      // ---- Input (pointer only — touch-first) --------------------------------
      created.stage.eventMode = 'static';
      created.stage.hitArea = new Rectangle(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

      const toLocal = (e: { global: { x: number; y: number } }): { x: number; y: number } =>
        created.stage.toLocal(e.global);

      created.stage.on('pointerdown', (e) => {
        if (ball !== null || shotsLeft <= 0) return;
        aiming = true;
        const p = toLocal(e);
        aimPoint.x = p.x;
        aimPoint.y = p.y;
      });
      created.stage.on('pointermove', (e) => {
        if (!aiming) return;
        const p = toLocal(e);
        aimPoint.x = p.x;
        aimPoint.y = p.y;
      });
      const release = (): void => {
        if (!aiming) return;
        aiming = false;
        if (ball !== null || shotsLeft <= 0) return;
        ball = spawnBall(activeType, aimPoint, knobs);
        shotsLeft -= 1;
      };
      created.stage.on('pointerup', release);
      created.stage.on('pointerupoutside', release);

      const onKey = (ev: KeyboardEvent): void => {
        switch (ev.key) {
          case '1':
            activeType = 'pierce';
            break;
          case '2':
            activeType = 'bouncy';
            break;
          case '3':
            activeType = 'homing';
            break;
          case 'r':
          case 'R':
            reset();
            break;
          case 'q':
            knobs.gravity = Math.min(2000, knobs.gravity + 50);
            break;
          case 'a':
            knobs.gravity = Math.max(200, knobs.gravity - 50);
            break;
          case 'w':
            knobs.restitution = Math.min(0.98, +(knobs.restitution + 0.04).toFixed(2));
            break;
          case 's':
            knobs.restitution = Math.max(0.1, +(knobs.restitution - 0.04).toFixed(2));
            break;
          case 'e':
            knobs.launchPower = Math.min(600, knobs.launchPower + 25);
            break;
          case 'd':
            knobs.launchPower = Math.max(120, knobs.launchPower - 25);
            break;
          default:
            return;
        }
      };
      window.addEventListener('keydown', onKey);
      keyHandler = onKey;

      // ---- Draw helpers ------------------------------------------------------
      const spawnBurst = (peg: Peg): void => {
        const g = new Graphics();
        const color = peg.ore ? COL.ore : peg.maxHits > 1 ? COL.hard : COL.peg;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          g.circle(peg.x + Math.cos(a) * 3, peg.y + Math.sin(a) * 3, 1.5).fill(color);
        }
        burstLayer.addChild(g);
        bursts.push({ g, life: 0.3 });
      };

      const drawField = (): void => {
        fieldGfx.clear();
        for (const peg of pegs) {
          if (!peg.alive) continue;
          const color = peg.ore ? COL.ore : peg.maxHits > 1 ? COL.hard : COL.peg;
          // Dim multi-hit pegs that have been chipped.
          const alpha = peg.maxHits > 1 ? 0.5 + 0.5 * (peg.hits / peg.maxHits) : 1;
          fieldGfx.circle(peg.x, peg.y, peg.r).fill({ color, alpha });
        }
      };

      const drawHopper = (): void => {
        hopper.clear();
        hopper.rect(0, knobs.floorY, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - knobs.floorY).fill(COL.hopper);
      };

      const drawAim = (): void => {
        aimGfx.clear();
        if (!aiming || ball !== null) return;
        // Project a few gravity steps (ignoring collisions) as guide dots.
        const preview = spawnBall(activeType, aimPoint, knobs);
        let px = preview.x;
        let py = preview.y;
        const vx = preview.vx;
        let vy = preview.vy;
        for (let i = 0; i < 22; i++) {
          for (let s = 0; s < 6; s++) {
            vy += knobs.gravity * STEP;
            px += vx * STEP;
            py += vy * STEP;
          }
          if (py > knobs.floorY || px < 0 || px > VIRTUAL_WIDTH) break;
          aimGfx.circle(px, py, 1.5).fill({ color: COL.aim, alpha: 0.5 - i * 0.018 });
        }
      };

      const drawBall = (): void => {
        ballGfx.clear();
        if (ball === null) return;
        ballGfx.circle(ball.x, ball.y, ball.r).fill(COL.ball);
        if (ball.type === 'homing')
          ballGfx.circle(ball.x, ball.y, ball.r + 2).stroke({ color: COL.ore, width: 1 });
        if (ball.type === 'bouncy')
          ballGfx.circle(ball.x, ball.y, ball.r - 2).stroke({ color: 0xd1956a, width: 1 });
      };

      const drawButtons = (): void => {
        for (const b of buttons) {
          b.g.clear();
          const on = b.type === activeType;
          b.g.roundRect(0, 0, 40, 16, 3).fill(on ? 0xf4e9d8 : 0x2a2f45);
          b.label.style.fill = on ? 0x0a0a12 : 0xc8d0e0;
        }
      };

      // ---- Loop --------------------------------------------------------------
      created.ticker.add((t) => {
        const dt = Math.min(t.deltaMS / 1000, MAX_FRAME);

        if (ball !== null) {
          acc += dt;
          while (acc >= STEP) {
            const broken = stepPhysics(ball, pegs, knobs, STEP);
            for (const id of broken) {
              const peg = pegs.find((p) => p.id === id);
              if (peg) {
                banked += peg.ore ? 2 : 1;
                spawnBurst(peg);
              }
            }
            acc -= STEP;
          }
          if (!ball.live) {
            ball = null;
            acc = 0;
          }
        }

        // Fade bursts.
        for (let i = bursts.length - 1; i >= 0; i--) {
          const b = bursts[i];
          b.life -= dt;
          b.g.alpha = Math.max(0, b.life / 0.3);
          if (b.life <= 0) {
            b.g.destroy();
            bursts.splice(i, 1);
          }
        }

        drawHopper();
        drawField();
        drawAim();
        drawBall();
        drawButtons();

        const aliveOre = pegs.filter((p) => p.alive && p.ore).length;
        hud.text =
          `SHOTS ${shotsLeft}/${knobs.shotsPerDrop}   BANKED ${banked}   ORE LEFT ${aliveOre}\n` +
          `BALL ${BALL_LABEL[activeType]}\n` +
          `G ${knobs.gravity}  E ${knobs.restitution}  PWR ${knobs.launchPower}\n` +
          `drag=aim  1/2/3=ball  R=reset  Q/A=grav W/S=rest E/D=pwr`;

        const done = shotsLeft <= 0 && ball === null;
        banner.text = done ? `DROP COMPLETE\nbanked ${banked}\npress R` : '';
      });
    })();

    return () => {
      cancelled = true;
      if (resize !== null) window.removeEventListener('resize', resize);
      if (keyHandler !== null) window.removeEventListener('keydown', keyHandler);
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
        // touch-action: none on the canvas HOST so drag-to-aim doesn't scroll the page on a phone.
        touchAction: 'none',
      }}
    />
  );
}
