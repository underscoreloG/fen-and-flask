import { describe, expect, it } from 'vitest';
import { CUSTOMER_TYPES, ITEM_IDS, ITEMS, NODES, type CatalogId, type CustomerType, type ItemId, type PotionId } from '../data/content';
import { ticks, TUNING } from '../data/tuning';
import { morningReset, setPhase } from './clock';
import { neutralFrame, type Command, type Frame } from './commands';
import type { GameEvent } from './events';
import { itemValue, pathBetween, PATIENCE_TICKS, patienceTicks, pickShelf, reactTo, rollType, typeMultiplier } from './shop';
import { createInitialState, type CreatureState, type GameState } from './state';
import { step } from './step';
import { plotTileCenter, shopTileCenter, TILE, tileAt } from './world';

const cmd = (...commands: Command[]): Frame => ({ ...neutralFrame(), commands });
const move = (moveX: number, moveY: number): Frame => ({ ...neutralFrame(), moveX, moveY });
const count = (ev: GameEvent[], type: GameEvent['type']): number => ev.filter((e) => e.type === type).length;
type Facing = GameState['player']['facing'];

// Interact tiles of the interior (specs/wp/WP06).
const SHELF_X = [3, 6, 9, 12];
const AT = { counter: [3, 9], sign: [9, 9], cot: [18, 9] } as const;

// A new game with no nodes and no mudlets (time passes in these tests).
function quiet(seed = 1): GameState {
  const s = createInitialState(seed);
  s.nodes = [];
  s.creatures = [];
  return s;
}

// Puts the player indoors on a shop-local tile, then one tick so the targets are fresh.
function inside(s: GameState, tx: number, ty: number, facing: Facing): void {
  const at = shopTileCenter(tx, ty);
  Object.assign(s.player, { area: 'shop', x: at.x, y: at.y, facing });
  step(s, neutralFrame());
}

function outside(s: GameState, tx: number, ty: number, facing: Facing): void {
  const at = plotTileCenter(0, 0, tx, ty);
  Object.assign(s.player, { area: 'world', x: at.x, y: at.y, facing });
  step(s, neutralFrame());
}

const atShelf = (s: GameState, i: number): void => inside(s, SHELF_X[i]!, 5, 'up');
const atCounter = (s: GameState): void => inside(s, AT.counter[0], AT.counter[1], 'up');
const atSign = (s: GameState): void => inside(s, AT.sign[0], AT.sign[1], 'down');
const atCot = (s: GameState): void => inside(s, AT.cot[0], AT.cot[1], 'right');

function run(s: GameState, n: number, frame: Frame = neutralFrame()): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...step(s, frame));
  return out;
}

// Steps until an event of `type` (at most `max` ticks); returns every event on the way.
function until(s: GameState, type: GameEvent['type'], max = 5000): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < max; i++) {
    const ev = step(s, neutralFrame());
    out.push(...ev);
    if (ev.some((e) => e.type === type)) return out;
  }
  throw new Error(`no ${type} within ${max} ticks`);
}

function expectRejected(s: GameState, c: Command): void {
  const twin = structuredClone(s);
  const ev = step(s, cmd(c));
  const evTwin = step(twin, neutralFrame());
  expect(JSON.stringify(s)).toBe(JSON.stringify(twin));
  expect(ev).toEqual(evTwin);
}

function stock(s: GameState, shelf: number, item: ItemId, qty: number, price?: number): void {
  atShelf(s, shelf);
  const extra: Command[] = price === undefined ? [] : [{ type: 'SetPrice', item, price }];
  step(s, cmd({ type: 'StockShelf', shelf, item, qty }, ...extra));
}

// Evening with shelves stocked (inventory given), the shop opened from the sign, the player then
// behind the counter (that tick lets the first customer in).
function openShop(stocked: readonly [ItemId, number, number][], seed = 1): GameState {
  const s = quiet(seed);
  setPhase(s, 'evening');
  stocked.forEach(([item, qty, price], i) => {
    s.inventory[item] += qty;
    stock(s, i, item, qty, price);
  });
  atSign(s);
  step(s, cmd({ type: 'OpenStall' }));
  expect(s.shop.phase).toBe('open');
  atCounter(s);
  return s;
}

// One customer only, its mood forced.
function openWithOne(item: ItemId, qty: number, price: number, personal = 1): GameState {
  const s = openShop([[item, qty, price]]);
  expect(s.shop.customers).toHaveLength(1);
  s.shop.customers[0]!.personal = personal;
  // A plain customer (specs/wp/WP09 types value and wait differently).
  s.shop.customers[0]!.type = 'traveller';
  s.shop.customersLeft = 0;
  return s;
}

// Rings up whoever waits at spot 1, until the shop is no longer open.
function serve(s: GameState, max = 20000, each?: () => void): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < max && s.shop.phase === 'open'; i++) {
    const waiting = s.shop.customers.some((c) => c.spot === 0 && c.mode === 'queued');
    out.push(...step(s, waiting ? cmd({ type: 'RingUp' }) : neutralFrame()));
    each?.();
  }
  return out;
}

// Does the player's feet box overlap shop-local tile (tx, ty)?
function onTile(s: GameState, tx: number, ty: number): boolean {
  const { hitboxW, hitboxH } = TUNING.player;
  const c = shopTileCenter(tx, ty);
  return Math.abs(s.player.x - c.x) < (hitboxW + TILE) / 2 && Math.abs(s.player.y - c.y) < (hitboxH + TILE) / 2;
}

function mudlet(s: GameState, x: number, y: number): CreatureState {
  const c: CreatureState = {
    id: s.nextId++,
    type: 'mudlet',
    x,
    y,
    hp: 3,
    plot: 0,
    mode: 'idle',
    timer: 1,
    dirX: 0,
    dirY: 0,
    stun: 0,
    knockTicks: 0,
    knockX: 0,
    knockY: 0,
  };
  s.creatures.push(c);
  return c;
}

