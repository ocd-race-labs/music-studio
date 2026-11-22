/* Damas (8x8): men move and capture forward only, capturing is mandatory and a capture
   continues while the same piece can capture again; a man reaching the far row is crowned;
   kings fly (move and capture along a whole diagonal). The side with no legal move loses.
   Board: 64 chars, index r*8+c, row 0 at the top. "." empty, "w"/"W" white man/king (start at the
   bottom, move up), "b"/"B" black man/king (start at the top, move down). Dark squares: (r+c) odd. */
(function (root) {
  "use strict";
  const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const at = (r, c) => r * 8 + c;
  const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const side = (p) => (p === "w" || p === "W" ? "w" : p === "b" || p === "B" ? "b" : null);
  const isKing = (p) => p === "W" || p === "B";
  const fwd = (s) => (s === "w" ? -1 : 1);

  function initial() {
    let b = "";
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const dark = (r + c) % 2 === 1;
      b += !dark ? "." : r < 3 ? "b" : r > 4 ? "w" : ".";
    }
    return b;
  }

  // every full capture sequence for the piece at sq: { from, path:[landing squares], caps:[captured squares] }
  function captureSeqs(board, sq) {
    const piece = board[sq], me = side(piece), king = isKing(piece);
    const out = [];
    const r0 = Math.floor(sq / 8), c0 = sq % 8;
    function dfs(r, c, path, caps) {
      let extended = false;
      for (const [dr, dc] of DIRS) {
        if (!king && dr !== fwd(me)) continue;
        if (!king) {
          const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
          if (!inside(lr, lc)) continue;
          const m = at(mr, mc), l = at(lr, lc);
          const mp = board[m];
          if (side(mp) && side(mp) !== me && !caps.includes(m) && (board[l] === "." || l === sq)) {
            extended = true;
            dfs(lr, lc, path.concat(l), caps.concat(m));
          }
          continue;
        }
        // flying king: slide over empties, meet one enemy, then land on any empty square beyond it
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc) && (board[at(rr, cc)] === "." || at(rr, cc) === sq)) { rr += dr; cc += dc; }
        if (!inside(rr, cc)) continue;
        const m = at(rr, cc), mp = board[m];
        if (!side(mp) || side(mp) === me || caps.includes(m)) continue;
        let lr = rr + dr, lc = cc + dc;
        while (inside(lr, lc) && (board[at(lr, lc)] === "." || at(lr, lc) === sq)) {
          extended = true;
          dfs(lr, lc, path.concat(at(lr, lc)), caps.concat(m));
          lr += dr; lc += dc;
        }
      }
      if (!extended && caps.length) out.push({ from: sq, path, caps });
    }
    dfs(r0, c0, [], []);
    return out;
  }

  function simpleMoves(board, sq) {
    const piece = board[sq], me = side(piece), king = isKing(piece);
    const r0 = Math.floor(sq / 8), c0 = sq % 8, out = [];
    for (const [dr, dc] of DIRS) {
      if (!king && dr !== fwd(me)) continue;
      let r = r0 + dr, c = c0 + dc;
      while (inside(r, c) && board[at(r, c)] === ".") {
        out.push({ from: sq, path: [at(r, c)], caps: [] });
        if (!king) break;
        r += dr; c += dc;
      }
    }
    return out;
  }

  // all legal moves for a side; captures are mandatory
  function legalMoves(board, s) {
    const caps = [], plain = [];
    for (let i = 0; i < 64; i++) {
      if (side(board[i]) !== s) continue;
      caps.push(...captureSeqs(board, i));
      plain.push(...simpleMoves(board, i));
    }
    return caps.length ? caps : plain;
  }

  function apply(board, mv) {
    const b = board.split("");
    const piece = b[mv.from];
    b[mv.from] = ".";
    for (const c of mv.caps) b[c] = ".";
    const to = mv.path[mv.path.length - 1];
    const tr = Math.floor(to / 8);
    let p = piece;
    if (p === "w" && tr === 0) p = "W";
    if (p === "b" && tr === 7) p = "B";
    b[to] = p;
    return b.join("");
  }

  // a new game state after a move: switches the turn and decides the winner when the next side cannot move
  function play(state, mv) {
    const board = apply(state.board, mv);
    const next = state.turn === "w" ? "b" : "w";
    const winner = legalMoves(board, next).length ? null : state.turn;
    return { board, turn: next, last: { from: mv.from, to: mv.path[mv.path.length - 1], path: mv.path, caps: mv.caps }, winner, moves: (state.moves || 0) + 1 };
  }

  const newState = () => ({ board: initial(), turn: "w", last: null, winner: null, moves: 0 });
  const count = (board, s) => board.split("").filter((p) => side(p) === s).length;

  const api = { initial, newState, legalMoves, captureSeqs, simpleMoves, apply, play, side, isKing, count };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Damas = api;
})(this);
