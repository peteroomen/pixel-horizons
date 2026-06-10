const SEED_PARAM = 'seed';

// Keeps seeds shareable/typeable and bounds hostile input from hand-edited URLs.
const SEED_PATTERN = /^[a-z0-9-]{1,64}$/;

/**
 * Pure — takes the search string (with or without leading '?') instead of touching
 * window.location, so it stays testable in node and usable from any router.
 */
export function parseSeedParam(search: string): string | null {
  const raw = new URLSearchParams(search).get(SEED_PARAM);
  if (raw === null) {
    return null;
  }
  const seed = raw.trim().toLowerCase();
  return SEED_PATTERN.test(seed) ? seed : null;
}

export function seedToSearchParam(seed: string): string {
  const params = new URLSearchParams();
  params.set(SEED_PARAM, seed);
  return `?${params.toString()}`;
}
