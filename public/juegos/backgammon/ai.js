// The machine for Backgammon. choose(state, color, level) → the list of single moves for the whole turn,
// each legal in order (from G.legalMoves), for the dice in state.dice.
// 1 Fácil: any legal play. 2 Medio: race, hits and points made, with a little noise.
// 3 Difícil: also counts the rolls that hit each of its blots, builds primes and its home board,
//    and switches to a pure race when the armies have passed each other.
import * as G from "./rules.js";

const sign = (c) => (c === "w" ? 1 : -1);
const key = (s) => s.board.join(",") + "|" + s.bar.w + s.bar.b + "|" + s.off.w + s.off.b;

// every distinct end position reachable with the dice, with the moves that lead there
export function plays(s, c) {
  const out = new Map();
  (function walk(st, seq) {
    const ms = G.legalMoves(st, c, st.dice);
    if (!ms.length || st.winner) { const k = key(st); if (!out.has(k)) out.set(k, { seq, end: st }); return; }
    const seen = new Set();
    for (const m of ms) {
      const id = m.from + ">" + m.to + ":" + m.die; if (seen.has(id)) continue; seen.add(id);
      walk(G.play(st, c, m), seq.concat(m));
    }
  })(s, []);
  return [...out.values()];
}

// distance from point i to point j in the direction c moves (positive when c can get there)
const ahead = (c, i, j) => (c === "w" ? i - j : j - i);

// how many of the 36 rolls let the opponent o hit a lone checker of c at point t
function shots(s, c, t) {
  const o = c === "w" ? "b" : "w";
  const from = [];
  for (let i = 0; i < 24; i++) if (s.board[i] * sign(o) > 0) from.push(i);
  const barAt = o === "w" ? 24 : -1; // the bar sits just before the first point
  if (s.bar[o]) from.push(barAt);
  const blocked = (p) => p >= 0 && p <= 23 && s.board[p] * sign(c) >= 2;
  let n = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
    let hit = false;
    for (const f of from) {
      const dist = o === "w" ? f - t : t - f;
      if (dist <= 0 || dist > 24) continue;
      const stepTo = (k) => (o === "w" ? f - k : f + k);
      if (a === b) { for (let k = 1; k <= 4 && !hit; k++) { if (blocked(stepTo(a * k))) break; if (a * k === dist) hit = true; } }
      else if (dist === a || dist === b) hit = true;
      else if (dist === a + b && (!blocked(stepTo(a)) || !blocked(stepTo(b)))) hit = true;
      if (hit) break;
    }
    if (hit) n++;
  }
  return n;
}

function contact(s) {
  // the race is on when every white checker is past every black checker
  let minB = 24, maxW = -1;
  for (let i = 0; i < 24; i++) { if (s.board[i] < 0) minB = Math.min(minB, i); if (s.board[i] > 0) maxW = Math.max(maxW, i); }
  if (s.bar.w) maxW = 24; if (s.bar.b) minB = -1;
  return maxW > minB;
}

function evaluate(s, c, level) {
  const o = c === "w" ? "b" : "w";
  if (s.winner === c) return 1e6;
  const pipMe = G.pipCount(s, c), pipO = G.pipCount(s, o);
  let v = (pipO - pipMe) * 1.0 + (s.off[c] - s.off[o]) * 4 + s.bar[o] * 18 - s.bar[c] * 18;
  const isContact = contact(s);
  if (!isContact && level >= 3) {
    // pure race: bear off fast and keep checkers deep
    return v * 2 + s.off[c] * 6;
  }
  let run = 0, prime = 0;
  for (let i = 0; i < 24; i++) {
    const n = s.board[i] * sign(c);
    const toHome = c === "w" ? i : 23 - i; // 0..5 is the home board
    if (n >= 2) {
      v += 6 + (toHome <= 5 ? 9 - toHome * 0.5 : toHome <= 8 ? 5 : 2);
      run++; prime = Math.max(prime, run);
      if (n > 3) v -= (n - 3) * 1.5;
    } else run = 0;
    if (n === 1) {
      const risk = level >= 3 ? shots(s, c, i) / 36 : (isContact ? 0.33 : 0);
      // a hit blot costs the way it has already come
      v -= risk * (10 + (24 - toHome) * 1.2);
    }
  }
  if (level >= 3) v += prime >= 3 ? (prime - 2) * 10 : 0;
  return v;
}

export function choose(s, c, level) {
  const all = plays(s, c);
  if (all.length <= 1) return all.length ? all[0].seq : [];
  if (level <= 1) return all[Math.floor(Math.random() * all.length)].seq;
  let best = null, bv = -Infinity;
  for (const p of all) {
    const v = evaluate(p.end, c, level) + (level === 2 ? Math.random() * 6 : 0);
    if (v > bv) { bv = v; best = p; }
  }
  return best.seq;
}
