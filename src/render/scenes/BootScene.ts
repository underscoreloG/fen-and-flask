import Phaser from 'phaser';
import type { GameAudio } from '../../audio/audio';
import { buildFont } from '../font';
import { buildAtlas } from '../sprites/generate';

// Loads the sounds, turns the code-drawn sprites and the font into textures, then shows the
// title, or starts a new game at once with ?skipTitle=1.
export class BootScene extends Phaser.Scene {
  private readonly skipTitle: boolean;
  private readonly audio: GameAudio;

  constructor(skipTitle: boolean, audio: GameAudio) {
    super('boot');
    this.skipTitle = skipTitle;
    this.audio = audio;
  }

  preload(): void {
    this.audio.preload(this);
  }

  create(): void {
    this.audio.start(this.game);
    buildAtlas(this);
    buildFont(this);
    this.scene.start(this.skipTitle ? 'game' : 'title');
  }
}
