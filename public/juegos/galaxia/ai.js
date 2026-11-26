// Galaxia: the machine. It thinks every 1.5 s of game time (always on the same steps, so games repeat
// exactly). Economy first (extractors where the resource is scarce, a lab, research, towers on the
// front), then defence, then attacks with a margin; the base keeps a reserve.
import * as S from "./sim.js?v=1795724487";

const LEVEL = { facil: { greed: 0.6, margin: 8, every: 3 }, medio: { greed: 0.85, margin: 4, every: 1 }, dificil: { greed: 1, margin: 2, every: 1 } };

export function think(s, civ, level = "medio") {
  const L = LEVEL[level] || LEVEL.medio;
  if ((s.step / 15) % L.every) return;
  const mine = s.planets.filter((p) => p.owner === civ);
  const enemyOf = (o) => o && o !== civ;
  const incoming = (p) => s.fleets.filter((f) => f.to === p.id && f.owner !== civ).reduce((a, f) => a + f.ships, 0);
  const coming = (p) => s.fleets.filter((f) => f.to === p.id && f.owner === civ).reduce((a, f) => a + f.ships, 0);
  const front = (p) => S.neighbours(s, p.id).some((j) => enemyOf(s.planets[j].owner));
  const base = S.baseOf(s, civ); if (!base) return;
  const res = s.res[civ];

  // 1. economy: an extractor on the planet whose resource we have least of
  const scarce = [...S.RES].sort((a, b) => res[a] - res[b]);
  const spots = [];
  for (const p of mine) p.slots.forEach((b, i) => { if (!b) spots.push([p, i]); });
  spots.sort((a, b) => scarce.indexOf(S.resOf(a[0])) - scarce.indexOf(S.resOf(b[0])) || b[0].size - a[0].size);
  for (const [p, i] of spots) {
    if (front(p) && p.slots.filter((b) => b && b.type === "torre").length < 1 && res.min > 60 && S.build(s, civ, p.id, i, "torre")) continue;
    if (p.base && !p.slots.some((b) => b && b.type === "lab") && res.min > 50 && res.ene > 40 && S.build(s, civ, p.id, i, "lab")) continue;
    if (p.base && res.min > 150 && res.ene > 80 && S.build(s, civ, p.id, i, "astillero")) continue;
    S.build(s, civ, p.id, i, "ext");
  }
  for (const key of Object.keys(S.TECH)) S.research(s, civ, key);

  // 2. defence
  for (const p of mine) {
    const threat = incoming(p); if (!threat) continue;
    const soon = Math.min(...s.fleets.filter((f) => f.to === p.id && f.owner !== civ).map((f) => S.eta(s, f)));
    const need = threat - (p.ships + S.garrison(s, p) * soon + coming(p)) * S.defense(s, p) + 3;
    if (need <= 0) continue;
    for (const q of S.neighbours(s, p.id).map((i) => s.planets[i]).filter((q) => q.owner === civ && q.ships > 6 && incoming(q) === 0)) {
      const n = Math.min(q.ships - 3, need);
      if (n > 2 && S.send(s, civ, q.id, p.id, n / q.ships)) break;
    }
  }
  // 3. attack and spread: targets one or two jumps away; the base keeps a reserve
  for (const p of mine) {
    const reserve = p.base ? 12 : 2;
    const spare = p.ships - reserve;
    if (spare < 8 || incoming(p) > 0) continue;
    const cands = new Set();
    for (const a of S.neighbours(s, p.id)) { cands.add(a); for (const b of S.neighbours(s, a)) cands.add(b); }
    let best = null;
    for (const id of cands) {
      const t = s.planets[id];
      if (t.owner === civ || id === p.id) continue;
      const path = S.route(s, p.id, id); if (!path) continue;
      let len = 0; for (let i = 0; i < path.length - 1; i++) len += S.dist(s.planets[path[i]], s.planets[path[i + 1]]);
      const time = len / 2.2;
      const defend = (t.ships + (enemyOf(t.owner) ? S.garrison(s, t) * time : 0)) * S.defense(s, t) - coming(t);
      const value = t.size * 10 + (enemyOf(t.owner) ? 6 : 0) + (t.base ? 40 : 0) - time * 0.6;
      const cost = defend + L.margin;
      if (cost < spare * L.greed && (!best || value / cost > best.v)) best = { id, v: value / cost, cost };
    }
    if (best) S.send(s, civ, p.id, best.id, Math.min(spare, best.cost + 3) / p.ships);
    // nothing to take: ships from the base move up to the front
    else if (p.base && spare > 20) {
      const f = mine.filter((q) => q !== p && front(q)).sort((a, b) => S.dist(a, p) - S.dist(b, p))[0];
      if (f) S.send(s, civ, p.id, f.id, (spare - 10) / p.ships);
    }
  }
  // 4. the Colmena leaves planets that are running dry
  if (civ === "colmena") {
    for (const p of mine) {
      const age = (s.step - p.born) / S.STEPS;
      if (p.base || age < 250 || p.ships < 8 || incoming(p) > 0) continue;
      const f = S.neighbours(s, p.id).map((i) => s.planets[i]).find((q) => q.owner === civ && front(q));
      if (f) S.send(s, civ, p.id, f.id, 0.8);
    }
  }
}