describe('doors', () => {
  it('walking up from plot tile (2,3) goes in on (7,10), down onto (7,11) comes out on (2,3); no bounce on a held key', () => {
    const s = quiet();
    outside(s, 2, 3, 'up');
    let ev: GameEvent[] = [];
    for (let i = 0; i < 60 && s.player.area === 'world'; i++) ev = [...ev, ...step(s, move(0, -1))];
    expect(s.player.area).toBe('shop');
    expect([s.player.x, s.player.y]).toEqual([shopTileCenter(7, 10).x, shopTileCenter(7, 10).y]);
    expect(s.player.facing).toBe('up');
    const held = run(s, 60, move(0, -1));
    expect(count([...ev, ...held], 'areaChanged')).toBe(1);
    expect(ev).toContainEqual({ type: 'areaChanged', area: 'shop' });
    expect(s.player.area).toBe('shop');

    inside(s, 7, 10, 'down');
    ev = [];
    for (let i = 0; i < 60 && s.player.area === 'shop'; i++) ev = [...ev, ...step(s, move(0, 1))];
    expect(s.player.area).toBe('world');
    const out = plotTileCenter(0, 0, 2, 3);
    expect([s.player.x, s.player.y]).toEqual([out.x, out.y]);
    const held2 = run(s, 60, move(0, 1));
    expect(count([...ev, ...held2], 'areaChanged')).toBe(1);
    expect(ev).toContainEqual({ type: 'areaChanged', area: 'world' });
    expect(s.player.area).toBe('world');
  });

  it('pushing up from a little beside the door still goes in', () => {
    const s = quiet();
    outside(s, 2, 3, 'up');
    s.player.x += 5;
    for (let i = 0; i < 60 && s.player.area === 'world'; i++) step(s, move(0, -1));
    expect(s.player.area).toBe('shop');
  });

  it('the exit does not let the player out while the shop is open', () => {
    const s = openShop([['tonic', 2, 10]]);
    inside(s, 7, 10, 'down');
    expect(s.player.interactTarget).toBe('exit');
    const ev = run(s, 300, move(0, 1));
    expect(count(ev, 'areaChanged')).toBe(0);
    expect(s.player.area).toBe('shop');
    expect(tileAt(s.player.y)).toBe(tileAt(shopTileCenter(7, 10).y));
  });
});

describe('interior', () => {
  // From a tile, push toward a solid tile next to it for 300 ticks: never inside it.
  const walls: [string, [number, number], [number, number], number, number][] = [
    ['back wall', [5, 2], [5, 1], 0, -1],
    ['left wall', [1, 6], [0, 6], -1, 0],
    ['right wall', [20, 5], [21, 5], 1, 0],
    ['front wall', [5, 10], [5, 11], 0, 1],
    ['partition', [13, 4], [14, 4], 1, 0],
    ['partition, back room side', [15, 8], [14, 8], -1, 0],
    ['shelf 1', [3, 5], [3, 4], 0, -1],
    ['shelf 2', [6, 5], [6, 4], 0, -1],
    ['shelf 3', [9, 5], [9, 4], 0, -1],
    ['shelf 4', [12, 5], [12, 4], 0, -1],
    ['counter, customer side', [3, 7], [3, 8], 0, 1],
    ['counter', [3, 9], [3, 8], 0, -1],
    ['sign', [9, 9], [9, 10], 0, 1],
    ['mortar', [16, 4], [16, 3], 0, -1],
    ['cauldron', [18, 4], [18, 3], 0, -1],
    ['cot', [18, 9], [19, 9], 1, 0],
  ];
  it.each(walls)('cannot enter the %s', (_name, from, solid, mx, my) => {
    const s = quiet();
    inside(s, from[0], from[1], 'down');
    for (let i = 0; i < 300; i++) {
      step(s, move(mx, my));
      expect(onTile(s, solid[0], solid[1])).toBe(false);
    }
    expect(s.player.area).toBe('shop');
  });

  it('the partition doorway (14,6) leads into the back room', () => {
    const s = quiet();
    inside(s, 13, 6, 'right');
    run(s, 60, move(1, 0));
    expect(tileAt(s.player.x)).toBeGreaterThan(tileAt(shopTileCenter(14, 6).x));
  });

  it('with 2 mudlets by the hut door and the player indoors for 3000 ticks: 5 hearts, no chase', () => {
    const s = quiet();
    inside(s, 7, 10, 'up');
    for (const tx of [1, 3]) {
      const at = plotTileCenter(0, 0, tx, 3);
      mudlet(s, at.x, at.y);
    }
    for (let i = 0; i < 3000; i++) {
      step(s, neutralFrame());
      expect(s.player.hearts).toBe(TUNING.player.hearts);
      expect(s.creatures.every((c) => c.mode !== 'chase')).toBe(true);
    }
  });

  it('indoors nothing outdoors is a target: a mudlet and a node on the player spot are never hit and never hurt', () => {
    const s = quiet();
    inside(s, 7, 6, 'up');
    const { x, y } = s.player;
    // Planted on the player's px by hand: the gates must hold even if they ever overlapped.
    mudlet(s, x, y);
    s.nodes.push({ id: s.nextId++, type: 'stump', x, y: y - 12, hp: 3, plot: 0 });
    const ev = run(s, 60, { ...neutralFrame(), swing: true });
    expect(count(ev, 'playerHurt')).toBe(0);
    expect(count(ev, 'creatureHit') + count(ev, 'nodeHit')).toBe(0);
    expect(s.player.swingTarget).toBeNull();
    expect(s.creatures[0]!.mode).not.toBe('chase');
  });

  it('a pickup in one area is never collected from the other', () => {
    const s = quiet();
    inside(s, 7, 6, 'up');
    s.pickups.push({ id: s.nextId++, item: 'reed', area: 'world', x: s.player.x, y: s.player.y, fromX: 0, fromY: 0, landing: 0 });
    run(s, 60);
    expect(s.pickups).toHaveLength(1);
    expect(s.inventory.reed).toBe(0);

    const o = quiet();
    outside(o, 5, 7, 'down');
    o.pickups.push({ id: o.nextId++, item: 'reed', area: 'shop', x: o.player.x, y: o.player.y, fromX: 0, fromY: 0, landing: 0 });
    run(o, 60);
    expect(o.pickups).toHaveLength(1);
    expect(o.inventory.reed).toBe(0);
  });

  it('sleeping in the bed gives a morning with the player indoors on (18,9); fainting outdoors does the same', () => {
    const s = quiet();
    atCot(s);
    expect(s.player.interactTarget).toBe('cot');
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'uiRequest', ui: 'sleepConfirm' });
    const ev = step(s, cmd({ type: 'Sleep' }));
    expect(count(ev, 'morning')).toBe(1);
    expect(s.day).toBe(2);
    const bed = shopTileCenter(18, 9);
    expect([s.player.area, s.player.x, s.player.y]).toEqual(['shop', bed.x, bed.y]);

    const f = quiet();
    outside(f, 5, 7, 'down');
    f.player.hearts = 1;
    mudlet(f, f.player.x, f.player.y);
    const fev = step(f, neutralFrame());
    expect(count(fev, 'playerFainted')).toBe(1);
    expect(f.day).toBe(2);
    expect([f.player.area, f.player.x, f.player.y, f.player.hearts]).toEqual(['shop', bed.x, bed.y, TUNING.player.hearts]);
  });
});

