/**
 * Planet-type catalog (data only — no logic). Planets are generated at runtime from a seed
 * (ADR 010); a type selects which shader/ramp family the generator uses. Terran is the only
 * type for the first 6.1 slice; gas/ice/lava/ocean land in follow-on slices.
 */

export type PlanetType = 'terran';

export interface PlanetDef {
  id: PlanetType;
  name: string;
}

export const PLANET_TYPES: Record<PlanetType, PlanetDef> = {
  terran: { id: 'terran', name: 'Terran' },
};

export const ALL_PLANET_TYPES: readonly PlanetType[] = ['terran'];
