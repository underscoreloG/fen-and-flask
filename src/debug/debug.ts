// Debug surface (SPEC section 5): query params and window.__game.
import { setPhase } from '../core/clock';
import { neutralFrame, type Command, type Frame } from '../core/commands';
import type { GameEvent } from '../core/events';
import { addItem, type GameState, type Phase } from '../core/state';
import { step } from '../core/step';
import { ITEM_IDS, type ItemId } from '../data/content';
import { TUNING } from '../data/tuning';
import { APP_VERSION } from '../data/version';
import { deliver, queueCommand } from '../input/input';
import type { Session } from '../input/session';

export interface Params {
  debug: boolean;
  seed: number | null;
  skipTitle: boolean;
  nosave: boolean;
  autoplay: boolean;
  speed: number;
}

export function readParams(search: string, dev: boolean): Params {
  const q = new URLSearchParams(search);
  const flag = (k: string): boolean => q.get(k) === '1';
  const debug = dev || flag('debug');
  const seedRaw = q.get('seed');
  const seed = seedRaw !== null && /^\d+$/.test(seedRaw) ? Number(seedRaw) >>> 0 : null;
  const speedRaw = Number.parseInt(q.get('speed') ?? '1', 10);
  const speed = debug && Number.isFinite(speedRaw) ? Math.max(1, Math.min(TUNING.sim.maxSpeed, speedRaw)) : 1;
  return { debug, seed, skipTitle: flag('skipTitle'), nosave: flag('nosave'), autoplay: flag('autoplay'), speed };
}

export interface DebugApi {
  readonly state: GameState;
  step(n?: number, frame?: Partial<Frame>): GameEvent[];
  cmd(command: Command): void;
  give(itemId: ItemId, n: number): void;
  setPhase(p: Phase): void;
  bot(on: boolean): void;
  frames(n?: number): void;
  readonly version: string;
}

// runFrames drives n render frames by hand: a hidden browser pane throttles requestAnimationFrame,
// so UI flows (panels, fades, key presses) cannot be checked through the live loop there.
export function installDebug(session: Session, target: Window, runFrames: (n: number) => void = () => {}): DebugApi {
  const api: DebugApi = {
    get state() {
      return session.state;
    },
    // Holds the frame for n ticks; swing, interact and commands (plus queued cmd()s) land on
    // the first tick only.
    step(n = 1, frame = {}) {
      const f: Frame = { ...neutralFrame(), ...frame };
      f.commands = [...session.latch.commands, ...(frame.commands ?? [])];
      const events: GameEvent[] = [];
      session.latch = deliver(f, session.latch, n, (tf) => {
        events.push(...step(session.state, tf));
      });
      session.events.push(...events);
      return events;
    },
    cmd(command) {
      session.latch = queueCommand(session.latch, command);
    },
    give(itemId, n) {
      if (!ITEM_IDS.includes(itemId)) throw new Error(`unknown item ${String(itemId)}`);
      addItem(session.state, itemId, n);
    },
    // Applied at once; its events (eveningStarted) reach the renderer with the next drain.
    setPhase(p) {
      session.events.push(...setPhase(session.state, p));
    },
    // Stub until WP04 (bot).
    bot(on) {
      session.botOn = on;
    },
    frames(n = 1) {
      runFrames(n);
    },
    version: APP_VERSION,
  };
  (target as unknown as { __game: DebugApi }).__game = api;
  return api;
}
