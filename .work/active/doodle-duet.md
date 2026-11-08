# Doodle Duet

## Goal
Two-player async draw-and-guess game for Jonas and his girlfriend, played on Android phones (Galaxy S Ultra with S Pen). Not for wider release.

## Acceptance
- [x] One player draws a chosen word under a time limit; the other later watches a replay and guesses under a time limit
- [x] Turns alternate: whoever guessed draws next
- [x] Scores accumulate per game and show on both devices
- [x] Works asynchronously across two phones (shared backend), with a link to invite and nudge the other player
- [ ] Usable at phone width, touch and S Pen input, installable to home screen
- [x] Live on a URL both phones can open

## Decisions
- PWA, not a native APK: matches D:\Apps\choice-timer (static files, Firebase RTDB + anonymous auth, GitHub Pages); no Android build tooling needed, S Pen works through pointer events.
- Local mode (no Firebase config): localStorage store with per-tab identity, so two tabs can play each other for testing.
- Canvas is a 2:3 sheet (1000x1500 logical units) to use tall phone screens; strokes stored as one JSON string per turn to keep RTDB node count low.
- Scores derived from turn results, never stored separately.
- Scoring (Jonas, 2026-11-08: no difficulty yet): correct guess = 1 point each, guesser +1 if correct before the replay ends. Wrong or timeout: 0. Words drawn from easy+medium lists; each choice keeps its `level` so difficulty can return later. Hard lists kept unused.
- Backend: shared choice-maker Firebase project, data under `doodleDuet/` (Jonas chose this over a new project, 2026-11-08). Console rules = `node tools/combine-rules.mjs` output; regenerate and re-paste whenever either repo's rules change.
- Hosting: public repo Jonasgg99/doodle-duet, GitHub Pages from main (approved 2026-11-08).
- One shared game, id `main`, opened by the plain URL (Jonas, 2026-11-08: no codes, it's two players). Replaced the short-code design from earlier the same day. First visitor sets it up (claimed by transaction), second joins, everyone else is locked out by the rules. Trade-off: whoever opens the site first after setup but before the partner could take seat b; accepted. Recovery from a lost seat = delete the game in the console.
- Draw time fixed at 60 s (Jonas, 2026-11-08; 45/60/90 picker removed). Guess time = draw time + 20 s, starts when the guesser taps Start and keeps running if they leave.

- Streamline + challenge set (Jonas, 2026-11-08, "Do it" on suggestions 1, 2, 4, 5): Send opens the share sheet itself (no separate Nudge step; auto-send on timeout can't open it, Nudge button stays); the last round's result is a banner on the next screen instead of its own screen; max 3 wrong guesses per round ("so close" doesn't count); points decay with guess time: 3 / 2 / 1 for a correct guess in the first / middle / last third of the guess time, same points to drawer and guesser (replaces flat 1 + speed bonus). Not chosen yet, in .work/backlog/: notifications, difficulty tiers, challenge rounds, fewer hints, team streak.
- Notifications: real web push via a Cloudflare Worker (Jonas, 2026-11-08, chose it over ntfy and Firebase Functions; no app for his girlfriend to install). Opt-in on the waiting screen; one notification type, "<name> drew something", sent when a drawing is sent (by tap or timeout), replacing the share sheet when the partner has push on. No result notifications (the banner covers that). Worker has no dependencies (own RFC 8291/8292 code, checked against the RFC vector) and only relays to real push services, for this site's origins, with links to this site.
- Word setting (Jonas, 2026-11-08): Easy / Mixed / Hard for the whole game (`wordLevel`), changeable mid-game by either player; an on-screen unpicked choice is redrawn, otherwise it applies next round. Points unchanged. Adult words added into the easy/medium/hard lists (Jonas: "not dirty as a fourth option, just include dirty words in the word lists"). Per-word difficulty with multipliers stays in .work/backlog/difficulty-tiers.md.
- Missed guesses and round messages (Jonas, 2026-11-08): the drawer's result banner and Earlier rounds show the guesser's wrong/close guesses; the guesser can write one message (120 chars) from their result banner, shown live on the drawer's banner and kept in Earlier rounds. No notification for messages.
- Review fixes (2026-11-09, Jonas: review the code, then fix): an independent review found 11 issues. Fixing: script injection through numeric fields of a hostile game link, the result banner and its message box lost when the word setting changes, banners missing after the game is deleted and set up again, notifications staying dead after a VAPID key change, turn order breaking past round 999. Not fixing now: a drawing in progress lost on reload or tab discard (and reload restarts the draw timer), offline writes that look sent, the Worker's spoofable Origin and lack of rate limit, no validation in the database rules, the game growing without bound, the setting change racing a round's end. Tests decided before the fixes: unit (totals ignore non-numeric points; a result counts as new after a game restart; turns order by round past t999), e2e (a hostile game runs no script; the guesser's banner and half-typed message survive the partner changing the setting; a subscription made with an old key is replaced on load).

## Dead ends

## Next
- Push: Worker live at https://doodle-duet-push.jonaseg.workers.dev (Cloudflare account jonaseg, secret set 2026-11-08). Deployed to Pages 2026-11-08. Left: real-phone check: her phone taps Notify on the waiting screen, Jonas sends a drawing.
- Then wait for Jonas's verdict from real-phone play; fix what he reports. Then finish: move lasting notes to AGENTS.md and delete this file.
- Real game `main` exists live: Jonas is player a and has drawn turn 0; seat b waits for his girlfriend. Tests must never use the plain URL in Firebase mode.

## Needs user
- Play a round on the two real phones: S Pen drawing, Install app from the browser menu, share sheet for invite/nudge. Report anything off.

## Verified
- unit tests (9) and two-player e2e in local mode (two rounds: correct guess, draw auto-send on timeout, guess timeout; no console errors; no side scroll at 412 px; dark theme) passed @first commit +dirty. Firebase backend and real-phone S Pen input not yet exercised.
- firebase e2e against https://jonasgg99.github.io/doodle-duet/ (two anonymous identities play a round live; third device refused read and seat write) passed @9d9e75a after Jonas published combined rules. choice-timer itself not re-tested (its rules were pasted unchanged).
- unit (10), local two-player e2e (incl. joining by typed code) and live firebase e2e on Pages (short code claimed by transaction, reload resume, stranger locked out) passed @5f87409. First live run right after deploy failed at word choice; passed on rerun once all files were served fresh (likely a stale-cache mix, not confirmed).
- single shared game: unit (10), local two-player e2e (both open the plain site; third tab locked out; reopen lands in game) and live firebase e2e on localhost (throwaway id) passed @c83b4d0+dirty. One live run timed out at the partner's reload and passed on rerun (network was flaky: an earlier push and page load also timed out).
- Stuck on Loading after deploy reproduced (new index.html + previous app.js -> TypeError in setupHome); self-heal added; stale-deploy e2e, unit, local and live tests passed @e3527b6+dirty.
- Streamline + challenge set: unit (11), local three-round e2e (share sheet on Send but not on auto-send, banners, 3-wrong-guess loss, time-out loss, 3/2/1 points), stale-deploy and live firebase e2e on localhost passed @8430967+dirty.
- Web push (not deployed): unit (18, incl. RFC 8291 vector byte-exact, VAPID JWT verifies, Worker refuses foreign origin/endpoint/link), push e2e (opt-in stores subscription, notify replaces share sheet, 410 removes it, service worker shows a CDP-delivered push), two-player and stale-deploy e2e passed @25dd8af+dirty.
- Live Worker: rejects missing/foreign Origin (403), preflight allows the Pages origin, a send to a made-up FCM token ran fully and FCM answered 410 (gone) @edc300e+dirty. A real FCM subscription could not be made headless (Chromium and Chrome both refuse registration), so FCM accepting our VAPID signature is unverified until the phone test. Unit (18), push, two-player and stale-deploy e2e passed with the real push-config @edc300e+dirty.
- Pages serves push build (push-config with Worker URL, sw.js 200); live firebase e2e passed against https://jonasgg99.github.io/doodle-duet/ @4485ce2.
- Word setting + adult words: unit (20, incl. setting picks only allowed lists, no duplicate or malformed words), two-player e2e (Ida switches to Hard on her choice screen: choices redrawn hard, Jonas sees it live, next round hard), push and stale-deploy e2e passed @3813a72+dirty.
- Pages serves the word-setting build; live firebase e2e passed against https://jonasgg99.github.io/doodle-duet/ @418ff4d. Changing the setting live in Firebase mode not exercised (rules allow players to write anything under their game).
- Missed guesses + round messages: unit (21), two-player e2e (Jonas sees Ida's missed guess, her message reaches his banner live and his history; Ida sees Jonas's 3 missed guesses), push and stale-deploy e2e passed @e186a84+dirty.
- Pages serves the missed-guesses/messages build; live firebase e2e passed against https://jonasgg99.github.io/doodle-duet/ @023268b. Sending a message through live Firebase not exercised.
- Review fixes: unit (24, incl. totals ignore bad points, result new after restart, turn order past t999), two-player e2e (banner, half-typed message and focus survive the partner switching to Hard; a hostile #evil game with markup in numeric fields runs no script, which failed before the fix), push e2e (old-key subscription replaced on reload, failed before the fix) and stale-deploy e2e passed @d6e4806+dirty. Not deployed; re-subscribing without a tap after a key change is unverified on a real phone.
