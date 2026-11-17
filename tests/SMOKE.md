# Campaign browser smoke check — November 16, 2026

Validated the local game in Chromium at desktop 1440×900 and mobile menu 390×844.

- Production build: passed. Vite reports the expected size advisory for the Three.js engine bundle (approximately 177 kB gzipped including game code).
- Automated tests: all 27 passed with `npm test` (collision, campaign inventory/results, and banter).
- Browser console: no errors after adding the favicon.
- Title menu: difficulty selection, field manual and settings open/close passed.
- Visible settings: HD and performance modes. The F4 Easter egg is absent from game menus.
- F4 in a paused game: changed 1440×900 HD to 320×200 retro, then restored HD; player state and elapsed time remained identical.
- Retro mode includes directional enemy sprites, palette reduction, nearest filtering, and the complete weapon rendering pass.
- Reload starts in HD; retro state is intentionally not persisted.
- Movement, aiming, shotgun hits, fire flower projectiles and weapon switching passed.
- Tactical map toggles and displays the world.
- Pause freezes game time; resume restores play.
- Enemy attacks deal damage and can reach the death screen.
- Full three-level playthrough via keyboard/mouse input simulation: each Power Star collected, each portal used, both Next Level screens and briefings passed, final Bowser defeated, campaign victory displayed (35/38 enemies eliminated; 3/3 levels cleared).
- Level 2 was completed in retro mode, switching back to HD for level 3.
- Level 2 lava death and retry: stayed on level 2, restored exact entry inventory, reset its key/kills, and preserved level 1 results.
- New campaign resets to chapter 1. Returning to title from chapter 2 restores the courtyard backdrop.
- Situational subtitles observed on chapter starts, retro toggle, pickups and course completion. Completion quotes render inside the intermission modal.
- Mobile menu: no horizontal overflow; main action visible.

The automated browser denied mouse capture, so the playthrough exercised drag-to-aim fallback. Native mouse capture and touch gestures should also be checked on the target device. Spoken delivery depends on available browser voices; captions work independently. Tests used the read-only `window.gameSnapshot()` for observation, without changing player health, position, ammo, enemy health, or victory conditions. `tests/install-browser-driver.js` installs the repeatable input-only campaign driver.
