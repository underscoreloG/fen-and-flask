// Content tables (specs/content.md). Tile coordinates are plot-local.

export type ItemId =
  | 'mint'
  | 'glowcap'
  | 'reed'
  | 'bogwood'
  | 'mudgel'
  | 'emberroot'
  | 'mintpaste'
  | 'glowdust'
  | 'emberpowder'
  | 'tonic'
  | 'salve'
  | 'glowdraught'
  | 'emberelixir';

export type ItemKind = 'raw' | 'fuel' | 'ground' | 'potion';

export interface ItemDef {
  id: ItemId;
  name: string;
  kind: ItemKind;
  // What a customer thinks one is worth before demand, trend and mood (every item sells).
  value: number;
}

// Raw and ground values are first guesses (tune): a potion is worth about 2.5 times its inputs.
export const ITEMS: readonly ItemDef[] = [
  { id: 'mint', name: 'Marsh Mint', kind: 'raw', value: 2 },
  { id: 'glowcap', name: 'Glowcap', kind: 'raw', value: 4 },
  { id: 'reed', name: 'Reed', kind: 'raw', value: 2 },
  { id: 'bogwood', name: 'Bogwood', kind: 'fuel', value: 1 },
  { id: 'mudgel', name: 'Mud Gel', kind: 'raw', value: 4 },
  { id: 'emberroot', name: 'Emberroot', kind: 'raw', value: 12 },
  { id: 'mintpaste', name: 'Mint Paste', kind: 'ground', value: 3 },
  { id: 'glowdust', name: 'Glow Dust', kind: 'ground', value: 6 },
  { id: 'emberpowder', name: 'Ember Powder', kind: 'ground', value: 18 },
  { id: 'tonic', name: 'Soothing Tonic', kind: 'potion', value: 14 },
  { id: 'salve', name: 'Slick Salve', kind: 'potion', value: 18 },
  { id: 'glowdraught', name: 'Glow Draught', kind: 'potion', value: 24 },
  { id: 'emberelixir', name: 'Ember Elixir', kind: 'potion', value: 60 },
];

export const ITEM_IDS: readonly ItemId[] = ITEMS.map((i) => i.id);

// --- Plots -------------------------------------------------------------

export type PlotId = 'home' | 'east';

export interface PlotDef {
  id: PlotId;
  gx: number;
  gy: number;
  ownedAtStart: boolean;
  price: number;
}

export const PLOTS: readonly PlotDef[] = [
  { id: 'home', gx: 0, gy: 0, ownedAtStart: true, price: 0 },
  { id: 'east', gx: 1, gy: 0, ownedAtStart: false, price: 150 },
];

// --- Nodes -------------------------------------------------------------

export type NodeId = 'mintbush' | 'glowcaps' | 'reedclump' | 'stump' | 'emberplant';

export interface NodeDef {
  id: NodeId;
  hits: number;
  drop: { item: ItemId; min: number; max: number };
  targets: Record<PlotId, number>;
}

export const NODES: readonly NodeDef[] = [
  { id: 'mintbush', hits: 1, drop: { item: 'mint', min: 1, max: 1 }, targets: { home: 6, east: 0 } },
  { id: 'glowcaps', hits: 1, drop: { item: 'glowcap', min: 1, max: 1 }, targets: { home: 4, east: 3 } },
  { id: 'reedclump', hits: 2, drop: { item: 'reed', min: 1, max: 2 }, targets: { home: 6, east: 3 } },
  { id: 'stump', hits: 3, drop: { item: 'bogwood', min: 2, max: 2 }, targets: { home: 3, east: 2 } },
  { id: 'emberplant', hits: 2, drop: { item: 'emberroot', min: 1, max: 1 }, targets: { home: 0, east: 4 } },
];

// --- Creatures ---------------------------------------------------------

export type CreatureId = 'mudlet';

export interface CreatureDef {
  id: CreatureId;
  hp: number;
  wanderSpeed: number;
  walkMin: number;
  walkMax: number;
  idleMin: number;
  idleMax: number;
  aggroRadius: number;
  hopSpeed: number;
  contactDamage: number;
  hitboxW: number;
  hitboxH: number;
  knockback: number;
  knockbackTime: number;
  stun: number;
  drop: { item: ItemId; min: number; max: number };
  counts: Record<PlotId, number>;
}

