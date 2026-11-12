# Fen & Flask (working title) - status
Phase: 2   Size: M   Milestone: M1   Updated: 2026-11-12
Next action: user approves SPEC.md -> git init + commit on main -> Phase 3 (write specs/wp/WP00-05, review gate, plan approval)

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
| WP00 Foundation | todo (no WP file yet) | subagent | opus high | | | |
| WP01 Gathering and combat | todo (no WP file yet) | subagent | opus high | | | |
| WP02 Day, sleep, garden, save | todo (no WP file yet) | subagent | opus high | | | |
| WP03 Stations, notebook | todo (no WP file yet) | subagent | opus high | | | |
| WP04 Stall, land, goal, bot | todo (no WP file yet) | subagent | opus high | | | |
| WP05 Audio, pause, Pages | todo (no WP file yet) | subagent | opus high | | | needs sound list approved by user |

## Helper agents (not WPs)
| Task | When | Model | Effort |
|---|---|---|---|
| Plan reviewer + recheck | Phase 3 | opus | max |

## Open
- Spec approval by the user.
- Sound source list to prepare and get approved before WP05.
