import { openStore, randomId } from "./store.js";
import { LANG_NAMES } from "./words.js";
import * as G from "./game.js";
import * as P from "./push.js";
import { detectLang, translator } from "./i18n.js";

// ---------- constants ----------
const W = 1000, H = 1500; // logical canvas size; strokes are stored in these units
const COLORS = ["#1d1d22", "#e5484d", "#f76b15", "#ffc53d", "#30a46c", "#0090ff", "#8e4ec6", "#8d5b3d", "#ffffff"];
const ERASER = COLORS.length - 1;
const SIZES = [6, 14, 34];

// ---------- small helpers ----------
const $ = (s, root = document) => root.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ls = {
  get(k, d = null) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};
// The app's language: the switch on the games list, else the phone's. Text for the other player
// (notification, share sheet) uses theirs when the game knows it (players/<seat>/lang).
const LANG = detectLang(ls.get("dd_ui"), navigator.languages?.length ? navigator.languages : [navigator.language]);
const t = translator(LANG);
const tFor = (lang) => translator(lang ?? LANG);
function translatePage() {
  document.documentElement.lang = LANG === "no" ? "nb" : "en";
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of document.querySelectorAll("[data-i18n-aria-label]")) el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
}

const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));
const turnKey = (n) => "t" + String(n).padStart(3, "0");

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen");
    if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

// ---------- state ----------
let store, me, profile; // profile: this player's entry in the player list ({name}), once made
let gameId = null, game = null, unwatch = null;
let panelKey = null; // which panel is on screen, so live updates don't restart it
let drawing = null; // active drawing session
let guessing = null; // active guessing session
let offView = []; // unsubscribes for the games list and new-game screens
const prefs = { name: ls.get("dd_name", ""), lang: ls.get("dd_lang", LANG), level: ls.get("dd_level", "mixed"), adult: ls.get("dd_adult", "on") };
const ADULT_LABELS = { on: t("adult_on"), off: t("adult_off") };

// ---------- views ----------
function show(view) {
  for (const v of document.querySelectorAll(".view")) v.hidden = v.id !== "view-" + view;
  $("#back-link").hidden = view === "list" || view === "setup" || view === "loading";
  if (view !== "game") setFocusMode(false);
}
function setFocusMode(on) {
  document.body.classList.toggle("focus", on);
}
function showError(msg) {
  $("#error-text").textContent = msg;
  show("error");
}

// ---------- boot & routing ----------
// Routes: no hash = your games; #new = start a game; #<id> = that game. Before any of them, a
// first visit makes a player (name + Google sign-in).
async function boot() {
  translatePage();
  try {
    store = await openStore();
    me = store.uid;
    profile = await store.get("players/" + me);
  } catch (e) {
    console.error(e);
    showError(t("connectFailed"));
    return;
  }
  $("#mode-tag").hidden = store.mode !== "local";
  setupViews();
  addEventListener("hashchange", route);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
  });
  route();
  window.__ddStarted = true; // tells the self-heal in index.html that startup worked
}

function route() {
  stopSessions();
  if (unwatch) unwatch();
  unwatch = null;
  for (const off of offView.splice(0)) off();
  game = null;
  gameId = null;
  panelKey = null;
  if (!store.signedIn || !profile?.name) return showSetup();
  if (location.hash === "#new") return showNew();
  const id = G.gameIdFromHash(location.hash);
  if (id) return openGame(id);
  showList();
}

function setupViews() {
  segmented($("#lang-seg"), Object.entries(LANG_NAMES), prefs.lang, (v) => ls.set("dd_lang", (prefs.lang = v)));
  segmented($("#level-seg"), Object.entries(WORD_LABELS), prefs.level, (v) => ls.set("dd_level", (prefs.level = v)));
  segmented($("#new-adult-seg"), Object.entries(ADULT_LABELS), prefs.adult, (v) => ls.set("dd_adult", (prefs.adult = v)));
  $("#new-game-btn").addEventListener("click", () => (location.hash = "new"));
  $("#invite-btn").addEventListener("click", () => createGame(null));
  $("#people").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-uid]");
    if (b) createGame({ uid: b.dataset.uid, name: b.dataset.name });
  });
  $("#signin-btn").addEventListener("click", makePlayer);
  segmented($("#ui-seg"), [["en", "English"], ["no", "Norsk"]], LANG, (v) => {
    ls.set("dd_ui", v);
    location.reload();
  });
}

function segmented(el, options, current, onPick) {
  el.innerHTML = options
    .map(([v, label]) => `<button type="button" role="radio" aria-checked="${v === current}" data-v="${esc(v)}">${esc(label)}</button>`)
    .join("");
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    for (const x of el.children) x.setAttribute("aria-checked", x === b);
    onPick(b.dataset.v);
  });
}

// ---------- first visit: make your player ----------
function showSetup() {
  show("setup");
  const input = $("#player-name");
  if (!input.value) input.value = profile?.name || prefs.name;
  $("#signin-btn").textContent = store.signedIn ? t("continue") : t("continueWithGoogle");
  $("#google-note").hidden = store.signedIn;
}

