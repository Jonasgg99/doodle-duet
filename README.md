# Doodle Duet

A two-player drawing game you play at your own pace. One of you picks a word and draws it against the clock; the other opens the game whenever they like, watches the drawing being replayed stroke by stroke, and guesses. Then you swap.

## Rules
- The drawer picks one of three words and has 60 seconds to draw it. The drawing is sent automatically when time runs out.
- The guesser taps Start and gets 80 seconds and 3 wrong guesses. The clock keeps running if they leave the app. A "so close" guess (one letter off) doesn't count as wrong.
- A correct guess is worth 3 points in the first third of the guess time, 2 in the middle and 1 at the end, the same for both players. So a quick, clear drawing pays off too.
- Whoever guessed draws next.
- **Words** under the game sets how hard the words are: Easy, Mixed (the default) or Hard. Either of you can change it any time; it applies to the next word choice. The lists include some adult words.

## Playing on Android
Open the game link in Chrome (or Samsung Internet) and use **Add to home screen / Install app** from the browser menu. It then runs full screen like an app. Works with the S Pen; once the pen has touched the canvas, finger and palm touches are ignored for that drawing.

The site is one shared game for the two of you: **jonasgg99.github.io/doodle-duet**. The first person to open it enters a name, picks a language, taps **Start** and draws. The second person opens the same address and taps **Join game**. After that nobody else can get in. Tapping Send after drawing opens your phone's share sheet so you can tell your partner straight away; if the timer sent the drawing for you, use the Nudge button.

To skip that: on the waiting screen, tap **Notify me when it's my turn** and allow notifications. From then on your partner's Send gives you a phone notification instead, with no app to install. Notifications go through a small Cloudflare Worker and your browser's push service (Google's, for Chrome on Android); the message is encrypted for your phone on the way.

Each phone is identified by the browser's anonymous sign-in. Clearing the browser's site data for the game loses your seat in existing games.

## Running locally
```bash
python -m http.server 8124
```
Open `http://localhost:8124/?local`. In local mode each browser tab is a separate player, so two tabs can play each other.
