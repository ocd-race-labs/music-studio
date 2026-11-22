// Nerviosito with one English deck (52 cards). Shared by the server (Supabase Edge Function) and the browser.
// The whole deck is dealt face down. In turn, each player flips their top card onto the centre while the
// count goes A, 2, 3 … J, Q, K and starts again. When the card matches the rank being said, everybody
// slaps ("¡mano!"); the last one to slap, or anybody who doesn't, takes the whole centre pile.
// Slapping when there is no match also takes the pile. The first player left without cards wins.
// A card is "RANK-SUIT": "10-H", "A-S".

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SAY = ["As", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez", "Jota", "Reina", "Rey"];
export const SUITS = ["S", "H", "D", "C"];
export const MAX_PLAYERS = 8;
export const WINDOW_MS = 3500;

export const rankOf = (c) => String(c).split("-")[0];
export function buildDeck() { const d = []; for (const s of SUITS) for (const r of RANKS) d.push(`${r}-${s}`); return d; }
export function shuffle(a, rand = Math.random) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const fail = (msg) => { const e = new Error(msg); e.user = true; throw e; };
const say = (s, text) => { s.log = [text].concat(s.log || []).slice(0, 8); };
const mk = (p) => ({ id: p.id, name: String(p.name || "Jugador").slice(0, 24), keyHash: p.keyHash, pile: [] });

export function newGame(code, host) {
  return { code, phase: "lobby", hostId: host.id, players: [mk(host)], center: [], turn: 0, count: 0,
    window: null, lastFlip: null, lastTake: null, winner: null, log: [], version: 0, round: 0 };
}
export function join(s, p) {
  const i = s.players.findIndex((x) => x.id === p.id);
  if (i >= 0) { s.players[i].name = String(p.name || s.players[i].name).slice(0, 24); return i; }
  if (s.phase !== "lobby") fail("La partida ya empezó");
  if (s.players.length >= MAX_PLAYERS) fail("La mesa está llena (máximo 8)");
  s.players.push(mk(p));
  say(s, `${p.name} se unió`);
  return s.players.length - 1;
}
export function start(s, pi, rand = Math.random) {
  if (s.players[pi].id !== s.hostId) fail("Solo quien creó la mesa puede empezar");
  if (s.players.length < 2) fail("Se necesitan al menos 2 jugadores");
  if (s.phase === "playing") fail("Ya empezó");
  const deck = shuffle(buildDeck(), rand);
  for (const p of s.players) p.pile = [];
  deck.forEach((c, k) => s.players[k % s.players.length].pile.push(c));
  s.center = []; s.count = 0; s.window = null; s.lastFlip = null; s.lastTake = null; s.winner = null;
  s.turn = s.round % s.players.length; s.round += 1;
  s.phase = "playing";
  say(s, "¡A jugar!");
}

export function flip(s, pi, now) {
  if (s.phase !== "playing") fail("La partida no está en juego");
  if (s.window) fail("Primero se resuelve la mano");
  if (s.turn !== pi) fail("No es tu turno");
  const p = s.players[pi];
  if (!p.pile.length) fail("No te quedan cartas");
  const card = p.pile.shift();
  s.center.push(card);
  const said = s.count;
  s.count = (s.count + 1) % 13;
  const match = rankOf(card) === RANKS[said];
  s.lastFlip = { by: pi, card, said, match, at: now };
  if (match) { s.window = { said, opened: now, deadline: now + WINDOW_MS, slaps: [] }; return; }
  if (!p.pile.length) return win(s, pi);
  s.turn = nextWithCards(s, pi);
}

export function slap(s, pi, now) {
  if (s.phase !== "playing") fail("La partida no está en juego");
  if (s.window) {
    if (s.window.slaps.includes(pi)) return;
    s.window.slaps.push(pi);
    if (s.window.slaps.length === s.players.length) close(s, now);
    return;
  }
  // a late tap right after a slap round closed is not a false slap
  if (s.lastTake && s.lastTake.at && now - s.lastTake.at < 1500) return;
  if (!s.center.length) fail("No hay nada en el centro");
  give(s, pi, "puso la mano en falso", null, now);
}

// the slap window ends when everybody has slapped, or when its time runs out
export function tick(s, now) {
  if (s.window && now >= s.window.deadline) { close(s, now); return true; }
  return false;
}
function close(s, now) {
  const w = s.window;
  const missing = s.players.map((_, i) => i).filter((i) => !w.slaps.includes(i));
  const loser = missing.length ? missing[0] : w.slaps[w.slaps.length - 1];
  s.window = null;
  give(s, loser, missing.length ? "no puso la mano" : "fue el último en poner la mano", w.slaps.slice(), now);
  const f = s.lastFlip;
  if (s.phase === "playing" && f && !s.players[f.by].pile.length && f.by !== loser) win(s, f.by);
}
function give(s, pi, why, order = null, now = 0) {
  const n = s.center.length;
  s.players[pi].pile.push(...s.center);
  s.center = []; s.count = 0; s.turn = pi;
  s.lastTake = { who: pi, n, why, order, at: now };
  say(s, `${s.players[pi].name} ${why} y se lleva ${n} ${n === 1 ? "carta" : "cartas"}`);
}
function nextWithCards(s, from) {
  for (let k = 1; k <= s.players.length; k++) { const i = (from + k) % s.players.length; if (s.players[i].pile.length) return i; }
  return from;
}
function win(s, pi) { s.phase = "finished"; s.winner = pi; s.window = null; say(s, `¡${s.players[pi].name} se quedó sin cartas y gana!`); }

// everything here is public: nobody (not even the owner) sees the order of the face-down cards
export function publicView(s, now) {
  return {
    code: s.code, phase: s.phase, hostId: s.hostId, turn: s.turn, count: s.count, round: s.round,
    top: s.center[s.center.length - 1] || null, centerCount: s.center.length,
    window: s.window ? { said: s.window.said, deadline: s.window.deadline, slaps: s.window.slaps } : null,
    lastFlip: s.lastFlip, lastTake: s.lastTake, winner: s.winner, log: s.log, version: s.version, serverNow: now,
    players: s.players.map((p) => ({ id: p.id, name: p.name, count: p.pile.length })),
  };
}
