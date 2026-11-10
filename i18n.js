// The app's own text in English and Norwegian (Bokmål). Pure: tested by tests/i18n.test.mjs.
// A text is a string with {placeholders}, or a function of the values where the wording depends
// on a count. Keys ending in Html are inserted as HTML: their values must be numbers.

const letterCounts = (word) => String(word ?? "").split(" ").map((w) => [...w].length);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

const en = {
  // page (index.html)
  loading: "Loading…",
  backToGames: "‹ Games",
  localMode: "local test mode",
  setupTitle: "Make your player",
  setupIntro: "One of you draws a word, the other watches it being drawn and guesses, then you swap. Play as many games as you like, with anyone who has a player.",
  yourName: "Your name",
  namePlaceholder: "The name other players see",
  googleNote: "Signing in keeps your games when you switch phone or browser: sign in with the same Google account there. Doodle Duet keeps only the name you type here.",
  yourGames: "Your games",
  listEmpty: "No games yet. Start one, then pick someone to play with or send them a link.",
  newGame: "New game",
  wordLanguage: "Language",
  words: "Words",
  adultWords: "Adult words",
  playWith: "Play with",
  peopleEmpty: "Nobody else has made a player yet.",
  inviteWithLink: "Invite someone with a link",
  newGameNote: "You draw first. The game shows up in their list straight away; someone who isn't in the list joins by opening the link you send.",
  invitedTitle: "You're invited",
  joinGame: "Join game",
  wordDifficulty: "Word difficulty",
  earlierRounds: "Earlier rounds",
  appLanguage: "App language",

  // first visit
  continueWithGoogle: "Continue with Google",
  continue: "Continue",
  nameNeeded: "Type the name other players will see.",
  inAppBrowser: "If you opened this from Messenger or another app, Google won't sign in there: open it in Chrome instead (⋮ → Open in Chrome).",
  saveNameFailed: "Couldn't save your name. Check your connection and try again.",
  signInCancelled: "Sign-in was cancelled. Tap the button to try again.",
  signInFailed: "Couldn't sign in.",
  connectFailed: "Couldn't connect to the game server. Check your connection and reload.",

  // games list and new game
  playingAs: "Playing as {name}",
  inviteSent: "Invite sent",
  round: "Round {n}",
  st_draw: "Your turn to draw",
  st_waitDraw: "Waiting for {name} to draw",
  st_waitGuess: "Waiting for {name} to guess",
  st_guess: "Your turn to guess",
  st_waitJoin: "Waiting for someone to join",
  loadGamesFailed: "Couldn't load your games. Check your connection and reload.",
  startGameFailed: "Couldn't start the game. Check your connection and try again.",
  level_easy: "Easy",
  level_mixed: "Mixed",
  level_hard: "Hard",
  adult_on: "Include",
  adult_off: "Leave out",

  // opening and joining a game
  player: "Player",
  player1: "Player 1",
  player2: "Player 2",
  seatTaken:
    "This game is already being played by two other players, so it can't be opened here. If you're one of them on another phone or browser, sign in with the same Google account you use there, or ask your partner to tap \"Let … join again\" at the bottom of the game, then reload this page.",
  joinTitle: "{name} invited you to Doodle Duet",
  joinSub: "One of you draws, the other guesses, then you swap. {secs} seconds to draw each word.",
  joinTaken: "Someone else already joined this game.",
  gameMissing: "This game doesn't exist. Tap ‹ Games to see yours or start a new one.",
  twoOthers: "This game already has two players on other devices. If you're {b} on a new phone or browser, ask {a} to tap \"Let {b} join again\" at the bottom of the game, then reload this page.",

  // result banner, scoreboard, history
  theyGotIt: "{name} got it!",
  youGotIt: "You got it!",
  theyMissed: "{name} didn't get it",
  youMissed: "Not this time",
  plusPoints: ({ n }) => `+${n} point${n === 1 ? "" : "s"}`,
  wonIn: "\"{word}\" in {s} s",
  inARowSuffix: "{n} in a row",
  missSub: "It was \"{word}\". No points this round.",
  theyGuessed: "{name} guessed",
  youGuessed: "You guessed",
  messageTo: "Message to {name}",
  send: "Send",
  noteFailed: "Couldn't send your message. Check your connection.",
  you: "You",
  youTag: "you",
  points: "points",
  inARow: "in a row",
  youDrew: "You drew",
  theyDrew: "{name} drew",
  guessedIn: "guessed in {s} s",
  notGuessed: "not guessed",
  missed: "Missed",

  // settings in a game
  wordsFailed: "Couldn't change the words. Check your connection.",
  reseatButton: "Let {name} join again from a new phone or browser",
  reseatConfirm: "Let {name} join again from another phone or browser?\n\nThe one {name} plays on now loses the game. Scores are kept. {name} then opens the game there and taps Join game.",
  reseatDone: "Send {name} the link to join again.",
  failed: "Couldn't do that. Check your connection.",

  // choosing, drawing, guessing
  pickWord: "Pick a word to draw",
  timerStarts: "The {secs}-second timer starts as soon as you pick.",
  pickFailed: "Couldn't save your pick. Check your connection.",
  draw: "Draw",
  eraser: "Eraser",
  colour: "Colour {n}",
  brushSize: "Brush size {n}",
  undo: "Undo",
  clear: "Clear",
  sure: "Sure?",
  timeUpSent: "Time's up, drawing sent.",
  timeUpNudge: "Time's up, drawing sent. Tap Nudge to tell your partner.",
  sendFailed: "Couldn't send. Check your connection and tap Send again.",
  drewSomething: "{name} drew something",
  readyInfoHtml: "You'll watch it being drawn and can guess any time. You have <strong>{secs} seconds</strong> once you start, and it keeps counting if you leave.",
  readyRules: "You get {max} wrong guesses. A quick guess is worth more: 3, 2 or 1 point, the same for both of you.",
  start: "Start",
  startFailed: "Couldn't start. Check your connection.",
  typeGuess: "Type a guess",
  guess: "Guess",
  guessesLeft: ({ n }) => `${n} wrong guess${n === 1 ? "" : "es"} left`,
  soClose: "so close!",
  saveFailed: "Couldn't save. Check your connection.",
  worthNow: "Worth {n} now",
  letters: ({ word }) => {
    const c = letterCounts(word);
    return `${c.join(" + ")} letter${sum(c) === 1 ? "" : "s"}`;
  },

  // waiting
  sentHead: "Drawing sent!",
  sentSub: "Now send your partner the link. They join, guess your drawing, then draw one for you.",
  waitGuessSub: "Give them a nudge so they know your drawing is ready.",
  waitDrawSub: "You'll get to guess as soon as they send it. Check back later.",
  guessingNow: "{name} is guessing right now…",
  guessTimeUp: "Their guess time ran out. They'll see the answer next time they open the game.",
  sendInvite: "Send invite link",
  nudge: "Nudge {name}",

  // notifications and sharing
  pushOn: "You'll get a notification when it's your turn.",
  pushBlocked: "Notifications are blocked for this site. Allow them in the browser's site settings to get one when it's your turn.",
  pushButton: "Notify me when it's my turn",
  pushNotAllowed: "Notifications weren't allowed.",
  pushFailed: "Couldn't turn on notifications on this phone.",
  notifyBody: "Your turn to guess in Doodle Duet.",
  notified: "{name} gets a notification.",
  notifyFailed: "Couldn't notify {name}. Tap Nudge to tell them.",
  shareJoin: "Play Doodle Duet with me! I've drawn the first one, your turn to guess.",
  shareGuess: "My drawing is ready for you to guess in Doodle Duet.",
  shareDraw: "Your turn to draw in Doodle Duet!",
  linkCopied: "Link copied. Paste it in a message.",
};

