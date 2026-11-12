import { describe, expect, it } from 'vitest';
import { NODES, type NodeId } from '../data/content';
import { TUNING } from '../data/tuning';
import { neutralFrame, type Frame } from './commands';
import type { GameEvent } from './events';
import { isNearStructure, nodeDef } from './nodes';
import { createInitialState, type GameState } from './state';
import { step } from './step';
import { plotOrigin, plotTileCenter, tileAt, tileKind } from './world';

const SWING: Frame = { ...neutralFrame(), swing: true };

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

function placeNode(s: GameState, type: NodeId, x: number, y: number): number {
  const id = s.nextId++;
  s.nodes.push({ id, type, x, y, hp: nodeDef(type).hits, plot: 0 });
  return id;
}

function run(s: GameState, n: number, frame: Frame = neutralFrame()): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...step(s, frame));
  return out;
}

// Swing, then wait out the cooldown (presses 19 ticks apart).
function swingAndWait(s: GameState): GameEvent[] {
  return [...step(s, SWING), ...run(s, 18)];
}

// Walks the player onto every pickup until `done` or the tick budget runs out.
function collectAll(s: GameState, done: () => boolean, budget = 240): void {
  for (let i = 0; i < budget && !done(); i++) {
    const k = s.pickups[0];
    if (!k) {
      step(s, neutralFrame());
      continue;
    }
    const dx = k.x - s.player.x;
    const dy = k.y - s.player.y;
    const d = Math.hypot(dx, dy) || 1;
    step(s, { ...neutralFrame(), moveX: dx / d, moveY: dy / d });
  }
}

const types = (ev: GameEvent[]): string[] => ev.map((e) => e.type);

