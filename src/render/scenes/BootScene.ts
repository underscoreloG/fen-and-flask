import Phaser from 'phaser';
import { buildFont } from '../font';
import { buildAtlas } from '../sprites/generate';

// Turns the code-drawn sprites and the font into textures, then shows the title, or starts a
// new game at once with ?skipTitle=1.
export class BootScene extends Phaser.Scene {
  private readonly skipTitle: boolean;

  constructor(skipTitle: boolean) {
    super('boot');
    this.skipTitle = skipTitle;
  }

  create(): void {
    buildAtlas(this);
    buildFont(this);
    this.scene.start(this.skipTitle ? 'game' : 'title');
  }
}