const no = {
  loading: "Laster…",
  backToGames: "‹ Spill",
  localMode: "lokal testmodus",
  setupTitle: "Lag spilleren din",
  setupIntro: "Den ene tegner et ord, den andre ser det bli til og gjetter, så bytter dere. Ha så mange spill gående du vil, med alle som har en spiller.",
  yourName: "Navnet ditt",
  namePlaceholder: "Navnet andre spillere ser",
  googleNote: "Når du logger inn, beholder du spillene dine selv om du bytter telefon eller nettleser: logg inn med samme Google-konto der. Doodle Duet lagrer bare navnet du skriver her.",
  yourGames: "Spillene dine",
  listEmpty: "Ingen spill ennå. Start et, og velg noen å spille med eller send dem en lenke.",
  newGame: "Nytt spill",
  wordLanguage: "Språk på ordene",
  words: "Ord",
  adultWords: "Voksenord",
  playWith: "Spill med",
  peopleEmpty: "Ingen andre har laget en spiller ennå.",
  inviteWithLink: "Inviter noen med en lenke",
  newGameNote: "Du tegner først. Spillet dukker opp med en gang i lista til den du velger; noen som ikke står i lista, blir med ved å åpne lenken du sender.",
  invitedTitle: "Du er invitert",
  joinGame: "Bli med",
  wordDifficulty: "Vanskelighetsgrad",
  earlierRounds: "Tidligere runder",
  appLanguage: "Språk i appen",

  continueWithGoogle: "Fortsett med Google",
  continue: "Fortsett",
  nameNeeded: "Skriv navnet andre spillere skal se.",
  inAppBrowser: "Har du åpnet dette fra Messenger eller en annen app, kan du ikke logge inn med Google der: åpne det i Chrome i stedet (⋮ → Åpne i Chrome).",
  saveNameFailed: "Fikk ikke lagret navnet ditt. Sjekk nettet og prøv igjen.",
  signInCancelled: "Innloggingen ble avbrutt. Trykk på knappen for å prøve igjen.",
  signInFailed: "Fikk ikke logget inn.",
  connectFailed: "Fikk ikke kontakt med spillserveren. Sjekk nettet og last inn siden på nytt.",

  playingAs: "Du spiller som {name}",
  inviteSent: "Invitasjon sendt",
  round: "Runde {n}",
  st_draw: "Din tur til å tegne",
  st_waitDraw: "Venter på at {name} skal tegne",
  st_waitGuess: "Venter på at {name} skal gjette",
  st_guess: "Din tur til å gjette",
  st_waitJoin: "Venter på at noen blir med",
  loadGamesFailed: "Fikk ikke hentet spillene dine. Sjekk nettet og last inn siden på nytt.",
  startGameFailed: "Fikk ikke startet spillet. Sjekk nettet og prøv igjen.",
  level_easy: "Lett",
  level_mixed: "Blandet",
  level_hard: "Vanskelig",
  adult_on: "Med",
  adult_off: "Uten",

  player: "Spiller",
  player1: "Spiller 1",
  player2: "Spiller 2",
  seatTaken:
    "Dette spillet spilles allerede av to andre, så det kan ikke åpnes her. Er du en av dem på en annen telefon eller nettleser, logg inn med samme Google-konto som du bruker der, eller be partneren din trykke «La … bli med igjen» nederst i spillet. Last så inn denne siden på nytt.",
  joinTitle: "{name} har invitert deg til Doodle Duet",
  joinSub: "Den ene tegner, den andre gjetter, så bytter dere. {secs} sekunder på å tegne hvert ord.",
  joinTaken: "Noen andre har allerede blitt med i dette spillet.",
  gameMissing: "Dette spillet finnes ikke. Trykk «‹ Spill» for å se dine eller starte et nytt.",
  twoOthers: "Dette spillet har allerede to spillere på andre enheter. Er du {b} på en ny telefon eller nettleser, be {a} trykke «La {b} bli med igjen» nederst i spillet. Last så inn denne siden på nytt.",

  theyGotIt: "{name} klarte det!",
  youGotIt: "Du klarte det!",
  theyMissed: "{name} klarte det ikke",
  youMissed: "Ikke denne gangen",
  plusPoints: ({ n }) => `+${n} poeng`,
  wonIn: "«{word}» på {s} s",
  inARowSuffix: "{n} på rad",
  missSub: "Det var «{word}». Ingen poeng denne runden.",
  theyGuessed: "{name} gjettet",
  youGuessed: "Du gjettet",
  messageTo: "Melding til {name}",
  send: "Send",
  noteFailed: "Fikk ikke sendt meldingen. Sjekk nettet.",
  you: "Du",
  youTag: "du",
  points: "poeng",
  inARow: "på rad",
  youDrew: "Du tegnet",
  theyDrew: "{name} tegnet",
  guessedIn: "gjettet på {s} s",
  notGuessed: "ikke gjettet",
  missed: "Bommet",

  wordsFailed: "Fikk ikke endret ordene. Sjekk nettet.",
  reseatButton: "La {name} bli med igjen fra en ny telefon eller nettleser",
  reseatConfirm: "La {name} bli med igjen fra en annen telefon eller nettleser?\n\nDen {name} spiller på nå, mister spillet. Poengene beholdes. {name} åpner så spillet der og trykker «Bli med».",
  reseatDone: "Send {name} lenken for å bli med igjen.",
  failed: "Det gikk ikke. Sjekk nettet.",

  pickWord: "Velg et ord å tegne",
  timerStarts: "Klokka på {secs} sekunder starter med en gang du velger.",
  pickFailed: "Fikk ikke lagret valget. Sjekk nettet.",
  draw: "Tegn",
  eraser: "Viskelær",
  colour: "Farge {n}",
  brushSize: "Penselstørrelse {n}",
  undo: "Angre",
  clear: "Tøm",
  sure: "Sikker?",
  timeUpSent: "Tiden er ute, tegningen er sendt.",
  timeUpNudge: "Tiden er ute, tegningen er sendt. Trykk «Si fra» for å gi partneren din beskjed.",
  sendFailed: "Fikk ikke sendt. Sjekk nettet og trykk «Send» igjen.",
  drewSomething: "{name} har tegnet noe",
  readyInfoHtml: "Du ser tegningen bli til og kan gjette når som helst. Du har <strong>{secs} sekunder</strong> fra du starter, og klokka går videre om du går ut.",
  readyRules: "Du kan gjette feil {max} ganger. En rask gjetning er verdt mer: 3, 2 eller 1 poeng, det samme for dere begge.",
  start: "Start",
  startFailed: "Fikk ikke startet. Sjekk nettet.",
  typeGuess: "Skriv en gjetning",
  guess: "Gjett",
  guessesLeft: ({ n }) => `${n} feil ${n === 1 ? "gjetning" : "gjetninger"} igjen`,
  soClose: "nesten!",
  saveFailed: "Fikk ikke lagret. Sjekk nettet.",
  worthNow: "Verdt {n} nå",
  letters: ({ word }) => {
    const c = letterCounts(word);
    return `${c.join(" + ")} ${sum(c) === 1 ? "bokstav" : "bokstaver"}`;
  },

  sentHead: "Tegningen er sendt!",
  sentSub: "Send nå lenken til den du vil spille med. Den som blir med, gjetter tegningen din og tegner en til deg.",
  waitGuessSub: "Si fra, så vet partneren din at tegningen er klar.",
  waitDrawSub: "Du får gjette så snart tegningen er sendt. Kom tilbake senere.",
  guessingNow: "{name} gjetter akkurat nå…",
  guessTimeUp: "Tiden for å gjette gikk ut. Svaret vises neste gang spillet åpnes.",
  sendInvite: "Send invitasjonslenke",
  nudge: "Si fra til {name}",

  pushOn: "Du får et varsel når det er din tur.",
  pushBlocked: "Varsler er blokkert for denne siden. Tillat dem i nettleserinnstillingene for siden, så får du beskjed når det er din tur.",
  pushButton: "Varsle meg når det er min tur",
  pushNotAllowed: "Varsler ble ikke tillatt.",
  pushFailed: "Fikk ikke slått på varsler på denne telefonen.",
  notifyBody: "Din tur til å gjette i Doodle Duet.",
  notified: "{name} får et varsel.",
  notifyFailed: "Fikk ikke varslet {name}. Trykk «Si fra» for å gi beskjed.",
  shareJoin: "Spill Doodle Duet med meg! Jeg har tegnet den første – nå er det din tur til å gjette.",
  shareGuess: "Tegningen min er klar til å gjettes i Doodle Duet.",
  shareDraw: "Din tur til å tegne i Doodle Duet!",
  linkCopied: "Lenken er kopiert. Lim den inn i en melding.",
};

export const STRINGS = { en, no };
export const UI_LANGS = ["en", "no"];

// The app's language: the switch if set, otherwise the phone's first language.
export function detectLang(override, languages) {
  if (UI_LANGS.includes(override)) return override;
  return /^(nb|nn|no)(-|$)/i.test(languages?.[0] ?? "") ? "no" : "en";
}

// t(key, values) in one language; unknown languages and keys fall back to English, then the key.
export function translator(lang) {
  const table = Object.hasOwn(STRINGS, lang) ? STRINGS[lang] : en;
  return (key, vars = {}) => {
    const v = Object.hasOwn(table, key) ? table[key] : Object.hasOwn(en, key) ? en[key] : key;
    return typeof v === "function" ? v(vars) : v.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
  };
}
