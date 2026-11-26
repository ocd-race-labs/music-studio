// Comarca: the rules. Pure functions over plain data, shared by the page, the machine and the tests.
//
// A tile has 12 edge segments, clockwise from the top-left: top 0 1 2, right 3 4 5, bottom 6 7 8, left 9 10 11.
// Each feature (city, road, field, hermitage) owns some segments; a field lists the cities on its tile it touches.
// A placed tile is { k: letter, x, y, r } with r quarter turns clockwise.

const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const C = (s, a, shield) => ({ t: "city", s, a, ...(shield ? { shield: true } : {}) });
const R = (s, a) => ({ t: "road", s, a });
const F = (s, a, adj = []) => ({ t: "field", s, a, adj });
const H = (a) => ({ t: "cloister", s: [], a });
const W = (s) => ({ t: "river", s, a: [50, 50] });

export const TILES = {
  A: { n: 2, f: [H([50, 42]), R([7], [50, 86]), F([0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11], [16, 84])] },
  B: { n: 4, f: [H([50, 46]), F(ALL, [16, 84])] },
  C: { n: 1, f: [C(ALL, [50, 50], true)] },
  D: { n: 4, f: [C([0, 1, 2], [50, 12]), R([4, 10], [64, 50]), F([3, 11], [24, 35], [0]), F([5, 6, 7, 8, 9], [50, 82])] },
  E: { n: 5, f: [C([0, 1, 2], [50, 12]), F([3, 4, 5, 6, 7, 8, 9, 10, 11], [50, 64], [0])] },
  F: { n: 2, f: [C([3, 4, 5, 9, 10, 11], [50, 50], true), F([0, 1, 2], [50, 8], [0]), F([6, 7, 8], [50, 92], [0])] },
  G: { n: 1, f: [C([3, 4, 5, 9, 10, 11], [50, 50]), F([0, 1, 2], [50, 8], [0]), F([6, 7, 8], [50, 92], [0])] },
  H: { n: 3, f: [C([3, 4, 5], [88, 50]), C([9, 10, 11], [12, 50]), F([0, 1, 2, 6, 7, 8], [50, 50], [0, 1])] },
  I: { n: 2, f: [C([3, 4, 5], [88, 50]), C([6, 7, 8], [50, 88]), F([9, 10, 11, 0, 1, 2], [36, 36], [0, 1])] },
  J: { n: 3, f: [C([0, 1, 2], [50, 12]), R([4, 7], [64, 64]), F([5, 6], [87, 87]), F([3, 8, 9, 10, 11], [30, 62], [0])] },
  K: { n: 3, f: [C([0, 1, 2], [50, 12]), R([7, 10], [36, 64]), F([8, 9], [13, 87]), F([11, 3, 4, 5, 6], [70, 62], [0])] },
  L: { n: 3, f: [C([0, 1, 2], [50, 12]), R([4], [82, 50]), R([7], [50, 86]), R([10], [18, 50]), F([11, 3], [70, 34], [0]), F([5, 6], [84, 84]), F([8, 9], [16, 84])] },
  M: { n: 2, f: [C([0, 1, 2, 9, 10, 11], [26, 26], true), F([3, 4, 5, 6, 7, 8], [70, 70], [0])] },
  N: { n: 3, f: [C([0, 1, 2, 9, 10, 11], [26, 26]), F([3, 4, 5, 6, 7, 8], [70, 70], [0])] },
  O: { n: 2, f: [C([0, 1, 2, 9, 10, 11], [22, 22], true), R([4, 7], [72, 72]), F([5, 6], [90, 90]), F([3, 8], [56, 56], [0])] },
  P: { n: 3, f: [C([0, 1, 2, 9, 10, 11], [22, 22]), R([4, 7], [72, 72]), F([5, 6], [90, 90]), F([3, 8], [56, 56], [0])] },
  Q: { n: 1, f: [C([0, 1, 2, 3, 4, 5, 9, 10, 11], [50, 36], true), F([6, 7, 8], [50, 91], [0])] },
  R: { n: 3, f: [C([0, 1, 2, 3, 4, 5, 9, 10, 11], [50, 36]), F([6, 7, 8], [50, 91], [0])] },
  S: { n: 2, f: [C([0, 1, 2, 3, 4, 5, 9, 10, 11], [50, 32], true), R([7], [50, 86]), F([6], [80, 91], [0]), F([8], [20, 91], [0])] },
  T: { n: 1, f: [C([0, 1, 2, 3, 4, 5, 9, 10, 11], [50, 32]), R([7], [50, 86]), F([6], [80, 91], [0]), F([8], [20, 91], [0])] },
  U: { n: 8, f: [R([1, 7], [50, 50]), F([8, 9, 10, 11, 0], [22, 50]), F([2, 3, 4, 5, 6], [78, 50])] },
  V: { n: 9, f: [R([7, 10], [36, 64]), F([8, 9], [13, 87]), F([11, 0, 1, 2, 3, 4, 5, 6], [68, 32])] },
  W: { n: 4, f: [R([4], [82, 50]), R([7], [50, 84]), R([10], [18, 50]), F([11, 0, 1, 2, 3], [50, 22]), F([5, 6], [84, 84]), F([8, 9], [16, 84])] },
  X: { n: 1, f: [R([1], [50, 16]), R([4], [84, 50]), R([7], [50, 84]), R([10], [16, 50]), F([2, 3], [84, 16]), F([5, 6], [84, 84]), F([8, 9], [16, 84]), F([11, 0], [16, 16])] },
};
// the river: 14 tiles played first, a winding river that crosses the whole map with a lake at each end.
// One straight piece starts the game; the other 11 river pieces come out of the bag first, then the 2 lakes.
export const RIVER = {
  RL: { n: 2, river: true, lake: true, f: [W([1]), F([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [12, 14])] },
  RA: { n: 2, river: true, f: [W([1, 7]), F([8, 9, 10, 11, 0], [20, 50]), F([2, 3, 4, 5, 6], [80, 50])] },
  RC: { n: 4, river: true, f: [W([7, 10]), F([8, 9], [13, 87]), F([11, 0, 1, 2, 3, 4, 5, 6], [70, 30])] },
  RB: { n: 1, river: true, f: [W([1, 7]), R([4, 10], [24, 50]), F([11, 0], [18, 18]), F([2, 3], [82, 18]), F([5, 6], [82, 82]), F([8, 9], [18, 82])] },
  RT: { n: 1, river: true, f: [W([1, 7]), C([3, 4, 5], [88, 50]), C([9, 10, 11], [12, 50]), F([8, 0], [30, 18], [2]), F([2, 6], [70, 82], [1])] },
  RK: { n: 1, river: true, f: [W([7, 10]), C([0, 1, 2, 3, 4, 5], [74, 26]), F([8, 9], [13, 87]), F([11, 6], [44, 50], [1])] },
  RM: { n: 1, river: true, f: [W([1, 7]), H([74, 42]), R([4], [92, 62]), F([8, 9, 10, 11, 0], [20, 50]), F([2, 3, 5, 6], [62, 84])] },
  RN: { n: 1, river: true, f: [W([1, 4]), R([7, 10], [36, 64]), F([2, 3], [86, 14]), F([11, 0, 5, 6], [52, 48]), F([8, 9], [13, 87])] },
  RV: { n: 1, river: true, f: [W([1, 7]), C([9, 10, 11], [12, 50]), F([8, 0], [30, 18], [1]), F([2, 3, 4, 5, 6], [78, 50])] },
};
Object.assign(TILES, RIVER);
export const START = "D";
export const RIVER_START = "RA";
export const MEEPLES = 7;
export const COLORS = ["#d93b3b", "#2f6fd0", "#f0bd22", "#2e9e4f", "#8e44ad"];
export const COLOR_NAMES = ["Rojo", "Azul", "Amarillo", "Verde", "Morado"];

const shuffle = (a, rand) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// the bag, drawn from the end (pop): the 72 land tiles, then the 2 lakes, then the 11 river pieces
export function newBag(rand = Math.random) {
  const land = [], river = [], lakes = [];
  for (const [k, d] of Object.entries(TILES)) for (let i = 0; i < d.n - (k === RIVER_START ? 1 : 0); i++) (d.lake ? lakes : d.river ? river : land).push(k);
  return shuffle(land, rand).concat(lakes, shuffle(river, rand));
}
export const BAG_SIZE = 85;
export function newGame(names) {
  return {
    phase: "play", n: names.length, turn: 0,
    players: names.map((name, i) => ({ name, color: i, score: 0, left: MEEPLES })),
    tiles: [{ k: RIVER_START, x: 0, y: 0, r: 1 }], meeples: [], current: null, remaining: BAG_SIZE, last: null, events: [],
  };
}

/* ---------- geometry ---------- */
const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const rotSeg = (s, r) => (s + 3 * r) % 12;
// the feature that owns a segment of a placed tile
function segOwner(k, r) {
  const own = new Array(12).fill(-1);
  TILES[k].f.forEach((f, i) => f.s.forEach((s) => (own[rotSeg(s, r)] = i)));
  return own;
}
const OWN = {};
const owner = (k, r) => OWN[k + r] || (OWN[k + r] = segOwner(k, r));
// what a side of a placed tile shows: C city, R road, F field
export function edge(k, r, side) {
  const f = TILES[k].f[owner(k, r)[side * 3 + 1]];
  return f.t === "city" ? "C" : f.t === "road" ? "R" : f.t === "river" ? "W" : "F";
}
export const keyOf = (x, y) => x + "," + y;
export function indexTiles(tiles) {
  const m = new Map(); tiles.forEach((t, i) => m.set(keyOf(t.x, t.y), i)); return m;
}
export function fits(tiles, idx, k, x, y, r) {
  if (idx.has(keyOf(x, y))) return false;
  let any = false;
  for (let s = 0; s < 4; s++) {
    const j = idx.get(keyOf(x + DIR[s][0], y + DIR[s][1]));
    if (j === undefined) continue;
    any = true;
    const o = tiles[j];
    if (edge(k, r, s) !== edge(o.k, o.r, (s + 2) % 4)) return false;
  }
  return any;
}
// every place and turn where tile k fits: [{x, y, r}]
export function placements(tiles, k) {
  const idx = indexTiles(tiles), seen = new Set(), out = [];
  const river = TILES[k].river;
  for (const t of tiles) for (const [dx, dy] of DIR) {
    const x = t.x + dx, y = t.y + dy, key = keyOf(x, y);
    if (seen.has(key) || idx.has(key)) continue;
    seen.add(key);
    for (let r = 0; r < 4; r++) if (fits(tiles, idx, k, x, y, r) && (!river || riverOk(tiles, idx, k, x, y, r))) out.push({ x, y, r });
  }
  // a river piece that can't continue the river without a forbidden turn may still go where it fits
  if (river && !out.length) {
    for (const t of tiles) for (const [dx, dy] of DIR) {
      const x = t.x + dx, y = t.y + dy;
      if (idx.has(keyOf(x, y))) continue;
      for (let r = 0; r < 4; r++) if (fits(tiles, idx, k, x, y, r) && joinsRiver(tiles, idx, k, x, y, r) && !out.some((p) => p.x === x && p.y === y && p.r === r)) out.push({ x, y, r });
    }
  }
  return out;
}
// river sides of a placed tile
const riverSides = (k, r) => [0, 1, 2, 3].filter((s) => edge(k, r, s) === "W");
// the new river piece must continue the river at one of its open ends
function joinsRiver(tiles, idx, k, x, y, r) {
  for (const s of riverSides(k, r)) {
    const j = idx.get(keyOf(x + DIR[s][0], y + DIR[s][1]));
    if (j !== undefined && edge(tiles[j].k, tiles[j].r, (s + 2) % 4) === "W") return true;
  }
  return false;
}
// left or right turn of a river piece walked from side a out through side b: 1 right, 3 left, 0 straight
const turnOf = (a, b) => ((b - ((a + 2) % 4)) + 4) % 4 === 0 ? 0 : ((b - ((a + 2) % 4)) + 4) % 4 === 1 ? 1 : 3;
// so the river never curls back on itself, two curves in a row at the same end can't turn the same way
function riverOk(tiles, idx, k, x, y, r) {
  if (!joinsRiver(tiles, idx, k, x, y, r)) return false;
  const mine = riverSides(k, r);
  // the side where it joins, and the turn it makes going outwards
  const into = mine.find((s) => { const j = idx.get(keyOf(x + DIR[s][0], y + DIR[s][1])); return j !== undefined; });
  const out = mine.find((s) => s !== into);
  if (out === undefined) return true;
  const t = turnOf(into, out);
  // its own open side must not face a tile
  if (idx.has(keyOf(x + DIR[out][0], y + DIR[out][1]))) return false;
  if (!t) return true;
  // walk back along the river to the last curve
  let cx = x + DIR[into][0], cy = y + DIR[into][1], from = (into + 2) % 4;
  for (let guard = 0; guard < 20; guard++) {
    const j = idx.get(keyOf(cx, cy)); if (j === undefined) return true;
    const sides = riverSides(tiles[j].k, tiles[j].r), back = sides.find((s) => s !== from);
    if (back === undefined) return true;
    const pt = turnOf(back, from);
    if (pt) return pt !== t;
    cx += DIR[back][0]; cy += DIR[back][1]; from = (back + 2) % 4;
  }
  return true;
}

/* ---------- connected features ---------- */
// analyse(tiles) → { comp: Map("ti:fi" → id), comps: [{ id, t, nodes, tiles:Set, complete, shields, cities:Set }] }
export function analyse(tiles) {
  const idx = indexTiles(tiles);
  const parent = new Map();
  const find = (a) => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a, b); };
  tiles.forEach((t, ti) => TILES[t.k].f.forEach((f, fi) => parent.set(ti + ":" + fi, ti + ":" + fi)));
  const open = new Map();
  tiles.forEach((t, ti) => {
    const own = owner(t.k, t.r);
    for (let s = 0; s < 4; s++) {
      const j = idx.get(keyOf(t.x + DIR[s][0], t.y + DIR[s][1]));
      for (let q = 0; q < 3; q++) {
        const seg = s * 3 + q, fi = own[seg];
        if (j === undefined) { const n = ti + ":" + fi; open.set(n, (open.get(n) || 0) + 1); continue; }
        if (j < ti) continue;
        const o = tiles[j], oseg = ((s + 2) % 4) * 3 + (2 - q);
        union(ti + ":" + fi, j + ":" + owner(o.k, o.r)[oseg]);
      }
    }
  });
  const byRoot = new Map(), comps = [], comp = new Map();
  tiles.forEach((t, ti) => TILES[t.k].f.forEach((f, fi) => {
    const n = ti + ":" + fi, root = find(n);
    let c = byRoot.get(root);
    if (!c) { c = { id: comps.length, t: f.t, nodes: [], tiles: new Set(), open: 0, shields: 0, cities: new Set() }; byRoot.set(root, c); comps.push(c); }
    c.nodes.push(n); c.tiles.add(ti); c.open += open.get(n) || 0; if (f.shield) c.shields++;
    comp.set(n, c.id);
  }));
  for (const c of comps) c.complete = c.t !== "field" && c.t !== "cloister" && c.open === 0;
  // fields: the cities they touch
  for (const c of comps) if (c.t === "field") for (const n of c.nodes) {
    const [ti, fi] = n.split(":").map(Number);
    for (const a of TILES[tiles[ti].k].f[fi].adj) c.cities.add(comp.get(ti + ":" + a));
  }
  return { comp, comps, idx };
}
export function neighbours8(idx, x, y) {
  let n = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && idx.has(keyOf(x + dx, y + dy))) n++;
  return n;
}
// seats with the most followers on a component
function majority(meeples, nodes) {
  const set = new Set(nodes), count = {};
  for (const m of meeples) if (set.has(m.t + ":" + m.f)) count[m.s] = (count[m.s] || 0) + 1;
  const best = Math.max(0, ...Object.values(count));
  return best ? Object.keys(count).filter((s) => count[s] === best).map(Number) : [];
}
export const valueOf = (c, final) => (c.t === "road" ? c.tiles.size : c.t === "city" ? (final && !c.complete ? 1 : 2) * (c.tiles.size + c.shields) : 0);

