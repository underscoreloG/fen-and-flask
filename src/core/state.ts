// GameState is plain JSON: no classes, Maps, Sets or functions, so it saves and diffs as is.
import { ITEM_IDS, PLOTS, PLOT_LAYOUTS, type ItemId } from '../data/content';
import { TUNING } from '../data/tuning';
import { APP_VERSION } from '../data/version';
import { seedRng } from './rng';
import { plotTileCenter } from './world';

export type Facing = 'down' | 'up' | 'left' | 'right';

export type Phase = 'day';

export interface PlayerState {
  // Center of the feet, in world px.
  x: number;
  y: number;
  facing: Facing;
  hearts: number;
  moving: boolean;
}

export interface PlotState {
  gx: number;
  gy: number;
  owned: boolean;
}

export interface GameState {
  version: string;
  seed: number;
  rng: number;
  tick: number;
  day: number;
  phase: Phase;
  player: PlayerState;
  inventory: Record<ItemId, number>;
  coins: number;
  plots: PlotState[];
}

export function createInitialState(seed: number): GameState {
  const start = PLOT_LAYOUTS.home.playerStart ?? { x: 0, y: 0 };
  const pos = plotTileCenter(0, 0, start.x, start.y);
  const inventory = {} as Record<ItemId, number>;
  for (const id of ITEM_IDS) inventory[id] = 0;
  return {
    version: APP_VERSION,
    seed,
    rng: seedRng(seed),
    tick: 0,
    day: 1,
    phase: 'day',
    player: { x: pos.x, y: pos.y, facing: 'down', hearts: TUNING.player.hearts, moving: false },
    inventory,
    coins: 0,
    plots: PLOTS.map((p) => ({ gx: p.gx, gy: p.gy, owned: p.ownedAtStart })),
  };
}

export function addItem(state: GameState, id: ItemId, n: number): void {
  state.inventory[id] = Math.max(0, state.inventory[id] + n);
}
