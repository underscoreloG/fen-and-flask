// Autoplay policy (specs/wp/WP04, WP06): state -> Frame, a pure function, so a run is as
// deterministic as the sim. It plays the whole loop with movement, swings and commands only; it
// never presses interact, and sends a command only once the previous tick's interact target is
// the structure that command needs. Pathing is a BFS over the tiles of the player's area (the
// world: nodes and solid structures block; the shop: walls and furniture), through the doors.
import { CATALOG, GRIND_RECIPES, PLOTS, type ItemId, type PotionId } from '../data/content';
import { TUNING } from '../data/tuning';
import { catalogStatus } from './catalog';
import { DAY_TICKS } from './clock';
import { neutralFrame, type Command, type Frame } from './commands';
import { BED_IDS, isReady } from './garden';
import { reactTo, shelfCapacity, SHELVES } from './shop';
import type { CreatureState, Facing, GameState } from './state';
import { brewRecipe, isCauldron, maxBrew, maxGrind, STATION_KINDS, STATION_STRUCTURES } from './stations';
import {
  DOOR_OUTSIDE,
  DOOR_TILE,
  EXIT_TILE,
  isTileBlocked,
  SHOP_H,
  SHOP_TX,
  SHOP_TY,
  SHOP_W,
  structureOfKind,
  structureStands,
  tileAt,
  TILE,
  WORLD_STRUCTURES,
  WORLD_TILES_H,
  WORLD_TILES_W,
  type WorldStructure,
} from './world';

const B = TUNING.bot;
const STEP = TUNING.player.speed / TUNING.sim.tickRate;
// Highest value first: the brew order and the stocking order.
const BREW_ORDER: readonly PotionId[] = ['emberelixir', 'glowdraught', 'salve', 'tonic'];
// Ground items go on a table only once no potion is left for it, the most valuable first (a
// herbalist pays 1.5 times for them). Raw items stay home: they are seeds and brewing inputs.
const GROUND_ORDER: readonly ItemId[] = ['emberpowder', 'glowdust', 'mintpaste'];
// Bed i grows this crop; these beds switch to emberroot once the east plot is owned and enough
// emberroot is held (bed 3, and beds 5 and 6 from the catalog).
const BED_CROPS: readonly ItemId[] = ['glowcap', 'glowcap', 'mint', 'mint', 'glowcap', 'mint'];
const EMBER_BEDS: readonly string[] = ['bed3', 'bed4', 'bed5'];
// Each bed is worked from a tile outside the bed block, facing it, so it is the only target (the
// catalog's two beds from the row below them).
const BED_STAND: readonly { dx: number; dy: number; face: Facing }[] = [
  { dx: 0, dy: -1, face: 'down' },
  { dx: 0, dy: -1, face: 'down' },
  { dx: 0, dy: 1, face: 'up' },
  { dx: 0, dy: 1, face: 'up' },
  { dx: 0, dy: 1, face: 'up' },
  { dx: 0, dy: 1, face: 'up' },
];

const SIGN = structureOfKind('sign');
const COUNTER = structureOfKind('counter');
const COT = structureOfKind('cot');
const STAND = structureOfKind('catalog');
const BOARD = structureOfKind('board');
const CAULDRONS = STATION_KINDS.filter(isCauldron);
const BEDS = WORLD_STRUCTURES.filter((s) => s.def.kind === 'bed');
const FACE_AT: Partial<Record<WorldStructure['def']['kind'], Facing>> = {
  mortar: 'up',
  cauldron: 'up',
  shelf: 'up',
  counter: 'down',
  sign: 'down',
  cot: 'right',
  signpost: 'right',
  catalog: 'down',
  board: 'up',
};

// A goal tile, in world tiles (the shop sits in the same tile space).
interface Goal {
  tx: number;
  ty: number;
  face?: Facing;
}

// A BFS over one area's tiles, indexed locally from (ox, oy).
interface Ctx {
  state: GameState;
  ox: number;
  oy: number;
  w: number;
  h: number;
  grid: Uint8Array;
  dist: Int32Array;
  parent: Int32Array;
  start: number;
}

