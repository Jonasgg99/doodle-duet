// Prints the full rules for the shared choice-maker Firebase project: choice-timer's rules
// with this game's "doodleDuet" block added. Paste the output into Firebase console >
// Realtime Database > Rules, replacing everything, then Publish.
// Run: node tools/combine-rules.mjs > combined-rules.json
import { readFileSync } from "node:fs";
const ct = JSON.parse(readFileSync(new URL("../../choice-timer/FIREBASE-RULES.json", import.meta.url), "utf8"));
const dd = JSON.parse(readFileSync(new URL("../FIREBASE-RULES.json", import.meta.url), "utf8"));
if (ct.rules.doodleDuet) throw new Error("choice-timer rules already have a doodleDuet key");
process.stdout.write(JSON.stringify({ rules: { ...ct.rules, ...dd.rules } }, null, 2) + "\n");
