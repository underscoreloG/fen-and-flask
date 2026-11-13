// World geometry: a grid of plots inside a border of deep water, and the shop interior. Tile
// coords are integers; "world tiles" count from the world's top-left, "plot-local" from a plot's
// top-left, "shop-local" from the interior's top-left. The interior shares the world's px space,
// shopGap tiles below the water border, so outdoor and indoor positions never overlap.
import { PLOTS, PLOT_LAYOUTS, SHOP_LAYOUT, type PlotDef, type StructureDef } from '../data/content';
import { TUNING } from '../data/tuning';
import type { Area, GameState, PlotState } from './state';

const W = TUNING.world;

export const TILE = W.tile;
export const WORLD_TILES_W = W.border * 2 + W.gridW * W.plotW;
export const WORLD_TILES_H = W.border * 2 + W.gridH * W.plotH;
export const WORLD_W = WORLD_TILES_W * TILE;
export const WORLD_H = WORLD_TILES_H * TILE;

// The interior's top-left, in world tiles.
export const SHOP_TX = 0;
export const SHOP_TY = WORLD_TILES_H + W.shopGap;
export const SHOP_W = SHOP_LAYOUT.w;
export const SHOP_H = SHOP_LAYOUT.h;

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

// Center of a shop-local tile, in world px.
export function shopTileCenter(tx: number, ty: number): { x: number; y: number } {
  return { x: (SHOP_TX + tx + 0.5) * TILE, y: (SHOP_TY + ty + 0.5) * TILE };
}

export function inShop(wtx: number, wty: number): boolean {
  return wtx >= SHOP_TX && wty >= SHOP_TY && wtx < SHOP_TX + SHOP_W && wty < SHOP_TY + SHOP_H;
}

export interface WorldStructure {
  def: StructureDef;
  // The plot it stands on; the shop interior belongs to the home plot.
  plot: PlotDef;
  area: Area;
  // Footprint in world px.
  x: number;
  y: number;
  w: number;
  h: number;
  // Center of the interact tile in world px (the footprint center when there is none).
  interactX: number;
  interactY: number;
}

function place(def: StructureDef, plot: PlotDef, area: Area, ox: number, oy: number): WorldStructure {
  const it = def.interact ?? { x: def.tiles.x + (def.tiles.w - 1) / 2, y: def.tiles.y + (def.tiles.h - 1) / 2 };
  return {
    def,
    plot,
    area,
    x: (ox + def.tiles.x) * TILE,
    y: (oy + def.tiles.y) * TILE,
    w: def.tiles.w * TILE,
    h: def.tiles.h * TILE,
    interactX: (ox + it.x + 0.5) * TILE,
    interactY: (oy + it.y + 0.5) * TILE,
  };
}

const HOME = PLOTS[0]!;

export const WORLD_STRUCTURES: readonly WorldStructure[] = [
  ...PLOTS.flatMap((plot) => {
    const o = plotOrigin(plot.gx, plot.gy);
    return PLOT_LAYOUTS[plot.id].structures.map((def) => place(def, plot, 'world', o.x, o.y));
  }),
  ...SHOP_LAYOUT.structures.map((def) => place(def, HOME, 'shop', SHOP_TX, SHOP_TY)),
];

export const structureById = (id: string): WorldStructure | undefined => WORLD_STRUCTURES.find((s) => s.def.id === id);

export function structureOfKind(kind: StructureDef['kind']): WorldStructure {
  const s = WORLD_STRUCTURES.find((w) => w.def.kind === kind);
  if (!s) throw new Error(`no ${kind} in the layouts`);
  return s;
}

// The structure the player is targeting for interact (as of the last updateTargets). Commands
// that act on a structure are only valid while it is this one.
export function targetStructure(state: GameState): WorldStructure | undefined {
  const id = state.player.interactTarget;
  return id === null ? undefined : structureById(id);
}

