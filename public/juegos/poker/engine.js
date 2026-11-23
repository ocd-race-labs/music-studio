// Texas Hold'em poker with one English deck. Shared by the server (Supabase Edge Function) and the browser.
// Everybody starts with 1000 chips; blinds 10/20. Two private cards each, five shared on the table.
// Betting: fold, check, call, raise (to an amount) or all-in. Side pots are built from what each player put in.
// The last one with chips wins. A card is "RANK-SUIT": "10-H", "A-S".

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const SUITS = ["S", "H", "D", "C"];
export const MAX_PLAYERS = 8;
export const START_CHIPS = 1000, SB = 10, BB = 20;
export const HAND_NAME = ["Carta alta", "Par", "Doble par", "Trío", "Escalera", "Color", "Full", "Póker", "Escalera de color"];

export const rankOf = (c) => String(c).split("-")[0];
export const suitOf = (c) => String(c).split("-")[1];
const rv = (c) => RANKS.indexOf(rankOf(c)) + 2; // 2..14

export function buildDeck() { const d = []; for (const s of SUITS) for (const r of RANKS) d.push(`${r}-${s}`); return d; }
export function shuffle(a, rand = Math.random) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const fail = (msg) => { const e = new Error(msg); e.user = true; throw e; };
const say = (s, text) => { s.log = [text].concat(s.log || []).slice(0, 10); };

/* ---------- hand strength ---------- */
// five cards to a comparable array: [category, tie-breakers…]
function eval5(cs) {
  const v = cs.map(rv).sort((a, b) => b - a);
  const flush = cs.every((c) => suitOf(c) === suitOf(cs[0]));
  const uniq = [...new Set(v)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (v[0] - v[4] === 4) straightHigh = v[0];
    else if (v.join() === "14,5,4,3,2") straightHigh = 5;
  }
  const cnt = {}; v.forEach((x) => (cnt[x] = (cnt[x] || 0) + 1));
  const groups = Object.entries(cnt).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  if (straightHigh && flush) return [8, straightHigh];
  if (groups[0][0] === 4) return [7, groups[0][1], groups[1][1]];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, groups[0][1], groups[1][1]];
  if (flush) return [5, ...v];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][0] === 3) return [3, groups[0][1], ...groups.slice(1).map((g) => g[1])];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, groups[0][1], groups[1][1], groups[2][1]];
  if (groups[0][0] === 2) return [1, groups[0][1], ...groups.slice(1).map((g) => g[1])];
  return [0, ...v];
}
export const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
export function best(cards) {
  let top = null, topCards = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const five = [cards[a], cards[b], cards[c], cards[d], cards[e]], sc = eval5(five);
    if (!top || cmp(sc, top) > 0) { top = sc; topCards = five; }
  }
  return { score: top, cards: topCards };
}
export const handName = (score) => (score[0] === 8 && score[1] === 14 ? "Escalera real" : HAND_NAME[score[0]]);

/* ---------- table ---------- */
const mk = (p) => ({ id: p.id, name: String(p.name || "Jugador").slice(0, 24), keyHash: p.keyHash, chips: 0, hole: [], bet: 0, total: 0, folded: true, allin: false, acted: false, out: false });
export function newGame(code, host) {
  return { code, game: "poker", phase: "lobby", stage: null, hostId: host.id, players: [mk(host)], deck: [], board: [], dealer: -1, turn: 0,
    street: null, currentBet: 0, minRaise: BB, handNo: 0, result: null, winner: null, log: [], version: 0 };
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
  for (const p of s.players) { p.chips = START_CHIPS; p.out = false; }
  s.dealer = -1; s.handNo = 0; s.winner = null; s.phase = "playing";
  newHand(s, rand);
}
const n_ = (s) => s.players.length;
const live = (s) => s.players.map((p, i) => i).filter((i) => !s.players[i].out);
const nextFrom = (s, i, ok) => { for (let k = 1; k <= n_(s); k++) { const j = (i + k) % n_(s); if (ok(j)) return j; } return -1; };
const canAct = (p) => !p.folded && !p.allin && !p.out;
function post(p, amt) { const a = Math.min(amt, p.chips); p.chips -= a; p.bet += a; p.total += a; if (!p.chips) p.allin = true; return a; }