describe('shelves', () => {
  it('StockShelf moves a potion, a ground item and a raw item; ClearShelf gives everything back', () => {
    const s = quiet();
    Object.assign(s.inventory, { glowdraught: 6, glowdust: 3, mint: 2 });
    stock(s, 0, 'glowdraught', 4);
    stock(s, 1, 'glowdust', 3);
    stock(s, 2, 'mint', 1);
    expect(s.shop.shelves.map((x) => [x.item, x.count])).toEqual([
      ['glowdraught', 4],
      ['glowdust', 3],
      ['mint', 1],
      [null, 0],
    ]);
    expect([s.inventory.glowdraught, s.inventory.glowdust, s.inventory.mint]).toEqual([2, 0, 1]);
    // Stocking the same item again tops the shelf up.
    stock(s, 0, 'glowdraught', 1);
    expect(s.shop.shelves[0]).toEqual({ item: 'glowdraught', count: 5 });
    atShelf(s, 0);
    step(s, cmd({ type: 'ClearShelf', shelf: 0 }));
    expect(s.shop.shelves[0]).toEqual({ item: null, count: 0 });
    expect(s.inventory.glowdraught).toBe(6);
  });

  it('rejects over 5, more than owned, another item on a stocked shelf, a top-up over capacity, a shelf not targeted', () => {
    const s = quiet();
    Object.assign(s.inventory, { tonic: 9, salve: 2 });
    atShelf(s, 0);
    expectRejected(s, { type: 'StockShelf', shelf: 0, item: 'tonic', qty: 6 });
    expectRejected(s, { type: 'StockShelf', shelf: 0, item: 'salve', qty: 3 });
    for (const qty of [0, -1, 1.5]) expectRejected(s, { type: 'StockShelf', shelf: 0, item: 'tonic', qty });
    expectRejected(s, { type: 'StockShelf', shelf: 1, item: 'tonic', qty: 1 });
    step(s, cmd({ type: 'StockShelf', shelf: 0, item: 'tonic', qty: 3 }));
    expectRejected(s, { type: 'StockShelf', shelf: 0, item: 'salve', qty: 1 });
    expectRejected(s, { type: 'StockShelf', shelf: 0, item: 'tonic', qty: 3 });
    expectRejected(s, { type: 'ClearShelf', shelf: 1 });
    atCounter(s);
    expectRejected(s, { type: 'StockShelf', shelf: 0, item: 'tonic', qty: 1 });
    expectRejected(s, { type: 'ClearShelf', shelf: 0 });
    expect(s.shop.shelves[0]).toEqual({ item: 'tonic', count: 3 });
  });

  it('interact on a shelf asks for its panel', () => {
    const s = quiet();
    atShelf(s, 2);
    expect(s.player.interactTarget).toBe('shelf2');
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'uiRequest', ui: 'shelf', shelf: 2 });
  });
});

describe('prices and reactions', () => {
  it('first prices are max(1, round(0.7 x value)) for every item', () => {
    const s = quiet();
    expect(s.shop.prices).toEqual({
      mint: 1,
      reed: 1,
      bogwood: 1,
      glowcap: 3,
      mudgel: 3,
      emberroot: 8,
      mintpaste: 2,
      glowdust: 4,
      emberpowder: 13,
      tonic: 10,
      salve: 13,
      glowdraught: 17,
      emberelixir: 42,
    });
    // An untouched price never refuses at full demand, whatever the mood.
    for (const id of ITEM_IDS) expect(reactTo(s, id, s.shop.prices[id], TUNING.stall.personalMax).sold, id).toBe(true);
  });

  it('glowdraught, value 24, personal 1: 19 delighted, 20 and 26 happy (sold), 27 and 31 grumbling, 32 refuses (not sold)', () => {
    const s = quiet();
    expect(itemValue(s, 'glowdraught')).toBeCloseTo(24);
    const at = (price: number): [string, boolean] => {
      const r = reactTo(s, 'glowdraught', price, 1);
      return [r.reaction, r.sold];
    };
    expect(at(19)).toEqual(['delighted', true]);
    expect(at(20)).toEqual(['happy', true]);
    expect(at(26)).toEqual(['happy', true]);
    // A grumble no longer buys (specs/wp/WP10).
    expect(at(27)).toEqual(['grumbling', false]);
    expect(at(31)).toEqual(['grumbling', false]);
    expect(at(32)).toEqual(['refuses', false]);
  });

  it('a raw item goes through the same rule: mint, value 2, personal 1: 2 is happy, 3 refuses', () => {
    const s = quiet();
    expect(reactTo(s, 'mint', 2, 1)).toEqual({ reaction: 'happy', sold: true });
    expect(reactTo(s, 'mint', 3, 1)).toEqual({ reaction: 'refuses', sold: false });
  });

  it('SetPrice at any shelf clamps to 1 and persists across a sleep; away from a shelf it is rejected', () => {
    const s = quiet();
    atShelf(s, 3);
    step(s, cmd({ type: 'SetPrice', item: 'tonic', price: 0 }, { type: 'SetPrice', item: 'mint', price: -5 }));
    step(s, cmd({ type: 'SetPrice', item: 'glowdraught', price: 23 }));
    expect([s.shop.prices.tonic, s.shop.prices.mint, s.shop.prices.glowdraught]).toEqual([1, 1, 23]);
    atCot(s);
    expectRejected(s, { type: 'SetPrice', item: 'tonic', price: 30 });
    step(s, cmd({ type: 'Sleep' }));
    expect([s.shop.prices.tonic, s.shop.prices.mint, s.shop.prices.glowdraught]).toEqual([1, 1, 23]);
    outside(s, 5, 7, 'down');
    expectRejected(s, { type: 'SetPrice', item: 'tonic', price: 30 });
  });
});