// Blocked tiles depend only on which plots are owned (outdoors), whether the shop is open
// (indoors, the exit closes) and which catalog items have arrived (tables, the second cauldron):
// memoized per pattern.
const STATIC = new Map<string, Uint8Array>();

function staticGrid(state: GameState, indoors: boolean): Uint8Array {
  const owned = [...state.catalog.owned].sort().join();
  const key = indoors ? `shop${state.shop.phase === 'open'}|${owned}` : `${state.plots.map((p) => (p.owned ? '1' : '0')).join('')}|${owned}`;
  let g = STATIC.get(key);
  if (!g) {
    if (indoors) {
      g = new Uint8Array(SHOP_W * SHOP_H);
      for (let y = 0; y < SHOP_H; y++) for (let x = 0; x < SHOP_W; x++) g[y * SHOP_W + x] = isTileBlocked(state, SHOP_TX + x, SHOP_TY + y) ? 1 : 0;
    } else {
      g = new Uint8Array(WORLD_TILES_W * WORLD_TILES_H);
      for (let y = 0; y < WORLD_TILES_H; y++) for (let x = 0; x < WORLD_TILES_W; x++) g[y * WORLD_TILES_W + x] = isTileBlocked(state, x, y) ? 1 : 0;
    }
    STATIC.set(key, g);
  }
  return g;
}

// The player's tile, unless that is a node's tile (standing flush on top of a node puts the feet
// center on the tile's top edge): then the free neighbour whose center is nearest.
function startTile(ctx: Omit<Ctx, 'start' | 'dist' | 'parent'>, x: number, y: number): number {
  const { w, h, ox, oy, grid } = ctx;
  const tx = tileAt(x) - ox;
  const ty = tileAt(y) - oy;
  if (grid[ty * w + tx] !== 1) return ty * w + tx;
  let best = ty * w + tx;
  let bestD = Infinity;
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h || grid[ny * w + nx] === 1) continue;
    const c = center(nx + ox, ny + oy);
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      best = ny * w + nx;
      bestD = d;
    }
  }
  return best;
}

// BFS over the area the player is in, or over the world from (x, y) when given (to ask, from
// indoors, whether anything outside is reachable from the door).
function plan(state: GameState, from?: { x: number; y: number }): Ctx {
  const indoors = from === undefined && state.player.area === 'shop';
  const base = indoors
    ? { state, ox: SHOP_TX, oy: SHOP_TY, w: SHOP_W, h: SHOP_H, grid: staticGrid(state, true).slice() }
    : { state, ox: 0, oy: 0, w: WORLD_TILES_W, h: WORLD_TILES_H, grid: staticGrid(state, false).slice() };
  if (!indoors) for (const n of state.nodes) base.grid[tileAt(n.y) * base.w + tileAt(n.x)] = 1;
  const { w, h, grid } = base;
  const dist = new Int32Array(w * h).fill(-1);
  const parent = new Int32Array(w * h).fill(-1);
  const start = startTile(base, from?.x ?? state.player.x, from?.y ?? state.player.y);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const i = queue[head++]!;
    const x = i % w;
    const y = (i - x) / w;
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of next) {
      if (j < 0 || dist[j]! >= 0 || grid[j] === 1) continue;
      dist[j] = dist[i]! + 1;
      parent[j] = i;
      queue[tail++] = j;
    }
  }
  return { ...base, dist, parent, start };
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
  const x = g.tx - ctx.ox;
  const y = g.ty - ctx.oy;
  if (x < 0 || y < 0 || x >= ctx.w || y >= ctx.h) return -1;
  return ctx.dist[y * ctx.w + x]!;
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
    let cur = (goal.ty - ctx.oy) * ctx.w + goal.tx - ctx.ox;
    while (ctx.parent[cur] !== ctx.start) cur = ctx.parent[cur]!;
    const c = center((cur % ctx.w) + ctx.ox, Math.floor(cur / ctx.w) + ctx.oy);
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

// Through the door to the other area: onto the doorway (outside) or the exit gap (inside).
function goThroughDoor(ctx: Ctx): Frame | null {
  const t = ctx.state.player.area === 'world' ? DOOR_TILE : EXIT_TILE;
  return goTo(ctx, [{ tx: t.x, ty: t.y }])?.frame ?? null;
}

