// HUD (specs/design.md clutter budget): hearts and coins top-left, clock and day top-right, the
// item bar bottom-center, the interact hint above it. Collected pickups hop from the player into their slot, and the
// count only ticks up when they land.
import Phaser from 'phaser';
import { ITEM_IDS, type ItemId } from '../../data/content';
import { PALETTE } from '../../data/palette';
import { TUNING } from '../../data/tuning';
import { clockHour, clockLabel } from '../../core/clock';
import type { GameEvent } from '../../core/events';
import { bedIndex, isReady } from '../../core/garden';
import { WORLD_STRUCTURES } from '../../core/world';
import type { Session } from '../../input/session';
import { addText } from '../font';
import { ATLAS } from '../sprites/generate';

const H = TUNING.hud;
const R = TUNING.render;
const ICON = 8;
const CHAR_W = R.fontCellW;
const CHAR_H = R.fontCellH;
// Keyboard key or gamepad button for interact (controls table in specs/design.md).
const INTERACT_KEY = { keyboard: 'C', gamepad: 'A' } as const;

const HINTS: Readonly<Record<string, string>> = Object.fromEntries(WORLD_STRUCTURES.map((s) => [s.def.id, s.def.hint]));
const READY_HINTS: Readonly<Record<string, string | undefined>> = Object.fromEntries(
  WORLD_STRUCTURES.map((s) => [s.def.id, s.def.hintReady]),
);
// The dial is a 12-hour face with 12 at the top.
const DIAL_HOURS = 12;

