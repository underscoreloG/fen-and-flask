import { describe, expect, it } from 'vitest';
import { ITEM_IDS, NODES } from '../../data/content';
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

  it('has the WP01 nodes, mudlet, icons and their target outlines', () => {
    const size = (k: string): [number, number] => [SPRITES[k]!.w, SPRITES[k]!.h];
    for (const n of NODES) {
      expect(size(`node_${n.id}`)).toEqual([16, 16]);
      expect(size(`node_${n.id}_hl`)).toEqual([16, 16]);
    }
    for (const f of ['mudlet_0', 'mudlet_1', 'mudlet_0_hl', 'mudlet_1_hl']) expect(size(f)).toEqual([16, 12]);
    for (const id of ITEM_IDS) expect(size(`icon_${id}`)).toEqual([8, 8]);
    for (const k of ['heart', 'heart_empty', 'coin']) expect(size(k)).toEqual([8, 8]);
    for (const k of ['hut', 'bed_empty', 'mortar', 'cauldron_0', 'cauldron_1', 'stall', 'signpost']) {
      expect(size(`${k}_hl`)).toEqual(size(k));
    }
  });

  it('node and mudlet outlines are complete (their art keeps a 1 px clear margin)', () => {
    for (const [name, s] of Object.entries(SPRITES)) {
      if (!/^(node_|mudlet_)/.test(name)) continue;
      const edge = [s.rows[0]!, s.rows[s.h - 1]!, ...s.rows.map((r) => r[0]! + r[s.w - 1]!)].join('');
      expect(edge.replace(/[.bk]/g, ''), name).toBe('');
    }
  });

  it('creatures are the only plum things', () => {
    for (const [name, s] of Object.entries(SPRITES)) {
      if (name.startsWith('mudlet_')) continue;
      expect(s.rows.join('').includes('q'), name).toBe(false);
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
