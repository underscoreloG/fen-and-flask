import { TUNING } from '../data/tuning';
import type { Frame } from './commands';
import type { Facing, GameState, PlayerState } from './state';
import { TILE, isBlocked } from './world';

const P = TUNING.player;
const STEP = P.speed / TUNING.sim.tickRate;

export function updatePlayer(state: GameState, frame: Frame): void {
  const p = state.player;
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
  moveAxis(state, p, mx * STEP, 'x');
  moveAxis(state, p, my * STEP, 'y');
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

// Axis-separated move: blocked on one axis, the player still slides along the other.
// When the full step is blocked, snap flush to the blocking tile edge (solids are tile-aligned).
function moveAxis(state: GameState, p: PlayerState, d: number, axis: 'x' | 'y'): void {
  if (d === 0) return;
  const w = P.hitboxW;
  const h = P.hitboxH;
  const half = axis === 'x' ? w / 2 : h / 2;
  const from = p[axis];
  const to = from + d;
  const fits = (v: number): boolean =>
    axis === 'x' ? !isBlocked(state, v, p.y, w, h) : !isBlocked(state, p.x, v, w, h);
  if (fits(to)) {
    p[axis] = to;
    return;
  }
  const flush = d > 0 ? Math.floor((to + half) / TILE) * TILE - half : (Math.floor((to - half) / TILE) + 1) * TILE + half;
  const progresses = d > 0 ? flush > from : flush < from;
  if (progresses && fits(flush)) p[axis] = flush;
}