// where the new tile (last in tiles) can take a follower: [featureIndex]
export function meepleSpots(tiles, meeples, an) {
  const ti = tiles.length - 1, t = tiles[ti];
  an = an || analyse(tiles);
  const taken = new Set(meeples.map((m) => an.comp.get(m.t + ":" + m.f)));
  return TILES[t.k].f.map((f, fi) => fi).filter((fi) => TILES[t.k].f[fi].t !== "river").filter((fi) => TILES[t.k].f[fi].t === "cloister" || !taken.has(an.comp.get(ti + ":" + fi)));
}

/* ---------- a turn ---------- */
// place the current tile, maybe a follower, and score what got finished.
// → new state (turn not advanced; the server or the local loop draws the next tile)
export function play(s, x, y, r, fi) {
  const seat = s.turn;
  const tiles = s.tiles.concat([{ k: s.current, x, y, r }]);
  const ti = tiles.length - 1;
  let meeples = s.meeples.slice();
  const players = s.players.map((p) => ({ ...p }));
  if (fi != null && fi >= 0 && players[seat].left > 0) { meeples.push({ t: ti, f: fi, s: seat }); players[seat].left--; }
  const an = analyse(tiles);
  const events = [];
  // finished roads and cities that the new tile touches
  const touched = new Set(TILES[s.current].f.map((f, i) => an.comp.get(ti + ":" + i)));
  for (const id of touched) {
    const c = an.comps[id];
    if (!c.complete) continue;
    const win = majority(meeples, c.nodes);
    if (!win.length) continue;
    const pts = valueOf(c, false);
    for (const w of win) players[w].score += pts;
    const set = new Set(c.nodes);
    for (const m of meeples) if (set.has(m.t + ":" + m.f)) players[m.s].left++;
    meeples = meeples.filter((m) => !set.has(m.t + ":" + m.f));
    events.push({ t: c.t, pts, who: win, at: [...c.tiles] });
  }
  // hermitages around the new tile that are now surrounded
  for (const m of meeples.slice()) {
    const mt = tiles[m.t];
    if (TILES[mt.k].f[m.f].t !== "cloister" || Math.abs(mt.x - x) > 1 || Math.abs(mt.y - y) > 1) continue;
    if (neighbours8(an.idx, mt.x, mt.y) === 8) {
      players[m.s].score += 9; players[m.s].left++;
      meeples = meeples.filter((q) => q !== m);
      events.push({ t: "cloister", pts: 9, who: [m.s], at: [m.t] });
    }
  }
  return { ...s, tiles, meeples, players, last: { x, y }, events };
}
// the game ends: unfinished things and farmers
export function finalScore(s) {
  const an = analyse(s.tiles);
  const players = s.players.map((p) => ({ ...p, end: { road: 0, city: 0, cloister: 0, field: 0 } }));
  const events = [];
  const done = new Set();
  for (const m of s.meeples) {
    const id = an.comp.get(m.t + ":" + m.f), c = an.comps[id];
    if (done.has(id)) continue;
    done.add(id);
    let pts = 0;
    if (c.t === "cloister") { const t = s.tiles[m.t]; pts = 1 + neighbours8(an.idx, t.x, t.y); }
    else if (c.t === "field") pts = 3 * [...c.cities].filter((ci) => an.comps[ci].complete).length;
    else pts = valueOf(c, true);
    const win = c.t === "cloister" ? [m.s] : majority(s.meeples, c.nodes);
    if (!pts) continue;
    for (const w of win) { players[w].score += pts; players[w].end[c.t] += pts; }
    events.push({ t: c.t, pts, who: win, at: [...c.tiles] });
  }
  const best = Math.max(...players.map((p) => p.score));
  return { ...s, players, phase: "over", current: null, winners: players.map((p, i) => i).filter((i) => players[i].score === best), events };
}
