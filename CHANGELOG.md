# Changelog

## v0.3.3 - 2026-11-13

Play feedback: stop a job, and unhappy customers keep their coins.

- A busy mortar or cauldron can be stopped: its panel has a second row, STOP, TAKE n BACK. The ingredients of every unit not yet made come back to your bag (the one in progress included); the bogwood is burnt. What is already out stays where it is.
- Only delighted and happy customers buy. A grumbling one shows its face, leaves the item on the table and walks out, like one who refuses: grumbling means a little too dear, refusing far too dear. A grumble no longer lowers demand, since nothing is sold.
- Saves from 0.3.2 load as they are.

## v0.3.2 - 2026-11-13

Customers stop being one rule, and every morning brings an order.

- Four kinds of customer, each with its own look: the traveller (nothing special), the courier (pays a quarter more for potions, waits only 12 s at the counter), the haggler (pays less, waits 50 s) and the herbalist (pays half again for herbs and powders, and heads for a table of them).
- Notebook page 3, CUSTOMERS: each kind once it has paid you, with its look and what it is like.
- The daily order: a note on the board on the shop's back wall asks for 1 to 3 of a potion you can brew, for 1.5 times its value. Deliver it from your bag at the board (potions on the tables do not count). A new note comes each morning; the notebook's price page shows it too. An Ember Elixir delivered there counts for the first-elixir goal.
- The shop is complete once you own the whole catalog: a banner says so, and play goes on.
- Saves from 0.3.1 load and get today's order.

## v0.3.1 - 2026-11-13

Helpers: three marsh toads from the catalog each take a chore off your hands.

- Garden toad (280): each morning it harvests the ready beds and plants them again with the same crop. It sits by the beds.
- Counter toad (320): while the shop is open it rings up a customer who has waited 8 s at the counter, wherever you are; the trained counter toad (450) does it after 3 s. You can still ring up sooner by hand. It sits on the counter, hops and lights the till.
- Basket toad (420): each morning it brings 5 ingredients from the marsh (9 with the bigger basket, 520), drawn like the plants of your plots. It sits in the back room.
- Dig up: interact with a growing bed to dig it up (the seed comes back) and plant something else; the garden toad then tends the new crop.
- The catalog now holds 14 items. Saves from 0.3.0 load as they are.

## v0.3.0 - 2026-11-13

Coins have somewhere to go: a catalog in the shop.

- A catalog stand by the shop door sells nine upgrades. Pay at once; the item arrives the next morning (a toast and a crate by the door say so).
- Shop floor: a fifth and a sixth table (2 more customers each), a painted signboard and then a lantern sign on the hut (2 and 3 more customers), and deep tables that hold 8, where one buyer in four takes two. Up to 17 customers an evening.
- Workshop: a stone mortar that grinds twice as fast and a second cauldron in the back room.
- Gathering: a copper sickle (one hit less on plants and stumps) and two more garden beds.
- Saves from 0.2.x are not loaded (New game only). From now on, saves from an earlier patch of the same version fill in what they lack.

## v0.2.1 - 2026-11-13

- The shop sign has one action: OPEN SHOP. Opening by day also ends the day; "call it a day" is gone.
- A test menu on F2: coins, items, hearts, skip to evening or to the next morning, unlock all land.

## v0.2.0 - 2026-11-13

The shop moves indoors.

- Walk into the hut through its door: a shop room with four display tables, a counter with a till and a sign by the door, and a back room with the mortar, the cauldron and your bed. The hut outside has an awning and a hanging sign.
- Shelves: put any item on a table (up to 5), set its price there, top it up or take it back, at any time of day. Every item has a value, so raw herbs sell too; first prices always sell.
- Evening: open the shop from the sign. Customers walk in, browse a table, react to the price, take one and queue at the counter. Press C at the counter to ring them up; after about 30 s of waiting they leave without paying and the item goes back.
- The outdoor stall and the outdoor stations are gone; you sleep in the back room and wake there, and mudlets leave you alone indoors.
- Saves from 0.1.x are not loaded (New game only).

## v0.1.3 - 2026-11-13

- The game now fills the window instead of stopping at the largest whole-number zoom.

## v0.1.2 - 2026-11-13

- The key hint on the title screen is now bright enough to read.

## v0.1.1 - 2026-11-13

- Enter now works like C (confirm and interact), and the title menu can be clicked with the mouse.
- The title screen shows which key starts the game.

## v0.1.0 - 2026-11-13

First playable slice (M1).

- One home plot and a buyable east plot (150 coins).
- Gathering: five node types hit with one swing button; drops fly to the player.
- Light combat: mudlets, five hearts, fainting skips to the next morning with nothing lost.
- Garden: four soil beds; plant one ingredient, harvest more after sleeping.
- Stations: mortar (three grind recipes) and cauldron (four potions), with progress bars.
- Day clock: a 240 s day, then an open-ended evening; sleep when you choose.
- Evening stall: set a price per potion, travellers react (delighted, happy, grumbling, refuses), demand shifts and a daily trend.
- Notebook: recipes and the last prices with their reactions.
- Goal: sell your first Ember Elixir; a banner says so and play continues.
- Save to the browser every morning; title screen with Continue / New game.
- Pause menu (Esc or Start): resume, mute, new game.
- Sound: 15 CC0 sound effects and a marsh ambience loop; M mutes anywhere, the setting is remembered.
- Keyboard and gamepad.
- Deployed to GitHub Pages; `version.json` next to the game holds the build's version.
