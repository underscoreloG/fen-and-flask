# Fen & Flask (working title) - status
Phase: 3   Size: M   Milestone: M2 shop progression   Updated: 2026-11-13
Next action: M2 plan approved by the user 2026-11-13 ("Approve, build it"). WP07 worker is running in ../fen-and-flask-wt/wp07 (branch wp/07-catalog). On its report: check the diff, merge --no-ff, npm run verify, browser gate through the headless Edge harness, ship v0.3.0; then WP08 (v0.3.1), WP09 (v0.3.2), same loop.

Idea: a cozy top-down pixel game where you run a potion stall at the edge of a marsh: gather, brew, sell at your own prices, sleep, buy more land.

## Decisions
- 2026-11-12 Platform: browser (play from anywhere via URL). Godot rejected.
- 2026-11-12 Size M: staged, small M1 vertical slice, fun gate before any M2 scope.
- 2026-11-12 Blend: fast gathering + buyable adjacent land; short crafting chains at workstations; player-priced stall + light combat; day/sleep rhythm + small grow plot.
- 2026-11-12 M1 scope: gathering, 2 stations, stall pricing, day/sleep, 1 creature, 1 buyable land, AND the grow plot (user moved it into M1). Unlock tree is M2.
- 2026-11-12 Combat: light (roaming creatures, one swing, drops are ingredients). No dungeons, no bosses.
- 2026-11-12 Setting: marsh apothecary, original world and names. Working title Fen & Flask, slug fen-and-flask.
- 2026-11-12 Input: desktop keyboard + gamepad in M1. Keys limited to arrows, X, C, V, M, Esc (same place on AZERTY and QWERTY). Touch is later.
- 2026-11-12 Day: 240 s clock that turns day to evening, no energy bar, player chooses when to sleep.
- 2026-11-12 Art: code-drawn pixel sprites on a fixed palette for M1; real art swap after the fun gate.
- 2026-11-12 Sound: about 14 real CC0 recordings in M1; list sources and get the user's OK before any download.
- 2026-11-12 Ship: public repo underscoreloG/fen-and-flask + GitHub Pages; first push only after the M1 gate passes (user approved this).
- 2026-11-12 Stack: phaser 3.90.0 (precedent pin, not 4.x), typescript 7.0.2, vite 8.3.8, vitest 5.1.0, port 5345.
- 2026-11-12 Brain defaults not asked (open to veto at spec approval): first price = 70% of true value so pricing is discovered; only potions are sold; save is per browser; no watering.

## Work packages
| WP | Status | Dispatch | Model | Agent/session id | Branch | Notes |
|---|---|---|---|---|---|---|
| WP00 Foundation | merged | subagent | opus high | | wp/00-foundation | verify green (35 tests), browser: x 88 -> 178, no console error. CCRs accepted: clearLatches(latch), input/session.ts holds the loop |
| WP01 Gathering and combat | merged | subagent | opus high | | wp/01-gathering | verify green (60 tests); browser: 19 nodes, 2 mudlets, swing breaks a reedclump and the reed lands in inventory, no console error. CCR accepted: pickup.landTime 0.3 s |
| WP02 Day, sleep, garden, save | merged | subagent | opus high | | wp/02-day-garden | verify green (87 tests). Browser: title renders, evening tint and clock show, sleep confirm panel opens and pauses the sim, no console error. Gate closed 2026-11-13 with real key presses: C at the door then YES gives day 2; C on a bed opens the picker and plants mint (garden bed1 mint:1, mint 2 -> 1) |
| WP03 Stations, notebook | merged | subagent | opus high | | wp/03-stations | verify green (98 tests). Browser, real keys: mortar panel grinds 3 mint into 3 paste, cauldron panel starts 3 tonics for 1 bogwood, notebook page 1 shows recipes, no console error |
| WP04 Stall, land, goal, bot | merged | subagent | opus high | | wp/04-stall | verify green (128 tests). Health seeds 1-3: evening-1 coins 87, plot bought day 2, goal day 3, 0 faints. Browser: bot reaches the goal on day 3 (32000 ticks); with real keys the stall setup opens, tonic raised 10 -> 12 sells as happy, 6 potions sold for 79 coins, summary shown, no console error |
| WP09 Customer types, daily order (v0.3.2) | todo | subagent | opus high | | | |
| WP08 Helpers: toads (v0.3.1) | todo | subagent | opus high | | | |
| WP07 Catalog and upgrades (v0.3.0) | running | subagent | opus high | | wp/07-catalog | dispatched 2026-11-13 |
| WP06 Shop interior (v0.2.0) | merged | subagent | opus high | | wp/06-shop | verify green (205 tests); health seeds 1-3 unchanged (87 coins, plot day 2, goal day 3, 0 unpaid). Headless Edge with real key events: walk in, stock shelves through the panel, open from the sign, ring up at the till (+10 coins), unserved customer leaves at 1800 ticks with the potion back on the shelf, sleep indoors to day 2, mortar panel indoors, walk out |
| WP05 Audio, pause, Pages | merged | subagent | opus high | | wp/05-audio | verify green (160 tests). Browser: 16 audio files load (200), pause menu and mute work, no console error or warning |

