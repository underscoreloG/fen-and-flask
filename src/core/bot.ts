// Autoplay policy (specs/wp/WP04): state -> Frame, a pure function, so a run is as deterministic as
// the sim. It plays the whole loop with movement, swings and commands only; it never presses
// interact, and sends a command only once the previous tick's interact target is the structure
// that command needs. Pathing is a BFS over world tiles (nodes and solid structures block).
import { GRIND_RECIPES, PLOTS, type ItemId, type PotionId } from '../data/content';
import { TUNING } from '../data/tuning';
import { DAY_TICKS } from './clock';
import { neutralFrame, type Command, type Frame } from './commands';
import { BED_IDS, isReady } from './garden';
import { potionsInStock, WALK_TICKS } from './stall';
import type { CreatureState, Facing, GameState } from './state';
import { brewRecipe, maxBrew, maxGrind, STATION_KINDS, STATION_STRUCTURES } from './stations';
import { isTileBlocked, tileAt, TILE, WORLD_STRUCTURES, WORLD_TILES_H, WORLD_TILES_W, type WorldStructure } from './world';

const B = TUNING.bot;
const W = WORLD_TILES_W;
const H = WORLD_TILES_H;
const STEP = TUNING.player.speed / TUNING.sim.tickRate;
const BREW_ORDER: readonly PotionId[] = ['emberelixir', 'glowdraught', 'salve', 'tonic'];
// Bed i grows this crop (bed 3 switches to emberroot once the east plot is owned).
const BED_CROPS: readonly ItemId[] = ['glowcap', 'glowcap', 'mint', 'mint'];
// Each bed is worked from the tile outside the 2x2 block, facing it, so it is the only target.
const BED_STAND: readonly { dx: number; dy: number; face: Facing }[] = [
  { dx: 0, dy: -1, face: 'down' },
  { dx: 0, dy: -1, face: 'down' },
  { dx: 0, dy: 1, face: 'up' },
  { dx: 0, dy: 1, face: 'up' },
];

const byKind = (kind: WorldStructure['def']['kind']): WorldStructure => WORLD_STRUCTURES.find((s) => s.def.kind === kind)!;
const HUT = byKind('hut');
const STALL = byKind('stall');
const BEDS = WORLD_STRUCTURES.filter((s) => s.def.kind === 'bed');
const FACE_AT: Partial<Record<WorldStructure['def']['kind'], Facing>> = {
  hut: 'up',
  mortar: 'up',
  cauldron: 'up',
  stall: 'down',
  signpost: 'right',
};

interface Goal {
  tx: number;
  ty: number;
  face?: Facing;
}

interface Ctx {
  state: GameState;
  grid: Uint8Array;
  dist: Int32Array;
  parent: Int32Array;
  start: number;
}

// Blocked tiles depend only on which plots are owned: memoized per ownership pattern.
const STATIC = new Map<string, Uint8Array>();

function staticGrid(state: GameState): Uint8Array {
  const key = state.plots.map((p) => (p.owned ? '1' : '0')).join('');
  let g = STATIC.get(key);
  if (!g) {
    g = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = isTileBlocked(state, x, y) ? 1 : 0;
    STATIC.set(key, g);
  }
  return g;
}

// The player's tile, unless that is a node's tile (standing flush on top of a node puts the feet
// center on the tile's top edge): then the free neighbour whose center is nearest.
function startTile(state: GameState, grid: Uint8Array): number {
  const { x, y } = state.player;
  const tx = tileAt(x);
  const ty = tileAt(y);
  if (grid[ty * W + tx] !== 1) return ty * W + tx;
  let best = ty * W + tx;
  let bestD = Infinity;
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H || grid[ny * W + nx] === 1) continue;
    const c = center(nx, ny);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      best = ny * W + nx;
      bestD = d;
    }
  }
  return best;
}