const standAt = (s: WorldStructure, face = FACE_AT[s.def.kind]): Goal => ({ tx: tileAt(s.interactX), ty: tileAt(s.interactY), face });

// Walk to a structure's interact tile (through the door if it is in the other area), face it,
// and once it is the interact target send `c`.
function useStructure(ctx: Ctx, s: WorldStructure, c: Command): Frame | null {
  const st = ctx.state;
  if (st.player.interactTarget === s.def.id) return send(c);
  if (s.area !== st.player.area) return goThroughDoor(ctx);
  return goTo(ctx, [standAt(s)])?.frame ?? null;
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

// --- Outdoor work --------------------------------------------------------------

function bedCrop(state: GameState, i: number): ItemId {
  if (EMBER_BEDS.includes(BED_IDS[i]!) && state.plots[1]?.owned && state.inventory.emberroot >= B.emberSeedMin) return 'emberroot';
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

const harvestGoals = (s: GameState): Goal[] => s.garden.flatMap((b, i) => (isReady(b) ? [bedGoal(i)] : []));
const plantGoals = (s: GameState): Goal[] =>
  s.garden.flatMap((b, i) => (b.crop === null && s.inventory[bedCrop(s, i)] >= 1 ? [bedGoal(i)] : []));
const nodeGoals = (s: GameState): Goal[] => s.nodes.flatMap((n) => tilesAround(tileAt(n.x), tileAt(n.y)));
const pickupGoals = (s: GameState): Goal[] =>
  s.pickups.flatMap((k) => {
    const tx = tileAt(k.x);
    const ty = tileAt(k.y);
    return [{ tx, ty }, ...tilesAround(tx, ty).map(({ tx: x, ty: y }) => ({ tx: x, ty: y }))];
  });

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

function nodeFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  const p = s.player;
  if (typeof p.swingTarget === 'number' && s.nodes.some((n) => n.id === p.swingTarget)) {
    return p.swingCooldown === 0 ? SWING : neutralFrame();
  }
  return goTo(ctx, nodeGoals(s))?.frame ?? null;
}

function pickupFrame(ctx: Ctx, maxTiles: number): Frame | null {
  const goals = pickupGoals(ctx.state);
  const found = nearestGoal(ctx, goals);
  if (!found || found.d > maxTiles) return null;
  return goTo(ctx, goals)?.frame ?? null;
}

const affordablePlot = (s: GameState): number =>
  PLOTS.findIndex((p, i) => p.price > 0 && !s.plots[i]?.owned && s.coins >= p.price);

// The signpost selling the plot the bot can afford now, if any.
function plotSign(s: GameState): { sign: WorldStructure; plot: number } | null {
  const plot = affordablePlot(s);
  const id = PLOTS[plot]?.id;
  const sign = id === undefined ? undefined : WORLD_STRUCTURES.find((w) => w.def.sells === id);
  return sign ? { sign, plot } : null;
}

function buyFrame(ctx: Ctx): Frame | null {
  const b = plotSign(ctx.state);
  return b ? useStructure(ctx, b.sign, { type: 'BuyPlot', plot: b.plot }) : null;
}

// Everything worth going out for, as goal tiles in the world.
function outdoorGoals(s: GameState): Goal[] {
  const b = plotSign(s);
  return [
    ...pickupGoals(s),
    ...s.creatures.map((c) => ({ tx: tileAt(c.x), ty: tileAt(c.y) })),
    ...harvestGoals(s),
    ...plantGoals(s),
    ...nodeGoals(s),
    ...(b ? [standAt(b.sign)] : []),
  ];
}

function outdoorFrame(ctx: Ctx): Frame | null {
  const foe = nearestCreature(ctx.state);
  if (foe && foe.d <= B.fightRadius) {
    const f = engage(ctx, foe.c, foe.d);
    if (f) return f;
  }
  return (
    pickupFrame(ctx, B.nearPickupTiles) ??
    (foe ? engage(ctx, foe.c, foe.d) : null) ??
    harvestFrame(ctx) ??
    plantFrame(ctx) ??
    nodeFrame(ctx) ??
    pickupFrame(ctx, Infinity) ??
    buyFrame(ctx)
  );
}

// --- Back room ---------------------------------------------------------------------

function grindFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  if (s.stations.mortar) return null;
  for (const r of GRIND_RECIPES) {
    const qty = Math.min(maxGrind(s, r), s.inventory[r.input] - seedsNeeded(s, r.input));
    if (qty >= 1) return useStructure(ctx, STATION_STRUCTURES.mortar, { type: 'StartGrind', input: r.input, qty });
  }
  return null;
}

