# WP08 - Helpers: incremental automation (M2, v0.3.1)

Goal: three marsh toads you order from the catalog each take one chore off your hands, in steps: first the till, then the garden, then some of the gathering.

The user's words (2026-11-13): "also some kind of automation but we should do something that is kinda incremental and fit to the game".

Why toads: an apothecary at the edge of a marsh with a few trained toads fits the setting, each one is a visible character in the room rather than a hidden setting, and each automates a chore the player has already done by hand many times. Original creatures, drawn in the palette (they are not plum: plum stays the color of hostile creatures).

Read first: SPEC.md, specs/wp/WP06-shop-interior.md, specs/wp/WP07-catalog-upgrades.md, this file. Then read all of src/.
Depends on: WP07 merged (catalog, delivery, `state.catalog`).
Owns: `src/core/helpers.ts` and its test, `src/render/sprites/toads.ts`. Edits to existing files as allowed by SPEC section 6.

## Catalog items added

| id | Name | Price | Requires | Effect |
|---|---|---|---|---|
| counterToad | COUNTER TOAD | 260 | - | rings up a waiting customer after 8 s |
| counterToad2 | TRAINED COUNTER TOAD | 300 | counterToad | the same after 3 s |
| gardenToad | GARDEN TOAD | 200 | - | each morning harvests ready beds and replants them |
| basketToad | BASKET TOAD | 340 | - | each morning brings 5 gathered ingredients |
| basketToad2 | BIGGER BASKET | 380 | basketToad | brings 9 instead of 5 |

Prices are first guesses (tune). Delivery, ordering and requirements follow WP07 without change.

## Rules

- **Counter toad**: while the shop is open, a customer on queue spot 1 whose `waited` reaches `helpers.counterDelay` (480 ticks; 180 with the trained toad) is rung up automatically, with exactly the effects of `RingUp` (coins, demand, `sale`, queue steps forward, goal). It works wherever the player is, indoors or out. Event `toadRang` just before the `sale`. The player can still ring up sooner by hand. The delay is always shorter than every customer patience.
- **Garden toad**: in the morning reset, right after the garden grows: for each ready bed, its yield goes straight into the inventory, then the bed is replanted with the same crop, taking 1 unit from the inventory. Event `gardenToad { harvested }` (total units) once, only if at least one bed was harvested; the UI toasts "GARDEN TOAD: +N".
- **Basket toad**: in the morning reset: `helpers.basketItems` 5 (9 with the bigger basket) raw items go into the inventory. Each is drawn from the node drop tables of the owned plots, weighted by each node type's morning target on those plots (so mostly mint and reed at home, some emberroot once the east plot is owned). It takes nothing from the world: the plants outside are unaffected. Event `basketToad { items }` (a count per item id) once; the UI toasts "BASKET TOAD: +N".
- Draws use the state RNG. Order inside the morning reset: jobs finish, garden grows, garden toad, plots refill, basket toad, then the existing steps.

## Look

- Counter toad: sits on the counter at indoor tile (2,8); hops and the till flashes when it rings someone up. The trained toad wears a tiny cap.
- Garden toad: sits beside the beds outside (home plot tile (5,3)), non-solid.
- Basket toad: sits with its basket in the back room at indoor (15,10), non-solid; the bigger basket is visibly bigger.
- Each has a 2-frame idle. Green and brown tokens only.

## Bot

Orders the helpers like any catalog item (cheapest first). With a counter toad it may leave the counter while the shop is open to restock; it must still never let a customer leave unpaid.

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] Vitest: with `counterToad`, a queued customer is paid at waited 480 exactly (not 479) with the player outdoors; with `counterToad2` at 180; `toadRang` comes right before `sale`; demand and coins change as for a hand ring-up; a hand `RingUp` before the delay still works and the toad does not ring that customer again.
- [ ] Vitest: without a counter toad nothing rings automatically (the customer leaves unpaid at 1800).
- [ ] Vitest: with `gardenToad`, a ready mint bed gives +3 mint then -1 for the replant at the morning, the bed is growing mint again, and `gardenToad { harvested: 3 }` fires once; with no ready bed the event does not fire; a bed that is still growing is left alone.
- [ ] Vitest: with `basketToad`, each morning adds exactly 5 raw items (9 with `basketToad2`); over 300 mornings on a home-only state no emberroot ever comes and every home raw item comes at least once; with the east plot owned emberroot does come; the node list is unchanged by the draw.
- [ ] Vitest: `counterToad2`, and `basketToad2`, cannot be ordered before their first tier is owned.
- [ ] Vitest: the catalog panel data lists 13 items in total (8 from WP07, 5 here).
- [ ] Vitest health test (bot, seeds 1-3): M1 metrics still hold, the 8 WP07 items are owned by day 16, and all 13 by day 26; 0 customers left unpaid over the whole run. Print per seed the day each item was delivered.
- [ ] Vitest: determinism (a run with all helpers owned replays byte-identical), week robustness and performance tests pass.
- [ ] Vitest: sprite tests cover the toad sprites.
- [ ] Browser (run by the brain after merge, you report "not run"): give the toads through orders with test-menu coins, watch the counter toad ring a customer up.

If a health target cannot be met by a competent bot, do not bend it: report the measured days and propose the smallest price change as a CCR.

## Allowed deferrals

None.

## Out of scope

Helpers that stock shelves, brew, fight or sell on their own; feeding or training helpers; more tiers; customer types and daily orders (WP09).
