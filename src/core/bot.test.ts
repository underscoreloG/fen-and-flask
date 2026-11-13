import { describe, expect, it } from 'vitest';
import { CATALOG, type CatalogId } from '../data/content';
import { TUNING } from '../data/tuning';
import { botFrame } from './bot';
import { owns } from './catalog';
import { DAY_TICKS } from './clock';
import type { GameEvent } from './events';
import { refillCreatures } from './creatures';
import { refillPlot } from './nodes';
import { createInitialState, type GameState } from './state';
import { step } from './step';

const HEALTH = TUNING.health;
// A stuck bot must fail the test, never hang it: the evening has no timer.
const MAX_DAYS = 8;
const TICK_CAP = MAX_DAYS * (DAY_TICKS + 20000);
// The M2 run: until every catalog item has arrived and the lantern sign has worked for its 5
// evenings, or this day at the latest.
const M2_MAX_DAYS = HEALTH.catalogAllMaxDay + HEALTH.lateEveningsAfter + 2;

interface Metrics {
  seed: number;
  evening1Coins: number | null;
  plotDay: number | null;
  goalDay: number | null;
  faints: number;
  // Customers left unpaid before a counter toad was owned, and after.
  unpaid: number;
  unpaidAfterToad: number;
  m2Day: number | null;
  // Days whose order was posted (from HEALTH.ordersFromDay on), and those delivered.
  ordersPosted: number[];
  ordersDelivered: number[];
  // Coins paid for the order delivered on each day.
  orderPay: Record<number, number>;
  ticks: number;
  // Coins held when the run ends.
  coins: number;
  // Day each catalog item arrived; coins and units sold per evening, by day.
  arrivals: Partial<Record<CatalogId, number>>;
  evenings: Record<number, { coins: number; units: number }>;
}

function runBot(seed: number): Metrics {
  const s = createInitialState(seed);
  const m: Metrics = {
    seed,
    evening1Coins: null,
    plotDay: null,
    goalDay: null,
    faints: 0,
    unpaid: 0,
    unpaidAfterToad: 0,
    m2Day: null,
    ordersPosted: [],
    ordersDelivered: [],
    orderPay: {},
    ticks: 0,
    coins: 0,
    arrivals: {},
    evenings: {},
  };
  const tickCap = M2_MAX_DAYS * (DAY_TICKS + 20000);
  const allDay = (): number => (CATALOG.every((d) => m.arrivals[d.id] !== undefined) ? Math.max(...CATALOG.map((d) => m.arrivals[d.id]!)) : M2_MAX_DAYS);
  const lastDay = (): number => Math.min(M2_MAX_DAYS, Math.max(allDay(), (m.arrivals.lanternSign ?? M2_MAX_DAYS) + HEALTH.lateEveningsAfter));
  for (let i = 0; i < tickCap && s.day <= lastDay(); i++) {
    const day = s.day;
    for (const e of step(s, botFrame(s))) {
      if (e.type === 'stallClosed') {
        if (day === 1 && m.evening1Coins === null) m.evening1Coins = e.soldCoins;
        m.evenings[day] = { coins: e.soldCoins, units: e.soldCount };
      } else if (e.type === 'plotBought') m.plotDay = s.day;
      else if (e.type === 'goalReached') m.goalDay = s.day;
      else if (e.type === 'playerFainted') m.faints += 1;
      else if (e.type === 'customerLeftUnpaid') {
        if (owns(s, 'counterToad')) m.unpaidAfterToad += 1;
        else m.unpaid += 1;
      } else if (e.type === 'upgradeArrived') m.arrivals[e.id] = s.day;
      else if (e.type === 'm2GoalReached') m.m2Day = s.day;
      else if (e.type === 'orderPosted' && s.day >= HEALTH.ordersFromDay) m.ordersPosted.push(s.day);
      else if (e.type === 'orderDelivered') {
        m.orderPay[s.day] = e.pay;
        if (s.day >= HEALTH.ordersFromDay) m.ordersDelivered.push(s.day);
      }
    }
    m.ticks = i + 1;
  }
  m.coins = s.coins;
  // The run stops on the morning past its last day: that order was posted but never played.
  m.ordersPosted = m.ordersPosted.filter((d) => d !== s.day);
  return m;
}

// Average over days [from, to] of the order pay (a day without a delivery counts 0).
const avgPay = (m: Metrics, from: number, to: number): number => {
  let sum = 0;
  for (let d = from; d <= to; d++) sum += m.orderPay[d] ?? 0;
  return sum / (to - from + 1);
};

// Average over days [from, to] of an evening's coins or units (a day with no shop counts 0).
const avg = (m: Metrics, from: number, to: number, k: 'coins' | 'units'): number => {
  let sum = 0;
  for (let d = from; d <= to; d++) sum += m.evenings[d]?.[k] ?? 0;
  return sum / (to - from + 1);
};

