# Fen & Flask (working title) - status
Phase: 4   Size: M   Milestone: M1   Updated: 2026-11-13
Next action: WP04 running in worktree ../fen-and-flask-wt/wp04. On report: verify, merge, browser gate (real key presses, pane shown; also ?autoplay=1&speed=16 to the M1 goal), dispatch WP05.

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
| WP04 Stall, land, goal, bot | running | subagent | opus high | | | |
| WP05 Audio, pause, Pages | todo | subagent | opus high | | | needs sound list approved by user |

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
