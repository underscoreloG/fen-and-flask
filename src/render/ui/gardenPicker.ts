// Garden picker (specs/design.md Screens): the plantable items the player owns, with counts.
import type Phaser from 'phaser';
import type { GameState } from '../../core/state';
import { CROPS, ITEMS } from '../../data/content';
import { ListPanel, type Panel } from './confirm';

export function gardenPicker(scene: Phaser.Scene, state: GameState, bed: number): Panel {
  const owned = CROPS.filter((c) => state.inventory[c.item] > 0).map((c) => c.item);
  const rows = owned.length
    ? owned.map((item) => ({
        label: ITEMS.find((i) => i.id === item)?.name ?? item,
        icon: `icon_${item}`,
        count: state.inventory[item],
      }))
    : [{ label: 'NOTHING TO PLANT', dim: true }];
  const list = new ListPanel(scene, 'PLANT', rows);
  return {
    update(intents) {
      const r = list.update(intents);
      const item = owned[list.selected];
      if (r === 'confirm' && item) return [{ type: 'Plant', bed, item }];
      // With nothing to plant, confirm just closes.
      if (r === 'back' || (intents.confirm && !item)) return [];
      return null;
    },
    destroy: () => list.destroy(),
  };
}
