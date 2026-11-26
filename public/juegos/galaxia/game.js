// Galaxia: the game itself, with no drawing. Everything is counts and rates per minute, so an hour
// or a month of play weighs the same; when the game opens it catches up on the time that passed.

/* ---------- what exists ---------- */
export const MATS = {
  hierro: { name: "Hierro", tier: 0, color: "#d9d4cc" },
  cobre: { name: "Cobre", tier: 0, color: "#c9864f" },
  silicio: { name: "Silicio", tier: 1, color: "#9fb8c8" },
  titanio: { name: "Titanio", tier: 1, color: "#e6e2da" },
  iridio: { name: "Iridio", tier: 2, color: "#a879ff" },
  plasma: { name: "Cristal de plasma", tier: 3, color: "#ffcf6b" },
};
export const SUPPLY = {
  alimentos: { name: "Alimentos", color: "#f1e9dc" },
  combustible: { name: "Combustible", color: "#ff9f2e" },
};
export const TIER = ["COMÚN", "MEDIO", "RARO", "LEGENDARIO"];
export const RAD = { baja: 1, media: 0.9, alta: 0.75, extrema: 0.55 };

// veins: what they give, where they sit on the field (360×460), size, purity; deep ones need the lab to be seen
// and the heavy excavator to be worked
export const PLANETS = [
  { id: "kalon", name: "Kalon", kind: "Rocoso", c1: "#d98a5a", c2: "#6a2e16", ground: "#3a271d", x: 22, y: 62,
    desc: "Mundo de roca con vetas de metal a flor de piel. La radiación de su estrella castiga a la tripulación.",
    grav: 0.6, atm: 0.1, rad: "alta", temp: -40, o2: false, luz: 0.8, storm: 0.6, radio: 0.35, day: 31,
    veins: [
      { id: "k1", mat: "hierro", x: 90, y: 120, size: 2400, purity: 0.62 },
      { id: "k2", mat: "cobre", x: 285, y: 150, size: 1800, purity: 0.55 },
      { id: "k3", mat: "hierro", x: 180, y: 70, size: 1600, purity: 0.8 },
      { id: "k4", mat: "iridio", x: 300, y: 70, size: 600, purity: 0.4, deep: true },
    ] },
  { id: "velia", name: "Velia", kind: "Selva", c1: "#9cc98a", c2: "#2f5a2a", ground: "#22301c", x: 46, y: 80,
    desc: "Selva húmeda con aire respirable. Suelos fértiles y arenas ricas en silicio.",
    grav: 0.9, atm: 1.1, rad: "baja", temp: 24, o2: true, luz: 0.6, storm: 0.3, radio: 0.05, day: 22,
    veins: [
      { id: "v1", mat: "alimentos", x: 80, y: 120, size: 99999, purity: 0.9, crop: true },
      { id: "v2", mat: "silicio", x: 280, y: 110, size: 2000, purity: 0.6 },
      { id: "v3", mat: "alimentos", x: 190, y: 70, size: 99999, purity: 0.7, crop: true },
      { id: "v4", mat: "silicio", x: 300, y: 190, size: 1200, purity: 0.75 },
    ] },
  { id: "brumar", name: "Brumar", kind: "Gigante gaseoso", c1: "#c9b0e8", c2: "#4a2f7a", ground: "#241c33", gas: true, x: 62, y: 42,
    desc: "Gigante de gas con lunas heladas. Tormentas de energía en las capas altas; titanio y hielo en las lunas.",
    grav: 0.3, atm: 9, rad: "baja", temp: -150, o2: false, luz: 0.4, storm: 0.9, radio: 0.1, day: 10,
    veins: [
      { id: "b1", mat: "titanio", x: 90, y: 110, size: 1800, purity: 0.5 },
      { id: "b2", mat: "combustible", x: 280, y: 120, size: 3000, purity: 0.8, ice: true },
      { id: "b3", mat: "titanio", x: 190, y: 60, size: 1200, purity: 0.65 },
    ] },
  { id: "tessa", name: "Tessa", kind: "Helado", c1: "#e3eefa", c2: "#6f88a6", ground: "#2a3644", x: 14, y: 22,
    desc: "Bola de hielo silenciosa. Su agua congelada se refina en combustible para el motor de pliegue.",
    grav: 0.4, atm: 0.02, rad: "media", temp: -190, o2: false, luz: 0.3, storm: 0.1, radio: 0.2, day: 70,
    veins: [
      { id: "t1", mat: "combustible", x: 100, y: 120, size: 5000, purity: 0.9, ice: true },
      { id: "t2", mat: "silicio", x: 270, y: 120, size: 1500, purity: 0.5 },
      { id: "t3", mat: "cobre", x: 190, y: 66, size: 1500, purity: 0.6 },
    ] },
  { id: "eco", name: "Eco", kind: "Desconocido", c1: "#ffcf6b", c2: "#6a3a10", ground: "#2a1c10", x: 90, y: 14, far: true,
    desc: "La señal que brillaba tras la nebulosa: un mundo de cristales que vibran. Radiación extrema.",
    grav: 1.4, atm: 0.4, rad: "extrema", temp: 60, o2: false, luz: 1, storm: 0.8, radio: 0.9, day: 12,
    veins: [
      { id: "e1", mat: "iridio", x: 90, y: 120, size: 1500, purity: 0.7 },
      { id: "e2", mat: "plasma", x: 270, y: 110, size: 800, purity: 0.5, deep: true },
    ] },
];
export const P = Object.fromEntries(PLANETS.map((p) => [p.id, p]));

