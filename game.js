// Pure game rules. No DOM, no network: tested by tests/game.test.mjs.
import { WORDS } from "./words.js";

export const DIFFICULTIES = ["easy", "medium", "hard"]; // index + 1 = points
export const DRAW_TIMES = [45, 60, 90];
export const MAX_REPLAY_GAP_MS = 1500;

export function normalizeGuess(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents (å becomes a on both sides)
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

export function scoreTurn({ difficulty, correct, beforeReplayEnd }) {
  if (!correct) return { drawer: 0, guesser: 0 };
  return { drawer: difficulty, guesser: difficulty + (beforeReplayEnd ? 1 : 0) };
}

export const otherSeat = (seat) => (seat === "a" ? "b" : "a");

export function pickChoices(lang, used, rng = Math.random) {
  const list = WORDS[lang] ?? WORDS.en;
  return DIFFICULTIES.map((d, i) => {
    const fresh = list[d].filter((w) => !used.has(w));
    const pool = fresh.length ? fresh : list[d];
    return { word: pool[Math.floor(rng() * pool.length)], difficulty: i + 1 };
  });
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
