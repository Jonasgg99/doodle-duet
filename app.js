import { openStore } from "./store.js";
import { LANG_NAMES } from "./words.js";
import * as G from "./game.js";
import * as P from "./push.js";

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
const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));
const turnKey = (n) => "t" + String(n).padStart(3, "0");

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
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
let store, me;
let gameId = null, game = null, unwatch = null;
let panelKey = null; // which panel is on screen, so live updates don't restart it
let drawing = null; // active drawing session
let guessing = null; // active guessing session
// The site is one shared game for two people. Other ids (old links, tests) still open via #<id>.
const MAIN_GAME = "main";
const prefs = { name: ls.get("dd_name", ""), lang: ls.get("dd_lang", "en") };

// ---------- views ----------
function show(view) {
  for (const v of document.querySelectorAll(".view")) v.hidden = v.id !== "view-" + view;
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
async function boot() {
  try {
    store = await openStore();
  } catch (e) {
    console.error(e);
    showError("Couldn't connect to the game server. Check your connection and reload.");
    return;
  }
  me = store.uid;
  $("#mode-tag").hidden = store.mode !== "local";
  setupHome();
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
  game = null;
  panelKey = null;
  openGame(G.gameIdFromHash(location.hash) ?? MAIN_GAME);
}

// ---------- home ----------
function setupHome() {
  const name = $("#name-input");
  name.value = prefs.name;
  name.addEventListener("input", () => ls.set("dd_name", (prefs.name = name.value.trim())));

  const seg = (el, options, current, onPick) => {
    el.innerHTML = options
      .map(([v, label]) => `<button type="button" role="radio" aria-checked="${v === current}" data-v="${v}">${esc(label)}</button>`)
      .join("");
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      for (const x of el.children) x.setAttribute("aria-checked", x === b);
      onPick(b.dataset.v);
    });
  };
  seg($("#lang-seg"), Object.entries(LANG_NAMES), prefs.lang, (v) => ls.set("dd_lang", (prefs.lang = v)));
  $("#new-game-btn").addEventListener("click", newGame);
}

async function newGame() {
  const name = prefs.name || "Player 1";
  const data = {
    v: 1,
    createdAt: store.now(),
    lang: prefs.lang,
    drawSecs: G.DRAW_SECS,
    players: { a: { uid: me, name } },
    cur: turnKey(0),
    turns: { [turnKey(0)]: makeTurn(0, "a", new Set(), prefs.lang) },
  };
  const btn = $("#new-game-btn");
  btn.disabled = true;
  try {
    // Claim, so a game the other phone created a moment earlier is never overwritten.
    // Either way the live watch then shows whatever game exists.
    await store.claim("games/" + gameId, data);
  } catch (e) {
    console.error(e);
    toast("Couldn't create the game. Try again.");
  } finally {
    btn.disabled = false;
  }
}

function makeTurn(n, drawer, used, lang, wordLevel) {
  return { n, drawer, status: "draw", choices: G.pickChoices(lang, used, Math.random, wordLevel) };
}

// ---------- game model helpers ----------
const seatOf = (g) => (g?.players?.a?.uid === me ? "a" : g?.players?.b?.uid === me ? "b" : null);
const turnList = (g) => G.turnsInOrder(g?.turns);
const totals = (g) => G.totals(turnList(g));
const nameOf = (g, seat) => g.players?.[seat]?.name || (seat === "a" ? "Player 1" : "Player 2");
const curTurn = (g) => g.turns[g.cur];
const guessDeadline = (g, t) => t.guessStartedAt + G.guessLimitMs(g.drawSecs);

function usedWords(g) {
  return new Set(turnList(g).map((t) => t.word).filter(Boolean));
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
      showError("This game is already being played by two other devices, so it can't be opened here.");
    }
  );
}

