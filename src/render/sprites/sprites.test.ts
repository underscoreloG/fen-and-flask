import { describe, expect, it } from 'vitest';
import { CROPS, ITEM_IDS, NODES } from '../../data/content';
import { PALETTE } from '../../data/palette';
import { CLEAR, LEGEND } from './format';
import { FONT_CHARS, GLYPHS } from './glyphs';
import { SPRITES } from './index';
import { BACK_WALL } from './interior';

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
    expect(size('cauldron_idle')).toEqual([16, 20]);
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
    for (const k of ['hut', 'bed_empty', 'mortar', 'cauldron_0', 'cauldron_1', 'signpost']) {
      expect(size(`${k}_hl`)).toEqual(size(k));
    }
  });

  it('has the WP02 bed sprout and ready states per crop, with target outlines, and the clock dial', () => {
    const size = (k: string): [number, number] => [SPRITES[k]!.w, SPRITES[k]!.h];
    for (const c of CROPS) {
      for (const st of ['sprout', 'ready']) {
        expect(size(`bed_${st}_${c.item}`)).toEqual([16, 16]);
        expect(size(`bed_${st}_${c.item}_hl`)).toEqual([16, 16]);
      }
    }
    expect(size('clock_dial')).toEqual([8, 8]);
  });

  it('has the customers (3 looks, front, back and side, 2-frame walk) and 4 reaction bubbles, world and icon', () => {
    const size = (k: string): [number, number] => [SPRITES[k]!.w, SPRITES[k]!.h];
    for (const v of [0, 1, 2]) {
      for (const dir of ['down', 'up', 'side']) for (const f of [0, 1]) expect(size(`customer_${v}_${dir}_${f}`)).toEqual([16, 24]);
    }
    // Front and back differ, and a customer never wears the player's coat.
    expect(SPRITES.customer_0_down_0!.rows).not.toEqual(SPRITES.customer_0_up_0!.rows);
    for (const v of [0, 1, 2]) expect(SPRITES[`customer_${v}_down_0`]!.rows.join('')).not.toContain('w');
    expect(size('bubble_wait')).toEqual([12, 14]);
    const fills = new Set<string>();
    for (const r of ['delighted', 'happy', 'grumbling', 'refuses']) {
      expect(size(`bubble_${r}`)).toEqual([12, 12]);
      expect(size(`react_${r}`)).toEqual([8, 8]);
      // The fill is the pixel just inside the left edge of the box.
      fills.add(SPRITES[`bubble_${r}`]!.rows[2]![1]!);
    }
    expect(fills.size).toBe(4);
  });

  it('has the WP06 interior: floor and wall tiles, rug, table, counter with till, sign, cot, with target outlines', () => {
    const size = (k: string): [number, number] => [SPRITES[k]!.w, SPRITES[k]!.h];
    for (const k of ['floor_0', 'floor_1', 'floor_2', 'floor_back_0', 'floor_back_1', 'wall_side_l', 'wall_side_r', 'wall_front']) {
      expect(size(k), k).toEqual([16, 16]);
    }
    for (const k of ['threshold', 'partition', 'partition_door', 'doormat']) expect(size(k), k).toEqual([16, 16]);
    for (const k of BACK_WALL) expect(size(k), k).toEqual([16, 32]);
    expect(BACK_WALL).toHaveLength(22);
    expect(size('rug')).toEqual([48, 32]);
    expect(size('hearth_glow')).toEqual([48, 24]);
    const furniture: [string, number, number][] = [
      ['shelf', 16, 16],
      ['counter', 48, 25],
      ['sign_open', 16, 24],
      ['sign_closed', 16, 24],
      ['cot', 32, 20],
    ];
    for (const [k, w, h] of furniture) {
      expect(size(k), k).toEqual([w, h]);
      expect(size(`${k}_hl`), k).toEqual([w, h]);
      // Ink outline only on the plain one, bone only on the target one.
      expect(SPRITES[k]!.rows.join('').includes('k'), k).toBe(true);
    }
    // The ground never gets an outline.
    expect(SPRITES.floor_0!.rows.join('')).not.toContain('k');
    // Open and closed signs differ at a glance.
    expect(SPRITES.sign_open!.rows).not.toEqual(SPRITES.sign_closed!.rows);
  });

  it('standing interior furniture keeps a 1 px clear margin, so its outline closes all around', () => {
    for (const k of ['shelf', 'counter', 'sign_open', 'sign_closed', 'cot']) {
      for (const name of [k, `${k}_hl`]) {
        const s = SPRITES[name]!;
        const edge = [s.rows[0]!, s.rows[s.h - 1]!, ...s.rows.map((r) => r[0]! + r[s.w - 1]!)].join('');
        expect(edge.replace(/[.bk]/g, ''), name).toBe('');
      }
    }
  });

  it('has the WP07 catalog sprites: stand, stone mortar, crate, the hut with board and lantern, the copper swing', () => {
    const size = (k: string): [number, number] => [SPRITES[k]!.w, SPRITES[k]!.h];
    for (const [k, w, h] of [
      ['catalog', 16, 24],
      ['mortar_stone', 16, 16],
      ['crate', 16, 16],
      ['hut_board', 48, 48],
      ['hut_lantern', 48, 48],
    ] as const) {
      expect(size(k), k).toEqual([w, h]);
      expect(SPRITES[k]!.rows.join('').includes('k'), k).toBe(true);
    }
    for (const k of ['catalog', 'mortar_stone']) expect(size(`${k}_hl`), k).toEqual(size(k));
    // Each reads differently from what it replaces or grows from.
    expect(SPRITES.mortar_stone!.rows).not.toEqual(SPRITES.mortar!.rows);
    expect(SPRITES.hut_board!.rows).not.toEqual(SPRITES.hut!.rows);
    expect(SPRITES.hut_lantern!.rows).not.toEqual(SPRITES.hut_board!.rows);
    for (const dir of ['down', 'up', 'side']) {
      const plain = SPRITES[`player_${dir}_swing`]!;
      const copper = SPRITES[`player_${dir}_swing_copper`]!;
      expect(size(`player_${dir}_swing_copper`)).toEqual([16, 24]);
      expect(plain.rows.join('')).toContain('b');
      expect(copper.rows.join(''), dir).not.toContain('b');
      expect(copper.rows.join('').replace(/e/g, 'b'), dir).toBe(plain.rows.join('').replace(/e/g, 'b'));
    }
  });

  it('the stand, the stone mortar and the crate keep a 1 px clear margin, so their outline closes all around', () => {
    for (const name of ['catalog', 'catalog_hl', 'mortar_stone', 'mortar_stone_hl', 'crate']) {
      const s = SPRITES[name]!;
      const edge = [s.rows[0]!, s.rows[s.h - 1]!, ...s.rows.map((r) => r[0]! + r[s.w - 1]!)].join('');
      expect(edge.replace(/[.bk]/g, ''), name).toBe('');
    }
  });

  it('has the WP08 helper toads: 2-frame idles in green and brown only, outlined all around, and the till flash', () => {
    const size = (k: string): [number, number] => [SPRITES[k]!.w, SPRITES[k]!.h];
    const looks: [string, number, number][] = [
      ['counter', 16, 14],
      ['counter2', 16, 16],
      ['garden', 16, 16],
      ['basket', 26, 16],
      ['basket2', 26, 16],
    ];
    for (const [k, w, h] of looks) {
      const f0 = SPRITES[`toad_${k}_0`]!;
      const f1 = SPRITES[`toad_${k}_1`]!;
      expect(size(`toad_${k}_0`), k).toEqual([w, h]);
      expect(size(`toad_${k}_1`), k).toEqual([w, h]);
      expect(f0.rows, k).not.toEqual(f1.rows);
      for (const s of [f0, f1]) {
        // Ink outline, then moss, grass, grasslight (green) and peat, mud, sand, wood, woodlight (brown).
        expect(s.rows.join('').replace(/[.kmgGpusoO]/g, ''), k).toBe('');
        const edge = [s.rows[0]!, s.rows[s.h - 1]!, ...s.rows.map((r) => r[0]! + r[s.w - 1]!)].join('');
        expect(edge.replace(/[.k]/g, ''), k).toBe('');
        expect(s.rows.join('').includes('k'), k).toBe(true);
      }
    }
    // The trained toad wears a cap; the bigger basket is visibly bigger.
    expect(SPRITES.toad_counter2_0!.rows.join('')).toContain('o');
    expect(SPRITES.toad_counter_0!.rows.join('')).not.toContain('o');
    const wood = (k: string): number => SPRITES[k]!.rows.join('').replace(/[^oO]/g, '').length;
    expect(wood('toad_basket2_0')).toBeGreaterThan(wood('toad_basket_0') * 2);
    expect(size('till_flash')).toEqual([10, 5]);
  });

  it('node and mudlet outlines are complete (their art keeps a 1 px clear margin)', () => {
    for (const [name, s] of Object.entries(SPRITES)) {
      if (!/^(node_|mudlet_)/.test(name)) continue;
      const edge = [s.rows[0]!, s.rows[s.h - 1]!, ...s.rows.map((r) => r[0]! + r[s.w - 1]!)].join('');
      expect(edge.replace(/[.bk]/g, ''), name).toBe('');
    }
  });

  it('the cauldron frames keep a clear bottom row, so the ink outline closes under the base', () => {
    for (const k of ['cauldron_0', 'cauldron_1', 'cauldron_idle']) {
      const s = SPRITES[k]!;
      expect(s.rows[s.h - 1]!.replace(/[.k]/g, ''), k).toBe('');
      expect(s.rows[s.h - 1]!.includes('k'), k).toBe(true);
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
