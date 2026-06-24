import { Application, Container, Graphics, Sprite, Text, Ticker } from 'pixi.js';

import type { CombatView } from '@/game/combat-view';
import { MAX_SHAKE, shakeAmplitude } from '@/components/combat-fx-core';
import {
  anchormawBoss,
  bloomGrunt,
  compositeShipForHull,
  laneBackdrop,
  moduleSlotType,
  muzzleFlash,
} from './sprites';
import type { HullSlot } from './sprites';
import { nearestTexture } from './textures';

const FLASH_MS = 160;
const SHAKE_MS = 240; // viewport-kick duration on a hit — decays to zero over this window
const PX = 3; // sprite pixel size in virtual units — integer so nearest-neighbor stays crisp
// Extra backdrop tiles on every side so a viewport shake never slides the void into frame.
const OVERSCAN_TILES = Math.ceil(MAX_SHAKE / PX);

// Floating damage numbers — they pop over the struck ship and climb as they fade, sharing
// the world layer with the future weapon effects (lasers/explosions) rather than the HUD.
const FLOATER_MS = 800;
const FLOATER_RISE = 36; // virtual px a number climbs over its life
const FLOATER_FONT = 30; // virtual px
// Damage you deal reads white (legible over any ship/organ tint — the position over the
// enemy already signals the side); damage you take reads red/danger. The heavy near-black
// outline keeps both crisp over a red hit-flash or a green organ alike.
const DMG_ENEMY_COLOR = 0xffffff;
const DMG_SHIP_COLOR = 0xff4757;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** The loaded VT323 family (matches the HUD readouts), with a monospace fallback. */
function resolveNumberFont(): string {
  if (typeof document === 'undefined') return 'monospace';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-vt323').trim();
  return v.length > 0 ? `${v}, monospace` : 'monospace';
}

/**
 * Battle viewport (World Art Direction): the infested lane backdrop, the player's
 * Gunship composited from its installed modules, and the Bloom grunt / Anchormaw boss
 * with its visible organs — all pixel-art sprites on nearest-neighbor textures, the
 * design's exact render path. Intents/organ reticles/HP readouts live in the DOM HUD;
 * this layer is the world behind the glass, plus the floating damage numbers that pop
 * over the struck ship. `sync` runs once per combat event, never per frame; the ticker
 * animates flashes, idle bob, breathing, viewport shake, and the floaters.
 */
export interface SpaceRenderer {
  sync(view: CombatView): void;
  destroy(): void;
}

function shipCompositeKey(view: CombatView): string {
  const c = { weapon: 0, engine: 0, utility: 0 };
  for (const m of view.modules) c[moduleSlotType(m.name)]++;
  return `${view.hullId}|w${c.weapon}e${c.engine}u${c.utility}`;
}

/**
 * Portrait layout: enemy offset right near the top of canvas, player offset left near the
 * bottom — a diagonal dogfight angle that reads naturally on a phone held upright.
 */
