# WP10 - Play feedback 1: stop a job, unhappy customers do not buy (v0.3.3)

Goal: two changes the user asked for after playing v0.3.2.

The user's words (2026-11-13):
- "ability to cancel crafting when multiple are in queue"
- "when customer unhappy with price, he doesn't buy"

Read first: SPEC.md, specs/content.md (Stations; Stall: reactions and demand), specs/wp/WP06 to WP09, this file. **This file wins over every earlier file.** Then read all of src/.
Depends on: v0.3.2 on main.
Owns: no new module is required. Edits to existing files as allowed by SPEC section 6.

## 1. Stop a job

Today a busy station only shows its job ("<STATION>: BUSY", the item, "n LEFT").

- Command `CancelJob` (no payload: the targeted station decides, as for `StartBrew`). Valid when the interact target is a station with a job. The job ends at once and the inputs of every unit **not yet out** come back to the inventory, the unit in progress included (its progress is lost):
  - mortar: `remaining` units of the recipe's input;
  - cauldron: `remaining` times each ingredient of the potion.
  - The job's bogwood is burnt: it never comes back.
- Event `jobCancelled { station, item, refunded }` (`item` = the job's output, `refunded` = the number of units given back). `jobFinished` does not fire for a stopped job.
- Rejected with the state unchanged away from a station or on a free station.
- Units already out stay where they are (pickups on the interact tile, or already picked up).
- Panel: the busy panel gains a second row, `STOP, TAKE n BACK` (n = `remaining`). The cursor starts on the first row (the job, which does nothing on confirm), so a double press of C on a busy station stops nothing. Confirm on the second row sends `CancelJob` and closes the panel. The count on screen is the one at the moment the panel opened; the command gives back what is really left when it lands.
- Toast on `jobCancelled`: "STOPPED: n BACK". Sound: reuse an existing soft sound if the manifest makes it a one-liner, otherwise none.
- The bot does not use it.

## 2. Unhappy customers do not buy

The four reactions and their thresholds stay (price / value: delighted <= 0.80, happy <= 1.10, grumbling <= 1.30, refuses above). What changes: **only delighted and happy buy.** A grumbling customer shows its grumbling bubble, leaves the item on the table and walks out, exactly like one who refuses. The two unhappy faces stay different on purpose: grumbling tells the player the price is a little too high, refusing that it is far too high.

- No demand change on a grumble (there is no sale any more): remove the grumble penalty and its tuning number.
- The notebook's history keeps recording all four reactions.
- A grumbling customer never queues, never carries, never counts as unpaid.
- Type multipliers are unchanged, so a haggler (x0.85) now buys only at or below 0.935 times the value, and a courier buys potions up to 1.375 times.
- The first-price rule is unchanged (`max(1, round(0.7 x base))`). Known and accepted: bogwood at its floor price of 1 is not bought by a haggler in a low mood (1 / (0.95 x 0.85) = 1.24, grumbling). Every other first price is still bought by every type at demand 1; the WP09 test becomes that statement.
- Bot: it keeps its price nudges (down after grumbling or refuses, up after delighted or happy). It must not leave a table on a price nobody buys for a whole evening.

## Version

`npm version 0.3.3 --no-git-tag-version`, CHANGELOG entry `## v0.3.3 - <date>`. No new state: a 0.3.2 save loads as it is (a test proves it still does).

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] Vitest: `CancelJob` on a mortar grinding 3 mint after the first unit is out gives 2 mint back, frees the mortar, fires `jobCancelled { station: 'mortar', item: 'mintpaste', refunded: 2 }` once and no `jobFinished`; the unit already out is still there.
- [ ] Vitest: `CancelJob` on a cauldron brewing 3 tonic, halfway through the first unit, gives back 3 mint paste and 3 reed and no bogwood; with the second cauldron owned, stopping one leaves the other job running.
- [ ] Vitest: `CancelJob` is rejected (state unchanged, no event) away from a station and on a free station.
- [ ] Vitest: after a stop the same station accepts a new job on the next tick.
- [ ] Vitest: personal 1, demand 1, no trend, a traveller on glowdraught (base 24): buys at 26 (happy), does not buy at 27 (grumbling) nor at 32 (refuses); at 27 the reaction recorded is grumbling, at 32 refuses; after the grumble the table still holds the unit, coins and demand are unchanged, and the customer leaves without queueing.
- [ ] Vitest: a haggler does not buy glowdraught at 23 and buys at 22; a courier buys it at 32 and not at 34.
- [ ] Vitest: at demand 1 and no trend, the first price of every item is bought by every type at personal 0.95 and 1.05, except bogwood for a haggler.
- [ ] Vitest: the deep-tables double never triggers on a grumbling customer.
- [ ] Vitest health test (bot, seeds 1-3): the existing targets hold (M1 metrics; all 14 owned and `m2GoalReached` by day 20; at least half of the orders delivered; unpaid limits; late units per evening; the income ratio with order pay). Print the same metrics as today.
- [ ] Vitest: determinism, week robustness, performance and save tests pass; a 0.3.2 save loads and steps.
- [ ] Browser (run by the brain after merge, you report "not run"): start a 3-potion brew, stop it after the first potion, see the ingredients come back; price a potion a little too high and watch a customer grumble and leave without it.

If a health target cannot be met by a competent bot, do not bend it: report the measured numbers per seed and propose the smallest change as a CCR.

## Allowed deferrals

None.

## Out of scope

A warm indoor ambience instead of the marsh frogs (the user: "not now"), where customers stand at the counter (question open with the user), prices and pace tuning, queueing several different recipes on one station.
