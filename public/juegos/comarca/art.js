// Comarca: the drawings. Each tile is drawn in a 100×100 box, unrotated; the board rotates it.
const FIELD = "#94c46c", FIELD2 = "#86b85f", CITY = "#e2c48f", CITY2 = "#d4b07a", WALL = "#8a5a2b", ROAD = "#f4ebd3", ROADE = "#b9a57a";

const CAP = { fill: "M0,0 H100 C78,30 22,30 0,0 Z", wall: ["M100,0 C78,30 22,30 0,0"] };
const SHAPES = {
  full: { fill: "M0,0 H100 V100 H0 Z", wall: [] },
  band: { fill: "M0,0 C30,28 70,28 100,0 V100 C70,72 30,72 0,100 Z", wall: ["M0,0 C30,28 70,28 100,0", "M0,100 C30,72 70,72 100,100"] },
  corner: { fill: "M0,0 H100 C60,25 25,60 0,100 Z", wall: ["M100,0 C60,25 25,60 0,100"] },
  three: { fill: "M0,0 H100 V100 C70,62 30,62 0,100 Z", wall: ["M100,100 C70,62 30,62 0,100"] },
};
const rot = (s) => (s ? ` transform="rotate(${s * 90} 50 50)"` : "");
// cities: [shape, rotation], shield position, houses
const CITIES = {
  C: [["full", 0]], D: [["cap", 0]], E: [["cap", 0]], F: [["band", 0]], G: [["band", 0]], H: [["cap", 1], ["cap", 3]], I: [["cap", 1], ["cap", 2]],
  J: [["cap", 0]], K: [["cap", 0]], L: [["cap", 0]], M: [["corner", 0]], N: [["corner", 0]], O: [["corner", 0]], P: [["corner", 0]],
  Q: [["three", 0]], R: [["three", 0]], S: [["three", 0]], T: [["three", 0]],
};
// note: a "band" turned once runs left to right
const SHIELD = { C: [30, 28], F: [24, 50], M: [16, 18], O: [16, 18], Q: [26, 22], S: [26, 22] };
const HOUSES = {
  C: [[56, 30], [40, 62], [66, 66], [24, 48]], D: [[38, 6], [58, 6]], E: [[38, 6], [58, 6]], F: [[44, 44], [62, 52], [80, 44]], G: [[34, 46], [56, 52], [74, 44]],
  H: [[90, 40], [4, 52]], I: [[90, 40], [44, 90]], J: [[38, 6], [58, 6]], K: [[38, 6], [58, 6]], L: [[38, 6], [58, 6]],
  M: [[40, 10], [12, 40], [30, 26]], N: [[40, 10], [12, 40], [30, 26]], O: [[40, 8], [10, 40]], P: [[40, 8], [10, 40]],
  Q: [[48, 34], [70, 20], [80, 50]], R: [[38, 30], [60, 36], [80, 50], [16, 52]], S: [[48, 40], [70, 22], [82, 56]], T: [[38, 34], [62, 40], [82, 56], [16, 56]],
};
const ROADS = {
  A: ["M50,100 V68"], D: ["M0,50 H100"], J: ["M100,50 C70,50 50,70 50,100"], K: ["M0,50 C30,50 50,70 50,100"],
  L: ["M100,50 H50", "M50,100 V50", "M0,50 H50"], O: ["M100,50 C76,54 54,76 50,100"], P: ["M100,50 C76,54 54,76 50,100"],
  S: ["M50,100 V74"], T: ["M50,100 V74"], U: ["M50,0 V100"], V: ["M0,50 C30,50 50,70 50,100"],
  W: ["M100,50 H50", "M0,50 H50", "M50,100 V50"], X: ["M50,0 V50", "M100,50 H50", "M50,100 V50", "M0,50 H50"],
};
const JUNCTION = { L: [50, 50], W: [50, 50], X: [50, 50] };

const house = ([x, y]) => `<g transform="translate(${x} ${y})"><rect x="0" y="4" width="9" height="7" fill="#f6ead2" stroke="${WALL}" stroke-width=".8"/><path d="M-1,4.5 L4.5,0 L10,4.5 Z" fill="#c4553a"/></g>`;

export function tileArt(k) {
  let s = `<rect width="100" height="100" fill="${FIELD}"/>`;
  // a little texture in the grass
  s += `<path d="M12,70 l2,-4 l2,4 M78,24 l2,-4 l2,4 M30,88 l2,-4 l2,4 M86,80 l2,-4 l2,4 M16,30 l2,-4 l2,4" stroke="${FIELD2}" stroke-width="1.3" fill="none"/>`;
  for (const r of ROADS[k] || []) s += `<path d="${r}" stroke="${ROADE}" stroke-width="12" fill="none" stroke-linecap="butt"/>`;
  for (const r of ROADS[k] || []) s += `<path d="${r}" stroke="${ROAD}" stroke-width="8" fill="none" stroke-linecap="butt"/>`;
  if (JUNCTION[k]) { const [x, y] = JUNCTION[k]; s += `<g transform="translate(${x - 7} ${y - 8})"><rect y="5" width="14" height="10" fill="#f6ead2" stroke="${WALL}" stroke-width="1"/><path d="M-1.5,5.5 L7,-1 L15.5,5.5 Z" fill="#c4553a"/></g>`; }
  for (const [shape, r] of CITIES[k] || []) {
    const sh = shape === "cap" ? CAP : SHAPES[shape];
    s += `<g${rot(r)}><path d="${sh.fill}" fill="${CITY}"/>${sh.wall.map((w) => `<path d="${w}" stroke="${WALL}" stroke-width="3.5" fill="none" stroke-dasharray="${shape === "full" ? "0" : "6 1.5"}"/>`).join("")}</g>`;
  }
  if (CITIES[k]) s += `<g opacity=".95">${(HOUSES[k] || []).map(house).join("")}</g>`;
  if (SHIELD[k]) { const [x, y] = SHIELD[k]; s += `<g transform="translate(${x} ${y})"><path d="M-7,-8 H7 V0 C7,6 0,9 0,9 C0,9 -7,6 -7,0 Z" fill="#2f5fb3" stroke="#fff" stroke-width="1.6"/><path d="M0,-5 V5 M-4,-1 H4" stroke="#ffd75e" stroke-width="1.8"/></g>`; }
  if (k === "A" || k === "B") {
    // the hermitage
    s += `<g transform="translate(50 ${k === "A" ? 44 : 48})"><rect x="-13" y="-6" width="26" height="20" rx="1" fill="#f3e7cc" stroke="#7a5a3a" stroke-width="1.4"/><path d="M-16,-5 L0,-18 L16,-5 Z" fill="#b5462f" stroke="#7a3322" stroke-width="1"/>
      <rect x="-3.5" y="5" width="7" height="9" rx="3.5" fill="#7a5a3a"/><path d="M0,-28 V-18 M-4,-24 H4" stroke="#7a5a3a" stroke-width="2"/></g>`;
  }
  return s;
}
// a follower, centred at (0,0), about 16 units tall
export function meepleArt(color, ghost) {
  return `<g${ghost ? ' opacity=".55"' : ""}><path d="M0,-9 a3.6,3.6 0 1 1 0.01,0 Z M-3,-4 C-8,-4 -10,0 -9,2 L-4,1.5 L-6,8 L-1.5,8 L0,4 L1.5,8 L6,8 L4,1.5 L9,2 C10,0 8,-4 3,-4 Z"
    fill="${color}" stroke="#1d1f23" stroke-width="1.3" stroke-linejoin="round"/></g>`;
}
