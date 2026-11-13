# WP06 - Shop interior (v0.2.0)

Goal: the hut becomes a building you walk into: a shop room with display shelves, a counter and a till, and a back room with the mortar, the cauldron and the bed. You stock shelves, set prices, open the shop, customers walk in, browse, react and queue at the counter, and you ring them up. The outdoor stall and the outdoor stations are gone.

The user's words (2026-11-13), which this WP serves:
- "I would love the shop to be inside the house with a shop visual"
- "I want to put my stuff on shelfs set the price exactly like in moonlighter"
- "I also want the potion making stuff inside the shop in some kind of a backroom or basement"

IP rule (SPEC header): take the mechanic (shelves, a price per item, customers who browse, react and pay at a counter), not another game's room layout, sprites, UI or names. Everything drawn here is original.

Read first: SPEC.md, specs/design.md, specs/content.md, this file. **Where this file disagrees with those three or with WP00-WP05, this file wins.** Then read all of src/ (this WP touches most of it).
Depends on: v0.1.3 on main (all of WP00-WP05).
Owns: `src/core/shop.ts` (may replace `stall.ts`), `src/render/ui/shelfPanel.ts` (may replace `stallPanel.ts`), `src/render/sprites/interior.ts`, their tests. Edits to existing files as allowed by SPEC section 6; this WP may also delete `src/core/stall.ts` and `src/render/ui/stallPanel.ts` and rewrite the tests of WP02-WP05 that referred to the outdoor stall, stations and door.

## Decisions (the user answered these on 2026-11-13)

- The shop **replaces** the outdoor stall. One selling system.
- Shelves take **potions and raw ingredients**: every item in the game can be shelved and sold.
- Checkout, in the user's words: "same as moonlighter they go to the cashier and wait for you to approve transaction. If you take too much time, they leave without paying. But like waiting for 30s or so".
- The back room is on the same floor and the same indoor map (no stairs, no second screen).
- Garden beds, plants, mudlets and the signpost stay outside.

## Areas

- `state.player.area: 'world' | 'shop'`. Pickups get an `area` too. Nodes and creatures exist only in the world.
- The whole sim keeps running whatever the area: clock, station jobs, garden, creatures wandering.
- Creatures ignore a player who is not in the world (no aggro, no contact damage). This replaces the WP04 "stall guard".
- Swinging indoors is allowed and hits nothing.

### Getting in and out (walk through, no button)

- Outside: the hut's bottom-middle tile, home plot tile (2,2), becomes a non-solid **doorway**. When the player's feet center is on it, the player moves to the center of indoor tile (7,10), facing up.
- Inside: indoor tile (7,11) is the **exit**. When the player's feet center is on it, the player moves to the center of home plot tile (2,3), facing down.
- The exit does nothing while the shop is open for business (the player is simply blocked there, with the hint "CLOSE SHOP FIRST").
- A transition must never bounce back: after one, holding the same direction keeps the player on the arrival side.

### Indoor map

22 x 12 tiles (352 x 192 px), drawn centered in the 480x270 view on an `ink` background; the camera does not scroll indoors. Indoor tile coordinates start at its top-left.

- Walls: rows 0-1 (back wall, drawn two tiles high), column 0, column 21, row 11 (except the exit tile), and a partition at column 14 with a doorway at (14,6).
- Shop room floor: columns 1-13, rows 2-10. Back room floor: columns 15-20, rows 2-10.

| Thing | Tiles | Solid | Interact tile | Hint |
|---|---|---|---|---|
| Shelf 1-4 (display tables) | (3,4) (6,4) (9,4) (12,4) | yes | the tile below each: (3,5) (6,5) (9,5) (12,5) | SHELF |
| Counter | (2,8) (3,8) (4,8), till drawn on (3,8) | yes | (3,7) (the player stands behind it) | RING UP when a customer waits, otherwise none |
| Shop sign (stand by the door) | (9,10) | yes | (9,9) | OPEN SHOP (by day too: opening ends the day); CLOSE SHOP while open |
| Customer queue spots | (3,9), then (4,9) | no | - | - |
| Mortar | (16,3) | yes | (16,4) | GRIND |
| Cauldron | (18,3) | yes | (18,4) | BREW |
| Bed | (19,9) (20,9) | yes | (18,9) | SLEEP |

