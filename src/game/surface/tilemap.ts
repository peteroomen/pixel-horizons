import { TILE_SIZE } from '@/game/data/surface';

export const TILE_EMPTY = 0;
export const TILE_SOLID = 1;
export const TILE_BREAKABLE = 2;
export const TILE_DEPOSIT_BIOMINERAL = 3;
export const TILE_SCRAP_CACHE = 4;
/** Rich biomineral vein that renders as plain rock without a Resource Scanner. */
export const TILE_DEPOSIT_HIDDEN = 5;
/** Core Crystal vein — the rare reactor-upgrade resource (GDD §6.5). */
export const TILE_CORE_CRYSTAL = 6;
/** Spike Bramble hazard (GDD §6.8): non-solid; deals contact damage on overlap. */
export const TILE_SPIKE_BRAMBLE = 7;
/** Crumbling Sandstone (GDD §6.8): solid; breaks ~0.5s after standing, re-forms ~8s. */
export const TILE_CRUMBLING = 8;

export type SurfaceEnemyType = 'hopper' | 'grubber' | 'dropper';

/** A spawn-point token resolved from the level grid (GDD §6.9 E1/E2/E3 tokens). */
export interface EnemySpawn {
  type: SurfaceEnemyType;
  /** Top-left px of the spawn tile. */
  x: number;
  y: number;
}

/** A Sandstorm Vent emitter resolved from a 'V' token. */
export interface Vent {
  /** Top-left px of the vent tile. */
  x: number;
  y: number;
}

export interface Tilemap {
  width: number;
  height: number;
  /** Flat row-major array: tiles[y * width + x]. */
  tiles: number[];
  spawnX: number;
  spawnY: number;
  /** Top-left px of the 'D' pod marker tile, or null if the level has no pod. */
  podX: number | null;
  podY: number | null;
  /** Enemy spawn points from E-tokens (GDD §6.7) — positions only; enemies.ts owns AI. */
  enemySpawns: EnemySpawn[];
  /** Sandstorm Vent emitters from 'V' tokens (GDD §6.8). */
  vents: Vent[];
  /**
   * Incremented by breakTile (and the crumble state machine) so the renderer
   * knows to redraw the tile layer. Plain number — no object identity needed.
   */
  version: number;
}

/**
 * Parse ASCII rows into a Tilemap. Throws on ragged rows or wrong spawn count
 * (loud-failure for programming errors — a bad level is a bug, not user input).
 *
 * Legend:
 *   '#' = TILE_SOLID
 *   '*' = TILE_BREAKABLE (plain rock — yields nothing)
 *   'b' = TILE_DEPOSIT_BIOMINERAL
 *   's' = TILE_SCRAP_CACHE
 *   'h' = TILE_DEPOSIT_HIDDEN
 *   'c' = TILE_CORE_CRYSTAL
 *   '^' = TILE_SPIKE_BRAMBLE (non-solid hazard)
 *   '~' = TILE_CRUMBLING (solid sandstone that breaks under weight)
 *   'H' = Bloom Hopper spawn (empty after parsing; recorded in enemySpawns)
 *   'G' = Scrap Grubber spawn (empty after parsing; recorded in enemySpawns)
 *   'C' = Ceiling Dropper spawn (empty after parsing; recorded in enemySpawns)
 *   'V' = Sandstorm Vent (empty after parsing; recorded in vents)
 *   'P' = spawn tile (empty after parsing; spawnX/spawnY record the position)
 *   'D' = pod marker (empty after parsing; podX/podY record the position — the
 *         pod is an entity, never a solid tile). At most one per level.
 *   '.' = TILE_EMPTY
 */
