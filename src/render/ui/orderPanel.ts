// Order panel (specs/wp/WP09), opened at the order board: today's potion and how many, the pay,
// how many the player holds, and DELIVER (dim until that is enough; potions on the tables do not
// count). Once delivered it says so until the next morning.
import type Phaser from 'phaser';
import type { Command } from '../../core/commands';
import type { Order } from '../../core/orders';
import type { GameState } from '../../core/state';
import { ITEMS } from '../../data/content';
import { ListPanel, type Panel, type PanelRow } from './confirm';

type OrderNote = Pick<Order, 'item' | 'qty' | 'pay'>;

const potionName = (order: OrderNote): string => (ITEMS.find((i) => i.id === order.item)?.name ?? order.item).toUpperCase();

// The toast at game start or load, and after each morning: "ORDER: 2 GLOW DRAUGHT FOR 72".
export function orderText(order: OrderNote): string {
  return `ORDER: ${order.qty} ${potionName(order)} FOR ${order.pay}`;
}

export function orderPanel(scene: Phaser.Scene, state: GameState): Panel {
  const o = state.order;
  const held = state.inventory[o.item];
  const wanted: PanelRow = { label: potionName(o), icon: `icon_${o.item}`, count: o.qty };
  const rows: PanelRow[] = o.done
    ? [wanted, { label: 'DONE - NEW ORDER TOMORROW', dim: true }]
    : [wanted, { label: 'PAY', extras: [{ icon: 'coin', count: o.pay }] }, { label: 'YOU HAVE', count: held }, { label: 'DELIVER', dim: held < o.qty }];
  const deliver = o.done ? -1 : rows.length - 1;
  const list = new ListPanel(scene, 'ORDER', rows);
  list.select(rows.length - 1);
  return {
    update(intents): Command[] | null {
      const r = list.update(intents);
      if (r === 'back') return [];
      if (r === 'confirm' && list.selected === deliver) return [{ type: 'DeliverOrder' }];
      // Once done, confirm just closes it.
      if (intents.confirm && o.done) return [];
      return null;
    },
    destroy: () => list.destroy(),
  };
}
