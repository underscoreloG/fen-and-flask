// The shop interior (specs/wp/WP06 Look): warm plank floor, a timber-and-plaster back wall with
// jars, herbs, windows and lanterns, a rug before the counter; the back room in flagstones and
// rough stone with hanging herbs, copper pots and the cauldron's glow. Ground, walls and rugs stay
// plain (no outline); the furniture you use is outlined by the index.
import { flipX, grid, put, rect, stamp, toRows } from './format';

// --- Floors (16x16) ------------------------------------------------------------

// Four planks of four rows; `ends` is where each plank's board joint falls (-1: none), `knots`
// adds a dark knot in a plank.
function planks(ends: readonly number[], knots: readonly (readonly [number, number])[]): string[] {
  const g = grid(16, 16, 'O');
  for (let p = 0; p < 4; p++) {
    const y = p * 4;
    rect(g, 0, y + 3, 16, 1, 'o');
    // Grain: a few darker flecks along each plank, offset per plank.
    for (let x = (p * 5) % 7; x < 16; x += 7) put(g, x, y + 1 + (p % 2), 'o');
    const e = ends[p]!;
    if (e >= 0) {
      rect(g, e, y, 1, 3, 'o');
      put(g, e + 1, y, 's');
    }
    put(g, (p * 9 + 3) % 16, y, 's');
  }
  for (const [x, y] of knots) {
    put(g, x, y, 'p');
    put(g, x + 1, y, 'o');
  }
  return toRows(g);
}

// Flagstones: peat grout, mud stone, sand chips catching the lantern light.
function flags(shift: number): string[] {
  const g = grid(16, 16, 'u');
  rect(g, 0, 7, 16, 1, 'p');
  rect(g, 0, 15, 16, 1, 'p');
  rect(g, (5 + shift) % 16, 0, 1, 7, 'p');
  rect(g, (12 + shift) % 16, 8, 1, 7, 'p');
  rect(g, (1 + shift) % 16, 8, 1, 7, 'p');
  for (const [x, y] of [
    [1, 1],
    [7, 1],
    [3, 9],
    [9, 9],
    [14, 2],
  ] as const) {
    put(g, (x + shift) % 16, y, 's');
  }
  for (const [x, y] of [
    [3, 4],
    [10, 5],
    [6, 12],
    [14, 11],
  ] as const) {
    put(g, (x + shift) % 16, y, 'o');
  }
  return toRows(g);
}

// --- Walls -----------------------------------------------------------------------

// Back wall pieces are 16x32 (two tiles high): ceiling beam, plaster (or stone), rail, wainscot.
function shopWall(): string[][] {
  const g = grid(16, 32, 's');
  rect(g, 0, 0, 16, 3, 'p');
  rect(g, 0, 3, 16, 1, 'o');
  for (let y = 5; y < 20; y += 3) for (let x = (y * 3) % 5; x < 16; x += 5) put(g, x, y, 'O');
  rect(g, 0, 20, 16, 1, 'O');
  rect(g, 0, 21, 16, 1, 'o');
  rect(g, 0, 22, 16, 8, 'o');
  for (let x = 0; x < 16; x += 4) {
    rect(g, x, 22, 1, 8, 'O');
    rect(g, x + 3, 22, 1, 8, 'p');
  }
  rect(g, 0, 30, 16, 2, 'p');
  return g;
}

function stoneWall(): string[][] {
  const g = grid(16, 32, 'u');
  rect(g, 0, 0, 16, 3, 'p');
  rect(g, 0, 3, 16, 1, 'o');
  for (let y = 4; y < 30; y += 5) {
    rect(g, 0, y + 4, 16, 1, 'p');
    const off = (y / 5) % 2 === 0 ? 3 : 10;
    rect(g, off, y, 1, 4, 'p');
    put(g, (off + 2) % 16, y, 's');
    put(g, (off + 8) % 16, y + 1, 's');
  }
  rect(g, 0, 30, 16, 2, 'p');
  return g;
}

