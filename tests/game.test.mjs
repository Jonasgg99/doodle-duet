// Run: node --test tests/
// Tests mirror the rules in .work/active/doodle-duet.md (Decisions), written before game.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeGuess,
  checkGuess,
  scoreTurn,
  otherSeat,
  pickChoices,
  totals,
  guessLimitMs,
  replayTimeline,
  pointsAt,
  guessesLeft,
  MAX_GUESSES,
  gameIdFromHash,
  wordLevels,
  WORD_SETTINGS,
} from "../game.js";
import { WORDS } from "../words.js";

test("guess matching ignores case, spacing, punctuation and accents", () => {
  assert.equal(normalizeGuess("  Ice-Cream! "), "ice cream");
  assert.equal(checkGuess("ICE cream", "ice cream"), "correct");
  assert.equal(checkGuess("icecream", "ice cream"), "correct");
  assert.equal(checkGuess("café", "cafe"), "correct");
  assert.equal(checkGuess("Blåbær", "blåbær"), "correct");
});

test("one typo on a longer word is close, not correct", () => {
  assert.equal(checkGuess("elefant", "elephant"), "wrong"); // two edits
  assert.equal(checkGuess("elephnt", "elephant"), "close");
  assert.equal(checkGuess("cat", "car"), "wrong"); // short words get no close hint
  assert.equal(checkGuess("", "car"), "wrong");
});

test("scoring: a faster correct guess is worth more, the same for drawer and guesser", () => {
  const limitMs = 90_000; // thirds at 30 s and 60 s
  const pts = (ms, correct = true) => scoreTurn({ correct, ms, limitMs });
  assert.deepEqual(pts(0), { drawer: 3, guesser: 3 });
  assert.deepEqual(pts(29_999), { drawer: 3, guesser: 3 });
  assert.deepEqual(pts(30_000), { drawer: 2, guesser: 2 });
  assert.deepEqual(pts(59_999), { drawer: 2, guesser: 2 });
  assert.deepEqual(pts(60_000), { drawer: 1, guesser: 1 });
  assert.deepEqual(pts(89_999), { drawer: 1, guesser: 1 });
  assert.deepEqual(pts(1_000, false), { drawer: 0, guesser: 0 });
  assert.equal(pointsAt(0, limitMs), 3);
  assert.equal(pointsAt(75_000, limitMs), 1);
});

test("three wrong guesses per round; a close guess doesn't use one up", () => {
  assert.equal(MAX_GUESSES, 3);
  assert.equal(guessesLeft([]), 3);
  assert.equal(guessesLeft([{ r: "wrong" }, { r: "close" }]), 2);
  assert.equal(guessesLeft([{ r: "wrong" }, { r: "wrong" }, { r: "close" }, { r: "wrong" }]), 0);
  assert.equal(guessesLeft([{ r: "wrong" }, { r: "wrong" }, { r: "wrong" }, { r: "wrong" }]), 0);
});

test("turns alternate between seats", () => {
  assert.equal(otherSeat("a"), "b");
  assert.equal(otherSeat("b"), "a");
});

test("word choices: three different unused words from the easy and medium lists, each keeping its level", () => {
  for (const lang of Object.keys(WORDS)) {
    const pool = [...WORDS[lang].easy, ...WORDS[lang].medium];
    const used = new Set(pool.slice(0, -3)); // exactly three words left
    const c = pickChoices(lang, used, Math.random);
    assert.equal(c.length, 3);
    assert.deepEqual(c.map((x) => x.word).sort(), pool.slice(-3).sort());
    for (const x of c) assert.ok(WORDS[lang][x.level].includes(x.word));
  }
});

test("word choices reuse words once the pool runs low, still three different words", () => {
  const used = new Set([...WORDS.en.easy, ...WORDS.en.medium]);
  const c = pickChoices("en", used, Math.random);
  assert.equal(new Set(c.map((x) => x.word)).size, 3);
});

test("word setting picks the lists: easy, mixed (easy+medium, the default), hard", () => {
  assert.deepEqual(WORD_SETTINGS, ["easy", "mixed", "hard"]);
  assert.deepEqual(wordLevels("easy"), ["easy"]);
  assert.deepEqual(wordLevels("mixed"), ["easy", "medium"]);
  assert.deepEqual(wordLevels(undefined), ["easy", "medium"]);
  assert.deepEqual(wordLevels("hard"), ["hard"]);
  for (const lang of Object.keys(WORDS))
    for (const setting of WORD_SETTINGS)
      for (let i = 0; i < 20; i++)
        for (const x of pickChoices(lang, new Set(), Math.random, setting)) {
          assert.ok(wordLevels(setting).includes(x.level), `${lang} ${setting}: ${x.level}`);
          assert.ok(WORDS[lang][x.level].includes(x.word));
        }
});

test("word lists: no word twice in a language, and every word is lower-case words", () => {
  for (const lang of Object.keys(WORDS)) {
    const all = [...WORDS[lang].easy, ...WORDS[lang].medium, ...WORDS[lang].hard];
    assert.deepEqual(all.filter((w, i) => all.indexOf(w) !== i), [], `${lang}: duplicates`);
    for (const w of all) assert.match(w, /^\p{Ll}+( \p{Ll}+)*$/u, `${lang}: "${w}"`);
  }
});

test("game ids are read from links; no id means the main game", () => {
  assert.equal(gameIdFromHash("#k7m2qp"), "k7m2qp");
  assert.equal(gameIdFromHash("#K7M2QP"), "k7m2qp");
  assert.equal(gameIdFromHash("#g=abcd2345efgh67"), "abcd2345efgh67"); // older long links still work
  assert.equal(gameIdFromHash(""), null);
  assert.equal(gameIdFromHash("#"), null);
  assert.equal(gameIdFromHash("#hello world"), null);
});

test("totals sum finished turns only", () => {
  const turns = [
    { drawer: "a", result: { drawerPts: 2, guesserPts: 3 } },
    { drawer: "b", result: { drawerPts: 1, guesserPts: 1 } },
    { drawer: "a" }, // in progress
  ];
  assert.deepEqual(totals(turns), { a: 3, b: 4 });
  assert.deepEqual(totals([]), { a: 0, b: 0 });
});

test("guess time is draw time plus 20 seconds", () => {
  assert.equal(guessLimitMs(60), 80000);
  assert.equal(guessLimitMs(45), 65000);
});

test("replay compresses long pauses between strokes and keeps drawing speed", () => {
  // stroke points are flat [x, y, t, ...] with t in ms from drawing start
  const strokes = [
    { c: 0, w: 1, p: [0, 0, 0, 10, 10, 500] },
    { c: 0, w: 1, p: [20, 20, 10500, 30, 30, 11000] }, // 10 s pause before it
  ];
  const tl = replayTimeline(strokes, 1500);
  assert.deepEqual(tl.times[0], [0, 500]);
  assert.deepEqual(tl.times[1], [2000, 2500]);
  assert.equal(tl.duration, 2500);
  assert.deepEqual(replayTimeline([], 1500), { times: [], duration: 0 });
});
