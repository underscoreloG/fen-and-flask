import { describe, expect, it } from 'vitest';
import { CATALOG, type CatalogId, type ItemId, type NodeId } from '../data/content';
import { TUNING } from '../data/tuning';
import { arriveUpgrades } from './catalog';
import { morningReset, setPhase } from './clock';
import { neutralFrame, type Command, type Frame } from './commands';
import type { GameEvent } from './events';
import { nodeDef, nodeHits } from './nodes';
import { nextFloat } from './rng';
import { customersFor, PATIENCE_TICKS } from './shop';
import { createInitialState, type GameState } from './state';
import { step } from './step';
import { plotOrigin, plotTileCenter, SHOP_TX, SHOP_TY, shopTileCenter, tileAt } from './world';

const cmd = (...commands: Command[]): Frame => ({ ...neutralFrame(), commands });
const SWING: Frame = { ...neutralFrame(), swing: true };
type Facing = GameState['player']['facing'];

// A new game with no nodes and no mudlets.
function quiet(seed = 1): GameState {
  const s = createInitialState(seed);
  s.nodes = [];
  s.creatures = [];
  return s;
}

// Delivers items as a morning would (the arrival step alone, so nothing else moves).
function own(s: GameState, ...ids: CatalogId[]): GameEvent[] {
  const ev: GameEvent[] = [];
  s.catalog.pending.push(...ids);
  arriveUpgrades(s, ev);
  return ev;
}

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

const atStand = (s: GameState): void => inside(s, 12, 9, 'down');

function run(s: GameState, n: number, frame: Frame = neutralFrame()): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...step(s, frame));
  return out;
}

function expectRejected(s: GameState, c: Command): void {
  const twin = structuredClone(s);
  const ev = step(s, cmd(c));
  const evTwin = step(twin, neutralFrame());
  expect(JSON.stringify(s)).toBe(JSON.stringify(twin));
  expect(ev).toEqual(evTwin);
}

// The player's tile, shop-local.
const shopTile = (x: number, y: number): [number, number] => [tileAt(x) - SHOP_TX, tileAt(y) - SHOP_TY];

describe('catalog table', () => {
  it('holds the 9 items of WP07 with their prices and requirements, then the 5 helpers of WP08: 14 in all', () => {
    expect(CATALOG).toHaveLength(14);
    expect(CATALOG.slice(0, 9).map((d) => [d.id, d.name, d.price, d.requires ?? null])).toEqual([
      ['stoneMortar', 'STONE MORTAR', 90, null],
      ['sickle', 'COPPER SICKLE', 120, null],
      ['beds2', 'TWO GARDEN BEDS', 150, null],
      ['shelf5', 'FIFTH TABLE', 200, null],
      ['signboard', 'PAINTED SIGNBOARD', 220, null],
      ['cauldron2', 'SECOND CAULDRON', 300, null],
      ['deepShelves', 'DEEP TABLES', 360, null],
      ['shelf6', 'SIXTH TABLE', 380, 'shelf5'],
      ['lanternSign', 'LANTERN SIGN', 480, 'signboard'],
    ]);
    expect(CATALOG.slice(9).map((d) => [d.id, d.name, d.price, d.requires ?? null])).toEqual([
      ['gardenToad', 'GARDEN TOAD', 280, null],
      ['counterToad', 'COUNTER TOAD', 320, null],
      ['basketToad', 'BASKET TOAD', 420, null],
      ['counterToad2', 'TRAINED COUNTER TOAD', 450, 'counterToad'],
      ['basketToad2', 'BIGGER BASKET', 520, 'basketToad'],
    ]);
    // The panel footer is one line inside a 220 px panel.
    for (const d of CATALOG) expect(d.effect.length, d.id).toBeLessThanOrEqual(34);
  });
});