// Jars on a wall shelf: mint, glow and ember brews, a stoppered bottle.
function jars(g: string[][]): void {
  rect(g, 1, 14, 14, 1, 'O');
  rect(g, 1, 15, 14, 1, 'o');
  put(g, 2, 16, 'o');
  put(g, 13, 16, 'o');
  stamp(g, 1, 8, ['.kk.', 'kbbk', 'knnk', 'knnk', 'kGnk', '.kk.']);
  stamp(g, 5, 9, ['.kk..', 'kOOk.', 'kcck.', 'kWck.', '.kk..']);
  stamp(g, 9, 7, ['..k..', '.kok.', '.kbk.', 'keeek', 'keEek', 'keeek', '.kkk.']);
  stamp(g, 13, 10, ['k.', 'k.', 'k.', 'k.']);
  stamp(g, 12, 10, ['kk', 'kQ', 'kQ', 'kk']);
}

// Bundles of drying herbs on a peg rail.
function herbs(g: string[][]): void {
  rect(g, 0, 5, 16, 1, 'o');
  for (const [x, leaf] of [
    [2, 'g'],
    [7, 'n'],
    [12, 'G'],
  ] as const) {
    put(g, x, 6, 'o');
    put(g, x, 7, 'r');
    stamp(g, x - 2, 8, [`.${leaf}${leaf}${leaf}.`, `${leaf}m${leaf}m${leaf}`, `.${leaf}m${leaf}.`, `.${leaf}${leaf}${leaf}.`, `..${leaf}..`]);
  }
}

// A window onto the marsh: frame, two panes of evening sky over a reed line, a sill.
function windowPane(g: string[][]): void {
  rect(g, 2, 5, 12, 13, 'o');
  rect(g, 3, 6, 10, 11, 'W');
  rect(g, 3, 11, 10, 6, 'w');
  rect(g, 3, 14, 10, 3, 'm');
  for (const x of [4, 7, 11]) put(g, x, 13, 'r');
  rect(g, 7, 6, 2, 11, 'o');
  rect(g, 3, 10, 10, 1, 'o');
  put(g, 4, 7, 'b');
  put(g, 10, 7, 'b');
  rect(g, 1, 18, 14, 1, 'O');
  rect(g, 1, 19, 14, 1, 'o');
}

// A lantern on an iron bracket, lit.
function lantern(g: string[][]): void {
  stamp(g, 4, 5, ['kkkk.....', '...k.....']);
  stamp(g, 5, 7, ['.kkkk.', 'kkkkkk', 'kEEEEk', 'kEbeEk', 'kEeeEk', 'kEEEEk', 'kkkkkk', '..kk..']);
  // Warm light falling on the plaster around it.
  for (const [x, y] of [
    [3, 9],
    [12, 9],
    [3, 12],
    [12, 12],
    [4, 16],
    [11, 16],
  ] as const) {
    put(g, x, y, 'E');
  }
}

// The shop's sign: a wooden plaque with a glowing flask.
function plaque(g: string[][]): void {
  rect(g, 2, 6, 12, 11, 'o');
  rect(g, 3, 7, 10, 9, 'O');
  stamp(g, 5, 8, ['..kk..', '..cc..', '.kccc.', 'kccWck', 'kcccck', '.kkkk.']);
  put(g, 3, 7, 's');
  put(g, 2, 5, 'k');
  put(g, 13, 5, 'k');
}

// Copper pots and a ladle hanging from a rack.
function rack(g: string[][]): void {
  rect(g, 1, 5, 14, 1, 'p');
  for (const x of [3, 8, 12]) put(g, x, 6, 'k');
  stamp(g, 1, 7, ['.kkk.', 'keEek', 'keeek', '.kkk.']);
  stamp(g, 6, 7, ['.kkkk.', 'kEeeek', 'keeeek', 'keeeek', '.kkkk.']);
  stamp(g, 11, 7, ['.k.', '.k.', '.k.', 'kbk', 'kbk', '.k.']);
}

// A recipe page pinned up, and a soot shadow over the fire.
function parchment(g: string[][]): void {
  rect(g, 3, 6, 10, 12, 'b');
  for (let y = 8; y < 17; y += 2) rect(g, 4, y, 6 + (y % 3), 1, 'p');
  put(g, 8, 6, 'h');
  stamp(g, 9, 12, ['.c.', 'ccc']);
}

