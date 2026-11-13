# Fen & Flask (working title) - status
Phase: 5   Size: M   Milestone: M1   Updated: 2026-11-13
Next action: the user plays v0.1.0 and answers the fun gate: "After reaching the Ember Elixir goal (about 20 minutes), do you want to keep playing another day?" No M2 scope before a yes; feel feedback becomes a tuning WP first.

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
