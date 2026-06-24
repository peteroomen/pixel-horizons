// Combat sound effects — ZzFX parameter arrays tuned to the Pixel Horizons aesthetic:
// Player/UI = mechanical (clicks, punches, metal).
// Enemy/Bloom = organic (wet, biological, unsettling).
//
// Standard ZzFX parameter order (20 args):
//   volume, randomness, frequency, attack, sustain, release,
//   shape (0=sine 1=square 2=saw 3=triangle 4=tan), shapeCurve,
//   slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime,
//   noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo

import { zzfx } from './zzfx';

let muted = false;
export const setMuted = (v: boolean) => {
  muted = v;
};
export const isMuted = () => muted;

function play(...params: Parameters<typeof zzfx>): void {
  if (muted) return;
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;
  zzfx(...params);
}

// ──────────────────────────────────────────────────
// Player / UI — mechanical, crisp, metallic
// ──────────────────────────────────────────────────

/** Card played from hand — satisfying button-click thunk. */
export const cardPlay = () =>
  //        vol  rnd  freq  atk  sus   rel   shp  shpC  slide
  play(0.4, 0, 180, 0, 0, 0.08, 1, 1, -1.5);

/** Card drawn into hand — light metallic tick. */
export const cardDraw = () =>
  //         vol   rnd   freq  atk  sus   rel   shp  shpC  slide
  play(0.25, 0.02, 440, 0, 0, 0.06, 0, 1, 0.5);

/** Card discarded — soft thud with slight crunch. */
export const cardDiscard = () =>
  //        vol   rnd   freq  atk   sus   rel   shp  shpC  slide
  play(0.3, 0.05, 120, 0, 0.02, 0.1, 2, 1, -0.8);

/** AP pip spent — short electrical pop. */
export const apSpend = () =>
  //        vol  rnd  freq  atk  sus   rel   shp  shpC  slide
  play(0.2, 0, 600, 0, 0, 0.04, 1, 1, -3);

/** End turn — deep mechanical clunk with a rising pitch jump. */
export const turnEnd = () =>
  //        vol  rnd  freq  atk   sus   rel   shp  shpC  slide  dSlide  pJump  pJumpT
  play(0.5, 0, 90, 0, 0.05, 0.18, 1, 1, 1.2, 0, 180, 0.12);

// ──────────────────────────────────────────────────
// Combat hits — punchy, directional
// ──────────────────────────────────────────────────

/** Player hull hit — heavy metallic thud (damage on your ship). */
export const hullHit = () =>
  //        vol   rnd   freq  atk   sus   rel   shp  shpC  slide  dSlide  pJ  pJT  repT  noise
  play(0.7, 0.1, 80, 0, 0.04, 0.22, 3, 1, -2.5, 0, 0, 0, 0, 0.15);

/** Enemy hit — organic wet smack (Bloom flesh, not metal). */
export const enemyHit = () =>
  //         vol   rnd   freq  atk   sus   rel   shp  shpC  slide  dSlide  pJ  pJT  repT  noise
  play(0.5, 0.15, 160, 0, 0.03, 0.14, 0, 1, -4, 0, 0, 0, 0, 0.3);

// ──────────────────────────────────────────────────
// Shields — FTL-style energy
// ──────────────────────────────────────────────────

/** Shield layer regenerated — bright electronic chime. */
export const shieldUp = () =>
  //         vol   rnd  freq   atk   sus   rel   shp  shpC  slide
  play(0.35, 0, 520, 0.02, 0.04, 0.12, 0, 1, 2);

/** Shield layer broken — crackling discharge. */
export const shieldBreak = () =>
  //         vol   rnd   freq  atk   sus   rel   shp  shpC  slide  dSlide  pJ  pJT  repT  noise
  play(0.55, 0.1, 300, 0, 0.05, 0.2, 2, 1, -3.5, 0, 0, 0, 0, 0.2);

// ──────────────────────────────────────────────────
// Run outcome
// ──────────────────────────────────────────────────

/** Victory fanfare — ascending triple-stab arpeggio. */
export const victory = () =>
  //        vol  rnd  freq  atk   sus   rel   shp  shpC  slide  dSlide  pJ   pJT   repT
  play(0.5, 0, 280, 0, 0.06, 0.12, 0, 1, 0, 0, 0, 0, 0.18);
