import { ticks, TUNING } from '../data/tuning';
import { morningReset } from './clock';
import type { Frame } from './commands';
import { creatureDef, hitCreature, touchingCreature } from './creatures';
import type { GameEvent } from './events';
import { bedIndex, harvest, interactBed, readyBeds, type ReadyBed } from './garden';
import { hitNode } from './nodes';
import type { CreatureState, Facing, GameState, NodeState, PlayerState } from './state';
import { moveAxis, WORLD_STRUCTURES, type WorldStructure } from './world';

const P = TUNING.player;
const STEP = P.speed / TUNING.sim.tickRate;
const HURT = TUNING.hurt;

export function updatePlayer(state: GameState, frame: Frame): void {
  const p = state.player;
  if (p.swingCooldown > 0) p.swingCooldown -= 1;
  if (p.invulnerable > 0) p.invulnerable -= 1;
  if (p.knockTicks > 0) {
    // Knockback overrides the stick until it ends.
    p.knockTicks -= 1;
    p.moving = false;
    moveAxis(state, p, p.knockX, 'x', P.hitboxW, P.hitboxH);
    moveAxis(state, p, p.knockY, 'y', P.hitboxW, P.hitboxH);
    return;
  }
  let mx = clampUnit(frame.moveX);
  let my = clampUnit(frame.moveY);
  const len = Math.hypot(mx, my);
  // Diagonals are normalized; a half-tilted stick stays slower than full speed.
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  p.moving = len > 0;
  if (!p.moving) return;
  p.facing = faceToward(p.facing, mx, my);
  moveAxis(state, p, mx * STEP, 'x', P.hitboxW, P.hitboxH);
  moveAxis(state, p, my * STEP, 'y', P.hitboxW, P.hitboxH);
}

function clampUnit(v: number): number {
  return Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
}

// Dominant axis wins; on an exact diagonal keep the current facing if it is one of the two.
function faceToward(current: Facing, mx: number, my: number): Facing {
  const h: Facing = mx > 0 ? 'right' : 'left';
  const v: Facing = my > 0 ? 'down' : 'up';
  const ax = Math.abs(mx);
  const ay = Math.abs(my);
  if (ax > ay) return h;
  if (ay > ax) return v;
  return current === h || current === v ? current : h;
}

const FACING_VEC: Record<Facing, { x: number; y: number }> = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

interface Reach {
  reachRadius: number;
  reachOffset: number;
  assistRadius: number;
}