Removed from the home plot: mortar, cauldron, stall, customer spot. The hut keeps tiles (1,1) (3,1) (1,2) (3,2) and (2,1) solid; (2,2) is the doorway. The node spawn rule keeps 1 tile clear of the doorway and of tile (2,3).

Station outputs appear as pickups on the station's interact tile, in the `shop` area.

## Shelves and prices

- `shop.shelves`: 4 entries `{ item: ItemId | null, count }`. `shop.shelfCapacity` = 5.
- Every item is sellable and has a base value (table below). Prices, demand and history are **per item id** (`prices[item]` and so on), first-ever price `max(1, round(0.7 x base))`, remembered across days. The daily trend still picks among potions only.

| Item | Base value | Item | Base value |
|---|---|---|---|
| mint | 2 | mintpaste | 3 |
| reed | 2 | glowdust | 6 |
| bogwood | 1 | emberpowder | 18 |
| glowcap | 4 | tonic | 14 |
| mudgel | 4 | salve | 18 |
| emberroot | 12 | glowdraught | 24 |
| | | emberelixir | 60 |

Raw and ground values are first guesses (tune): a potion is worth about 2.5 times its ingredients, and each customer buys one unit, so brewing stays the better use of a customer.
- Commands, each valid only when that shelf is the player's interact target:
  - `StockShelf { shelf, item, qty }`: moves `qty` from the inventory onto the shelf. Rejected if the item is not owned in that quantity, if the shelf holds a different item, or if the total would exceed the capacity. Stocking the same item again tops the shelf up.
  - `ClearShelf { shelf }`: returns the whole stack to the inventory.
  - `SetPrice { item, price }`: as before (minimum 1), valid when the player targets any shelf.
- Shelves can be stocked, cleared and repriced at any time of day, including while the shop is open.
- Shelf panel (pauses the sim like every panel): an empty shelf lists the items you own (potions first, then ground, then raw); picking one shows two fields, QTY and PRICE (up/down picks the field, left/right changes it with the usual accelerating repeat), the potion's base ingredients are not shown, and the last 3 (price, reaction icon) entries for that potion are shown under the fields so the player can read what customers thought. A stocked shelf opens straight on its PRICE field with two more rows: ADD MORE (if you own more and there is room) and TAKE BACK.
- In the world view each shelf shows its potion icon and its count.

## Opening and customers

- The shop opens from the sign, once per day, with at least one stocked shelf. Opening by day switches to the evening at once (v0.2.1, the user: "instead of call it a day and then open shop merge the 2 and leave only openshop"); there is no separate "call it a day". While open the sign asks "CLOSE SHOP?".
- While open the player moves freely indoors.
- Customers this evening: `stall.customersBase` 6, plus 2 per extra owned plot, as before. At most 2 are indoors at once. A new one enters when fewer than 2 are indoors and at least `shop.enterGap` 150 ticks have passed since the previous entry.
- A customer:
  1. appears on indoor tile (7,10) and walks (`shop.customerSpeed` 40 px/s, axis by axis, through walkable tiles; customers do not collide with the player or each other) to the interact tile of a shelf chosen uniformly among stocked shelves;
  2. if that shelf is empty on arrival, picks another stocked shelf, or leaves if there is none;
  3. looks for `REACT_TICKS` 48 with a reaction bubble: `value` and the four reactions exactly as in content.md Stall (personal factor, demand, trend, thresholds, demand drops);
  4. if the reaction sells: takes 1 unit off the shelf at once, walks to the first free queue spot and waits; the price is fixed at that moment. The reaction is written to the history now; nothing else changes yet;
  5. if it refuses: walks back to (7,10) and leaves.