function showJoin() {
  show("join");
  $("#join-title").textContent = `${nameOf(game, "a")} invited you to Doodle Duet`;
  $("#join-sub").textContent = `One of you draws, the other guesses, then you swap. ${game.drawSecs} seconds to draw each word.`;
  const input = $("#join-name");
  if (!input.value) input.value = prefs.name;
  $("#join-btn").onclick = async () => {
    const name = input.value.trim() || "Player 2";
    ls.set("dd_name", (prefs.name = name));
    $("#name-input").value = name;
    $("#join-btn").disabled = true;
    try {
      const ok = await store.claim(`games/${gameId}/players/b`, { uid: me, name });
      if (!ok) throw new Error("taken");
    } catch (e) {
      console.error(e);
      const err = $("#join-error");
      err.textContent = "Someone else already joined this game.";
      err.hidden = false;
    } finally {
      $("#join-btn").disabled = false;
    }
  };
}

// ---------- game rendering ----------
function renderGame() {
  if (!game) return show("home"); // no game yet: set it up
  const seat = seatOf(game);
  if (!seat) {
    if (!game.players.b) return showJoin();
    return showError("This game already has two players on other devices.");
  }
  show("game");
  syncPush(seat);
  renderScoreboard(seat);
  renderWordSetting();
  renderHistory(seat);

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
  const mine = iDrew ? r.drawerPts : r.guesserPts;
  const head = r.correct ? (iDrew ? `${other} got it!` : "You got it!") : iDrew ? `${other} didn't get it` : "Not this time";
  const sub = r.correct ? `"${last.word}" in ${secs(r.ms)} s · +${mine} for you` : `It was "${last.word}". No points this round.`;
  const missed = G.missedGuesses(last);
  const key = turnKey(last.n);
  const el = document.createElement("div");
  el.className = `card result-banner ${r.correct ? "win" : "miss"}`;
  el.dataset.key = key;
  el.innerHTML = `<canvas class="thumb"></canvas><div class="h-text">
    <strong class="rb-head">${esc(head)}</strong><span class="small">${esc(sub)}</span>
    ${missed.length ? `<span class="small muted">${iDrew ? esc(other) + " guessed" : "You guessed"}: ${missed.map(esc).join(" · ")}</span>` : ""}
    <span class="small rb-note" hidden></span>
    ${iDrew ? "" : `<form class="note-form" autocomplete="off"><input class="input note-input" maxlength="120" placeholder="Message to ${esc(other)}" enterkeyhint="send"><button class="btn small-btn">Send</button></form>`}
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
      toast("Couldn't send your message. Check your connection.");
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
const noteLine = (t, seat) => `${t.drawer === seat ? nameOf(game, G.otherSeat(seat)) : "You"}: "${t.note.text}"`;
function fillNote(el, t, seat) {
  if (!t?.note?.text) return;
  const line = el.querySelector(".rb-note");
  line.textContent = noteLine(t, seat);
  line.hidden = false;
  el.querySelector(".note-form")?.remove();
}

function pickPanel(seat) {
  const t = curTurn(game);
  if (t.drawer === seat) {
    if (t.status === "draw") return t.word ? "draw:" + t.n : "choose:" + t.n + ":" + t.choices.map((c) => c.word).join("|");
    return "wait:" + t.n + ":" + (game.players.b ? "guess" : "join");
  }
  if (t.status === "draw") return "wait:" + t.n + ":draw";
  return (t.guessStartedAt ? "guess:" : "ready:") + t.n;
}

function renderScoreboard(seat) {
  const t = totals(game);
  const cur = curTurn(game);
  const chip = (s) => `
    <div class="player p-${s} ${s === seat ? "is-me" : ""}">
      <span class="pname">${esc(nameOf(game, s))}${s === seat ? ' <span class="you">you</span>' : ""}</span>
      <span class="pscore">${esc(t[s])}</span>
    </div>`;
  $("#scoreboard").innerHTML = `${chip("a")}<div class="round">Round ${esc(cur.n + 1)}</div>${chip("b")}`;
}

// Easy / Mixed / Hard, for both players, changeable any time. A word choice on screen that
// hasn't been picked yet is redrawn from the new lists; otherwise it applies from the next round.
const WORD_LABELS = { easy: "Easy", mixed: "Mixed", hard: "Hard" };
function renderWordSetting() {
  const seg = $("#word-seg");
  const cur = game.wordLevel ?? "mixed";
  if (!seg.children.length) {
    seg.innerHTML = G.WORD_SETTINGS.map((v) => `<button type="button" role="radio" data-v="${v}">${WORD_LABELS[v]}</button>`).join("");
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b && b.dataset.v !== (game.wordLevel ?? "mixed")) setWordLevel(b.dataset.v);
    });
  }
  for (const b of seg.children) b.setAttribute("aria-checked", b.dataset.v === cur);
}

async function setWordLevel(v) {
  const t = curTurn(game);
  const patch = { wordLevel: v };
  if (t.status === "draw" && !t.word) patch[`turns/${game.cur}/choices`] = G.pickChoices(game.lang, usedWords(game), Math.random, v);
  try {
    await store.update(`games/${gameId}`, patch);
  } catch (err) {
    console.error(err);
    toast("Couldn't change the words. Check your connection.");
  }
}

function renderHistory(seat) {
  const done = turnList(game).filter((t) => t.status === "done").reverse();
  $("#history-wrap").hidden = !done.length;
  const ul = $("#history");
  const sig = done.map((t) => t.n + (t.note?.text ?? "")).join(",");
  if (ul.dataset.sig === sig) return;
  ul.dataset.sig = sig;
  ul.innerHTML = "";
  for (const t of done) {
    const li = document.createElement("li");
    const c = document.createElement("canvas");
    c.className = "thumb";
    li.append(c);
    const r = t.result;
    const by = t.drawer === seat ? "You drew" : `${esc(nameOf(game, t.drawer))} drew`;
    const outcome = r.correct
      ? `guessed in ${secs(r.ms)} s · +${esc(t.drawer === seat ? r.drawerPts : r.guesserPts)} for you`
      : "not guessed";
    const missed = G.missedGuesses(t);
    li.insertAdjacentHTML(
      "beforeend",
      `<div class="h-text"><span class="h-word">${esc(t.word)}</span><span class="muted small">${by} · ${outcome}</span>` +
        (missed.length ? `<span class="muted small">Missed: ${missed.map(esc).join(" · ")}</span>` : "") +
        (t.note?.text ? `<span class="small rb-note">${esc(noteLine(t, seat))}</span>` : "") +
        `</div>`
    );
    ul.append(li);
    sizeCanvas(c, 96);
    paint(c, parseStrokes(t.strokes), Infinity);
  }
}

function updatePanel(seat) {
  // Live data changed but the same panel stays up: refresh what can change in place.
  if (panelKey.startsWith("wait:")) {
    const t = curTurn(game);
    const el = $("#wait-extra");
    if (el && t.status === "guess" && t.guessStartedAt && t.drawer === seat) {
      const left = guessDeadline(game, t) - store.now();
      el.textContent = left > 0 ? `${nameOf(game, G.otherSeat(seat))} is guessing right now…` : "Their guess time ran out. They'll see the answer next time they open the game.";
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
  const t = curTurn(game);
  panel.innerHTML = `
    <div class="card stack">
      <h2>Pick a word to draw</h2>
      <p class="muted small">The ${esc(game.drawSecs)}-second timer starts as soon as you pick.</p>
      <div class="choices">
        ${t.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="cw">${esc(c.word)}</span></button>`).join("")}
      </div>
    </div>`;
  panel.querySelector(".choices").addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const c = t.choices[+b.dataset.i];
    for (const x of panel.querySelectorAll("button")) x.disabled = true;
    try {
      await store.update(`games/${gameId}/turns/${game.cur}`, { word: c.word, level: c.level ?? null });
    } catch (err) {
      console.error(err);
      toast("Couldn't save your pick. Check your connection.");
      for (const x of panel.querySelectorAll("button")) x.disabled = false;
    }
  });
}

