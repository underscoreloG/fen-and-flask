// Helper toads (specs/wp/WP08), bought from the catalog: the counter toad rings up a customer who
// has waited long enough (shop.ts asks counterDelay), the garden toad harvests and replants ready
// beds at morning reset step 6, the basket toad brings ingredients at step 9. Nothing here
// imports shop.ts: shop.ts reads this module.
import { NODES, PLOTS, type ItemId } from '../data/content';
import { ticks, TUNING } from '../data/tuning';
import { owns } from './catalog';
import type { GameEvent } from './events';
import { cropDef, isReady } from './garden';
import { nextInt } from './rng';
import type { GameState } from './state';

const H = TUNING.helpers;
const DELAY = ticks(H.counterDelay);
const DELAY_TRAINED = ticks(H.counterDelayTrained);

// Ticks a customer waits at spot 1 before the counter toad rings it up; null without one.
export function counterDelay(state: GameState): number | null {
  if (owns(state, 'counterToad2')) return DELAY_TRAINED;
  return owns(state, 'counterToad') ? DELAY : null;
}

// Step 6: each ready bed's yield goes to the inventory, then the bed is planted again with the
// same crop from it (every yield is at least 2, so the seed is always there).
export function gardenToad(state: GameState, events: GameEvent[]): void {
  if (!owns(state, 'gardenToad')) return;
  let harvested = 0;
  for (const bed of state.garden) {
    const def = bed.crop === null ? undefined : cropDef(bed.crop);
    if (!def || !isReady(bed)) continue;
    state.inventory[def.item] += def.yield;
    harvested += def.yield;
    state.inventory[def.item] -= 1;
    bed.nightsLeft = def.nights;
  }
  if (harvested > 0) events.push({ type: 'gardenToadHarvested', harvested });
}

// What the basket toad can bring: each node's drop, weighted by the node's morning target summed
// over the owned plots (mud gel is a creature drop, so it never comes).
export function basketPool(state: GameState): { item: ItemId; weight: number }[] {
  const pool: { item: ItemId; weight: number }[] = [];
  for (const n of NODES) {
    const weight = PLOTS.reduce((w, p, i) => w + (state.plots[i]?.owned ? n.targets[p.id] : 0), 0);
    if (weight <= 0) continue;
    const have = pool.find((e) => e.item === n.drop.item);
    if (have) have.weight += weight;
    else pool.push({ item: n.drop.item, weight });
  }
  return pool;
}

// Step 9: basketItems draws (more with the bigger basket) from the pool, one RNG roll each, into
// the inventory. The world keeps its nodes.
export function basketToad(state: GameState, events: GameEvent[]): void {
  if (!owns(state, 'basketToad')) return;
  const n = owns(state, 'basketToad2') ? H.basketItemsBigger : H.basketItems;
  const pool = basketPool(state);
  const total = pool.reduce((w, e) => w + e.weight, 0);
  if (total <= 0) return;
  const items: Partial<Record<ItemId, number>> = {};
  for (let k = 0; k < n; k++) {
    let r = nextInt(state, 0, total - 1);
    const e = pool.find((o) => (r -= o.weight) < 0)!;
    state.inventory[e.item] += 1;
    items[e.item] = (items[e.item] ?? 0) + 1;
  }
  events.push({ type: 'basketToadBrought', items });
}
