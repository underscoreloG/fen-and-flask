import { describe, expect, it } from 'vitest';
import { CREATURES, NODES } from '../data/content';
import { TUNING } from '../data/tuning';
import { neutralFrame, type Frame } from './commands';
import { creatureDef } from './creatures';
import type { GameEvent } from './events';
import { isNearStructure } from './nodes';
import { createInitialState, type GameState } from './state';
import { step } from './step';
import { plotOrigin, plotTileCenter, TILE, tileAt, tileKind } from './world';

const SWING: Frame = { ...neutralFrame(), swing: true };
const MUDLET = CREATURES[0]!;

// An empty home plot with the player on open grass at plot tile (5,7), facing down.
function scene(seed = 1): GameState {
  const s = createInitialState(seed);
  s.nodes = [];
  s.creatures = [];
  const at = plotTileCenter(0, 0, 5, 7);
  s.player.x = at.x;
  s.player.y = at.y;
  s.player.facing = 'down';
  return s;
}

function placeMudlet(s: GameState, x: number, y: number): number {
  const id = s.nextId++;
  s.creatures.push({
    id,
    type: 'mudlet',
    x,
    y,
    hp: MUDLET.hp,
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
  return id;
}

function run(s: GameState, n: number, frame: Frame = neutralFrame(), each?: () => void): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    each?.();
    out.push(...step(s, frame));
  }
  return out;
}

const count = (ev: GameEvent[], type: GameEvent['type']): number => ev.filter((e) => e.type === type).length;

describe('mudlet spawn', () => {
  it('seeds 1-20: the home plot starts with its mudlet count, by the spawn rule, 4+ tiles from the player', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createInitialState(seed);
      expect(s.creatures.length).toBe(MUDLET.counts.home);
      const o = plotOrigin(0, 0);
      const ptx = tileAt(s.player.x);
      const pty = tileAt(s.player.y);
      for (const c of s.creatures) {
        const tx = tileAt(c.x);
        const ty = tileAt(c.y);
        const where = `seed ${seed} mudlet ${c.id}`;
        expect(ty - o.y, where).toBeLessThanOrEqual(TUNING.spawn.creatureMaxRow);
        expect(tileKind(s, tx, ty), where).toBe('grass');
        expect(isNearStructure(tx, ty), where).toBe(false);
        expect(Math.max(Math.abs(tx - ptx), Math.abs(ty - pty)), where).toBeGreaterThanOrEqual(TUNING.spawn.creaturePlayerClearance);
        for (const n of [...s.nodes, ...s.creatures]) {
          if (n === c) continue;
          expect(Math.max(Math.abs(tx - tileAt(n.x)), Math.abs(ty - tileAt(n.y))), where).toBeGreaterThan(1);
        }
      }
      expect(s.nodes.length).toBe(NODES.reduce((sum, n) => sum + n.targets.home, 0));
    }
  });
});

