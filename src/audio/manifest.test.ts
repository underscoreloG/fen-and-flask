import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../core/events';
import { TUNING } from '../data/tuning';
import { createLimiter, SOUNDS, soundsFor } from './manifest';

// fileURLToPath, not URL.pathname: the latter keeps %-escapes and a leading slash on Windows.
const AUDIO_DIR = fileURLToPath(new URL('../../public/audio/', import.meta.url));
const DESIGN = fileURLToPath(new URL('../../specs/design.md', import.meta.url));
// SPEC section 5: 1 KB = 1000 bytes.
const MAX_BYTES = 150_000;
const MAX_AMBIENCE_BYTES = 400_000;

describe('sound manifest', () => {
  it('every entry has its file in public/audio, under the size budget', () => {
    for (const s of SOUNDS) {
      const size = statSync(join(AUDIO_DIR, s.file)).size;
      expect(size, s.file).toBeLessThan(s.id === 'marsh_ambience' ? MAX_AMBIENCE_BYTES : MAX_BYTES);
    }
  });

  it('every file in public/audio except CREDITS.md is in the manifest', () => {
    const files = readdirSync(AUDIO_DIR).filter((f) => f !== 'CREDITS.md');
    expect(files.sort()).toEqual(SOUNDS.map((s) => s.file).sort());
  });

  it('every sound id of design.md is in the manifest', () => {
    const line = readFileSync(DESIGN, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('Ids:'));
    const ids = [...(line ?? '').matchAll(/`([a-z_]+)`/g)].map((m) => m[1]);
    expect(ids.length).toBe(16);
    for (const id of ids) expect(SOUNDS.map((s) => s.id)).toContain(id);
  });

  it('ids are unique and volumes are in 0..1', () => {
    expect(new Set(SOUNDS.map((s) => s.id)).size).toBe(SOUNDS.length);
    for (const s of SOUNDS) expect(s.volume > 0 && s.volume <= 1, s.id).toBe(true);
  });
});

describe('event to sound', () => {
  const at = { x: 0, y: 0 };
  const cases: [GameEvent, string[]][] = [
    [{ type: 'swing', ...at, facing: 'down', targetId: null }, ['swing']],
    [{ type: 'nodeHit', id: 1, nodeType: 'mintbush', ...at, hp: 1 }, ['hit_plant']],
    [{ type: 'nodeHit', id: 1, nodeType: 'glowcaps', ...at, hp: 1 }, ['hit_plant']],
    [{ type: 'nodeHit', id: 1, nodeType: 'reedclump', ...at, hp: 1 }, ['hit_plant']],
    [{ type: 'nodeHit', id: 1, nodeType: 'emberplant', ...at, hp: 1 }, ['hit_plant']],
    [{ type: 'nodeHit', id: 1, nodeType: 'stump', ...at, hp: 1 }, ['hit_wood']],
    [{ type: 'creatureHit', id: 1, creatureType: 'mudlet', ...at, hp: 1 }, ['squish']],
    [{ type: 'creatureDied', id: 1, creatureType: 'mudlet', ...at }, ['squish']],
    [{ type: 'pickupCollected', id: 1, item: 'mint', ...at, count: 1 }, ['pickup']],
    [{ type: 'jobStarted', station: 'mortar', item: 'mintpaste', qty: 2 }, ['grind']],
    [{ type: 'jobStarted', station: 'cauldron', item: 'glowdraught', qty: 2 }, ['bubble']],
    [{ type: 'jobUnitDone', station: 'cauldron', item: 'glowdraught' }, ['potion_done']],
    [{ type: 'jobCancelled', station: 'cauldron', item: 'glowdraught', refunded: 2 }, ['pickup']],
    [{ type: 'sale', item: 'glowdraught', price: 20, qty: 1 }, ['coin']],
    [{ type: 'customerReacted', item: 'glowdraught', price: 99, reaction: 'refuses', sold: false }, ['refuse']],
    [{ type: 'customerLeftUnpaid', item: 'glowdraught' }, ['refuse']],
    [{ type: 'customerQueued', item: 'glowdraught' }, ['bell']],
    [{ type: 'stallOpened' }, ['bell']],
    [{ type: 'orderDelivered', item: 'tonic', qty: 2, pay: 42 }, ['coin']],
    [{ type: 'orderPosted', item: 'tonic', qty: 2, pay: 42 }, ['bell']],
    [{ type: 'playerHurt', ...at, hearts: 4, fromX: 0, fromY: 0 }, ['hurt']],
    [{ type: 'morning', day: 2 }, ['sleep']],
  ];
  it.each(cases)('%o -> %o', (e, ids) => {
    expect(soundsFor(e).map((p) => p.id)).toEqual(ids);
  });

  it('the bell rings softer for a customer at the counter than for the opening; others play at their base volume', () => {
    const [open] = soundsFor({ type: 'stallOpened' });
    const [queued] = soundsFor({ type: 'customerQueued', item: 'tonic' });
    expect(queued!.volume).toBeLessThan(open!.volume);
    const [posted] = soundsFor({ type: 'orderPosted', item: 'salve', qty: 1, pay: 27 });
    expect(posted!.volume).toBeLessThan(open!.volume);
    const refuse = SOUNDS.find((s) => s.id === 'refuse')!;
    expect(soundsFor({ type: 'customerLeftUnpaid', item: 'tonic' })).toEqual([{ id: 'refuse', volume: refuse.volume }]);
  });

  const silent: GameEvent[] = [
    { type: 'nodeBroken', id: 1, nodeType: 'stump', ...at },
    { type: 'jobUnitDone', station: 'mortar', item: 'mintpaste' },
    { type: 'jobFinished', station: 'cauldron' },
    { type: 'customerArrived', item: 'glowdraught' },
    { type: 'customerReacted', item: 'glowdraught', price: 20, reaction: 'happy', sold: true },
    { type: 'areaChanged', area: 'shop' },
    { type: 'stallClosed', soldCount: 1, soldCoins: 20 },
    { type: 'eveningStarted', day: 1 },
    { type: 'goalReached' },
    { type: 'm2GoalReached' },
    { type: 'plotBought', plot: 1 },
    { type: 'uiRequest', ui: 'sleepConfirm' },
  ];
  it.each(silent)('%o -> nothing', (e) => {
    expect(soundsFor(e)).toEqual([]);
  });
});

describe('rate limit', () => {
  it('drops a second identical id inside 50 ms, not other ids', () => {
    expect(TUNING.audio.minGapMs).toBe(50);
    const allow = createLimiter(TUNING.audio.minGapMs);
    expect(allow('coin', 1000)).toBe(true);
    expect(allow('coin', 1049)).toBe(false);
    expect(allow('swing', 1010)).toBe(true);
    expect(allow('coin', 1050)).toBe(true);
  });
});
