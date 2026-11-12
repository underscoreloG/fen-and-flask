// World geometry: a grid of plots inside a border of deep water. Tile coords are integers;
// "world tiles" count from the world's top-left, "plot-local" from a plot's top-left.
import { PLOTS, PLOT_LAYOUTS, type PlotDef, type StructureDef } from '../data/content';
import { TUNING } from '../data/tuning';
import type { GameState, PlotState } from './state';

const W = TUNING.world;

export const TILE = W.tile;
export const WORLD_TILES_W = W.border * 2 + W.gridW * W.plotW;
export const WORLD_TILES_H = W.border * 2 + W.gridH * W.plotH;
export const WORLD_W = WORLD_TILES_W * TILE;
export const WORLD_H = WORLD_TILES_H * TILE;

export type TileKind = 'deepwater' | 'grass' | 'road' | 'locked';

// Plot's top-left, in world tiles.
export function plotOrigin(gx: number, gy: number): { x: number; y: number } {
  return { x: W.border + gx * W.plotW, y: W.border + gy * W.plotH };
}

// Center of a plot-local tile, in world px.
export function plotTileCenter(gx: number, gy: number, tx: number, ty: number): { x: number; y: number } {
  const o = plotOrigin(gx, gy);
  return { x: (o.x + tx + 0.5) * TILE, y: (o.y + ty + 0.5) * TILE };
}

export interface WorldStructure {
  def: StructureDef;
  plot: PlotDef;
  // Footprint in world px.
  x: number;
  y: number;
  w: number;
  h: number;
  // Center of the interact tile in world px.
  interactX: number;
  interactY: number;
}

export const WORLD_STRUCTURES: readonly WorldStructure[] = PLOTS.flatMap((plot) =>
  PLOT_LAYOUTS[plot.id].structures.map((def) => {
    const o = plotOrigin(plot.gx, plot.gy);
    const c = plotTileCenter(plot.gx, plot.gy, def.interact.x, def.interact.y);
    return {
      def,
      plot,
      x: (o.x + def.tiles.x) * TILE,
      y: (o.y + def.tiles.y) * TILE,
      w: def.tiles.w * TILE,
      h: def.tiles.h * TILE,
      interactX: c.x,
      interactY: c.y,
    };
  }),
);

// Solid structure tiles never move, so they are baked once into a world-tile mask.
const SOLID = new Uint8Array(WORLD_TILES_W * WORLD_TILES_H);
for (const s of WORLD_STRUCTURES) {
  if (!s.def.solid) continue;
  const tx = s.x / TILE;
  const ty = s.y / TILE;
  for (let j = 0; j < s.def.tiles.h; j++) {
    for (let i = 0; i < s.def.tiles.w; i++) SOLID[(ty + j) * WORLD_TILES_W + tx + i] = 1;
  }
}

export function plotAtTile(state: GameState, wtx: number, wty: number): PlotState | undefined {
  const lx = wtx - W.border;
  const ly = wty - W.border;
  if (lx < 0 || ly < 0) return undefined;
  const gx = Math.floor(lx / W.plotW);
  const gy = Math.floor(ly / W.plotH);
  return state.plots.find((p) => p.gx === gx && p.gy === gy);
}

export function tileKind(state: GameState, wtx: number, wty: number): TileKind {
  if (wtx < 0 || wty < 0 || wtx >= WORLD_TILES_W || wty >= WORLD_TILES_H) return 'deepwater';
  const plot = plotAtTile(state, wtx, wty);
  if (!plot) return 'deepwater';
  if (!plot.owned) return 'locked';
  const localY = wty - plotOrigin(plot.gx, plot.gy).y;
  return localY === W.roadRow ? 'road' : 'grass';
}

export function isSolidStructureTile(wtx: number, wty: number): boolean {
  if (wtx < 0 || wty < 0 || wtx >= WORLD_TILES_W || wty >= WORLD_TILES_H) return false;
  return SOLID[wty * WORLD_TILES_W + wtx] === 1;
}

