// Toasts (top-center one-liners, 3 s) and the M1 goal banner (6 s). Neither pauses the sim; a new
// toast replaces the one showing.
import type Phaser from 'phaser';
import type { Token } from '../../data/palette';
import { TUNING } from '../../data/tuning';
import { addText } from '../font';
import { panelBox, UI_DEPTH } from './confirm';

const T = TUNING.toast;
const R = TUNING.render;

interface Shown {
  parts: Phaser.GameObjects.GameObject[];
  timer: Phaser.Time.TimerEvent;
}

export class Toasts {
  private readonly scene: Phaser.Scene;
  private toastNow: Shown | null = null;
  private bannerNow: Shown | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  toast(text: string): void {
    this.toastNow = this.replace(this.toastNow, text, T.top, T.ms, 'bone');
  }

  banner(text: string): void {
    this.bannerNow = this.replace(this.bannerNow, text, T.bannerY, T.bannerMs, 'coin');
  }

  private replace(old: Shown | null, text: string, y: number, ms: number, token: Token): Shown {
    if (old) this.drop(old);
    const w = text.length * R.fontCellW + T.padX * 2;
    const h = R.fontCellH + T.padY * 2;
    const x0 = Math.round((R.viewW - w) / 2);
    const box = panelBox(this.scene, x0, y, w, h).setDepth(UI_DEPTH.overlay - 1);
    const label = addText(this.scene, x0 + T.padX, y + T.padY + 1, text, token).setDepth(UI_DEPTH.overlay - 1);
    const parts = [box, label];
    const timer = this.scene.time.delayedCall(ms, () => {
      this.scene.tweens.add({ targets: parts, alpha: 0, duration: T.fadeMs, onComplete: () => this.drop(shown) });
    });
    const shown: Shown = { parts, timer };
    return shown;
  }

  private drop(s: Shown): void {
    s.timer.remove();
    for (const p of s.parts) {
      this.scene.tweens.killTweensOf(p);
      p.destroy();
    }
  }
}
