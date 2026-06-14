import {
  CACHE_SCRAP_MAX,
  CACHE_SCRAP_MIN,
  LANE_DISTANCE_MAX,
  LANE_DISTANCE_MIN,
  LANE_ENCOUNTERS_MAX,
  LANE_ENCOUNTERS_MIN,
  MAP_COLUMN_NODES_MAX,
  MAP_COLUMN_NODES_MIN,
  MAP_MIDDLE_COLUMNS,
  MAP_NODE_WEIGHTS,
} from '../data';
import { deriveRng } from './rng';
import type { Rng } from './rng';

/**
 * Sector map generation (GDD §7.1): a fixed branching-path map — START, middle
 * columns of 2–3 nodes, GATE — with per-edge lane parameters so "safe planet
 * behind a dangerous lane" exists as a real choice.
 *
 * The map is a PURE FUNCTION of (seed, sector) on its own derived stream —
 * deliberately NOT the run's mutable map-gen stream, which lane rolls consume.
 * Saves therefore never serialize the map: resume regenerates it bit-identically
 * from the RunState's seed (ADR 005).
 */

/**
 * Nodes are realspace destinations — the Bloom can't follow there (GDD §2).
 * Combat exists only on the edges (lane encounters); danger is a property of
 * the path, never of the destination.
 */
export type NodeType = 'start' | 'planet' | 'cache' | 'shop' | 'engineer' | 'gate';

export interface LaneParams {
  /** Lane length in turns of travel (GDD §5.1). */
  distance: number;
  /** Encounters rolled along the lane — the danger axis. */
  encounterCount: number;
}

export interface MapNode {
  id: string;
  type: NodeType;
  /** 0 = START … MAP_MIDDLE_COLUMNS + 1 = GATE. */
  column: number;
  /** Index within the column, for layout. */
  row: number;
  /** Cache nodes only: Scrap found on arrival. */
  cacheScrap?: number;
}

export interface MapEdge {
  from: string;
  to: string;
  lane: LaneParams;
}

export interface SectorMap {
  sector: number;
  nodes: MapNode[];
  edges: MapEdge[];
  startId: string;
  gateId: string;
}

const MIDDLE_TYPES = Object.keys(MAP_NODE_WEIGHTS) as (keyof typeof MAP_NODE_WEIGHTS)[];
const TOTAL_WEIGHT = MIDDLE_TYPES.reduce((sum, t) => sum + MAP_NODE_WEIGHTS[t], 0);

function rollMiddleType(rng: Rng): NodeType {
  let roll = rng.int(0, TOTAL_WEIGHT);
  for (const type of MIDDLE_TYPES) {
    roll -= MAP_NODE_WEIGHTS[type];
    if (roll < 0) return type;
  }
  return MIDDLE_TYPES[MIDDLE_TYPES.length - 1];
}

function rollLane(rng: Rng): LaneParams {
  return {
    distance: rng.int(LANE_DISTANCE_MIN, LANE_DISTANCE_MAX + 1),
    encounterCount: rng.int(LANE_ENCOUNTERS_MIN, LANE_ENCOUNTERS_MAX + 1),
  };
}

/**
 * Monotone full-coverage edges between adjacent columns: every left node gets
 * an exit, every right node an entrance, and the floor-partition mapping in
 * both directions can't produce crossing paths. Duplicates are merged.
 */
function connectColumns(rng: Rng, left: MapNode[], right: MapNode[], edges: MapEdge[]): void {
  const pairs = new Set<string>();
  const add = (a: MapNode, b: MapNode): void => {
    const key = `${a.id}>${b.id}`;
    if (pairs.has(key)) return;
    pairs.add(key);
    edges.push({ from: a.id, to: b.id, lane: rollLane(rng) });
  };
  for (let k = 0; k < right.length; k++) {
    add(left[Math.floor((k * left.length) / right.length)], right[k]);
  }
  for (let i = 0; i < left.length; i++) {
    add(left[i], right[Math.floor((i * right.length) / left.length)]);
  }
}

export function generateSectorMap(seed: string, sector: number): SectorMap {
  const rng = deriveRng(seed, `sector-map-${sector}`);

  const start: MapNode = { id: 'n0-0', type: 'start', column: 0, row: 0 };
  const gateColumn = MAP_MIDDLE_COLUMNS + 1;
  const gate: MapNode = { id: `n${gateColumn}-0`, type: 'gate', column: gateColumn, row: 0 };

  const columns: MapNode[][] = [[start]];
  for (let c = 1; c <= MAP_MIDDLE_COLUMNS; c++) {
    const count = rng.int(MAP_COLUMN_NODES_MIN, MAP_COLUMN_NODES_MAX + 1);
    const column: MapNode[] = [];
    for (let r = 0; r < count; r++) {
      const type = rollMiddleType(rng);
      const node: MapNode = { id: `n${c}-${r}`, type, column: c, row: r };
      if (type === 'cache') {
        node.cacheScrap = rng.int(CACHE_SCRAP_MIN, CACHE_SCRAP_MAX + 1);
      }
      column.push(node);
    }
    columns.push(column);
  }
  columns.push([gate]);

  const middle = columns.slice(1, -1).flat();

  // Floor guarantees: at least one planet and one engineer per sector.
  // Re-type a deterministic middle node if the roll missed.
  if (!middle.some((n) => n.type === 'planet')) {
    const forced = middle[rng.int(0, middle.length)];
    forced.type = 'planet';
    delete forced.cacheScrap;
  }
  if (!middle.some((n) => n.type === 'engineer')) {
    const candidates = middle.filter((n) => n.type !== 'planet');
    if (candidates.length > 0) {
      const forced = candidates[rng.int(0, candidates.length)];
      forced.type = 'engineer';
      delete forced.cacheScrap;
    }
  }

  const edges: MapEdge[] = [];
  for (let c = 0; c < columns.length - 1; c++) {
    connectColumns(rng, columns[c], columns[c + 1], edges);
  }

  return {
    sector,
    nodes: columns.flat(),
    edges,
    startId: start.id,
    gateId: gate.id,
  };
}

export function getNode(map: SectorMap, id: string): MapNode {
  const node = map.nodes.find((n) => n.id === id);
  if (node === undefined) {
    throw new Error(`Unknown map node: ${id}`);
  }
  return node;
}

/** Outgoing edges, in generation order (stable for UI layout). */
export function edgesFrom(map: SectorMap, id: string): MapEdge[] {
  return map.edges.filter((e) => e.from === id);
}
