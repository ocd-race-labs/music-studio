// Blackjack against the house, with two English decks. Shared by the server (Supabase Edge Function) and the browser.
// Everybody starts with 100 chips and bets each hand. Get closer to 21 than the dealer without going over.
// Ace 1 or 11, J Q K 10. Blackjack (ace + 10 with the first two cards) pays 3 to 2; a win pays 1 to 1.
// You may hit, stand, or double on your first two cards (one more card, bet doubled). The dealer draws to 17.
// Anyone who runs out of chips gets 100 more at the next hand. A card is "RANK-SUIT": "10-H", "A-S".

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUITS = ["S", "H", "D", "C"];
export const MAX_PLAYERS = 6;
export const START_CHIPS = 100, MIN_BET = 5;

export const rankOf = (c) => String(c).split("-")[0];
export function total(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { const r = rankOf(c); if (r === "A") { aces++; t += 11; } else t += ["J", "Q", "K"].includes(r) ? 10 : Number(r); }
  while (t > 21 && aces) { t -= 10; aces--; }
  return t;
}
export const soft = (cards) => { let t = 0, aces = 0; for (const c of cards) { const r = rankOf(c); if (r === "A") { aces++; t += 1; } else t += ["J", "Q", "K"].includes(r) ? 10 : Number(r); } return aces > 0 && t + 10 <= 21; };
export const isBJ = (cards) => cards.length === 2 && total(cards) === 21;

