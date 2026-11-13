import { describe, expect, it } from 'vitest';
import { ITEM_IDS, type CatalogId, type ItemId } from '../data/content';
import { TUNING } from '../data/tuning';
import { botFrame } from './bot';
import { arriveUpgrades } from './catalog';
import { morningReset, setPhase } from './clock';
import { neutralFrame, type Command, type Frame } from './commands';
import type { GameEvent } from './events';
import { basketToad, counterDelay } from './helpers';
import { refillCreatures } from './creatures';
import { refillPlot } from './nodes';
import { PATIENCE_TICKS } from './shop';
import { createInitialState, type GameState } from './state';
import { step } from './step';
import { shopTileCenter } from './world';

const cmd = (...commands: Command[]): Frame => ({ ...neutralFrame(), commands });
const count = (ev: GameEvent[], type: GameEvent['type']): number => ev.filter((e) => e.type === type).length;
type Facing = GameState['player']['facing'];

// A new game with no nodes and no mudlets.
function quiet(seed = 1): GameState {
  const s = createInitialState(seed);
  s.nodes = [];
  s.creatures = [];
  return s;
}

// Delivers items as a morning would (the arrival step alone).
function own(s: GameState, ...ids: CatalogId[]): void {
  s.catalog.pending.push(...ids);
  arriveUpgrades(s, []);
}

function inside(s: GameState, tx: number, ty: number, facing: Facing): void {
  const at = shopTileCenter(tx, ty);
  Object.assign(s.player, { area: 'shop', x: at.x, y: at.y, facing });
  step(s, neutralFrame());
}

const atCounter = (s: GameState): void => inside(s, 3, 7, 'down');
const atCot = (s: GameState): void => inside(s, 18, 9, 'right');

function run(s: GameState, n: number): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...step(s, neutralFrame()));
  return out;
}

function until(s: GameState, type: GameEvent['type'], max = 5000): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < max; i++) {
    const ev = step(s, neutralFrame());
    out.push(...ev);
    if (ev.some((e) => e.type === type)) return out;
  }
  throw new Error(`no ${type} within ${max} ticks`);
}

// Evening, table 1 stocked with `qty` glowdraught at 20 (happy for personal 1), the shop open, one
// customer in (its mood forced), `helpers` owned, the player then on the cot's interact tile.
function openWith(helpers: CatalogId[], qty = 1, customers = 0): GameState {
  const s = quiet();
  own(s, ...helpers);
  setPhase(s, 'evening');
  s.inventory.glowdraught = qty;
  inside(s, 3, 5, 'up');
  step(s, cmd({ type: 'StockShelf', shelf: 0, item: 'glowdraught', qty }, { type: 'SetPrice', item: 'glowdraught', price: 20 }));
  inside(s, 9, 9, 'down');
  step(s, cmd({ type: 'OpenStall' }));
  expect(s.shop.phase).toBe('open');
  atCot(s);
  expect(s.shop.customers).toHaveLength(1);
  s.shop.customers[0]!.personal = 1;
  s.shop.customersLeft = customers;
  return s;
}

describe('catalog: the helpers', () => {
  it('counterToad2 and basketToad2 cannot be bought while their first tier is only pending', () => {
    const s = quiet();
    s.coins = 5000;
    inside(s, 12, 9, 'down');
    step(s, cmd({ type: 'BuyUpgrade', id: 'counterToad' }, { type: 'BuyUpgrade', id: 'basketToad' }));
    expect(s.catalog.pending).toEqual(['counterToad', 'basketToad']);
    const coins = s.coins;
    step(s, cmd({ type: 'BuyUpgrade', id: 'counterToad2' }, { type: 'BuyUpgrade', id: 'basketToad2' }));
    expect(s.catalog.pending).toEqual(['counterToad', 'basketToad']);
    expect(s.coins).toBe(coins);
    morningReset(s, []);
    inside(s, 12, 9, 'down');
    step(s, cmd({ type: 'BuyUpgrade', id: 'counterToad2' }, { type: 'BuyUpgrade', id: 'basketToad2' }));
    expect(s.catalog.pending).toEqual(['counterToad2', 'basketToad2']);
    expect(s.coins).toBe(coins - 450 - 520);
  });
});