describe('BuyUpgrade', () => {
  it('at the stand: takes the coins at once and lists the id as pending', () => {
    const s = quiet();
    s.coins = 500;
    atStand(s);
    expect(s.player.interactTarget).toBe('catalog');
    step(s, cmd({ type: 'BuyUpgrade', id: 'sickle' }));
    expect(s.coins).toBe(380);
    expect(s.catalog).toEqual({ owned: [], pending: ['sickle'] });
  });

  it('interact at the stand asks for the catalog panel', () => {
    const s = quiet();
    atStand(s);
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'uiRequest', ui: 'catalog' });
  });

  it('is rejected away from the stand, without the coins, for an owned, a pending or an unknown id, and for shelf6 while shelf5 is only pending', () => {
    const s = quiet();
    s.coins = 1000;
    inside(s, 9, 9, 'down');
    expectRejected(s, { type: 'BuyUpgrade', id: 'sickle' });
    atStand(s);
    s.coins = 119;
    expectRejected(s, { type: 'BuyUpgrade', id: 'sickle' });
    s.coins = 1000;
    own(s, 'stoneMortar');
    atStand(s);
    expectRejected(s, { type: 'BuyUpgrade', id: 'stoneMortar' });
    step(s, cmd({ type: 'BuyUpgrade', id: 'shelf5' }));
    expect(s.catalog.pending).toEqual(['shelf5']);
    expectRejected(s, { type: 'BuyUpgrade', id: 'shelf5' });
    expectRejected(s, { type: 'BuyUpgrade', id: 'nope' as CatalogId });
    expectRejected(s, { type: 'BuyUpgrade', id: 'shelf6' });
    expectRejected(s, { type: 'BuyUpgrade', id: 'lanternSign' });
    // Once shelf5 is owned, shelf6 sells.
    morningReset(s, []);
    atStand(s);
    step(s, cmd({ type: 'BuyUpgrade', id: 'shelf6' }));
    expect(s.catalog.pending).toEqual(['shelf6']);
  });
});

describe('arrival', () => {
  it('nothing changes until the morning reset; then upgradeArrived fires once per id, before morning, and the item acts that morning', () => {
    const s = quiet();
    s.coins = 1000;
    atStand(s);
    step(s, cmd({ type: 'BuyUpgrade', id: 'shelf5' }, { type: 'BuyUpgrade', id: 'signboard' }));
    expect(s.catalog.pending).toEqual(['shelf5', 'signboard']);
    run(s, 600);
    setPhase(s, 'evening');
    run(s, 60);
    expect(s.catalog.owned).toEqual([]);
    expect(s.shop.shelves).toHaveLength(4);
    expect(customersFor(s)).toBe(6);
    const ev: GameEvent[] = [];
    morningReset(s, ev);
    const types = ev.map((e) => e.type);
    expect(ev.filter((e) => e.type === 'upgradeArrived')).toEqual([
      { type: 'upgradeArrived', id: 'shelf5' },
      { type: 'upgradeArrived', id: 'signboard' },
    ]);
    expect(types.lastIndexOf('upgradeArrived')).toBeLessThan(types.indexOf('morning'));
    expect(s.catalog).toEqual({ owned: ['shelf5', 'signboard'], pending: [] });
    expect(s.shop.shelves).toHaveLength(5);
    expect(customersFor(s)).toBe(10);
    // A second morning delivers nothing more.
    const ev2: GameEvent[] = [];
    morningReset(s, ev2);
    expect(ev2.some((e) => e.type === 'upgradeArrived')).toBe(false);
  });
});

