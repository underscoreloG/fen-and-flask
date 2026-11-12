import Phaser from 'phaser';
import type { StructureKind } from '../../data/content';
import { PALETTE } from '../../data/palette';
import { TUNING } from '../../data/tuning';
import { plotAtTile, plotOrigin, TILE, WORLD_H, WORLD_STRUCTURES, WORLD_TILES_H, WORLD_TILES_W, WORLD_W } from '../../core/world';
import { createDeviceReader, type DeviceReader } from '../../input/devices';
import { ATLAS } from '../sprites/generate';
import { pump, type Session } from '../../input/session';

// Draw order: flat ground layers below everything that stands; standing things sort by their
// feet (depth = world y of the feet), fog covers them all.
const DEPTH = { water: -5, ground: -4, shore: -3, flat: -2, shadow: -1, fog: WORLD_H + 1 };

const STRUCTURE_FRAME: Record<StructureKind, string> = {
  hut: 'hut',
  bed: 'bed_empty',
  mortar: 'mortar',
  cauldron: 'cauldron_0',
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

const pick = (frames: readonly string[], x: number, y: number): string => frames[tileHash(x, y) % frames.length]!;

export class GameScene extends Phaser.Scene {
  private readonly session: Session;
  private reader: DeviceReader | null = null;
  private player!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Image;
  private waterTiles: Phaser.GameObjects.Image[] = [];
  private cauldrons: Phaser.GameObjects.Image[] = [];
  private fogs: { gx: number; gy: number; rect: Phaser.GameObjects.Rectangle }[] = [];

  constructor(session: Session) {
    super('game');
    this.session = session;
  }

  create(): void {
    this.drawGround();
    this.drawStructures();
    this.drawFog();

    const r = TUNING.render;
    this.playerShadow = this.add.image(0, 0, ATLAS, 'shadow_s').setAlpha(r.shadowAlpha).setDepth(DEPTH.shadow);
    this.player = this.add.image(0, 0, ATLAS, 'player_down_0').setOrigin(0.5, 1);
    this.syncPlayer();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.player, true, r.cameraLerp, r.cameraLerp);

    this.reader = createDeviceReader(window);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.reader?.dispose());
    this.scene.launch('ui');
  }

  update(_time: number, delta: number): void {
    if (this.reader) {
      const { keys, pad } = this.reader.read();
      pump(this.session, keys, pad, delta);
    }
    this.syncPlayer();
    this.syncWorld();
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
      if (s.def.kind === 'bed') {
        img.setDepth(DEPTH.flat);
        continue;
      }
      img.setDepth(bottom);
      if (s.def.kind === 'cauldron') this.cauldrons.push(img);
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
    const feetBottom = p.y + TUNING.player.hitboxH / 2;
    const dir = p.facing === 'left' || p.facing === 'right' ? 'side' : p.facing;
    // Walk cycle: stand, stride, stand, stride; front and back mirror every other stride
    // so the lifted foot alternates.
    const phase = p.moving ? Math.floor(state.tick / TUNING.render.walkFrameTicks) % 4 : 0;
    const frame = `player_${dir}_${phase % 2}`;
    const flip = dir === 'side' ? p.facing === 'left' : phase === 3;
    this.player.setFrame(frame).setFlipX(flip).setPosition(p.x, feetBottom).setDepth(feetBottom);
    this.playerShadow.setPosition(p.x, feetBottom - 1);
  }

  private syncWorld(): void {
    const r = TUNING.render;
    const waterFrame = `water_${Math.floor(this.time.now / r.waterFrameMs) % 2}`;
    if (this.waterTiles[0]?.frame.name !== waterFrame) {
      for (const t of this.waterTiles) t.setFrame(waterFrame);
    }
    const cauldronFrame = `cauldron_${Math.floor(this.time.now / r.cauldronFrameMs) % 2}`;
    for (const c of this.cauldrons) c.setFrame(cauldronFrame);
    for (const f of this.fogs) {
      const owned = this.session.state.plots.find((p) => p.gx === f.gx && p.gy === f.gy)?.owned ?? false;
      f.rect.setVisible(!owned);
    }
  }
}
