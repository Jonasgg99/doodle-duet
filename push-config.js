// Web push: the Cloudflare Worker that sends notifications (worker/) and its VAPID public key.
// Both are public. Empty values turn notifications off; the app then works as before.
export const PUSH = {
  worker: "https://doodle-duet-push.jonaseg.workers.dev",
  publicKey: "BDJVNphl8f36jDqF6yGR0N1DByOCVxapnSdqvp44iCHcPJ7H1CHyYMxKmnr364PERXyBsvjGxtHd4ZSG5H9eZmk",
};
