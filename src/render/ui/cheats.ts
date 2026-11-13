import type Phaser from 'phaser';
import type { CheatId } from '../../core/cheat';
import { TUNING } from '../../data/tuning';
import { ListPanel, type Panel } from './confirm';

const C = TUNING.cheat;
const ROWS: readonly { label: string; cheat: CheatId }[] = [
  { label: `+${C.coinsSmall} COINS`, cheat: 'coinsSmall' },
  { label: `+${C.coinsBig} COINS`, cheat: 'coinsBig' },
  { label: `+${C.items} OF EVERY ITEM`, cheat: 'items' },
  { label: 'FULL HEARTS', cheat: 'hearts' },
  { label: 'EVENING NOW', cheat: 'evening' },
  { label: 'NEXT MORNING', cheat: 'morning' },
  { label: 'UNLOCK ALL LAND', cheat: 'land' },
];

// Hidden test menu, opened with F2. Picking a row applies it and closes the menu.
export function cheatPanel(scene: Phaser.Scene): Panel {
  const list = new ListPanel(scene, 'TEST MENU', ROWS.map((r) => ({ label: r.label })));
  return {
    update(intents) {
      const r = list.update(intents);
      if (r === 'back') return [];
      if (r === 'confirm') return [{ type: 'Cheat', cheat: ROWS[list.selected]!.cheat }];
      return null;
    },
    destroy: () => list.destroy(),
  };
}
