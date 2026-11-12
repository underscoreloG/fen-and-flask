# WP01 - Gathering and combat

Goal: the player can hit plants and stumps, collect what drops, fight mudlets, get hurt and faint, and sees hearts, coins, an item bar and an interact hint.
Read first: SPEC.md, specs/design.md, specs/content.md (Player, Nodes, Creature sections)
Depends on: WP00 (core tick, world, player movement, data tables, sprite and font pipeline, debug surface). Read the existing `src/core` and `src/data` before writing.
Owns: `src/core/{nodes,creatures,pickups}.ts` and tests, `src/render/fx.ts`, `src/render/ui/hud.ts`. Edits to existing files as allowed by SPEC section 6.

## Deliverables

- `src/core/nodes.ts`: node entities `{ id, type, x, y, hp, plot }`; `refillPlot(state, plotIndex)` brings each node type up to its target for that plot using the spawn rule; `createInitialState` fills the home plot.
- `src/core/pickups.ts`: spawn, magnet, collect into inventory.
- `src/core/creatures.ts`: mudlet entity and AI; `refillCreatures(state, plotIndex)`; initial state has the home count.
- Swing and targeting in `player.ts` / `step.ts`: `state.player.swingTarget` and `state.player.interactTarget` (ids or null) recomputed every tick; swing cooldown; damage.
- Interact: pressing interact on a target emits `{ type: 'interact', kind, structureId }`. No panel exists yet; later WPs consume it.
- Hearts, hurt, invulnerability, knockback, faint.
- Events added to `GameEvent`: `swing`, `nodeHit`, `nodeBroken`, `creatureHit`, `creatureDied`, `pickupSpawned`, `pickupCollected`, `playerHurt`, `playerFainted`, `interact`. Each carries the ids and positions the renderer needs. Every hit on a node emits `nodeHit { nodeType, ... }`; the hit that breaks it emits `nodeHit` and then `nodeBroken { nodeType, ... }`. The same pattern for `creatureHit` then `creatureDied`. `pickupSpawned` and `pickupCollected` carry the item id.
- `src/render/ui/hud.ts`: hearts and coins top-left, item bar bottom-center (only items with count > 0, in the item table order), interact hint above the bar (hint text from the structure table, prefixed with the key or button for the last device used).
- `src/render/fx.ts`: the juice list of design.md that applies to these events, plus the `bone` outline on the swing target and the interact target.
- Sprites: the 5 nodes, mudlet (2 frames), the 13 item icons, heart, coin, particle.
- GameScene draws nodes, creatures and pickups (y-sorted, shadows, pickups bob).

## Behaviour and numbers

All values by name from specs/content.md.

- Nodes are solid with a 10 x 8 feet box. Node and mudlet spawn rules as in content.md (World and Creature sections).
- All timers are integer ticks (SPEC section 5): cooldown 18, invulnerability 60, knockbacks 9, stun 15.
- Swing: on press, if `swing.cooldown` has elapsed, pick the target (priority: creature, node; ready soil beds arrive in WP02) inside `swing.reach`; if none, use `swing.assistRadius` and turn the player to face that target. Apply `swing.damage`. A swing with no target still plays (event `swing` with no target).
- Interact targeting uses the same shape and assist over the structure table's interact tiles (target a structure when its interact tile center is in reach).
- Node drops: counts per the Nodes table (1-2 means `nextInt(1, 2)`), scattered `8-14` px in a random direction, not inside solid things when avoidable.
- Mudlet: values from the Creature table. Wander and aggro as described; it never leaves its plot and never enters row 13 (clamp its movement). Hit: knockback away from the player (collision-respecting), stun. Death: drops 1 mudgel.
- Contact (mudlet box overlaps the player box, player not invulnerable): -1 heart, `hurt.knockback` away from the mudlet (collision-respecting), `hurt.invulnerable`.
- Faint at 0 hearts: emit `playerFainted`, set hearts to `player.hearts`, move the player to the hut door tile (2,3) center. WP02 adds the morning reset here.

## Acceptance tests

- [ ] `npm run verify` -> exit 0. The WP00 tests still pass, with their expectations updated only where the initial state legitimately grew.
- [ ] Vitest, seeds 1 to 20: the initial home plot holds exactly the home targets of every node type, and no node breaks the spawn rule.
- [ ] Tests that need a quiet scene build their state explicitly (clear `state.nodes` and `state.creatures`, then place what the test needs); never rely on where a seed happened to put things.
- [ ] Vitest: a swing at a mintbush in reach removes it, emits `nodeHit` then `nodeBroken` with `nodeType: 'mintbush'`, and spawns 1 mint pickup; walking onto it gives `inventory.mint === 1`.
- [ ] Vitest: reedclump breaks on the 2nd hit and drops 1 or 2 reed; stump breaks on the 3rd and drops 2 bogwood.
- [ ] Vitest: two swing presses 6 ticks apart land one hit; 19 ticks apart land two.
- [ ] Vitest: with nothing in front and a node 14 px behind the player, the swing hits it and the facing flips.
- [ ] Vitest: with a mudlet and a node both in reach, the mudlet is hit.
- [ ] Vitest: 3 hits kill a mudlet and drop 1 mudgel; contact costs exactly 1 heart, and a second contact inside 1.0 s costs none.
- [ ] Vitest, seeds 1 to 5, 3000 ticks each with the player standing still far away: no mudlet leaves the home plot or enters row 13.
- [ ] Vitest: at 0 hearts the player is at the hut door with full hearts and `playerFainted` was emitted once.
- [ ] Vitest: the 600-frame determinism test passes with swings and interacts in the script.
- [ ] Browser (run by the brain after merge, you report "not run") (same URL as WP00): no console error; `__game.give('mint', 3)` then `__game.step(1)` -> `__game.state.inventory.mint === 3`; `__game.state.nodes.length === 19`.

## Allowed deferrals

`// WP02: morning reset` at the faint. Soil beds as swing targets.

## Out of scope

Day clock, respawn over time, garden, stations, stall, panels, audio, save.
