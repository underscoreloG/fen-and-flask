# WP04 - Stall, customers, demand, land purchase, M1 goal, bot

Goal: in the evening the player prices and sells potions to travellers who react to the price, buys the east plot with the coins, reaches the M1 goal by selling an Ember Elixir, and a headless bot proves the whole loop and its economy.
Read first: SPEC.md (sections 2 and 7), specs/design.md (Screens, Juice), specs/content.md (Stall, Economy and goal)
Depends on: WP03 (stations and recipes, notebook page 2 placeholder, `morningReset` hooks, command targeting rule, panel switch).
Owns: `src/core/{stall,bot}.ts` and tests, `src/render/ui/{stallPanel,toast}.ts`. Edits to existing files as allowed by SPEC section 6.

## Deliverables

- `src/core/stall.ts`:
  - `state.stall = { phase: 'closed' | 'open' | 'done', openedToday, prices, demand, trend, history, customersLeft, customer, soldCount, soldCoins }`. The setup screen is UI only: `phase` stays `closed` until `OpenStall`.
  - Commands (all need the stall as interact target, except during `open` where the player is held at the counter): `SetPrice { potion, price }` (any time), `OpenStall` (evening, not opened today, at least 1 potion owned), `CloseStall` (during open).
  - Customer cycle and reactions exactly as in content.md. `value = base x demand x trend x personal`; `personal` from the state RNG.
  - Events: `stallOpened`, `customerArrived`, `customerReacted { potion, price, reaction, sold }`, `sale { potion, price }`, `stallClosed { soldCount, soldCoins }`, `trendAnnounced { potion }` (emitted right after `eveningStarted`, only when `trend` is not null), `goalReached`.
  - `morningReset` hooks: demand recovery, new trend, `openedToday = false`, phase closed. `createInitialState` sets `trend: null` (day 1 has no trend, multiplier 1).
- Interact routing: stall in the evening -> `uiRequest { ui: 'stall' }` (if already opened today: `uiRequest { ui: 'toast', text: 'STALL IS DONE FOR TODAY' }`); signpost -> `uiRequest { ui: 'buyPlotConfirm', plot: 1 }`.
- Land: command `{ type: 'BuyPlot', plot }` at the signpost with coins >= 150: coins -150, plot owned, plot filled to its node and mudlet targets, signpost structure removed, event `plotBought`. The fog goes and the border becomes walkable.
- Goal: the first emberelixir sale sets `state.flags.m1Goal = true` and emits `goalReached` once; the UI shows the banner text of content.md for 6 s.
- `src/render/ui/stallPanel.ts`: setup, open and done states per design.md Screens. Customers are drawn in the world (walk in along row 13 from the west edge of the home plot to the customer spot, bubble, walk out west). Coins fly to the counter on a sale.
- Notebook page 2: per potion owned or ever sold, the last 3 (price, reaction icon), plus "IN DEMAND TODAY: <potion>".
- `src/render/ui/toast.ts`: toast element (top-center, 3 s) used for the trend and other one-liners.
- Sprites: 3 customer variants (2-frame walk), 4 reaction bubbles.
- `src/core/bot.ts`: `botFrame(state): Frame`, a deterministic policy that plays the full loop with movement, swings and commands only. It never presses `interact`: everything a panel would do it sends as the command itself, while standing where that command is valid (harvest is done by swinging at a ready bed). `?autoplay=1` and `__game.bot(true)` use it; while the bot drives, the UI ignores `uiRequest` events and auto-dismisses the stall summary, and `__game.step(n)` without a frame uses `botFrame` for each tick.

## Behaviour and numbers

All values by name from specs/content.md.

