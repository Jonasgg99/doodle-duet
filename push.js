// Browser side of "your turn" notifications: subscribe this phone, and ask the Worker to
// notify the partner's phone. Subscriptions are stored in the game at push/<seat>.
import { PUSH } from "./push-config.js";

export const pushAvailable = () =>
  !!(PUSH.worker && PUSH.publicKey && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
export const pushPermission = () => (pushAvailable() ? Notification.permission : "unsupported");

const keyBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const plain = (sub) => {
  const j = sub.toJSON();
  return { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } };
};

// A subscription made with another VAPID key (before tools/vapid-keys.mjs made a new pair)
// can't receive our pushes; replace it with one for the current key.
const sameKey = (sub) => {
  const k = sub.options?.applicationServerKey;
  if (!k) return true; // browser doesn't say; assume it's ours
  const a = new Uint8Array(k), b = keyBytes(PUSH.publicKey);
  return a.length === b.length && a.every((x, i) => x === b[i]);
};
async function ensureSubscription(reg, sub) {
  if (sub && sameKey(sub)) return sub;
  await sub?.unsubscribe();
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH.publicKey) });
}

// Asks for permission (call from a tap) and returns this phone's subscription, or null.
export async function subscribe() {
  if ((await Notification.requestPermission()) !== "granted") return null;
  await navigator.serviceWorker.register("sw.js");
  const reg = await navigator.serviceWorker.ready;
  return plain(await ensureSubscription(reg, await reg.pushManager.getSubscription()));
}

// This phone's subscription if it has opted in and notifications are allowed, without prompting.
export async function currentSubscription() {
  if (pushPermission() !== "granted") return null;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? plain(await ensureSubscription(reg, sub)) : null;
}

// Resolves {status, gone?}: status is the push service's reply; gone means forget the subscription.
export async function notify(subscription, { title, body, url }) {
  const res = await fetch(PUSH.worker + "/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription, title, body, url }),
  });
  if (!res.ok) throw new Error("notify failed: " + res.status);
  return res.json();
}
