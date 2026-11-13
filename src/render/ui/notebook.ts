// Notebook (specs/design.md Screens), opened with V / pad Y from the world: page 1 the grind and
// brew recipes, page 2 the prices. Left/right turns the page; back or V again closes it.
import type Phaser from 'phaser';
import type { GameState } from '../../core/state';
import { BREW_RECIPES, CAULDRON_FUEL, GRIND_RECIPES, ITEMS, type ItemId } from '../../data/content';
import type { Token } from '../../data/palette';
import { TUNING } from '../../data/tuning';
import { addText } from '../font';
import { ATLAS } from '../sprites/generate';
import { panelBox, UI_DEPTH, type Panel } from './confirm';

const K = TUNING.panel;
const R = TUNING.render;
const ICON = 8;
const CHAR_W = R.fontCellW;
const CHAR_H = R.fontCellH;

// A line is laid out left to right, K.iconGap between parts.
export type NotePart = { icon: string } | { text: string; token?: Token };
export type NoteLine = readonly NotePart[];

const itemName = (id: ItemId): string => ITEMS.find((i) => i.id === id)?.name ?? id;
const icon = (id: ItemId): NotePart => ({ icon: `icon_${id}` });

function recipesPage(): NoteLine[] {
  const fuel = TUNING.cauldron.fuelPerJob;
  return [
    [{ text: 'GRIND', token: 'coin' }],
    ...GRIND_RECIPES.map((r) => [icon(r.input), { text: itemName(r.input) }, { text: '=' }, icon(r.output), { text: itemName(r.output) }]),
    [{ text: 'BREW', token: 'coin' }, { text: `+${fuel}` }, icon(CAULDRON_FUEL), { text: 'A BATCH' }],
    ...BREW_RECIPES.map((r) => [
      ...r.ingredients.flatMap((ing, i) => [...(i > 0 ? [{ text: '+' }] : []), icon(ing.item)]),
      { text: '=' },
      icon(r.potion),
      { text: itemName(r.potion) },
    ]),
  ];
}

// Page 2. WP04 replaces this body with the price history and today's trend.
export function pricesPage(_state: GameState): NoteLine[] {
  return [[{ text: 'PRICES: AFTER YOUR FIRST SALE' }]];
}

const partW = (p: NotePart): number => ('icon' in p ? ICON : p.text.length * CHAR_W);
const lineW = (l: NoteLine): number => l.reduce((a, p, i) => a + partW(p) + (i > 0 ? K.iconGap : 0), 0);

export function notebook(scene: Phaser.Scene, state: GameState): Panel {
  const pages = [recipesPage(), pricesPage(state)];
  const title = (i: number): string => `NOTEBOOK ${i + 1}/${pages.length}`;
  // One box size for every page, so turning a page does not make it jump.
  const inner = Math.max(title(0).length * CHAR_W, ...pages.flat().map(lineW));
  const w = Math.min(K.maxW, inner + K.padX * 2);
  const h = K.padY * 2 + CHAR_H + K.titleGap + Math.max(...pages.map((p) => p.length)) * K.rowH;
  const x0 = Math.round((R.viewW - w) / 2);
  const y0 = Math.round((R.viewH - h) / 2);
  const box = panelBox(scene, x0, y0, w, h);
  let parts: Phaser.GameObjects.GameObject[] = [];
  let page = 0;

  const draw = (): void => {
    for (const p of parts) p.destroy();
    parts = [addText(scene, x0 + K.padX, y0 + K.padY, title(page), 'coin').setDepth(UI_DEPTH.panel)];
    const textDy = Math.floor((K.rowH - CHAR_H) / 2) + 1;
    pages[page]!.forEach((line, j) => {
      const y = y0 + K.padY + CHAR_H + K.titleGap + j * K.rowH;
      let x = x0 + K.padX;
      for (const p of line) {
        if ('icon' in p) parts.push(scene.add.image(x, y + K.rowH / 2, ATLAS, p.icon).setOrigin(0, 0.5).setDepth(UI_DEPTH.panel));
        else parts.push(addText(scene, x, y + textDy, p.text, p.token ?? 'bone').setDepth(UI_DEPTH.panel));
        x += partW(p) + K.iconGap;
      }
    });
  };
  draw();

  return {
    update(intents) {
      if (intents.back || intents.notebook) return [];
      if (intents.left || intents.right) {
        page = (page + (intents.right ? 1 : -1) + pages.length) % pages.length;
        draw();
      }
      return null;
    },
    destroy: () => {
      for (const p of parts) p.destroy();
      box.destroy();
    },
  };
}