async function makePlayer() {
  const btn = $("#signin-btn");
  const err = $("#setup-error");
  const name = $("#player-name").value.trim().slice(0, 20);
  err.hidden = true;
  if (!name) {
    err.textContent = t("nameNeeded");
    err.hidden = false;
    return;
  }
  btn.disabled = true;
  try {
    if (!store.signedIn && (await store.signIn()) === "switched") {
      // This Google account already has a player from another phone or browser: carry on as it.
      if (!(await store.get(`players/${store.uid}/name`))) await store.set(`players/${store.uid}`, { name });
      location.reload();
      return;
    }
    await store.set(`players/${me}`, { name });
    profile = { name };
    ls.set("dd_name", (prefs.name = name));
    route();
  } catch (e) {
    console.error(e);
    err.textContent = store.signedIn
      ? t("saveNameFailed")
      : (/popup-closed-by-user|cancelled-popup-request|user-cancelled/.test(e.code || "") ? t("signInCancelled") : t("signInFailed")) + " " + t("inAppBrowser");
    err.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

// ---------- your games ----------
// Reads only each game's players, current round and whose move it is, never the drawings.
function showList() {
  show("list");
  $("#me-name").textContent = t("playingAs", { name: profile.name });
  const games = new Map(); // id -> {players, turn, off: [unsubscribe…]}
  let loaded = false;
  const render = () => {
    const rows = [];
    let waiting = false;
    for (const [id, g] of games) {
      const turn = g.turn;
      if (g.players === undefined || turn === undefined || (turn && (turn.drawer === undefined || turn.status === undefined || turn.n === undefined))) waiting = true;
      if (!g.players || !turn || turn.drawer == null || turn.status == null || turn.n == null) continue;
      const status = G.gameStatus({ players: g.players, turn }, me);
      if (status) rows.push({ id, status });
    }
    $("#list-empty").hidden = !loaded || waiting || rows.length > 0;
    $("#games-list").innerHTML = G.sortGames(rows)
      .map(
        ({ id, status: s }) => `<li><a class="game-row${s.mine ? " mine" : ""}" href="#${esc(id)}">
          <span class="gr-them">${esc(s.them ?? t("inviteSent"))}</span>
          <span class="gr-status">${esc(t("st_" + s.kind, { name: s.them || t("player") }))}</span>
          <span class="gr-round">${esc(t("round", { n: s.round }))}</span>
        </a></li>`
      )
      .join("");
  };
  const drop = (id) => {
    for (const off of games.get(id)?.off ?? []) off();
    games.delete(id);
  };
  const follow = (id) => {
    const g = { off: [] };
    games.set(id, g);
    // Lost access (someone else has the seat now): take it off the list.
    const denied = (err) => {
      console.warn(err);
      store.set(`users/${me}/games/${id}`, null).catch(() => {});
    };
    g.off.push(
      store.watch(
        `games/${id}/players`,
        (p) => {
          g.players = p;
          if (p === null) store.set(`users/${me}/games/${id}`, null).catch(() => {}); // the game was deleted
          syncListPush(id, p);
          render();
        },
        denied
      )
    );
    let offTurn = () => {};
    g.off.push(() => offTurn());
    g.off.push(
      store.watch(
        `games/${id}/cur`,
        (cur) => {
          offTurn();
          g.turn = cur ? {} : null;
          const offs = cur ? ["drawer", "status", "n"].map((k) => store.watch(`games/${id}/turns/${cur}/${k}`, (v) => ((g.turn = { ...g.turn, [k]: v }), render()), denied)) : [];
          offTurn = () => offs.forEach((off) => off());
          render();
        },
        denied
      )
    );
  };
  offView.push(
    store.watch(
      `users/${me}/games`,
      (ids) => {
        const want = new Set(Object.keys(ids || {}));
        for (const id of [...games.keys()]) if (!want.has(id)) drop(id);
        for (const id of want) if (!games.has(id)) follow(id);
        loaded = true;
        render();
      },
      (err) => {
        console.error(err);
        showError(t("loadGamesFailed"));
      }
    ),
    () => [...games.keys()].forEach(drop)
  );
  addMainGame();
}

// The game from before players and lists (id `main`) joins your list the first time it's found.
let mainChecked = false;
async function addMainGame() {
  if (mainChecked) return;
  mainChecked = true;
  try {
    const p = await store.get("games/main/players");
    if (p?.a?.uid === me || p?.b?.uid === me) await store.set(`users/${me}/games/main`, true);
  } catch (e) {
    // No access means it isn't your game; anything else (offline) gets another try next time.
    if (!/permission/i.test(e.code || e.message || "")) mainChecked = false;
  }
}

// Put this phone's notification address into each of your games that lacks it, once per visit,
// so a new game from someone you play with can notify you before you've opened it. Only for
// people you've played on this phone: anyone can put a game in your list, and whoever has the
// address can send this phone notifications. (Opening a game turns them on there anyway.)
const pushDone = new Set();
let mySub;
const partners = () => ls.get("dd_partners", {});
function rememberPartner(uid) {
  if (uid && !partners()[uid]) ls.set("dd_partners", { ...partners(), [uid]: true });
}
async function syncListPush(id, players) {
  const seat = players?.a?.uid === me ? "a" : players?.b?.uid === me ? "b" : null;
  if (!seat || pushDone.has(id) || !partners()[players[G.otherSeat(seat)]?.uid]) return;
  pushDone.add(id);
  const sub = await (mySub ??= P.currentSubscription().catch(() => null));
  if (!sub) return;
  try {
    const cur = await store.get(`games/${id}/push/${seat}`);
    if (cur?.endpoint !== sub.endpoint) await store.update(`games/${id}/push`, { [seat]: sub });
  } catch (err) {
    console.error(err);
  }
}

// ---------- new game ----------
function showNew() {
  show("new");
  offView.push(
    store.watch("players", (all) => {
      const people = Object.entries(all || {})
        .filter(([uid, p]) => uid !== me && p?.name)
        .sort(([, x], [, y]) => x.name.localeCompare(y.name));
      $("#people-empty").hidden = people.length > 0;
      $("#people").innerHTML = people
        .map(([uid, p]) => `<button type="button" class="person" data-uid="${esc(uid)}" data-name="${esc(p.name)}">${esc(p.name)}</button>`)
        .join("");
    })
  );
}

// partner: {uid, name} picked from the list, or null to invite someone with the game's link.
let creating = false;
async function createGame(partner) {
  if (creating) return;
  creating = true;
  const btns = document.querySelectorAll("#view-new button");
  for (const b of btns) b.disabled = true;
  const id = randomId(10);
  const players = { a: { uid: me, name: profile.name, lang: LANG } };
  if (partner) players.b = partner;
  const data = {
    v: 1,
    createdAt: store.now(),
    lang: prefs.lang,
    wordLevel: prefs.level,
    adult: prefs.adult !== "off",
    drawSecs: G.DRAW_SECS,
    players,
    cur: turnKey(0),
    turns: { [turnKey(0)]: makeTurn(0, "a", new Set(), prefs.lang, prefs.level, prefs.adult !== "off") },
  };
  try {
    if (!(await store.claim("games/" + id, data))) throw new Error("game id taken");
    await store.set(`users/${me}/games/${id}`, true);
    if (partner) await store.set(`users/${partner.uid}/games/${id}`, true);
    location.hash = id;
  } catch (e) {
    console.error(e);
    toast(t("startGameFailed"));
  } finally {
    creating = false;
    for (const b of btns) b.disabled = false;
  }
}

function makeTurn(n, drawer, used, lang, wordLevel, adult) {
  return { n, drawer, status: "draw", choices: G.pickChoices(lang, used, Math.random, wordLevel, adult) };
}

// ---------- game model helpers ----------
const seatOf = (g) => (g?.players?.a?.uid === me ? "a" : g?.players?.b?.uid === me ? "b" : null);
const turnList = (g) => G.turnsInOrder(g?.turns);
const nameOf = (g, seat) => g.players?.[seat]?.name || (seat === "a" ? t("player1") : t("player2"));
// The other player's translator, for text they read (their language, when the game knows it).
const tThem = (g, seat) => tFor(g.players?.[G.otherSeat(seat)]?.lang);
const curTurn = (g) => g.turns[g.cur];
const guessDeadline = (g, turn) => turn.guessStartedAt + G.guessLimitMs(g.drawSecs);

function usedWords(g) {
  return new Set(turnList(g).map((turn) => turn.word).filter(Boolean));
}

// ---------- open / join ----------
function openGame(id) {
  gameId = id;
  show("loading");
  unwatch = store.watch(
    "games/" + id,
    (g) => {
      game = g;
      renderGame();
    },
    (err) => {
      console.error(err);
      showError(t("seatTaken"));
    }
  );
}

function showJoin() {
  show("join");
  $("#join-title").textContent = t("joinTitle", { name: nameOf(game, "a") });
  $("#join-sub").textContent = t("joinSub", { secs: game.drawSecs });
  $("#join-btn").onclick = async () => {
    $("#join-btn").disabled = true;
    try {
      const ok = await store.claim(`games/${gameId}/players/b`, { uid: me, name: profile.name, lang: LANG });
      if (!ok) throw new Error("taken");
    } catch (e) {
      console.error(e);
      const err = $("#join-error");
      err.textContent = t("joinTaken");
      err.hidden = false;
    } finally {
      $("#join-btn").disabled = false;
    }
  };
}

// Your seated games are kept in your list (users/<you>/games), whichever way you got the seat.
const listed = new Set();
function keepInList(id) {
  if (listed.has(id)) return;
  listed.add(id);
  store.set(`users/${me}/games/${id}`, true).catch((err) => (console.error(err), listed.delete(id)));
}

// Your seat in the game says which language you read, so the other player's phone can write to
// you in it. Once per game and page load, and only when it changed.
const langSaved = new Set();
function saveLang(seat) {
  if (game.players[seat]?.lang === LANG || langSaved.has(gameId)) return;
  const id = gameId;
  langSaved.add(id);
  store.set(`games/${id}/players/${seat}/lang`, LANG).catch((err) => (console.error(err), langSaved.delete(id)));
}

// ---------- game rendering ----------
function renderGame() {
  if (!game) return showError(t("gameMissing"));
  const seat = seatOf(game);
  if (!seat) {
    if (!game.players.b) return showJoin();
    const [a, b] = [nameOf(game, "a"), nameOf(game, "b")];
    return showError(t("twoOthers", { a, b }));
  }
  show("game");
  keepInList(gameId);
  saveLang(seat);
  rememberPartner(game.players[G.otherSeat(seat)]?.uid);
  syncPush(seat);
  renderScoreboard(seat);
  renderWordSetting();
  renderHistory(seat);
  renderReseat(seat);

  const key = pickPanel(seat);
  if (key === panelKey) {
    updatePanel(seat);
    for (const b of document.querySelectorAll(".result-banner")) fillNote(b, game.turns[b.dataset.key], seat);
    return;
  }
  stopSessions();
  const [kind] = key.split(":");
  const panel = $("#panel");
  // The same kind of screen redrawn (new word choices after a setting change, the partner
  // joining) keeps the banner on screen, with any message being typed and the keyboard.
  const keep = panelKey?.split(":")[0] === kind ? panel.querySelector(".result-banner") : null;
  const typing = keep?.contains(document.activeElement) ? document.activeElement : null;
  panelKey = key;
  setFocusMode(kind === "draw" || kind === "guess");
  panel.innerHTML = "";
  ({ choose: panelChoose, draw: panelDraw, ready: panelReady, guess: panelGuess, wait: panelWait })[kind](panel, seat);
  if (kind !== "draw" && kind !== "guess") {
    const banner = resultBanner(seat) ?? keep;
    if (banner) panel.prepend(banner);
    if (banner === keep) typing?.focus({ preventScroll: true });
  }
}

// The last finished round's outcome, shown once as a banner on top of the next screen.
function resultBanner(seat) {
  const last = turnList(game).filter((x) => x.status === "done").at(-1);
  const seenKey = `dd_seen:${gameId}:${seat}`;
  if (!last || !G.resultIsNew(last.n, ls.get(seenKey, -1), curTurn(game).n)) return null;
  ls.set(seenKey, last.n);
  const r = last.result;
  const iDrew = last.drawer === seat;
  const other = nameOf(game, G.otherSeat(seat));
  const team = G.teamScore(turnList(game).filter((x) => x.n <= last.n));
  const pts = G.teamScore([last]).points;
  const head = r.correct ? (iDrew ? t("theyGotIt", { name: other }) : t("youGotIt")) : iDrew ? t("theyMissed", { name: other }) : t("youMissed");
  const sub = r.correct
    ? `${t("wonIn", { word: last.word, s: secs(r.ms) })} · ${t("plusPoints", { n: pts })}` + (team.streak > 1 ? ` · ${t("inARowSuffix", { n: team.streak })}` : "")
    : t("missSub", { word: last.word });
  const missed = G.missedGuesses(last);
  const key = turnKey(last.n);
  const el = document.createElement("div");
  el.className = `card result-banner ${r.correct ? "win" : "miss"}`;
  el.dataset.key = key;
  el.innerHTML = `<canvas class="thumb"></canvas><div class="h-text">
    <strong class="rb-head">${esc(head)}</strong><span class="small">${esc(sub)}</span>
    ${missed.length ? `<span class="small muted">${esc(iDrew ? t("theyGuessed", { name: other }) : t("youGuessed"))}: ${missed.map(esc).join(" · ")}</span>` : ""}
    <span class="small rb-note" hidden></span>
    ${iDrew ? "" : `<form class="note-form" autocomplete="off"><input class="input note-input" maxlength="120" placeholder="${esc(t("messageTo", { name: other }))}" enterkeyhint="send"><button class="btn small-btn">${esc(t("send"))}</button></form>`}
  </div>`;
  el.querySelector(".note-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = el.querySelector(".note-input").value.trim().slice(0, 120);
    if (!text) return;
    try {
      await store.update(`games/${gameId}/turns/${key}`, { note: { text, at: store.now() } });
      fillNote(el, { ...last, note: { text } }, seat);
    } catch (err) {
      console.error(err);
      toast(t("noteFailed"));
    }
  });
  fillNote(el, last, seat);
  const c = el.querySelector("canvas");
  sizeCanvas(c, 64);
  paint(c, parseStrokes(last.strokes));
  if (r.correct && !iDrew) navigator.vibrate?.([30, 40, 30]);
  return el;
}

// The guesser's message about a round, shown on the banner once written (live for the drawer).
const noteLine = (turn, seat) => `${turn.drawer === seat ? nameOf(game, G.otherSeat(seat)) : t("you")}: "${turn.note.text}"`;
function fillNote(el, turn, seat) {
  if (!turn?.note?.text) return;
  const line = el.querySelector(".rb-note");
  line.textContent = noteLine(turn, seat);
  line.hidden = false;
  el.querySelector(".note-form")?.remove();
}

function pickPanel(seat) {
  const turn = curTurn(game);
  if (turn.drawer === seat) {
    if (turn.status === "draw") return turn.word ? "draw:" + turn.n : "choose:" + turn.n + ":" + turn.choices.map((c) => c.word).join("|");
    return "wait:" + turn.n + ":" + (game.players.b ? "guess" : "join");
  }
  if (turn.status === "draw") return "wait:" + turn.n + ":draw";
  return (turn.guessStartedAt ? "guess:" : "ready:") + turn.n;
}

// Both players score together: one shared score and the streak of rounds guessed in a row.
function renderScoreboard(seat) {
  const { points, streak } = G.teamScore(turnList(game));
  const cur = curTurn(game);
  const name = (s) =>
    `<span class="pname p-${s}${s === seat ? " is-me" : ""}">${esc(nameOf(game, s))}${s === seat ? ` <span class="you">${esc(t("youTag"))}</span>` : ""}</span>`;
  $("#scoreboard").innerHTML = `
    <div class="team-names">${name("a")}<span class="amp">&amp;</span>${name("b")}</div>
    <div class="team-stats">
      <div class="stat"><span class="snum" id="team-points">${esc(points)}</span><span class="slabel">${esc(t("points"))}</span></div>
      <div class="round">${esc(t("round", { n: cur.n + 1 }))}</div>
      <div class="stat streak${streak > 1 ? " hot" : ""}"><span class="snum" id="team-streak">${esc(streak)}</span><span class="slabel">${esc(t("inARow"))}</span></div>
    </div>`;
}

// Easy / Mixed / Hard, for both players, changeable any time. A word choice on screen that
// hasn't been picked yet switches to the new setting's words (the same ones each time within a
// round); otherwise it applies from the next round.
const WORD_LABELS = Object.fromEntries(G.WORD_SETTINGS.map((v) => [v, t("level_" + v)]));
function renderWordSetting() {
  const seg = $("#word-seg");
  const cur = game.wordLevel ?? "mixed";
  if (!seg.children.length) {
    seg.innerHTML = G.WORD_SETTINGS.map((v) => `<button type="button" role="radio" data-v="${v}">${esc(WORD_LABELS[v])}</button>`).join("");
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b && b.dataset.v !== (game.wordLevel ?? "mixed")) setWordLevel(b.dataset.v);
    });
  }
  for (const b of seg.children) b.setAttribute("aria-checked", b.dataset.v === cur);

  const adultSeg = $("#adult-seg");
  const adult = game.adult === false ? "off" : "on";
  if (!adultSeg.children.length) {
    adultSeg.innerHTML = Object.entries(ADULT_LABELS).map(([v, l]) => `<button type="button" role="radio" data-v="${v}">${esc(l)}</button>`).join("");
    adultSeg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b && b.dataset.v !== (game.adult === false ? "off" : "on")) setAdult(b.dataset.v === "on");
    });
  }
  for (const b of adultSeg.children) b.setAttribute("aria-checked", b.dataset.v === adult);
}

