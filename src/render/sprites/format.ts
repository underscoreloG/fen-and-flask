// Code-drawn sprite format (specs/design.md): one string per pixel row, one char per pixel,
// chars map to palette tokens through LEGEND, '.' is transparent. No Phaser here so tests can load it.
import type { Token } from '../../data/palette';

export const CLEAR = '.';

export const LEGEND: Readonly<Record<string, Token>> = {
  k: 'ink',
  D: 'deepwater',
  w: 'water',
  W: 'waterlight',
  m: 'moss',
  g: 'grass',
  G: 'grasslight',
  p: 'peat',
  u: 'mud',
  s: 'sand',
  r: 'reed',
  o: 'wood',
  O: 'woodlight',
  n: 'mint',
  c: 'glow',
  e: 'ember',
  E: 'emberhot',
  q: 'plum',
  Q: 'plumlight',
  $: 'coin',
  h: 'heart',
  b: 'bone',
  P: 'panel',
  L: 'panellight',
  N: 'night',
};

export interface SpriteDef {
  w: number;
  h: number;
  rows: readonly string[];
}

export function sprite(rows: readonly string[]): SpriteDef {
  return { w: rows[0]?.length ?? 0, h: rows.length, rows };
}

// Paints `ch` on every clear pixel that touches an opaque one (4-neighbour). Used for the ink
// outline of things that stand up, and later for the bone outline of the current target.
export function addOutline(rows: readonly string[], ch: string): string[] {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const at = (x: number, y: number): string => (x < 0 || y < 0 || x >= w || y >= h ? CLEAR : rows[y]![x]!);
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = '';
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      const touches =
        at(x - 1, y) !== CLEAR || at(x + 1, y) !== CLEAR || at(x, y - 1) !== CLEAR || at(x, y + 1) !== CLEAR;
      line += c === CLEAR && touches ? ch : c;
    }
    out.push(line);
  }
  return out;
}

export function flipX(rows: readonly string[]): string[] {
  return rows.map((r) => [...r].reverse().join(''));
}

export function flipY(rows: readonly string[]): string[] {
  return [...rows].reverse();
}

// --- A tiny mutable canvas for the larger, partly procedural sprites ----------

export type Grid = string[][];

export function grid(w: number, h: number, ch: string = CLEAR): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ch));
}

export function put(g: Grid, x: number, y: number, ch: string): void {
  const row = g[y];
  if (row && x >= 0 && x < row.length) row[x] = ch;
}

export function rect(g: Grid, x: number, y: number, w: number, h: number, ch: string): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(g, i, j, ch);
}

// Copies the opaque chars of `src` onto the grid at (x, y).
export function stamp(g: Grid, x: number, y: number, src: readonly string[]): void {
  src.forEach((line, j) => {
    [...line].forEach((ch, i) => {
      if (ch !== CLEAR) put(g, x + i, y + j, ch);
    });
  });
}

export function toRows(g: Grid): string[] {
  return g.map((r) => r.join(''));
}

// Overlays `src` onto a copy of `rows`.
export function patch(rows: readonly string[], x: number, y: number, src: readonly string[]): string[] {
  const g = rows.map((r) => [...r]);
  stamp(g, x, y, src);
  return toRows(g);
}
