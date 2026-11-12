import Phaser from 'phaser';
import type { GameEvent } from '../../core/events';
import { TUNING } from '../../data/tuning';
import { APP_VERSION } from '../../data/version';
import { addText } from '../font';
import { Hud } from '../ui/hud';
import type { Session } from '../../input/session';
import { SIM_EVENTS } from './GameScene';

// HUD and panels overlay; the version label only in debug.
export class UIScene extends Phaser.Scene {
  private readonly session: Session;
  private hud!: Hud;

  constructor(session: Session) {
    super('ui');
    this.session = session;
  }

  create(): void {
    this.hud = new Hud(this, this.session);
    const onSim = (events: GameEvent[]): void => this.hud.onEvents(events, this.scene.get('game').cameras.main.worldView);
    this.game.events.on(SIM_EVENTS, onSim);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(SIM_EVENTS, onSim));
    if (!this.session.options.debug) return;
    const { viewW, viewH, uiMargin } = TUNING.render;
    addText(this, viewW - uiMargin, viewH - uiMargin, `v${APP_VERSION}`, 'bone').setOrigin(1, 1);
  }

  update(): void {
    this.hud.update();
  }
}
