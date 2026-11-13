import Phaser from 'phaser';
import type { GameAudio } from '../../audio/audio';
import { createInitialState, type GameState } from '../../core/state';
import { TUNING } from '../../data/tuning';
import { APP_VERSION } from '../../data/version';
import type { DeviceReader } from '../../input/devices';
import { holdInput, readUi, startGame, type Session } from '../../input/session';
import { clear, load } from '../../save/save';
import { addText } from '../font';
import { ListPanel } from '../ui/confirm';

// Title text, Continue (only with a valid save) / New game, version bottom-right.
export class TitleScene extends Phaser.Scene {
  private readonly session: Session;
  private readonly reader: DeviceReader;
  private readonly audio: GameAudio;
  private menu!: ListPanel;
  private saved: GameState | null = null;
  // Menu row clicked since the last update, if any.
  private clicked: number | null = null;

  constructor(session: Session, reader: DeviceReader, audio: GameAudio) {
    super('title');
    this.session = session;
    this.reader = reader;
    this.audio = audio;
  }

  create(): void {
    const { viewW, viewH, uiMargin } = TUNING.render;
    const K = TUNING.panel;
    this.saved = this.session.options.nosave ? null : load();
    addText(this, viewW / 2, K.titleTextY, 'FEN & FLASK', 'bone').setOrigin(0.5, 0.5).setScale(K.titleScale);
    const rows = this.saved ? [{ label: 'CONTINUE' }, { label: 'NEW GAME' }] : [{ label: 'NEW GAME' }];
    this.menu = new ListPanel(this, null, rows, K.titleMenuY);
    addText(this, viewW / 2, K.titleHintY, 'C OR ENTER TO START', 'waterlight').setOrigin(0.5, 0.5);
    this.clicked = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.clicked = this.menu.rowAt(p.x, p.y);
    });
    addText(this, viewW - uiMargin, viewH - uiMargin, `v${APP_VERSION}`, 'bone').setOrigin(1, 1);
  }

  update(_time: number, delta: number): void {
    const { keys, pad } = this.reader.read();
    holdInput(this.session, keys, pad);
    readUi(this.session, keys, pad, delta);
    const intents = this.session.intents;
    this.audio.wake(intents);
    if (intents.mute) this.audio.toggleMute();
    const before = this.menu.selected;
    const click = this.clicked;
    this.clicked = null;
    if (click !== null) this.menu.selected = click;
    else if (this.menu.update(intents) !== 'confirm') {
      if (this.menu.selected !== before) this.audio.ui('ui_move');
      return;
    }
    this.audio.ui('ui_confirm');
    const cont = this.saved !== null && this.menu.selected === 0;
    // New game replaces any save at once, not only at the next morning.
    if (!cont && !this.session.options.nosave) clear();
    startGame(this.session, cont && this.saved ? this.saved : createInitialState(this.session.options.seed));
    this.scene.start('game');
  }
}
