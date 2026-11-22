// Backgammon rules, shared by the page and the tests.
// The board is 24 points, index 0..23. A positive number is white checkers, negative is black.
// White moves from 23 down to 0 and bears off from 0..5; black moves from 0 up to 23 and bears off from 18..23.
// A move is { from, to, die, hit }: from is a point or "bar", to is a point or "off".

export const START = (() => {
  const b = Array(24).fill(0);
  b[23] = 2; b[12] = 5; b[7] = 3; b[5] = 5;
  b[0] = -2; b[11] = -5; b[16] = -3; b[18] = -5;
  return b;
})();

export function newState() {
  return { board: START.slice(), bar: { w: 0, b: 0 }, off: { w: 0, b: 0 }, turn: null, phase: "opening", dice: null, winner: null, last: null, resigned: "" };
}
export const other = (c) => (c === "w" ? "b" : "w");
const sign = (c) => (c === "w" ? 1 : -1);
const mine = (b, i, c) => b[i] * sign(c) > 0;
const count = (b, i) => Math.abs(b[i]);
const home = (c) => (c === "w" ? [0, 1, 2, 3, 4, 5] : [18, 19, 20, 21, 22, 23]);
export const pipCount = (s, c) => s.board.reduce((a, v, i) => a + (v * sign(c) > 0 ? Math.abs(v) * (c === "w" ? i + 1 : 24 - i) : 0), 0) + s.bar[c] * 25;

function allHome(s, c) {
  if (s.bar[c]) return false;
  for (let i = 0; i < 24; i++) if (mine(s.board, i, c) && !home(c).includes(i)) return false;
  return true;
}

// every single-checker move with one die
export function singleMoves(s, c, d) {
  const b = s.board, out = [], dir = c === "w" ? -1 : 1;
  const open = (t) => !(b[t] * sign(c) < 0 && count(b, t) >= 2);
  if (s.bar[c]) {
    const t = c === "w" ? 24 - d : d - 1;
    if (open(t)) out.push({ from: "bar", to: t, die: d, hit: b[t] * sign(c) === -1 });
    return out;
  }
  const bearing = allHome(s, c);
  for (let i = 0; i < 24; i++) {
    if (!mine(b, i, c)) continue;
    const t = i + dir * d;
    if (t >= 0 && t <= 23) { if (open(t)) out.push({ from: i, to: t, die: d, hit: b[t] * sign(c) === -1 }); continue; }
    if (!bearing) continue;
    const dist = c === "w" ? i + 1 : 24 - i;
    if (d === dist) out.push({ from: i, to: "off", die: d, hit: false });
    else if (d > dist) {
      // a higher die may bear off the farthest checker only
      const farther = c === "w" ? [...Array(6).keys()].filter((k) => k > i) : [18, 19, 20, 21, 22, 23].filter((k) => k < i);
      if (!farther.some((k) => mine(b, k, c))) out.push({ from: i, to: "off", die: d, hit: false });
    }
  }
  return out;
}

export function apply(s, c, m) {
  const n = { ...s, board: s.board.slice(), bar: { ...s.bar }, off: { ...s.off } };
  if (m.from === "bar") n.bar[c]--; else n.board[m.from] -= sign(c);
  if (m.to === "off") n.off[c]++;
  else {
    if (m.hit) { n.board[m.to] = 0; n.bar[other(c)]++; }
    n.board[m.to] += sign(c);
  }
  return n;
}

const uniq = (a) => [...new Set(a)];
// how many dice can still be played from here (the rules force the most)
function maxUse(s, c, dice) {
  if (!dice.length) return 0;
  let best = 0;
  for (const d of uniq(dice)) {
    const rest = dice.slice(); rest.splice(rest.indexOf(d), 1);
    for (const m of singleMoves(s, c, d)) {
      best = Math.max(best, 1 + maxUse(apply(s, c, m), c, rest));
      if (best === dice.length) return best;
    }
  }
  return best;
}

// the single moves allowed now, given the dice left: they must keep the longest possible play,
// and when only one of two different dice can be played, it must be the larger one if possible
export function legalMoves(s, c, dice) {
  if (!dice || !dice.length) return [];
  const want = maxUse(s, c, dice);
  if (!want) return [];
  let moves = [];
  for (const d of uniq(dice)) {
    const rest = dice.slice(); rest.splice(rest.indexOf(d), 1);
    for (const m of singleMoves(s, c, d)) if (1 + maxUse(apply(s, c, m), c, rest) === want) moves.push(m);
  }
  if (want === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const hi = Math.max(...dice);
    if (moves.some((m) => m.die === hi)) moves = moves.filter((m) => m.die === hi);
  }
  return moves;
}

export function play(s, c, m) {
  const n = apply(s, c, m);
  const dice = s.dice.slice(); dice.splice(dice.indexOf(m.die), 1);
  n.dice = dice;
  if (n.off[c] === 15) { n.winner = c; n.phase = "over"; n.gammon = s.off[other(c)] === 0; }
  return n;
}