export const CREATURES: readonly CreatureDef[] = [
  {
    id: 'mudlet',
    hp: 3,
    wanderSpeed: 30,
    walkMin: 1.5,
    walkMax: 3,
    idleMin: 0.5,
    idleMax: 1.5,
    aggroRadius: 56,
    hopSpeed: 45,
    contactDamage: 1,
    hitboxW: 10,
    hitboxH: 8,
    knockback: 20,
    knockbackTime: 0.15,
    stun: 0.25,
    drop: { item: 'mudgel', min: 1, max: 1 },
    counts: { home: 2, east: 4 },
  },
];

// --- Garden ------------------------------------------------------------

export interface CropDef {
  item: ItemId;
  nights: number;
  yield: number;
}

export const CROPS: readonly CropDef[] = [
  { item: 'mint', nights: 1, yield: 3 },
  { item: 'glowcap', nights: 1, yield: 3 },
  { item: 'emberroot', nights: 2, yield: 2 },
];

// --- Save --------------------------------------------------------------

export const SAVE_KEY = 'fenflask.save.v1';

// --- Stations ----------------------------------------------------------

export interface GrindRecipe {
  input: ItemId;
  output: ItemId;
}

export const GRIND_RECIPES: readonly GrindRecipe[] = [
  { input: 'mint', output: 'mintpaste' },
  { input: 'glowcap', output: 'glowdust' },
  { input: 'emberroot', output: 'emberpowder' },
];

export type PotionId = 'tonic' | 'salve' | 'glowdraught' | 'emberelixir';

export interface BrewRecipe {
  potion: PotionId;
  ingredients: readonly { item: ItemId; n: number }[];
}

export const CAULDRON_FUEL: ItemId = 'bogwood';

export const GOAL_BANNER = 'First Ember Elixir sold - the marsh is yours to grow';
export const GOAL_POTION: PotionId = 'emberelixir';

export const BREW_RECIPES: readonly BrewRecipe[] = [
  { potion: 'tonic', ingredients: [{ item: 'mintpaste', n: 1 }, { item: 'reed', n: 1 }] },
  { potion: 'salve', ingredients: [{ item: 'mudgel', n: 1 }, { item: 'reed', n: 1 }] },
  { potion: 'glowdraught', ingredients: [{ item: 'glowdust', n: 1 }, { item: 'mintpaste', n: 1 }] },
  { potion: 'emberelixir', ingredients: [{ item: 'emberpowder', n: 1 }, { item: 'glowdust', n: 1 }] },
];

// --- Catalog (specs/wp/WP07) ---------------------------------------------
// Bought at the catalog stand, delivered at the next morning reset. Prices are first guesses (tune).

export type CatalogId =
  | 'stoneMortar'
  | 'sickle'
  | 'beds2'
  | 'shelf5'
  | 'signboard'
  | 'cauldron2'
  | 'deepShelves'
  | 'shelf6'
  | 'lanternSign'
  | 'gardenToad'
  | 'counterToad'
  | 'basketToad'
  | 'counterToad2'
  | 'basketToad2';

export interface CatalogDef {
  id: CatalogId;
  name: string;
  price: number;
  // Must be owned (pending is not enough) before this one can be bought.
  requires?: CatalogId;
  // Extra customers each evening while owned.
  customers?: number;
  // One line for the catalog panel's footer (at most 34 characters).
  effect: string;
}

