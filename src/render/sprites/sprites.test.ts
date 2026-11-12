import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../data/palette';
import { CLEAR, LEGEND } from './format';
import { FONT_CHARS, GLYPHS } from './glyphs';
import { SPRITES } from './index';

describe('sprites', () => {
  it('every row matches the sprite width and uses only legend chars', () => {
    for (const [name, s] of Object.entries(SPRITES)) {
      expect(s.rows.length, name).toBe(s.h);
      s.rows.forEach((r, y) => {
        expect(r.length, `${name} row ${y}`).toBe(s.w);
        for (const ch of r) expect(ch === CLEAR || ch in LEGEND, `${name} row ${y} char ${ch}`).toBe(true);
      });
    }
  });

  it('legend maps to palette tokens', () => {
    for (const token of Object.values(LEGEND)) expect(token in PALETTE).toBe(true);
  });

  it('has the sizes of the design sprite list', () => {
    const size = (k: string): [number, number] => [SPRITES[k]!.w, SPRITES[k]!.h];
    for (const dir of ['down', 'up', 'side']) {
      for (const f of ['0', '1', 'swing']) expect(size(`player_${dir}_${f}`)).toEqual([16, 24]);
    }
    expect(size('hut')).toEqual([48, 48]);
    expect(size('mortar')).toEqual([16, 16]);
    expect(size('cauldron_0')).toEqual([16, 20]);
    expect(size('cauldron_1')).toEqual([16, 20]);
    expect(size('stall')).toEqual([48, 32]);
    expect(size('signpost')).toEqual([16, 24]);
    expect(size('bed_empty')).toEqual([16, 16]);
    for (const t of ['grass_0', 'grass_1', 'grass_2', 'road_0', 'water_0', 'water_1', 'shore_top', 'bank_front']) {
      expect(size(t)).toEqual([16, 16]);
    }
  });

  it('font covers the design glyph set in 5x7', () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?-+/()'%&= ") expect(FONT_CHARS).toContain(ch);
    for (const g of Object.values(GLYPHS)) {
      expect(g.length).toBe(7);
      for (const r of g) expect(r.length).toBe(5);
    }
  });
});
