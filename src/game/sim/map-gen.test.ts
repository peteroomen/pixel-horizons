import { describe, expect, it } from 'vitest';

import {
  LANE_DISTANCE_MAX,
  LANE_DISTANCE_MIN,
  LANE_ENCOUNTERS_MAX,
  LANE_ENCOUNTERS_MIN,
  MAP_COLUMN_NODES_MAX,
  MAP_COLUMN_NODES_MIN,
  MAP_MIDDLE_COLUMNS,
} from '../data';
import { edgesFrom, generateSectorMap, getNode } from './map-gen';
import type { SectorMap } from './map-gen';

const SEEDS = Array.from({ length: 200 }, (_, i) => `seed-${i}`);

function reachableFrom(map: SectorMap, startId: string, forward: boolean): Set<string> {
  const seen = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    for (const edge of map.edges) {
      const next = forward
        ? edge.from === id
          ? edge.to
          : null
        : edge.to === id
          ? edge.from
          : null;
      if (next !== null && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

describe('generateSectorMap', () => {
  it('is a pure function of (seed, sector) — identical across calls', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      expect(generateSectorMap(seed, 1)).toEqual(generateSectorMap(seed, 1));
    }
  });

  it('different seeds and sectors produce different maps', () => {
    const a = generateSectorMap('seed-a', 1);
    const b = generateSectorMap('seed-b', 1);
    const a2 = generateSectorMap('seed-a', 2);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(a2));
  });

  it('every node is reachable from START and reaches GATE (200 seeds)', () => {
    for (const seed of SEEDS) {
      const map = generateSectorMap(seed, 1);
      const fromStart = reachableFrom(map, map.startId, true);
      const toGate = reachableFrom(map, map.gateId, false);
      for (const node of map.nodes) {
        expect(fromStart.has(node.id), `${seed} ${node.id} unreachable`).toBe(true);
        expect(toGate.has(node.id), `${seed} ${node.id} dead-ends`).toBe(true);
      }
    }
  });

  it('has the documented shape: single START/GATE, bounded middle columns', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const map = generateSectorMap(seed, 1);
      expect(getNode(map, map.startId).type).toBe('start');
      expect(getNode(map, map.gateId).type).toBe('gate');
      for (let c = 1; c <= MAP_MIDDLE_COLUMNS; c++) {
        const column = map.nodes.filter((n) => n.column === c);
        expect(column.length).toBeGreaterThanOrEqual(MAP_COLUMN_NODES_MIN);
        expect(column.length).toBeLessThanOrEqual(MAP_COLUMN_NODES_MAX);
        for (const node of column) {
          // Nodes are realspace destinations — combat exists only on lanes
          expect(['planet', 'cache']).toContain(node.type);
        }
      }
    }
  });

  it('guarantees at least one planet node per sector', () => {
    for (const seed of SEEDS) {
      const map = generateSectorMap(seed, 1);
      expect(
        map.nodes.some((n) => n.type === 'planet'),
        seed,
      ).toBe(true);
    }
  });

  it('edges only step one column forward and carry in-band lane params', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const map = generateSectorMap(seed, 1);
      for (const edge of map.edges) {
        const from = getNode(map, edge.from);
        const to = getNode(map, edge.to);
        expect(to.column).toBe(from.column + 1);
        expect(edge.lane.distance).toBeGreaterThanOrEqual(LANE_DISTANCE_MIN);
        expect(edge.lane.distance).toBeLessThanOrEqual(LANE_DISTANCE_MAX);
        expect(edge.lane.encounterCount).toBeGreaterThanOrEqual(LANE_ENCOUNTERS_MIN);
        expect(edge.lane.encounterCount).toBeLessThanOrEqual(LANE_ENCOUNTERS_MAX);
      }
    }
  });

  it('cache nodes carry scrap, others do not', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const map = generateSectorMap(seed, 1);
      for (const node of map.nodes) {
        if (node.type === 'cache') {
          expect(node.cacheScrap).toBeGreaterThan(0);
        } else {
          expect(node.cacheScrap).toBeUndefined();
        }
      }
    }
  });

  it('edgesFrom returns every choice out of a node', () => {
    const map = generateSectorMap('seed-edges', 1);
    const out = edgesFrom(map, map.startId);
    expect(out.length).toBeGreaterThanOrEqual(1);
    for (const edge of out) {
      expect(edge.from).toBe(map.startId);
    }
  });
});
