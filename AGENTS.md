# Doodle Duet

Two-player, asynchronous draw-and-guess game for Jonas and his girlfriend on Android phones. Private, not for wider release. Installable PWA.

## Architecture
- Static site: plain HTML/CSS/JS ES modules, no build step, no npm. Same pattern as `D:\Apps\choice-timer`.
- `game.js`: pure rules (guess matching, scoring, word picks, replay timing). Covered by `tests/game.test.mjs`.
- `store.js`: storage with two backends behind one interface. Firebase Realtime Database + anonymous auth when `firebase-config.js` has a config; otherwise local mode (localStorage, one identity per browser tab). `?local` in the URL forces local mode.
- `app.js`: UI, drawing canvas, replay. The plain site opens the one shared game, id `main`; `#<id>` opens another game (older links, tests).
- `words.js`: English and Norwegian word lists by difficulty.
- `FIREBASE-RULES.json`: the only access control. Data lives under `doodleDuet/games/<id>`. Editing the file does nothing until it is pasted into the Firebase console (Realtime Database > Rules > Publish).
- `firebase-config.js` is public by design (Firebase web config), not a secret.

## Data model
`games/<id>` (`main` for the real game; older ids still open via `#<id>` or `#g=<id>`): `lang`, `drawSecs` (always 60 for new games), `players.{a,b}.{uid,name}`, `cur` (current turn key), `turns.t000…`. A turn has `drawer`, `status` (`draw` → `guess` → `done`), `choices` (`{word, level}`), `word`, `level` (word list it came from; older turns have `difficulty` instead), `strokes` (JSON string of `{c,w,p:[x,y,t,…]}` on a 1000×1500 grid), `guessStartedAt`, `guesses` (`{g, t, r}`, r = correct/close/wrong), `result` (`{correct, ms, drawerPts, guesserPts}`; older rounds also have `beforeReplayEnd`). Scores are derived from turn results, never stored. Difficulty is not used in play yet: words come from the easy and medium lists, scoring is flat; the hard lists stay in `words.js` for later.

## Testing
- Unit: `node --test "tests/*.test.mjs"`
- Two-player end to end (local mode, headless, two simulated phones): start `python -m http.server 8124`, then `node tests/two-player.e2e.mjs [screenshot-dir]`. Uses Playwright from `D:\Apps\quiz-maker` (override with `PLAYWRIGHT=<path to index.mjs>`); this repo installs nothing.
- In Firebase mode two tabs in one browser share one identity; use local mode or two browser profiles to play yourself.
- After a deploy, phones can briefly mix old and new files (GitHub Pages caches each for 10 min); an inline script in `index.html` re-downloads everything and reloads once if `app.js` hasn't set `window.__ddStarted`. Covered by `node tests/stale-deploy.e2e.mjs` (needs the :8124 server). Keep the file list in that script in sync when adding files.
- Live test: `node tests/firebase.e2e.mjs [base-url]` plays in a throwaway `#test…` game. Never point a test at the plain URL in Firebase mode: that would take the real game's seats.
- If a player loses their seat (cleared site data, new phone), delete `doodleDuet/games/main` in the Firebase console and set up again; scores are lost.
