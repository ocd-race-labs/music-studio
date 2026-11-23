/* The machine for Damas. DamasAI.choose(state, level) → one of Damas.legalMoves(state.board, state.turn).
   1 Fácil: a random legal move. 2 Medio: looks 3 plies ahead, with a little noise.
   3 Difícil: alpha-beta with iterative deepening for about 0.9 s, capture sequences searched to the end. */
(function (root) {
  "use strict";
  const D = root.Damas || (typeof require !== "undefined" ? require("./rules.js") : null);
  const WIN = 100000;

  function evaluate(board, s) {
    let v = 0;
    for (let i = 0; i < 64; i++) {
      const p = board[i]; if (p === ".") continue;
      const side = D.side(p), sg = side === s ? 1 : -1;
      const r = Math.floor(i / 8), c = i % 8;
      if (D.isKing(p)) v += sg * 300;
      else {
        const adv = side === "w" ? 7 - r : r;        // rows advanced
        v += sg * (100 + adv * 5 + (adv >= 5 ? 6 : 0));
        if ((side === "w" && r === 7) || (side === "b" && r === 0)) v += sg * 8; // guard the crowning row
      }
      if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += sg * 4;
      if (c === 0 || c === 7) v -= sg * 2;
    }
    return v;
  }

  function search(board, turn, depth, alpha, beta, ply, clock) {
    if (clock && Date.now() > clock.end) { clock.out = true; return 0; }
    const moves = D.legalMoves(board, turn);
    if (!moves.length) return -WIN + ply;
    const forced = moves[0].caps.length > 0;
    if (depth <= 0 && (!forced || ply > 14)) return evaluate(board, turn);
    // captures with more pieces first
    moves.sort((a, b) => b.caps.length - a.caps.length);
    const next = turn === "w" ? "b" : "w";
    let best = -Infinity;
    for (const m of moves) {
      const v = -search(D.apply(board, m), next, depth - 1, -beta, -alpha, ply + 1, clock);
      if (clock && clock.out) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  function rootScores(board, turn, depth, clock) {
    const moves = D.legalMoves(board, turn), next = turn === "w" ? "b" : "w";
    const out = [];
    for (const m of moves) {
      const v = -search(D.apply(board, m), next, depth - 1, -Infinity, Infinity, 1, clock);
      if (clock && clock.out) return null;
      out.push({ m, v });
    }
    return out;
  }

  function choose(state, level) {
    const moves = D.legalMoves(state.board, state.turn);
    if (moves.length <= 1) return moves[0];
    if (level <= 1) return moves[Math.floor(Math.random() * moves.length)];
    if (level === 2) {
      const sc = rootScores(state.board, state.turn, 3, null);
      sc.forEach((x) => (x.v += Math.random() * 40));
      sc.sort((a, b) => b.v - a.v);
      return sc[0].m;
    }
    const clock = { end: Date.now() + 900, out: false };
    let best = null;
    for (let d = 2; d <= 12; d++) {
      const sc = rootScores(state.board, state.turn, d, clock);
      if (!sc) break;
      sc.sort((a, b) => b.v - a.v);
      // among equal best moves, pick any
      const top = sc.filter((x) => x.v === sc[0].v);
      best = top[Math.floor(Math.random() * top.length)].m;
      if (Math.abs(sc[0].v) > WIN / 2) break;
    }
    return best || moves[0];
  }

  const api = { choose, evaluate };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.DamasAI = api;
})(this);
