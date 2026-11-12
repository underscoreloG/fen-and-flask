import Phaser from 'phaser';
import type { Command } from '../../core/commands';
import type { GameEvent, UiRequest } from '../../core/events';
import { PALETTE } from '../../data/palette';
import { TUNING } from '../../data/tuning';
import { APP_VERSION } from '../../data/version';
import { closePanel, openPanel, type Session } from '../../input/session';
import { store } from '../../save/save';
import { addText } from '../font';
import { confirmPanel, UI_DEPTH, type Panel } from '../ui/confirm';
import { gardenPicker } from '../ui/gardenPicker';
import { Hud } from '../ui/hud';
import { SIM_EVENTS } from './GameScene';

// HUD, screen tints and the panel host; the version label only in debug.
// Panel host: a uiRequest opens one panel and sets the session's pause switch; the panel reads
// session.intents each frame; when it returns commands, it closes and they reach the next tick.
export class UIScene extends Phaser.Scene {
  private readonly session: Session;
  private hud!: Hud;
  private panel: Panel | null = null;
  private tint!: Phaser.GameObjects.Rectangle;
  private night!: Phaser.GameObjects.Rectangle;

  constructor(session: Session) {
    super('ui');
    this.session = session;
  }

  create(): void {
    const { viewW, viewH, uiMargin } = TUNING.render;
    this.tint = this.add
      .rectangle(0, 0, viewW, viewH, PALETTE.ember, TUNING.fx.eveningTintAlpha)
      .setOrigin(0, 0)
      .setDepth(UI_DEPTH.tint);
    this.hud = new Hud(this, this.session);
    this.night = this.add.rectangle(0, 0, viewW, viewH, PALETTE.night, 1).setOrigin(0, 0).setDepth(UI_DEPTH.overlay).setAlpha(0);
    const onSim = (events: GameEvent[]): void => {
      this.hud.onEvents(events, this.scene.get('game').cameras.main.worldView);
      this.onEvents(events);
    };
    this.game.events.on(SIM_EVENTS, onSim);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(SIM_EVENTS, onSim));
    if (!this.session.options.debug) return;
    addText(this, viewW - uiMargin, viewH - uiMargin, `v${APP_VERSION}`, 'bone').setOrigin(1, 1);
  }

  update(): void {
    this.hud.update();
    this.tint.setVisible(this.session.state.phase === 'evening');
    if (!this.panel) return;
    const out = this.panel.update(this.session.intents);
    if (!out) return;
    this.panel.destroy();
    this.panel = null;
    if (out.some((c) => c.type === 'Sleep')) this.sleepThen(out);
    else closePanel(this.session, out);
  }

  private onEvents(events: readonly GameEvent[]): void {
    for (const e of events) {
      if (e.type === 'morning' && !this.session.options.nosave) store(this.session.state);
      else if (e.type === 'uiRequest') this.open(e);
    }
  }

  private open(req: UiRequest): void {
    if (this.panel || this.session.panelOpen) return;
    this.panel = this.makePanel(req);
    openPanel(this.session);
  }

  // Later WPs add their panels here.
  private makePanel(req: UiRequest): Panel {
    switch (req.ui) {
      case 'sleepConfirm':
        return confirmPanel(this, 'SLEEP?', [{ type: 'Sleep' }]);
      case 'callItADayConfirm':
        return confirmPanel(this, 'CALL IT A DAY?', [{ type: 'CallItADay' }]);
      case 'gardenPicker':
        return gardenPicker(this, this.session.state, req.bed);
    }
  }

  // Fade to night while the sim is still paused, deliver the Sleep in the dark (the morning swap
  // never shows), hold, then fade back.
  private sleepThen(commands: readonly Command[]): void {
    const f = TUNING.fx;
    this.tweens.add({
      targets: this.night,
      alpha: 1,
      duration: f.sleepFadeMs,
      onComplete: () => {
        closePanel(this.session, commands);
        this.tweens.add({ targets: this.night, alpha: 0, delay: f.sleepHoldMs, duration: f.sleepFadeMs });
      },
    });
  }
}