/* ---------- the terrain: 3×3 sectors; you land in the middle one ---------- */
export const SW = 360, SH = 470, CENTER = 4;
export const sectorOf = (v) => Math.floor(v.y / SH) * 3 + Math.floor(v.x / SW);
export const sectorName = (i) => "ABC"[i % 3] + (Math.floor(i / 3) + 1);
// building lots, around the headquarters, in the middle sector
export const SLOTXY = [[180, 300], [72, 262], [288, 262], [58, 362], [302, 362], [128, 418], [232, 418], [180, 212]].map(([x, y]) => [x + SW, y + SH]);
function seeded(str) { let h = 7; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; let s = h || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const VCACHE = {};
// the planet's veins: the known ones in the middle, and richer ones out in the fog (the corners can hide rare ones)
export function veinsOf(pid) {
  if (VCACHE[pid]) return VCACHE[pid];
  const p = P[pid], R = seeded("veins-" + pid), out = p.veins.map((v) => ({ ...v, x: v.x + SW, y: v.y + SH }));
  const pool = p.veins.filter((v) => !v.deep), rare = p.veins.find((v) => v.deep);
  for (let sec = 0; sec < 9; sec++) {
    if (sec === CENTER) continue;
    const sx = (sec % 3) * SW, sy = Math.floor(sec / 3) * SH, corner = sec % 2 === 0, placed = [];
    const n = 1 + (R() < 0.6 ? 1 : 0) + (corner && R() < 0.4 ? 1 : 0);
    const spot = () => { for (let k = 0; k < 30; k++) { const x = sx + 60 + R() * (SW - 120), y = sy + 70 + R() * (SH - 150); if (placed.every(([a, b]) => Math.hypot(a - x, b - y) > 110)) { placed.push([x, y]); return [x, y]; } } return [sx + SW / 2, sy + SH / 2]; };
    for (let i = 0; i < n; i++) {
      const base = pool[Math.floor(R() * pool.length)], [x, y] = spot();
      out.push({ ...base, id: pid[0] + sec + "-" + i, x: Math.round(x), y: Math.round(y), purity: Math.round((0.6 + R() * 0.35) * 100) / 100, size: base.crop ? 99999 : Math.round(2000 + R() * 2500), deep: false });
    }
    if (corner && rare && R() < 0.45) { const [x, y] = spot(); out.push({ ...rare, id: pid[0] + sec + "-r", x: Math.round(x), y: Math.round(y), purity: Math.round((0.55 + R() * 0.35) * 100) / 100, size: Math.round(rare.size * 1.5) }); }
  }
  return (VCACHE[pid] = out);
}
export const veinById = (pid, id) => veinsOf(pid).find((v) => v.id === id);
export const leftOf = (b, v) => (b.veins[v.id] == null ? v.size : b.veins[v.id]);

// buildings on the base, with their cost and seconds to build
export const BUILD = {
  cuartel: { name: "Cuartel", cost: {}, time: 0, note: "La nave convertida en base. Guarda 200." },
  paneles: { name: "Paneles solares", cost: { hierro: 20, cobre: 10 }, time: 20, note: "Energía según la luz del planeta" },
  colector: { name: "Colector de tormentas", cost: { hierro: 40, cobre: 20 }, time: 30, note: "+8 energía · solo en gigantes de gas", gas: true },
  habitat: { name: "Hábitat", cost: { hierro: 40, cobre: 10 }, time: 30, note: "Oxígeno y camas: +10 tripulantes; donde no hay aire, sin hábitat se rinde 25 % menos" },
  bodega: { name: "Bodega", cost: { hierro: 60 }, time: 25, note: "+300 de capacidad" },
  fabrica: { name: "Fábrica", cost: { hierro: 120, cobre: 40 }, time: 45, note: "Abre la fabricación de máquinas" },
  refugio: { name: "Refugio blindado", cost: { hierro: 80, titanio: 10 }, time: 40, note: "Turnos más largos: +20 % de rendimiento con radiación" },
  laboratorio: { name: "Laboratorio", cost: { hierro: 60, cobre: 30, silicio: 20 }, time: 60, note: "Escaneo profundo: revela vetas raras", needs: "lab" },
  reactor: { name: "Reactor", cost: { titanio: 30, silicio: 20, iridio: 5 }, time: 60, note: "+12 energía, de día y de noche" },
};
// machines, made at the factory
export const MACH = {
  excavadora: { name: "Excavadora", cost: { hierro: 50, cobre: 20 }, time: 30, rate: 40, crew: 2, ene: 1, note: "Vetas de superficie" },
  cosechadora: { name: "Cosechadora", cost: { hierro: 40, cobre: 30 }, time: 30, rate: 30, crew: 2, ene: 1, note: "Suelos fértiles: alimentos" },
  pesada: { name: "Excavadora pesada", cost: { hierro: 80, cobre: 30, titanio: 20, silicio: 15 }, time: 60, rate: 15, crew: 2, ene: 2, note: "Llega a las vetas profundas" },
  robot: { name: "Robot minero", cost: { silicio: 30, titanio: 20, cobre: 20 }, time: 45, rate: 25, crew: 0, ene: 2, note: "Sin tripulación; no le afecta la radiación" },
};
export const ITEMS = {
  dron: { name: "Dron explorador", cost: { hierro: 40, cobre: 25 }, time: 30, note: "Revela un sector en niebla y vuelve" },
  modulo: { name: "Módulo de base", cost: { hierro: 150, cobre: 60 }, time: 60, note: "Para fundar una base en otro planeta" },
  pliegue2: { name: "Motor de pliegue II", cost: { titanio: 40, iridio: 20, silicio: 30 }, time: 90, note: "Saltos sin límite de distancia", needs: "lab" },
};
export const RANGE1 = 45;

/* ---------- a new game ---------- */
export function newGame(now = Date.now()) {
  return {
    v: 1, t: now, created: now,
    inv: { hierro: 60, cobre: 30, silicio: 0, titanio: 0, iridio: 0, plasma: 0, alimentos: 120, combustible: 35 },
    got: {},                        // everything ever collected, for the missions
    crew: 24, machines: { excavadora: 2, cosechadora: 1, pesada: 0, robot: 0 }, items: { modulo: 2, pliegue2: 0, dron: 1 },
    ship: { at: "kalon", jump: null },
    bases: {},                      // planet id -> { buildings: [{type, slot, done}], jobs: [{id, type, vein}], veins: {id: left} }
    craft: null, nextId: 1, grow: 0, log: [],
  };
}

/* ---------- numbers derived from the state ---------- */
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
export const has = (s, cost) => Object.entries(cost).every(([k, v]) => (s.inv[k] || 0) >= v);
const pay = (s, cost) => { for (const [k, v] of Object.entries(cost)) s.inv[k] -= v; };
export const built = (b, type) => b.buildings.filter((x) => x.type === type && x.done >= 1).length;
export const anyBuilt = (s, type) => Object.values(s.bases).some((b) => built(b, type) > 0);
export function capacity(s) {
  let c = 0; for (const b of Object.values(s.bases)) c += 200 * built(b, "cuartel") + 300 * built(b, "bodega");
  return Math.max(c, 150);
}
export const supplyCap = (s) => { let c = 400; for (const b of Object.values(s.bases)) c += 100 * built(b, "bodega"); return c; };
export const stored = (s) => Object.keys(MATS).reduce((a, k) => a + s.inv[k], 0);
export function crewCap(s) { let c = 20; for (const b of Object.values(s.bases)) c += 10 * built(b, "cuartel") + 10 * built(b, "habitat"); return c; }
export function crewBusy(s) { let n = 0; for (const b of Object.values(s.bases)) for (const j of b.jobs) n += MACH[j.type].crew; return n; }
export function machinesFree(s, type) { let n = s.machines[type]; for (const b of Object.values(s.bases)) n -= b.jobs.filter((j) => j.type === type).length; return n; }
export function energy(s, pid) {
  const b = s.bases[pid], p = P[pid]; if (!b) return { prod: 0, cons: 0, f: 1 };
  const prod = 2 * built(b, "cuartel") + 3 * p.luz * built(b, "paneles") + 8 * built(b, "colector") + 12 * built(b, "reactor");
  const cons = b.jobs.reduce((a, j) => a + MACH[j.type].ene, 0) + built(b, "habitat") + built(b, "laboratorio") + (s.craft && built(b, "fabrica") ? 1 : 0);
  return { prod, cons, f: cons ? Math.min(1, prod / cons) : 1 };
}
// how well the crew works on this planet: radiation (helped by a shelter) and air (helped by a habitat)
export function crewFactor(s, pid) {
  const b = s.bases[pid], p = P[pid];
  let f = Math.min(1, RAD[p.rad] + (b && built(b, "refugio") ? 0.2 : 0));
  if (!p.o2 && !(b && built(b, "habitat"))) f *= 0.75;
  if (s.inv.alimentos <= 0) f *= 0.5;
  return f;
}
export const shiftHours = (s, pid) => Math.round(8 * crewFactor(s, pid) * 2) / 2;
// what a job makes per minute right now
export function jobRate(s, pid, j) {
  const b = s.bases[pid], v = veinById(pid, j.vein), m = MACH[j.type];
  if (!v || leftOf(b, v) <= 0) return 0;
  if (MATS[v.mat] ? stored(s) >= capacity(s) : s.inv[v.mat] >= supplyCap(s)) return 0;
  const people = m.crew ? crewFactor(s, pid) : 1;
  return m.rate * v.purity * people * energy(s, pid).f * haul(b, v);
}
export function income(s) {
  const o = {}; for (const k of [...Object.keys(MATS), ...Object.keys(SUPPLY)]) o[k] = 0;
  for (const [pid, b] of Object.entries(s.bases)) for (const j of b.jobs) { const v = veinById(pid, j.vein); o[v.mat] += jobRate(s, pid, j); }
  o.alimentos -= s.crew * 0.05;
  return o;
}
export const seen = (s, pid, sec) => { const b = s.bases[pid]; return sec === CENTER || !!(b && b.seen && b.seen[sec]); };
export const visibleVeins = (s, pid) => veinsOf(pid).filter((v) => (!v.deep || anyBuilt(s, "laboratorio")) && seen(s, pid, sectorOf(v)));
// the store a vein's material goes to: the nearest finished store, or the headquarters
export function depotFor(b, v) {
  let best = SLOTXY[0], bd = Infinity;
  for (const x of b.buildings) if ((x.type === "bodega" && x.done >= 1) || x.type === "cuartel") { const [px, py] = SLOTXY[x.slot], d = Math.hypot(px - v.x, py - v.y); if (d < bd) { bd = d; best = [px, py]; } }
  return best;
}
// far veins give less: the machines spend their time on the road (transport comes later)
export function haul(b, v) { const [x, y] = depotFor(b, v), d = Math.hypot(x - v.x, y - v.y); return d < 280 ? 1 : 280 / d; }
export function canWork(type, v) {
  if (v.crop) return type === "cosechadora";
  if (type === "cosechadora") return false;
  if (v.deep) return type === "pesada";
  return true;
}

/* ---------- orders ---------- */
const fail = (why) => ({ ok: false, why });
export function establish(s) {
  const pid = s.ship.at;
  if (s.ship.jump) return fail("La nave está saltando");
  if (s.bases[pid]) return fail("Ya tienes una base aquí");
  if (s.items.modulo < 1) return fail("Necesitas un módulo de base (se fabrica)");
  s.items.modulo--;
  s.bases[pid] = { buildings: [{ type: "cuartel", slot: 0, done: 1 }], jobs: [], veins: {}, seen: { [CENTER]: true }, explore: [] };
  return { ok: true };
}
// take a base down: the module goes back into the ship (buildings are lost, machines come back)
export function dismantle(s) {
  const pid = s.ship.at;
  if (!s.bases[pid]) return fail("No hay base aquí");
  delete s.bases[pid]; s.items.modulo++;
  return { ok: true };
}
// an old save could be stuck: no module, no factory to make one
export function rescue(s) { if (s.items.modulo < 1 && !anyBuilt(s, "fabrica") && !(s.craft && s.craft.key === "modulo")) { s.items.modulo = 1; return true; } return false; }
// send an explorer drone to a sector next to one you already know
export const dronesFree = (s) => s.items.dron - Object.values(s.bases).reduce((a, b) => a + (b.explore ? b.explore.length : 0), 0);
export function exploreTime(s, pid, sec) { const d = Math.abs((sec % 3) - 1) + Math.abs(Math.floor(sec / 3) - 1); return Math.round((40 + 30 * d) * (1 + P[pid].storm * 0.5)); }
export function explore(s, pid, sec) {
  const b = s.bases[pid];
  if (!b) return fail("Necesitas una base aquí");
  if (seen(s, pid, sec)) return fail("Ese sector ya está explorado");
  if (b.explore.some((x) => x.sector === sec)) return fail("Un dron ya va en camino");
  const near = [sec - 3, sec + 3, sec % 3 ? sec - 1 : -1, sec % 3 < 2 ? sec + 1 : -1].some((n) => n >= 0 && n < 9 && seen(s, pid, n));
  if (!near) return fail("Primero explora un sector vecino");
  if (dronesFree(s) < 1) return fail("No tienes drones libres (se fabrican)");
  const t = exploreTime(s, pid, sec); b.explore.push({ sector: sec, left: t, total: t });
  return { ok: true };
}
// saves from before the big terrain
export function migrate(s) {
  if (s.items.dron == null) s.items.dron = 1;
  for (const b of Object.values(s.bases)) { if (!b.seen) b.seen = { [CENTER]: true }; if (!b.explore) b.explore = []; }
  for (const [pid, b] of Object.entries(s.bases)) for (const id of Object.keys(b.veins)) if (!veinById(pid, id)) delete b.veins[id];
}
export const SLOTS = 8;
export function build(s, pid, type, slot) {
  const b = s.bases[pid], d = BUILD[type];
  if (!b || !d || type === "cuartel") return fail("No se puede");
  if (b.buildings.some((x) => x.slot === slot)) return fail("Ese terreno está ocupado");
  if (d.gas && !P[pid].gas) return fail("Solo en un gigante de gas");
  if (d.needs === "lab" && !missionDone(s, "m7")) return fail("Primero reúne 4 materiales distintos");
  if (!has(s, d.cost)) return fail("Faltan materiales");
  pay(s, d.cost); b.buildings.push({ type, slot, done: 0 });
  return { ok: true };
}
export function assign(s, pid, type, vein) {
  const b = s.bases[pid], v = veinById(pid, vein);
  if (!b || !v) return fail("No se puede");
  if (!seen(s, pid, sectorOf(v))) return fail("Ese sector aún no está explorado");
  if (v.deep && !anyBuilt(s, "laboratorio")) return fail("Aún no la ves");
  if (!canWork(type, v)) return fail(v.crop ? "Aquí se cosecha: usa una cosechadora" : v.deep ? "Veta profunda: necesita excavadora pesada" : "Esa máquina no sirve aquí");
  if (machinesFree(s, type) < 1) return fail("No tienes " + MACH[type].name.toLowerCase() + " libre");
  if (MACH[type].crew && crewBusy(s) + MACH[type].crew > s.crew) return fail("No hay tripulantes libres");
  b.jobs.push({ id: s.nextId++, type, vein });
  return { ok: true };
}
export function unassign(s, pid, id) { const b = s.bases[pid]; b.jobs = b.jobs.filter((j) => j.id !== id); return { ok: true }; }
export function craft(s, key) {
  const d = MACH[key] || ITEMS[key];
  if (!anyBuilt(s, "fabrica")) return fail("Necesitas una fábrica");
  if (s.craft) return fail("La fábrica está ocupada");
  if (d.needs === "lab" && !anyBuilt(s, "laboratorio")) return fail("Necesitas un laboratorio");
  if (!has(s, d.cost)) return fail("Faltan materiales");
  pay(s, d.cost); s.craft = { key, left: d.time, total: d.time };
  return { ok: true };
}
export const jumpCost = (s, to) => { const a = P[s.ship.at], b = P[to]; return Math.max(5, Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 0.35)); };
export const inRange = (s, to) => { const a = P[s.ship.at], b = P[to]; return s.items.pliegue2 > 0 || (!b.far && Math.hypot(a.x - b.x, a.y - b.y) <= RANGE1); };
export function jump(s, to) {
  if (s.ship.jump) return fail("Ya estás saltando");
  if (to === s.ship.at) return fail("Ya estás aquí");
  if (!inRange(s, to)) return fail("Fuera de alcance: necesitas el motor de pliegue II");
  const c = jumpCost(s, to);
  if (s.inv.combustible < c) return fail("Falta combustible");
  s.inv.combustible -= c; s.ship.jump = { to, left: 8 };
  return { ok: true };
}

