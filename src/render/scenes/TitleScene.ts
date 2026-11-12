import Phaser from 'phaser';
import { createInitialState, type GameState } from '../../core/state';
import { TUNING } from '../../data/tuning';
import { APP_VERSION } from '../../data/version';
import type { DeviceReader } from '../../input/devices';
import { holdInput, readUi, startGame, type Session } from '../../input/session';
import { load } from '../../save/save';
import { addText } from '../font';
import { ListPanel } from '../ui/confirm';

// Title text, Continue (only with a valid save) / New game, version bottom-right.
export class TitleScene extends Phaser.Scene {
  private readonly session: Session;
  private readonly reader: DeviceReader;
  private menu!: ListPanel;
  private saved: GameState | null = null;

  constructor(session: Session, reader: DeviceReader) {
    super('title');
    this.session = session;
    this.reader = reader;
  }

  create(): void {
    const { viewW, viewH, uiMargin } = TUNING.render;
    const K = TUNING.panel;
    this.saved = this.session.options.nosave ? null : load();
    addText(this, viewW / 2, K.titleTextY, 'FEN & FLASK', 'bone').setOrigin(0.5, 0.5).setScale(K.titleScale);
    const rows = this.saved ? [{ label: 'CONTINUE' }, { label: 'NEW GAME' }] : [{ label: 'NEW GAME' }];
    this.menu = new ListPanel(this, null, rows, K.titleMenuY);
    addText(this, viewW - uiMargin, viewH - uiMargin, `v${APP_VERSION}`, 'bone').setOrigin(1, 1);
  }

  update(_time: number, delta: number): void {
    const { keys, pad } = this.reader.read();
    holdInput(this.session, keys, pad);
    readUi(this.session, keys, pad, delta);
    if (this.menu.update(this.session.intents) !== 'confirm') return;
    const cont = this.saved !== null && this.menu.selected === 0;
    startGame(this.session, cont && this.saved ? this.saved : createInitialState(this.session.options.seed));
    this.scene.start('game');
  }
}
