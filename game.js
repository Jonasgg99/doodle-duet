// Pure game rules. No DOM, no network: tested by tests/game.test.mjs.
import { WORDS } from "./words.js";

// The game's word setting (game.wordLevel) decides which lists words are drawn from.
export const WORD_SETTINGS = ["easy", "mixed", "hard"];
export const wordLevels = (setting) => ({ easy: ["easy"], hard: ["hard"] })[setting] ?? ["easy", "medium"];
export const DRAW_SECS = 60;
export const MAX_REPLAY_GAP_MS = 1500;

export function normalizeGuess(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (å becomes a on both sides)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// "correct" | "close" | "wrong". Spaces are ignored, so "icecream" matches "ice cream".
export function checkGuess(guess, word) {
  const g = normalizeGuess(guess).replace(/ /g, "");
  const w = normalizeGuess(word).replace(/ /g, "");
  if (!g) return "wrong";
  if (g === w) return "correct";
  if (w.length >= 5 && editDistance(g, w) === 1) return "close";
  return "wrong";
}

// A correct guess is worth 3, 2 or 1 point in the first, middle or last third of the guess time.
export const pointsAt = (ms, limitMs) => (ms < limitMs / 3 ? 3 : ms < (2 * limitMs) / 3 ? 2 : 1);

// Drawer and guesser get the same points: a quick guess needs a quick, clear drawing.
export function scoreTurn({ correct, ms, limitMs }) {
  if (!correct) return { drawer: 0, guesser: 0 };
  const p = pointsAt(ms, limitMs);
  return { drawer: p, guesser: p };
}

// Wrong guesses allowed per round. A "close" guess (one typo) doesn't use one up.
export const MAX_GUESSES = 3;
export const guessesLeft = (guesses) => Math.max(0, MAX_GUESSES - guesses.filter((g) => g.r === "wrong").length);

// What the guesser tried before getting it (or running out): wrong and close guesses, in order.
export const missedGuesses = (turn) =>
  Object.values(turn.guesses || {})
    .filter((g) => g.r !== "correct")
    .sort((a, b) => a.t - b.t)
    .map((g) => g.g);

export const otherSeat = (seat) => (seat === "a" ? "b" : "a");

// Three different words to choose from, from the lists the word setting allows.
// Each keeps the list it came from (its level).
export function pickChoices(lang, used, rng = Math.random, setting) {
  const list = WORDS[lang] ?? WORDS.en;
  const pool = wordLevels(setting).flatMap((level) => list[level].map((word) => ({ word, level })));
  const shuffle = (xs) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };
  const fresh = shuffle(pool.filter((x) => !used.has(x.word)));
  const reused = shuffle(pool.filter((x) => used.has(x.word)));
  return [...fresh, ...reused].slice(0, 3);
}

// The word setting changed while the drawer is still choosing: keep the words on screen for the
// old setting and show the new setting's words, drawn once per round, so switching back and forth
// brings back the same words. pick(setting) draws fresh choices. Returns the turn fields to write.
export function switchChoices(turn, from, to, pick) {
  const choiceSets = { ...turn.choiceSets, [from]: turn.choices };
  return { choices: choiceSets[to] ?? pick(to), choiceSets };
}

// One line of the games list for player `uid`: who they play (null while nobody has joined),
// whether the next move is theirs, and what it is. game = {players, turn: the current turn's
// {drawer, status, n}}. Null when the player isn't in the game. The other player writes their own
// name into the game, so it may be anything: it always comes back as text.
export function gameStatus({ players, turn }, uid) {
  const seat = players?.a?.uid === uid ? "a" : players?.b?.uid === uid ? "b" : null;
  if (!seat || !turn) return null;
  const other = players[otherSeat(seat)];
  const them = other ? String(other.name ?? "Player") : null;
  const round = turn.n + 1;
  const myDraw = turn.drawer === seat;
  if (turn.status === "draw") return { them, mine: myDraw, text: myDraw ? "Your turn to draw" : `Waiting for ${them} to draw`, round };
  if (!them) return { them, mine: false, text: "Waiting for someone to join", round };
  return { them, mine: !myDraw, text: myDraw ? `Waiting for ${them} to guess` : "Your turn to guess", round };
}

// Games list order: your move first, then by the other player's name; games nobody joined last.
export function sortGames(rows) {
  const key = (r) => [r.status.mine ? 0 : r.status.them ? 1 : 2, String(r.status.them ?? "")];
  return [...rows].sort((x, y) => {
    const [a, b] = [key(x), key(y)];
    return a[0] - b[0] || a[1].localeCompare(b[1]);
  });
}

// Accepts "#<id>" or older "#g=<id>" links. Returns the id or null (no id: the main game).
export function gameIdFromHash(s) {
  const id = String(s ?? "").trim().replace(/^#/, "").replace(/^g=/, "").toLowerCase();
  return /^[a-z0-9]{4,20}$/.test(id) ? id : null;
}

export function totals(turns) {
  const t = { a: 0, b: 0 };
  const pts = (x) => (Number.isFinite(x) ? x : 0);
  for (const turn of turns) {
    if (!turn?.result) continue;
    t[turn.drawer] += pts(turn.result.drawerPts);
    t[otherSeat(turn.drawer)] += pts(turn.result.guesserPts);
  }
  return t;
}

// The guesser's hint as a number, e.g. "8 letters" or "3 + 5 letters" for two words.
export function letterHint(word) {
  const counts = word.split(" ").map((w) => [...w].length);
  const n = counts.reduce((a, b) => a + b, 0);
  return `${counts.join(" + ")} letter${n === 1 ? "" : "s"}`;
}

// Turns in round order. Keys are "t" + round padded to 3 digits, so key order breaks at t1000.
export const turnsInOrder = (turns) => Object.values(turns || {}).sort((a, b) => a.n - b.n);

// Whether the last finished round's result still has to be shown on this phone. A seen round at
// or past the current round means the game was deleted and set up again, so it no longer counts.
export const resultIsNew = (lastN, seenN, curN) => lastN > seenN || seenN >= curN;

export const guessLimitMs = (drawSecs) => (drawSecs + 20) * 1000;

// Maps each point's recorded time to replay time, shrinking pauses between strokes
// to at most maxGap ms. Returns per-stroke arrays of replay times and the total duration.
export function replayTimeline(strokes, maxGap = MAX_REPLAY_GAP_MS) {
  const times = [];
  let shift = 0;
  let lastEnd = null;
  for (const s of strokes) {
    const p = s.p;
    const start = p[2];
    if (lastEnd !== null && start - lastEnd > maxGap) shift += start - lastEnd - maxGap;
    const ts = [];
    for (let i = 2; i < p.length; i += 3) ts.push(p[i] - shift);
    times.push(ts);
    lastEnd = p[p.length - 1];
  }
  const duration = times.length ? times.at(-1).at(-1) : 0;
  return { times, duration };
}