describe('the sign', () => {
  it('OpenStall needs a stocked shelf and works once a day; by day it also starts the evening', () => {
    const s = quiet();
    s.inventory.tonic = 2;
    atSign(s);
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'uiRequest', ui: 'toast', text: 'STOCK A SHELF FIRST' });
    expectRejected(s, { type: 'OpenStall' });
    expect(s.phase).toBe('day');

    stock(s, 0, 'tonic', 2);
    atSign(s);
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'uiRequest', ui: 'openShopConfirm' });
    const ev = step(s, cmd({ type: 'OpenStall' }));
    expect(s.phase).toBe('evening');
    expect(ev.filter((e) => e.type === 'eveningStarted')).toHaveLength(1);
    expect(ev).toContainEqual({ type: 'stallOpened' });
    expect(s.shop.phase).toBe('open');
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'uiRequest', ui: 'closeShopConfirm' });
    step(s, cmd({ type: 'CloseStall' }));
    expect(s.shop.phase).toBe('done');
    expectRejected(s, { type: 'OpenStall' });
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'uiRequest', ui: 'toast', text: 'SHOP IS DONE FOR TODAY' });

    // Away from the sign.
    const away = quiet();
    away.inventory.tonic = 1;
    stock(away, 0, 'tonic', 1);
    expectRejected(away, { type: 'OpenStall' });
    expect(away.phase).toBe('day');
  });
});

