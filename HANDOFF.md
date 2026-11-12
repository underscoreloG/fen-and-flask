# Fen & Flask - handoff (2026-11-12, evening)

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
| WP02 Day, sleep, garden, save, title | merged, tests green, **browser gate still open** (see below) |
| WP03 Stations and notebook | not started |
| WP04 Stall, land, goal, bot | not started |
| WP05 Audio, pause, GitHub Pages | not started |
| M1 gate, then push to GitHub + Pages | not started (nothing has been pushed; no remote exists yet) |

`main` is at "Debug frames helper, ledger: paused at WP02 browser gate". `npm run verify` is green there: 87 tests, build 1.26 MB.

## First thing to do tomorrow: close the WP02 browser gate

Confirmed in the browser: the title screen renders, the HUD clock and evening tint show, walking to the hut door and pressing interact opens the "SLEEP? YES / NO" panel and pauses the sim, no console errors.

**Not confirmed:** driving the UI with synthetic key events, pressing C on the sleep panel did not advance the day (day stayed 1 and the clock kept running), and pressing C on a soil bed did not show the garden picker or plant anything. The same actions pass in Vitest at the command level (`Sleep`, `Plant`), so the doubt is in the UI layer or in my test method.

How to settle it:
1. Simplest: play it for real. `npm run dev`, open `http://localhost:5345/?nosave=1`, walk up to the hut door, press C, choose YES. Then stand on a soil bed holding some mint and press C. If both work, the finding was a test artifact.
2. If it fails for real: read `src/render/scenes/UIScene.ts` (`sleepThen`, `makePanel`) and `src/render/ui/confirm.ts` (default selected row, how `update(intents)` returns commands), fix or send it back as a small WP02b job, add a test.
3. Then remove the merged worktree: `git worktree remove ../fen-and-flask-wt/wp02` and `git branch -d wp/02-day-garden`.

Why my test is suspect: the browser pane was hidden, which throttles `requestAnimationFrame` to about one frame per second. I added `__game.frames(n)` to drive render frames by hand, but 5 manual frames produced only 3 sim ticks, so timing under it is not trustworthy yet.

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
