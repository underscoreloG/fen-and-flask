// Stall panel (specs/design.md Screens). Setup: one row per potion you own (icon, name, count,
// price); left/right changes the selected price, confirm opens, back leaves (prices kept). Open:
// the same rows in a narrow left column while customers come in the world; price changes and
// back (close) are sent live, since the sim keeps running. Done: "Sold N potions for C coins".
import type Phaser from 'phaser';
import type { Command } from '../../core/commands';
import type { GameState } from '../../core/state';
import { POTION_IDS, WALK_TICKS, type Reaction } from '../../core/stall';
import { plotTileCenter, WORLD_H } from '../../core/world';
import { ITEMS, PLOT_LAYOUTS, PLOTS, type PotionId } from '../../data/content';
import { PALETTE } from '../../data/palette';
import { TUNING } from '../../data/tuning';
import type { Device, UiIntents } from '../../input/input';
import { addText } from '../font';
import { ATLAS } from '../sprites/generate';
import { CUSTOMER_LOOKS } from '../sprites/stall';
import { ListPanel, panelBox, UI_DEPTH, type Panel } from './confirm';

const K = TUNING.panel;
const R = TUNING.render;
const V = TUNING.stallView;
const ICON = 8;
const CHAR_W = R.fontCellW;
const CHAR_H = R.fontCellH;
const TEXT_DY = Math.floor((K.rowH - CHAR_H) / 2) + 1;
const PRICE_W = V.priceChars * CHAR_W;
const COUNT_W = V.countChars * CHAR_W;
const KEYS: Record<Device, { ok: string; back: string }> = { keyboard: { ok: 'C', back: 'X' }, gamepad: { ok: 'A', back: 'B' } };

const potionName = (id: PotionId): string => ITEMS.find((i) => i.id === id)?.name ?? id;

// A box of potion rows with a cursor; counts and prices are rewritten in place.
class PriceList {
  selected = 0;
  readonly potions: readonly PotionId[];
  private readonly parts: Phaser.GameObjects.GameObject[] = [];
  private readonly cursor: Phaser.GameObjects.Graphics;
  private readonly counts: Phaser.GameObjects.BitmapText[] = [];
  private readonly prices: Phaser.GameObjects.BitmapText[] = [];
  private readonly icons: Phaser.GameObjects.Image[] = [];
  private readonly x0: number;
  private readonly w: number;
  private readonly rowsTop: number;