// Adult words in or out, for both players, any time. An unpicked word choice is drawn again
// (the words kept for switching Easy / Mixed / Hard are dropped, as they may hold adult words).
async function setAdult(on) {
  const turn = curTurn(game);
  const patch = { adult: on };
  if (turn.status === "draw" && !turn.word) {
    patch[`turns/${game.cur}/choices`] = G.pickChoices(game.lang, usedWords(game), Math.random, game.wordLevel, on);
    patch[`turns/${game.cur}/choiceSets`] = null;
  }
  try {
    await store.update(`games/${gameId}`, patch);
  } catch (err) {
    console.error(err);
    toast(t("wordsFailed"));
  }
}

async function setWordLevel(v) {
  const turn = curTurn(game);
  const patch = { wordLevel: v };
  if (turn.status === "draw" && !turn.word) {
    const pick = (s) => G.pickChoices(game.lang, usedWords(game), Math.random, s, game.adult !== false);
    const next = G.switchChoices(turn, game.wordLevel ?? "mixed", v, pick);
    patch[`turns/${game.cur}/choices`] = next.choices;
    patch[`turns/${game.cur}/choiceSets`] = next.choiceSets;
  }
  try {
    await store.update(`games/${gameId}`, patch);
  } catch (err) {
    console.error(err);
    toast(t("wordsFailed"));
  }
}

