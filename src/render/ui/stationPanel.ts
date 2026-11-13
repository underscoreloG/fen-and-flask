// Station panel (specs/design.md Screens): one row per recipe with its ingredients and owned
// counts, a quantity changed with left/right, Start on confirm. Rows you cannot afford are dim; a
// busy station only shows its job.
import type Phaser from 'phaser';
import type { Command } from '../../core/commands';
import { maxBrew, maxGrind, type StationKind } from '../../core/stations';
import type { GameState } from '../../core/state';
import { BREW_RECIPES, CAULDRON_FUEL, GRIND_RECIPES, ITEMS, type ItemId } from '../../data/content';
import { ListPanel, type Panel, type PanelRow } from './confirm';

const TITLES: Record<StationKind, string> = { mortar: 'MORTAR', cauldron: 'CAULDRON', cauldron2: 'CAULDRON' };

const itemName = (id: ItemId): string => ITEMS.find((i) => i.id === id)?.name ?? id;

const qtyText = (qty: number): string => `QTY - ${qty} +   START`;
const SHORT = 'NOT ENOUGH';

interface RecipeView {
  output: ItemId;
  // What one job takes, for the owned counts on the row (the cauldron's bogwood included).
  inputs: readonly { item: ItemId }[];
  max: number;
  command(qty: number): Command;
}

function recipesOf(state: GameState, station: StationKind): RecipeView[] {
  if (station === 'mortar') {
    return GRIND_RECIPES.map((r) => ({
      output: r.output,
      inputs: [{ item: r.input }],
      max: maxGrind(state, r),
      command: (qty) => ({ type: 'StartGrind', input: r.input, qty }),
    }));
  }
  return BREW_RECIPES.map((r) => ({
    output: r.potion,
    inputs: [...r.ingredients, { item: CAULDRON_FUEL }],
    max: maxBrew(state, r),
    command: (qty) => ({ type: 'StartBrew', potion: r.potion, qty }),
  }));
}

export function stationPanel(scene: Phaser.Scene, state: GameState, station: StationKind): Panel {
  const job = state.stations[station];
  if (job) {
    const row: PanelRow = { label: itemName(job.recipe), icon: `icon_${job.recipe}` };
    const list = new ListPanel(scene, `${TITLES[station]}: BUSY`, [row], undefined, `${job.remaining} LEFT`);
    return {
      update: (intents) => (list.update(intents) !== null ? [] : null),
      destroy: () => list.destroy(),
    };
  }

  const recipes = recipesOf(state, station);
  const rows: PanelRow[] = recipes.map((r) => ({
    label: itemName(r.output),
    icon: `icon_${r.output}`,
    extras: r.inputs.map((i) => ({ icon: `icon_${i.item}`, count: state.inventory[i.item] })),
    dim: r.max < 1,
  }));
  const widest = [SHORT, ...recipes.map((r) => qtyText(r.max))].reduce((a, t) => (t.length > a.length ? t : a));
  const list = new ListPanel(scene, TITLES[station], rows, undefined, widest);
  // Starts at the most the selected recipe allows; the cozy default is "all of it".
  let qty = recipes[0]?.max ?? 0;
  const show = (): void => {
    const max = recipes[list.selected]?.max ?? 0;
    if (max < 1) list.setFooter(SHORT);
    else list.setFooter(qtyText(qty));
  };
  show();

  return {
    update(intents): Command[] | null {
      const before = list.selected;
      const r = list.update(intents);
      if (r === 'back') return [];
      const rec = recipes[list.selected];
      if (!rec) return null;
      if (list.selected !== before) qty = rec.max;
      if (intents.right) qty = Math.min(rec.max, qty + 1);
      if (intents.left) qty = Math.max(Math.min(1, rec.max), qty - 1);
      show();
      if (r === 'confirm' && rec.max >= 1) return [rec.command(qty)];
      return null;
    },
    destroy: () => list.destroy(),
  };
}
