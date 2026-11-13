// Juice driven by core events (specs/design.md): squash, flashes, particles, shakes, fades.
// Render-only randomness is fine here; nothing in this file feeds back into the sim.
import Phaser from 'phaser';
import type { CreatureId, NodeId } from '../data/content';
import { PALETTE, type Token } from '../data/palette';
import { TUNING } from '../data/tuning';
import type { GameEvent } from '../core/events';
import { isCauldron, STATION_STRUCTURES } from '../core/stations';
import { ATLAS } from './sprites/generate';

const F = TUNING.fx;
const FRAME_MS = 1000 / TUNING.sim.tickRate;

// What flies off each thing when it is hit.
const NODE_BITS: Record<NodeId, readonly Token[]> = {
  mintbush: ['mint', 'grass', 'grasslight'],
  glowcaps: ['glow', 'waterlight', 'bone'],
  reedclump: ['reed', 'sand', 'woodlight'],
  stump: ['woodlight', 'wood', 'sand'],
  emberplant: ['ember', 'emberhot', 'grass'],
};

const CREATURE_BITS: Record<CreatureId, readonly Token[]> = {
  mudlet: ['plumlight', 'mud', 'plumlight'],
};

const SPARKLE: readonly Token[] = ['glow', 'glow', 'bone'];

interface Particle {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  age: number;
}

// The scene that owns the world sprites; fx only borrows them. topDepth is above everything,
// indoors included.
export interface FxHost {
  viewOf(id: number): Phaser.GameObjects.Image | undefined;
  topDepth: number;
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

export class Fx {
  // Render time of the last hurt, for the player's heart-colored blink.
  hurtAt = -Infinity;
  private parts: Particle[] = [];
  private readonly scene: Phaser.Scene;
  private readonly host: FxHost;

  constructor(scene: Phaser.Scene, host: FxHost) {
    this.scene = scene;
    this.host = host;
  }

  play(events: readonly GameEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'nodeHit':
          this.squash(e.id);
          this.burst(e.x, e.y, NODE_BITS[e.nodeType], Phaser.Math.Between(F.hitParticlesMin, F.hitParticlesMax), false);
          break;
        case 'nodeBroken':
          this.burst(e.x, e.y, NODE_BITS[e.nodeType], F.breakParticles, true);
          break;
        case 'creatureHit':
          this.squash(e.id);
          this.flash(e.id);
          this.burst(e.x, e.y, CREATURE_BITS[e.creatureType], Phaser.Math.Between(F.hitParticlesMin, F.hitParticlesMax), false);
          this.shake(F.creatureShakePx);
          break;
        case 'creatureDied':
          this.burst(e.x, e.y, CREATURE_BITS[e.creatureType], F.deathParticles, true);
          this.shake(F.creatureShakePx);
          break;
        case 'playerHurt':
          this.hurtAt = this.scene.time.now;
          this.shake(F.hurtShakePx);
          break;
        case 'jobUnitDone':
          // Potion done: a glow sparkle from the cauldron's rim (the footprint top).
          if (isCauldron(e.station)) {
            const s = STATION_STRUCTURES[e.station];
            this.burst(s.x + s.w / 2, s.y, SPARKLE, F.sparkleParticles, true);
          }
          break;
        case 'playerFainted': {
          const c = Phaser.Display.Color.IntegerToColor(PALETTE.ink);
          this.scene.cameras.main.fadeIn(F.faintFadeMs, c.red, c.green, c.blue);
          break;
        }
        default:
          break;
      }
    }
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    this.parts = this.parts.filter((p) => {
      p.age += dtMs;
      if (p.age >= F.particleLifeMs) {
        p.img.destroy();
        return false;
      }
      p.vy += F.particleGravity * dt;
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      // Hold full alpha, then fade over the tail of the life.
      const left = 1 - p.age / F.particleLifeMs;
      p.img.setAlpha(Math.min(1, left / F.particleFadeTail));
      return true;
    });
  }

  // Squash flat for a couple of frames, then spring back (sprites are anchored at the feet).
  private squash(id: number): void {
    const img = this.host.viewOf(id);
    if (!img) return;
    this.scene.tweens.killTweensOf(img);
    img.setScale(F.squashX, F.squashY);
    this.scene.tweens.add({
      targets: img,
      scaleX: 1,
      scaleY: 1,
      delay: F.squashFrames * FRAME_MS,
      duration: F.squashRecoverMs,
      ease: 'Back.Out',
    });
  }

  private flash(id: number): void {
    const img = this.host.viewOf(id);
    if (!img) return;
    img.setTintFill(PALETTE.bone);
    this.scene.time.delayedCall(F.flashMs, () => {
      if (img.active) img.clearTint();
    });
  }

  // A spray of bits from just above the feet; a break throws more, bigger, all around.
  private burst(x: number, y: number, tokens: readonly Token[], n: number, big: boolean): void {
    for (let i = 0; i < n; i++) {
      const token = tokens[i % tokens.length]!;
      const img = this.scene.add
        .image(x, y - F.particleLiftPx, ATLAS, big && i % 2 === 0 ? 'particle_l' : 'particle')
        .setTintFill(PALETTE[token])
        .setDepth(this.host.topDepth);
      // Upward fan for hits, a full ring for breaks.
      const a = big ? rand(0, Math.PI * 2) : rand(Math.PI * F.hitFanFrom, Math.PI * F.hitFanTo);
      const s = rand(F.particleSpeedMin, F.particleSpeedMax) * (big ? F.breakSpeedBoost : 1);
      this.parts.push({ img, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0 });
    }
  }

  private shake(px: number): void {
    const { viewW, viewH } = TUNING.render;
    this.scene.cameras.main.shake(F.shakeMs, new Phaser.Math.Vector2(px / viewW, px / viewH));
  }
}