function newHand(s, rand) {
  for (const p of s.players) if (!p.out && p.chips <= 0) p.out = true;
  const seats = live(s);
  if (seats.length < 2) { s.phase = "finished"; s.stage = null; s.winner = seats[0]; say(s, `¡${s.players[seats[0]].name} se quedó con todas las fichas!`); return; }
  s.handNo += 1;
  s.dealer = nextFrom(s, s.dealer < 0 ? n_(s) - 1 : s.dealer, (j) => !s.players[j].out);
  s.deck = shuffle(buildDeck(), rand); s.board = []; s.result = null;
  for (const p of s.players) { p.hole = []; p.bet = 0; p.total = 0; p.allin = false; p.acted = false; p.folded = p.out; }
  for (let r = 0; r < 2; r++) for (let k = 1; k <= n_(s); k++) { const j = (s.dealer + k) % n_(s); if (!s.players[j].out) s.players[j].hole.push(s.deck.shift()); }
  const heads = seats.length === 2;
  const sb = heads ? s.dealer : nextFrom(s, s.dealer, (j) => !s.players[j].out);
  const bb = nextFrom(s, sb, (j) => !s.players[j].out);
  post(s.players[sb], SB); post(s.players[bb], BB);
  s.sbSeat = sb; s.bbSeat = bb;
  s.currentBet = BB; s.minRaise = BB; s.street = "preflop"; s.stage = "hand";
  s.turn = nextFrom(s, bb, (j) => canAct(s.players[j]));
  say(s, `Mano ${s.handNo}: reparte ${s.players[s.dealer].name}`);
  settleIfStuck(s, rand);
}

export function act(s, pi, b, rand = Math.random) {
  const a = String(b.action || "");
  if (a === "next") return nextHand(s, rand);
  if (s.phase !== "playing" || s.stage !== "hand") fail("No hay una mano en juego");
  if (s.turn !== pi) fail("No es tu turno");
  const p = s.players[pi], toCall = s.currentBet - p.bet;
  if (a === "fold") { p.folded = true; say(s, `${p.name} se retira`); }
  else if (a === "check") { if (toCall > 0) fail(`Tienes que pagar ${toCall} o retirarte`); say(s, `${p.name} pasa`); }
  else if (a === "call") { if (toCall <= 0) fail("No hay nada que pagar"); const paid = post(p, toCall); say(s, p.allin ? `${p.name} va con todo (${paid})` : `${p.name} paga ${paid}`); }
  else if (a === "raise" || a === "allin") {
    const max = p.bet + p.chips;
    let to = a === "allin" ? max : Math.floor(Number(b.amount) || 0);
    if (to > max) fail("No tienes tantas fichas");
    if (to <= s.currentBet) { if (a === "allin") { post(p, max - p.bet); say(s, `${p.name} va con todo`); return advance(s, pi, rand); } fail("La subida tiene que ser mayor que la apuesta"); }
    if (to < s.currentBet + s.minRaise && to < max) fail(`Tienes que subir al menos a ${s.currentBet + s.minRaise}`);
    const raise = to - s.currentBet;
    post(p, to - p.bet);
    if (raise >= s.minRaise) { s.minRaise = raise; for (const q of s.players) if (q !== p) q.acted = false; }
    s.currentBet = to;
    say(s, p.allin ? `${p.name} va con todo (${to})` : `${p.name} sube a ${to}`);
  } else fail("Acción desconocida");
  p.acted = true;
  advance(s, pi, rand);
}

function advance(s, pi, rand) {
  s.players[pi].acted = true;
  const inHand = s.players.filter((p) => !p.folded && !p.out);
  if (inHand.length === 1) return award(s, false);
  const pending = s.players.map((p, i) => i).filter((i) => { const p = s.players[i]; return canAct(p) && (!p.acted || p.bet < s.currentBet); });
  if (pending.length) { s.turn = nextFrom(s, pi, (j) => pending.includes(j)); return; }
  nextStreet(s, rand);
}
function nextStreet(s, rand) {
  for (const p of s.players) { p.bet = 0; p.acted = false; }
  s.currentBet = 0; s.minRaise = BB;
  if (s.street === "river") return award(s, true);
  s.deck.shift(); // burn
  if (s.street === "preflop") { s.board.push(...s.deck.splice(0, 3)); s.street = "flop"; }
  else if (s.street === "flop") { s.board.push(s.deck.shift()); s.street = "turn"; }
  else { s.board.push(s.deck.shift()); s.street = "river"; }
  s.turn = nextFrom(s, s.dealer, (j) => canAct(s.players[j]));
  settleIfStuck(s, rand);
}
// with fewer than two players able to bet, the rest of the board comes out by itself
function settleIfStuck(s, rand) {
  if (s.stage !== "hand") return;
  const able = s.players.filter(canAct);
  const owe = able.filter((p) => p.bet < s.currentBet);
  if (able.length >= 2 || owe.length) return;
  nextStreet(s, rand);
}

