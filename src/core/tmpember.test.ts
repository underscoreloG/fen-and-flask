import { it } from 'vitest';
import { CATALOG } from '../data/content';
import { botFrame } from './bot';
import { createInitialState } from './state';
import { step } from './step';
it('ember + arrivals', () => {
  for (const seed of [1, 2, 3]) {
    const s = createInitialState(seed);
    const plants: Record<string, number> = {};
    const arr: Record<string, number> = {};
    const ev: Record<number, string> = {};
    let unpaid = 0, rang = 0, emberBasket = 0;
    for (let i = 0; i < 4000000 && s.day <= 24; i++) {
      const f = botFrame(s);
      for (const c of f.commands) if (c.type === 'Plant') plants[`${c.bed}:${c.item}`] = (plants[`${c.bed}:${c.item}`] ?? 0) + 1;
      for (const e of step(s, f)) {
        if (e.type === 'upgradeArrived') arr[e.id] = s.day;
        if (e.type === 'stallClosed') ev[s.day] = `${e.soldCoins}/${e.soldCount}`;
        if (e.type === 'customerLeftUnpaid') unpaid++;
        if (e.type === 'toadRang') rang++;
        if (e.type === 'basketToadBrought') emberBasket += e.items.emberroot ?? 0;
      }
    }
    console.log(`[m] seed ${seed} day ${s.day} coins ${s.coins} unpaid ${unpaid} rang ${rang} emberFromBasket ${emberBasket}\n plants ${JSON.stringify(plants)}\n arrivals ${CATALOG.map((d) => d.id + ' ' + (arr[d.id] ?? '-')).join(', ')}\n evenings ${JSON.stringify(ev)}`);
  }
}, 300000);
