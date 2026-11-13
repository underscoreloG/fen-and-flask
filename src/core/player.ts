import { PLOTS } from '../data/content';
import { ticks, TUNING } from '../data/tuning';
import { morningReset } from './clock';
import type { Frame } from './commands';
import { creatureDef, hitCreature, touchingCreature } from './creatures';
import type { GameEvent } from './events';
import { bedIndex, harvest, interactBed, readyBeds, type ReadyBed } from './garden';
import { hitNode } from './nodes';
import { ringUp, shelfIndex, stockedShelves } from './shop';
import type { StationKind } from './stations';
import type { Area, CreatureState, Facing, GameState, NodeState, PlayerState } from './state';
import {
  DOOR_OUTSIDE,
  DOOR_TILE,
  ENTRY_TILE,
  EXIT_TILE,
  moveAxis,
  structureStands,
  TILE,
  tileAt,
  WORLD_STRUCTURES,
  type WorldStructure,
} from './world';

const P = TUNING.player;
const STEP = P.speed / TUNING.sim.tickRate;
const HURT = TUNING.hurt;

// Each door: the tile that takes you through, the tile in front of it (from where you push
// into it), the push direction, and where you arrive.
interface Door {
  from: Area;
  tile: { x: number; y: number };
  front: { x: number; y: number };
  push: Facing;
  to: Area;
  land: { x: number; y: number };
  face: Facing;
}

const DOORS: readonly Door[] = [
  { from: 'world', tile: DOOR_TILE, front: DOOR_OUTSIDE, push: 'up', to: 'shop', land: ENTRY_TILE, face: 'up' },
  { from: 'shop', tile: EXIT_TILE, front: ENTRY_TILE, push: 'down', to: 'world', land: DOOR_OUTSIDE, face: 'down' },
];

const center = (t: { x: number; y: number }): { x: number; y: number } => ({ x: (t.x + 0.5) * TILE, y: (t.y + 0.5) * TILE });

// Pushing into a doorway from just beside its center slides the player in line with it, so a
// one-tile gap never snags on its corners.
function doorNudge(state: GameState, mx: number, my: number): number {
  const p = state.player;
  for (const d of DOORS) {
    if (d.from !== p.area || tileAt(p.x) !== d.front.x || tileAt(p.y) !== d.front.y) continue;
    const pushing = d.push === 'up' ? my < 0 : my > 0;
    if (!pushing || Math.abs(mx) >= Math.abs(my)) continue;
    const dx = center(d.front).x - p.x;
    return Math.sign(dx) * Math.min(Math.abs(dx), STEP);
  }
  return 0;
}

// Feet center on a door tile: through to the other side, at the center of the landing tile one
// step away from the door there, so holding the same direction carries on and never bounces back.
export function updateDoors(state: GameState, events: GameEvent[]): void {
  const p = state.player;
  const d = DOORS.find((o) => o.from === p.area && tileAt(p.x) === o.tile.x && tileAt(p.y) === o.tile.y);
  if (!d) return;
  const at = center(d.land);
  p.area = d.to;
  p.x = at.x;
  p.y = at.y;
  p.facing = d.face;
  events.push({ type: 'areaChanged', area: d.to });
}

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
  moveAxis(state, p, mx * STEP + doorNudge(state, mx, my), 'x', P.hitboxW, P.hitboxH);
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
  // Creatures, nodes and beds all live outdoors: a swing indoors hits nothing.
  if (p.area !== 'world') return null;
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

// The counter is worked from its interact side only (specs/wp/WP11): from the customers' side the
// reach circle can still touch its interact tile, two tiles away across it.
function acrossCounter(state: GameState, s: WorldStructure): boolean {
  const mid = s.y + s.h / 2;
  return s.def.kind === 'counter' && (state.player.y - mid) * (s.interactY - mid) < 0;
}

// Structures with an interact tile in the player's area, on an owned plot. The exit is only a
// target while the shop is open, to say why it does not let you out.
function usableStructures(state: GameState): WorldStructure[] {
  const open = state.shop.phase === 'open';
  return WORLD_STRUCTURES.filter(
    (s) =>
      s.def.interact !== undefined &&
      s.area === state.player.area &&
      (s.def.kind !== 'exit' || open) &&
      !acrossCounter(state, s) &&
      structureStands(state, s) &&
      state.plots.some((pl) => pl.gx === s.plot.gx && pl.gy === s.plot.gy && pl.owned),
  );
}

function findInteractTarget(state: GameState): { s: WorldStructure; assist: boolean } | null {
  const p = state.player;
  const usable = usableStructures(state);
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
  const shop = state.shop;
  switch (s.def.kind) {
    case 'cot':
      events.push({ type: 'uiRequest', ui: 'sleepConfirm' });
      break;
    case 'sign':
      if (shop.phase === 'open') events.push({ type: 'uiRequest', ui: 'closeShopConfirm' });
      else if (shop.openedToday) events.push({ type: 'uiRequest', ui: 'toast', text: 'SHOP IS DONE FOR TODAY' });
      else if (stockedShelves(state).length === 0) events.push({ type: 'uiRequest', ui: 'toast', text: 'STOCK A SHELF FIRST' });
      else events.push({ type: 'uiRequest', ui: 'openShopConfirm' });
      break;
    case 'shelf':
      events.push({ type: 'uiRequest', ui: 'shelf', shelf: shelfIndex(s.def.id) });
      break;
    case 'counter':
      // No panel: the press rings up whoever waits at spot 1.
      ringUp(state, events);
      break;
    case 'signpost': {
      const plot = PLOTS.findIndex((p) => p.id === s.def.sells);
      if (plot >= 0) events.push({ type: 'uiRequest', ui: 'buyPlotConfirm', plot });
      break;
    }
    case 'bed':
      interactBed(state, bedIndex(s.def.id), events);
      break;
    case 'mortar':
    case 'cauldron':
      // A station's structure id is its StationKind (there are two cauldrons).
      events.push({ type: 'uiRequest', ui: 'station', station: s.def.id as StationKind });
      break;
    case 'catalog':
      events.push({ type: 'uiRequest', ui: 'catalog' });
      break;
    case 'board':
      events.push({ type: 'uiRequest', ui: 'order' });
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

// The morning reset puts the player in bed, indoors.
function faint(state: GameState, events: GameEvent[]): void {
  const p = state.player;
  events.push({ type: 'playerFainted', x: p.x, y: p.y });
  p.hearts = P.hearts;
  morningReset(state, events);
}

// For the renderer: what a swing or an interact would hit right now. Never turns the player.
export function updateTargets(state: GameState): void {
  const p = state.player;
  p.swingTarget = findSwingTarget(state)?.ent.id ?? null;
  p.interactTarget = findInteractTarget(state)?.s.def.id ?? null;
}