// Each browser has its own anonymous identity, so playing from a new phone or browser means a new
// identity. The player who set up the game can free seat b; turns and scores belong to the seat,
// so they stay, and the partner joins again from the new browser. (A lost seat a needs the console.)
function renderReseat(seat) {
  const btn = $("#reseat-btn");
  btn.hidden = seat !== "a" || !game.players.b;
  if (btn.hidden) return;
  const them = nameOf(game, "b");
  btn.textContent = t("reseatButton", { name: them });
  btn.onclick = async () => {
    const ask = t("reseatConfirm", { name: them });
    if (!confirm(ask)) return;
    try {
      await store.update(`games/${gameId}`, { "players/b": null, "push/b": null });
      toast(t("reseatDone", { name: them }));
    } catch (err) {
      console.error(err);
      toast(t("failed"));
    }
  };
}

function renderHistory(seat) {
  const done = turnList(game).filter((turn) => turn.status === "done").reverse();
  $("#history-wrap").hidden = !done.length;
  const ul = $("#history");
  const sig = done.map((turn) => turn.n + (turn.note?.text ?? "")).join(",");
  if (ul.dataset.sig === sig) return;
  ul.dataset.sig = sig;
  ul.innerHTML = "";
  for (const turn of done) {
    const li = document.createElement("li");
    const c = document.createElement("canvas");
    c.className = "thumb";
    li.append(c);
    const r = turn.result;
    const by = turn.drawer === seat ? t("youDrew") : t("theyDrew", { name: nameOf(game, turn.drawer) });
    const outcome = r.correct ? `${t("guessedIn", { s: secs(r.ms) })} · ${t("plusPoints", { n: G.teamScore([turn]).points })}` : t("notGuessed");
    const missed = G.missedGuesses(turn);
    li.insertAdjacentHTML(
      "beforeend",
      `<div class="h-text"><span class="h-word">${esc(turn.word)}</span><span class="muted small">${esc(by)} · ${esc(outcome)}</span>` +
        (missed.length ? `<span class="muted small">${esc(t("missed"))}: ${missed.map(esc).join(" · ")}</span>` : "") +
        (turn.note?.text ? `<span class="small rb-note">${esc(noteLine(turn, seat))}</span>` : "") +
        `</div>`
    );
    ul.append(li);
    sizeCanvas(c, 96);
    paint(c, parseStrokes(turn.strokes), Infinity);
  }
}

