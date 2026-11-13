// Notebook (specs/design.md Screens), opened with V / pad Y from the world: page 1 the grind and
// brew recipes, page 2 the prices and today's order, page 3 the customer types met (specs/wp/WP09).
// Left/right turns the page; back or V again closes it.
import type Phaser from 'phaser';
import { POTION_IDS } from '../../core/shop';
import type { GameState } from '../../core/state';
import { BREW_RECIPES, CAULDRON_FUEL, CUSTOMER_TYPES, GRIND_RECIPES, ITEMS, type ItemId } from '../../data/content';
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

// Page 2: per potion owned or ever offered, its last prices with the reaction each got, then
// today's trend ("-" on day 1) and today's order.
export function pricesPage(state: GameState): NoteLine[] {
  const st = state.shop;
  const shown = POTION_IDS.filter((p) => state.inventory[p] > 0 || st.history[p].length > 0);
  const lines: NoteLine[] = [[{ text: 'PRICES', token: 'coin' }]];
  if (shown.length === 0) lines.push([{ text: 'NO POTIONS YET' }]);
  for (const p of shown) {
    const h = st.history[p];
    const entries: NotePart[] = h.flatMap((e) => [{ text: String(e.price), token: 'coin' as const }, { icon: `react_${e.reaction}` }]);
    lines.push([icon(p), { text: itemName(p) }, ...(entries.length > 0 ? entries : [{ text: '-' }])]);
  }
  const trend: NotePart[] = st.trend ? [icon(st.trend), { text: itemName(st.trend) }] : [{ text: '-' }];
  lines.push([{ text: 'IN DEMAND TODAY:', token: 'coin' }, ...trend]);
  const o = state.order;
  const order: NotePart[] = o.done
    ? [{ text: 'DONE' }]
    : [{ text: String(o.qty) }, icon(o.item), { text: itemName(o.item) }, { text: 'FOR' }, { text: String(o.pay), token: 'coin' }];
  lines.push([{ text: 'ORDER:', token: 'coin' }, ...order]);
  return lines;
}

// Page 3: each customer type that has paid at least once, its look and name, its trait below.
export function customersPage(state: GameState): NoteLine[] {
  const met = CUSTOMER_TYPES.filter((t) => state.shop.met.includes(t.id));
  const lines: NoteLine[] = [[{ text: 'CUSTOMERS', token: 'coin' }]];
  if (met.length === 0) lines.push([{ text: 'NONE MET YET' }]);
  for (const t of met) lines.push([{ icon: `face_${t.id}` }, { text: t.name }], [{ text: `  ${t.trait}` }]);
  return lines;
}

const partW = (p: NotePart): number => ('icon' in p ? ICON : p.text.length * CHAR_W);
const lineW = (l: NoteLine): number => l.reduce((a, p, i) => a + partW(p) + (i > 0 ? K.iconGap : 0), 0);

export function notebook(scene: Phaser.Scene, state: GameState): Panel {
  const pages = [recipesPage(), pricesPage(state), customersPage(state)];
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
