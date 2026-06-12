import { TILE_SIZE } from '@/game/data/surface';
import { isSolid, maxEdgeTileIndex, tileAt } from './tilemap';
import type { Tilemap } from './tilemap';

/**
 * Axis-aligned bounding box body. Origin is top-left; position is in virtual pixels.
 * Velocities are in pixels per second.
 */
export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

export interface MoveResult {
  /** Body's bottom edge was touching solid ground at end of step. */
  onGround: boolean;
  /** Body hit a solid tile on its left or right side. */
  hitWall: boolean;
  /** Body hit a solid tile on its top edge. */
  hitCeiling: boolean;
}

/**
 * Axis-separated AABB sweep against the tile grid. The caller applies gravity
 * before calling moveBody — physics doesn't know what falls.
 *
 * X then Y. Each axis: move, then scan tiles overlapping the new rect; any solid
 * tile that the body actually entered from that axis (tested by checking whether
 * the body EDGE crossed the tile boundary) gets resolved. Velocity zeroed on hit.
 */
export function moveBody(body: Body, map: Tilemap, dtMs: number): MoveResult {
  const dt = dtMs / 1000;

  let onGround = false;
  let hitWall = false;
  let hitCeiling = false;

  // ── X axis ───────────────────────────────────────────────────────────────
  const prevX = body.x;
  body.x += body.vx * dt;
  if (resolveX(body, map, prevX)) {
    body.vx = 0;
    hitWall = true;
  }

  // ── Y axis ───────────────────────────────────────────────────────────────
  const prevY = body.y;
  body.y += body.vy * dt;
  const yResult = resolveY(body, map, prevY);
  if (yResult === 'floor') {
    body.vy = 0;
    onGround = true;
  } else if (yResult === 'ceiling') {
    body.vy = 0;
    hitCeiling = true;
  }

  return { onGround, hitWall, hitCeiling };
}

/** True if any solid tile overlaps the rect — dash landing-spot checks. */
export function rectOverlapsSolid(
  map: Tilemap,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const left = Math.floor(x / TILE_SIZE);
  const right = maxEdgeTileIndex(x + w);
  const top = Math.floor(y / TILE_SIZE);
  const bottom = maxEdgeTileIndex(y + h);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(tileAt(map, tx, ty))) return true;
    }
  }
  return false;
}

/**
 * Resolve X-axis penetration. prevX is the body's X position before the step.
 * Only resolves tiles the body actually crossed into in X (not tiles it was
 * already overlapping in Y from resting on a floor, etc.).
 */
function resolveX(body: Body, map: Tilemap, prevX: number): boolean {
  // Y range based on current (post-move-X, pre-move-Y) position
  const top = Math.floor(body.y / TILE_SIZE);
  const bottom = maxEdgeTileIndex(body.y + body.h);
  const left = Math.floor(body.x / TILE_SIZE);
  const right = maxEdgeTileIndex(body.x + body.w);

  let hit = false;
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (!isSolid(tileAt(map, tx, ty))) continue;

      const tileLeft = tx * TILE_SIZE;
      const tileRight = (tx + 1) * TILE_SIZE;

      // Was this tile already overlapping in X before the step? If so, skip —
      // we only push out tiles we newly entered from the X side.
      const wasOverlappingX = prevX < tileRight && prevX + body.w > tileLeft;
      if (wasOverlappingX) continue;

      // Body has entered this tile from a side: push out in direction of travel
      if (body.vx >= 0) {
        body.x = tileLeft - body.w;
      } else {
        body.x = tileRight;
      }
      hit = true;
    }
  }
  return hit;
}

/**
 * Resolve Y-axis penetration. prevY is the body's Y position before the step.
 * Returns 'floor', 'ceiling', or null.
 */
function resolveY(body: Body, map: Tilemap, prevY: number): 'floor' | 'ceiling' | null {
  const left = Math.floor(body.x / TILE_SIZE);
  const right = maxEdgeTileIndex(body.x + body.w);
  const top = Math.floor(body.y / TILE_SIZE);
  const bottom = maxEdgeTileIndex(body.y + body.h);

  // Iterate in the right direction so we snap to the nearest tile boundary first
  const yStep = body.vy >= 0 ? 1 : -1;
  const yStart = body.vy >= 0 ? top : bottom;
  const yEnd = body.vy >= 0 ? bottom : top;

  let result: 'floor' | 'ceiling' | null = null;
  for (let ty = yStart; body.vy >= 0 ? ty <= yEnd : ty >= yEnd; ty += yStep) {
    for (let tx = left; tx <= right; tx++) {
      if (!isSolid(tileAt(map, tx, ty))) continue;

      const tileTop = ty * TILE_SIZE;
      const tileBottom = (ty + 1) * TILE_SIZE;

      // Was this tile already overlapping in Y before the step? Skip if so.
      const wasOverlappingY = prevY < tileBottom && prevY + body.h > tileTop;
      if (wasOverlappingY) continue;

      if (body.vy >= 0) {
        // Fell into this tile from above — floor
        body.y = tileTop - body.h;
        result = 'floor';
      } else {
        // Rose into this tile from below — ceiling
        body.y = tileBottom;
        result = 'ceiling';
      }
      // Stop after the first resolution to avoid double-snapping
      return result;
    }
  }
  return result;
}