describe('combat', () => {
  it('with a mudlet and a node both in reach, the mudlet is hit', () => {
    const s = scene();
    s.nodes.push({ id: s.nextId++, type: 'stump', x: s.player.x, y: s.player.y + 14, hp: 3, plot: 0 });
    const id = placeMudlet(s, s.player.x + 10, s.player.y + 12);
    const ev = step(s, SWING);
    expect(ev.find((e) => e.type === 'swing')).toMatchObject({ targetId: id });
    expect(count(ev, 'creatureHit')).toBe(1);
    expect(count(ev, 'nodeHit')).toBe(0);
  });

  it('a hit knocks the mudlet away from the player and stuns it', () => {
    const s = scene();
    s.player.invulnerable = 10000;
    placeMudlet(s, s.player.x, s.player.y + 12);
    step(s, SWING);
    const c = s.creatures[0]!;
    expect(c.stun).toBeGreaterThan(0);
    run(s, 9);
    expect(c.y).toBeCloseTo(s.player.y + 12 + MUDLET.knockback, 5);
  });

  it('3 hits kill a mudlet and drop 1 mudgel', () => {
    const s = scene();
    s.player.invulnerable = 10000;
    const id = placeMudlet(s, s.player.x, s.player.y + 12);
    const ev: GameEvent[] = [];
    for (let i = 0; i < 3; i++) {
      // Put it back in front after each knockback.
      const c = s.creatures.find((x) => x.id === id);
      if (c) {
        c.x = s.player.x;
        c.y = s.player.y + 12;
      }
      ev.push(...step(s, SWING), ...run(s, 18));
    }
    expect(count(ev, 'creatureHit')).toBe(3);
    expect(count(ev, 'creatureDied')).toBe(1);
    const died = ev.findIndex((e) => e.type === 'creatureDied');
    expect(ev.findIndex((e) => e.type === 'creatureHit' && e.hp === 0)).toBe(died - 1);
    const drops = ev.filter((e) => e.type === 'pickupSpawned');
    expect(drops.length).toBe(1);
    expect(drops[0]).toMatchObject({ item: 'mudgel' });
    expect(s.creatures.length).toBe(0);
  });

  it('contact costs exactly 1 heart, a second contact inside 1.0 s costs none, then it counts again', () => {
    const s = scene();
    const id = placeMudlet(s, s.player.x, s.player.y);
    const glue = (): void => {
      const c = s.creatures.find((x) => x.id === id)!;
      c.x = s.player.x;
      c.y = s.player.y;
    };
    const first = step(s, neutralFrame());
    expect(count(first, 'playerHurt')).toBe(1);
    expect(first[0]).toMatchObject({ type: 'playerHurt', hearts: TUNING.player.hearts - 1 });
    expect(s.player.hearts).toBe(TUNING.player.hearts - 1);
    // Forced contact on every tick for the rest of the second.
    const inside = run(s, 59, neutralFrame(), glue);
    expect(count(inside, 'playerHurt')).toBe(0);
    expect(s.player.hearts).toBe(TUNING.player.hearts - 1);
    const after = run(s, 1, neutralFrame(), glue);
    expect(count(after, 'playerHurt')).toBe(1);
    expect(s.player.hearts).toBe(TUNING.player.hearts - 2);
  });

  it('contact knocks the player 24 px away from the mudlet', () => {
    const s = scene();
    placeMudlet(s, s.player.x, s.player.y - 6);
    const y0 = s.player.y;
    step(s, neutralFrame());
    // Remove it so the chase does not matter, then let the knockback run out.
    s.creatures = [];
    run(s, 9);
    expect(s.player.y - y0).toBeCloseTo(TUNING.hurt.knockback, 5);
  });

  it('at 0 hearts the player faints once, wakes at the hut door with full hearts', () => {
    const s = scene();
    s.player.hearts = 1;
    placeMudlet(s, s.player.x, s.player.y);
    const ev = [...step(s, neutralFrame()), ...run(s, 120)];
    expect(count(ev, 'playerFainted')).toBe(1);
    expect(ev.findIndex((e) => e.type === 'playerHurt')).toBe(ev.findIndex((e) => e.type === 'playerFainted') - 1);
    const door = plotTileCenter(0, 0, 2, 3);
    expect(s.player.x).toBe(door.x);
    expect(s.player.y).toBe(door.y);
    expect(s.player.hearts).toBe(TUNING.player.hearts);
  });
});

describe('mudlet wander', () => {
  it('seeds 1-5, 3000 ticks, player far away: no mudlet leaves the home plot or enters row 13', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = createInitialState(seed);
      // The east plot owned too, so only the plot clamp keeps them home.
      s.plots[1]!.owned = true;
      s.player.x = 4;
      s.player.y = 4;
      const o = plotOrigin(0, 0);
      const x0 = o.x * TILE;
      const x1 = (o.x + TUNING.world.plotW) * TILE;
      const y0 = o.y * TILE;
      const roadTop = (o.y + TUNING.world.roadRow) * TILE;
      let moved = 0;
      const start = s.creatures.map((c) => ({ x: c.x, y: c.y }));
      run(s, 3000, neutralFrame(), () => {
        for (const c of s.creatures) {
          const d = creatureDef(c.type);
          expect(c.x - d.hitboxW / 2).toBeGreaterThanOrEqual(x0);
          expect(c.x + d.hitboxW / 2).toBeLessThanOrEqual(x1);
          expect(c.y - d.hitboxH / 2).toBeGreaterThanOrEqual(y0);
          expect(c.y + d.hitboxH / 2).toBeLessThanOrEqual(roadTop);
        }
      });
      s.creatures.forEach((c, i) => {
        moved += Math.hypot(c.x - start[i]!.x, c.y - start[i]!.y);
      });
      expect(s.creatures.length).toBe(MUDLET.counts.home);
      expect(moved).toBeGreaterThan(0);
    }
  });

  it('a mudlet in aggro range closes in on the player', () => {
    const s = scene();
    s.player.invulnerable = 10000;
    placeMudlet(s, s.player.x + MUDLET.aggroRadius - 4, s.player.y);
    const c = s.creatures[0]!;
    const d0 = c.x - s.player.x;
    run(s, 30);
    expect(c.mode).toBe('chase');
    expect(d0 - (c.x - s.player.x)).toBeCloseTo((MUDLET.hopSpeed / 60) * 30, 5);
  });
});
