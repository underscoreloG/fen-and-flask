// Catalog panel (specs/wp/WP07): every item not yet owned. Buyable rows first, then the ones
// waiting on another item, then what arrives tomorrow; dim when it cannot be bought now (missing
// requirement, not enough coins, already coming). The footer says what the selected row does.
// Confirm on a buyable, affordable row buys it and closes the panel.
import type Phaser from 'phaser';
import { catalogDef, catalogStatus } from '../../core/catalog';
import type { Command } from '../../core/commands';
import type { GameState } from '../../core/state';
import { CATALOG, type CatalogDef } from '../../data/content';
import { ListPanel, type Panel, type PanelRow } from './confirm';

interface Row {
  row: PanelRow;
  footer: string;
  buy: CatalogDef | null;
}

export function catalogPanel(scene: Phaser.Scene, state: GameState): Panel {
  const price = (d: CatalogDef): PanelRow['extras'] => [{ icon: 'coin', count: d.price }];
  const of = (status: ReturnType<typeof catalogStatus>): CatalogDef[] => CATALOG.filter((d) => catalogStatus(state, d) === status);
  const rows: Row[] = [
    ...of('buyable').map((d) => {
      const short = state.coins < d.price;
      return { row: { label: d.name, extras: price(d), dim: short }, footer: d.effect, buy: short ? null : d };
    }),
    // Under a "NEEDS <NAME>" line per missing item.
    ...of('needs').flatMap((d) => [
      { row: { label: `NEEDS ${catalogDef(d.requires!)?.name ?? ''}`, dim: true }, footer: '', buy: null },
      { row: { label: d.name, extras: price(d), dim: true }, footer: d.effect, buy: null },
    ]),
  ];
  const coming = of('pending');
  if (coming.length > 0) {
    rows.push({ row: { label: 'ARRIVING TOMORROW', dim: true }, footer: '', buy: null });
    for (const d of coming) rows.push({ row: { label: d.name, dim: true }, footer: d.effect, buy: null });
  }
  if (rows.length === 0) rows.push({ row: { label: 'ALL BOUGHT', dim: true }, footer: '', buy: null });
  const widest = rows.reduce((a, r) => (r.footer.length > a.length ? r.footer : a), '');
  const list = new ListPanel(
    scene,
    'CATALOG',
    rows.map((r) => r.row),
    undefined,
    widest,
  );
  const show = (): void => list.setFooter(rows[list.selected]?.footer ?? '');
  show();
  return {
    update(intents): Command[] | null {
      const r = list.update(intents);
      show();
      if (r === 'back') return [];
      const buy = rows[list.selected]?.buy;
      if (r === 'confirm' && buy) return [{ type: 'BuyUpgrade', id: buy.id }];
      // Confirm on the only row when nothing is left closes the panel.
      if (intents.confirm && rows.length === 1 && !buy) return [];
      return null;
    },
    destroy: () => list.destroy(),
  };
}