- `RingUp`: valid when the counter is the player's interact target and a customer waits on queue spot 1. Pressing interact at the counter sends it directly (no panel). Coins rise by the fixed price, the demand drops are applied now (-0.04, and -0.05 more if the reaction was grumbling), event `sale`, the customer leaves, the second in the queue steps forward.
- **Patience**: `shop.patience` 30 s (1800 ticks), counted for each customer from the moment they reach a queue spot. When it runs out the customer leaves **without paying** and puts the item back: onto its shelf if that shelf is empty or holds the same item below capacity, otherwise into the player's inventory. Event `customerLeftUnpaid { item }`. No coins, no demand change, and the unit is never lost (pillar 3). A waiting customer shows a patience bubble above their head that drains, turning from `bone` to `ember` in the last third.
- The shop is `done` when no customer is left to come and none is indoors; or when no shelf is stocked, nobody is browsing or waiting, and nobody is walking to a shelf. Then the summary "SOLD N POTIONS FOR C COINS" shows.
- `CloseStall` (from the sign) and sleeping while open: customers who hold an item pay at once (coins and `sale` events), everyone else leaves, the shop is `done` (no summary on sleep).
- History, demand, trend, `goalReached` on the first Ember Elixir **paid for**: as before.
- Events: keep `stallOpened`, `stallClosed { soldCount, soldCoins }`, `customerArrived`, `customerReacted`, `sale`, `trendAnnounced`, `goalReached`; add `customerQueued` (a customer reached the queue), `customerLeftUnpaid { item }` and `areaChanged { area }`. Event payloads that carried `potion` now carry `item`.

## Bed, sleep, faint

- Sleep from the bed (confirm as before). The player wakes on the bed's interact tile, indoors.
- Fainting outside wakes the player at the same place, indoors.

## Interface

- HUD while open: a small "OPEN" tag with the number of customers still to come, under the clock.
- Coins fly from the counter to the coin counter on a sale. Reaction bubbles sit above the browsing customer.
- Sounds (no new files): `bell` also plays on `customerQueued` at a lower volume, `refuse` also plays on `customerLeftUnpaid`; the rest of the mapping is unchanged.
- The interact hint line and the notebook work indoors as outdoors. The notebook's price page is unchanged.

## Look

