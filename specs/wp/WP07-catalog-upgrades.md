# WP07 - Catalog and upgrades (M2, v0.3.0)

Goal: coins have somewhere to go. A catalog in the shop sells upgrades for the shop floor, the workshop and gathering; what you buy arrives the next morning. A bigger, better-signed shop draws more customers, so the upgrades feed each other.

The user's choices (2026-11-13): upgrade groups "Shop floor, Workshop, Gathering"; delivery "Delivered next morning"; plus "some kind of automation ... kinda incremental and fit to the game" (that part is WP08, which adds its items to this catalog).

Read first: SPEC.md, specs/design.md, specs/content.md, specs/wp/WP06-shop-interior.md, this file. **This file wins over WP06 and every earlier file** (WP06 listed buyable tables as out of scope; that no longer holds). Then read all of src/.
Depends on: v0.2.1 on main.
Owns: `src/core/catalog.ts`, `src/render/ui/catalogPanel.ts`, their tests. Edits to existing files as allowed by SPEC section 6.

## Names (fixed, the next two WPs rely on them)

- Catalog item ids are `CatalogId`. The command is `BuyUpgrade { id: CatalogId }`. State: `state.catalog = { owned: CatalogId[], pending: CatalogId[] }`. Event on arrival: `upgradeArrived { id }`.
- The word "order" is reserved for the daily order of WP09. Do not use it for the catalog.
- "Raw" in M2 means item kinds `raw` and `fuel` (so bogwood counts as raw).

## The catalog

- A new indoor structure, the **catalog stand** (a lectern with an open book): solid on indoor tile (12,10), interact tile (12,9), hint `CATALOG`. The player faces down to use it; table 6's interact tile (12,8) is the tile above, and facing decides which one is targeted, as for the sign under table 5.
- The panel lists every catalog item not yet owned: buyable rows first, then rows whose requirement is missing (dimmed, with "NEEDS <NAME>"), then "ARRIVING TOMORROW" for pending ones. Rows you cannot afford are dimmed. The selected row's effect shows as a one-line footer. Confirm on a buyable, affordable row buys it.
- `BuyUpgrade` is valid when the stand is the interact target, the id exists, is neither owned nor pending, its requirement is **owned** (pending is not enough), and its price is at most the player's coins. Coins are taken at once. No refunds, no limit per day.
- **Arrival**: at the morning reset every pending item becomes owned and acts from that same morning; `upgradeArrived { id }` fires for each; the UI shows one toast per item, "ARRIVED: <NAME>".

### Items in this WP

The table lives in `data/content.ts` as `CATALOG`. Prices are first guesses (tune).

| id | Name | Price | Requires | Effect |
|---|---|---|---|---|
| stoneMortar | STONE MORTAR | 90 | - | grinding takes 45 ticks per unit instead of 90 |
| sickle | COPPER SICKLE | 120 | - | every plant and stump needs 1 hit fewer (minimum 1) |
| beds2 | TWO GARDEN BEDS | 150 | - | 2 more soil beds on home plot tiles (6,4) and (7,4) |
| shelf5 | FIFTH TABLE | 200 | - | a 5th display table at indoor (9,7), interact tile (9,8); 2 more customers each evening |
| signboard | PAINTED SIGNBOARD | 220 | - | 2 more customers each evening |
| cauldron2 | SECOND CAULDRON | 300 | - | a second cauldron at indoor (20,3), interact tile (20,4) |
| deepShelves | DEEP TABLES | 360 | - | table capacity 5 -> 8, and one customer in four takes two units |
| shelf6 | SIXTH TABLE | 380 | shelf5 | a 6th display table at indoor (12,7), interact tile (12,8); 2 more customers each evening |
| lanternSign | LANTERN SIGN | 480 | signboard | 3 more customers each evening |

Customers per evening become: 6, +2 per extra owned plot (as today), +2 for each of `shelf5`, `shelf6` and `signboard`, +3 for `lanternSign`: 17 at most. Why: without more customers every other upgrade is wasted, because the shop already makes more than it can sell (measured: 18 to 25 potions made a day against 7 sold).

