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
  | { type: 'StartBrew'; potion: PotionId; qty: number };

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
