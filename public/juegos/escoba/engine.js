// Escoba de 15 with the Spanish deck (40 cards). Shared by the server (Supabase Edge Function) and the browser.
// Play one card; if it adds up to 15 with cards on the table, you take them. Clearing the table is an "escoba".
// A card is "NUMBER-SUIT": 1..7, 10 sota, 11 caballo, 12 rey; suits O oros, C copas, E espadas, B bastos.

export const NUMS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const SUITS = ["O", "C", "E", "B"];
export const SUIT_NAME = { O: "oros", C: "copas", E: "espadas", B: "bastos" };
export const MAX_PLAYERS = 4;
export const TARGET = 15;

export const numOf = (c) => Number(String(c).split("-")[0]);
export const suitOf = (c) => String(c).split("-")[1];
export const value = (c) => { const n = numOf(c); return n <= 7 ? n : n - 2; }; // sota 8, caballo 9, rey 10
export const sum = (cs) => cs.reduce((a, c) => a + value(c), 0);

export function buildDeck() { const d = []; for (const s of SUITS) for (const n of NUMS) d.push(`${n}-${s}`); return d; }
export function shuffle(a, rand = Math.random) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const fail = (msg) => { const e = new Error(msg); e.user = true; throw e; };
const say = (s, text) => { s.log = [text].concat(s.log || []).slice(0, 10); };
const mk = (p) => ({ id: p.id, name: String(p.name || "Jugador").slice(0, 24), keyHash: p.keyHash, hand: [], pile: [], escobas: 0, scores: [] });
export const total = (p) => (p.scores || []).reduce((a, b) => a + (b || 0), 0);

// every set of table cards that makes 15 with this card
export function captures(card, table) {
  const need = 15 - value(card), out = [];
  const rec = (i, picked, acc) => {
    if (acc === need && picked.length) out.push(picked.slice());
    if (acc >= need) return;
    for (let k = i; k < table.length; k++) { picked.push(table[k]); rec(k + 1, picked, acc + value(table[k])); picked.pop(); }
  };
  rec(0, [], 0);
  return out;
}

export function newGame(code, host) {
  return { code, game: "escoba", phase: "lobby", hostId: host.id, players: [mk(host)], deck: [], table: [], turn: 0, round: 0,
    lastCapturer: null, last: null, result: null, winner: null, log: [], version: 0 };
}
export function join(s, p) {
  const i = s.players.findIndex((x) => x.id === p.id);
  if (i >= 0) { s.players[i].name = String(p.name || s.players[i].name).slice(0, 24); return i; }
  if (s.phase !== "lobby") fail("La partida ya empezó");
  if (s.players.length >= MAX_PLAYERS) fail("La mesa está llena (máximo 4)");
  s.players.push(mk(p));
  say(s, `${p.name} se unió`);
  return s.players.length - 1;
}
function dealHands(s) { for (const p of s.players) p.hand = s.deck.splice(0, 3); }
function deal(s, rand) {
  const n = s.players.length, dealer = s.round % n;
  s.deck = shuffle(buildDeck(), rand);
  for (const p of s.players) { p.pile = []; p.escobas = 0; }
  s.table = s.deck.splice(0, 4);
  dealHands(s);
  s.last = null; s.result = null; s.lastCapturer = null;
  // the dealer takes a first table that already adds up to 15 (or 30): one escoba for each 15
  const t = sum(s.table);
  if (t === 15 || t === 30) {
    const d = s.players[dealer];
    d.pile.push(...s.table); d.escobas += t / 15; s.lastCapturer = dealer;
    say(s, `La mesa sumaba ${t}: ${d.name} se lleva ${t === 30 ? "dos escobas" : "una escoba"}`);
    s.table = [];
  }
  s.turn = (dealer + 1) % n;
  s.phase = "playing";
  say(s, `Ronda ${s.round + 1}`);
}
export function start(s, pi, rand = Math.random) {
  if (s.players[pi].id !== s.hostId) fail("Solo quien creó la mesa puede empezar");
  if (s.players.length < 2) fail("Se necesitan al menos 2 jugadores");
  if (s.phase !== "lobby") fail("Ya empezó");
  s.round = 0; for (const p of s.players) p.scores = [];
  deal(s, rand);
}
export function next(s, pi, rand = Math.random) {
  if (s.phase === "roundEnd") { s.round += 1; return deal(s, rand); }
  if (s.phase === "finished") { s.round = 0; for (const p of s.players) p.scores = []; s.winner = null; return deal(s, rand); }
  fail("La ronda no ha terminado");
}