### Effects, exactly

- **Structures that arrive later**: `StructureDef` gains `requires?: CatalogId`. A structure with a requirement does not exist until that item is owned: not solid, not a target, not drawn. Everything that reads solids must read this from the state: the player's collision, the customer path search, and the bot's path grid (its cache key must change when ownership changes). No invisible obstacles before arrival, no walking through furniture after it.
- **Tables 5 and 6**: `shop.shelves` starts with 4 entries; arrival pushes a 5th then a 6th. They follow every shelf rule. Customers choose uniformly among stocked tables and reach the new interact tiles from rows 9-10; they never step on a table tile and never on the staff row behind the counter (row 7, x 1 to 4).
- **Deep tables**: the capacity used by `StockShelf` and the shelf panel becomes 8; the world view shows counts above 5 legibly. Also, when a customer's reaction sells and its table holds at least 2 units, it takes **two** with probability `shop.doubleChance` 0.25 (one state RNG roll, made only when deep tables are owned and the table holds 2 or more). It then carries 2 units at the same unit price: ringing up pays twice the price, the demand drop applies per unit (the grumbling extra once), `soldCount` rises by 2, and `sale` carries `qty`. If it leaves unpaid both units go back (table first, the rest to the inventory).
- **Signboard, lantern sign**: `customersFor` adds as above; the hut outside shows the painted board, then a lantern on it.
- **Stone mortar**: a unit that starts after arrival takes 45 ticks; the mortar sprite changes.
- **Second cauldron**: `StationKind` gains `'cauldron2'` and `state.stations.cauldron2`. `StartGrind` and `StartBrew` act on the station the player targets (the command carries no station; the target decides), and `uiRequest`, `jobStarted`, `jobUnitDone` and `jobFinished` carry the station id. Same recipes, fuel cost and panel as the first cauldron; outputs appear on its own interact tile.
- **Copper sickle**: hits needed = max(1, table hits - 1) for every node type. On arrival, nodes already damaged keep their remaining hits, capped to the new need.
- **Garden beds**: `state.garden` grows to 6 on arrival. The node spawn clearance around tiles (6,4) and (7,4) may be in force from day 1 (the existing beds already keep those tiles clear). On arrival, any node standing on either tile is removed without drops.

## Morning reset order (the same list in WP07, WP08 and WP09)

1. day and clock; 2. the player wakes in bed; 3. station jobs finish; 4. **catalog arrivals** (effects apply, `upgradeArrived`); 5. the garden grows; 6. garden toad (WP08); 7. plots refill their nodes; 8. mudlets refill; 9. basket toad (WP08); 10. hearts; 11. demand, trend and shop reset; 12. the daily order (WP09); 13. the M2 goal check (WP09); 14. `morning` (the UI saves on it).

## Saves

- Version 0.3.0 (`npm version 0.3.0 --no-git-tag-version`, CHANGELOG entry `## v0.3.0 - <date>`). A 0.2.x save is ignored by the existing major.minor rule.
- From now on a field added inside a minor version must not break saves: add `fillDefaults(loaded, fresh)` to `src/save/save.ts` and call it on load with a fresh `createInitialState`. A key is missing when `!(key in loaded)`; it is then copied from `fresh`. Recurse only when both values are non-null plain objects. `null`, arrays and scalars are kept as loaded (so 5 loaded shelves stay 5). Fields added later to array elements (shelves, beds, nodes, creatures, pickups, customers) must be read with a default in code.

## Bot

- After the east plot is bought, when indoors with nothing else to start and coins cover the cheapest buyable item, it walks to the stand and buys it (cheapest first; ties in `CATALOG` order).
- It stocks tables 5 and 6, fills deep tables to 8, uses the second cauldron, and plants beds 5 and 6.
- It keeps one table per potion type it holds before doubling up; a table left over goes to the potion it holds the most units of.
- It plants emberroot in beds 5 and 6 when it holds at least 3, otherwise the same crops as the other beds.

