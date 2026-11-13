import { describe, expect, it } from 'vitest';
import { BREW_RECIPES, CAULDRON_FUEL, GRIND_RECIPES, type ItemId } from '../data/content';
import { neutralFrame, type Command, type Frame } from './commands';
import type { GameEvent } from './events';
import { createInitialState, type GameState } from './state';
import { STATION_STRUCTURES, UNIT_TICKS } from './stations';
import { step } from './step';
import { plotTileCenter, TILE } from './world';

const cmd = (...commands: Command[]): Frame => ({ ...neutralFrame(), commands });
const INTERACT: Frame = { ...neutralFrame(), interact: true };

function standAt(s: GameState, tx: number, ty: number, facing: GameState['player']['facing']): void {
  const at = plotTileCenter(0, 0, tx, ty);
  s.player.x = at.x;
  s.player.y = at.y;
  s.player.facing = facing;
  step(s, neutralFrame());
}

// An empty home plot (no nodes, no mudlets) with the player on a station's interact tile.
function scene(at: 'mortar' | 'cauldron', inv: Partial<Record<ItemId, number>> = {}): GameState {
  const s = createInitialState(1);
  s.nodes = [];
  s.creatures = [];
  Object.assign(s.inventory, inv);
  if (at === 'mortar') standAt(s, 10, 3, 'up');
  else standAt(s, 12, 3, 'up');
  expect(s.player.interactTarget).toBe(at);
  return s;
}

// Events of each of n steps, indexed from 1 (step 0 is the one that sent the command).
function perStep(s: GameState, n: number): GameEvent[][] {
  const out: GameEvent[][] = [[]];
  for (let i = 1; i <= n; i++) out.push(step(s, neutralFrame()));
  return out;
}

const stepsWith = (byStep: GameEvent[][], pred: (e: GameEvent) => boolean): number[] =>
  byStep.flatMap((ev, i) => (ev.some(pred) ? [i] : []));

function expectRejected(s: GameState, c: Command): void {
  const twin = structuredClone(s);
  const ev = step(s, cmd(c));
  const evTwin = step(twin, neutralFrame());
  expect(JSON.stringify(s)).toBe(JSON.stringify(twin));
  expect(ev).toEqual(evTwin);
}

