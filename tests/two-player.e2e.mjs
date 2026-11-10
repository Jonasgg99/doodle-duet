// Two-player end-to-end test in local mode: two headless "phones" share one browser
// context (shared localStorage, separate per-tab identities) and play three rounds:
// a quick correct guess, a round lost on three wrong guesses, and one lost on time.
// Needs a static server on :8124 (python -m http.server 8124) and Playwright, which this
// repo doesn't install: set PLAYWRIGHT to a playwright/index.mjs (defaults to quiz-maker's).
// Run: node tests/two-player.e2e.mjs [screenshot-dir]
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { translator } from "../i18n.js";
const letterHint = (word) => translator("en")("letters", { word });

const pwPath = process.env.PLAYWRIGHT || "D:/Apps/quiz-maker/node_modules/@playwright/test/index.mjs";
const { chromium } = await import(pathToFileURL(pwPath).href);
const URL0 = "http://localhost:8124/?local";
const shots = process.argv[2];
const errors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
// Record share-sheet calls instead of opening one.
await ctx.addInitScript(() => {
  window.__shares = [];
  navigator.share = async (data) => void window.__shares.push(data);
});
const open = async (label) => {
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && errors.push(`${label}: ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await p.clock.install();
  return p;
};
const shot = (p, name) => shots && p.screenshot({ path: `${shots}/${name}.png` });
const text = (p, sel) => p.locator(sel).innerText();
const shares = (p) => p.evaluate(() => window.__shares);
// The scoreboard shows one shared score and the streak of rounds guessed in a row: [points, streak].
const scores = (p) => Promise.all(["#team-points", "#team-streak"].map(async (s) => +(await p.locator(s).innerText())));
const noSideScroll = async (p, where) =>
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `horizontal scroll on ${where}`);

async function scribble(p) {
  const box = await p.locator("canvas.art").boundingBox();
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  for (const line of [[[0.2, 0.3], [0.5, 0.6], [0.8, 0.3]], [[0.3, 0.8], [0.7, 0.8]]]) {
    await p.mouse.move(...at(...line[0]));
    await p.mouse.down();
    for (const pt of line.slice(1)) await p.mouse.move(...at(...pt), { steps: 8 });
    await p.mouse.up();
    await p.clock.runFor(300);
  }
}
async function makePlayer(p, name) {
  await p.waitForSelector("#view-setup:not([hidden])");
  await p.fill("#player-name", name);
  await p.click("#signin-btn");
}
async function guess(p, word) {
  await p.fill("#guess-input", word);
  await p.press("#guess-input", "Enter");
}

// --- Round 1: Jonas sets up the game, draws, and Send opens the share sheet ---
const A = await open("A");
await A.goto(URL0);
await makePlayer(A, "Jonas");
await A.waitForSelector("#view-list:not([hidden])");
await shot(A, "01-home");
await noSideScroll(A, "home");
await A.click("#new-game-btn");
await A.click("#invite-btn");
await A.waitForSelector(".choice");
const GAME = URL0 + "#" + (await A.evaluate(() => window.__dd.gameId));
await shot(A, "02-choose");
await A.locator(".choice").nth(1).click();
await A.waitForSelector("#draw-canvas");
await scribble(A);
await shot(A, "03-draw");
await noSideScroll(A, "draw");
await A.click("#done-btn");
await A.waitForSelector("#share-btn");
assert.match(await text(A, "#panel"), /Drawing sent/);
const s1 = await shares(A);
assert.equal(s1.length, 1, "Send opened the share sheet");
assert.equal(s1[0].url, GAME.replace("?local", ""));
assert.match(s1[0].text, /your turn to guess/);
await shot(A, "04-sent");

// --- Ida joins and guesses quickly: worth 3 each ---
const B = await open("B");
await B.goto(GAME);
await makePlayer(B, "Ida");
await B.click("#join-btn");
await B.waitForSelector("#start-guess");
assert.match(await text(B, "#panel"), /3 wrong guesses/);
await shot(B, "05-ready");
await B.click("#start-guess");
await B.waitForSelector("#guess-canvas");
await B.clock.runFor(400);
assert.match(await text(B, "#guess-worth"), /Worth 3/);
assert.match(await text(B, "#guess-left"), /^3 wrong guesses left/);
await guess(B, "definitely not it");
assert.match(await text(B, "#guess-left"), /^2 wrong guesses left/);
await shot(B, "06-guessing");
const word1 = await B.evaluate(() => window.__dd.game.turns.t000.word);
assert.equal(await text(B, ".blank-count"), letterHint(word1), "the letter count is spelled out");
await guess(B, word1.toUpperCase());
// No result screen: Ida lands on her word choice with the result on top.
await B.waitForSelector(".choice");
assert.match(await text(B, ".result-banner"), /You got it/);
assert.match(await text(B, ".result-banner"), /\+3 points/);
await shot(B, "07-got-it-banner");

await A.waitForSelector(".result-banner");
assert.match(await text(A, ".result-banner"), /Ida got it/);
assert.deepEqual(await scores(A), [3, 1]);
assert.match(await text(A, "#panel"), /Waiting for Ida to draw/);
// Jonas sees what Ida guessed wrong; Ida leaves him a message from her banner and he sees it live.
assert.match(await text(A, ".result-banner"), /definitely not it/);
assert.equal(await A.locator(".result-banner .note-input").count(), 0, "only the guesser writes");
assert.equal(await B.getAttribute(".result-banner .note-input", "maxlength"), "120");
await B.fill(".result-banner .note-input", "Nice drawing!");
// While Ida is still writing, Jonas switches the words to Hard: her choices are redrawn,
// her banner and half-written message stay (and keep the keyboard).
const choicesNow = (p) => p.evaluate(() => window.__dd.game.turns[window.__dd.game.cur].choices);
assert.ok((await choicesNow(B)).some((c) => c.level !== "hard"), "starts on the default lists");
const firstWords = (await choicesNow(B)).map((c) => c.word);
await A.click('#word-seg [data-v="hard"]');
await B.waitForFunction(() => window.__dd.game.turns[window.__dd.game.cur].choices.every((c) => c.level === "hard"));
const hard = (await choicesNow(B)).map((c) => c.word);
await B.waitForFunction((w) => [...document.querySelectorAll(".choice .cw")].map((e) => e.textContent).join() === w.join(), hard);
await B.waitForSelector('#word-seg [data-v="hard"][aria-checked="true"]'); // Ida sees the setting live
// Switching back and forth while she's still choosing brings back the same words, not new ones.
const shownWords = (p) => p.$$eval(".choice .cw", (els) => els.map((e) => e.textContent).join());
await A.click('#word-seg [data-v="mixed"]');
await B.waitForFunction(() => window.__dd.game.turns[window.__dd.game.cur].choices.some((c) => c.level !== "hard"));
const mixedAgain = (await choicesNow(B)).map((c) => c.word);
await A.click('#word-seg [data-v="hard"]');
await B.waitForFunction((w) => [...document.querySelectorAll(".choice .cw")].map((e) => e.textContent).join() === w.join(), hard);
assert.deepEqual((await choicesNow(B)).map((c) => c.word), hard, "Hard shows the same words again");
assert.deepEqual(mixedAgain, firstWords, "Mixed brought back her first words");
assert.equal(await shownWords(B), hard.join());
// Jonas leaves the adult words out: Ida sees the switch change, and her choices are drawn again
// from the clean words only (new rounds too, checked below).
const adultWords = await B.evaluate(async () => [...(await import("./words.js")).ADULT_WORDS.en]);
await A.click('#adult-seg [data-v="off"]');
await B.waitForSelector('#adult-seg [data-v="off"][aria-checked="true"]');
await B.waitForFunction(() => window.__dd.game.adult === false);
const cleanChoices = await choicesNow(B);
assert.ok(cleanChoices.every((c) => c.level === "hard" && !adultWords.includes(c.word)), "choices redrawn without adult words");
await B.waitForFunction((w) => [...document.querySelectorAll(".choice .cw")].map((e) => e.textContent).join() === w.join(), cleanChoices.map((c) => c.word));
assert.equal(await B.inputValue(".result-banner .note-input"), "Nice drawing!");
assert.ok(await B.evaluate(() => document.activeElement?.classList.contains("note-input")), "message box keeps focus");
await shot(B, "08b-hard-words");
await B.press(".result-banner .note-input", "Enter");
await B.waitForSelector(".result-banner .rb-note:has-text('Nice drawing!')");
await A.waitForSelector(".result-banner .rb-note:has-text('Nice drawing!')");
await A.waitForSelector("#history :text('Nice drawing!')");
assert.match(await text(A, "#history"), /definitely not it/);
await shot(A, "08a-drawer-sees-message");
await shot(A, "08-drawer-banner");

// --- Round 2 (Hard words): Ida's timer runs out (auto-send, no share sheet); Jonas uses up 3 wrong guesses ---
await B.locator(".choice").nth(0).click();
await B.waitForSelector("#draw-canvas");
await scribble(B);
await B.clock.runFor(61_000);
await B.waitForSelector("#share-btn");
assert.match(await text(B, "#panel"), /Waiting for Jonas to guess/);
assert.equal((await shares(B)).length, 0, "auto-send can't open the share sheet");

await A.waitForSelector("#start-guess");
await A.click("#start-guess");
await A.waitForSelector("#guess-canvas");
for (const w of ["zzz one", "zzz two", "zzz three"]) await guess(A, w);
await A.waitForSelector(".choice"); // round over, Jonas draws next
assert.ok((await choicesNow(A)).every((c) => c.level === "hard" && !adultWords.includes(c.word)), "the next round uses the new settings");
assert.match(await text(A, ".result-banner"), /Not this time/);
await shot(A, "09-out-of-guesses");
await B.waitForSelector(".result-banner");
assert.match(await text(B, ".result-banner"), /Jonas didn't get it/);
assert.match(await text(B, ".result-banner"), /zzz one.*zzz two.*zzz three/s);

// --- Round 3: Ida's guess time runs out ---
await A.locator(".choice").nth(0).click();
await A.waitForSelector("#draw-canvas");
await scribble(A);
await A.click("#done-btn");
await A.waitForSelector("#share-btn");
await B.waitForSelector("#start-guess");
await B.click("#start-guess");
await B.waitForSelector("#guess-canvas");
await B.clock.runFor(81_000);
await B.waitForSelector(".choice");
assert.match(await text(B, ".result-banner"), /Not this time/);
assert.deepEqual(await scores(B), [3, 0], "two misses: points kept, streak reset");
assert.match(await text(B, "#scoreboard"), /round 4/i);

// Reopening lands straight in the game; the banner isn't shown twice.
await A.reload();
await A.waitForSelector("#share-btn");
assert.equal(await A.locator(".result-banner").count(), 0);
await shot(A, "10-reopened");

// A third tab is locked out of the game
const C = await open("C");
await C.goto(GAME);
await makePlayer(C, "Ida");
await C.waitForSelector("#view-error:not([hidden])");
assert.match(await text(C, "#error-text"), /Let Ida join again/, "the lock-out says how to move a seat");

// Ida moves to another browser (tab C): Jonas lets her join again, her old tab loses the seat,
// the new one joins as her and the scores and turn stay. Only the player who set up the game has the button.
assert.ok(await B.locator("#reseat-btn").isHidden(), "Ida can't release Jonas's seat");
A.once("dialog", (d) => d.accept());
await A.click("#reseat-btn");
await B.waitForSelector("#view-join:not([hidden])");
await C.reload();
await C.waitForSelector("#view-join:not([hidden])");
await C.click("#join-btn");
await C.waitForSelector(".choice"); // it was Ida's turn to draw
assert.deepEqual(await scores(C), [3, 0]);
assert.match(await text(C, "#scoreboard"), /round 4/i);
assert.match(await text(C, "#scoreboard .is-me"), /Ida/);
const D = await open("D");
await D.goto(GAME);
await makePlayer(D, "Dan");
await D.waitForSelector("#view-error:not([hidden])"); // two players again

await A.emulateMedia({ colorScheme: "dark" });
await shot(A, "11-dark");

// A game link from someone else can't run script: every field is data, numbers included.
const ctxX = await browser.newContext();
await ctxX.addInitScript(() => {
  if (sessionStorage.getItem("dd_uid")) return;
  const x = '<img src=x onerror="window.__pwned=1">';
  const t = (n, extra) => ({ n, drawer: "a", word: "cat", strokes: "[]", ...extra });
  sessionStorage.setItem("dd_uid", "local-victim");
  sessionStorage.setItem("dd_signedin", "1");
  localStorage.setItem("dd_localdb", JSON.stringify({
    players: { "local-victim": { name: "Jonas" } },
    games: { evil: {
      lang: "en", drawSecs: x, cur: "t001",
      players: { a: { uid: "local-attacker", name: "Eve" }, b: { uid: "local-victim", name: "Jonas" } },
      turns: {
        t000: t(0, { status: "done", result: { correct: true, ms: 1000, drawerPts: x, guesserPts: x }, guesses: { k: { g: "dog", t: 5, r: x } } }),
        t001: t(x, { status: "guess", guessStartedAt: Date.now(), guesses: { k: { g: "dog", t: 5, r: x } } }),
      },
    } },
  }));
});
const X = await ctxX.newPage();
await X.goto(URL0 + "#evil");
await X.waitForSelector("#guess-list li");
await X.waitForTimeout(300);
assert.equal(await X.evaluate(() => window.__pwned), undefined, "hostile game ran script");
assert.equal(await X.locator("#view-game img").count(), 0, "hostile game injected markup");
await ctxX.close();

await browser.close();
assert.deepEqual(errors, [], "console errors:\n" + errors.join("\n"));
console.log("two-player e2e: passed");