// Potions of the daily order still to brew: wanted, minus held, brewing and lying on the floor.
function orderShort(s: GameState): number {
  const o = s.order;
  if (o.done) return 0;
  const brewing = CAULDRONS.reduce((n, k) => n + (s.stations[k]?.recipe === o.item ? s.stations[k]!.remaining : 0), 0);
  const lying = s.pickups.filter((k) => k.item === o.item).length;
  return Math.max(0, o.qty - s.inventory[o.item] - brewing - lying);
}

// The order's potions first, as soon as the inputs for all of them are there (no waiting for a
// full batch); then a full batch at once, or whatever is possible once no more inputs are coming
// today, in the first free cauldron.
function brewFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  const free = CAULDRONS.find((k) => s.stations[k] === null && structureStands(s, STATION_STRUCTURES[k]));
  if (!free) return null;
  const short = orderShort(s);
  if (short > 0 && maxBrew(s, brewRecipe(s.order.item)!) >= short) {
    return useStructure(ctx, STATION_STRUCTURES[free], { type: 'StartBrew', potion: s.order.item, qty: short });
  }
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
    return useStructure(ctx, STATION_STRUCTURES[free], { type: 'StartBrew', potion, qty: n });
  }
  return null;
}

// While a station still works, wait at its output tile (the cauldrons first).
function waitFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  for (const kind of [...STATION_KINDS].reverse()) {
    if (!s.stations[kind]) continue;
    return goTo(ctx, [standAt(STATION_STRUCTURES[kind])])?.frame ?? neutralFrame();
  }
  return null;
}

// --- The shop ------------------------------------------------------------------------

// The order goes to the board as soon as its potions are in hand.
function deliverFrame(ctx: Ctx): Frame | null {
  const o = ctx.state.order;
  if (o.done || ctx.state.inventory[o.item] < o.qty) return null;
  return useStructure(ctx, BOARD, { type: 'DeliverOrder' });
}

// Potions only, highest value first: top up a table that holds it; else an empty table goes to a
// potion that has none yet, or, when every potion held has one, to the potion held most.
function stockFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  const cap = shelfCapacity(s);
  const shelves = s.shop.shelves;
  const held = BREW_ORDER.filter((p) => s.inventory[p] > 0);
  const put = (i: number, potion: PotionId): Frame | null => {
    const qty = Math.min(s.inventory[potion], cap - shelves[i]!.count);
    return useStructure(ctx, SHELVES[i]!, { type: 'StockShelf', shelf: i, item: potion, qty });
  };
  for (const potion of held) {
    const i = shelves.findIndex((sl) => sl.item === potion && sl.count < cap);
    if (i >= 0) return put(i, potion);
  }
  const empty = shelves.findIndex((sl) => sl.item === null);
  // A potion with no table and none free: the table of a ground item makes room.
  const ground = shelves.findIndex((sl) => sl.item !== null && GROUND_ORDER.includes(sl.item));
  if (empty < 0 && held.length > 0 && ground >= 0) return useStructure(ctx, SHELVES[ground]!, { type: 'ClearShelf', shelf: ground });
  if (empty < 0) return null;
  if (held.length === 0) {
    const item = GROUND_ORDER.find((g) => s.inventory[g] > 0);
    if (!item) return null;
    const i = shelves.findIndex((sl) => sl.item === item && sl.count < cap);
    const at = i >= 0 ? i : empty;
    return useStructure(ctx, SHELVES[at]!, { type: 'StockShelf', shelf: at, item, qty: Math.min(s.inventory[item], cap - shelves[at]!.count) });
  }
  const most = held.reduce((a, p) => (s.inventory[p] > s.inventory[a] ? p : a));
  return put(empty, held.find((p) => !shelves.some((sl) => sl.item === p)) ?? most);
}