describe('customers', () => {
  it('personal 1, glowdraught at 20: one unit leaves the shelf at the decision, coins and demand wait for RingUp', () => {
    const s = openWithOne('glowdraught', 2, 20);
    const ev = until(s, 'customerReacted');
    expect(ev).toContainEqual({ type: 'customerArrived', item: 'glowdraught' });
    expect(ev).toContainEqual({ type: 'customerReacted', item: 'glowdraught', price: 20, reaction: 'happy', sold: true });
    expect(s.shop.shelves[0]).toEqual({ item: 'glowdraught', count: 1 });
    expect(s.coins).toBe(0);
    expect(s.shop.demand.glowdraught).toBe(1);
    expect(s.shop.history.glowdraught).toEqual([{ price: 20, reaction: 'happy' }]);
    until(s, 'customerQueued');
    expect(s.coins).toBe(0);
    expect(s.shop.demand.glowdraught).toBe(1);
    const ring = step(s, cmd({ type: 'RingUp' }));
    expect(ring.filter((e) => e.type === 'sale')).toEqual([{ type: 'sale', item: 'glowdraught', price: 20, qty: 1 }]);
    expect(s.coins).toBe(20);
    expect(s.shop.demand.glowdraught).toBeCloseTo(0.96);
  });

  it('personal 1, glowdraught at 32: refuses, the shelf keeps its stock, nobody queues', () => {
    const s = openWithOne('glowdraught', 2, 32);
    const ev = serve(s);
    expect(ev).toContainEqual({ type: 'customerReacted', item: 'glowdraught', price: 32, reaction: 'refuses', sold: false });
    expect(count(ev, 'customerQueued')).toBe(0);
    expect(count(ev, 'sale')).toBe(0);
    expect(s.shop.shelves[0]).toEqual({ item: 'glowdraught', count: 2 });
    expect(s.shop.phase).toBe('done');
  });

  it('a raw item sells too: mint at 2, personal 1, is happy and pays 2', () => {
    const s = openWithOne('mint', 1, 2);
    const ev = serve(s);
    expect(ev).toContainEqual({ type: 'customerReacted', item: 'mint', price: 2, reaction: 'happy', sold: true });
    expect(s.coins).toBe(2);
  });

  it('a queued customer not rung up leaves at tick 1800 of waiting, not 1799, the unit back on its shelf', () => {
    expect(PATIENCE_TICKS).toBe(1800);
    const s = openWithOne('glowdraught', 1, 17);
    until(s, 'customerQueued');
    expect(s.shop.shelves[0]).toEqual({ item: null, count: 0 });
    const before = run(s, PATIENCE_TICKS - 1);
    expect(count(before, 'customerLeftUnpaid')).toBe(0);
    expect(s.shop.customers[0]!.holding).toBe(true);
    const at = step(s, neutralFrame());
    expect(at).toContainEqual({ type: 'customerLeftUnpaid', item: 'glowdraught' });
    expect(s.coins).toBe(0);
    expect(s.shop.demand.glowdraught).toBe(1);
    expect(s.shop.shelves[0]).toEqual({ item: 'glowdraught', count: 1 });
    expect(s.inventory.glowdraught).toBe(0);
    // A RingUp now is too late.
    expectRejected(s, { type: 'RingUp' });
  });

  it('the unpaid unit goes to the inventory when its shelf meanwhile holds another item, or is full', () => {
    const other = openWithOne('glowdraught', 1, 17);
    until(other, 'customerQueued');
    other.inventory.tonic = 1;
    stock(other, 0, 'tonic', 1);
    until(other, 'customerLeftUnpaid');
    expect(other.shop.shelves[0]).toEqual({ item: 'tonic', count: 1 });
    expect(other.inventory.glowdraught).toBe(1);

    const full = openWithOne('glowdraught', 5, 17);
    until(full, 'customerQueued');
    full.inventory.glowdraught = 1;
    stock(full, 0, 'glowdraught', 1);
    expect(full.shop.shelves[0]).toEqual({ item: 'glowdraught', count: 5 });
    until(full, 'customerLeftUnpaid');
    expect(full.shop.shelves[0]).toEqual({ item: 'glowdraught', count: 5 });
    expect(full.inventory.glowdraught).toBe(1);
  });

  it('RingUp with nobody on queue spot 1, or away from the counter, changes nothing', () => {
    const s = openWithOne('tonic', 1, 5);
    expectRejected(s, { type: 'RingUp' });
    until(s, 'customerQueued');
    atShelf(s, 1);
    expectRejected(s, { type: 'RingUp' });
    atCounter(s);
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'sale', item: 'tonic', price: 5, qty: 1 });
  });

  it('never more than 2 indoors; 6 customers with one plot, 8 with two; every sale paid', () => {
    const stocked: [ItemId, number, number][] = [0, 1, 2, 3].map(() => ['tonic', 5, 1]);
    const s = openShop(stocked);
    const ev = serve(s, 20000, () => expect(s.shop.customers.length).toBeLessThanOrEqual(TUNING.shop.maxIndoors));
    expect(s.shop.phase).toBe('done');
    expect(s.shop.entered).toBe(6);
    expect(count(ev, 'sale')).toBe(6);
    expect(ev.filter((e) => e.type === 'stallClosed')).toEqual([{ type: 'stallClosed', soldCount: 6, soldCoins: 6 }]);

    const t = quiet(2);
    t.plots[1]!.owned = true;
    setPhase(t, 'evening');
    t.inventory.tonic = 20;
    for (let i = 0; i < 4; i++) stock(t, i, 'tonic', 5, 1);
    atSign(t);
    step(t, cmd({ type: 'OpenStall' }));
    atCounter(t);
    serve(t);
    expect(t.shop.entered).toBe(8);
  });

  it('the shop is not done while a customer holds an unpaid potion; then the bare shelves end it', () => {
    const s = openShop([['tonic', 1, 1]]);
    until(s, 'customerQueued');
    expect(s.shop.shelves.every((x) => x.item === null)).toBe(true);
    run(s, 600, neutralFrame());
    expect(s.shop.phase).toBe('open');
    const ev = serve(s);
    expect(count(ev, 'sale')).toBe(1);
    expect(s.shop.phase).toBe('done');
  });

  it('CloseStall and Sleep make holders pay; stallClosed.soldCoins equals the coins gained', () => {
    const s = openWithOne('tonic', 2, 5);
    until(s, 'customerQueued');
    atSign(s);
    const ev = step(s, cmd({ type: 'CloseStall' }));
    expect(ev).toContainEqual({ type: 'sale', item: 'tonic', price: 5, qty: 1 });
    expect(ev).toContainEqual({ type: 'stallClosed', soldCount: 1, soldCoins: 5 });
    expect(s.coins).toBe(5);
    expect(s.shop.phase).toBe('done');

    const z = openWithOne('tonic', 2, 7);
    until(z, 'customerQueued');
    atCot(z);
    const zev = step(z, cmd({ type: 'Sleep' }));
    expect(zev).toContainEqual({ type: 'stallClosed', soldCount: 1, soldCoins: 7 });
    expect(z.coins).toBe(7);
    expect(z.day).toBe(2);
    expect(z.shop.customers).toEqual([]);
  });

  // The shopkeeper's side is rows 9 and 10 with x 1 to 4 since specs/wp/WP11; the queue is (3,7), (4,7).
  it.each([
    ['four tables', [] as CatalogId[]],
    ['six tables', ['shelf5', 'shelf6'] as CatalogId[]],
  ])('customers walk from the door to every shelf, and from every shelf to both queue spots, never behind the counter (%s)', (_name, owned) => {
    const W = 22;
    const at = (x: number, y: number): number => y * W + x;
    const s = quiet();
    s.catalog.owned = [...owned];
    const tables: [number, number][] = SHELF_X.map((x) => [x, 5]);
    if (owned.length > 0) tables.push([9, 8], [12, 8]);
    const routes: [number, number][] = [];
    for (const [x, y] of tables) {
      routes.push([at(7, 10), at(x, y)]);
      for (const q of [3, 4]) routes.push([at(x, y), at(q, 7)]);
      routes.push([at(x, y), at(7, 10)]);
    }
    routes.push([at(4, 7), at(3, 7)], [at(3, 7), at(7, 10)], [at(4, 7), at(7, 10)]);
    for (const [a, b] of routes) {
      const path = pathBetween(s, a, b);
      expect(path.at(-1), `${a} -> ${b}`).toBe(b);
      for (const i of path) {
        const x = i % W;
        const y = Math.floor(i / W);
        expect((y === 9 || y === 10) && x >= 1 && x <= 4, `${a} -> ${b} passes ${x},${y}`).toBe(false);
      }
    }
  });

  it('two in the queue: ring up spot 1, spot 2 steps forward still counting its patience, then rings up too', () => {
    const s = openShop([
      ['tonic', 5, 1],
      ['tonic', 5, 1],
    ]);
    s.shop.customersLeft = 1;
    for (let i = 0; i < 5000 && s.shop.customers.filter((c) => c.waited >= 0).length < 2; i++) step(s, neutralFrame());
    const second = s.shop.customers.find((c) => c.spot === 1)!;
    expect(second.mode).toBe('queued');
    const waited = second.waited;
    expect(count(step(s, cmd({ type: 'RingUp' })), 'sale')).toBe(1);
    expect(second.spot).toBe(0);
    expect(second.mode).toBe('toQueue');
    // Not yet at spot 1: RingUp does nothing.
    expectRejected(s, { type: 'RingUp' });
    for (let i = 0; i < 200 && second.mode !== 'queued'; i++) step(s, neutralFrame());
    expect(second.mode).toBe('queued');
    expect(second.waited).toBeGreaterThan(waited);
    expect(count(step(s, cmd({ type: 'RingUp' })), 'sale')).toBe(1);
    expect(s.coins).toBe(2);
  });

  // specs/wp/WP11: the shopkeeper rings up from below the counter, customers queue above it.
  it('from (3,9) facing up the counter is the target and RingUp pays; from (3,7) facing down it is not and RingUp is rejected', () => {
    const s = openWithOne('tonic', 1, 5);
    until(s, 'customerQueued');
    inside(s, 3, 7, 'down');
    expect(s.player.interactTarget).not.toBe('counter');
    expectRejected(s, { type: 'RingUp' });
    inside(s, 3, 9, 'up');
    expect(s.player.interactTarget).toBe('counter');
    expect(step(s, cmd({ type: 'RingUp' }))).toContainEqual({ type: 'sale', item: 'tonic', price: 5, qty: 1 });
    expect(s.coins).toBe(5);
  });

  it('a buyer queues on (3,7) facing down; a second waits on (4,7) and steps to (3,7) when the first is paid', () => {
    const center = (x: number, y: number): [number, number] => [shopTileCenter(x, y).x, shopTileCenter(x, y).y];
    const s = openShop([
      ['tonic', 5, 1],
      ['tonic', 5, 1],
    ]);
    s.shop.customersLeft = 1;
    for (let i = 0; i < 5000 && s.shop.customers.filter((c) => c.mode === 'queued').length < 2; i++) step(s, neutralFrame());
    const first = s.shop.customers.find((c) => c.spot === 0)!;
    const second = s.shop.customers.find((c) => c.spot === 1)!;
    expect([first.mode, second.mode]).toEqual(['queued', 'queued']);
    expect([first.x, first.y]).toEqual(center(3, 7));
    expect([second.x, second.y]).toEqual(center(4, 7));
    expect([first.facing, second.facing]).toEqual(['down', 'down']);
    expect(count(step(s, cmd({ type: 'RingUp' })), 'sale')).toBe(1);
    for (let i = 0; i < 200 && second.mode !== 'queued'; i++) step(s, neutralFrame());
    expect(second.mode).toBe('queued');
    expect([second.x, second.y]).toEqual(center(3, 7));
    expect(second.facing).toBe('down');
  });

  it('a customer whose shelf was emptied on the way goes to another stocked shelf, or leaves when there is none', () => {
    const s = openShop([
      ['tonic', 1, 1],
      ['salve', 1, 1],
    ]);
    s.shop.customersLeft = 0;
    const c = s.shop.customers[0]!;
    const other = 1 - c.shelf;
    atShelf(s, c.shelf);
    step(s, cmd({ type: 'ClearShelf', shelf: c.shelf }));
    atCounter(s);
    const ev = until(s, 'customerArrived');
    expect(ev).toContainEqual({ type: 'customerArrived', item: other === 0 ? 'tonic' : 'salve' });

    const t = openShop([['tonic', 1, 1]]);
    t.shop.customersLeft = 0;
    atShelf(t, 0);
    step(t, cmd({ type: 'ClearShelf', shelf: 0 }));
    atCounter(t);
    const tev = run(t, 1500);
    expect(count(tev, 'customerArrived')).toBe(0);
    expect(t.shop.customers).toEqual([]);
    expect(t.shop.phase).toBe('done');
  });

  it('history keeps only the last 3 entries per item', () => {
    const s = openShop([['tonic', 5, 2]]);
    const ev = serve(s);
    expect(count(ev, 'customerReacted')).toBe(5);
    expect(s.shop.history.tonic).toHaveLength(3);
    expect(s.shop.history.salve).toEqual([]);
  });
});