  constructor(
    scene: Phaser.Scene,
    title: string,
    potions: readonly PotionId[],
    names: boolean,
    footer: readonly string[],
    place: { x0: number | null; y0: number | null },
  ) {
    this.potions = potions;
    const nameW = names ? Math.max(0, ...potions.map((p) => potionName(p).length * CHAR_W)) + K.countGap : 0;
    const rowW = ICON + K.iconGap + nameW + COUNT_W + K.countGap + PRICE_W + 1 + ICON;
    const inner = Math.max(title.length * CHAR_W, rowW, ...footer.map((f) => f.length * CHAR_W));
    this.w = Math.min(K.maxW, inner + K.padX * 2);
    const h = K.padY * 2 + CHAR_H + K.titleGap + Math.max(1, potions.length) * K.rowH + footer.length * (CHAR_H + K.footerGap);
    this.x0 = place.x0 ?? Math.round((R.viewW - this.w) / 2);
    const y0 = place.y0 ?? Math.round((R.viewH - h) / 2);
    this.rowsTop = y0 + K.padY + CHAR_H + K.titleGap;
    this.parts.push(panelBox(scene, this.x0, y0, this.w, h));
    this.cursor = scene.add.graphics().setDepth(UI_DEPTH.panel);
    this.parts.push(this.cursor);
    this.parts.push(addText(scene, this.x0 + K.padX, y0 + K.padY, title, 'coin').setDepth(UI_DEPTH.panel));
    const right = this.x0 + this.w - K.padX;
    potions.forEach((p, i) => {
      const y = this.rowsTop + i * K.rowH;
      const icon = scene.add.image(this.x0 + K.padX, y + K.rowH / 2, ATLAS, `icon_${p}`).setOrigin(0, 0.5).setDepth(UI_DEPTH.panel);
      this.icons.push(icon);
      this.parts.push(icon);
      if (names) this.parts.push(addText(scene, this.x0 + K.padX + ICON + K.iconGap, y + TEXT_DY, potionName(p), 'bone').setDepth(UI_DEPTH.panel));
      const coinX = right - ICON;
      this.parts.push(scene.add.image(coinX, y + K.rowH / 2, ATLAS, 'coin').setOrigin(0, 0.5).setDepth(UI_DEPTH.panel));
      const price = addText(scene, coinX - 1, y + TEXT_DY, '', 'coin').setOrigin(1, 0).setDepth(UI_DEPTH.panel);
      const count = addText(scene, coinX - 1 - PRICE_W - K.countGap, y + TEXT_DY, '', 'bone').setOrigin(1, 0).setDepth(UI_DEPTH.panel);
      this.prices.push(price);
      this.counts.push(count);
      this.parts.push(price, count);
    });
    if (potions.length === 0) {
      this.parts.push(addText(scene, this.x0 + K.padX, this.rowsTop + TEXT_DY, 'NO POTIONS', 'bone').setAlpha(K.dimAlpha).setDepth(UI_DEPTH.panel));
    }
    footer.forEach((f, j) => {
      const fy = this.rowsTop + Math.max(1, potions.length) * K.rowH + K.footerGap + j * (CHAR_H + K.footerGap);
      this.parts.push(addText(scene, this.x0 + K.padX, fy, f, 'bone').setDepth(UI_DEPTH.panel));
    });
    this.drawCursor();
  }

  // Up/down move the cursor (wrapping); left/right give -1 / +1.
  move(intents: UiIntents): number {
    const n = this.potions.length;
    if (n > 0 && (intents.up || intents.down)) {
      this.selected = (this.selected + (intents.down ? 1 : -1) + n) % n;
      this.drawCursor();
    }
    return (intents.right ? 1 : 0) - (intents.left ? 1 : 0);
  }

  show(i: number, count: number, price: number): void {
    this.counts[i]?.setText(`X${count}`);
    this.prices[i]?.setText(String(price));
    const alpha = count > 0 ? 1 : K.dimAlpha;
    this.icons[i]?.setAlpha(alpha);
    this.counts[i]?.setAlpha(alpha);
  }

  destroy(): void {
    for (const p of this.parts) p.destroy();
  }

  private drawCursor(): void {
    this.cursor.clear();
    if (this.potions.length === 0) return;
    this.cursor.fillStyle(PALETTE.panellight, 1).fillRect(this.x0 + 1, this.rowsTop + this.selected * K.rowH, this.w - 2, K.rowH);
  }
}

// Prices the player is editing: start from the state, step 1, never below the minimum.
function editPrice(prices: Record<PotionId, number>, p: PotionId, delta: number): number {
  prices[p] = Math.max(TUNING.stall.priceMin, prices[p] + delta * TUNING.stall.priceStep);
  return prices[p];
}

const setPrices = (prices: Record<PotionId, number>, potions: readonly PotionId[]): Command[] =>
  potions.map((potion) => ({ type: 'SetPrice', potion, price: prices[potion] }));

