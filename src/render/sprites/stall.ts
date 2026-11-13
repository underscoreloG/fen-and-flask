// Customer sprites: shoppers (16x24, front, back and side, 2-frame walk, 3 looks) recoloured from
// the player's frames, the waiting bubble, and the 4 reaction bubbles. Each reaction has its own fill token and
// its own glyph, so they read apart at a glance: delighted = emberhot with a red heart,
// happy = mint with a smile, grumbling = ember with a zigzag mouth, refuses = heart red with a
// bone X. World bubbles are 12x12 with a tail; the `react_` icons are the 8x8 notebook versions.
import { grid, rect, stamp, toRows } from './format';
import { PLAYER_SPRITES } from './player';

// Hat, coat, coat light, coat dark of each look (never plum: creatures only).
const LOOKS: readonly Record<string, string>[] = [
  { r: 'O', w: 'e', W: 'E', D: 'o' },
  { r: 'u', w: 'n', W: 'G', D: 'g' },
  { r: 'b', w: 'u', W: 's', D: 'p' },
];

const recolor = (rows: readonly string[], map: Record<string, string>): string[] =>
  rows.map((row) => [...row].map((ch) => map[ch] ?? ch).join(''));

// customer_<look>_<down|up|side>_<frame>; side faces right, like the player's.
export const CUSTOMER_SPRITES: Record<string, readonly string[]> = Object.fromEntries(
  LOOKS.flatMap((map, v) =>
    ['down', 'up', 'side'].flatMap((dir) =>
      [0, 1].map((f) => [`customer_${v}_${dir}_${f}`, recolor(PLAYER_SPRITES[`player_${dir}_${f}`]!, map)]),
    ),
  ),
);

// Waiting at the counter: a bone bubble, 12x14, whose inside (from (2,1), 8x8) holds the icon of
// the item being bought; the renderer draws the icon, and the patience bar under the bubble.
function waitBubble(): string[] {
  const g = grid(12, 14);
  rect(g, 2, 0, 8, 1, 'k');
  rect(g, 1, 1, 10, 1, 'k');
  rect(g, 0, 2, 12, 7, 'k');
  rect(g, 1, 9, 10, 1, 'k');
  rect(g, 2, 10, 8, 1, 'k');
  rect(g, 2, 1, 8, 1, 'b');
  rect(g, 1, 2, 10, 7, 'b');
  rect(g, 2, 9, 8, 1, 'b');
  stamp(g, 4, 10, ['b']);
  stamp(g, 3, 11, ['kbk']);
  stamp(g, 4, 12, ['k']);
  return toRows(g);
}

export const CUSTOMER_LOOKS = LOOKS.length;

// 12x12: a rounded box (rows 0-9) with a tail under its middle; glyphs go in the 8x6 inside.
function bubble(fill: string, glyph: readonly string[]): string[] {
  const g = grid(12, 12);
  rect(g, 2, 0, 8, 1, 'k');
  rect(g, 1, 1, 10, 1, 'k');
  rect(g, 0, 2, 12, 6, 'k');
  rect(g, 1, 8, 10, 1, 'k');
  rect(g, 2, 9, 8, 1, 'k');
  rect(g, 2, 1, 8, 1, fill);
  rect(g, 1, 2, 10, 6, fill);
  rect(g, 2, 8, 8, 1, fill);
  stamp(g, 4, 9, [fill]);
  stamp(g, 3, 10, [`k${fill}k`]);
  stamp(g, 4, 11, ['k']);
  stamp(g, 2, 2, glyph);
  return toRows(g);
}

const GLYPHS: Record<string, { fill: string; big: readonly string[]; icon: readonly string[] }> = {
  delighted: {
    fill: 'E',
    big: ['.hh.hh..', 'hhhhhhh.', 'hhhhhhh.', '.hhhhh..', '..hhh...', '...h....'],
    icon: ['.kkkkkk.', 'kEhEEhEk', 'khhhhhhk', 'kEhhhhEk', 'kEEhhEEk', '.kkkkkk.', '..kk....', '..k.....'],
  },
  happy: {
    fill: 'n',
    big: ['........', '.k...k..', '........', 'k.....k.', '.kkkkk..', '........'],
    icon: ['.kkkkkk.', 'knknnknk', 'knnnnnnk', 'kknnnnkk', 'knkkkknk', '.kkkkkk.', '..kk....', '..k.....'],
  },
  grumbling: {
    fill: 'e',
    big: ['kk...kk.', '..k.k...', '........', '........', 'k.k.k.k.', '.k.k.k.k'],
    icon: ['.kkkkkk.', 'kkeeeekk', 'kekeekek', 'keeeeeek', 'kkekekek', '.kkkkkk.', '..kk....', '..k.....'],
  },
  refuses: {
    fill: 'h',
    big: ['b.....b.', '.b...b..', '..b.b...', '...b....', '..b.b...', '.b...b..'],
    icon: ['.kkkkkk.', 'khbhhbhk', 'khhbbhhk', 'khhbbhhk', 'khbhhbhk', '.kkkkkk.', '..kk....', '..k.....'],
  },
};

export const BUBBLE_SPRITES: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(GLYPHS).flatMap(([r, g]) => [
    [`bubble_${r}`, bubble(g.fill, g.big)],
    [`react_${r}`, g.icon],
  ]),
);
BUBBLE_SPRITES.bubble_wait = waitBubble();
