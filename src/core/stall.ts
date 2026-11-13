// The evening stall (specs/content.md, Stall): prices, travellers and their reactions, demand,
// the daily trend; and the land purchase its coins pay for (Economy and goal).
import {
  BREW_RECIPES,
  CAULDRON_FUEL,
  CREATURES,
  GOAL_POTION,
  GRIND_RECIPES,
  NODES,
  PLOTS,
  type ItemId,
  type PotionId,
} from '../data/content';
import { ticks, TUNING } from '../data/tuning';
import { refillCreatures } from './creatures';
import type { GameEvent } from './events';
import { refillPlot } from './nodes';
import { nextInt, nextRange } from './rng';
import type { GameState } from './state';
import { targetStructure, WORLD_STRUCTURES } from './world';

const S = TUNING.stall;
const D = TUNING.demand;

export type Reaction = 'delighted' | 'happy' | 'grumbling' | 'refuses';

export const REACTIONS: readonly Reaction[] = ['delighted', 'happy', 'grumbling', 'refuses'];

export const POTION_IDS: readonly PotionId[] = BREW_RECIPES.map((r) => r.potion);

// Customer timing in ticks: walk in, then the reaction; the walk out overlaps the next walk in.
export const WALK_TICKS = ticks(S.walkIn);
export const REACT_TICKS = ticks(S.reactionTime);

export interface Customer {
  // 0-based within this evening (the renderer picks a look from it).
  n: number;
  // Ticks since this customer started walking in.
  t: number;
  // Filled in on arrival at the spot.
  potion: PotionId | null;
  price: number;
  reaction: Reaction | null;
  sold: boolean;
}

export interface HistoryEntry {
  price: number;
  reaction: Reaction;
}

export interface StallState {
  // The setup screen is UI only: phase stays closed until OpenStall.
  phase: 'closed' | 'open' | 'done';
  openedToday: boolean;
  prices: Record<PotionId, number>;
  demand: Record<PotionId, number>;
  // Today's in-demand potion; null on day 1.
  trend: PotionId | null;
  // The last historyLength (price, reaction) pairs per potion, oldest first.
  history: Record<PotionId, HistoryEntry[]>;
  // Customers still to come after the current one.
  customersLeft: number;
  customer: Customer | null;
  // This evening's totals.
  soldCount: number;
  soldCoins: number;
}

const perPotion = <T>(f: (p: PotionId) => T): Record<PotionId, T> =>
  Object.fromEntries(POTION_IDS.map((p) => [p, f(p)])) as Record<PotionId, T>;

const baseValue = (p: PotionId): number => BREW_RECIPES.find((r) => r.potion === p)!.baseValue;

// First-ever price of every potion is round(0.7 x base); prices then persist across days.
export function createStall(): StallState {
  return {
    phase: 'closed',
    openedToday: false,
    prices: perPotion((p) => Math.round(S.firstPriceFactor * baseValue(p))),
    demand: perPotion(() => D.start),
    trend: null,
    history: perPotion(() => []),
    customersLeft: 0,
    customer: null,
    soldCount: 0,
    soldCoins: 0,
  };
}

export const STALL = WORLD_STRUCTURES.find((s) => s.def.kind === 'stall')!;

// What a traveller would think the potion is worth today, before their personal mood.
export function potionValue(state: GameState, potion: PotionId): number {
  const trend = state.stall.trend === potion ? D.trendMultiplier : 1;
  return baseValue(potion) * state.stall.demand[potion] * trend;
}

export function judge(price: number, value: number): Reaction {
  const r = price / value;
  if (r <= S.delightedMax) return 'delighted';
  if (r <= S.happyMax) return 'happy';
  if (r <= S.grumblingMax) return 'grumbling';
  return 'refuses';
}

// A traveller with this personal mood (0.95-1.05) seeing `price` on `potion`.
export function reactTo(state: GameState, potion: PotionId, price: number, personal: number): { reaction: Reaction; sold: boolean } {
  const reaction = judge(price, potionValue(state, potion) * personal);
  return { reaction, sold: reaction !== 'refuses' };
}

export function potionsInStock(state: GameState): PotionId[] {
  return POTION_IDS.filter((p) => state.inventory[p] > 0);
}

export function customersFor(state: GameState): number {
  const owned = state.plots.filter((p) => p.owned).length;
  return S.customersBase + S.customersPerExtraPlot * Math.max(0, owned - 1);
}

// Potions whose every input (and the cauldron's fuel) can be gathered on owned plots.
export function trendCandidates(state: GameState): PotionId[] {
  const owned = PLOTS.filter((_, i) => state.plots[i]?.owned).map((p) => p.id);
  const have = new Set<ItemId>();
  for (const n of NODES) if (owned.some((id) => n.targets[id] > 0)) have.add(n.drop.item);
  for (const c of CREATURES) if (owned.some((id) => c.counts[id] > 0)) have.add(c.drop.item);
  for (const g of GRIND_RECIPES) if (have.has(g.input)) have.add(g.output);
  if (!have.has(CAULDRON_FUEL)) return [];
  return BREW_RECIPES.filter((r) => r.ingredients.every((i) => have.has(i.item))).map((r) => r.potion);
}

