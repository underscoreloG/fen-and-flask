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

// Does a w x h box centered on (cx, cy) overlap any blocked tile? Edges that only touch a tile
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
  return false;
}
