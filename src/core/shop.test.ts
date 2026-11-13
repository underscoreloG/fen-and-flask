import { describe, expect, it } from 'vitest';
import { ITEM_IDS, NODES, type ItemId, type PotionId } from '../data/content';
import { TUNING } from '../data/tuning';
import { morningReset, setPhase } from './clock';
import { neutralFrame, type Command, type Frame } from './commands';
import type { GameEvent } from './events';
import { itemValue, pathBetween, PATIENCE_TICKS, reactTo } from './shop';
import { createInitialState, type CreatureState, type GameState } from './state';
import { step } from './step';
import { plotTileCenter, shopTileCenter, TILE, tileAt } from './world';

const cmd = (...commands: Command[]): Frame => ({ ...neutralFrame(), commands });
const move = (moveX: number, moveY: number): Frame => ({ ...neutralFrame(), moveX, moveY });
const count = (ev: GameEvent[], type: GameEvent['type']): number => ev.filter((e) => e.type === type).length;
type Facing = GameState['player']['facing'];

// Interact tiles of the interior (specs/wp/WP06).
const SHELF_X = [3, 6, 9, 12];
const AT = { counter: [3, 7], sign: [9, 9], cot: [18, 9] } as const;

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
const atCounter = (s: GameState): void => inside(s, AT.counter[0], AT.counter[1], 'down');
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
    ['counter', [3, 7], [3, 8], 0, 1],
    ['counter, customer side', [3, 9], [3, 8], 0, -1],
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

  it('glowdraught, value 24, personal 1: 19 delighted, 20 and 26 happy, 27 and 31 grumbling, 32 refuses', () => {
    const s = quiet();
    expect(itemValue(s, 'glowdraught')).toBeCloseTo(24);
    const at = (price: number): [string, boolean] => {
      const r = reactTo(s, 'glowdraught', price, 1);
      return [r.reaction, r.sold];
    };
    expect(at(19)).toEqual(['delighted', true]);
    expect(at(20)).toEqual(['happy', true]);
    expect(at(26)).toEqual(['happy', true]);
    expect(at(27)).toEqual(['grumbling', true]);
    expect(at(31)).toEqual(['grumbling', true]);
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

  it('customers walk from the door to every shelf, and from every shelf to both queue spots, never behind the counter', () => {
    const W = 22;
    const at = (x: number, y: number): number => y * W + x;
    const routes: [number, number][] = [];
    for (const x of SHELF_X) {
      routes.push([at(7, 10), at(x, 5)]);
      for (const q of [3, 4]) routes.push([at(x, 5), at(q, 9)]);
      routes.push([at(x, 5), at(7, 10)]);
    }
    routes.push([at(4, 9), at(3, 9)], [at(3, 9), at(7, 10)]);
    for (const [a, b] of routes) {
      const path = pathBetween(quiet(), a, b);
      expect(path.at(-1), `${a} -> ${b}`).toBe(b);
      for (const i of path) {
        const x = i % W;
        const y = Math.floor(i / W);
        expect(y === 7 && x >= 1 && x <= 4, `${a} -> ${b} passes ${x},${y}`).toBe(false);
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
  it('a sale lowers demand by 0.04, a grumbling one by 0.09, never below 0.6; a night adds 0.15 up to 1.0', () => {
    const s = openWithOne('glowdraught', 1, 1);
    serve(s);
    expect(s.shop.demand.glowdraught).toBeCloseTo(0.96);

    // 29 on a value of 24 is grumbling (r 1.21).
    const g = openWithOne('glowdraught', 1, 29);
    const gev = serve(g);
    expect(gev).toContainEqual(expect.objectContaining({ type: 'customerReacted', reaction: 'grumbling', sold: true }));
    expect(g.shop.demand.glowdraught).toBeCloseTo(0.91);

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
