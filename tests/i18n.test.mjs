// App text in English and Norwegian. Tests mirror .work/active/i18n.md (Acceptance), written
// before i18n.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STRINGS, detectLang, translator } from "../i18n.js";
import { WORD_SETTINGS, STATUS_KINDS, gameStatus } from "../game.js";

const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test("a phone set to Norwegian gets Norwegian, anything else English, and the switch wins", () => {
  for (const l of ["nb-NO", "nb", "nn-NO", "no", "NB-no"]) assert.equal(detectLang(null, [l, "en-US"]), "no", l);
  for (const l of ["en-US", "en-NO", "sv-SE", "de"]) assert.equal(detectLang(null, [l, "nb-NO"]), "en", l);
  assert.equal(detectLang(null, []), "en");
  assert.equal(detectLang(null, undefined), "en");
  assert.equal(detectLang("en", ["nb-NO"]), "en");
  assert.equal(detectLang("no", ["en-US"]), "no");
  assert.equal(detectLang("xx", ["nb-NO"]), "no", "an unknown stored choice is ignored");
});

test("every text exists in both languages, with the same placeholders", () => {
  assert.deepEqual(Object.keys(STRINGS.no).sort(), Object.keys(STRINGS.en).sort());
  for (const [k, en] of Object.entries(STRINGS.en)) {
    const no = STRINGS.no[k];
    assert.equal(typeof no, typeof en, k);
    if (typeof en === "string") {
      assert.deepEqual(placeholders(no), placeholders(en), k);
      assert.ok(no.trim(), k);
    }
  }
});

test("texts fill in their values, and unknown languages or keys fall back", () => {
  const no = translator("no"), en = translator("en");
  assert.equal(en("round", { n: 3 }), "Round 3");
  assert.equal(no("round", { n: 3 }), "Runde 3");
  assert.equal(translator("xx")("round", { n: 3 }), "Round 3");
  assert.equal(translator("__proto__")("round", { n: 3 }), "Round 3");
  assert.equal(translator(undefined)("round", { n: 3 }), "Round 3");
  assert.equal(en("no such key"), "no such key");
});

test("counts read right for one and for many", () => {
  const no = translator("no"), en = translator("en");
  assert.equal(en("guessesLeft", { n: 1 }), "1 wrong guess left");
  assert.equal(en("guessesLeft", { n: 2 }), "2 wrong guesses left");
  assert.equal(no("guessesLeft", { n: 1 }), "1 feil gjetning igjen");
  assert.equal(no("guessesLeft", { n: 3 }), "3 feil gjetninger igjen");
  assert.equal(en("plusPoints", { n: 1 }), "+1 point");
  assert.equal(en("plusPoints", { n: 3 }), "+3 points");
  assert.equal(no("plusPoints", { n: 1 }), "+1 poeng");
});

test("letter hint: the count per word, so the guesser doesn't have to count blanks", () => {
  const no = translator("no"), en = translator("en");
  assert.equal(en("letters", { word: "elephant" }), "8 letters");
  assert.equal(en("letters", { word: "ice cream" }), "3 + 5 letters");
  assert.equal(en("letters", { word: "blåbær" }), "6 letters");
  assert.equal(en("letters", { word: "a" }), "1 letter");
  assert.equal(no("letters", { word: "blåbær" }), "6 bokstaver");
  assert.equal(no("letters", { word: "is krem" }), "2 + 4 bokstaver");
  assert.equal(no("letters", { word: "å" }), "1 bokstav");
});

test("every text the app asks for exists", () => {
  const app = read("app.js");
  const used = [...app.matchAll(/\bt[tT]?(?:For\([^()]*\))?\("(\w+)"\s*[,)]/g)].map((m) => m[1]); // whole keys; built ones below
  for (const k of ["shareJoin", "notifyBody"]) assert.ok(used.includes(k), "the scan sees the partner's texts: " + k);
  assert.ok(used.length > 80, "found the app's texts: " + used.length);
  const html = read("index.html");
  const inHtml = [...html.matchAll(/data-i18n(?:-[\w-]+)?="(\w+)"/g)].map((m) => m[1]);
  assert.ok(inHtml.length > 15, "found the page's texts: " + inHtml.length);
  const built = [
    ...STATUS_KINDS.map((k) => "st_" + k),
    ...WORD_SETTINGS.map((v) => "level_" + v),
    "adult_on",
    "adult_off",
  ];
  for (const k of [...used, ...inHtml, ...built]) assert.ok(Object.hasOwn(STRINGS.en, k), "missing text: " + k);
});

test("notification text fits what the Worker accepts", () => {
  for (const lang of ["en", "no"]) {
    const t = translator(lang);
    const name = "x".repeat(20);
    assert.ok(t("drewSomething", { name }).length <= 80, lang);
    assert.ok(t("notifyBody").length <= 160, lang);
  }
});
