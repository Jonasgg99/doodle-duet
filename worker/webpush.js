// Web Push sending without dependencies: payload encryption (RFC 8291, aes128gcm per
// RFC 8188) and VAPID (RFC 8292). WebCrypto only, so it runs in Cloudflare Workers and Node.
const subtle = crypto.subtle;
const te = new TextEncoder();

export const b64u = {
  encode(bytes) {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(str) {
    const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) out.set(p, (i += p.length) - p.length);
  return out;
};

async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

// Encrypts one push message for a subscription (uaPublic = keys.p256dh, authSecret = keys.auth).
// salt and asKeys ({privateKey, publicRaw}) are only passed in tests, to reproduce the RFC vector.
export async function encryptPayload({ plaintext, uaPublic, authSecret, salt, asKeys }) {
  salt ??= crypto.getRandomValues(new Uint8Array(16));
  if (!asKeys) {
    const kp = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    asKeys = { privateKey: kp.privateKey, publicRaw: new Uint8Array(await subtle.exportKey("raw", kp.publicKey)) };
  }
  const uaKey = await subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(te.encode("WebPush: info\0"), uaPublic, asKeys.publicRaw), 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const key = await subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // One record: plaintext, then the 0x02 last-record delimiter, no further padding.
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(plaintext, [2])));
  const rs = [0, 0, 0x10, 0]; // record size 4096
  return concat(salt, rs, [asKeys.publicRaw.length], asKeys.publicRaw, ct);
}

// The raw (65-byte, base64url) public key that belongs to a private P-256 JWK.
export const publicKeyFromJwk = (jwk) => b64u.encode(concat([4], b64u.decode(jwk.x), b64u.decode(jwk.y)));

// Authorization header value for one push request, signed with the VAPID private key.
export async function vapidAuthorization({ endpoint, subject, privateJwk, publicKey, now = Math.floor(Date.now() / 1000) }) {
  const enc = (obj) => b64u.encode(te.encode(JSON.stringify(obj)));
  const unsigned = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud: new URL(endpoint).origin, exp: now + 12 * 3600, sub: subject });
  const key = await subtle.importKey("jwk", { ...privateJwk, key_ops: ["sign"] }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(unsigned)));
  return `vapid t=${unsigned}.${b64u.encode(sig)}, k=${publicKey ?? publicKeyFromJwk(privateJwk)}`;
}

// The browsers' own push services: Chrome/Android/Samsung (FCM), Firefox, Edge, Safari.
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com"];
const PUSH_SUFFIXES = [".notify.windows.com", ".push.apple.com"];
export function isPushEndpoint(endpoint) {
  let u;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  return u.protocol === "https:" && (PUSH_HOSTS.includes(u.hostname) || PUSH_SUFFIXES.some((s) => u.hostname.endsWith(s)));
}
