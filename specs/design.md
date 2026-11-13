# Fen & Flask - design

## Look

- Top-down 3/4 pixel art: you see the top and the front of things. 16 px tiles, internal 480x270, scaled to fill the window (see SPEC section 5).
- Sprites are drawn in code for M1: each sprite is an array of strings, one character per pixel, with a legend that maps characters to palette tokens (`.` = transparent). BootScene turns them into textures. No image files in M1.
- Everything that stands up is y-sorted by its feet and has a soft oval shadow.
- Mood: damp, green, lantern-warm. Day is neutral, evening is a warm tint, the night fade is blue.

### Readability rules
1. Anything the player can hit or use has an `ink` outline; the ground never does.
2. The current swing target and interact target get a `bone` outline.
3. Creatures are the only `plum` things on screen.
4. Pickups bob and are never larger than 8x8 px.
5. A hint for the interact target sits at the bottom of the screen, 2-3 words ("C Brew"); no other tutorial text.

### Clutter budget
HUD only: hearts and coins top-left, clock and day number top-right, the item bar bottom-center (icons with counts, only items you own), the interact hint above it. Everything else lives in a panel.

## Color bible

No color ships outside these tokens (`src/data/palette.ts`).

| Token | Hex | Use |
|---|---|---|
| ink | #1b1f2a | outlines, darkest shade, text shadow |
| deepwater | #22384a | border water, fog base |
| water | #2f5d62 | shallow water, puddles |
| waterlight | #4f8a7b | water highlights, ripples |
| moss | #3e6b3a | dark grass, bush shade |
| grass | #5f8f3e | main ground |
| grasslight | #8fb84e | grass tufts, leaf highlights |
| peat | #3b2e26 | soil beds, stump dark |
| mud | #5a4636 | road, mud patches |
| sand | #b59a6a | road highlights, hut wall |
| reed | #c9b458 | reeds, thatch |
| wood | #7a5230 | stumps, stall, hut frame |
| woodlight | #a8763e | wood highlights |
| mint | #7fd6a0 | mint, tonic |
| glow | #7df0e6 | glowcaps, glow draught, sparkles |
| ember | #f0803c | emberroot, elixir, evening tint |
| emberhot | #ffd166 | fire, lantern, elixir highlight |
| plum | #8e5a8a | creatures only |
| plumlight | #c08fbd | creature highlights, mud gel |
| coin | #f2c94c | coins, prices |
| heart | #e0524d | hearts, damage flash |
| bone | #f3ecd8 | UI text, highlights, outlines of targets |
| panel | #2a2433 | UI panel fill |
| panellight | #40364d | UI panel border, selected row |
| night | #3a4a8a | sleep fade |

## Controls

| Action | Keyboard | Gamepad (standard mapping) |
|---|---|---|
| Move | Arrow keys | left stick (dead zone 0.25) or d-pad |
| Swing (gather, attack) | X | X (button 2) |
| Interact / confirm | C or Enter | A (button 0) |
| Back / cancel | X or Esc in panels | B (button 1) |
| Notebook | V | Y (button 3) |
| Pause | Esc (outside panels) | Start (button 9) |
| Mute | M | - |
| In panels | Up/Down select, Left/Right change quantity or price (hold to repeat, accelerating) | same on stick or d-pad |

Only X, C, V, M, Esc and the arrows are used: X, C and V sit in the same place on AZERTY and QWERTY keyboards. Read keys by their value (Phaser KeyCodes or `event.key`), never by `event.code`, so M is the key labelled M on any layout.

Hints show the keyboard key or the gamepad button depending on the last device used.

## Screens

- **Title**: logo text, Continue (if a save exists) / New game, a one-line key hint, version bottom-right. The title menu rows can also be clicked with the mouse.
- **World**: the game plus HUD.
- **Station panel** (mortar, cauldron): list of recipes with what you own, quantity, Start. A recipe you cannot afford is dimmed.
- **Garden picker**: the plantable ingredients you own.
- **Stall panel**: setup = one row per potion (icon, name, count, price); open = same rows, the customer and their reaction bubble shown in the world behind the panel's narrow left column; done = "Sold N potions for C coins".
- **Notebook**: page 1 recipes (grind and brew), page 2 per potion the last 3 prices with their reaction icon and today's trend.
- **Confirm**: small yes/no box (sleep, call it a day, buy plot for 150).
- **Pause**: Resume, Mute, New game (with confirm), version.

Panels are at most 220 px wide, `panel` fill with a `panellight` border, text in `bone`.

## Font

A code-defined bitmap font: 5x7 glyphs in a 6x8 cell, uppercase A-Z, digits, and `. , : ; ! ? - + / ( ) ' % & =` plus space. Lowercase input is shown as uppercase (so "x3" renders as "X3"). Built into a texture at boot and used for all text.

## Juice (driven by core events)

Hit: target squashes 2 frames, 3-5 leaf or chip particles, 1 px screen shake for creatures only. Node breaks: pop of 6 particles. Pickup collected: icon hops into the item bar, count ticks up. Sale: coins fly to the coin counter with a "+N". Damage: player flashes `heart`, 2 px shake. Potion done: `glow` sparkle on the cauldron.

## Sprite list (all code-drawn in M1)

| Group | Sprites |
|---|---|
| Player | 16x24; down, up, side (flipped for left); 2-frame walk and 1 swing pose each |
| Mudlet | 16x12, 2-frame hop |
| Customers | 16x24, side view, 2-frame walk, 3 palette variants |
| Nodes | mintbush, glowcaps, reedclump, stump, emberplant (16x16 each) |
| Structures | hut 48x48, mortar 16x16, cauldron 16x20 (2 frames), stall 48x32, signpost 16x24, soil bed 16x16 (empty, sprout, ready per crop) |
| Tiles | grass x3 variants, mud road, deep water x2 frames, shore edges |
| Icons | 8x8 per item id (13), heart, coin, 4 reaction bubbles, clock dial |
| Fx | shadow, particle, target outline is generated from the sprite |

## Sounds (WP05)

Real open-license recordings, CC0 only, never synthesized. The brain lists each source and file for the user and downloads nothing before the user says yes. Files go to `public/audio/` as `.ogg`, each under 150 KB (the ambience loop under 400 KB), with `public/audio/CREDITS.md` naming every source and its license.

Ids: `swing`, `hit_plant`, `hit_wood`, `squish`, `pickup`, `grind`, `bubble`, `potion_done`, `coin`, `refuse`, `bell`, `hurt`, `sleep`, `ui_move`, `ui_confirm`, plus one quiet `marsh_ambience` loop. Default volume 0.6. No music in M1.
