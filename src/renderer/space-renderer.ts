import { Application, Container, Graphics, Sprite, Ticker } from 'pixi.js';

import type { CombatView } from '@/game/combat-view';
import { MAX_SHAKE, shakeAmplitude } from '@/components/combat-fx-core';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './pixel-scale';
import { anchormawBoss, bloomGrunt, compositeShip, laneBackdrop, muzzleFlash } from './sprites';
import type { ShipModuleKind } from './sprites';
import { nearestTexture } from './textures';

const FLASH_MS = 160;
const SHAKE_MS = 240; // viewport-kick duration on a hit — decays to zero over this window
const PX = 3; // sprite pixel size in virtual units — integer so nearest-neighbor stays crisp
// Extra backdrop tiles on every side so a viewport shake never slides the void into frame.
const OVERSCAN_TILES = Math.ceil(MAX_SHAKE / PX);
const PLAYER_X = 150;
const ENEMY_X = VIRTUAL_WIDTH - 170;
const CENTER_Y = VIRTUAL_HEIGHT / 2 + 24; // sit the ships below the top HUD plates

/**
 * Battle viewport (World Art Direction): the infested lane backdrop, the player's
 * Gunship composited from its installed modules, and the Bloom grunt / Anchormaw boss
 * with its visible organs — all pixel-art sprites on nearest-neighbor textures, the
 * design's exact render path. Numbers/intents/organ reticles live in the DOM HUD; this
 * layer is the world behind the glass. `sync` runs once per combat event, never per
 * frame; the ticker only animates flashes, idle bob, and breathing.
 */
export interface SpaceRenderer {
  sync(view: CombatView): void;
  destroy(): void;
}

/** Maps an installed module's name to the overlay category bolted onto the hull. */
function moduleKind(name: string): ShipModuleKind {
  const n = name.toLowerCase();
  if (/flak|cannon|missile|laser|railgun|gun/.test(n)) return 'cannon';
  if (n.includes('shield')) return 'shield';
  if (/thruster|engine|hauler|drive/.test(n)) return 'engine';
  return 'armor'; // matrices, scanners, phase shifter → a generic plate
}

function shipKindsKey(view: CombatView): string {
  const kinds = new Set<ShipModuleKind>();
  for (const m of view.modules) kinds.add(moduleKind(m.name));
  return (['cannon', 'shield', 'engine', 'armor'] as ShipModuleKind[])
    .filter((k) => kinds.has(k))
    .join(',');
}

export function createSpaceRenderer(app: Application): SpaceRenderer {
  const scene = new Container();
  app.stage.addChild(scene);

  // ── Infested lane backdrop (drawn chunky, scaled to fill the virtual scene) ──
  // Overscanned by OVERSCAN_TILES on each side and offset back by the same, so the scene
  // can shake up to MAX_SHAKE px in any direction without exposing the void at an edge.
  const laneW = Math.ceil(VIRTUAL_WIDTH / PX) + OVERSCAN_TILES * 2;
  const laneH = Math.ceil(VIRTUAL_HEIGHT / PX) + OVERSCAN_TILES * 2;
  const lane = new Sprite(nearestTexture(laneBackdrop(laneW, laneH, 1234)));
  lane.scale.set(PX);
  lane.position.set(-OVERSCAN_TILES * PX, -OVERSCAN_TILES * PX);
  scene.addChild(lane);

  const shieldRing = new Graphics().ellipse(0, 0, 70, 46).stroke({ width: 2, color: 0x6ad1e3 });
  shieldRing.position.set(PLAYER_X, CENTER_Y);
  scene.addChild(shieldRing);

  // Player ship + muzzle share the composite frame, so the same anchor/scale aligns them.
  const playerShip = new Sprite();
  playerShip.anchor.set(0.5);
  playerShip.scale.set(PX);
  playerShip.position.set(PLAYER_X, CENTER_Y);
  scene.addChild(playerShip);

  const muzzle = new Sprite(nearestTexture(muzzleFlash()));
  muzzle.anchor.set(0.5);
  muzzle.scale.set(PX);
  muzzle.position.set(PLAYER_X, CENTER_Y);
  muzzle.visible = false;
  scene.addChild(muzzle);

  const enemyShip = new Sprite();
  enemyShip.anchor.set(0.5);
  enemyShip.position.set(ENEMY_X, CENTER_Y);
  scene.addChild(enemyShip);

  let prevHullHp: number | null = null;
  let prevEnemyHp: number | null = null;
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
    const kinds = key === '' ? [] : (key.split(',') as ShipModuleKind[]);
    if (kindsKey !== null) playerShip.texture.destroy(true); // not the initial EMPTY
    playerShip.texture = nearestTexture(compositeShip(kinds));
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
    playerShip.y = CENTER_Y + Math.round(Math.sin(elapsed / 900) * 1) * PX;
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
  };
  app.ticker.add(tick);

  return {
    sync(view: CombatView): void {
      const hullDrop = prevHullHp !== null ? Math.max(0, prevHullHp - view.hullHp) : 0;
      const enemyDrop = prevEnemyHp !== null ? Math.max(0, prevEnemyHp - view.enemyHp) : 0;
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
      prevHullHp = view.hullHp;
      prevEnemyHp = view.enemyHp;

      isBoss = view.boss;
      bossPhase = view.bossPhase ?? -1;

      const nextKey = shipKindsKey(view);
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
