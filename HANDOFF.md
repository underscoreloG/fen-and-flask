# Fen & Flask - handoff (written 2026-11-12, updated 2026-11-13)

Paused by the user mid-build. To resume: open a session in `Downloads/Claude`, say "resume fen-and-flask", and have the agent read this file, then `specs/STATUS.md` (the ledger), then follow the game-forge skill from Phase 4.

## What the game is

Cozy top-down pixel game in the browser: you run a potion stall at the edge of a marsh. Gather and fight lightly by day, grind and brew, sell at your own prices in the evening, sleep, buy more land. Full rules in `SPEC.md`, `specs/content.md`, `specs/design.md`.

## Where the build stands

M1 (v0.1.0) is built: all six work packages are merged, the M1 gate passed on 2026-11-13 (160 tests, bot health, full day in the browser), and the ledger `specs/STATUS.md` holds the details. Next is the fun gate: the user plays it and says whether the loop is fun. No new scope before a yes; feel feedback becomes a tuning job first.

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
- The canvas scales by whole numbers only, so it is small in a narrow window.
- Git identity is set in this repo only (GitHub noreply address, same as sibling repos).
