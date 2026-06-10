import type { RunState } from './sim/run-state';
import { deserializeRunState, serializeRunState } from './sim/run-state';

/**
 * Persistence lives here, one level above sim/, behind an injected backend: the browser
 * passes window.localStorage, tests pass an in-memory map, and Phase 7 swaps in a
 * Supabase-backed implementation without touching callers (roadmap 7.1).
 */

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveStore {
  save(state: RunState): void;
  /** Null when no save exists or the stored payload is corrupt — never throws. */
  load(): RunState | null;
  clear(): void;
}

const SAVE_KEY = 'pixel-horizons:run';

export function createSaveStore(storage: StringStorage): SaveStore {
  return {
    save(state: RunState): void {
      storage.setItem(SAVE_KEY, serializeRunState(state));
    },
    load(): RunState | null {
      const raw = storage.getItem(SAVE_KEY);
      return raw === null ? null : deserializeRunState(raw);
    },
    clear(): void {
      storage.removeItem(SAVE_KEY);
    },
  };
}