export function stallSetup(scene: Phaser.Scene, state: GameState, device: Device): Panel {
  const potions = POTION_IDS.filter((p) => state.inventory[p] > 0);
  const prices = { ...state.stall.prices };
  const k = KEYS[device];
  const footer = potions.length > 0 ? ['-/+ PRICE', `${k.ok} OPEN   ${k.back} BACK`] : [`${k.back} BACK`];
  const list = new PriceList(scene, 'STALL', potions, true, footer, { x0: null, y0: null });
  const show = (): void => potions.forEach((p, i) => list.show(i, state.inventory[p], prices[p]));
  show();
  return {
    update(intents) {
      if (intents.back) return setPrices(prices, potions);
      if (intents.confirm) return potions.length > 0 ? [...setPrices(prices, potions), { type: 'OpenStall' }] : [];
      const d = list.move(intents);
      const p = potions[list.selected];
      if (d !== 0 && p) editPrice(prices, p, d);
      show();
      return null;
    },
    destroy: () => list.destroy(),
  };
}

// The open stall: not a pausing Panel. update returns the commands to send live this frame.
export class StallOpenView {
  private readonly list: PriceList;
  private readonly prices: Record<PotionId, number>;

  constructor(scene: Phaser.Scene, state: GameState, device: Device) {
    const potions = POTION_IDS.filter((p) => state.inventory[p] > 0);
    this.prices = { ...state.stall.prices };
    const k = KEYS[device];
    this.list = new PriceList(scene, 'OPEN', potions, false, ['-/+ PRICE', `${k.back} CLOSE`], { x0: V.columnX, y0: V.columnTop });
  }

  update(intents: UiIntents, state: GameState, readOnly: boolean): Command[] {
    const out: Command[] = [];
    if (!readOnly) {
      if (intents.back) out.push({ type: 'CloseStall' });
      const d = this.list.move(intents);
      const p = this.list.potions[this.list.selected];
      if (d !== 0 && p) out.push({ type: 'SetPrice', potion: p, price: editPrice(this.prices, p, d) });
    } else {
      // The bot sets prices itself: just mirror them.
      Object.assign(this.prices, state.stall.prices);
    }
    this.list.potions.forEach((p, i) => this.list.show(i, state.inventory[p], this.prices[p]));
    return out;
  }

  destroy(): void {
    this.list.destroy();
  }
}

export function stallSummary(scene: Phaser.Scene, soldCount: number, soldCoins: number): Panel {
  const what = soldCount === 1 ? 'POTION' : 'POTIONS';
  const list = new ListPanel(scene, `SOLD ${soldCount} ${what} FOR ${soldCoins} COINS`, [{ label: 'OK' }]);
  return {
    update: (intents) => (list.update(intents) !== null ? [] : null),
    destroy: () => list.destroy(),
  };
}

// --- Travellers in the world (drawn by GameScene) -------------------------------------------

interface Figure {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Image;
}

interface Leaver {
  n: number;
  look: number;
  reaction: Reaction | null;
  // Path position it turned back from, and the render time (ms) it did: the walk out runs on
  // render time, so it carries on behind the summary panel while the sim is paused.
  u0: number;
  from: number;
  fig: Figure;
}

const HOME = PLOTS[0]!;
const LAYOUT = PLOT_LAYOUTS.home;
const ENTRY = plotTileCenter(HOME.gx, HOME.gy, LAYOUT.customerEntry?.x ?? 0, LAYOUT.customerEntry?.y ?? 0);
const SPOT = plotTileCenter(HOME.gx, HOME.gy, LAYOUT.customerSpot?.x ?? 0, LAYOUT.customerSpot?.y ?? 0);
const LEG1 = Math.abs(SPOT.x - ENTRY.x);
const LEG2 = Math.abs(SPOT.y - ENTRY.y);
const FEET = TUNING.player.hitboxH / 2;
const MS_PER_TICK = 1000 / TUNING.sim.tickRate;

// u in [0, 1]: east along the road from the entry, then up to the spot.
function pathAt(u: number): { x: number; y: number } {
  const d = Math.max(0, Math.min(1, u)) * (LEG1 + LEG2);
  if (d <= LEG1) return { x: ENTRY.x + Math.sign(SPOT.x - ENTRY.x) * d, y: ENTRY.y };
  return { x: SPOT.x, y: ENTRY.y + Math.sign(SPOT.y - ENTRY.y) * (d - LEG1) };
}

