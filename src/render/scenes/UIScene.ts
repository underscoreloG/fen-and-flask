import Phaser from 'phaser';
import type { GameAudio } from '../../audio/audio';
import type { Command } from '../../core/commands';
import type { GameEvent, UiRequest } from '../../core/events';
import { createInitialState } from '../../core/state';
import { CATALOG, GOAL_BANNER, ITEMS, M2_BANNER, PLOTS } from '../../data/content';
import { PALETTE } from '../../data/palette';
import { TUNING } from '../../data/tuning';
import { APP_VERSION } from '../../data/version';
import { closePanel, openPanel, startGame, type Session } from '../../input/session';
import { clear, store } from '../../save/save';
import { addText } from '../font';
import { catalogPanel } from '../ui/catalogPanel';
import { cheatPanel } from '../ui/cheats';
import { confirmPanel, UI_DEPTH, type Panel } from '../ui/confirm';
import { gardenPicker } from '../ui/gardenPicker';
import { Hud } from '../ui/hud';
import { notebook } from '../ui/notebook';
import { orderPanel, orderText } from '../ui/orderPanel';
import { pausePanel } from '../ui/pause';
import { shelfPanel, shopSummary } from '../ui/shelfPanel';
import { stationPanel } from '../ui/stationPanel';
import { Toasts } from '../ui/toast';
import { SIM_EVENTS } from './GameScene';

// The shop summary is opened by the UI itself (on stallClosed), not by a core uiRequest.
type ShopSummary = { ui: 'shopSummary'; soldCount: number; soldCoins: number };

// The morning's one-liners, shown one after another: arrivals, what the helper toads did, the order.
function morningToast(e: GameEvent): string | null {
  if (e.type === 'upgradeArrived') return `ARRIVED: ${CATALOG.find((d) => d.id === e.id)?.name ?? e.id}`;
  if (e.type === 'gardenToadHarvested') return `GARDEN TOAD: +${e.harvested}`;
  if (e.type === 'basketToadBrought') return `BASKET TOAD: +${Object.values(e.items).reduce((a, b) => a + b, 0)}`;
  if (e.type === 'orderPosted') return orderText(e);
  return null;
}

// HUD, screen tints and the panel host; the version label only in debug.
// Panel host: a uiRequest opens one panel and sets the session's pause switch; the panel reads
// session.intents each frame; when it returns commands, it closes and they reach the next tick.
export class UIScene extends Phaser.Scene {
  private readonly session: Session;
  private readonly audio: GameAudio;
  private hud!: Hud;
  private panel: Panel | null = null;
  // F2 was pressed since the last update (the hidden test menu).
  private cheatAsked = false;
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
    // The test menu has its own key, outside the input layer: it is not part of the game's controls.
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'F2') return;
      e.preventDefault();
      this.cheatAsked = true;
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
    this.audio.ambience();
    // A game starting or loading posts no order event: the board's note is told here.
    this.toasts.toast(orderText(this.session.state.order));
    if (!this.session.options.debug) return;
    addText(this, viewW - uiMargin, viewH - uiMargin, `v${APP_VERSION}`, 'bone').setOrigin(1, 1);
  }

  update(): void {
    this.hud.update();
    this.tint.setVisible(this.session.state.phase === 'evening');
    const intents = this.session.intents;
    this.audio.wake(intents);
    // M works everywhere, every panel included.
    if (intents.mute) this.audio.toggleMute();
    const moved = intents.up || intents.down || intents.left || intents.right;
    const cheatAsked = this.cheatAsked;
    this.cheatAsked = false;
    if (!this.panel) {
      if (cheatAsked && !this.session.panelOpen && !this.session.botOn) {
        this.panel = cheatPanel(this);
        openPanel(this.session);
        return;
      }
      // The notebook opens from the world on its own key, not from a uiRequest; never during a
      // sleep fade (the switch is still on then).
      if (this.session.intents.notebook && !this.session.panelOpen) {
        this.panel = notebook(this, this.session.state);
        openPanel(this.session);
      } else if (intents.pause && !this.session.panelOpen && !this.session.botOn) {
        // Never during a sleep fade (the switch is still on then).
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
    this.toasts.toast(orderText(this.session.state.order));
  }

  // In order: at high ?speed one batch can hold a shop's whole evening.
  private onEvents(events: readonly GameEvent[]): void {
    const bot = this.session.botOn;
    events.forEach((e, i) => {
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
          this.toasts.toast(`IN DEMAND TODAY: ${ITEMS.find((i) => i.id === e.item)?.name ?? e.item}`);
          break;
        case 'goalReached':
          this.toasts.banner(GOAL_BANNER);
          break;
        case 'm2GoalReached':
          this.toasts.banner(M2_BANNER);
          break;
        case 'plotBought':
          this.toasts.toast(`THE ${(PLOTS[e.plot]?.id ?? '').toUpperCase()} PLOT IS YOURS`);
          break;
        case 'upgradeArrived':
        case 'gardenToadHarvested':
        case 'basketToadBrought':
        case 'orderPosted': {
          // One toast per arrival, then the toads' work: a toast replaces the one showing, so later
          // ones wait their turn.
          const text = morningToast(e);
          const n = events.slice(0, i).filter((o) => morningToast(o) !== null).length;
          if (text) this.time.delayedCall(n * TUNING.toast.ms, () => this.toasts.toast(text));
          break;
        }
        case 'stallClosed':
          // Not when the shop closed because the player went to sleep: the morning follows.
          if (!bot && !events.slice(i).some((o) => o.type === 'morning')) {
            this.open({ ui: 'shopSummary', soldCount: e.soldCount, soldCoins: e.soldCoins });
          }
          break;
        default:
          break;
      }
    });
  }

  private open(req: UiRequest | ShopSummary): void {
    if (this.panel || this.session.panelOpen) return;
    this.panel = this.makePanel(req);
    openPanel(this.session);
  }

  private makePanel(req: UiRequest | ShopSummary): Panel {
    const state = this.session.state;
    switch (req.ui) {
      case 'sleepConfirm':
        return confirmPanel(this, 'SLEEP?', [{ type: 'Sleep' }]);
      case 'openShopConfirm':
        return confirmPanel(this, 'OPEN SHOP?', [{ type: 'OpenStall' }]);
      case 'closeShopConfirm':
        return confirmPanel(this, 'CLOSE SHOP?', [{ type: 'CloseStall' }]);
      case 'gardenPicker':
        return gardenPicker(this, this.session.state, req.bed);
      case 'digUpConfirm': {
        const crop = state.garden[req.bed]?.crop;
        const name = ITEMS.find((i) => i.id === crop)?.name.toUpperCase() ?? '';
        return confirmPanel(this, `DIG UP ${name}?`, [{ type: 'DigUpBed', bed: req.bed }], true);
      }
      case 'station':
        return stationPanel(this, this.session.state, req.station);
      case 'catalog':
        return catalogPanel(this, state);
      case 'order':
        return orderPanel(this, state);
      case 'shelf':
        return shelfPanel(this, state, req.shelf, this.session.latch.lastDevice);
      case 'shopSummary':
        return shopSummary(this, req.soldCount, req.soldCoins);
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
