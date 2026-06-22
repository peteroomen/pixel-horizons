/**
 * Mining Run v2 renderer (ADR-003). PixiJS-powered portrait physics loop: the pod is embedded at
 * the top of the planet surface and fires balls downward; mineral drops auto-magnet back up.
 *
 * This file is the orchestrator — it drives the CB.1 sim accumulator, owns pointer input, manages
 * peg/ball sprites and the FOUNDRY HUD, and composes two nested fit transforms (see ./core-breaker/
 * layout): the portrait "column" fitted into the host viewport (so the main game's landscape stage
 * shows it as a centered column), and the full cfg sim space fitted into the playfield band between
 * the header and tray. Pixel-art sprites + background are baked in ./core-breaker/*.
 *
 * Phases: 'aim' (drag down from the rig) · 'play' (ball in flight) · 'complete'.
 */

import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';

import type { Resources } from '@/game/sim/run-state';
import {
  type CoreBreakerConfig,
  type Peg,
  type Ball,
  type MineralDrop,
  defaultConfig,
  spawnBall,
  step,
  stepMinerals,
} from '@/game/surface/core-breaker';
import type { ModuleId } from '@/game/data';
import type { RosterBall } from '@/game/surface/ball-projection';

import { type Ramp } from './palette';
import { buildPegSprites } from './core-breaker/peg-sprites';
import { buildBallSprites, ballColors } from './core-breaker/ball-sprites';
import { buildBackground } from './core-breaker/background';
import { fitTransform } from './core-breaker/layout';
import { createHud, type HudHandle } from './core-breaker/hud';

export interface CoreBreakerOptions {
  pegs: Peg[];
  roster: RosterBall[];
  landRamp: Ramp;
  cfg?: CoreBreakerConfig;
  /** Host viewport (logical stage size) to fit the portrait column into; defaults to cfg dims. */
  viewport?: { width: number; height: number };
  /** Biome label shown in the HUD header. */
  biome?: string;
  onComplete?: (banked: Resources) => void;
}

export interface CoreBreakerHandle {
  destroy(): void;
}

const MAX_FRAME = 0.05;
const RUN_DURATION = 180;
const HEADER_H = 60;
const TRAY_H = 170;
const PEG_SCALE = 2;
const BALL_SCALE = 2;
const REPRINT_COSTS = [2, 5, 10];
const MAX_REPRINTS = 3;
const TRAIL_LEN = 7;

