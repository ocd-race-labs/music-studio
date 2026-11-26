// The machine for Comarca. choose(state, level) → { x, y, r, f } for the current tile (f: feature for a follower, or null).
// 1 Fácil: a random place, and sometimes a follower anywhere.
// 2 Medio: the move that adds most to its score plus what its followers on the board are worth.
// 3 Difícil: weighs the chance of finishing each city, the hermitages, the farmers, the followers it keeps in hand,
//    and what its best rival is worth, so it also blocks and joins rivals' cities.
import * as G from "./rules.js?v=1795704760";

export const K={hand:0.5,handBase:0.3,rival:0.4,pc:1.5,fieldInc:0.5,cl:0.5};
function worth(s, seat, level) {
  const an = G.analyse(s.tiles);
  const left = s.remaining == null ? 40 : s.remaining, late = Math.min(1, left / 50);
  const vals = new Array(s.n).fill(0);
  s.players.forEach((p, i) => (vals[i] = p.score + p.left * (level >= 3 ? K.hand * late + K.handBase : 0.8)));
  const done = new Set();
  for (const m of s.meeples) {
    const id = an.comp.get(m.t + ":" + m.f), c = an.comps[id];
    if (done.has(id)) continue; done.add(id);
    let v = 0;
    if (c.t === "road") v = c.tiles.size + (level >= 3 ? 0.5 : 0);
    else if (c.t === "city") {
      const sides = c.open / 3, p = level >= 3 ? Math.min(1, late * K.pc) / (1 + 0.55 * sides) : 0.5;
      v = (c.tiles.size + c.shields) * (1 + p);
    } else if (c.t === "cloister") {
      const t = s.tiles[m.t], nb = G.neighbours8(an.idx, t.x, t.y);
      v = 1 + nb + (level >= 3 ? (8 - nb) * K.cl * late : (8 - nb) * 0.5);
    } else if (c.t === "field") {
      if (level < 3) { v = 1; }
      else {
        const cities = [...c.cities].map((ci) => an.comps[ci]);
        v = 3 * cities.filter((x) => x.complete).length + K.fieldInc * late * cities.filter((x) => !x.complete).length;
      }
    }
    // who owns it
    const set = new Set(c.nodes), count = {};
    for (const q of s.meeples) if (set.has(q.t + ":" + q.f)) count[q.s] = (count[q.s] || 0) + 1;
    const best = Math.max(...Object.values(count));
    for (const k of Object.keys(count)) if (count[k] === best) vals[k] += v;
  }
  const mine = vals[seat];
  vals[seat] = -Infinity;
  const rival = s.n > 1 ? Math.max(...vals) : 0;
  return level >= 3 ? mine - rival * K.rival : mine;
}

export function choose(s, level) {
  const places = G.placements(s.tiles, s.current);
  if (!places.length) return null;
  const seat = s.turn, hasMeeple = s.players[seat].left > 0;
  if (level <= 1) {
    const p = places[Math.floor(Math.random() * places.length)];
    let f = null;
    if (hasMeeple && Math.random() < 0.35) {
      const spots = G.meepleSpots(s.tiles.concat([{ k: s.current, x: p.x, y: p.y, r: p.r }]), s.meeples);
      if (spots.length) f = spots[Math.floor(Math.random() * spots.length)];
    }
    return { ...p, f };
  }
  let best = null, bv = -Infinity;
  for (const p of places) {
    const tiles = s.tiles.concat([{ k: s.current, x: p.x, y: p.y, r: p.r }]);
    const opts = [null].concat(hasMeeple ? G.meepleSpots(tiles, s.meeples) : []);
    for (const f of opts) {
      const next = G.play(s, p.x, p.y, p.r, f);
      next.remaining = s.remaining;
      const v = worth(next, seat, level) + Math.random() * (level === 2 ? 3 : 0.2);
      if (v > bv) { bv = v; best = { ...p, f }; }
    }
  }
  return best;
}
