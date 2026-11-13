// Structures outdoors, and the stations of the back room. Drawn without outline; the index adds
// ink to the ones that stand up.
import { grid, put, rect, stamp, toRows } from './format';

// Hut 48x48: deep thatch roof, daub walls with a timber frame, door bottom-center
// (the door tile is plot tile (2,3), right under the middle footprint column).
function buildHut(): string[] {
  const g = grid(48, 48);
  // Roof: a trapezoid from the ridge (row 2) to the eaves (row 27), thatch in bands.
  for (let y = 2; y <= 27; y++) {
    const left = Math.round(13 - ((y - 2) * 12) / 25);
    const right = 47 - left;
    for (let x = left; x < right; x++) {
      const band = (y - 2) % 4;
      const n = (x * 7 + y * 13) % 11;
      let ch = 'r';
      if (band === 3) ch = n < 6 ? 's' : 'O';
      else if (band === 0) ch = n < 2 ? 's' : 'r';
      else if (n === 0) ch = 's';
      // Light from the top-left: the right slope sits a shade darker.
      if (x > 34 && ch === 'r' && n < 5) ch = 's';
      if (x === left || x === right - 1) ch = 'O';
      put(g, x, y, ch);
    }
  }
  rect(g, 13, 2, 22, 1, 'o');
  rect(g, 14, 1, 20, 1, 'O');
  // Ragged eave fringe hanging over the wall top.
  for (let x = 1; x < 47; x++) {
    put(g, x, 28, x % 3 === 0 ? 'O' : 's');
    if (x % 2 === 0) put(g, x, 29, 'O');
  }
  // Chimney of mud bricks poking through the right slope.
  rect(g, 33, 3, 5, 9, 'u');
  rect(g, 33, 3, 5, 1, 'p');
  rect(g, 32, 4, 7, 1, 'p');
  for (let y = 6; y < 12; y += 2) rect(g, 33, y, 5, 1, 'p');
  put(g, 34, 2, 'b');
  put(g, 35, 1, 'b');
  // Walls.
  rect(g, 4, 29, 40, 17, 's');
  rect(g, 4, 30, 40, 2, 'O');
  for (const x of [4, 15, 32, 43]) {
    rect(g, x, 29, 1, 17, 'o');
  }
  for (const x of [5, 16, 33]) rect(g, x, 30, 1, 16, 'O');
  rect(g, 4, 38, 40, 1, 'o');
  // Foundation and moss at the base.
  rect(g, 3, 45, 42, 2, 'p');
  rect(g, 4, 45, 40, 1, 'u');
  for (const x of [6, 7, 13, 30, 38, 39, 41]) put(g, x, 45, 'm');
  // Windows with lamplight.
  for (const wx of [8, 36]) {
    rect(g, wx - 1, 33, 6, 6, 'o');
    rect(g, wx, 34, 4, 4, 'E');
    rect(g, wx, 36, 4, 2, 'e');
    rect(g, wx + 1, 34, 1, 4, 'o');
    rect(g, wx, 35, 4, 1, 'o');
    put(g, wx, 34, 'b');
  }
  // Door.
  rect(g, 19, 33, 10, 13, 'k');
  rect(g, 20, 34, 8, 12, 'o');
  for (const x of [21, 24]) rect(g, x, 34, 1, 12, 'O');
  rect(g, 20, 34, 8, 1, 'p');
  put(g, 26, 40, '$');
  rect(g, 19, 46, 10, 1, 'u');
  // A striped awning over the door, scalloped over its frame, and a shop sign hanging from a
  // bracket beside it: the hut reads as a shop.
  for (let x = 18; x <= 29; x++) {
    const stripe = Math.floor((x - 18) / 2) % 2 === 0 ? 'e' : 'b';
    put(g, x, 30, 'o');
    rect(g, x, 31, 1, 2, stripe);
    if ((x - 18) % 2 === 0) put(g, x, 33, stripe);
  }
  rect(g, 13, 31, 5, 1, 'k');
  put(g, 13, 32, 'k');
  put(g, 17, 32, 'k');
  rect(g, 13, 33, 5, 6, 'o');
  rect(g, 14, 34, 3, 4, 'O');
  stamp(g, 14, 34, ['.k.', '.c.', 'ccc', 'cWc']);
  return toRows(g);
}

const MORTAR = [
  '................',
  '...........bb...',
  '..........bsb...',
  '.........bsb....',
  '........bsb.....',
  '...OOOOObbOOO...',
  '..OppppnnnppoO..',
  '..ooppnnnnppoo..',
  '..Ooooooooooooo.',
  '...OooooooooOo..',
  '....ooooooooo...',
  '.....pppppp.....',
  '....OoooooooO...',
  '...OoooOoooooo..',
  '...pppppppppppp.',
  '................',
];

const CAULDRON_0 = [
  '.......c........',
  '....c.....c.....',
  '......cc....c...',
  '.....c..c.......',
  '...LLLLLLLLLL...',
  '..LcccWccccccP..',
  '..LLccccccccPP..',
  '.LLLLLLLLLLLLPP.',
  '.LLPPPPPPPPPPkP.',
  '.LPPPPPPPPPPPkP.',
  '.LPPPPPPPPPPPkP.',
  '.LPPPPPPPPPPkkP.',
  '..PPPPPPPPPPkP..',
  '..PPPPPPPPPkkP..',
  '...PPPPPPPPPP...',
  '...P.eEEee..P...',
  '...P.eEEEe.P....',
  '...ooeeEeeoo....',
  '..oooOooooooo...',
  '................',
];

