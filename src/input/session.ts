// The running game shared by the scenes and the debug surface: the state, the input latches
// and the fixed-step accumulator. No Phaser here.
import type { Command } from '../core/commands';
import type { GameEvent } from '../core/events';
import { step } from '../core/step';
import { createInitialState, type GameState } from '../core/state';
import { TUNING } from '../data/tuning';
import {
  buildFrame,
  buildUiIntents,
  clearLatches,
  createLatch,
  createUiLatch,
  deliver,
  noKeys,
  queueCommand,
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
  // Events of the ticks run since the renderer last drained them (pump and __game.step).
  events: GameEvent[];
  // The one "panel open" switch: while on, pump runs no ticks (SPEC section 4).
  panelOpen: boolean;
}

function noIntents(): UiIntents {
  return buildUiIntents(noKeys(), null, createUiLatch(), 0).intents;
}

const MS_PER_TICK = 1000 / TUNING.sim.tickRate;

export function createSession(options: SessionOptions): Session {
  return {
    state: createInitialState(options.seed),
    latch: createLatch(),
    uiLatch: createUiLatch(),
    intents: noIntents(),
    acc: 0,
    options,
    botOn: options.autoplay,
    events: [],
    panelOpen: false,
  };
}

// Swaps in the game to play (title screen: Continue or New game). Held flags are kept so a key
// still down from the title does not fire in the world.
export function startGame(session: Session, state: GameState): void {
  session.state = state;
  session.latch = clearLatches({ ...session.latch, commands: [] });
  session.acc = 0;
  session.events = [];
  session.panelOpen = false;
}

// Pauses the sim for a panel. The press that opened it is dropped from both the sim latch and
// this frame's intents, so it is not also read as the panel's confirm.
export function openPanel(session: Session): void {
  session.panelOpen = true;
  session.latch = clearLatches(session.latch);
  session.intents = noIntents();
}

// Resumes the sim; `commands` reach the first tick after the close. The press that closed the
// panel is dropped, so it never reaches the sim as a swing or interact.
export function closePanel(session: Session, commands: readonly Command[] = []): void {
  let latch = session.latch;
  for (const c of commands) latch = queueCommand(latch, c);
  session.latch = clearLatches(latch);
  session.panelOpen = false;
}

// UI intents only (title screen, and every pump).
export function readUi(session: Session, keys: KeyState, pad: PadState | null, dtMs: number): void {
  const ui = buildUiIntents(keys, pad, session.uiLatch, dtMs);
  session.uiLatch = ui.latch;
  session.intents = ui.intents;
}

// Tracks held keys without letting any press reach the sim (title screen).
export function holdInput(session: Session, keys: KeyState, pad: PadState | null): void {
  session.latch = clearLatches(buildFrame(keys, pad, session.latch).latch);
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
  readUi(session, keys, pad, dtMs);
  if (session.panelOpen) {
    // Paused: keys feed only the UI intents, queued commands wait, and no backlog builds up.
    session.latch = clearLatches(session.latch);
    session.acc = 0;
    return;
  }
  const n = ticksDue(session, dtMs);
  session.latch = deliver(built.frame, session.latch, n, (f) => {
    session.events.push(...step(session.state, f));
  });
}