describe('demand', () => {
  it('a sale lowers demand by 0.04, a grumble (no sale since WP10) leaves it, never below 0.6; a night adds 0.15 up to 1.0', () => {
    const s = openWithOne('glowdraught', 1, 1);
    serve(s);
    expect(s.shop.demand.glowdraught).toBeCloseTo(0.96);

    // 29 on a value of 24 is grumbling (r 1.21).
    const g = openWithOne('glowdraught', 1, 29);
    const gev = serve(g);
    expect(gev).toContainEqual(expect.objectContaining({ type: 'customerReacted', reaction: 'grumbling', sold: false }));
    expect(g.shop.demand.glowdraught).toBe(1);

    const f = quiet();
    f.shop.demand.tonic = 0.62;
    setPhase(f, 'evening');
    f.inventory.tonic = 1;
    stock(f, 0, 'tonic', 1, 1);
    atSign(f);
    step(f, cmd({ type: 'OpenStall' }));
    atCounter(f);
    serve(f);
    expect(f.shop.demand.tonic).toBeCloseTo(0.6);

    f.shop.demand.salve = 0.7;
    f.shop.demand.mint = 0.9;
    atCot(f);
    step(f, cmd({ type: 'Sleep' }));
    expect(f.shop.demand.tonic).toBeCloseTo(0.75);
    expect(f.shop.demand.salve).toBeCloseTo(0.85);
    expect(f.shop.demand.mint).toBeCloseTo(1.0);
    expect(f.shop.demand.glowdraught).toBeCloseTo(1.0);
  });
});

describe('trend', () => {
  it('day 1 has no trend and no trendAnnounced; from day 2 on, exactly one per evening', () => {
    const s = quiet();
    atSign(s);
    expect(s.shop.trend).toBeNull();
    expect(count(setPhase(s, 'evening'), 'trendAnnounced')).toBe(0);
    for (let day = 2; day <= 5; day++) {
      atCot(s);
      step(s, cmd({ type: 'Sleep' }));
      s.creatures = [];
      s.nodes = [];
      expect(s.day).toBe(day);
      atSign(s);
      const ev = setPhase(s, 'evening');
      expect(ev.filter((e) => e.type === 'trendAnnounced')).toEqual([{ type: 'trendAnnounced', item: s.shop.trend }]);
      const types = ev.map((e) => e.type);
      expect(types.indexOf('trendAnnounced')).toBe(types.indexOf('eveningStarted') + 1);
      expect(count([...ev, ...step(s, neutralFrame())], 'trendAnnounced')).toBe(1);
    }
  });

  it('200 mornings on the home plot: never emberelixir, always tonic, salve or glowdraught; glowdraught trending is worth 31.2', () => {
    const s = createInitialState(3);
    const seen = new Set<PotionId | null>();
    for (let i = 0; i < 200; i++) {
      morningReset(s, []);
      seen.add(s.shop.trend);
    }
    expect([...seen].sort()).toEqual(['glowdraught', 'salve', 'tonic']);
    s.shop.trend = 'glowdraught';
    s.shop.demand.glowdraught = 1;
    expect(itemValue(s, 'glowdraught')).toBeCloseTo(31.2);
    expect(itemValue(s, 'tonic')).toBeCloseTo(14);
  });

  it('with the east plot owned, emberelixir can trend', () => {
    const s = createInitialState(3);
    s.plots[1]!.owned = true;
    const seen = new Set<PotionId | null>();
    for (let i = 0; i < 100; i++) {
      morningReset(s, []);
      seen.add(s.shop.trend);
    }
    expect(seen.has('emberelixir')).toBe(true);
  });
});

