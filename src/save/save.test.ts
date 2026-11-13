import { describe, expect, it } from 'vitest';
import { morningReset, setPhase } from '../core/clock';
import { neutralFrame, type Command, type Frame } from '../core/commands';
import type { GameEvent } from '../core/events';
import { createInitialState, type GameState } from '../core/state';
import { step } from '../core/step';
import { shopTileCenter } from '../core/world';
import { APP_VERSION } from '../data/version';
import { deserialize, fillDefaults, serialize } from './save';

const script = (i: number): Frame => ({
  ...neutralFrame(),
  moveX: Math.sin(i / 17),
  moveY: Math.cos(i / 23),
  swing: i % 30 === 0,
  interact: i % 55 === 0,
});

// A state from ordinary play: moved, swung, maybe hurt, with pickups on the ground.
function played(): GameState {
  const s = createInitialState(7);
  s.inventory.mint = 2;
  s.coins = 12;
  for (let i = 0; i < 400; i++) step(s, script(i));
  return s;
}

const cmd = (...commands: Command[]): Frame => ({ ...neutralFrame(), commands });

function inside(s: GameState, tx: number, ty: number, facing: GameState['player']['facing']): void {
  const at = shopTileCenter(tx, ty);
  Object.assign(s.player, { area: 'shop', x: at.x, y: at.y, facing });
  step(s, neutralFrame());
}

// An open shop with a stocked shelf and a customer waiting at the counter.
function busyShop(): GameState {
  const s = createInitialState(7);
  s.creatures = [];
  s.inventory.tonic = 4;
  setPhase(s, 'evening');
  inside(s, 3, 5, 'up');
  step(s, cmd({ type: 'StockShelf', shelf: 0, item: 'tonic', qty: 4 }, { type: 'SetPrice', item: 'tonic', price: 3 }));
  inside(s, 9, 9, 'down');
  step(s, cmd({ type: 'OpenStall' }));
  inside(s, 3, 7, 'down');
  for (let i = 0; i < 2000 && !s.shop.customers.some((c) => c.mode === 'queued'); i++) step(s, neutralFrame());
  expect(s.shop.customers.some((c) => c.mode === 'queued' && c.holding)).toBe(true);
  return s;
}

