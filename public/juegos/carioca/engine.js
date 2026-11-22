// Carioca (Chilean rummy) with two English decks and four jokers.
// Shared by the server (Supabase Edge Function) and the browser: rules, validation and the game engine.
// A card is "RANK-SUIT-COPY": "10-H-1", "A-S-2", "JK-*-3". Suits: S ♠, H ♥, D ♦, C ♣.

export const ROUNDS = [
  { name: "Dos tríos", t: 2, e: 0, size: 12 },
  { name: "Un trío y una escala", t: 1, e: 1, size: 12 },
  { name: "Dos escalas", t: 0, e: 2, size: 12 },
  { name: "Tres tríos", t: 3, e: 0, size: 12 },
  { name: "Dos tríos y una escala", t: 2, e: 1, size: 12 },
  { name: "Un trío y dos escalas", t: 1, e: 2, size: 12 },
  { name: "Tres escalas", t: 0, e: 3, size: 12 },
  { name: "Cuatro tríos", t: 4, e: 0, size: 12 },
  { name: "Escala real", t: 0, e: 1, size: 13, real: true },
];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUITS = ["S", "H", "D", "C"];
export const MAX_PLAYERS = 6;

export const parse = (id) => { const [r, s] = String(id).split("-"); return { r, s, joker: r === "JK" }; };
export const isJoker = (id) => parse(id).joker;
export const rankVal = (r) => RANKS.indexOf(r) + 1; // A=1 … K=13
export function points(id) {
  const { r, joker } = parse(id);
  if (joker) return 30;
  if (r === "A") return 20;
  if (r === "J" || r === "Q" || r === "K") return 10;
  return Number(r);
}

export function buildDeck() {
  const d = [];
  for (let copy = 1; copy <= 2; copy++) for (const s of SUITS) for (const r of RANKS) d.push(`${r}-${s}-${copy}`);
  for (let j = 1; j <= 4; j++) d.push(`JK-*-${j}`);
  return d;
}
export function shuffle(a, rand = Math.random) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ---------- groups ---------- */
// a trío: 3+ cards of one rank (suits free), at most one joker, at least two natural cards
export function validTrio(cards) {
  if (cards.length < 3) return false;
  const nat = cards.filter((c) => !isJoker(c)), jk = cards.length - nat.length;
  if (jk > 1 || nat.length < 2) return false;
  return nat.every((c) => parse(c).r === parse(nat[0]).r);
}
// an escala: 4+ consecutive cards of one suit, at most one joker (two in the 13-card escala real);
// it may go around the corner: Q-K-A-2 is a valid escala
export function escalaOrder(cards, maxJokers = 1) {
  const n = cards.length;
  if (n < 4 || n > 13) return null;
  const nat = cards.filter((c) => !isJoker(c)), jokers = cards.filter(isJoker);
  if (jokers.length > maxJokers || nat.length < 2) return null;
  if (!nat.every((c) => parse(c).s === parse(nat[0]).s)) return null;
  const vs = nat.map((c) => rankVal(parse(c).r));
  if (new Set(vs).size !== vs.length) return null;
  const byVal = new Map(nat.map((c) => [rankVal(parse(c).r), c]));
  // try every starting rank; the window wraps from K back to A
  for (let s = 1; s <= 13; s++) {
    const win = Array.from({ length: n }, (_, k) => ((s - 1 + k) % 13) + 1);
    if (!vs.every((v) => win.includes(v))) continue;
    const js = jokers.slice();
    return win.map((v) => (byVal.has(v) ? byVal.get(v) : js.shift()));
  }
  return null;
}
export const validEscala = (cards, maxJokers = 1) => !!escalaOrder(cards, maxJokers);
export function validGroup(type, cards, real = false) {
  if (type === "trio") return validTrio(cards);
  if (type === "escala") return real ? cards.length === 13 && validEscala(cards, 2) : validEscala(cards);
  return false;
}
// cards on the table, shown in playing order
export function arrange(group) {
  if (group.type === "escala") return escalaOrder(group.cards, 2) || group.cards;
  const nat = group.cards.filter((c) => !isJoker(c)), jk = group.cards.filter(isJoker);
  return nat.concat(jk);
}

