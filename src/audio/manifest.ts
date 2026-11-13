// Sounds (specs/design.md Sounds): one entry per file in public/audio, its base volume (the files
// differ in loudness; these even them out, tune by ear) and the core events that trigger it.
// ui_move and ui_confirm come from the panels, marsh_ambience loops in the world.
import type { GameEvent } from '../core/events';
import type { NodeId } from '../data/content';

export type SoundId =
  | 'swing'
  | 'hit_plant'
  | 'hit_wood'
  | 'squish'
  | 'pickup'
  | 'grind'
  | 'bubble'
  | 'potion_done'
  | 'coin'
  | 'refuse'
  | 'bell'
  | 'hurt'
  | 'sleep'
  | 'ui_move'
  | 'ui_confirm'
  | 'marsh_ambience';

type EventOf<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;

// An event type, optionally narrowed by its payload; volume overrides the sound's base volume.
export type Trigger = { [T in GameEvent['type']]: { event: T; when?: (e: EventOf<T>) => boolean; volume?: number } }[GameEvent['type']];

export interface SoundDef {
  id: SoundId;
  file: string;
  volume: number;
  loop?: boolean;
  on: readonly Trigger[];
}

const PLANTS: readonly NodeId[] = ['mintbush', 'glowcaps', 'reedclump', 'emberplant'];

export const SOUNDS: readonly SoundDef[] = [
  { id: 'swing', file: 'swing.ogg', volume: 0.8, on: [{ event: 'swing' }] },
  { id: 'hit_plant', file: 'hit_plant.ogg', volume: 0.6, on: [{ event: 'nodeHit', when: (e) => PLANTS.includes(e.nodeType) }] },
  { id: 'hit_wood', file: 'hit_wood.ogg', volume: 0.45, on: [{ event: 'nodeHit', when: (e) => e.nodeType === 'stump' }] },
  { id: 'squish', file: 'squish.ogg', volume: 1.0, on: [{ event: 'creatureHit' }, { event: 'creatureDied' }] },
  { id: 'pickup', file: 'pickup.ogg', volume: 0.5, on: [{ event: 'pickupCollected' }] },
  { id: 'grind', file: 'grind.ogg', volume: 0.9, on: [{ event: 'jobStarted', when: (e) => e.station === 'mortar' }] },
  { id: 'bubble', file: 'bubble.ogg', volume: 0.6, on: [{ event: 'jobStarted', when: (e) => e.station === 'cauldron' }] },
  { id: 'potion_done', file: 'potion_done.ogg', volume: 0.8, on: [{ event: 'jobUnitDone', when: (e) => e.station === 'cauldron' }] },
  { id: 'coin', file: 'coin.ogg', volume: 1.0, on: [{ event: 'sale' }] },
  {
    id: 'refuse',
    file: 'refuse.ogg',
    volume: 0.4,
    on: [{ event: 'customerReacted', when: (e) => e.reaction === 'refuses' }, { event: 'customerLeftUnpaid' }],
  },
  // A softer ring each time a customer reaches the counter.
  { id: 'bell', file: 'bell.ogg', volume: 1.0, on: [{ event: 'stallOpened' }, { event: 'customerQueued', volume: 0.4 }] },
  { id: 'hurt', file: 'hurt.ogg', volume: 0.45, on: [{ event: 'playerHurt' }] },
  { id: 'sleep', file: 'sleep.ogg', volume: 0.6, on: [{ event: 'morning' }] },
  { id: 'ui_move', file: 'ui_move.ogg', volume: 0.4, on: [] },
  { id: 'ui_confirm', file: 'ui_confirm.ogg', volume: 0.5, on: [] },
  { id: 'marsh_ambience', file: 'marsh_ambience.ogg', volume: 0.25, loop: true, on: [] },
];

const matches = (t: Trigger, e: GameEvent): boolean =>
  t.event === e.type && (t.when === undefined || (t.when as (x: GameEvent) => boolean)(e));

export interface Play {
  id: SoundId;
  volume: number;
}

// The sounds one core event plays, at their volume (empty for events without a sound).
export function soundsFor(e: GameEvent): Play[] {
  return SOUNDS.flatMap((s) => {
    const t = s.on.find((x) => matches(x, e));
    return t ? [{ id: s.id, volume: t.volume ?? s.volume }] : [];
  });
}

// At most one play of the same id per gapMs; a dropped play does not push the window.
export function createLimiter(gapMs: number): (id: SoundId, nowMs: number) => boolean {
  const last = new Map<SoundId, number>();
  return (id, nowMs) => {
    const t = last.get(id);
    if (t !== undefined && nowMs - t < gapMs) return false;
    last.set(id, nowMs);
    return true;
  };
}