function soot(g: string[][]): void {
  for (let y = 4; y < 22; y++) for (let x = 2 + (y % 2); x < 14; x += 2) if (y > 4 + Math.abs(x - 8)) put(g, x, y, 'p');
}

// A heavy timber post where the partition meets the back wall.
function beam(g: string[][]): void {
  rect(g, 4, 0, 8, 32, 'o');
  rect(g, 4, 0, 1, 32, 'O');
  rect(g, 11, 0, 1, 32, 'p');
}

const deco = (base: () => string[][], f?: (g: string[][]) => void): string[] => {
  const g = base();
  f?.(g);
  return toRows(g);
};

// Side walls (16x16), seen from above: a thick wall top with a lit inner lip.
function sideWall(): string[] {
  const g = grid(16, 16, 'p');
  rect(g, 0, 0, 12, 16, 'o');
  rect(g, 1, 0, 1, 16, 'O');
  for (let y = 3; y < 16; y += 6) rect(g, 0, y, 12, 1, 'p');
  rect(g, 12, 0, 1, 16, 'O');
  rect(g, 13, 0, 3, 16, 'p');
  return toRows(g);
}

// The front wall's top, seen from above.
function frontWall(): string[] {
  const g = grid(16, 16, 'o');
  rect(g, 0, 0, 16, 2, 'p');
  rect(g, 0, 2, 16, 1, 'O');
  for (let x = 2; x < 16; x += 6) rect(g, x, 3, 1, 13, 'p');
  rect(g, 0, 15, 16, 1, 'p');
  return toRows(g);
}

// The open front door: the sill, then the marsh grass outside.
function threshold(): string[] {
  const g = grid(16, 16, 'g');
  rect(g, 0, 0, 16, 3, 'O');
  rect(g, 0, 3, 16, 1, 'o');
  rect(g, 0, 4, 16, 2, 's');
  rect(g, 0, 6, 16, 1, 'u');
  for (const [x, y] of [
    [3, 9],
    [10, 8],
    [13, 12],
    [6, 13],
  ] as const) {
    put(g, x, y, 'G');
  }
  rect(g, 0, 0, 2, 16, 'p');
  rect(g, 14, 0, 2, 16, 'p');
  return toRows(g);
}

// The partition seen from above: a planked timber wall, light on its left face.
function partition(): string[] {
  const g = grid(16, 16, 'o');
  rect(g, 0, 0, 2, 16, 'O');
  rect(g, 14, 0, 2, 16, 'p');
  for (let y = 5; y < 16; y += 8) rect(g, 2, y, 12, 1, 'p');
  put(g, 6, 2, 'O');
  put(g, 9, 10, 'O');
  return toRows(g);
}

// The partition's doorway: planks on the shop side, stone on the back room side, a sill between.
function partitionDoor(): string[] {
  const g = planks([-1, 9, -1, 4], []).map((r) => [...r]);
  const stone = flags(2);
  for (let y = 0; y < 16; y++) for (let x = 9; x < 16; x++) put(g, x, y, stone[y]![x]!);
  rect(g, 7, 0, 2, 16, 'p');
  rect(g, 7, 0, 1, 16, 'o');
  return toRows(g);
}

// --- Flat decor ---------------------------------------------------------------------

// The rug before the counter, 48x32: ember field, emberhot diamonds, bone tassels.
function rug(): string[] {
  const g = grid(48, 32);
  rect(g, 2, 2, 44, 28, 'p');
  rect(g, 3, 3, 42, 26, 'e');
  rect(g, 5, 5, 38, 22, 'h');
  rect(g, 6, 6, 36, 20, 'e');
  for (let i = 0; i < 4; i++) {
    const cx = 10 + i * 9;
    for (let d = 0; d <= 4; d++) {
      for (const [x, y] of [
        [cx - d, 16 - (4 - d)],
        [cx + d, 16 - (4 - d)],
        [cx - d, 15 + (4 - d)],
        [cx + d, 15 + (4 - d)],
      ] as const) {
        put(g, x, y, d === 4 ? 'E' : 'e');
      }
    }
    put(g, cx, 15, 'E');
    put(g, cx, 16, 'E');
  }
  for (let y = 4; y < 28; y += 3) {
    put(g, 1, y, 'b');
    put(g, 46, y, 'b');
  }
  return toRows(g);
}

