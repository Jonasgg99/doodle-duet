// App text in the phone's language, end to end in local mode: Jonas's phone is Norwegian, Ida's
// English, in one game. Each sees their own language; what one sends the other (share sheet,
// notification) is in the receiver's language once the game knows it. The switch on the games
// list overrides the phone. Narrow phone, so longer Norwegian text must not cause side scroll.
// Needs the :8124 server. Run: node tests/i18n.e2e.mjs
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const pwPath = process.env.PLAYWRIGHT || "D:/Apps/quiz-maker/node_modules/@playwright/test/index.mjs";
const { chromium } = await import(pathToFileURL(pwPath).href);
const URL0 = "http://localhost:8124/?local";
const WORKER = "https://push.test";
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, locale: "en-US" });
// Notifications: a stub Worker records what would be sent (the push service itself isn't needed).
await ctx.route("**/push-config.js", (r) =>
  r.fulfill({ contentType: "text/javascript", body: `export const PUSH = { worker: "${WORKER}", publicKey: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4" };` })
);
const sent = [];
await ctx.route(WORKER + "/**", (r) => {
  const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json" };
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers });
  sent.push(r.request().postDataJSON());
  return r.fulfill({ status: 200, headers, body: JSON.stringify({ status: 201 }) });
});
await ctx.addInitScript(() => {
  window.__shares = [];
  navigator.share = async (data) => void window.__shares.push(data);
});
// One browser profile holds both players (local mode), so the phone language is set per tab.
const open = async (label, languages) => {
  const p = await ctx.newPage();
  if (languages) await p.addInitScript((l) => Object.defineProperty(navigator, "languages", { get: () => l }), languages);
  p.on("console", (m) => m.type() === "error" && errors.push(`${label}: ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  return p;
};
const text = (p, sel) => p.locator(sel).innerText();
const lastShare = (p) => p.evaluate(() => window.__shares.at(-1)?.text);
const noSideScroll = async (p, where) =>
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no side scroll: " + where);

async function makePlayer(p, name) {
  await p.waitForSelector("#view-setup:not([hidden])");
  await p.fill("#player-name", name);
  await p.click("#signin-btn");
}
async function drawAndSend(p) {
  await p.locator(".choice").first().click();
  await p.waitForSelector("#draw-canvas");
  await noSideScroll(p, "drawing");
  const b = await p.locator("#draw-canvas").boundingBox();
  await p.mouse.move(b.x + 60, b.y + 60);
  await p.mouse.down();
  await p.mouse.move(b.x + 200, b.y + 260, { steps: 8 });
  await p.mouse.up();
  await p.click("#done-btn");
  await p.waitForSelector("#share-btn");
}
async function guessRight(p) {
  await p.click("#start-guess");
  await p.waitForSelector("#guess-canvas");
  await noSideScroll(p, "guessing");
  const word = await p.evaluate(() => window.__dd.game.turns[window.__dd.game.cur].word);
  await p.fill("#guess-input", word);
  await p.press("#guess-input", "Enter");
  await p.waitForSelector(".choice");
}

// --- 1. A Norwegian phone's first visit is in Norwegian ---
const A = await open("A", ["nb-NO", "en-US"]);
await A.goto(URL0);
await A.waitForSelector("#view-setup:not([hidden])");
assert.equal(await A.evaluate(() => document.documentElement.lang), "nb");
assert.match(await text(A, "#view-setup"), /Lag spilleren din/);
assert.equal(await text(A, "#signin-btn"), "Fortsett med Google");
assert.equal(await A.getAttribute("#player-name", "placeholder"), "Navnet andre spillere ser");
await makePlayer(A, "Jonas");
await A.waitForSelector("#view-list:not([hidden])");
assert.match(await text(A, "#view-list"), /Spillene dine/);
assert.match(await text(A, "#list-empty"), /Ingen spill ennå/);
assert.equal(await text(A, "#me-name"), "Du spiller som Jonas");
await A.waitForSelector('#ui-seg [data-v="no"][aria-checked="true"]');
await noSideScroll(A, "games list");

// --- 2. Starting a game: Norwegian words by default, invite text in Jonas's language ---
await A.click("#new-game-btn");
await A.waitForSelector("#view-new:not([hidden])");
assert.match(await text(A, "#view-new"), /Spill med/);
await A.waitForSelector('#lang-seg [data-v="no"][aria-checked="true"]');
await A.waitForSelector('#level-seg [data-v="mixed"]:has-text("Blandet")');
await noSideScroll(A, "new game");
await A.click("#invite-btn");
await A.waitForSelector(".choice");
assert.match(await text(A, "#panel"), /Velg et ord å tegne/);
assert.equal(await A.evaluate(() => window.__dd.game.lang), "no");
const ID = await A.evaluate(() => window.__dd.gameId);
await drawAndSend(A);
assert.match(await text(A, "#panel"), /Tegningen er sendt!/);
assert.match(await lastShare(A), /^Spill Doodle Duet med meg!/, "nobody has joined: the sender's language");
await noSideScroll(A, "waiting");

// --- 3. Ida's English phone: English screens, Norwegian text to Jonas ---
const B = await open("B", ["en-US"]);
await B.goto(URL0 + "#" + ID);
await makePlayer(B, "Ida");
await B.waitForSelector("#join-btn");
assert.equal(await text(B, "#join-title"), "Jonas invited you to Doodle Duet");
await B.click("#join-btn");
await B.waitForSelector("#start-guess");
assert.match(await text(B, "#panel"), /Jonas drew something/);
assert.deepEqual(await B.evaluate(() => [window.__dd.game.players.a.lang, window.__dd.game.players.b.lang]), ["no", "en"]);
await guessRight(B);
assert.match(await text(B, ".result-banner"), /You got it!/);
await drawAndSend(B);
assert.match(await text(B, "#panel"), /Waiting for Jonas to guess/);
assert.equal(await lastShare(B), "Tegningen min er klar til å gjettes i Doodle Duet.", "to Jonas, in Norwegian");

// --- 4. Jonas's list and game stay Norwegian; his text to Ida is English ---
await A.goto(URL0);
await A.waitForSelector("#games-list .game-row");
assert.equal(await text(A, "#games-list .gr-status"), "Din tur til å gjette");
assert.equal(await text(A, "#games-list .gr-round"), "Runde 2");
await A.click("#games-list .game-row");
await A.waitForSelector("#start-guess");
assert.match(await text(A, "#panel"), /Ida har tegnet noe/);
assert.match(await text(A, "#scoreboard"), /poeng/i);
assert.equal(await text(A, "#reseat-btn"), "La Ida bli med igjen fra en ny telefon eller nettleser");
assert.deepEqual(await A.$$eval("#word-seg button, #adult-seg button", (els) => els.map((e) => e.textContent)), ["Lett", "Blandet", "Vanskelig", "Med", "Uten"]);
await noSideScroll(A, "game with both players, reseat button showing");
await A.click("#start-guess");
await A.waitForSelector("#guess-canvas");
assert.equal(await A.getAttribute("#guess-input", "placeholder"), "Skriv en gjetning");
assert.match(await text(A, "#guess-left"), /3 feil gjetninger igjen/);
assert.match(await text(A, ".blank-count"), /bokstav/);
const word = await A.evaluate(() => window.__dd.game.turns[window.__dd.game.cur].word);
await A.fill("#guess-input", word);
await A.press("#guess-input", "Enter");
await A.waitForSelector(".choice");
assert.match(await text(A, ".result-banner"), /Du klarte det!/);
assert.match(await text(A, "#history"), /Du tegnet/);
// Jonas turns on notifications (stored straight into the game: the push service isn't needed here)
await A.evaluate((id) => window.__dd.store.update(`games/${id}/push`, { a: { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: "p", auth: "a" } } }), ID);
await drawAndSend(A);
assert.equal(await lastShare(A), "My drawing is ready for you to guess in Doodle Duet.", "to Ida, in English");

// --- 5. Ida's drawing notifies Jonas in Norwegian; her own toast is English ---
await B.waitForSelector("#start-guess");
await guessRight(B);
await drawAndSend(B);
await B.waitForSelector("#toast:has-text('Jonas gets a notification')");
assert.equal(sent.length, 1);
assert.deepEqual([sent[0].title, sent[0].body], ["Ida har tegnet noe", "Din tur til å gjette i Doodle Duet."]);

// --- 6. The switch overrides the phone, and is remembered ---
await A.goto(URL0);
await A.waitForSelector('#ui-seg [data-v="en"]');
await Promise.all([A.waitForEvent("load"), A.click('#ui-seg [data-v="en"]')]);
await A.waitForSelector("#games-list .game-row");
assert.match(await text(A, "#view-list"), /Your games/);
assert.equal(await text(A, "#games-list .gr-status"), "Your turn to guess");
assert.equal(await A.evaluate(() => document.documentElement.lang), "en");
await A.click("#games-list .game-row");
await A.waitForFunction(() => window.__dd.game?.players.a.lang === "en", null, { timeout: 5000 })
  .catch(() => assert.fail("opening the game stores Jonas's new language for Ida's phone"));
await A.goto(URL0);
await A.reload();
await A.waitForSelector('#ui-seg [data-v="en"][aria-checked="true"]');
assert.match(await text(A, "#view-list"), /Your games/);
await Promise.all([A.waitForEvent("load"), A.click('#ui-seg [data-v="no"]')]);
await A.waitForSelector("#games-list .game-row");
assert.match(await text(A, "#view-list"), /Spillene dine/);

await browser.close();
assert.deepEqual(errors, [], "console errors:\n" + errors.join("\n"));
console.log("i18n e2e: passed");
