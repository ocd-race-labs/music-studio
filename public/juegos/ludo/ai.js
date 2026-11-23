// The machine for Ludo. choose(state, die, moves, level) → one of moves (from L.afterRoll).
// 1 Fácil: any move. 2 Medio: eat, reach home, come out, go safe, else move the front token.
// 3 Difícil: weighs every move: eating (more if the rival was far along), getting home, the danger
//    of the square it lands on and the one it leaves, safe squares, and keeping tokens spread out.
import * as L from "./rules.js";

// rival tokens that could land on absolute square sq with one die next turn
function threats(s, seat, sq) {
  if (L.SAFE.has(sq)) return 0;
  let n = 0;
  s.tokens.forEach((toks, o) => {
    if (o === seat) return;
    const col = s.colors[o];
    toks.forEach((p) => {
      if (p < 0) { if (sq === L.START[col]) n += 0.5; return; }
      if (p > 50) return;
      for (let d = 1; d <= 6; d++) if (p + d <= 50 && L.absSquare(col, p + d) === sq) { n++; break; }
    });
  });
  return n;
}

function info(s, m) {
  const seat = s.turn, col = s.colors[seat];
  let eats = 0, eatenProgress = 0;
  if (m.to <= 50) {
    const sq = L.absSquare(col, m.to);
    if (!L.SAFE.has(sq)) s.tokens.forEach((toks, o) => { if (o !== seat) toks.forEach((p) => { if (p >= 0 && p <= 50 && L.absSquare(s.colors[o], p) === sq) { eats++; eatenProgress += p; } }); });
  }
  return { seat, col, eats, eatenProgress };
}

function score(s, m, level) {
  const { seat, col, eats, eatenProgress } = info(s, m);
  let v = 0;
  if (eats) v += level >= 3 ? 60 + eatenProgress * 0.8 : 100;
  if (m.to === 56) v += level >= 3 ? 55 : 80;
  else if (m.to > 50 && m.from <= 50) v += level >= 3 ? 35 : 40;
  if (m.from < 0) v += level >= 3 ? 30 : 60;
  if (m.to <= 50) {
    const sq = L.absSquare(col, m.to);
    if (L.SAFE.has(sq)) v += level >= 3 ? 14 : 20;
    if (level >= 3) v -= threats(s, seat, sq) * (14 + m.to * 0.5);
  }
  if (level >= 3 && m.from >= 0 && m.from <= 50) {
    // leaving a square where it could be eaten
    v += threats(s, seat, L.absSquare(col, m.from)) * (10 + m.from * 0.45);
  }
  v += level >= 3 ? m.to * 0.15 : m.to * 0.3;
  return v;
}

export function choose(s, d, moves, level) {
  if (moves.length <= 1) return moves[0];
  if (level <= 1) return moves[Math.floor(Math.random() * moves.length)];
  let best = moves[0], bv = -Infinity;
  for (const m of moves) {
    const v = score(s, m, level) + Math.random() * (level === 2 ? 4 : 0.5);
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}
