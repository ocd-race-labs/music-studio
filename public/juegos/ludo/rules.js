// Ludo rules, shared by the page and the tests.
// 15 x 15 board. Each colour has 4 tokens. A token is a number: -1 at base, 0..50 on the shared track
// (counted from its own start square), 51..55 in its home column, 56 at home.
// A 6 brings a token out; a 6, a capture or reaching home earns another roll; three 6s in a row lose the turn.
// Landing on a rival token sends it back to its base, except on the safe squares (starts and stars).
// You need the exact number to get home. The first to bring all four home wins.

export const COLORS = ["red", "green", "yellow", "blue"];
export const COLOR_NAME = ["Rojo", "Verde", "Amarillo", "Azul"];
export const START = [0, 13, 26, 39];
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// the 52 squares of the track as [row, col], starting at red's start and going clockwise
export const PATH = (() => {
  const p = [];
  for (let c = 1; c <= 5; c++) p.push([6, c]);
  for (let r = 5; r >= 0; r--) p.push([r, 6]);
  p.push([0, 7]);
  for (let r = 0; r <= 5; r++) p.push([r, 8]);
  for (let c = 9; c <= 14; c++) p.push([6, c]);
  p.push([7, 14]);
  for (let c = 14; c >= 9; c--) p.push([8, c]);
  for (let r = 9; r <= 14; r++) p.push([r, 8]);
  p.push([14, 7]);
  for (let r = 14; r >= 9; r--) p.push([r, 6]);
  for (let c = 5; c >= 0; c--) p.push([8, c]);
  p.push([7, 0]);
  p.push([6, 0]);
  return p;
})();
// each colour's home column (steps 51..55) and its home (56)
export const HOME = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
];
// the four spots inside each base
export const BASE = [
  [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]],
  [[1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5]],
  [[10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5]],
  [[10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5]],
];
export const colorsFor = (n) => (n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
export const absSquare = (color, p) => (START[color] + p) % 52;
// where a token sits on the board, as [row, col] of the cell's top-left corner (bases use half cells)
export function cellOf(color, p, k) {
  if (p < 0) return BASE[color][k];
  if (p <= 50) return PATH[absSquare(color, p)];
  return HOME[color][p - 51];
}

export function newState(n) {
  return { n, colors: colorsFor(n), tokens: Array.from({ length: n }, () => [-1, -1, -1, -1]), turn: 0,
    phase: "roll", dice: null, sixes: 0, winner: null, last: null };
}

// the moves allowed with this die for the player in turn
export function moves(s, d) {
  const seat = s.turn, out = [];
  s.tokens[seat].forEach((p, t) => {
    if (p === 56) return;
    if (p < 0) { if (d === 6) out.push({ t, from: p, to: 0 }); return; }
    const to = p + d;
    if (to <= 56) out.push({ t, from: p, to });
  });
  // two tokens on the same spot give the same move: keep one
  const seen = new Set();
  return out.filter((m) => { const k = m.from + ">" + m.to; if (seen.has(k)) return false; seen.add(k); return true; });
}

// play one move; returns the next state with the turn already passed on (or kept, for another roll)
export function play(s, m, d) {
  const n = JSON.parse(JSON.stringify(s));
  const seat = n.turn, color = n.colors[seat];
  n.tokens[seat][m.t] = m.to;
  let captured = 0;
  if (m.to <= 50) {
    const sq = absSquare(color, m.to);
    if (!SAFE.has(sq)) {
      n.tokens.forEach((toks, o) => {
        if (o === seat) return;
        toks.forEach((p, k) => { if (p >= 0 && p <= 50 && absSquare(n.colors[o], p) === sq) { toks[k] = -1; captured++; } });
      });
    }
  }
  n.last = { seat, t: m.t, from: m.from, to: m.to, d, captured };
  n.dice = null;
  if (n.tokens[seat].every((p) => p === 56)) { n.winner = seat; n.phase = "over"; return n; }
  const again = d === 6 || captured > 0 || m.to === 56;
  n.sixes = d === 6 ? (n.sixes || 0) + 1 : 0;
  n.phase = "roll";
  if (!again) { n.turn = (seat + 1) % n.n; n.sixes = 0; }
  return n;
}

// after a roll with nothing to move, or a third six in a row: the turn passes on
export function pass(s, d, why) {
  const n = JSON.parse(JSON.stringify(s));
  n.last = { seat: n.turn, pass: why, d };
  n.dice = null; n.phase = "roll"; n.sixes = 0;
  n.turn = (n.turn + 1) % n.n;
  return n;
}
// what a fresh roll leaves: either moves to choose from, or a pass
export function afterRoll(s, d) {
  if (d === 6 && (s.sixes || 0) >= 2) return { pass: "tres seises" };
  const ms = moves(s, d);
  return ms.length ? { moves: ms } : { pass: "sin jugada" };
}