/* ---------- missions: always one at a time, and then the game keeps growing ---------- */
const distinct = (s) => ["hierro", "cobre", "silicio", "titanio"].filter((k) => (s.got[k] || 0) > 0).length;
export const MISSIONS = [
  { id: "m1", t: "Establece tu primera base", h: "En la cabina: «Establecer base»", ok: (s) => Object.keys(s.bases).length > 0 },
  { id: "m2", t: "Instala paneles solares", h: "En la base, toca un terreno libre", ok: (s) => anyBuilt(s, "paneles") },
  { id: "m3", t: "Pon una excavadora a trabajar", h: "Toca una veta de hierro y asigna una excavadora", ok: (s) => Object.values(s.bases).some((b) => b.jobs.some((j) => j.type === "excavadora")) },
  { id: "m4", t: "Junta 150 de hierro", h: "Más excavadoras rinden más", ok: (s) => (s.got.hierro || 0) >= 150, n: (s) => [Math.floor(s.got.hierro || 0), 150] },
  { id: "mx1", t: "Explora un sector con el dron", h: "En la base, toca un sector en niebla o usa el minimapa", ok: (s) => Object.values(s.bases).some((b) => b.seen && Object.keys(b.seen).length > 1) },
  { id: "m5", t: "Construye una fábrica", h: "Abre la fabricación", ok: (s) => anyBuilt(s, "fabrica") },
  { id: "m6", t: "Funda una base en Velia y cosecha alimentos", h: "Fabrica un módulo, salta a Velia, establece base y asigna la cosechadora", ok: (s) => !!s.bases.velia && s.bases.velia.jobs.some((j) => j.type === "cosechadora") },
  { id: "m7", t: "Reúne hierro, cobre, silicio y titanio", h: "El titanio está en las lunas de Brumar", ok: (s) => distinct(s) >= 4, n: (s) => [distinct(s), 4] },
  { id: "m8", t: "Construye un laboratorio", h: "El escaneo profundo revela vetas raras", ok: (s) => anyBuilt(s, "laboratorio") },
  { id: "m9", t: "Extrae tu primer iridio", h: "Bajo la veta de Kalon; necesita excavadora pesada", ok: (s) => (s.got.iridio || 0) >= 1 },
  { id: "m10", t: "Fabrica el motor de pliegue II", h: "Abre los saltos largos", ok: (s) => s.items.pliegue2 > 0 },
  { id: "m11", t: "Llega a Eco y extrae cristal de plasma", h: "La señal tras la nebulosa", ok: (s) => (s.got.plasma || 0) >= 1 },
  { id: "m12", t: "Haz crecer tu colonia a 60 tripulantes", h: "Hábitats y alimentos", ok: (s) => s.crew >= 60, n: (s) => [s.crew, 60] },
];
export const missionDone = (s, id) => MISSIONS.find((m) => m.id === id).ok(s);
export const currentMission = (s) => MISSIONS.find((m) => !m.ok(s)) || null;