## Interface

- The catalog panel as described (reuse `ListPanel`).
- A crate sits by the door the morning something arrived and disappears when the player walks past it (render only).
- New sprites: catalog stand, stone mortar, signboard and lantern on the hut, crate; tables 5-6 and the second cauldron reuse existing frames; the copper sickle changes the tool color in the player's swing frame.

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] Vitest: `CATALOG` holds exactly the 9 items above with these prices and requirements.
- [ ] Vitest: `BuyUpgrade` takes the coins and lists the id as pending; it is rejected (state unchanged) away from the stand, without enough coins, for an owned id, a pending id, an unknown id, and for `shelf6` while `shelf5` is only pending.
- [ ] Vitest: nothing changes until the morning reset; then `upgradeArrived` fires once per pending id, before `morning`, and the item acts that same morning.
- [ ] Vitest: before `shelf5` arrives the player walks freely across indoor tile (9,7) and the interact target from (9,8) facing up is not a table (the sign below may be picked by the assist); after it, (9,7) is solid, the target there is the fifth table and `StockShelf` works from (9,8).
- [ ] Vitest: with tables 5 and 6 owned and all six stocked, over 200 customers every table is browsed at least once and no customer ever stands on (9,7), (12,7), or on row 7 with x <= 4.
- [ ] Vitest: customers per evening: 6 at start; 8 with `shelf5`; 10 with `shelf5` and `signboard`; 17 with two plots and all four of `shelf5`, `shelf6`, `signboard`, `lanternSign`.
- [ ] Vitest: with `deepShelves`, stocking 8 works and 9 is rejected; without it 6 is rejected. With the double roll forced to succeed, a happy customer takes 2 units, pays twice the price at ring-up, demand drops by 0.08, `sale` has `qty: 2`; forced to fail, or on a table holding 1 unit, or without `deepShelves`, it takes 1. Over 2000 buying customers on full tables the share of doubles is within 3 points of 25%. A double that leaves unpaid returns both units.
- [ ] Vitest: with `stoneMortar`, grinding 3 mint emits `jobUnitDone` at ticks 45, 90 and 135.
- [ ] Vitest: with `cauldron2`, two brew jobs run at once, each costing 1 bogwood, each dropping its outputs on its own interact tile and naming its own station in its events; before it arrives, tile (20,3) is walkable and nothing is targeted from (20,4) facing up.
- [ ] Vitest: with `sickle`, a reedclump breaks on hit 1, a stump on hit 2, a mintbush still on hit 1; a stump hit once before arrival breaks on its next hit.
- [ ] Vitest: with `beds2`, the garden has 6 beds, a node placed on tile (6,4) before arrival is gone after it, and over seeds 1-20 no node ever spawns on or next to the new bed tiles.
- [ ] Vitest: save round trip with owned and pending ids; a 0.2.1 save returns null; `fillDefaults` restores a deleted `catalog` key and keeps a 5-entry `shelves` array at 5.
- [ ] Vitest health test (bot, seeds 1-3, live mudlets): the M1 metrics still hold (evening-1 coins 40-130, `plotBought` by day 4, `goalReached` by day 6); the bot owns all 9 items by day 15; with L the arrival day of `lanternSign`, the run lasts until day L+4, and over evenings L to L+4 the average coins per evening are at least 1.5 times the average of evenings 3 to 5 and the average units sold per evening are at least 12. Print per seed the arrival day of each item and those averages.
- [ ] Vitest: week robustness, determinism and performance tests still pass.
- [ ] Browser (run by the brain after merge, you report "not run"): buy an item with test-menu coins, sleep, see it arrive.

If a health target cannot be met by a competent bot, do not bend it: report the measured numbers and propose the smallest price or number change as a CCR.

## Allowed deferrals

None.

## Out of scope

Helpers and automation (WP08), customer types and the daily order (WP09), new land, new potions, customers buying more than two units or two units without deep tables, selling upgrades back, decoration.
