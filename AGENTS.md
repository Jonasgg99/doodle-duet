# Doodle Duet

Two-player, asynchronous draw-and-guess game for Jonas and his girlfriend on Android phones. Private, not for wider release. Installable PWA.

## Architecture
- Static site: plain HTML/CSS/JS ES modules, no build step, no npm. Same pattern as `D:\Apps\choice-timer`.
- `game.js`: pure rules (guess matching, scoring, word picks, replay timing). Covered by `tests/game.test.mjs`.
- `store.js`: storage with two backends behind one interface. Firebase Realtime Database + anonymous auth when `firebase-config.js` has a config; otherwise local mode (localStorage, one identity per browser tab). `?local` in the URL forces local mode.
- `app.js`: UI, drawing canvas, replay. The plain site opens the one shared game, id `main`; `#<id>` opens another game (older links, tests).
- `words.js`: English and Norwegian word lists by difficulty, with adult words mixed in (the `ADULT` block; delete it for a clean game).
- `FIREBASE-RULES.json`: the only access control. Data lives under `doodleDuet/games/<id>`. Editing the file does nothing until it is pasted into the Firebase console (Realtime Database > Rules > Publish).
- `firebase-config.js` is public by design (Firebase web config), not a secret.
- Notifications (web push): `push.js` subscribes the phone (from the waiting screen) and asks the Worker to notify the partner when a drawing is sent; `sw.js` only shows notifications (no fetch handler, no caching). `worker/` is a Cloudflare Worker (`doodle-duet-push`) that encrypts (RFC 8291) and VAPID-signs (RFC 8292) the push, with no dependencies; it accepts only this site's origins, real push-service endpoints and links to this site. `push-config.js` holds the Worker URL and VAPID public key (public); empty values turn notifications off. The VAPID private key lives only in the Worker secret `VAPID_PRIVATE_JWK`; `tools/vapid-keys.mjs` makes a new pair (see its header) and every phone must then opt in again.

## Data model
`games/<id>` (`main` for the real game; older ids still open via `#<id>` or `#g=<id>`): `lang`, `drawSecs` (always 60 for new games), `wordLevel` (`easy` / `mixed` / `hard`, absent = mixed; either player changes it any time, an unpicked word choice is redrawn), `players.{a,b}.{uid,name}`, `push.{a,b}` (that phone's push subscription `{endpoint, keys}`, removed when the push service says it's gone), `cur` (current turn key), `turns.t000…`. A turn has `drawer`, `status` (`draw` → `guess` → `done`), `choices` (`{word, level}`), `word`, `level` (word list it came from; older turns have `difficulty` instead), `strokes` (JSON string of `{c,w,p:[x,y,t,…]}` on a 1000×1500 grid), `guessStartedAt`, `guesses` (`{g, t, r}`, r = correct/close/wrong), `result` (`{correct, ms, drawerPts, guesserPts}`; older rounds also have `beforeReplayEnd`), `note` (`{text, at}`, the guesser's message to the drawer, max 120 chars, written from the result banner). Scores are derived from turn results, never stored. Word level picks the lists (easy; easy + medium; hard) but not the points: scoring is the same for every word.

## Testing
- Unit: `node --test "tests/*.test.mjs"`
- Two-player end to end (local mode, headless, two simulated phones): start `python -m http.server 8124`, then `node tests/two-player.e2e.mjs [screenshot-dir]`. Uses Playwright from `D:\Apps\quiz-maker` (override with `PLAYWRIGHT=<path to index.mjs>`); this repo installs nothing.
- Notifications: unit tests check the Worker's encryption against the RFC 8291 test vector; `node tests/push.e2e.mjs` (needs the :8124 server) covers opt-in, notify-instead-of-share-sheet, dead subscriptions and the service worker showing a push. It runs Playwright's full Chromium (`channel: "chromium"`), because the default headless shell always denies notifications.
- In Firebase mode two tabs in one browser share one identity; use local mode or two browser profiles to play yourself.
- After a deploy, phones can briefly mix old and new files (GitHub Pages caches each for 10 min); an inline script in `index.html` re-downloads everything and reloads once if `app.js` hasn't set `window.__ddStarted`. Covered by `node tests/stale-deploy.e2e.mjs` (needs the :8124 server). Keep the file list in that script in sync when adding files.
- Live test: `node tests/firebase.e2e.mjs [base-url]` plays in a throwaway `#test…` game. Never point a test at the plain URL in Firebase mode: that would take the real game's seats.
- If a player loses their seat (cleared site data, new phone), delete `doodleDuet/games/main` in the Firebase console and set up again; scores are lost.
