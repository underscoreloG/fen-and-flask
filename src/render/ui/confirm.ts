// The shared panel helper (ListPanel, Panel) and the yes/no confirm built on it.
// Panels read UI intents only, never the sim Frame; the UIScene host pauses the sim while one
// is open and sends the commands a panel returns on the first tick after it closes.
import Phaser from 'phaser';
import type { Command } from '../../core/commands';
import { PALETTE } from '../../data/palette';
import { TUNING } from '../../data/tuning';
import type { UiIntents } from '../../input/input';
import { addText } from '../font';
import { ATLAS } from '../sprites/generate';

const K = TUNING.panel;
const R = TUNING.render;
const ICON = 8;
const CHAR_W = R.fontCellW;
const CHAR_H = R.fontCellH;

// Layers inside UIScene: the evening tint under the HUD, panels over it, the night fade on top.
export const UI_DEPTH = { tint: -1, panel: 10, overlay: 20 } as const;

export interface PanelRow {
  label: string;
  // Atlas frame of an 8x8 icon.
  icon?: string;
  // Right-aligned number (an owned count).
  count?: number;
  // Right-aligned icon + count pairs (recipe ingredients with owned counts), after `count`.
  extras?: readonly { icon: string; count: number }[];
  // Shown faded; confirm does nothing on it.
  dim?: boolean;
}

// What the UIScene host runs: update returns null while the panel stays open, or the commands
// to send as it closes ([] for no / back).
export interface Panel {
  update(intents: UiIntents): Command[] | null;
  destroy(): void;
}

// The shared panel box: `panel` fill, `panellight` border.
export function panelBox(scene: Phaser.Scene, x0: number, y0: number, w: number, h: number): Phaser.GameObjects.Graphics {
  const box = scene.add.graphics().setDepth(UI_DEPTH.panel);
  box.fillStyle(PALETTE.panel, 1).fillRect(x0, y0, w, h);
  box.lineStyle(1, PALETTE.panellight, 1).strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
  return box;
}

// Width of an icon + count pair: icon, 1 px, digits.
const pairW = (count: number): number => ICON + 1 + String(count).length * CHAR_W;

// A `panel` box with an optional title and selectable rows, centered on x, its middle at cy.
// Up/down move the cursor (wrapping); confirm on a row that is not dim gives 'confirm', back gives 'back'.
// An optional footer is one text line under the rows that the owner rewrites with setFooter
// (the station quantity); its initial text sets the width it may take.
export class ListPanel {
  selected = 0;
  private readonly rows: readonly PanelRow[];
  private readonly parts: Phaser.GameObjects.GameObject[] = [];
  private readonly cursor: Phaser.GameObjects.Graphics;
  private readonly x0: number;
  private readonly w: number;
  private readonly rowsTop: number;
  private readonly footerText: Phaser.GameObjects.BitmapText | null = null;

