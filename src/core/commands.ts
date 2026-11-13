// UI -> core. UI changes state only through these. Each one names the structure that must be the
// interact target; otherwise it is dropped with the state untouched.
import type { CatalogId, ItemId, PotionId } from '../data/content';
import type { CheatId } from './cheat';

export type Command =
  // Any phase, at the cot.
  | { type: 'Sleep' }
  // bed indexes state.garden; that bed must be the interact target.
  | { type: 'Plant'; bed: number; item: ItemId }
  // That bed must be the interact target and growing: it is emptied, 1 unit of the crop comes back.
  | { type: 'DigUpBed'; bed: number }
  // The targeted mortar or cauldron (either one) must be free; qty 1 to what the inputs allow.
  | { type: 'StartGrind'; input: ItemId; qty: number }
  | { type: 'StartBrew'; potion: PotionId; qty: number }
  // The targeted station must have a job: it stops, the inputs of the units not yet out come back.
  | { type: 'CancelJob' }
  // At that shelf: move qty from the inventory onto it, or take its whole stack back.
  | { type: 'StockShelf'; shelf: number; item: ItemId; qty: number }
  | { type: 'ClearShelf'; shelf: number }
  // At any shelf, any time; clamped to at least 1.
  | { type: 'SetPrice'; item: ItemId; price: number }
  // At the sign: evening, once a day, with a stocked shelf.
  | { type: 'OpenStall' }
  // At the sign, while the shop is open.
  | { type: 'CloseStall' }
  // At the counter, with a customer waiting on queue spot 1.
  | { type: 'RingUp' }
  // At the signpost that sells the plot (plot indexes state.plots), with the coins.
  | { type: 'BuyPlot'; plot: number }
  // At the catalog stand: not owned, not pending, its requirement owned, coins enough.
  | { type: 'BuyUpgrade'; id: CatalogId }
  // At the order board: today's order, not done, with its potions in the inventory.
  | { type: 'DeliverOrder' }
  // Hidden test menu (F2); no target needed.
  | { type: 'Cheat'; cheat: CheatId };

// Everything one tick needs from the outside world.
export interface Frame {
  moveX: number;
  moveY: number;
  swing: boolean;
  interact: boolean;
  commands: Command[];
}

export function neutralFrame(): Frame {
  return { moveX: 0, moveY: 0, swing: false, interact: false, commands: [] };
}
