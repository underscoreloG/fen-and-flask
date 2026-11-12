import type { Frame } from './commands';
import type { GameEvent } from './events';
import { updatePlayer } from './player';
import type { GameState } from './state';

// One fixed 1/60 s tick. Later WPs hook their systems in here, in a stable order.
export function step(state: GameState, frame: Frame): GameEvent[] {
  const events: GameEvent[] = [];
  state.tick += 1;
  updatePlayer(state, frame);
  return events;
}