function award(s, showdown) {
  const P = s.players, contenders = P.map((p, i) => i).filter((i) => !P[i].folded && !P[i].out);
  const scores = {};
  if (showdown) for (const i of contenders) scores[i] = best(P[i].hole.concat(s.board));
  // pots by levels of what each player put in
  const levels = [...new Set(P.map((p) => p.total).filter((t) => t > 0))].sort((a, b) => a - b);
  let prev = 0; const pots = [];
  for (const lv of levels) {
    const amount = P.reduce((a, p) => a + Math.max(0, Math.min(p.total, lv) - prev), 0);
    const eligible = contenders.filter((i) => P[i].total >= lv);
    if (amount > 0) {
      if (eligible.length) pots.push({ amount, eligible });
      else if (pots.length) pots[pots.length - 1].amount += amount;
    }
    prev = lv;
  }
  const winnings = P.map(() => 0), potsOut = [];
  for (const pot of pots) {
    let win = pot.eligible;
    if (showdown && win.length > 1) {
      let top = null;
      for (const i of win) if (!top || cmp(scores[i].score, top) > 0) top = scores[i].score;
      win = win.filter((i) => cmp(scores[i].score, top) === 0);
    }
    const share = Math.floor(pot.amount / win.length);
    let rest = pot.amount - share * win.length;
    // odd chips go to the first winners after the dealer
    const order = win.slice().sort((a, b) => ((a - s.dealer + n_(s)) % n_(s)) - ((b - s.dealer + n_(s)) % n_(s)));
    for (const i of order) { winnings[i] += share + (rest > 0 ? 1 : 0); if (rest > 0) rest--; }
    potsOut.push({ amount: pot.amount, winners: win });
  }
  winnings.forEach((w, i) => { P[i].chips += w; });
  s.result = {
    showdown, pots: potsOut, winnings,
    hands: showdown ? contenders.map((i) => ({ seat: i, hole: P[i].hole, best: scores[i].cards, name: handName(scores[i].score) })) : [],
  };
  const names = winnings.map((w, i) => (w ? `${P[i].name} gana ${w}` : null)).filter(Boolean).join(" · ");
  say(s, names + (showdown && s.result.hands.length ? "" : " (los demás se retiraron)"));
  s.stage = "result"; s.turn = -1;
  for (const p of P) { p.bet = 0; }
}
function nextHand(s, rand) {
  if (s.phase === "finished") { return start(s, s.players.findIndex((p) => p.id === s.hostId), rand); }
  if (s.stage !== "result") fail("La mano no ha terminado");
  newHand(s, rand);
}

export function view(s, pi) {
  const showAll = s.stage === "result" && s.result && s.result.showdown;
  const me = s.players[pi];
  return {
    code: s.code, game: "poker", phase: s.phase, stage: s.stage, hostId: s.hostId, me: pi, turn: s.turn, dealer: s.dealer, sbSeat: s.sbSeat, bbSeat: s.bbSeat,
    board: s.board, street: s.street, currentBet: s.currentBet, minRaise: s.minRaise, handNo: s.handNo, result: s.result, winner: s.winner, log: s.log, version: s.version,
    pot: s.players.reduce((a, p) => a + p.total, 0),
    toCall: me ? Math.max(0, s.currentBet - me.bet) : 0,
    minTo: s.currentBet + s.minRaise, maxTo: me ? me.bet + me.chips : 0,
    players: s.players.map((p, i) => ({ name: p.name, chips: p.chips, bet: p.bet, total: p.total, folded: p.folded, allin: p.allin, out: p.out, host: p.id === s.hostId,
      hole: i === pi || (showAll && !p.folded && !p.out) ? p.hole : null, cards: p.hole.length })),
  };
}
