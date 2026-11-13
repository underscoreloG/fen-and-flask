import Phaser from 'phaser';
import type { GameAudio } from '../../audio/audio';
import type { Command } from '../../core/commands';
import type { GameEvent, UiRequest } from '../../core/events';
import { createInitialState } from '../../core/state';
import { GOAL_BANNER, ITEMS, PLOTS } from '../../data/content';
import { PALETTE } from '../../data/palette';
import { TUNING } from '../../data/tuning';
import { APP_VERSION } from '../../data/version';
import { clearLatches, queueCommand } from '../../input/input';
import { closePanel, openPanel, startGame, type Session } from '../../input/session';
import { clear, store } from '../../save/save';
import { addText } from '../font';
import { confirmPanel, UI_DEPTH, type Panel } from '../ui/confirm';
import { gardenPicker } from '../ui/gardenPicker';
import { Hud } from '../ui/hud';
import { notebook } from '../ui/notebook';
import { pausePanel } from '../ui/pause';
import { stallSetup, stallSummary, StallOpenView } from '../ui/stallPanel';
import { stationPanel } from '../ui/stationPanel';
import { Toasts } from '../ui/toast';
import { SIM_EVENTS } from './GameScene';

// The stall summary is opened by the UI itself (on stallClosed), not by a core uiRequest.
type StallSummary = { ui: 'stallSummary'; soldCount: number; soldCoins: number };

// HUD, screen tints and the panel host; the version label only in debug.
// Panel host: a uiRequest opens one panel and sets the session's pause switch; the panel reads
// session.intents each frame; when it returns commands, it closes and they reach the next tick.
export class UIScene extends Phaser.Scene {
  private readonly session: Session;
  private readonly audio: GameAudio;
  private hud!: Hud;
  private panel: Panel | null = null;
  // The open stall's live view: shown on stallOpened, gone on stallClosed; it never pauses.
  private stallView: StallOpenView | null = null;
  private toasts!: Toasts;
  private tint!: Phaser.GameObjects.Rectangle;
  private night!: Phaser.GameObjects.Rectangle;

  constructor(session: Session, audio: GameAudio) {
    super('ui');
    this.session = session;
    this.audio = audio;
  }

