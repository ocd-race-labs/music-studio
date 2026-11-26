// Galaxia: the simulation. Fixed steps of 100 ms and every random number from a seed, so the same
// orders always give the same game (needed later to play online).
//
// The loop: planets give one natural resource each (minerals, energy or biomass). You build on their
// surface; what they produce travels as cargo along the routes ("pipelines") to your base. At the base
// the shipyard turns resources into ships, and ships take planets. Taking the enemy base wins.
export const TICK = 100;
export const STEPS = 1000 / TICK;
export const CIVS = {
  humanos: { name: "Humanos", color: "#4aa3ff", glow: "#a9d6ff", base: "Estación Tierra" },
  colmena: { name: "Colmena", color: "#7ee04a", glow: "#d1ff9e", base: "Nave Madre" },
};
export const RES = ["min", "ene", "bio"];
export const RES_NAME = { min: "Minerales", ene: "Energía", bio: "Biomasa" };
export const RES_ICON = { min: "⛏", ene: "⚡", bio: "🌱" };
// planet kinds: name, resource
export const KINDS = [
  { name: "Rocoso", res: "min" }, { name: "Oceánico", res: "bio" }, { name: "Selva", res: "bio" },
  { name: "Helado", res: "ene" }, { name: "Volcánico", res: "min" }, { name: "Gaseoso", res: "ene" },
];
// buildings: cost, seconds to build
export const BUILD = {
  ext: { name: "Extractor", cost: { min: 20, ene: 5 }, time: 8 },
  torre: { name: "Torre de defensa", cost: { min: 30, ene: 15 }, time: 12 },
  astillero: { name: "Astillero", cost: { min: 60, ene: 30 }, time: 20, base: true },
  lab: { name: "Laboratorio", cost: { min: 25, ene: 20, bio: 10 }, time: 15, base: true },
};
export const EXT_NAME = { min: "Mina", ene: "Colector de energía", bio: "Biogranja" };
export const SHIP_COST = { min: 4, ene: 2, bio: 1 };
const BASE_TRICKLE = 0.4;
// the shipyard leaves a reserve, so there is always enough for a building
export const RESERVE = 25;
const keep = (cost) => Object.fromEntries(RES.map((k) => [k, (cost[k] || 0) + RESERVE]));     // the base makes a little of everything, so a missing resource never stalls you
export const TECH = {
  motores: { name: "Motores iónicos", note: "Flotas 30 % más rápidas", cost: { ene: 60, bio: 30 } },
  escudos: { name: "Escudos planetarios", note: "Tus planetas resisten 25 % más", cost: { min: 50, ene: 50 } },
  perforacion: { name: "Perforación profunda", note: "Extractores 40 % más productivos", cost: { min: 60, bio: 40 } },
};
const SPEED = 2.2;           // fleets: galaxy units per second
const CARGO = 3.2;           // cargo along the pipelines
const EXHAUST = 300;         // Colmena: seconds until a planet it mines runs dry
const EXT_RATE = 0.55;       // resource per second per extractor and planet size

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  for (let i = 0; i < 8; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; }
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

export function newGalaxy(seed, n = 22) {
  const R = rng(seed), W = 100, H = 62, planets = [];
  let guard = 0;
  while (planets.length < n && guard++ < 5000) {
    const x = 6 + R() * (W - 12), y = 6 + R() * (H - 12);
    if (planets.every((p) => Math.hypot(p.x - x, p.y - y) > 11)) {
      const size = R() < 0.25 ? 3 : R() < 0.55 ? 2 : 1;
      planets.push({ id: planets.length, x, y, size, kind: Math.floor(R() * 6), owner: null, ships: 3 + Math.floor(R() * 5) * size,
        slots: new Array(size + 1).fill(null), born: 0, acc: 0, store: 0, deco: Math.floor(R() * 1e6) });
    }
  }
  const links = new Set(), key = (a, b) => (a < b ? a + "-" + b : b + "-" + a);
  for (const p of planets) planets.filter((q) => q !== p).sort((a, b) => dist(p, a) - dist(p, b)).slice(0, 3).forEach((q) => { if (dist(p, q) < 26) links.add(key(p.id, q.id)); });
  const groups = () => { const g = planets.map((p) => p.id); const f = (i) => (g[i] === i ? i : (g[i] = f(g[i]))); for (const l of links) { const [a, b] = l.split("-").map(Number); g[f(a)] = f(b); } return planets.map((p) => f(p.id)); };
  for (let k = 0; k < 40; k++) {
    const g = groups(); if (new Set(g).size === 1) break;
    let best = null;
    for (const p of planets) for (const q of planets) if (g[p.id] !== g[q.id] && (!best || dist(p, q) < best[2])) best = [p.id, q.id, dist(p, q)];
    links.add(key(best[0], best[1]));
  }
  let a = 0, b = 1, far = 0;
  for (const p of planets) for (const q of planets) if (dist(p, q) > far) { far = dist(p, q); a = p.id; b = q.id; }
  for (const [id, civ] of [[a, "humanos"], [b, "colmena"]]) {
    // the base: a big planet of minerals with a shipyard and a mine, and two free slots
    Object.assign(planets[id], { owner: civ, size: 3, kind: 0, ships: 20, base: true, slots: [{ type: "astillero", done: 1 }, { type: "ext", done: 1 }, null, null] });
  }
  return { W, H, planets, links: [...links].map((l) => l.split("-").map(Number)) };
}

