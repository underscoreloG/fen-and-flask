# Fen & Flask - content and numbers

Every value here lives in `src/data/tuning.ts` or `src/data/content.ts` under the name given. Values marked (tune) are first guesses.

## World

- Tile 16 px. A plot is 20 x 14 tiles (320 x 224 px). M1 world: 2 plots side by side, home at grid (0,0), east at grid (1,0), inside a border of 3 deep-water tiles. World = 46 x 20 tiles (736 x 320 px).
- Deep water and locked plots are not walkable. A locked plot is drawn under a dark fog.
- The road is plot row 13 on every plot (walkable, no nodes).
- The data model is a grid of plots, so M2 can add more without a rewrite.

### Home plot layout (plot-local tiles)

| Thing | Tiles | Solid | Interact |
|---|---|---|---|
| Hut | (1,1) to (3,2) | yes | door at (2,3): sleep |
| Soil beds x4 | (6,2) (7,2) (6,3) (7,3) | no | plant / harvest |
| Mortar | (10,2) | yes | grind |
| Cauldron | (12,2) | yes | brew |
| Stall | (8,11) to (10,11) | yes | from tile (9,10): stall |
| Customer spot | (9,12) | no | - |
| East signpost | (19,6) | yes | buy east plot |
| Player start | (2,4) | - | - |

East plot: no structures in M1.

Node spawn rule: a random free tile in rows 0-11, not solid, not a soil bed, not within 1 tile of a structure or another node. Positions are re-rolled each morning from the state RNG.

## Items

| id | Name | Kind |
|---|---|---|
| mint | Marsh Mint | raw |
| glowcap | Glowcap | raw |
| reed | Reed | raw |
| bogwood | Bogwood | fuel |
| mudgel | Mud Gel | raw |
| emberroot | Emberroot | raw |
| mintpaste | Mint Paste | ground |
| glowdust | Glow Dust | ground |
| emberpowder | Ember Powder | ground |
| tonic | Soothing Tonic | potion |
| salve | Slick Salve | potion |
| glowdraught | Glow Draught | potion |
| emberelixir | Ember Elixir | potion |

Inventory: a count per item id, no limit.

## Player

| Name | Value |
|---|---|
| `player.speed` | 90 px/s, 8 directions, diagonal normalized |
| `player.hitbox` | 10 x 8 px at the feet |
| `player.hearts` | 5 |
| `swing.cooldown` | 0.30 s |
| `swing.reach` | circle of radius 20 px centered 12 px in front of the player |
| `swing.assistRadius` | 18 px around the player: if nothing is in reach in front, the swing turns to the nearest target in this radius |
| `swing.damage` | 1 |
| `interact.reach` | same shape as `swing.reach`, same assist |
| `hurt.invulnerable` | 1.0 s |
| `hurt.knockback` | 24 px over 0.15 s |

Swing target priority: nearest creature in reach, else nearest node, else a ready soil bed (harvest). The current swing target and the current interact target are exposed in state so the renderer can outline them.

Faint (0 hearts): fade out, then the normal morning reset runs and the player wakes at the hut door with full hearts. That day's stall is lost. Nothing else is lost.

## Nodes

| id | Hits | Drops | Home target | East target |
|---|---|---|---|---|
| mintbush | 1 | 1 mint | 6 | 0 |
| glowcaps | 1 | 1 glowcap | 4 | 3 |
| reedclump | 2 | 1-2 reed | 6 | 3 |
| stump | 3 | 2 bogwood | 3 | 2 |
| emberplant | 2 | 1 emberroot | 0 | 4 |

Each morning every owned plot is refilled to its target counts. No daytime respawn.

Pickups: scatter 8-14 px from the source, `pickup.magnetRadius` 28 px, fly at 160 px/s, collected within 6 px.

## Creature: mudlet

