import Phaser from 'phaser';
import { buildFont } from '../font';
import { buildAtlas } from '../sprites/generate';

// Turns the code-drawn sprites and the font into textures, then starts the world.
// The title screen slots in here in WP02.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    buildAtlas(this);
    buildFont(this);
    this.scene.start('game');
  }
}
