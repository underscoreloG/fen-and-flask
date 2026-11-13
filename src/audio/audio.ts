// Game sound: loads the manifest through Phaser, plays core events, mute and master volume kept in
// fenflask.settings.v1 (never touched with ?nosave=1). It never throws: a missing or undecodable
// file logs one warning and stays silent, and nothing plays before the browser lets audio start.
import Phaser from 'phaser';
import type { GameEvent } from '../core/events';
import { TUNING } from '../data/tuning';
import type { UiIntents } from '../input/input';
import { createLimiter, SOUNDS, soundsFor, type SoundId } from './manifest';

const SETTINGS_KEY = 'fenflask.settings.v1';

interface Settings {
  muted: boolean;
  volume: number;
}

function readSettings(): Settings {
  const s: Settings = { muted: false, volume: TUNING.audio.volume };
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return s;
    const r = raw as Partial<Settings>;
    if (typeof r.muted === 'boolean') s.muted = r.muted;
    if (typeof r.volume === 'number' && r.volume >= 0 && r.volume <= 1) s.volume = r.volume;
  } catch {
    // Bad JSON or blocked storage: defaults.
  }
  return s;
}

function writeSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: the setting lasts for this page only.
  }
}

const DEF = new Map(SOUNDS.map((s) => [s.id, s]));

export class GameAudio {
  private readonly nosave: boolean;
  private settings: Settings;
  private game: Phaser.Game | null = null;
  private readonly allow = createLimiter(TUNING.audio.minGapMs);
  private ambienceOn = false;

  constructor(nosave: boolean) {
    this.nosave = nosave;
    this.settings = nosave ? { muted: false, volume: TUNING.audio.volume } : readSettings();
  }

  get muted(): boolean {
    return this.settings.muted;
  }

  // From a scene's preload. Relative to the page's base, so it works under ./ and /fen-and-flask/.
  preload(scene: Phaser.Scene): void {
    for (const s of SOUNDS) scene.load.audio(s.id, `${import.meta.env.BASE_URL}audio/${s.file}`);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (scene.sound instanceof Phaser.Sound.NoAudioSoundManager) return;
      for (const s of SOUNDS) {
        if (!scene.cache.audio.exists(s.id)) console.warn(`audio: ${s.file} is missing or cannot be decoded; it stays silent`);
      }
    });
  }

  start(game: Phaser.Game): void {
    this.game = game;
    this.apply();
  }

  toggleMute(): void {
    this.settings = { ...this.settings, muted: !this.settings.muted };
    this.apply();
    if (!this.nosave) writeSettings(this.settings);
  }

  // Phaser already resumes on the first key (body keydown); this covers pad presses too.
  wake(intents: UiIntents): void {
    const ctx = this.context();
    if (!ctx || ctx.state === 'running' || !Object.values(intents).some(Boolean)) return;
    ctx.resume().catch(() => {});
  }

  play(events: readonly GameEvent[]): void {
    for (const e of events) for (const id of soundsFor(e)) this.fire(id);
  }

  ui(id: 'ui_move' | 'ui_confirm'): void {
    this.fire(id);
  }

  // Once per page: the loop runs from the first world frame and survives a new game. Started on a
  // suspended context it simply waits for the unlock.
  ambience(): void {
    const g = this.game;
    if (this.ambienceOn || !g || !g.cache.audio.exists('marsh_ambience')) return;
    this.ambienceOn = true;
    const def = DEF.get('marsh_ambience');
    try {
      g.sound.add('marsh_ambience', { loop: true, volume: def?.volume ?? 0 }).play();
    } catch (err) {
      console.warn('audio: ambience failed to start', err);
    }
  }

  private apply(): void {
    if (!this.game) return;
    this.game.sound.mute = this.settings.muted;
    this.game.sound.volume = this.settings.volume;
  }

  private context(): AudioContext | null {
    return (this.game?.sound as Partial<Phaser.Sound.WebAudioSoundManager> | undefined)?.context ?? null;
  }

  // Skipped while locked: one-shots started on a suspended context would pile up and burst out
  // together on unlock.
  private fire(id: SoundId): void {
    const g = this.game;
    if (!g || !g.cache.audio.exists(id)) return;
    const ctx = this.context();
    if (ctx ? ctx.state !== 'running' : g.sound.locked) return;
    if (!this.allow(id, performance.now())) return;
    try {
      g.sound.play(id, { volume: DEF.get(id)?.volume ?? 0 });
    } catch (err) {
      console.warn(`audio: ${id} failed to play`, err);
    }
  }
}