// Walk in along the road, a reaction bubble at the spot (popped in), walk back out west while
// the next one comes in. Purely visual: the walk out is not in the sim.
export class StallCrowd {
  private readonly scene: Phaser.Scene;
  private readonly shadowDepth: number;
  private current: { n: number; look: number; t: number; reaction: Reaction | null; fig: Figure } | null = null;
  private leavers: Leaver[] = [];

  constructor(scene: Phaser.Scene, shadowDepth: number) {
    this.scene = scene;
    this.shadowDepth = shadowDepth;
  }

  sync(state: GameState): void {
    const c = state.stall.customer;
    if (this.current && (!c || c.n !== this.current.n || state.stall.phase !== 'open')) {
      const cur = this.current;
      const from = this.scene.time.now;
      this.leavers.push({ n: cur.n, look: cur.look, reaction: cur.reaction, u0: Math.min(1, cur.t / WALK_TICKS), from, fig: cur.fig });
      this.current = null;
    }
    if (c && state.stall.phase === 'open') {
      if (!this.current) {
        this.current = { n: c.n, look: (c.n + state.day) % CUSTOMER_LOOKS, t: c.t, reaction: null, fig: this.figure() };
      }
      const cur = this.current;
      cur.t = c.t;
      const arrived = c.t >= WALK_TICKS;
      this.place(cur.fig, cur.look, Math.min(1, c.t / WALK_TICKS), !arrived, false, state.tick);
      if (arrived && c.reaction && cur.reaction === null) {
        cur.reaction = c.reaction;
        this.popBubble(cur.fig.bubble, c.reaction);
      }
      cur.fig.bubble.setVisible(cur.reaction !== null);
    }
    this.leavers = this.leavers.filter((l) => {
      const now = this.scene.time.now;
      const e = (now - l.from) / (WALK_TICKS * MS_PER_TICK);
      const u = l.u0 - e;
      if (u <= 0) {
        for (const o of [l.fig.img, l.fig.shadow, l.fig.bubble]) o.destroy();
        return false;
      }
      // Render time in ticks drives the walk frames too.
      this.place(l.fig, l.look, u, true, true, now / MS_PER_TICK);
      const linger = V.bubbleLingers;
      l.fig.bubble.setVisible(l.reaction !== null && e < linger).setAlpha(Math.max(0, 1 - e / linger));
      return true;
    });
  }

  private figure(): Figure {
    const s = this.scene;
    return {
      img: s.add.image(0, 0, ATLAS, 'customer_0_0').setOrigin(0.5, 1),
      shadow: s.add.image(0, 0, ATLAS, 'shadow_s').setAlpha(R.shadowAlpha).setDepth(this.shadowDepth),
      bubble: s.add.image(0, 0, ATLAS, 'bubble_happy').setOrigin(0.5, 1).setVisible(false).setDepth(WORLD_H),
    };
  }

  private place(f: Figure, look: number, u: number, walking: boolean, leaving: boolean, tick: number): void {
    const p = pathAt(u);
    const bottom = p.y + FEET;
    const frame = walking ? Math.floor(tick / V.walkFrameTicks) % 2 : 0;
    const alpha = Math.min(1, u / V.edgeFade);
    f.img.setFrame(`customer_${look}_${frame}`).setFlipX(leaving).setPosition(p.x, bottom).setDepth(bottom).setAlpha(alpha);
    f.shadow.setPosition(p.x, bottom - 1).setAlpha(R.shadowAlpha * alpha);
    f.bubble.setPosition(p.x, bottom - f.img.height - V.bubbleLiftPx);
  }

  private popBubble(b: Phaser.GameObjects.Image, r: Reaction): void {
    b.setFrame(`bubble_${r}`).setVisible(true).setAlpha(1).setScale(V.popScale);
    this.scene.tweens.add({ targets: b, scale: 1, duration: V.popMs, ease: 'Back.Out' });
  }
}
