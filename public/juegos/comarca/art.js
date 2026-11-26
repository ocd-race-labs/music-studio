// Comarca: the drawings. The ground of each tile (grass, river, roads, city floors and walls) is drawn in a
// 100×100 box and turned with the tile; houses, trees, towers and the hermitage are drawn upright on top,
// so the map reads as one landscape whatever the turns. Fields get a few trees, bushes, flowers or wheat
// that change with the tile's place, so two copies of a tile never look the same.

const C = {
  grass: "#8dbd5c", grass2: "#7fae50", grass3: "#a3cd6f",
  road: "#e4d3a6", roadEdge: "#b99d68", track: "#cdb685",
  floor: "#d9c49b", wall: "#8d8273", wallTop: "#b9ae9c", wallDark: "#6c6356",
  water: "#4f9fd6", water2: "#7cc0ec", bank: "#6f9a46",
  roof: ["#c0533a", "#a8452f", "#d0663f", "#b3573c"], plaster: "#f3e7cc", wood: "#7a5a3a",
  leaf: ["#3f7d36", "#4d8f3c", "#5a9b45"], trunk: "#6b4a2b", wheat: "#e2c25c", wheat2: "#c9a43e", flower: ["#f4d35e", "#ffffff", "#e57aa0", "#b98ee0"],
};

