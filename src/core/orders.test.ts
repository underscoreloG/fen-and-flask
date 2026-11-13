import { describe, expect, it } from 'vitest';
import { CATALOG, ITEMS, type PotionId } from '../data/content';
import { morningReset } from './clock';
import { neutralFrame, type Command, type Frame } from './commands';
import type { GameEvent } from './events';
import { createInitialState, type GameState } from './state';
import { step } from './step';
import { plotTileCenter, shopTileCenter } from './world';

const cmd = (...commands: Command[]): Frame => ({ ...neutralFrame(), commands });
const count = (ev: GameEvent[], type: GameEvent['type']): number => ev.filter((e) => e.type === type).length;
const base = (item: PotionId): number => ITEMS.find((i) => i.id === item)!.value;
const DELIVER: Command = { type: 'DeliverOrder' };

function quiet(seed = 1): GameState {
  const s = createInitialState(seed);
  s.nodes = [];
  s.creatures = [];
  return s;
}

function inside(s: GameState, tx: number, ty: number, facing: GameState['player']['facing']): void {
  const at = shopTileCenter(tx, ty);
  Object.assign(s.player, { area: 'shop', x: at.x, y: at.y, facing });
  step(s, neutralFrame());
}

// The board hangs on the back wall above (5,2): the player stands there facing up.
const atBoard = (s: GameState): void => inside(s, 5, 2, 'up');

function expectRejected(s: GameState, c: Command): void {
  const twin = structuredClone(s);
  const ev = step(s, cmd(c));
  const evTwin = step(twin, neutralFrame());
  expect(JSON.stringify(s)).toBe(JSON.stringify(twin));
  expect(ev).toEqual(evTwin);
}

