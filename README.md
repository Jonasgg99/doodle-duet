# Doodle Duet

A two-player drawing game you play at your own pace. One of you picks a word and draws it against the clock; the other opens the game whenever they like, watches the drawing being replayed stroke by stroke, and guesses. Then you swap.

## Rules
- The drawer picks one of three words and has 60 seconds to draw it. The drawing is sent automatically when time runs out.
- The guesser taps Start and gets 80 seconds. The clock keeps running if they leave the app.
- A correct guess gives both players 1 point. The guesser gets +1 for guessing before the replay finishes.
- Whoever guessed draws next.

## Playing on Android
Open the game link in Chrome (or Samsung Internet) and use **Add to home screen / Install app** from the browser menu. It then runs full screen like an app. Works with the S Pen; once the pen has touched the canvas, finger and palm touches are ignored for that drawing.

To start: enter your name, pick a language, tap **Start a game**, draw, then **Send invite link**. Each game has a 6-character code, and the link is just `jonasgg99.github.io/doodle-duet/#<code>`. Your partner can open that link or type the code under "Got a game code?" on the home screen. After each turn, use the Nudge button to send them a message.

Each phone is identified by the browser's anonymous sign-in. Clearing the browser's site data for the game loses your seat in existing games.

## Running locally
```bash
python -m http.server 8124
```
Open `http://localhost:8124/?local`. In local mode each browser tab is a separate player, so two tabs can play each other.