function plan(state: GameState): Ctx {
  const grid = staticGrid(state).slice();
  for (const n of state.nodes) grid[tileAt(n.y) * W + tileAt(n.x)] = 1;
  const dist = new Int32Array(W * H).fill(-1);
  const parent = new Int32Array(W * H).fill(-1);
  const start = startTile(state, grid);
  const queue = new Int32Array(W * H);
  let head = 0;
  let tail = 0;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const i = queue[head++]!;
    const x = i % W;
    const y = (i - x) / W;
    const next = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of next) {
      if (j < 0 || dist[j]! >= 0 || grid[j] === 1) continue;
      dist[j] = dist[i]! + 1;
      parent[j] = i;
      queue[tail++] = j;
    }
  }
  return { state, grid, dist, parent, start };
}

const center = (tx: number, ty: number): { x: number; y: number } => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });

// Full-speed stick toward a point, scaled down on the last step so it lands exactly.
function toward(state: GameState, x: number, y: number): Frame {
  const p = state.player;
  let mx = (x - p.x) / STEP;
  let my = (y - p.y) / STEP;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  return { ...neutralFrame(), moveX: mx, moveY: my };
}

const FACE_VEC: Record<Facing, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

function goalDist(ctx: Ctx, g: Goal): number {
  if (g.tx < 0 || g.ty < 0 || g.tx >= W || g.ty >= H) return -1;
  return ctx.dist[g.ty * W + g.tx]!;
}

function nearestGoal(ctx: Ctx, goals: readonly Goal[]): { goal: Goal; d: number } | null {
  let best: { goal: Goal; d: number } | null = null;
  for (const g of goals) {
    const d = goalDist(ctx, g);
    if (d >= 0 && (!best || d < best.d)) best = { goal: g, d };
  }
  return best;
}

// One tick toward the nearest reachable goal: along the BFS path, onto the tile center, then a
// turn to its facing. null when no goal is reachable.
function goTo(ctx: Ctx, goals: readonly Goal[]): { frame: Frame; arrived: boolean } | null {
  const found = nearestGoal(ctx, goals);
  if (!found) return null;
  const { goal, d } = found;
  const s = ctx.state;
  if (d > 0) {
    let cur = goal.ty * W + goal.tx;
    while (ctx.parent[cur] !== ctx.start) cur = ctx.parent[cur]!;
    const c = center(cur % W, Math.floor(cur / W));
    return { frame: toward(s, c.x, c.y), arrived: false };
  }
  const c = center(goal.tx, goal.ty);
  if (Math.hypot(c.x - s.player.x, c.y - s.player.y) > B.arriveEps) return { frame: toward(s, c.x, c.y), arrived: false };
  if (goal.face && s.player.facing !== goal.face) {
    const [fx, fy] = FACE_VEC[goal.face];
    return { frame: { ...neutralFrame(), moveX: fx * B.faceNudge, moveY: fy * B.faceNudge }, arrived: false };
  }
  return { frame: neutralFrame(), arrived: true };
}

const send = (...commands: Command[]): Frame => ({ ...neutralFrame(), commands });
const SWING: Frame = { ...neutralFrame(), swing: true };

// Walk to a structure's interact tile, face it, and once it is the interact target send `c`.
function useStructure(ctx: Ctx, s: WorldStructure, c: Command, face = FACE_AT[s.def.kind]): Frame | null {
  if (ctx.state.player.interactTarget === s.def.id) return send(c);
  const g = goTo(ctx, [{ tx: tileAt(s.interactX), ty: tileAt(s.interactY), face }]);
  return g ? g.frame : null;
}

const tilesAround = (tx: number, ty: number): Goal[] => [
  { tx: tx - 1, ty, face: 'right' },
  { tx: tx + 1, ty, face: 'left' },
  { tx, ty: ty - 1, face: 'down' },
  { tx, ty: ty + 1, face: 'up' },
];

// --- Fighting ----------------------------------------------------------------

