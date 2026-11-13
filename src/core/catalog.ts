// The catalog (specs/wp/WP07): upgrades bought at the catalog stand, paid at once, delivered at
// the next morning reset. Most effects are read from state.catalog.owned where they apply; this
// module only does what has to happen once, on the morning an item arrives.
import { CATALOG, type CatalogDef, type CatalogId } from '../data/content';
import type { GameEvent } from './events';
import { nodeDef, nodeHits } from './nodes';
import type { GameState } from './state';
import { structureStands, targetStructure, tileAt, WORLD_STRUCTURES } from './world';

export const catalogDef = (id: CatalogId): CatalogDef | undefined => CATALOG.find((d) => d.id === id);

export const owns = (state: GameState, id: CatalogId): boolean => state.catalog.owned.includes(id);

// Where an item stands for the player: bought and here, bought and coming, waiting on another
// item, or for sale (affordable or not).
export type CatalogStatus = 'owned' | 'pending' | 'needs' | 'buyable';

export function catalogStatus(state: GameState, def: CatalogDef): CatalogStatus {
  if (owns(state, def.id)) return 'owned';
  if (state.catalog.pending.includes(def.id)) return 'pending';
  if (def.requires && !owns(state, def.requires)) return 'needs';
  return 'buyable';
}

// At the stand, for a known id that is buyable now and affordable; otherwise the state is untouched.
export function buyUpgrade(state: GameState, id: CatalogId): void {
  const def = catalogDef(id);
  if (!def || targetStructure(state)?.def.kind !== 'catalog') return;
  if (catalogStatus(state, def) !== 'buyable' || state.coins < def.price) return;
  state.coins -= def.price;
  state.catalog.pending.push(id);
}

// Grows a per-structure list (shelves, beds) to the number of its structures that now stand.
function grow<T>(state: GameState, list: T[], kind: 'shelf' | 'bed', make: () => T): void {
  const n = WORLD_STRUCTURES.filter((s) => s.def.kind === kind && structureStands(state, s)).length;
  while (list.length < n) list.push(make());
}

// Morning reset step 4: every pending item becomes owned and acts from this morning.
export function arriveUpgrades(state: GameState, events: GameEvent[]): void {
  const c = state.catalog;
  for (const id of c.pending) {
    const hitsBefore = new Map(state.nodes.map((n) => [n.id, nodeHits(state, n.type)]));
    c.owned.push(id);
    // Outdoor structures that just appeared clear the nodes standing on them, without drops.
    for (const s of WORLD_STRUCTURES) {
      if (s.def.requires !== id || s.area !== 'world') continue;
      const x0 = tileAt(s.x);
      const y0 = tileAt(s.y);
      state.nodes = state.nodes.filter((n) => {
        const tx = tileAt(n.x) - x0;
        const ty = tileAt(n.y) - y0;
        return tx < 0 || ty < 0 || tx >= s.def.tiles.w || ty >= s.def.tiles.h;
      });
    }
    // Fewer hits needed: a node keeps the damage it took (a stump hit once breaks on its next hit).
    for (const n of state.nodes) {
      const fewer = (hitsBefore.get(n.id) ?? nodeDef(n.type).hits) - nodeHits(state, n.type);
      n.hp = Math.max(1, n.hp - fewer);
    }
    events.push({ type: 'upgradeArrived', id });
  }
  c.pending = [];
  grow(state, state.shop.shelves, 'shelf', () => ({ item: null, count: 0 }));
  grow(state, state.garden, 'bed', () => ({ crop: null, nightsLeft: 0 }));
}