describe('node spawn', () => {
  it('seeds 1-20: the home plot holds exactly the home targets and every node keeps the spawn rule', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createInitialState(seed);
      for (const def of NODES) {
        expect(s.nodes.filter((n) => n.type === def.id).length, `seed ${seed} ${def.id}`).toBe(def.targets.home);
      }
      const o = plotOrigin(0, 0);
      const ptx = tileAt(s.player.x);
      const pty = tileAt(s.player.y);
      for (const n of s.nodes) {
        const tx = tileAt(n.x);
        const ty = tileAt(n.y);
        const where = `seed ${seed} node ${n.id} at ${tx},${ty}`;
        expect(n.x, where).toBe((tx + 0.5) * 16);
        expect(n.y, where).toBe((ty + 0.5) * 16);
        expect(n.plot, where).toBe(0);
        expect(ty - o.y, where).toBeGreaterThanOrEqual(0);
        expect(ty - o.y, where).toBeLessThanOrEqual(TUNING.spawn.nodeMaxRow);
        expect(tileKind(s, tx, ty), where).toBe('grass');
        expect(isNearStructure(tx, ty), where).toBe(false);
        expect(Math.max(Math.abs(tx - ptx), Math.abs(ty - pty)), where).toBeGreaterThan(1);
        for (const m of s.nodes) {
          if (m === n) continue;
          expect(Math.max(Math.abs(tx - tileAt(m.x)), Math.abs(ty - tileAt(m.y))), where).toBeGreaterThan(1);
        }
      }
    }
  });

  it('the initial state is plain JSON', () => {
    const s = createInitialState(3);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('gathering', () => {
  it('a swing at a mintbush in reach breaks it, drops 1 mint, and walking onto it collects it', () => {
    const s = scene();
    placeNode(s, 'mintbush', s.player.x, s.player.y + 14);
    const ev = step(s, SWING);
    expect(types(ev)).toEqual(['swing', 'nodeHit', 'nodeBroken', 'pickupSpawned']);
    expect(ev[1]).toMatchObject({ type: 'nodeHit', nodeType: 'mintbush', hp: 0 });
    expect(ev[2]).toMatchObject({ type: 'nodeBroken', nodeType: 'mintbush' });
    expect(ev[3]).toMatchObject({ type: 'pickupSpawned', item: 'mint' });
    expect(s.nodes.length).toBe(0);
    expect(s.pickups.length).toBe(1);
    const k = s.pickups[0]!;
    const d = Math.hypot(k.x - k.fromX, k.y - k.fromY);
    expect(d).toBeGreaterThanOrEqual(TUNING.pickup.scatterMin);
    expect(d).toBeLessThanOrEqual(TUNING.pickup.scatterMax);
    collectAll(s, () => s.inventory.mint > 0);
    expect(s.inventory.mint).toBe(1);
    expect(s.pickups.length).toBe(0);
  });

  it('pickupCollected carries the item and the new count', () => {
    const s = scene();
    placeNode(s, 'glowcaps', s.player.x, s.player.y + 14);
    step(s, SWING);
    const seen: GameEvent[] = [];
    for (let i = 0; i < 240 && s.inventory.glowcap === 0; i++) {
      const k = s.pickups[0]!;
      const dx = k.x - s.player.x;
      const dy = k.y - s.player.y;
      const d = Math.hypot(dx, dy) || 1;
      seen.push(...step(s, { ...neutralFrame(), moveX: dx / d, moveY: dy / d }));
    }
    expect(seen.find((e) => e.type === 'pickupCollected')).toMatchObject({ item: 'glowcap', count: 1 });
  });

  it('reedclump breaks on the 2nd hit and drops 1 or 2 reed', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 10; seed++) {
      const s = scene(seed);
      placeNode(s, 'reedclump', s.player.x, s.player.y + 14);
      const first = swingAndWait(s);
      expect(types(first)).not.toContain('nodeBroken');
      expect(first.find((e) => e.type === 'nodeHit')).toMatchObject({ hp: 1 });
      const second = step(s, SWING);
      expect(types(second).slice(0, 3)).toEqual(['swing', 'nodeHit', 'nodeBroken']);
      const drops = second.filter((e) => e.type === 'pickupSpawned');
      expect(drops.every((e) => e.type === 'pickupSpawned' && e.item === 'reed')).toBe(true);
      expect(drops.length).toBeGreaterThanOrEqual(1);
      expect(drops.length).toBeLessThanOrEqual(2);
      counts.add(drops.length);
    }
    expect([...counts].sort()).toEqual([1, 2]);
  });

  it('stump breaks on the 3rd hit and drops 2 bogwood', () => {
    const s = scene();
    placeNode(s, 'stump', s.player.x, s.player.y + 14);
    expect(types(swingAndWait(s))).not.toContain('nodeBroken');
    expect(types(swingAndWait(s))).not.toContain('nodeBroken');
    const third = step(s, SWING);
    expect(types(third)).toEqual(['swing', 'nodeHit', 'nodeBroken', 'pickupSpawned', 'pickupSpawned']);
    expect(s.pickups.map((k) => k.item)).toEqual(['bogwood', 'bogwood']);
    collectAll(s, () => s.inventory.bogwood === 2);
    expect(s.inventory.bogwood).toBe(2);
  });

  it('two presses 6 ticks apart land one hit; 19 (and 18) apart land two', () => {
    const hits = (gap: number): number => {
      const s = scene();
      placeNode(s, 'stump', s.player.x, s.player.y + 14);
      const ev = [...step(s, SWING), ...run(s, gap - 1), ...step(s, SWING)];
      return ev.filter((e) => e.type === 'nodeHit').length;
    };
    expect(hits(6)).toBe(1);
    expect(hits(19)).toBe(2);
    expect(hits(18)).toBe(2);
    expect(hits(17)).toBe(1);
  });

  it('a press during the cooldown plays nothing', () => {
    const s = scene();
    step(s, SWING);
    expect(run(s, 1, SWING)).toEqual([]);
  });

  it('with nothing in front and a node 14 px behind, the swing hits it and the facing flips', () => {
    const s = scene();
    const id = placeNode(s, 'stump', s.player.x, s.player.y - 14);
    // Targeting alone never turns the player.
    step(s, neutralFrame());
    expect(s.player.swingTarget).toBe(id);
    expect(s.player.facing).toBe('down');
    const ev = step(s, SWING);
    expect(ev.find((e) => e.type === 'nodeHit')).toMatchObject({ id, nodeType: 'stump' });
    expect(s.player.facing).toBe('up');
  });

  it('a swing at the air still plays, with no target', () => {
    const s = scene();
    expect(step(s, SWING)).toEqual([{ type: 'swing', x: s.player.x, y: s.player.y, facing: 'down', targetId: null }]);
  });

  it('nodes are solid: walking into one stops flush against its box', () => {
    const s = scene();
    placeNode(s, 'stump', s.player.x, s.player.y + 24);
    run(s, 60, { ...neutralFrame(), moveY: 1 });
    expect(s.player.y).toBe(s.nodes[0]!.y - TUNING.node.hitboxH / 2 - TUNING.player.hitboxH / 2);
  });
});

describe('interact', () => {
  it('at the hut door facing up, interact emits the hut and the target is exposed', () => {
    const s = scene();
    const door = plotTileCenter(0, 0, 2, 3);
    s.player.x = door.x;
    s.player.y = door.y;
    s.player.facing = 'up';
    const ev = step(s, { ...neutralFrame(), interact: true });
    expect(ev).toEqual([{ type: 'interact', kind: 'hut', structureId: 'hut' }]);
    expect(s.player.interactTarget).toBe('hut');
  });

  it('interact with nothing near emits nothing', () => {
    const s = scene();
    expect(step(s, { ...neutralFrame(), interact: true })).toEqual([]);
    expect(s.player.interactTarget).toBeNull();
  });
});