/* ---------- shapes (in the unrotated 100×100 box) ---------- */
const P = (pts) => "M" + pts.map((p) => p.join(",")).join(" L");
// city walls are bent lines with towers at the corners, so no two towns look like the same curve
const CAPW = [[100, 0], [92, 17], [76, 30], [60, 27], [44, 35], [26, 29], [10, 18], [0, 0]];
const BANDN = [[0, 0], [14, 19], [33, 26], [52, 21], [70, 28], [87, 17], [100, 0]];
const BANDS = [[100, 100], [86, 81], [68, 73], [50, 79], [31, 72], [13, 81], [0, 100]];
const CORNW = [[100, 0], [86, 18], [66, 28], [54, 46], [32, 54], [22, 72], [0, 100]];
const THREEW = [[100, 100], [87, 78], [68, 69], [51, 75], [31, 67], [14, 79], [0, 100]];
const CITY = {
  cap: { fill: P([[0, 0], ...CAPW.slice().reverse().slice(1), [100, 0]]) + " Z", wall: P(CAPW), tower: [[76, 30], [44, 35]] },
  full: { fill: "M0,0 H100 V100 H0 Z", wall: null },
  band: { fill: P([[0, 0], ...BANDN.slice(1), ...BANDS.slice(1)]) + " Z", wall: [P(BANDN), P(BANDS)], tower: [[33, 26], [70, 28], [68, 73], [31, 72]] },
  corner: { fill: P([[0, 0], ...CORNW]) + " Z", wall: P(CORNW), tower: [[66, 28], [32, 54]] },
  three: { fill: P([[0, 0], [100, 0], ...THREEW]) + " Z", wall: P(THREEW), tower: [[68, 69], [31, 67]] },
};
// per tile: cities [shape, quarter turns], roads, rivers, houses inside the cities, junction, hermitage, free spots in the fields
const ART = {
  A: { road: ["M50,100 V70"], abbey: [50, 46], spots: [[16, 18], [84, 18], [16, 84], [84, 84], [20, 52], [80, 56]] },
  B: { abbey: [50, 50], spots: [[16, 18], [84, 18], [16, 84], [84, 84], [20, 52], [80, 56], [50, 86]] },
  C: { city: [["full", 0]], shield: [26, 24], houses: [[50, 24], [72, 30], [36, 46], [60, 52], [80, 60], [26, 70], [48, 76], [72, 82], [18, 44]] },
  D: { city: [["cap", 0]], road: ["M0,50 H100"], houses: [[34, 10], [50, 14], [66, 10]], spots: [[20, 80], [50, 84], [80, 78], [14, 32], [86, 32]] },
  E: { city: [["cap", 0]], houses: [[34, 10], [50, 14], [66, 10]], spots: [[20, 60], [50, 66], [80, 58], [24, 88], [76, 88], [50, 44]] },
  F: { city: [["band", 0]], shield: [22, 50], houses: [[40, 44], [58, 52], [76, 44], [50, 60], [30, 56], [70, 62]], spots: [[30, 6], [70, 8], [30, 94], [70, 94]] },
  G: { city: [["band", 0]], houses: [[30, 44], [50, 52], [70, 44], [40, 60], [62, 62], [84, 54]], spots: [[30, 6], [70, 8], [30, 94], [70, 94]] },
  H: { city: [["cap", 1], ["cap", 3]], houses: [[90, 40], [86, 58], [10, 42], [14, 60]], spots: [[50, 20], [50, 50], [50, 80], [36, 34], [64, 66]] },
  I: { city: [["cap", 1], ["cap", 2]], houses: [[90, 40], [86, 58], [42, 90], [60, 86]], spots: [[24, 24], [44, 50], [18, 70], [66, 18]] },
  J: { city: [["cap", 0]], road: ["M100,50 C80,50 66,58 58,64 C50,72 50,86 50,100"], houses: [[34, 10], [50, 14], [66, 10]], spots: [[22, 58], [22, 86], [88, 88], [40, 44]] },
  K: { city: [["cap", 0]], road: ["M0,50 C20,50 34,58 42,64 C50,72 50,86 50,100"], houses: [[34, 10], [50, 14], [66, 10]], spots: [[78, 58], [78, 86], [12, 88], [60, 44]] },
  L: { city: [["cap", 0]], road: ["M100,50 H56", "M50,100 V56", "M0,50 H44"], hamlet: [50, 50], houses: [[34, 10], [50, 14], [66, 10]], spots: [[84, 84], [16, 84], [22, 34], [78, 34]] },
  M: { city: [["corner", 0]], shield: [16, 18], houses: [[38, 12], [60, 10], [14, 40], [30, 28], [12, 62]], spots: [[66, 66], [84, 46], [46, 86], [84, 84]] },
  N: { city: [["corner", 0]], houses: [[38, 12], [60, 10], [14, 40], [30, 28], [12, 62]], spots: [[66, 66], [84, 46], [46, 86], [84, 84]] },
  O: { city: [["corner", 0]], shield: [16, 18], road: ["M100,50 C84,50 72,60 64,70 C56,80 50,88 50,100"], houses: [[38, 12], [60, 8], [14, 40], [28, 26]], spots: [[90, 90], [56, 52], [86, 30]] },
  P: { city: [["corner", 0]], road: ["M100,50 C84,50 72,60 64,70 C56,80 50,88 50,100"], houses: [[38, 12], [60, 8], [14, 40], [28, 26]], spots: [[90, 90], [56, 52], [86, 30]] },
  Q: { city: [["three", 0]], shield: [24, 20], houses: [[46, 18], [68, 14], [84, 34], [30, 40], [54, 40], [80, 58], [14, 58]], spots: [[30, 92], [70, 92]] },
  R: { city: [["three", 0]], houses: [[30, 14], [52, 18], [74, 14], [86, 36], [30, 40], [56, 42], [82, 60], [14, 60]], spots: [[30, 92], [70, 92]] },
  S: { city: [["three", 0]], shield: [24, 20], road: ["M50,100 V72"], gate: [50, 72], houses: [[46, 18], [68, 14], [84, 34], [30, 40], [62, 40], [82, 58], [14, 58]], spots: [[24, 92], [78, 92]] },
  T: { city: [["three", 0]], road: ["M50,100 V72"], gate: [50, 72], houses: [[30, 14], [52, 18], [74, 14], [86, 36], [30, 40], [62, 42], [82, 60], [14, 60]], spots: [[24, 92], [78, 92]] },
  U: { road: ["M50,0 V100"], spots: [[20, 20], [22, 62], [78, 30], [80, 76], [18, 88]] },
  V: { road: ["M0,50 C20,50 34,58 42,64 C50,72 50,86 50,100"], spots: [[14, 86], [66, 30], [84, 74], [30, 18], [82, 14]] },
  W: { road: ["M100,50 H56", "M0,50 H44", "M50,100 V56"], hamlet: [50, 50], spots: [[30, 18], [70, 20], [86, 86], [14, 86]] },
  X: { road: ["M50,0 V44", "M100,50 H56", "M50,100 V56", "M0,50 H44"], well: [50, 50], spots: [[18, 18], [84, 84], [16, 84], [84, 16]] },
  // Posadas y catedrales
  NU: { road: ["M50,0 V100"], inn: [74, 40], spots: [[20, 20], [22, 64], [80, 84], [18, 88]] },
  NV: { road: ["M0,50 C20,50 34,58 42,64 C50,72 50,86 50,100"], inn: [62, 38], spots: [[14, 86], [30, 18], [86, 16], [86, 80]] },
  ND: { city: [["cap", 0]], road: ["M0,50 H100"], inn: [34, 72], houses: [[34, 10], [50, 14], [66, 10]], spots: [[80, 80], [14, 32], [86, 32]] },
  NW: { road: ["M100,50 H56", "M0,50 H44", "M50,100 V56"], hamlet: [50, 50], inn: [70, 74], spots: [[30, 18], [70, 20], [14, 86]] },
  NA: { road: ["M50,100 V70"], abbey: [50, 44], inn: [74, 82], spots: [[16, 18], [84, 18], [16, 84], [20, 52], [82, 50]] },
  NS: { city: [["three", 0]], road: ["M50,100 V72"], gate: [50, 72], inn: [74, 90], houses: [[30, 14], [52, 18], [74, 14], [86, 36], [30, 40], [62, 42], [82, 60], [14, 60]] },
  CC: { city: [["full", 0]], cathedral: [50, 44], houses: [[16, 16], [84, 16], [16, 80], [84, 82], [30, 88], [70, 90], [12, 50], [88, 52]] },
  // Comerciantes y constructores: cities with goods
  GA: { city: [["cap", 0]], good: ["vino", 28, 12], houses: [[72, 10], [86, 6]], spots: [[20, 60], [50, 66], [80, 58], [24, 88], [76, 88]] },
  GB: { city: [["corner", 0]], good: ["trigo", 46, 11], houses: [[12, 46], [66, 8], [12, 66]], spots: [[66, 66], [84, 46], [46, 86], [84, 84]] },
  GC: { city: [["three", 0]], good: ["tela", 50, 14], houses: [[24, 16], [74, 14], [86, 40], [14, 52], [80, 60]], spots: [[30, 92], [70, 92]] },
  GD: { city: [["band", 0]], good: ["vino", 22, 50], houses: [[72, 44], [66, 62], [84, 54]], spots: [[30, 6], [70, 8], [30, 94], [70, 94]] },
  GE: { city: [["cap", 0]], road: ["M100,50 C80,50 66,58 58,64 C50,72 50,86 50,100"], good: ["trigo", 28, 12], houses: [[72, 10], [86, 6]], spots: [[22, 58], [22, 86], [88, 88]] },
  GF: { city: [["corner", 0]], road: ["M100,50 C84,50 72,60 64,70 C56,80 50,88 50,100"], good: ["vino", 44, 10], houses: [[10, 44], [64, 6]], spots: [[90, 90], [86, 30]] },
  GG: { city: [["three", 0]], road: ["M50,100 V72"], gate: [50, 72], good: ["tela", 50, 14], houses: [[24, 16], [74, 14], [86, 40], [14, 52], [80, 60]], spots: [[24, 92], [78, 92]] },
  GH: { city: [["cap", 1], ["cap", 3]], good: ["tela", 91, 30], houses: [[10, 42], [14, 60], [88, 70]], spots: [[50, 20], [50, 50], [50, 80]] },
  GI: { city: [["cap", 0]], road: ["M0,50 H100"], good: ["vino", 28, 12], houses: [[72, 10], [86, 6]], spots: [[20, 80], [50, 84], [80, 78]] },
  GJ: { city: [["cap", 0]], road: ["M100,50 H56", "M50,100 V56", "M0,50 H44"], hamlet: [50, 50], good: ["trigo", 28, 12], houses: [[72, 10], [86, 6]], spots: [[84, 84], [16, 84]] },
  // meadows
  PA: { forest: [[30, 30], [52, 24], [70, 36], [40, 50], [62, 56], [80, 62], [48, 76], [72, 82], [22, 56]] },
  PB: { fields: [[30, 32], [62, 30], [30, 60], [62, 58], [46, 86]], spots: [[86, 14], [86, 86]] },
  PC: { pond: true, spots: [[18, 86], [86, 18], [84, 84]] },
  PD: { mill: [52, 44], spots: [[18, 18], [20, 84], [84, 20]] },
  PE: { garden: [50, 48], spots: [[16, 16], [86, 86], [84, 16]] },
  PF: { sheep: [[40, 46], [56, 54], [64, 40], [48, 66], [70, 66], [30, 62]], spots: [[16, 16], [86, 86]] },
  PG: { bloom: true, spots: [[20, 20], [80, 80]] },
  PH: { spots: [[24, 30], [76, 70]] },
  // the river
  RL: { river: ["M50,0 C50,12 48,22 50,34"], lake: true, spots: [[12, 14], [88, 14], [8, 94], [92, 94]] },
  RA: { river: ["M50,0 C50,18 34,30 38,46 C42,62 62,66 60,80 C58,90 50,90 50,100"], spots: [[18, 20], [20, 70], [82, 34], [80, 84]] },
  RC: { river: ["M0,50 C20,50 34,58 42,64 C50,72 50,86 50,100"], spots: [[14, 86], [66, 30], [84, 74], [30, 18]] },
  RB: { river: ["M50,0 V100"], road: ["M0,50 H100"], bridge: true, spots: [[18, 18], [84, 18], [18, 84], [84, 84]] },
  RT: { river: ["M50,0 V100"], city: [["cap", 1], ["cap", 3]], houses: [[90, 40], [86, 58], [10, 42], [14, 60]], spots: [[32, 12], [68, 88]] },
  RK: { river: ["M0,50 C20,50 34,58 42,64 C50,72 50,86 50,100"], city: [["corner", 1]], houses: [[62, 12], [86, 38], [72, 26], [88, 62]], spots: [[14, 86], [30, 24], [40, 50]] },
  RM: { river: ["M50,0 C50,20 38,34 42,50 C46,66 50,80 50,100"], road: ["M100,62 H80"], abbey: [76, 46], spots: [[18, 20], [20, 70], [84, 88]] },
  RN: { river: ["M50,0 C50,16 56,30 64,38 C72,46 84,50 100,50"], road: ["M0,50 C20,50 34,58 42,64 C50,72 50,86 50,100"], spots: [[86, 14], [14, 86], [80, 84], [22, 22]] },
  RV: { river: ["M50,0 V100"], city: [["cap", 3]], houses: [[10, 42], [14, 60]], spots: [[30, 14], [80, 30], [76, 76], [30, 86]] },
};