const CAULDRON_1 = [
  '..........c.....',
  '.....c..........',
  '...c....cc......',
  '.........c..c...',
  '...LLLLLLLLLL...',
  '..LccccccWcccP..',
  '..LLccccccccPP..',
  '.LLLLLLLLLLLLPP.',
  '.LLPPPPPPPPPPkP.',
  '.LPPPPPPPPPPPkP.',
  '.LPPPPPPPPPPPkP.',
  '.LPPPPPPPPPPkkP.',
  '..PPPPPPPPPPkP..',
  '..PPPPPPPPPkkP..',
  '...PPPPPPPPPP...',
  '...P.eeEEe..P...',
  '...P.eEEEeeP....',
  '...ooeEEeeoo....',
  '..oooooooOooo...',
  '................',
];

// Idle: frame 0 without the bubbles above the rim, the fire under it gone to cold logs.
const COLD: Readonly<Record<string, string>> = { e: 'p', E: 'o' };
const CAULDRON_IDLE = CAULDRON_0.map((r, y) => (y < 4 ? '.'.repeat(r.length) : r.replace(/[eE]/g, (c) => COLD[c]!)));

const SIGNPOST = [
  '................',
  '................',
  '..OOOOOOOOOO....',
  '..OsssssssssO...',
  '..OsskkkkkksOO..',
  '..Osssss$sssskO.',
  '..OsskkkkkksOO..',
  '..OsssssssssO...',
  '..ooooooooooo...',
  '......oO........',
  '......oO........',
  '......oO........',
  '......oO........',
  '......oO........',
  '......oO........',
  '......oO........',
  '......oO........',
  '......oO........',
  '......oO........',
  '......oO........',
  '.....ooOO.......',
  '....mpoOpm......',
  '...mmppppmm.....',
  '................',
];

// Low raised bed: thin log rim around dark peat with scattered mud clods.
const BED_EMPTY = [
  '................',
  '................',
  '..OOOOOOOOOOOO..',
  '.OppppppppppppO.',
  '.OpuupppuuppupO.',
  '.OppppppppppppO.',
  '.OppuupppuupppO.',
  '.OppppppppppppO.',
  '.OpuuppuupppuuO.',
  '.OppppppppppppO.',
  '.OpppuuppppuupO.',
  '.OppppppppppppO.',
  '.oOOOOOOOOOOOOo.',
  '..oooooooooooo..',
  '................',
  '................',
];

// Crops on the bed: a few small shoots after planting, a full crop once ready.
const onBed = (spots: readonly (readonly [number, number])[], art: readonly string[]): string[] => {
  const g = BED_EMPTY.map((r) => [...r]);
  for (const [x, y] of spots) stamp(g, x, y, art);
  return toRows(g);
};

const SPROUT_SPOTS = [
  [3, 4],
  [9, 3],
  [5, 8],
  [10, 8],
] as const;

const CROP_SPOTS = [
  [2, 1],
  [8, 1],
  [4, 6],
  [9, 6],
] as const;

const BED_CROP_SPRITES: Record<string, readonly string[]> = {
  bed_sprout_mint: onBed(SPROUT_SPOTS, ['n.n', '.g.']),
  bed_sprout_glowcap: onBed(SPROUT_SPOTS, ['.c.', '.b.']),
  bed_sprout_emberroot: onBed(SPROUT_SPOTS, ['G.G', '.e.']),
  bed_ready_mint: onBed(CROP_SPOTS, ['.nGn.', 'nnGnn', 'gnGng', '.ggg.']),
  bed_ready_glowcap: onBed(CROP_SPOTS, ['.ccc.', 'cWbcc', 'WWWWW', '..b..', '..b..']),
  bed_ready_emberroot: onBed(CROP_SPOTS, ['g.G.g', '.gGg.', 'eEEee', '.eee.']),
};

export const STRUCTURE_SPRITES: Record<string, readonly string[]> = {
  ...BED_CROP_SPRITES,
  hut: buildHut(),
  mortar: MORTAR,
  cauldron_0: CAULDRON_0,
  cauldron_1: CAULDRON_1,
  cauldron_idle: CAULDRON_IDLE,
  signpost: SIGNPOST,
  bed_empty: BED_EMPTY,
};

export const SHADOW_SPRITES: Record<string, readonly string[]> = {
  shadow_s: ['..kkkkkkkk..', '.kkkkkkkkkk.', '.kkkkkkkkkk.', '..kkkkkkkk..'],
  shadow_m: ['...kkkkkkkkkk...', '.kkkkkkkkkkkkkk.', 'kkkkkkkkkkkkkkkk', '.kkkkkkkkkkkkkk.', '...kkkkkkkkkk...'],
  shadow_l: [
    '......' + 'k'.repeat(36) + '......',
    '..' + 'k'.repeat(44) + '..',
    'k'.repeat(48),
    '..' + 'k'.repeat(44) + '..',
    '......' + 'k'.repeat(36) + '......',
  ],
};
