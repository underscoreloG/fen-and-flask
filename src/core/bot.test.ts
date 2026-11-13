import { describe, expect, it } from 'vitest';
import { TUNING } from '../data/tuning';
import { botFrame } from './bot';
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

interface Metrics {
  seed: number;
  evening1Coins: number | null;
  plotDay: number | null;
  goalDay: number | null;
  faints: number;
  ticks: number;
}

function runBot(seed: number): Metrics {
  const s = createInitialState(seed);
  const m: Metrics = { seed, evening1Coins: null, plotDay: null, goalDay: null, faints: 0, ticks: 0 };
  for (let i = 0; i < TICK_CAP && m.goalDay === null && s.day <= MAX_DAYS; i++) {
    const day = s.day;
    for (const e of step(s, botFrame(s))) {
      if (e.type === 'stallClosed' && day === 1 && m.evening1Coins === null) m.evening1Coins = e.soldCoins;
      else if (e.type === 'plotBought') m.plotDay = s.day;
      else if (e.type === 'goalReached') m.goalDay = s.day;
      else if (e.type === 'playerFainted') m.faints += 1;
    }
    m.ticks = i + 1;
  }
  return m;
}

describe('bot health (seeds 1-3, live mudlets, core only)', () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed}: evening-1 coins ${HEALTH.evening1CoinsMin}-${HEALTH.evening1CoinsMax}, plot by day ${HEALTH.plotBoughtMaxDay}, goal by day ${HEALTH.goalMaxDay}`, () => {
      const m = runBot(seed);
      console.log(
        `[health] seed ${seed}: evening-1 coins ${m.evening1Coins}, plotBought day ${m.plotDay}, goalReached day ${m.goalDay}, faints ${m.faints}, ticks ${m.ticks}`,
      );
      expect(m.evening1Coins).not.toBeNull();
      expect(m.evening1Coins!).toBeGreaterThanOrEqual(HEALTH.evening1CoinsMin);
      expect(m.evening1Coins!).toBeLessThanOrEqual(HEALTH.evening1CoinsMax);
      expect(m.plotDay).not.toBeNull();
      expect(m.plotDay!).toBeLessThanOrEqual(HEALTH.plotBoughtMaxDay);
      expect(m.goalDay).not.toBeNull();
      expect(m.goalDay!).toBeLessThanOrEqual(HEALTH.goalMaxDay);
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