/* ---------- game engine (runs on the server) ---------- */
export function newGame(code, host) {
  return { code, phase: "lobby", hostId: host.id, players: [mkPlayer(host)], round: 0, dealer: 0, turn: 0, drew: false,
    deck: [], discard: [], table: [], log: [], lastWinner: null, version: 0 };
}
const mkPlayer = (p) => ({ id: p.id, name: String(p.name || "Jugador").slice(0, 24), keyHash: p.keyHash, hand: [], down: false, scores: [] });
const fail = (msg) => { const e = new Error(msg); e.user = true; throw e; };
const say = (s, text) => { s.log = [text].concat(s.log || []).slice(0, 12); };

export function join(s, p) {
  const i = s.players.findIndex((x) => x.id === p.id);
  if (i >= 0) { s.players[i].name = String(p.name || s.players[i].name).slice(0, 24); return i; }
  if (s.phase !== "lobby") fail("La partida ya empezó");
  if (s.players.length >= MAX_PLAYERS) fail("La mesa está llena (máximo 6)");
  s.players.push(mkPlayer(p));
  say(s, `${p.name} se unió`);
  return s.players.length - 1;
}

export function startRound(s, rand = Math.random) {
  const R = ROUNDS[s.round];
  let deck = shuffle(buildDeck(), rand);
  for (const p of s.players) { p.hand = deck.splice(0, R.size); p.down = false; }
  s.discard = [deck.shift()];
  s.deck = deck; s.table = []; s.drew = false;
  s.turn = (s.dealer + 1) % s.players.length;
  s.phase = "playing";
  say(s, `Ronda ${s.round + 1}: ${R.name}`);
}
export function start(s, pi, rand) {
  if (s.players[pi].id !== s.hostId) fail("Solo quien creó la mesa puede empezar");
  if (s.players.length < 2) fail("Se necesitan al menos 2 jugadores");
  if (s.phase !== "lobby") fail("Ya empezó");
  s.round = 0; s.dealer = 0;
  for (const p of s.players) p.scores = [];
  startRound(s, rand);
}

function myTurn(s, pi) {
  if (s.phase !== "playing") fail("No hay una ronda en juego");
  if (s.turn !== pi) fail("No es tu turno");
}
function takeFromHand(p, cards) {
  const hand = p.hand.slice();
  for (const c of cards) { const k = hand.indexOf(c); if (k < 0) fail("Esa carta no está en tu mano"); hand.splice(k, 1); }
  return hand;
}

export function draw(s, pi, rand = Math.random) {
  myTurn(s, pi); if (s.drew) fail("Ya robaste en este turno");
  if (!s.deck.length) {
    const top = s.discard.pop();
    s.deck = shuffle(s.discard, rand); s.discard = top ? [top] : [];
    if (!s.deck.length) fail("No quedan cartas");
  }
  s.players[pi].hand.push(s.deck.shift()); s.drew = true;
  say(s, `${s.players[pi].name} robó del mazo`);
}
export function takeDiscard(s, pi) {
  myTurn(s, pi); if (s.drew) fail("Ya robaste en este turno");
  if (!s.discard.length) fail("El pozo está vacío");
  const c = s.discard.pop();
  s.players[pi].hand.push(c); s.drew = true;
  say(s, `${s.players[pi].name} tomó del pozo`);
}

