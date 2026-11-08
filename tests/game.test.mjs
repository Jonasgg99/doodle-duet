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

test("scoring: both score difficulty points on a correct guess, speed bonus for guesser", () => {
  assert.deepEqual(scoreTurn({ difficulty: 2, correct: true, beforeReplayEnd: false }), { drawer: 2, guesser: 2 });
  assert.deepEqual(scoreTurn({ difficulty: 3, correct: true, beforeReplayEnd: true }), { drawer: 3, guesser: 4 });
  assert.deepEqual(scoreTurn({ difficulty: 1, correct: false, beforeReplayEnd: false }), { drawer: 0, guesser: 0 });
});

test("turns alternate between seats", () => {
  assert.equal(otherSeat("a"), "b");
  assert.equal(otherSeat("b"), "a");
});

test("word choices: one per difficulty, never a word already used", () => {
  for (const lang of Object.keys(WORDS)) {
    const used = new Set(WORDS[lang].easy.slice(0, -1)); // only one easy word left
    const c = pickChoices(lang, used, Math.random);
    assert.equal(c.length, 3);
    assert.deepEqual(c.map((x) => x.difficulty), [1, 2, 3]);
    assert.equal(c[0].word, WORDS[lang].easy.at(-1));
    for (const x of c) assert.ok(!used.has(x.word));
  }
});

test("word choices fall back to reusing words once a difficulty is exhausted", () => {
  const used = new Set(WORDS.en.easy);
  const c = pickChoices("en", used, Math.random);
  assert.ok(WORDS.en.easy.includes(c[0].word));
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
