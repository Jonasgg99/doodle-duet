// Web push: the Cloudflare Worker that sends notifications (worker/) and its VAPID public key.
// Both are public. Empty values turn notifications off; the app then works as before.
export const PUSH = {
  worker: "",
  publicKey: "",
};
