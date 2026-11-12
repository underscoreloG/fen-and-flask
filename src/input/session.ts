// The running game shared by the scenes and the debug surface: the state, the input latches
// and the fixed-step accumulator. No Phaser here.
import { step } from '../core/step';
import { createInitialState, type GameState } from '../core/state';
import { TUNING } from '../data/tuning';
import {
  buildFrame,
  buildUiIntents,
  createLatch,
  createUiLatch,
  deliver,
  noKeys,
  type InputLatch,
  type KeyState,
  type PadState,
  type UiIntents,
  type UiLatch,
} from './input';

export interface SessionOptions {
  seed: number;
  debug: boolean;
  speed: number;
  nosave: boolean;
  autoplay: boolean;
}

export interface Session {
  state: GameState;
  latch: InputLatch;
  uiLatch: UiLatch;
  // This render frame's UI intents; panels read these, never the sim Frame.
  intents: UiIntents;
  acc: number;
  options: SessionOptions;
  botOn: boolean;
}

const MS_PER_TICK = 1000 / TUNING.sim.tickRate;

export function createSession(options: SessionOptions): Session {
  return {
    state: createInitialState(options.seed),
    latch: createLatch(),
    uiLatch: createUiLatch(),
    intents: buildUiIntents(noKeys(), null, createUiLatch(), 0).intents,
    acc: 0,
    options,
    botOn: options.autoplay,
  };
}

// How many 60 Hz ticks this render frame owes. Capped so a stalled tab does not spiral;
// ?speed scales both the rate and the cap.
export function ticksDue(session: Session, dtMs: number): number {
  const speed = session.options.speed;
  session.acc += dtMs * speed;
  const n = Math.floor(session.acc / MS_PER_TICK);
  const cap = TUNING.sim.maxStepsPerFrame * speed;
  if (n > cap) {
    session.acc = 0;
    return cap;
  }
  session.acc -= n * MS_PER_TICK;
  return n;
}

// One render frame: read input, run the ticks owed, keep unconsumed presses latched.
export function pump(session: Session, keys: KeyState, pad: PadState | null, dtMs: number): void {
  const built = buildFrame(keys, pad, session.latch);
  session.latch = built.latch;
  const ui = buildUiIntents(keys, pad, session.uiLatch, dtMs);
  session.uiLatch = ui.latch;
  session.intents = ui.intents;
  const n = ticksDue(session, dtMs);
  session.latch = deliver(built.frame, session.latch, n, (f) => {
    step(session.state, f);
  });
}