export function newGame(seed, you = "humanos") {
  const g = newGalaxy(seed);
  const res = {}, tech = {}, yard = {};
  for (const c of Object.keys(CIVS)) { res[c] = { min: 60, ene: 40, bio: 20 }; tech[c] = {}; yard[c] = { on: true, acc: 0 }; }
  return { seed, step: 0, you, ...g, fleets: [], cargo: [], nextId: 1, over: null, log: [], res, tech, yard };
}
export function neighbours(s, id) {
  const out = []; for (const [a, b] of s.links) { if (a === id) out.push(b); else if (b === id) out.push(a); } return out;
}
// shortest route; avoid: planets the route may not cross (for cargo: the enemy's)
export function route(s, from, to, avoid) {
  const prev = new Map([[from, -1]]), d = new Map([[from, 0]]), q = [from];
  while (q.length) {
    q.sort((a, b) => d.get(a) - d.get(b));
    const u = q.shift(); if (u === to) break;
    for (const v of neighbours(s, u)) {
      if (avoid && v !== to && avoid(s.planets[v])) continue;
      const nd = d.get(u) + dist(s.planets[u], s.planets[v]);
      if (!d.has(v) || nd < d.get(v)) { d.set(v, nd); prev.set(v, u); q.push(v); }
    }
  }
  if (!prev.has(to)) return null;
  const path = []; for (let v = to; v !== -1; v = prev.get(v)) path.unshift(v);
  return path;
}
export const baseOf = (s, civ) => s.planets.find((p) => p.base && p.owner === civ);
// the pipeline from a planet to its owner's base (cargo can't cross enemy planets)
export const pipeline = (s, p) => { const b = baseOf(s, p.owner); return b ? route(s, p.id, b.id, (q) => q.owner && q.owner !== p.owner) : null; };
export const resOf = (p) => KINDS[p.kind].res;
const afford = (have, cost) => Object.entries(cost).every(([k, v]) => (have[k] || 0) >= v);
const pay = (have, cost) => { for (const [k, v] of Object.entries(cost)) have[k] -= v; };
export const canAfford = (s, civ, cost) => afford(s.res[civ], cost);

// resource per second a planet makes now
export function output(s, p) {
  if (!p.owner) return 0;
  const n = p.slots.filter((b) => b && b.type === "ext" && b.done >= 1).length;
  let r = n * EXT_RATE * p.size * (s.tech[p.owner].perforacion ? 1.4 : 1);
  if (p.owner === "colmena") r *= 1.45 * Math.max(0.15, 1 - (s.step - p.born) / STEPS / EXHAUST);
  return r;
}
// ships a planet grows by itself (a small garrison); towers help
export function garrison(s, p) {
  if (!p.owner) return 0;
  const towers = p.slots.filter((b) => b && b.type === "torre" && b.done >= 1).length;
  return 0.06 * p.size + towers * 0.25;
}
export const defense = (s, p) => (p.owner && s.tech[p.owner].escudos ? 1.25 : 1) * (1 + 0.25 * p.slots.filter((b) => b && b.type === "torre" && b.done >= 1).length);

/* ---------- orders ---------- */
export function send(s, civ, from, to, share) {
  const p = s.planets[from];
  if (!p || p.owner !== civ || from === to) return false;
  const n = Math.floor(p.ships * share); if (n < 1) return false;
  const path = route(s, from, to); if (!path) return false;
  p.ships -= n;
  s.fleets.push({ id: s.nextId++, owner: civ, ships: n, path, leg: 0, t: 0, from, to });
  return true;
}
export function build(s, civ, planet, slot, type) {
  const p = s.planets[planet], b = BUILD[type];
  if (!p || p.owner !== civ || p.slots[slot] || !b || (b.base && !p.base)) return false;
  if (type === "lab" && p.slots.some((x) => x && x.type === "lab")) return false;
  if (type === "astillero" && p.slots.filter((x) => x && x.type === "astillero").length >= 2) return false;
  if (!afford(s.res[civ], b.cost)) return false;
  pay(s.res[civ], b.cost);
  p.slots[slot] = { type, done: b.time ? 0 : 1 };
  return true;
}
export function research(s, civ, key) {
  const t = TECH[key], base = baseOf(s, civ);
  if (!t || s.tech[civ][key] || !base || !base.slots.some((x) => x && x.type === "lab" && x.done >= 1) || !afford(s.res[civ], t.cost)) return false;
  pay(s.res[civ], t.cost); s.tech[civ][key] = true; return true;
}
// digging by hand on a planet's surface: a little of its resource, into the pipeline
export function dig(s, civ, planet) {
  const p = s.planets[planet];
  if (!p || p.owner !== civ) return false;
  p.store += 1.5; return true;
}
export function setYard(s, civ, on) { s.yard[civ].on = on; }