/* ---------- a little deterministic noise ---------- */
function rng(x, y, salt) {
  let h = (x * 374761393 + y * 668265263 + salt * 2654435761) | 0;
  return () => { h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return ((h >>> 0) % 10000) / 10000; };
}
const rot = (r) => (r ? ` transform="rotate(${r * 90} 50 50)"` : "");
const turn = ([x, y], r) => { for (let i = 0; i < r; i++) [x, y] = [100 - y, x]; return [x, y]; };

/* ---------- upright things ---------- */
function house(x, y, s, roof) {
  const w = 9 * s, h = 6 * s;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="${(-w / 2).toFixed(1)}" y="${(-h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${C.plaster}" stroke="${C.wood}" stroke-width=".6"/>
    <path d="M${(-w / 2 - 1.2).toFixed(1)},${(-h / 2 + .4).toFixed(1)} L0,${(-h / 2 - 5 * s).toFixed(1)} L${(w / 2 + 1.2).toFixed(1)},${(-h / 2 + .4).toFixed(1)} Z" fill="${roof}" stroke="#7a3322" stroke-width=".5"/>
    <rect x="${(-1.2 * s).toFixed(1)}" y="${(h / 2 - 3.2 * s).toFixed(1)}" width="${(2.4 * s).toFixed(1)}" height="${(3.2 * s).toFixed(1)}" fill="${C.wood}"/></g>`;
}
function tree(x, y, s, k) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})"><ellipse cx="1.5" cy="6.5" rx="7" ry="2.4" fill="rgba(0,0,0,.18)"/>
    <rect x="-1" y="1" width="2" height="5" fill="${C.trunk}"/><circle cx="-3" cy="0" r="4.6" fill="${C.leaf[k % 3]}"/><circle cx="3" cy="-1" r="4.8" fill="${C.leaf[(k + 1) % 3]}"/><circle cx="0" cy="-4.5" r="4.8" fill="${C.leaf[(k + 2) % 3]}"/>
    <circle cx="-1.5" cy="-6" r="1.6" fill="rgba(255,255,255,.18)"/></g>`;
}
function bush(x, y) { return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle cx="-2.5" cy="0" r="3" fill="${C.leaf[1]}"/><circle cx="2" cy=".5" r="3.2" fill="${C.leaf[2]}"/><circle cx="0" cy="-2" r="2.8" fill="${C.leaf[0]}"/></g>`; }
function flowers(x, y, g) {
  let s = ""; for (let i = 0; i < 7; i++) s += `<circle cx="${(x + (g() - .5) * 16).toFixed(1)}" cy="${(y + (g() - .5) * 12).toFixed(1)}" r="1.3" fill="${C.flower[Math.floor(g() * 4)]}"/>`;
  return s;
}
function wheat(x, y) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="-9" y="-6" width="18" height="12" rx="2" fill="${C.wheat}" stroke="${C.wheat2}" stroke-width=".8"/>
    <path d="M-6,-5 V5 M-2,-5 V5 M2,-5 V5 M6,-5 V5" stroke="${C.wheat2}" stroke-width=".8"/></g>`;
}
function abbey(x, y) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="-17" y="-12" width="34" height="30" rx="5" fill="${C.grass3}"/><path d="M-12,14 h24" stroke="${C.flower[0]}" stroke-width="2" stroke-dasharray="1 3"/>
    <rect x="-11" y="-4" width="22" height="15" fill="${C.plaster}" stroke="${C.wood}" stroke-width="1"/><path d="M-13,-3 L0,-14 L13,-3 Z" fill="${C.roof[1]}" stroke="#7a3322" stroke-width=".8"/>
    <rect x="5" y="-17" width="6" height="12" fill="${C.plaster}" stroke="${C.wood}" stroke-width=".8"/><path d="M4,-17 L8,-22 L12,-17 Z" fill="${C.roof[0]}"/><path d="M8,-28 V-22 M5.5,-25.5 H10.5" stroke="${C.wood}" stroke-width="1.2"/>
    <rect x="-2.5" y="4" width="5" height="7" rx="2.5" fill="${C.wood}"/></g>`;
}
function mill(x, y) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="2" cy="16" rx="12" ry="3" fill="rgba(0,0,0,.18)"/>
    <path d="M-7,15 L-5,-6 L5,-6 L7,15 Z" fill="${C.plaster}" stroke="${C.wood}" stroke-width="1"/><path d="M-7,-5 L0,-13 L7,-5 Z" fill="${C.roof[1]}"/>
    <rect x="-2" y="8" width="4" height="7" fill="${C.wood}"/>
    <g transform="translate(0 -6)" stroke="${C.wood}" stroke-width="1.2"><path d="M0,0 L-14,-14 M0,0 L14,-14 M0,0 L14,14 M0,0 L-14,14"/>
    <path d="M-14,-14 l5,-2 l4,5 Z M14,-14 l2,5 l-5,4 Z M14,14 l-5,2 l-4,-5 Z M-14,14 l-2,-5 l5,-4 Z" fill="#f6efe0"/></g></g>`;
}
function sheep(x, y) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="0" cy="3.5" rx="5" ry="1.4" fill="rgba(0,0,0,.15)"/>
    <path d="M-2.5,2 v2.4 M2.5,2 v2.4" stroke="#3a3a3a" stroke-width="1"/><ellipse cx="0" cy="0" rx="5" ry="3.6" fill="#fbfaf5" stroke="#cfcac0" stroke-width=".6"/>
    <ellipse cx="4.6" cy="-1.4" rx="1.9" ry="1.6" fill="#3a3a3a"/></g>`;
}
function garden(x, y) {
  let s = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="-26" y="-20" width="52" height="40" rx="3" fill="#a5814f" stroke="#8a6a3e" stroke-width="1"/>`;
  for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) s += `<circle cx="${-21 + j * 7}" cy="${-14 + i * 7}" r="2.3" fill="${["#4d8f3c", "#e07a3a", "#5a9b45", "#c93b3b", "#4d8f3c"][i]}"/>`;
  return s + `<path d="M-28,22 H28" stroke="${C.wood}" stroke-width="1.2" stroke-dasharray="2 2"/></g>`;
}
// an inn by the road: a house with a hanging sign and a mug
function inn(x, y) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="1" cy="9" rx="13" ry="3" fill="rgba(0,0,0,.16)"/>
    <rect x="-11" y="-3" width="22" height="12" fill="#f1dcb0" stroke="${C.wood}" stroke-width="1"/><path d="M-13,-2 L0,-12 L13,-2 Z" fill="#8a3b26" stroke="#5f281a" stroke-width=".8"/>
    <rect x="-3" y="2" width="6" height="7" fill="${C.wood}"/><path d="M11,0 H17 V3" stroke="${C.wood}" stroke-width="1.2" fill="none"/>
    <rect x="13" y="3" width="8" height="7" rx="1" fill="#f4d35e" stroke="${C.wood}" stroke-width=".8"/><path d="M15,5 h3 v3 h-3 Z M18,6 h1.4 v1.4" stroke="#8a5a2b" stroke-width=".7" fill="#fff6d0"/></g>`;
}
// a cathedral in the middle of a city
function cathedral(x, y) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="2" cy="22" rx="26" ry="4" fill="rgba(0,0,0,.18)"/>
    <rect x="-16" y="-2" width="32" height="24" fill="#efe6d2" stroke="#7a6a52" stroke-width="1"/><path d="M-18,-1 L0,-12 L18,-1 Z" fill="#5b6f8f" stroke="#3e4d66" stroke-width=".8"/>
    <rect x="-24" y="-14" width="10" height="36" fill="#efe6d2" stroke="#7a6a52" stroke-width="1"/><path d="M-26,-13 L-19,-30 L-12,-13 Z" fill="#5b6f8f" stroke="#3e4d66" stroke-width=".8"/>
    <rect x="14" y="-14" width="10" height="36" fill="#efe6d2" stroke="#7a6a52" stroke-width="1"/><path d="M12,-13 L19,-30 L26,-13 Z" fill="#5b6f8f" stroke="#3e4d66" stroke-width=".8"/>
    <circle cx="0" cy="6" r="4" fill="#7fb2e5" stroke="#7a6a52" stroke-width=".8"/><path d="M-4,22 v-8 a4,4 0 0 1 8,0 v8 Z" fill="${C.wood}"/>
    <path d="M-19,-36 v6 M-21.5,-33.5 h5 M19,-36 v6 M16.5,-33.5 h5" stroke="#7a6a52" stroke-width="1.2"/></g>`;
}
// goods in a city: a wine barrel, a wheat sheaf, a bolt of cloth, on a little market stall
export function goodArt(kind) {
  const base = `<circle r="8.5" fill="#fff8e6" stroke="#8a6a3e" stroke-width="1.2"/>`;
  if (kind === "vino") return base + `<rect x="-4.5" y="-5.5" width="9" height="11" rx="3.5" fill="#8a4a2a" stroke="#4d2814" stroke-width=".8"/><path d="M-4.5,-2 H4.5 M-4.5,2 H4.5" stroke="#d9b36a" stroke-width="1"/><circle cx="0" cy="0" r="1.4" fill="#7b2a5a"/>`;
  if (kind === "trigo") return base + `<path d="M0,6 V-4 M-3,6 L-1,-3 M3,6 L1,-3" stroke="#b08a2a" stroke-width="1.2"/><ellipse cx="0" cy="-5" rx="1.8" ry="3" fill="#e2c25c"/><ellipse cx="-2.6" cy="-3.6" rx="1.6" ry="2.6" fill="#e2c25c" transform="rotate(-20 -2.6 -3.6)"/><ellipse cx="2.6" cy="-3.6" rx="1.6" ry="2.6" fill="#e2c25c" transform="rotate(20 2.6 -3.6)"/><path d="M-3,2 H3" stroke="#8a5a2b" stroke-width="1.4"/>`;
  return base + `<rect x="-5.5" y="-3.5" width="11" height="7" rx="1" fill="#3e7cc4" stroke="#24508a" stroke-width=".8"/><path d="M-5.5,-1 H5.5 M-5.5,1.5 H5.5" stroke="#9cc4ef" stroke-width=".7"/><circle cx="5.5" cy="0" r="3.5" fill="#3e7cc4" stroke="#24508a" stroke-width=".8"/>`;
}
// the builder and the pig, in the player's colour
export function builderArt(color) {
  return `<g><ellipse cx="0" cy="9" rx="7" ry="2" fill="rgba(0,0,0,.25)"/><path d="M-4,8 L-4,-1 C-4,-4 4,-4 4,-1 L4,8 Z" fill="${color}" stroke="#1d1f23" stroke-width="1.2"/>
    <circle cx="0" cy="-6" r="3.6" fill="${color}" stroke="#1d1f23" stroke-width="1.2"/><path d="M-5,-7.5 a5,4 0 0 1 10,0 Z" fill="#ffd75e" stroke="#1d1f23" stroke-width="1"/>
    <path d="M5,-2 L11,4" stroke="#7a5a3a" stroke-width="1.6"/><rect x="8.5" y="1.5" width="5" height="3" fill="#8f8a7e" stroke="#1d1f23" stroke-width=".7" transform="rotate(45 11 3)"/></g>`;
}
export function pigArt(color) {
  return `<g><ellipse cx="0" cy="6" rx="8" ry="2" fill="rgba(0,0,0,.22)"/><ellipse cx="0" cy="0" rx="8" ry="5.5" fill="#f3a9b8" stroke="#1d1f23" stroke-width="1.1"/>
    <circle cx="7" cy="-1" r="3.4" fill="#f3a9b8" stroke="#1d1f23" stroke-width="1"/><ellipse cx="9.6" cy="-.6" rx="1.5" ry="1.2" fill="#e88a9c"/><circle cx="6.6" cy="-2.4" r=".6" fill="#1d1f23"/>
    <path d="M-5,5 v2.4 M-1,5.4 v2.4 M3,5.4 v2.4" stroke="#1d1f23" stroke-width="1.1"/><path d="M3.6,-2.8 h3 v6" stroke="${color}" stroke-width="2.2" fill="none"/><path d="M-8,-1 q-3,-2 -2,1" stroke="#1d1f23" stroke-width=".9" fill="none"/></g>`;
}
// the hills the river is born in
function hills(x, y) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="0" cy="12" rx="26" ry="5" fill="rgba(0,0,0,.15)"/>
    <path d="M-26,12 L-10,-14 L2,4 L10,-6 L26,12 Z" fill="#8f8a7e" stroke="#6c665b" stroke-width="1"/>
    <path d="M-10,-14 L-15,-6 L-11,-8 L-7,-5 Z M10,-6 L6,0 L10,-2 L13,0 Z" fill="#fff"/>
    <path d="M-20,12 L-6,-4 L4,12 Z" fill="#a19b8e"/><path d="M-2,8 q2,3 0,6" stroke="${C.water2}" stroke-width="2.5" fill="none"/></g>`;
}
function tower(x, y) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="-4.5" y="-6" width="9" height="11" fill="${C.wallTop}" stroke="${C.wallDark}" stroke-width=".8"/>
    <path d="M-5,-6 h2.5 v-2.5 h2.5 v2.5 h2.5 v-2.5 h2.5 v2.5" fill="${C.wallTop}" stroke="${C.wallDark}" stroke-width=".8"/></g>`;
}
function shield(x, y) {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M-6,-7 H6 V0 C6,5 0,8 0,8 C0,8 -6,5 -6,0 Z" fill="#2f5fb3" stroke="#fff" stroke-width="1.4"/><path d="M0,-4.5 V4.5 M-3.5,-1 H3.5" stroke="#ffd75e" stroke-width="1.6"/></g>`;
}

