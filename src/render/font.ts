// Code-defined bitmap font (5x7 glyphs in 6x8 cells), built into a texture at boot.
// Glyphs are drawn once in bone; addText fill-tints them to any palette token.
import Phaser from 'phaser';
import { PALETTE, type Token } from '../data/palette';
import { TUNING } from '../data/tuning';
import { FONT_CHARS, GLYPHS } from './sprites/glyphs';
import { writePixels } from './sprites/generate';

export const FONT = 'font';

const CELL_W = TUNING.render.fontCellW;
const CELL_H = TUNING.render.fontCellH;
const PER_ROW = 16;

export function buildFont(scene: Phaser.Scene): void {
  const chars = [...FONT_CHARS];
  const w = CELL_W * PER_ROW;
  const h = CELL_H * Math.ceil(chars.length / PER_ROW);
  const tex = scene.textures.createCanvas(FONT, w, h);
  if (!tex) throw new Error('font texture could not be created');
  const ctx = tex.getContext();
  const img = ctx.createImageData(w, h);
  chars.forEach((ch, i) => {
    const rows = (GLYPHS[ch] ?? []).map((r) => r.replaceAll('#', 'b'));
    writePixels(img.data, w, (i % PER_ROW) * CELL_W, Math.floor(i / PER_ROW) * CELL_H, rows);
  });
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  const parsed = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: FONT,
    width: CELL_W,
    height: CELL_H,
    chars: FONT_CHARS,
    charsPerRow: PER_ROW,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 0,
  });
  scene.cache.bitmapFont.add(FONT, parsed);
}

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  token: Token = 'bone',
): Phaser.GameObjects.BitmapText {
  return scene.add.bitmapText(x, y, FONT, text.toUpperCase()).setTintFill(PALETTE[token]);
}
