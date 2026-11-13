// The daily order (specs/wp/WP09): each morning a note on the board asks for qty of one potion the
// player can brew now, for 1.5 times their base value. Delivered from the inventory at the board;
// it does not touch demand, history or the evening's sold counters. Plus the M2 goal check.
import { CATALOG, type PotionId } from '../data/content';
import { TUNING } from '../data/tuning';
import { owns } from './catalog';
import type { GameEvent } from './events';
import { nextInt } from './rng';
import { baseValue, POTION_IDS, reachM1Goal, trendCandidates } from './shop';
import type { GameState } from './state';
import { targetStructure } from './world';

const O = TUNING.orders;

export interface Order {
  item: PotionId;
  qty: number;
  pay: number;
  done: boolean;
}

// The item is uniform among the potions brewable now (the trend's rule), then the quantity.
export function drawOrder(state: GameState): Order {
  const pool = trendCandidates(state);
  const item = pool.length > 0 ? pool[nextInt(state, 0, pool.length - 1)]! : POTION_IDS[0]!;
  const qty = nextInt(state, O.qtyMin, state.day === 1 ? O.qtyMaxDay1 : O.qtyMax);
  return { item, qty, pay: Math.round(O.payFactor * baseValue(item) * qty), done: false };
}

// Morning reset step 12: a new order replaces today's, done or not (nothing was taken for it).
export function postOrder(state: GameState, events: GameEvent[]): void {
  state.order = drawOrder(state);
  const { item, qty, pay } = state.order;
  events.push({ type: 'orderPosted', item, qty, pay });
}

// At the board, not done yet, with qty of the potion in the inventory (tables do not count).
export function deliverOrder(state: GameState, events: GameEvent[]): void {
  const o = state.order;
  if (targetStructure(state)?.def.kind !== 'board' || o.done || state.inventory[o.item] < o.qty) return;
  state.inventory[o.item] -= o.qty;
  state.coins += o.pay;
  o.done = true;
  events.push({ type: 'orderDelivered', item: o.item, qty: o.qty, pay: o.pay });
  reachM1Goal(state, o.item, events);
}

// Morning reset step 13: the first morning every catalog item is owned (once per game).
export function checkM2Goal(state: GameState, events: GameEvent[]): void {
  if (state.flags.m2Goal || !CATALOG.every((d) => owns(state, d.id))) return;
  state.flags.m2Goal = true;
  events.push({ type: 'm2GoalReached' });
}
