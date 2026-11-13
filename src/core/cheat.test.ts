import { describe, expect, it } from 'vitest';
import { ITEM_IDS } from '../data/content';
import { neutralFrame } from './commands';
import type { CheatId } from './cheat';
import type { GameEvent } from './events';
import { createInitialState, type GameState } from './state';
import { step } from './step';

function run(s: GameState, id: CheatId): GameEvent[] {
  return step(s, { ...neutralFrame(), commands: [{ type: 'Cheat', cheat: id }] });
}

describe('test menu cheats', () => {
  it('coins and items', () => {
    const s = createInitialState(1);
    run(s, 'coinsSmall');
    run(s, 'coinsBig');
    expect(s.coins).toBe(1100);
    run(s, 'items');
    for (const item of ITEM_IDS) expect(s.inventory[item]).toBe(5);
  });

  it('hearts, evening and morning', () => {
    const s = createInitialState(1);
    s.creatures = [];
    s.player.hearts = 1;
    run(s, 'hearts');
    expect(s.player.hearts).toBe(5);
    expect(run(s, 'evening').filter((e) => e.type === 'eveningStarted')).toHaveLength(1);
    expect(s.phase).toBe('evening');
    expect(run(s, 'morning').filter((e) => e.type === 'morning')).toHaveLength(1);
    expect(s.day).toBe(2);
    expect(s.phase).toBe('day');
  });

  it('land: every plot is owned and filled, once', () => {
    const s = createInitialState(1);
    const ev = run(s, 'land');
    expect(s.plots.every((pl) => pl.owned)).toBe(true);
    expect(ev.filter((e) => e.type === 'plotBought')).toHaveLength(1);
    expect(s.nodes.some((n) => n.type === 'emberplant')).toBe(true);
    expect(run(s, 'land').filter((e) => e.type === 'plotBought')).toHaveLength(0);
  });
});
