import { describe, expect, it } from 'vitest';
import type { Frame } from '../core/commands';
import {
  buildFrame,
  buildUiIntents,
  clearLatches,
  createLatch,
  createUiLatch,
  deliver,
  noKeys,
  PAD,
  type InputLatch,
  type KeyState,
  type PadState,
  type UiIntents,
  type UiLatch,
} from './input';

const keys = (k: Partial<KeyState> = {}): KeyState => ({ ...noKeys(), ...k });
const pad = (p: { axes?: number[]; pressed?: number[] } = {}): PadState => {
  const buttons = Array.from({ length: 17 }, (_, i) => (p.pressed ?? []).includes(i));
  return { axes: p.axes ?? [0, 0, 0, 0], buttons };
};

// One render frame: build, then run n ticks, recording what each tick saw.
function frameRun(latch: InputLatch, k: KeyState, p: PadState | null, n: number, seen: Frame[]): InputLatch {
  const built = buildFrame(k, p, latch);
  return deliver(built.frame, built.latch, n, (f) => seen.push(f));
}

describe('buildFrame', () => {
  it('maps arrows to movement', () => {
    const f = buildFrame(keys({ right: true, up: true }), null, createLatch()).frame;
    expect([f.moveX, f.moveY]).toEqual([1, -1]);
    const g = buildFrame(keys({ left: true, down: true }), null, createLatch()).frame;
    expect([g.moveX, g.moveY]).toEqual([-1, 1]);
  });

  it('ignores the stick inside the 0.25 dead zone and passes it beyond', () => {
    expect(buildFrame(keys(), pad({ axes: [0.2, 0.1] }), createLatch()).frame.moveX).toBe(0);
    expect(buildFrame(keys(), pad({ axes: [0.24, 0] }), createLatch()).frame.moveX).toBe(0);
    const f = buildFrame(keys(), pad({ axes: [0.8, -0.5] }), createLatch()).frame;
    expect([f.moveX, f.moveY]).toEqual([0.8, -0.5]);
  });

  it('maps the d-pad', () => {
    const f = buildFrame(keys(), pad({ pressed: [PAD.left, PAD.down] }), createLatch()).frame;
    expect([f.moveX, f.moveY]).toEqual([-1, 1]);
  });

  it('X / C and pad buttons 2 / 0 trigger once per press', () => {
    for (const [held, field] of [
      [{ k: keys({ x: true }), p: null }, 'swing'],
      [{ k: keys({ c: true }), p: null }, 'interact'],
      [{ k: keys(), p: pad({ pressed: [2] }) }, 'swing'],
      [{ k: keys(), p: pad({ pressed: [0] }) }, 'interact'],
    ] as const) {
      const seen: Frame[] = [];
      let l = createLatch();
      for (let i = 0; i < 5; i++) l = frameRun(l, held.k, held.p, 1, seen);
      l = frameRun(l, keys(), null, 1, seen); // release
      for (let i = 0; i < 3; i++) l = frameRun(l, held.k, held.p, 1, seen); // press again
      expect(seen.map((f) => f[field])).toEqual([true, false, false, false, false, false, true, false, false]);
    }
  });

  it('tracks the last device used', () => {
    let l = createLatch();
    expect(l.lastDevice).toBe('keyboard');
    l = buildFrame(keys(), pad({ pressed: [PAD.a] }), l).latch;
    expect(l.lastDevice).toBe('gamepad');
    l = buildFrame(keys(), pad(), l).latch; // idle pad: no change
    expect(l.lastDevice).toBe('gamepad');
    l = buildFrame(keys({ left: true }), pad({ axes: [0.1, 0] }), l).latch;
    expect(l.lastDevice).toBe('keyboard');
    l = buildFrame(keys(), pad({ axes: [0, 0.9] }), l).latch;
    expect(l.lastDevice).toBe('gamepad');
  });
});