// A signpost stands until the plot it sells is owned; a catalog structure from the morning its
// item arrives; every other structure always stands.
export function structureStands(state: GameState, s: WorldStructure): boolean {
  if (s.def.requires) return state.catalog.owned.includes(s.def.requires);
  if (!s.def.sells) return true;
  const i = PLOTS.findIndex((p) => p.id === s.def.sells);
  return !state.plots[i]?.owned;
}

// The home door, in world tiles: the doorway in the hut and the tile in front of it.
const DOOR = PLOT_LAYOUTS.home.door!;
const HOME_O = plotOrigin(HOME.gx, HOME.gy);
export const DOOR_TILE = { x: HOME_O.x + DOOR.tile.x, y: HOME_O.y + DOOR.tile.y };
export const DOOR_OUTSIDE = { x: HOME_O.x + DOOR.outside.x, y: HOME_O.y + DOOR.outside.y };
export const EXIT_TILE = { x: SHOP_TX + SHOP_LAYOUT.exit.x, y: SHOP_TY + SHOP_LAYOUT.exit.y };
export const ENTRY_TILE = { x: SHOP_TX + SHOP_LAYOUT.entry.x, y: SHOP_TY + SHOP_LAYOUT.entry.y };

// Solid structure tiles never move, so they are baked once into tile masks holding the
// structure's index + 1 (a signpost's tiles free up once it is gone, a catalog structure's are
// only solid once it stands).
const SOLID = new Uint8Array(WORLD_TILES_W * WORLD_TILES_H);
// Shop-local: 1 = wall, k + 2 = the solid tile of structure k.
const SHOP_SOLID = new Uint8Array(SHOP_W * SHOP_H);
{
  const L = SHOP_LAYOUT;
  for (let y = 0; y < SHOP_H; y++) {
    for (let x = 0; x < SHOP_W; x++) {
      const outer = x === 0 || x === SHOP_W - 1 || y <= 1 || (y === SHOP_H - 1 && x !== L.exit.x);
      const partition = x === L.partitionX && y !== L.partitionDoorY;
      if (outer || partition) SHOP_SOLID[y * SHOP_W + x] = 1;
    }
  }
}
WORLD_STRUCTURES.forEach((s, k) => {
  if (!s.def.solid) return;
  const tx = s.x / TILE;
  const ty = s.y / TILE;
  for (let j = 0; j < s.def.tiles.h; j++) {
    for (let i = 0; i < s.def.tiles.w; i++) {
      if (s.def.open?.some((o) => o.x === s.def.tiles.x + i && o.y === s.def.tiles.y + j)) continue;
      if (s.area === 'shop') SHOP_SOLID[(ty - SHOP_TY + j) * SHOP_W + tx - SHOP_TX + i] = k + 2;
      else SOLID[(ty + j) * WORLD_TILES_W + tx + i] = k + 1;
    }
  }
});

// Indoors, shop-local: a wall or a solid structure that stands (the exit gap is open; see isTileBlocked).
export function isShopTileSolid(state: GameState, lx: number, ly: number): boolean {
  if (lx < 0 || ly < 0 || lx >= SHOP_W || ly >= SHOP_H) return true;
  const k = SHOP_SOLID[ly * SHOP_W + lx]!;
  return k === 1 || (k > 1 && structureStands(state, WORLD_STRUCTURES[k - 2]!));
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
  return SOLID[wty * WORLD_TILES_W + wtx]! > 0;
}

// Indoors, walls and solid furniture; the exit gap closes while the shop is open for business.
export function isTileBlocked(state: GameState, wtx: number, wty: number): boolean {
  if (inShop(wtx, wty)) {
    if (wtx === EXIT_TILE.x && wty === EXIT_TILE.y) return state.shop.phase === 'open';
    return isShopTileSolid(state, wtx - SHOP_TX, wty - SHOP_TY);
  }
  const kind = tileKind(state, wtx, wty);
  if (kind === 'deepwater' || kind === 'locked') return true;
  const k = SOLID[wty * WORLD_TILES_W + wtx]!;
  return k > 0 && structureStands(state, WORLD_STRUCTURES[k - 1]!);
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
