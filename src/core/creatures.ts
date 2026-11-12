// Mudlets (specs/content.md, Creature): wander, chase the player when close, take knockback.
import { CREATURES, PLOTS, type CreatureDef } from '../data/content';
import { ticks, TUNING } from '../data/tuning';
import type { GameEvent } from './events';
import { pickSpawnTile } from './nodes';
import { spawnDrops } from './pickups';
import { nextInt, nextRange } from './rng';
import type { CreatureState, GameState } from './state';
import { boxesOverlap, moveAxis, plotRect, type Rect } from './world';

const RATE = TUNING.sim.tickRate;

export function creatureDef(type: CreatureState['type']): CreatureDef {
  return CREATURES.find((c) => c.id === type)!;
}

// A mudlet's whole feet box stays inside its plot and above the road row.
export function creatureBounds(state: GameState, c: CreatureState): Rect | null {
  const plot = state.plots[c.plot];
  return plot ? plotRect(plot.gx, plot.gy, TUNING.world.roadRow) : null;
}

function idleTicks(state: GameState, def: CreatureDef): number {
  return nextInt(state, ticks(def.idleMin), ticks(def.idleMax));
}

// Brings each creature type of a plot up to its morning count; survivors stay.
export function refillCreatures(state: GameState, plotIndex: number): void {
  const plotId = PLOTS[plotIndex]?.id;
  if (!plotId) return;
  const S = TUNING.spawn;
  for (const def of CREATURES) {
    let have = state.creatures.filter((c) => c.plot === plotIndex && c.type === def.id).length;
    while (have < def.counts[plotId]) {
      const at = pickSpawnTile(state, plotIndex, S.creatureMaxRow, S.creaturePlayerClearance);
      if (!at) return;
      state.creatures.push({
        id: state.nextId++,
        type: def.id,
        x: at.x,
        y: at.y,
        hp: def.hp,
        plot: plotIndex,
        mode: 'idle',
        timer: idleTicks(state, def),
        dirX: 0,
        dirY: 0,
        stun: 0,
        knockTicks: 0,
        knockX: 0,
        knockY: 0,
      });
      have += 1;
    }
  }
}

function move(state: GameState, c: CreatureState, def: CreatureDef, dx: number, dy: number): void {
  const b = creatureBounds(state, c);
  moveAxis(state, c, dx, 'x', def.hitboxW, def.hitboxH, b);
  moveAxis(state, c, dy, 'y', def.hitboxW, def.hitboxH, b);
}

export function updateCreatures(state: GameState): void {
  const p = state.player;
  for (const c of state.creatures) {
    const def = creatureDef(c.type);
    if (c.knockTicks > 0) {
      c.knockTicks -= 1;
      move(state, c, def, c.knockX, c.knockY);
    }
    if (c.stun > 0) {
      c.stun -= 1;
      continue;
    }
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d <= def.aggroRadius) {
      c.mode = 'chase';
      const s = Math.min(def.hopSpeed / RATE, d);
      if (d > 0) move(state, c, def, (dx / d) * s, (dy / d) * s);
      continue;
    }
    if (c.mode === 'chase') {
      c.mode = 'idle';
      c.timer = idleTicks(state, def);
    }
    c.timer -= 1;
    if (c.timer <= 0) {
      if (c.mode === 'walk') {
        c.mode = 'idle';
        c.timer = idleTicks(state, def);
      } else {
        const a = nextRange(state, 0, 2 * Math.PI);
        c.mode = 'walk';
        c.dirX = Math.cos(a);
        c.dirY = Math.sin(a);
        c.timer = nextInt(state, ticks(def.walkMin), ticks(def.walkMax));
      }
    }
    if (c.mode === 'walk') {
      const s = def.wanderSpeed / RATE;
      move(state, c, def, c.dirX * s, c.dirY * s);
    }
  }
}

// One swing hit: knockback away from the player and a stun, or death and a drop.
export function hitCreature(state: GameState, c: CreatureState, events: GameEvent[]): void {
  const def = creatureDef(c.type);
  c.hp -= TUNING.swing.damage;
  const base = { id: c.id, creatureType: c.type, x: c.x, y: c.y };
  events.push({ type: 'creatureHit', ...base, hp: Math.max(0, c.hp) });
  if (c.hp <= 0) {
    state.creatures = state.creatures.filter((o) => o.id !== c.id);
    events.push({ type: 'creatureDied', ...base });
    spawnDrops(state, def.drop.item, nextInt(state, def.drop.min, def.drop.max), c.x, c.y, events);
    return;
  }
  let ux = c.x - state.player.x;
  let uy = c.y - state.player.y;
  const len = Math.hypot(ux, uy);
  if (len > 0) {
    ux /= len;
    uy /= len;
  } else {
    ux = 0;
    uy = 1;
  }
  const kt = ticks(def.knockbackTime);
  c.knockTicks = kt;
  c.knockX = (ux * def.knockback) / kt;
  c.knockY = (uy * def.knockback) / kt;
  c.stun = ticks(def.stun);
}

// The first creature whose feet box overlaps the player's.
export function touchingCreature(state: GameState): CreatureState | undefined {
  const p = state.player;
  const { hitboxW, hitboxH } = TUNING.player;
  return state.creatures.find((c) => {
    const def = creatureDef(c.type);
    return boxesOverlap(p.x, p.y, hitboxW, hitboxH, c.x, c.y, def.hitboxW, def.hitboxH);
  });
}