export function isTileBlocked(state: GameState, wtx: number, wty: number): boolean {
  const kind = tileKind(state, wtx, wty);
  return kind === 'deepwater' || kind === 'locked' || isSolidStructureTile(wtx, wty);
}

const NODE_W = TUNING.node.hitboxW;
const NODE_H = TUNING.node.hitboxH;

// Strict overlap of two centered boxes: touching edges do not count.
export function boxesOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
}

// Does a w x h box centered on (cx, cy) overlap any blocked tile or node? Edges that only touch
// do not count, so an entity can stand flush against a wall.
export function isBlocked(state: GameState, cx: number, cy: number, w: number, h: number): boolean {
  const left = cx - w / 2;
  const top = cy - h / 2;
  const tx0 = Math.floor(left / TILE);
  const ty0 = Math.floor(top / TILE);
  const tx1 = Math.ceil((left + w) / TILE) - 1;
  const ty1 = Math.ceil((top + h) / TILE) - 1;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (isTileBlocked(state, tx, ty)) return true;
    }
  }
  for (const n of state.nodes) {
    if (boxesOverlap(cx, cy, w, h, n.x, n.y, NODE_W, NODE_H)) return true;
  }
  return false;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Mover {
  x: number;
  y: number;
}

// Axis-separated move of a w x h box: blocked on one axis, it still slides along the other.
// When the full step is blocked it stops flush against what is in the way (a tile edge, a node
// box or the `bounds` edge). `bounds`, if given, must contain the whole box.
export function moveAxis(
  state: GameState,
  m: Mover,
  d: number,
  axis: 'x' | 'y',
  w: number,
  h: number,
  bounds: Rect | null = null,
): void {
  if (d === 0) return;
  const half = axis === 'x' ? w / 2 : h / 2;
  const from = m[axis];
  const to = from + d;
  const at = (v: number): [number, number] => (axis === 'x' ? [v, m.y] : [m.x, v]);
  const fits = (v: number): boolean => {
    const [cx, cy] = at(v);
    if (bounds && (cx - w / 2 < bounds.x0 || cx + w / 2 > bounds.x1 || cy - h / 2 < bounds.y0 || cy + h / 2 > bounds.y1)) {
      return false;
    }
    return !isBlocked(state, cx, cy, w, h);
  };
  if (fits(to)) {
    m[axis] = to;
    return;
  }
  const candidates = [
    d > 0 ? Math.floor((to + half) / TILE) * TILE - half : (Math.floor((to - half) / TILE) + 1) * TILE + half,
  ];
  const [tx, ty] = at(to);
  for (const n of state.nodes) {
    if (!boxesOverlap(tx, ty, w, h, n.x, n.y, NODE_W, NODE_H)) continue;
    const c = axis === 'x' ? n.x : n.y;
    const nh = (axis === 'x' ? NODE_W : NODE_H) / 2;
    candidates.push(d > 0 ? c - nh - half : c + nh + half);
  }
  if (bounds) {
    candidates.push(d > 0 ? (axis === 'x' ? bounds.x1 : bounds.y1) - half : (axis === 'x' ? bounds.x0 : bounds.y0) + half);
  }
  // The furthest stop that still lies between from and to and fits.
  let best = from;
  for (const c of candidates) {
    const ahead = d > 0 ? c > best && c <= to : c < best && c >= to;
    if (ahead && fits(c)) best = c;
  }
  m[axis] = best;
}

// The world tile under a world px point.
export function tileAt(px: number): number {
  return Math.floor(px / TILE);
}

// A plot's area in world px, rows [0, rows) only.
export function plotRect(gx: number, gy: number, rows: number): Rect {
  const o = plotOrigin(gx, gy);
  return { x0: o.x * TILE, y0: o.y * TILE, x1: (o.x + W.plotW) * TILE, y1: (o.y + rows) * TILE };
}
