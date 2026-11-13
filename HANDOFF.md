# Fen & Flask - handoff (written 2026-11-12, updated 2026-11-13)

Paused by the user mid-build. To resume: open a session in `Downloads/Claude`, say "resume fen-and-flask", and have the agent read this file, then `specs/STATUS.md` (the ledger), then follow the game-forge skill from Phase 4.

## What the game is

Cozy top-down pixel game in the browser: you run a potion stall at the edge of a marsh. Gather and fight lightly by day, grind and brew, sell at your own prices in the evening, sleep, buy more land. Full rules in `SPEC.md`, `specs/content.md`, `specs/design.md`.

## Where the build stands

| Job | State |
|---|---|
| Spec, 6 work packages, two plan reviews | done, all findings applied |
| 16 CC0 sounds | downloaded, trimmed, in `public/audio/` (not listened to yet) |
| WP00 Foundation | merged, verified in the browser |
| WP01 Gathering and combat | merged, verified in the browser |
| WP02 Day, sleep, garden, save, title | merged, verified in the browser |
| WP03 Stations and notebook | not started |
| WP04 Stall, land, goal, bot | not started |
| WP05 Audio, pause, GitHub Pages | not started |
| M1 gate, then push to GitHub + Pages | not started (nothing has been pushed; no remote exists yet) |

`main` is at "Debug frames helper, ledger: paused at WP02 browser gate". `npm run verify` is green there: 87 tests, build 1.26 MB.

## WP02 browser gate: closed 2026-11-13

Sleeping and planting both work with real key presses. The doubt of 2026-11-12 came from the test method (synthetic key events and hand-stepped frames in a hidden pane). For UI checks, show the preview pane and use real key presses; `__game.step()` stays reliable for sim state.

## Then continue the build

For each of WP03, WP04, WP05, in order: create a worktree (`git worktree add ../fen-and-flask-wt/wpNN -b wp/NN-name main`), dispatch one opus worker with the brief pattern used so far (see the WP00-WP02 dispatches; the template is in the game-forge skill's `references/orchestration.md`), then check the diff, merge with `--no-ff`, run `npm run verify` on `main`, and run the browser checks yourself.

Facts each next brief must carry (not all are in the spec files):
- The sim loop is `pump()` in `src/input/session.ts`. Panels: add a `UiRequest` member and a case in `UIScene.makePanel` returning a `Panel` whose `update(intents)` gives `null` while open or `Command[]` on close. `ListPanel` in `src/render/ui/confirm.ts` draws a box with rows and a cursor. `openPanel(session)` / `closePanel(session, cmds)` is the only pause switch.
- New command: add a case in `step.ts` `applyCommand` and check `targetStructure(state)?.def.kind`. Morning hooks go at the numbered comment in `clock.ts` `morningReset` (WP03 jobs = step 2, WP04 demand, trend and stall = step 6).
- WP04: the stall's open view must not use `openPanel` (the sim keeps running); `UIScene` must ignore `uiRequest` while `session.botOn`; the stall guard (no hurt, mudlets only wander) goes in `updateHurt` and the chase branch of `updateCreatures`.
- WP05: `main.ts` has `audio: { noAudio: true }`, turn audio on. Sim events are re-emitted on `game.events` as `SIM_EVENTS` (exported from `GameScene.ts`). Base volumes are in the WP05 file.
- A WP02 save has no station or stall fields: default missing fields on load or bump the save key.
- Workers do no browser checks; the brain does them after each merge.

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