describe('land', () => {
  function atSignpost(coins: number): GameState {
    const s = quiet();
    s.coins = coins;
    outside(s, 18, 6, 'right');
    expect(s.player.interactTarget).toBe('signpost');
    return s;
  }

  it('the signpost asks to buy the east plot', () => {
    const s = atSignpost(0);
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'uiRequest', ui: 'buyPlotConfirm', plot: 1 });
  });

  it('BuyPlot with 149 coins is rejected; with 150 the east plot is owned, filled, and walkable', () => {
    expectRejected(atSignpost(149), { type: 'BuyPlot', plot: 1 });

    const s = atSignpost(150);
    const ev = step(s, cmd({ type: 'BuyPlot', plot: 1 }));
    expect(ev).toContainEqual({ type: 'plotBought', plot: 1 });
    expect(s.coins).toBe(0);
    expect(s.plots[1]!.owned).toBe(true);
    const east = (type: string): number => s.nodes.filter((n) => n.plot === 1 && n.type === type).length;
    expect(Object.fromEntries(NODES.map((n) => [n.id, east(n.id)]))).toEqual({
      mintbush: 0,
      glowcaps: 3,
      reedclump: 3,
      stump: 2,
      emberplant: 4,
    });
    expect(s.creatures.filter((c) => c.plot === 1).length).toBe(4);
    // The signpost is gone: no target, no wall. Walk east through its tile into the plot.
    expect(s.player.interactTarget).toBeNull();
    expectRejected(s, { type: 'BuyPlot', plot: 1 });
    s.creatures = [];
    s.nodes = s.nodes.filter((n) => n.plot === 0);
    run(s, 90, move(1, 0));
    expect(tileAt(s.player.x)).toBeGreaterThanOrEqual(23);
  });

  it('BuyPlot away from the signpost is rejected', () => {
    const s = quiet();
    s.coins = 500;
    atSign(s);
    expectRejected(s, { type: 'BuyPlot', plot: 1 });
  });
});

describe('goal', () => {
  it('fires on the first Ember Elixir paid for, not when it is picked up; once only', () => {
    const s = openShop([['emberelixir', 2, 5]]);
    const ev: GameEvent[] = [];
    let decided = false;
    serve(s, 20000, () => {
      if (!decided && s.shop.customers.some((c) => c.holding)) {
        decided = true;
        expect(s.flags.m1Goal).toBe(false);
      }
    });
    expect(decided).toBe(true);
    expect(s.flags.m1Goal).toBe(true);
    // A second game, collecting events: one goal for two sales, right after the first sale.
    const t = openShop([['emberelixir', 2, 5]]);
    ev.push(...serve(t));
    expect(count(ev, 'sale')).toBe(2);
    expect(count(ev, 'goalReached')).toBe(1);
    const first = ev.findIndex((e) => e.type === 'sale');
    expect(ev[first + 1]).toEqual({ type: 'goalReached' });
  });
});

describe('customer types (specs/wp/WP09)', () => {
  const kindOf = (item: ItemId): string => ITEMS.find((i) => i.id === item)!.kind;

  it('over 4000 rolls the shares are within 3 points of 50 / 20 / 15 / 15', () => {
    const s = quiet(11);
    const n: Record<CustomerType, number> = { traveller: 0, courier: 0, haggler: 0, herbalist: 0 };
    for (let i = 0; i < 4000; i++) n[rollType(s)] += 1;
    const want: Record<CustomerType, number> = { traveller: 50, courier: 20, haggler: 15, herbalist: 15 };
    for (const t of CUSTOMER_TYPES) expect(Math.abs((100 * n[t.id]) / 4000 - want[t.id]), t.id).toBeLessThanOrEqual(3);
  });

  it('a courier pays 1.25 on potions, a haggler 0.85 on all, a herbalist 1.5 on raw and ground; thresholds unchanged', () => {
    const s = quiet();
    const at = (type: CustomerType, item: ItemId, price: number): string => reactTo(s, item, price, 1, type).reaction;
    // Glow draught, value 24: courier 30, haggler 20.4.
    expect(at('courier', 'glowdraught', 32)).toBe('happy');
    expect(at('courier', 'glowdraught', 40)).toBe('refuses');
    expect(at('haggler', 'glowdraught', 22)).toBe('happy');
    expect(at('haggler', 'glowdraught', 27)).toBe('refuses');
    expect(at('traveller', 'glowdraught', 26)).toBe('happy');
    expect(at('traveller', 'glowdraught', 31)).toBe('grumbling');
    expect(at('traveller', 'glowdraught', 32)).toBe('refuses');
    // Mint, value 2: a herbalist 3.
    expect(at('herbalist', 'mint', 3)).toBe('happy');
    expect(at('herbalist', 'mint', 4)).toBe('refuses');
    expect(at('traveller', 'mint', 3)).toBe('refuses');
    expect(at('herbalist', 'glowdraught', 32)).toBe('refuses');
    expect(at('courier', 'mint', 3)).toBe('refuses');
    // Bogwood (fuel) counts as raw: a herbalist values it at 1.5.
    expect(itemValue(s, 'bogwood') * typeMultiplier('herbalist', 'bogwood')).toBeCloseTo(1.5);
    expect(typeMultiplier('herbalist', 'emberpowder')).toBe(1.5);
  });

  // WP10: only delighted and happy buy, so the known exception is bogwood (first price 1) for a
  // haggler: 1 / (0.95 x 0.85) = 1.24 and 1 / (1.05 x 0.85) = 1.12, both grumbling.
  it('at demand 1 and no trend, the first price of every item is bought by every type at personal 0.95 and 1.05, except bogwood for a haggler', () => {
    const s = quiet();
    for (const id of ITEM_IDS) {
      for (const t of CUSTOMER_TYPES) {
        for (const p of [TUNING.stall.personalMin, TUNING.stall.personalMax]) {
          const r = reactTo(s, id, s.shop.prices[id], p, t.id);
          const exception = id === 'bogwood' && t.id === 'haggler';
          expect(r.sold, `${id} ${t.id} ${p}`).toBe(!exception);
          if (exception) expect(r.reaction).toBe('grumbling');
        }
      }
    }
  });

  const leaveAt: readonly [CustomerType, number][] = [
    ['courier', 720],
    ['haggler', 3000],
    ['traveller', 1800],
    ['herbalist', 1800],
  ];
  it("the counter toad's delay, trained or not, is shorter than every type's patience", () => {
    for (const t of CUSTOMER_TYPES) expect(ticks(TUNING.helpers.counterDelay), t.id).toBeLessThan(patienceTicks(t.id));
    expect(ticks(TUNING.helpers.counterDelayTrained)).toBeLessThan(ticks(TUNING.helpers.counterDelay));
  });

  for (const [type, ticksToLeave] of leaveAt) {
    it(`without a counter toad a ${type} leaves unpaid at waited ${ticksToLeave}, not before`, () => {
      expect(patienceTicks(type)).toBe(ticksToLeave);
      const s = openWithOne('glowdraught', 1, 17);
      s.shop.customers[0]!.type = type;
      until(s, 'customerQueued');
      const before = run(s, ticksToLeave - 1);
      expect(count(before, 'customerLeftUnpaid')).toBe(0);
      expect(s.shop.customers[0]!.waited).toBe(ticksToLeave - 1);
      expect(step(s, neutralFrame())).toContainEqual({ type: 'customerLeftUnpaid', item: 'glowdraught' });
    });
  }

  it('herbalists head for a raw or ground table: 200 of them with tonic and mint stocked all pick mint; with only tonic, tonic', () => {
    const s = quiet(3);
    s.shop.shelves[0] = { item: 'tonic', count: 5 };
    s.shop.shelves[2] = { item: 'mint', count: 5 };
    for (let i = 0; i < 200; i++) expect(pickShelf(s, 'herbalist')).toBe(2);
    const others = new Set<number | null>();
    for (let i = 0; i < 200; i++) others.add(pickShelf(s, 'traveller'));
    expect(others).toEqual(new Set([0, 2]));
    s.shop.shelves[2] = { item: null, count: 0 };
    for (let i = 0; i < 50; i++) expect(pickShelf(s, 'herbalist')).toBe(0);
    s.shop.shelves[0] = { item: null, count: 0 };
    expect(pickShelf(s, 'herbalist')).toBeNull();
  });

  it('in the shop every herbalist browses the mint table while tonic and mint are stocked', () => {
    const s = openShop([
      ['tonic', 5, 1],
      ['mint', 5, 1],
    ]);
    s.shop.customersLeft = 150;
    const seen = new Map<number, { type: CustomerType; shelf: number }>();
    serve(s, 200000, () => {
      s.shop.shelves[0] = { item: 'tonic', count: 5 };
      s.shop.shelves[1] = { item: 'mint', count: 5 };
      for (const c of s.shop.customers) if (c.mode === 'look') seen.set(c.n, { type: c.type!, shelf: c.shelf });
    });
    const herbalists = [...seen.values()].filter((v) => v.type === 'herbalist');
    expect(herbalists.length).toBeGreaterThan(5);
    expect(herbalists.every((v) => v.shelf === 1)).toBe(true);
    expect([...seen.values()].some((v) => v.shelf === 0)).toBe(true);
  });

  it('a herbalist whose table was emptied before arrival re-picks by the same rule: a raw table while one is stocked', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = openShop(
        [
          ['tonic', 2, 1],
          ['salve', 2, 1],
          ['mint', 2, 1],
          ['reed', 2, 1],
        ],
        seed,
      );
      const c = s.shop.customers[0]!;
      c.type = 'herbalist';
      const first = c.shelf;
      s.shop.shelves[first] = { item: null, count: 0 };
      // Another customer may come in and reach a table first: follow this one.
      for (let i = 0; i < 5000 && c.mode === 'toShelf'; i++) step(s, neutralFrame());
      expect(c.mode, `seed ${seed}`).toBe('look');
      expect(c.shelf, `seed ${seed}`).not.toBe(first);
      expect(kindOf(c.item!), `seed ${seed}`).toBe('raw');
    }
  });

  it('met gains a type on its first payment only, once', () => {
    const s = openWithOne('glowdraught', 3, 17);
    until(s, 'customerQueued');
    // Choosing and queueing is not paying.
    expect(s.shop.met).toEqual([]);
    atCounter(s);
    step(s, cmd({ type: 'RingUp' }));
    expect(s.shop.met).toEqual(['traveller']);
    // Two more: another traveller, then a courier.
    s.shop.customersLeft = 2;
    const types: CustomerType[] = ['traveller', 'courier'];
    serve(s, 20000, () => {
      for (const c of s.shop.customers) if (c.n > 0 && c.mode === 'toShelf') c.type = types[c.n - 1];
    });
    expect(s.shop.soldCount).toBe(3);
    expect(s.shop.met).toEqual(['traveller', 'courier']);
  });
});

