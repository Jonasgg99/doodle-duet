// Live test against the real Firebase backend: two separate browser profiles (so two
// anonymous identities) play one round, then a third profile opens the game link and
// must be refused by the database rules. Writes one small test game to the database.
// Run: node tests/firebase.e2e.mjs [base-url]   (default http://localhost:8124/)
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const pwPath = process.env.PLAYWRIGHT || "D:/Apps/quiz-maker/node_modules/@playwright/test/index.mjs";
const { chromium } = await import(pathToFileURL(pwPath).href);
const BASE = process.argv[2] || "http://localhost:8124/";
const errors = [];
const browser = await chromium.launch();
const phone = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/permission_denied/i.test(m.text()) && errors.push(`${label}: ${m.text()}`));
  return p;
};
const T = { timeout: 20_000 };

const A = await phone("A");
await A.goto(BASE);
await A.waitForSelector("#new-game-btn", T);
assert.ok(await A.locator("#mode-tag").isHidden(), "should be in Firebase mode");
await A.fill("#name-input", "Test A");
await A.click("#new-game-btn");
await A.waitForSelector(".choice", T);
await A.locator(".choice").first().click();
await A.waitForSelector("#draw-canvas", T);
const box = await A.locator("#draw-canvas").boundingBox();
await A.mouse.move(box.x + 50, box.y + 50);
await A.mouse.down();
await A.mouse.move(box.x + 250, box.y + 300, { steps: 10 });
await A.mouse.up();
await A.click("#done-btn");
await A.waitForSelector("#share-btn", T);
const gameUrl = BASE + A.url().replace(/^[^#]*/, "");

const B = await phone("B");
await B.goto(gameUrl);
await B.fill("#join-name", "Test B", T);
await B.click("#join-btn");
await B.click("#start-guess", T);
await B.waitForSelector("#guess-canvas", T);
const word = await B.evaluate(() => window.__dd.game.turns[window.__dd.game.cur].word);
await B.fill("#guess-input", word);
await B.press("#guess-input", "Enter");
await B.waitForSelector("#continue-btn", T);
assert.match(await B.locator("#panel").innerText(), /You got it/);

await A.waitForSelector("#continue-btn", T); // drawer sees the outcome live
assert.match(await A.locator("#panel").innerText(), /got it/);

// Closing and reopening keeps your seat: same anonymous identity, game listed at home.
await A.reload();
await A.waitForSelector("#scoreboard .is-me", T);
assert.match(await A.locator("#scoreboard .is-me").innerText(), /Test A/);
await A.goto(BASE);
await A.waitForSelector(".game-list a[data-id]", T);
await B.reload();
await B.click("#continue-btn", T); // the unacknowledged result comes back first
await B.waitForSelector(".choice", T); // then B's turn to draw

const C = await phone("C");
await C.goto(gameUrl);
await C.waitForSelector("#view-error:not([hidden])", T);
assert.match(await C.locator("#error-text").innerText(), /two other devices/);
const stranger = await C.evaluate(async (id) => {
  try {
    await window.__dd.store.set(`games/${id}/players/b`, { uid: window.__dd.store.uid, name: "intruder" });
    return "write allowed";
  } catch (e) {
    return String(e.code || e.message);
  }
}, gameUrl.split("#")[1]);
assert.match(stranger, /permission.denied/i, "stranger must not be able to take a seat");

await browser.close();
assert.deepEqual(errors, [], errors.join("\n"));
console.log("firebase e2e: passed against " + BASE);