describe('stations', () => {
  it('job timers are integer ticks: 90 per ground unit, 360 per potion', () => {
    expect(UNIT_TICKS).toEqual({ mortar: 90, cauldron: 360 });
  });

  it('interact routes the mortar and the cauldron to their station panel', () => {
    expect(step(scene('mortar'), INTERACT)).toContainEqual({ type: 'uiRequest', ui: 'station', station: 'mortar' });
    expect(step(scene('cauldron'), INTERACT)).toContainEqual({ type: 'uiRequest', ui: 'station', station: 'cauldron' });
  });

  it('StartGrind mint x3: mint -3 at once, a unit and a mintpaste pickup at ticks 90, 180, 270, then free', () => {
    const s = scene('mortar', { mint: 5 });
    const ev0 = step(s, cmd({ type: 'StartGrind', input: 'mint', qty: 3 }));
    expect(ev0).toContainEqual({ type: 'jobStarted', station: 'mortar', item: 'mintpaste', qty: 3 });
    expect(s.inventory.mint).toBe(2);
    expect(s.stations.mortar).toEqual({ recipe: 'mintpaste', remaining: 3, progress: 0 });
    const byStep = perStep(s, 300);
    expect(stepsWith(byStep, (e) => e.type === 'jobUnitDone' && e.station === 'mortar' && e.item === 'mintpaste')).toEqual([
      90, 180, 270,
    ]);
    expect(stepsWith(byStep, (e) => e.type === 'pickupSpawned' && e.item === 'mintpaste')).toEqual([90, 180, 270]);
    expect(stepsWith(byStep, (e) => e.type === 'jobFinished')).toEqual([270]);
    expect(s.stations.mortar).toBeNull();
    // Each unit lands on the tile below the mortar.
    const m = STATION_STRUCTURES.mortar;
    const spawned = byStep.flat().filter((e) => e.type === 'pickupSpawned');
    for (const e of spawned) {
      expect(Math.floor(e.x / TILE)).toBe(m.x / TILE);
      expect(Math.floor(e.y / TILE)).toBe(m.y / TILE + 1);
    }
  });

  it('StartBrew tonic x2: mintpaste -2, reed -2, bogwood -1 at once; tonic at ticks 360 and 720', () => {
    const s = scene('cauldron', { mintpaste: 3, reed: 4, bogwood: 2 });
    step(s, cmd({ type: 'StartBrew', potion: 'tonic', qty: 2 }));
    expect([s.inventory.mintpaste, s.inventory.reed, s.inventory.bogwood]).toEqual([1, 2, 1]);
    const byStep = perStep(s, 800);
    expect(stepsWith(byStep, (e) => e.type === 'jobUnitDone' && e.station === 'cauldron' && e.item === 'tonic')).toEqual([
      360, 720,
    ]);
    expect(stepsWith(byStep, (e) => e.type === 'jobFinished')).toEqual([720]);
    expect(s.stations.cauldron).toBeNull();
  });

  it('rejects qty 6, no bogwood, ingredients for 1 at qty 2, a busy station, and the wrong target', () => {
    const rich = { mintpaste: 9, reed: 9, bogwood: 3 };
    expectRejected(scene('cauldron', rich), { type: 'StartBrew', potion: 'tonic', qty: 6 });
    expectRejected(scene('cauldron', { ...rich, bogwood: 0 }), { type: 'StartBrew', potion: 'tonic', qty: 1 });
    expectRejected(scene('cauldron', { mintpaste: 1, reed: 1, bogwood: 1 }), { type: 'StartBrew', potion: 'tonic', qty: 2 });
    for (const qty of [0, -1, 1.5]) expectRejected(scene('cauldron', rich), { type: 'StartBrew', potion: 'tonic', qty });

    const busy = scene('cauldron', rich);
    step(busy, cmd({ type: 'StartBrew', potion: 'tonic', qty: 1 }));
    expect(busy.stations.cauldron).not.toBeNull();
    expectRejected(busy, { type: 'StartBrew', potion: 'tonic', qty: 1 });

    const grinding = scene('mortar', { mint: 4 });
    step(grinding, cmd({ type: 'StartGrind', input: 'mint', qty: 1 }));
    expectRejected(grinding, { type: 'StartGrind', input: 'mint', qty: 1 });
    expectRejected(scene('mortar', { mint: 2 }), { type: 'StartGrind', input: 'mint', qty: 3 });
    expectRejected(scene('mortar', { reed: 2 }), { type: 'StartGrind', input: 'reed', qty: 1 });

    // Mortar command while targeting the cauldron, and the other way round.
    expectRejected(scene('cauldron', { mint: 4 }), { type: 'StartGrind', input: 'mint', qty: 1 });
    expectRejected(scene('mortar', rich), { type: 'StartBrew', potion: 'tonic', qty: 1 });
    // Targeting nothing at all.
    const away = scene('mortar', { mint: 4 });
    standAt(away, 5, 7, 'down');
    expect(away.player.interactTarget).toBeNull();
    expectRejected(away, { type: 'StartGrind', input: 'mint', qty: 1 });
  });

  it('a job with 2 units left at sleep leaves 2 extra pickups right after the reset and a free station', () => {
    const s = scene('mortar', { mint: 3 });
    step(s, cmd({ type: 'StartGrind', input: 'mint', qty: 3 }));
    const byStep = perStep(s, UNIT_TICKS.mortar);
    expect(stepsWith(byStep, (e) => e.type === 'jobUnitDone')).toEqual([UNIT_TICKS.mortar]);
    expect(s.stations.mortar?.remaining).toBe(2);
    // To the door (one tick, far from the next unit) and sleep.
    standAt(s, 2, 3, 'up');
    expect(s.player.interactTarget).toBe('hut');
    const before = s.pickups.filter((k) => k.item === 'mintpaste').length;
    const ev = step(s, cmd({ type: 'Sleep' }));
    expect(s.day).toBe(2);
    expect(ev.filter((e) => e.type === 'jobUnitDone')).toHaveLength(2);
    expect(ev.filter((e) => e.type === 'pickupSpawned' && e.item === 'mintpaste')).toHaveLength(2);
    expect(ev).toContainEqual({ type: 'jobFinished', station: 'mortar' });
    expect(s.pickups.filter((k) => k.item === 'mintpaste').length).toBe(before + 2);
    expect(s.stations.mortar).toBeNull();
  });

  it('every grind and brew recipe runs end to end and yields the right item', () => {
    for (const r of GRIND_RECIPES) {
      const s = scene('mortar', { [r.input]: 2 });
      step(s, cmd({ type: 'StartGrind', input: r.input, qty: 2 }));
      perStep(s, UNIT_TICKS.mortar * 2 + 60);
      expect(s.inventory[r.input], r.input).toBe(0);
      expect(s.inventory[r.output], r.output).toBe(2);
      expect(s.stations.mortar).toBeNull();
    }
    for (const r of BREW_RECIPES) {
      const inv: Partial<Record<ItemId, number>> = { [CAULDRON_FUEL]: 1 };
      for (const ing of r.ingredients) inv[ing.item] = ing.n * 2;
      const s = scene('cauldron', inv);
      step(s, cmd({ type: 'StartBrew', potion: r.potion, qty: 2 }));
      perStep(s, UNIT_TICKS.cauldron * 2 + 60);
      for (const ing of r.ingredients) expect(s.inventory[ing.item], ing.item).toBe(0);
      expect(s.inventory[CAULDRON_FUEL]).toBe(0);
      expect(s.inventory[r.potion], r.potion).toBe(2);
      expect(s.stations.cauldron).toBeNull();
    }
  });

  it('an idle station emits nothing', () => {
    const s = scene('mortar');
    expect(perStep(s, 200).flat()).toEqual([]);
  });

  it('determinism: a grind and a brew running, a sleep mid-job, byte-identical twice', () => {
    const play = (): string => {
      const s = createInitialState(42);
      s.creatures = [];
      s.nodes = [];
      Object.assign(s.inventory, { mint: 6, mintpaste: 4, reed: 4, bogwood: 2 });
      const events: GameEvent[] = [];
      standAt(s, 10, 3, 'up');
      events.push(...step(s, cmd({ type: 'StartGrind', input: 'mint', qty: 6 })));
      standAt(s, 12, 3, 'up');
      events.push(...step(s, cmd({ type: 'StartBrew', potion: 'tonic', qty: 3 })));
      for (let i = 0; i < 500; i++) {
        events.push(...step(s, { ...neutralFrame(), moveX: Math.sin(i / 17), moveY: Math.cos(i / 23), swing: i % 40 === 0 }));
      }
      standAt(s, 2, 3, 'up');
      events.push(...step(s, cmd({ type: 'Sleep' })));
      // The morning respawned mudlets; clear them again before more time passes.
      s.creatures = [];
      for (let i = 0; i < 300; i++) events.push(...step(s, neutralFrame()));
      expect(s.day).toBe(2);
      expect(events.some((e) => e.type === 'jobFinished' && e.station === 'cauldron')).toBe(true);
      return JSON.stringify({ s, events });
    };
    expect(play()).toBe(play());
  });
});
