// localStorage save (specs/content.md, Save): the whole GameState plus the game version.
// Called from the render side only; ?nosave=1 is checked by the callers.
import { createInitialState, type GameState } from '../core/state';
import { SAVE_KEY } from '../data/content';
import { APP_VERSION } from '../data/version';

interface SaveFile {
  version: string;
  state: GameState;
}

const majorMinor = (v: string): string => v.split('.').slice(0, 2).join('.');

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// A save from an earlier patch of this minor may lack fields added since: each key missing from
// `loaded` is copied from `fresh`, recursing only where both sides are plain objects. null,
// arrays and scalars stay as loaded (5 loaded shelves stay 5); fields added later to array
// elements are read with a default in code instead.
export function fillDefaults(loaded: Record<string, unknown>, fresh: Record<string, unknown>): void {
  for (const key of Object.keys(fresh)) {
    if (!(key in loaded)) loaded[key] = fresh[key];
    else if (isPlainObject(loaded[key]) && isPlainObject(fresh[key])) fillDefaults(loaded[key], fresh[key]);
  }
}

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
  // A 0.1.x save (outdoor stall) is never migrated: the rule above turns it away.
  if (majorMinor(f.version) !== majorMinor(version)) return null;
  const seed = typeof f.state.seed === 'number' ? f.state.seed : 1;
  fillDefaults(f.state as unknown as Record<string, unknown>, createInitialState(seed) as unknown as Record<string, unknown>);
  return f.state;
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
