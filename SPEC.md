# Fen & Flask - SPEC

Working title: **Fen & Flask**. A cozy top-down pixel game in the browser. You run a potion stall at the edge of a marsh: by day you gather herbs and whack bog creatures, you grind and brew at your stations, in the evening you open the stall and set your own prices for passing travellers, then you sleep, things regrow, and you buy the next plot of marsh.

IP note: the genre feel comes from shopkeeping, crafting and farming games, but every name, sprite, sound, layout and number here is original. Never copy names, art, audio or level layouts from an existing game.

This file is the entry point for every agent. Read it fully, then `specs/design.md` and `specs/content.md`, then your own `specs/wp/WPxx-*.md`.

## 1. Pillars

1. **Every action pays off within seconds**: a hit, a pop, a pickup, a number.
2. **One loop, four beats**: gather -> brew -> sell -> expand. A feature that does not feed this loop is out.
3. **Cozy, never punishing**: no energy bar, no fail state, no loss of items or coins.

Audience: the user (adult, desktop). In-game text: English, short.

## 2. Scope

### M1 vertical slice (build this)
- One home plot, one buyable east plot (150 coins).
- Gathering: 5 node types hit with one swing button; drops fly to the player; unlimited inventory.
- Light combat: 1 creature (mudlet), 5 hearts, fainting skips to next morning with nothing lost.
- Garden: 4 soil beds; plant 1 ingredient, harvest more after sleeping.
- Stations: mortar (grind) and cauldron (brew), 3 grind recipes, 4 potions.
- Day clock: 240 s day, then open-ended evening; sleep when you choose.
- Stall: evening only; you set a price per potion, travellers react (delighted, happy, grumbling, refuses); demand shifts.
- Notebook: recipes and price history.
- Save to localStorage every morning; title screen with Continue / New game.
- Keyboard and gamepad.
- About 14 real CC0 sounds.
- M1 goal: sell your first Ember Elixir. A banner says so; play continues.

**Fun gate** (the user answers after M1): "After reaching the Ember Elixir goal (about 20 minutes), do you want to keep playing another day?"

### Later (one line each, do not build)
- M2: unlock tree earned by doing, more plots and biomes, more creatures, tool upgrades, spending choices.
- M3: real art swap (generated or hand-picked sprite sheets remapped to the color bible), music.
- M4: touch controls, save export/import.

### Out of scope (do not build)
Energy or stamina, seasons, weather, NPC dialogue or relationships, quests, dungeons, bosses, thieves, decoration, multiplayer, cloud saves, inventory limits, selling raw ingredients, watering.

## 3. Stack

Verified on npm 2026-11-12. No `^`, no dependency outside this table without a CCR.

| Package | Version | Role |
|---|---|---|
| phaser | 3.90.0 | rendering, scenes, input devices, audio playback |
| typescript | 7.0.2 | language (strict) |
| vite | 8.3.8 | dev server and build |
| vitest | 5.1.0 | unit and headless tests |

Decisions and why:
- Browser, not Godot: playable from anywhere by URL, and the brain can run and assert the game in the browser pane.
- Phaser 3.90.0, not 4.x: same pin as the sibling project `../moonlighter-like` (known to work on this PC with these tool versions); nothing here needs the v4 renderer. Mirror that project's `package.json` scripts and `tsconfig.json` where they apply.
- Node 24. Dev server port **5345** (`--strictPort`).

## 4. Architecture

```
src/
  main.ts              Phaser config, integer scaling, scene list
  core/                pure deterministic sim: no Phaser, no DOM
    state.ts           GameState + createInitialState(seed)
    step.ts            step(state, frame): advances one tick, returns GameEvent[]
    rng.ts             mulberry32, its state lives in GameState
    events.ts          GameEvent union
    commands.ts        Command union (UI -> core)
    world.ts           plots, tiles, collision, structures
    player.ts nodes.ts creatures.ts pickups.ts
    clock.ts           day, evening, sleep, morning reset
    garden.ts          soil beds
    stations.ts        mortar and cauldron jobs
    stall.ts           prices, customers, demand
    bot.ts             autoplay policy: state -> frame
  data/
    content.ts         items, nodes, creatures, recipes, plot layouts
    tuning.ts          every tunable number
    palette.ts         color bible tokens
  input/input.ts       keyboard + gamepad -> input part of the frame
  render/
    sprites/           pixel-array sprite sources + texture generator
    font.ts            code-defined bitmap font
    scenes/            BootScene, TitleScene, GameScene (world), UIScene (HUD + panels)
    ui/                hud, stationPanel, gardenPicker, stallPanel, notebook, confirm
    fx.ts              juice driven by GameEvents
  audio/audio.ts       GameEvent -> sound
  save/save.ts         localStorage
  debug/debug.ts       window.__game, query params
scripts/check-boundaries.mjs
```

Per frame: `input` builds a `Frame { moveX, moveY, swing, interact, commands[] }` -> an accumulator calls `step(state, frame)` at a fixed **60 Hz** (max 5 steps per render frame) -> `render` draws from `state` and plays fx and audio from the returned events. While a UI panel is open the sim is paused (no `step` calls), except while the stall is open for business, which is a core mode of its own.

Hard boundary rules, checked by `scripts/check-boundaries.mjs`:
1. `src/core/**` and `src/data/**` import nothing from `phaser`, `render`, `input`, `audio`, `save`, `debug`, and never use `window`, `document`, `Math.random`, `Date` or `performance`.
2. Nothing outside `src/core/**` mutates `GameState`. UI changes state only through `Command`s in a frame.
3. No tunable number literal in `src/core/**` or `src/render/**`: numbers come from `data/tuning.ts` or `data/content.ts`.
4. No color literal outside `data/palette.ts`.

