import Phaser from 'phaser';
import { SHOP_LAYOUT, type StructureKind } from '../../data/content';
import type { GameEvent } from '../../core/events';
import { creatureDef } from '../../core/creatures';
import type { Area, CreatureState, NodeState, PickupState } from '../../core/state';
import { PALETTE } from '../../data/palette';
import { ticks, TUNING } from '../../data/tuning';
import {
  ENTRY_TILE,
  plotAtTile,
  plotOrigin,
  SHOP_H,
  SHOP_TX,
  SHOP_TY,
  SHOP_W,
  shopTileCenter,
  structureOfKind,
  structureStands,
  TILE,
  WORLD_H,
  WORLD_STRUCTURES,
  WORLD_TILES_H,
  WORLD_TILES_W,
  WORLD_W,
  type WorldStructure,
} from '../../core/world';
import { bedIndex, isReady } from '../../core/garden';
import { PATIENCE_TICKS, SHELVES, type Customer } from '../../core/shop';
import { STATION_KINDS, UNIT_TICKS } from '../../core/stations';
import type { DeviceReader } from '../../input/devices';
import { Fx } from '../fx';
import { ATLAS } from '../sprites/generate';
import { BACK_WALL } from '../sprites/interior';
import { CUSTOMER_LOOKS } from '../sprites/stall';
import { pump, type Session } from '../../input/session';

// Draw order: flat ground layers below everything that stands; standing things sort by their
// feet (depth = world y of the feet), fog covers the outdoor world, and bubbles, bars and
// particles sit on top of everything, the interior (which lies below the world) included.
const TOP = (SHOP_TY + SHOP_H + 1) * TILE;
const DEPTH = { water: -5, ground: -4, shore: -3, flat: -2, shadow: -1, fog: WORLD_H + 1, top: TOP };

const STRUCTURE_FRAME: Record<StructureKind, string> = {
  hut: 'hut',
  bed: 'bed_empty',
  signpost: 'signpost',
  shelf: 'shelf',
  counter: 'counter',
  sign: 'sign_closed',
  mortar: 'mortar',
  cauldron: 'cauldron_idle',
  cot: 'cot',
  exit: '',
};

// Weighted variety so the ground never reads as a flat fill.
const GRASS_FRAMES = ['grass_0', 'grass_0', 'grass_0', 'grass_0', 'grass_0', 'grass_1', 'grass_1', 'grass_2', 'grass_2', 'grass_2'];
const ROAD_FRAMES = ['road_0', 'road_1'];
const PLANK_FRAMES = ['floor_0', 'floor_0', 'floor_1', 'floor_2'];
const STONE_FRAMES = ['floor_back_0', 'floor_back_1'];

// Stable per-tile hash for picking variants (integer mixing constants, not tunables).
function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// GameScene re-emits each frame's sim events on game.events for the UI scene.
export const SIM_EVENTS = 'sim-events';

const LAND_TICKS = ticks(TUNING.pickup.landTime);
const V = TUNING.shopView;
const R = TUNING.render;
const ICON = 8;
const FEET = TUNING.player.hitboxH / 2;
const CAP = TUNING.shop.shelfCapacity;
const CAULDRON = structureOfKind('cauldron');

interface View {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
}

// A customer on screen: body, shadow, the bubble over the head and the item in it or carried.
interface Shopper {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Image;
  item: Phaser.GameObjects.Image;
  mode: Customer['mode'] | null;
}

const pick = (frames: readonly string[], x: number, y: number): string => frames[tileHash(x, y) % frames.length]!;

export class GameScene extends Phaser.Scene {
  private readonly session: Session;
  // Shared with the title screen, so a key held across the switch is not read as a new press.
  private readonly reader: DeviceReader;
  private player!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Image;
  private waterTiles: Phaser.GameObjects.Image[] = [];
  private structures: { s: WorldStructure; id: string; kind: StructureKind; img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image | null }[] = [];
  private nodeViews = new Map<number, View>();
  private creatureViews = new Map<number, View>();
  private pickupViews = new Map<number, View>();
  private shoppers = new Map<number, Shopper>();
  private wares: Phaser.GameObjects.Image[] = [];
  private fx!: Fx;
  private swingUntil = -Infinity;
  private fogs: { gx: number; gy: number; rect: Phaser.GameObjects.Rectangle }[] = [];
  // Progress bars over busy stations, shelf pips and patience bars, redrawn every frame.
  private bars!: Phaser.GameObjects.Graphics;
  // Shelf count pips, just in front of the tables.
  private pips!: Phaser.GameObjects.Graphics;
  private hearth!: Phaser.GameObjects.Image;
  private cameraArea: Area | null = null;

