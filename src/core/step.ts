import { callItADay, sleep, updateClock } from './clock';
import type { Command, Frame } from './commands';
import { updateCreatures } from './creatures';
import type { GameEvent } from './events';
import { plant } from './garden';
import { updatePickups } from './pickups';
import { interact, swing, updateHurt, updatePlayer, updateTargets } from './player';
import { startBrew, startGrind, updateStations } from './stations';
import type { GameState } from './state';

// Invalid commands are dropped with the state untouched; each handler checks its own rules.
// Later WPs add their cases here.
function applyCommand(state: GameState, c: Command, events: GameEvent[]): void {
  switch (c.type) {
    case 'CallItADay':
      callItADay(state, events);
      break;
    case 'Sleep':
      sleep(state, events);
      break;
    case 'Plant':
      plant(state, c.bed, c.item);
      break;
    case 'StartGrind':
      startGrind(state, c.input, c.qty, events);
      break;
    case 'StartBrew':
      startBrew(state, c.potion, c.qty, events);
      break;
  }
}

// One fixed 1/60 s tick. Later WPs hook their systems in here, in a stable order.
// The clock runs before commands so a Sleep leaves t at 0; commands run before movement so
// their target check sees the interact target of the tick the panel was opened on. Stations run
// before commands, so a job started on tick T first advances on T + 1.
export function step(state: GameState, frame: Frame): GameEvent[] {
  const events: GameEvent[] = [];
  state.tick += 1;
  updateClock(state, events);
  updateStations(state, events);
  for (const c of frame.commands) applyCommand(state, c, events);
  updatePlayer(state, frame);
  if (frame.swing) swing(state, events);
  if (frame.interact) interact(state, events);
  updateCreatures(state);
  updateHurt(state, events);
  updatePickups(state, events);
  updateTargets(state);
  return events;
}