function updatePanel(seat) {
  // Live data changed but the same panel stays up: refresh what can change in place.
  if (panelKey.startsWith("wait:")) {
    const turn = curTurn(game);
    const el = $("#wait-extra");
    if (el && turn.status === "guess" && turn.guessStartedAt && turn.drawer === seat) {
      const left = guessDeadline(game, turn) - store.now();
      el.textContent = left > 0 ? t("guessingNow", { name: nameOf(game, G.otherSeat(seat)) }) : t("guessTimeUp");
    }
  }
}

function stopSessions() {
  if (drawing) {
    clearInterval(drawing.timer);
    drawing = null;
  }
  if (guessing) {
    clearInterval(guessing.timer);
    guessing = null;
  }
  keepAwake(false);
}

function tick() {
  drawing?.tick();
  guessing?.tick();
}

// ---------- panel: choose a word ----------
function panelChoose(panel) {
  const turn = curTurn(game);
  panel.innerHTML = `
    <div class="card stack">
      <h2>${esc(t("pickWord"))}</h2>
      <p class="muted small">${esc(t("timerStarts", { secs: game.drawSecs }))}</p>
      <div class="choices">
        ${turn.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="cw">${esc(c.word)}</span></button>`).join("")}
      </div>
    </div>`;
  panel.querySelector(".choices").addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const c = turn.choices[+b.dataset.i];
    for (const x of panel.querySelectorAll("button")) x.disabled = true;
    try {
      await store.update(`games/${gameId}/turns/${game.cur}`, { word: c.word, level: c.level ?? null });
    } catch (err) {
      console.error(err);
      toast(t("pickFailed"));
      for (const x of panel.querySelectorAll("button")) x.disabled = false;
    }
  });
}

// ---------- panel: draw ----------
function panelDraw(panel, seat) {
  const turn = curTurn(game);
  const limit = game.drawSecs * 1000;
  panel.innerHTML = `
    <div class="draw-head">
      <div><span class="muted small">${esc(t("draw"))}</span> <strong class="word">${esc(turn.word)}</strong></div>
      <div class="timer" id="draw-timer">${esc(game.drawSecs)}</div>
    </div>
    <div class="timebar"><div class="timebar-fill" id="draw-bar"></div></div>
    <div class="canvas-box"><canvas class="art" id="draw-canvas"></canvas></div>
    <div class="tools">
      <div class="swatches" id="swatches">
        ${COLORS.map((c, i) => `<button class="swatch ${i === ERASER ? "eraser" : ""}" style="--c:${c}" data-i="${i}" aria-label="${esc(i === ERASER ? t("eraser") : t("colour", { n: i + 1 }))}" aria-pressed="${i === 0}"></button>`).join("")}
      </div>
      <div class="tool-row">
        <div class="sizes" id="sizes">
          ${SIZES.map((s, i) => `<button class="size" data-i="${i}" aria-label="${esc(t("brushSize", { n: i + 1 }))}" aria-pressed="${i === 1}"><span style="--s:${6 + i * 7}px"></span></button>`).join("")}
        </div>
        <button class="btn small-btn" id="undo-btn">${esc(t("undo"))}</button>
        <button class="btn small-btn" id="clear-btn">${esc(t("clear"))}</button>
        <button class="btn primary small-btn" id="done-btn">${esc(t("send"))}</button>
      </div>
    </div>`;

  const canvas = $("#draw-canvas");
  sizeCanvas(canvas);
  const s = (drawing = { strokes: [], color: 0, size: 1, start: performance.now(), penSeen: false, active: null, sent: false });
  const elapsed = () => performance.now() - s.start;
  const redraw = () => paint(canvas, s.strokes, Infinity);
  redraw();
  keepAwake(true);

  const toLogical = (e) => {
    const r = canvas.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * W), Math.round(((e.clientY - r.top) / r.height) * H)];
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (s.sent) return;
    if (e.pointerType === "pen") s.penSeen = true;
    if (e.pointerType === "touch" && s.penSeen) return; // palm rejection once the S Pen has been used
    if (s.active) return;
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = toLogical(e);
    s.active = { id: e.pointerId, stroke: { c: s.color, w: s.size, p: [x, y, Math.round(elapsed())] } };
    s.strokes.push(s.active.stroke);
    redraw();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!s.active || e.pointerId !== s.active.id) return;
    const p = s.active.stroke.p;
    for (const ev of e.getCoalescedEvents?.() ?? [e]) {
      const [x, y] = toLogical(ev);
      const dx = x - p[p.length - 3], dy = y - p[p.length - 2];
      if (dx * dx + dy * dy < 9) continue; // skip sub-3-unit jitter, keeps saved drawings small
      p.push(x, y, Math.round(elapsed()));
    }
    redraw();
  });
  const end = (e) => {
    if (s.active && e.pointerId === s.active.id) s.active = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  $("#swatches").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    s.color = +b.dataset.i;
    for (const x of $("#swatches").children) x.setAttribute("aria-pressed", x === b);
  });
  $("#sizes").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    s.size = +b.dataset.i;
    for (const x of $("#sizes").children) x.setAttribute("aria-pressed", x === b);
  });
  $("#undo-btn").onclick = () => {
    s.strokes.pop();
    redraw();
  };
  let clearArmed = 0;
  $("#clear-btn").onclick = (e) => {
    if (Date.now() - clearArmed < 2500) {
      s.strokes = [];
      redraw();
      clearArmed = 0;
      e.target.textContent = t("clear");
    } else {
      clearArmed = Date.now();
      e.target.textContent = t("sure");
      setTimeout(() => (e.target.textContent = t("clear")), 2500);
    }
  };
  const doneBtn = $("#done-btn");
  doneBtn.onclick = () => submit(true);

  // byTap: sent with the Send button, so the share sheet may open (it needs a fresh tap).
  async function submit(byTap = false) {
    if (s.sent) return;
    s.sent = true;
    s.active = null;
    clearInterval(s.timer);
    doneBtn.disabled = true;
    const drawMs = Math.min(limit, Math.round(elapsed()));
    try {
      await store.update(`games/${gameId}/turns/${game.cur}`, {
        strokes: JSON.stringify(s.strokes),
        drawMs,
        drawnAt: store.now(),
        status: "guess",
      });
      keepAwake(false);
      // Partner has notifications on: notify them. Otherwise open the share sheet (needs the tap).
      if (game.players.b && game.push?.[G.otherSeat(seat)]) notifyPartner(seat, byTap ? "" : t("timeUpSent") + " ");
      else if (byTap) share(game.players.b ? "guess" : "join", { auto: true });
      else toast(t("timeUpNudge"));
    } catch (err) {
      console.error(err);
      s.sent = false;
      doneBtn.disabled = false;
      toast(t("sendFailed"));
    }
  }

  s.tick = () => {
    if (s.sent) return;
    const left = limit - elapsed();
    $("#draw-timer").textContent = secs(left);
    $("#draw-timer").classList.toggle("urgent", left < 10000);
    $("#draw-bar").style.transform = `scaleX(${Math.max(0, left / limit)})`;
    if (left <= 0) submit();
  };
  s.timer = setInterval(s.tick, 200);
  s.tick();
}

// ---------- panel: ready to guess ----------
function panelReady(panel, seat) {
  const other = nameOf(game, G.otherSeat(seat));
  panel.innerHTML = `
    <div class="card stack center">
      <h2 class="big">${esc(t("drewSomething", { name: other }))}</h2>
      <p>${t("readyInfoHtml", { secs: Number(G.guessLimitMs(game.drawSecs) / 1000) })}</p>
      <p class="muted small">${esc(t("readyRules", { max: G.MAX_GUESSES }))}</p>
      <button class="btn primary big-btn" id="start-guess">${esc(t("start"))}</button>
    </div>`;
  $("#start-guess").onclick = async (e) => {
    e.target.disabled = true;
    try {
      await store.update(`games/${gameId}/turns/${game.cur}`, { guessStartedAt: store.now() });
    } catch (err) {
      console.error(err);
      e.target.disabled = false;
      toast(t("startFailed"));
    }
  };
}

// ---------- panel: guess ----------
function panelGuess(panel, seat) {
  const turn = curTurn(game);
  const key = game.cur;
  const strokes = parseStrokes(turn.strokes);
  const tl = G.replayTimeline(strokes);
  const limit = G.guessLimitMs(game.drawSecs);
  const blanks = turn.word
    .split(" ")
    .map((w) => `<span class="blank-word" aria-hidden="true">${[...w].map(() => "<i></i>").join("")}</span>`)
    .join("");
  panel.innerHTML = `
    <div class="draw-head">
      <div class="blanks">${blanks}<span class="blank-count">${esc(t("letters", { word: turn.word }))}</span></div>
      <div class="timer" id="guess-timer"></div>
    </div>
    <div class="timebar"><div class="timebar-fill" id="guess-bar"></div></div>
    <div class="guess-meta"><span id="guess-worth"></span><span id="guess-left"></span></div>
    <div class="canvas-box"><canvas class="art" id="guess-canvas"></canvas></div>
    <form class="guess-form" id="guess-form" autocomplete="off">
      <input class="input" id="guess-input" placeholder="${esc(t("typeGuess"))}" enterkeyhint="send" autocapitalize="off" autocorrect="off" spellcheck="false">
      <button class="btn primary" type="submit">${esc(t("guess"))}</button>
    </form>
    <ul class="guesses" id="guess-list"></ul>`;

  const canvas = $("#guess-canvas");
  sizeCanvas(canvas);
  const s = (guessing = { finished: false });
  keepAwake(true);
  const elapsed = () => store.now() - turn.guessStartedAt;

  const list = $("#guess-list");
  const made = [];
  const showLeft = () => {
    const n = G.guessesLeft(made);
    $("#guess-left").textContent = t("guessesLeft", { n });
  };
  const addGuess = (g) => {
    made.push(g);
    list.insertAdjacentHTML("afterbegin", `<li class="g-${esc(g.r)}">${esc(g.g)}${g.r === "close" ? ` <em>${esc(t("soClose"))}</em>` : ""}</li>`);
    showLeft();
  };
  Object.values(turn.guesses || {})
    .sort((a, b) => a.t - b.t)
    .forEach(addGuess);
  showLeft();

  async function finish(correct, ms) {
    if (s.finished) return;
    s.finished = true;
    clearInterval(s.timer);
    const pts = G.scoreTurn({ correct, ms, limitMs: limit });
    const used = usedWords(game);
    const nextKey = turnKey(turn.n + 1);
    const patch = {
      [`turns/${key}/status`]: "done",
      [`turns/${key}/result`]: { correct, ms: Math.round(ms), drawerPts: pts.drawer, guesserPts: pts.guesser },
      [`turns/${nextKey}`]: makeTurn(turn.n + 1, seat, used, game.lang, game.wordLevel, game.adult !== false),
      cur: nextKey,
    };
    try {
      await store.update(`games/${gameId}`, patch);
      keepAwake(false);
    } catch (err) {
      console.error(err);
      s.finished = false;
      s.timer = setInterval(s.tick, 50);
      toast(t("saveFailed"));
    }
  }

  $("#guess-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#guess-input");
    const text = input.value.trim();
    if (!text || s.finished) return;
    input.value = "";
    const ms = elapsed();
    if (ms > limit) return finish(false, limit);
    const r = G.checkGuess(text, turn.word);
    const g = { g: text.slice(0, 40), t: Math.round(ms), r };
    addGuess(g);
    store.update(`games/${gameId}/turns/${key}/guesses`, { [store.newKey()]: g }).catch(console.error);
    if (r === "correct") finish(true, ms);
    else if (G.guessesLeft(made) === 0) finish(false, ms);
    else if (r === "close") navigator.vibrate?.(20);
  });

  s.tick = () => {
    if (s.finished) return;
    const ms = elapsed();
    const left = limit - ms;
    $("#guess-timer").textContent = secs(left);
    $("#guess-timer").classList.toggle("urgent", left < 10000);
    $("#guess-bar").style.transform = `scaleX(${Math.max(0, left / limit)})`;
    $("#guess-worth").textContent = t("worthNow", { n: G.pointsAt(ms, limit) });
    paintReplay(canvas, strokes, tl, ms);
    if (left <= 0) finish(false, limit);
  };
  s.timer = setInterval(s.tick, 50);
  s.tick();
  if (G.guessesLeft(made) === 0) finish(false, Math.min(elapsed(), limit));
  else if (elapsed() < limit) $("#guess-input").focus({ preventScroll: true });
}

// ---------- panel: waiting ----------
function panelWait(panel, seat) {
  const [, , what] = panelKey.split(":");
  const other = nameOf(game, G.otherSeat(seat));
  const msgs = {
    join: [t("sentHead"), t("sentSub")],
    guess: [t("st_waitGuess", { name: other }), t("waitGuessSub")],
    draw: [t("st_waitDraw", { name: other }), t("waitDrawSub")],
  };
  const [head, sub] = msgs[what];
  panel.innerHTML = `
    <div class="card stack center">
      <h2>${esc(head)}</h2>
      <p class="muted">${esc(sub)}</p>
      ${what === "join" ? `<p class="link-line">${esc(gameLink().replace(/^https?:\/\//, ""))}</p>` : ""}
      <p class="muted small" id="wait-extra"></p>
      <button class="btn primary" id="share-btn">${esc(what === "join" ? t("sendInvite") : t("nudge", { name: other }))}</button>
      <div id="push-box"></div>
    </div>`;
  $("#share-btn").onclick = () => share(what);
  renderPushBox(seat);
  updatePanel(seat);
}

// ---------- notifications ----------
// Offered on the waiting screen, where "tell me when it's my turn" makes sense.
function renderPushBox(seat) {
  const box = $("#push-box");
  const perm = P.pushPermission();
  if (!box || perm === "unsupported") return;
  if (perm === "granted" && game.push?.[seat]) {
    box.innerHTML = `<p class="muted small">${esc(t("pushOn"))}</p>`;
  } else if (perm === "denied") {
    box.innerHTML = `<p class="muted small">${esc(t("pushBlocked"))}</p>`;
  } else {
    box.innerHTML = `<button class="btn" id="push-btn">${esc(t("pushButton"))}</button>`;
    $("#push-btn").onclick = async (e) => {
      e.target.disabled = true;
      try {
        const sub = await P.subscribe();
        if (sub) await store.update(`games/${gameId}/push`, { [seat]: sub });
        else toast(t("pushNotAllowed"));
      } catch (err) {
        console.error(err);
        toast(t("pushFailed"));
      }
      renderPushBox(seat);
    };
  }
}

// Push services can replace a subscription; keep the stored one current, once per page load.
let pushSynced = null;
async function syncPush(seat) {
  if (pushSynced === gameId + seat) return;
  pushSynced = gameId + seat;
  const sub = await P.currentSubscription().catch(() => null);
  if (sub && sub.endpoint !== game?.push?.[seat]?.endpoint) store.update(`games/${gameId}/push`, { [seat]: sub }).catch(console.error);
}

async function notifyPartner(seat, prefix) {
  const other = G.otherSeat(seat);
  const them = nameOf(game, other);
  let ok = false;
  try {
    const tt = tThem(game, seat);
    const r = await P.notify(game.push[other], { title: tt("drewSomething", { name: nameOf(game, seat) }), body: tt("notifyBody"), url: gameLink() });
    if (r.gone) await store.update(`games/${gameId}/push`, { [other]: null });
    ok = r.status >= 200 && r.status < 300;
  } catch (err) {
    console.error(err);
  }
  toast(prefix + (ok ? t("notified", { name: them }) : t("notifyFailed", { name: them })));
}

const gameLink = () => location.origin + location.pathname.replace(/index\.html$/, "") + "#" + gameId;

// auto: opened right after Send. Only the share sheet, and nothing on failure (the Nudge button stays).
async function share(what, { auto = false } = {}) {
  const url = gameLink();
  const tt = tThem(game, seatOf(game));
  const text = { join: tt("shareJoin"), guess: tt("shareGuess"), draw: tt("shareDraw") }[what];
  if (navigator.share) {
    try {
      await navigator.share({ title: "Doodle Duet", text, url });
      return;
    } catch (e) {
      if (e.name === "AbortError" || auto) return;
    }
  }
  if (auto) return;
  try {
    await navigator.clipboard.writeText(text + " " + url);
    toast(t("linkCopied"));
  } catch {
    toast(url);
  }
}

// ---------- canvas drawing ----------
function parseStrokes(s) {
  try {
    return typeof s === "string" ? JSON.parse(s) : s || [];
  } catch {
    return [];
  }
}

function sizeCanvas(canvas, cssWidth) {
  const dpr = Math.min(devicePixelRatio || 1, 3);
  const w = cssWidth || canvas.getBoundingClientRect().width || 320;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(w * dpr * (H / W));
}

function strokePath(ctx, p, upTo) {
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  if (upTo === 1) {
    ctx.lineTo(p[0] + 0.1, p[1]); // a tap draws a dot
    return;
  }
  for (let i = 1; i < upTo - 1; i++) {
    const x = p[i * 3], y = p[i * 3 + 1];
    ctx.quadraticCurveTo(x, y, (x + p[i * 3 + 3]) / 2, (y + p[i * 3 + 4]) / 2);
  }
  ctx.lineTo(p[(upTo - 1) * 3], p[(upTo - 1) * 3 + 1]);
}

function prep(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return ctx;
}

function drawStroke(ctx, s, upTo) {
  ctx.strokeStyle = COLORS[s.c] ?? COLORS[0];
  ctx.lineWidth = (SIZES[s.w] ?? SIZES[1]) * (s.c === ERASER ? 2 : 1);
  strokePath(ctx, s.p, upTo);
  ctx.stroke();
}

function paint(canvas, strokes) {
  const ctx = prep(canvas);
  for (const s of strokes) drawStroke(ctx, s, s.p.length / 3);
}

function paintReplay(canvas, strokes, tl, ms) {
  const ctx = prep(canvas);
  strokes.forEach((s, i) => {
    const ts = tl.times[i];
    if (ts[0] > ms) return;
    let k = 0;
    while (k < ts.length && ts[k] <= ms) k++;
    drawStroke(ctx, s, k);
  });
}

addEventListener("resize", () => {
  if (drawing || guessing) return; // keep live canvases as they are mid-round
  if (game && seatOf(game)) {
    $("#history").dataset.sig = "";
    renderHistory(seatOf(game));
  }
});

boot();

// Exposed for testing in the browser console only.
window.__dd = { get store() { return store; }, get game() { return game; }, get gameId() { return gameId; } };
