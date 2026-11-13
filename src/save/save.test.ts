import { describe, expect, it } from 'vitest';
import { neutralFrame, type Frame } from '../core/commands';
import { createInitialState, type GameState } from '../core/state';
import { step } from '../core/step';
import { deserialize, serialize } from './save';

const script = (i: number): Frame => ({
  ...neutralFrame(),
  moveX: Math.sin(i / 17),
  moveY: Math.cos(i / 23),
  swing: i % 30 === 0,
  interact: i % 55 === 0,
});

// A state from ordinary play: moved, swung, maybe hurt, with pickups on the ground.
function played(): GameState {
  const s = createInitialState(7);
  s.inventory.mint = 2;
  s.coins = 12;
  for (let i = 0; i < 400; i++) step(s, script(i));
  return s;
}

describe('save', () => {
  it('deserialize(serialize(s)) deep-equals s', () => {
    const s = played();
    expect(deserialize(serialize(s, '0.1.0'), '0.1.0')).toEqual(s);
  });

  it('a loaded state and the original, stepped through the same 600 frames, end byte-identical', () => {
    const a = played();
    const b = deserialize(serialize(a, '0.1.0'), '0.1.0')!;
    for (let i = 0; i < 600; i++) {
      step(a, script(i + 1000));
      step(b, script(i + 1000));
    }
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('a save from 0.2.0 is ignored by 0.1.x; another patch of the same minor loads', () => {
    const s = createInitialState(1);
    expect(deserialize(serialize(s, '0.2.0'), '0.1.0')).toBeNull();
    expect(deserialize(serialize(s, '0.2.0'), '0.1.9')).toBeNull();
    expect(deserialize(serialize(s, '1.1.0'), '0.1.0')).toBeNull();
    expect(deserialize(serialize(s, '0.1.3'), '0.1.0')).toEqual(s);
  });

  it('a save written before stations existed loads with free stations and steps', () => {
    const file = JSON.parse(serialize(played(), '0.1.0')) as { state: Partial<GameState> };
    delete file.state.stations;
    const s = deserialize(JSON.stringify(file), '0.1.0')!;
    expect(s.stations).toEqual({ mortar: null, cauldron: null });
    expect(() => step(s, neutralFrame())).not.toThrow();
  });

  it('garbage and wrong shapes return null', () => {
    for (const bad of ['', '{', 'not json', 'null', '42', '"x"', '[]', '{"version":"0.1.0"}', '{"state":{}}', '{"version":1,"state":{}}']) {
      expect(deserialize(bad, '0.1.0'), bad).toBeNull();
    }
  });
});
