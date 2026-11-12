import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../core/events';
import { step } from '../core/step';
import { neutralFrame } from '../core/commands';
import { plotTileCenter } from '../core/world';
import { buildFrame, noKeys, type KeyState } from './input';
import { closePanel, createSession, openPanel, pump, type Session } from './session';

const MS = 1000 / 60;
const keys = (k: Partial<KeyState> = {}): KeyState => ({ ...noKeys(), ...k });

// A session with the player at the hut door, no mudlets.
function atDoor(): Session {
  const s = createSession({ seed: 1, debug: false, speed: 1, nosave: true, autoplay: false });
  s.state.creatures = [];
  const door = plotTileCenter(0, 0, 2, 3);
  s.state.player.x = door.x;
  s.state.player.y = door.y;
  s.state.player.facing = 'up';
  step(s.state, neutralFrame());
  return s;
}

// One render frame; returns the events it produced (drained like GameScene does).
function frame(s: Session, k: KeyState = keys()): GameEvent[] {
  pump(s, k, null, MS);
  const ev = s.events;
  s.events = [];
  return ev;
}

const count = (ev: GameEvent[], type: GameEvent['type']): number => ev.filter((e) => e.type === type).length;

describe('panel switch', () => {
  it('the C that opens a panel is not read as its confirm, and the sim is paused while it is open', () => {
    const s = atDoor();
    const ev = frame(s, keys({ c: true }));
    expect(ev).toContainEqual({ type: 'uiRequest', ui: 'sleepConfirm' });
    // That frame's intents carry the C edge; opening consumes it.
    expect(s.intents.confirm).toBe(true);
    openPanel(s);
    expect(s.intents.confirm).toBe(false);
    const tick = s.state.tick;
    for (let i = 0; i < 30; i++) frame(s, keys({ c: i % 2 === 0, x: i % 3 === 0, down: true }));
    expect(s.state.tick).toBe(tick);
    expect(s.latch.interact).toBe(false);
    expect(s.latch.swing).toBe(false);
  });

  it('confirming Sleep: one morning, no new uiRequest, commands land on the first tick after close', () => {
    const s = atDoor();
    frame(s, keys({ c: true }));
    openPanel(s);
    frame(s);
    // The confirming C press is latched while the Sleep command is queued.
    s.latch = buildFrame(keys({ c: true }), null, s.latch).latch;
    expect(s.latch.interact).toBe(true);
    closePanel(s, [{ type: 'Sleep' }]);
    expect(s.latch.interact).toBe(false);
    expect(s.latch.commands).toEqual([{ type: 'Sleep' }]);
    const first = frame(s, keys({ c: true }));
    expect(count(first, 'morning')).toBe(1);
    expect(s.state.day).toBe(2);
    const rest: GameEvent[] = [];
    for (let i = 0; i < 60; i++) rest.push(...frame(s, keys({ c: i < 20 })));
    expect(count([...first, ...rest], 'morning')).toBe(1);
    expect(count([...first, ...rest], 'uiRequest')).toBe(0);
  });

  it('closing with no commands (No / back) changes nothing but resumes the sim', () => {
    const s = atDoor();
    frame(s, keys({ c: true }));
    openPanel(s);
    closePanel(s);
    const tick = s.state.tick;
    frame(s, keys({ x: true }));
    expect(s.state.tick).toBe(tick + 1);
    expect(s.state.day).toBe(1);
  });
});
