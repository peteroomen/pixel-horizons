import {
  CRUMBLE_BREAK_MS,
  CRUMBLE_REFORM_MS,
  TILE_SIZE,
  VENT_ACTIVE_MS,
  VENT_IDLE_MS,
  VENT_PUSH_HALF_WIDTH,
  VENT_PUSH_HEIGHT,
  VENT_PUSH_VX,
} from '@/game/data/surface';
import type { Body } from './physics';
import {
  TILE_CRUMBLING,
  TILE_EMPTY,
  TILE_SPIKE_BRAMBLE,
  maxEdgeTileIndex,
  tileAt,
} from './tilemap';
import type { Tilemap, Vent } from './tilemap';

/** Live state of one Crumbling Sandstone tile (GDD §6.8). */
export interface CrumbleTile {
  /** Flat tile index (ty * width + tx). */
  index: number;
  tx: number;
  ty: number;
  state: 'solid' | 'breaking' | 'gone';
  /** Time accrued in the current state (ms). */
  timerMs: number;
}

/** Scan the level for Crumbling Sandstone tiles and build their live state. */
export function createCrumbleTiles(map: Tilemap): CrumbleTile[] {
  const out: CrumbleTile[] = [];
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const index = ty * map.width + tx;
      if (map.tiles[index] === TILE_CRUMBLING) {
        out.push({ index, tx, ty, state: 'solid', timerMs: 0 });
      }
    }
  }
  return out;
}

function bodyStandsOn(body: Body, grounded: boolean, tx: number, ty: number): boolean {
  if (!grounded) return false;
  const footRow = Math.floor((body.y + body.h) / TILE_SIZE);
  if (footRow !== ty) return false;
  return body.x < (tx + 1) * TILE_SIZE && body.x + body.w > tx * TILE_SIZE;
}

/**
 * Advance the Crumbling Sandstone state machines (GDD §6.8). A tile begins
 * breaking the instant the grounded clone stands on it, collapses to empty
 * after CRUMBLE_BREAK_MS (committed — stepping off doesn't save it), and
 * re-forms solid after CRUMBLE_REFORM_MS. Toggles map tiles + bumps version.
 */
export function updateCrumbling(
  crumbles: CrumbleTile[],
  map: Tilemap,
  cloneBody: Body,
  grounded: boolean,
  dtMs: number,
): void {
  for (const c of crumbles) {
    switch (c.state) {
      case 'solid':
        if (bodyStandsOn(cloneBody, grounded, c.tx, c.ty)) {
          c.state = 'breaking';
          c.timerMs = 0;
        }
        break;
      case 'breaking':
        c.timerMs += dtMs;
        if (c.timerMs >= CRUMBLE_BREAK_MS) {
          c.state = 'gone';
          c.timerMs = 0;
          map.tiles[c.index] = TILE_EMPTY;
          map.version++;
        }
        break;
      case 'gone':
        c.timerMs += dtMs;
        if (c.timerMs >= CRUMBLE_REFORM_MS) {
          c.state = 'solid';
          c.timerMs = 0;
          map.tiles[c.index] = TILE_CRUMBLING;
          map.version++;
        }
        break;
    }
  }
}

/** True if the clone body overlaps any Spike Bramble tile (GDD §6.8). */
export function brambleContact(map: Tilemap, body: Body): boolean {
  const left = Math.floor(body.x / TILE_SIZE);
  const right = maxEdgeTileIndex(body.x + body.w);
  const top = Math.floor(body.y / TILE_SIZE);
  const bottom = maxEdgeTileIndex(body.y + body.h);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (tileAt(map, tx, ty) === TILE_SPIKE_BRAMBLE) return true;
    }
  }
  return false;
}

/** Whole vent cycle length (active + idle). */
export const VENT_CYCLE_MS = VENT_ACTIVE_MS + VENT_IDLE_MS;

/** True while vents are in their active (pushing) phase. */
export function ventsActive(phaseMs: number): boolean {
  return phaseMs % VENT_CYCLE_MS < VENT_ACTIVE_MS;
}

/**
 * Horizontal impulse (px/s) a Sandstorm Vent imparts on the clone this step
 * (GDD §6.8) — outward from the vent column, only while active and within the
 * push band. Zero when idle or out of range. Caller advances the phase clock.
 */
export function ventPush(vents: Vent[], phaseMs: number, body: Body): number {
  if (!ventsActive(phaseMs) || vents.length === 0) return 0;
  const cloneCenterX = body.x + body.w / 2;
  const cloneBottom = body.y + body.h;
  let push = 0;
  for (const vent of vents) {
    const ventCenterX = vent.x + TILE_SIZE / 2;
    const withinX = Math.abs(cloneCenterX - ventCenterX) <= VENT_PUSH_HALF_WIDTH;
    const aboveVent = cloneBottom <= vent.y + TILE_SIZE && cloneBottom >= vent.y - VENT_PUSH_HEIGHT;
    if (withinX && aboveVent) {
      push += (cloneCenterX >= ventCenterX ? 1 : -1) * VENT_PUSH_VX;
    }
  }
  return push;
}
