import { describe, expect, it } from 'vitest';
import { NODES, type ItemId, type PotionId } from '../data/content';
import { TUNING } from '../data/tuning';
import { morningReset, setPhase } from './clock';
import { neutralFrame, type Command, type Frame } from './commands';
import type { GameEvent } from './events';
import { potionValue, reactTo } from './stall';
import { createInitialState, type GameState } from './state';
import { step } from './step';
import { plotTileCenter, tileAt } from './world';

const cmd = (...commands: Command[]): Frame => ({ ...neutralFrame(), commands });
const count = (ev: GameEvent[], type: GameEvent['type']): number => ev.filter((e) => e.type === type).length;

function standAt(s: GameState, tx: number, ty: number, facing: GameState['player']['facing']): void {
  const at = plotTileCenter(0, 0, tx, ty);
  s.player.x = at.x;
  s.player.y = at.y;
  s.player.facing = facing;
  step(s, neutralFrame());
}

// A new game with no mudlets (time passes in these tests), potions in hand, at the stall.
function atStall(inv: Partial<Record<ItemId, number>> = {}, seed = 1): GameState {
  const s = createInitialState(seed);
  s.creatures = [];
  Object.assign(s.inventory, inv);
  standAt(s, 9, 10, 'down');
  expect(s.player.interactTarget).toBe('stall');
  return s;
}

function eveningAtStall(inv: Partial<Record<ItemId, number>>, seed = 1): GameState {
  const s = atStall(inv, seed);
  setPhase(s, 'evening');
  return s;
}

// Steps until the stall closes (or n ticks), returning every event.
function runStall(s: GameState, n = 5000): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n && s.stall.phase === 'open'; i++) out.push(...step(s, neutralFrame()));
  return out;
}

function sleep(s: GameState): GameEvent[] {
  standAt(s, 2, 3, 'up');
  const ev = step(s, cmd({ type: 'Sleep' }));
  s.creatures = [];
  return ev;
}

function expectRejected(s: GameState, c: Command): void {
  const twin = structuredClone(s);
  const ev = step(s, cmd(c));
  const evTwin = step(twin, neutralFrame());
  expect(JSON.stringify(s)).toBe(JSON.stringify(twin));
  expect(ev).toEqual(evTwin);
}

