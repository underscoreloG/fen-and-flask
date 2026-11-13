// The helper toads (specs/wp/WP08): marsh toads in green and brown tokens only (plum stays the
// creatures' color), each with a 2-frame idle (frame 1 blinks and puffs its throat). Drawn without
// outline; the index adds ink. Plus the till's keys lit up, laid over the counter when the counter
// toad rings someone up.
import { grid, put, rect, stamp, toRows, type Grid } from './format';

// A toad sitting, seen from the front, 16x14 with a clear margin all around.
function toad(g: Grid, ox: number, oy: number, blink: boolean): void {
  // Eye bumps and the eyes (closed: a moss line).
  rect(g, ox + 3, oy + 2, 3, 1, 'G');
  rect(g, ox + 10, oy + 2, 3, 1, 'G');
  rect(g, ox + 2, oy + 3, 5, 1, 'g');
  rect(g, ox + 9, oy + 3, 5, 1, 'g');
  put(g, ox + 3, oy + 3, 'G');
  put(g, ox + 10, oy + 3, 'G');
  for (const x of [4, 11]) put(g, ox + x, oy + 3, blink ? 'm' : 'k');
  // Head and body, a moss mouth line, a sand belly, moss feet.
  rect(g, ox + 2, oy + 4, 12, 1, 'g');
  rect(g, ox + 1, oy + 5, 14, 6, 'g');
  put(g, ox + 2, oy + 5, 'G');
  rect(g, ox + 3, oy + 6, 10, 1, 'm');
  rect(g, ox + (blink ? 3 : 4), oy + 7, blink ? 10 : 8, 3, 's');
  if (blink) rect(g, ox + 4, oy + 6, 8, 1, 's');
  for (const x of [1, 13]) put(g, ox + x, oy + 9, 'm');
  rect(g, ox + 1, oy + 10, 4, 1, 'm');
  rect(g, ox + 11, oy + 10, 4, 1, 'm');
  rect(g, ox + 1, oy + 11, 3, 1, 'm');
  rect(g, ox + 12, oy + 11, 3, 1, 'm');
  rect(g, ox + 5, oy + 10, 6, 1, 'p');
}

function plain(blink: boolean): string[] {
  const g = grid(16, 14);
  toad(g, 0, 0, blink);
  return toRows(g);
}

// The trained counter toad: a tiny wooden cap between the eyes (two rows taller for it).
function capped(blink: boolean): string[] {
  const g = grid(16, 16);
  toad(g, 0, 2, blink);
  rect(g, 6, 1, 4, 1, 'o');
  rect(g, 5, 2, 6, 2, 'o');
  put(g, 7, 2, 'O');
  rect(g, 5, 4, 7, 1, 'p');
  return toRows(g);
}

// The garden toad: a sprout on its head.
function sprout(blink: boolean): string[] {
  const g = grid(16, 16);
  toad(g, 0, 2, blink);
  rect(g, 7, 2, 1, 2, 'm');
  stamp(g, 5, 1, ['GG', '.G']);
  stamp(g, 8, 1, ['GG', 'G.']);
  return toRows(g);
}

// A woven basket of herbs beside the toad; the bigger one is wider and taller.
function basket(g: Grid, x: number, y: number, w: number, h: number): void {
  rect(g, x, y, w, h, 'o');
  for (let j = y + 1; j < y + h; j += 2) for (let i = x + ((j - y) % 4 === 1 ? 0 : 1); i < x + w; i += 2) put(g, i, j, 'O');
  rect(g, x, y, w, 1, 'p');
  // Herbs over the rim: a mint leaf, a reed, a glowcap stalk.
  for (let i = x + 1; i < x + w - 1; i += 3) {
    put(g, i, y - 1, 'G');
    put(g, i + 1, y - 2, 'g');
    put(g, i + 1, y - 1, 'm');
  }
}

function withBasket(blink: boolean, big: boolean): string[] {
  const g = grid(26, 16);
  toad(g, 0, 2, blink);
  if (big) basket(g, 14, 5, 11, 10);
  else basket(g, 16, 10, 7, 5);
  return toRows(g);
}

export const TOAD_SPRITES: Record<string, readonly string[]> = Object.fromEntries(
  [0, 1].flatMap((f) => [
    [`toad_counter_${f}`, plain(f === 1)],
    [`toad_counter2_${f}`, capped(f === 1)],
    [`toad_garden_${f}`, sprout(f === 1)],
    [`toad_basket_${f}`, withBasket(f === 1, false)],
    [`toad_basket2_${f}`, withBasket(f === 1, true)],
  ]),
);

// The till's keys (counter sprite pixels 19-28, rows 3-7, see interior.ts) lit coin and emberhot.
export const TILL_KEYS_AT = { x: 19, y: 3 } as const;

export const TILL_FLASH: Record<string, readonly string[]> = {
  till_flash: ['.$E$E$E$E.', 'EEEEEEEEEE', '.E$E$E$E$.', 'EEEEEEEEEE', '..$E$E$E..'],
};
