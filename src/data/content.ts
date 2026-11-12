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
}

export const ITEMS: readonly ItemDef[] = [
  { id: 'mint', name: 'Marsh Mint', kind: 'raw' },
  { id: 'glowcap', name: 'Glowcap', kind: 'raw' },
  { id: 'reed', name: 'Reed', kind: 'raw' },
  { id: 'bogwood', name: 'Bogwood', kind: 'fuel' },
  { id: 'mudgel', name: 'Mud Gel', kind: 'raw' },
  { id: 'emberroot', name: 'Emberroot', kind: 'raw' },
  { id: 'mintpaste', name: 'Mint Paste', kind: 'ground' },
  { id: 'glowdust', name: 'Glow Dust', kind: 'ground' },
  { id: 'emberpowder', name: 'Ember Powder', kind: 'ground' },
  { id: 'tonic', name: 'Soothing Tonic', kind: 'potion' },
  { id: 'salve', name: 'Slick Salve', kind: 'potion' },
  { id: 'glowdraught', name: 'Glow Draught', kind: 'potion' },
  { id: 'emberelixir', name: 'Ember Elixir', kind: 'potion' },
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
  baseValue: number;
}

export const CAULDRON_FUEL: ItemId = 'bogwood';

export const BREW_RECIPES: readonly BrewRecipe[] = [
  { potion: 'tonic', ingredients: [{ item: 'mintpaste', n: 1 }, { item: 'reed', n: 1 }], baseValue: 14 },
  { potion: 'salve', ingredients: [{ item: 'mudgel', n: 1 }, { item: 'reed', n: 1 }], baseValue: 18 },
  { potion: 'glowdraught', ingredients: [{ item: 'glowdust', n: 1 }, { item: 'mintpaste', n: 1 }], baseValue: 24 },
  { potion: 'emberelixir', ingredients: [{ item: 'emberpowder', n: 1 }, { item: 'glowdust', n: 1 }], baseValue: 60 },
];

// --- Home plot layout --------------------------------------------------

export type StructureKind = 'hut' | 'bed' | 'mortar' | 'cauldron' | 'stall' | 'signpost';

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
  interact: { x: number; y: number };
  hint: string;
  // Beds switch hint once a crop is ready.
  hintReady?: string;
}

export interface PlotLayout {
  structures: readonly StructureDef[];
  playerStart?: { x: number; y: number };
  customerSpot?: { x: number; y: number };
}

const bed = (id: string, x: number, y: number): StructureDef => ({
  id,
  kind: 'bed',
  tiles: { x, y, w: 1, h: 1 },
  solid: false,
  interact: { x, y },
  hint: 'PLANT',
  hintReady: 'HARVEST',
});

export const PLOT_LAYOUTS: Record<PlotId, PlotLayout> = {
  home: {
    structures: [
      { id: 'hut', kind: 'hut', tiles: { x: 1, y: 1, w: 3, h: 2 }, solid: true, interact: { x: 2, y: 3 }, hint: 'SLEEP' },
      bed('bed0', 6, 2),
      bed('bed1', 7, 2),
      bed('bed2', 6, 3),
      bed('bed3', 7, 3),
      { id: 'mortar', kind: 'mortar', tiles: { x: 10, y: 2, w: 1, h: 1 }, solid: true, interact: { x: 10, y: 3 }, hint: 'GRIND' },
      { id: 'cauldron', kind: 'cauldron', tiles: { x: 12, y: 2, w: 1, h: 1 }, solid: true, interact: { x: 12, y: 3 }, hint: 'BREW' },
      { id: 'stall', kind: 'stall', tiles: { x: 8, y: 11, w: 3, h: 1 }, solid: true, interact: { x: 9, y: 10 }, hint: 'STALL' },
      { id: 'signpost', kind: 'signpost', tiles: { x: 19, y: 6, w: 1, h: 1 }, solid: true, interact: { x: 18, y: 6 }, hint: 'BUY PLOT' },
    ],
    playerStart: { x: 2, y: 4 },
    customerSpot: { x: 9, y: 12 },
  },
  east: {
    structures: [],
  },
};