describe('stall reactions', () => {
  it('glowdraught, value 24, personal 1: 19 delighted, 20 and 26 happy, 27 and 31 grumbling, 32 refuses', () => {
    const s = createInitialState(1);
    expect(potionValue(s, 'glowdraught')).toBeCloseTo(24);
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

  it('first prices are 10, 13, 17, 42; SetPrice below 1 clamps to 1; prices persist across a sleep', () => {
    const s = atStall();
    expect(s.stall.prices).toEqual({ tonic: 10, salve: 13, glowdraught: 17, emberelixir: 42 });
    step(s, cmd({ type: 'SetPrice', potion: 'tonic', price: 0 }, { type: 'SetPrice', potion: 'salve', price: -5 }));
    step(s, cmd({ type: 'SetPrice', potion: 'glowdraught', price: 23 }));
    expect(s.stall.prices).toEqual({ tonic: 1, salve: 1, glowdraught: 23, emberelixir: 42 });
    sleep(s);
    expect(s.stall.prices).toEqual({ tonic: 1, salve: 1, glowdraught: 23, emberelixir: 42 });
  });

  it('SetPrice away from the stall (stall not open) is rejected', () => {
    const s = createInitialState(1);
    s.creatures = [];
    standAt(s, 5, 7, 'down');
    expectRejected(s, { type: 'SetPrice', potion: 'tonic', price: 30 });
  });
});

describe('demand', () => {
  it('a sale lowers demand by 0.04, a grumbling sale by 0.09; never below 0.6; a night adds 0.15 up to 1.0', () => {
    const s = eveningAtStall({ glowdraught: 1 });
    step(s, cmd({ type: 'SetPrice', potion: 'glowdraught', price: 1 }, { type: 'OpenStall' }));
    const ev = runStall(s);
    expect(ev).toContainEqual({ type: 'customerReacted', potion: 'glowdraught', price: 1, reaction: 'delighted', sold: true });
    expect(s.stall.demand.glowdraught).toBeCloseTo(0.96);

    // 29 on a value of 22.8-25.2 is always grumbling (r 1.15-1.27).
    const g = eveningAtStall({ glowdraught: 1 });
    step(g, cmd({ type: 'SetPrice', potion: 'glowdraught', price: 29 }, { type: 'OpenStall' }));
    const gev = runStall(g);
    expect(gev).toContainEqual(expect.objectContaining({ type: 'customerReacted', reaction: 'grumbling', sold: true }));
    expect(g.stall.demand.glowdraught).toBeCloseTo(0.91);

    const f = eveningAtStall({ tonic: 1 });
    f.stall.demand.tonic = 0.62;
    step(f, cmd({ type: 'SetPrice', potion: 'tonic', price: 1 }, { type: 'OpenStall' }));
    runStall(f);
    expect(f.stall.demand.tonic).toBeCloseTo(0.6);

    f.stall.demand.salve = 0.7;
    f.stall.demand.emberelixir = 0.9;
    sleep(f);
    expect(f.stall.demand.tonic).toBeCloseTo(0.75);
    expect(f.stall.demand.salve).toBeCloseTo(0.85);
    expect(f.stall.demand.emberelixir).toBeCloseTo(1.0);
    expect(f.stall.demand.glowdraught).toBeCloseTo(1.0);
  });
});

describe('stall open', () => {
  it('with 2 mudlets next to the counter, a full stall (6 customers) costs no heart and never moves the player', () => {
    const s = eveningAtStall({ tonic: 10 });
    const counter = plotTileCenter(0, 0, 9, 10);
    for (const [dx, dy] of [
      [-12, 0],
      [12, 0],
    ] as const) {
      s.creatures.push({
        id: s.nextId++,
        type: 'mudlet',
        x: counter.x + dx,
        y: counter.y + dy,
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
      });
    }
    step(s, cmd({ type: 'SetPrice', potion: 'tonic', price: 1 }, { type: 'OpenStall' }));
    expect(s.stall.phase).toBe('open');
    const ev: GameEvent[] = [];
    let ticks = 0;
    while (s.stall.phase === 'open' && ticks < 5000) {
      // Try to walk and swing: both ignored while held.
      ev.push(...step(s, { ...neutralFrame(), moveX: 1, moveY: -1, swing: ticks % 20 === 0, interact: ticks % 33 === 0 }));
      ticks += 1;
      // The closing tick frees the player again; until then they stay put.
      if (s.stall.phase === 'open') expect([s.player.x, s.player.y]).toEqual([counter.x, counter.y]);
      expect(s.player.hearts).toBe(TUNING.player.hearts);
      expect(s.creatures.every((c) => c.mode !== 'chase')).toBe(true);
    }
    expect(count(ev, 'customerArrived')).toBe(6);
    expect(count(ev, 'playerHurt')).toBe(0);
    expect(count(ev, 'swing')).toBe(0);
    expect(s.stall.phase).toBe('done');
  });

  it('6 customers with one plot, 8 with two; walk 120 ticks, react 48, next one at once', () => {
    const s = eveningAtStall({ tonic: 20 });
    step(s, cmd({ type: 'SetPrice', potion: 'tonic', price: 1 }, { type: 'OpenStall' }));
    const arrivals: number[] = [];
    for (let i = 1; s.stall.phase === 'open' && i < 5000; i++) {
      if (step(s, neutralFrame()).some((e) => e.type === 'customerArrived')) arrivals.push(i);
    }
    expect(arrivals).toEqual([120, 288, 456, 624, 792, 960]);

    const t = eveningAtStall({ tonic: 20 }, 2);
    t.plots[1]!.owned = true;
    step(t, cmd({ type: 'OpenStall' }));
    expect(count(runStall(t), 'customerArrived')).toBe(8);
  });

  it('ends early when stock runs out; stallClosed totals match the coins gained', () => {
    const s = eveningAtStall({ tonic: 2, salve: 1 });
    step(s, cmd({ type: 'SetPrice', potion: 'tonic', price: 3 }, { type: 'SetPrice', potion: 'salve', price: 4 }, { type: 'OpenStall' }));
    const ev = runStall(s);
    expect(count(ev, 'customerArrived')).toBe(3);
    expect(count(ev, 'sale')).toBe(3);
    expect(ev.filter((e) => e.type === 'stallClosed')).toEqual([{ type: 'stallClosed', soldCount: 3, soldCoins: 10 }]);
    expect(s.coins).toBe(10);
    expect([s.inventory.tonic, s.inventory.salve]).toEqual([0, 0]);
  });

  it('CloseStall ends it at once; totals match the coins gained', () => {
    const s = eveningAtStall({ tonic: 20 });
    step(s, cmd({ type: 'SetPrice', potion: 'tonic', price: 5 }, { type: 'OpenStall' }));
    const ev: GameEvent[] = [];
    for (let i = 0; i < 300; i++) ev.push(...step(s, neutralFrame()));
    const closing = step(s, cmd({ type: 'CloseStall' }));
    expect(s.stall.phase).toBe('done');
    const sold = count(ev, 'sale');
    expect(sold).toBeGreaterThan(0);
    expect(closing).toEqual([{ type: 'stallClosed', soldCount: sold, soldCoins: s.coins }]);
    expect(s.coins).toBe(5 * sold);
    expect(count(runStall(s), 'customerArrived')).toBe(0);
  });

  it('OpenStall is rejected by day, with no potions, away from the stall, and twice the same evening; it works after sleeping', () => {
    const day = atStall({ tonic: 3 });
    expectRejected(day, { type: 'OpenStall' });

    const empty = eveningAtStall({});
    expectRejected(empty, { type: 'OpenStall' });

    const away = eveningAtStall({ tonic: 3 });
    standAt(away, 5, 7, 'down');
    expectRejected(away, { type: 'OpenStall' });

    const s = eveningAtStall({ tonic: 3 });
    step(s, cmd({ type: 'OpenStall' }));
    expect(s.stall.phase).toBe('open');
    step(s, cmd({ type: 'CloseStall' }));
    standAt(s, 9, 10, 'down');
    expectRejected(s, { type: 'OpenStall' });
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'uiRequest', ui: 'toast', text: 'STALL IS DONE FOR TODAY' });

    sleep(s);
    standAt(s, 9, 10, 'down');
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'uiRequest', ui: 'callItADayConfirm' });
    step(s, cmd({ type: 'CallItADay' }));
    expect(step(s, { ...neutralFrame(), interact: true })).toContainEqual({ type: 'uiRequest', ui: 'stall' });
    step(s, cmd({ type: 'OpenStall' }));
    expect(s.stall.phase).toBe('open');
  });

  it('history keeps only the last 3 entries per potion', () => {
    const s = eveningAtStall({ tonic: 5 });
    step(s, cmd({ type: 'SetPrice', potion: 'tonic', price: 2 }, { type: 'OpenStall' }));
    for (let i = 0; s.stall.history.tonic.length < 2 && i < 5000; i++) step(s, neutralFrame());
    step(s, cmd({ type: 'SetPrice', potion: 'tonic', price: 3 }));
    runStall(s);
    expect(s.inventory.tonic).toBe(0);
    expect(s.stall.history.tonic).toEqual([
      { price: 3, reaction: 'delighted' },
      { price: 3, reaction: 'delighted' },
      { price: 3, reaction: 'delighted' },
    ]);
    expect(s.stall.history.salve).toEqual([]);
  });
});

