# WP00 - Foundation

Goal: the project builds, tests and boots in the browser to a home plot the player can walk around, with every pipeline later WPs need (data tables, core tick, sprites, font, input, debug).
Read first: SPEC.md, specs/design.md, specs/content.md
Depends on: nothing. `../moonlighter-like/package.json` and its `tsconfig.json` are a working precedent for these tool versions on this PC: mirror its scripts and compiler setup where they apply.
Owns: root config (`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`), `scripts/**`, `src/main.ts`, `src/core/{state,step,rng,events,commands,world,player}.ts` and their tests, `src/data/**`, `src/input/**`, `src/render/sprites/**`, `src/render/font.ts`, `src/render/scenes/**`, `src/debug/**`.

## Deliverables

- `package.json`: exact versions from SPEC section 3, `"version": "0.1.0"`, scripts `dev` (`vite --port 5345 --strictPort`), `build`, `test` (`vitest run`), `verify` (`tsc --noEmit && node scripts/check-boundaries.mjs && vitest run && vite build && node scripts/check-size.mjs`).
- `vite.config.ts`: `define: { __APP_VERSION__ }` from package.json; `base` taken from the CLI (`--base`), default `./`.
- `scripts/check-boundaries.mjs`: enforces SPEC section 4 rule 1 on `src/core/**` and `src/data/**` (test files excluded from the forbidden-globals check only for `performance`). Exit 1 with `file:line` on a violation. `--self-test` runs it against an in-memory bad sample and must report a violation.
- `scripts/check-size.mjs`: fails if the summed size of `dist/**/*.js` exceeds 1.8 MB.
- `src/data/palette.ts`: the 25 tokens of the color bible, as `PALETTE: Record<Token, number>` (0xRRGGBB) plus `hex(token)`.
- `src/data/tuning.ts`: every named number in specs/content.md, all sections, now (later WPs read, they do not re-enter).
- `src/data/content.ts`: item table, node table, creature table, garden table, grind and brew recipes, plot grid (2 x 1), home plot structure layout with for each structure: id, kind (`hut | bed | mortar | cauldron | stall | signpost`), tiles, solid flag, interact tile, hint text (`SLEEP`, `PLANT`, `HARVEST`, `GRIND`, `BREW`, `STALL`, `BUY PLOT`).
- `src/core/rng.ts`: mulberry32 over a number held in state: `nextFloat(state)`, `nextInt(state, min, max)` inclusive, `nextRange(state, min, max)`.
- `src/core/state.ts`: `GameState` (version, seed, rng, tick, day = 1, phase = `'day'`, player { x, y, facing, hearts, moving }, inventory, coins = 0, plots [{ gx, gy, owned }]) and `createInitialState(seed)`. Entity positions are the center of the feet. Later WPs add fields; keep it a plain JSON-serializable object (no classes, Maps, Sets or functions).
- `src/core/commands.ts`: `Frame { moveX, moveY, swing, interact, commands }` and an empty-for-now `Command` union.
- `src/core/events.ts`: `GameEvent` union (empty for now, plus `{ type: 'step' }` is NOT wanted: return an empty array when nothing happened).
- `src/core/world.ts`: world size, `plotOrigin(gx, gy)` in world tiles, `plotTileCenter(gx, gy, tx, ty)` in px, `tileKind(state, wtx, wty)` -> `'deepwater' | 'grass' | 'road' | 'locked'`, `isBlocked(state, x, y, w, h)` for a feet box against deep water, locked plots and solid structures.
- `src/core/player.ts`: movement at `player.speed`, diagonal normalized, axis-separated collision (slide along walls), facing = last non-zero dominant axis (`'down' | 'up' | 'left' | 'right'`).
- `src/core/step.ts`: `step(state, frame): GameEvent[]`, one 1/60 s tick, increments `state.tick`.
- `src/input/input.ts`: a pure `buildFrame(keys, pad, prev)` (unit tested) and a thin Phaser-facing reader. Keyboard and gamepad per the controls table in design.md. `swing` and `interact` are edge-triggered and latched per SPEC section 4 (input delivery rules): a press is held until one tick consumes it, then cleared; the same for queued `commands`. Tracks the last device used.
- `src/input/input.ts` also exports a pure `buildUiIntents(keys, pad, prev, dtMs)` (unit tested): `{ up, down, left, right, confirm, back, notebook, pause, mute }`, edge-triggered, where the four directions auto-repeat while held (first repeat after 350 ms, then every 120 ms, every 40 ms after 1.5 s held). Later WPs' panels read these, not `Frame`.
- `src/render/sprites/`: the string-array sprite format from design.md, a generator that turns every sprite into a Phaser texture in BootScene, and sprites for: player (all poses), tiles, hut, mortar, cauldron (2 frames), stall, signpost, soil bed (empty), shadow.
- `src/render/font.ts`: the bitmap font from design.md and a helper to add text in a palette token color.
- `src/render/scenes/`: BootScene (textures, then GameScene; the title comes in WP02), GameScene (ground tiles, structures, player, y-sort, shadows, camera follows the player and is clamped to the world, dark fog over locked plots), UIScene (overlay, for now only the version text when debug is on).
- `src/main.ts`: Phaser config (480x270, pixelArt, roundPixels), integer scaling recomputed on resize, fixed-step accumulator (60 Hz, max 5 steps per frame, times `?speed`).
- `src/debug/debug.ts`: `window.__game = { state, step(n, frame?), cmd(command), give(itemId, n), setPhase(p), bot(on), version }` in dev or with `?debug=1`; `setPhase` and `bot` may be no-op stubs here. Query params from SPEC section 5 (`autoplay` may be a stub).

