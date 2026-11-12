# WP02 - Day cycle, sleep, garden, save, title screen

Goal: days pass, the player sleeps to start a new morning where everything regrows, plants ingredients in the 4 soil beds, and the game saves each morning and resumes from a title screen.
Read first: SPEC.md, specs/design.md (Screens, Controls), specs/content.md (Day clock, Garden, Save)
Depends on: WP01 (nodes and creatures with their refill functions, interact event, HUD, faint).
Owns: `src/core/{clock,garden}.ts` and tests, `src/save/**`, `src/render/ui/{gardenPicker,confirm}.ts`, `src/render/scenes/TitleScene.ts`. Edits to existing files as allowed by SPEC section 6.

## Deliverables

- `src/core/clock.ts`: `state.clock = { t }` with `state.phase: 'day' | 'evening'`; at `day.length` (14400 ticks) the phase becomes evening. Every switch to evening (timer, `CallItADay`, debug `setPhase`) goes through one function that emits `eveningStarted` exactly once for that day. `morningReset(state)`: day + 1, phase day, t = 0, `refillPlot` and `refillCreatures` on every owned plot (existing nodes and mudlets are kept, only the missing ones are added; positions of new ones are rolled from the state RNG), garden advances one night, hearts full, pickups left on the ground stay, emit `morning`. Keep a clearly named hook order so WP03 (finish jobs) and WP04 (demand, trend, stall reset) can add their steps.
- Commands: `{ type: 'CallItADay' }` (day only), `{ type: 'Sleep' }` (any phase).
- Faint now calls `morningReset` (replacing the WP01 deferral), then places the player at the door.
- `src/core/garden.ts`: `state.garden: Bed[4]`, each `{ crop: ItemId | null, nightsLeft }`; command `{ type: 'Plant', bed, item }`; harvest by interact or by swing on a ready bed (ready beds join the swing target list, lowest priority) -> spawns the yield as pickups on the bed and empties it.
- Interact routing in core: door -> event `uiRequest { ui: 'sleepConfirm' }`; stall during the day -> `uiRequest { ui: 'callItADayConfirm' }` (the evening stall is WP04); empty bed -> `uiRequest { ui: 'gardenPicker', bed }`; growing bed -> nothing; ready bed -> harvest.
- Commands that act on a structure (`Plant`, and later station and stall commands) are rejected unless that structure is the player's current interact target. `Sleep` requires the door, `CallItADay` requires the stall.
- `src/save/save.ts`: `serialize(state, version)`, `deserialize(json, version)` (null on a major.minor mismatch or bad JSON), `load()`, `store(state)`, `clear()`; key and rules from content.md Save. The render side stores on the `morning` event. `?nosave=1` disables both directions.
- `src/render/scenes/TitleScene.ts`: title text, Continue (only with a valid save) / New game, version bottom-right. `?skipTitle=1` starts a new game at once.
- `src/render/ui/confirm.ts`: yes/no box, used for sleep and call-it-a-day. `src/render/ui/gardenPicker.ts`: the plantable items the player owns with counts.
- The sim is paused (no `step`) while a panel is open; a single shared "panel open" switch that later panels reuse. Panels read UI intents from `src/input`, and their commands are queued and delivered on the first tick after the panel closes (SPEC section 4, input delivery rules). Build this queue once here so WP03 and WP04 panels reuse it.
- HUD: clock dial and "DAY N" top-right; shows "EVENING" in the evening.
- Screen tint: none by day, `ember` at low alpha in the evening; sleep = fade to `night`, hold, fade back (1.5 s total).
- Sprites: soil bed sprout and ready states per crop, clock dial.
- Debug: `__game.setPhase('day' | 'evening')` works.

## Behaviour and numbers

All values by name from specs/content.md. The clock time shown is `06:00 + (t / day.length) x 12 h`, in 10-minute steps.

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] Tests that let time pass with an idle player first clear `state.creatures` (an idle player next to live mudlets faints, and a faint resets the day).
- [ ] Vitest: with creatures cleared, after 14400 ticks from a new game the phase is evening and exactly one `eveningStarted` was emitted; t stops advancing in the evening. `CallItADay` and `setPhase('evening')` each emit exactly one `eveningStarted` too.
- [ ] Vitest: `CallItADay` at the stall during the day jumps to evening; in the evening it is rejected; away from the stall it is rejected.
- [ ] Vitest: `Sleep` at the door: day 2, phase day, t 0, node counts back at the home targets after some were broken, 2 mudlets after one was killed, hearts full after damage, one `morning` event. `Sleep` away from the door is rejected.
- [ ] Vitest: plant mint (inventory -1), sleep, the bed is ready, harvest gives 3 mint; emberroot needs 2 sleeps and gives 2; planting an item the player does not own, or a non-plantable item, or on a non-empty bed, is rejected with the state unchanged.
- [ ] Vitest: fainting advances the day and leaves inventory and coins unchanged.
- [ ] Vitest: `deserialize(serialize(s))` deep-equals `s`; a state loaded from a save and the original, both stepped through the same 600 frames, end byte-identical; a save from version 0.2.0 loaded by 0.1.x returns null; garbage JSON returns null.
- [ ] Vitest: the determinism test passes across a sleep.
- [ ] Browser, if available: `?debug=1&nosave=1&seed=1` shows the title with New game and no Continue; with `skipTitle=1`, `__game.setPhase('evening')` then `__game.step(1)` -> `__game.state.phase === 'evening'`. Otherwise report "not run".

## Allowed deferrals

Demand, trend and stall reset in the morning hook (WP04). Finishing station jobs at sleep (WP03). Pause menu (WP05).

## Out of scope

Stations, stall, land purchase, audio, save export.
