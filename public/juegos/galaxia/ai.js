// Galaxia: the machine. It thinks every 1.5 s of game time (always on the same steps, so games repeat
// exactly). It defends planets that will fall, then attacks what it can take with a margin, and the
// Colmena moves ships off planets that are running dry.
import * as S from "./sim.js?v=1795723400";

export function think(s, civ) {
  const mine = s.planets.filter((p) => p.owner === civ);
  const enemyOf = (o) => o && o !== civ;
  const incoming = (p) => s.fleets.filter((f) => f.to === p.id && f.owner !== civ).reduce((a, f) => a + f.ships, 0);
  const coming = (p) => s.fleets.filter((f) => f.to === p.id && f.owner === civ).reduce((a, f) => a + f.ships, 0);
  // 1. defence
  for (const p of mine) {
    const threat = incoming(p);
    if (!threat) continue;
    const soon = Math.min(...s.fleets.filter((f) => f.to === p.id && f.owner !== civ).map((f) => S.eta(s, f)));
    const need = threat - (p.ships + S.rate(s, p) * soon + coming(p)) + 3;
    if (need <= 0) continue;
    for (const q of S.neighbours(s, p.id).map((i) => s.planets[i]).filter((q) => q.owner === civ && q.ships > 6 && incoming(q) === 0)) {
      const n = Math.min(q.ships - 3, need);
      if (n > 2 && S.send(s, civ, q.id, p.id, n / q.ships)) break;
    }
  }
  // 2. attack and spread: targets one or two jumps away
  for (const p of mine) {
    if (p.ships < 10 || incoming(p) > 0) continue;
    const cands = new Set();
    for (const a of S.neighbours(s, p.id)) { cands.add(a); for (const b of S.neighbours(s, a)) cands.add(b); }
    let best = null;
    for (const id of cands) {
      const t = s.planets[id];
      if (t.owner === civ || id === p.id) continue;
      const path = S.route(s, p.id, id); if (!path) continue;
      let len = 0; for (let i = 0; i < path.length - 1; i++) len += S.dist(s.planets[path[i]], s.planets[path[i + 1]]);
      const time = len / 2.2;
      const defend = t.ships + (enemyOf(t.owner) ? S.rate(s, t) * time : 0) - coming(t);
      const value = t.size * 10 + (enemyOf(t.owner) ? 6 : 0) - time * 0.6;
      const cost = defend + 4;
      if (cost < p.ships * 0.85 && (!best || value / cost > best.v)) best = { id, v: value / cost, cost };
    }
    if (best) S.send(s, civ, p.id, best.id, Math.min(1, (best.cost + 3) / p.ships));
  }
  // 3. the Colmena leaves planets that are running dry
  if (civ === "colmena") {
    for (const p of mine) {
      const age = (s.step - p.born) / S.STEPS;
      if (age < 250 || p.ships < 8 || incoming(p) > 0) continue;
      const front = S.neighbours(s, p.id).map((i) => s.planets[i]).find((q) => q.owner === civ && S.neighbours(s, q.id).some((j) => s.planets[j].owner !== civ));
      if (front) S.send(s, civ, p.id, front.id, 0.8);
    }
  }
}