## Helper agents (not WPs)
| Task | When | Model | Effort |
|---|---|---|---|
| Plan reviewer + recheck | Phase 3 | opus | max |

## Open
- Plan review 2026-11-12: 4 blockers, 15 rework, 5 nits, all fixed (specs/REVIEW-2026-11-12.md). Recheck dispatched in parallel with WP00 (deviation from the skill order, to save about 30 minutes; findings go to the running worker by message).
- Sounds: 16 CC0 files in public/audio (user approved the download 2026-11-12). Loudness uneven: WP05 must set base volumes (quiet: squish, bell, coin; loud: refuse, hurt, hit_wood).
- Workers do no browser checks; the brain runs them after each merge. Preview entry fen-and-flask (port 5345) is in ../.claude/launch.json and serves the main checkout.
- Git identity is repo-local (GitHub noreply address, as in sibling repos).
- Recheck 2026-11-12: no blocker, 10 rework items, all applied (latch clearing around panels, stall open view not pausing, sprite and test file creation allowed, WP04 idle-test rule, event payloads, clock formula in ticks, WP05 base volumes, browser lines are the brain's, faint moves the player before the reset). WP00 worker told about clearLatches by message.
- WP02 gate finding of 2026-11-12 was a test artifact: synthetic KeyboardEvents plus __game.frames(n) do not drive the UI reliably. For UI flows use the computer tool (real key presses) with the preview pane shown; the loop then runs (8+ ticks/s is enough). __game.step() stays reliable for sim state.
- Brain wiring fix on main: __game.frames(n) drives render frames by hand, because the hidden browser pane throttles requestAnimationFrame (about 1 tick per second).
- 2026-11-13 user FYI: pixel-mcp and Pillow are both installed for graphics. Pick the better one when the real-art milestone (M3) is planned; M1 stays code-drawn.
- M1 gate PASSED 2026-11-13: verify green (160 tests, dist JS 1.29 MB); bot health seeds 1-3 = evening-1 coins 87, plot bought day 2, goal day 3, 0 faints; browser full day with real key presses (swing breaks a mintbush, grind 5, brew 3 tonics, plant glowcap, stall sells 3 for 30 coins, sleep to day 2 with regrow and a trend); gamepad covered by input unit tests only (no real pad tried).
- Not judged by anyone yet: how the sounds and their volumes actually sound, hit feel, 60 fps on the real window (user at the fun gate).
- Known for M2 planning: evening 1 is identical on every seed (87 coins, first prices always sell); potions pile up after day 3 (6-8 customers cap); no spending choices after the plot; repo has no LICENSE file.
- Shipped 2026-11-13: v0.1.0 tagged and pushed to the public repo underscoreloG/fen-and-flask; Pages source = GitHub Actions; live at https://underscorelog.github.io/fen-and-flask/ (version.json = 0.1.0, title -> new game works, no console error). Workflow annotation: deploy-pages@v4 targets Node 20 (deprecated, forced to Node 24): bump the action majors in the next batch.
- 2026-11-13 v0.1.1 hotfix (user report: "cannot click or hit enter on the new game button, nothing happens"): Enter = C everywhere, title menu rows clickable, key hint on the title. Lesson for gates: test the first screen as a player who has not read the controls. The user also saw a Firefox console line "Security Error: Content at https://underscorelog.github.io/fen-and-flask/ may not load or link to file:///": the live HTML and bundle load nothing from file:// (only a Phaser config string), cause not found, not reproduced; ask for the console source line if it shows again.
- Still open from v0.1.0: deploy-pages@v4 Node 20 deprecation warning (bump action majors in the next feature batch).
- 2026-11-13 v0.1.2: the user did not see the title key hint in v0.1.1 (it was drawn in waterlight on deepwater, about 3:1 contrast); now bone. Brain reading: low contrast, not a missing element (layout checked: the hint sits 11 px below a two-row menu).
- 2026-11-13 v0.1.3 (user: "its not fitting the entire screen"): scaling now fills the window at 16:9; whole-number zoom only when it covers at least 92% of the fit, else fractional zoom (pixels slightly uneven). Bars remain on one axis when the window is not 16:9. Checked at 1315x1252: canvas 1315x740, title click still lands, 60 ticks/s.
- 2026-11-13 user feedback after first play (v0.1.x): shop inside the house with shelves and prices "exactly like in moonlighter"; potion making in a back room; customers wait at the cashier about 30 s then leave without paying; shelves take potions and raw ingredients; shop replaces the stall. Spec: specs/wp/WP06-shop-interior.md (it overrides SPEC/content/design where they disagree; fold it back into them after the merge). Brain choices to flag to the user: an impatient customer puts the item back (never lost); raw and ground base values are first guesses. No fresh-context plan review was run for WP06 (speed; brain gap pass only).
- 2026-11-13 the in-app browser tools stopped answering in this session (pane not open in any window). Browser gates now run through a headless Edge harness over the DevTools protocol (scratchpad cdp.cjs + a scenario file): real key events, 60 ticks/s, screenshots. Rebuild it from the ledger note if the scratchpad is gone: spawn msedge --headless=new --remote-debugging-port, Runtime.evaluate, Input.dispatchKeyEvent, Page.captureScreenshot.
- Small leftovers seen in the gate: favicon.ico 404; the road at the bottom of the plot has no use now that customers appear at the shop door; the title hint still says only "C OR ENTER TO START".
- 2026-11-13 v0.2.1 (user): the sign has one action, OPEN SHOP, which also ends the day; the CallItADay command and its confirm are removed (the bot now waits for its jobs by day and opens). Hidden test menu on F2 (command Cheat: coinsSmall, coinsBig, items, hearts, evening, morning, land; numbers in TUNING.cheat). The F2 key is read by UIScene directly, outside the input layer, on purpose. favicon 404 fixed with an empty data icon. Gate: 205 tests, health unchanged, headless Edge with real keys (F2 menu rows, open by day -> evening + open, next morning).
- 2026-11-13 M2 chosen by the user: "Shop progression". Answers: upgrade groups Shop floor + Workshop + Gathering, "also some kind of automation but we should do something that is kinda incremental and fit to the game"; delivery next morning; customer types plus a daily order; no new land yet ("Not yet"). Brain design: catalog stand with 13 items (2740 coins in total), automation = three helper toads with tiers, four customer types, order board, M2 goal = whole catalog owned. Ships as 0.3.0, 0.3.1, 0.3.2 with saves kept inside 0.3.x (fillDefaults). The user never answered the fun gate in words; they keep steering, which the brain reads as engaged, not as a yes.
- 2026-11-13 M2 plan review: 2 blockers, 15 rework, 5 nits, all applied (specs/REVIEW-2026-11-13.md). Design change from it: the shop was customer-capped, so tables 5/6 and the signboard each add 2 customers and a lantern sign adds 3 (max 17); catalog is now 14 items for 4050 coins; names fixed (BuyUpgrade, catalog.pending, upgradeArrived, m2GoalReached).
- 2026-11-13 M2 recheck (same reviewer, economy model re-run): 21 of 23 fixes confirmed; 3 test lines could not pass and 5 smaller gaps, all applied. Model with the new customer rule: 247 coins an evening at 8 customers, 417 at 17; production (18-25 potions a day) still exceeds sales (14 at 17 customers); the 9 WP07 items by day 10-12, all 14 by day 15-18. Brain change AFTER the recheck, not modeled by the reviewer: deep tables cost 360 and make one customer in four take two units, so sales approach production; catalog total 4290. Reviewer note kept: 10 of 14 items earn the bot nothing because they save a human time (sickle, mortar, second cauldron, toads).
