// Culebras y escaleras (snakes and ladders), shared by the page and the tests.
// Squares 1..100; everybody starts off the board (0). Roll one die and move; a ladder takes you up,
// a snake takes you down. You must land exactly on 100: if the roll goes past it, you bounce back.

export const COLORS = ["red", "green", "yellow", "blue"];
export const COLOR_NAME = ["Rojo", "Verde", "Amarillo", "Azul"];
export const LADDERS = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
export const SNAKES = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
export const colorsFor = (n) => (n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3]);

// square to [row, col] on a 10 x 10 grid, row 0 at the top; 1 is bottom left and the rows zigzag
export function cell(sq) {
  const i = sq - 1, rowFromBottom = Math.floor(i / 10), k = i % 10;
  return [9 - rowFromBottom, rowFromBottom % 2 ? 9 - k : k];
}

export function newState(n) {
  return { n, colors: colorsFor(n), pos: Array(n).fill(0), turn: 0, phase: "roll", dice: null, winner: null, last: null };
}

// where a roll takes the player in turn: the squares walked, and where they end after a ladder or a snake
export function walk(from, d) {
  const steps = [];
  let p = from, back = false;
  // past 100 you bounce back
  for (let k = 0; k < d; k++) { if (p === 100) back = true; p += back ? -1 : 1; steps.push(p); }
  const land = p;
  const to = LADDERS[land] || SNAKES[land] || land;
  return { steps, land, to, via: LADDERS[land] ? "ladder" : SNAKES[land] ? "snake" : null };
}

export function play(s, d) {
  const n = JSON.parse(JSON.stringify(s));
  const seat = n.turn, from = n.pos[seat], w = walk(from, d);
  n.pos[seat] = w.to;
  n.last = { seat, d, from, land: w.land, to: w.to, via: w.via, steps: w.steps };
  n.dice = null;
  if (w.to === 100) { n.winner = seat; n.phase = "over"; return n; }
  n.phase = "roll";
  n.turn = (seat + 1) % n.n;
  return n;
}