describe('trend', () => {
  it('day 1 has no trend and no trendAnnounced; from day 2 on, exactly one per evening', () => {
    const s = atStall();
    expect(s.stall.trend).toBeNull();
    expect(count(step(s, cmd({ type: 'CallItADay' })), 'trendAnnounced')).toBe(0);
    for (let day = 2; day <= 5; day++) {
      sleep(s);
      expect(s.day).toBe(day);
      standAt(s, 9, 10, 'down');
      const ev = step(s, cmd({ type: 'CallItADay' }));
      expect(ev.filter((e) => e.type === 'trendAnnounced')).toEqual([{ type: 'trendAnnounced', potion: s.stall.trend }]);
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
      seen.add(s.stall.trend);
    }
    expect([...seen].sort()).toEqual(['glowdraught', 'salve', 'tonic']);
    s.stall.trend = 'glowdraught';
    s.stall.demand.glowdraught = 1;
    expect(potionValue(s, 'glowdraught')).toBeCloseTo(31.2);
    expect(potionValue(s, 'tonic')).toBeCloseTo(14);
  });

  it('with the east plot owned, emberelixir can trend', () => {
    const s = createInitialState(3);
    s.plots[1]!.owned = true;
    const seen = new Set<PotionId | null>();
    for (let i = 0; i < 100; i++) {
      morningReset(s, []);
      seen.add(s.stall.trend);
    }
    expect(seen.has('emberelixir')).toBe(true);
  });
});

describe('land', () => {
  function atSignpost(coins: number): GameState {
    const s = createInitialState(1);
    s.creatures = [];
    s.coins = coins;
    standAt(s, 18, 6, 'right');
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
    for (let i = 0; i < 90; i++) step(s, { ...neutralFrame(), moveX: 1 });
    expect(tileAt(s.player.x)).toBeGreaterThanOrEqual(23);
  });

  it('BuyPlot away from the signpost is rejected', () => {
    const s = createInitialState(1);
    s.creatures = [];
    s.coins = 500;
    standAt(s, 9, 10, 'down');
    expectRejected(s, { type: 'BuyPlot', plot: 1 });
  });
});

describe('goal', () => {
  it('the first emberelixir sale emits goalReached once and sets the flag; the second emits none', () => {
    const s = eveningAtStall({ emberelixir: 2 });
    step(s, cmd({ type: 'SetPrice', potion: 'emberelixir', price: 5 }, { type: 'OpenStall' }));
    const ev = runStall(s);
    expect(count(ev, 'sale')).toBe(2);
    expect(count(ev, 'goalReached')).toBe(1);
    const sales = ev.flatMap((e, i) => (e.type === 'sale' ? [i] : []));
    expect(ev[sales[0]! + 1]).toEqual({ type: 'goalReached' });
    expect(s.flags.m1Goal).toBe(true);
  });
});