describe('save', () => {
  it('deserialize(serialize(s)) deep-equals s', () => {
    const s = played();
    expect(deserialize(serialize(s, '0.2.0'), '0.2.0')).toEqual(s);
  });

  it('a stocked shelf and a queued customer survive the round trip, and both copies step on identically', () => {
    const a = busyShop();
    expect(a.shop.shelves[0]!.item).toBe('tonic');
    const b = deserialize(serialize(a, '0.2.0'), '0.2.0')!;
    expect(b).toEqual(a);
    for (let i = 0; i < 600; i++) {
      const f = i === 10 ? cmd({ type: 'RingUp' }) : neutralFrame();
      step(a, f);
      step(b, f);
    }
    expect(a.coins).toBeGreaterThan(0);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('a loaded state and the original, stepped through the same 600 frames, end byte-identical', () => {
    const a = played();
    const b = deserialize(serialize(a, '0.2.0'), '0.2.0')!;
    for (let i = 0; i < 600; i++) {
      step(a, script(i + 1000));
      step(b, script(i + 1000));
    }
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('a save from another major.minor is ignored (0.1.3 by 0.2.0, the outdoor-stall saves); another patch loads', () => {
    const s = createInitialState(1);
    expect(deserialize(serialize(s, '0.1.3'), '0.2.0')).toBeNull();
    expect(deserialize(serialize(s, '0.2.0'), '0.1.3')).toBeNull();
    expect(deserialize(serialize(s, '1.2.0'), '0.2.0')).toBeNull();
    expect(deserialize(serialize(s, '0.2.4'), '0.2.0')).toEqual(s);
  });

  it('catalog ids, owned and pending, survive the round trip; a 0.2.1 save is ignored by 0.3.0', () => {
    const s = played();
    s.catalog = { owned: ['shelf5', 'sickle'], pending: ['shelf6'] };
    s.shop.shelves.push({ item: 'tonic', count: 2 });
    const b = deserialize(serialize(s, APP_VERSION), APP_VERSION)!;
    expect(b).toEqual(s);
    expect(b.catalog).toEqual({ owned: ['shelf5', 'sickle'], pending: ['shelf6'] });
    expect(APP_VERSION).toBe('0.3.3');
    expect(deserialize(serialize(createInitialState(1), '0.2.1'), APP_VERSION)).toBeNull();
  });

  it('a 0.3.0 save loads in 0.3.1 as it is, helpers included, and steps', () => {
    const s = played();
    s.catalog = { owned: ['shelf5', 'gardenToad', 'counterToad'], pending: ['basketToad'] };
    const b = deserialize(serialize(s, '0.3.0'), APP_VERSION)!;
    expect(b).toEqual(s);
    expect(() => step(b, neutralFrame())).not.toThrow();
  });

  it('an order and the customer types met survive the round trip, and both copies step on identically', () => {
    const a = busyShop();
    a.order = { item: 'salve', qty: 3, pay: 81, done: true };
    a.shop.met = ['courier', 'traveller'];
    const b = deserialize(serialize(a, APP_VERSION), APP_VERSION)!;
    expect(b).toEqual(a);
    for (let i = 0; i < 600; i++) {
      step(a, neutralFrame());
      step(b, neutralFrame());
    }
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('a 0.3.1 save (no order, no met, no m2Goal) loads in 0.3.2 with a valid order, steps and wakes up to a new one', () => {
    const s = busyShop();
    const file = JSON.parse(serialize(s, '0.3.1')) as { state: GameState & Record<string, unknown> };
    delete (file.state as Record<string, unknown>).order;
    delete (file.state.shop as unknown as Record<string, unknown>).met;
    delete (file.state.flags as unknown as Record<string, unknown>).m2Goal;
    // Its queued customer has no type either: it waits as a traveller.
    for (const c of file.state.shop.customers) delete c.type;
    const b = deserialize(JSON.stringify(file), APP_VERSION)!;
    expect(b).not.toBeNull();
    expect(b.shop.met).toEqual([]);
    expect(b.flags).toEqual({ m1Goal: s.flags.m1Goal, m2Goal: false });
    expect(b.order).toEqual(createInitialState(b.seed).order);
    expect(['tonic', 'salve', 'glowdraught']).toContain(b.order.item);
    expect(b.order.qty).toBeGreaterThanOrEqual(1);
    expect(b.order.done).toBe(false);
    const left: GameEvent[] = [];
    for (let i = 0; i < 1800; i++) left.push(...step(b, neutralFrame()));
    expect(left.filter((e) => e.type === 'customerLeftUnpaid')).toHaveLength(1);
    const ev: GameEvent[] = [];
    morningReset(b, ev);
    expect(ev).toContainEqual({ type: 'orderPosted', item: b.order.item, qty: b.order.qty, pay: b.order.pay });
  });

  it('a 0.3.2 save loads in 0.3.3 as it is and steps; a grumbler it already holds pays without the old penalty', () => {
    const s = busyShop();
    s.inventory.mint = 3;
    s.stations.mortar = { recipe: 'mintpaste', remaining: 2, progress: 40 };
    // Under 0.3.2 a grumbling customer bought and queued.
    const c = s.shop.customers.find((o) => o.mode === 'queued' && o.holding)!;
    c.reaction = 'grumbling';
    const b = deserialize(serialize(s, '0.3.2'), APP_VERSION)!;
    expect(b).toEqual(s);
    const demand = b.shop.demand.tonic;
    const ev = step(b, cmd({ type: 'RingUp' }));
    expect(ev.filter((e) => e.type === 'sale')).toHaveLength(1);
    expect(b.shop.demand.tonic).toBeCloseTo(demand - 0.04, 10);
    for (let i = 0; i < 600; i++) ev.push(...step(b, neutralFrame()));
    expect(ev).toContainEqual({ type: 'jobFinished', station: 'mortar' });
  });

  it('fillDefaults restores a missing key from a fresh state and keeps loaded arrays as they are', () => {
    const s = createInitialState(3);
    s.shop.shelves.push({ item: 'salve', count: 1 });
    const loaded = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete loaded.catalog;
    delete (loaded.stations as Record<string, unknown>).cauldron2;
    fillDefaults(loaded, createInitialState(3) as unknown as Record<string, unknown>);
    const back = loaded as unknown as GameState;
    expect(back.catalog).toEqual({ owned: [], pending: [] });
    expect(back.stations.cauldron2).toBeNull();
    expect(back.shop.shelves).toHaveLength(5);
    expect(back.shop.shelves[4]).toEqual({ item: 'salve', count: 1 });
    // Through a load too: a save of this minor without the key comes back with it.
    const file = JSON.parse(serialize(s, APP_VERSION)) as { state: Record<string, unknown> };
    delete file.state.catalog;
    expect(deserialize(JSON.stringify(file), APP_VERSION)!.catalog).toEqual({ owned: [], pending: [] });
  });

  it('garbage and wrong shapes return null', () => {
    for (const bad of ['', '{', 'not json', 'null', '42', '"x"', '[]', '{"version":"0.2.0"}', '{"state":{}}', '{"version":1,"state":{}}']) {
      expect(deserialize(bad, '0.2.0'), bad).toBeNull();
    }
  });
});