// A reed doormat inside the front door.
function doormat(): string[] {
  const g = grid(16, 16);
  rect(g, 2, 4, 12, 8, 'r');
  for (let x = 3; x < 13; x += 2) rect(g, x, 5, 1, 6, 'O');
  rect(g, 2, 4, 12, 1, 's');
  rect(g, 2, 11, 12, 1, 'o');
  return toRows(g);
}

// The hearth's glow on the back room floor, drawn faintly under the cauldron.
function glow(): string[] {
  const g = grid(48, 24);
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 48; x++) {
      const d = ((x - 23.5) / 24) ** 2 + ((y - 11.5) / 12) ** 2;
      if (d < 0.35) put(g, x, y, 'E');
      else if (d < 0.7) put(g, x, y, 'e');
      else if (d < 1 && (x + y) % 2 === 0) put(g, x, y, 'e');
    }
  }
  return toRows(g);
}

// --- Furniture (outlined; every piece keeps a 1 px clear margin) --------------------

// Display table: planked top seen from above, an apron in front (the count pips go there), legs.
const TABLE = [
  '................',
  '.sOOOOOOOOOOOOs.',
  '.OOoOOOOOOOoOOO.',
  '.OOOOOOOOOOOOOO.',
  '.OOOOOoOOOOOOOO.',
  '.OOOOOOOOOoOOOO.',
  '.ssssssssssssss.',
  '.oooooooooooooo.',
  '.oppppppppppppo.',
  '.oppppppppppppo.',
  '.oooooooooooooo.',
  '..oO........oO..',
  '..oO........oO..',
  '..op........op..',
  '..pp........pp..',
  '................',
];

// Counter 48x25 (footprint 48x16): a till in the middle, a ledger and a coin stack on the top,
// planked front facing the customers.
function counter(): string[] {
  const g = grid(48, 25);
  rect(g, 1, 7, 46, 6, 'O');
  rect(g, 1, 7, 46, 1, 's');
  rect(g, 1, 12, 46, 1, 's');
  for (let x = 4; x < 46; x += 9) put(g, x, 9, 'o');
  rect(g, 1, 13, 46, 1, 'O');
  rect(g, 1, 14, 46, 8, 'o');
  for (let x = 6; x < 46; x += 6) rect(g, x, 14, 1, 8, 'p');
  rect(g, 1, 22, 46, 2, 'p');
  // Till: a bone-keyed box with a paper roll and a drawer.
  rect(g, 18, 2, 12, 9, 'L');
  rect(g, 18, 2, 12, 1, 'k');
  rect(g, 18, 2, 1, 9, 'k');
  rect(g, 29, 2, 1, 9, 'k');
  for (let x = 20; x < 28; x += 2) put(g, x, 4, '$');
  for (let x = 20; x < 28; x += 2) put(g, x, 6, 'b');
  rect(g, 19, 8, 10, 2, 'P');
  put(g, 24, 9, '$');
  stamp(g, 25, 1, ['bb', 'bk']);
  // Ledger, open, and a coin stack.
  stamp(g, 4, 8, ['kkkkkkk', 'kbbkbbk', 'kbbkbbk', 'kkkkkkk']);
  stamp(g, 37, 7, ['.kkk.', 'k$E$k', 'k$$$k', 'kE$$k', '.kkk.']);
  return toRows(g);
}