describe('tables 5 and 6', () => {
  it('before shelf5, (9,7) is floor and nothing but the sign is targeted from (9,8); after it, (9,7) is solid, the fifth table is the target and StockShelf works there', () => {
    const s = quiet();
    inside(s, 9, 8, 'up');
    expect(s.player.interactTarget === null || !s.player.interactTarget.startsWith('shelf')).toBe(true);
    run(s, 12, { ...neutralFrame(), moveY: -1 });
    expect(shopTile(s.player.x, s.player.y)).toEqual([9, 7]);
    run(s, 20, { ...neutralFrame(), moveY: -1 });
    expect(shopTile(s.player.x, s.player.y)[1]).toBeLessThan(7);

    own(s, 'shelf5');
    inside(s, 9, 8, 'up');
    expect(s.player.interactTarget).toBe('shelf4');
    run(s, 60, { ...neutralFrame(), moveY: -1 });
    expect(shopTile(s.player.x, s.player.y)).toEqual([9, 8]);
    inside(s, 9, 8, 'up');
    s.inventory.tonic = 3;
    step(s, cmd({ type: 'StockShelf', shelf: 4, item: 'tonic', qty: 3 }));
    expect(s.shop.shelves[4]).toEqual({ item: 'tonic', count: 3 });
    expect(s.inventory.tonic).toBe(0);
  });

  it('with six tables stocked, over 200 customers every table is browsed and nobody steps on a table or behind the counter', () => {
    const s = quiet();
    own(s, 'shelf5', 'shelf6');
    expect(s.shop.shelves).toHaveLength(6);
    const items: ItemId[] = ['tonic', 'salve', 'glowdraught', 'emberelixir', 'mint', 'reed'];
    s.shop.shelves.forEach((sl, i) => Object.assign(sl, { item: items[i], count: TUNING.shop.shelfCapacity }));
    for (const it of items) s.shop.prices[it] = 1;
    setPhase(s, 'evening');
    inside(s, 9, 9, 'down');
    step(s, cmd({ type: 'OpenStall' }));
    expect(s.shop.phase).toBe('open');
    s.shop.customersLeft = 200;
    inside(s, 3, 7, 'down');
    const browsed = new Set<number>();
    let served = 0;
    for (let i = 0; i < 200000 && s.shop.phase === 'open'; i++) {
      const waiting = s.shop.customers.some((c) => c.spot === 0 && c.mode === 'queued');
      for (const e of step(s, waiting ? cmd({ type: 'RingUp' }) : neutralFrame())) if (e.type === 'customerArrived') served += 1;
      s.shop.shelves.forEach((sl, k) => Object.assign(sl, { item: items[k], count: TUNING.shop.shelfCapacity }));
      for (const c of s.shop.customers) {
        if (c.mode === 'look') browsed.add(c.shelf);
        const [x, y] = shopTile(c.x, c.y);
        expect((x === 9 || x === 12) && y === 7, `customer on table tile ${x},${y}`).toBe(false);
        expect(y === 7 && x <= 4, `customer behind the counter ${x},${y}`).toBe(false);
      }
    }
    expect(served).toBe(200);
    expect([...browsed].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('customers per evening', () => {
  it('6 at start; 8 with shelf5; 10 with shelf5 and signboard; 17 with two plots and all four', () => {
    const s = quiet();
    expect(customersFor(s)).toBe(6);
    own(s, 'shelf5');
    expect(customersFor(s)).toBe(8);
    own(s, 'signboard');
    expect(customersFor(s)).toBe(10);
    own(s, 'shelf6', 'lanternSign');
    s.plots[1]!.owned = true;
    expect(customersFor(s)).toBe(17);
  });
});

// An rng state whose next roll is under the double chance (or not).
function rngFor(double: boolean): number {
  for (let r = 0; ; r++) if (nextFloat({ rng: r }) < TUNING.shop.doubleChance === double) return r;
}

// One customer on its way to table 1 holding `qty` tonic at the happy price 14, the next RNG roll set.
function oneBuyer(qty: number, deep: boolean, double: boolean): GameState {
  const s = quiet();
  if (deep) own(s, 'deepShelves');
  setPhase(s, 'evening');
  s.inventory.tonic = qty;
  inside(s, 3, 5, 'up');
  step(s, cmd({ type: 'StockShelf', shelf: 0, item: 'tonic', qty }, { type: 'SetPrice', item: 'tonic', price: 14 }));
  inside(s, 9, 9, 'down');
  step(s, cmd({ type: 'OpenStall' }));
  inside(s, 3, 7, 'down');
  expect(s.shop.customers).toHaveLength(1);
  s.shop.customers[0]!.personal = 1;
  s.shop.customers[0]!.type = 'traveller';
  s.shop.customersLeft = 0;
  s.rng = rngFor(double);
  return s;
}

function untilQueued(s: GameState): void {
  for (let i = 0; i < 5000 && !s.shop.customers.some((c) => c.mode === 'queued'); i++) step(s, neutralFrame());
  expect(s.shop.customers[0]!.mode).toBe('queued');
}

describe('deep tables', () => {
  it('stocking 8 works and 9 is rejected; without them 6 is rejected', () => {
    const s = quiet();
    s.inventory.tonic = 20;
    inside(s, 3, 5, 'up');
    expectRejected(s, { type: 'StockShelf', shelf: 0, item: 'tonic', qty: 6 });
    own(s, 'deepShelves');
    inside(s, 3, 5, 'up');
    expectRejected(s, { type: 'StockShelf', shelf: 0, item: 'tonic', qty: 9 });
    step(s, cmd({ type: 'StockShelf', shelf: 0, item: 'tonic', qty: 8 }));
    expect(s.shop.shelves[0]).toEqual({ item: 'tonic', count: 8 });
    expectRejected(s, { type: 'StockShelf', shelf: 0, item: 'tonic', qty: 1 });
  });

  it('a double: a happy customer takes 2, pays twice the price at ring-up, demand drops by 0.08, sale has qty 2', () => {
    const s = oneBuyer(8, true, true);
    untilQueued(s);
    expect(s.shop.shelves[0]).toEqual({ item: 'tonic', count: 6 });
    expect(s.shop.customers[0]).toMatchObject({ reaction: 'happy', qty: 2, holding: true });
    expect(s.coins).toBe(0);
    const ev = step(s, cmd({ type: 'RingUp' }));
    expect(ev.filter((e) => e.type === 'sale')).toEqual([{ type: 'sale', item: 'tonic', price: 14, qty: 2 }]);
    expect(s.coins).toBe(28);
    expect(s.shop.demand.tonic).toBeCloseTo(0.92, 10);
    expect(s.shop.soldCount).toBe(2);
  });

  it('a single when the roll fails, when the table holds 1, and without deep tables', () => {
    for (const [qty, deep, double] of [
      [8, true, false],
      [1, true, true],
      [5, false, true],
    ] as const) {
      const s = oneBuyer(qty, deep, double);
      untilQueued(s);
      expect(s.shop.customers[0]!.qty, `${qty} ${deep} ${double}`).toBe(1);
      const ev = step(s, cmd({ type: 'RingUp' }));
      expect(ev.filter((e) => e.type === 'sale')).toEqual([{ type: 'sale', item: 'tonic', price: 14, qty: 1 }]);
      expect(s.shop.demand.tonic).toBeCloseTo(0.96, 10);
    }
  });

  it('without deep tables no roll is made (the RNG is untouched)', () => {
    const s = oneBuyer(5, false, true);
    const rng = s.rng;
    untilQueued(s);
    expect(s.rng).toBe(rng);
  });

  it('a double that leaves unpaid puts both units back: on the table while it fits, the rest in the inventory', () => {
    const s = oneBuyer(8, true, true);
    untilQueued(s);
    s.shop.shelves[0]!.count = 7;
    const ev = run(s, PATIENCE_TICKS + 5);
    expect(ev.filter((e) => e.type === 'customerLeftUnpaid')).toHaveLength(1);
    expect(s.shop.shelves[0]).toEqual({ item: 'tonic', count: 8 });
    expect(s.inventory.tonic).toBe(1);
    expect(s.coins).toBe(0);
  });

  it('over 2000 buying customers on full tables, the share of doubles is within 3 points of 25%', () => {
    const s = quiet(4);
    own(s, 'deepShelves');
    setPhase(s, 'evening');
    s.shop.shelves[0] = { item: 'tonic', count: 8 };
    s.shop.prices.tonic = 1;
    inside(s, 9, 9, 'down');
    step(s, cmd({ type: 'OpenStall' }));
    s.shop.customersLeft = 2100;
    inside(s, 3, 7, 'down');
    let buyers = 0;
    let doubles = 0;
    for (let i = 0; i < 1000000 && buyers < 2000; i++) {
      const waiting = s.shop.customers.some((c) => c.spot === 0 && c.mode === 'queued');
      for (const e of step(s, waiting ? cmd({ type: 'RingUp' }) : neutralFrame())) {
        if (e.type !== 'sale') continue;
        buyers += 1;
        if (e.qty === 2) doubles += 1;
      }
      s.shop.shelves[0] = { item: 'tonic', count: 8 };
    }
    expect(buyers).toBe(2000);
    expect(Math.abs(doubles / buyers - TUNING.shop.doubleChance)).toBeLessThanOrEqual(0.03);
  });
});

describe('stone mortar', () => {
  it('grinding 3 mint emits jobUnitDone at ticks 45, 90 and 135', () => {
    const s = quiet();
    own(s, 'stoneMortar');
    s.inventory.mint = 3;
    inside(s, 16, 4, 'up');
    step(s, cmd({ type: 'StartGrind', input: 'mint', qty: 3 }));
    const at: number[] = [];
    for (let t = 1; t <= 200; t++) if (step(s, neutralFrame()).some((e) => e.type === 'jobUnitDone')) at.push(t);
    expect(at).toEqual([45, 90, 135]);
  });
});

describe('second cauldron', () => {
  it('before it arrives, (20,3) is floor and nothing is targeted from (20,4) facing up', () => {
    const s = quiet();
    inside(s, 20, 4, 'up');
    expect(s.player.interactTarget).toBeNull();
    run(s, 12, { ...neutralFrame(), moveY: -1 });
    expect(shopTile(s.player.x, s.player.y)).toEqual([20, 3]);
  });

  it('two brew jobs run at once, each costing 1 bogwood, each dropping on its own tile and naming its own station', () => {
    const s = quiet();
    own(s, 'cauldron2');
    Object.assign(s.inventory, { mintpaste: 2, reed: 2, bogwood: 2 });
    inside(s, 18, 4, 'up');
    expect(s.player.interactTarget).toBe('cauldron');
    const ev = step(s, cmd({ type: 'StartBrew', potion: 'tonic', qty: 1 }));
    inside(s, 20, 4, 'up');
    expect(s.player.interactTarget).toBe('cauldron2');
    ev.push(...step(s, cmd({ type: 'StartBrew', potion: 'tonic', qty: 1 })));
    expect(s.stations.cauldron).not.toBeNull();
    expect(s.stations.cauldron2).not.toBeNull();
    expect(s.inventory.bogwood).toBe(0);
    expect(ev.filter((e) => e.type === 'jobStarted').map((e) => e.type === 'jobStarted' && e.station)).toEqual(['cauldron', 'cauldron2']);
    // The player steps away so the outputs stay where they land.
    inside(s, 8, 8, 'down');
    ev.push(...run(s, 400));
    const done = ev.filter((e) => e.type === 'jobUnitDone' || e.type === 'jobFinished').map((e) => 'station' in e && e.station);
    expect(done.sort()).toEqual(['cauldron', 'cauldron', 'cauldron2', 'cauldron2']);
    const spots = s.pickups.map((k) => shopTile(k.x, k.y));
    expect(spots.sort()).toEqual([
      [18, 4],
      [20, 4],
    ]);
  });
});

describe('copper sickle', () => {
  function withNode(type: NodeId): GameState {
    const s = quiet();
    outside(s, 5, 7, 'down');
    const at = plotTileCenter(0, 0, 5, 8);
    s.nodes.push({ id: s.nextId++, type, x: at.x, y: at.y, hp: nodeDef(type).hits, plot: 0 });
    return s;
  }
  const hitsToBreak = (s: GameState): number => {
    for (let n = 1; n <= 5; n++) {
      const ev = [...step(s, SWING), ...run(s, 18)];
      if (ev.some((e) => e.type === 'nodeBroken')) return n;
    }
    return -1;
  };

  it('a reedclump breaks on hit 1, a stump on hit 2, a mintbush still on hit 1', () => {
    for (const [type, n] of [
      ['reedclump', 1],
      ['stump', 2],
      ['mintbush', 1],
    ] as const) {
      const s = quiet();
      own(s, 'sickle');
      const at = plotTileCenter(0, 0, 5, 8);
      // As a refill after the arrival spawns it.
      s.nodes.push({ id: s.nextId++, type, x: at.x, y: at.y, hp: nodeHits(s, type), plot: 0 });
      outside(s, 5, 7, 'down');
      expect(hitsToBreak(s), type).toBe(n);
    }
  });

  it('nodes refilled after the sickle arrives need the new hit count', () => {
    const s = createInitialState(1);
    s.nodes = [];
    s.catalog.pending.push('sickle');
    morningReset(s, []);
    expect(s.nodes.length).toBeGreaterThan(0);
    for (const n of s.nodes) expect(n.hp, n.type).toBe(Math.max(1, nodeDef(n.type).hits - 1));
  });

  it('a stump hit once before the sickle arrives breaks on its next hit', () => {
    const s = withNode('stump');
    step(s, SWING);
    run(s, 18);
    expect(s.nodes[0]!.hp).toBe(2);
    own(s, 'sickle');
    expect(hitsToBreak(s)).toBe(1);
  });
});

describe('two garden beds', () => {
  it('the garden grows to 6 beds and a node standing on (6,4) is gone, without drops', () => {
    const s = quiet();
    expect(s.garden).toHaveLength(4);
    const at = plotTileCenter(0, 0, 6, 4);
    s.nodes.push({ id: s.nextId++, type: 'stump', x: at.x, y: at.y, hp: 3, plot: 0 });
    const other = plotTileCenter(0, 0, 12, 8);
    s.nodes.push({ id: s.nextId++, type: 'stump', x: other.x, y: other.y, hp: 3, plot: 0 });
    const ev = own(s, 'beds2');
    expect(s.garden).toHaveLength(6);
    expect(s.garden.slice(4)).toEqual([
      { crop: null, nightsLeft: 0 },
      { crop: null, nightsLeft: 0 },
    ]);
    expect(s.nodes.map((n) => [n.x, n.y])).toEqual([[other.x, other.y]]);
    expect(s.pickups).toEqual([]);
    expect(ev.filter((e) => e.type === 'pickupSpawned')).toEqual([]);
    // The new beds work like the others.
    outside(s, 6, 5, 'up');
    expect(s.player.interactTarget).toBe('bed4');
    s.inventory.mint = 1;
    step(s, cmd({ type: 'Plant', bed: 4, item: 'mint' }));
    expect(s.garden[4]).toEqual({ crop: 'mint', nightsLeft: 1 });
  });

  it('over seeds 1-20 no node ever spawns on or next to the new bed tiles', () => {
    const o = plotOrigin(0, 0);
    for (let seed = 1; seed <= 20; seed++) {
      const s = createInitialState(seed);
      for (let morning = 0; morning <= 5; morning++) {
        for (const n of s.nodes) {
          if (n.plot !== 0) continue;
          const lx = tileAt(n.x) - o.x;
          const ly = tileAt(n.y) - o.y;
          const near = Math.abs(ly - 4) <= 1 && lx >= 5 && lx <= 8;
          expect(near, `seed ${seed}: ${n.type} at ${lx},${ly}`).toBe(false);
        }
        s.nodes = [];
        morningReset(s, []);
      }
    }
  });
});
