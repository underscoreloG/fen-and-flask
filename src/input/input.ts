// Pure input logic: device snapshots in, a sim Frame and UI intents out. No DOM, no Phaser,
// so it is unit tested headless. devices.ts produces the snapshots in the browser.
import type { Command, Frame } from '../core/commands';
import { TUNING } from '../data/tuning';

const I = TUNING.input;

// Keys by value (controls table in specs/design.md): X swing/back, C interact/confirm,
// V notebook, M mute, Esc back/pause.
export interface KeyState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  x: boolean;
  c: boolean;
  v: boolean;
  m: boolean;
  esc: boolean;
}

// A standard-mapping gamepad: 0 A, 1 B, 2 X, 3 Y, 9 Start, 12-15 d-pad up/down/left/right.
export interface PadState {
  axes: readonly number[];
  buttons: readonly boolean[];
}

export const PAD = { a: 0, b: 1, x: 2, y: 3, start: 9, up: 12, down: 13, left: 14, right: 15 } as const;

export type Device = 'keyboard' | 'gamepad';

export function noKeys(): KeyState {
  return { left: false, right: false, up: false, down: false, x: false, c: false, v: false, m: false, esc: false };
}

const btn = (pad: PadState | null, i: number): boolean => pad?.buttons[i] === true;

function stick(pad: PadState | null): { x: number; y: number } {
  const x = pad?.axes[0] ?? 0;
  const y = pad?.axes[1] ?? 0;
  return Math.hypot(x, y) < I.deadZone ? { x: 0, y: 0 } : { x, y };
}

function keyboardActive(k: KeyState): boolean {
  return k.left || k.right || k.up || k.down || k.x || k.c || k.v || k.m || k.esc;
}

function padActive(pad: PadState | null): boolean {
  if (!pad) return false;
  const s = stick(pad);
  return s.x !== 0 || s.y !== 0 || pad.buttons.some((b) => b);
}

// --- Sim frame -------------------------------------------------------------

// Edge presses and commands are latched until a tick consumes them: a render frame may run
// 0 to 5 ticks, and a press must land on exactly one of them.
export interface InputLatch {
  swingHeld: boolean;
  interactHeld: boolean;
  swing: boolean;
  interact: boolean;
  commands: Command[];
  lastDevice: Device;
}

export function createLatch(): InputLatch {
  return { swingHeld: false, interactHeld: false, swing: false, interact: false, commands: [], lastDevice: 'keyboard' };
}

export function buildFrame(
  keys: KeyState,
  pad: PadState | null,
  prev: InputLatch,
): { frame: Frame; latch: InputLatch } {
  const s = stick(pad);
  const dx = (keys.right || btn(pad, PAD.right) ? 1 : 0) - (keys.left || btn(pad, PAD.left) ? 1 : 0);
  const dy = (keys.down || btn(pad, PAD.down) ? 1 : 0) - (keys.up || btn(pad, PAD.up) ? 1 : 0);
  const moveX = Math.max(-1, Math.min(1, dx + s.x));
  const moveY = Math.max(-1, Math.min(1, dy + s.y));

  const swingHeld = keys.x || btn(pad, PAD.x);
  const interactHeld = keys.c || btn(pad, PAD.a);
  const lastDevice: Device = padActive(pad) ? 'gamepad' : keyboardActive(keys) ? 'keyboard' : prev.lastDevice;
  const latch: InputLatch = {
    swingHeld,
    interactHeld,
    swing: prev.swing || (swingHeld && !prev.swingHeld),
    interact: prev.interact || (interactHeld && !prev.interactHeld),
    commands: prev.commands,
    lastDevice,
  };
  const frame: Frame = { moveX, moveY, swing: latch.swing, interact: latch.interact, commands: [...latch.commands] };
  return { frame, latch };
}

// Drops a pending swing / interact press (queued commands stay). Panels call it when they open
// and close, so the key that confirmed a panel never reaches the sim. Held flags are kept, so a
// key still held afterwards does not fire again until it is released and pressed anew.
export function clearLatches(latch: InputLatch): InputLatch {
  return { ...latch, swing: false, interact: false };
}