describe('latched delivery', () => {
  it('a press during a 0-tick render frame reaches the next tick exactly once; held keys do not re-trigger', () => {
    const seen: Frame[] = [];
    let l = createLatch();
    l = frameRun(l, keys({ x: true }), null, 0, seen); // pressed, but no tick ran
    expect(seen).toEqual([]);
    l = frameRun(l, keys({ x: true }), null, 3, seen); // still held, 3 ticks
    l = frameRun(l, keys({ x: true }), null, 2, seen); // still held
    expect(seen.map((f) => f.swing)).toEqual([true, false, false, false, false]);
  });

  it('a tap released before any tick ran is still delivered once', () => {
    const seen: Frame[] = [];
    let l = createLatch();
    l = frameRun(l, keys({ c: true }), null, 0, seen);
    l = frameRun(l, keys(), null, 0, seen);
    l = frameRun(l, keys(), null, 2, seen);
    expect(seen.map((f) => f.interact)).toEqual([true, false]);
  });

  it('a press followed by clearLatches() is never delivered', () => {
    const seen: Frame[] = [];
    let l = createLatch();
    const built = buildFrame(keys({ x: true, c: true }), null, l);
    l = clearLatches(built.latch);
    l = frameRun(l, keys({ x: true, c: true }), null, 2, seen); // still held after the panel closed
    l = frameRun(l, keys(), null, 2, seen);
    expect(seen.some((f) => f.swing || f.interact)).toBe(false);
  });
});

describe('buildUiIntents', () => {
  function runUi(frames: { k: KeyState; p: PadState | null }[], dtMs: number): UiIntents[] {
    let l: UiLatch = createUiLatch();
    return frames.map(({ k, p }) => {
      const r = buildUiIntents(k, p, l, dtMs);
      l = r.latch;
      return r.intents;
    });
  }

  it('buttons fire once per press on keyboard and pad', () => {
    const cases: [keyof UiIntents, KeyState, PadState | null][] = [
      ['confirm', keys({ c: true }), null],
      ['confirm', keys(), pad({ pressed: [PAD.a] })],
      ['back', keys({ x: true }), null],
      ['back', keys({ esc: true }), null],
      ['back', keys(), pad({ pressed: [PAD.b] })],
      ['notebook', keys({ v: true }), null],
      ['notebook', keys(), pad({ pressed: [PAD.y] })],
      ['pause', keys({ esc: true }), null],
      ['pause', keys(), pad({ pressed: [PAD.start] })],
      ['mute', keys({ m: true }), null],
    ];
    for (const [intent, k, p] of cases) {
      const held = { k, p };
      const up = { k: keys(), p: p ? pad() : null };
      const out = runUi([held, held, held, up, held, held], 16);
      expect(out.map((i) => i[intent]), intent).toEqual([true, false, false, false, true, false]);
    }
  });

  it('a direction held for 1 s fires 1 + 6 times (350 ms, then every 120 ms)', () => {
    const held = Array.from({ length: 101 }, () => ({ k: keys({ down: true }), p: null }));
    const out = runUi(held, 10); // 0 .. 1000 ms
    expect(out.filter((i) => i.down).length).toBe(7);
    const pressed = Array.from({ length: 61 }, () => ({ k: keys(), p: pad({ axes: [0, -0.9] }) }));
    expect(runUi(pressed, 1000 / 60).filter((i) => i.up).length).toBe(7);
  });

  it('accelerates to every 40 ms after 1.5 s held', () => {
    const held = Array.from({ length: 201 }, () => ({ k: keys({ right: true }), p: null }));
    const out = runUi(held, 10); // 0 .. 2000 ms
    const times = out.flatMap((i, n) => (i.right ? [n * 10] : []));
    expect(times.slice(0, 7)).toEqual([0, 350, 470, 590, 710, 830, 950]);
    const late = times.filter((t) => t > 1600);
    expect(late[1]! - late[0]!).toBe(40);
  });
});
