import Phaser from 'phaser';
import { GameAudio } from './audio/audio';
import { hex } from './data/palette';
import { TUNING } from './data/tuning';
import { installDebug, readParams } from './debug/debug';
import { BootScene } from './render/scenes/BootScene';
import { GameScene } from './render/scenes/GameScene';
import { TitleScene } from './render/scenes/TitleScene';
import { UIScene } from './render/scenes/UIScene';
import { createDeviceReader } from './input/devices';
import { createSession } from './input/session';

const { viewW, viewH } = TUNING.render;

const params = readParams(window.location.search, import.meta.env.DEV);
// Outside core, so a fresh random seed is fine here; ?seed pins it.
const seed = params.seed ?? Math.floor(Math.random() * 2 ** 32);
const session = createSession({
  seed,
  debug: params.debug,
  speed: params.speed,
  nosave: params.nosave,
  autoplay: params.autoplay,
});

document.body.style.background = hex('ink');

const audio = new GameAudio(params.nosave);

// One keyboard and pad reader for the page: title and world share it, so a key held across the
// scene switch keeps its held state.
const reader = createDeviceReader(window);

// Largest integer zoom that fits the window, so pixels stay square and crisp.
function fitZoom(): number {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / viewW, window.innerHeight / viewH)));
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: viewW,
  height: viewH,
  backgroundColor: hex('deepwater'),
  pixelArt: true,
  roundPixels: true,
  banner: false,
  scale: { mode: Phaser.Scale.NONE, zoom: fitZoom() },
  scene: [
    new BootScene(params.skipTitle, audio),
    new TitleScene(session, reader, audio),
    new GameScene(session, reader),
    new UIScene(session, audio),
  ],
});

window.addEventListener('resize', () => game.scale.setZoom(fitZoom()));

let debugTime = 0;
if (params.debug) {
  installDebug(session, window, (n) => {
    for (let i = 0; i < n; i++) {
      debugTime = Math.max(debugTime, performance.now()) + 1000 / 60;
      game.loop.step(debugTime);
    }
  });
}
