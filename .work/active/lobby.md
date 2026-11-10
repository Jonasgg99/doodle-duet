# Players and games list

## Goal
Players with their own sign-in, several games at once, a home page listing your games, and starting a game with another player. Design approved by Jonas 2026-11-10 ("Looks good"): https://claude.ai/artifact/VtJDChyS46QQVF6KBEvQxF

## Acceptance
- [ ] A first-time visitor makes a player (name + Google sign-in) and lands on an empty games list
- [ ] The plain site shows your games, your turn first, each with opponent, round, score and draw / guess / waiting; live
- [ ] New game: language and words, then pick a player from the list (the game appears in their list without a link) or send an invite link
- [ ] One player runs games with different people at once without them touching each other
- [ ] The existing `main` game appears in both players' lists with every round and score
- [ ] Rules: only you read your games list or change your name; a game can be added to someone's list only by the player who started it with them in seat b; a game can start with seat b filled only for a listed player; seat b claim and invite links work as today
- [ ] Google sign-in works on the real phones in Chrome and from the installed app, keeping the same player id (linked to the anonymous player)

## Decisions
- Player = Google sign-in, linked to the existing anonymous player so its uid and seats stay (recommended in the design; Jonas approved the design as a whole, "Looks good", without picking explicitly). Pop-up, not redirect: redirect sign-in breaks in current browsers when the site and Firebase's auth domain differ, and GitHub Pages can't host the auth handler.
- Starting a game: a list of all players to pick from (Jonas: "Just a list for now, won't be too many players") plus an invite link for someone not in it. The list (`players/<uid>/name`) is readable by anyone signed in; accepted.
- Adult words stay in every game (Jonas).
- The `main` game is kept as one game in the list (Jonas).
- Data: `players/<uid>/name` (list), `users/<uid>/games/<gameId>` (your list, private), games unchanged. Push stays per game; the home page writes this phone's subscription into each of your games lacking it. A brand-new game's first notification reaches the partner only if they opened the app since; else Send opens the share sheet.
- Home page reads only players, `cur` and the current turn's drawer/status per game, never drawings.
- Review (fresh agent, 2026-11-10) fixes: a non-text player name in a game crashed the list (names now coerced to text, and the rules require text names in games); the list sent this phone's notification address into any game in your list, and anyone can put a game there, so it now does that only for people you've opened a game with on this phone (`dd_partners`); deleted games leave the list; "No games yet" waits for games to load; no double game on a double tap; clearer sign-in errors (in-app browsers, name not saved). Accepted, not fixed: seat a can still set seat b to anyone in two steps (spam only, same as the open list); any seated player can still rewrite the whole game, including the other seat (as before); no limit on games added to your list; the Worker relays any text with a forgeable Origin (backlog); signing in with a Google account that already has a player leaves this browser's anonymous seats behind.

## Dead ends

## Next
1. Deployed with Jonas's OK (rules published 2026-11-10, then push). `signin-test.html` removed in the deploy commit.
2. Jonas and Ida open the site, make their players with Google (Jonas's Chrome is already linked; same uid as before), and check the game with Ida shows up in both lists with its scores. If a `main` seat lived in a browser that can't sign in (Messenger), seat b moves with "Let … join again"; seat a needs the console.
3. Installed-app sign-in on Android still unreported.
4. Then finish: lasting notes are already in AGENTS.md/README; delete this file.

## Needs user
- Steps 2 and 3 of Next on the real phones.

## Verified
- Local: unit (29), lobby e2e (first visit, list live, invite link, pick a player, two games at once, `main` in the list with scores), two-player, push (incl. list sync for partners only, not for a stranger's game) and stale-deploy e2e passed @a671be2+dirty. Live rules published by Jonas; firebase e2e on localhost against them (incl. all stranger refusals, odd names refused, test players cleaned up) passed @07e67b7+dirty.
- Live `signin-test.html` on Pages: the pop-up reaches accounts.google.com (provider on, domain authorized), headless, no sign-in completed @b683227. Phone test pending.
- Jonas's phone, Chrome (2026-11-10 21:02): linkWithPopup signed in as his Google account and kept the same player id. Installed-app run not reported yet.