interface Slot {
  icon: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.BitmapText;
  shown: number;
}

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly session: Session;
  private readonly hearts: Phaser.GameObjects.Image[] = [];
  private readonly coinText: Phaser.GameObjects.BitmapText;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly slots = new Map<ItemId, Slot>();
  // Pickups still hopping toward their slot, per item.
  private readonly inFlight: Partial<Record<ItemId, number>> = {};
  private readonly hintKey: Phaser.GameObjects.Graphics;
  private readonly hintKeyText: Phaser.GameObjects.BitmapText;
  private readonly hintShadow: Phaser.GameObjects.BitmapText;
  private readonly hintText: Phaser.GameObjects.BitmapText;
  private readonly dial: Phaser.GameObjects.Image;
  private readonly hand: Phaser.GameObjects.Graphics;
  private readonly dayText: Phaser.GameObjects.BitmapText;
  private readonly timeText: Phaser.GameObjects.BitmapText;
  private shownHearts: number;
  private barTop: number = R.viewH;

  constructor(scene: Phaser.Scene, session: Session) {
    this.scene = scene;
    this.session = session;
    const m = R.uiMargin;
    for (let i = 0; i < TUNING.player.hearts; i++) {
      this.hearts.push(scene.add.image(m + i * (ICON + H.heartGap) + ICON / 2, m + ICON / 2, ATLAS, 'heart'));
    }
    this.shownHearts = session.state.player.hearts;
    const coinY = m + ICON + H.heartGap * 2;
    scene.add.image(m, coinY, ATLAS, 'coin').setOrigin(0, 0);
    this.coinText = addText(scene, m + ICON + H.iconTextGap * 2, coinY, '0', 'coin');
    this.bar = scene.add.graphics();
    this.hintKey = scene.add.graphics();
    this.hintKeyText = addText(scene, 0, 0, '', 'ink');
    this.hintShadow = addText(scene, 0, 0, '', 'ink');
    this.hintText = addText(scene, 0, 0, '', 'bone');
    // Clock top-right: dial, "DAY N", and the time (or EVENING) under it.
    const dialX = R.viewW - m - ICON;
    this.dial = scene.add.image(dialX, m, ATLAS, 'clock_dial').setOrigin(0, 0);
    this.hand = scene.add.graphics();
    this.dayText = addText(scene, dialX - H.clockGap, m, '', 'bone').setOrigin(1, 0);
    this.timeText = addText(scene, R.viewW - m, m + ICON + H.clockGap, '', 'bone').setOrigin(1, 0);
  }

  onEvents(events: readonly GameEvent[], worldView: Phaser.Geom.Rectangle): void {
    for (const e of events) {
      if (e.type === 'pickupCollected') this.hop(e.item, e.x - worldView.x, e.y - worldView.y - H.hopFromLiftPx);
      else if (e.type === 'playerHurt') this.pop(this.hearts[e.hearts]);
    }
  }

  update(): void {
    const state = this.session.state;
    const hearts = state.player.hearts;
    this.hearts.forEach((h, i) => h.setFrame(i < hearts ? 'heart' : 'heart_empty'));
    // Refilled hearts (after a faint) pop back in.
    if (hearts > this.shownHearts) for (let i = this.shownHearts; i < hearts; i++) this.pop(this.hearts[i]);
    this.shownHearts = hearts;
    this.coinText.setText(String(state.coins));
    this.layoutBar();
    this.layoutHint();
    this.layoutClock();
  }

  private layoutClock(): void {
    const s = this.session.state;
    const evening = s.phase === 'evening';
    this.dayText.setText(`DAY ${s.day}`);
    this.timeText.setText(evening ? 'EVENING' : clockLabel(s.clock.t)).setTintFill(PALETTE[evening ? 'emberhot' : 'bone']);
    // Hour hand drawn pixel by pixel from the dial's center pixel.
    const a = (clockHour(s.clock.t) / DIAL_HOURS) * Math.PI * 2 - Math.PI / 2;
    const cx = this.dial.x + ICON / 2;
    const cy = this.dial.y + ICON / 2;
    this.hand.clear().fillStyle(PALETTE.ink, 1);
    for (let i = 1; i <= H.clockHandPx; i++) {
      this.hand.fillRect(cx + Math.round(Math.cos(a) * i), cy + Math.round(Math.sin(a) * i), 1, 1);
    }
  }

  // Beds: PLANT when empty, HARVEST when ready, nothing while growing.
  private hintFor(id: string): string | undefined {
    const i = bedIndex(id);
    if (i < 0) return HINTS[id];
    const bed = this.session.state.garden[i];
    if (!bed) return undefined;
    if (bed.crop === null) return HINTS[id];
    return isReady(bed) ? READY_HINTS[id] : undefined;
  }

  // Only items you own, in the item table order, centered at the bottom.
  private layoutBar(): void {
    const inv = this.session.state.inventory;
    const owned = ITEM_IDS.filter((id) => inv[id] > 0);
    const widths = owned.map((id) => ICON + H.iconTextGap + String(this.shownCount(id)).length * CHAR_W);
    const inner = widths.reduce((a, w) => a + w, 0) + Math.max(0, owned.length - 1) * H.slotGap;
    const w = inner + H.barPadX * 2;
    const h = CHAR_H + H.barPadY * 2;
    const x0 = Math.round((R.viewW - w) / 2);
    const y0 = R.viewH - H.barBottom - h;
    this.barTop = owned.length > 0 ? y0 : R.viewH - H.barBottom;
    this.bar.clear();
    for (const [id, slot] of this.slots) {
      if (!owned.includes(id)) {
        slot.icon.setVisible(false);
        slot.text.setVisible(false);
      }
    }
    if (owned.length === 0) return;
    this.bar.fillStyle(PALETTE.panel, H.barAlpha).fillRect(x0, y0, w, h);
    this.bar.lineStyle(1, PALETTE.panellight, 1).strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
    let x = x0 + H.barPadX;
    owned.forEach((id, i) => {
      const slot = this.slot(id);
      const n = this.shownCount(id);
      // A brand-new item waits, dimmed, for its first pickup to land.
      slot.icon.setVisible(true).setPosition(x + ICON / 2, y0 + h / 2).setAlpha(n > 0 ? 1 : H.pendingAlpha);
      slot.text.setVisible(n > 0).setText(String(n)).setPosition(x + ICON + H.iconTextGap, y0 + H.barPadY);
      if (n > slot.shown) this.pop(slot.icon);
      slot.shown = n;
      x += widths[i]! + H.slotGap;
    });
  }

  private layoutHint(): void {
    const id = this.session.state.player.interactTarget;
    const hint = id ? this.hintFor(id) : undefined;
    const visible = hint !== undefined;
    this.hintKey.clear();
    for (const t of [this.hintKeyText, this.hintShadow, this.hintText]) t.setVisible(visible);
    if (!visible) return;
    const key = INTERACT_KEY[this.session.latch.lastDevice];
    const keyW = CHAR_W - 1 + H.keyPadX * 2;
    const w = keyW + H.hintGap + hint.length * CHAR_W - 1;
    const x = Math.round((R.viewW - w) / 2);
    const y = this.barTop - H.hintGap - CHAR_H;
    // A bone keycap with the key in ink, then the hint with an ink drop shadow.
    this.hintKey.fillStyle(PALETTE.ink, 1).fillRect(x, y - 1, keyW, CHAR_H + 1);
    this.hintKey.fillStyle(PALETTE.bone, 1).fillRect(x, y - 2, keyW, CHAR_H + 1);
    this.hintKeyText.setText(key).setPosition(x + H.keyPadX, y - 1);
    const tx = x + keyW + H.hintGap;
    this.hintShadow.setText(hint).setPosition(tx + 1, y);
    this.hintText.setText(hint).setPosition(tx, y - 1);
  }

  private shownCount(id: ItemId): number {
    return Math.max(0, this.session.state.inventory[id] - (this.inFlight[id] ?? 0));
  }

  private slot(id: ItemId): Slot {
    let s = this.slots.get(id);
    if (!s) {
      s = {
        icon: this.scene.add.image(0, 0, ATLAS, `icon_${id}`),
        text: addText(this.scene, 0, 0, '', 'bone'),
        shown: 0,
      };
      this.slots.set(id, s);
    }
    return s;
  }

  // An icon hops in an arc from the player to the item's slot; the slot follows the bar layout
  // live, since a new item can shift it mid-flight.
  private hop(id: ItemId, fromX: number, fromY: number): void {
    this.inFlight[id] = (this.inFlight[id] ?? 0) + 1;
    const img = this.scene.add.image(fromX, fromY, ATLAS, `icon_${id}`);
    const t = { v: 0 };
    this.scene.tweens.add({
      targets: t,
      v: 1,
      duration: H.hopMs,
      ease: 'Sine.In',
      onUpdate: () => {
        const to = this.slot(id).icon;
        img.setPosition(fromX + (to.x - fromX) * t.v, fromY + (to.y - fromY) * t.v - H.hopArcPx * 4 * t.v * (1 - t.v));
      },
      onComplete: () => {
        img.destroy();
        this.inFlight[id] = Math.max(0, (this.inFlight[id] ?? 0) - 1);
      },
    });
  }

  private pop(target: Phaser.GameObjects.Image | undefined): void {
    if (!target) return;
    const f = TUNING.fx;
    this.scene.tweens.killTweensOf(target);
    target.setScale(f.popScale);
    this.scene.tweens.add({ targets: target, scale: 1, duration: f.popMs, ease: 'Back.Out' });
  }
}
