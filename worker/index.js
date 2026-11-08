// Cloudflare Worker that relays "your turn" notifications. Browsers can't post to push
// services themselves (no CORS, and the VAPID private key must stay secret), so the app
// sends {subscription, title, body, url} here and the Worker encrypts, signs and forwards it.
// Secret: VAPID_PRIVATE_JWK (wrangler secret put). The public key is in ../push-config.js.
import { b64u, encryptPayload, vapidAuthorization, isPushEndpoint, publicKeyFromJwk } from "./webpush.js";

const APPS = ["https://jonasgg99.github.io/doodle-duet/", "http://localhost:8124/"];
const ORIGINS = APPS.map((a) => new URL(a).origin);
const SUBJECT = "https://jonasgg99.github.io/doodle-duet/";

const cors = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

function check(m) {
  const sub = m?.subscription;
  const len = (s) => (typeof s === "string" ? b64u.decode(s).length : -1);
  if (!sub || !isPushEndpoint(sub.endpoint)) return "endpoint";
  try {
    if (len(sub.keys?.p256dh) !== 65 || len(sub.keys?.auth) !== 16) return "keys";
  } catch {
    return "keys";
  }
  if (typeof m.title !== "string" || m.title.length > 80) return "title";
  if (typeof m.body !== "string" || m.body.length > 160) return "body";
  if (typeof m.url !== "string" || !APPS.some((a) => m.url.startsWith(a))) return "url";
  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (!ORIGINS.includes(origin)) return new Response("forbidden", { status: 403 });
    const headers = { ...cors(origin), "Content-Type": "application/json" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers });
    if (request.method !== "POST" || new URL(request.url).pathname !== "/notify") return reply({ error: "not found" }, 404);

    let m;
    try {
      m = await request.json();
    } catch {
      return reply({ error: "json" }, 400);
    }
    const bad = check(m);
    if (bad) return reply({ error: bad }, 400);

    const { endpoint, keys } = m.subscription;
    const privateJwk = JSON.parse(env.VAPID_PRIVATE_JWK);
    const body = await encryptPayload({
      plaintext: new TextEncoder().encode(JSON.stringify({ title: m.title, body: m.body, url: m.url })),
      uaPublic: b64u.decode(keys.p256dh),
      authSecret: b64u.decode(keys.auth),
    });
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidAuthorization({ endpoint, subject: SUBJECT, privateJwk, publicKey: publicKeyFromJwk(privateJwk) }),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(4 * 24 * 3600),
        Urgency: "high",
      },
      body,
    });
    // 404/410: the subscription is gone (app uninstalled, permission revoked); the app forgets it.
    return reply(res.status === 404 || res.status === 410 ? { status: res.status, gone: true } : { status: res.status });
  },
};