export function play(s, pi, card, take) {
  if (s.phase !== "playing") fail("No hay una ronda en juego");
  if (s.turn !== pi) fail("No es tu turno");
  const p = s.players[pi], k = p.hand.indexOf(card);
  if (k < 0) fail("Esa carta no está en tu mano");
  take = Array.isArray(take) ? take : [];
  if (new Set(take).size !== take.length || take.some((c) => !s.table.includes(c))) fail("Esas cartas no están en la mesa");
  if (take.length && value(card) + sum(take) !== 15) fail(`Eso suma ${value(card) + sum(take)}; tiene que sumar 15`);
  p.hand.splice(k, 1);
  if (take.length) {
    s.table = s.table.filter((c) => !take.includes(c));
    p.pile.push(card, ...take);
    s.lastCapturer = pi;
    const escoba = s.table.length === 0;
    if (escoba) { p.escobas += 1; say(s, `¡${p.name} hizo escoba!`); }
    s.last = { by: pi, card, took: take, escoba };
  } else {
    s.table.push(card);
    s.last = { by: pi, card, took: [], escoba: false };
  }
  advance(s);
}
function advance(s) {
  const n = s.players.length;
  if (s.players.every((p) => !p.hand.length)) {
    if (s.deck.length) dealHands(s);
    else return endRound(s);
  }
  s.turn = (s.turn + 1) % n;
}
function endRound(s) {
  if (s.table.length && s.lastCapturer !== null) {
    s.players[s.lastCapturer].pile.push(...s.table);
    say(s, `${s.players[s.lastCapturer].name} se lleva lo que quedó en la mesa`);
  }
  s.table = [];
  const P = s.players;
  // one point to whoever alone has the most of something
  const most = (f) => { const v = P.map(f), m = Math.max(...v); return v.filter((x) => x === m).length === 1 ? v.indexOf(m) : -1; };
  const cards = most((p) => p.pile.length), oros = most((p) => p.pile.filter((c) => suitOf(c) === "O").length);
  const sevens = most((p) => p.pile.filter((c) => numOf(c) === 7).length);
  const velo = P.findIndex((p) => p.pile.includes("7-O"));
  const rows = P.map((p, i) => {
    const r = { escobas: p.escobas, cartas: i === cards ? 1 : 0, oros: i === oros ? 1 : 0, velo: i === velo ? 1 : 0, sietes: i === sevens ? 1 : 0,
      nCards: p.pile.length, nOros: p.pile.filter((c) => suitOf(c) === "O").length, nSietes: p.pile.filter((c) => numOf(c) === 7).length };
    r.total = r.escobas + r.cartas + r.oros + r.velo + r.sietes;
    return r;
  });
  P.forEach((p, i) => { p.scores[s.round] = rows[i].total; });
  s.result = rows;
  const tot = P.map(total), top = Math.max(...tot);
  if (top >= TARGET && tot.filter((t) => t === top).length === 1) { s.phase = "finished"; s.winner = tot.indexOf(top); say(s, `¡${P[s.winner].name} llegó a ${top} y gana!`); }
  else { s.phase = "roundEnd"; say(s, `Fin de la ronda ${s.round + 1}`); }
}

export function view(s, pi) {
  return {
    code: s.code, game: "escoba", phase: s.phase, round: s.round, turn: s.turn, me: pi, hostId: s.hostId,
    deckCount: s.deck.length, table: s.table, last: s.last, result: s.result, winner: s.winner, log: s.log, version: s.version,
    players: s.players.map((p, i) => ({ name: p.name, count: p.hand.length, pile: p.pile.length, escobas: p.escobas, total: total(p), scores: p.scores,
      host: p.id === s.hostId, hand: i === pi ? p.hand : null })),
  };
}