// After the east plot: the cheapest item buyable now (ties in catalog order), once it is affordable.
function catalogFrame(ctx: Ctx): Frame | null {
  const s = ctx.state;
  if (!s.plots[1]?.owned) return null;
  const buyable = CATALOG.filter((d) => catalogStatus(s, d) === 'buyable');
  const cheapest = buyable.reduce<(typeof buyable)[number] | null>((a, d) => (a === null || d.price < a.price ? d : a), null);
  if (!cheapest || s.coins < cheapest.price) return null;
  return useStructure(ctx, STAND, { type: 'BuyUpgrade', id: cheapest.id });
}

// The WP04 rule, one step per reaction: up after a sale, down after a refusal or a grumble.
function nudged(price: number, reaction: keyof typeof B.priceAfter): number {
  const raw = Math.round(price * B.priceAfter[reaction]);
  const up = reaction === 'delighted' || reaction === 'happy';
  return Math.max(TUNING.stall.priceMin, up ? Math.max(raw, price + 1) : Math.min(raw, price - 1));
}

// A customer reacted to the price still on the tag: that price is due a nudge (read from state,
// so once it is sent the price differs and the nudge is done). The bot tells the customer types
// apart by their looks and nudges by what a traveller with that mood would have thought, so a
// courier's delight or a haggler's grumble does not drag the price off for everyone else.
function pendingNudge(s: GameState): { item: ItemId; price: number } | null {
  for (const c of s.shop.customers) {
    if (c.item === null || c.reaction === null || s.shop.prices[c.item] !== c.price) continue;
    const price = nudged(c.price, reactTo(s, c.item, c.price, c.personal).reaction);
    if (price !== c.price) return { item: c.item, price };
  }
  return null;
}

// Open for business: ring up at once, nudge prices at the nearest shelf between customers, else
// wait behind the counter.
function openFrame(ctx: Ctx): Frame {
  const s = ctx.state;
  if (s.shop.customers.some((c) => c.spot === 0 && c.mode === 'queued')) {
    return useStructure(ctx, COUNTER, { type: 'RingUp' }) ?? neutralFrame();
  }
  const nudge = pendingNudge(s);
  if (nudge) {
    const at = s.player.interactTarget;
    const tables = SHELVES.filter((sh) => structureStands(s, sh));
    if (at !== null && tables.some((sh) => sh.def.id === at)) return send({ type: 'SetPrice', item: nudge.item, price: nudge.price });
    return goTo(ctx, tables.map((sh) => standAt(sh)))?.frame ?? neutralFrame();
  }
  return goTo(ctx, [standAt(COUNTER)])?.frame ?? neutralFrame();
}

// Indoors with nothing to start (a catalog purchase counts as one): out if there is outdoor work,
// else end the day (no waiting on the stations by day, the evening has no timer), then wait for
// the jobs, stock, open, sleep.
function indoorFrame(ctx: Ctx): Frame {
  const s = ctx.state;
  const inside = pickupFrame(ctx, Infinity) ?? deliverFrame(ctx) ?? grindFrame(ctx) ?? brewFrame(ctx) ?? catalogFrame(ctx);
  if (inside) return inside;
  if (nearestGoal(plan(s, center(DOOR_OUTSIDE.x, DOOR_OUTSIDE.y)), outdoorGoals(s))) return goThroughDoor(ctx) ?? neutralFrame();
  const wait = waitFrame(ctx) ?? stockFrame(ctx);
  if (wait) return wait;
  const sh = s.shop;
  if (sh.phase === 'closed' && !sh.openedToday && sh.shelves.some((sl) => sl.item !== null)) {
    return useStructure(ctx, SIGN, { type: 'OpenStall' }) ?? neutralFrame();
  }
  return useStructure(ctx, COT, { type: 'Sleep' }) ?? neutralFrame();
}

export function botFrame(state: GameState): Frame {
  const ctx = plan(state);
  if (state.shop.phase === 'open') return openFrame(ctx);
  if (state.player.area === 'world') return outdoorFrame(ctx) ?? goThroughDoor(ctx) ?? neutralFrame();
  return indoorFrame(ctx);
}

