// The order panel's rules, headless: ListPanel (Phaser) is replaced by a stand-in that keeps the
// rows and the cursor the panel gives it and answers intents as ListPanel does.
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../core/state';
import type { UiIntents } from '../../input/input';
import type { PanelRow } from './confirm';

const shown: { title: string | null; rows: readonly PanelRow[] }[] = [];

vi.mock('./confirm', () => ({
  ListPanel: class {
    selected = 0;
    private readonly rows: readonly PanelRow[];
    constructor(_scene: unknown, title: string | null, rows: readonly PanelRow[]) {
      this.rows = rows;
      shown.push({ title, rows });
    }
    select(i: number): void {
      this.selected = i;
    }
    update(intents: UiIntents): 'confirm' | 'back' | null {
      if (intents.back) return 'back';
      const n = this.rows.length;
      if (intents.up || intents.down) this.selected = (this.selected + (intents.down ? 1 : -1) + n) % n;
      if (intents.confirm && !this.rows[this.selected]!.dim) return 'confirm';
      return null;
    }
    destroy(): void {}
  },
}));

const { orderPanel, orderText } = await import('./orderPanel');

const none: UiIntents = { up: false, down: false, left: false, right: false, confirm: false, back: false, notebook: false, pause: false, mute: false };
const press = (k: keyof UiIntents): UiIntents => ({ ...none, [k]: true });
const scene = {} as Phaser.Scene;

function state(held: number, done = false): ReturnType<typeof createInitialState> {
  const s = createInitialState(1);
  s.order = { item: 'glowdraught', qty: 2, pay: 72, done };
  s.inventory.glowdraught = held;
  return s;
}

describe('order panel', () => {
  it('the toast text names the quantity, the potion and the pay', () => {
    expect(orderText({ item: 'glowdraught', qty: 2, pay: 72 })).toBe('ORDER: 2 GLOW DRAUGHT FOR 72');
  });

  it('shows the potion and how many, the pay, how many are held, and DELIVER dimmed until enough are held', () => {
    orderPanel(scene, state(1));
    const { title, rows } = shown.at(-1)!;
    expect(title).toBe('ORDER');
    expect(rows[0]).toMatchObject({ label: 'GLOW DRAUGHT', icon: 'icon_glowdraught', count: 2 });
    expect(rows[1]).toMatchObject({ label: 'PAY', extras: [{ icon: 'coin', count: 72 }] });
    expect(rows[2]).toMatchObject({ label: 'YOU HAVE', count: 1 });
    expect(rows[3]).toMatchObject({ label: 'DELIVER', dim: true });
    orderPanel(scene, state(2));
    expect(shown.at(-1)!.rows[3]).toMatchObject({ label: 'DELIVER', dim: false });
  });

  it('confirm on DELIVER (where the cursor starts) sends DeliverOrder; dimmed it does nothing; back closes', () => {
    expect(orderPanel(scene, state(2)).update(press('confirm'))).toEqual([{ type: 'DeliverOrder' }]);
    const short = orderPanel(scene, state(1));
    expect(short.update(press('confirm'))).toBeNull();
    expect(short.update(press('back'))).toEqual([]);
    // Confirm on another row does not deliver.
    const moved = orderPanel(scene, state(2));
    moved.update(press('up'));
    expect(moved.update(press('confirm'))).toBeNull();
  });

  it('once done it says so and confirm just closes it', () => {
    const p = orderPanel(scene, state(5, true));
    expect(shown.at(-1)!.rows.map((r) => r.label)).toEqual(['GLOW DRAUGHT', 'DONE - NEW ORDER TOMORROW']);
    expect(p.update(press('confirm'))).toEqual([]);
  });
});