export function createSpaceRenderer(app: Application, virtW: number, virtH: number): SpaceRenderer {
  // Portrait ship positions: offset horizontally to suggest opposing trajectories.
  const PLAYER_X = Math.round(virtW * 0.38);
  const PLAYER_Y = Math.round(virtH * 0.71);
  const ENEMY_X = Math.round(virtW * 0.62);
  const ENEMY_Y = Math.round(virtH * 0.29);

  const scene = new Container();
  app.stage.addChild(scene);

  // ── Infested lane backdrop (drawn chunky, scaled to fill the virtual scene) ──
  // Overscanned by OVERSCAN_TILES on each side and offset back by the same, so the scene
  // can shake up to MAX_SHAKE px in any direction without exposing the void at an edge.
  const laneW = Math.ceil(virtW / PX) + OVERSCAN_TILES * 2;
  const laneH = Math.ceil(virtH / PX) + OVERSCAN_TILES * 2;
  const lane = new Sprite(nearestTexture(laneBackdrop(laneW, laneH, 1234)));
  lane.scale.set(PX);
  lane.position.set(-OVERSCAN_TILES * PX, -OVERSCAN_TILES * PX);
  scene.addChild(lane);

  const shieldRing = new Graphics().ellipse(0, 0, 70, 46).stroke({ width: 2, color: 0x6ad1e3 });
  shieldRing.position.set(PLAYER_X, PLAYER_Y);
  scene.addChild(shieldRing);

  // Player ship + muzzle share the composite frame, so the same anchor/scale aligns them.
  const playerShip = new Sprite();
  playerShip.anchor.set(0.5);
  playerShip.scale.set(PX);
  playerShip.position.set(PLAYER_X, PLAYER_Y);
  scene.addChild(playerShip);

  const muzzle = new Sprite(nearestTexture(muzzleFlash()));
  muzzle.anchor.set(0.5);
  muzzle.scale.set(PX);
  muzzle.position.set(PLAYER_X, PLAYER_Y);
  muzzle.visible = false;
  scene.addChild(muzzle);

  const enemyShip = new Sprite();
  enemyShip.anchor.set(0.5);
  enemyShip.position.set(ENEMY_X, ENEMY_Y);
  scene.addChild(enemyShip);

  // Floating damage numbers sit on top of the ships and inside `scene`, so they ride the
  // viewport shake with the rest of the world.
  const floaterLayer = new Container();
  scene.addChild(floaterLayer);
  const numberFont = resolveNumberFont();

  interface Floater {
    text: Text;
    ageMs: number;
    baseY: number;
  }
  const floaters: Floater[] = [];
  let spawnCount = 0;

  const spawnFloater = (x: number, spawnY: number, color: number, amount: number): void => {
    // Stagger rapid hits sideways so stacked numbers stay legible. Deterministic — no RNG
    // (it would consume the sim's stream), just a 3-step cycle off the spawn counter.
    const jitter = ((spawnCount % 3) - 1) * 10;
    spawnCount += 1;
    const text = new Text({
      text: `-${amount}`,
      style: {
        fontFamily: numberFont,
        fontSize: FLOATER_FONT,
        fill: color,
        stroke: { color: 0x05060d, width: 6 },
        align: 'center',
      },
    });
    text.anchor.set(0.5);
    // Render the glyph at the on-screen size (stage zoom) so it stays crisp, not upscaled.
    text.resolution = Math.max(1, Math.ceil(app.stage.scale.x));
    text.position.set(x + jitter, spawnY);
    floaterLayer.addChild(text);
    floaters.push({ text, ageMs: 0, baseY: spawnY });
  };

  let prevHullHp: number | null = null;
  let prevEnemyHp: number | null = null;
  let prevParts: number[] | null = null;
  let playerFlashMs = 0;
  let enemyFlashMs = 0;
  let shakeMs = 0;
  let shakeAmp = 0;
  let isBoss = false;
  let bossPhase = -1;
  let kindsKey: string | null = null;
  let enemyIsBoss: boolean | null = null;
  let elapsed = 0;

  // A hit shakes the camera unless the player asked the OS for reduced motion.
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const setPlayerShip = (key: string): void => {
    const pipeIdx = key.indexOf('|');
    const hullId = pipeIdx >= 0 ? key.slice(0, pipeIdx) : 'hull-gunship';
    const rest = pipeIdx >= 0 ? key.slice(pipeIdx + 1) : '';
    const m = rest.match(/w(\d+)e(\d+)u(\d+)/);
    const slotCounts: Record<HullSlot, number> = {
      weapon: parseInt(m?.[1] ?? '0'),
      engine: parseInt(m?.[2] ?? '0'),
      utility: parseInt(m?.[3] ?? '0'),
    };
    if (kindsKey !== null) playerShip.texture.destroy(true); // not the initial EMPTY
    playerShip.texture = nearestTexture(compositeShipForHull(hullId, slotCounts));
  };

  const setEnemyShip = (boss: boolean): void => {
    if (enemyIsBoss !== null) enemyShip.texture.destroy(true); // not the initial EMPTY
    enemyShip.texture = nearestTexture(boss ? anchormawBoss() : bloomGrunt());
  };

  const tick = (ticker: Ticker): void => {
    elapsed += ticker.deltaMS;
    playerFlashMs = Math.max(0, playerFlashMs - ticker.deltaMS);
    enemyFlashMs = Math.max(0, enemyFlashMs - ticker.deltaMS);
    shakeMs = Math.max(0, shakeMs - ticker.deltaMS);

    // Damped high-frequency jitter, integer px so nearest-neighbor stays crisp. Two
    // different frequencies for x/y keep it from reading as a straight diagonal slide.
    // No RNG (it'd consume the sim's deterministic stream); a decaying sinusoid is plenty.
    if (shakeMs > 0) {
      const decay = (shakeMs / SHAKE_MS) * shakeAmp;
      scene.position.set(
        Math.round(Math.sin(elapsed / 17) * decay),
        Math.round(Math.cos(elapsed / 13) * decay),
      );
    } else {
      scene.position.set(0, 0);
    }

    // Collective: rigid idle bob. Bloom: slow breathing squash. (The "it lives" cue.)
    playerShip.y = PLAYER_Y + Math.round(Math.sin(elapsed / 900) * 1) * PX;
    const breathe = 1 + Math.sin(elapsed / 700) * 0.03;
    const baseScale = isBoss ? PX * 1.25 : PX;
    enemyShip.scale.set(baseScale, baseScale * breathe);

    playerShip.tint = playerFlashMs > 0 ? 0xff4757 : 0xffffff;
    muzzle.visible = enemyFlashMs > 0 && playerShip.alpha > 0.5;
    if (enemyFlashMs > 0) {
      enemyShip.tint = 0xff4757;
    } else if (isBoss && bossPhase >= 0) {
      enemyShip.tint = 0xff8392;
    } else {
      enemyShip.tint = 0xffffff;
    }

    // Damage numbers climb and fade (rise suppressed under reduced motion; they still show).
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.ageMs += ticker.deltaMS;
      const t = f.ageMs / FLOATER_MS;
      if (t >= 1) {
        f.text.destroy();
        floaters.splice(i, 1);
        continue;
      }
      f.text.y = f.baseY - (reducedMotion ? 0 : FLOATER_RISE * easeOutCubic(t));
      f.text.alpha = t < 0.12 ? t / 0.12 : t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;
      // A quick punch-in (1.5 → 1 over the first 15%) gives the number its impact.
      f.text.scale.set(reducedMotion || t > 0.15 ? 1 : 1.5 - (0.5 * t) / 0.15);
    }
  };
  app.ticker.add(tick);

  return {
    sync(view: CombatView): void {
      const hullDrop = prevHullHp !== null ? Math.max(0, prevHullHp - view.hullHp) : 0;
      const coreDrop = prevEnemyHp !== null ? Math.max(0, prevEnemyHp - view.enemyHp) : 0;
      // Organ hits don't move the core HP, so diff each part too and fold it into the
      // enemy-side total — the whole creature is one sprite, so one number over it reads.
      let partsDrop = 0;
      if (prevParts !== null) {
        for (let i = 0; i < view.enemyParts.length; i++) {
          const prev = prevParts[i];
          if (prev !== undefined) partsDrop += Math.max(0, prev - view.enemyParts[i].hp);
        }
      }
      const enemyDrop = coreDrop + partsDrop;

      if (hullDrop > 0) playerFlashMs = FLASH_MS;
      if (enemyDrop > 0) enemyFlashMs = FLASH_MS;
      // Either side taking damage kicks the camera; scale to the bigger hit this event.
      if (!reducedMotion && (hullDrop > 0 || enemyDrop > 0)) {
        const amp = Math.max(
          shakeAmplitude(hullDrop, view.hullMaxHp),
          shakeAmplitude(enemyDrop, view.enemyMaxHp),
        );
        if (amp > 0) {
          shakeAmp = amp;
          shakeMs = SHAKE_MS;
        }
      }
      if (enemyDrop > 0) spawnFloater(ENEMY_X, ENEMY_Y - 42, DMG_ENEMY_COLOR, enemyDrop);
      if (hullDrop > 0) spawnFloater(PLAYER_X, PLAYER_Y - 42, DMG_SHIP_COLOR, hullDrop);

      prevHullHp = view.hullHp;
      prevEnemyHp = view.enemyHp;
      prevParts = view.enemyParts.map((p) => p.hp);

      isBoss = view.boss;
      bossPhase = view.bossPhase ?? -1;

      const nextKey = shipCompositeKey(view);
      if (nextKey !== kindsKey) {
        setPlayerShip(nextKey);
        kindsKey = nextKey;
      }
      if (enemyIsBoss !== view.boss) {
        setEnemyShip(view.boss);
        enemyIsBoss = view.boss;
      }

      const layersUp = view.shields.filter((layer) => layer.up).length + view.tempShieldLayers;
      shieldRing.visible = layersUp > 0;
      shieldRing.alpha = Math.min(0.3 + layersUp * 0.2, 0.85);

      enemyShip.alpha = view.enemyHp > 0 ? 1 : 0.15;
      playerShip.alpha = view.hullHp > 0 ? 1 : 0.15;
    },
    destroy(): void {
      app.ticker.remove(tick);
      scene.destroy({ children: true, texture: true });
    },
  };
}
