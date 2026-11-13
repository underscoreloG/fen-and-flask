// Shelf panel (specs/wp/WP06): an empty shelf lists what you own (potions, then ground, then raw);
// picking one shows QTY and PRICE fields (up/down picks a field, left/right changes it). A stocked
// shelf opens on its PRICE, with ADD MORE (when you own more and there is room) and TAKE BACK.
// Under the fields, what the last customers thought of that price. The panel pauses the sim like
// every panel; its commands reach the first tick after it closes.
import type Phaser from 'phaser';
import type { Command } from '../../core/commands';
import type { GameState } from '../../core/state';
import { ITEMS, type ItemId, type ItemKind } from '../../data/content';
import type { Token } from '../../data/palette';
import { PALETTE } from '../../data/palette';
import { TUNING } from '../../data/tuning';
import type { Device, UiIntents } from '../../input/input';
import { addText } from '../font';
import { ATLAS } from '../sprites/generate';
import { ListPanel, panelBox, UI_DEPTH, type Panel, type PanelRow } from './confirm';

const K = TUNING.panel;
const R = TUNING.render;
const SP = TUNING.shelfPanel;
const ICON = 8;
const CHAR_W = R.fontCellW;
const CHAR_H = R.fontCellH;
const TEXT_DY = Math.floor((K.rowH - CHAR_H) / 2) + 1;
const CAP = TUNING.shop.shelfCapacity;
const KEYS: Record<Device, { ok: string; back: string }> = { keyboard: { ok: 'C', back: 'X' }, gamepad: { ok: 'A', back: 'B' } };
const KIND_ORDER: readonly ItemKind[] = ['potion', 'ground', 'raw', 'fuel'];

const itemName = (id: ItemId): string => ITEMS.find((i) => i.id === id)?.name ?? id;

type Cell = { icon: string } | { text: string; token?: Token };

interface Line {
  left: readonly Cell[];
  right?: readonly Cell[];
  // A field the cursor can sit on.
  field?: boolean;
}

const cellW = (c: Cell): number => ('icon' in c ? ICON : c.text.length * CHAR_W);
const cellsW = (cs: readonly Cell[]): number => cs.reduce((a, c, i) => a + cellW(c) + (i > 0 ? K.iconGap : 0), 0);

// Draws a titled box of lines (the cursor on the `selected`-th field) and a footer; returns its parts.
function sheet(scene: Phaser.Scene, title: string, lines: readonly Line[], selected: number, footer: string): Phaser.GameObjects.GameObject[] {
  const inner = Math.max(
    title.length * CHAR_W,
    footer.length * CHAR_W,
    ...lines.map((l) => cellsW(l.left) + (l.right ? SP.historyGap + cellsW(l.right) : 0)),
  );
  const w = Math.min(K.maxW, inner + K.padX * 2);
  const h = K.padY * 2 + CHAR_H + K.titleGap + lines.length * K.rowH + K.footerGap + CHAR_H;
  const x0 = Math.round((R.viewW - w) / 2);
  const y0 = Math.round((R.viewH - h) / 2);
  const top = y0 + K.padY + CHAR_H + K.titleGap;
  const parts: Phaser.GameObjects.GameObject[] = [panelBox(scene, x0, y0, w, h)];
  let f = -1;
  lines.forEach((l, i) => {
    if (!l.field) return;
    f += 1;
    if (f !== selected) return;
    parts.push(scene.add.graphics().setDepth(UI_DEPTH.panel).fillStyle(PALETTE.panellight, 1).fillRect(x0 + 1, top + i * K.rowH, w - 2, K.rowH));
  });
  parts.push(addText(scene, x0 + K.padX, y0 + K.padY, title, 'coin').setDepth(UI_DEPTH.panel));
  const put = (cells: readonly Cell[], x: number, y: number): void => {
    for (const c of cells) {
      if ('icon' in c) parts.push(scene.add.image(x, y + K.rowH / 2, ATLAS, c.icon).setOrigin(0, 0.5).setDepth(UI_DEPTH.panel));
      else parts.push(addText(scene, x, y + TEXT_DY, c.text, c.token ?? 'bone').setDepth(UI_DEPTH.panel));
      x += cellW(c) + K.iconGap;
    }
  };
  lines.forEach((l, i) => {
    const y = top + i * K.rowH;
    put(l.left, x0 + K.padX, y);
    if (l.right) put(l.right, x0 + w - K.padX - cellsW(l.right), y);
  });
  parts.push(addText(scene, x0 + K.padX, top + lines.length * K.rowH + K.footerGap, footer, 'bone').setDepth(UI_DEPTH.panel));
  return parts;
}

// A field's label padded to one column, then "- value +".
const fieldCells = (label: string, value: number | null, coin = false): Cell[] => [
  { text: label.padEnd(SP.labelChars) },
  ...(value === null ? [] : [{ text: `- ${value} +` }, ...(coin ? [{ icon: 'coin' }] : [])]),
];

function historyLine(state: GameState, item: ItemId): Line {
  const h = state.shop.history[item];
  const entries: Cell[] = h.flatMap((e) => [{ text: String(e.price), token: 'coin' as const }, { icon: `react_${e.reaction}` }]);
  return { left: [{ text: 'LAST' }, ...(entries.length > 0 ? entries : [{ text: '-' }])] };
}

// The price being edited: step 1, never below the minimum.
const nudge = (price: number, d: number): number => Math.max(TUNING.stall.priceMin, price + d * TUNING.stall.priceStep);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// Fields over one item: the caller says which fields there are and what confirm sends.
interface FieldSpec {
  label: string;
  get(): number | null;
  set?(d: number): void;
  coin?: boolean;
}

