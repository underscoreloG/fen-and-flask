import { describe, expect, it } from 'vitest';
import { CREATURES, NODES } from '../data/content';
import { TUNING } from '../data/tuning';
import { clockLabel, DAY_TICKS, setPhase } from './clock';
import { neutralFrame, type Command, type Frame } from './commands';
import type { GameEvent } from './events';
import { createInitialState, type GameState } from './state';
import { step } from './step';
import { plotTileCenter, shopTileCenter } from './world';

const cmd = (...commands: Command[]): Frame => ({ ...neutralFrame(), commands });

function run(s: GameState, n: number, frame: Frame = neutralFrame()): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...step(s, frame));
  return out;
}

const count = (ev: GameEvent[], type: GameEvent['type']): number => ev.filter((e) => e.type === type).length;

// A new game without mudlets (an idle player next to them faints, and a faint resets the day).
function quiet(seed = 1): GameState {
  const s = createInitialState(seed);
  s.creatures = [];
  return s;
}

// Puts the player on a plot-local tile facing `facing`, then one tick so the targets are fresh.
function standAt(s: GameState, tx: number, ty: number, facing: GameState['player']['facing']): void {
  const at = plotTileCenter(0, 0, tx, ty);
  s.player.x = at.x;
  s.player.y = at.y;
  s.player.facing = facing;
  step(s, neutralFrame());
}

// Indoors on a shop-local tile.
function inside(s: GameState, tx: number, ty: number, facing: GameState['player']['facing']): void {
  const at = shopTileCenter(tx, ty);
  Object.assign(s.player, { area: 'shop', x: at.x, y: at.y, facing });
  step(s, neutralFrame());
}

const atCot = (s: GameState): void => inside(s, 18, 9, 'right');
const atSign = (s: GameState): void => inside(s, 9, 9, 'down');

// The command is rejected when the state ends exactly like a twin that got no command.
function expectRejected(s: GameState, c: Command): void {
  const twin = structuredClone(s);
  const ev = step(s, cmd(c));
  const evTwin = step(twin, neutralFrame());
  expect(JSON.stringify(s)).toBe(JSON.stringify(twin));
  expect(ev).toEqual(evTwin);
}

describe('day clock', () => {
  it(`after ${DAY_TICKS} ticks the phase is evening with exactly one eveningStarted, then t stops`, () => {
    expect(DAY_TICKS).toBe(14400);
    const s = quiet();
    const before = run(s, DAY_TICKS - 1);
    expect(s.phase).toBe('day');
    expect(count(before, 'eveningStarted')).toBe(0);
    const at = run(s, 1);
    expect(s.phase).toBe('evening');
    expect(at).toContainEqual({ type: 'eveningStarted', day: 1 });
    const after = run(s, 600);
    expect(count([...before, ...at, ...after], 'eveningStarted')).toBe(1);
    expect(s.clock.t).toBe(DAY_TICKS);
  });

  it('shows 06:00 to 17:50 in 10-minute steps', () => {
    expect(clockLabel(0)).toBe('06:00');
    expect(clockLabel(1199)).toBe('06:50');
    expect(clockLabel(1200)).toBe('07:00');
    expect(clockLabel(DAY_TICKS / 2)).toBe('12:00');
    expect(clockLabel(DAY_TICKS - 1)).toBe('17:50');
  });
});

describe('CallItADay', () => {
  it('at the shop sign during the day jumps to evening with one eveningStarted, never a second', () => {
    const s = quiet();
    atSign(s);
    expect(s.player.interactTarget).toBe('sign');
    const ev = step(s, cmd({ type: 'CallItADay' }));
    expect(s.phase).toBe('evening');
    expect(count(ev, 'eveningStarted')).toBe(1);
    const later = run(s, DAY_TICKS + 10);
    expect(count(later, 'eveningStarted')).toBe(0);
  });

  it('is rejected in the evening', () => {
    const s = quiet();
    atSign(s);
    step(s, cmd({ type: 'CallItADay' }));
    expect(s.phase).toBe('evening');
    expectRejected(s, { type: 'CallItADay' });
  });

  it('is rejected away from the sign', () => {
    const s = quiet();
    standAt(s, 5, 7, 'down');
    expect(s.player.interactTarget).toBeNull();
    expectRejected(s, { type: 'CallItADay' });
    expect(s.phase).toBe('day');
  });

  it('debug setPhase(evening) emits exactly one eveningStarted', () => {
    const s = quiet();
    const ev = setPhase(s, 'evening');
    expect(s.phase).toBe('evening');
    expect(ev).toEqual([{ type: 'eveningStarted', day: 1 }]);
    expect(setPhase(s, 'evening')).toEqual([]);
    expect(count(run(s, 10), 'eveningStarted')).toBe(0);
  });
});