// --- Commands ----------------------------------------------------------------

const atStall = (state: GameState): boolean => targetStructure(state)?.def.kind === 'stall';

export function setPrice(state: GameState, potion: PotionId, price: number): void {
  const st = state.stall;
  if (!POTION_IDS.includes(potion) || !Number.isFinite(price)) return;
  if (st.phase !== 'open' && !atStall(state)) return;
  st.prices[potion] = Math.max(S.priceMin, Math.round(price));
}

export function openStall(state: GameState, events: GameEvent[]): void {
  const st = state.stall;
  if (state.phase !== 'evening' || st.phase !== 'closed' || st.openedToday) return;
  if (potionsInStock(state).length === 0 || !atStall(state)) return;
  st.phase = 'open';
  st.openedToday = true;
  st.soldCount = 0;
  st.soldCoins = 0;
  st.customersLeft = customersFor(state);
  // Held behind the counter: placed, still, and out of any knockback.
  const p = state.player;
  p.x = STALL.interactX;
  p.y = STALL.interactY;
  p.facing = 'down';
  p.moving = false;
  p.knockTicks = 0;
  p.knockX = 0;
  p.knockY = 0;
  events.push({ type: 'stallOpened' });
  nextCustomer(state, 0);
}

export function closeStall(state: GameState, events: GameEvent[]): void {
  const st = state.stall;
  if (st.phase !== 'open') return;
  st.phase = 'done';
  st.customer = null;
  events.push({ type: 'stallClosed', soldCount: st.soldCount, soldCoins: st.soldCoins });
}

function nextCustomer(state: GameState, n: number): void {
  const st = state.stall;
  st.customersLeft -= 1;
  st.customer = { n, t: 0, potion: null, price: 0, reaction: null, sold: false };
}

// --- The customer cycle --------------------------------------------------------

// Runs every tick while open: walk in, arrive and react, then the next one or the end.
export function updateStall(state: GameState, events: GameEvent[]): void {
  const st = state.stall;
  const c = st.customer;
  if (st.phase !== 'open' || !c) return;
  c.t += 1;
  if (c.t === WALK_TICKS) {
    arrive(state, c, events);
    return;
  }
  if (c.t < WALK_TICKS + REACT_TICKS) return;
  if (st.customersLeft > 0 && potionsInStock(state).length > 0) nextCustomer(state, c.n + 1);
  else closeStall(state, events);
}

function arrive(state: GameState, c: Customer, events: GameEvent[]): void {
  const st = state.stall;
  const stock = potionsInStock(state);
  if (stock.length === 0) {
    closeStall(state, events);
    return;
  }
  const potion = stock[nextInt(state, 0, stock.length - 1)]!;
  const price = st.prices[potion];
  const { reaction, sold } = reactTo(state, potion, price, nextRange(state, S.personalMin, S.personalMax));
  Object.assign(c, { potion, price, reaction, sold });
  events.push({ type: 'customerArrived', potion });
  events.push({ type: 'customerReacted', potion, price, reaction, sold });
  const h = st.history[potion];
  h.push({ price, reaction });
  if (h.length > TUNING.notebook.historyLength) h.shift();
  if (!sold) return;
  state.inventory[potion] -= 1;
  state.coins += price;
  st.soldCount += 1;
  st.soldCoins += price;
  const drop = D.perSale + (reaction === 'grumbling' ? S.grumbleDemandPenalty : 0);
  st.demand[potion] = Math.max(D.floor, st.demand[potion] - drop);
  events.push({ type: 'sale', potion, price });
  if (potion === GOAL_POTION && !state.flags.m1Goal) {
    state.flags.m1Goal = true;
    events.push({ type: 'goalReached' });
  }
}

// Morning reset step 6: demand recovers, a new trend, the stall is ready again.
export function morningStall(state: GameState): void {
  const st = state.stall;
  for (const p of POTION_IDS) st.demand[p] = Math.min(D.cap, st.demand[p] + D.perNight);
  const pool = trendCandidates(state);
  st.trend = pool.length > 0 ? pool[nextInt(state, 0, pool.length - 1)]! : null;
  st.phase = 'closed';
  st.openedToday = false;
  st.customer = null;
  st.customersLeft = 0;
}

// --- Land ------------------------------------------------------------------------

// At the signpost that sells `plot`, with its price in coins: the plot is owned and filled at once.
export function buyPlot(state: GameState, plot: number, events: GameEvent[]): void {
  const def = PLOTS[plot];
  const ps = state.plots[plot];
  if (!def || !ps || ps.owned || state.coins < def.price) return;
  if (targetStructure(state)?.def.sells !== def.id) return;
  state.coins -= def.price;
  // Owned first: spawn tiles must read as grass, not as a locked plot.
  ps.owned = true;
  refillPlot(state, plot);
  refillCreatures(state, plot);
  events.push({ type: 'plotBought', plot });
}