export const CATALOG: readonly CatalogDef[] = [
  { id: 'stoneMortar', name: 'STONE MORTAR', price: 90, effect: 'GRINDS TWICE AS FAST' },
  { id: 'sickle', name: 'COPPER SICKLE', price: 120, effect: 'ONE HIT LESS ON PLANTS AND STUMPS' },
  { id: 'beds2', name: 'TWO GARDEN BEDS', price: 150, effect: '2 MORE GARDEN BEDS' },
  { id: 'shelf5', name: 'FIFTH TABLE', price: 200, customers: 2, effect: 'A 5TH TABLE, 2 MORE CUSTOMERS' },
  { id: 'signboard', name: 'PAINTED SIGNBOARD', price: 220, customers: 2, effect: '2 MORE CUSTOMERS EACH EVENING' },
  { id: 'cauldron2', name: 'SECOND CAULDRON', price: 300, effect: 'BREW TWO BATCHES AT ONCE' },
  { id: 'deepShelves', name: 'DEEP TABLES', price: 360, effect: 'TABLES HOLD 8, SOME BUY TWO' },
  { id: 'shelf6', name: 'SIXTH TABLE', price: 380, requires: 'shelf5', customers: 2, effect: 'A 6TH TABLE, 2 MORE CUSTOMERS' },
  { id: 'lanternSign', name: 'LANTERN SIGN', price: 480, requires: 'signboard', customers: 3, effect: '3 MORE CUSTOMERS EACH EVENING' },
  // Helper toads (specs/wp/WP08).
  { id: 'gardenToad', name: 'GARDEN TOAD', price: 280, effect: 'HARVESTS AND REPLANTS EACH MORNING' },
  { id: 'counterToad', name: 'COUNTER TOAD', price: 320, effect: 'RINGS UP AFTER 8 SECONDS' },
  { id: 'basketToad', name: 'BASKET TOAD', price: 420, effect: 'BRINGS 5 INGREDIENTS EACH MORNING' },
  { id: 'counterToad2', name: 'TRAINED COUNTER TOAD', price: 450, requires: 'counterToad', effect: 'RINGS UP AFTER 3 SECONDS' },
  { id: 'basketToad2', name: 'BIGGER BASKET', price: 520, requires: 'basketToad', effect: 'BRINGS 9 INGREDIENTS EACH MORNING' },
];

// Where the helper toads sit (specs/wp/WP08): drawn only, never solid, never a target. Tiles are
// plot-local on the home plot ('world') or shop-local ('shop').
export const TOAD_SPOTS: Readonly<Record<'counter' | 'garden' | 'basket', { area: 'world' | 'shop'; x: number; y: number }>> = {
  counter: { area: 'shop', x: 2, y: 8 },
  garden: { area: 'world', x: 5, y: 3 },
  basket: { area: 'shop', x: 15, y: 10 },
};

// --- Structures --------------------------------------------------------

// hut: the shop seen from outside; bed: a soil bed; cot: where the player sleeps; exit: the shop
// door seen from inside (a target only while the shop is open, to say why it does not open);
// catalog: the stand where upgrades are bought (specs/wp/WP07).
export type StructureKind = 'hut' | 'bed' | 'signpost' | 'shelf' | 'counter' | 'sign' | 'mortar' | 'cauldron' | 'cot' | 'exit' | 'catalog';

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StructureDef {
  id: string;
  kind: StructureKind;
  tiles: TileRect;
  solid: boolean;
  // Footprint tiles that stay walkable (the hut's doorway).
  open?: readonly { x: number; y: number }[];
  // Without one the structure is never an interact target.
  interact?: { x: number; y: number };
  hint: string;
  // Beds switch hint once a crop is ready.
  hintReady?: string;
  // A signpost sells this plot and is gone once it is owned.
  sells?: PlotId;
  // Does not exist (not solid, not a target, not drawn) until this catalog item is owned.
  requires?: CatalogId;
}

export interface PlotLayout {
  structures: readonly StructureDef[];
  playerStart?: { x: number; y: number };
  // Walking onto `tile` goes indoors; coming out lands on `outside`.
  door?: { tile: { x: number; y: number }; outside: { x: number; y: number } };
}

const bed = (id: string, x: number, y: number, requires?: CatalogId): StructureDef => ({
  id,
  kind: 'bed',
  tiles: { x, y, w: 1, h: 1 },
  solid: false,
  interact: { x, y },
  hint: 'PLANT',
  hintReady: 'HARVEST',
  ...(requires ? { requires } : {}),
});

