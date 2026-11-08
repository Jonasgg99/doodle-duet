// Pure game rules. No DOM, no network: tested by tests/game.test.mjs.
import { WORDS } from "./words.js";

export const WORD_LEVELS = ["easy", "medium"]; // lists words are drawn from; "hard" is kept for later
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

export function scoreTurn({ correct, beforeReplayEnd }) {
  if (!correct) return { drawer: 0, guesser: 0 };
  return { drawer: 1, guesser: 1 + (beforeReplayEnd ? 1 : 0) };
}

export const otherSeat = (seat) => (seat === "a" ? "b" : "a");

// Three different words to choose from. Each keeps the list it came from (its level),
// so difficulty can come back later without changing saved games.
export function pickChoices(lang, used, rng = Math.random) {
  const list = WORDS[lang] ?? WORDS.en;
  const pool = WORD_LEVELS.flatMap((level) => list[level].map((word) => ({ word, level })));
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

const CODE_ABC = "abcdefghjkmnpqrstuvwxyz23456789"; // no i, l, o, 0, 1
export function newGameCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_ABC[b % CODE_ABC.length]).join("");
}

// Accepts "#k7m2qp", older "#g=<id>" links, or a typed code. Returns the id or null.
export function gameIdFromHash(s) {
  const id = String(s ?? "").trim().replace(/^#/, "").replace(/^g=/, "").toLowerCase();
  return /^[a-z0-9]{4,20}$/.test(id) ? id : null;
}

export function totals(turns) {
  const t = { a: 0, b: 0 };
  for (const turn of turns) {
    if (!turn?.result) continue;
    t[turn.drawer] += turn.result.drawerPts;
    t[otherSeat(turn.drawer)] += turn.result.guesserPts;
  }
  return t;
}

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
