// Words already drawn in other games between the same two players aren't offered again; words
// drawn in games with someone else don't count. Local mode, with an old Jonas–Ida game that drew
// all clean easy and medium English words but three, and a Jonas–Marte game that drew those three.
// Needs the :4321 server. Run: node tests/pair-words.e2e.mjs
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { WORDS, ADULT_WORDS } from "../words.js";

const pwPath = process.env.PLAYWRIGHT || "D:/Apps/quiz-maker/node_modules/@playwright/test/index.mjs";
const { chromium } = await import(pathToFileURL(pwPath).href);
const URL0 = "http://localhost:4321/?local";
const errors = [];

const pool = [...WORDS.en.easy, ...WORDS.en.medium].filter((w) => !ADULT_WORDS.en.has(w));
const keep = pool.slice(-3).sort();
const oldGame = (b, words) => ({
  v: 1, lang: "en", wordLevel: "mixed", adult: false, drawSecs: 60,
  players: { a: { uid: "local-jonas", name: "Jonas" }, b },
  cur: "t" + String(words.length).padStart(3, "0"),
  turns: Object.fromEntries([
    ...words.map((word, n) => ["t" + String(n).padStart(3, "0"), { n, drawer: n % 2 ? "b" : "a", status: "done", word, strokes: "[]", result: { correct: false, ms: 80000, drawerPts: 0, guesserPts: 0 } }]),
    ["t" + String(words.length).padStart(3, "0"), { n: words.length, drawer: "a", status: "draw", choices: [{ word: "cat", level: "easy" }] }],
  ]),
});
const db = {
  players: { "local-jonas": { name: "Jonas" }, "local-ida": { name: "Ida" }, "local-marte": { name: "Marte" } },
  users: { "local-jonas": { games: { oldida: true, oldmarte: true } }, "local-ida": { games: { oldida: true } } },
  games: {
    oldida: oldGame({ uid: "local-ida", name: "Ida" }, pool.filter((w) => !keep.includes(w))),
    oldmarte: oldGame({ uid: "local-marte", name: "Marte" }, keep),
  },
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true, locale: "en-US" });
await ctx.addInitScript((db) => {
  window.__shares = [];
  navigator.share = async (data) => void window.__shares.push(data);
  if (!localStorage.getItem("dd_localdb")) localStorage.setItem("dd_localdb", JSON.stringify(db));
}, db);
const open = async (label, uid) => {
  const p = await ctx.newPage();
  await p.addInitScript((uid) => {
    if (sessionStorage.getItem("dd_uid")) return;
    sessionStorage.setItem("dd_uid", uid);
    sessionStorage.setItem("dd_signedin", "1");
  }, uid);
  p.on("console", (m) => m.type() === "error" && errors.push(`${label}: ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  return p;
};
const choices = (p) => p.evaluate(() => window.__dd.game.turns[window.__dd.game.cur].choices.map((c) => c.word).sort());

// --- 1. A new game with Ida offers only the words the two of them haven't drawn ---
const A = await open("A", "local-jonas");
await A.goto(URL0 + "#new");
await A.waitForSelector("#people .person");
await A.click('#new-adult-seg [data-v="off"]');
await A.click("#people .person:has-text('Ida')");
await A.waitForSelector(".choice");
assert.deepEqual(await choices(A), keep, "words from the old Jonas–Ida game are skipped; the Jonas–Marte game doesn't count");

// --- 2. Choices drawn again (adult words switched on, then off) skip them too ---
await A.click('#adult-seg [data-v="on"]');
await A.waitForFunction(() => window.__dd.game.adult === true);
await A.click('#adult-seg [data-v="off"]');
await A.waitForFunction(() => window.__dd.game.adult === false);
assert.deepEqual(await choices(A), keep, "redrawn choices skip the pair's words");

// --- 3. The next round's choices skip them too ---
await A.locator(".choice").first().click();
await A.waitForSelector("#draw-canvas");
const drawn = await A.evaluate(() => window.__dd.game.turns.t000.word);
await A.click("#done-btn");
await A.waitForSelector("#share-btn");
const gameId = await A.evaluate(() => window.__dd.gameId);
const B = await open("B", "local-ida");
await B.goto(URL0 + "#" + gameId);
await B.click("#start-guess");
await B.waitForSelector("#guess-canvas");
await B.fill("#guess-input", drawn);
await B.press("#guess-input", "Enter");
await B.waitForSelector(".choice");
const next = await choices(B);
for (const w of keep.filter((w) => w !== drawn)) assert.ok(next.includes(w), `round 2 offers the unused ${w}: ${next}`);

await browser.close();
assert.deepEqual(errors, [], "console errors:\n" + errors.join("\n"));
console.log("pair words e2e: passed");
