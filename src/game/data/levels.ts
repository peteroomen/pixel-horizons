/**
 * Hand-crafted test levels. One level = string[] where every row has equal length.
 * Legend: '#' solid, '*' breakable rock (yields nothing), 'b' biomineral deposit,
 * 's' scrap cache, 'P' spawn (counts as empty), 'D' pod marker (counts as empty),
 * '.' empty.
 *
 * TILE_SIZE = 16 px; CLONE body = 12 × 20 px; POD = 32 × 48 px (2×3 tiles).
 * Jump apex ≈ 380² / (2 × 1500) ≈ 48 px = 3 tiles → max climbable step = 3 tiles.
 */

/**
 * Rocky biome test level (Slices 3.1–3.2). 60 × 20 tiles = 960 × 320 virtual px.
 * Wider and taller than the 640 × 360 virtual screen so the camera must scroll.
 *
 * Row / column key (0-based, TILE_SIZE = 16):
 *   Rows 0 and 19      : solid top/bottom boundary
 *   Row 18             : sub-floor (solid)
 *   Row 17             : main floor; pit at cols 14-17; wall base at cols 36-37
 *   Rows 15-16 col 22-27 : step-1 platform (2 tiles above floor)
 *   Row 14 col 28-32   : step-2 platform (3 tiles above floor)
 *   Row 15 col 3       : pod marker — pod AABB spans cols 3-4 × rows 15-17,
 *                        resting on the row-18 floor, one step right of spawn
 *   Row 17 cols 6-7    : biomineral deposits at standing height (near spawn)
 *   Row 14 col 32      : biomineral deposit atop step-2 platform
 *   Row 17 col 33      : scrap cache on the mid floor stretch
 *   Row 17 cols 40-44  : far cluster beyond the wall (b b s b b) — the
 *                        risk/reward trip against the pod timer
 *   Row 17 col 47      : plain breakable rock (yields nothing — kept testable)
 *   Row 17 cols 34, 46 : hidden deposits ('h') — render as plain rock without
 *                        a Resource Scanner
 *   Cols 50-55 rows 15-17: dash-gated crystal pocket — 2-tile wall (cols 50-51),
 *                        ceiling (row 15), interior at cols 52-53 rows 16-17,
 *                        core crystal at row 17 col 54. Only a phase dash gets
 *                        in; the crystal can't be swung at from outside.
 */
export const ROCKY_TEST_LEVEL: string[] = [
  // col: 0         1         2         3         4         5
  //      0123456789012345678901234567890123456789012345678901234567890
  /*  0 */ '############################################################',
  /*  1 */ '#..........................................................#',
  /*  2 */ '#..........................................................#',
  /*  3 */ '#..........................................................#',
  /*  4 */ '#..........................................................#',
  /*  5 */ '#..........................................................#',
  /*  6 */ '#..........................................................#',
  /*  7 */ '#..........................................................#',
  /*  8 */ '#..........................................................#',
  /*  9 */ '#..........................................................#',
  /* 10 */ '#..........................................................#',
  /* 11 */ '#..........................................................#',
  /* 12 */ '#..........................................................#',
  /* 13 */ '#..........................................................#',
  /* 14 */ '#...........................####b....##....................#',
  /* 15 */ '#.PD..................######.........##...........######...#',
  /* 16 */ '#.....................######.........##...........##...#...#',
  /* 17 */ '##....bb######....######.........sh.##..bbsbb.h*..##..c#####',
  /* 18 */ '############################################################',
  /* 19 */ '############################################################',
];