| Name | Value |
|---|---|
| hp | 3 |
| wander | 30 px/s; walk 1.5-3 s in a random direction, idle 0.5-1.5 s |
| aggro radius | 56 px, then hops toward the player at 45 px/s |
| contact | 1 heart |
| when hit | knockback 20 px, stun 0.25 s |
| drop | 1 mudgel |
| count each morning | home 2, east 4 |

Mudlets never leave their plot and never enter the road row.

## Day clock

- `day.length` 240 s (tune). The clock shows 06:00 to 18:00 across it. Then phase `evening`, which has no timer.
- Interacting with the stall during the day asks "Call it a day?"; yes jumps to evening.
- Sleeping (hut door, any time, with a confirm) runs the morning reset: day + 1, phase day, nodes and mudlets refilled, garden advances one night, hearts full, demand recovers, a trend potion is picked, the game saves.
- Station jobs still running at sleep finish instantly and drop their output.

## Garden

4 soil beds. Interact with an empty bed: pick an ingredient you own (consumes 1). Interact or swing on a ready bed: harvest.

| Planted | Nights | Yield |
|---|---|---|
| mint | 1 | 3 mint |
| glowcap | 1 | 3 glowcap |
| emberroot | 2 | 2 emberroot |

## Stations

One job at a time per station. Start a job from its panel, walk away, outputs pop out next to the station as pickups. A progress bar shows above a busy station.

Mortar: pick an input and a quantity (1 to all owned); `mortar.secondsPerUnit` 1.5.

| Input | Output |
|---|---|
| mint | mintpaste |
| glowcap | glowdust |
| emberroot | emberpowder |

Cauldron: pick a recipe and a quantity (1 to 5, limited by ingredients); costs 1 bogwood per job; `cauldron.secondsPerPotion` 6.

| Potion | Ingredients | Base value |
|---|---|---|
| tonic | 1 mintpaste + 1 reed | 14 |
| salve | 1 mudgel + 1 reed | 18 |
| glowdraught | 1 glowdust + 1 mintpaste | 24 |
| emberelixir | 1 emberpowder + 1 glowdust | 60 |

## Stall

- Usable in the evening, once per day. Flow: `closed` -> `setup` (price list) -> `open` (customers) -> `done` (summary).
- Setup lists every potion type you own with its count and your price. First-ever price of a potion = round(0.7 x base value). Prices persist across days. Step 1 coin, minimum 1.
- `stall.customersBase` 6, plus 2 per extra owned plot.
- Each customer: walks in along the road (2 s), picks a random potion type in stock, shows a reaction (0.8 s), buys 1 unit or not, walks out. Prices can be changed between customers. The player can close early. The stall ends when customers or stock run out.

Reaction, with `value = base x demand[potion] x trend x personal` and `r = price / value`:

| r | Reaction | Sale | Extra |
|---|---|---|---|
| r <= 0.80 | delighted | yes | you priced too low |
| 0.80 < r <= 1.10 | happy | yes | - |
| 1.10 < r <= 1.30 | grumbling | yes | demand -0.05 |
| r > 1.30 | refuses | no | - |

- `personal`: uniform 0.95-1.05 per customer.
- `demand[potion]`: starts 1.0; -0.04 per unit sold (floor 0.6); +0.15 per night (cap 1.0).
- `trend`: each morning one potion type the player can currently brew (recipe ingredients obtainable on owned plots) is "in demand": x1.3 for that day. Announced by a toast when evening starts and shown in the notebook.
- The notebook keeps the last 3 (price, reaction) entries per potion.

## Economy and goal

- East plot: 150 coins at the signpost. Buying it unlocks it at once and fills it to its targets.
- M1 goal: the first sale of an emberelixir shows the banner "First Ember Elixir sold - the marsh is yours to grow" once. Play continues.
- Health targets (headless bot, seeds 1-3): coins earned on evening 1 between 40 and 130; east plot bought by day 4; goal reached by day 6.

## Save

localStorage key `fenflask.save.v1`: the whole `GameState` as JSON plus the game version, written at each morning reset. A save whose version major.minor differs from the game's is ignored (New game only). Mute and volume live in `fenflask.settings.v1`.
