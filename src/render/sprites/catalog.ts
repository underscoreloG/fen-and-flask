// What the catalog (specs/wp/WP07) adds to the screen: the catalog stand, the stone mortar, the
// painted signboard and its lantern on the hut, the delivery crate, and the copper sickle in the
// player's swing. Drawn without outline; the index adds ink to the ones that stand up.
import { grid, patch, put, rect, toRows } from './format';
import { PLAYER_SPRITES } from './player';
import { STRUCTURE_SPRITES } from './structures';

// Catalog stand 16x24 (footprint 16x16): a lectern with the catalog open on it, a ribbon marker.
function stand(): string[] {
  const g = grid(16, 24);
  // The open book, two pages over the spine, lines of text.
  rect(g, 2, 2, 5, 5, 'b');
  rect(g, 8, 2, 5, 5, 'b');
  rect(g, 7, 2, 1, 5, 'o');
  for (const y of [3, 5]) {
    rect(g, 3, y, 3, 1, 'u');
    rect(g, 9, y, 3, 1, 'u');
  }
  rect(g, 2, 6, 11, 1, 's');
  rect(g, 10, 6, 1, 3, 'e');
  // The slanted top, the post, the foot.
  rect(g, 1, 7, 13, 1, 'o');
  rect(g, 1, 8, 13, 1, 'O');
  rect(g, 2, 9, 11, 1, 'o');
  put(g, 10, 8, 'e');
  rect(g, 6, 10, 3, 10, 'o');
  rect(g, 7, 10, 1, 10, 'O');
  rect(g, 3, 20, 9, 1, 'o');
  rect(g, 2, 21, 11, 1, 'O');
  rect(g, 2, 22, 11, 1, 'p');
  return toRows(g);
}

// The stone mortar: the wooden one's shape cut from pale stone, a darker bowl.
const STONE: Readonly<Record<string, string>> = { o: 's', O: 'b', p: 'u' };
const MORTAR_STONE = STRUCTURE_SPRITES.mortar!.map((r) => r.replace(/[oOp]/g, (c) => STONE[c]!));

// The hut with a painted board on the roof above the awning, then a lantern hung from it.
function board(): string[] {
  const g = grid(20, 8);
  rect(g, 0, 1, 20, 6, 'o');
  rect(g, 1, 2, 18, 4, 'n');
  // A flask painted on it, and a coin.
  rect(g, 4, 3, 3, 2, 'b');
  put(g, 5, 2, 'b');
  rect(g, 9, 3, 7, 1, 'k');
  rect(g, 9, 4, 5, 1, 'k');
  put(g, 16, 4, '$');
  rect(g, 0, 0, 1, 1, 'O');
  rect(g, 19, 0, 1, 1, 'O');
  rect(g, 0, 7, 20, 1, 'p');
  return toRows(g);
}

const LANTERN = ['.o.', 'ooo', 'oEo', 'EEE', 'oeo', '.o.'];

const HUT = STRUCTURE_SPRITES.hut!;
const HUT_BOARD = patch(HUT, 14, 19, board());
const HUT_LANTERN = patch(HUT_BOARD, 34, 22, LANTERN);

// A wooden delivery crate 16x16, bound in iron-dark bands, a bone label.
function crate(): string[] {
  const g = grid(16, 16);
  rect(g, 2, 3, 12, 11, 'O');
  rect(g, 2, 3, 12, 1, 's');
  for (const x of [2, 13]) rect(g, x, 3, 1, 11, 'o');
  rect(g, 2, 7, 12, 1, 'o');
  rect(g, 2, 13, 12, 1, 'p');
  rect(g, 6, 9, 4, 3, 'b');
  rect(g, 7, 10, 2, 1, 'u');
  return toRows(g);
}

// The copper sickle: the swing frames with the bone blade in ember.
const copper = (rows: readonly string[]): string[] => rows.map((r) => r.replace(/b/g, 'e'));

export const CATALOG_STRUCTURES: Record<string, readonly string[]> = {
  catalog: stand(),
  mortar_stone: MORTAR_STONE,
  hut_board: HUT_BOARD,
  hut_lantern: HUT_LANTERN,
};

export const CATALOG_PROPS: Record<string, readonly string[]> = {
  crate: crate(),
};

export const COPPER_SWING: Record<string, readonly string[]> = Object.fromEntries(
  ['down', 'up', 'side'].map((dir) => [`player_${dir}_swing_copper`, copper(PLAYER_SPRITES[`player_${dir}_swing`]!)]),
);
