// Right after a deploy a phone can get the new index.html with an old, cached app.js, which
// crashes on start. This serves the previous app.js once (as a stale cache would) and checks the
// page heals itself: re-downloads its files, reloads, and reaches the setup screen.
// Needs `python -m http.server 4321`. Run: node tests/stale-deploy.e2e.mjs
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const pwPath = process.env.PLAYWRIGHT || "D:/Apps/quiz-maker/node_modules/@playwright/test/index.mjs";
const { chromium } = await import(pathToFileURL(pwPath).href);
const oldApp = execSync("git show 5f87409:app.js", { encoding: "utf8" }); // version with the code box
assert.match(oldApp, /join-code-form/);

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let staleServed = 0;
await page.route("**/app.js", (route) => {
  if (staleServed++ === 0) return route.fulfill({ body: oldApp, contentType: "text/javascript" });
  return route.continue();
});
await page.goto("http://localhost:4321/?local");
await page.waitForSelector("#view-setup:not([hidden])", { timeout: 15_000 });
assert.ok(errors.length > 0, "the stale script did crash first"); // where depends on which element it misses
assert.ok(staleServed >= 2, "app.js was downloaded again");
await browser.close();
console.log("stale-deploy self-heal: passed");