// lay down the round's contract, all at once
export function laydown(s, pi, groups) {
  myTurn(s, pi); if (!s.drew) fail("Primero roba una carta");
  const p = s.players[pi], R = ROUNDS[s.round];
  if (p.down) fail("Ya te bajaste en esta ronda");
  if (!Array.isArray(groups)) fail("Juego inválido");
  const t = groups.filter((g) => g.type === "trio").length, e = groups.filter((g) => g.type === "escala").length;
  if (t !== R.t || e !== R.e) fail(`Esta ronda pide: ${R.name.toLowerCase()}`);
  for (const g of groups) if (!validGroup(g.type, g.cards, R.real)) fail(g.type === "trio" ? "Hay un trío que no es válido" : R.real ? "La escala real son 13 cartas seguidas de la misma pinta" : "Hay una escala que no es válida");
  p.hand = takeFromHand(p, groups.flatMap((g) => g.cards));
  for (const g of groups) s.table.push({ owner: pi, type: g.type, cards: g.cards.slice() });
  p.down = true;
  say(s, `${p.name} se bajó`);
  if (!p.hand.length) endRound(s, pi);
}

// add cards to any group on the table once you are down
export function addTo(s, pi, gi, cards) {
  myTurn(s, pi); if (!s.drew) fail("Primero roba una carta");
  const p = s.players[pi];
  if (!p.down) fail("Primero tienes que bajarte");
  const g = s.table[gi]; if (!g) fail("Ese juego no existe");
  if (!cards.length) fail("Elige cartas para agregar");
  const merged = g.cards.concat(cards);
  if (!validGroup(g.type, merged, false) || (g.type === "escala" && ROUNDS[s.round].real)) fail("Esas cartas no calzan en ese juego");
  p.hand = takeFromHand(p, cards);
  g.cards = merged;
  say(s, `${p.name} agregó ${cards.length === 1 ? "una carta" : cards.length + " cartas"}`);
  if (!p.hand.length) endRound(s, pi);
}

export function discard(s, pi, card) {
  myTurn(s, pi); if (!s.drew) fail("Primero roba una carta");
  const p = s.players[pi];
  p.hand = takeFromHand(p, [card]);
  s.discard.push(card);
  say(s, `${p.name} botó una carta`);
  if (!p.hand.length) return endRound(s, pi);
  s.turn = (s.turn + 1) % s.players.length; s.drew = false;
}

export function endRound(s, winner) {
  for (const [i, p] of s.players.entries()) p.scores[s.round] = i === winner ? 0 : p.hand.reduce((a, c) => a + points(c), 0);
  s.lastWinner = winner;
  s.phase = s.round >= ROUNDS.length - 1 ? "finished" : "roundEnd";
  say(s, `${s.players[winner].name} terminó la ronda ${s.round + 1}`);
}
export function nextRound(s, pi, rand) {
  if (s.phase !== "roundEnd") fail("La ronda no ha terminado");
  s.round += 1; s.dealer = (s.dealer + 1) % s.players.length;
  startRound(s, rand);
}
export function rematch(s, pi, rand) {
  if (s.phase !== "finished") fail("La partida no ha terminado");
  s.round = 0; s.dealer = (s.dealer + 1) % s.players.length;
  for (const p of s.players) p.scores = [];
  startRound(s, rand);
}
export const total = (p) => (p.scores || []).reduce((a, b) => a + (b || 0), 0);

// what one player may see: their own hand, everybody else's card count
export function view(s, pi) {
  return {
    code: s.code, phase: s.phase, round: s.round, turn: s.turn, drew: s.drew, me: pi, hostId: s.hostId,
    deckCount: s.deck.length, discardTop: s.discard[s.discard.length - 1] || null, discardCount: s.discard.length,
    table: s.table, log: s.log, lastWinner: s.lastWinner, version: s.version,
    players: s.players.map((p, i) => ({ name: p.name, count: p.hand.length, down: p.down, scores: p.scores, total: total(p), host: p.id === s.hostId,
      hand: i === pi || s.phase === "roundEnd" || s.phase === "finished" ? p.hand : null })),
  };
}
