# WP07 - Catalog and upgrades (M2, v0.3.0)

Goal: coins have somewhere to go. A catalog in the shop sells upgrades for the shop floor, the workshop and gathering; what you order arrives the next morning.

The user's choices (2026-11-13): upgrade groups "Shop floor, Workshop, Gathering"; delivery "Delivered next morning"; plus "some kind of automation ... kinda incremental and fit to the game" (that part is WP08, which adds its items to this catalog).

Read first: SPEC.md, specs/design.md, specs/content.md, specs/wp/WP06-shop-interior.md, this file. WP06 and this file win over the older three. Then read all of src/.
Depends on: v0.2.1 on main.
Owns: `src/core/catalog.ts`, `src/render/ui/catalogPanel.ts`, their tests. Edits to existing files as allowed by SPEC section 6.

## The catalog

- A new indoor structure, the **catalog stand** (a lectern with an open book): solid on indoor tile (12,10), interact tile (12,9), hint `CATALOG`.
- Interacting opens the catalog panel: one row per item that can be ordered now, with its price and a one-line effect; rows you cannot afford are dimmed; items already on order are listed under "ARRIVING TOMORROW". Confirm on a row orders it.
- Command `Order { item }`, valid when the stand is the interact target: the item must exist, not be owned, not be on order, have its requirement owned, and cost at most the player's coins. Coins are taken at once. No refunds, no limit on orders per day.
- **Delivery**: at the morning reset every item on order becomes owned and its effect applies; event `delivered { item }` for each (the UI shows one toast per item, "DELIVERED: <NAME>").
- State: `state.catalog = { owned: CatalogId[], ordered: CatalogId[] }`.

### Items in this WP

| id | Name | Price | Requires | Effect |
|---|---|---|---|---|
| shelf5 | FIFTH TABLE | 120 | - | a 5th display table at indoor (9,7), interact tile (9,8) |
| shelf6 | SIXTH TABLE | 220 | shelf5 | a 6th display table at indoor (12,7), interact tile (12,8) |
| deepShelves | DEEP TABLES | 160 | - | shelf capacity 5 -> 8 |
| signboard | PAINTED SIGNBOARD | 180 | - | 2 more customers each evening |
| stoneMortar | STONE MORTAR | 90 | - | grinding takes 45 ticks per unit instead of 90 |
| cauldron2 | SECOND CAULDRON | 240 | - | a second cauldron at indoor (20,3), interact tile (20,4) |
| sickle | COPPER SICKLE | 110 | - | every plant and stump needs 1 hit fewer (minimum 1) |
| beds2 | TWO GARDEN BEDS | 140 | - | 2 more soil beds on home plot tiles (6,4) and (7,4) |

Prices are first guesses (tune) and live in `data/content.ts` with the rest of the table.

### Effects, exactly

- **Tables 5 and 6**: `shop.shelves` grows to 5 then 6 entries. They behave like the first four in every rule (stocking, customers choosing uniformly among stocked shelves, customer routes). The structure exists (solid, interactable, drawn) only once owned. Customers reach their interact tiles from rows 9-10 and still never walk the staff row behind the counter.
- **Deep tables**: the capacity used by `StockShelf` and the shelf panel becomes 8. The world view shows counts above 5 legibly.
- **Signboard**: `customersFor` adds 2. The hut outside shows the painted board.
- **Stone mortar**: the mortar's unit time becomes 45 ticks; the new time applies from the next unit a job starts (a unit already in progress keeps counting to 90). The mortar sprite changes.
- **Second cauldron**: `state.stations.cauldron2`, same rules, recipes, fuel cost and panel as the first; its outputs appear on its own interact tile. The structure exists only once owned.
- **Copper sickle**: hits needed = max(1, table hits - 1) for every node type. Nodes already damaged keep their remaining hits, capped to the new need.
- **Garden beds**: `state.garden` grows to 6. On delivery a plant or stump standing on one of the two tiles is removed without drops, and the node spawn rule treats the new beds as structures from then on.

## Saves

- Version 0.3.0. A 0.2.x save is ignored (existing major.minor rule).
- From now on additive fields must not break saves inside a minor version: add `fillDefaults(loaded, fresh)` in `src/save/save.ts`, a generic deep fill that copies every key missing in the loaded state from a fresh `createInitialState` (objects merged key by key, arrays and scalars kept as loaded), and call it on load. Test: a 0.3.0 save with `catalog` deleted loads with an empty catalog and steps without throwing.

## Bot

`botFrame` orders from the catalog: after the east plot is bought, when it is indoors with nothing else to start and coins cover the cheapest item it can order, it walks to the stand and orders it. It stocks tables 5 and 6, uses the deeper tables and the second cauldron once owned.

## Interface

- Catalog panel per the rules above (reuse `ListPanel`; the effect line can be its footer for the selected row).
- Toast on each delivery. A crate sits by the door the morning something arrived and disappears when the player walks past it (render only).
- New sprites: catalog stand, tables 5-6 reuse the table sprite, stone mortar, second cauldron reuses the cauldron frames, copper sickle changes the player's swing frame tool color, signboard on the hut, crate.

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] Vitest: `Order` takes the coins and lists the item as ordered; it is rejected (state unchanged) away from the stand, without enough coins, for an owned item, for an item already on order, for an unknown id, and for `shelf6` before `shelf5` is owned (ordered is not enough).
- [ ] Vitest: nothing changes until the morning reset; then `delivered` fires once per ordered item, `owned` holds them and `ordered` is empty.
- [ ] Vitest: after `shelf5` is delivered there are 5 shelves, the table at (9,7) is solid, `StockShelf` works on it from (9,8), and over 200 customers on a state with only shelf 5 stocked every one browses it and none ever stands on a tile of row 7 with x <= 5.
- [ ] Vitest: with `deepShelves`, stocking 8 works and 9 is rejected; without it 6 is rejected.
- [ ] Vitest: with `signboard`, 8 customers come with one plot and 10 with two.
- [ ] Vitest: with `stoneMortar`, grinding 3 mint emits `jobUnitDone` at ticks 45, 90 and 135.
- [ ] Vitest: with `cauldron2`, two brew jobs run at the same time, each costing 1 bogwood, each dropping its outputs on its own interact tile; without it a command for the second cauldron is rejected.
- [ ] Vitest: with `sickle`, a reedclump breaks on hit 1, a stump on hit 2, a mintbush still on hit 1.
- [ ] Vitest: with `beds2`, the garden has 6 beds, a node placed on tile (6,4) before delivery is gone after it, and over seeds 1-20 no node spawns on or next to the new beds.
- [ ] Vitest: save round trip with owned and ordered items; a 0.2.1 save returns null; `fillDefaults` restores a deleted `catalog` key.
- [ ] Vitest health test (bot, seeds 1-3, live mudlets): the M1 metrics still hold (evening-1 coins 40-130, `plotBought` by day 4, `goalReached` by day 6), and the bot owns all 8 items of this WP by day 16. Print per seed the day each item was delivered.
- [ ] Vitest: week robustness, determinism and performance tests still pass.
- [ ] Browser (run by the brain after merge, you report "not run"): order an item with the test menu's coins, sleep, see it delivered.

If a health target cannot be met by a competent bot, do not bend it: report the measured days and propose the smallest price change as a CCR.

## Allowed deferrals

None.

## Out of scope

Helpers and automation (WP08), customer types and daily orders (WP09), new land, new potions, selling upgrades back, decoration items.
