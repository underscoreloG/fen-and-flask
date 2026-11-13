import { cheat } from './cheat';
import { sleep, updateClock } from './clock';
import type { Command, Frame } from './commands';
import { updateCreatures } from './creatures';
import type { GameEvent } from './events';
import { plant } from './garden';
import { updatePickups } from './pickups';
import { interact, swing, updateDoors, updateHurt, updatePlayer, updateTargets } from './player';
import { buyPlot, clearShelf, closeStall, openShop, ringUp, setPrice, stockShelf, updateShop } from './shop';
import { startBrew, startGrind, updateStations } from './stations';
import type { GameState } from './state';

// Invalid commands are dropped with the state untouched; each handler checks its own rules.
function applyCommand(state: GameState, c: Command, events: GameEvent[]): void {
  switch (c.type) {
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
    case 'StockShelf':
      stockShelf(state, c.shelf, c.item, c.qty);
      break;
    case 'ClearShelf':
      clearShelf(state, c.shelf);
      break;
    case 'SetPrice':
      setPrice(state, c.item, c.price);
      break;
    case 'OpenStall':
      openShop(state, events);
      break;
    case 'CloseStall':
      closeStall(state, events);
      break;
    case 'RingUp':
      ringUp(state, events);
      break;
    case 'BuyPlot':
      buyPlot(state, c.plot, events);
      break;
    case 'Cheat':
      cheat(state, c.cheat, events);
      break;
  }
}

// One fixed 1/60 s tick, in a stable order. The clock runs before commands so a Sleep leaves t
// at 0; commands run before movement so their target check sees the interact target of the tick
// the panel was opened on. Stations and the shop's customers run before commands, so a job
// started on tick T first advances on T + 1. Doors run right after movement, so the targets,
// swing and interact of a tick all see the area the player ends it in.
export function step(state: GameState, frame: Frame): GameEvent[] {
  const events: GameEvent[] = [];
  state.tick += 1;
  updateClock(state, events);
  updateStations(state, events);
  updateShop(state, events);
  for (const c of frame.commands) applyCommand(state, c, events);
  updatePlayer(state, frame);
  updateDoors(state, events);
  if (frame.swing) swing(state, events);
  if (frame.interact) interact(state, events);
  updateCreatures(state);
  updateHurt(state, events);
  updatePickups(state, events);
  updateTargets(state);
  return events;
}
