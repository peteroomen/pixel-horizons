/**
 * Mining Run v2 data tables (ADR-003 / GDD §6).
 * Ball metadata, formation tables, biome ramps, reprint costs.
 * Pure data — no logic. Interpreted by core-breaker.ts and ball-projection.ts.
 */

import type { BallType, PegKind } from '@/game/surface/core-breaker';

export type BiomeKey = 'verdant' | 'rust' | 'tundra';

export interface BallMeta {
  radius: number;
  /** Base launch speed in px/s (640×360 space). */
  speed: number;
  damage: number;
  label: string;
}

export const BALL_META: Record<BallType, BallMeta> = {
  standard: { radius: 6, speed: 360, damage: 1, label: 'STANDARD' },
  heavy: { radius: 8, speed: 290, damage: 2, label: 'HEAVY' },
  split: { radius: 6, speed: 360, damage: 1, label: 'SPLIT' },
  drill: { radius: 5, speed: 420, damage: 1, label: 'DRILL' },
  ghost: { radius: 6, speed: 340, damage: 1, label: 'GHOST' },
};

/** Hit-points before a formation shatters. */
export const PEG_HP: Record<PegKind, number> = {
  mineral: 1,
  hard: 1,
  ore: 3,
  crystal: 4,
  rock: 2,
  bloom: 99,
};

/** Damage stages for sprite rendering (Slice B). */
export const PEG_STAGES: Record<PegKind, number> = {
  mineral: 1,
  hard: 2,
  ore: 3,
  crystal: 3,
  rock: 2,
  bloom: 1,
};

/** Collision radius in 640×360 virtual px. */
export const PEG_RADIUS: Record<PegKind, number> = {
  mineral: 10,
  hard: 10,
  ore: 10,
  crystal: 11,
  rock: 10,
  bloom: 12,
};

/** Box collision half-extents for ore bars (all other kinds use circular). */
export const PEG_ABAR = { hw: 26, hh: 7 } as const;

/**
 * What a formation drops when it shatters.
 * null = nothing (rock, bloom).
 * ore drops on every hit as well (intermediate, before full shatter).
 */
export const PEG_DROP: Record<
  PegKind,
  { resource: 'scrap' | 'biominerals' | 'coreCrystals'; amount: number } | null
> = {
  mineral: { resource: 'biominerals', amount: 1 },
  hard: { resource: 'scrap', amount: 1 },
  ore: { resource: 'biominerals', amount: 2 },
  crystal: { resource: 'coreCrystals', amount: 1 },
  rock: null,
  bloom: null,
};

/** Resurrect-64 palette ramps per biome (light→dark, 6 steps). */
export const BIOME_RAMPS: Record<BiomeKey, [string, string, string, string, string, string]> = {
  verdant: ['#cddf6c', '#91db69', '#3aa06a', '#239063', '#1c5a4c', '#123235'],
  rust: ['#fdcbb0', '#fca790', '#e6904e', '#cd683d', '#8a4034', '#4a2330'],
  tundra: ['#c7dcd0', '#9babb2', '#7f8a9c', '#566080', '#3a4256', '#262a3a'],
};

/** Escalating scrap cost for each reprint; max 3 reprints per run. */
export const REPRINT_COSTS = [2, 5, 10] as const;
export const MAX_REPRINTS = 3;

/** Run timer in seconds. */
export const RUN_DURATION = 180;

/** Scrap bonus for catching an active ball with the pod. */
export const BALL_CATCH_BONUS = 2;
/** Scrap bonus for catching a spent ball (fell out but pod was there). */
export const SPENT_CATCH_BONUS = 1;