  constructor(
    scene: Phaser.Scene,
    title: string | null,
    rows: readonly PanelRow[],
    cy: number = R.viewH / 2,
    footer: string | null = null,
  ) {
    this.rows = rows;
    const extrasW = (r: PanelRow): number => (r.extras ?? []).reduce((a, e) => a + K.countGap + pairW(e.count), 0);
    const rowW = (r: PanelRow): number =>
      (r.icon ? ICON + K.iconGap : 0) +
      r.label.length * CHAR_W +
      (r.count !== undefined ? K.countGap + String(r.count).length * CHAR_W : 0) +
      extrasW(r);
    const inner = Math.max(title ? title.length * CHAR_W : 0, footer !== null ? footer.length * CHAR_W : 0, ...rows.map(rowW));
    this.w = Math.min(K.maxW, inner + K.padX * 2);
    const titleH = title ? CHAR_H + K.titleGap : 0;
    const footerH = footer !== null ? K.footerGap + CHAR_H : 0;
    const h = K.padY * 2 + titleH + rows.length * K.rowH + footerH;
    this.x0 = Math.round((R.viewW - this.w) / 2);
    const y0 = Math.round(cy - h / 2);
    this.rowsTop = y0 + K.padY + titleH;

    this.parts.push(panelBox(scene, this.x0, y0, this.w, h));
    this.cursor = scene.add.graphics().setDepth(UI_DEPTH.panel);
    this.parts.push(this.cursor);
    if (title) this.parts.push(addText(scene, this.x0 + K.padX, y0 + K.padY, title, 'coin').setDepth(UI_DEPTH.panel));

    const textDy = Math.floor((K.rowH - CHAR_H) / 2) + 1;
    rows.forEach((r, i) => {
      const y = this.rowsTop + i * K.rowH;
      const alpha = r.dim ? K.dimAlpha : 1;
      let x = this.x0 + K.padX;
      if (r.icon) {
        this.parts.push(scene.add.image(x, y + K.rowH / 2, ATLAS, r.icon).setOrigin(0, 0.5).setAlpha(alpha).setDepth(UI_DEPTH.panel));
        x += ICON + K.iconGap;
      }
      this.parts.push(addText(scene, x, y + textDy, r.label, 'bone').setAlpha(alpha).setDepth(UI_DEPTH.panel));
      // Right-aligned, drawn from the right edge inward: extras last to first, then count.
      let right = this.x0 + this.w - K.padX;
      for (const e of [...(r.extras ?? [])].reverse()) {
        const t = addText(scene, right, y + textDy, String(e.count), 'bone').setOrigin(1, 0);
        this.parts.push(t.setAlpha(alpha).setDepth(UI_DEPTH.panel));
        const ix = right - pairW(e.count);
        this.parts.push(scene.add.image(ix, y + K.rowH / 2, ATLAS, e.icon).setOrigin(0, 0.5).setAlpha(alpha).setDepth(UI_DEPTH.panel));
        right = ix - K.countGap;
      }
      if (r.count !== undefined) {
        const t = addText(scene, right, y + textDy, String(r.count), 'bone');
        this.parts.push(t.setOrigin(1, 0).setAlpha(alpha).setDepth(UI_DEPTH.panel));
      }
    });
    if (footer !== null) {
      const fy = this.rowsTop + rows.length * K.rowH + K.footerGap;
      this.footerText = addText(scene, this.x0 + K.padX, fy, footer, 'bone').setDepth(UI_DEPTH.panel);
      this.parts.push(this.footerText);
    }
    this.drawCursor();
  }

  setFooter(text: string): void {
    this.footerText?.setText(text.toUpperCase());
  }

  update(intents: UiIntents): 'confirm' | 'back' | null {
    if (intents.back) return 'back';
    const n = this.rows.length;
    if (n > 0 && (intents.up || intents.down)) {
      this.selected = (this.selected + (intents.down ? 1 : -1) + n) % n;
      this.drawCursor();
    }
    if (intents.confirm && this.rows[this.selected] && !this.rows[this.selected]!.dim) return 'confirm';
    return null;
  }

  destroy(): void {
    for (const p of this.parts) p.destroy();
  }

  // Row under a point in view pixels, or null (mouse clicks on the title menu).
  rowAt(x: number, y: number): number | null {
    if (x < this.x0 || x >= this.x0 + this.w) return null;
    const i = Math.floor((y - this.rowsTop) / K.rowH);
    return i >= 0 && i < this.rows.length ? i : null;
  }

  private drawCursor(): void {
    this.cursor.clear();
    if (this.rows.length === 0) return;
    this.cursor.fillStyle(PALETTE.panellight, 1).fillRect(this.x0 + 1, this.rowsTop + this.selected * K.rowH, this.w - 2, K.rowH);
  }
}

// Yes / no; Yes sends `commands`, No and back send nothing.
export function confirmPanel(scene: Phaser.Scene, question: string, commands: readonly Command[]): Panel {
  const list = new ListPanel(scene, question, [{ label: 'YES' }, { label: 'NO' }]);
  return {
    update(intents) {
      const r = list.update(intents);
      if (r === 'back') return [];
      if (r === 'confirm') return list.selected === 0 ? [...commands] : [];
      return null;
    },
    destroy: () => list.destroy(),
  };
}
