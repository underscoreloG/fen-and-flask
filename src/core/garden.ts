// Soil beds (specs/content.md, Garden): plant one owned crop item, harvest more after sleeping.
import { CROPS, type CropDef, type ItemId } from '../data/content';
import type { GameEvent } from './events';
import { spawnDrops } from './pickups';
import type { BedState, GameState } from './state';
import { WORLD_STRUCTURES, type WorldStructure } from './world';

// state.garden[i] belongs to the i-th bed structure in layout order.
const BEDS: readonly WorldStructure[] = WORLD_STRUCTURES.filter((s) => s.def.kind === 'bed');
export const BED_IDS: readonly string[] = BEDS.map((s) => s.def.id);

export function bedIndex(structureId: string): number {
  return BED_IDS.indexOf(structureId);
}

export function createGarden(): BedState[] {
  return BEDS.map(() => ({ crop: null, nightsLeft: 0 }));
}

export function cropDef(item: ItemId): CropDef | undefined {
  return CROPS.find((c) => c.item === item);
}

export function isReady(bed: BedState): boolean {
  return bed.crop !== null && bed.nightsLeft === 0;
}

export interface ReadyBed {
  id: string;
  index: number;
  x: number;
  y: number;
}

// Ready beds as swing targets, positioned at their tile center.
export function readyBeds(state: GameState): ReadyBed[] {
  const out: ReadyBed[] = [];
  state.garden.forEach((b, index) => {
    const s = BEDS[index];
    if (s && isReady(b)) out.push({ id: s.def.id, index, x: s.interactX, y: s.interactY });
  });
  return out;
}

// Rejected (state untouched) unless the bed is the interact target, empty, and the item is a
// crop the player owns.
export function plant(state: GameState, index: number, item: ItemId): void {
  const bed = state.garden[index];
  const def = cropDef(item);
  if (!bed || !def || bed.crop !== null) return;
  if (state.player.interactTarget !== BED_IDS[index]) return;
  if ((state.inventory[item] ?? 0) < 1) return;
  state.inventory[item] -= 1;
  bed.crop = item;
  bed.nightsLeft = def.nights;
}

// The yield pops out on the bed as pickups and the bed is empty again.
export function harvest(state: GameState, index: number, events: GameEvent[]): void {
  const bed = state.garden[index];
  const s = BEDS[index];
  if (!bed || !s || !isReady(bed) || bed.crop === null) return;
  const def = cropDef(bed.crop);
  const item = bed.crop;
  bed.crop = null;
  bed.nightsLeft = 0;
  if (def) spawnDrops(state, item, def.yield, s.interactX, s.interactY, events);
}

// Interact on a bed: empty -> the picker, ready -> harvest, growing -> nothing.
export function interactBed(state: GameState, index: number, events: GameEvent[]): void {
  const bed = state.garden[index];
  if (!bed) return;
  if (bed.crop === null) events.push({ type: 'uiRequest', ui: 'gardenPicker', bed: index });
  else if (isReady(bed)) harvest(state, index, events);
}

export function growNight(state: GameState): void {
  for (const b of state.garden) if (b.crop !== null && b.nightsLeft > 0) b.nightsLeft -= 1;
}
