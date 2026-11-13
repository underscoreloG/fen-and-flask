# WP09 - Customer types and the daily order (M2, v0.3.2)

Goal: evenings stop being one rule. Four kinds of customer value things differently and wait differently, and every morning a note asks for a specific potion by tonight for a good price.

The user's choice (2026-11-13): "Types plus a daily order".

Read first: SPEC.md, specs/content.md (Stall: reactions and demand), specs/wp/WP06-shop-interior.md, WP07, WP08, this file. **This file wins over WP06 and every earlier file** (WP06 listed customer types as out of scope; that no longer holds); it follows WP07's names and its morning reset order. Then read all of src/.
Depends on: WP08 merged.
Owns: `src/core/orders.ts`, `src/render/ui/orderPanel.ts`, their tests. Edits to existing files as allowed by SPEC section 6.

## Customer types

When a customer enters, roll in this order from the state RNG: its **type**, then its **shelf**, then its **personal** factor.

| id | Name shown | Weight | Value multiplier | Patience | Shelf choice |
|---|---|---|---|---|---|
| traveller | TRAVELLER | 50 | x1 | 1800 ticks (30 s) | any stocked table |
| courier | COURIER | 20 | x1.25 on potions, x1 on the rest | 720 (12 s) | any stocked table |
| haggler | HAGGLER | 15 | x0.85 on everything | 3000 (50 s) | any stocked table |
| herbalist | HERBALIST | 15 | x1.5 on raw and ground items, x1 on potions | 1800 (30 s) | a stocked table holding a raw or ground item if there is one, otherwise any stocked table |

- "Raw" = item kinds `raw` and `fuel` (WP07), so bogwood counts for the herbalist's multiplier and shelf choice.
- `value = base x demand x trend x personal x typeMultiplier`; the four reactions and their thresholds are unchanged.
- When the chosen table is empty on arrival, the re-pick uses the same preference rule.
- The counter toad's delay (480 or 180 ticks) is shorter than every patience above.
- Each type has its own look (hat, coat or bag in different palette tokens), readable at a glance, with front, back and side walking frames.
- The first time a customer of a type pays, `state.shop.met` gains that type (once), and the notebook's new page 3 "CUSTOMERS" shows its name, look and trait: "NOTHING SPECIAL"; "PAYS MORE, WILL NOT WAIT"; "PAYS LESS, WAITS LONG"; "WANTS HERBS AND POWDERS".
- At full demand and with no trend, a first-ever price `max(1, round(0.7 x base))` is never refused by any type (the tightest case is bogwood for a haggler: 1 / (0.95 x 0.85) = 1.24, grumbling, still a sale).

## The daily order