  constructor(session: Session, reader: DeviceReader) {
    super('game');
    this.session = session;
    this.reader = reader;
  }

  create(): void {
    this.drawGround();
    this.drawInterior();
    this.drawStructures();
    this.drawFog();
    this.bars = this.add.graphics().setDepth(DEPTH.top);
    const table = SHELVES[0]!;
    this.pips = this.add.graphics().setDepth(table.y + table.h + 1);
    this.wares = SHELVES.map(() => this.add.image(0, 0, ATLAS, 'icon_tonic').setOrigin(0.5, 1).setVisible(false));

    this.playerShadow = this.add.image(0, 0, ATLAS, 'shadow_s').setAlpha(R.shadowAlpha).setDepth(DEPTH.shadow);
    this.player = this.add.image(0, 0, ATLAS, 'player_down_0').setOrigin(0.5, 1);
    this.fx = new Fx(this, { viewOf: (id) => (this.nodeViews.get(id) ?? this.creatureViews.get(id))?.img, topDepth: DEPTH.top });
    this.syncPlayer();
    this.syncEntities();
    this.syncCamera();

    this.scene.launch('ui');
  }

  update(_time: number, delta: number): void {
    const { keys, pad } = this.reader.read();
    pump(this.session, keys, pad, delta);
    const events = this.session.events;
    this.session.events = [];
    this.onEvents(events);
    this.syncPlayer();
    this.syncCamera();
    this.syncEntities();
    this.syncWorld();
    this.syncShop();
    this.fx.update(delta);
  }

  // Fx first, while the views of things that just broke still exist; then the UI gets them.
  private onEvents(events: GameEvent[]): void {
    if (events.length === 0) return;
    for (const e of events) if (e.type === 'swing') this.swingUntil = this.time.now + TUNING.fx.swingPoseMs;
    this.fx.play(events);
    this.game.events.emit(SIM_EVENTS, events);
  }

