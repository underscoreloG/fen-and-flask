# WP11 - Play feedback 2: swap the sides of the counter (v0.3.4)

Goal: the shopkeeper stands on the door side of the counter and customers queue on the room side.

The user's words (2026-11-13): "npc should be south to the cashier and not north". Asked "Customers already queue south of the counter: do you want you and them swapped?", the user answered "Yes, swap sides".

Read first: SPEC.md, specs/wp/WP06-shop-interior.md (layout, customers, queue), WP07 (tables 5 and 6, state-read solids), WP08 (counter toad), this file. **This file wins over every earlier file.** Then read the code you touch.
Depends on: v0.3.3 on main.
Owns: no new module. Edits to existing files as allowed by SPEC section 6.

## The change

The counter stays on indoor tiles (2-4, 8). Everything else about the two sides swaps:

| | Before | After |
|---|---|---|
| Player's tile to ring up | (3,7), facing down | (3,9), facing up |
| Queue spot 1 | (3,9) | (3,7) |
| Queue spot 2 | (4,9) | (4,7) |
| Tiles customers never step on (staff side) | row 7, x 1 to 4 | rows 9 and 10, x 1 to 4 |

- A queued customer faces down (toward the counter, so the player sees its face and its bubble); the player faces up.
- Customers still come in at the entry (7,10), browse a table, and walk to the queue without stepping on a table, the counter or the staff side. With tables 5 and 6 owned ((9,7) and (12,7)) every table and both queue spots stay reachable.
- A customer waiting on spot 2 steps to spot 1 as today. Patience, ring-up, the counter toad's rule, doubles, unpaid returns: unchanged.
- The counter toad stays on the counter at (2,8). The till stays on the counter. The rug stays on its tiles; it is now under the shopkeeper.
- The hint at (3,9) facing up is `RING UP`. Nothing is targeted as the counter from (3,7) any more.
- The sign's interact tile (9,9), the catalog stand's (12,9) and the order board's (5,2) are unchanged.
- The bot rings up from the new tile and still never lets a customer leave unpaid.
- Render: draw order must still look right with a customer standing above the counter and the player below it (the counter overlaps the player's legs side as it did the customers').

## Version

`npm version 0.3.4 --no-git-tag-version`, CHANGELOG entry `## v0.3.4 - <date>`. No state change: a 0.3.3 save loads as it is.

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] Vitest: from (3,9) facing up the interact target is the counter and `RingUp` pays a queued customer; from (3,7) facing down the counter is not the target and `RingUp` is rejected.
- [ ] Vitest: a customer that buys queues on (3,7); a second one waits on (4,7) and steps to (3,7) when the first is paid.
- [ ] Vitest: with all six tables stocked, over 200 customers every table is browsed at least once and no customer ever stands on a table tile, a counter tile, or on rows 9-10 with x 1 to 4.
- [ ] Vitest: the counter toad still rings up a customer queued on spot 1 at its delay with the player on the cot tile.
- [ ] Vitest health test (bot, seeds 1-3): every existing target holds; print the same metrics.
- [ ] Vitest: determinism, week robustness, performance and save tests pass.
- [ ] Browser (run by the brain after merge, you report "not run"): open the shop, stand at (3,9), ring up a customer queued at (3,7).

If a health target cannot be met by a competent bot, do not bend it: report the numbers and propose the smallest change as a CCR.

## Allowed deferrals

None.

## Out of scope

Moving the counter, the tables, the door or the rug; a longer queue; the indoor ambience; prices and pace.