export const PLOT_LAYOUTS: Record<PlotId, PlotLayout> = {
  home: {
    structures: [
      { id: 'hut', kind: 'hut', tiles: { x: 1, y: 1, w: 3, h: 2 }, solid: true, open: [{ x: 2, y: 2 }], hint: '' },
      bed('bed0', 6, 2),
      bed('bed1', 7, 2),
      bed('bed2', 6, 3),
      bed('bed3', 7, 3),
      bed('bed4', 6, 4, 'beds2'),
      bed('bed5', 7, 4, 'beds2'),
      {
        id: 'signpost',
        kind: 'signpost',
        tiles: { x: 19, y: 6, w: 1, h: 1 },
        solid: true,
        interact: { x: 18, y: 6 },
        hint: 'BUY PLOT',
        sells: 'east',
      },
    ],
    playerStart: { x: 2, y: 4 },
    door: { tile: { x: 2, y: 2 }, outside: { x: 2, y: 3 } },
  },
  east: {
    structures: [],
  },
};

// --- Shop interior (specs/wp/WP06) -----------------------------------------
// One indoor map, tile coordinates from its top-left: the shop room (columns 1-13) and the back
// room (15-20) behind a partition at column 14 with a doorway.

export interface ShopLayout {
  w: number;
  h: number;
  partitionX: number;
  partitionDoorY: number;
  // Where the player and customers come in, and the gap in the front wall below it.
  entry: { x: number; y: number };
  exit: { x: number; y: number };
  // Spot 1, then spot 2, on the customer side of the counter.
  queue: readonly { x: number; y: number }[];
  // Where the delivery crate sits on a morning something arrived (drawn only, never solid).
  crate: { x: number; y: number };
  structures: readonly StructureDef[];
}

const shelf = (i: number, x: number, y = 4, requires?: CatalogId): StructureDef => ({
  id: `shelf${i}`,
  kind: 'shelf',
  tiles: { x, y, w: 1, h: 1 },
  solid: true,
  interact: { x, y: y + 1 },
  hint: 'SHELF',
  ...(requires ? { requires } : {}),
});

export const SHOP_LAYOUT: ShopLayout = {
  w: 22,
  h: 12,
  partitionX: 14,
  partitionDoorY: 6,
  entry: { x: 7, y: 10 },
  exit: { x: 7, y: 11 },
  queue: [
    { x: 3, y: 9 },
    { x: 4, y: 9 },
  ],
  crate: { x: 6, y: 10 },
  structures: [
    shelf(0, 3),
    shelf(1, 6),
    shelf(2, 9),
    shelf(3, 12),
    // Tables 5 and 6 come from the catalog; state.shop.shelves[i] belongs to the i-th shelf here.
    shelf(4, 9, 7, 'shelf5'),
    shelf(5, 12, 7, 'shelf6'),
    { id: 'counter', kind: 'counter', tiles: { x: 2, y: 8, w: 3, h: 1 }, solid: true, interact: { x: 3, y: 7 }, hint: 'RING UP' },
    { id: 'sign', kind: 'sign', tiles: { x: 9, y: 10, w: 1, h: 1 }, solid: true, interact: { x: 9, y: 9 }, hint: 'OPEN SHOP' },
    { id: 'mortar', kind: 'mortar', tiles: { x: 16, y: 3, w: 1, h: 1 }, solid: true, interact: { x: 16, y: 4 }, hint: 'GRIND' },
    { id: 'cauldron', kind: 'cauldron', tiles: { x: 18, y: 3, w: 1, h: 1 }, solid: true, interact: { x: 18, y: 4 }, hint: 'BREW' },
    // A station's id is its StationKind; the second cauldron is a cauldron like the first.
    { id: 'cauldron2', kind: 'cauldron', tiles: { x: 20, y: 3, w: 1, h: 1 }, solid: true, interact: { x: 20, y: 4 }, hint: 'BREW', requires: 'cauldron2' },
    { id: 'catalog', kind: 'catalog', tiles: { x: 12, y: 10, w: 1, h: 1 }, solid: true, interact: { x: 12, y: 9 }, hint: 'CATALOG' },
    { id: 'cot', kind: 'cot', tiles: { x: 19, y: 9, w: 2, h: 1 }, solid: true, interact: { x: 18, y: 9 }, hint: 'SLEEP' },
    { id: 'exit', kind: 'exit', tiles: { x: 7, y: 11, w: 1, h: 1 }, solid: false, interact: { x: 7, y: 10 }, hint: 'CLOSE SHOP FIRST' },
  ],
};
