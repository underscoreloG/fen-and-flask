// Toasts (top-center one-liners, 3 s) and the M1 goal banner (6 s). Neither pauses the sim; a new
// toast replaces the one showing.
import type Phaser from 'phaser';
import type { Token } from '../../data/palette';
import { TUNING } from '../../data/tuning';
import { addText } from '../font';
import { panelBox, UI_DEPTH } from './confirm';

const T = TUNING.toast;
const R = TUNING.render;

// Word wrap to at most maxChars per line (panels stay within panel.maxW).
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  return lines;
}

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
    const lines = wrap(text, Math.floor((TUNING.panel.maxW - T.padX * 2) / R.fontCellW));
    const w = Math.max(...lines.map((l) => l.length)) * R.fontCellW + T.padX * 2;
    const h = lines.length * R.fontCellH + T.padY * 2;
    const x0 = Math.round((R.viewW - w) / 2);
    const box = panelBox(this.scene, x0, y, w, h).setDepth(UI_DEPTH.overlay - 1);
    const label = addText(this.scene, x0 + T.padX, y + T.padY + 1, lines.join('\n'), token).setDepth(UI_DEPTH.overlay - 1);
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
