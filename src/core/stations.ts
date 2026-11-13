// Mortar and cauldrons (specs/content.md, Stations; the second cauldron and the stone mortar from
// specs/wp/WP07): one background job per station; each unit pops out as a pickup on the tile below
// the station. A station is named by its structure id.
import {
  BREW_RECIPES,
  CAULDRON_FUEL,
  GRIND_RECIPES,
  type BrewRecipe,
  type GrindRecipe,
  type ItemId,
  type PotionId,
} from '../data/content';
import { ticks, TUNING } from '../data/tuning';
import type { GameEvent } from './events';
import { spawnPickup } from './pickups';
import type { GameState } from './state';
import { structureById, targetStructure, type WorldStructure } from './world';

export type StationKind = 'mortar' | 'cauldron' | 'cauldron2';

export const STATION_KINDS: readonly StationKind[] = ['mortar', 'cauldron', 'cauldron2'];

export interface Job {
  // The output item: a ground item at the mortar, a potion at the cauldron.
  recipe: ItemId;
  // Units still to come.
  remaining: number;
  // Ticks into the current unit.
  progress: number;
}

export type Stations = Record<StationKind, Job | null>;

export function createStations(): Stations {
  return { mortar: null, cauldron: null, cauldron2: null };
}

export const UNIT_TICKS: Readonly<Record<StationKind, number>> = {
  mortar: ticks(TUNING.mortar.secondsPerUnit),
  cauldron: ticks(TUNING.cauldron.secondsPerPotion),
  cauldron2: ticks(TUNING.cauldron.secondsPerPotion),
};
const STONE_TICKS = ticks(TUNING.mortar.stoneSecondsPerUnit);

// Ticks per unit right now. The stone mortar only arrives at a morning reset, after every job has
// finished, so a unit never changes speed halfway.
export function unitTicks(state: GameState, kind: StationKind): number {
  return kind === 'mortar' && state.catalog.owned.includes('stoneMortar') ? STONE_TICKS : UNIT_TICKS[kind];
}

const C = TUNING.cauldron;

// All stand in the shop's back room.
export const STATION_STRUCTURES: Readonly<Record<StationKind, WorldStructure>> = {
  mortar: structureById('mortar')!,
  cauldron: structureById('cauldron')!,
  cauldron2: structureById('cauldron2')!,
};

export const isCauldron = (kind: StationKind): boolean => STATION_STRUCTURES[kind].def.kind === 'cauldron';

// The station the player targets, if any.
function targetStation(state: GameState): StationKind | null {
  const id = targetStructure(state)?.def.id;
  return STATION_KINDS.find((k) => k === id) ?? null;
}

export function grindRecipe(input: ItemId): GrindRecipe | undefined {
  return GRIND_RECIPES.find((r) => r.input === input);
}

export function brewRecipe(potion: PotionId): BrewRecipe | undefined {
  return BREW_RECIPES.find((r) => r.potion === potion);
}

// Largest quantity a Start command may ask for right now (0 = cannot start).
export function maxGrind(state: GameState, r: GrindRecipe): number {
  return state.inventory[r.input] ?? 0;
}

export function maxBrew(state: GameState, r: BrewRecipe): number {
  if ((state.inventory[CAULDRON_FUEL] ?? 0) < C.fuelPerJob) return 0;
  let n: number = C.maxQuantity;
  for (const ing of r.ingredients) n = Math.min(n, Math.floor((state.inventory[ing.item] ?? 0) / ing.n));
  return n;
}

function canStart(state: GameState, kind: StationKind, qty: number, max: number): boolean {
  return Number.isInteger(qty) && qty >= 1 && qty <= max && state.stations[kind] === null;
}

function startJob(state: GameState, kind: StationKind, item: ItemId, qty: number, events: GameEvent[]): void {
  state.stations[kind] = { recipe: item, remaining: qty, progress: 0 };
  events.push({ type: 'jobStarted', station: kind, item, qty });
}

// Rejected (state untouched) unless the mortar is the interact target and free, and qty is 1 to owned.
export function startGrind(state: GameState, input: ItemId, qty: number, events: GameEvent[]): void {
  const r = grindRecipe(input);
  if (!r || targetStation(state) !== 'mortar' || !canStart(state, 'mortar', qty, maxGrind(state, r))) return;
  state.inventory[r.input] -= qty;
  startJob(state, 'mortar', r.output, qty, events);
}

// Rejected unless a cauldron is the interact target and free, and qty is 1 to min(5, what the
// ingredients allow) with the job's bogwood in hand. All inputs leave at once.
export function startBrew(state: GameState, potion: PotionId, qty: number, events: GameEvent[]): void {
  const r = brewRecipe(potion);
  const kind = targetStation(state);
  if (!r || kind === null || !isCauldron(kind) || !canStart(state, kind, qty, maxBrew(state, r))) return;
  for (const ing of r.ingredients) state.inventory[ing.item] -= ing.n * qty;
  state.inventory[CAULDRON_FUEL] -= C.fuelPerJob;
  startJob(state, kind, r.potion, qty, events);
}

// Stop (specs/wp/WP10): rejected unless the targeted station has a job. The inputs of every unit
// not yet out come back, the one in progress included; the job's bogwood is burnt. Units already
// out stay where they are.
export function cancelJob(state: GameState, events: GameEvent[]): void {
  const kind = targetStation(state);
  const job = kind === null ? null : state.stations[kind];
  if (kind === null || !job) return;
  const inputs = isCauldron(kind)
    ? brewRecipe(job.recipe as PotionId)!.ingredients
    : [{ item: GRIND_RECIPES.find((r) => r.output === job.recipe)!.input, n: 1 }];
  for (const ing of inputs) state.inventory[ing.item] += ing.n * job.remaining;
  state.stations[kind] = null;
  events.push({ type: 'jobCancelled', station: kind, item: job.recipe, refunded: job.remaining });
}

// One unit out: an indoor pickup on the station's interact tile, arcing from the station itself.
function produce(state: GameState, kind: StationKind, job: Job, events: GameEvent[]): void {
  const s = STATION_STRUCTURES[kind];
  job.remaining -= 1;
  job.progress = 0;
  events.push({ type: 'jobUnitDone', station: kind, item: job.recipe });
  spawnPickup(state, job.recipe, 'shop', s.interactX, s.interactY, s.x + s.w / 2, s.y + s.h / 2, events);
  if (job.remaining > 0) return;
  state.stations[kind] = null;
  events.push({ type: 'jobFinished', station: kind });
}

// Runs before commands in a tick, so a job started on tick T yields its first unit on T + UNIT_TICKS.
export function updateStations(state: GameState, events: GameEvent[]): void {
  for (const kind of STATION_KINDS) {
    const job = state.stations[kind];
    if (!job) continue;
    job.progress += 1;
    if (job.progress >= unitTicks(state, kind)) produce(state, kind, job, events);
  }
}

// Morning reset: every running job finishes at once and drops what it still owed.
export function finishJobs(state: GameState, events: GameEvent[]): void {
  for (const kind of STATION_KINDS) {
    let job = state.stations[kind];
    while (job) {
      produce(state, kind, job, events);
      job = state.stations[kind];
    }
  }
}
