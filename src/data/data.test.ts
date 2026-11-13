import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREATURES, CROPS, GRIND_RECIPES, ITEMS, NODES, PLOTS, PLOT_LAYOUTS, SHOP_LAYOUT } from './content';
import { PALETTE, hex } from './palette';
import { ticks, TUNING } from './tuning';

describe('palette', () => {
  it('has exactly the 25 tokens and hex values of specs/design.md', () => {
    const md = readFileSync(new URL('../../specs/design.md', import.meta.url), 'utf8');
    const rows = [...md.matchAll(/^\|\s*([a-z]+)\s*\|\s*#([0-9a-f]{6})\s*\|/gim)].map((m) => [m[1], '#' + m[2]!.toLowerCase()]);
    expect(rows.length).toBe(25);
    expect(Object.keys(PALETTE).length).toBe(25);
    for (const [token, value] of rows) {
      expect(hex(token as keyof typeof PALETTE), token).toBe(value);
    }
  });
});

describe('tuning', () => {
  it('holds the numbers of specs/content.md', () => {
    expect(TUNING.day.length).toBe(240);
    expect(ticks(TUNING.day.length)).toBe(14400);
    expect(TUNING.player.speed).toBe(90);
    expect(TUNING.player.hearts).toBe(5);
    expect(ticks(TUNING.swing.cooldown)).toBe(18);
    expect(ticks(TUNING.hurt.invulnerable)).toBe(60);
    expect(ticks(TUNING.hurt.knockbackTime)).toBe(9);
    expect(ticks(TUNING.mortar.secondsPerUnit)).toBe(90);
    expect(ticks(TUNING.cauldron.secondsPerPotion)).toBe(360);
    expect(TUNING.pickup.magnetRadius).toBe(28);
    expect(TUNING.stall.customersBase).toBe(6);
    expect(TUNING.stall.firstPriceFactor).toBe(0.7);
    expect(TUNING.demand.floor).toBe(0.6);
    expect(TUNING.demand.trendMultiplier).toBe(1.3);
    expect(TUNING.world.roadRow).toBe(13);
  });
});

describe('content', () => {
  it('holds the tables of specs/content.md', () => {
    expect(ITEMS.length).toBe(13);
    expect(PLOTS.find((p) => p.id === 'east')!.price).toBe(150);
    // Potion values from content.md; raw and ground values from specs/wp/WP06.
    expect(Object.fromEntries(ITEMS.map((i) => [i.id, i.value]))).toEqual({
      mint: 2,
      reed: 2,
      bogwood: 1,
      glowcap: 4,
      mudgel: 4,
      emberroot: 12,
      mintpaste: 3,
      glowdust: 6,
      emberpowder: 18,
      tonic: 14,
      salve: 18,
      glowdraught: 24,
      emberelixir: 60,
    });
    const targets = Object.fromEntries(NODES.map((n) => [n.id, n.targets]));
    expect(targets).toEqual({
      mintbush: { home: 6, east: 0 },
      glowcaps: { home: 4, east: 3 },
      reedclump: { home: 6, east: 3 },
      stump: { home: 3, east: 2 },
      emberplant: { home: 0, east: 4 },
    });
    expect(NODES.reduce((sum, n) => sum + n.targets.home, 0)).toBe(19);
    expect(CREATURES[0]!.counts).toEqual({ home: 2, east: 4 });
    expect(CROPS.find((c) => c.item === 'emberroot')).toEqual({ item: 'emberroot', nights: 2, yield: 2 });
    expect(GRIND_RECIPES.length).toBe(3);
  });

  it('lays out the home plot structures', () => {
    const s = PLOT_LAYOUTS.home.structures;
    expect(s.map((x) => x.kind).sort()).toEqual(['bed', 'bed', 'bed', 'bed', 'hut', 'signpost']);
    const hut = s.find((x) => x.kind === 'hut')!;
    expect(hut).toMatchObject({ tiles: { x: 1, y: 1, w: 3, h: 2 }, solid: true, open: [{ x: 2, y: 2 }] });
    expect(hut.interact).toBeUndefined();
    expect(PLOT_LAYOUTS.home.door).toEqual({ tile: { x: 2, y: 2 }, outside: { x: 2, y: 3 } });
    expect(s.find((x) => x.kind === 'signpost')).toMatchObject({ tiles: { x: 19, y: 6 }, interact: { x: 18, y: 6 }, hint: 'BUY PLOT' });
    expect(s.filter((x) => x.kind === 'bed').every((b) => !b.solid && b.hint === 'PLANT' && b.hintReady === 'HARVEST')).toBe(true);
    expect(PLOT_LAYOUTS.home.playerStart).toEqual({ x: 2, y: 4 });
  });

  it('lays out the shop interior of specs/wp/WP06', () => {
    const L = SHOP_LAYOUT;
    expect([L.w, L.h, L.partitionX, L.partitionDoorY]).toEqual([22, 12, 14, 6]);
    expect([L.entry, L.exit]).toEqual([
      { x: 7, y: 10 },
      { x: 7, y: 11 },
    ]);
    expect(L.queue).toEqual([
      { x: 3, y: 9 },
      { x: 4, y: 9 },
    ]);
    const at = (id: string) => L.structures.find((x) => x.id === id)!;
    for (const [i, x] of [3, 6, 9, 12].entries()) {
      expect(at('shelf' + i)).toMatchObject({ kind: 'shelf', tiles: { x, y: 4, w: 1, h: 1 }, solid: true, interact: { x, y: 5 }, hint: 'SHELF' });
    }
    expect(at('counter')).toMatchObject({ tiles: { x: 2, y: 8, w: 3, h: 1 }, solid: true, interact: { x: 3, y: 7 } });
    expect(at('sign')).toMatchObject({ tiles: { x: 9, y: 10, w: 1, h: 1 }, solid: true, interact: { x: 9, y: 9 } });
    expect(at('mortar')).toMatchObject({ tiles: { x: 16, y: 3 }, solid: true, interact: { x: 16, y: 4 }, hint: 'GRIND' });
    expect(at('cauldron')).toMatchObject({ tiles: { x: 18, y: 3 }, solid: true, interact: { x: 18, y: 4 }, hint: 'BREW' });
    expect(at('cot')).toMatchObject({ tiles: { x: 19, y: 9, w: 2, h: 1 }, solid: true, interact: { x: 18, y: 9 }, hint: 'SLEEP' });
    expect(TUNING.shop).toMatchObject({ shelfCapacity: 5, maxIndoors: 2, customerSpeed: 40 });
    expect([ticks(TUNING.shop.enterGap), ticks(TUNING.shop.patience), ticks(TUNING.stall.reactionTime)]).toEqual([150, 1800, 48]);
  });
});
