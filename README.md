# Mushroom DOOM

A playable first-person fan-game prototype set in a fallen Mushroom Kingdom. Built with Three.js and Vite, with original procedural models, textures and Web Audio music/effects.

## Run

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates a static production build in `dist`; `npm run preview` serves it. No accounts, API keys or external game assets are required. The interface font uses Google Fonts with local fallbacks.

For publishing on Vercel, installing its CLI is recommended: `npm i -g vercel`. This enables `vercel deploy`, `vercel logs`, and environment management. No public deployment has been made.

## Play

- WASD: move and strafe; Shift: sprint
- Mouse: aim; left click or Space: fire
- 1 / 2: super shotgun / fire flower cannon
- E: use the exit portal
- Tab: tactical map; Esc: pause
- Arrow keys: forward/back and turn; drag to aim if mouse capture is unavailable
- Touch: on-screen movement/fire/use controls and drag the world to aim

The campaign has a beginning, three distinct levels, and a final ending:

1. **The Ashen Courtyard** — breach the fallen castle and recover its Power Star.
2. **The Infernal Pipeworks** — navigate offset blast doors, a central boiler and lava bridges to find the next star.
3. **The Midnight Citadel** — reclaim the chapel’s star, defeat Bowser and escape through the final warp gate.

Each level has a briefing, Power Star, exit gate and secret supply cache. Reach the gate and press **E**, then choose **Next Level** on the results screen. Completing the final gate shows combined campaign statistics. Health resets between chapters; armor and ammunition carry over with a minimum supply. Dying lets you retry the current chapter with its entry inventory.

Red mushrooms restore health, shells add armor, and ammo crates refill both weapons. Avoid the glowing lava pools and channels; safe bridges and service routes lead around them.

The campaign contains 38 enemies, three difficulty levels, two weapons, optional spoken one-liners and subtitles. The 74 original quips react to kills, pickups, secrets and story events. Spoken dialogue uses an available browser voice, so delivery varies by device; subtitles work without speech support. Settings save locally; campaign progress is per run. This is a compact browser prototype. A WebGL 2 browser with hardware acceleration works best; settings include HD and performance modes.

### The hidden time machine

Press **F4** to toggle 1993 mode anywhere, including mid-fight. This renders at 200 lines, uses a constrained DOS-inspired palette, nearest-neighbor textures, mild ordered dithering, a classic status bar and eight-direction enemy sprites. Press F4 again to restore detailed 3D models, soft shadows, bump detail and bloom. Progress stays intact. The Easter egg is deliberately absent from the game menus and resets to modern rendering on a new page visit. Some laptops require Fn+F4.

## Checks

```sh
npm test
npm run build
```

Collision tests cover wall sliding, corners, tunneling prevention and line of sight. `window.gameSnapshot()` exposes a read-only gameplay snapshot for browser smoke checks.

Unofficial fan-made tribute. Mario characters belong to Nintendo; DOOM and Duke Nukem belong to their respective rights holders. Not affiliated with or endorsed by them. No original game assets or recordings are included.
