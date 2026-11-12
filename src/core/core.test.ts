import { describe, expect, it } from 'vitest';
import { neutralFrame, type Frame } from './commands';
import type { GameEvent } from './events';
import { nextFloat, nextInt, nextRange, seedRng, type RngHolder } from './rng';
import { addItem, createInitialState, type GameState } from './state';
import { step } from './step';
import { isBlocked, isTileBlocked, plotOrigin, TILE, WORLD_TILES_H, WORLD_TILES_W } from './world';
import { TUNING } from '../data/tuning';

const move = (moveX: number, moveY: number): Frame => ({ ...neutralFrame(), moveX, moveY });

// The initial state now holds nodes and mudlets; movement tests need an empty plot.
function quiet(seed: number): GameState {
  const s = createInitialState(seed);
  s.nodes = [];
  s.creatures = [];
  return s;
}

function run(state: GameState, frame: Frame, n: number, each?: () => void): void {
  for (let i = 0; i < n; i++) {
    step(state, frame);
    each?.();
  }
}

// Does the player's feet box overlap the world px rectangle?
function feetOverlap(s: GameState, x: number, y: number, w: number, h: number): boolean {
  const { hitboxW, hitboxH } = TUNING.player;
  const l = s.player.x - hitboxW / 2;
  const t = s.player.y - hitboxH / 2;
  return l < x + w && l + hitboxW > x && t < y + h && t + hitboxH > y;
}

