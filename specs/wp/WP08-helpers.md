# WP08 - Helpers: incremental automation (M2, v0.3.1)

Goal: three marsh toads you buy from the catalog each take one chore off your hands, in steps: first the till, then the garden, then some of the gathering.

The user's words (2026-11-13): "also some kind of automation but we should do something that is kinda incremental and fit to the game".

Why toads: an apothecary at the edge of a marsh with a few trained toads fits the setting, each one is a visible character in the room rather than a hidden setting, and each automates a chore the player has already done by hand many times. Original creatures, drawn in the palette (never plum: plum stays the color of hostile creatures).

Read first: SPEC.md, specs/wp/WP06-shop-interior.md, specs/wp/WP07-catalog-upgrades.md, this file. **This file wins over WP06 and every earlier file**; it follows WP07's names (`BuyUpgrade`, `catalog.pending`, `upgradeArrived`, "raw" = kinds raw and fuel). Then read all of src/.
Depends on: WP07 merged.
Owns: `src/core/helpers.ts` and its test, `src/render/sprites/toads.ts`. Edits to existing files as allowed by SPEC section 6.

## Catalog items added to `CATALOG`

| id | Name | Price | Requires | Effect |
|---|---|---|---|---|
| gardenToad | GARDEN TOAD | 280 | - | each morning harvests ready beds and replants them |
| counterToad | COUNTER TOAD | 320 | - | rings up a waiting customer after 8 s |
| basketToad | BASKET TOAD | 420 | - | each morning brings 5 gathered ingredients |
| counterToad2 | TRAINED COUNTER TOAD | 450 | counterToad | the same after 3 s |
| basketToad2 | BIGGER BASKET | 520 | basketToad | brings 9 instead of 5 |

Prices are first guesses (tune). Buying, arrival and requirements follow WP07 without change. The catalog then holds 14 items.

## Rules

- **Counter toad**: while the shop is open, each tick, before the patience check: if a customer is queued on spot 1 and its `waited` is at least `helpers.counterDelay` (480 ticks; 180 with the trained toad), it is rung up with exactly the effects of `RingUp` (coins, demand, `sale`, the queue steps forward, goal). `>=`, never `===`: a customer who steps up from spot 2 having already waited longer is rung up on the tick it reaches spot 1. Event `toadRang` just before the `sale`. It works wherever the player is indoors (the exit stays shut while the shop is open, as in WP06). The player can still ring up sooner by hand.
- **Garden toad**: morning reset step 6, right after the garden grows: for each ready bed, its yield goes straight into the inventory, then the bed is replanted with the same crop, taking 1 unit from the inventory (every yield is at least 2, so the unit is always there). Event `gardenToadHarvested { harvested }` (total units) once, only if at least one bed was harvested; the UI toasts "GARDEN TOAD: +N".
- **Basket toad**: morning reset step 9: `helpers.basketItems` 5 (9 with the bigger basket) items go into the inventory. Each is one draw from this pool, weighted by the morning node targets of the owned plots: home plot - mint 6, glowcap 4, reed 6, bogwood 3; the east plot adds glowcap 3, reed 3, bogwood 2, emberroot 4. Build the pool from the node tables, do not hard-code it. Mud gel never comes (it is not a node drop). The draw takes nothing from the world. Event `basketToadBrought { items }` (a count per item id) once; the UI toasts "BASKET TOAD: +N".
- Draws use the state RNG, at the step given in WP07's morning reset order.

## Look

- Counter toad: sits on the counter at indoor tile (2,8); hops and the till flashes when it rings someone up. The trained toad wears a tiny cap.
- Garden toad: sits beside the beds outside, on home plot tile (5,3), non-solid.
- Basket toad: sits with its basket in the back room at indoor (15,10), non-solid; the bigger basket is visibly bigger.
- Each has a 2-frame idle. Green and brown tokens only.

## Bot

Buys the helpers like any catalog item (cheapest buyable first). With a counter toad it may leave the counter while the shop is open to restock tables; it must still never let a customer leave unpaid.

## Version

`npm version 0.3.1 --no-git-tag-version`, CHANGELOG entry `## v0.3.1 - <date>`. A 0.3.0 save must still load (no new top-level state is needed; if you add any, `fillDefaults` covers it and a test proves it).

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] Vitest: `CATALOG` holds 14 items: the 9 of WP07 and the 5 above with these prices and requirements; `counterToad2` and `basketToad2` cannot be bought while their first tier is only pending.
- [ ] Vitest: with `counterToad` and the player on the cot's interact tile (18,9), a queued customer is paid at waited 480 exactly (not at 479); with `counterToad2` at 180; `toadRang` comes right before `sale`; demand and coins change as for a hand ring-up; a hand `RingUp` before the delay still works and that customer is not rung again.
- [ ] Vitest: a customer who reaches spot 1 with `waited` already above the delay is rung up on that tick.
- [ ] Vitest: without a counter toad nothing rings automatically (the customer leaves unpaid at 1800).
- [ ] Vitest: with `gardenToad`, a ready mint bed gives +3 mint then -1 for the replant at the morning, the bed is growing mint again, and `gardenToadHarvested { harvested: 3 }` fires once; with no ready bed the event does not fire; a bed still growing is left alone.
- [ ] Vitest: with `basketToad`, each morning adds exactly 5 items (9 with `basketToad2`); over 300 mornings on a home-only state only mint, glowcap, reed and bogwood come, each at least once, never emberroot or mud gel; with the east plot owned emberroot does come; the node list is unchanged by the draw.
- [ ] Vitest: an item that arrives in the morning acts that morning (a `basketToad` bought yesterday brings 5 items today).
- [ ] Vitest health test (bot, seeds 1-3): M1 metrics hold; the 9 WP07 items are owned by day 15 and all 14 by day 22; 0 customers left unpaid over the whole run. Print per seed the arrival day of each item.
- [ ] Vitest: determinism (a run with all helpers owned replays byte-identical), week robustness and performance tests pass.
- [ ] Vitest: sprite tests cover the toad sprites.
- [ ] Browser (run by the brain after merge, you report "not run"): buy the toads with test-menu coins, watch the counter toad ring a customer up.

If a health target cannot be met by a competent bot, do not bend it: report the measured days and propose the smallest price change as a CCR.

## Allowed deferrals

None.

## Out of scope

Helpers that stock tables, brew, fight or set prices; feeding or training helpers; more tiers; customer types and the daily order (WP09).
