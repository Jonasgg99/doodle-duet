// Notifications end to end in local mode. The browser's push service and the Cloudflare
// Worker are stubbed at the edges (PushManager.subscribe, and the Worker URL via page.route);
// the service worker is real and gets a push delivered through Chromium's DevTools protocol.
// Needs the :8124 server. Run: node tests/push.e2e.mjs
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const pwPath = process.env.PLAYWRIGHT || "D:/Apps/quiz-maker/node_modules/@playwright/test/index.mjs";
const { chromium } = await import(pathToFileURL(pwPath).href);
const ORIGIN = "http://localhost:8124";
const URL0 = ORIGIN + "/?local";
const WORKER = "https://push.test";
const errors = [];

// Full Chromium headless: the default headless shell always reports notifications as denied.
const browser = await chromium.launch({ channel: "chromium" });
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true, permissions: ["notifications"] });
await ctx.route("**/push-config.js", (r) =>
  r.fulfill({
    contentType: "text/javascript",
    body: `export const PUSH = { worker: "${WORKER}", publicKey: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4" };`,
  })
);
const sent = [];
let workerReply = { status: 201 };
await ctx.route(WORKER + "/**", (r) => {
  const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json" };
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers });
  sent.push(r.request().postDataJSON());
  return r.fulfill({ status: 200, headers, body: JSON.stringify(workerReply) });
});
await ctx.addInitScript(() => {
  window.__shares = [];
  navigator.share = async (data) => void window.__shares.push(data);
  // Headless Chromium has no push service; hand out a fake FCM subscription per tab, kept in
  // sessionStorage ({endpoint, key: the applicationServerKey as a byte array}) so it survives a reload.
  const keys = { p256dh: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8", auth: "BTBZMqHH6r4Tts7J_aSIgg" };
  const fake = (s) => ({
    endpoint: s.endpoint,
    options: { applicationServerKey: new Uint8Array(s.key).buffer, userVisibleOnly: true },
    toJSON: () => ({ endpoint: s.endpoint, keys }),
    unsubscribe: async () => (sessionStorage.removeItem("__sub"), true),
  });
  PushManager.prototype.getSubscription = async () => {
    const s = sessionStorage.getItem("__sub");
    return s ? fake(JSON.parse(s)) : null;
  };
  PushManager.prototype.subscribe = async (opts) => {
    if (sessionStorage.getItem("__sub")) throw new DOMException("already subscribed with a different key", "InvalidStateError");
    const s = { endpoint: "https://fcm.googleapis.com/fcm/send/" + Math.random().toString(36).slice(2), key: [...new Uint8Array(opts.applicationServerKey)] };
    sessionStorage.setItem("__sub", JSON.stringify(s));
    return fake(s);
  };
});

const open = async (label) => {
  const p = await ctx.newPage();
  p.on("console", (m) => m.type() === "error" && errors.push(`${label}: ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  return p;
};
const text = (p, sel) => p.locator(sel).innerText();
const shares = (p) => p.evaluate(() => window.__shares.length);
const pushOf = (p) => p.evaluate(() => window.__dd.game.push || {});
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
async function makePlayer(p, name) {
  await p.waitForSelector("#view-setup:not([hidden])");
  await p.fill("#player-name", name);
  await p.click("#signin-btn");
}
async function guessRight(p) {
  await p.click("#start-guess");
  await p.waitForSelector("#guess-canvas");
  const word = await p.evaluate(() => window.__dd.game.turns[window.__dd.game.cur].word);
  await p.fill("#guess-input", word);
  await p.press("#guess-input", "Enter");
  await p.waitForSelector(".choice");
}

// Jonas starts; Ida hasn't joined, so Send still opens the share sheet.
const A = await open("A");
await A.goto(URL0);
await makePlayer(A, "Jonas");
await A.click("#new-game-btn");
await A.click("#invite-btn");
await A.waitForSelector(".choice");
const ID = await A.evaluate(() => window.__dd.gameId);
await drawAndSend(A);
assert.equal(await shares(A), 1, "invite goes through the share sheet");

// 1. The waiting screen offers notifications; turning them on stores this phone's subscription.
await A.click("#push-btn");
await A.waitForSelector("text=You'll get a notification");
const subA = (await pushOf(A)).a;
assert.match(subA?.endpoint ?? "", /^https:\/\/fcm\.googleapis\.com\//);
assert.ok(subA.keys.p256dh && subA.keys.auth);

// 2. Ida draws: Jonas has push, so the Worker is asked to notify him and no share sheet opens.
const B = await open("B");
await B.goto(URL0 + "#" + ID);
await makePlayer(B, "Ida");
await B.click("#join-btn");
await guessRight(B);
await drawAndSend(B);
await B.waitForSelector("#toast:has-text('Jonas gets a notification')");
assert.equal(sent.length, 1);
assert.deepEqual(sent[0].subscription, subA);
assert.equal(sent[0].title, "Ida drew something");
assert.equal(sent[0].url, ORIGIN + "/#" + ID, "the notification opens this game");
assert.equal(await shares(B), 0, "no share sheet when the partner gets a notification");

// 4. Ida turns hers on; later her subscription turns out dead, so it is forgotten.
await B.click("#push-btn");
await B.waitForSelector("text=You'll get a notification");
assert.ok((await pushOf(A)).b, "Ida's subscription is stored");
workerReply = { status: 410, gone: true };
await guessRight(A);
await drawAndSend(A);
await A.waitForSelector("#toast:has-text('Couldn\\'t notify Ida')");
assert.equal(sent.length, 2);
assert.equal(sent[1].title, "Jonas drew something");
assert.equal((await pushOf(A)).b, undefined, "dead subscription removed");
assert.equal(await shares(A), 1, "still no extra share sheet");

// 5. The real service worker shows a delivered push as a notification.
const cdp = await ctx.newCDPSession(A);
const regId = new Promise((res) =>
  cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
    const r = registrations.find((x) => x.scopeURL === ORIGIN + "/" && !x.isDeleted);
    if (r) res(r.registrationId);
  })
);
await cdp.send("ServiceWorker.enable");
await cdp.send("ServiceWorker.deliverPushMessage", {
  origin: ORIGIN,
  registrationId: await regId,
  data: JSON.stringify({ title: "Ida drew something", body: "Your turn to guess in Doodle Duet.", url: ORIGIN + "/" }),
});
let shown = [];
for (let i = 0; i < 30 && !shown.length; i++) {
  await A.waitForTimeout(200);
  shown = await A.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => [n.title, n.body, n.tag]));
}
assert.deepEqual(shown, [["Ida drew something", "Your turn to guess in Doodle Duet.", "doodle-duet"]]);

// 6. After a VAPID key change, a phone's subscription made with the old key is replaced on its
// next visit, without tapping anything, and the new one is stored for the partner to use.
const OLD = "https://fcm.googleapis.com/fcm/send/old-key";
await A.evaluate(([endpoint, id]) => {
  sessionStorage.setItem("__sub", JSON.stringify({ endpoint, key: Array(65).fill(4) }));
  const db = JSON.parse(localStorage.getItem("dd_localdb"));
  db.games[id].push.a = { endpoint, keys: { p256dh: "x", auth: "y" } };
  localStorage.setItem("dd_localdb", JSON.stringify(db));
}, [OLD, ID]);
await A.reload();
let renewed;
for (let i = 0; i < 30; i++) {
  renewed = (await pushOf(A)).a?.endpoint;
  if (renewed && renewed !== OLD) break;
  await A.waitForTimeout(100);
}
assert.ok(renewed && renewed !== OLD, "old-key subscription replaced: " + renewed);
assert.ok(await A.evaluate(async () => {
  const s = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  const want = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
  const b = Uint8Array.from(atob(want.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  return s.endpoint !== "" && new Uint8Array(s.options.applicationServerKey).every((x, i) => x === b[i]);
}), "new subscription uses the current key");

// 7. A game started from the list has no notification address yet; opening the games list puts
// this phone's into every game of yours that lacks it, so the partner can notify you there too.
await A.goto(URL0);
await A.click("#new-game-btn");
await A.click("#people .person:has-text('Ida')");
await A.waitForSelector(".choice");
const ID2 = await A.evaluate(() => window.__dd.gameId);
await A.goto(URL0);
await A.waitForSelector("#games-list .game-row >> nth=1");
let inGame2;
for (let i = 0; i < 30 && !inGame2; i++) {
  inGame2 = await A.evaluate((id) => JSON.parse(localStorage.getItem("dd_localdb")).games[id].push?.a?.endpoint, ID2);
  if (!inGame2) await A.waitForTimeout(100);
}
assert.equal(inGame2, renewed, "the list stored this phone's subscription in the new game");

// 8. A game from someone Jonas has never played doesn't get his notification address just
// because it appears in his list; it gets it once he opens that game himself.
const M = await open("M");
await M.goto(URL0);
await makePlayer(M, "Marte");
await M.click("#new-game-btn");
await M.click("#people .person:has-text('Jonas')");
await M.waitForSelector(".choice");
const ID3 = await M.evaluate(() => window.__dd.gameId);
await A.waitForSelector("#games-list .game-row:has-text('Marte')");
await A.waitForTimeout(800);
const pushIn3 = () => A.evaluate((id) => JSON.parse(localStorage.getItem("dd_localdb")).games[id].push?.b?.endpoint ?? null, ID3);
assert.equal(await pushIn3(), null, "a stranger's game must not get Jonas's subscription from the list");
await A.click("#games-list .game-row:has-text('Marte')");
await A.waitForSelector("#scoreboard .is-me");
let opened3;
for (let i = 0; i < 30 && !opened3; i++) {
  opened3 = await pushIn3();
  if (!opened3) await A.waitForTimeout(100);
}
assert.equal(opened3, renewed, "opening the game turns notifications on there");

await browser.close();
assert.deepEqual(errors, [], "console errors:\n" + errors.join("\n"));
console.log("push e2e: passed");
