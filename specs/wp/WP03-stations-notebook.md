# WP03 - Stations, recipes, notebook

Goal: the player grinds ingredients at the mortar and brews potions at the cauldron as background jobs, and can read the recipes in a notebook.
Read first: SPEC.md, specs/design.md (Screens, Juice), specs/content.md (Stations)
Depends on: WP02 (interact routing with `uiRequest`, the structure-target rule for commands, the shared panel switch, `morningReset` hooks, pickups).
Owns: `src/core/stations.ts` and tests, `src/render/ui/{stationPanel,notebook}.ts`. Edits to existing files as allowed by SPEC section 6.

## Deliverables

- `src/core/stations.ts`: `state.stations = { mortar: Job | null, cauldron: Job | null }`, `Job = { recipe, remaining, progress }`.
- Commands: `{ type: 'StartGrind', input, qty }` and `{ type: 'StartBrew', potion, qty }`, each valid only when that station is the player's interact target and has no job.
- Interact routing: mortar -> `uiRequest { ui: 'station', station: 'mortar' }`, cauldron likewise.
- Events: `jobStarted { station, item, qty }`, `jobUnitDone { station, item }` (one per unit produced), `jobFinished { station }`.
- `morningReset` hook: any running job finishes at once and its remaining outputs spawn as pickups.
- `src/render/ui/stationPanel.ts`: recipe rows (icon, name, ingredients with owned counts), quantity with left/right, Start; rows the player cannot afford are dimmed and cannot start; a busy station shows its job and no Start.
- `src/render/ui/notebook.ts` (V / Y): page 1 = grind and brew recipes with base ingredients; page 2 = a placeholder line "PRICES: AFTER YOUR FIRST SALE" that WP04 replaces. Left/right changes page.
- World: progress bar above a busy station, cauldron bubbling animation while busy, `glow` sparkle on each finished potion.

## Behaviour and numbers

All values by name from specs/content.md.

- Starting a job removes all its inputs at once: grind = `qty` of the input; brew = `qty` of each ingredient plus 1 bogwood for the whole job.
- A job produces one unit every `mortar.secondsPerUnit` or `cauldron.secondsPerPotion`; each unit spawns as a pickup on the tile below the station (tile y + 1).
- Limits: grind qty 1 to owned; brew qty 1 to min(5, what the ingredients allow). Invalid commands leave the state unchanged.
- Jobs advance only while the sim steps (so not while a panel is open), including during the stall's open mode.

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] Tests that let time pass first clear `state.creatures` (WP02 rule). Job timers are integer ticks: 90 per ground unit, 360 per potion.
- [ ] Vitest: `StartGrind mint x3` at the mortar: mint -3 at once; `jobUnitDone` and a mintpaste `pickupSpawned` fire at ticks 90, 180 and 270 (assert the events, not the inventory: the output tile is inside the player magnet radius); the station is free after the third.
- [ ] Vitest: `StartBrew tonic x2`: mintpaste -2, reed -2, bogwood -1 at once; `jobUnitDone` for tonic at ticks 360 and 720.
- [ ] Vitest: brew qty 6 is rejected; brew without bogwood is rejected; brew with ingredients for 1 but qty 2 is rejected; a second job on a busy station is rejected; a station command sent while the player targets something else is rejected. State unchanged in every case.
- [ ] Vitest: a job with 2 units left when the player sleeps leaves 2 extra pickups right after the reset and a free station.
- [ ] Vitest: every grind and brew recipe of content.md can be run end to end and yields the right item.
- [ ] Vitest: the determinism test passes with jobs running.
- [ ] Browser (run by the brain after merge, you report "not run") (`?debug=1&skipTitle=1&nosave=1&seed=1`): no console error on opening both panels and the notebook.

## Allowed deferrals

Notebook page 2 content (WP04).

## Out of scope

Selling, prices, new recipes, station upgrades, queues of several jobs.