export function queueCommand(latch: InputLatch, command: Command): InputLatch {
  return { ...latch, commands: [...latch.commands, command] };
}

// Runs `n` ticks of one render frame: edges and commands go to the first tick only, movement
// is held for all of them. With n = 0 nothing is consumed and the latch carries over.
export function deliver(frame: Frame, latch: InputLatch, n: number, tick: (f: Frame) => void): InputLatch {
  if (n <= 0) return latch;
  const rest: Frame = { ...frame, swing: false, interact: false, commands: [] };
  for (let i = 0; i < n; i++) tick(i === 0 ? frame : rest);
  return { ...latch, swing: false, interact: false, commands: [] };
}

// --- UI intents ------------------------------------------------------------

export interface UiIntents {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
  notebook: boolean;
  pause: boolean;
  mute: boolean;
}

type Dir = 'up' | 'down' | 'left' | 'right';
type Button = 'confirm' | 'back' | 'notebook' | 'pause' | 'mute';
const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];
const BUTTONS: readonly Button[] = ['confirm', 'back', 'notebook', 'pause', 'mute'];

export interface UiLatch {
  held: Record<Dir | Button, boolean>;
  heldMs: Record<Dir, number>;
  nextRepeatMs: Record<Dir, number>;
}

export function createUiLatch(): UiLatch {
  const held = {} as Record<Dir | Button, boolean>;
  for (const k of [...DIRS, ...BUTTONS]) held[k] = false;
  return { held, heldMs: { up: 0, down: 0, left: 0, right: 0 }, nextRepeatMs: { up: 0, down: 0, left: 0, right: 0 } };
}

function uiHeld(keys: KeyState, pad: PadState | null): Record<Dir | Button, boolean> {
  const ax = pad?.axes[0] ?? 0;
  const ay = pad?.axes[1] ?? 0;
  const t = I.uiStickThreshold;
  return {
    up: keys.up || btn(pad, PAD.up) || ay <= -t,
    down: keys.down || btn(pad, PAD.down) || ay >= t,
    left: keys.left || btn(pad, PAD.left) || ax <= -t,
    right: keys.right || btn(pad, PAD.right) || ax >= t,
    confirm: keys.c || btn(pad, PAD.a),
    // Esc is both back (in panels) and pause (outside them); the open panel decides which applies.
    back: keys.x || keys.esc || btn(pad, PAD.b),
    notebook: keys.v || btn(pad, PAD.y),
    pause: keys.esc || btn(pad, PAD.start),
    mute: keys.m,
  };
}

// Edge-triggered intents; directions auto-repeat while held, accelerating after a while.
export function buildUiIntents(
  keys: KeyState,
  pad: PadState | null,
  prev: UiLatch,
  dtMs: number,
): { intents: UiIntents; latch: UiLatch } {
  const now = uiHeld(keys, pad);
  const intents = {} as UiIntents;
  const heldMs = { ...prev.heldMs };
  const nextRepeatMs = { ...prev.nextRepeatMs };
  for (const b of BUTTONS) intents[b] = now[b] && !prev.held[b];
  for (const d of DIRS) {
    if (!now[d]) {
      intents[d] = false;
      heldMs[d] = 0;
      continue;
    }
    if (!prev.held[d]) {
      intents[d] = true;
      heldMs[d] = 0;
      nextRepeatMs[d] = I.repeatDelayMs;
      continue;
    }
    heldMs[d] += dtMs;
    intents[d] = false;
    if (heldMs[d] >= nextRepeatMs[d]) {
      intents[d] = true;
      nextRepeatMs[d] += nextRepeatMs[d] >= I.repeatFastAfterMs ? I.repeatFastEveryMs : I.repeatEveryMs;
    }
  }
  return { intents, latch: { held: now, heldMs, nextRepeatMs } };
}