/* ---------- positions and times ---------- */
export const fleetSpeed = (s, f) => (f.cargo ? CARGO : SPEED * (s.tech[f.owner].motores ? 1.3 : 1));
export function fleetPos(s, f, extra = 0) {
  const a = s.planets[f.path[f.leg]], b = s.planets[f.path[f.leg + 1]];
  const len = dist(a, b), t = Math.min(len, f.t + extra * fleetSpeed(s, f));
  return { x: a.x + (b.x - a.x) * (t / len), y: a.y + (b.y - a.y) * (t / len) };
}
export function eta(s, f) {
  let left = dist(s.planets[f.path[f.leg]], s.planets[f.path[f.leg + 1]]) - f.t;
  for (let i = f.leg + 1; i < f.path.length - 1; i++) left += dist(s.planets[f.path[i]], s.planets[f.path[i + 1]]);
  return left / fleetSpeed(s, f);
}
function move(s, list) {
  const done = [];
  for (const f of list) {
    f.t += fleetSpeed(s, f) / STEPS;
    const len = dist(s.planets[f.path[f.leg]], s.planets[f.path[f.leg + 1]]);
    if (f.t >= len) { f.leg++; f.t = 0; if (f.leg >= f.path.length - 1) done.push(f); }
  }
  return done;
}

/* ---------- one step of 100 ms ---------- */
export function step(s) {
  if (s.over) return;
  s.step++;
  for (const p of s.planets) {
    if (!p.owner) continue;
    for (const b of p.slots) if (b && b.done < 1) b.done = Math.min(1, b.done + 1 / (BUILD[b.type].time * STEPS));
    p.acc += garrison(s, p) / STEPS;
    while (p.acc >= 1) { p.acc -= 1; if (p.ships < 30 * p.size) p.ships++; }
    // production goes into the planet's store, and leaves as cargo every 4 s
    p.store += output(s, p) / STEPS;
    if (s.step % 40 === p.id % 40 && p.store >= 1) {
      const amount = Math.floor(p.store);
      if (p.base) { s.res[p.owner][resOf(p)] += amount; p.store -= amount; }
      else {
        const path = pipeline(s, p);
        if (path) { s.cargo.push({ id: s.nextId++, cargo: true, owner: p.owner, res: resOf(p), amount, path, leg: 0, t: 0, from: p.id, to: path[path.length - 1] }); p.store -= amount; }
      }
    }
  }
  // the shipyards at each base: one ship a second each, while there are resources
  for (const civ of Object.keys(CIVS)) {
    const b = baseOf(s, civ);
    if (!b) continue;
    for (const r of RES) s.res[civ][r] += BASE_TRICKLE / STEPS;
    if (!s.yard[civ].on) continue;
    const yards = b.slots.filter((x) => x && x.type === "astillero" && x.done >= 1).length;
    s.yard[civ].acc = Math.min(1, s.yard[civ].acc + yards / STEPS);
    if (s.yard[civ].acc >= 1 && afford(s.res[civ], keep(SHIP_COST))) { s.yard[civ].acc = 0; pay(s.res[civ], SHIP_COST); b.ships++; }
  }
  const landed = move(s, s.fleets);
  for (const f of landed) land(s, f);
  s.fleets = s.fleets.filter((f) => !landed.includes(f));
  // cargo: delivered at the base; lost if it reaches enemy ground on the way
  const delivered = move(s, s.cargo);
  for (const c of delivered) { const to = s.planets[c.to]; if (to.owner === c.owner) s.res[c.owner][c.res] += c.amount; }
  s.cargo = s.cargo.filter((c) => !delivered.includes(c) && !(s.planets[c.path[c.leg]].owner && s.planets[c.path[c.leg]].owner !== c.owner));
  for (const civ of Object.keys(CIVS)) if (!baseOf(s, civ)) s.over = { loser: civ, winner: Object.keys(CIVS).find((c) => c !== civ), at: s.step };
}
function land(s, f) {
  const p = s.planets[f.to];
  if (p.owner === f.owner) { p.ships += f.ships; return; }
  const hold = p.ships * defense(s, p);
  if (f.ships > hold) {
    const was = p.owner;
    p.ships = Math.max(1, Math.round(f.ships - hold)); p.owner = f.owner; p.born = s.step; p.acc = 0; p.store = 0;
    if (p.base) { p.base = false; p.ruined = was; }
    s.log.push({ step: s.step, kind: "capture", planet: p.id, by: f.owner, from: was });
  } else {
    p.ships = Math.max(0, Math.round((hold - f.ships) / defense(s, p)));
    s.log.push({ step: s.step, kind: "hold", planet: p.id, by: p.owner, against: f.owner });
  }
}