describe('counter toad', () => {
  for (const [helpers, delay] of [
    [['counterToad'], 480],
    [['counterToad', 'counterToad2'], 180],
  ] as const) {
    it(`with ${helpers.at(-1)}, the player at the cot: paid at waited ${delay} exactly, toadRang right before the sale, coins and demand as by hand`, () => {
      const s = openWith([...helpers]);
      expect(counterDelay(s)).toBe(delay);
      until(s, 'customerQueued');
      const c = s.shop.customers[0]!;
      const before = run(s, delay - 1);
      expect(c.waited).toBe(delay - 1);
      expect(count(before, 'sale')).toBe(0);
      expect(c.holding).toBe(true);
      const at = step(s, neutralFrame());
      const types = at.map((e) => e.type);
      expect(types.filter((t) => t === 'toadRang')).toHaveLength(1);
      expect(types.indexOf('sale')).toBe(types.indexOf('toadRang') + 1);
      expect(at.filter((e) => e.type === 'sale')).toEqual([{ type: 'sale', item: 'glowdraught', price: 20, qty: 1 }]);
      expect(s.coins).toBe(20);
      expect(s.shop.demand.glowdraught).toBeCloseTo(0.96, 10);
      expect(s.shop.soldCount).toBe(1);
      expect(c.mode).toBe('leaving');
      // Nobody is rung twice.
      const after = run(s, 2000);
      expect(count(after, 'sale') + count(after, 'toadRang')).toBe(0);
    });
  }

  it('a hand RingUp before the delay still works, and that customer is not rung again', () => {
    const s = openWith(['counterToad']);
    until(s, 'customerQueued');
    run(s, 100);
    atCounter(s);
    const ev = step(s, cmd({ type: 'RingUp' }));
    expect(count(ev, 'sale')).toBe(1);
    expect(count(ev, 'toadRang')).toBe(0);
    expect(s.coins).toBe(20);
    const after = run(s, 2000);
    expect(count(after, 'sale') + count(after, 'toadRang')).toBe(0);
    expect(s.coins).toBe(20);
  });

  it('a customer who reaches spot 1 having waited past the delay is rung up on that tick', () => {
    const s = openWith(['counterToad'], 2, 1);
    for (let i = 0; i < 5000 && s.shop.customers.filter((c) => c.waited >= 0).length < 2; i++) step(s, neutralFrame());
    const first = s.shop.customers.find((c) => c.spot === 0)!;
    const second = s.shop.customers.find((c) => c.spot === 1)!;
    expect(second.mode).toBe('queued');
    // The first is fresh, the second has waited long already: ring the first up by hand.
    first.waited = 0;
    second.waited = 600;
    atCounter(s);
    step(s, cmd({ type: 'RingUp' }));
    expect(second.spot).toBe(0);
    expect(second.mode).toBe('toQueue');
    inside(s, 18, 9, 'right');
    let paidAt = -1;
    for (let i = 0; i < 200 && paidAt < 0; i++) {
      const ev = step(s, neutralFrame());
      if (ev.some((e) => e.type === 'toadRang')) paidAt = i;
      // Never seen standing at spot 1 unpaid.
      else expect(second.mode).toBe('toQueue');
    }
    expect(paidAt).toBeGreaterThan(0);
    expect(second.mode).toBe('leaving');
    expect(s.coins).toBe(40);
  });

  it('without a counter toad nothing rings automatically: the customer leaves unpaid at 1800', () => {
    const s = openWith([]);
    until(s, 'customerQueued');
    const before = run(s, PATIENCE_TICKS - 1);
    expect(count(before, 'sale') + count(before, 'toadRang')).toBe(0);
    const at = step(s, neutralFrame());
    expect(at).toContainEqual({ type: 'customerLeftUnpaid', item: 'glowdraught' });
    expect(s.coins).toBe(0);
  });
});

describe('garden toad', () => {
  it('a ready mint bed: +3 mint then -1 for the replant, growing mint again, gardenToadHarvested 3 once; a growing bed is left alone', () => {
    const s = quiet();
    own(s, 'gardenToad');
    s.garden[0] = { crop: 'mint', nightsLeft: 1 };
    s.garden[1] = { crop: 'emberroot', nightsLeft: 2 };
    s.inventory.mint = 0;
    const ev: GameEvent[] = [];
    morningReset(s, ev);
    expect(s.inventory.mint).toBe(2);
    expect(s.garden[0]).toEqual({ crop: 'mint', nightsLeft: 1 });
    expect(s.garden[1]).toEqual({ crop: 'emberroot', nightsLeft: 1 });
    expect(s.inventory.emberroot).toBe(0);
    expect(ev.filter((e) => e.type === 'gardenToadHarvested')).toEqual([{ type: 'gardenToadHarvested', harvested: 3 }]);
  });

  it('no ready bed: no event, nothing moves', () => {
    const s = quiet();
    own(s, 'gardenToad');
    s.garden[2] = { crop: 'emberroot', nightsLeft: 2 };
    const inv = { ...s.inventory };
    const ev: GameEvent[] = [];
    morningReset(s, ev);
    expect(count(ev, 'gardenToadHarvested')).toBe(0);
    expect(s.inventory).toEqual(inv);
    expect(s.garden[2]).toEqual({ crop: 'emberroot', nightsLeft: 1 });
  });

  it('without the toad a ready bed waits for the player', () => {
    const s = quiet();
    s.garden[0] = { crop: 'mint', nightsLeft: 1 };
    const ev: GameEvent[] = [];
    morningReset(s, ev);
    expect(s.garden[0]).toEqual({ crop: 'mint', nightsLeft: 0 });
    expect(s.inventory.mint).toBe(0);
    expect(count(ev, 'gardenToadHarvested')).toBe(0);
  });
});

const total = (s: GameState): number => ITEM_IDS.reduce((n, i) => n + s.inventory[i], 0);

