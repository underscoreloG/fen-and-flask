// Hidden test menu (F2): shortcuts for trying the game without playing through it.
import { ITEM_IDS } from '../data/content';
import { TUNING } from '../data/tuning';
import { morningReset, startEvening } from './clock';
import { refillCreatures } from './creatures';
import type { GameEvent } from './events';
import { refillPlot } from './nodes';
import { closeShop } from './shop';
import { addItem, type GameState } from './state';

export const CHEATS = ['coinsSmall', 'coinsBig', 'items', 'hearts', 'evening', 'morning', 'land'] as const;
export type CheatId = (typeof CHEATS)[number];

const C = TUNING.cheat;

export function cheat(state: GameState, id: CheatId, events: GameEvent[]): void {
  switch (id) {
    case 'coinsSmall':
      state.coins += C.coinsSmall;
      break;
    case 'coinsBig':
      state.coins += C.coinsBig;
      break;
    case 'items':
      for (const item of ITEM_IDS) addItem(state, item, C.items);
      break;
    case 'hearts':
      state.player.hearts = TUNING.player.hearts;
      break;
    case 'evening':
      startEvening(state, events);
      break;
    case 'morning':
      // As a sleep would: an open shop closes first.
      closeShop(state, events);
      morningReset(state, events);
      break;
    case 'land':
      state.plots.forEach((plot, i) => {
        if (plot.owned) return;
        plot.owned = true;
        refillPlot(state, i);
        refillCreatures(state, i);
        events.push({ type: 'plotBought', plot: i });
      });
      break;
  }
}
