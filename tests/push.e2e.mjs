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
  // Headless Chromium has no push service; hand out a fake FCM subscription per tab.
  PushManager.prototype.getSubscription = async () => window.__sub ?? null;
  PushManager.prototype.subscribe = async () => {
    const id = Math.random().toString(36).slice(2);
    const keys = { p256dh: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8", auth: "BTBZMqHH6r4Tts7J_aSIgg" };
    return (window.__sub = { endpoint: "https://fcm.googleapis.com/fcm/send/" + id, toJSON: () => ({ endpoint: window.__sub.endpoint, keys }) });
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
await A.fill("#name-input", "Jonas");
await A.click("#new-game-btn");
await A.waitForSelector(".choice");
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
await B.goto(URL0);
await B.fill("#join-name", "Ida");
await B.click("#join-btn");
await guessRight(B);
await drawAndSend(B);
await B.waitForSelector("#toast:has-text('Jonas gets a notification')");
assert.equal(sent.length, 1);
assert.deepEqual(sent[0].subscription, subA);
assert.equal(sent[0].title, "Ida drew something");
assert.equal(sent[0].url, ORIGIN + "/");
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

await browser.close();
assert.deepEqual(errors, [], "console errors:\n" + errors.join("\n"));
console.log("push e2e: passed");
