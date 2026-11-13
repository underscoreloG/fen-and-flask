// The shop (specs/wp/WP06): shelves and prices, customers who browse, react, queue at the counter
// and pay when rung up (or leave without paying), demand and the daily trend; and the land
// purchase its coins pay for. Reaction rules are those of specs/content.md, Stall.
import {
  BREW_RECIPES,
  CAULDRON_FUEL,
  CREATURES,
  GOAL_POTION,
  GRIND_RECIPES,
  ITEM_IDS,
  ITEMS,
  NODES,
  PLOTS,
  SHOP_LAYOUT,
  type ItemId,
  type PotionId,
} from '../data/content';
import { ticks, TUNING } from '../data/tuning';
import { refillCreatures } from './creatures';
import type { GameEvent } from './events';
import { refillPlot } from './nodes';
import { nextInt, nextRange } from './rng';
import type { Facing, GameState } from './state';
import { isShopTileSolid, SHOP_H, SHOP_TX, SHOP_TY, SHOP_W, shopTileCenter, targetStructure, tileAt, WORLD_STRUCTURES } from './world';

const S = TUNING.stall;
const D = TUNING.demand;
const SH = TUNING.shop;

export type Reaction = 'delighted' | 'happy' | 'grumbling' | 'refuses';

export const REACTIONS: readonly Reaction[] = ['delighted', 'happy', 'grumbling', 'refuses'];

export const POTION_IDS: readonly PotionId[] = BREW_RECIPES.map((r) => r.potion);

export const REACT_TICKS = ticks(S.reactionTime);
export const ENTER_GAP_TICKS = ticks(SH.enterGap);
export const PATIENCE_TICKS = ticks(SH.patience);
const STEP = SH.customerSpeed / TUNING.sim.tickRate;

export const SHELVES = WORLD_STRUCTURES.filter((s) => s.def.kind === 'shelf');

export type CustomerMode = 'toShelf' | 'look' | 'toQueue' | 'queued' | 'leaving';

export interface Customer {
  // 0-based within this evening (the renderer picks a look from it).
  n: number;
  // Feet center, world px.
  x: number;
  y: number;
  facing: Facing;
  mode: CustomerMode;
  // Tile centers still to walk through, as shop-local tile indexes (y * width + x).
  path: number[];
  // The shelf it is visiting, or visited.
  shelf: number;
  // Mood, rolled on entry (0.95-1.05).
  personal: number;
  // Ticks into the look.
  t: number;
  // What it looked at, the price it saw and what it thought (null until then).
  item: ItemId | null;
  price: number;
  reaction: Reaction | null;
  // Carrying one unit of `item` to the counter, at `price`, not yet paid.
  holding: boolean;
  // Queue spot index (0 = spot 1), or -1; ticks waited since first reaching a spot, or -1.
  spot: number;
  waited: number;
}

export interface Shelf {
  // null exactly when count is 0.
  item: ItemId | null;
  count: number;
}

export interface HistoryEntry {
  price: number;
  reaction: Reaction;
}

export interface ShopState {
  phase: 'closed' | 'open' | 'done';
  openedToday: boolean;
  shelves: Shelf[];
  prices: Record<ItemId, number>;
  demand: Record<ItemId, number>;
  // Today's in-demand potion; null on day 1.
  trend: PotionId | null;
  // The last historyLength (price, reaction) pairs per item, oldest first.
  history: Record<ItemId, HistoryEntry[]>;
  // Customers still to come in this evening.
  customersLeft: number;
  customers: Customer[];
  sinceEntry: number;
  entered: number;
  // This evening's payments.
  soldCount: number;
  soldCoins: number;
}

const perItem = <T>(f: (i: ItemId) => T): Record<ItemId, T> => Object.fromEntries(ITEM_IDS.map((i) => [i, f(i)])) as Record<ItemId, T>;

export const baseValue = (item: ItemId): number => ITEMS.find((i) => i.id === item)!.value;

// Below the value of every item, so an untouched price always sells on the first evening.
export const firstPrice = (item: ItemId): number => Math.max(S.priceMin, Math.round(S.firstPriceFactor * baseValue(item)));

export function createShop(): ShopState {
  return {
    phase: 'closed',
    openedToday: false,
    shelves: SHELVES.map(() => ({ item: null, count: 0 })),
    prices: perItem(firstPrice),
    demand: perItem(() => D.start),
    trend: null,
    history: perItem(() => []),
    customersLeft: 0,
    customers: [],
    sinceEntry: 0,
    entered: 0,
    soldCount: 0,
    soldCoins: 0,
  };
}

