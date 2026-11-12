// GameState is plain JSON: no classes, Maps, Sets or functions, so it saves and diffs as is.
import { ITEM_IDS, PLOTS, PLOT_LAYOUTS, type CreatureId, type ItemId, type NodeId } from '../data/content';
import { TUNING } from '../data/tuning';
import { APP_VERSION } from '../data/version';
import { refillCreatures } from './creatures';
import { refillPlot } from './nodes';
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
  // Integer tick counters; 0 means ready / not active.
  swingCooldown: number;
  invulnerable: number;
  knockTicks: number;
  // Knockback displacement per tick while knockTicks > 0.
  knockX: number;
  knockY: number;
  // Recomputed every tick for the renderer: a node or creature id, a structure id.
  swingTarget: number | null;
  interactTarget: string | null;
}

export interface PlotState {
  gx: number;
  gy: number;
  owned: boolean;
}

export interface NodeState {
  id: number;
  type: NodeId;
  // Center of the feet box, in world px (a tile center).
  x: number;
  y: number;
  hp: number;
  // Index into state.plots.
  plot: number;
}

export type CreatureMode = 'idle' | 'walk' | 'chase';

export interface CreatureState {
  id: number;
  type: CreatureId;
  x: number;
  y: number;
  hp: number;
  plot: number;
  mode: CreatureMode;
  // Ticks left in the current idle or walk.
  timer: number;
  // Unit walk direction.
  dirX: number;
  dirY: number;
  stun: number;
  knockTicks: number;
  knockX: number;
  knockY: number;
}

export interface PickupState {
  id: number;
  item: ItemId;
  x: number;
  y: number;
  // Where it was dropped from, so the renderer can draw the arc out.
  fromX: number;
  fromY: number;
  // Ticks left before the magnet may take it.
  landing: number;
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
  // One id counter for nodes, creatures and pickups, so an id names one thing.
  nextId: number;
  nodes: NodeState[];
  creatures: CreatureState[];
  pickups: PickupState[];
}

export function createInitialState(seed: number): GameState {
  const start = PLOT_LAYOUTS.home.playerStart ?? { x: 0, y: 0 };
  const pos = plotTileCenter(0, 0, start.x, start.y);
  const inventory = {} as Record<ItemId, number>;
  for (const id of ITEM_IDS) inventory[id] = 0;
  const state: GameState = {
    version: APP_VERSION,
    seed,
    rng: seedRng(seed),
    tick: 0,
    day: 1,
    phase: 'day',
    player: {
      x: pos.x,
      y: pos.y,
      facing: 'down',
      hearts: TUNING.player.hearts,
      moving: false,
      swingCooldown: 0,
      invulnerable: 0,
      knockTicks: 0,
      knockX: 0,
      knockY: 0,
      swingTarget: null,
      interactTarget: null,
    },
    inventory,
    coins: 0,
    plots: PLOTS.map((p) => ({ gx: p.gx, gy: p.gy, owned: p.ownedAtStart })),
    nextId: 1,
    nodes: [],
    creatures: [],
    pickups: [],
  };
  // Nodes first: mudlets then keep clear of them.
  state.plots.forEach((p, i) => {
    if (p.owned) refillPlot(state, i);
  });
  state.plots.forEach((p, i) => {
    if (p.owned) refillCreatures(state, i);
  });
  return state;
}

export function addItem(state: GameState, id: ItemId, n: number): void {
  state.inventory[id] = Math.max(0, state.inventory[id] + n);
}
