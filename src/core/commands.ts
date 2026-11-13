// UI -> core. Later WPs add members ({ type: 'SetPrice', ... }); UI changes state only through these.
import type { ItemId, PotionId } from '../data/content';

export type Command =
  // Day only, with the stall as interact target.
  | { type: 'CallItADay' }
  // Any phase, with the hut door as interact target.
  | { type: 'Sleep' }
  // bed indexes state.garden; that bed must be the interact target.
  | { type: 'Plant'; bed: number; item: ItemId }
  // The mortar or cauldron must be the interact target and free; qty 1 to what the inputs allow.
  | { type: 'StartGrind'; input: ItemId; qty: number }
  | { type: 'StartBrew'; potion: PotionId; qty: number }
  // Stall: SetPrice any time (at the stall, or live while it is open), clamped to at least 1.
  | { type: 'SetPrice'; potion: PotionId; price: number }
  // Evening, once a day, with a potion in hand, at the stall.
  | { type: 'OpenStall' }
  // While the stall is open.
  | { type: 'CloseStall' }
  // At the signpost that sells the plot (plot indexes state.plots), with the coins.
  | { type: 'BuyPlot'; plot: number };

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
