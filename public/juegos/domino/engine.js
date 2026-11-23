// Dominó (double six, 28 tiles). Shared by the server (Supabase Edge Function) and the browser.
// 7 tiles each. With 2 or 3 players the rest is the boneyard: if you can't play, you draw until you can.
// With 4 players it is pairs (seats 1 and 3 against 2 and 4) and there is no boneyard: if you can't play, you pass.
// The first hand starts with the highest double; after that, the winner of the last hand starts with any tile.
// Emptying your hand wins the hand and the pips left in the rivals' hands. If nobody can play (tranque),
// the lowest count wins them. The game is to 100. A tile is "A-B" with A <= B.

export const MAX_PLAYERS = 4, TARGET = 100;
export const pips = (t) => { const [a, b] = String(t).split("-").map(Number); return a + b; };
export const halves = (t) => String(t).split("-").map(Number);
export const isDouble = (t) => { const [a, b] = halves(t); return a === b; };

export function buildSet() { const d = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) d.push(`${a}-${b}`); return d; }
export function shuffle(a, rand = Math.random) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const fail = (msg) => { const e = new Error(msg); e.user = true; throw e; };
const say = (s, text) => { s.log = [text].concat(s.log || []).slice(0, 10); };
const mk = (p) => ({ id: p.id, name: String(p.name || "Jugador").slice(0, 24), keyHash: p.keyHash, hand: [], score: 0 });
export const teamOf = (s, i) => (s.players.length === 4 ? i % 2 : i);
const handPips = (p) => p.hand.reduce((a, t) => a + pips(t), 0);

// can this tile go on the line, and on which side
export function fits(t, ends) {
  if (!ends) return ["L"];
  const [a, b] = halves(t), out = [];
  if (a === ends[0] || b === ends[0]) out.push("L");
  if (a === ends[1] || b === ends[1]) out.push("R");
  return out;
}
export const playable = (hand, ends, must) => hand.filter((t) => (must ? t === must : fits(t, ends).length));

export function newGame(code, host) {
  return { code, game: "domino", phase: "lobby", stage: null, hostId: host.id, players: [mk(host)], boneyard: [], line: [], ends: null,
    turn: 0, passes: 0, round: 0, must: null, starter: null, result: null, winner: null, last: null, log: [], version: 0 };
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
  const set = shuffle(buildSet(), rand);
  for (const p of s.players) p.hand = set.splice(0, 7);
  s.boneyard = s.players.length === 4 ? [] : set;
  s.line = []; s.ends = null; s.passes = 0; s.result = null; s.last = null; s.stage = "hand";
  if (s.starter === null) {
    // the highest double starts (and must be played)
    for (let d = 6; d >= 0; d--) {
      const i = s.players.findIndex((p) => p.hand.includes(`${d}-${d}`));
      if (i >= 0) { s.turn = i; s.must = `${d}-${d}`; break; }
    }
    if (s.must === null) { s.turn = 0; s.must = null; }
  } else { s.turn = s.starter; s.must = null; }
  say(s, `Mano ${s.round + 1}`);
}
export function start(s, pi, rand = Math.random) {
  if (s.players[pi].id !== s.hostId) fail("Solo quien creó la mesa puede empezar");
  if (s.players.length < 2) fail("Se necesitan al menos 2 jugadores");
  if (s.phase === "playing") fail("Ya empezó");
  for (const p of s.players) p.score = 0;
  s.round = 0; s.starter = null; s.must = null; s.winner = null; s.phase = "playing";
  deal(s, rand);
}