  // Outdoors the camera follows the player within the world; indoors it holds the room centered,
  // on ink. A change of area snaps it (no glide across the map).
  private syncCamera(): void {
    const area = this.session.state.player.area;
    if (area === this.cameraArea) return;
    this.cameraArea = area;
    const cam = this.cameras.main;
    if (area === 'shop') {
      cam.stopFollow();
      cam.removeBounds();
      cam.centerOn((SHOP_TX + SHOP_W / 2) * TILE, (SHOP_TY + SHOP_H / 2) * TILE);
      return;
    }
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.player, true, R.cameraLerp, R.cameraLerp);
    cam.centerOn(this.player.x, this.player.y);
  }

  private isLand(tx: number, ty: number): boolean {
    return plotAtTile(this.session.state, tx, ty) !== undefined;
  }

  private drawGround(): void {
    const roadRow = TUNING.world.roadRow;
    for (let ty = 0; ty < WORLD_TILES_H; ty++) {
      for (let tx = 0; tx < WORLD_TILES_W; tx++) {
        const px = tx * TILE;
        const py = ty * TILE;
        const plot = plotAtTile(this.session.state, tx, ty);
        if (!plot) {
          this.waterTiles.push(this.add.image(px, py, ATLAS, 'water_0').setOrigin(0, 0).setDepth(DEPTH.water));
          const shore = this.shoreFrame(tx, ty);
          if (shore) this.add.image(px, py, ATLAS, shore).setOrigin(0, 0).setDepth(DEPTH.shore);
          continue;
        }
        const local = ty - plotOrigin(plot.gx, plot.gy).y;
        const frame = local === roadRow ? pick(ROAD_FRAMES, tx, ty) : pick(GRASS_FRAMES, tx, ty);
        this.add.image(px, py, ATLAS, frame).setOrigin(0, 0).setDepth(DEPTH.ground);
      }
    }
  }

  // Edges first, then corners: the land is one rectangle, so a water tile has at most one.
  private shoreFrame(tx: number, ty: number): string | null {
    const land = (dx: number, dy: number): boolean => this.isLand(tx + dx, ty + dy);
    if (land(0, 1)) return 'shore_top';
    if (land(0, -1)) return 'bank_front';
    if (land(1, 0)) return 'shore_left';
    if (land(-1, 0)) return 'shore_right';
    if (land(1, 1)) return 'shore_corner_tl';
    if (land(-1, 1)) return 'shore_corner_tr';
    if (land(1, -1)) return 'bank_corner_bl';
    if (land(-1, -1)) return 'bank_corner_br';
    return null;
  }

  // The interior, tile by tile, on an ink field that fills the view around it.
  private drawInterior(): void {
    const L = SHOP_LAYOUT;
    const { viewW, viewH } = R;
    const cx = (SHOP_TX + SHOP_W / 2) * TILE;
    const cy = (SHOP_TY + SHOP_H / 2) * TILE;
    this.add.rectangle(cx, cy, viewW * 2, viewH * 2, PALETTE.ink, 1).setDepth(DEPTH.water);
    const at = (tx: number, ty: number, frame: string, depth: number = DEPTH.ground): Phaser.GameObjects.Image =>
      this.add.image((SHOP_TX + tx) * TILE, (SHOP_TY + ty) * TILE, ATLAS, frame).setOrigin(0, 0).setDepth(depth);
    for (let tx = 0; tx < SHOP_W; tx++) at(tx, 0, BACK_WALL[tx] ?? 'wall_plain');
    for (let ty = 2; ty < SHOP_H; ty++) {
      for (let tx = 0; tx < SHOP_W; tx++) {
        const front = ty === SHOP_H - 1;
        let frame: string;
        if (front) frame = tx === L.exit.x ? 'threshold' : 'wall_front';
        else if (tx === 0) frame = 'wall_side_l';
        else if (tx === SHOP_W - 1) frame = 'wall_side_r';
        else if (tx === L.partitionX) frame = ty === L.partitionDoorY ? 'partition_door' : 'partition';
        else frame = tx < L.partitionX ? pick(PLANK_FRAMES, tx, ty) : pick(STONE_FRAMES, tx, ty);
        at(tx, ty, frame);
      }
    }
    const queue = L.queue[0]!;
    at(queue.x - 1, queue.y, 'rug', DEPTH.flat);
    at(L.entry.x, L.entry.y, 'doormat', DEPTH.flat);
    const c = CAULDRON;
    this.hearth = this.add
      .image(c.x + c.w / 2, c.y + c.h, ATLAS, 'hearth_glow')
      .setDepth(DEPTH.flat)
      .setAlpha(0);
  }

  private drawStructures(): void {
    for (const s of WORLD_STRUCTURES) {
      const frame = STRUCTURE_FRAME[s.def.kind];
      if (!frame) continue;
      const cx = s.x + s.w / 2;
      const bottom = s.y + s.h;
      const img = this.add.image(cx, bottom, ATLAS, frame).setOrigin(0.5, 1);
      if (s.def.kind === 'bed') {
        this.structures.push({ s, id: s.def.id, kind: s.def.kind, img, shadow: null });
        img.setDepth(DEPTH.flat);
        continue;
      }
      img.setDepth(bottom);
      const shadowFrame = s.w > TILE * 2 ? 'shadow_l' : 'shadow_m';
      const shadow = this.add.image(cx, bottom - 1, ATLAS, shadowFrame).setOrigin(0.5, 0.5).setAlpha(R.shadowAlpha).setDepth(DEPTH.shadow);
      // Stretched to the footprint (the cot is two tiles wide).
      shadow.setScale(s.w / shadow.width, 1);
      this.structures.push({ s, id: s.def.id, kind: s.def.kind, img, shadow });
    }
  }

  private drawFog(): void {
    const { plotW, plotH } = TUNING.world;
    for (const p of this.session.state.plots) {
      const o = plotOrigin(p.gx, p.gy);
      const rect = this.add
        .rectangle(o.x * TILE, o.y * TILE, plotW * TILE, plotH * TILE, PALETTE.ink, R.fogAlpha)
        .setOrigin(0, 0)
        .setDepth(DEPTH.fog);
      this.fogs.push({ gx: p.gx, gy: p.gy, rect });
    }
  }

  private syncPlayer(): void {
    const state = this.session.state;
    const p = state.player;
    const now = this.time.now;
    const feetBottom = p.y + FEET;
    const dir = p.facing === 'left' || p.facing === 'right' ? 'side' : p.facing;
    // Walk cycle: stand, stride, stand, stride; front and back mirror every other stride
    // so the lifted foot alternates.
    const phase = p.moving ? Math.floor(state.tick / R.walkFrameTicks) % 4 : 0;
    const swinging = now < this.swingUntil;
    const frame = swinging ? `player_${dir}_swing` : `player_${dir}_${phase % 2}`;
    const flip = dir === 'side' ? p.facing === 'left' : !swinging && phase === 3;
    this.player.setFrame(frame).setFlipX(flip).setPosition(p.x, feetBottom).setDepth(feetBottom);
    this.playerShadow.setPosition(p.x, feetBottom - 1);
    // Hurt: blink in heart red for a moment.
    const fx = TUNING.fx;
    const since = now - this.fx.hurtAt;
    if (since < fx.hurtFlashMs && Math.floor(since / fx.hurtBlinkMs) % 2 === 0) this.player.setTintFill(PALETTE.heart);
    else this.player.clearTint();
  }

  // Creates, moves and removes the sprites of nodes, creatures and pickups to match the state.
  private syncEntities(): void {
    const state = this.session.state;
    const { swingTarget } = state.player;
    const now = this.time.now;
    const nodeFeet = TUNING.node.hitboxH / 2;

    this.syncViews(this.nodeViews, state.nodes, 'shadow_s', (n: NodeState, v) => {
      const bottom = n.y + nodeFeet;
      v.img.setFrame(`node_${n.type}${swingTarget === n.id ? '_hl' : ''}`).setPosition(n.x, bottom).setDepth(bottom);
      v.shadow.setPosition(n.x, bottom - 1);
    });

    this.syncViews(this.creatureViews, state.creatures, 'shadow_s', (c: CreatureState, v) => {
      const bottom = c.y + creatureDef(c.type).hitboxH / 2;
      const hopping = c.mode !== 'idle' && c.stun === 0;
      const f = hopping ? Math.floor((now + c.id * R.hopFrameMs) / R.hopFrameMs) % 2 : 0;
      const faceLeft = c.mode === 'chase' ? state.player.x < c.x : c.dirX < 0;
      v.img
        .setFrame(`mudlet_${f}${swingTarget === c.id ? '_hl' : ''}`)
        .setFlipX(faceLeft)
        .setPosition(c.x, bottom - f * R.hopLiftPx)
        .setDepth(bottom);
      v.shadow.setPosition(c.x, bottom - 1);
    });

    this.syncViews(this.pickupViews, state.pickups, 'shadow_xs', (k: PickupState, v) => {
      let x = k.x;
      let y = k.y;
      let lift: number;
      if (k.landing > 0) {
        // Arc out from where it dropped.
        const t = 1 - k.landing / LAND_TICKS;
        x = k.fromX + (k.x - k.fromX) * t;
        y = k.fromY + (k.y - k.fromY) * t;
        lift = R.pickupArcPx * 4 * t * (1 - t);
      } else {
        lift = Math.round(R.pickupBobPx * (1 + Math.sin((now + k.id * R.pickupBobMs) / R.pickupBobMs)));
      }
      v.img.setFrame(`icon_${k.item}`).setPosition(x, y - lift).setDepth(y);
      v.shadow.setPosition(x, y);
    });
  }

  private syncViews<T extends { id: number }>(
    views: Map<number, View>,
    items: readonly T[],
    shadowFrame: string,
    place: (item: T, v: View) => void,
  ): void {
    const alive = new Set<number>();
    for (const it of items) {
      alive.add(it.id);
      let v = views.get(it.id);
      if (!v) {
        v = {
          img: this.add.image(0, 0, ATLAS, '__BASE').setOrigin(0.5, 1),
          shadow: this.add.image(0, 0, ATLAS, shadowFrame).setAlpha(R.shadowAlpha).setDepth(DEPTH.shadow),
        };
        views.set(it.id, v);
      }
      place(it, v);
    }
    for (const [id, v] of views) {
      if (alive.has(id)) continue;
      v.img.destroy();
      v.shadow.destroy();
      views.delete(id);
    }
  }

  private bedFrame(id: string): string {
    const bed = this.session.state.garden[bedIndex(id)];
    if (!bed || bed.crop === null) return STRUCTURE_FRAME.bed;
    return `bed_${isReady(bed) ? 'ready' : 'sprout'}_${bed.crop}`;
  }

  // A bar over each busy station filling up toward its next unit: ink track, bone fill.
  private drawStationBars(g: Phaser.GameObjects.Graphics): void {
    for (const kind of STATION_KINDS) {
      const job = this.session.state.stations[kind];
      const view = this.structures.find((s) => s.kind === kind);
      if (!job || !view) continue;
      const x = Math.round(view.img.x - R.stationBarW / 2);
      const y = Math.round(view.img.y - view.img.height - R.stationBarGap - R.stationBarH);
      const fill = Math.round((R.stationBarW * job.progress) / UNIT_TICKS[kind]);
      g.fillStyle(PALETTE.ink, 1).fillRect(x, y, R.stationBarW, R.stationBarH);
      g.fillStyle(PALETTE.bone, 1).fillRect(x, y, fill, R.stationBarH);
    }
  }

  private syncWorld(): void {
    const state = this.session.state;
    const { interactTarget, swingTarget } = state.player;
    const waterFrame = `water_${Math.floor(this.time.now / R.waterFrameMs) % 2}`;
    if (this.waterTiles[0]?.frame.name !== waterFrame) {
      for (const t of this.waterTiles) t.setFrame(waterFrame);
    }
    // The cauldron bubbles, and its hearth glows on the floor, only while it brews.
    const brewing = state.stations.cauldron !== null;
    const cauldronFrame = brewing ? `cauldron_${Math.floor(this.time.now / R.cauldronFrameMs) % 2}` : STRUCTURE_FRAME.cauldron;
    const pulse = 1 + Math.sin(this.time.now / V.glowPulseMs) / 4;
    this.hearth.setAlpha(brewing ? V.glowAlpha * pulse : 0);
    const signFrame = state.shop.phase === 'open' ? 'sign_open' : 'sign_closed';
    for (const s of this.structures) {
      // A signpost is gone once its plot is bought.
      const stands = structureStands(state, s.s);
      s.img.setVisible(stands);
      s.shadow?.setVisible(stands);
      let base = STRUCTURE_FRAME[s.kind];
      if (s.kind === 'cauldron') base = cauldronFrame;
      else if (s.kind === 'bed') base = this.bedFrame(s.id);
      else if (s.kind === 'sign') base = signFrame;
      // A ready bed can also be the swing target.
      s.img.setFrame(interactTarget === s.id || swingTarget === s.id ? `${base}_hl` : base);
    }
    for (const f of this.fogs) {
      const owned = state.plots.find((p) => p.gx === f.gx && p.gy === f.gy)?.owned ?? false;
      f.rect.setVisible(!owned);
    }
  }

  // Shelves show their ware and a pip per unit; customers walk, react, carry and wait.
  private syncShop(): void {
    const state = this.session.state;
    const g = this.bars.clear();
    const pips = this.pips.clear();
    this.drawStationBars(g);
    state.shop.shelves.forEach((sl, i) => {
      const s = SHELVES[i]!;
      const ware = this.wares[i]!;
      const cx = s.x + s.w / 2;
      ware.setVisible(sl.item !== null);
      if (sl.item === null) return;
      ware.setFrame(`icon_${sl.item}`).setPosition(cx, s.y + V.wareLiftPx).setDepth(s.y + s.h + 1);
      // Count pips on the table's apron, one per unit out of the capacity: bone full, ink empty.
      const pip = V.pipSize;
      const w = CAP * pip + (CAP - 1) * V.pipGap;
      const x0 = Math.round(cx - w / 2);
      const y = s.y + s.h - TILE / 2;
      for (let k = 0; k < CAP; k++) {
        pips.fillStyle(k < sl.count ? PALETTE.bone : PALETTE.ink, 1).fillRect(x0 + k * (pip + V.pipGap), y, pip, pip);
      }
    });
    this.syncShoppers(g);
  }

  private shopper(): Shopper {
    return {
      img: this.add.image(0, 0, ATLAS, 'customer_0_up_0').setOrigin(0.5, 1),
      shadow: this.add.image(0, 0, ATLAS, 'shadow_s').setAlpha(R.shadowAlpha).setDepth(DEPTH.shadow),
      bubble: this.add.image(0, 0, ATLAS, 'bubble_wait').setOrigin(0.5, 1).setDepth(DEPTH.top).setVisible(false),
      item: this.add.image(0, 0, ATLAS, 'icon_tonic').setOrigin(0.5, 1).setDepth(DEPTH.top).setVisible(false),
      mode: null,
    };
  }

  private syncShoppers(g: Phaser.GameObjects.Graphics): void {
    const state = this.session.state;
    const now = this.time.now;
    const entry = shopTileCenter(ENTRY_TILE.x - SHOP_TX, ENTRY_TILE.y - SHOP_TY);
    const alive = new Set<number>();
    for (const c of state.shop.customers) {
      alive.add(c.n);
      let v = this.shoppers.get(c.n);
      if (!v) {
        v = this.shopper();
        this.shoppers.set(c.n, v);
      }
      const look = (c.n + state.day) % CUSTOMER_LOOKS;
      const dir = c.facing === 'left' || c.facing === 'right' ? 'side' : c.facing;
      const walking = c.path.length > 0;
      const f = walking ? Math.floor(state.tick / V.walkFrameTicks) % 2 : 0;
      const bottom = c.y + FEET;
      // Fade in on the doormat, fade out back onto it.
      const alpha = Math.min(1, Math.hypot(c.x - entry.x, c.y - entry.y) / (V.edgeFadeTicks * (TUNING.shop.customerSpeed / TUNING.sim.tickRate)));
      v.img.setFrame(`customer_${look}_${dir}_${f}`).setFlipX(c.facing === 'left').setPosition(c.x, bottom).setDepth(bottom).setAlpha(alpha);
      v.shadow.setPosition(c.x, bottom - 1).setAlpha(R.shadowAlpha * alpha);
      const head = bottom - v.img.height - V.bubbleLiftPx;
      // The look: the reaction pops up. Then the item rides over the head to the counter, where a
      // bone bubble shows it and a bar under it drains (ember in the last third).
      if (c.mode === 'look' && c.reaction) {
        if (v.mode !== 'look') this.pop(v.bubble.setFrame(`bubble_${c.reaction}`));
        v.bubble.setVisible(true).setPosition(c.x, head);
        v.item.setVisible(false);
      } else if (c.holding && c.waited >= 0 && c.item) {
        v.bubble.setFrame('bubble_wait').setVisible(true).setScale(1).setPosition(c.x, head);
        v.item.setFrame(`icon_${c.item}`).setVisible(true).setPosition(c.x, head - v.bubble.height + 1 + ICON);
        const left = Math.max(0, 1 - c.waited / PATIENCE_TICKS);
        const w = v.bubble.width;
        const x = Math.round(c.x - w / 2);
        const y = Math.round(head - v.bubble.height - V.bubbleLiftPx - V.patienceBarH);
        g.fillStyle(PALETTE.ink, 1).fillRect(x, y, w, V.patienceBarH);
        g.fillStyle(left <= V.patienceWarn ? PALETTE.ember : PALETTE.bone, 1).fillRect(x, y, Math.round(w * left), V.patienceBarH);
      } else if (c.holding && c.item) {
        const bob = Math.round(Math.sin(now / V.carryBobMs));
        v.bubble.setVisible(false);
        v.item.setFrame(`icon_${c.item}`).setVisible(true).setPosition(c.x, head - V.carryLiftPx + bob);
      } else {
        v.bubble.setVisible(false);
        v.item.setVisible(false);
      }
      v.mode = c.mode;
    }
    for (const [n, v] of this.shoppers) {
      if (alive.has(n)) continue;
      for (const o of [v.img, v.shadow, v.bubble, v.item]) o.destroy();
      this.shoppers.delete(n);
    }
  }

  private pop(img: Phaser.GameObjects.Image): void {
    img.setScale(V.popScale);
    this.tweens.add({ targets: img, scale: 1, duration: V.popMs, ease: 'Back.Out' });
  }
}