class Fields {
  selected = 0;
  private parts: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly title: string,
    private readonly header: Line,
    private readonly fields: readonly FieldSpec[],
    private readonly history: Line,
    private readonly footer: string,
    start = 0,
  ) {
    this.selected = start;
    this.draw();
  }

  // Up/down pick a field (wrapping), left/right change it.
  update(intents: UiIntents): void {
    const n = this.fields.length;
    let changed = false;
    if (intents.up || intents.down) {
      this.selected = (this.selected + (intents.down ? 1 : -1) + n) % n;
      changed = true;
    }
    const d = (intents.right ? 1 : 0) - (intents.left ? 1 : 0);
    const f = this.fields[this.selected];
    if (d !== 0 && f?.set) {
      f.set(d);
      changed = true;
    }
    if (changed) this.draw();
  }

  destroy(): void {
    for (const p of this.parts) p.destroy();
    this.parts = [];
  }

  private draw(): void {
    this.destroy();
    const lines: Line[] = [this.header, ...this.fields.map((f) => ({ left: fieldCells(f.label, f.get(), f.coin), field: true })), this.history];
    this.parts = sheet(this.scene, this.title, lines, this.selected, this.footer);
  }
}

export function shelfPanel(scene: Phaser.Scene, state: GameState, shelf: number, device: Device): Panel {
  const k = KEYS[device];
  const title = `SHELF ${shelf + 1}`;
  const sl = state.shop.shelves[shelf]!;
  const owned = (id: ItemId): number => state.inventory[id];
  const header = (item: ItemId, extra: string): Line => ({ left: [{ icon: `icon_${item}` }, { text: itemName(item) }], right: [{ text: extra }] });

  // A stocked shelf: PRICE, then ADD MORE if possible, then TAKE BACK.
  if (sl.item !== null) {
    const item = sl.item;
    let price = state.shop.prices[item];
    const room = Math.min(CAP - sl.count, owned(item));
    let add = room;
    const specs: FieldSpec[] = [{ label: 'PRICE', get: () => price, set: (d) => (price = nudge(price, d)), coin: true }];
    if (room > 0) specs.push({ label: 'ADD MORE', get: () => add, set: (d) => (add = clamp(add + d, 1, room)) });
    specs.push({ label: 'TAKE BACK', get: () => null });
    const view = new Fields(scene, title, header(item, `X${sl.count}`), specs, historyLine(state, item), `${k.ok} OK   ${k.back} BACK`);
    const setPrice = (): Command => ({ type: 'SetPrice', item, price });
    return {
      update(intents) {
        if (intents.back) return [setPrice()];
        if (intents.confirm) {
          const label = specs[view.selected]!.label;
          if (label === 'ADD MORE') return [setPrice(), { type: 'StockShelf', shelf, item, qty: add }];
          if (label === 'TAKE BACK') return [setPrice(), { type: 'ClearShelf', shelf }];
          return [setPrice()];
        }
        view.update(intents);
        return null;
      },
      destroy: () => view.destroy(),
    };
  }

  // An empty shelf: what you own, best first; picking one opens its QTY and PRICE.
  const items = KIND_ORDER.flatMap((kind) => ITEMS.filter((i) => i.kind === kind && owned(i.id) > 0).map((i) => i.id));
  const rows: PanelRow[] = items.length
    ? items.map((id) => ({ label: itemName(id), icon: `icon_${id}`, count: owned(id) }))
    : [{ label: 'NOTHING TO SHELVE', dim: true }];
  let list: ListPanel | null = null;
  let fields: { view: Fields; item: ItemId; qty: () => number; price: () => number } | null = null;
  let picked = 0;

  const openList = (): void => {
    list = new ListPanel(scene, title, rows);
    list.selected = picked;
  };
  const openFields = (item: ItemId): void => {
    let qty = Math.min(CAP, owned(item));
    let price = state.shop.prices[item];
    const specs: FieldSpec[] = [
      { label: 'QTY', get: () => qty, set: (d) => (qty = clamp(qty + d, 1, Math.min(CAP, owned(item)))) },
      { label: 'PRICE', get: () => price, set: (d) => (price = nudge(price, d)), coin: true },
    ];
    const view = new Fields(scene, title, header(item, `OWN ${owned(item)}`), specs, historyLine(state, item), `${k.ok} STOCK   ${k.back} BACK`);
    fields = { view, item, qty: () => qty, price: () => price };
  };
  openList();

  return {
    update(intents) {
      if (fields) {
        const f = fields;
        if (intents.back) {
          f.view.destroy();
          fields = null;
          openList();
          return null;
        }
        if (intents.confirm) {
          return [
            { type: 'StockShelf', shelf, item: f.item, qty: f.qty() },
            { type: 'SetPrice', item: f.item, price: f.price() },
          ];
        }
        f.view.update(intents);
        return null;
      }
      const r = list!.update(intents);
      if (r === 'back' || (intents.confirm && items.length === 0)) return [];
      if (r === 'confirm') {
        picked = list!.selected;
        list!.destroy();
        list = null;
        openFields(items[picked]!);
      }
      return null;
    },
    destroy: () => {
      list?.destroy();
      fields?.view.destroy();
    },
  };
}

export function shopSummary(scene: Phaser.Scene, soldCount: number, soldCoins: number): Panel {
  const what = soldCount === 1 ? 'POTION' : 'POTIONS';
  const list = new ListPanel(scene, `SOLD ${soldCount} ${what} FOR ${soldCoins} COINS`, [{ label: 'OK' }]);
  return {
    update: (intents) => (list.update(intents) !== null ? [] : null),
    destroy: () => list.destroy(),
  };
}
