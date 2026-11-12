# WP05 - Audio, pause, changelog, GitHub Pages workflow

Goal: the game has sound driven by core events, a pause menu with mute, a changelog, and a workflow that builds and deploys it to GitHub Pages.
Read first: SPEC.md (section 10), specs/design.md (Sounds, Screens, Controls)
Depends on: WP04 (all core events exist). The sound files are already in `public/audio/` with `public/audio/CREDITS.md`, placed there by the brain after the user approved each source; do not download or generate any audio yourself.
Owns: `src/audio/**`, `src/render/ui/pause.ts`, `.github/**`, `CHANGELOG.md`, `README.md`, `scripts/write-version.mjs`. Edits to existing files as allowed by SPEC section 6. `public/audio/**` is read-only for you.

## Deliverables

- `src/audio/manifest.ts`: sound ids from design.md Sounds, each with its file name, base volume and the events that trigger it:
  `swing` <- swing; `hit_plant` <- nodeHit on mintbush, glowcaps, reedclump, emberplant; `hit_wood` <- nodeHit on stump; `squish` <- creatureHit, creatureDied; `pickup` <- pickupCollected; `grind` <- jobStarted at the mortar; `bubble` <- jobStarted at the cauldron; `potion_done` <- jobUnitDone at the cauldron; `coin` <- sale; `refuse` <- customerReacted with reaction refuses; `bell` <- stallOpened; `hurt` <- playerHurt; `sleep` <- morning; `ui_move` and `ui_confirm` <- panel navigation and confirm; `marsh_ambience` loops in the world at low volume.
- Base volumes (the files differ in loudness; these even them out, tune by ear later): `swing` 0.8, `hit_plant` 0.6, `hit_wood` 0.45, `squish` 1.0, `pickup` 0.5, `grind` 0.9, `bubble` 0.6, `potion_done` 0.8, `coin` 1.0, `refuse` 0.4, `bell` 1.0, `hurt` 0.45, `sleep` 0.6, `ui_move` 0.4, `ui_confirm` 0.5, `marsh_ambience` 0.25.
- `src/audio/audio.ts`: loads through Phaser, plays from the event list each frame, at most one instance of the same id per 50 ms, master volume 0.6, mute toggle on M, both stored in `fenflask.settings.v1`. A missing or undecodable file logs one warning and never throws. Audio starts after the first user input (browser autoplay policy).
- `src/render/ui/pause.ts`: Esc (outside panels) or Start: Resume, Mute on/off, New game (confirm, clears the save), version. Pauses the sim.
- `scripts/write-version.mjs`: writes `dist/version.json` `{ "version": "<package version>" }`; `build` runs it after `vite build`.
- `.github/workflows/pages.yml`: on push to `main`: checkout, setup-node 24, `npm ci`, `npm run verify`, `npx vite build --base=/fen-and-flask/`, write version.json, upload-pages-artifact, deploy-pages; permissions `pages: write`, `id-token: write`, `contents: read`.
- `CHANGELOG.md`: `## v0.1.0 - <date>` with the M1 feature list.
- `README.md`: 15 lines max: what it is, controls, `npm run dev`, credits pointer.

## Acceptance tests

- [ ] `npm run verify` -> exit 0.
- [ ] Vitest: every manifest entry's file exists in `public/audio/` and is under 150 KB (`marsh_ambience` under 400 KB); every file in `public/audio/` except CREDITS.md is in the manifest; every sound id of design.md is in the manifest.
- [ ] Vitest: the event-to-sound mapping (a pure function) returns the ids above for sample events, and nothing for events without a sound.
- [ ] Vitest: the rate limit drops a second identical id inside 50 ms.
- [ ] `npm run build` -> `dist/version.json` holds the package version; `dist/audio/` holds the sound files.
- [ ] Browser (run by the brain after merge, you report "not run") (`?debug=1&skipTitle=1&nosave=1&seed=1`): no console error or warning from the game's own code about audio after `__game.step(600)` with a few swings (the browser's own autoplay-policy notice does not count).

## Allowed deferrals

None.

## Out of scope

Music, volume slider, generating or fetching audio, pushing to GitHub (the brain does the first push and the Pages setting).
