import Phaser from 'phaser';
import { SHOP_LAYOUT, TOAD_SPOTS, type StructureKind } from '../../data/content';
import type { GameEvent } from '../../core/events';
import { creatureDef } from '../../core/creatures';
import type { Area, CreatureState, NodeState, PickupState } from '../../core/state';
import { PALETTE } from '../../data/palette';
import { ticks, TUNING } from '../../data/tuning';
import {
  ENTRY_TILE,
  plotAtTile,
  plotOrigin,
  plotTileCenter,
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
import { owns } from '../../core/catalog';
import { patienceTicks, shelfCapacity, SHELVES, type Customer } from '../../core/shop';
import { isCauldron, STATION_KINDS, STATION_STRUCTURES, unitTicks, type StationKind } from '../../core/stations';
import type { DeviceReader } from '../../input/devices';
import { Fx } from '../fx';
import { ATLAS } from '../sprites/generate';
import { BACK_WALL } from '../sprites/interior';
import { SPRITES } from '../sprites/index';
import { TILL_KEYS_AT } from '../sprites/toads';
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
  catalog: 'catalog',
  board: 'order_board',
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
const CAULDRONS = STATION_KINDS.filter(isCauldron);
const COUNTER = structureOfKind('counter');

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
  // Shelf count pips, just in front of each table (one layer per table, sorted with it).
  private pips: Phaser.GameObjects.Graphics[] = [];
  // The glow under each cauldron, by station.
  private hearths: { kind: StationKind; img: Phaser.GameObjects.Image }[] = [];
  // The delivery crate by the door, from a morning something arrived until the player passes it.
  private crate!: Phaser.GameObjects.Image;
  private cameraArea: Area | null = null;
  // The helper toads (specs/wp/WP08), shown once owned; the counter toad hops and the till flashes
  // when it rings someone up.
  private toads: { spot: keyof typeof TOAD_SPOTS; img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image | null; y: number }[] = [];
  private tillFlash!: Phaser.GameObjects.Image;
  private toadRangAt = -Infinity;

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
    this.pips = SHELVES.map((t) => this.add.graphics().setDepth(t.y + t.h + 1));
    const crate = shopTileCenter(SHOP_LAYOUT.crate.x, SHOP_LAYOUT.crate.y);
    this.crate = this.add.image(crate.x, crate.y + TILE / 2, ATLAS, 'crate').setOrigin(0.5, 1).setDepth(crate.y + TILE / 2).setVisible(false);
    this.wares = SHELVES.map(() => this.add.image(0, 0, ATLAS, 'icon_tonic').setOrigin(0.5, 1).setVisible(false));
    this.drawToads();

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
    this.syncToads();
    this.fx.update(delta);
  }

  // Fx first, while the views of things that just broke still exist; then the UI gets them.
  private onEvents(events: GameEvent[]): void {
    if (events.length === 0) return;
    for (const e of events) {
      if (e.type === 'swing') this.swingUntil = this.time.now + TUNING.fx.swingPoseMs;
      else if (e.type === 'upgradeArrived') this.crate.setVisible(true);
      else if (e.type === 'toadRang') this.toadRangAt = this.time.now;
    }
    this.fx.play(events);
    this.game.events.emit(SIM_EVENTS, events);
  }

  // Outdoors the camera follows the player within the world (which always fills the view);
  // indoors it holds the room centered, on ink. A change of area snaps it (no glide across the map).
  private syncCamera(): void {
    const area = this.session.state.player.area;
    if (area === this.cameraArea) return;
    this.cameraArea = area;
    const cam = this.cameras.main;
    if (area === 'shop') {
      cam.stopFollow();
      cam.removeBounds();
      cam.setBackgroundColor(PALETTE.ink);
      cam.centerOn((SHOP_TX + SHOP_W / 2) * TILE, (SHOP_TY + SHOP_H / 2) * TILE);
      return;
    }
    cam.setBackgroundColor(PALETTE.deepwater);
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

  // The interior, tile by tile (the camera's ink background fills the view around it).
  private drawInterior(): void {
    const L = SHOP_LAYOUT;
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
    for (const kind of CAULDRONS) {
      const c = STATION_STRUCTURES[kind];
      this.hearths.push({ kind, img: this.add.image(c.x + c.w / 2, c.y + c.h, ATLAS, 'hearth_glow').setDepth(DEPTH.flat).setAlpha(0) });
    }
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
      // The order board hangs on the wall: no shadow on the floor.
      if (s.def.kind === 'board') {
        this.structures.push({ s, id: s.def.id, kind: s.def.kind, img, shadow: null });
        continue;
      }
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
    // The copper sickle shows in the swing pose.
    const tool = owns(state, 'sickle') ? '_copper' : '';
    const frame = swinging ? `player_${dir}_swing${tool}` : `player_${dir}_${phase % 2}`;
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
    const state = this.session.state;
    for (const kind of STATION_KINDS) {
      const job = state.stations[kind];
      const view = this.structures.find((s) => s.id === kind);
      if (!job || !view) continue;
      const x = Math.round(view.img.x - R.stationBarW / 2);
      const y = Math.round(view.img.y - view.img.height - R.stationBarGap - R.stationBarH);
      const fill = Math.round((R.stationBarW * job.progress) / unitTicks(state, kind));
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
    // A cauldron bubbles, and its hearth glows on the floor, only while it brews.
    const bubbling = `cauldron_${Math.floor(this.time.now / R.cauldronFrameMs) % 2}`;
    const pulse = 1 + Math.sin(this.time.now / V.glowPulseMs) * V.glowPulseAmp;
    for (const h of this.hearths) h.img.setAlpha(state.stations[h.kind] !== null ? V.glowAlpha * pulse : 0);
    const signFrame = state.shop.phase === 'open' ? 'sign_open' : 'sign_closed';
    // The catalog's looks: the stone mortar, the hut's painted board and then its lantern.
    const mortarFrame = owns(state, 'stoneMortar') ? 'mortar_stone' : STRUCTURE_FRAME.mortar;
    const hutFrame = owns(state, 'lanternSign') ? 'hut_lantern' : owns(state, 'signboard') ? 'hut_board' : STRUCTURE_FRAME.hut;
    this.syncCrate();
    for (const s of this.structures) {
      // A signpost is gone once its plot is bought.
      const stands = structureStands(state, s.s);
      s.img.setVisible(stands);
      s.shadow?.setVisible(stands);
      let base = STRUCTURE_FRAME[s.kind];
      if (s.kind === 'cauldron') base = state.stations[s.id as StationKind] ? bubbling : STRUCTURE_FRAME.cauldron;
      else if (s.kind === 'mortar') base = mortarFrame;
      else if (s.kind === 'hut') base = hutFrame;
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

  // The counter toad sits on the counter's left end, its feet on the top; the garden and basket
  // toads stand on their tiles with a shadow. None of them is solid or a target.
  private drawToads(): void {
    const cy = COUNTER.y + COUNTER.h;
    for (const spot of ['counter', 'garden', 'basket'] as const) {
      const t = TOAD_SPOTS[spot];
      const c = t.area === 'shop' ? shopTileCenter(t.x, t.y) : plotTileCenter(0, 0, t.x, t.y);
      const onCounter = spot === 'counter';
      const y = onCounter ? cy - V.toadOnCounterPx : c.y + TILE / 2;
      const img = this.add.image(c.x, y, ATLAS, `toad_${spot}_0`).setOrigin(0.5, 1).setDepth(onCounter ? cy + 1 : y).setVisible(false);
      const shadow = onCounter ? null : this.add.image(c.x, y - 1, ATLAS, 'shadow_s').setAlpha(R.shadowAlpha).setDepth(DEPTH.shadow).setVisible(false);
      this.toads.push({ spot, img, shadow, y });
    }
    // The counter's art stands taller than its footprint; the till keys sit in that art.
    const top = cy - SPRITES.counter!.h;
    this.tillFlash = this.add
      .image(COUNTER.x + TILL_KEYS_AT.x, top + TILL_KEYS_AT.y, ATLAS, 'till_flash')
      .setOrigin(0, 0)
      .setDepth(cy + 1)
      .setVisible(false);
  }

  private syncToads(): void {
    const state = this.session.state;
    const now = this.time.now;
    const idle = Math.floor(now / V.toadIdleMs) % 2;
    const hopping = now - this.toadRangAt < V.toadHopMs;
    const owned = { counter: owns(state, 'counterToad'), garden: owns(state, 'gardenToad'), basket: owns(state, 'basketToad') };
    const look = { counter: owns(state, 'counterToad2') ? 'counter2' : 'counter', garden: 'garden', basket: owns(state, 'basketToad2') ? 'basket2' : 'basket' };
    for (const t of this.toads) {
      const lift = t.spot === 'counter' && hopping ? V.toadHopPx : 0;
      t.img.setVisible(owned[t.spot]).setFrame(`toad_${look[t.spot]}_${hopping && t.spot === 'counter' ? 1 : idle}`).setY(t.y - lift);
      t.shadow?.setVisible(owned[t.spot]);
    }
    this.tillFlash.setVisible(now - this.toadRangAt < V.tillFlashMs);
  }

  // The crate goes once the player walks past it (within a tile of it, indoors).
  private syncCrate(): void {
    const p = this.session.state.player;
    const c = SHOP_LAYOUT.crate;
    const near = Math.abs(Math.floor(p.x / TILE) - SHOP_TX - c.x) <= V.crateClearTiles && Math.abs(Math.floor(p.y / TILE) - SHOP_TY - c.y) <= V.crateClearTiles;
    if (p.area === 'shop' && near) this.crate.setVisible(false);
  }

  // Shelves show their ware and a pip per unit; customers walk, react, carry and wait.
  private syncShop(): void {
    const state = this.session.state;
    const g = this.bars.clear();
    for (const p of this.pips) p.clear();
    this.drawStationBars(g);
    const cap = shelfCapacity(state);
    // Pips wrap into rows of at most pipsPerRow, so 8 still fit on a 16 px table.
    const rows = Math.ceil(cap / V.pipsPerRow);
    const perRow = Math.ceil(cap / rows);
    state.shop.shelves.forEach((sl, i) => {
      const s = SHELVES[i]!;
      const ware = this.wares[i]!;
      const cx = s.x + s.w / 2;
      ware.setVisible(sl.item !== null);
      if (sl.item === null) return;
      ware.setFrame(`icon_${sl.item}`).setPosition(cx, s.y + V.wareLiftPx).setDepth(s.y + s.h + 1);
      // Count pips on the table's apron, one per unit out of the capacity: bone full, ink empty.
      const pip = V.pipSize;
      const w = perRow * pip + (perRow - 1) * V.pipGap;
      const x0 = Math.round(cx - w / 2);
      const y0 = s.y + s.h - TILE / 2;
      for (let k = 0; k < cap; k++) {
        const x = x0 + (k % perRow) * (pip + V.pipGap);
        const y = y0 + Math.floor(k / perRow) * (pip + V.pipGap);
        this.pips[i]!.fillStyle(k < sl.count ? PALETTE.bone : PALETTE.ink, 1).fillRect(x, y, pip, pip);
      }
    });
    this.syncShoppers(g);
  }

  private shopper(): Shopper {
    return {
      img: this.add.image(0, 0, ATLAS, 'customer_traveller_up_0').setOrigin(0.5, 1),
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
      // Each customer type has its look (specs/wp/WP09); one saved before the types is a traveller.
      const look = c.type ?? 'traveller';
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
        const left = Math.max(0, 1 - c.waited / patienceTicks(c.type));
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
