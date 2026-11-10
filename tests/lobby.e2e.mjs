// Players and the games list, end to end in local mode (shared localStorage, one identity per
// tab): a first visit makes a player, the plain site lists your games with whose move it is, a
// new game goes to a player picked from the list (no link) or to whoever opens an invite link,
// one player runs two games with two people at once, and an old `main` game shows up in the list.
// Needs the :8124 server. Run: node tests/lobby.e2e.mjs
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const pwPath = process.env.PLAYWRIGHT || "D:/Apps/quiz-maker/node_modules/@playwright/test/index.mjs";
const { chromium } = await import(pathToFileURL(pwPath).href);
const URL0 = "http://localhost:8124/?local";
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  window.__shares = [];
  navigator.share = async (data) => void window.__shares.push(data);
});
const open = async (label, c = ctx) => {
  const p = await c.newPage();
  p.on("console", (m) => m.type() === "error" && errors.push(`${label}: ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  return p;
};
const text = (p, sel) => p.locator(sel).innerText();
const rows = (p) => p.$$eval("#games-list .game-row", (els) => els.map((e) => [e.querySelector(".gr-them").textContent, e.querySelector(".gr-status").textContent]));
const waitRows = (p, want) =>
  p.waitForFunction(
    (w) => JSON.stringify([...document.querySelectorAll("#games-list .game-row")].map((e) => [e.querySelector(".gr-them").textContent, e.querySelector(".gr-status").textContent])) === JSON.stringify(w),
    want
  ).catch(async (e) => assert.fail(`rows: ${JSON.stringify(await rows(p))}, want ${JSON.stringify(want)} (${e.message})`));

async function makePlayer(p, name) {
  await p.waitForSelector("#view-setup:not([hidden])");
  await p.fill("#player-name", name);
  await p.click("#signin-btn");
}
async function drawAndSend(p) {
  await p.locator(".choice").first().click();
  await p.waitForSelector("#draw-canvas");
  const b = await p.locator("#draw-canvas").boundingBox();
  await p.mouse.move(b.x + 60, b.y + 60);
  await p.mouse.down();
  await p.mouse.move(b.x + 200, b.y + 260, { steps: 8 });
  await p.mouse.up();
  await p.click("#done-btn");
  await p.waitForSelector("#share-btn");
}

// --- 1. A first visit makes a player and lands on an empty games list ---
const A = await open("A");
await A.goto(URL0);
await makePlayer(A, "Jonas");
await A.waitForSelector("#view-list:not([hidden])");
assert.match(await text(A, "#view-list"), /No games yet/);
assert.match(await text(A, "#me-name"), /Jonas/);
assert.ok(await A.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no side scroll on the list");

// --- 2. New game by invite link: Jonas draws first, Send shares the game's own link ---
await A.click("#new-game-btn");
await A.waitForSelector("#view-new:not([hidden])");
assert.equal(await A.locator("#people .person").count(), 0, "nobody else to pick yet");
await A.click("#invite-btn");
await A.waitForSelector(".choice");
const game1 = await A.evaluate(() => window.__dd.gameId);
assert.match(game1, /^[a-z0-9]{10}$/);
await drawAndSend(A);
const [share1] = await A.evaluate(() => window.__shares);
assert.equal(share1.url, "http://localhost:8124/#" + game1);

// --- 3. Ida opens the link, makes her player and joins ---
const B = await open("B");
await B.goto(URL0 + "#" + game1);
await makePlayer(B, "Ida");
await B.waitForSelector("#join-btn");
assert.match(await text(B, "#join-title"), /Jonas/);
await B.click("#join-btn");
await B.waitForSelector("#start-guess");

// --- 4. The list shows the game with whose move it is, live ---
await A.click("#back-link");
await A.waitForSelector("#view-list:not([hidden])");
await waitRows(A, [["Ida", "Waiting for Ida to guess"]]);
await B.click("#start-guess");
await B.waitForSelector("#guess-canvas");
const word1 = await B.evaluate(() => window.__dd.game.turns[window.__dd.game.cur].word);
await B.fill("#guess-input", word1);
await B.press("#guess-input", "Enter");
await B.waitForSelector(".choice");
await waitRows(A, [["Ida", "Waiting for Ida to draw"]]);
await B.goto(URL0);
await waitRows(B, [["Jonas", "Your turn to draw"]]);
assert.match(await text(B, "#games-list"), /Round 2/);

// --- 5. Jonas starts a second game with Marte, picked from the list: no link needed ---
const M = await open("M");
await M.goto(URL0);
await makePlayer(M, "Marte");
await M.waitForSelector("#view-list:not([hidden])");
await A.click("#new-game-btn");
await A.waitForSelector("#people .person");
assert.deepEqual(await A.$$eval("#people .person", (els) => els.map((e) => e.textContent.trim())), ["Ida", "Marte"], "everyone but me, by name");
await A.click('#level-seg [data-v="hard"]');
await A.click("#people .person:has-text('Marte')");
await A.waitForSelector(".choice");
const game2 = await A.evaluate(() => window.__dd.gameId);
assert.notEqual(game2, game1);
assert.ok((await A.evaluate(() => window.__dd.game.turns.t000.choices)).every((c) => c.level === "hard"), "the picked word setting is used");
await waitRows(M, [["Jonas", "Waiting for Jonas to draw"]]);
await A.click("#back-link");
await waitRows(A, [["Marte", "Your turn to draw"], ["Ida", "Waiting for Ida to draw"]]);

// --- 6. Two games at once don't touch each other ---
await A.click("#games-list .game-row:has-text('Marte')");
await A.waitForSelector(".choice");
assert.equal(await A.evaluate(() => window.__dd.gameId), game2);
await drawAndSend(A);
assert.equal((await A.evaluate(() => window.__shares)).length, 2, "Send tells Marte through the share sheet");
await waitRows(M, [["Jonas", "Your turn to guess"]]);
await waitRows(B, [["Jonas", "Your turn to draw"]]);
await M.click("#games-list .game-row");
await M.waitForSelector("#start-guess");
assert.deepEqual(await M.$$eval(".pscore", (els) => els.map((e) => +e.textContent)), [0, 0]);
await B.click("#games-list .game-row");
await B.waitForSelector(".choice");
assert.deepEqual(await B.$$eval(".pscore", (els) => els.map((e) => +e.textContent)), [3, 3], "game 1 keeps its own score");

// Ida can't open Jonas and Marte's game
await B.goto(URL0 + "#" + game2);
await B.waitForSelector("#view-error:not([hidden])");

// --- 7. An old `main` game shows up in its players' lists, scores kept ---
const ctxOld = await browser.newContext({ viewport: { width: 412, height: 892 } });
await ctxOld.addInitScript(() => {
  if (sessionStorage.getItem("dd_uid")) return;
  sessionStorage.setItem("dd_uid", "local-old-a");
  const t = (n, drawer, extra) => ({ n, drawer, word: "cat", strokes: "[]", ...extra });
  localStorage.setItem("dd_localdb", JSON.stringify({
    games: { main: {
      lang: "en", drawSecs: 60, cur: "t001",
      players: { a: { uid: "local-old-a", name: "Jonas" }, b: { uid: "local-old-b", name: "Ida" } },
      turns: {
        t000: t(0, "a", { status: "done", result: { correct: true, ms: 1000, drawerPts: 3, guesserPts: 3 } }),
        t001: t(1, "b", { status: "draw", choices: [{ word: "dog", level: "easy" }] }),
      },
    } },
  }));
});
const O = await open("O", ctxOld);
await O.goto(URL0);
await makePlayer(O, "Jonas");
await waitRows(O, [["Ida", "Waiting for Ida to draw"]]);
await O.click("#games-list .game-row");
await O.waitForSelector("#scoreboard .is-me");
assert.equal(await O.evaluate(() => window.__dd.gameId), "main");
assert.deepEqual(await O.$$eval(".pscore", (els) => els.map((e) => +e.textContent)), [3, 3]);
await ctxOld.close();

await browser.close();
assert.deepEqual(errors, [], "console errors:\n" + errors.join("\n"));
console.log("lobby e2e: passed");