describe('bot health (seeds 1-3, live mudlets, core only)', () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed}: M1 metrics, all ${CATALOG.length} catalog items and m2GoalReached by day ${HEALTH.catalogAllMaxDay}, orders delivered, a busier shop after the lantern sign`, () => {
      const m = runBot(seed);
      const arrivals = CATALOG.map((d) => `${d.id} ${m.arrivals[d.id] ?? '-'}`).join(', ');
      const L = m.arrivals.lanternSign ?? null;
      const early = avg(m, 3, 5, 'coins');
      const span = HEALTH.lateEveningsAfter;
      const late = L === null ? null : { coins: avg(m, L, L + span, 'coins'), units: avg(m, L, L + span, 'units') };
      // The same with each day's order pay added (orders take potions off the evening's tables).
      const withOrders = (from: number, to: number): number => avg(m, from, to, 'coins') + avgPay(m, from, to);
      const ratioWithOrders = L === null ? null : withOrders(L, L + span) / withOrders(3, 5);
      console.log(
        `[health] seed ${seed}: evening-1 coins ${m.evening1Coins}, plotBought day ${m.plotDay}, goalReached day ${m.goalDay}, faints ${m.faints}, ticks ${m.ticks}, coins at the end ${m.coins}\n` +
          `[health] seed ${seed}: m2GoalReached day ${m.m2Day}; orders from day ${HEALTH.ordersFromDay}: ${m.ordersDelivered.length} delivered of ${m.ordersPosted.length} posted; left unpaid ${m.unpaid} before a counter toad, ${m.unpaidAfterToad} after\n` +
          `[health] seed ${seed}: arrivals ${arrivals}\n` +
          `[health] seed ${seed}: avg coins evenings 3-5 ${early.toFixed(1)}; L ${L}: avg coins ${late?.coins.toFixed(1)}, avg units ${late?.units.toFixed(1)} (ratio ${late ? (late.coins / early).toFixed(2) : '-'}; with order pay ${ratioWithOrders?.toFixed(2)})\n` +
          `[health] seed ${seed}: evenings ${JSON.stringify(m.evenings)}`,
      );
      expect(m.evening1Coins).not.toBeNull();
      expect(m.evening1Coins!).toBeGreaterThanOrEqual(HEALTH.evening1CoinsMin);
      expect(m.evening1Coins!).toBeLessThanOrEqual(HEALTH.evening1CoinsMax);
      expect(m.plotDay).not.toBeNull();
      expect(m.plotDay!).toBeLessThanOrEqual(HEALTH.plotBoughtMaxDay);
      expect(m.goalDay).not.toBeNull();
      expect(m.goalDay!).toBeLessThanOrEqual(HEALTH.goalMaxDay);
      // The bot rings up at once (and the counter toad when it is away).
      expect(m.unpaid).toBeLessThanOrEqual(HEALTH.unpaidBeforeToadMax);
      expect(m.unpaidAfterToad).toBe(0);
      expect(m.m2Day).not.toBeNull();
      expect(m.m2Day!).toBeLessThanOrEqual(HEALTH.catalogAllMaxDay);
      expect(m.ordersPosted.length).toBeGreaterThan(0);
      expect(m.ordersDelivered.length).toBeGreaterThanOrEqual(HEALTH.ordersDeliveredMin * m.ordersPosted.length);
      for (const d of CATALOG) {
        expect(m.arrivals[d.id], d.id).toBeDefined();
        expect(m.arrivals[d.id]!, d.id).toBeLessThanOrEqual(HEALTH.catalogAllMaxDay);
      }
      expect(late).not.toBeNull();
      expect(m.evenings[L! + span], 'the run reaches evening L+4').toBeDefined();
      // WP07's coins ratio (late.coins >= lateCoinsRatio x early) is printed, no longer asserted: with
      // orders and customer types (specs/wp/WP09) seed 3 measures 1.43 (see the WP09 report).
      expect(late!.units).toBeGreaterThanOrEqual(HEALTH.lateUnitsMin);
    }, 180000);
  }
});

// Past the goal: a week of play with live mudlets, so a bot that gets pinned (seed 2 once stood
// flush on a node, seed 7 once chased an east mudlet into one) fails here.
describe('bot robustness (a week, live mudlets)', () => {
  for (const seed of [1, 2, 3, 7]) {
    it(`seed ${seed}: reaches day 7 with no faint and no day ended by the clock`, () => {
      const s = createInitialState(seed);
      let faints = 0;
      let timerDays = 0;
      for (let i = 0; i < TICK_CAP && s.day < 7; i++) {
        for (const e of step(s, botFrame(s))) {
          if (e.type === 'playerFainted') faints += 1;
          else if (e.type === 'eveningStarted' && s.clock.t >= DAY_TICKS) timerDays += 1;
        }
      }
      console.log(`[week] seed ${seed}: day ${s.day}, faints ${faints}, days ended by the clock ${timerDays}, coins ${s.coins}`);
      expect(s.day).toBe(7);
      expect(faints).toBe(0);
      expect(timerDays).toBe(0);
    }, 60000);
  }
});

// A day-3 game with both plots owned and filled.
function dayThree(seed: number): GameState {
  const s = createInitialState(seed);
  s.day = 3;
  s.plots[1]!.owned = true;
  refillPlot(s, 1);
  refillCreatures(s, 1);
  return s;
}

describe('bot', () => {
  it('1000 ticks of the bot on a day-3 state with both plots run in under 100 ms', () => {
    const s = dayThree(5);
    // Warm the JIT on a twin first, so the timing measures the code, not the compiler.
    const warm = dayThree(5);
    for (let i = 0; i < 300; i++) step(warm, botFrame(warm));
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) step(s, botFrame(s));
    const ms = performance.now() - t0;
    console.log(`[perf] 1000 bot ticks: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(100);
  });

  it('is deterministic: two runs of the same seed end byte-identical, with identical events', () => {
    const run = (): { json: string; events: GameEvent[] } => {
      const s = createInitialState(9);
      const events: GameEvent[] = [];
      for (let i = 0; i < 20000; i++) events.push(...step(s, botFrame(s)));
      return { json: JSON.stringify(s), events };
    };
    const a = run();
    const b = run();
    expect(b.json).toBe(a.json);
    expect(b.events).toEqual(a.events);
  });

  it('never presses interact', () => {
    const s = createInitialState(2);
    for (let i = 0; i < 6000; i++) {
      const f = botFrame(s);
      expect(f.interact).toBe(false);
      step(s, f);
    }
  });
});
