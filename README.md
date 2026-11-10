# Doodle Duet

A drawing game for two that you play at your own pace, with as many games going as you like. One of you picks a word and draws it against the clock; the other opens the game whenever they like, watches the drawing being replayed stroke by stroke, and guesses. Then you swap.

## Rules
- The drawer picks one of three words and has 60 seconds to draw it. The drawing is sent automatically when time runs out.
- The guesser taps Start and gets 80 seconds and 3 wrong guesses. The clock keeps running if they leave the app. A "so close" guess (one letter off) doesn't count as wrong.
- A correct guess is worth 3 points in the first third of the guess time, 2 in the middle and 1 at the end, the same for both players. So a quick, clear drawing pays off too.
- Whoever guessed draws next.
- After a round the result shows on top of the next screen, with the guesses that missed. The guesser can send the drawer a short message from there; it also stays under Earlier rounds.
- **Words** under the game sets how hard the words are: Easy, Mixed (the default) or Hard. Either of you can change it any time; it applies to the next word choice. The lists include some adult words: **Adult words** (when starting a game, and under the game) includes them or leaves them out.

## Playing on Android
Open the game link in Chrome (or Samsung Internet) and use **Add to home screen / Install app** from the browser menu. It then runs full screen like an app. Works with the S Pen; once the pen has touched the canvas, finger and palm touches are ignored for that drawing.

The site is **jonasgg99.github.io/doodle-duet**. The first time, you make your player: type the name others see and sign in with Google, so your games follow you to any phone or browser where you sign in with the same account. The game keeps only your name.

The site opens on **Your games**, with the games where it's your move first. **New game** picks the language and words, then either someone from the list of players (the game shows up in their list straight away) or **Invite someone with a link** for a person who hasn't made a player yet: whoever opens the link and taps **Join game** gets the seat. You always draw first. Tapping Send after drawing opens your phone's share sheet so you can tell the other player; if the timer sent the drawing for you, use the Nudge button.

To skip that: on the waiting screen, tap **Notify me when it's my turn** and allow notifications. From then on the other player's Send gives you a phone notification instead, with no app to install. Opening your games list keeps this phone's notifications on in all your games. Notifications go through a small Cloudflare Worker and your browser's push service (Google's, for Chrome on Android); the message is encrypted for your phone on the way.

Google won't sign in inside Messenger's or another app's built-in browser: open the link in Chrome. If someone played from a browser before signing in and now can't get into a game, the player who started it taps **Let … join again** at the bottom of the game; they then open it where they are signed in and tap **Join game**. Scores and the current round are kept.

## Running locally
```bash
python -m http.server 8124
```
Open `http://localhost:8124/?local`. In local mode each browser tab is a separate player, so two tabs can play each other.