describe('the daily order', () => {
  it('a new game has an order of 1 or 2 home-plot potions, pay = round(1.5 x base x qty), and no orderPosted', () => {
    const qtys = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = createInitialState(seed);
      const o = s.order;
      expect(['tonic', 'salve', 'glowdraught']).toContain(o.item);
      expect(o.qty === 1 || o.qty === 2).toBe(true);
      expect(o.pay).toBe(Math.round(1.5 * base(o.item) * o.qty));
      expect(o.done).toBe(false);
      qtys.add(o.qty);
      // The first ticks of a game post nothing.
      const ev: GameEvent[] = [];
      for (let i = 0; i < 5; i++) ev.push(...step(s, neutralFrame()));
      expect(count(ev, 'orderPosted')).toBe(0);
    }
    expect(qtys).toEqual(new Set([1, 2]));
  });

  it('300 mornings on a home-only state: never emberelixir, qty 1 to 3, one orderPosted per reset, before morning', () => {
    const s = quiet(5);
    const items = new Set<PotionId>();
    const qtys = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const ev: GameEvent[] = [];
      morningReset(s, ev);
      expect(count(ev, 'orderPosted')).toBe(1);
      const posted = ev.find((e) => e.type === 'orderPosted')!;
      expect(posted).toEqual({ type: 'orderPosted', item: s.order.item, qty: s.order.qty, pay: s.order.pay });
      expect(ev.findIndex((e) => e.type === 'orderPosted')).toBeLessThan(ev.findIndex((e) => e.type === 'morning'));
      expect(s.order.pay).toBe(Math.round(1.5 * base(s.order.item) * s.order.qty));
      expect(s.order.done).toBe(false);
      items.add(s.order.item);
      qtys.add(s.order.qty);
    }
    expect(items).toEqual(new Set(['tonic', 'salve', 'glowdraught']));
    expect(qtys).toEqual(new Set([1, 2, 3]));
  });

  it('with the east plot owned an Ember Elixir can be ordered', () => {
    const s = quiet(5);
    s.plots[1]!.owned = true;
    const items = new Set<PotionId>();
    for (let i = 0; i < 100; i++) {
      morningReset(s, []);
      items.add(s.order.item);
    }
    expect(items.has('emberelixir')).toBe(true);
  });

  it('an unfinished order is replaced at the morning; nothing is taken for it', () => {
    const s = quiet();
    s.order = { item: 'salve', qty: 3, pay: 81, done: false };
    s.inventory.salve = 2;
    morningReset(s, []);
    expect(s.inventory.salve).toBe(2);
    expect(s.order.done).toBe(false);
  });

  it('the board: interact tile (5,2) facing up, hint ORDER, it opens the order panel and adds no solid tile', () => {
    const s = quiet();
    atBoard(s);
    expect(s.player.interactTarget).toBe('board');
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'uiRequest', ui: 'order' });
    // Walk along row 2 under the board: nothing in the way.
    const from = shopTileCenter(3, 2);
    Object.assign(s.player, { x: from.x, y: from.y, facing: 'right' });
    for (let i = 0; i < 60; i++) step(s, { ...neutralFrame(), moveX: 1 });
    expect(s.player.x).toBeGreaterThan(shopTileCenter(6, 2).x);
  });

  it('DeliverOrder at the board: potions out, pay in, done, orderDelivered; demand, history and sold counters untouched', () => {
    const s = quiet();
    s.order = { item: 'glowdraught', qty: 2, pay: 72, done: false };
    s.inventory.glowdraught = 3;
    s.coins = 5;
    atBoard(s);
    const shopBefore = JSON.stringify(s.shop);
    const ev = step(s, cmd(DELIVER));
    expect(ev).toContainEqual({ type: 'orderDelivered', item: 'glowdraught', qty: 2, pay: 72 });
    expect(s.inventory.glowdraught).toBe(1);
    expect(s.coins).toBe(77);
    expect(s.order.done).toBe(true);
    expect(JSON.stringify(s.shop)).toBe(shopBefore);
    // A second time the same day, even with the potions in hand.
    s.inventory.glowdraught = 5;
    expectRejected(s, DELIVER);
  });

  it('DeliverOrder is rejected away from the board and with too few potions in the inventory (tables do not count)', () => {
    const away = quiet();
    away.order = { item: 'tonic', qty: 1, pay: 21, done: false };
    away.inventory.tonic = 1;
    inside(away, 9, 9, 'down');
    expectRejected(away, DELIVER);
    const outdoors = quiet();
    outdoors.order = { item: 'tonic', qty: 1, pay: 21, done: false };
    outdoors.inventory.tonic = 1;
    const at = plotTileCenter(0, 0, 2, 4);
    Object.assign(outdoors.player, { area: 'world', x: at.x, y: at.y });
    step(outdoors, neutralFrame());
    expectRejected(outdoors, DELIVER);

    const few = quiet();
    few.order = { item: 'tonic', qty: 3, pay: 63, done: false };
    few.inventory.tonic = 2;
    few.shop.shelves[0] = { item: 'tonic', count: 5 };
    atBoard(few);
    expectRejected(few, DELIVER);
  });

  it('an Ember Elixir delivered to the board reaches the M1 goal if it was not reached yet', () => {
    const s = quiet();
    s.order = { item: 'emberelixir', qty: 1, pay: 90, done: false };
    s.inventory.emberelixir = 1;
    atBoard(s);
    const ev = step(s, cmd(DELIVER));
    expect(s.flags.m1Goal).toBe(true);
    expect(ev.findIndex((e) => e.type === 'goalReached')).toBe(ev.findIndex((e) => e.type === 'orderDelivered') + 1);

    const again = quiet();
    again.flags.m1Goal = true;
    again.order = { item: 'emberelixir', qty: 1, pay: 90, done: false };
    again.inventory.emberelixir = 1;
    atBoard(again);
    expect(count(step(again, cmd(DELIVER)), 'goalReached')).toBe(0);
  });
});

describe('the M2 goal', () => {
  it('fires at the first morning reset where all 14 items are owned, once, after the order and before morning', () => {
    const s = quiet();
    s.catalog.owned = CATALOG.slice(0, -1).map((d) => d.id);
    s.catalog.pending = [CATALOG.at(-1)!.id];
    const ev: GameEvent[] = [];
    morningReset(s, ev);
    expect(s.flags.m2Goal).toBe(true);
    expect(count(ev, 'm2GoalReached')).toBe(1);
    const at = (t: GameEvent['type']): number => ev.findIndex((e) => e.type === t);
    expect(at('upgradeArrived')).toBeLessThan(at('orderPosted'));
    expect(at('orderPosted')).toBeLessThan(at('m2GoalReached'));
    expect(at('m2GoalReached')).toBeLessThan(at('morning'));
    const next: GameEvent[] = [];
    morningReset(s, next);
    expect(count(next, 'm2GoalReached')).toBe(0);
  });

  it('does not fire while one item is missing; a state edited to own all 14 with the flag false fires at its next morning', () => {
    const s = quiet();
    s.catalog.owned = CATALOG.slice(1).map((d) => d.id);
    const ev: GameEvent[] = [];
    morningReset(s, ev);
    expect(count(ev, 'm2GoalReached')).toBe(0);
    expect(s.flags.m2Goal).toBe(false);
    s.catalog.owned = CATALOG.map((d) => d.id);
    const ev2: GameEvent[] = [];
    morningReset(s, ev2);
    expect(count(ev2, 'm2GoalReached')).toBe(1);
  });
});