// The shop sign: a slate on an easel. Open: a chalk flask and a coin; closed: a moon and stars.
function sign(open: boolean): string[] {
  const g = grid(16, 24);
  rect(g, 2, 1, 12, 14, 'o');
  rect(g, 3, 2, 10, 12, 'P');
  put(g, 2, 1, 'O');
  for (const [x, y] of [
    [3, 15],
    [3, 16],
    [2, 17],
    [2, 18],
    [2, 19],
    [1, 20],
    [1, 21],
    [12, 15],
    [12, 16],
    [13, 17],
    [13, 18],
    [13, 19],
    [14, 20],
    [14, 21],
  ] as const) {
    put(g, x, y, 'o');
  }
  rect(g, 4, 15, 8, 1, 'o');
  if (open) {
    stamp(g, 4, 3, ['..bb....', '..bb....', '.b..b...', 'bnnnnb..', 'bnnnnb.$', '.bbbb.$$']);
    rect(g, 4, 11, 8, 1, 'n');
  } else {
    stamp(g, 4, 3, ['..bbb...', '.bb...E.', '.b......', '.bb...E.', '..bbb...', '........']);
    rect(g, 4, 11, 8, 1, 'L');
  }
  return toRows(g);
}

// Cot 32x20 (footprint 32x16): head at the wall end, pillow, a coat-teal blanket.
function cot(): string[] {
  const g = grid(32, 20);
  rect(g, 1, 3, 30, 13, 'o');
  rect(g, 2, 4, 28, 10, 's');
  rect(g, 2, 4, 19, 10, 'w');
  rect(g, 2, 4, 19, 1, 'W');
  for (let x = 4; x < 21; x += 4) rect(g, x, 6, 1, 7, 'D');
  rect(g, 20, 4, 1, 10, 'W');
  rect(g, 22, 5, 7, 7, 'b');
  rect(g, 22, 11, 7, 1, 's');
  rect(g, 28, 1, 3, 15, 'O');
  rect(g, 30, 1, 1, 15, 'o');
  rect(g, 1, 14, 30, 1, 'p');
  for (const x of [2, 28]) rect(g, x, 15, 2, 4, 'o');
  return toRows(g);
}

export const INTERIOR_TILES: Record<string, readonly string[]> = {
  floor_0: planks([5, 12, 2, 9], []),
  floor_1: planks([10, 3, 13, 6], [[6, 9]]),
  floor_2: planks([1, 8, -1, 14], [[11, 2]]),
  floor_back_0: flags(0),
  floor_back_1: flags(7),
  wall_plain: deco(shopWall),
  wall_jars: deco(shopWall, jars),
  wall_herbs: deco(shopWall, herbs),
  wall_window: deco(shopWall, windowPane),
  wall_lantern: deco(shopWall, lantern),
  wall_plaque: deco(shopWall, plaque),
  wall_beam: deco(shopWall, beam),
  wallb_plain: deco(stoneWall),
  wallb_herbs: deco(stoneWall, herbs),
  wallb_rack: deco(stoneWall, rack),
  wallb_page: deco(stoneWall, parchment),
  wallb_soot: deco(stoneWall, soot),
  wallb_lantern: deco(stoneWall, lantern),
  wall_side_l: sideWall(),
  wall_side_r: flipX(sideWall()),
  wall_front: frontWall(),
  threshold: threshold(),
  partition: partition(),
  partition_door: partitionDoor(),
  rug: rug(),
  doormat: doormat(),
  hearth_glow: glow(),
};

export const INTERIOR_STRUCTURES: Record<string, readonly string[]> = {
  shelf: TABLE,
  counter: counter(),
  sign_open: sign(true),
  sign_closed: sign(false),
  cot: cot(),
};

// Which back wall piece stands over each column of the 22-wide interior (14 is the partition).
export const BACK_WALL: readonly string[] = [
  'wall_plain',
  'wall_plain',
  'wall_jars',
  'wall_lantern',
  'wall_herbs',
  'wall_window',
  'wall_jars',
  'wall_plaque',
  'wall_window',
  'wall_herbs',
  'wall_jars',
  'wall_lantern',
  'wall_window',
  'wall_jars',
  'wall_beam',
  'wallb_herbs',
  'wallb_rack',
  'wallb_page',
  'wallb_soot',
  'wallb_lantern',
  'wallb_herbs',
  'wallb_plain',
];
