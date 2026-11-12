import type { Frame } from './commands';
import { updateCreatures } from './creatures';
import type { GameEvent } from './events';
import { updatePickups } from './pickups';
import { interact, swing, updateHurt, updatePlayer, updateTargets } from './player';
import type { GameState } from './state';

// One fixed 1/60 s tick. Later WPs hook their systems in here, in a stable order.
export function step(state: GameState, frame: Frame): GameEvent[] {
  const events: GameEvent[] = [];
  state.tick += 1;
  updatePlayer(state, frame);
  if (frame.swing) swing(state, events);
  if (frame.interact) interact(state, events);
  updateCreatures(state);
  updateHurt(state, events);
  updatePickups(state, events);
  updateTargets(state);
  return events;
}