/* ---------- a whole tile, drawn in its own 100×100 box with turn r (x, y only vary the decoration) ---------- */
// layer: "grass" (draw it for every tile first), "ground" (the rest of the turned ground), "top" (upright things), or all
export function tileArt(k, r = 0, x = 0, y = 0, layer) {
  const a = ART[k] || {};
  if (layer === "grass") return `<rect x="-.8" y="-.8" width="101.6" height="101.6" fill="url(#grass)"/>`;
  let g = layer ? "" : `<rect x="-.8" y="-.8" width="101.6" height="101.6" fill="url(#grass)"/>`;
  if (a.lake) g += `<path d="M6,60 C2,40 18,28 32,32 C38,22 62,20 68,30 C82,24 98,40 94,58 C100,74 88,90 72,90 C62,98 40,98 30,92 C14,96 2,84 6,74 C2,70 4,64 6,60 Z" fill="${C.bank}"/>
    <path d="M11,60 C8,44 20,34 33,38 C40,29 60,27 66,36 C79,31 92,44 89,59 C94,72 84,85 71,85 C61,92 41,92 31,87 C17,90 7,81 10,73 C7,69 8,64 11,60 Z" fill="${C.water}"/>
    <path d="M22,56 q7,-3 14,0 M56,52 q7,-3 14,0 M36,70 q6,-2 12,0 M64,72 q5,-2 10,0 M24,80 q4,-2 8,0" stroke="${C.water2}" stroke-width="1.6" fill="none"/>
    <path d="M14,52 l-2,-6 M17,51 l0,-7 M20,52 l2,-6 M84,78 l-2,-6 M87,77 l0,-7 M90,78 l2,-6" stroke="#4d7a32" stroke-width="1.4"/>`;
  for (const p of a.river || []) g += `<path d="${p}" stroke="${C.bank}" stroke-width="30" fill="none"/><path d="${p}" stroke="${C.water}" stroke-width="23" fill="none"/><path d="${p}" stroke="${C.water2}" stroke-width="1.4" stroke-dasharray="4 11" fill="none"/>`;
  if (a.spring) g += `<ellipse cx="48" cy="58" rx="10" ry="6" fill="${C.water}" stroke="${C.bank}" stroke-width="2.5"/>`;
  for (const p of a.road || []) g += `<path d="${p}" stroke="${C.roadEdge}" stroke-width="12" fill="none"/><path d="${p}" stroke="${C.road}" stroke-width="9" fill="none"/><path d="${p}" stroke="${C.track}" stroke-width="5" stroke-dasharray="3 4" fill="none" opacity=".7"/>`;
  if (a.bridge) g += `<rect x="32" y="40" width="36" height="20" fill="${C.road}" stroke="${C.wallDark}" stroke-width="1.2"/><path d="M32,40 H68 M32,60 H68" stroke="${C.wall}" stroke-width="3"/>`;
  for (const [shape, q] of a.city || []) {
    const sh = CITY[shape];
    g += `<g${rot(q)}><path d="${sh.fill}" fill="${C.floor}" stroke="${C.floor}" stroke-width="1.2"/>`;
    for (const w of [].concat(sh.wall || [])) g += `<path d="${w}" stroke="${C.wallDark}" stroke-width="7" fill="none" stroke-linejoin="round"/><path d="${w}" stroke="${C.wall}" stroke-width="5" fill="none"/><path d="${w}" stroke="${C.wallTop}" stroke-width="2" stroke-dasharray="3 2.5" fill="none"/>`;
    g += `</g>`;
  }
  if (a.pond) g += `<path d="M28,52 C24,38 40,30 54,34 C70,30 82,44 76,58 C80,72 62,78 50,74 C38,80 26,70 28,52 Z" fill="${C.bank}"/>
    <path d="M32,52 C29,41 42,35 54,38 C68,35 77,46 72,57 C75,68 61,73 50,70 C40,74 30,66 32,52 Z" fill="${C.water}"/><path d="M42,50 q5,-2 10,0 M54,60 q5,-2 10,0" stroke="${C.water2}" stroke-width="1.4" fill="none"/>`;
  if (a.hamlet || a.well) { const [hx, hy] = a.hamlet || a.well; g += `<circle cx="${hx}" cy="${hy}" r="9" fill="${C.road}" stroke="${C.roadEdge}" stroke-width="1.5"/>`; }
  if (layer === "ground") return `<g${rot(r)}>${g}</g>`;
  let up = "";
  const R = rng(x, y, k.charCodeAt(0) * 7 + (k.charCodeAt(1) || 0));
  // fields: trees, bushes, flowers, wheat
  for (const s of a.spots || []) {
    const [px, py] = turn(s, r), roll = R();
    if (roll < 0.34) { up += tree(px, py, 0.8 + R() * 0.45, Math.floor(R() * 3)); if (R() < 0.4) up += tree(px + 6, py + 4, 0.7, 1); }
    else if (roll < 0.52) up += bush(px, py);
    else if (roll < 0.68) up += flowers(px, py, R);
    else if (roll < 0.78 && !(a.city && a.city.length)) up += wheat(px, py);
  }
  for (const [fx, fy] of (a.forest || []).map((p) => turn(p, r))) up += tree(fx, fy, 0.9 + R() * 0.4, Math.floor(R() * 3));
  for (const [fx, fy] of (a.fields || []).map((p) => turn(p, r))) up += wheat(fx, fy) + wheat(fx + 0.1, fy + 0.1);
  for (const [fx, fy] of (a.sheep || []).map((p) => turn(p, r))) up += sheep(fx, fy);
  if (a.mill) { const [mx, my] = turn(a.mill, r); up += mill(mx, my); }
  if (a.garden) { const [gx, gy] = turn(a.garden, r); up += garden(gx, gy); }
  if (a.pond) { const [px, py] = turn([46, 46], r); up += `<g fill="#fff" stroke="#c9a43e" stroke-width=".5"><ellipse cx="${px}" cy="${py}" rx="2.6" ry="1.6"/><ellipse cx="${px + 12}" cy="${py + 10}" rx="2.6" ry="1.6"/></g>`; }
  if (a.bloom) { const g2 = rng(x + 7, y + 3, 9); for (let i = 0; i < 6; i++) up += flowers(14 + g2() * 72, 14 + g2() * 72, g2); }
  // cities: towers, houses, shield
  for (const [shape, q] of a.city || []) {
    const t = CITY[shape].tower; if (!t) continue;
    for (const p of t) { const [tx, ty] = turn(turn(p, q), r); up += tower(tx, ty); }
  }
  (a.houses || []).forEach((h, i) => { const [hx, hy] = turn(h, r); up += house(hx, hy, 0.85 + R() * 0.3, C.roof[i % 4]); });
  if (a.gate) { const [gx, gy] = turn(a.gate, r); up += tower(gx, gy); }
  if (a.shield) { const [sx, sy] = turn(a.shield, r); up += shield(sx, sy); }
  if (a.abbey) { const [bx, by] = turn(a.abbey, r); up += abbey(bx, by); }
  if (a.inn) { const [ix, iy] = turn(a.inn, r); up += inn(ix, iy); }
  if (a.good) { const [gx, gy] = turn([a.good[1], a.good[2]], r); up += `<g transform="translate(${gx} ${gy})">${goodArt(a.good[0])}</g>`; }
  if (a.cathedral) { const [cx, cy] = turn(a.cathedral, r); up += cathedral(cx, cy); }
  if (a.spring) { const [mx, my] = turn([48, 40], r); up += hills(mx, my); }
  if (a.hamlet) { const [hx, hy] = turn(a.hamlet, r); up += house(hx, hy - 1, 1.1, C.roof[2]); }
  if (a.well) { const [wx, wy] = turn(a.well, r); up += `<g transform="translate(${wx} ${wy})"><circle r="4.5" fill="${C.wallTop}" stroke="${C.wallDark}" stroke-width="1"/><circle r="2.4" fill="${C.water}"/></g>`; }
  return layer === "top" ? up : `<g${rot(r)}>${g}</g>${up}`;
}
// shared definitions: the grass texture (put once in each <svg>'s <defs>)
export const DEFS = `<pattern id="grass" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="${C.grass}"/>
  <path d="M6,9 l1.5,-3 l1.5,3 M28,6 l1.5,-3 l1.5,3 M40,30 l1.5,-3 l1.5,3 M14,36 l1.5,-3 l1.5,3 M33,46 l1.5,-3 l1.5,3 M2,24 l1.5,-3 l1.5,3" stroke="${C.grass2}" stroke-width="1" fill="none"/>
  <circle cx="20" cy="18" r="5" fill="${C.grass3}" opacity=".35"/><circle cx="44" cy="10" r="4" fill="${C.grass2}" opacity=".25"/><circle cx="8" cy="44" r="6" fill="${C.grass3}" opacity=".25"/></pattern>`;
// a follower, centred at (0,0), about 16 units tall
export function meepleArt(color, ghost) {
  return `<g${ghost ? ' opacity=".55"' : ""}><ellipse cx="0" cy="8.5" rx="7" ry="2" fill="rgba(0,0,0,.25)"/><path d="M0,-9 a3.6,3.6 0 1 1 0.01,0 Z M-3,-4 C-8,-4 -10,0 -9,2 L-4,1.5 L-6,8 L-1.5,8 L0,4 L1.5,8 L6,8 L4,1.5 L9,2 C10,0 8,-4 3,-4 Z"
    fill="${color}" stroke="#1d1f23" stroke-width="1.3" stroke-linejoin="round"/></g>`;
}
