// Galaxia: drawings as SVG strings. Same palette as the mockup: amber for the interface, cyan for
// holograms and what is ready, red for what is missing, violet for what is rare.
import { MATS, SUPPLY } from "./game.js?v=1795734178";

export const AMBER = "#ff9f2e", CYAN = "#59d8ff", RED = "#ff4d5e", VIOLET = "#a879ff", INK = "#f1e9dc", DIM = "#9a8f80";
export const matColor = (k) => (MATS[k] || SUPPLY[k] || {}).color || INK;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const hash = (str) => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f)); return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""); };

// a vein: crystals (StarCraft style), crop rows for food, or blue ice
export function vein(v, left) {
  const R = rng(hash(v.id)), col = v.crop ? "#7fbf5a" : v.ice ? "#bfe8ff" : matColor(v.mat), dark = shade(col, 0.55);
  let s = `<ellipse cx="0" cy="10" rx="34" ry="13" fill="#000" opacity=".35"/>`;
  if (v.mat === "iridio" || v.mat === "plasma") s = `<circle r="38" fill="${col}" opacity=".18"/>` + s;
  if (v.crop) {
    for (let r = 0; r < 4; r++) s += `<path d="M-30 ${-14 + r * 9} q30 -5 60 0" stroke="${r % 2 ? "#5e9a43" : "#8fd06a"}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    return s;
  }
  const n = Math.max(3, Math.round(7 * Math.max(0.35, left)));
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ x: (R() - 0.5) * 44, y: (R() - 0.4) * 18, h: 14 + R() * 18, w: 5 + R() * 4, t: (R() - 0.5) * 0.7 });
  pts.sort((a, b) => a.y - b.y);
  for (const p of pts) {
    const tx = p.x + Math.sin(p.t) * p.h, ty = p.y - Math.cos(p.t) * p.h;
    s += `<path d="M${p.x - p.w} ${p.y} L${tx} ${ty} L${p.x + p.w} ${p.y} L${p.x} ${p.y + p.w * 0.6}Z" fill="${col}"/><path d="M${p.x} ${p.y + p.w * 0.6} L${tx} ${ty} L${p.x + p.w} ${p.y}Z" fill="${dark}"/><path d="M${p.x - p.w * 0.4} ${p.y - 2} L${tx - 1} ${ty + 4}" stroke="#fff" stroke-opacity=".5"/>`;
  }
  return s;
}
export function rock(x, y, size, seed) {
  const R = rng(seed); let pts = "";
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, k = 0.7 + R() * 0.4; pts += `${(x + Math.cos(a) * size * k).toFixed(1)},${(y + Math.sin(a) * size * 0.6 * k).toFixed(1)} `; }
  return `<polygon points="${pts}" fill="#000" opacity=".25" transform="translate(2 3)"/><polygon points="${pts}" fill="rgba(255,255,255,.07)"/>`;
}
// buildings, centred, about 56 wide
export function building(type) {
  switch (type) {
    case "cuartel": return `<path d="M0 -30 l30 17 v34 l-30 17 l-30 -17 v-34z" fill="#16130f" stroke="${AMBER}" stroke-width="2.5"/><path d="M0 -18 l20 11 v22 l-20 11 l-20 -11 v-22z" fill="none" stroke="${AMBER}" stroke-opacity=".4"/><path d="M-12 4 l24 -8 l-24 -8 l5 8z" fill="${CYAN}"/>`;
    case "paneles": return `<g transform="skewX(-12)"><rect x="-26" y="-18" width="52" height="34" fill="#14202a" stroke="${CYAN}" stroke-width="1.5"/><path d="M-26 -7H26M-26 5H26M-9 -18V16M8 -18V16" stroke="${CYAN}" stroke-opacity=".6"/></g>`;
    case "colector": return `<circle r="22" fill="#16130f" stroke="${CYAN}" stroke-width="1.5"/><circle r="12" fill="none" stroke="${CYAN}" stroke-dasharray="3 3"/><path d="M0 -30 V-8" stroke="${CYAN}" stroke-width="3"/><circle cy="-32" r="4" fill="${CYAN}"/>`;
    case "habitat": return `<circle r="24" fill="rgba(89,216,255,.12)" stroke="${CYAN}" stroke-width="1.5"/><circle r="12" fill="none" stroke="${CYAN}" stroke-opacity=".6"/><circle cx="-6" cy="-3" r="2.5" fill="${INK}"/><circle cx="7" cy="4" r="2.5" fill="${INK}"/>`;
    case "bodega": return `<rect x="-30" y="-20" width="60" height="40" fill="#16130f" stroke="${INK}" stroke-opacity=".7" stroke-width="1.5"/><rect x="-24" y="-14" width="14" height="12" fill="#6f7b8a"/><rect x="-8" y="-14" width="14" height="12" fill="#c9864f"/><rect x="-24" y="0" width="14" height="12" fill="#6f7b8a"/><rect x="8" y="-14" width="14" height="12" fill="#9fb8c8"/>`;
    case "fabrica": return `<rect x="-28" y="-16" width="56" height="34" fill="#1c1a16" stroke="${AMBER}" stroke-width="1.5"/><rect x="12" y="-30" width="9" height="16" fill="#1c1a16" stroke="${AMBER}"/><circle cx="-8" cy="1" r="9" fill="none" stroke="${AMBER}" stroke-width="2" stroke-dasharray="4 3"/>`;
    case "refugio": return `<path d="M-30 14 V-6 Q0 -26 30 -6 V14Z" fill="#1c1a16" stroke="${AMBER}" stroke-width="1.5"/><path d="M-22 10 l8 -12 M-8 10 l8 -12 M6 10 l8 -12" stroke="${AMBER}" stroke-opacity=".6" stroke-width="3"/>`;
    case "laboratorio": return `<path d="M-24 14 A24 24 0 0 1 24 14Z" fill="rgba(89,216,255,.1)" stroke="${CYAN}" stroke-width="1.5"/><ellipse cy="2" rx="30" ry="7" fill="none" stroke="${VIOLET}" stroke-width="1.5"/><circle cy="0" r="4" fill="${VIOLET}"/>`;
    case "reactor": return `<circle r="24" fill="rgba(255,159,46,.15)"/><circle r="16" fill="#1c1a16" stroke="${AMBER}" stroke-width="2"/><circle r="7" fill="${CYAN}"/>`;
  }
  return "";
}
// the label under a building
export const tag = (x, y, t, col = INK) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="8" font-family="Orbitron" font-weight="800" letter-spacing="1" fill="${col}">${t}</text>`;
// machines seen from above, pointing right
export function machine(type, loaded) {
  if (type === "cosechadora") return `<ellipse cy="6" rx="18" ry="6" fill="#000" opacity=".35"/><rect x="-14" y="-7" width="24" height="13" fill="#8fd06a" stroke="#1a2a10"/><rect x="10" y="-10" width="5" height="20" fill="#c9bfae"/>`;
  if (type === "robot") return `<ellipse cy="6" rx="12" ry="5" fill="#000" opacity=".35"/><rect x="-9" y="-8" width="18" height="16" rx="4" fill="${CYAN}"/><circle cx="3" cy="-1" r="3" fill="#07080c"/>`;
  const big = type === "pesada", k = big ? 1.3 : 1, c = big ? VIOLET : AMBER;
  return `<g transform="scale(${k})"><ellipse cy="6" rx="20" ry="7" fill="#000" opacity=".35"/><rect x="-14" y="-12" width="4" height="22" fill="#2a241c"/><rect x="2" y="-12" width="4" height="22" fill="#2a241c"/><rect x="-16" y="-8" width="26" height="14" rx="2" fill="${c}" stroke="#1a0f00"/><rect x="-6" y="-6" width="9" height="8" fill="${CYAN}" fill-opacity=".7"/><path d="M10 -2 L22 -8 L28 -2" stroke="#b86f1a" stroke-width="3" fill="none"/><path d="M26 -6 l6 4 l-4 6z" fill="#c9bfae"/>${loaded ? `<rect x="-14" y="-16" width="18" height="6" fill="#d9d4cc"/>` : ""}</g>`;
}
export const crewman = (x, y) => `<g transform="translate(${x} ${y})"><ellipse cy="4" rx="5" ry="2" fill="#000" opacity=".4"/><circle r="4.5" fill="${INK}"/><path d="M-2 -1 h4" stroke="${CYAN}" stroke-width="2.5"/></g>`;

// a dial: f from 0 to 1, the last part in red
export function gauge(val, label, f, danger) {
  const p = (a, r) => [40 + r * Math.cos(a), 42 + r * Math.sin(a)].map((n) => n.toFixed(1)).join(" ");
  let ticks = ""; for (let i = 0; i <= 10; i++) { const a = ((135 + 27 * i) * Math.PI) / 180; ticks += `<path d="M${p(a, 30)} L${p(a, 26)}" stroke="${DIM}" stroke-width="1.2"/>`; }
  const a = ((135 + 270 * Math.max(0, Math.min(1, f))) * Math.PI) / 180;
  return `<div class="slot gauge${danger ? " bad" : ""}"><svg width="80" height="66" viewBox="0 0 80 66" role="img" aria-label="${label} ${val}">${ticks}<path d="M70 42 A30 30 0 0 1 61.2 63.2" stroke="${RED}" stroke-width="4" fill="none"/><path d="M40 42 L${p(a, 24)}" stroke="${AMBER}" stroke-width="2.5"/><circle cx="40" cy="42" r="4" fill="${AMBER}"/></svg><b class="h ${danger ? "no" : "ok"}">${val}</b><span>${label}</span></div>`;
}
// a material as a gem
export const gem = (k, dim) => `<svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true"><path d="M14 2 L25 11 L14 26 L3 11Z" fill="${matColor(k)}" fill-opacity="${dim ? 0.3 : 1}"/><path d="M14 2 V26 M3 11 H25" stroke="#000" stroke-opacity=".35"/></svg>`;
export const person = (c) => `<svg width="28" height="28" aria-hidden="true"><circle cx="14" cy="9" r="6" fill="${c}"/><path d="M3 28 q11 -16 22 0z" fill="${c}"/></svg>`;
export function planetOrb(p, size = 72, ring = true) {
  const id = "o" + p.id + size;
  return `<svg width="${size}" height="${size}" viewBox="0 0 72 72" aria-hidden="true"><defs><radialGradient id="${id}" cx="35%" cy="30%"><stop offset="0" stop-color="${p.c1}"/><stop offset=".7" stop-color="${p.c2}"/><stop offset="1" stop-color="#07080c"/></radialGradient></defs><circle cx="36" cy="36" r="26" fill="url(#${id})"/>${ring && p.gas ? `<ellipse cx="36" cy="36" rx="35" ry="9" stroke="${AMBER}" stroke-opacity=".6" fill="none" transform="rotate(-18 36 36)"/>` : ""}</svg>`;
}