Rule 1 is checked by script (imports and forbidden globals). Rules 2-4 are checked in review.

## 5. Conventions

- Units: pixels and seconds. x right, y down. Tile = 16 px. Plot-local tile coordinates start at the plot's top-left.
- Internal resolution 480x270, scaled by the largest integer zoom that fits the window, centered, `pixelArt: true`, `roundPixels: true`.
- Named exports only. Comments say why, not what. Plain `-` only, never em or en dashes, in code, comments and docs.
- Tests live next to code as `*.test.ts`. Core logic is tested headless; never test through Phaser.
- Version comes from `package.json`, injected with Vite `define`, shown on the title and pause screens.

Debug surface (active in dev or with `?debug=1`): `window.__game = { state, step(n), cmd(command), give(itemId, n), setPhase(p), bot(on), version }`.

| Query param | Effect |
|---|---|
| `?debug=1` | expose `window.__game` in a production build |
| `?seed=N` | fixed RNG seed for a new game |
| `?skipTitle=1` | start a new game at once, ignore any save |
| `?nosave=1` | never read or write localStorage |
| `?autoplay=1` | the bot plays |
| `?speed=N` | N sim ticks per render frame (debug only, max 32) |

## 6. Work packages

Size M: waves of one, in order. Each WP owns its new modules; it may also edit the shared integration files (`core/state.ts`, `core/step.ts`, `core/events.ts`, `core/commands.ts`, `data/content.ts`, `data/tuning.ts`, `render/scenes/*`, `debug/debug.ts`) as far as its feature needs, without rewriting earlier work.

| WP | Name | Depends on | Owns | Model | Dispatch |
|---|---|---|---|---|---|
| WP00 | Foundation: scaffold, verify, core skeleton, world, player movement, sprite and font pipeline, input, debug | - | root config, `scripts/**`, `src/main.ts`, `src/core/{state,step,rng,events,commands,world,player}.ts`, `src/data/**`, `src/input/**`, `src/render/{sprites,font.ts,scenes}/**`, `src/debug/**` | opus high | subagent |
| WP01 | Gathering and combat: nodes, swing, pickups, mudlets, hearts, faint, HUD, fx | WP00 | `src/core/{nodes,creatures,pickups}.ts`, `src/render/fx.ts`, `src/render/ui/hud.ts` | opus high | subagent |
| WP02 | Day cycle, sleep, garden, save, title screen | WP01 | `src/core/{clock,garden}.ts`, `src/save/**`, `src/render/ui/{gardenPicker,confirm}.ts`, TitleScene | opus high | subagent |
| WP03 | Stations, recipes, notebook | WP02 | `src/core/stations.ts`, `src/render/ui/{stationPanel,notebook}.ts` | opus high | subagent |
| WP04 | Stall, customers, demand, land purchase, east plot, M1 goal, bot and health test | WP03 | `src/core/{stall,bot}.ts`, `src/render/ui/stallPanel.ts` | opus high | subagent |
| WP05 | Audio, pause and mute, changelog, GitHub Pages workflow | WP04 + sounds approved by the user | `src/audio/**`, `public/audio/**`, `.github/**`, `CHANGELOG.md` | opus high | subagent |

## 7. Gates

After every WP the brain runs: `npm run verify` on `main`; the game in the browser pane with `?debug=1&skipTitle=1&nosave=1&seed=1`, no console errors, and the WP's state assertions through `window.__game`.

**M1 gate** (after WP05):
- `npm run verify` green.
- Headless bot run (Vitest, seed 1, 2 and 3): east plot bought by day 4 or earlier; M1 goal reached by day 6 or earlier; coins earned on evening 1 between 40 and 130.
- Browser pane: full manual pass of one day (gather, grind, brew, plant, sell, sleep) by state assertions, plus one screenshot per phase as proof.
- Gamepad: input module unit tests pass with a mocked standard-mapping pad.

## 8. Definition of done (every WP)

`npm run verify` green on the branch (`tsc --noEmit`, `check-boundaries`, `vitest run`, `vite build`); every acceptance test in the WP file passes with evidence; no file outside owned or shared-integration paths; no new dependency; no TODO outside the WP's allowed deferrals; budgets respected.

## 9. Performance budgets

| Budget | Target | Checked by |
|---|---|---|
| Core tick cost | 1000 ticks of a busy state under 100 ms | Vitest |
| Frame rate | 60 fps at 1920x1080 on the user's PC | user at the fun gate |
| Build size | `dist` JS under 1.8 MB uncompressed | script in `verify` |
| Boot | title screen within 2 s on localhost | browser pane |

## 10. Ship

- Repo `underscoreloG/fen-and-flask`, public, branch `main`. GitHub Pages from a GitHub Actions workflow (`vite build --base=/fen-and-flask/`).
- First push happens only after the M1 gate passes.
- Version shown in game; bump minor per feature batch, patch per fix; `CHANGELOG.md`; git tag `vX.Y.Z`. M1 ships as `v0.1.0`.
- Live check: the build writes `version.json`; fetch it from the Pages URL and compare.

## 11. Contract Change Request

```
CCR: <short title>
WP: WPxx
File: <path>
Change: <exact diff or new signature>
Why: <what fails without it>
Impact: <which WPs read this>
Workaround used meanwhile: <or "blocked">
```

## 12. Spec index

| File | Contents |
|---|---|
| `SPEC.md` | this file |
| `specs/design.md` | look, color bible, readability, screens, controls, sprite list, sounds |
| `specs/content.md` | every rule and number: world layout, items, nodes, creature, garden, stations, stall, economy |
| `specs/wp/WPxx-*.md` | one self-contained spec per work package |
| `specs/STATUS.md` | the brain's ledger (workers do not need it) |
