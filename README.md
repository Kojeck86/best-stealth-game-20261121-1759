# Ember Archive — a firefly stealth heist

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Kojeck86/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Kojeck86/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

You are **Luma**, a little firefly thief, sneaking through the midnight Ember Archive. Pocket the three keycards — Sun, Moon and Star — then slip out through the moonlit EXIT without a warden catching you.

## How to play

- **Objective:** collect all 3 keycards, then reach the green EXIT zone.
- **Wardens** patrol the hall with golden vision cones. Step into a cone with a clear line of sight and their alert meter climbs; at full alert they give chase. If a warden touches you, the heist is over.
- **Bushes** hide you — a warden cannot see you crouched in one unless it is right next to you.
- **Crates** block a warden's sight as well as your path. Use them as cover.
- **Sneaking** (hold Shift) makes you slower but much harder to spot.
- The HUD shows keycards collected, the run timer, the hottest alert meter, your visibility (UNSEEN / SNEAKING / SEEN / HUNTED) and how many times you have been spotted.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Click a spot | Walk there (click-to-move) |
| Shift (hold) | Sneak — slower, harder to spot |
| R | Restart the run |
| M | Toggle sound |
| Enter / click | Start, or play again after a win or a loss |

## Screenshots

The `screenshots/` folder holds four real renders of the game running in a browser: the start screen, a mid-game patrol with a warden's vision cone, a near-detection alert moment, and the win screen.

## Play it locally

No build step, no network, no libraries — just static files.

```sh
# from this repo root
python3 -m http.server 8123 --directory game
# then open http://localhost:8123/ in a desktop browser
```

Or simply open `game/index.html` directly in a browser (a local server is recommended so the ES modules load without file-URL quirks).

## Tech notes

- Top-down stealth game drawn on a single `<canvas>`; all art is drawn in code and all sounds are WebAudio beeps generated in code.
- Source lives in `game/src/`: `main.js` (loop, input, screens, HUD), `level.js` (map, collision, line of sight), `guards.js` (warden patrol / vision / chase AI), `audio.js` (synthesized sounds).
- `main.ts` is the make.fun bundle entry point: it copies `game/` and `screenshots/` into the output directory and writes `dossier.json` via the vendored helper in `vendor/`.

## License

MIT — see [LICENSE](LICENSE).
