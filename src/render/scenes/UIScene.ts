import Phaser from 'phaser';
import { TUNING } from '../../data/tuning';
import { APP_VERSION } from '../../data/version';
import { addText } from '../font';
import type { Session } from '../../input/session';

// HUD and panels overlay. For now only the version, and only in debug.
export class UIScene extends Phaser.Scene {
  private readonly session: Session;

  constructor(session: Session) {
    super('ui');
    this.session = session;
  }

  create(): void {
    if (!this.session.options.debug) return;
    const { viewW, viewH, uiMargin } = TUNING.render;
    addText(this, viewW - uiMargin, viewH - uiMargin, `v${APP_VERSION}`, 'bone').setOrigin(1, 1);
  }
}
