'use client';

import type { MapNodeView, MapView } from '@/game/main';

interface SectorMapProps {
  view: MapView;
  onSelect: (nodeId: string) => void;
}

const NODE_LABEL: Record<MapNodeView['type'], string> = {
  start: 'START',
  planet: 'PLANET',
  combat: 'COMBAT',
  cache: 'CACHE',
  gate: 'GATE',
};

const RESOURCE_LABELS: ReadonlyArray<[keyof MapView['resources'], string]> = [
  ['scrap', 'SCRAP'],
  ['biominerals', 'BIO'],
  ['coreCrystals', 'CRYSTAL'],
  ['blueprints', 'BP'],
];

/** Node center in % of the map area — shared by buttons and the SVG edge layer. */
function nodePos(view: MapView, node: MapNodeView): { x: number; y: number } {
  const columnCount = view.nodes.filter((n) => n.column === node.column).length;
  return {
    x: ((node.column + 0.5) / view.columns) * 100,
    y: ((node.row + 0.5) / columnCount) * 100,
  };
}

/**
 * The sector map screen (GDD §7.1): fully DOM — the Pixi canvas idles behind
 * it between lanes. Nodes one lane-hop from the ship are clickable; their lane
 * badge (turns · encounters) is the path-choice information.
 */
export default function SectorMap({ view, onSelect }: SectorMapProps) {
  const currentId = view.nodes.find((n) => n.current)?.id ?? null;
  const positions = new Map(view.nodes.map((n) => [n.id, nodePos(view, n)]));

  return (
    <div className="absolute inset-0 flex flex-col bg-fd-void/95">
      {/* Header strip: run identity + resources */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 sm:px-6 sm:py-3">
        <div className="font-label text-[10px] uppercase text-fd-orange sm:text-sm">
          Sector {view.sector}
        </div>
        <div className="font-label text-[8px] uppercase text-white/80 sm:text-xs">
          {view.hullName} · Hull {view.hullHp}
        </div>
        <div className="font-readout flex gap-3 text-[10px] text-fd-amber sm:text-xs">
          {RESOURCE_LABELS.map(([key, label]) => (
            <span key={key} className={view.resources[key] === 0 ? 'opacity-40' : undefined}>
              {label} {view.resources[key]}
            </span>
          ))}
        </div>
      </div>

      {/* Map area */}
      <div className="relative mx-2 mb-2 flex-1 sm:mx-8 sm:mb-6">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {view.edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (from === undefined || to === undefined) return null;
            const fromCurrent = edge.from === currentId;
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={fromCurrent ? '#e8842c' : '#4a4a6a'}
                strokeWidth={fromCurrent ? 0.7 : 0.35}
                strokeDasharray={fromCurrent ? undefined : '1.5 1.5'}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {view.nodes.map((node) => {
          const { x, y } = positions.get(node.id) as { x: number; y: number };
          const incoming =
            node.selectable && currentId !== null
              ? view.edges.find((e) => e.from === currentId && e.to === node.id)
              : undefined;
          const frame = node.current
            ? 'border-fd-orange text-fd-orange'
            : node.selectable
              ? 'border-white/80 text-white animate-pulse'
              : 'border-[#4a4a6a] text-white/40';
          return (
            <button
              key={node.id}
              type="button"
              disabled={!node.selectable}
              onClick={() => onSelect(node.id)}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 border-2 bg-fd-plate px-1.5 py-1 sm:px-3 sm:py-2 ${frame} ${
                node.selectable ? 'cursor-pointer' : ''
              }`}
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-label={`${NODE_LABEL[node.type]} node${node.selectable ? ' — travel here' : ''}`}
            >
              <span className="font-label text-[7px] uppercase sm:text-[10px]">
                {NODE_LABEL[node.type]}
              </span>
              {incoming !== undefined && (
                <span className="font-readout text-[7px] text-fd-amber sm:text-[9px]">
                  {incoming.distance}T·{incoming.encounterCount}E
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
