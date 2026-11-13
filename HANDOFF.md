# Fen & Flask - handoff (written 2026-11-12, updated 2026-11-13)

Paused by the user mid-build. To resume: open a session in `Downloads/Claude`, say "resume fen-and-flask", and have the agent read this file, then `specs/STATUS.md` (the ledger), then follow the game-forge skill from Phase 4.

## What the game is

Cozy top-down pixel game in the browser: you run a potion stall at the edge of a marsh. Gather and fight lightly by day, grind and brew, sell at your own prices in the evening, sleep, buy more land. Full rules in `SPEC.md`, `specs/content.md`, `specs/design.md`.

## Where the build stands

v0.2.1 is live at https://underscorelog.github.io/fen-and-flask/ (public repo underscoreloG/fen-and-flask, Pages via GitHub Actions, deploys on every push to main).

- v0.1.0 to v0.1.3: the first slice (gather, fight, garden, grind, brew, sell, sleep, buy land, Ember Elixir goal), then fixes from the first play: Enter confirms, title menu clickable, readable hint, the game fills the window.
- v0.2.0: the hut is a building you walk into. Shop room with 4 shelves you stock and price (any item), customers browse, queue at the counter and leave unpaid after 30 s; back room with mortar, cauldron and bed. The outdoor stall and stations are gone. Spec: `specs/wp/WP06-shop-interior.md`.

- v0.2.1: the sign is one action, OPEN SHOP (by day it also starts the evening); hidden test menu on F2 (coins, items, hearts, evening, morning, land).

Next: milestone M2 "shop progression", approved by the user on 2026-11-13, three releases in order: WP07 catalog and upgrades (v0.3.0), WP08 toads that automate chores (v0.3.1), WP09 customer types and the daily order (v0.3.2). Specs in `specs/wp/WP07..WP09`, reviews in `specs/REVIEW-2026-11-13.md`. The ledger `specs/STATUS.md` says which one is running or merged and has every decision, gate result and open leftover.

Browser checks: the in-app browser pane only works while this session is open in a window; otherwise use a headless Edge over the DevTools protocol (see the ledger).

## Commands

```bash
npm run dev
```

```bash
npm run verify
```

Debug URL: `http://localhost:5345/?debug=1&skipTitle=1&nosave=1&seed=1`, then in the console `__game.state`, `__game.step(n, frame)`, `__game.give('mint', 3)`, `__game.setPhase('evening')`, `__game.frames(n)`.

Controls: arrows move, X swing, C interact / confirm, X or Esc back, V notebook (from WP03), Esc pause (from WP05).

## Decisions still ahead for the user

- Fun gate after M1: "After reaching the Ember Elixir goal (about 20 minutes), do you want to keep playing another day?" No new scope before a yes.
- Sounds and their volumes were chosen from measurements, never heard: judge them when WP05 lands.
- Publishing was approved as a public repo `underscoreloG/fen-and-flask` with GitHub Pages, first push only after the M1 gate passes.

## Known small things

- The cauldron sprite's outline is open at the bottom edge.
- "New game" on the title does not clear an existing save; the next morning overwrites it.
- Git identity is set in this repo only (GitHub noreply address, same as sibling repos).
