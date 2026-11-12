import Phaser from 'phaser';
import { hex } from './data/palette';
import { TUNING } from './data/tuning';
import { installDebug, readParams } from './debug/debug';
import { BootScene } from './render/scenes/BootScene';
import { GameScene } from './render/scenes/GameScene';
import { UIScene } from './render/scenes/UIScene';
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
  // Sound arrives in WP05; until then no AudioContext (and no autoplay notice).
  audio: { noAudio: true },
  scale: { mode: Phaser.Scale.NONE, zoom: fitZoom() },
  scene: [new BootScene(), new GameScene(session), new UIScene(session)],
});

window.addEventListener('resize', () => game.scale.setZoom(fitZoom()));

if (params.debug) installDebug(session, window);