describe('basket toad', () => {
  it('each morning adds exactly 5 items (9 with basketToad2), one basketToadBrought naming them', () => {
    for (const [helpers, n] of [
      [['basketToad'], TUNING.helpers.basketItems],
      [['basketToad', 'basketToad2'], TUNING.helpers.basketItemsBigger],
    ] as const) {
      expect(n).toBe(helpers.length === 1 ? 5 : 9);
      const s = quiet();
      own(s, ...helpers);
      for (let m = 0; m < 5; m++) {
        const before = total(s);
        const ev: GameEvent[] = [];
        morningReset(s, ev);
        expect(total(s) - before).toBe(n);
        const brought = ev.filter((e) => e.type === 'basketToadBrought');
        expect(brought).toHaveLength(1);
        const items = brought[0]!.type === 'basketToadBrought' ? brought[0]!.items : {};
        expect(Object.values(items).reduce((a, b) => a + b, 0)).toBe(n);
      }
    }
  });

  it('over 300 mornings at home only mint, glowcap, reed and bogwood come, each at least once; with the east plot emberroot comes too', () => {
    const seen = (east: boolean): Set<ItemId> => {
      const s = quiet(east ? 7 : 3);
      own(s, 'basketToad');
      if (east) s.plots[1]!.owned = true;
      const got = new Set<ItemId>();
      for (let m = 0; m < 300; m++) {
        const ev: GameEvent[] = [];
        morningReset(s, ev);
        for (const e of ev) if (e.type === 'basketToadBrought') for (const k of Object.keys(e.items)) got.add(k as ItemId);
      }
      return got;
    };
    expect([...seen(false)].sort()).toEqual(['bogwood', 'glowcap', 'mint', 'reed']);
    expect([...seen(true)].sort()).toEqual(['bogwood', 'emberroot', 'glowcap', 'mint', 'reed']);
  });

  it('the draw takes nothing from the world: the node list is unchanged', () => {
    const s = createInitialState(5);
    s.plots[1]!.owned = true;
    refillPlot(s, 1);
    refillCreatures(s, 1);
    own(s, 'basketToad', 'basketToad2');
    const nodes = JSON.stringify(s.nodes);
    const creatures = JSON.stringify(s.creatures);
    const ev: GameEvent[] = [];
    basketToad(s, ev);
    expect(count(ev, 'basketToadBrought')).toBe(1);
    expect(JSON.stringify(s.nodes)).toBe(nodes);
    expect(JSON.stringify(s.creatures)).toBe(creatures);
  });
});

describe('arrival', () => {
  it('an item acts the morning it arrives: a basketToad bought yesterday brings 5 today, a gardenToad harvests today', () => {
    const s = quiet();
    s.coins = 1000;
    s.garden[0] = { crop: 'glowcap', nightsLeft: 1 };
    inside(s, 12, 9, 'down');
    step(s, cmd({ type: 'BuyUpgrade', id: 'basketToad' }, { type: 'BuyUpgrade', id: 'gardenToad' }));
    expect(s.catalog.pending).toEqual(['basketToad', 'gardenToad']);
    const before = total(s);
    const ev: GameEvent[] = [];
    morningReset(s, ev);
    const types = ev.map((e) => e.type);
    expect(types.lastIndexOf('upgradeArrived')).toBeLessThan(types.indexOf('gardenToadHarvested'));
    expect(types.indexOf('gardenToadHarvested')).toBeLessThan(types.indexOf('basketToadBrought'));
    expect(types.indexOf('basketToadBrought')).toBeLessThan(types.indexOf('morning'));
    // +5 from the basket, +3 - 1 glowcap from the garden.
    expect(total(s) - before).toBe(5 + 2);
  });
});

describe('determinism', () => {
  // The bot plays by day; each evening the player then sits on the cot so the counter toad does
  // the ringing. Every helper owned from the start, both plots.
  function play(): { json: string; events: GameEvent[] } {
    const s = createInitialState(11);
    s.plots[1]!.owned = true;
    refillPlot(s, 1);
    refillCreatures(s, 1);
    own(s, 'beds2', 'gardenToad', 'counterToad', 'counterToad2', 'basketToad', 'basketToad2');
    s.garden.forEach((b, i) => Object.assign(b, { crop: i % 2 === 0 ? 'mint' : 'glowcap', nightsLeft: 1 }));
    const events: GameEvent[] = [];
    for (let i = 0; i < 400000 && s.day < 4; i++) {
      const parked = s.shop.phase === 'open';
      if (parked && s.player.interactTarget !== 'cot') Object.assign(s.player, shopTileCenter(18, 9), { facing: 'right' });
      events.push(...step(s, parked ? neutralFrame() : botFrame(s)));
    }
    return { json: JSON.stringify(s), events };
  }

  it('a run with all helpers owned replays byte-identical, and every helper acted in it', () => {
    const a = play();
    const b = play();
    expect(b.json).toBe(a.json);
    expect(b.events).toEqual(a.events);
    expect(count(a.events, 'toadRang')).toBeGreaterThan(0);
    expect(count(a.events, 'gardenToadHarvested')).toBeGreaterThan(1);
    expect(count(a.events, 'basketToadBrought')).toBeGreaterThan(1);
    expect(JSON.parse(a.json).day).toBe(4);
  });
});