function nearestCreature(state: GameState): { c: CreatureState; d: number } | null {
  let best: { c: CreatureState; d: number } | null = null;
  for (const c of state.creatures) {
    const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
    if (!best || d < best.d) best = { c, d };
  }
  return best;
}

// Swing when a mudlet is the swing target, back off while the swing cools down, else close in.
function engage(ctx: Ctx, c: CreatureState, d: number): Frame | null {
  const s = ctx.state;
  const p = s.player;
  const targetIsCreature = typeof p.swingTarget === 'number' && s.creatures.some((o) => o.id === p.swingTarget);
  if (targetIsCreature && p.swingCooldown === 0) return SWING;
  if (p.swingCooldown > 0 && d < B.retreatRadius) {
    const len = d > 0 ? d : 1;
    return { ...neutralFrame(), moveX: (p.x - c.x) / len, moveY: (p.y - c.y) / len };
  }
  // Straight in only when it is right there; otherwise the BFS path, so a node in between never
  // pins the bot against it. A mudlet it cannot reach is left alone.
  if (d <= B.retreatRadius) return toward(s, c.x, c.y);
  return goTo(ctx, [{ tx: tileAt(c.x), ty: tileAt(c.y) }])?.frame ?? null;
}

// --- Day work ------------------------------------------------------------------

function bedCrop(state: GameState, i: number): ItemId {
  if (i === BED_CROPS.length - 1 && state.plots[1]?.owned && state.inventory.emberroot >= B.emberSeedMin) return 'emberroot';
  return BED_CROPS[i]!;
}

// Raw items held back from the mortar for empty beds.
function seedsNeeded(state: GameState, item: ItemId): number {
  let n = 0;
  state.garden.forEach((b, i) => {
    if (b.crop === null && bedCrop(state, i) === item) n += 1;
  });
  return n;
}

function bedGoal(i: number): Goal {
  const s = BEDS[i]!;
  const st = BED_STAND[i]!;
  return { tx: tileAt(s.interactX) + st.dx, ty: tileAt(s.interactY) + st.dy, face: st.face };
}

function harvestFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  for (let i = 0; i < s.garden.length; i++) {
    if (!isReady(s.garden[i]!)) continue;
    if (s.player.swingTarget === BED_IDS[i] && s.player.swingCooldown === 0) return SWING;
    const g = goTo(ctx, [bedGoal(i)]);
    if (g) return g.frame;
  }
  return null;
}

function plantFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  for (let i = 0; i < s.garden.length; i++) {
    const item = bedCrop(s, i);
    if (s.garden[i]!.crop !== null || s.inventory[item] < 1) continue;
    if (s.player.interactTarget === BED_IDS[i]) return send({ type: 'Plant', bed: i, item });
    const g = goTo(ctx, [bedGoal(i)]);
    if (g) return g.frame;
  }
  return null;
}

function grindFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  if (s.stations.mortar) return null;
  for (const r of GRIND_RECIPES) {
    const qty = Math.min(maxGrind(s, r), s.inventory[r.input] - seedsNeeded(s, r.input));
    if (qty >= 1) return useStructure(ctx, STATION_STRUCTURES.mortar, { type: 'StartGrind', input: r.input, qty });
  }
  return null;
}

// Brew a full batch at once, or whatever is possible once no more inputs are coming today.
function brewFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  if (s.stations.cauldron) return null;
  const nothingComing =
    s.nodes.length === 0 &&
    s.creatures.length === 0 &&
    s.pickups.length === 0 &&
    s.stations.mortar === null &&
    GRIND_RECIPES.every((r) => s.inventory[r.input] - seedsNeeded(s, r.input) < 1);
  const late = s.phase === 'evening' || s.clock.t >= B.brewAnywayAt * DAY_TICKS;
  for (const potion of BREW_ORDER) {
    const n = maxBrew(s, brewRecipe(potion)!);
    if (n < 1) continue;
    if (n < TUNING.cauldron.maxQuantity && !nothingComing && !late) return null;
    return useStructure(ctx, STATION_STRUCTURES.cauldron, { type: 'StartBrew', potion, qty: n });
  }
  return null;
}

function nodeFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  const p = s.player;
  if (typeof p.swingTarget === 'number' && s.nodes.some((n) => n.id === p.swingTarget)) {
    return p.swingCooldown === 0 ? SWING : neutralFrame();
  }
  const goals = s.nodes.flatMap((n) => tilesAround(tileAt(n.x), tileAt(n.y)));
  return goTo(ctx, goals)?.frame ?? null;
}

function pickupFrame(ctx: Ctx, maxTiles: number): Frame | null {
  const s = ctx.state;
  const goals = s.pickups.flatMap((k) => {
    const tx = tileAt(k.x);
    const ty = tileAt(k.y);
    return [{ tx, ty }, ...tilesAround(tx, ty).map(({ tx: x, ty: y }) => ({ tx: x, ty: y }))];
  });
  const found = nearestGoal(ctx, goals);
  if (!found || found.d > maxTiles) return null;
  return goTo(ctx, goals)?.frame ?? null;
}

// While a station still works, wait at its output tile (the cauldron first).
function waitFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  for (const kind of [...STATION_KINDS].reverse()) {
    if (!s.stations[kind]) continue;
    const st = STATION_STRUCTURES[kind];
    return goTo(ctx, [{ tx: tileAt(st.interactX), ty: tileAt(st.interactY) }])?.frame ?? neutralFrame();
  }
  return null;
}

function buyFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  for (const sign of WORLD_STRUCTURES) {
    const plot = PLOTS.findIndex((p) => p.id === sign.def.sells);
    if (plot < 0 || s.plots[plot]?.owned || s.coins < PLOTS[plot]!.price) continue;
    return useStructure(ctx, sign, { type: 'BuyPlot', plot });
  }
  return null;
}

// --- Stall -----------------------------------------------------------------------

// On the tick a customer has just reacted, nudge that potion's price (at least 1 coin).
function stallFrame(state: GameState): Frame {
  const c = state.stall.customer;
  if (!c || c.t !== WALK_TICKS || !c.potion || !c.reaction) return neutralFrame();
  const raw = Math.round(c.price * B.priceAfter[c.reaction]);
  const up = c.reaction === 'delighted' || c.reaction === 'happy';
  const price = Math.max(TUNING.stall.priceMin, up ? Math.max(raw, c.price + 1) : Math.min(raw, c.price - 1));
  return send({ type: 'SetPrice', potion: c.potion, price });
}

function endOfDayFrame(ctx: Ctx): Frame {
  const s = ctx.state;
  if (s.phase === 'day') return useStructure(ctx, STALL, { type: 'CallItADay' }) ?? neutralFrame();
  const st = s.stall;
  if (st.phase === 'closed' && !st.openedToday && potionsInStock(s).length > 0) {
    return useStructure(ctx, STALL, { type: 'OpenStall' }) ?? neutralFrame();
  }
  return useStructure(ctx, HUT, { type: 'Sleep' }) ?? neutralFrame();
}

export function botFrame(state: GameState): Frame {
  if (state.stall.phase === 'open') return stallFrame(state);
  const ctx = plan(state);
  const foe = nearestCreature(state);
  if (foe && foe.d <= B.fightRadius) {
    const f = engage(ctx, foe.c, foe.d);
    if (f) return f;
  }
  return (
    pickupFrame(ctx, B.nearPickupTiles) ??
    (foe ? engage(ctx, foe.c, foe.d) : null) ??
    harvestFrame(ctx) ??
    plantFrame(ctx) ??
    grindFrame(ctx) ??
    brewFrame(ctx) ??
    nodeFrame(ctx) ??
    pickupFrame(ctx, Infinity) ??
    waitFrame(ctx) ??
    buyFrame(ctx) ??
    endOfDayFrame(ctx)
  );
}
