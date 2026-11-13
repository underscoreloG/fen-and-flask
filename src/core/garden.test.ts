import { describe, expect, it } from 'vitest';
import type { ItemId } from '../data/content';
import { setPhase } from './clock';
import { neutralFrame, type Command, type Frame } from './commands';
import type { GameEvent } from './events';
import { BED_IDS } from './garden';
import { createInitialState, type GameState } from './state';
import { step } from './step';
import { plotTileCenter, shopTileCenter } from './world';

const cmd = (...commands: Command[]): Frame => ({ ...neutralFrame(), commands });
const INTERACT: Frame = { ...neutralFrame(), interact: true };
const SWING: Frame = { ...neutralFrame(), swing: true };

function run(s: GameState, n: number, frame: Frame = neutralFrame()): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...step(s, frame));
  return out;
}

function standAt(s: GameState, tx: number, ty: number, facing: GameState['player']['facing']): void {
  const at = plotTileCenter(0, 0, tx, ty);
  s.player.x = at.x;
  s.player.y = at.y;
  s.player.facing = facing;
  step(s, neutralFrame());
}

// An empty home plot; the player stands west of bed0 (plot tile 6,2) facing it.
function scene(): GameState {
  const s = createInitialState(1);
  s.nodes = [];
  s.creatures = [];
  standAt(s, 5, 2, 'right');
  return s;
}

// Indoors on a shop-local tile.
function inside(s: GameState, tx: number, ty: number, facing: GameState['player']['facing']): void {
  const at = shopTileCenter(tx, ty);
  Object.assign(s.player, { area: 'shop', x: at.x, y: at.y, facing });
  step(s, neutralFrame());
}

// Sleep in the cot, then back out to the bed on an empty plot (the morning refills nodes and mudlets).
function sleepAndReturn(s: GameState): void {
  inside(s, 18, 9, 'right');
  expect(s.player.interactTarget).toBe('cot');
  const day = s.day;
  step(s, cmd({ type: 'Sleep' }));
  expect(s.day).toBe(day + 1);
  s.nodes = [];
  s.creatures = [];
  s.player.area = 'world';
  standAt(s, 5, 2, 'right');
}

function plantBed0(s: GameState, item: ItemId): void {
  expect(s.player.interactTarget).toBe(BED_IDS[0]);
  step(s, cmd({ type: 'Plant', bed: 0, item }));
}

function expectRejected(s: GameState, c: Command): void {
  const twin = structuredClone(s);
  step(s, cmd(c));
  step(twin, neutralFrame());
  expect(JSON.stringify(s)).toBe(JSON.stringify(twin));
}

const types = (ev: GameEvent[]): string[] => ev.map((e) => e.type);

describe('garden', () => {
  it('has 4 empty beds on a new game', () => {
    expect(createInitialState(1).garden).toEqual(Array.from({ length: 4 }, () => ({ crop: null, nightsLeft: 0 })));
  });

  it('interact on an empty bed asks for the picker with that bed', () => {
    const s = scene();
    expect(step(s, INTERACT)).toContainEqual({ type: 'uiRequest', ui: 'gardenPicker', bed: 0 });
  });

  it('plant mint (-1), sleep, ready; interact harvests 3 mint and empties the bed', () => {
    const s = scene();
    s.inventory.mint = 1;
    plantBed0(s, 'mint');
    expect(s.inventory.mint).toBe(0);
    expect(s.garden[0]).toEqual({ crop: 'mint', nightsLeft: 1 });
    // Growing: interact does nothing.
    expect(types(step(s, INTERACT))).not.toContain('uiRequest');
    sleepAndReturn(s);
    expect(s.garden[0]).toEqual({ crop: 'mint', nightsLeft: 0 });
    expect(s.player.swingTarget).toBe(BED_IDS[0]);
    const ev = step(s, INTERACT);
    expect(ev.filter((e) => e.type === 'pickupSpawned').length).toBe(3);
    expect(types(ev)).not.toContain('uiRequest');
    expect(s.garden[0]).toEqual({ crop: null, nightsLeft: 0 });
    // On the bed, so every drop (8-14 px out) is inside the magnet whatever the RNG sequence.
    standAt(s, 6, 2, 'right');
    run(s, 60);
    expect(s.pickups).toEqual([]);
    expect(s.inventory.mint).toBe(3);
  });

  it('a swing on a ready bed harvests it (glowcap gives 3)', () => {
    const s = scene();
    s.inventory.glowcap = 2;
    plantBed0(s, 'glowcap');
    expect(s.inventory.glowcap).toBe(1);
    sleepAndReturn(s);
    const ev = step(s, SWING);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'swing', targetId: BED_IDS[0] }));
    standAt(s, 6, 2, 'right');
    run(s, 60);
    expect(s.inventory.glowcap).toBe(4);
    expect(s.garden[0]!.crop).toBeNull();
  });

  it('emberroot needs 2 sleeps and gives 2', () => {
    const s = scene();
    s.inventory.emberroot = 1;
    plantBed0(s, 'emberroot');
    sleepAndReturn(s);
    expect(s.garden[0]).toEqual({ crop: 'emberroot', nightsLeft: 1 });
    expect(step(s, INTERACT).filter((e) => e.type === 'pickupSpawned')).toEqual([]);
    sleepAndReturn(s);
    step(s, INTERACT);
    run(s, 60);
    expect(s.inventory.emberroot).toBe(2);
  });

  it('a creature or a node in reach wins over a ready bed', () => {
    const s = scene();
    s.inventory.mint = 1;
    plantBed0(s, 'mint');
    sleepAndReturn(s);
    const at = plotTileCenter(0, 0, 6, 2);
    s.nodes.push({ id: s.nextId++, type: 'mintbush', x: at.x, y: at.y - 4, hp: 1, plot: 0 });
    step(s, neutralFrame());
    expect(typeof s.player.swingTarget).toBe('number');
  });

  it('rejects an item not owned, a non-plantable item, a non-empty bed and a bed not targeted', () => {
    const s = scene();
    expectRejected(s, { type: 'Plant', bed: 0, item: 'mint' });
    s.inventory.reed = 3;
    expectRejected(s, { type: 'Plant', bed: 0, item: 'reed' });
    s.inventory.mint = 2;
    expectRejected(s, { type: 'Plant', bed: 1, item: 'mint' });
    expectRejected(s, { type: 'Plant', bed: 9, item: 'mint' });
    plantBed0(s, 'mint');
    expect(s.inventory.mint).toBe(1);
    expectRejected(s, { type: 'Plant', bed: 0, item: 'mint' });
    expect(s.garden[0]).toEqual({ crop: 'mint', nightsLeft: 1 });
  });
});

describe('interact routing', () => {
  it('cot -> sleepConfirm; sign by day -> callItADayConfirm, by evening -> openShopConfirm once a shelf is stocked', () => {
    const s = createInitialState(1);
    s.creatures = [];
    inside(s, 18, 9, 'right');
    expect(step(s, INTERACT)).toContainEqual({ type: 'uiRequest', ui: 'sleepConfirm' });
    inside(s, 9, 9, 'down');
    expect(step(s, INTERACT)).toContainEqual({ type: 'uiRequest', ui: 'callItADayConfirm' });
    setPhase(s, 'evening');
    s.shop.shelves[0] = { item: 'tonic', count: 1 };
    expect(step(s, INTERACT)).toContainEqual({ type: 'uiRequest', ui: 'openShopConfirm' });
  });
});
