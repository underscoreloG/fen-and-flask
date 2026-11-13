// Day clock, evening, sleep and the morning reset (specs/content.md, Day clock).
import { ticks, TUNING } from '../data/tuning';
import { arriveUpgrades } from './catalog';
import { refillCreatures } from './creatures';
import type { GameEvent } from './events';
import { growNight } from './garden';
import { basketToad, gardenToad } from './helpers';
import { refillPlot } from './nodes';
import { checkM2Goal, postOrder } from './orders';
import { closeShop, morningShop } from './shop';
import { finishJobs } from './stations';
import type { GameState, Phase } from './state';
import { structureOfKind, targetStructure } from './world';

const COT = structureOfKind('cot');

const D = TUNING.day;
export const DAY_TICKS = ticks(D.length);
const MIN_PER_HOUR = 60;

// The day timer runs only by day; the evening has no timer.
export function updateClock(state: GameState, events: GameEvent[]): void {
  if (state.phase !== 'day') return;
  state.clock.t += 1;
  if (state.clock.t >= DAY_TICKS) startEvening(state, events);
}

// The one way into the evening, so eveningStarted fires once per day whatever caused it.
export function startEvening(state: GameState, events: GameEvent[]): void {
  if (state.phase !== 'day') return;
  state.phase = 'evening';
  events.push({ type: 'eveningStarted', day: state.day });
  const trend = state.shop.trend;
  if (trend) events.push({ type: 'trendAnnounced', item: trend });
}

// From the cot. An open shop closes first: whoever holds an item pays.
export function sleep(state: GameState, events: GameEvent[]): void {
  if (targetStructure(state)?.def.kind !== 'cot') return;
  closeShop(state, events);
  morningReset(state, events);
}

// Hook order matters (each step sees the one before); the same list is in specs/wp/WP07-WP09:
//   1. day and clock
//   2. the player wakes in bed, indoors (WP06)
//   3. station jobs finish (WP03)
//   4. catalog arrivals: effects apply, upgradeArrived (WP07)
//   5. the garden grows one night
//   6. garden toad (WP08)
//   7. plots refill their nodes
//   8. mudlets refill (after the nodes, so they keep clear of them)
//   9. basket toad (WP08)
//  10. hearts
//  11. demand, trend and shop reset (WP04, WP06)
//  12. the daily order (WP09)
//  13. the M2 goal check (WP09)
//  14. morning (the UI saves on it)
// Pickups on the ground stay.
export function morningReset(state: GameState, events: GameEvent[]): void {
  // 1.
  state.day += 1;
  state.phase = 'day';
  state.clock.t = 0;
  // 2.
  const p = state.player;
  Object.assign(p, { area: 'shop', x: COT.interactX, y: COT.interactY, facing: 'down', moving: false, knockTicks: 0, knockX: 0, knockY: 0 });
  // 3.
  finishJobs(state, events);
  // 4.
  arriveUpgrades(state, events);
  // 5.
  growNight(state);
  // 6.
  gardenToad(state, events);
  // 7.
  state.plots.forEach((p, i) => {
    if (p.owned) refillPlot(state, i);
  });
  // 8.
  state.plots.forEach((p, i) => {
    if (p.owned) refillCreatures(state, i);
  });
  // 9.
  basketToad(state, events);
  // 10.
  p.hearts = TUNING.player.hearts;
  // 11.
  morningShop(state);
  // 12.
  postOrder(state, events);
  // 13.
  checkM2Goal(state, events);
  // 14.
  events.push({ type: 'morning', day: state.day });
}

// Debug only (__game.setPhase): evening goes through startEvening; day rewinds the clock of the
// current day without a morning reset.
export function setPhase(state: GameState, phase: Phase): GameEvent[] {
  const events: GameEvent[] = [];
  if (phase === 'evening') startEvening(state, events);
  else if (state.phase !== 'day') {
    state.phase = 'day';
    state.clock.t = 0;
  }
  return events;
}

// "HH:MM" for the HUD: 06:00 + (t / day ticks) x 12 h, in clockStepMinutes steps.
export function clockLabel(t: number): string {
  const span = (D.clockEndHour - D.clockStartHour) * MIN_PER_HOUR;
  const raw = Math.floor((Math.min(t, DAY_TICKS) * span) / DAY_TICKS);
  const min = D.clockStartHour * MIN_PER_HOUR + Math.floor(raw / D.clockStepMinutes) * D.clockStepMinutes;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(Math.floor(min / MIN_PER_HOUR))}:${pad(min % MIN_PER_HOUR)}`;
}

// Hour of the day as a float, for the dial hand.
export function clockHour(t: number): number {
  return D.clockStartHour + ((D.clockEndHour - D.clockStartHour) * Math.min(t, DAY_TICKS)) / DAY_TICKS;
}
