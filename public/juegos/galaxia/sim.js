// Galaxia: the simulation. Fixed steps of 100 ms, every random number from a seed,
// so the same orders always give the same game (needed later to play online).
export const TICK = 100;                 // ms per step
export const STEPS = 1000 / TICK;        // steps per second
export const CIVS = {
  humanos: { name: "Humanos", color: "#4aa3ff", glow: "#a9d6ff" },
  colmena: { name: "Colmena", color: "#7ee04a", glow: "#d1ff9e" },
};
const SPEED = 2.2;            // galaxy units per second for a fleet (a hop between neighbours takes 6–10 s)
const EXHAUST = 300;          // Colmena: seconds until a planet it owns runs dry

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// a galaxy: planets spread out, each joined to its nearest neighbours
export function newGalaxy(seed, n = 22) {
  const R = rng(seed), W = 100, H = 62, planets = [];
  let guard = 0;
  while (planets.length < n && guard++ < 5000) {
    const x = 6 + R() * (W - 12), y = 6 + R() * (H - 12);
    if (planets.every((p) => Math.hypot(p.x - x, p.y - y) > 11)) {
      const size = R() < 0.25 ? 3 : R() < 0.55 ? 2 : 1;
      planets.push({ id: planets.length, x, y, size, kind: Math.floor(R() * 6), owner: null, ships: 4 + Math.floor(R() * 6) * size, born: 0, acc: 0 });
    }
  }
  // routes: the 3 nearest, then join any separate groups
  const links = new Set();
  const key = (a, b) => (a < b ? a + "-" + b : b + "-" + a);
  for (const p of planets) {
    planets.filter((q) => q !== p).sort((a, b) => dist(p, a) - dist(p, b)).slice(0, 3).forEach((q) => { if (dist(p, q) < 26) links.add(key(p.id, q.id)); });
  }
  const groups = () => { const g = planets.map((p) => p.id); const f = (i) => (g[i] === i ? i : (g[i] = f(g[i]))); for (const l of links) { const [a, b] = l.split("-").map(Number); g[f(a)] = f(b); } return planets.map((p) => f(p.id)); };
  for (let k = 0; k < 40; k++) {
    const g = groups(); if (new Set(g).size === 1) break;
    let best = null;
    for (const p of planets) for (const q of planets) if (g[p.id] !== g[q.id] && (!best || dist(p, q) < best[2])) best = [p.id, q.id, dist(p, q)];
    links.add(key(best[0], best[1]));
  }
  // home planets: the two farthest big ones
  let a = 0, b = 1, far = 0;
  for (const p of planets) for (const q of planets) if (dist(p, q) > far) { far = dist(p, q); a = p.id; b = q.id; }
  for (const [id, civ] of [[a, "humanos"], [b, "colmena"]]) Object.assign(planets[id], { owner: civ, size: 3, ships: 30, home: true });
  return { W, H, planets, links: [...links].map((l) => l.split("-").map(Number)) };
}
export const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

export function newGame(seed, you = "humanos") {
  const g = newGalaxy(seed);
  return { seed, step: 0, you, ...g, fleets: [], nextFleet: 1, over: null, log: [] };
}
export function neighbours(s, id) {
  const out = [];
  for (const [a, b] of s.links) { if (a === id) out.push(b); else if (b === id) out.push(a); }
  return out;
}
// shortest route along the links
export function route(s, from, to) {
  const prev = new Map([[from, -1]]), q = [from];
  const d = new Map([[from, 0]]);
  while (q.length) {
    q.sort((a, b) => d.get(a) - d.get(b));
    const u = q.shift();
    if (u === to) break;
    for (const v of neighbours(s, u)) {
      const nd = d.get(u) + dist(s.planets[u], s.planets[v]);
      if (!d.has(v) || nd < d.get(v)) { d.set(v, nd); prev.set(v, u); q.push(v); }
    }
  }
  if (!prev.has(to)) return null;
  const path = []; for (let v = to; v !== -1; v = prev.get(v)) path.unshift(v);
  return path;
}
// production per second of a planet for its owner
export function rate(s, p) {
  if (!p.owner) return 0;
  const base = 0.45 * p.size;
  if (p.owner === "colmena") {
    // fast, but the planet runs dry
    const age = (s.step - p.born) / STEPS;
    return base * 1.7 * Math.max(0.15, 1 - age / EXHAUST);
  }
  return base;
}
// order: send a share of a planet's ships to another planet
export function send(s, civ, from, to, share) {
  const p = s.planets[from];
  if (!p || p.owner !== civ || from === to) return false;
  const n = Math.floor(p.ships * share);
  if (n < 1) return false;
  const path = route(s, from, to);
  if (!path) return false;
  p.ships -= n;
  s.fleets.push({ id: s.nextFleet++, owner: civ, ships: n, path, leg: 0, t: 0, from, to });
  return true;
}
// where a fleet is now (for drawing and for its countdown)
export function fleetPos(s, f, extra = 0) {
  const a = s.planets[f.path[f.leg]], b = s.planets[f.path[f.leg + 1]];
  const len = dist(a, b), t = Math.min(len, f.t + extra * SPEED);
  return { x: a.x + (b.x - a.x) * (t / len), y: a.y + (b.y - a.y) * (t / len) };
}
// seconds until a fleet arrives
export function eta(s, f) {
  let left = dist(s.planets[f.path[f.leg]], s.planets[f.path[f.leg + 1]]) - f.t;
  for (let i = f.leg + 1; i < f.path.length - 1; i++) left += dist(s.planets[f.path[i]], s.planets[f.path[i + 1]]);
  return left / SPEED;
}

// one step of 100 ms
export function step(s) {
  if (s.over) return;
  s.step++;
  for (const p of s.planets) {
    if (!p.owner) continue;
    p.acc += rate(s, p) / STEPS;
    const cap = 40 * p.size;
    while (p.acc >= 1) { p.acc -= 1; if (p.ships < cap) p.ships++; }
  }
  const arrived = [];
  for (const f of s.fleets) {
    f.t += SPEED / STEPS;
    const len = dist(s.planets[f.path[f.leg]], s.planets[f.path[f.leg + 1]]);
    if (f.t >= len) {
      f.leg++; f.t = 0;
      if (f.leg >= f.path.length - 1) arrived.push(f);
    }
  }
  for (const f of arrived) land(s, f);
  s.fleets = s.fleets.filter((f) => !arrived.includes(f));
  // the end: someone has no planets and no fleets left
  for (const civ of Object.keys(CIVS)) {
    if (!s.planets.some((p) => p.owner === civ) && !s.fleets.some((f) => f.owner === civ)) {
      s.over = { loser: civ, winner: Object.keys(CIVS).find((c) => c !== civ), at: s.step };
    }
  }
}
function land(s, f) {
  const p = s.planets[f.to];
  if (p.owner === f.owner) { p.ships += f.ships; return; }
  if (f.ships > p.ships) {
    const was = p.owner;
    p.ships = f.ships - p.ships; p.owner = f.owner; p.born = s.step; p.acc = 0;
    s.log.push({ step: s.step, kind: "capture", planet: p.id, by: f.owner, from: was });
  } else {
    p.ships -= f.ships;
    s.log.push({ step: s.step, kind: "hold", planet: p.id, by: p.owner, against: f.owner });
  }
}
