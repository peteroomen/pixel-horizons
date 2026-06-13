import { describe, expect, it } from 'vitest';

import { buildMapView } from './map-view';
import { edgesFrom, generateSectorMap } from './sim/map-gen';
import { createRunState } from './sim/run-state';

describe('buildMapView', () => {
  it('marks the current node and its lane-hop neighbors selectable', () => {
    const run = createRunState('map-view', 'hull-scout');
    const map = generateSectorMap(run.seed, 1);
    run.position.nodeId = map.startId;

    const view = buildMapView(map, run);
    const current = view.nodes.filter((n) => n.current);
    expect(current.map((n) => n.id)).toEqual([map.startId]);

    const expected = new Set(edgesFrom(map, map.startId).map((e) => e.to));
    for (const node of view.nodes) {
      expect(node.selectable, node.id).toBe(expected.has(node.id));
    }
  });

  it('copies run resources rather than referencing them', () => {
    const run = createRunState('map-view-copy', 'hull-gunship');
    const map = generateSectorMap(run.seed, 1);
    run.position.nodeId = map.startId;
    const view = buildMapView(map, run);
    view.resources.scrap = 999;
    expect(run.resources.scrap).toBe(0);
  });

  it('carries hull identity and edge lane params for the path choice', () => {
    const run = createRunState('map-view-hull', 'hull-freighter');
    const map = generateSectorMap(run.seed, 1);
    run.position.nodeId = map.startId;
    const view = buildMapView(map, run);
    expect(view.hullName).toBe('Freighter');
    expect(view.hullHp).toBe(100);
    expect(view.edges.length).toBe(map.edges.length);
    for (const edge of view.edges) {
      expect(edge.distance).toBeGreaterThan(0);
      expect(edge.encounterCount).toBeGreaterThan(0);
    }
  });
});