## Behaviour and numbers

- Player start: center of home plot tile (2,4) = world px (88, 120).
- Collision uses `player.hitbox` (10 x 8) centered on the feet position.
- `step(n, frame)` in debug holds the same frame for n ticks, except `swing`, `interact` and `commands`, which apply to the first tick only.
- All timers are integer tick counters (SPEC section 5). `tuning.ts` keeps the values in seconds as in content.md and exports a `ticks(seconds)` helper = `Math.round(seconds * 60)`.
- `package.json` devDependencies include `@types/node` at the pinned version.

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] `node scripts/check-boundaries.mjs --self-test` -> exit 0 and prints the detected sample violation.
- [ ] Vitest: same seed gives the same RNG sequence; two different seeds differ.
- [ ] Vitest: `createInitialState(1)` survives `JSON.parse(JSON.stringify())` unchanged, and player is at (88, 120).
- [ ] Vitest: 60 ticks with `moveX: 1` from the start position moves x by 90 (+-1); a down-right diagonal move (`moveX: 1, moveY: 1`) covers 90 (+-1) px of distance in 60 ticks.
- [ ] Vitest: the player cannot enter the hut tiles, deep water, or the locked east plot (walk into each for 600 ticks, assert the feet box never overlaps them).
- [ ] Vitest: determinism: the same 600 scripted frames from the same seed give byte-identical `JSON.stringify(state)` twice.
- [ ] Vitest: `buildFrame`: arrows, gamepad stick below 0.25 gives 0, d-pad, X/C and buttons 2/0 edge-trigger once per press, last-device tracking.
- [ ] Vitest: a press made during a render frame that runs 0 ticks is still delivered to the next tick, exactly once; a held key does not re-trigger.
- [ ] Vitest: `buildUiIntents`: confirm/back/notebook/pause/mute fire once per press on keyboard and pad; a direction held for 1 s fires 1 + 6 times (350 ms, then every 120 ms).
- [ ] Vitest: the palette has exactly the 25 tokens and hex values of specs/design.md.
- [ ] Vitest: `tuning` and `content` hold the values of specs/content.md (spot-check at least: day length 240, plot price 150, the 4 potion base values, node targets per plot).
- [ ] Browser, if the preview tools are available to you (`preview_start` name `fen-and-flask`, then `http://localhost:5345/?debug=1&skipTitle=1&nosave=1&seed=1`): no console error; `__game.state.player.x === 88`; after `__game.step(60, {moveX:1, moveY:0, swing:false, interact:false, commands:[]})`, x is 178 (+-1). If you cannot run it, say "not run" in the report; never claim it.

## Allowed deferrals

`setPhase`, `bot`, `?autoplay` as stubs. No title screen, no HUD.

## Out of scope

Nodes, creatures, pickups, clock, garden, stations, stall, audio, save. Do not add state fields for them.
