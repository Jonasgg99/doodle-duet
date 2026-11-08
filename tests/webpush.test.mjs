// Run: node --test "tests/*.test.mjs"
// Web Push sender (worker/webpush.js) and the Cloudflare Worker (worker/index.js).
// Encryption is checked against the RFC 8291 Appendix A test vector, not just against itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { b64u, encryptPayload, vapidAuthorization, isPushEndpoint } from "../worker/webpush.js";
import worker from "../worker/index.js";

const subtle = crypto.subtle;
const join = (s) => s.replace(/\s+/g, "");

// RFC 8291, Section 5 and Appendix A
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPublic: join("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIg Dll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"),
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic: join("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcx aOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4"),
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  header: join("DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z 9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml mlMoZIIgDll6e3vCYLocInmYWAmS6Tlz AC8wEqKK6PBru3jl7A8"),
  ciphertext: join("8pfeW0KbunFT06SuDKoJH9Ql87S1QUrd irN6GcG7sFz1y1sqLgVi1VhjVkHsUoEs bI_0LpXMuGvnzQ"),
};

const jwkFromRaw = (pub, d) => {
  const p = b64u.decode(pub);
  return { kty: "EC", crv: "P-256", x: b64u.encode(p.slice(1, 33)), y: b64u.encode(p.slice(33, 65)), ...(d ? { d } : {}) };
};

test("payload encryption matches the RFC 8291 test vector exactly", async () => {
  const asKeys = {
    privateKey: await subtle.importKey("jwk", jwkFromRaw(RFC.asPublic, RFC.asPrivate), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]),
    publicRaw: b64u.decode(RFC.asPublic),
  };
  const body = await encryptPayload({
    plaintext: new TextEncoder().encode(RFC.plaintext),
    uaPublic: b64u.decode(RFC.uaPublic),
    authSecret: b64u.decode(RFC.auth),
    salt: b64u.decode(RFC.salt),
    asKeys,
  });
  // Compare bytes: the 86-byte header's base64 doesn't end on a 3-byte boundary, so the
  // two base64 strings can't simply be joined.
  assert.equal(b64u.encode(body.slice(0, 86)), RFC.header);
  assert.equal(b64u.encode(body.slice(86)), RFC.ciphertext);
});

// Receiver side of RFC 8291, used to prove random-key messages decrypt.
async function decrypt(body, uaPrivateKey, uaPublicRaw, authSecret) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const ct = body.slice(21 + idlen);
  const asKey = await subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: asKey }, uaPrivateKey, 256));
  const hkdf = async (s, ikm, info, len) => {
    const k = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: s, info }, k, len * 8));
  };
  const enc = (s) => new TextEncoder().encode(s);
  const keyInfo = new Uint8Array([...enc("WebPush: info\0"), ...uaPublicRaw, ...asPublic]);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc("Content-Encoding: nonce\0"), 12);
  const key = await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const rec = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ct));
  assert.equal(rec.at(-1), 2, "last-record padding delimiter");
  return new TextDecoder().decode(rec.slice(0, -1));
}