export function shelfIndex(structureId: string): number {
  return SHELVES.findIndex((s) => s.def.id === structureId);
}

export function stockedShelves(state: GameState): number[] {
  return state.shop.shelves.flatMap((s, i) => (s.item !== null ? [i] : []));
}

// What a customer would think one unit is worth today, before their personal mood.
export function itemValue(state: GameState, item: ItemId): number {
  const trend = state.shop.trend === item ? D.trendMultiplier : 1;
  return baseValue(item) * state.shop.demand[item] * trend;
}

export function judge(price: number, value: number): Reaction {
  const r = price / value;
  if (r <= S.delightedMax) return 'delighted';
  if (r <= S.happyMax) return 'happy';
  if (r <= S.grumblingMax) return 'grumbling';
  return 'refuses';
}

// A customer with this personal mood (0.95-1.05) seeing `price` on `item`.
export function reactTo(state: GameState, item: ItemId, price: number, personal: number): { reaction: Reaction; sold: boolean } {
  const reaction = judge(price, itemValue(state, item) * personal);
  return { reaction, sold: reaction !== 'refuses' };
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

const targetKind = (state: GameState): string | undefined => targetStructure(state)?.def.kind;

const targetShelf = (state: GameState): number => {
  const id = state.player.interactTarget;
  return id === null ? -1 : shelfIndex(id);
};

export function stockShelf(state: GameState, shelf: number, item: ItemId, qty: number): void {
  const sl = state.shop.shelves[shelf];
  if (!sl || targetShelf(state) !== shelf || !ITEM_IDS.includes(item)) return;
  if (!Number.isInteger(qty) || qty < 1 || state.inventory[item] < qty) return;
  if ((sl.item !== null && sl.item !== item) || sl.count + qty > SH.shelfCapacity) return;
  state.inventory[item] -= qty;
  sl.item = item;
  sl.count += qty;
}

export function clearShelf(state: GameState, shelf: number): void {
  const sl = state.shop.shelves[shelf];
  if (!sl || targetShelf(state) !== shelf || sl.item === null) return;
  state.inventory[sl.item] += sl.count;
  sl.item = null;
  sl.count = 0;
}

export function setPrice(state: GameState, item: ItemId, price: number): void {
  if (!ITEM_IDS.includes(item) || !Number.isFinite(price) || targetShelf(state) < 0) return;
  state.shop.prices[item] = Math.max(S.priceMin, Math.round(price));
}

export function openShop(state: GameState, events: GameEvent[]): void {
  const sh = state.shop;
  if (state.phase !== 'evening' || sh.phase !== 'closed' || sh.openedToday) return;
  if (targetKind(state) !== 'sign' || stockedShelves(state).length === 0) return;
  sh.phase = 'open';
  sh.openedToday = true;
  sh.soldCount = 0;
  sh.soldCoins = 0;
  sh.customersLeft = customersFor(state);
  sh.customers = [];
  sh.entered = 0;
  // The first customer comes in on the next tick.
  sh.sinceEntry = ENTER_GAP_TICKS;
  events.push({ type: 'stallOpened' });
}

export function closeStall(state: GameState, events: GameEvent[]): void {
  if (targetKind(state) !== 'sign') return;
  closeShop(state, events);
}

// From the sign or a sleep: whoever holds an item pays at once, everyone else heads out.
export function closeShop(state: GameState, events: GameEvent[]): void {
  const sh = state.shop;
  if (sh.phase !== 'open') return;
  for (const c of sh.customers) {
    if (c.holding) pay(state, c, events);
    leave(c);
  }
  finish(state, events);
}

export function ringUp(state: GameState, events: GameEvent[]): void {
  const sh = state.shop;
  if (targetKind(state) !== 'counter') return;
  const c = sh.customers.find((o) => o.spot === 0 && o.mode === 'queued');
  if (!c) return;
  pay(state, c, events);
  leave(c);
  advanceQueue(sh);
}

function finish(state: GameState, events: GameEvent[]): void {
  const sh = state.shop;
  sh.phase = 'done';
  events.push({ type: 'stallClosed', soldCount: sh.soldCount, soldCoins: sh.soldCoins });
}

function pay(state: GameState, c: Customer, events: GameEvent[]): void {
  const sh = state.shop;
  const item = c.item;
  if (!c.holding || item === null) return;
  c.holding = false;
  state.coins += c.price;
  sh.soldCount += 1;
  sh.soldCoins += c.price;
  const drop = D.perSale + (c.reaction === 'grumbling' ? S.grumbleDemandPenalty : 0);
  sh.demand[item] = Math.max(D.floor, sh.demand[item] - drop);
  events.push({ type: 'sale', item, price: c.price });
  if (item === GOAL_POTION && !state.flags.m1Goal) {
    state.flags.m1Goal = true;
    events.push({ type: 'goalReached' });
  }
}

// --- Walking ---------------------------------------------------------------------

const L = SHOP_LAYOUT;
const idx = (t: { x: number; y: number }): number => t.y * SHOP_W + t.x;
// Behind the counter is the shopkeeper's side: the row of its interact tile, from the tile
// before the counter to its end. Customers never walk there.
const COUNTER = WORLD_STRUCTURES.find((s) => s.def.kind === 'counter')!;
const STAFF_Y = tileAt(COUNTER.interactY) - SHOP_TY;
const STAFF_X0 = COUNTER.def.tiles.x - 1;
const STAFF_X1 = COUNTER.def.tiles.x + COUNTER.def.tiles.w - 1;
const customerBlocked = (x: number, y: number): boolean => isShopTileSolid(x, y) || (y === STAFF_Y && x >= STAFF_X0 && x <= STAFF_X1);
const SHELF_SPOTS = SHELVES.map((s) => ({ x: tileAt(s.interactX) - SHOP_TX, y: tileAt(s.interactY) - SHOP_TY }));
const QUEUE_SPOTS = L.queue;

// Shortest 4-connected path over the customers' floor, from tile a (excluded) to tile b, as
// shop-local tile indexes.
export function pathBetween(a: number, b: number): number[] {
  const parent = new Int16Array(SHOP_W * SHOP_H).fill(-1);
  parent[a] = a;
  const queue = [a];
  for (let head = 0; head < queue.length && parent[b] === -1; head++) {
    const i = queue[head]!;
    const x = i % SHOP_W;
    const next = [i - SHOP_W, i + SHOP_W, x > 0 ? i - 1 : -1, x < SHOP_W - 1 ? i + 1 : -1];
    for (const j of next) {
      if (j < 0 || j >= SHOP_W * SHOP_H || parent[j] !== -1 || customerBlocked(j % SHOP_W, Math.floor(j / SHOP_W))) continue;
      parent[j] = i;
      queue.push(j);
    }
  }
  const out: number[] = [];
  for (let i = b; i !== a && parent[i] !== -1; i = parent[i]!) out.push(i);
  return out.reverse();
}

// Walks on from the tile center it is heading for (or stands on), so a re-route mid-step stays on
// the grid's axis lines.
function routeTo(c: Customer, goal: { x: number; y: number }): void {
  const here = c.path[0] ?? (tileAt(c.y) - SHOP_TY) * SHOP_W + tileAt(c.x) - SHOP_TX;
  const rest = pathBetween(here, idx(goal));
  c.path = c.path.length > 0 ? [here, ...rest] : rest;
}

// One tick along the path; true once the path is done.
function walk(c: Customer): boolean {
  const next = c.path[0];
  if (next === undefined) return true;
  const to = shopTileCenter(next % SHOP_W, Math.floor(next / SHOP_W));
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  if (dx !== 0 || dy !== 0) c.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  const d = Math.hypot(dx, dy);
  if (d <= STEP) {
    c.x = to.x;
    c.y = to.y;
    c.path.shift();
  } else {
    c.x += (dx / d) * STEP;
    c.y += (dy / d) * STEP;
  }
  return c.path.length === 0;
}

function leave(c: Customer): void {
  c.mode = 'leaving';
  c.spot = -1;
  routeTo(c, L.entry);
}

// When spot 1 frees up, whoever holds spot 2 steps forward (still counting their patience).
function advanceQueue(sh: ShopState): void {
  if (sh.customers.some((o) => o.spot === 0)) return;
  const c = sh.customers.find((o) => o.spot === 1);
  if (!c) return;
  c.spot = 0;
  c.mode = 'toQueue';
  routeTo(c, QUEUE_SPOTS[0]!);
}

function goToShelf(state: GameState, c: Customer): boolean {
  const stocked = stockedShelves(state);
  if (stocked.length === 0) return false;
  c.shelf = stocked[nextInt(state, 0, stocked.length - 1)]!;
  c.mode = 'toShelf';
  routeTo(c, SHELF_SPOTS[c.shelf]!);
  return true;
}

function enter(state: GameState): void {
  const sh = state.shop;
  const at = shopTileCenter(L.entry.x, L.entry.y);
  const c: Customer = {
    n: sh.entered,
    x: at.x,
    y: at.y,
    facing: 'up',
    mode: 'toShelf',
    path: [],
    shelf: 0,
    personal: 1,
    t: 0,
    item: null,
    price: 0,
    reaction: null,
    holding: false,
    spot: -1,
    waited: -1,
  };
  goToShelf(state, c);
  c.personal = nextRange(state, S.personalMin, S.personalMax);
  sh.customers.push(c);
  sh.entered += 1;
  sh.customersLeft -= 1;
  sh.sinceEntry = 0;
}

// At the shelf: an empty one sends it to another stocked shelf (or out); otherwise it reacts to the
// price, and on a sale takes one unit at once (the price is fixed now, the payment comes later).
function arriveAtShelf(state: GameState, c: Customer, events: GameEvent[]): void {
  const sh = state.shop;
  const shelf = sh.shelves[c.shelf]!;
  const item = shelf.item;
  if (item === null) {
    if (!goToShelf(state, c)) leave(c);
    return;
  }
  const price = sh.prices[item];
  const { reaction, sold } = reactTo(state, item, price, c.personal);
  events.push({ type: 'customerArrived', item });
  events.push({ type: 'customerReacted', item, price, reaction, sold });
  const h = sh.history[item];
  h.push({ price, reaction });
  if (h.length > TUNING.notebook.historyLength) h.shift();
  Object.assign(c, { mode: 'look', t: 0, facing: 'up', item, price, reaction });
  if (!sold) return;
  c.holding = true;
  shelf.count -= 1;
  if (shelf.count === 0) shelf.item = null;
}

// Out of patience: the unit goes back on its shelf if it fits there, else to the player.
function leaveUnpaid(state: GameState, c: Customer, events: GameEvent[]): void {
  const item = c.item!;
  const shelf = state.shop.shelves[c.shelf]!;
  if (shelf.item === null || (shelf.item === item && shelf.count < SH.shelfCapacity)) {
    shelf.item = item;
    shelf.count += 1;
  } else {
    state.inventory[item] += 1;
  }
  c.holding = false;
  events.push({ type: 'customerLeftUnpaid', item });
  leave(c);
  advanceQueue(state.shop);
}

function stepCustomer(state: GameState, c: Customer, events: GameEvent[]): void {
  if (c.holding && c.waited >= 0) {
    c.waited += 1;
    if (c.waited >= PATIENCE_TICKS) {
      leaveUnpaid(state, c, events);
      return;
    }
  }
  switch (c.mode) {
    case 'toShelf':
      if (walk(c)) arriveAtShelf(state, c, events);
      break;
    case 'look':
      c.t += 1;
      if (c.t < REACT_TICKS) break;
      if (!c.holding) {
        leave(c);
        break;
      }
      c.spot = state.shop.customers.some((o) => o !== c && o.spot === 0) ? 1 : 0;
      c.mode = 'toQueue';
      routeTo(c, QUEUE_SPOTS[c.spot]!);
      break;
    case 'toQueue':
      if (!walk(c)) break;
      c.mode = 'queued';
      c.facing = 'up';
      if (c.waited < 0) {
        c.waited = 0;
        events.push({ type: 'customerQueued', item: c.item! });
      }
      break;
    case 'queued':
      break;
    case 'leaving':
      walk(c);
      break;
  }
}

// Runs every tick: customers move whatever the phase (they finish walking out after closing);
// while open, a new one comes in when there is room, and the evening ends when nobody is left to
// come and nobody is inside, or when the shelves are bare and nobody is still buying.
export function updateShop(state: GameState, events: GameEvent[]): void {
  const sh = state.shop;
  for (const c of [...sh.customers]) stepCustomer(state, c, events);
  sh.customers = sh.customers.filter((c) => c.mode !== 'leaving' || c.path.length > 0);
  if (sh.phase !== 'open') return;
  sh.sinceEntry += 1;
  const stocked = stockedShelves(state).length > 0;
  if (sh.customersLeft > 0 && stocked && sh.customers.length < SH.maxIndoors && sh.sinceEntry >= ENTER_GAP_TICKS) enter(state);
  const buying = sh.customers.some((c) => c.mode !== 'leaving');
  if ((sh.customersLeft === 0 && sh.customers.length === 0) || (!stocked && !buying)) finish(state, events);
}

// Morning reset step 6: demand recovers, a new trend, the shop is ready again. Shelves keep their stock.
export function morningShop(state: GameState): void {
  const sh = state.shop;
  for (const i of ITEM_IDS) sh.demand[i] = Math.min(D.cap, sh.demand[i] + D.perNight);
  const pool = trendCandidates(state);
  sh.trend = pool.length > 0 ? pool[nextInt(state, 0, pool.length - 1)]! : null;
  sh.phase = 'closed';
  sh.openedToday = false;
  sh.customers = [];
  sh.customersLeft = 0;
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
