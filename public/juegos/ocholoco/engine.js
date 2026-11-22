// Ocho loco (crazy eights) with one English deck. Shared by the server (Supabase Edge Function) and the browser.
// Play a card of the same suit or the same number as the top of the pile. An 8 goes on anything and
// lets you choose the suit. If you can't (or don't want to) play, draw: up to 3 cards, then you may pass.
// The first to empty their hand wins the round; the others add up what they hold (8 = 50, J-Q-K = 10, A = 1).
// A card is "RANK-SUIT": "10-H", "8-S".

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUITS = ["S", "H", "D", "C"];
export const SUIT_NAME = { S: "picas", H: "corazones", D: "diamantes", C: "tréboles" };
export const MAX_PLAYERS = 6;
export const MAX_DRAW = 3;

export const rankOf = (c) => String(c).split("-")[0];
export const suitOf = (c) => String(c).split("-")[1];
export const points = (c) => { const r = rankOf(c); return r === "8" ? 50 : r === "A" ? 1 : ["J", "Q", "K"].includes(r) ? 10 : Number(r); };
export const canPlay = (card, top, suit) => rankOf(card) === "8" || suitOf(card) === suit || rankOf(card) === rankOf(top);

export function buildDeck() { const d = []; for (const s of SUITS) for (const r of RANKS) d.push(`${r}-${s}`); return d; }
export function shuffle(a, rand = Math.random) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const fail = (msg) => { const e = new Error(msg); e.user = true; throw e; };
const say = (s, text) => { s.log = [text].concat(s.log || []).slice(0, 10); };
const mk = (p) => ({ id: p.id, name: String(p.name || "Jugador").slice(0, 24), keyHash: p.keyHash, hand: [], scores: [] });
export const total = (p) => (p.scores || []).reduce((a, b) => a + (b || 0), 0);

export function newGame(code, host) {
  return { code, phase: "lobby", hostId: host.id, players: [mk(host)], deck: [], discard: [], suit: null, turn: 0, drawn: 0,
    round: 0, winner: null, log: [], version: 0, last: null };
}
export function join(s, p) {
  const i = s.players.findIndex((x) => x.id === p.id);
  if (i >= 0) { s.players[i].name = String(p.name || s.players[i].name).slice(0, 24); return i; }
  if (s.phase !== "lobby") fail("La partida ya empezó");
  if (s.players.length >= MAX_PLAYERS) fail("La mesa está llena (máximo 6)");
  s.players.push(mk(p));
  say(s, `${p.name} se unió`);
  return s.players.length - 1;
}
function deal(s, rand) {
  const n = s.players.length, size = n <= 4 ? 8 : 6;
  let deck = shuffle(buildDeck(), rand);
  for (const p of s.players) p.hand = deck.splice(0, size);
  // the first card of the pile is never an 8
  let k = deck.findIndex((c) => rankOf(c) !== "8");
  const first = deck.splice(k, 1)[0];
  s.discard = [first]; s.deck = deck; s.suit = suitOf(first);
  s.turn = s.round % n; s.drawn = 0; s.winner = null; s.last = null;
  s.phase = "playing";
  say(s, `Ronda ${s.round + 1}: ${size} cartas a cada uno`);
}
export function start(s, pi, rand = Math.random) {
  if (s.players[pi].id !== s.hostId) fail("Solo quien creó la mesa puede empezar");
  if (s.players.length < 2) fail("Se necesitan al menos 2 jugadores");
  if (s.phase !== "lobby") fail("Ya empezó");
  s.round = 0; for (const p of s.players) p.scores = [];
  deal(s, rand);
}
export function again(s, pi, rand = Math.random) {
  if (s.phase !== "finished") fail("La ronda no ha terminado");
  s.round += 1;
  deal(s, rand);
}
function mine(s, pi) {
  if (s.phase !== "playing") fail("No hay una ronda en juego");
  if (s.turn !== pi) fail("No es tu turno");
}
const next = (s) => { s.turn = (s.turn + 1) % s.players.length; s.drawn = 0; };

export function play(s, pi, card, chosen) {
  mine(s, pi);
  const p = s.players[pi], k = p.hand.indexOf(card);
  if (k < 0) fail("Esa carta no está en tu mano");
  const top = s.discard[s.discard.length - 1];
  if (!canPlay(card, top, s.suit)) fail(`Tiene que ser ${SUIT_NAME[s.suit]}, un ${rankOf(top)} o un 8`);
  if (rankOf(card) === "8" && !SUITS.includes(chosen)) fail("Elige la pinta");
  p.hand.splice(k, 1);
  s.discard.push(card);
  s.suit = rankOf(card) === "8" ? chosen : suitOf(card);
  s.last = { by: pi, card, suit: s.suit };
  if (rankOf(card) === "8") say(s, `${p.name} jugó un 8 y pidió ${SUIT_NAME[chosen]}`);
  if (!p.hand.length) return endRound(s, pi);
  if (p.hand.length === 1) say(s, `¡A ${p.name} le queda una carta!`);
  next(s);
}
export function draw(s, pi, rand = Math.random) {
  mine(s, pi);
  if (s.drawn >= MAX_DRAW) fail("Ya robaste 3; ahora pasa");
  if (!s.deck.length) {
    const top = s.discard.pop();
    s.deck = shuffle(s.discard, rand); s.discard = [top];
    if (!s.deck.length) fail("No quedan cartas: pasa");
  }
  s.players[pi].hand.push(s.deck.shift());
  s.drawn += 1;
}
export const canPass = (s) => s.drawn >= MAX_DRAW || (!s.deck.length && s.discard.length <= 1);
export function pass(s, pi) {
  mine(s, pi);
  if (!canPass(s)) fail("Primero roba (hasta 3 cartas)");
  say(s, `${s.players[pi].name} pasó`);
  next(s);
}
function endRound(s, winner) {
  for (const [i, p] of s.players.entries()) p.scores[s.round] = i === winner ? 0 : p.hand.reduce((a, c) => a + points(c), 0);
  s.winner = winner; s.phase = "finished";
  say(s, `¡${s.players[winner].name} se quedó sin cartas!`);
}

// what one player may see: their own hand; everybody else's count (all hands at the end of a round)
export function view(s, pi) {
  return {
    code: s.code, phase: s.phase, round: s.round, turn: s.turn, me: pi, hostId: s.hostId, drawn: s.drawn, canPass: canPass(s),
    deckCount: s.deck.length, top: s.discard[s.discard.length - 1] || null, suit: s.suit, last: s.last, winner: s.winner,
    log: s.log, version: s.version,
    players: s.players.map((p, i) => ({ name: p.name, count: p.hand.length, total: total(p), scores: p.scores, host: p.id === s.hostId,
      hand: i === pi || s.phase === "finished" ? p.hand : null })),
  };
}
