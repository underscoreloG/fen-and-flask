import Phaser from 'phaser';
import type { StructureKind } from '../../data/content';
import type { GameEvent } from '../../core/events';
import { creatureDef } from '../../core/creatures';
import type { CreatureState, NodeState, PickupState } from '../../core/state';
import { PALETTE } from '../../data/palette';
import { ticks, TUNING } from '../../data/tuning';
import { plotAtTile, plotOrigin, TILE, WORLD_H, WORLD_STRUCTURES, WORLD_TILES_H, WORLD_TILES_W, WORLD_W } from '../../core/world';
import { bedIndex, isReady } from '../../core/garden';
import { STATION_KINDS, UNIT_TICKS } from '../../core/stations';
import type { DeviceReader } from '../../input/devices';
import { Fx } from '../fx';
import { ATLAS } from '../sprites/generate';
import { pump, type Session } from '../../input/session';

// Draw order: flat ground layers below everything that stands; standing things sort by their
// feet (depth = world y of the feet), fog covers them all.
const DEPTH = { water: -5, ground: -4, shore: -3, flat: -2, shadow: -1, fog: WORLD_H + 1 };

const STRUCTURE_FRAME: Record<StructureKind, string> = {
  hut: 'hut',
  bed: 'bed_empty',
  mortar: 'mortar',
  cauldron: 'cauldron_idle',
  stall: 'stall',
  signpost: 'signpost',
};

// Weighted variety so the ground never reads as a flat fill.
const GRASS_FRAMES = ['grass_0', 'grass_0', 'grass_0', 'grass_0', 'grass_0', 'grass_1', 'grass_1', 'grass_2', 'grass_2', 'grass_2'];
const ROAD_FRAMES = ['road_0', 'road_1'];

// Stable per-tile hash for picking variants (integer mixing constants, not tunables).
function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// GameScene re-emits each frame's sim events on game.events for the UI scene.
export const SIM_EVENTS = 'sim-events';

const LAND_TICKS = ticks(TUNING.pickup.landTime);

interface View {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
}

const pick = (frames: readonly string[], x: number, y: number): string => frames[tileHash(x, y) % frames.length]!;

export class GameScene extends Phaser.Scene {
  private readonly session: Session;
  // Shared with the title screen, so a key held across the switch is not read as a new press.
  private readonly reader: DeviceReader;
  private player!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Image;
  private waterTiles: Phaser.GameObjects.Image[] = [];
  private structures: { id: string; kind: StructureKind; img: Phaser.GameObjects.Image }[] = [];
  private nodeViews = new Map<number, View>();
  private creatureViews = new Map<number, View>();
  private pickupViews = new Map<number, View>();
  private fx!: Fx;
  private swingUntil = -Infinity;
  private fogs: { gx: number; gy: number; rect: Phaser.GameObjects.Rectangle }[] = [];
  // Progress bars over busy stations, redrawn every frame.
  private stationBars!: Phaser.GameObjects.Graphics;

  constructor(session: Session, reader: DeviceReader) {
    super('game');
    this.session = session;
    this.reader = reader;
  }

  create(): void {
    this.drawGround();
    this.drawStructures();
    this.drawFog();
    this.stationBars = this.add.graphics().setDepth(WORLD_H);

    const r = TUNING.render;
    this.playerShadow = this.add.image(0, 0, ATLAS, 'shadow_s').setAlpha(r.shadowAlpha).setDepth(DEPTH.shadow);
    this.player = this.add.image(0, 0, ATLAS, 'player_down_0').setOrigin(0.5, 1);
    this.fx = new Fx(this, { viewOf: (id) => (this.nodeViews.get(id) ?? this.creatureViews.get(id))?.img });
    this.syncPlayer();
    this.syncEntities();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.player, true, r.cameraLerp, r.cameraLerp);