/* ---------- time ---------- */
// advance the game by dt seconds (any size: one second while playing, hours when coming back)
export function advance(s, dt) {
  while (dt > 0) { const h = Math.min(dt, 30); step(s, h); dt -= h; }
}
function step(s, dt) {
  const min = dt / 60;
  if (s.ship.jump) { s.ship.jump.left -= dt; if (s.ship.jump.left <= 0) { s.ship.at = s.ship.jump.to; s.ship.jump = null; } }
  for (const b of Object.values(s.bases)) for (const x of b.buildings) if (x.done < 1) x.done = Math.min(1, x.done + dt / BUILD[x.type].time);
  if (s.craft) { s.craft.left -= dt; if (s.craft.left <= 0) { const k = s.craft.key; if (MACH[k]) s.machines[k]++; else s.items[k]++; s.log.push({ t: s.t, made: k }); s.craft = null; } }
  // extraction, against what the veins have left and what the stores can hold
  for (const [pid, b] of Object.entries(s.bases)) {
    for (const j of b.jobs) {
      const v = veinById(pid, j.vein);
      let got = Math.min(jobRate(s, pid, j) * min, leftOf(b, v));
      if (MATS[v.mat]) got = Math.min(got, Math.max(0, capacity(s) - stored(s)));
      else got = Math.min(got, Math.max(0, supplyCap(s) - s.inv[v.mat]));
      if (got <= 0) continue;
      if (!v.crop) b.veins[v.id] = leftOf(b, v) - got;
      s.inv[v.mat] += got; s.got[v.mat] = (s.got[v.mat] || 0) + got;
    }
    // veins slowly come back (deep rock moves up), so the game never runs dry
    for (const id of Object.keys(b.veins)) { const v = veinById(pid, id); if (v) b.veins[id] = Math.min(v.size, b.veins[id] + v.size * 0.002 * min); }
    // explorer drones flying over the fog
    if (b.explore && b.explore.length) {
      for (const x of b.explore) x.left -= dt;
      for (const x of b.explore.filter((x) => x.left <= 0)) { b.seen[x.sector] = true; s.log.push({ t: s.t, seen: pid + ":" + x.sector }); }
      b.explore = b.explore.filter((x) => x.left > 0);
    }
  }
  s.inv.alimentos = Math.max(0, s.inv.alimentos - s.crew * 0.05 * min);
  for (const k of Object.keys(SUPPLY)) s.inv[k] = Math.min(s.inv[k], supplyCap(s));
  // the colony grows while there is food and room
  if (s.inv.alimentos > 20 && s.crew < crewCap(s)) { s.grow += min / 3; while (s.grow >= 1 && s.crew < crewCap(s)) { s.grow--; s.crew++; } }
  s.t += dt * 1000;
}
// catch up on the time since the last save (at most 12 hours)
export function catchUp(s, now = Date.now()) {
  const dt = Math.min(12 * 3600, Math.max(0, (now - s.t) / 1000));
  const before = { ...s.inv };
  advance(s, dt);
  s.t = now;
  return { dt, gained: Object.fromEntries(Object.keys(before).map((k) => [k, s.inv[k] - before[k]])) };
}
