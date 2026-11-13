# Fen & Flask - handoff (written 2026-11-12, updated 2026-11-13)

Paused by the user mid-build. To resume: open a session in `Downloads/Claude`, say "resume fen-and-flask", and have the agent read this file, then `specs/STATUS.md` (the ledger), then follow the game-forge skill from Phase 4.

## What the game is

Cozy top-down pixel game in the browser: you run a potion stall at the edge of a marsh. Gather and fight lightly by day, grind and brew, sell at your own prices in the evening, sleep, buy more land. Full rules in `SPEC.md`, `specs/content.md`, `specs/design.md`.

## Where the build stands

v0.3.2 is live at https://underscorelog.github.io/fen-and-flask/ (public repo underscoreloG/fen-and-flask, Pages via GitHub Actions, deploys on every push to main).

- v0.1.0 to v0.1.3: the first slice (gather, fight, garden, grind, brew, sell, sleep, buy land, Ember Elixir goal), then fixes from the first play: Enter confirms, title menu clickable, readable hint, the game fills the window.
- v0.2.0: the hut is a building you walk into. Shop room with 4 shelves you stock and price (any item), customers browse, queue at the counter and leave unpaid after 30 s; back room with mortar, cauldron and bed. The outdoor stall and stations are gone. Spec: `specs/wp/WP06-shop-interior.md`.

- v0.2.1: the sign is one action, OPEN SHOP (by day it also starts the evening); hidden test menu on F2 (coins, items, hearts, evening, morning, land).

- v0.3.0 to v0.3.2 (milestone M2 "shop progression", approved and built 2026-11-13): a catalog stand sells 14 upgrades delivered the next morning (tables 5-6, signboard, lantern sign, deep tables, stone mortar, second cauldron, copper sickle, two beds, and toads that tend the garden, ring up customers and bring ingredients); four customer types; a daily order on a board; dig up a growing bed; the shop is "complete" once the whole catalog is owned. Specs `specs/wp/WP07..WP09`, reviews `specs/REVIEW-2026-11-13.md`.

Next: the user plays and answers the M2 fun gate (below). The ledger `specs/STATUS.md` has every decision, gate result and open leftover.

Browser checks: the in-app browser pane only works while this session is open in a window; otherwise use a headless Edge over the DevTools protocol (see the ledger).

## Commands

```bash
npm run dev
```

```bash
npm run verify
```

Debug URL: `http://localhost:5345/?debug=1&skipTitle=1&nosave=1&seed=1`, then in the console `__game.state`, `__game.step(n, frame)`, `__game.give('mint', 3)`, `__game.setPhase('evening')`, `__game.frames(n)`.

Controls: arrows move, X swing, C or Enter interact / confirm, X or Esc back, V notebook, Esc pause, M mute, F2 hidden test menu (coins, items, hearts, evening, morning, land).

Browser gates: `node cdp.cjs <scenario.cjs> <outDir>` style headless Edge harness (rules in the ledger: absolute profile path, close the browser, count leftovers). Stop the dev server before `npm ci` on main.

## Decisions still ahead for the user

- Fun gate for M2: "Do the catalog, the helpers and the orders make you want to keep playing until the shop is complete?" (The M1 question was never answered in words; the user asked for more instead.)
- Prices and pace: the bot finishes the catalog on day 14-15 with over 2000 spare coins. Tune only from the user's play feedback.
- Real art (M3): compare pixel-mcp and Pillow on one screen, then pick one.
- Sounds and their volumes were chosen from measurements, never heard by the agent.

## Known small things

- The cauldron sprite's outline is open at the bottom edge.
- "New game" on the title does not clear an existing save; the next morning overwrites it.
- Git identity is set in this repo only (GitHub noreply address, same as sibling repos).
