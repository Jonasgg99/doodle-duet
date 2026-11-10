// Shared game storage. Two backends with the same interface:
//   firebase: Realtime Database + Firebase auth. Everyone starts anonymous; signIn() links a
//             Google account to that player (same uid), so the player follows them to other
//             phones and browsers.
//   local:    localStorage, identity per browser tab (two tabs can play each other; for testing).
//             signIn() only marks the tab as signed in.
// Paths are relative, e.g. "games/<id>/turns/t000". Firebase data lives under ROOT.
import { firebaseConfig } from "./firebase-config.js";

const ROOT = "doodleDuet/";
const FIREBASE = "https://www.gstatic.com/firebasejs/12.17.1/";

export async function openStore() {
  const forceLocal = new URLSearchParams(location.search).has("local");
  if (firebaseConfig && !forceLocal) return firebaseStore(firebaseConfig);
  return localStore();
}

async function firebaseStore(cfg) {
  const [{ initializeApp }, A, D] = await Promise.all([
    import(FIREBASE + "firebase-app.js"),
    import(FIREBASE + "firebase-auth.js"),
    import(FIREBASE + "firebase-database.js"),
  ]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  await auth.authStateReady();
  if (!auth.currentUser) await A.signInAnonymously(auth);
  const db = D.getDatabase(app);
  const google = () => auth.currentUser.providerData.some((p) => p.providerId === "google.com");
  // Tests can't sign in with Google headless; the database rules don't depend on it.
  let skipGoogle = false;
  try {
    skipGoogle = localStorage.getItem("dd_skip_google") === "1";
  } catch {}
  const r = (path) => D.ref(db, ROOT + path);
  let offset = 0;
  D.onValue(D.ref(db, ".info/serverTimeOffset"), (s) => (offset = s.val() || 0));

  return {
    mode: "firebase",
    get uid() {
      return auth.currentUser.uid;
    },
    get signedIn() {
      return google() || skipGoogle;
    },
    // Opens Google's sign-in pop-up (call from a tap). "linked": this player now has the Google
    // account. "switched": the account already had a player (made on another phone or browser),
    // which is now this browser's player: the uid changed, so reload.
    async signIn() {
      try {
        await A.linkWithPopup(auth.currentUser, new A.GoogleAuthProvider());
        return "linked";
      } catch (e) {
        if (e.code !== "auth/credential-already-in-use") throw e;
        await A.signInWithCredential(auth, A.GoogleAuthProvider.credentialFromError(e));
        return "switched";
      }
    },
    now: () => Date.now() + offset,
    newKey: () => D.push(r("keys")).key,
    async get(path) {
      return (await D.get(r(path))).val();
    },
    set: (path, value) => D.set(r(path), value),
    update: (path, patch) => D.update(r(path), patch),
    async claim(path, value) {
      const res = await D.runTransaction(r(path), (cur) => (cur === null ? value : undefined));
      return res.committed;
    },
    watch(path, onData, onError) {
      return D.onValue(r(path), (s) => onData(s.val()), onError);
    },
  };
}

function localStore() {
  const KEY = "dd_localdb";
  let uid = null;
  try {
    uid = sessionStorage.getItem("dd_uid");
    if (!uid) sessionStorage.setItem("dd_uid", (uid = "local-" + randomId(8)));
  } catch {
    uid = "local-" + randomId(8);
  }
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch {
      return {};
    }
  };
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l());
  const write = (data) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {}
    emit();
  };
  addEventListener("storage", (e) => e.key === KEY && emit());

  const parts = (path) => path.split("/").filter(Boolean);
  const getAt = (obj, path) => parts(path).reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const setAt = (obj, path, value) => {
    const ks = parts(path);
    const last = ks.pop();
    let o = obj;
    for (const k of ks) o = o[k] && typeof o[k] === "object" ? o[k] : (o[k] = {});
    if (value === null || value === undefined) delete o[last];
    else o[last] = JSON.parse(JSON.stringify(value));
  };

  return {
    mode: "local",
    uid,
    get signedIn() {
      try {
        return sessionStorage.getItem("dd_signedin") === "1";
      } catch {
        return false;
      }
    },
    async signIn() {
      try {
        sessionStorage.setItem("dd_signedin", "1");
      } catch {}
      return "linked";
    },
    now: () => Date.now(),
    newKey: () => Date.now().toString(36) + randomId(4),
    async get(path) {
      return getAt(read(), path) ?? null;
    },
    async set(path, value) {
      const d = read();
      setAt(d, path, value);
      write(d);
    },
    async update(path, patch) {
      const d = read();
      for (const [k, v] of Object.entries(patch)) setAt(d, path + "/" + k, v);
      write(d);
    },
    async claim(path, value) {
      const d = read();
      if (getAt(d, path) != null) return false;
      setAt(d, path, value);
      write(d);
      return true;
    },
    watch(path, onData) {
      let last;
      const l = () => {
        const s = JSON.stringify(getAt(read(), path) ?? null);
        if (s !== last) onData(JSON.parse((last = s)));
      };
      listeners.add(l);
      queueMicrotask(l);
      return () => listeners.delete(l);
    },
  };
}

export function randomId(n) {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}
