/**
 * Pure, React-free helpers behind the combat juice layer (Slice 6.6). All combat fx —
 * floating damage numbers, plate flashes, viewport shake — are *derived* from the
 * difference between consecutive `CombatView` snapshots rather than threaded through the
 * sim, so the sim and the view stay untouched. The derivation lives here, out of the
 * .tsx, so it is unit-testable under vitest's node env (no DOM, no React, no PixiJS).
 */

/** Damage taken between two HP readings: the positive drop, or null when HP didn't fall. */
export function hpDrop(prev: number | null, next: number): number | null {
  if (prev === null || next >= prev) return null;
  return prev - next;
}

/** Smallest / largest viewport-shake amplitude in virtual px (integer — see below). */
export const MIN_SHAKE = 2;
export const MAX_SHAKE = 6;

/**
 * Viewport-shake amplitude (virtual px) for a hit of `drop` damage against a `maxHp`
 * pool. Scales with the fraction of the pool removed so a chip and a haymaker both read
 * but neither wrecks the frame, clamped to [MIN_SHAKE, MAX_SHAKE]. Returns whole pixels
 * so the nearest-neighbour scale stays crisp (the renderer shakes in virtual units).
 */
export function shakeAmplitude(drop: number, maxHp: number): number {
  if (drop <= 0 || maxHp <= 0) return 0;
  const frac = Math.min(1, drop / maxHp);
  return Math.round(MIN_SHAKE + (MAX_SHAKE - MIN_SHAKE) * frac);
}
