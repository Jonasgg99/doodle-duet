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

## Dead ends

## Next
- Build the streamline + challenge set (Decisions), tests first; deploy and verify live.
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