describe('unhappy customers do not buy (specs/wp/WP10)', () => {
  it('a traveller on glowdraught (base 24), personal 1: buys at 26 (happy), not at 27 (grumbling) nor at 32 (refuses)', () => {
    for (const [price, reaction, sold] of [
      [26, 'happy', true],
      [27, 'grumbling', false],
      [32, 'refuses', false],
    ] as const) {
      const s = openWithOne('glowdraught', 1, price);
      const ev = serve(s);
      expect(ev, `${price}`).toContainEqual({ type: 'customerReacted', item: 'glowdraught', price, reaction, sold });
      expect(s.shop.history.glowdraught, `${price}`).toEqual([{ price, reaction }]);
      expect(count(ev, 'sale'), `${price}`).toBe(sold ? 1 : 0);
    }
  });

  it('after a grumble the table keeps its unit, coins and demand are unchanged, and the customer leaves without queueing', () => {
    const s = openWithOne('glowdraught', 1, 27);
    const coins = s.coins;
    const ev = until(s, 'customerReacted');
    const c = s.shop.customers[0]!;
    expect(c).toMatchObject({ reaction: 'grumbling', holding: false });
    expect(s.shop.shelves[0]).toEqual({ item: 'glowdraught', count: 1 });
    // Watch it walk out: it never takes a queue spot, never carries, never counts as unpaid.
    for (let i = 0; i < 5000 && s.shop.customers.includes(c); i++) {
      ev.push(...step(s, neutralFrame()));
      expect(c.spot).toBe(-1);
      expect(c.holding).toBe(false);
    }
    expect(s.shop.customers).not.toContain(c);
    expect(c.mode).toBe('leaving');
    expect(count(ev, 'customerQueued')).toBe(0);
    expect(count(ev, 'customerLeftUnpaid')).toBe(0);
    expect(count(ev, 'sale')).toBe(0);
    expect(s.shop.shelves[0]).toEqual({ item: 'glowdraught', count: 1 });
    expect(s.coins).toBe(coins);
    expect(s.shop.demand.glowdraught).toBe(1);
  });

  it('a haggler does not buy glowdraught at 23 and buys at 22; a courier buys it at 32 and not at 34', () => {
    const s = quiet();
    const buys = (type: CustomerType, price: number): boolean => reactTo(s, 'glowdraught', price, 1, type).sold;
    expect(buys('haggler', 22)).toBe(true);
    expect(buys('haggler', 23)).toBe(false);
    expect(buys('courier', 32)).toBe(true);
    expect(buys('courier', 34)).toBe(false);
  });
});
