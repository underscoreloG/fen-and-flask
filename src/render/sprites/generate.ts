// Packs every code-drawn sprite into one canvas texture (one atlas = one WebGL batch).
import type Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { TUNING } from '../../data/tuning';
import { CLEAR, LEGEND, type SpriteDef } from './format';
import { SPRITES } from './index';

export const ATLAS = 'atlas';

interface Placed {
  name: string;
  def: SpriteDef;
  x: number;
  y: number;
}

// Shelf packing, tallest first; a clear gutter between frames keeps NEAREST sampling clean.
function pack(sprites: Readonly<Record<string, SpriteDef>>): { placed: Placed[]; w: number; h: number } {
  const pad = TUNING.render.atlasPadding;
  const w = TUNING.render.atlasWidth;
  const entries = Object.entries(sprites).sort((a, b) => b[1].h - a[1].h);
  const placed: Placed[] = [];
  let x = pad;
  let y = pad;
  let shelf = 0;
  for (const [name, def] of entries) {
    if (x + def.w + pad > w) {
      x = pad;
      y += shelf + pad;
      shelf = 0;
    }
    placed.push({ name, def, x, y });
    x += def.w + pad;
    shelf = Math.max(shelf, def.h);
  }
  return { placed, w, h: y + shelf + pad };
}

export function writePixels(
  data: Uint8ClampedArray,
  stride: number,
  ox: number,
  oy: number,
  rows: readonly string[],
): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === CLEAR) continue;
      const token = LEGEND[ch];
      if (!token) continue;
      const c = PALETTE[token];
      const i = ((oy + y) * stride + ox + x) * 4;
      data[i] = (c >> 16) & 0xff;
      data[i + 1] = (c >> 8) & 0xff;
      data[i + 2] = c & 0xff;
      data[i + 3] = 0xff;
    }
  });
}

export function buildAtlas(scene: Phaser.Scene): void {
  const { placed, w, h } = pack(SPRITES);
  const tex = scene.textures.createCanvas(ATLAS, w, h);
  if (!tex) throw new Error('atlas texture could not be created');
  const ctx = tex.getContext();
  const img = ctx.createImageData(w, h);
  for (const p of placed) {
    writePixels(img.data, w, p.x, p.y, p.def.rows);
  }
  ctx.putImageData(img, 0, 0);
  for (const p of placed) tex.add(p.name, 0, p.x, p.y, p.def.w, p.def.h);
  tex.refresh();
}
