// Customer sprites: shoppers (16x24, front, back and side, 2-frame walk, one look per customer
// type of specs/wp/WP09) recoloured from the player's frames, their 8x8 faces for the notebook,
// the waiting bubble, and the 4 reaction bubbles. Each reaction has its own fill token and
// its own glyph, so they read apart at a glance: delighted = emberhot with a red heart,
// happy = mint with a smile, grumbling = ember with a zigzag mouth, refuses = heart red with a
// bone X. World bubbles are 12x12 with a tail; the `react_` icons are the 8x8 notebook versions.
import type { CustomerType } from '../../data/content';
import { grid, rect, stamp, toRows } from './format';
import { PLAYER_SPRITES } from './player';

// Hat (r), coat (w), coat light (W), coat dark (D) of each type, one hue each so they read apart at
// 16 px: the traveller in an ember coat under a wooden hat, the courier in night blue under a red
// cap, the haggler in coin gold under a peat hat, the herbalist in grass green under a moss hat.
// Never plum: creatures only.
const LOOKS: Readonly<Record<CustomerType, Record<string, string>>> = {
  traveller: { r: 'O', w: 'e', W: 'E', D: 'o' },
  courier: { r: 'h', w: 'N', W: 'W', D: 'D' },
  haggler: { r: 'p', w: '$', W: 'E', D: 'o' },
  herbalist: { r: 'm', w: 'g', W: 'G', D: 'm' },
};

const recolor = (rows: readonly string[], map: Record<string, string>): string[] =>
  rows.map((row) => [...row].map((ch) => map[ch] ?? ch).join(''));

// customer_<type>_<down|up|side>_<frame>; side faces right, like the player's.
export const CUSTOMER_SPRITES: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(LOOKS).flatMap(([type, map]) =>
    ['down', 'up', 'side'].flatMap((dir) =>
      [0, 1].map((f) => [`customer_${type}_${dir}_${f}`, recolor(PLAYER_SPRITES[`player_${dir}_${f}`]!, map)]),
    ),
  ),
);

// face_<type>, 8x8 with its own ink for the notebook: the hat and its brim, the face, the coat.
export const FACE_SPRITES: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(LOOKS).map(([type, map]) => [
    `face_${type}`,
    recolor(['..kkkk..', '.krrrrk.', 'krrrrrrk', '.kssssk.', '.kksskk.', '..kssk..', '.kDwwDk.', 'kDwwwwDk'], map),
  ]),
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
