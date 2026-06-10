import { CARD_DEFS } from './cards';
import { HULL_DEFS } from './hulls';
import { MODULE_DEFS } from './modules';
import type { CardDef, CardId, HullDef, HullId, ModuleDef, ModuleId } from './types';

export * from './types';
export { CARD_DEFS } from './cards';
export { MODULE_DEFS } from './modules';
export { HULL_DEFS } from './hulls';

const cardsById = new Map<CardId, CardDef>(CARD_DEFS.map((c) => [c.id, c]));
const modulesById = new Map<ModuleId, ModuleDef>(MODULE_DEFS.map((m) => [m.id, m]));
const hullsById = new Map<HullId, HullDef>(HULL_DEFS.map((h) => [h.id, h]));

function lookup<T>(map: Map<string, T>, id: string, kind: string): T {
  const def = map.get(id);
  if (def === undefined) {
    throw new Error(`Unknown ${kind} id: ${id}`);
  }
  return def;
}

export function getCard(id: CardId): CardDef {
  return lookup(cardsById, id, 'card');
}

export function getModule(id: ModuleId): ModuleDef {
  return lookup(modulesById, id, 'module');
}

export function getHull(id: HullId): HullDef {
  return lookup(hullsById, id, 'hull');
}
