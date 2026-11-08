// Makes a new VAPID key pair for web push. Writes the public key into push-config.js and
// prints the private key (a JWK) to stdout only, to be piped straight into the Worker secret:
//   node tools/vapid-keys.mjs | npx wrangler secret put VAPID_PRIVATE_JWK --config worker/wrangler.toml
// Never redirect the output to a file or paste it anywhere. A new pair invalidates every
// existing subscription (each phone taps "Notify me" again).
import { readFileSync, writeFileSync } from "node:fs";

const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const { kty, crv, x, y, d } = await crypto.subtle.exportKey("jwk", kp.privateKey);
const pub = Buffer.from(await crypto.subtle.exportKey("raw", kp.publicKey)).toString("base64url");

const file = new URL("../push-config.js", import.meta.url);
const src = readFileSync(file, "utf8");
if (!/publicKey: "[^"]*"/.test(src)) throw new Error("publicKey line not found in push-config.js");
writeFileSync(file, src.replace(/publicKey: "[^"]*"/, `publicKey: "${pub}"`));
console.error("Public key written to push-config.js");
process.stdout.write(JSON.stringify({ kty, crv, x, y, d }));