  create(): void {
    const { viewW, viewH, uiMargin } = TUNING.render;
    this.tint = this.add
      .rectangle(0, 0, viewW, viewH, PALETTE.ember, TUNING.fx.eveningTintAlpha)
      .setOrigin(0, 0)
      .setDepth(UI_DEPTH.tint);
    this.hud = new Hud(this, this.session);
    this.toasts = new Toasts(this);
    this.night = this.add.rectangle(0, 0, viewW, viewH, PALETTE.night, 1).setOrigin(0, 0).setDepth(UI_DEPTH.overlay).setAlpha(0);
    const onSim = (events: GameEvent[]): void => {
      this.hud.onEvents(events, this.scene.get('game').cameras.main.worldView);
      this.audio.play(events);
      this.onEvents(events);
    };
    this.game.events.on(SIM_EVENTS, onSim);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(SIM_EVENTS, onSim));
    this.audio.ambience();
    if (!this.session.options.debug) return;
    addText(this, viewW - uiMargin, viewH - uiMargin, `v${APP_VERSION}`, 'bone').setOrigin(1, 1);
  }

  update(): void {
    this.hud.update();
    this.tint.setVisible(this.session.state.phase === 'evening');
    const intents = this.session.intents;
    this.audio.wake(intents);
    // M works everywhere, the open stall and every panel included.
    if (intents.mute) this.audio.toggleMute();
    const moved = intents.up || intents.down || intents.left || intents.right;
    if (!this.panel && this.stallView) {
      if (moved && !this.session.botOn) this.audio.ui('ui_move');
      const live = this.stallView.update(this.session.intents, this.session.state, this.session.botOn);
      // Sent live (the sim runs); the key that sent them never reaches the sim as a swing.
      for (const c of live) this.session.latch = clearLatches(queueCommand(this.session.latch, c));
      return;
    }
    if (!this.panel) {
      // The notebook opens from the world on its own key, not from a uiRequest; never during a
      // sleep fade (the switch is still on then).
      if (this.session.intents.notebook && !this.session.panelOpen) {
        this.panel = notebook(this, this.session.state);
        openPanel(this.session);
      } else if (intents.pause && !this.session.panelOpen && !this.session.botOn) {
        // Never while the stall is open (handled above) or during a sleep fade (switch still on).
        this.panel = pausePanel(this, this.audio, () => this.newGame());
        openPanel(this.session);
      }
      return;
    }
    const out = this.panel.update(intents);
    if (!out) {
      if (moved) this.audio.ui('ui_move');
      return;
    }
    // Back and no-op closes stay quiet; a confirm that closes the panel clicks.
    if (intents.confirm) this.audio.ui('ui_confirm');
    this.panel.destroy();
    this.panel = null;
    if (out.some((c) => c.type === 'Sleep')) this.sleepThen(out);
    else closePanel(this.session, out);
  }

  // From the pause menu, in place: the save goes (unless ?nosave) and a fresh game with this page's
  // seed swaps in; the scenes keep running and redraw from the new state.
  private newGame(): void {
    if (!this.session.options.nosave) clear();
    startGame(this.session, createInitialState(this.session.options.seed));
  }

  // In order: at high ?speed one batch can hold a stall's whole evening.
  private onEvents(events: readonly GameEvent[]): void {
    const bot = this.session.botOn;
    for (const e of events) {
      switch (e.type) {
        case 'morning':
          if (!this.session.options.nosave) store(this.session.state);
          break;
        case 'uiRequest':
          // While the bot drives it sends commands itself; a panel would only pause it.
          if (bot) break;
          if (e.ui === 'toast') this.toasts.toast(e.text);
          else this.open(e);
          break;
        case 'trendAnnounced':
          this.toasts.toast(`IN DEMAND TODAY: ${ITEMS.find((i) => i.id === e.potion)?.name ?? e.potion}`);
          break;
        case 'goalReached':
          this.toasts.banner(GOAL_BANNER);
          break;
        case 'plotBought':
          this.toasts.toast(`THE ${(PLOTS[e.plot]?.id ?? '').toUpperCase()} PLOT IS YOURS`);
          break;
        case 'stallOpened':
          this.stallView?.destroy();
          this.stallView = new StallOpenView(this, this.session.state, this.session.latch.lastDevice);
          break;
        case 'stallClosed':
          this.stallView?.destroy();
          this.stallView = null;
          if (!bot) this.open({ ui: 'stallSummary', soldCount: e.soldCount, soldCoins: e.soldCoins });
          break;
        default:
          break;
      }
    }
  }

  private open(req: UiRequest | StallSummary): void {
    if (this.panel || this.session.panelOpen) return;
    this.panel = this.makePanel(req);
    openPanel(this.session);
  }

  // Later WPs add their panels here.
  private makePanel(req: UiRequest | StallSummary): Panel {
    const state = this.session.state;
    switch (req.ui) {
      case 'sleepConfirm':
        return confirmPanel(this, 'SLEEP?', [{ type: 'Sleep' }]);
      case 'callItADayConfirm':
        return confirmPanel(this, 'CALL IT A DAY?', [{ type: 'CallItADay' }]);
      case 'gardenPicker':
        return gardenPicker(this, this.session.state, req.bed);
      case 'station':
        return stationPanel(this, this.session.state, req.station);
      case 'stall':
        return stallSetup(this, state, this.session.latch.lastDevice);
      case 'stallSummary':
        return stallSummary(this, req.soldCount, req.soldCoins);
      case 'buyPlotConfirm': {
        const price = PLOTS[req.plot]?.price ?? 0;
        if (state.coins < price) return confirmPanel(this, `NEED ${price} COINS`, []);
        return confirmPanel(this, `BUY PLOT FOR ${price}?`, [{ type: 'BuyPlot', plot: req.plot }]);
      }
      case 'toast':
        // Never reaches here (toasts do not pause), but keep the switch total.
        return confirmPanel(this, req.text, []);
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