    this.scene.launch('ui');
  }

  update(_time: number, delta: number): void {
    const { keys, pad } = this.reader.read();
    pump(this.session, keys, pad, delta);
    const events = this.session.events;
    this.session.events = [];
    this.onEvents(events);
    this.syncPlayer();
    this.syncEntities();
    this.syncWorld();
    this.fx.update(delta);
  }

  // Fx first, while the views of things that just broke still exist; then the UI gets them.
  private onEvents(events: GameEvent[]): void {
    if (events.length === 0) return;
    for (const e of events) if (e.type === 'swing') this.swingUntil = this.time.now + TUNING.fx.swingPoseMs;
    this.fx.play(events);
    this.game.events.emit(SIM_EVENTS, events);
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

  private drawStructures(): void {
    const alpha = TUNING.render.shadowAlpha;
    for (const s of WORLD_STRUCTURES) {
      const cx = s.x + s.w / 2;
      const bottom = s.y + s.h;
      const img = this.add.image(cx, bottom, ATLAS, STRUCTURE_FRAME[s.def.kind]).setOrigin(0.5, 1);
      this.structures.push({ id: s.def.id, kind: s.def.kind, img });
      if (s.def.kind === 'bed') {
        img.setDepth(DEPTH.flat);
        continue;
      }
      img.setDepth(bottom);
      const shadow = s.w > TILE ? 'shadow_l' : 'shadow_m';
      this.add.image(cx, bottom - 1, ATLAS, shadow).setOrigin(0.5, 0.5).setAlpha(alpha).setDepth(DEPTH.shadow);
    }
  }

  private drawFog(): void {
    const { plotW, plotH } = TUNING.world;
    for (const p of this.session.state.plots) {
      const o = plotOrigin(p.gx, p.gy);
      const rect = this.add
        .rectangle(o.x * TILE, o.y * TILE, plotW * TILE, plotH * TILE, PALETTE.ink, TUNING.render.fogAlpha)
        .setOrigin(0, 0)
        .setDepth(DEPTH.fog);
      this.fogs.push({ gx: p.gx, gy: p.gy, rect });
    }
  }

  private syncPlayer(): void {
    const state = this.session.state;
    const p = state.player;
    const now = this.time.now;
    const feetBottom = p.y + TUNING.player.hitboxH / 2;
    const dir = p.facing === 'left' || p.facing === 'right' ? 'side' : p.facing;
    // Walk cycle: stand, stride, stand, stride; front and back mirror every other stride
    // so the lifted foot alternates.
    const phase = p.moving ? Math.floor(state.tick / TUNING.render.walkFrameTicks) % 4 : 0;
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
    const r = TUNING.render;
    const nodeFeet = TUNING.node.hitboxH / 2;

    this.syncViews(this.nodeViews, state.nodes, 'shadow_s', (n: NodeState, v) => {
      const bottom = n.y + nodeFeet;
      v.img.setFrame(`node_${n.type}${swingTarget === n.id ? '_hl' : ''}`).setPosition(n.x, bottom).setDepth(bottom);
      v.shadow.setPosition(n.x, bottom - 1);
    });

    this.syncViews(this.creatureViews, state.creatures, 'shadow_s', (c: CreatureState, v) => {
      const bottom = c.y + creatureDef(c.type).hitboxH / 2;
      const hopping = c.mode !== 'idle' && c.stun === 0;
      const f = hopping ? Math.floor((now + c.id * r.hopFrameMs) / r.hopFrameMs) % 2 : 0;
      const faceLeft = c.mode === 'chase' ? state.player.x < c.x : c.dirX < 0;
      v.img
        .setFrame(`mudlet_${f}${swingTarget === c.id ? '_hl' : ''}`)
        .setFlipX(faceLeft)
        .setPosition(c.x, bottom - f * r.hopLiftPx)
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
        lift = r.pickupArcPx * 4 * t * (1 - t);
      } else {
        lift = Math.round(r.pickupBobPx * (1 + Math.sin((now + k.id * r.pickupBobMs) / r.pickupBobMs)));
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
          shadow: this.add.image(0, 0, ATLAS, shadowFrame).setAlpha(TUNING.render.shadowAlpha).setDepth(DEPTH.shadow),
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
  private drawStationBars(): void {
    const r = TUNING.render;
    const g = this.stationBars.clear();
    for (const kind of STATION_KINDS) {
      const job = this.session.state.stations[kind];
      const view = this.structures.find((s) => s.kind === kind);
      if (!job || !view) continue;
      const x = Math.round(view.img.x - r.stationBarW / 2);
      const y = Math.round(view.img.y - view.img.height - r.stationBarGap - r.stationBarH);
      const fill = Math.round((r.stationBarW * job.progress) / UNIT_TICKS[kind]);
      g.fillStyle(PALETTE.ink, 1).fillRect(x, y, r.stationBarW, r.stationBarH);
      g.fillStyle(PALETTE.bone, 1).fillRect(x, y, fill, r.stationBarH);
    }
  }

  private syncWorld(): void {
    const r = TUNING.render;
    const { interactTarget, swingTarget } = this.session.state.player;
    const waterFrame = `water_${Math.floor(this.time.now / r.waterFrameMs) % 2}`;
    if (this.waterTiles[0]?.frame.name !== waterFrame) {
      for (const t of this.waterTiles) t.setFrame(waterFrame);
    }
    // The cauldron bubbles only while it brews.
    const cauldronFrame = this.session.state.stations.cauldron
      ? `cauldron_${Math.floor(this.time.now / r.cauldronFrameMs) % 2}`
      : STRUCTURE_FRAME.cauldron;
    for (const s of this.structures) {
      const base = s.kind === 'cauldron' ? cauldronFrame : s.kind === 'bed' ? this.bedFrame(s.id) : STRUCTURE_FRAME[s.kind];
      // A ready bed can also be the swing target.
      s.img.setFrame(interactTarget === s.id || swingTarget === s.id ? `${base}_hl` : base);
    }
    this.drawStationBars();
    for (const f of this.fogs) {
      const owned = this.session.state.plots.find((p) => p.gx === f.gx && p.gy === f.gy)?.owned ?? false;
      f.rect.setVisible(!owned);
    }
  }
}