async function newSubscriber() {
  const kp = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await subtle.exportKey("raw", kp.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { kp, pub, auth, keys: { p256dh: b64u.encode(pub), auth: b64u.encode(auth) } };
}

test("a message encrypted with fresh random keys decrypts on the receiving side", async () => {
  const sub = await newSubscriber();
  const body = await encryptPayload({ plaintext: new TextEncoder().encode('{"title":"Hei på deg ✏️"}'), uaPublic: sub.pub, authSecret: sub.auth });
  assert.equal(await decrypt(body, sub.kp.privateKey, sub.pub, sub.auth), '{"title":"Hei på deg ✏️"}');
});

async function vapidKeys() {
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return {
    privateJwk: await subtle.exportKey("jwk", kp.privateKey),
    publicKey: b64u.encode(new Uint8Array(await subtle.exportKey("raw", kp.publicKey))),
  };
}

test("VAPID authorization is a valid ES256 JWT for the push service's origin", async () => {
  const v = await vapidKeys();
  const now = 1_800_000_000;
  const auth = await vapidAuthorization({ endpoint: "https://fcm.googleapis.com/fcm/send/abc:def", subject: "https://example.com/", ...v, now });
  const m = auth.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.ok(m, auth);
  assert.equal(m[2], v.publicKey);
  const [h, p, sig] = m[1].split(".");
  assert.deepEqual(JSON.parse(new TextDecoder().decode(b64u.decode(h))), { typ: "JWT", alg: "ES256" });
  const claims = JSON.parse(new TextDecoder().decode(b64u.decode(p)));
  assert.equal(claims.aud, "https://fcm.googleapis.com");
  assert.equal(claims.sub, "https://example.com/");
  assert.ok(claims.exp > now && claims.exp <= now + 24 * 3600, "expires within 24 h");
  const pub = await subtle.importKey("raw", b64u.decode(v.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const ok = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, b64u.decode(sig), new TextEncoder().encode(h + "." + p));
  assert.ok(ok, "signature verifies");
});

test("only real browser push services are accepted as endpoints", () => {
  for (const ok of [
    "https://fcm.googleapis.com/fcm/send/x",
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://wns2-db5p.notify.windows.com/w/?token=x",
    "https://web.push.apple.com/x",
  ])
    assert.ok(isPushEndpoint(ok), ok);
  for (const bad of ["http://fcm.googleapis.com/x", "https://evil.example/x", "https://fcm.googleapis.com.evil.example/x", "https://localhost/x", "nonsense"])
    assert.ok(!isPushEndpoint(bad), bad);
});

// ---- the Worker ----
async function callWorker(body, { origin = "https://jonasgg99.github.io", pushStatus = 201 } = {}) {
  const v = await vapidKeys();
  const env = { VAPID_PRIVATE_JWK: JSON.stringify(v.privateJwk), VAPID_PUBLIC: v.publicKey, VAPID_SUBJECT: "https://jonasgg99.github.io/doodle-duet/" };
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push({ url, init });
    return new Response(null, { status: pushStatus });
  };
  try {
    const res = await worker.fetch(
      new Request("https://push.example.workers.dev/notify", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      env
    );
    return { res, json: await res.json().catch(() => null), sent };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("the Worker sends an encrypted, signed push the subscriber can read", async () => {
  const sub = await newSubscriber();
  const msg = { title: "Jonas drew something", body: "Your turn to guess.", url: "https://jonasgg99.github.io/doodle-duet/" };
  const { res, json, sent } = await callWorker({ subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: sub.keys }, ...msg });
  assert.equal(res.status, 200);
  assert.deepEqual(json, { status: 201 });
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://jonasgg99.github.io");
  assert.equal(sent.length, 1);
  const { url, init } = sent[0];
  assert.equal(url, "https://fcm.googleapis.com/fcm/send/abc");
  assert.equal(init.headers["Content-Encoding"], "aes128gcm");
  assert.match(init.headers.Authorization, /^vapid t=/);
  assert.ok(+init.headers.TTL > 0);
  const text = await decrypt(new Uint8Array(init.body), sub.kp.privateKey, sub.pub, sub.auth);
  assert.deepEqual(JSON.parse(text), msg);
});

test("the Worker reports a dead subscription so the app can forget it", async () => {
  const sub = await newSubscriber();
  const { json } = await callWorker({ subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/old", keys: sub.keys }, title: "t", body: "b", url: "https://jonasgg99.github.io/doodle-duet/" }, { pushStatus: 410 });
  assert.deepEqual(json, { status: 410, gone: true });
});

test("the Worker refuses other sites, non-push endpoints, foreign links and long text", async () => {
  const sub = await newSubscriber();
  const good = { subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: sub.keys }, title: "t", body: "b", url: "https://jonasgg99.github.io/doodle-duet/" };
  const cases = [
    [good, { origin: "https://evil.example" }],
    [{ ...good, subscription: { ...good.subscription, endpoint: "https://evil.example/x" } }, {}],
    [{ ...good, url: "https://evil.example/" }, {}],
    [{ ...good, title: "x".repeat(200) }, {}],
    [{ ...good, subscription: { endpoint: good.subscription.endpoint } }, {}],
  ];
  for (const [body, opts] of cases) {
    const { res, sent } = await callWorker(body, opts);
    assert.ok(res.status >= 400, JSON.stringify(body).slice(0, 80));
    assert.equal(sent.length, 0, "nothing sent");
  }
});