The user asked for "a shop visual" and likes cozy pixel-art shopkeeping games for their design. Give the interior real care, within the color bible and the sprite format:
- warm wooden plank floor with variation, a rug in front of the counter, back wall with wall shelves of jars and dried herbs, a window, a lantern; the back room reads as a workshop (stone floor or darker planks, the cauldron's fire glow, hanging herbs);
- display tables that clearly show what is on them (the potion icon large enough to read, count pips);
- a counter with a till;
- the hut outside grows a small shop sign or awning above its door so it reads as a shop;
- customers get front and back walking frames (they walk up and down indoors).
No image files; palette tokens only.

## Bot

Update `botFrame` to the new loop: gather outside, enter, grind and brew in the back room, stock shelves (highest value first, 5 per shelf; potions only is enough for the bot), open from the sign, stand behind the counter and ring up at once (never let patience run out), adjust prices from reactions by the same rule as before (through `SetPrice` while standing at a shelf between customers, or keep prices fixed during an evening and adjust after it; either is fine if the health test passes), close, sleep in the bed. BFS per area.

## Version and saves

`package.json` version 0.2.0 (`npm version 0.2.0 --no-git-tag-version`). A 0.1.x save is ignored by the existing major.minor rule; do not migrate it. CHANGELOG entry `## v0.2.0 - 2026-11-13`. README controls line stays valid.

## Acceptance tests

- [ ] `npm run verify` -> exit 0 (tests of earlier WPs updated to the new layout, none deleted without a replacement that covers the same rule).
- [ ] Vitest: walking up from home plot tile (2,3) puts the player indoors on (7,10); walking down from there onto (7,11) puts the player back on plot tile (2,3); after each transition, holding the same direction 60 more ticks causes no second transition; `areaChanged` fires once each time.
- [ ] Vitest: indoors, the player cannot enter walls, the partition (except its doorway), shelves, the counter, the sign, the stations or the bed (walk into each for 300 ticks).
- [ ] Vitest: with 2 mudlets placed on plot tiles next to the hut door and the player indoors for 3000 ticks, hearts stay at 5 and no mudlet is in its chase state.
- [ ] Vitest: `StartGrind` and `StartBrew` work when targeting the indoor stations and are rejected outdoors; outputs are pickups with `area: 'shop'` on (16,4) and (18,4); a pickup in one area is never collected from the other.
- [ ] Vitest: `StockShelf` moves the stock for a potion, a ground item and a raw item; rejects quantity over 5, more than owned, a different item on a stocked shelf, a top-up over capacity, and a shelf that is not targeted; `ClearShelf` returns everything. State unchanged on each rejection.
- [ ] Vitest: the sign: by day it routes to the call-it-a-day confirm; in the evening `OpenStall` works with a stocked shelf, is rejected with empty shelves and a second time the same day.
- [ ] Vitest, personal forced to 1, glowdraught at 20: the customer reaches the shelf, the shelf loses 1 unit at the decision, coins and demand do not change until `RingUp`, then coins rise by 20 with one `sale` and demand drops by 0.04. At 32: refuses, shelf unchanged, never queues.
- [ ] Vitest: a queued customer who is not rung up leaves at tick 1800 of waiting, not at 1799: `customerLeftUnpaid`, coins and demand unchanged, the unit back on its shelf (and in the inventory instead when the shelf meanwhile holds another item or is full).
- [ ] Vitest: first prices: mint 1, reed 1, bogwood 1, glowcap 3, mudgel 3, emberroot 8, mintpaste 2, glowdust 4, emberpowder 13, tonic 10, salve 13, glowdraught 17, emberelixir 42. A raw item sells through the same reaction rule (mint, value 2, personal 1: price 2 is happy, price 3 refuses).
- [ ] Vitest: `RingUp` with nobody on queue spot 1, or away from the counter, changes nothing.
- [ ] Vitest: never more than 2 customers indoors; 6 customers in total with one plot, 8 with two; the shop is not `done` while a customer holds an unpaid potion; `CloseStall` and `Sleep` make holders pay, and `stallClosed.soldCoins` equals the coins gained.
- [ ] Vitest: the exit tile does not let the player out while the shop is open.
- [ ] Vitest: sleeping in the bed gives a morning with the player indoors on (18,9); fainting outdoors does the same.
- [ ] Vitest: the WP04 reaction thresholds, demand, trend, first prices, history and goal tests still pass against the shop (goal fires on payment).
- [ ] Vitest: save round trip with a stocked shelf and a queued customer; a save serialized as version 0.1.3 returns null.
- [ ] Vitest health test, seeds 1, 2, 3, bot only, live mudlets: evening-1 coins between 40 and 130; `state.day <= 4` at `plotBought`; `state.day <= 6` at `goalReached`. Week robustness test (day 7, 0 faints) and the determinism and performance tests still pass.
- [ ] Vitest: sprite tests cover the new interior sprites (sizes, legend, outline closed on standing objects).
- [ ] Browser (run by the brain after merge, you report "not run"): walk in, stock a shelf, open, ring a customer up, sleep.

If the health test cannot pass with a competent bot, do not bend it: report the measured metrics and propose the smallest tuning change as a CCR.

## Allowed deferrals

None.

## Out of scope

Thieves, haggling, customer types, customers buying several units, buyable extra shelves, decoration, a basement level, mouse control indoors, new sound files.
