/**
 * Seeded PRNG — ALL game randomness flows through here (see CLAUDE.md: Math.random is
 * banned). String seeds are hashed (xmur3) into a 32-bit mulberry32 state. The full
 * generator state is a plain serializable object, so a restored save continues its
 * random sequence exactly where it left off.
 */

export interface RngState {
  seed: string;
  state: number;
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max) — exclusive upper bound. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Deterministic Fisher–Yates; returns a new array, input untouched. */
  shuffle<T>(items: readonly T[]): T[];
  /** Snapshot of the current state — safe to store in RunState. */
  getState(): RngState;
}

// xmur3 string hash — folds a seed string into a well-mixed uint32.
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

// mulberry32 — advances the uint32 state and yields a float in [0, 1).
function advance(state: number): { state: number; value: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { state: next, value };
}

function rngFromState(initial: RngState): Rng {
  const seed = initial.seed;
  let state = initial.state >>> 0;

  const next = (): number => {
    const result = advance(state);
    state = result.state;
    return result.value;
  };

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max <= min) {
      throw new Error(`invalid int range [${min}, ${max})`);
    }
    return min + Math.floor(next() * (max - min));
  };

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('pick from empty array');
      }
      return items[int(0, items.length)];
    },
    shuffle<T>(items: readonly T[]): T[] {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i--) {
        const j = int(0, i + 1);
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    },
    getState(): RngState {
      return { seed, state };
    },
  };
}

export function createRng(seed: string): Rng {
  return rngFromState({ seed, state: hashSeed(seed) });
}

export function restoreRng(state: RngState): Rng {
  return rngFromState(state);
}

/**
 * Independent named sub-stream (e.g. 'map-gen', 'combat', 'surface'). Systems must each
 * consume their own stream so drawing randomness in one cannot desync another — otherwise
 * shareable seeds and daily runs break the moment systems interleave differently.
 */
export function deriveRng(seed: string, label: string): Rng {
  return createRng(`${seed}:${label}`);
}

/**
 * The single place true entropy enters the game. Everything downstream of run start
 * must flow through the seeded generator above.
 */
export function newSeed(): string {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  return Array.from(words, (w) => w.toString(36)).join('-');
}
