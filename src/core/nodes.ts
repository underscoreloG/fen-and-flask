// Gatherable nodes and the shared spawn rule (specs/content.md, World and Nodes).
import { NODES, PLOTS, type NodeDef } from '../data/content';
import { TUNING } from '../data/tuning';
import type { GameEvent } from './events';
import { spawnDrops } from './pickups';
import { nextInt } from './rng';
import type { GameState, NodeState } from './state';
import { DOOR_OUTSIDE, DOOR_TILE, plotOrigin, tileAt, tileKind, TILE, WORLD_STRUCTURES, WORLD_TILES_H, WORLD_TILES_W } from './world';

const S = TUNING.spawn;

// World tiles within `clearance` of a structure footprint or interact tile, or of the hut door and
// the tile in front of it; static, so baked once.
const NEAR_STRUCTURE = new Uint8Array(WORLD_TILES_W * WORLD_TILES_H);
{
  const mark = (tx: number, ty: number): void => {
    for (let dy = -S.clearance; dy <= S.clearance; dy++) {
      for (let dx = -S.clearance; dx <= S.clearance; dx++) {
        const x = tx + dx;
        const y = ty + dy;
        if (x >= 0 && y >= 0 && x < WORLD_TILES_W && y < WORLD_TILES_H) NEAR_STRUCTURE[y * WORLD_TILES_W + x] = 1;
      }
    }
  };
  for (const s of WORLD_STRUCTURES) {
    if (s.area !== 'world') continue;
    const tx = s.x / TILE;
    const ty = s.y / TILE;
    for (let j = 0; j < s.def.tiles.h; j++) for (let i = 0; i < s.def.tiles.w; i++) mark(tx + i, ty + j);
    if (s.def.interact) mark(tileAt(s.interactX), tileAt(s.interactY));
  }
  mark(DOOR_TILE.x, DOOR_TILE.y);
  mark(DOOR_OUTSIDE.x, DOOR_OUTSIDE.y);
}

const cheb = (ax: number, ay: number, bx: number, by: number): number => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export function isNearStructure(wtx: number, wty: number): boolean {
  return NEAR_STRUCTURE[wty * WORLD_TILES_W + wtx] === 1;
}

// Free spawn tiles of a plot in row-major order: walkable grass in rows 0..maxRow, clear of
// structures, nodes and creatures by `spawn.clearance`, and at least `minPlayerDist` tiles
// (Chebyshev) from the player's tile; from the tile in front of the door while the player is
// indoors, since that is where they come out.
export function spawnTiles(state: GameState, plotIndex: number, maxRow: number, minPlayerDist: number): { tx: number; ty: number }[] {
  const plot = state.plots[plotIndex];
  if (!plot) return [];
  const o = plotOrigin(plot.gx, plot.gy);
  const outside = state.player.area === 'world';
  const ptx = outside ? tileAt(state.player.x) : DOOR_OUTSIDE.x;
  const pty = outside ? tileAt(state.player.y) : DOOR_OUTSIDE.y;
  const taken = [...state.nodes, ...state.creatures].map((e) => ({ tx: tileAt(e.x), ty: tileAt(e.y) }));
  const out: { tx: number; ty: number }[] = [];
  for (let ly = 0; ly <= maxRow; ly++) {
    for (let lx = 0; lx < TUNING.world.plotW; lx++) {
      const tx = o.x + lx;
      const ty = o.y + ly;
      if (tileKind(state, tx, ty) !== 'grass' || isNearStructure(tx, ty)) continue;
      if (cheb(tx, ty, ptx, pty) < minPlayerDist) continue;
      if (taken.some((t) => cheb(tx, ty, t.tx, t.ty) <= S.clearance)) continue;
      out.push({ tx, ty });
    }
  }
  return out;
}

export function pickSpawnTile(state: GameState, plotIndex: number, maxRow: number, minPlayerDist: number): { x: number; y: number } | null {
  const tiles = spawnTiles(state, plotIndex, maxRow, minPlayerDist);
  if (tiles.length === 0) return null;
  const t = tiles[nextInt(state, 0, tiles.length - 1)]!;
  return { x: (t.tx + 0.5) * TILE, y: (t.ty + 0.5) * TILE };
}

export function nodeDef(type: NodeState['type']): NodeDef {
  return NODES.find((n) => n.id === type)!;
}

// Hits a fresh node of this type needs: the copper sickle (specs/wp/WP07) takes some off, never
// below one.
export function nodeHits(state: GameState, type: NodeState['type']): number {
  const fewer = state.catalog.owned.includes('sickle') ? TUNING.sickle.hitsFewer : 0;
  return Math.max(1, nodeDef(type).hits - fewer);
}

// Brings every node type of a plot up to its target count; survivors stay where they are.
export function refillPlot(state: GameState, plotIndex: number): void {
  const plotId = PLOTS[plotIndex]?.id;
  if (!plotId) return;
  for (const def of NODES) {
    let have = state.nodes.filter((n) => n.plot === plotIndex && n.type === def.id).length;
    while (have < def.targets[plotId]) {
      const at = pickSpawnTile(state, plotIndex, S.nodeMaxRow, S.playerClearance + 1);
      if (!at) return;
      state.nodes.push({ id: state.nextId++, type: def.id, x: at.x, y: at.y, hp: nodeHits(state, def.id), plot: plotIndex });
      have += 1;
    }
  }
}

export function hitNode(state: GameState, node: NodeState, events: GameEvent[]): void {
  node.hp -= TUNING.swing.damage;
  const base = { id: node.id, nodeType: node.type, x: node.x, y: node.y };
  events.push({ type: 'nodeHit', ...base, hp: Math.max(0, node.hp) });
  if (node.hp > 0) return;
  state.nodes = state.nodes.filter((n) => n.id !== node.id);
  events.push({ type: 'nodeBroken', ...base });
  const drop = nodeDef(node.type).drop;
  spawnDrops(state, drop.item, nextInt(state, drop.min, drop.max), node.x, node.y, events);
}
