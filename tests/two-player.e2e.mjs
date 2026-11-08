// Two-player end-to-end test in local mode: two headless "phones" share one browser
// context (shared localStorage, separate per-tab identities) and play two full rounds.
// Needs a static server on :8124 (python -m http.server 8124) and Playwright, which this
// repo doesn't install: set PLAYWRIGHT to a playwright/index.mjs (defaults to quiz-maker's).
// Run: node tests/two-player.e2e.mjs [screenshot-dir]
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const pwPath = process.env.PLAYWRIGHT || "D:/Apps/quiz-maker/node_modules/@playwright/test/index.mjs";
const { chromium } = await import(pathToFileURL(pwPath).href);
const URL0 = "http://localhost:8124/?local";
const shots = process.argv[2];
const errors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const open = async (label) => {
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && errors.push(`${label}: ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await p.clock.install();
  return p;
};
const shot = (p, name) => shots && p.screenshot({ path: `${shots}/${name}.png` });
const text = (p, sel) => p.locator(sel).innerText();
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

// --- Round 1: Jonas creates a game and draws ---
const A = await open("A");
await A.goto(URL0);
await A.fill("#name-input", "Jonas");
await shot(A, "01-home");
await noSideScroll(A, "home");
await A.click("#new-game-btn");
await A.waitForSelector(".choice");
await shot(A, "02-choose");
await A.locator(".choice").nth(1).click(); // medium word, 2 pts
await A.waitForSelector("#draw-canvas");
await scribble(A);
await shot(A, "03-draw");
await noSideScroll(A, "draw");
await A.click("#done-btn");
await A.waitForSelector("#share-btn");
assert.match(await text(A, "#panel"), /Drawing sent/);
await shot(A, "04-sent");
const gameUrl = A.url().replace(/^[^#]*/, URL0);

// --- Ida joins and guesses ---
const B = await open("B");
await B.goto(gameUrl);
await B.waitForSelector("#join-btn");
assert.match(await text(B, "#join-title"), /Jonas invited you/);
await B.fill("#join-name", "Ida");
await B.click("#join-btn");
await B.waitForSelector("#start-guess");
await shot(B, "05-ready");
await B.click("#start-guess");
await B.waitForSelector("#guess-canvas");
await B.clock.runFor(400);
await shot(B, "06-guessing");
const word1 = await B.evaluate(() => window.__dd.game.turns.t000.word);
await B.fill("#guess-input", "definitely not it");
await B.press("#guess-input", "Enter");
await B.fill("#guess-input", word1.toUpperCase());
await B.press("#guess-input", "Enter");
await B.waitForSelector("#continue-btn");
assert.match(await text(B, "#panel"), /You got it/);
await shot(B, "07-got-it");
await B.click("#continue-btn");
await B.waitForSelector(".choice"); // Ida draws next

// Jonas sees the outcome and the score
await A.waitForSelector("#continue-btn");
assert.match(await text(A, "#panel"), /Ida got it/);
const scoresA = await A.$$eval(".pscore", (els) => els.map((e) => +e.textContent));
assert.equal(scoresA[0], 2, "drawer gets 2 for a medium word");
assert.ok(scoresA[1] === 2 || scoresA[1] === 3, "guesser gets 2, or 3 with the speed bonus");
await shot(A, "08-drawer-result");
await A.click("#continue-btn");
await A.waitForSelector("#share-btn");
assert.match(await text(A, "#panel"), /Waiting for Ida to draw/);

// --- Round 2: Ida's draw timer runs out (auto-send), Jonas's guess timer runs out ---
await B.locator(".choice").nth(0).click();
await B.waitForSelector("#draw-canvas");
await scribble(B);
await B.clock.runFor(61_000);
await B.waitForSelector("#share-btn");
assert.match(await text(B, "#panel"), /Waiting for Jonas to guess/);

await A.waitForSelector("#start-guess");
await A.click("#start-guess");
await A.waitForSelector("#guess-canvas");
await A.clock.runFor(81_000);
await A.waitForSelector("#continue-btn");
assert.match(await text(A, "#panel"), /Time's up/);
await shot(A, "09-times-up");
await A.click("#continue-btn");
await A.waitForSelector(".choice"); // Jonas draws round 3
assert.match(await text(A, "#scoreboard"), /round 3/i);
await A.goto(URL0.replace("?local", "?local#"));
await A.waitForSelector(".game-list a.my-turn");
assert.match(await text(A, ".game-list"), /Your turn to draw/);
await shot(A, "10-home-list");

// Dark theme renders without side scroll
await A.emulateMedia({ colorScheme: "dark" });
await A.goto(gameUrl.replace(/#.*/, "") + "#");
await shot(A, "11-home-dark");

await browser.close();
assert.deepEqual(errors, [], "console errors:\n" + errors.join("\n"));
console.log("two-player e2e: passed");