// ---------- panel: draw ----------
function panelDraw(panel, seat) {
  const t = curTurn(game);
  const limit = game.drawSecs * 1000;
  panel.innerHTML = `
    <div class="draw-head">
      <div><span class="muted small">Draw</span> <strong class="word">${esc(t.word)}</strong></div>
      <div class="timer" id="draw-timer">${esc(game.drawSecs)}</div>
    </div>
    <div class="timebar"><div class="timebar-fill" id="draw-bar"></div></div>
    <div class="canvas-box"><canvas class="art" id="draw-canvas"></canvas></div>
    <div class="tools">
      <div class="swatches" id="swatches">
        ${COLORS.map((c, i) => `<button class="swatch ${i === ERASER ? "eraser" : ""}" style="--c:${c}" data-i="${i}" aria-label="${i === ERASER ? "Eraser" : "Colour " + (i + 1)}" aria-pressed="${i === 0}"></button>`).join("")}
      </div>
      <div class="tool-row">
        <div class="sizes" id="sizes">
          ${SIZES.map((s, i) => `<button class="size" data-i="${i}" aria-label="Brush size ${i + 1}" aria-pressed="${i === 1}"><span style="--s:${6 + i * 7}px"></span></button>`).join("")}
        </div>
        <button class="btn small-btn" id="undo-btn">Undo</button>
        <button class="btn small-btn" id="clear-btn">Clear</button>
        <button class="btn primary small-btn" id="done-btn">Send</button>
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
      e.target.textContent = "Clear";
    } else {
      clearArmed = Date.now();
      e.target.textContent = "Sure?";
      setTimeout(() => (e.target.textContent = "Clear"), 2500);
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
      if (game.players.b && game.push?.[G.otherSeat(seat)]) notifyPartner(seat, byTap ? "" : "Time's up, drawing sent. ");
      else if (byTap) share(game.players.b ? "guess" : "join", { auto: true });
      else toast("Time's up, drawing sent. Tap Nudge to tell your partner.");
    } catch (err) {
      console.error(err);
      s.sent = false;
      doneBtn.disabled = false;
      toast("Couldn't send. Check your connection and tap Send again.");
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
  const t = curTurn(game);
  panel.innerHTML = `
    <div class="card stack center">
      <h2 class="big">${esc(other)} drew something</h2>
      <p>You'll watch it being drawn and can guess any time. You have <strong>${G.guessLimitMs(game.drawSecs) / 1000} seconds</strong> once you start, and it keeps counting if you leave.</p>
      <p class="muted small">You get ${G.MAX_GUESSES} wrong guesses. A quick guess is worth more: 3, 2 or 1 point, the same for both of you.</p>
      <button class="btn primary big-btn" id="start-guess">Start</button>
    </div>`;
  $("#start-guess").onclick = async (e) => {
    e.target.disabled = true;
    try {
      await store.update(`games/${gameId}/turns/${game.cur}`, { guessStartedAt: store.now() });
    } catch (err) {
      console.error(err);
      e.target.disabled = false;
      toast("Couldn't start. Check your connection.");
    }
  };
}

// ---------- panel: guess ----------
function panelGuess(panel, seat) {
  const t = curTurn(game);
  const key = game.cur;
  const strokes = parseStrokes(t.strokes);
  const tl = G.replayTimeline(strokes);
  const limit = G.guessLimitMs(game.drawSecs);
  const blanks = t.word
    .split(" ")
    .map((w) => `<span class="blank-word">${[...w].map(() => "<i></i>").join("")}</span>`)
    .join("");
  panel.innerHTML = `
    <div class="draw-head">
      <div class="blanks" aria-label="${[...t.word.replace(/ /g, "")].length} letters">${blanks}</div>
      <div class="timer" id="guess-timer"></div>
    </div>
    <div class="timebar"><div class="timebar-fill" id="guess-bar"></div></div>
    <div class="guess-meta"><span id="guess-worth"></span><span id="guess-left"></span></div>
    <div class="canvas-box"><canvas class="art" id="guess-canvas"></canvas></div>
    <form class="guess-form" id="guess-form" autocomplete="off">
      <input class="input" id="guess-input" placeholder="Type a guess" enterkeyhint="send" autocapitalize="off" autocorrect="off" spellcheck="false">
      <button class="btn primary" type="submit">Guess</button>
    </form>
    <ul class="guesses" id="guess-list"></ul>`;

  const canvas = $("#guess-canvas");
  sizeCanvas(canvas);
  const s = (guessing = { finished: false });
  keepAwake(true);
  const elapsed = () => store.now() - t.guessStartedAt;

  const list = $("#guess-list");
  const made = [];
  const showLeft = () => {
    const n = G.guessesLeft(made);
    $("#guess-left").textContent = `${n} wrong guess${n === 1 ? "" : "es"} left`;
  };
  const addGuess = (g) => {
    made.push(g);
    list.insertAdjacentHTML("afterbegin", `<li class="g-${esc(g.r)}">${esc(g.g)}${g.r === "close" ? " <em>so close!</em>" : ""}</li>`);
    showLeft();
  };
  Object.values(t.guesses || {})
    .sort((a, b) => a.t - b.t)
    .forEach(addGuess);
  showLeft();

  async function finish(correct, ms) {
    if (s.finished) return;
    s.finished = true;
    clearInterval(s.timer);
    const pts = G.scoreTurn({ correct, ms, limitMs: limit });
    const used = usedWords(game);
    const nextKey = turnKey(t.n + 1);
    const patch = {
      [`turns/${key}/status`]: "done",
      [`turns/${key}/result`]: { correct, ms: Math.round(ms), drawerPts: pts.drawer, guesserPts: pts.guesser },
      [`turns/${nextKey}`]: makeTurn(t.n + 1, seat, used, game.lang, game.wordLevel),
      cur: nextKey,
    };
    try {
      await store.update(`games/${gameId}`, patch);
      keepAwake(false);
    } catch (err) {
      console.error(err);
      s.finished = false;
      s.timer = setInterval(s.tick, 50);
      toast("Couldn't save. Check your connection.");
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
    const r = G.checkGuess(text, t.word);
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
    $("#guess-worth").textContent = `Worth ${G.pointsAt(ms, limit)} now`;
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
    join: ["Drawing sent!", "Now send your partner the link. They join, guess your drawing, then draw one for you."],
    guess: [`Waiting for ${other} to guess`, "Give them a nudge so they know your drawing is ready."],
    draw: [`Waiting for ${other} to draw`, "You'll get to guess as soon as they send it. Check back later."],
  };
  const [head, sub] = msgs[what];
  panel.innerHTML = `
    <div class="card stack center">
      <h2>${esc(head)}</h2>
      <p class="muted">${esc(sub)}</p>
      ${what === "join" ? `<p class="link-line">${esc(gameLink().replace(/^https?:\/\//, ""))}</p>` : ""}
      <p class="muted small" id="wait-extra"></p>
      <button class="btn primary" id="share-btn">${what === "join" ? "Send invite link" : "Nudge " + esc(other)}</button>
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
    box.innerHTML = `<p class="muted small">You'll get a notification when it's your turn.</p>`;
  } else if (perm === "denied") {
    box.innerHTML = `<p class="muted small">Notifications are blocked for this site. Allow them in the browser's site settings to get one when it's your turn.</p>`;
  } else {
    box.innerHTML = `<button class="btn" id="push-btn">Notify me when it's my turn</button>`;
    $("#push-btn").onclick = async (e) => {
      e.target.disabled = true;
      try {
        const sub = await P.subscribe();
        if (sub) await store.update(`games/${gameId}/push`, { [seat]: sub });
        else toast("Notifications weren't allowed.");
      } catch (err) {
        console.error(err);
        toast("Couldn't turn on notifications on this phone.");
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
    const r = await P.notify(game.push[other], { title: `${nameOf(game, seat)} drew something`, body: "Your turn to guess in Doodle Duet.", url: gameLink() });
    if (r.gone) await store.update(`games/${gameId}/push`, { [other]: null });
    ok = r.status >= 200 && r.status < 300;
  } catch (err) {
    console.error(err);
  }
  toast(prefix + (ok ? `${them} gets a notification.` : `Couldn't notify ${them}. Tap Nudge to tell them.`));
}

const gameLink = () => location.origin + location.pathname.replace(/index\.html$/, "") + (gameId === MAIN_GAME ? "" : "#" + gameId);

// auto: opened right after Send. Only the share sheet, and nothing on failure (the Nudge button stays).
async function share(what, { auto = false } = {}) {
  const url = gameLink();
  const text = {
    join: `Play Doodle Duet with me! I've drawn the first one, your turn to guess.`,
    guess: `My drawing is ready for you to guess in Doodle Duet.`,
    draw: `Your turn to draw in Doodle Duet!`,
  }[what];
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
    toast("Link copied. Paste it in a message.");
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
