// Drops on the ground: scatter out, get pulled in by the magnet, land in the inventory.
import type { ItemId } from '../data/content';
import { ticks, TUNING } from '../data/tuning';
import type { GameEvent } from './events';
import { nextRange } from './rng';
import type { GameState, PickupState } from './state';
import { isBlocked } from './world';

const K = TUNING.pickup;
const FLY = K.flySpeed / TUNING.sim.tickRate;
const LAND = ticks(K.landTime);

// n pickups of `item`, each scattered scatterMin-scatterMax px from (x, y) in a random direction,
// clear of solids when one of a few tries allows it.
export function spawnDrops(state: GameState, item: ItemId, n: number, x: number, y: number, events: GameEvent[]): void {
  for (let i = 0; i < n; i++) {
    let px = x;
    let py = y;
    for (let t = 0; t < K.scatterTries; t++) {
      const a = nextRange(state, 0, 2 * Math.PI);
      const d = nextRange(state, K.scatterMin, K.scatterMax);
      const cx = x + Math.cos(a) * d;
      const cy = y + Math.sin(a) * d;
      if (!isBlocked(state, cx, cy, K.clearBox, K.clearBox)) {
        px = cx;
        py = cy;
        break;
      }
    }
    spawnPickup(state, item, px, py, x, y, events);
  }
}

// One pickup landing at (x, y), arcing out from (fromX, fromY). Uses no RNG.
export function spawnPickup(
  state: GameState,
  item: ItemId,
  x: number,
  y: number,
  fromX: number,
  fromY: number,
  events: GameEvent[],
): void {
  const id = state.nextId++;
  state.pickups.push({ id, item, x, y, fromX, fromY, landing: LAND });
  events.push({ type: 'pickupSpawned', id, item, x, y, fromX, fromY });
}

export function updatePickups(state: GameState, events: GameEvent[]): void {
  const p = state.player;
  const kept: PickupState[] = [];
  for (const k of state.pickups) {
    if (k.landing > 0) {
      k.landing -= 1;
      kept.push(k);
      continue;
    }
    let d = Math.hypot(p.x - k.x, p.y - k.y);
    if (d <= K.magnetRadius && d > K.collectRadius) {
      const s = Math.min(FLY, d);
      k.x += ((p.x - k.x) / d) * s;
      k.y += ((p.y - k.y) / d) * s;
      d = Math.hypot(p.x - k.x, p.y - k.y);
    }
    if (d <= K.collectRadius) {
      state.inventory[k.item] += 1;
      events.push({ type: 'pickupCollected', id: k.id, item: k.item, x: k.x, y: k.y, count: state.inventory[k.item] });
      continue;
    }
    kept.push(k);
  }
  state.pickups = kept;
}
