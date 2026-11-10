// Live test against the real Firebase backend: separate browser profiles (so separate anonymous
// identities) make players, play a round by invite link, and the database rules are checked
// for what a stranger must not do. Google sign-in can't run headless, so the profiles skip it
// (localStorage dd_skip_google; the rules don't depend on it). Test players are named "zz test …"
// and removed from the player list at the end; the small test games stay.
// Run: node tests/firebase.e2e.mjs [base-url]   (default http://localhost:8124/)
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const pwPath = process.env.PLAYWRIGHT || "D:/Apps/quiz-maker/node_modules/@playwright/test/index.mjs";
const { chromium } = await import(pathToFileURL(pwPath).href);
const BASE = process.argv[2] || "http://localhost:8124/";
const errors = [];
const browser = await chromium.launch();
const pages = [];
const phone = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem("dd_skip_google", "1"));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/permission_denied/i.test(m.text()) && errors.push(`${label}: ${m.text()}`));
  pages.push(p);
  return p;
};
const T = { timeout: 20_000 };
async function makePlayer(p, name) {
  await p.waitForSelector("#view-setup:not([hidden])", T);
  await p.fill("#player-name", name);
  await p.click("#signin-btn");
}
// Runs a database write as this page's player; resolves "ok" or the error code.
const tryWrite = (p, op, path, value) =>
  p.evaluate(async ([op, path, value]) => {
    try {
      await window.__dd.store[op](path, value);
      return "ok";
    } catch (e) {
      return String(e.code || e.message);
    }
  }, [op, path, value]);
const tryRead = (p, path) =>
  p.evaluate(async (path) => {
    try {
      await window.__dd.store.get(path);
      return "ok";
    } catch (e) {
      return String(e.code || e.message);
    }
  }, path);
const uidOf = (p) => p.evaluate(() => window.__dd.store.uid);
const DENIED = /permission.denied/i;

try {
  // --- A makes a player and starts a game by invite link ---
  const A = await phone("A");
  await A.goto(BASE);
  await makePlayer(A, "zz test A");
  await A.waitForSelector("#view-list:not([hidden])", T);
  assert.ok(await A.locator("#mode-tag").isHidden(), "should be in Firebase mode");
  await A.click("#new-game-btn");
  await A.click("#invite-btn", T);
  await A.waitForSelector(".choice", T);
  const gameId = await A.evaluate(() => window.__dd.gameId);
  const gameUrl = BASE + "#" + gameId;
  await A.locator(".choice").first().click();
  await A.waitForSelector("#draw-canvas", T);
  const box = await A.locator("#draw-canvas").boundingBox();
  await A.mouse.move(box.x + 50, box.y + 50);
  await A.mouse.down();
  await A.mouse.move(box.x + 250, box.y + 300, { steps: 10 });
  await A.mouse.up();
  await A.click("#done-btn");
  await A.waitForSelector("#share-btn", T);

  // --- B opens the link, makes a player, joins and guesses ---
  const B = await phone("B");
  await B.goto(gameUrl);
  await makePlayer(B, "zz test B");
  await B.click("#join-btn", T);
  await B.click("#start-guess", T);
  await B.waitForSelector("#guess-canvas", T);
  const word = await B.evaluate(() => window.__dd.game.turns[window.__dd.game.cur].word);
  await B.fill("#guess-input", word);
  await B.press("#guess-input", "Enter");
  await B.waitForSelector(".result-banner", T);
  assert.match(await B.locator(".result-banner").innerText(), /You got it/);
  await A.waitForSelector(".result-banner", T); // drawer sees the outcome live

  // Both lists show the game
  await A.goto(BASE);
  await A.waitForSelector("#games-list .game-row:has-text('zz test B')", T);
  await B.goto(BASE);
  await B.waitForSelector("#games-list .game-row:has-text('Your turn to draw')", T);

  // --- A stranger, C, against the rules ---
  const C = await phone("C");
  await C.goto(gameUrl);
  await makePlayer(C, "zz test C");
  await C.waitForSelector("#view-error:not([hidden])", T);
  const [a, b, c] = [await uidOf(A), await uidOf(B), await uidOf(C)];
  assert.match(await tryWrite(C, "set", `games/${gameId}/players/b`, { uid: c, name: "intruder" }), DENIED, "take a seat");
  assert.match(await tryRead(C, `users/${a}/games`), DENIED, "read someone's games list");
  assert.match(await tryWrite(C, "set", `players/${a}/name`, "renamed"), DENIED, "rename someone");
  assert.match(await tryWrite(C, "set", `users/${a}/games/${gameId}`, true), DENIED, "add a game they're not in to someone's list");
  assert.equal(await tryRead(C, "players"), "ok", "the player list is readable");
  const ghost = "zzghost" + Date.now().toString(36);
  const fake = { v: 1, lang: "en", drawSecs: 60, cur: "t000", players: { a: { uid: c, name: "zz test C" }, b: { uid: "nobody-" + ghost, name: "x" } }, turns: { t000: { n: 0, drawer: "a", status: "draw", choices: [{ word: "cat", level: "easy" }] } } };
  assert.match(await tryWrite(C, "set", `games/${ghost}`, fake), DENIED, "start a game with someone who isn't a player");
  const odd = { ...fake, players: { a: { uid: c, name: 5 }, b: { uid: a, name: "zz test A" } } };
  assert.match(await tryWrite(C, "set", `games/${ghost}`, odd), DENIED, "a player name in a game must be text");
  // ...but starting one with a listed player and putting it in their list is allowed
  const g2 = "zzpick" + Date.now().toString(36);
  const real = { ...fake, players: { a: fake.players.a, b: { uid: a, name: "zz test A" } } };
  assert.equal(await tryWrite(C, "set", `games/${g2}`, real), "ok", "start a game with a listed player");
  assert.equal(await tryWrite(C, "set", `users/${a}/games/${g2}`, true), "ok", "add it to their list");
  assert.match(await tryWrite(C, "set", `users/${a}/games/${g2}`, null), DENIED, "but not remove games from their list");
  assert.match(await tryWrite(B, "set", `users/${a}/games/${g2}`, true), DENIED, "only the game's starter adds it to the other's list");
  await A.waitForSelector("#games-list .game-row:has-text('zz test C')", T);
  assert.equal(await tryWrite(C, "set", `games/${g2}`, null), "ok");

  // Closing and reopening keeps your seat and your player
  await A.goto(gameUrl);
  await A.waitForSelector("#scoreboard .is-me", T);
  assert.match(await A.locator("#scoreboard .is-me").innerText(), /zz test A/);

  // B moves to another browser (C): A lets B join again, C takes the seat with scores kept
  const scoresOf = (p) => p.$$eval(".pscore", (els) => els.map((e) => +e.textContent));
  const before = await scoresOf(A);
  A.once("dialog", (d) => d.accept());
  await A.click("#reseat-btn", T);
  await C.reload();
  await C.click("#join-btn", T);
  await C.waitForSelector(".choice", T); // it was B's turn to draw
  assert.deepEqual(await scoresOf(C), before);
  await B.goto(gameUrl);
  await B.waitForSelector("#view-error:not([hidden])", T);
} finally {
  // Remove the test players from the list (and their games lists).
  for (const p of pages) {
    await p.evaluate(async () => {
      const s = window.__dd?.store;
      if (!s) return;
      await s.set(`players/${s.uid}`, null).catch(() => {});
      await s.set(`users/${s.uid}`, null).catch(() => {});
    }).catch(() => {});
  }
  await browser.close();
}
assert.deepEqual(errors, [], errors.join("\n"));
console.log("firebase e2e: passed against " + BASE);