export function createCoreBreakerRenderer(
  app: Application,
  opts: CoreBreakerOptions,
): CoreBreakerHandle {
  const cfg = opts.cfg ?? defaultConfig();
  const viewport = opts.viewport ?? { width: cfg.width, height: cfg.height };
  const ramp = opts.landRamp.map(hexNum);

  // ── Layout: column → viewport, cfg → playfield band ──────────────────────────
  // The "column" (header + playfield + tray) is fixed-width (= sim width) but grows taller to
  // fill a portrait viewport so there is no top/bottom letterbox — the header pins to the very
  // top, the tray to the very bottom, and the playfield band takes everything between. A
  // landscape viewport (the main game's shared stage) keeps the natural portrait column and is
  // centered instead (fitTransform letterboxes it on the sides).
  const vpAspect = viewport.height / viewport.width;
  const cfgAspect = cfg.height / cfg.width;
  const columnHeight = vpAspect > cfgAspect ? Math.round(cfg.width * vpAspect) : cfg.height;
  const column = { width: cfg.width, height: columnHeight };
  const band = { width: column.width, height: column.height - HEADER_H - TRAY_H };
  const sceneFit = fitTransform(column, viewport);
  const playFit = fitTransform(cfg, band);

  // ── Baked textures ───────────────────────────────────────────────────────────
  const pegTextures = buildPegSprites(opts.landRamp);
  const ballTextures = buildBallSprites();
  const bgTexture = buildBackground(cfg.width, cfg.height, opts.landRamp);

  // ── Mutable sim state ────────────────────────────────────────────────────────
  const initialPegs: Peg[] = opts.pegs.map((p) => ({ ...p }));
  let pegs: Peg[] = opts.pegs;
  const roster: RosterBall[] = [...opts.roster];

  let balls: Ball[] = [];
  let minerals: MineralDrop[] = [];
  const trails = new WeakMap<Ball, Array<{ x: number; y: number }>>();
  let rosterIdx = 0;
  let reprints = 0;
  let phase: 'aim' | 'play' | 'complete' = 'aim';
  let haul: Resources = { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 };
  let timer = RUN_DURATION;
  let acc = 0;
  let completed = false;

  let aiming = false;
  let aimDragging = false;
  const aimPt = { x: cfg.launch.x, y: cfg.launch.y + 80 };

  // ── Scene graph ──────────────────────────────────────────────────────────────
  const scene = new Container();
  scene.scale.set(sceneFit.scale);
  scene.position.set(sceneFit.x, sceneFit.y);
  app.stage.addChild(scene);

  // Column base — fills side gaps and behind panels with deep rock.
  const base = new Graphics();
  base.rect(0, 0, column.width, column.height).fill(ramp[5]);
  scene.addChild(base);

  // Playfield (cfg sim space) fitted into the band.
  const playfield = new Container();
  playfield.scale.set(playFit.scale);
  playfield.position.set(playFit.x, HEADER_H + playFit.y);
  scene.addChild(playfield);

  const bgSprite = new Sprite(bgTexture);
  bgSprite.eventMode = 'none';
  const fieldContainer = new Container();
  fieldContainer.eventMode = 'none';
  const mineralGfx = new Graphics();
  const aimGfx = new Graphics();
  const ballGfx = new Graphics();
  const ballContainer = new Container();
  ballContainer.eventMode = 'none';
  const rigGfx = new Graphics();
  playfield.addChild(bgSprite, fieldContainer, mineralGfx, aimGfx, ballGfx, ballContainer, rigGfx);

  const flash = new Text({
    text: '',
    style: { fontFamily: 'monospace', fontSize: 14, fill: 0xff9e2c, align: 'center' },
  });
  flash.anchor.set(0.5);
  flash.position.set(cfg.width / 2, cfg.height / 2);
  flash.alpha = 0;
  playfield.addChild(flash);

  // Peg sprites (created once, texture swapped per damage stage, hidden on break).
  const pegSprites = new Map<number, Sprite>();
  for (const peg of pegs) {
    const s = new Sprite(pegTextures[peg.kind][0]);
    s.anchor.set(0.5);
    s.position.set(peg.x, peg.y);
    s.scale.set(PEG_SCALE);
    s.eventMode = 'none';
    pegSprites.set(peg.id, s);
    fieldContainer.addChild(s);
  }

  // Ball sprite pool.
  const ballPool: Sprite[] = [];

  // ── HUD ────────────────────────────────────────────────────────────────────
  const hud: HudHandle = createHud({
    columnWidth: column.width,
    columnHeight: column.height,
    headerH: HEADER_H,
    trayH: TRAY_H,
    ballTextures,
    onReprint: () => reprint(),
    onReturn: () => endRun(),
  });
  scene.addChild(hud.container);

  // ── Input ────────────────────────────────────────────────────────────────────
  app.stage.eventMode = 'static';
  app.stage.hitArea = { contains: () => true } as never;

  const toField = (e: { global: { x: number; y: number } }): { x: number; y: number } =>
    playfield.toLocal(e.global);

  const onDown = (e: { global: { x: number; y: number } }): void => {
    if (completed) {
      redrop();
      return;
    }
    if (phase === 'aim') {
      const p = toField(e);
      aiming = aimDragging = true;
      aimPt.x = p.x;
      aimPt.y = p.y;
    }
  };

  const onMove = (e: { global: { x: number; y: number } }): void => {
    if (aimDragging) {
      const p = toField(e);
      aimPt.x = p.x;
      aimPt.y = p.y;
    }
  };

  const onUp = (): void => {
    if (!aimDragging) return;
    aimDragging = false;
    if (phase !== 'aim' || roster.length === 0 || rosterIdx >= roster.length) return;
    const type = roster[rosterIdx].type;
    const aim = computeAim(aimPt, cfg);
    balls.push(spawnBall({ type, angleRad: aim.angle, power: aim.power }, cfg));
    phase = 'play';
    aimGfx.clear();
  };

  app.stage.on('pointerdown', onDown);
  app.stage.on('pointermove', onMove);
  app.stage.on('pointerup', onUp);
  app.stage.on('pointerupoutside', onUp);

  // ── Mechanics ────────────────────────────────────────────────────────────────
  function setFlash(text: string): void {
    flash.text = text;
    flash.alpha = 1;
  }

  function advanceTurn(): void {
    rosterIdx++;
    if (rosterIdx >= roster.length) endRun();
    else {
      phase = 'aim';
      setFlash('PROBE LOST');
    }
  }

  function endRun(): void {
    if (completed) return;
    completed = true;
    phase = 'complete';
    setFlash('MINING COMPLETE');
    opts.onComplete?.({ ...haul });
  }

  function reprint(): void {
    if (completed || reprints >= MAX_REPRINTS) return;
    const cost = REPRINT_COSTS[reprints];
    if (haul.scrap < cost) return;
    haul.scrap -= cost;
    reprints++;
    // Synthetic standard probe — only `type`/`yieldMultiplier` are read by the renderer.
    roster.push({
      moduleIndex: -1,
      moduleId: 'reprint' as unknown as ModuleId,
      type: 'standard',
      tier: 1,
      yieldMultiplier: 1,
    });
    setFlash('PROBE REPRINTED');
  }

  function redrop(): void {
    pegs = initialPegs.map((p) => ({ ...p }));
    opts.pegs = pegs;
    for (const [id, sprite] of pegSprites) {
      const peg = pegs.find((p) => p.id === id);
      sprite.visible = peg !== undefined;
    }
    balls = [];
    minerals = [];
    rosterIdx = 0;
    reprints = 0;
    haul = { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 };
    timer = RUN_DURATION;
    phase = 'aim';
    completed = false;
    acc = 0;
    flash.alpha = 0;
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────
  function drawField(): void {
    for (const peg of pegs) {
      const sprite = pegSprites.get(peg.id);
      if (sprite === undefined) continue;
      if (peg.hits <= 0) {
        sprite.visible = false;
        continue;
      }
      const stages = pegTextures[peg.kind];
      const stage = clampInt(peg.maxHits - peg.hits, 0, stages.length - 1);
      sprite.texture = stages[stage];
      sprite.alpha = peg.maxHits > 1 ? 0.55 + 0.45 * (peg.hits / peg.maxHits) : 1;
    }
  }

  function drawBalls(): void {
    ballGfx.clear();
    let i = 0;
    for (const b of balls) {
      if (!b.live) continue;
      // Trail.
      const hist = trails.get(b) ?? [];
      const acc2 = ballColors(b.type).acc;
      const accNum = hexNum(acc2);
      for (let t = 0; t < hist.length; t++) {
        ballGfx
          .rect(hist[t].x, hist[t].y, 1, 1)
          .fill({ color: accNum, alpha: (t / hist.length) * 0.4 });
      }
      // Sprite.
      const sprite = ballPool[i] ?? newBallSprite();
      sprite.visible = true;
      sprite.texture = ballTextures[b.type];
      sprite.position.set(b.x, b.y);
      sprite.alpha = b.type === 'ghost' ? 0.55 : 1;
      i++;
    }
    for (let j = i; j < ballPool.length; j++) ballPool[j].visible = false;
  }

  function newBallSprite(): Sprite {
    const s = new Sprite();
    s.anchor.set(0.5);
    s.scale.set(BALL_SCALE);
    s.eventMode = 'none';
    ballPool.push(s);
    ballContainer.addChild(s);
    return s;
  }

  function drawMinerals(): void {
    mineralGfx.clear();
    for (const m of minerals) {
      if (!m.live) continue;
      const col =
        m.resource === 'biominerals'
          ? 0x91db69
          : m.resource === 'coreCrystals'
            ? 0x6ad1e3
            : 0x9aa0ad;
      mineralGfx.rect(m.x - 1.5, m.y - 1.5, 3, 3).fill(col);
      mineralGfx.rect(m.x, m.y - 1.5, 1, 1).fill(0xffffff);
    }
  }

  function drawAim(): void {
    aimGfx.clear();
    if (phase !== 'aim' || !aiming || roster.length === 0) return;
    const aim = computeAim(aimPt, cfg);
    let px = cfg.launch.x;
    let py = cfg.launch.y;
    const vx = Math.cos(aim.angle) * aim.power;
    let vy = Math.sin(aim.angle) * aim.power;
    for (let i = 0; i < 30; i++) {
      for (let s = 0; s < 6; s++) {
        vy += cfg.gravity * cfg.step;
        px += vx * cfg.step;
        py += vy * cfg.step;
      }
      if (py > cfg.floorY || px < 0 || px > cfg.width) break;
      aimGfx.circle(px, py, 1.5).fill({ color: 0x8ff8e2, alpha: 0.5 - i * 0.013 });
    }
  }

  function drawRig(): void {
    rigGfx.clear();
    const lx = cfg.launch.x;
    const ly = cfg.launch.y;
    // Launcher head mounted at the ceiling breach, aperture pointing down.
    rigGfx.rect(lx - 9, ly - 6, 18, 7).fill(0x3a3e48);
    rigGfx.rect(lx - 9, ly - 6, 18, 1).fill(0x54607e);
    rigGfx.rect(lx - 8, ly - 9, 16, 3).fill(0x547e64);
    rigGfx.rect(lx - 8, ly - 9, 16, 1).fill(0x92a984);
    rigGfx.rect(lx - 3, ly + 1, 6, 5).fill(0x23262d);
    if (phase === 'aim') {
      const aim = computeAim(aimPt, cfg);
      const tx = lx + Math.cos(aim.angle) * 8;
      const ty = ly + 6 + Math.sin(aim.angle) * 6;
      rigGfx.circle(tx, ty, 2).fill(0x6ad1e3);
    }
  }

  function syncHud(): void {
    const armed = rosterIdx < roster.length ? roster[rosterIdx] : null;
    const queue = roster.slice(rosterIdx + 1);
    const reprintState =
      reprints >= MAX_REPRINTS
        ? null
        : { cost: REPRINT_COSTS[reprints], enabled: haul.scrap >= REPRINT_COSTS[reprints] };
    hud.update({
      biome: opts.biome ?? 'MINING',
      timerSecs: timer,
      haul,
      armed,
      queue,
      remaining: Math.max(0, roster.length - rosterIdx),
      reprint: reprintState,
    });
  }

  // ── Tick ─────────────────────────────────────────────────────────────────────
  const tick = (): void => {
    const dt = Math.min(app.ticker.deltaMS / 1000, MAX_FRAME);

    if (!completed) {
      timer = Math.max(0, timer - dt);
      if (timer <= 0) endRun();
    }

    if (phase === 'play') {
      acc += dt;
      while (acc >= cfg.step) {
        const toAdd: Ball[] = [];
        for (const b of balls) {
          if (!b.live) continue;
          const ev = step(b, pegs, cfg);
          for (const d of ev.drops) {
            haul[d.resource] += Math.round(d.amount * (roster[rosterIdx]?.yieldMultiplier ?? 1));
          }
          for (const m of ev.newMinerals) minerals.push(m);
          for (const s of ev.spawned) toAdd.push(s);
          // Trail history.
          const hist = trails.get(b) ?? [];
          hist.push({ x: b.x, y: b.y });
          if (hist.length > TRAIL_LEN) hist.shift();
          trails.set(b, hist);
        }
        for (const b of toAdd) balls.push(b);

        const mr = stepMinerals(minerals, cfg.launch.x, cfg);
        for (const d of mr.caught) haul[d.resource] += d.amount;

        acc -= cfg.step;
      }

      balls = balls.filter((b) => b.live);
      minerals = minerals.filter((m) => m.live);

      if (balls.length === 0 && minerals.length === 0) advanceTurn();
    }

    if (flash.alpha > 0) flash.alpha = Math.max(0, flash.alpha - dt * 0.8);

    drawField();
    drawMinerals();
    drawAim();
    drawBalls();
    drawRig();
    syncHud();
  };

  app.ticker.add(tick);
  drawField();
  syncHud();

  return {
    destroy(): void {
      app.ticker.remove(tick);
      app.stage.off('pointerdown', onDown);
      app.stage.off('pointermove', onMove);
      app.stage.off('pointerup', onUp);
      app.stage.off('pointerupoutside', onUp);
      hud.destroy();
      scene.destroy({ children: true });
      bgTexture.destroy(true);
      for (const stages of Object.values(pegTextures)) for (const t of stages) t.destroy(true);
      for (const t of Object.values(ballTextures)) t.destroy(true);
    },
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function computeAim(
  pt: { x: number; y: number },
  cfg: CoreBreakerConfig,
): { angle: number; power: number } {
  const dx = pt.x - cfg.launch.x;
  const dy = pt.y - cfg.launch.y;
  const len = Math.hypot(dx, dy) || 1;
  const downY = Math.max(dy, 0.25 * len);
  const angle = Math.atan2(downY, dx);
  const power = clamp(len * 2.4, 170, 560);
  return { angle, power };
}

function hexNum(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}
