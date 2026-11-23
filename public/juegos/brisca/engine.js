// Brisca with the Spanish deck (40 cards). Shared by the server (Supabase Edge Function) and the browser.
// Three cards each; one card turned face up marks the trump suit and is the last one drawn.
// Each trick: the highest trump wins; with no trump, the highest card of the suit led. No need to follow suit.
// Card points: As 11, 3 10, Rey 4, Caballo 3, Sota 2, the rest 0; 120 in all, 61 wins.
// With 4 players it is pairs: seats 1 and 3 against 2 and 4. With 3 players the 2 of oros is left out.
// A card is "NUMBER-SUIT": 1..7, 10 sota, 11 caballo, 12 rey; suits O oros, C copas, E espadas, B bastos.

export const NUMS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const SUITS = ["O", "C", "E", "B"];
export const SUIT_NAME = { O: "oros", C: "copas", E: "espadas", B: "bastos" };
export const MAX_PLAYERS = 4;
const ORDER = [1, 3, 12, 11, 10, 7, 6, 5, 4, 2]; // strongest first
const PTS = { 1: 11, 3: 10, 12: 4, 11: 3, 10: 2 };

export const numOf = (c) => Number(String(c).split("-")[0]);
export const suitOf = (c) => String(c).split("-")[1];
export const points = (c) => PTS[numOf(c)] || 0;
const strength = (c) => 10 - ORDER.indexOf(numOf(c));

export function buildDeck(n) {
  const d = [];
  for (const s of SUITS) for (const k of NUMS) d.push(`${k}-${s}`);
  return n === 3 ? d.filter((c) => c !== "2-O") : d;
}
export function shuffle(a, rand = Math.random) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const fail = (msg) => { const e = new Error(msg); e.user = true; throw e; };
const say = (s, text) => { s.log = [text].concat(s.log || []).slice(0, 10); };
const mk = (p) => ({ id: p.id, name: String(p.name || "Jugador").slice(0, 24), keyHash: p.keyHash, hand: [], pile: [], wins: 0 });
export const teamOf = (s, i) => (s.players.length === 4 ? i % 2 : i);
export const pilePoints = (p) => p.pile.reduce((a, c) => a + points(c), 0);

export function trickWinner(trick, trump) {
  let best = 0;
  for (let k = 1; k < trick.length; k++) {
    const a = trick[best].c, b = trick[k].c;
    const aT = suitOf(a) === trump, bT = suitOf(b) === trump;
    if (bT && !aT) best = k;
    else if (bT === aT && suitOf(b) === suitOf(a) && strength(b) > strength(a)) best = k;
  }
  return trick[best].p;
}

export function newGame(code, host) {
  return { code, game: "brisca", phase: "lobby", hostId: host.id, players: [mk(host)], deck: [], trump: null, trumpSuit: null,
    trick: [], turn: 0, round: 0, lastTrick: null, result: null, log: [], version: 0 };
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
function deal(s, rand) {
  const n = s.players.length, dealer = s.round % n;
  const deck = shuffle(buildDeck(n), rand);
  for (const p of s.players) { p.hand = deck.splice(0, 3); p.pile = []; }
  s.trump = deck.shift(); s.trumpSuit = suitOf(s.trump);
  deck.push(s.trump); // the face-up card is the last one drawn
  s.deck = deck; s.trick = []; s.lastTrick = null; s.result = null;
  s.turn = (dealer + 1) % n; s.phase = "playing";
  say(s, `Mano ${s.round + 1}: triunfo ${SUIT_NAME[s.trumpSuit]}`);
}
export function start(s, pi, rand = Math.random) {
  if (s.players[pi].id !== s.hostId) fail("Solo quien creó la mesa puede empezar");
  if (s.players.length < 2) fail("Se necesitan al menos 2 jugadores");
  if (s.phase !== "lobby") fail("Ya empezó");
  s.round = 0; for (const p of s.players) p.wins = 0;
  deal(s, rand);
}
export function next(s, pi, rand = Math.random) {
  if (s.phase !== "finished") fail("La mano no ha terminado");
  s.round += 1; deal(s, rand);
}
export function play(s, pi, card) {
  if (s.phase !== "playing") fail("No hay una mano en juego");
  if (s.turn !== pi) fail("No es tu turno");
  const p = s.players[pi], k = p.hand.indexOf(card);
  if (k < 0) fail("Esa carta no está en tu mano");
  p.hand.splice(k, 1);
  s.trick.push({ p: pi, c: card });
  const n = s.players.length;
  if (s.trick.length < n) { s.turn = (pi + 1) % n; return; }
  // the trick is complete
  const w = trickWinner(s.trick, s.trumpSuit), pts = s.trick.reduce((a, t) => a + points(t.c), 0);
  s.players[w].pile.push(...s.trick.map((t) => t.c));
  s.lastTrick = { cards: s.trick, winner: w, points: pts, at: s.version };
  s.trick = [];
  // the winner draws first, then the others in turn
  for (let k2 = 0; k2 < n && s.deck.length; k2++) s.players[(w + k2) % n].hand.push(s.deck.shift());
  s.turn = w;
  if (s.players.every((x) => !x.hand.length)) endRound(s);
}
function endRound(s) {
  const n = s.players.length, teams = n === 4 ? 2 : n;
  const pts = Array(teams).fill(0);
  s.players.forEach((p, i) => { pts[teamOf(s, i)] += pilePoints(p); });
  const top = Math.max(...pts), winners = pts.map((v, t) => (v === top ? t : -1)).filter((t) => t >= 0);
  const tie = winners.length > 1;
  if (!tie) s.players.forEach((p, i) => { if (teamOf(s, i) === winners[0]) p.wins += 1; });
  s.result = { points: pts, winner: tie ? null : winners[0] };
  s.phase = "finished";
  say(s, tie ? `Empate a ${top}` : `Mano para ${n === 4 ? s.players[winners[0]].name + " y " + s.players[winners[0] + 2].name : s.players[winners[0]].name} con ${top} puntos`);
}

export function view(s, pi) {
  return {
    code: s.code, game: "brisca", phase: s.phase, round: s.round, turn: s.turn, me: pi, hostId: s.hostId,
    deckCount: s.deck.length, trump: s.deck.length ? s.trump : null, trumpSuit: s.trumpSuit, trick: s.trick, lastTrick: s.lastTrick,
    result: s.result, teams: s.players.length === 4, log: s.log, version: s.version,
    players: s.players.map((p, i) => ({ name: p.name, count: p.hand.length, pile: p.pile.length, wins: p.wins, host: p.id === s.hostId,
      points: s.phase === "finished" ? pilePoints(p) : null, hand: i === pi ? p.hand : null })),
  };
}
