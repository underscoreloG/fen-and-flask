// Pause menu (specs/design.md Screens): Resume, Mute on/off, New game behind a yes/no, the version.
// The host pauses the sim while it is open, like any panel. Confirms that keep it open play their
// own click; the host plays the one that closes it.
import type Phaser from 'phaser';
import type { GameAudio } from '../../audio/audio';
import { APP_VERSION } from '../../data/version';
import { ListPanel, type Panel } from './confirm';

const ROWS = [{ label: 'RESUME' }, { label: 'MUTE' }, { label: 'NEW GAME' }];
const footer = (muted: boolean): string => `${muted ? 'MUTE: ON ' : 'MUTE: OFF'}   V${APP_VERSION}`;

// newGame runs on "yes"; the panel then closes.
export function pausePanel(scene: Phaser.Scene, audio: GameAudio, newGame: () => void): Panel {
  const menu = (): ListPanel => new ListPanel(scene, 'PAUSED', ROWS, undefined, footer(audio.muted));
  // One of the two is shown: the menu, or the new-game yes/no in its place.
  let list: ListPanel | null = menu();
  let sure: ListPanel | null = null;

  return {
    update(intents) {
      if (sure) {
        const r = sure.update(intents);
        if (r === null) return null;
        if (r === 'confirm' && sure.selected === 0) {
          newGame();
          return [];
        }
        if (r === 'confirm') audio.ui('ui_confirm');
        sure.destroy();
        sure = null;
        list = menu();
        return null;
      }
      if (!list) return [];
      if (intents.back || intents.pause) return [];
      // M also toggles from the host, so the footer follows the setting, not this panel.
      list.setFooter(footer(audio.muted));
      if (list.update(intents) !== 'confirm') return null;
      if (list.selected === 0) return [];
      if (list.selected === 1) {
        audio.toggleMute();
        audio.ui('ui_confirm');
        list.setFooter(footer(audio.muted));
        return null;
      }
      audio.ui('ui_confirm');
      list.destroy();
      list = null;
      sure = new ListPanel(scene, 'START A NEW GAME?', [{ label: 'YES' }, { label: 'NO' }]);
      return null;
    },
    destroy: () => {
      sure?.destroy();
      list?.destroy();
    },
  };
}