function buildShoe(rand) {
  const d = [];
  for (let k = 0; k < 2; k++) for (const s of SUITS) for (const r of RANKS) d.push(`${r}-${s}`);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
const fail = (msg) => { const e = new Error(msg); e.user = true; throw e; };
const say = (s, text) => { s.log = [text].concat(s.log || []).slice(0, 10); };
const mk = (p) => ({ id: p.id, name: String(p.name || "Jugador").slice(0, 24), keyHash: p.keyHash, chips: START_CHIPS, bet: 0, hand: [], inRound: false, done: false, doubled: false, outcome: null, paid: 0 });

export function newGame(code, host) {
  return { code, game: "blackjack", phase: "lobby", stage: null, hostId: host.id, players: [mk(host)], shoe: [], dealer: [], turn: -1, round: 0, log: [], version: 0 };
}
export function join(s, p) {
  const i = s.players.findIndex((x) => x.id === p.id);
  if (i >= 0) { s.players[i].name = String(p.name || s.players[i].name).slice(0, 24); return i; }
  if (s.players.length >= MAX_PLAYERS) fail("La mesa está llena (máximo 6)");
  // at a blackjack table you can sit down between hands
  if (s.phase === "playing" && s.stage !== "betting") fail("Espera a que termine la mano");
  s.players.push(mk(p));
  say(s, `${p.name} se sentó a la mesa`);
  return s.players.length - 1;
}
export function start(s, pi) {
  if (s.players[pi].id !== s.hostId) fail("Solo quien creó la mesa puede empezar");
  if (s.phase !== "lobby") fail("Ya empezó");
  s.phase = "playing"; toBetting(s);
}
function toBetting(s) {
  s.stage = "betting"; s.dealer = []; s.turn = -1; s.round += 1;
  for (const p of s.players) {
    if (p.chips < MIN_BET) { p.chips += START_CHIPS; say(s, `${p.name} recibió ${START_CHIPS} fichas más`); }
    p.bet = 0; p.hand = []; p.inRound = false; p.done = false; p.doubled = false; p.outcome = null; p.paid = 0;
  }
}
const draw = (s, rand) => { if (s.shoe.length < 15) s.shoe = buildShoe(rand); return s.shoe.shift(); };

export function act(s, pi, b, rand = Math.random) {
  const a = String(b.action || ""), p = s.players[pi];
  if (s.phase !== "playing") fail("La mesa no ha empezado");
  if (a === "bet") {
    if (s.stage !== "betting") fail("Ahora no se apuesta");
    const amt = Math.floor(Number(b.amount) || 0);
    if (amt < MIN_BET) fail(`La apuesta mínima es ${MIN_BET}`);
    if (amt > p.chips + p.bet) fail("No tienes tantas fichas");
    p.chips += p.bet; p.bet = amt; p.chips -= amt; p.inRound = true;
    if (s.players.every((q) => q.inRound)) deal(s, rand);
    return;
  }
  if (a === "deal") {
    if (s.stage !== "betting") fail("Ahora no se reparte");
    if (!s.players.some((q) => q.inRound)) fail("Nadie ha apostado todavía");
    return deal(s, rand);
  }
  if (a === "next") { if (s.stage !== "result") fail("La mano no ha terminado"); return toBetting(s); }
  if (s.stage !== "turns") fail("No hay una mano en juego");
  if (s.turn !== pi) fail("No es tu turno");
  if (a === "hit") {
    p.hand.push(draw(s, rand));
    const t = total(p.hand);
    if (t > 21) { p.done = true; p.outcome = "bust"; say(s, `${p.name} se pasó (${t})`); }
    else if (t === 21) p.done = true;
  } else if (a === "stand") { p.done = true; }
  else if (a === "double") {
    if (p.hand.length !== 2) fail("Solo se dobla con las dos primeras cartas");
    if (p.chips < p.bet) fail("No tienes fichas para doblar");
    p.chips -= p.bet; p.bet *= 2; p.doubled = true;
    p.hand.push(draw(s, rand)); p.done = true;
    if (total(p.hand) > 21) { p.outcome = "bust"; say(s, `${p.name} dobló y se pasó`); } else say(s, `${p.name} dobló`);
  } else fail("Acción desconocida");
  nextTurn(s, pi, rand);
}
function deal(s, rand) {
  for (const p of s.players) if (!p.inRound) { p.chips += p.bet; p.bet = 0; }
  const seated = s.players.filter((p) => p.inRound);
  for (let r = 0; r < 2; r++) { for (const p of seated) p.hand.push(draw(s, rand)); s.dealer.push(draw(s, rand)); }
  s.stage = "turns";
  for (const p of seated) if (isBJ(p.hand)) p.done = true;
  // the dealer peeks: with blackjack the hand is over at once
  if (isBJ(s.dealer)) { say(s, "¡La banca tiene blackjack!"); return settle(s); }
  nextTurn(s, -1, rand);
}
function nextTurn(s, from, rand) {
  // players act in seat order, once around
  for (let j = from + 1; j < s.players.length; j++) { const p = s.players[j]; if (p.inRound && !p.done) { s.turn = j; return; } }
  // everybody is done: the dealer plays
  s.turn = -1;
  const anyAlive = s.players.some((p) => p.inRound && p.outcome !== "bust" && !isBJ(p.hand));
  if (anyAlive) while (total(s.dealer) < 17) s.dealer.push(draw(s, rand));
  settle(s);
}
function settle(s) {
  const d = total(s.dealer), dBJ = isBJ(s.dealer);
  for (const p of s.players) {
    if (!p.inRound) continue;
    const t = total(p.hand), bj = isBJ(p.hand);
    let out;
    if (p.outcome === "bust") out = "bust";
    else if (bj && !dBJ) out = "blackjack";
    else if (dBJ && !bj) out = "lose";
    else if (dBJ && bj) out = "push";
    else if (d > 21 || t > d) out = "win";
    else if (t === d) out = "push";
    else out = "lose";
    const pay = out === "blackjack" ? p.bet + Math.floor(p.bet * 1.5) : out === "win" ? p.bet * 2 : out === "push" ? p.bet : 0;
    p.chips += pay; p.paid = pay - p.bet; p.outcome = out;
  }
  s.stage = "result"; s.turn = -1;
  say(s, d > 21 ? `La banca se pasó (${d})` : `La banca tiene ${d}`);
}

export function view(s, pi) {
  const hide = s.stage === "turns";
  return {
    code: s.code, game: "blackjack", phase: s.phase, stage: s.stage, hostId: s.hostId, me: pi, turn: s.turn, round: s.round, log: s.log, version: s.version,
    dealer: hide ? [s.dealer[0], null] : s.dealer, dealerTotal: hide ? null : total(s.dealer),
    players: s.players.map((p) => ({ name: p.name, chips: p.chips, bet: p.bet, hand: p.hand, total: total(p.hand), inRound: p.inRound, done: p.done,
      doubled: p.doubled, outcome: p.outcome, paid: p.paid, host: p.id === s.hostId })),
  };
}
