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
- Scoring: correct guess gives drawer and guesser the word's difficulty points (easy 1, medium 2, hard 3); guesser +1 if correct before the replay ends. Wrong or timeout: 0.
- Backend: shared choice-maker Firebase project, data under `doodleDuet/` (Jonas chose this over a new project, 2026-11-08). Console rules = `node tools/combine-rules.mjs` output; regenerate and re-paste whenever either repo's rules change.
- Hosting: public repo Jonasgg99/doodle-duet, GitHub Pages from main (approved 2026-11-08).
- Draw time chosen per game (45/60/90 s, default 60). Guess time = draw time + 20 s, starts when the guesser taps Start and keeps running if they leave.

## Dead ends

## Next
- Wait for Jonas's verdict from real-phone play; fix what he reports. Then finish: move lasting notes to AGENTS.md and delete this file.

## Needs user
- Play a round on the two real phones: S Pen drawing, Install app from the browser menu, share sheet for invite/nudge. Report anything off.

## Verified
- unit tests (9) and two-player e2e in local mode (two rounds: correct guess, draw auto-send on timeout, guess timeout; no console errors; no side scroll at 412 px; dark theme) passed @first commit +dirty. Firebase backend and real-phone S Pen input not yet exercised.
- firebase e2e against https://jonasgg99.github.io/doodle-duet/ (two anonymous identities play a round live; third device refused read and seat write) passed @9d9e75a after Jonas published combined rules. choice-timer itself not re-tested (its rules were pasted unchanged).