export function parseLevel(rows: string[]): Tilemap {
  if (rows.length === 0) {
    throw new Error('parseLevel: empty rows array');
  }
  const width = rows[0].length;
  const height = rows.length;
  for (let y = 0; y < height; y++) {
    if (rows[y].length !== width) {
      throw new Error(
        `parseLevel: row ${y} has length ${rows[y].length}, expected ${width} (ragged level)`,
      );
    }
  }

  const tiles: number[] = new Array(width * height).fill(TILE_EMPTY);
  const enemySpawns: EnemySpawn[] = [];
  const vents: Vent[] = [];
  let spawnCount = 0;
  let spawnX = 0;
  let spawnY = 0;
  let podCount = 0;
  let podX: number | null = null;
  let podY: number | null = null;

  const ENEMY_TOKENS: Record<string, SurfaceEnemyType> = {
    H: 'hopper',
    G: 'grubber',
    C: 'dropper',
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      if (ch === '#') {
        tiles[y * width + x] = TILE_SOLID;
      } else if (ch === '*') {
        tiles[y * width + x] = TILE_BREAKABLE;
      } else if (ch === 'b') {
        tiles[y * width + x] = TILE_DEPOSIT_BIOMINERAL;
      } else if (ch === 's') {
        tiles[y * width + x] = TILE_SCRAP_CACHE;
      } else if (ch === 'h') {
        tiles[y * width + x] = TILE_DEPOSIT_HIDDEN;
      } else if (ch === 'c') {
        tiles[y * width + x] = TILE_CORE_CRYSTAL;
      } else if (ch === '^') {
        tiles[y * width + x] = TILE_SPIKE_BRAMBLE;
      } else if (ch === '~') {
        tiles[y * width + x] = TILE_CRUMBLING;
      } else if (ch in ENEMY_TOKENS) {
        enemySpawns.push({ type: ENEMY_TOKENS[ch], x: px, y: py });
        tiles[y * width + x] = TILE_EMPTY;
      } else if (ch === 'V') {
        vents.push({ x: px, y: py });
        tiles[y * width + x] = TILE_EMPTY;
      } else if (ch === 'P') {
        spawnCount++;
        // Spawn tile itself is empty; clone spawns at its top-left corner
        spawnX = px;
        spawnY = py;
        tiles[y * width + x] = TILE_EMPTY;
      } else if (ch === 'D') {
        podCount++;
        // Pod marker tile is empty; the pod AABB anchors at its top-left corner
        podX = px;
        podY = py;
        tiles[y * width + x] = TILE_EMPTY;
      } else if (ch !== '.') {
        throw new Error(`parseLevel: unknown character '${ch}' at (${x}, ${y})`);
      }
    }
  }

  if (spawnCount !== 1) {
    throw new Error(`parseLevel: expected exactly 1 spawn tile ('P'), found ${spawnCount}`);
  }
  if (podCount > 1) {
    throw new Error(`parseLevel: expected at most 1 pod marker ('D'), found ${podCount}`);
  }

  return { width, height, tiles, spawnX, spawnY, podX, podY, enemySpawns, vents, version: 0 };
}

/**
 * Returns the tile type at (tx, ty). Out-of-bounds returns TILE_SOLID — the
 * clone cannot leave the level (pit-death semantics arrive in 3.4).
 */
export function tileAt(map: Tilemap, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) {
    return TILE_SOLID;
  }
  return map.tiles[ty * map.width + tx];
}

/**
 * Solid tiles and all breakable rock kinds block movement — deposits are rock
 * you can stand on, Crumbling Sandstone too (until it gives way). Spike Bramble
 * is a pass-through hazard, never solid (GDD §6.8 — you walk into it).
 */
export function isSolid(tile: number): boolean {
  return tile !== TILE_EMPTY && tile !== TILE_SPIKE_BRAMBLE;
}

/** Resource/rock tiles a melee swing can mine — excludes hazards and bedrock. */
function isBreakable(tile: number): boolean {
  return (
    tile === TILE_BREAKABLE ||
    tile === TILE_DEPOSIT_BIOMINERAL ||
    tile === TILE_SCRAP_CACHE ||
    tile === TILE_DEPOSIT_HIDDEN ||
    tile === TILE_CORE_CRYSTAL
  );
}

/**
 * Tile index containing the last occupied pixel of an AABB's max (right/bottom)
 * edge, where `edge` is the exclusive coordinate (x + w or y + h). A flush edge
 * exactly on a tile boundary does not overlap the next tile. This must be
 * `ceil(edge / TILE) - 1`, NOT `floor((edge - 1) / TILE)`: the latter misses
 * sub-pixel penetrations (e.g. a resting body nudged 0.4px into the floor by
 * one gravity step), which let bodies sink through solid tiles.
 */
export function maxEdgeTileIndex(edge: number): number {
  return Math.ceil(edge / TILE_SIZE) - 1;
}

/**
 * Converts a breakable tile to empty and bumps map.version so the renderer
 * knows to redraw the tile layer. Returns the tile type that was broken so
 * callers can resolve mining yields, or null if nothing broke (non-breakable
 * tile or out of bounds).
 */
export function breakTile(map: Tilemap, tx: number, ty: number): number | null {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
  const idx = ty * map.width + tx;
  const tile = map.tiles[idx];
  if (!isBreakable(tile)) return null;
  map.tiles[idx] = TILE_EMPTY;
  map.version++;
  return tile;
}
