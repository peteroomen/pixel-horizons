import { CARD_DEFS } from './cards';
import { ENEMY_DEFS } from './enemies';
import { HULL_DEFS } from './hulls';
import { MODIFIER_DEFS } from './modifiers';
import { MODULE_DEFS } from './modules';
import type {
  CardDef,
  CardId,
  EnemyDef,
  EnemyId,
  HullDef,
  HullId,
  ModifierDef,
  ModifierId,
  ModuleDef,
  ModuleId,
} from './types';

export * from './types';
export * from './constants';
export { CARD_DEFS } from './cards';
export { MODULE_DEFS } from './modules';
export { MODIFIER_DEFS } from './modifiers';
export { HULL_DEFS } from './hulls';
export { ENEMY_DEFS } from './enemies';

const cardsById = new Map<CardId, CardDef>(CARD_DEFS.map((c) => [c.id, c]));
const modulesById = new Map<ModuleId, ModuleDef>(MODULE_DEFS.map((m) => [m.id, m]));
const modifiersById = new Map<ModifierId, ModifierDef>(MODIFIER_DEFS.map((m) => [m.id, m]));
const hullsById = new Map<HullId, HullDef>(HULL_DEFS.map((h) => [h.id, h]));
const enemiesById = new Map<EnemyId, EnemyDef>(ENEMY_DEFS.map((e) => [e.id, e]));

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

export function getModifier(id: ModifierId): ModifierDef {
  return lookup(modifiersById, id, 'modifier');
}

export function getHull(id: HullId): HullDef {
  return lookup(hullsById, id, 'hull');
}

export function getEnemy(id: EnemyId): EnemyDef {
  return lookup(enemiesById, id, 'enemy');
}