// Nearest of `items` to the reach circle center within the circle, else nearest to the feet
// within the assist radius. `assist` tells the caller to turn the player on a press.
function nearestInReach<T>(
  p: PlayerState,
  r: Reach,
  items: readonly T[],
  pos: (t: T) => { x: number; y: number },
  assist: boolean,
): T | null {
  const f = FACING_VEC[p.facing];
  const cx = assist ? p.x : p.x + f.x * r.reachOffset;
  const cy = assist ? p.y : p.y + f.y * r.reachOffset;
  const radius = assist ? r.assistRadius : r.reachRadius;
  let best: T | null = null;
  let bestD = Infinity;
  for (const t of items) {
    const q = pos(t);
    const d = Math.hypot(q.x - cx, q.y - cy);
    if (d <= radius && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

type SwingTarget =
  | { kind: 'creature'; ent: CreatureState; assist: boolean }
  | { kind: 'node'; ent: NodeState; assist: boolean }
  | { kind: 'bed'; ent: ReadyBed; assist: boolean };

// Priority: nearest creature in reach, else nearest node, else a ready bed; then the same in
// the assist radius around the feet.
function findSwingTarget(state: GameState): SwingTarget | null {
  const p = state.player;
  const beds = readyBeds(state);
  for (const assist of [false, true]) {
    const creature = nearestInReach(p, TUNING.swing, state.creatures, (c) => c, assist);
    if (creature) return { kind: 'creature', ent: creature, assist };
    const node = nearestInReach(p, TUNING.swing, state.nodes, (n) => n, assist);
    if (node) return { kind: 'node', ent: node, assist };
    const bed = nearestInReach(p, TUNING.swing, beds, (b) => b, assist);
    if (bed) return { kind: 'bed', ent: bed, assist };
  }
  return null;
}

function findInteractTarget(state: GameState): { s: WorldStructure; assist: boolean } | null {
  const p = state.player;
  const usable = WORLD_STRUCTURES.filter((s) => state.plots.some((pl) => pl.gx === s.plot.gx && pl.gy === s.plot.gy && pl.owned));
  for (const assist of [false, true]) {
    const s = nearestInReach(p, TUNING.interact, usable, (w) => ({ x: w.interactX, y: w.interactY }), assist);
    if (s) return { s, assist };
  }
  return null;
}

// Turns the player toward an assist target; only ever called on a press.
function turnToward(p: PlayerState, x: number, y: number): void {
  const dx = x - p.x;
  const dy = y - p.y;
  if (dx !== 0 || dy !== 0) p.facing = faceToward(p.facing, dx, dy);
}

export function swing(state: GameState, events: GameEvent[]): void {
  const p = state.player;
  if (p.swingCooldown > 0) return;
  p.swingCooldown = ticks(TUNING.swing.cooldown);
  const t = findSwingTarget(state);
  if (t?.assist) turnToward(p, t.ent.x, t.ent.y);
  events.push({ type: 'swing', x: p.x, y: p.y, facing: p.facing, targetId: t ? t.ent.id : null });
  if (t?.kind === 'creature') hitCreature(state, t.ent, events);
  else if (t?.kind === 'node') hitNode(state, t.ent, events);
  else if (t?.kind === 'bed') harvest(state, t.ent.index, events);
}

export function interact(state: GameState, events: GameEvent[]): void {
  const found = findInteractTarget(state);
  if (!found) return;
  let s = found.s;
  if (found.assist) {
    turnToward(state.player, s.interactX, s.interactY);
    // After the turn the reach circle may favour a neighbour (beds are one tile apart); route to
    // what updateTargets will report, so a command sent back from the panel passes the target check.
    s = findInteractTarget(state)?.s ?? s;
  }
  events.push({ type: 'interact', kind: s.def.kind, structureId: s.def.id });
  switch (s.def.kind) {
    case 'hut':
      events.push({ type: 'uiRequest', ui: 'sleepConfirm' });
      break;
    case 'stall':
      // The evening stall is WP04.
      if (state.phase === 'day') events.push({ type: 'uiRequest', ui: 'callItADayConfirm' });
      break;
    case 'bed':
      interactBed(state, bedIndex(s.def.id), events);
      break;
    case 'mortar':
    case 'cauldron':
      events.push({ type: 'uiRequest', ui: 'station', station: s.def.kind });
      break;
    default:
      break;
  }
}

// Contact with a mudlet: one heart, knockback away from it, then a spell of invulnerability.
export function updateHurt(state: GameState, events: GameEvent[]): void {
  const p = state.player;
  if (p.invulnerable > 0) return;
  const c = touchingCreature(state);
  if (!c) return;
  p.hearts = Math.max(0, p.hearts - creatureDef(c.type).contactDamage);
  events.push({ type: 'playerHurt', x: p.x, y: p.y, hearts: p.hearts, fromX: c.x, fromY: c.y });
  let ux = p.x - c.x;
  let uy = p.y - c.y;
  const len = Math.hypot(ux, uy);
  if (len > 0) {
    ux /= len;
    uy /= len;
  } else {
    // Exactly on top: step back against the facing.
    ux = -FACING_VEC[p.facing].x;
    uy = -FACING_VEC[p.facing].y;
  }
  const kt = ticks(HURT.knockbackTime);
  p.knockTicks = kt;
  p.knockX = (ux * HURT.knockback) / kt;
  p.knockY = (uy * HURT.knockback) / kt;
  p.invulnerable = ticks(HURT.invulnerable);
  if (p.hearts <= 0) faint(state, events);
}

const HUT_DOOR = WORLD_STRUCTURES.find((s) => s.def.kind === 'hut')!;

function faint(state: GameState, events: GameEvent[]): void {
  const p = state.player;
  events.push({ type: 'playerFainted', x: p.x, y: p.y });
  p.hearts = P.hearts;
  p.x = HUT_DOOR.interactX;
  p.y = HUT_DOOR.interactY;
  p.facing = 'down';
  p.moving = false;
  p.knockTicks = 0;
  p.knockX = 0;
  p.knockY = 0;
  // After the move, so the respawn distance rule is measured from where the player wakes.
  morningReset(state, events);
}

// For the renderer: what a swing or an interact would hit right now. Never turns the player.
export function updateTargets(state: GameState): void {
  const p = state.player;
  p.swingTarget = findSwingTarget(state)?.ent.id ?? null;
  p.interactTarget = findInteractTarget(state)?.s.def.id ?? null;
}
