// Day clock, evening, sleep and the morning reset (specs/content.md, Day clock).
import { ticks, TUNING } from '../data/tuning';
import { refillCreatures } from './creatures';
import type { GameEvent } from './events';
import { growNight } from './garden';
import { refillPlot } from './nodes';
import { morningStall } from './stall';
import { finishJobs } from './stations';
import type { GameState, Phase } from './state';
import { targetStructure } from './world';

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
  const trend = state.stall.trend;
  if (trend) events.push({ type: 'trendAnnounced', potion: trend });
}

export function callItADay(state: GameState, events: GameEvent[]): void {
  if (state.phase !== 'day' || targetStructure(state)?.def.kind !== 'stall') return;
  startEvening(state, events);
}

export function sleep(state: GameState, events: GameEvent[]): void {
  if (targetStructure(state)?.def.kind !== 'hut') return;
  morningReset(state, events);
}

// Hook order matters (each step sees the one before):
//   1. clock and day counter
//   2. finish running station jobs (WP03)
//   3. garden grows one night
//   4. refill nodes, then mudlets (so mudlets keep clear of new nodes), on every owned plot
//   5. player hearts
//   6. demand recovery, trend pick, stall reset (WP04)
//   7. emit morning
// Pickups on the ground stay.
export function morningReset(state: GameState, events: GameEvent[]): void {
  state.day += 1;
  state.phase = 'day';
  state.clock.t = 0;
  finishJobs(state, events);
  growNight(state);
  state.plots.forEach((p, i) => {
    if (p.owned) refillPlot(state, i);
  });
  state.plots.forEach((p, i) => {
    if (p.owned) refillCreatures(state, i);
  });
  state.player.hearts = TUNING.player.hearts;
  morningStall(state);
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