export function act(s, pi, b, rand = Math.random) {
  const a = String(b.action || "");
  if (a === "next") {
    if (s.phase === "finished") return start(s, s.players.findIndex((p) => p.id === s.hostId), rand);
    if (s.stage !== "result") fail("La mano no ha terminado");
    s.round += 1; return deal(s, rand);
  }
  if (s.phase !== "playing" || s.stage !== "hand") fail("No hay una mano en juego");
  if (s.turn !== pi) fail("No es tu turno");
  const p = s.players[pi], can = playable(p.hand, s.ends, s.must);
  if (a === "play") {
    const t = String(b.tile || "");
    if (!p.hand.includes(t)) fail("Esa ficha no está en tu mano");
    if (s.must && t !== s.must) fail(`La primera ficha tiene que ser el ${s.must.replace("-", "|")}`);
    const sides = fits(t, s.ends);
    if (!sides.length) fail("Esa ficha no calza en ninguna punta");
    const side = sides.includes(b.side) ? b.side : sides[0];
    const [x, y] = halves(t);
    if (!s.ends) { s.line.push([x, y]); s.ends = [x, y]; }
    else if (side === "L") { const o = y === s.ends[0] ? [x, y] : [y, x]; s.line.unshift(o); s.ends[0] = o[0]; }
    else { const o = x === s.ends[1] ? [x, y] : [y, x]; s.line.push(o); s.ends[1] = o[1]; }
    p.hand.splice(p.hand.indexOf(t), 1);
    s.must = null; s.passes = 0;
    s.last = { by: pi, tile: t, side: s.line.length === 1 ? null : side };
    if (!p.hand.length) return endHand(s, pi, false);
    s.turn = (pi + 1) % s.players.length;
    return;
  }
  if (a === "draw") {
    if (can.length) fail("Tienes una ficha que calza: juégala");
    if (!s.boneyard.length) fail("No quedan fichas para robar: pasa");
    p.hand.push(s.boneyard.shift());
    s.last = { by: pi, drew: true };
    return;
  }
  if (a === "pass") {
    if (can.length) fail("Tienes una ficha que calza: juégala");
    if (s.boneyard.length) fail("Primero roba del pozo");
    s.passes += 1;
    s.last = { by: pi, passed: true };
    say(s, `${p.name} pasó`);
    if (s.passes >= s.players.length) return endHand(s, null, true);
    s.turn = (pi + 1) % s.players.length;
    return;
  }
  fail("Acción desconocida");
}

function endHand(s, winner, blocked) {
  const n = s.players.length, teams = n === 4 ? 2 : n;
  const sums = Array(teams).fill(0);
  s.players.forEach((p, i) => { sums[teamOf(s, i)] += handPips(p); });
  let wteam = null;
  if (blocked) {
    const low = Math.min(...sums), who = sums.map((v, t) => (v === low ? t : -1)).filter((t) => t >= 0);
    wteam = who.length === 1 ? who[0] : null;
  } else wteam = teamOf(s, winner);
  let gain = 0;
  if (wteam !== null) {
    gain = sums.reduce((a, v, t) => a + (t === wteam ? 0 : v), 0);
    s.players.forEach((p, i) => { if (teamOf(s, i) === wteam) p.score += gain; });
    if (!blocked) s.starter = winner;
    else s.starter = s.players.findIndex((p, i) => teamOf(s, i) === wteam);
  }
  s.result = { blocked, team: wteam, gain, sums, hands: s.players.map((p) => p.hand.slice()) };
  s.stage = "result"; s.turn = -1;
  const names = (t) => s.players.map((p, i) => (teamOf(s, i) === t ? p.name : null)).filter(Boolean).join(" y ");
  say(s, wteam === null ? "Tranque empatado: nadie suma" : `${blocked ? "Tranque: " : "¡Dominó! "}${names(wteam)} ${n === 4 ? "suman" : "suma"} ${gain}`);
  const top = Math.max(...s.players.map((p) => p.score));
  if (top >= TARGET) { s.phase = "finished"; s.winner = teamOf(s, s.players.findIndex((p) => p.score === top)); say(s, `¡${names(s.winner)} ${n === 4 ? "ganan" : "gana"} la partida!`); }
}

export function view(s, pi) {
  const me = s.players[pi];
  return {
    code: s.code, game: "domino", phase: s.phase, stage: s.stage, hostId: s.hostId, me: pi, turn: s.turn, round: s.round, line: s.line, ends: s.ends,
    must: s.must, boneyard: s.boneyard.length, result: s.result, winner: s.winner, last: s.last, teams: s.players.length === 4, log: s.log, version: s.version,
    canPlay: me && s.stage === "hand" && s.turn === pi ? playable(me.hand, s.ends, s.must) : [],
    players: s.players.map((p, i) => ({ name: p.name, count: p.hand.length, score: p.score, host: p.id === s.hostId, hand: i === pi ? p.hand : null })),
  };
}
