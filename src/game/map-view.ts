import { getHull } from './data';
import { edgesFrom } from './sim/map-gen';
import type { NodeType, SectorMap } from './sim/map-gen';
import type { Resources, RunState } from './sim/run-state';

/**
 * The React-facing sector-map snapshot (sibling of CombatView/SurfaceView).
 * Built by main.ts on map-phase entry — the map screen is fully DOM, so this
 * is the only channel it has. Plain copies throughout, never references into
 * mutable sim state.
 */

export interface MapNodeView {
  id: string;
  type: NodeType;
  column: number;
  row: number;
  /** The ship is docked here. */
  current: boolean;
  /** One lane-hop away from the current node — clickable. */
  selectable: boolean;
}

export interface MapEdgeView {
  from: string;
  to: string;
  /** Lane length in turns — shown so path choice weighs distance (GDD §7.1). */
  distance: number;
  /** Encounters on the lane — the danger axis of the choice. */
  encounterCount: number;
}

export interface MapView {
  sector: number;
  /** Total columns including START and GATE, for layout. */
  columns: number;
  nodes: MapNodeView[];
  edges: MapEdgeView[];
  hullName: string;
  hullHp: number;
  resources: Resources;
}

export function buildMapView(map: SectorMap, run: RunState): MapView {
  const currentId = run.position.nodeId;
  const selectable = new Set(
    currentId === null ? [] : edgesFrom(map, currentId).map((edge) => edge.to),
  );
  const columns = Math.max(...map.nodes.map((n) => n.column)) + 1;
  return {
    sector: map.sector,
    columns,
    nodes: map.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      column: node.column,
      row: node.row,
      current: node.id === currentId,
      selectable: selectable.has(node.id),
    })),
    edges: map.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      distance: edge.lane.distance,
      encounterCount: edge.lane.encounterCount,
    })),
    hullName: getHull(run.hullId).name,
    hullHp: run.hullHp,
    resources: { ...run.resources },
  };
}
