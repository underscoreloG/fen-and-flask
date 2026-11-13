// localStorage save (specs/content.md, Save): the whole GameState plus the game version.
// Called from the render side only; ?nosave=1 is checked by the callers.
import type { GameState } from '../core/state';
import { createStations } from '../core/stations';
import { SAVE_KEY } from '../data/content';
import { APP_VERSION } from '../data/version';

interface SaveFile {
  version: string;
  state: GameState;
}

const majorMinor = (v: string): string => v.split('.').slice(0, 2).join('.');

export function serialize(state: GameState, version: string): string {
  const file: SaveFile = { version, state };
  return JSON.stringify(file);
}

// null on bad JSON, a wrong shape, or a save whose major.minor differs from `version`.
export function deserialize(json: string, version: string): GameState | null {
  let file: unknown;
  try {
    file = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof file !== 'object' || file === null) return null;
  const f = file as Partial<SaveFile>;
  if (typeof f.version !== 'string' || typeof f.state !== 'object' || f.state === null) return null;
  if (majorMinor(f.version) !== majorMinor(version)) return null;
  return withDefaults(f.state);
}

// Fields added after a save was written (same major.minor) get their new-game value, in place so
// the key order of an up-to-date save is untouched.
function withDefaults(state: GameState): GameState {
  const s = state as Partial<GameState>;
  if (s.stations === undefined) s.stations = createStations();
  return state;
}

// Private mode or blocked storage must never break the game: every access is guarded.
export function load(): GameState | null {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    return json === null ? null : deserialize(json, APP_VERSION);
  } catch {
    return null;
  }
}

export function store(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(state, APP_VERSION));
  } catch {
    // Storage full or blocked: the game goes on unsaved.
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
