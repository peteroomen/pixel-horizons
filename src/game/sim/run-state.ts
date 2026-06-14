import { BASELINE_AP, getHull } from '../data';
import type { ModuleInstance } from '../data';
import type { RngState } from './rng';
import { deriveRng } from './rng';

/**
 * Single source of truth for a run. Plain JSON throughout — no class instances — so it
 * serializes losslessly for saves and shareable seeds.
 */

export const RUN_STATE_VERSION = 2;

export const RNG_STREAMS = ['map-gen', 'combat', 'surface'] as const;
export type RngStream = (typeof RNG_STREAMS)[number];

export interface Resources {
  scrap: number;
  biominerals: number;
  coreCrystals: number;
  blueprints: number;
}

export interface RunPosition {
  sector: number;
  nodeId: string | null;
}

export interface RunState {
  version: number;
  seed: string;
  hullId: string;
  hullHp: number;
  resources: Resources;
  modules: ModuleInstance[];
  cargo: ModuleInstance[];
  reactorLevel: number;
  position: RunPosition;
  rng: Record<RngStream, RngState>;
}

export const STARTING_HULL_HP = 100;

function toInstances(moduleIds: readonly string[]): ModuleInstance[] {
  return moduleIds.map((id) => ({ id, tier: 1 }));
}

export function createRunState(seed: string, hullId = 'hull-scout'): RunState {
  const rng = {} as Record<RngStream, RngState>;
  for (const stream of RNG_STREAMS) {
    rng[stream] = deriveRng(seed, stream).getState();
  }
  return {
    version: RUN_STATE_VERSION,
    seed,
    hullId,
    hullHp: STARTING_HULL_HP,
    resources: { scrap: 0, biominerals: 0, coreCrystals: 0, blueprints: 0 },
    modules: toInstances(getHull(hullId).startingModules),
    cargo: [],
    reactorLevel: BASELINE_AP,
    position: { sector: 1, nodeId: null },
    rng,
  };
}

export function serializeRunState(state: RunState): string {
  return JSON.stringify(state);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isModuleInstance(value: unknown): value is ModuleInstance {
  return isRecord(value) && isNonEmptyString(value.id) && (value.tier === 1 || value.tier === 2);
}

function parseRngState(value: unknown): RngState | null {
  if (!isRecord(value) || !isNonEmptyString(value.seed) || !isFiniteNumber(value.state)) {
    return null;
  }
  return { seed: value.seed, state: value.state };
}

/**
 * Returns null — never throws — on corrupt JSON, wrong version, or missing/mistyped
 * fields, so a bad save degrades to "no save" instead of crashing the app. The result
 * is rebuilt field-by-field: unknown extra properties are dropped, not carried along.
 */
export function deserializeRunState(json: string): RunState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.version !== RUN_STATE_VERSION) {
    return null;
  }

  const { seed, hullId, hullHp, resources, modules, position, rng } = parsed;
  if (!isNonEmptyString(seed) || !isNonEmptyString(hullId) || !isFiniteNumber(hullHp)) {
    return null;
  }

  if (
    !isRecord(resources) ||
    !isFiniteNumber(resources.scrap) ||
    !isFiniteNumber(resources.biominerals) ||
    !isFiniteNumber(resources.coreCrystals) ||
    !isFiniteNumber(resources.blueprints)
  ) {
    return null;
  }

  if (!Array.isArray(modules) || !modules.every(isModuleInstance)) {
    return null;
  }

  if (!Array.isArray(parsed.cargo) || !(parsed.cargo as unknown[]).every(isModuleInstance)) {
    return null;
  }
  const cargo = parsed.cargo as ModuleInstance[];

  if (!isFiniteNumber(parsed.reactorLevel) || parsed.reactorLevel < 0) {
    return null;
  }
  const reactorLevel = parsed.reactorLevel;

  if (
    !isRecord(position) ||
    !isFiniteNumber(position.sector) ||
    !(position.nodeId === null || isNonEmptyString(position.nodeId))
  ) {
    return null;
  }

  if (!isRecord(rng)) {
    return null;
  }
  const rngStates = {} as Record<RngStream, RngState>;
  for (const stream of RNG_STREAMS) {
    const parsedStream = parseRngState(rng[stream]);
    if (parsedStream === null) {
      return null;
    }
    rngStates[stream] = parsedStream;
  }

  return {
    version: RUN_STATE_VERSION,
    seed,
    hullId,
    hullHp,
    resources: {
      scrap: resources.scrap,
      biominerals: resources.biominerals,
      coreCrystals: resources.coreCrystals,
      blueprints: resources.blueprints,
    },
    modules: (modules as ModuleInstance[]).map((m) => ({ id: m.id, tier: m.tier })),
    cargo: cargo.map((m) => ({ id: m.id, tier: m.tier })),
    reactorLevel,
    position: { sector: position.sector, nodeId: position.nodeId },
    rng: rngStates,
  };
}
