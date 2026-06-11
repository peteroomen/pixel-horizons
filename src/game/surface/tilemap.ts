import { TILE_SIZE } from '@/game/data/surface';

export const TILE_EMPTY = 0;
export const TILE_SOLID = 1;
export const TILE_BREAKABLE = 2;

export interface Tilemap {
  width: number;
  height: number;
  /** Flat row-major array: tiles[y * width + x]. */
  tiles: number[];
  spawnX: number;
  spawnY: number;
  /**
   * Incremented by breakTile so the renderer knows to redraw the tile layer.
   * Plain number — no object identity needed.
   */
  version: number;
}

/**
 * Parse ASCII rows into a Tilemap. Throws on ragged rows or wrong spawn count
 * (loud-failure for programming errors — a bad level is a bug, not user input).
 *
 * Legend:
 *   '#' = TILE_SOLID
 *   '*' = TILE_BREAKABLE
 *   'P' = spawn tile (empty after parsing; spawnX/spawnY record the position)
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
  let spawnCount = 0;
  let spawnX = 0;
  let spawnY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x];
      if (ch === '#') {
        tiles[y * width + x] = TILE_SOLID;
      } else if (ch === '*') {
        tiles[y * width + x] = TILE_BREAKABLE;
      } else if (ch === 'P') {
        spawnCount++;
        // Spawn tile itself is empty; clone spawns at its top-left corner
        spawnX = x * TILE_SIZE;
        spawnY = y * TILE_SIZE;
        tiles[y * width + x] = TILE_EMPTY;
      } else if (ch !== '.') {
        throw new Error(`parseLevel: unknown character '${ch}' at (${x}, ${y})`);
      }
    }
  }

  if (spawnCount !== 1) {
    throw new Error(`parseLevel: expected exactly 1 spawn tile ('P'), found ${spawnCount}`);
  }

  return { width, height, tiles, spawnX, spawnY, version: 0 };
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

/** Solid tiles and breakable rocks both block movement. */
export function isSolid(tile: number): boolean {
  return tile === TILE_SOLID || tile === TILE_BREAKABLE;
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
 * knows to redraw the tile layer. No-op on non-breakable tiles.
 */
export function breakTile(map: Tilemap, tx: number, ty: number): void {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return;
  const idx = ty * map.width + tx;
  if (map.tiles[idx] === TILE_BREAKABLE) {
    map.tiles[idx] = TILE_EMPTY;
    map.version++;
  }
}