describe('Sleep', () => {
  it('at the cot: day 2, t 0, nodes and mudlets refilled, hearts full, pickups kept, one morning', () => {
    const s = createInitialState(3);
    atCot(s);
    expect(s.player.interactTarget).toBe('cot');
    // Break some nodes, kill a mudlet, take damage, leave a drop lying far away.
    const broken = s.nodes.filter((n) => n.type === 'mintbush' || n.type === 'stump').slice(0, 5);
    s.nodes = s.nodes.filter((n) => !broken.includes(n));
    s.creatures = s.creatures.slice(1);
    s.player.hearts = 2;
    const far = plotTileCenter(0, 0, 17, 9);
    s.pickups.push({ id: s.nextId++, item: 'reed', area: 'world', x: far.x, y: far.y, fromX: far.x, fromY: far.y, landing: 0 });
    expect(s.creatures.length).toBe(1);
    const ev = step(s, cmd({ type: 'Sleep' }));
    expect(s.day).toBe(2);
    expect(s.phase).toBe('day');
    expect(s.clock.t).toBe(0);
    for (const def of NODES) {
      expect(s.nodes.filter((n) => n.plot === 0 && n.type === def.id).length, def.id).toBe(def.targets.home);
    }
    expect(s.creatures.length).toBe(CREATURES[0]!.counts.home);
    expect(s.player.hearts).toBe(TUNING.player.hearts);
    expect(s.pickups.map((k) => k.item)).toEqual(['reed']);
    expect(ev.filter((e) => e.type === 'morning')).toEqual([{ type: 'morning', day: 2 }]);
  });

  it('works in the evening too', () => {
    const s = quiet();
    setPhase(s, 'evening');
    atCot(s);
    step(s, cmd({ type: 'Sleep' }));
    expect(s.day).toBe(2);
    expect(s.phase).toBe('day');
  });

  it('is rejected away from the cot', () => {
    const s = quiet();
    atSign(s);
    expectRejected(s, { type: 'Sleep' });
    expect(s.day).toBe(1);
  });
});

describe('faint', () => {
  it('advances the day and leaves inventory and coins unchanged', () => {
    const s = quiet();
    standAt(s, 5, 7, 'down');
    s.inventory.mint = 4;
    s.inventory.bogwood = 2;
    s.coins = 37;
    s.player.hearts = 1;
    s.creatures.push({
      id: s.nextId++,
      type: 'mudlet',
      x: s.player.x,
      y: s.player.y,
      hp: CREATURES[0]!.hp,
      plot: 0,
      mode: 'idle',
      timer: 1000,
      dirX: 0,
      dirY: 0,
      stun: 0,
      knockTicks: 0,
      knockX: 0,
      knockY: 0,
    });
    const inv = { ...s.inventory };
    const ev = step(s, neutralFrame());
    expect(count(ev, 'playerFainted')).toBe(1);
    expect(count(ev, 'morning')).toBe(1);
    expect(s.day).toBe(2);
    expect(s.inventory).toEqual(inv);
    expect(s.coins).toBe(37);
  });
});

describe('determinism', () => {
  it('600 scripted frames with a sleep in the middle give byte-identical state', () => {
    const script = (i: number): Frame => ({
      ...neutralFrame(),
      moveX: i < 300 ? 0 : Math.sin(i / 17),
      moveY: i < 300 ? 0 : Math.cos(i / 23),
      swing: i % 40 === 0,
      commands: i === 200 ? [{ type: 'Sleep' }] : [],
    });
    const play = (): string => {
      const s = createInitialState(42);
      s.creatures = [];
      atCot(s);
      const events: GameEvent[] = [];
      for (let i = 0; i < 600; i++) events.push(...step(s, script(i)));
      expect(s.day).toBe(2);
      return JSON.stringify({ s, events });
    };
    expect(play()).toBe(play());
  });
});
