// The machine for Comarca. choose(state, level) → { x, y, r, f } for the current tile (f: feature for a follower, or null).
// 1 Fácil: a random place, and sometimes a follower anywhere.
// 2 Medio: the move that adds most to its score plus what its followers on the board are worth.
// 3 Difícil: weighs the chance of finishing each city, the hermitages, the farmers, the followers it keeps in hand,
//    and what its best rival is worth, so it also blocks and joins rivals' cities.
import * as G from "./rules.js?v=1795707422";

export const K={hand:0.5,handBase:0.3,rival:0.4,pc:1.5,fieldInc:0.5,cl:0.5};
function worth(s, seat, level) {
  const an = G.analyse(s.tiles);
  const left = s.remaining == null ? 40 : s.remaining, late = Math.min(1, left / 50);
  const vals = new Array(s.n).fill(0);
  s.players.forEach((p, i) => (vals[i] = p.score + (p.left + (p.big || 0) * 1.6) * (level >= 3 ? K.hand * late + K.handBase : 0.8)));
  // goods count toward the 10-point bonuses; a builder or pig still in hand is worth a little
  s.players.forEach((p, i) => { vals[i] += (p.abbey || 0) * 2.5 + (p.mayor || 0) * 1.2; });
  s.players.forEach((p, i) => { if (p.goods) vals[i] += (p.goods.vino + p.goods.trigo + p.goods.tela) * (level >= 3 ? 2.2 : 1.5) + (p.builder || 0) * 1.5 * late + (p.pig || 0) * 1; });
  const done = new Set();
  for (const m of s.meeples) {
    if (m.kind === "b") { vals[m.s] += level >= 3 ? 4 * late : 2; continue; }
    if (m.kind === "p") { vals[m.s] += level >= 3 ? 3 : 1.5; continue; }
    const id = an.comp.get(m.t + ":" + m.f), c = an.comps[id];
    if (done.has(id)) continue; done.add(id);
    let v = 0;
    if (c.t === "road") v = c.inn ? 2 * c.tiles.size * (c.open === 0 ? 1 : level >= 3 ? 0.75 * late : 0.6) : c.tiles.size + (level >= 3 ? 0.5 : 0);
    else if (c.t === "city") {
      const sides = c.open / 3, p = level >= 3 ? Math.min(1, late * K.pc) / (1 + 0.55 * sides) : 0.5;
      v = c.cathedral ? 3 * (c.tiles.size + c.shields) * (level >= 3 ? p * 1.4 : 0.6) : (c.tiles.size + c.shields) * (1 + p);
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
    for (const q of s.meeples) if ((!q.kind || q.kind === "a") && set.has(q.t + ":" + q.f)) count[q.s] = (count[q.s] || 0) + (q.kind === "a" ? c.shields : q.big ? 2 : 1);
    const best = Math.max(...Object.values(count));
    for (const k of Object.keys(count)) if (count[k] === best) vals[k] += v;
  }
  const mine = vals[seat];
  vals[seat] = -Infinity;
  const rival = s.n > 1 ? Math.max(...vals) : 0;
  return level >= 3 ? mine - rival * K.rival : mine;
}

// the best move with the drawn tile, or (Abadía y alcalde) with the player's abbey in a closed hole
export function choose(s, level) {
  const normal = chooseTile(s, level, null);
  const p = s.players[s.turn];
  if (!p.abbey || level <= 1) return normal;
  const holes = G.abbeySpots(s.tiles);
  if (!holes.length) return normal;
  const ab = chooseTile(s, level, G.ABBEY, holes);
  if (!normal) return ab;
  return ab && ab.v > normal.v + 1 ? ab : normal;
}
function chooseTile(s, level, k, holes) {
  const tile = k || s.current;
  const places = holes || G.placements(s.tiles, tile);
  if (!places.length) return null;
  const seat = s.turn, hasMeeple = s.players[seat].left > 0 || s.players[seat].big > 0 || s.players[seat].mayor > 0, hasBig = s.players[seat].big > 0;
  if (level <= 1) {
    const p = places[Math.floor(Math.random() * places.length)];
    let f = null;
    if (hasMeeple && Math.random() < 0.35) {
      const spots = G.meepleSpots(s.tiles.concat([{ k: s.current, x: p.x, y: p.y, r: p.r }]), s.meeples);
      if (spots.length) f = spots[Math.floor(Math.random() * spots.length)];
    }
    return { ...p, f, big: f != null && hasBig && !(s.players[seat].left > 0) };
  }
  let best = null, bv = -Infinity;
  for (const p of places) {
    const tiles = s.tiles.concat([{ k: tile, x: p.x, y: p.y, r: p.r }]);
    const spots = hasMeeple ? G.meepleSpots(tiles, s.meeples) : [];
    const opts = [[null, false, null]];
    for (const f of spots) {
      if (s.players[seat].left > 0) opts.push([f, false, null]);
      if (hasBig) opts.push([f, true, null]);
      if (s.players[seat].mayor && G.TILES[tile].f[f].t === "city") opts.push([f, false, "a"]);
    }
    if (s.players[seat].builder || s.players[seat].pig) {
      const sp = G.specialSpots(tiles, s.meeples, seat, s.players[seat]);
      for (const f of sp.b) opts.push([f, false, "b"]);
      for (const f of sp.p) opts.push([f, false, "p"]);
    }
    for (const [f, big, kind] of opts) {
      const next = G.play(s, p.x, p.y, p.r, f, big, kind, k);
      next.remaining = s.remaining;
      const v = worth(next, seat, level) + (next.again ? 3 : 0) + Math.random() * (level === 2 ? 3 : 0.2);
      if (v > bv) { bv = v; best = { ...p, f, big, kind, k, v }; }
    }
  }
  return best;
}
