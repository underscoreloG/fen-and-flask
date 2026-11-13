# WP09 - Customer types and the daily order (M2, v0.3.2)

Goal: evenings stop being one rule. Four kinds of customer value things differently and wait differently, and every morning a note asks for a specific potion by tonight for a good price.

The user's choice (2026-11-13): "Types plus a daily order".

Read first: SPEC.md, specs/content.md (Stall: reactions and demand), specs/wp/WP06-shop-interior.md, WP07, WP08, this file. Then read all of src/.
Depends on: WP08 merged.
Owns: `src/core/orders.ts`, `src/render/ui/orderPanel.ts`, their tests. Edits to existing files as allowed by SPEC section 6.

## Customer types

Each customer gets a type when it enters, drawn from the state RNG with these weights.

| id | Name shown | Weight | Value multiplier | Patience | Shelf choice |
|---|---|---|---|---|---|
| traveller | TRAVELLER | 50 | x1 | 30 s (1800 ticks) | any stocked shelf |
| courier | COURIER | 20 | x1.25 on potions, x1 on the rest | 12 s (720) | any stocked shelf |
| haggler | HAGGLER | 15 | x0.85 on everything | 50 s (3000) | any stocked shelf |
| herbalist | HERBALIST | 15 | x1.5 on raw and ground items, x1 on potions | 30 s (1800) | a stocked shelf holding a raw or ground item if there is one, otherwise any stocked shelf |

- `value = base x demand x trend x personal x typeMultiplier`; the four reactions and their thresholds are unchanged.
- The counter toad's delay (WP08) is shorter than every patience above, so it still saves every sale.
- Each type has its own look (hat, coat or bag in different palette tokens), readable at a glance; customers keep front, back and side walking frames.
- The first time each type pays, the notebook gains a line about it on a new page 3 "CUSTOMERS": name, look, and its trait in a few words ("PAYS MORE, WILL NOT WAIT"; "PAYS LESS, WAITS LONG"; "WANTS HERBS AND POWDERS"; "NOTHING SPECIAL"). `state.shop.met: CustomerTypeId[]`.
- A first-ever price (0.7 x base) still always sells, to every type (haggler: 0.7 / 0.85 = 0.82, happy).

## The daily order

- State: `state.order = { item: PotionId, qty: number, pay: number, done: boolean } | null`.
- A new order is drawn at every morning reset, and at the start of a new game for day 1: the item is uniform among the potions the player can brew now (the same rule as the trend candidates); `qty` is 1 to 3 (1 to 2 on day 1); `pay = round(1.5 x base value x qty)`. An unfinished order is simply replaced; nothing is lost.
- Event `orderPosted { item, qty, pay }` with the morning (and once at game start); the UI toasts "ORDER: 2 GLOW DRAUGHT FOR 72".
- A new indoor structure, the **order board**: on the back wall above indoor tile (5,2); interact tile (5,2), hint `ORDER`. It is wall-mounted: it adds no solid tile.
- Interacting opens the order panel: the potion, how many, the pay, how many you hold, and DELIVER (dimmed until you hold enough). When the order is done the board shows "DONE - NEW ORDER TOMORROW".
- Command `DeliverOrder`, valid when the board is the interact target, the order is not done and the inventory holds `qty` of the item: the potions leave the inventory, `pay` coins arrive, `done` becomes true, event `orderDelivered { item, qty, pay }`. Delivering does not touch demand, history or the shop's sold counters. An Ember Elixir delivered this way also reaches the M1 goal if it was not reached yet.
- Potions on a shelf do not count: only the inventory.
- The notebook's price page shows today's order under the trend line.

## Milestone goal

When all 13 catalog items are owned, `state.flags.m2Goal` becomes true and `goal2Reached` fires once; the UI shows a banner for 6 s: "THE SHOP IS COMPLETE - WELL RUN". Play continues.

## Bot

Delivers the order when it holds the potions (it may brew toward it when the ingredients allow), keeps ringing customers up before the shortest patience, and stocks at least one raw or ground item on a spare shelf when it has surplus.

## Sounds

No new files. `coin` on `orderDelivered`; `bell` (low volume) on `orderPosted`.

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] Vitest: over 4000 customers the type shares are within 3 points of 50 / 20 / 15 / 15.
- [ ] Vitest, personal 1, demand 1, no trend, glowdraught (base 24): a courier is happy at 33 and refuses at 40 (value 30); a haggler is happy at 22 and refuses at 27 (value 20.4); a traveller keeps the WP04 thresholds. Mint (base 2): a herbalist is happy at 3 (value 3) and refuses at 4; a traveller refuses at 3.
- [ ] Vitest: a courier leaves unpaid at waited 720, a haggler at 3000, others at 1800.
- [ ] Vitest: with one shelf of tonic and one of mint stocked, 200 herbalists all browse the mint shelf; with only tonic stocked they browse it.
- [ ] Vitest: first prices sell to all four types for all 13 items (no refusal at `max(1, round(0.7 x base))`, personal between 0.95 and 1.05). If bogwood (base 1, price 1) fails for the haggler, report it: do not special-case it silently.
- [ ] Vitest: `met` gains a type on its first payment only, once.
- [ ] Vitest: a new game has an order for day 1 with qty 1 or 2; 300 mornings on a home-only state never order emberelixir; `pay` equals `round(1.5 x base x qty)`; `orderPosted` fires once per morning.
- [ ] Vitest: `DeliverOrder` moves potions and coins and marks the order done; it is rejected away from the board, with too few potions in the inventory (potions on a shelf do not count), and a second time the same day; demand and history are unchanged by it.
- [ ] Vitest: delivering an Ember Elixir order sets the M1 goal flag if it was not set.
- [ ] Vitest: `goal2Reached` fires once when the 13th catalog item is delivered, not before, not again.
- [ ] Vitest health test (bot, seeds 1-3): M1 metrics hold; all 13 catalog items owned and `goal2Reached` by day 26 (the WP08 target; orders should only make it sooner); the bot delivers at least half of the orders posted from day 3 on; 0 customers left unpaid once a counter toad is owned, and at most 2 before that over the whole run. Print the metrics per seed.
- [ ] Vitest: determinism, week robustness, performance and save round trip (with an order and `met`) pass; `fillDefaults` restores a deleted `order` key.
- [ ] Browser (run by the brain after merge, you report "not run"): read the order on the board, deliver it with test-menu potions, see the four customer looks in one evening.

If a health target cannot be met by a competent bot, do not bend it: report the measured numbers and propose the smallest change as a CCR.

## Allowed deferrals

None.

## Out of scope

Named regulars, reputation, order streaks, orders for raw items, haggling dialogue, thieves, new land, new potions.