- State: `state.order = { item: PotionId, qty: number, pay: number, done: boolean }` (never null after the first one is drawn).
- Drawn at morning reset step 12, and by `createInitialState` for day 1: the item is uniform among the potions the player can brew now (the trend's candidate rule); `qty` is 1 to 3 (1 to 2 on day 1); `pay = round(1.5 x base value x qty)`. An unfinished order is replaced; nothing is lost.
- Event `orderPosted { item, qty, pay }` at each morning reset. There is no event at game start: when a game starts or loads, the UI toasts the current `state.order` itself ("ORDER: 2 GLOW DRAUGHT FOR 72"); tests check `state.order`.
- A new indoor structure, the **order board**: drawn on the back wall above indoor tile (5,2); interact tile (5,2), facing up; hint `ORDER`. It adds no solid tile.
- The order panel shows the potion, how many, the pay, how many you hold, and DELIVER (dimmed until you hold enough). Once done: "DONE - NEW ORDER TOMORROW".
- Command `DeliverOrder`, valid when the board is the interact target, the order is not done and the inventory holds `qty` of the item: the potions leave the inventory, `pay` coins arrive, `done` becomes true, event `orderDelivered { item, qty, pay }`. It does not touch demand, history or the shop's sold counters. An Ember Elixir delivered this way reaches the M1 goal if it was not reached yet.
- Potions on a table do not count: only the inventory.
- The notebook's price page shows today's order under the trend line.

## Milestone goal

At morning reset step 13, if all 14 catalog items are owned and `state.flags.m2Goal` is false, it becomes true and `m2GoalReached` fires (so a save that already owns everything gets it on its next morning). The UI shows a banner for 6 s: "THE SHOP IS COMPLETE - WELL RUN". Play continues.

## Bot

- Delivers the order when it holds the potions, and brews toward it when ingredients allow.
- Keeps ringing customers up before the shortest patience (720 ticks) until a counter toad is owned.
- Puts a raw or ground item on a table only when it has no potion left to stock on that table; ember powder first (a herbalist values it at 27).

## Sounds

No new files. `coin` on `orderDelivered`; `bell` (low volume) on `orderPosted`.

## Version

`npm version 0.3.2 --no-git-tag-version`, CHANGELOG entry `## v0.3.2 - <date>`. A 0.3.1 save must still load: `order`, `shop.met` and `flags.m2Goal` come from `fillDefaults`, and a test proves it.

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] Vitest: over 4000 type rolls the shares are within 3 points of 50 / 20 / 15 / 15.
- [ ] Vitest, personal 1, demand 1, no trend, glowdraught (base 24): a courier is happy at 32 and refuses at 40 (value 30); a haggler is happy at 22 and refuses at 27 (value 20.4); a traveller keeps the earlier thresholds. Mint (base 2): a herbalist is happy at 3 (value 3) and refuses at 4; a traveller refuses at 3. Bogwood (base 1): a herbalist values it at 1.5.
- [ ] Vitest: a courier leaves unpaid at waited 720, a haggler at 3000, the others at 1800 (no counter toad owned).
- [ ] Vitest: with one table of tonic and one of mint stocked, 200 herbalists all browse the mint table; with only tonic stocked they browse it; a herbalist whose mint table was emptied before arrival re-picks another raw or ground table when one is stocked.
- [ ] Vitest: at demand 1 and no trend, the first price of each of the 13 items is not refused by any type for personal 0.95 and 1.05.
- [ ] Vitest: `met` gains a type on its first payment only, once.
- [ ] Vitest: a new game has an order with qty 1 or 2; 300 mornings on a home-only state never order emberelixir; `pay` equals `round(1.5 x base x qty)`; `orderPosted` fires once per morning reset and never from `createInitialState`.
- [ ] Vitest: `DeliverOrder` moves potions and coins and marks the order done; it is rejected away from the board, with too few potions in the inventory (potions on a table do not count), and a second time the same day; demand, history and sold counters are unchanged by it.
- [ ] Vitest: delivering an Ember Elixir order sets the M1 goal flag if it was not set.
- [ ] Vitest: `m2GoalReached` fires at the first morning reset where all 14 items are owned, once; a state edited to own all 14 with the flag false fires it at its next morning.
- [ ] Vitest health test (bot, seeds 1-3): M1 metrics hold; all 14 catalog items owned and `m2GoalReached` by day 20; the bot delivers at least half of the orders posted from day 3 on; 0 customers left unpaid once a counter toad is owned, and at most 1 before that over the whole run. Print the metrics per seed.
- [ ] Vitest: determinism, week robustness, performance and save round trip (with an order and `met`) pass; a 0.3.1-shaped save (no `order`, no `met`, no `m2Goal`) loads and steps.
- [ ] Browser (run by the brain after merge, you report "not run"): read the order on the board, deliver it with test-menu potions, see the customer looks over a few evenings.

If a health target cannot be met by a competent bot, do not bend it: report the measured numbers and propose the smallest change as a CCR.

## Allowed deferrals

None.

## Out of scope

Named regulars, reputation, order streaks, orders for raw items, haggling dialogue, thieves, new land, new potions.