describe('rng', () => {
  it('same seed gives the same sequence, different seeds differ', () => {
    const seq = (seed: number): number[] => {
      const h: RngHolder = { rng: seedRng(seed) };
      return Array.from({ length: 20 }, () => nextFloat(h));
    };
    expect(seq(1)).toEqual(seq(1));
    expect(seq(1)).not.toEqual(seq(2));
  });

  it('nextInt is inclusive and nextRange stays in range', () => {
    const h: RngHolder = { rng: seedRng(7) };
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = nextInt(h, 1, 3);
      seen.add(v);
      const r = nextRange(h, 8, 14);
      expect(r >= 8 && r < 14).toBe(true);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
});

describe('state', () => {
  it('createInitialState is plain JSON with the player at (88, 120)', () => {
    const s = createInitialState(1);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    expect(s.player.x).toBe(88);
    expect(s.player.y).toBe(120);
    expect(s.day).toBe(1);
    expect(s.phase).toBe('day');
    expect(s.coins).toBe(0);
    expect(s.player.hearts).toBe(5);
    expect(s.plots).toEqual([
      { gx: 0, gy: 0, owned: true },
      { gx: 1, gy: 0, owned: false },
    ]);
  });

  it('carries the package version (Vite define reaches core)', () => {
    expect(createInitialState(1).version).toBe('0.1.0');
  });

  it('addItem adds to the inventory', () => {
    const s = createInitialState(1);
    addItem(s, 'mint', 3);
    expect(s.inventory.mint).toBe(3);
  });

  it('step advances one tick and returns no events when nothing happened', () => {
    const s = createInitialState(1);
    expect(step(s, neutralFrame())).toEqual([]);
    expect(s.tick).toBe(1);
  });
});

describe('world', () => {
  it('is 46 x 20 tiles with the home plot at (3,3)', () => {
    expect(WORLD_TILES_W).toBe(46);
    expect(WORLD_TILES_H).toBe(20);
    expect(plotOrigin(0, 0)).toEqual({ x: 3, y: 3 });
    expect(plotOrigin(1, 0)).toEqual({ x: 23, y: 3 });
  });

  it('blocks water, the locked plot and solid structures, not beds or the road', () => {
    const s = quiet(1);
    expect(isTileBlocked(s, 0, 0)).toBe(true);
    expect(isTileBlocked(s, 23, 8)).toBe(true); // east plot, locked
    expect(isTileBlocked(s, 3 + 2, 3 + 1)).toBe(true); // hut
    expect(isTileBlocked(s, 3 + 6, 3 + 2)).toBe(false); // soil bed
    expect(isTileBlocked(s, 3 + 9, 3 + 13)).toBe(false); // road
    expect(isTileBlocked(s, 3 + 9, 3 + 11)).toBe(true); // stall
    s.plots[1]!.owned = true;
    expect(isTileBlocked(s, 23, 8)).toBe(false);
    // Touching an edge is not overlapping.
    expect(isBlocked(s, 48 + 5, 120, 10, 8)).toBe(false);
    expect(isBlocked(s, 48 + 4.9, 120, 10, 8)).toBe(true);
  });
});

describe('player movement', () => {
  it('60 ticks of moveX 1 move x by 90', () => {
    const s = quiet(1);
    run(s, move(1, 0), 60);
    expect(s.player.x).toBeCloseTo(178, 0);
    expect(Math.abs(s.player.x - 178)).toBeLessThanOrEqual(1);
    expect(s.player.y).toBe(120);
    expect(s.player.facing).toBe('right');
    expect(s.player.moving).toBe(true);
  });

  it('a down-right diagonal covers 90 px of distance in 60 ticks', () => {
    const s = quiet(1);
    run(s, move(1, 1), 60);
    const d = Math.hypot(s.player.x - 88, s.player.y - 120);
    expect(Math.abs(d - 90)).toBeLessThanOrEqual(1);
  });

  it('faces the dominant axis and stops moving on a neutral frame', () => {
    const s = quiet(1);
    run(s, move(-0.3, -1), 1);
    expect(s.player.facing).toBe('up');
    run(s, move(-1, 0.2), 1);
    expect(s.player.facing).toBe('left');
    run(s, neutralFrame(), 1);
    expect(s.player.moving).toBe(false);
    expect(s.player.facing).toBe('left');
  });

  it('cannot enter the hut: walking up stops flush under it', () => {
    const s = quiet(1);
    const hut = { x: (3 + 1) * TILE, y: (3 + 1) * TILE, w: 3 * TILE, h: 2 * TILE };
    run(s, move(0, -1), 600, () => expect(feetOverlap(s, hut.x, hut.y, hut.w, hut.h)).toBe(false));
    expect(s.player.y).toBe(hut.y + hut.h + TUNING.player.hitboxH / 2);
  });

  it('cannot enter deep water on the west or north edge', () => {
    const s = quiet(1);
    const west = { x: 0, y: 0, w: 3 * TILE, h: 20 * TILE };
    run(s, move(-1, 0), 600, () => expect(feetOverlap(s, west.x, west.y, west.w, west.h)).toBe(false));
    expect(s.player.x).toBe(3 * TILE + TUNING.player.hitboxW / 2);

    const n = quiet(1);
    n.player.x = (3 + 15) * TILE + 8;
    const north = { x: 0, y: 0, w: 46 * TILE, h: 3 * TILE };
    run(n, move(0, -1), 600, () => expect(feetOverlap(n, north.x, north.y, north.w, north.h)).toBe(false));
    expect(n.player.y).toBe(3 * TILE + TUNING.player.hitboxH / 2);
  });

  it('cannot enter the locked east plot', () => {
    const s = quiet(1);
    s.player.y = (3 + 8) * TILE + 8;
    const east = { x: 23 * TILE, y: 3 * TILE, w: 20 * TILE, h: 14 * TILE };
    run(s, move(1, 0), 600, () => expect(feetOverlap(s, east.x, east.y, east.w, east.h)).toBe(false));
    expect(s.player.x).toBe(23 * TILE - TUNING.player.hitboxW / 2);
  });

  it('slides along a wall on a diagonal', () => {
    const s = quiet(1);
    run(s, move(-1, -1), 120);
    // Blocked west by water, still moved up until the hut... x is flush with the water edge.
    expect(s.player.x).toBe(3 * TILE + TUNING.player.hitboxW / 2);
    expect(s.player.y).toBeLessThan(120);
  });
});

describe('determinism', () => {
  it('600 scripted frames from the same seed give byte-identical state', () => {
    const script = (i: number): Frame => ({
      ...neutralFrame(),
      moveX: Math.sin(i / 17),
      moveY: Math.cos(i / 23),
      swing: i % 40 === 0,
      interact: i % 55 === 0,
    });
    const play = (): string => {
      const s = createInitialState(42);
      const events: GameEvent[] = [];
      for (let i = 0; i < 600; i++) events.push(...step(s, script(i)));
      return JSON.stringify({ s, events });
    };
    const a = play();
    expect(play()).toBe(a);
    const out = JSON.parse(a) as { s: GameState; events: GameEvent[] };
    expect(out.s.tick).toBe(600);
    expect(out.events.filter((e) => e.type === 'swing').length).toBeGreaterThan(0);
  });
});