- While `open`, the player is placed on tile (9,10) facing down; move, swing and interact are ignored; the sim keeps stepping (stations keep working). The player cannot be hurt or pushed, and mudlets only wander (no aggro, no contact damage), per content.md Creature.
- Customer timing in ticks: walk in 120, reaction 48, then the next customer starts walking in while this one walks out (2 s). The stall goes `done` when `customersLeft` is 0 and the last reaction is over, when no potion is left, or on `CloseStall`.
- A customer picks uniformly among potion types with count > 0 at the moment they arrive at the spot. A sale moves 1 unit and adds the price to coins.
- First-ever price of a potion: `round(0.7 x base)` = tonic 10, salve 13, glowdraught 17, emberelixir 42.
- Trend candidates: potions whose ingredients are all obtainable on owned plots (so never emberelixir before the east plot is owned).
- Bot policy (suggested; it must be deterministic and pass the health test): BFS on the tile grid to reach a tile next to the target. By day: kill mudlets and break every node on owned plots; harvest ready beds; plant mint and glowcap in empty beds while keeping at least 2 of each (emberroot once owned: plant 1 if at least 3 owned); grind everything grindable; brew in priority emberelixir, glowdraught, salve, tonic, as many as ingredients and bogwood allow, collecting outputs; buy the plot as soon as coins >= 150; then call it a day. Evening: open the stall with current prices; after each reaction adjust that potion's price: delighted x1.15, happy x1.05, grumbling x0.95, refuses x0.85 (rounded, at least +-1); then sleep.

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] Vitest, with `personal` forced to 1, demand 1, no trend, glowdraught (value 24): price 19 -> delighted, sold; 20 -> happy; 26 -> happy; 27 -> grumbling, sold; 31 -> grumbling; 32 -> refuses, not sold.
- [ ] Float results are asserted with `toBeCloseTo`, never `toBe`.
- [ ] Non-bot tests that let time pass first clear `state.creatures`, or reach evening with `CallItADay` (an idle player next to live mudlets faints, and a faint resets the day). The health, performance and bot-determinism tests keep live mudlets.
- [ ] Vitest: a sale lowers that potion's demand by 0.04; a grumbling sale by 0.09 in total; demand never goes below 0.6; one night adds 0.15, capped at 1.0.
- [ ] Vitest: with 2 mudlets placed next to the counter, a full open stall (6 customers) costs the player no heart and never moves them off tile (9,10).
- [ ] Vitest: on day 1 `trend` is null and no `trendAnnounced` is emitted that evening; from day 2 on, exactly one per evening.
- [ ] Vitest: `OpenStall` is rejected by day, with no potions, away from the stall, and a second time the same evening; it works again after sleeping.
- [ ] Vitest: 6 customers with one owned plot, 8 with two; the stall ends early when stock runs out; `CloseStall` ends it at once; `stallClosed` totals match the coins gained.
- [ ] Vitest: first prices are 10, 13, 17, 42; `SetPrice` below 1 is clamped to 1; prices persist across a sleep.
- [ ] Vitest, 200 mornings on a home-only state: the trend is never emberelixir and is always one of tonic, salve, glowdraught; with the trend on glowdraught its value is 31.2 before `personal`.
- [ ] Vitest: `BuyPlot` with 149 coins is rejected; with 150 it leaves 0 coins, the east plot owned and filled to its targets (emberplant 4, glowcaps 3, reedclump 3, stump 2, mudlets 4), and the player can walk onto it.
- [ ] Vitest: the first emberelixir sale emits `goalReached` once and sets the flag; the second emits none.
- [ ] Vitest: history keeps only the last 3 entries per potion.
- [ ] Vitest health test, seeds 1, 2 and 3, bot only, core only: coins earned on evening 1 are between 40 and 130; `state.day <= 4` at the tick `plotBought` fires; `state.day <= 6` at the tick `goalReached` fires. Print the three metrics per seed in the test output.
- [ ] Vitest: 1000 ticks of the bot on a day-3 state with both plots run in under 100 ms (SPEC budget), and the determinism test passes with the bot driving.
- [ ] Browser (run by the brain after merge, you report "not run"): `?debug=1&skipTitle=1&nosave=1&seed=1&autoplay=1&speed=16` reaches `__game.state.flags.m1Goal === true` with no console error.

If the health test cannot pass with the numbers of content.md and a competent bot, do not bend the test: report the measured metrics and propose the smallest change to `tuning.ts` values as a CCR.

## Allowed deferrals

None.

## Out of scope

Thieves, haggling, customer types, more plots, a shop for upgrades, audio.
