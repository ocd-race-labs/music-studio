// Galaxia: the screens. Inventory, cockpit, holographic map, the base field (animated) and the factory,
// plus the sheets that open when you tap something on the field.
import * as G from "./game.js?v=1795731396";
import * as A from "./art.js?v=1795731396";
const $ = (q) => document.querySelector(q);
const KEY = "galaxia-v2";
let S, view = "cab", baseSel = null, sheetFn = null, mapSel = null;

/* ---------- saving ---------- */
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) return s; } } catch (e) {}
  return null;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
document.addEventListener("visibilitychange", () => { if (document.hidden) save(); else { const r = G.catchUp(S); if (r.dt > 60) welcome(r); render(true); } });

/* ---------- helpers ---------- */
const fmt = (n) => (n >= 10000 ? Math.round(n / 1000) + "k" : Math.floor(n).toLocaleString("es-CL"));
const rate = (n) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(1).replace(".", ",");
const seg = (n, on, col) => `<div class="seg" style="grid-template-columns:repeat(${n},minmax(0,1fr))">${Array.from({ length: n }, (_, i) => `<i style="${i < on ? "background:" + col : ""}"></i>`).join("")}</div>`;
const bar = (f, col) => `<div class="bar"><i style="width:${Math.max(0, Math.min(1, f)) * 100}%;background:${col};box-shadow:0 0 8px ${col}"></i></div>`;
const kv = (k, v, c = "") => `<div class="kv"><span>${k}</span><b class="${c}">${v}</b></div>`;
const matName = (k) => (G.MATS[k] || G.SUPPLY[k]).name;
const costTxt = (c) => Object.entries(c).map(([k, v]) => `${fmt(v)} ${matName(k).toLowerCase()}`).join(" · ") || "gratis";
let toastT;
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2800); }
const act = (r, ok) => { if (!r.ok) { toast(r.why); return false; } if (ok) toast(ok); save(); render(true); return true; };
function whereIs(k) {
  const list = G.PLANETS.filter((p) => G.visibleVeins(S, p.id).some((v) => v.mat === k)).map((p) => p.name);
  if (list.length) return list.join(", ");
  return k === "iridio" ? "bajo las vetas de Kalon (necesitas laboratorio)" : k === "plasma" ? "en Eco, tras la nebulosa" : "aún no lo encuentras";
}

/* ---------- header, mission and tabs ---------- */
const ICON = {
  inv: '<path d="M2 2h7v7H2zM11 2h7v7h-7zM2 11h7v7H2zM11 11h7v7h-7z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  cab: '<path d="M1 14 Q10 2 19 14 Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="12" r="2.5" fill="currentColor"/>',
  map: '<ellipse cx="10" cy="10" rx="9" ry="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="10" r="3" fill="currentColor"/>',
  base: '<path d="M10 1 L18 6 V14 L10 19 L2 14 V6Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 10h8" stroke="currentColor" stroke-width="1.8"/>',
  fab: '<circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3M3.5 3.5l2 2M14.5 14.5l2 2M3.5 16.5l2-2M14.5 5.5l2-2" stroke="currentColor" stroke-width="1.8"/>',
};
const TABS = [["inv", "Inventario"], ["cab", "Cabina"], ["map", "Mapa"], ["base", "Base"], ["fab", "Fabricar"]];
let chromeSig = "";
function chrome() {
  $("#st").innerHTML = `COMB <b>${fmt(S.inv.combustible)}</b> · TRIP <b>${S.crew}</b>`;
  const m = G.currentMission(S), n = m && m.n ? m.n(S) : null;
  const sig = (m ? m.id : "-") + (n ? n.join() : "") + view;
  if (sig === chromeSig) return; chromeSig = sig;
  if (m) {
    $("#mis").innerHTML = `<svg width="34" height="34" aria-hidden="true"><path d="M17 2 L31 10 V24 L17 32 L3 24 V10Z" fill="rgba(255,159,46,.15)" stroke="#ff9f2e" stroke-width="2"/><text x="17" y="21" text-anchor="middle" font-size="11" font-family="Orbitron" font-weight="900" fill="#ff9f2e">${G.MISSIONS.indexOf(m) + 1}</text></svg>
      <div style="flex:1;min-width:0"><div class="lbl">Misión · toca para una pista</div><div style="font-weight:700;font-size:14px">${m.t}</div>${n ? `<div style="display:flex;gap:8px;align-items:center;margin-top:6px">${seg(10, Math.floor((10 * n[0]) / n[1]), "#ff9f2e")}<b style="font-size:11px">${n[0]}/${n[1]}</b></div>` : ""}</div>`;
    $("#mis").onclick = () => toast(m.h);
  } else { $("#mis").innerHTML = `<div><div class="lbl">Expansión libre</div><div style="font-size:13px">Cumpliste todas las misiones. Sigue creciendo.</div></div>`; $("#mis").onclick = null; }
  $("#tabs").innerHTML = TABS.map(([k, t]) => `<button class="${view === k ? "on" : ""}" data-v="${k}"><svg width="20" height="20" aria-hidden="true">${ICON[k]}</svg>${t}</button>`).join("");
  $("#tabs").querySelectorAll("button").forEach((b) => (b.onclick = () => go(b.dataset.v)));
}
function go(v) { view = v; closeSheet(); fieldSig = ""; render(true); scrollTo(0, 0); }

/* ---------- views ---------- */
let lastHtml = "", binders = [];
function render(force) {
  chrome();
  if (view === "base") return baseView();
  const html = VIEWS[view]();
  if (force || html !== lastHtml) { $("#view").innerHTML = html; lastHtml = html; for (const f of binders) f(); }
}
const VIEWS = {};

// 1. inventory
VIEWS.inv = () => {
  binders = [];
  const inc = G.income(S), cap = G.capacity(S), st = G.stored(S), busy = G.crewBusy(S);
  const mats = Object.entries(G.MATS).map(([k, m]) => {
    const seen = (S.got[k] || 0) > 0 || S.inv[k] > 0, r = m.tier >= 2;
    return `<div class="slot${r ? " rareb" : ""}">${seen ? A.gem(k) : `<svg width="26" height="26" aria-hidden="true"><path d="M13 2 L24 10 L13 24 L2 10Z" fill="none" stroke="${r ? "#a879ff" : "#9a8f80"}" stroke-dasharray="3 3"/></svg>`}<b class="h ${r ? "rare" : ""}">${seen ? fmt(S.inv[k]) : "?"}</b><span>${seen ? m.name.toUpperCase() : "SIN DESCUBRIR"}</span><span style="color:${inc[k] > 0 ? "#59d8ff" : "#6e6458"}">${inc[k] > 0 ? rate(inc[k]) + "/min" : G.TIER[m.tier]}</span></div>`;
  }).join("");
  const machines = Object.entries(G.MACH).map(([k, m]) => `<div class="slot"><svg width="44" height="30" viewBox="-22 -15 44 30" aria-hidden="true">${A.machine(k)}</svg><b class="h">${G.machinesFree(S, k)}/${S.machines[k]}</b><span>${m.name.toUpperCase()}</span></div>`).join("");
  return `<div><div class="lbl">// Nave Áurea · bodega central</div><div class="h" style="font-weight:900;font-size:22px;margin-top:4px">Inventario</div></div>
  <div class="p" style="padding:14px;display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between"><span class="lbl">Bodegas</span><b class="h" style="font-size:12px">${fmt(st)} / ${fmt(cap)}</b></div>${bar(st / cap, st >= cap ? "#ff4d5e" : "#ff9f2e")}${st >= cap ? `<div class="no" style="font-size:12px">Bodegas llenas: las máquinas se detienen. Construye otra bodega o retira máquinas.</div>` : ""}</div>
  <div class="lbl">Materiales</div><div class="g4">${mats}</div>
  <div class="lbl">Tripulación</div>
  <div class="p" style="padding:14px;display:flex;gap:14px;align-items:center">${A.person("#f1e9dc")}<div style="flex:1;display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between"><b class="h" style="font-size:15px">${S.crew} tripulantes</b><span class="dim" style="font-size:12px">camas ${G.crewCap(S)}</span></div><div style="font-size:12px" class="dim">${busy} trabajando · ${S.crew - busy} libres · ${S.crew < G.crewCap(S) ? (S.inv.alimentos > 20 ? "la colonia crece" : "sin alimentos no crece") : "sin camas: construye un hábitat"}</div></div></div>
  <div class="lbl">Suministros</div>
  <div class="p" style="padding:14px;display:flex;flex-direction:column;gap:10px">
    ${[["alimentos", "#f1e9dc"], ["combustible", "#ff9f2e"]].map(([k, c]) => `<div style="display:flex;align-items:center;gap:10px"><span class="dim" style="width:96px;font-size:11px;letter-spacing:2px">${G.SUPPLY[k].name.toUpperCase()}</span>${seg(10, Math.round((10 * S.inv[k]) / G.supplyCap(S)), c)}<b class="h" style="font-size:11px;width:78px;text-align:right">${fmt(S.inv[k])} <span class="${inc[k] >= 0 ? "ok" : "no"}" style="font-size:9px">${rate(inc[k])}</span></b></div>`).join("")}
  </div>
  <div class="lbl">Máquinas · libres / total</div><div class="g4">${machines}</div>
  <div class="lbl">Objetos</div><div class="g2"><div class="slot"><b class="h">${S.items.modulo}</b><span>MÓDULOS DE BASE</span></div><div class="slot${S.items.pliegue2 ? " rareb" : ""}"><b class="h ${S.items.pliegue2 ? "rare" : ""}">${S.items.pliegue2 ? "INSTALADO" : "—"}</b><span>PLIEGUE II</span></div></div>`;
};

// 2. cockpit
const radF = { baja: 0.15, media: 0.45, alta: 0.86, extrema: 0.97 };
VIEWS.cab = () => {
  binders = [];
  const j = S.ship.jump, p = G.P[S.ship.at], b = S.bases[p.id];
  const veins = G.visibleVeins(S, p.id).filter((v) => !v.crop), crops = G.visibleVeins(S, p.id).some((v) => v.crop);
  binders.push(() => {
    const e = $("#est"); if (e) e.onclick = () => { if (act(G.establish(S), "La nave baja y se despliega: base en " + p.name)) { baseSel = p.id; go("base"); } };
    const d = $("#down"); if (d) d.onclick = () => { baseSel = p.id; go("base"); };
    $("#tomap").onclick = () => go("map");
  });
  const cf = G.crewFactor(S, p.id);
  return `<div class="cockpit"><svg viewBox="0 0 362 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><radialGradient id="pl" cx="40%" cy="15%"><stop offset="0" stop-color="${p.c1}"/><stop offset=".55" stop-color="${p.c2}"/><stop offset="1" stop-color="#05030a"/></radialGradient><linearGradient id="atm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.c1}" stop-opacity="0"/><stop offset="1" stop-color="${p.c1}" stop-opacity="${Math.min(0.4, 0.05 + p.atm * 0.05)}"/></linearGradient></defs>
    <g fill="#fff"><circle cx="40" cy="26" r="1"/><circle cx="120" cy="14" r="1.2"/><circle cx="300" cy="36" r="1"/><circle cx="250" cy="12" r=".8"/><circle cx="80" cy="60" r=".7"/><circle cx="200" cy="40" r=".7"/></g>
    <rect y="60" width="362" height="60" fill="url(#atm)"/><circle cx="181" cy="340" r="240" fill="url(#pl)"/>
    ${p.gas ? `<ellipse cx="181" cy="150" rx="250" ry="22" fill="none" stroke="${p.c1}" stroke-opacity=".5" stroke-width="3"/>` : ""}
    <g stroke="#59d8ff" fill="none" stroke-width="1.4"><circle cx="181" cy="140" r="20" stroke-dasharray="3 4"/><path d="M181 112 v10 M181 158 v10 M153 140 h10 M199 140 h10"/></g>
    <path d="M0 0 L40 200 M362 0 L322 200" stroke="#ff9f2e" stroke-opacity=".5" stroke-width="3"/></svg>
    <div class="hud" style="left:30px;top:12px">${j ? "EN SALTO" : "ÓRBITA 420 KM"}<br>${p.name.toUpperCase()} · ${p.kind.toUpperCase()}</div>
    <div class="hud" style="right:30px;top:12px;text-align:right">ESCANEO 100 %<br>DÍA ${p.day} H</div></div>
  <div class="g4">${A.gauge(String(p.grav).replace(".", ",") + " G", "GRAVEDAD", p.grav / 2)}${A.gauge((p.atm >= 1 ? Math.round(p.atm) : String(p.atm).replace(".", ",")) + " ATM", "ATMÓSFERA", Math.min(1, p.atm / 3))}${A.gauge(p.rad.toUpperCase(), "RADIACIÓN", radF[p.rad], p.rad === "alta" || p.rad === "extrema")}${A.gauge(p.temp + " °C", "TEMP.", (p.temp + 200) / 300, p.temp < -100 || p.temp > 50)}</div>
  <div class="p" style="padding:12px 14px;display:flex;gap:12px;align-items:center"><div style="flex:1;display:flex;flex-direction:column;gap:8px">
    ${[["OXÍGENO EXT.", p.o2 ? 6 : 0, "#59d8ff", p.o2 ? "21 %" : "0 %"], ["RADIACTIVIDAD", Math.round(p.radio * 8), "#ff9f2e", Math.round(p.radio * 100) + " %"], ["TORMENTAS", Math.round(p.storm * 8), "#ff9f2e", Math.round(p.storm * 100) + " %"], ["LUZ SOLAR", Math.round(p.luz * 8), "#59d8ff", Math.round(p.luz * 100) + " %"]].map(([t, on, c, v]) => `<div style="display:flex;align-items:center;gap:8px"><span class="dim" style="width:86px;font-size:10px;letter-spacing:1px">${t}</span>${seg(8, on, c)}<b style="font-size:10px;width:34px;text-align:right">${v}</b></div>`).join("")}
    </div><div style="display:flex;flex-direction:column;gap:8px">${[[26, 9], [9, 13]].map(([x, y]) => `<svg width="36" height="36" aria-hidden="true"><circle cx="18" cy="18" r="15" fill="#15171c" stroke="#3a3328" stroke-width="2"/><circle cx="18" cy="18" r="10" fill="#1e1a14"/><line x1="18" y1="18" x2="${x}" y2="${y}" stroke="#ff9f2e" stroke-width="3"/></svg>`).join("")}</div></div>
  <div class="g2">
    <div class="p" style="padding:12px;display:flex;flex-direction:column;gap:4px"><div class="lbl">Tripulación afuera</div><div style="font-size:13px">Turno máx. <b class="h" style="font-size:13px">${G.shiftHours(S, p.id)} H</b></div><div style="font-size:13px">Rinde <b class="h ${cf < 0.8 ? "no" : "ok"}" style="font-size:13px">${Math.round(cf * 100)} %</b></div><div class="dim" style="font-size:10px">${[p.rad !== "baja" ? "radiación " + p.rad : "", p.o2 ? "aire respirable" : "sin oxígeno"].filter(Boolean).join(" · ")}</div></div>
    <div class="p" style="padding:12px;display:flex;flex-direction:column;gap:4px"><div class="lbl">Bajo la superficie</div>${veins.map((v) => `<div style="font-size:13px">${matName(v.mat)} <b class="${G.MATS[v.mat] && G.MATS[v.mat].tier >= 2 ? "rare" : "ok"}">${v.purity > 0.7 ? "alto" : v.purity > 0.5 ? "medio" : "bajo"}</b></div>`).join("")}${crops ? `<div style="font-size:13px">Suelo <b class="ok">fértil</b></div>` : ""}${p.veins.some((v) => v.deep) && !G.anyBuilt(S, "laboratorio") ? `<div class="rare" style="font-size:11px">Ecos profundos sin identificar</div>` : ""}</div>
  </div>
  ${j ? `<button class="btn" disabled>Saltando a ${G.P[j.to].name}</button>` : b ? `<button class="btn" id="down">Bajar a la base</button>` : `<button class="btn" id="est" ${S.items.modulo ? "" : "disabled"}>${S.items.modulo ? "Establecer base aquí" : "Establecer base · falta un módulo"}</button>`}
  <button class="btn2" id="tomap">Fijar coordenadas de salto</button>`;
};

// 3. holographic map
const mx = (p) => 30 + p.x * 3.02, my = (p) => 70 + p.y * 1.7;
VIEWS.map = () => {
  binders = [];
  const at = G.P[S.ship.at], sel = G.P[mapSel] || null;
  binders.push(() => {
    document.querySelectorAll("[data-pl]").forEach((e) => (e.onclick = () => { mapSel = e.dataset.pl; render(true); }));
    const j = $("#jump"); if (j) j.onclick = () => { if (act(G.jump(S, sel.id))) warp(sel); };
    $("#list").onclick = () => openSheet(sysSheet);
  });
  let planets = "";
  for (const p of G.PLANETS) {
    const x = mx(p), y = my(p), here = p.id === S.ship.at, base = !!S.bases[p.id], reach = G.inRange(S, p.id) || here;
    planets += `<g data-pl="${p.id}" style="cursor:pointer"><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 40}" stroke="#59d8ff" stroke-opacity=".35"/><ellipse cx="${x}" cy="${y + 40}" rx="6" ry="2" fill="#59d8ff" opacity=".4"/>
      <circle cx="${x}" cy="${y}" r="24" fill="transparent"/><circle cx="${x}" cy="${y}" r="${p.gas ? 9 : 7}" fill="${reach ? "#59d8ff" : "#a879ff"}" fill-opacity="${reach ? 0.85 : 0.5}" ${reach ? "" : 'stroke="#a879ff" stroke-dasharray="2 2"'}/>
      ${base ? `<path d="M${x - 5} ${y - 14} l5 -4 l5 4" stroke="#ff9f2e" stroke-width="2" fill="none"/>` : ""}
      <text x="${x}" y="${y + 24}" text-anchor="middle" font-size="10" font-family="Chakra Petch" letter-spacing="1" fill="${reach ? "#bfefff" : "#a879ff"}">${p.name.toUpperCase()}${here ? " · AQUÍ" : ""}</text>
      ${mapSel === p.id ? `<circle cx="${x}" cy="${y}" r="17" stroke="#ff9f2e" stroke-width="2" fill="none"/><path d="M${x} ${y - 25} v7 M${x} ${y + 18} v7 M${x - 25} ${y} h7 M${x + 18} ${y} h7" stroke="#ff9f2e" stroke-width="2"/>` : ""}</g>`;
  }
  const route = sel && sel.id !== at.id ? `<path d="M${mx(at)} ${my(at)} Q${(mx(at) + mx(sel)) / 2} ${Math.min(my(at), my(sel)) - 40} ${mx(sel)} ${my(sel)}" stroke="#ff9f2e" stroke-width="2" stroke-dasharray="6 5" fill="none"/>` : "";
  let card = `<div class="p dim" style="padding:14px;font-size:13px">Toca un planeta del holograma para ver su ficha.</div>`;
  if (sel) {
    const here = sel.id === at.id, reach = G.inRange(S, sel.id), cost = G.jumpCost(S, sel.id), hot = sel.rad === "alta" || sel.rad === "extrema";
    const mats = [...new Set(G.visibleVeins(S, sel.id).map((v) => (v.crop ? "alimentos" : v.mat)))];
    card = `<div class="p" style="padding:14px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="h" style="font-weight:900;font-size:18px">${sel.name}</span><span class="lbl">${here ? "Aquí" : S.bases[sel.id] ? "Base activa" : sel.kind}</span></div>
      <div style="font-size:13px;color:#d9cfc0">${sel.desc}</div>
      <div class="g4"><div class="slot"><b class="h ok">${String(sel.grav).replace(".", ",")} G</b><span>GRAVEDAD</span></div><div class="slot ${hot ? "bad" : ""}"><b class="h ${hot ? "no" : "ok"}">${sel.rad.toUpperCase()}</b><span>RADIACIÓN</span></div><div class="slot"><b class="h ok">${sel.o2 ? "SÍ" : "NO"}</b><span>OXÍGENO</span></div><div class="slot"><b class="h ok">${Math.round(sel.luz * 100)} %</b><span>LUZ</span></div></div>
      <div>${mats.map((k) => `<span class="chip" style="${G.MATS[k] && G.MATS[k].tier >= 2 ? "color:#a879ff;box-shadow:inset 0 0 0 1px rgba(168,121,255,.7)" : ""}">${matName(k).toUpperCase()}</span>`).join("")}</div>
      ${here ? "" : kv("Costo del salto", cost + " combustible", S.inv.combustible >= cost ? "" : "no") + kv("Alcance", reach ? "dentro del alcance" : "necesita pliegue II", reach ? "ok" : "rare")}
    </div>${here ? "" : `<button class="btn" id="jump" ${reach && S.inv.combustible >= cost && !S.ship.jump ? "" : "disabled"}>Fijar coordenadas y saltar</button>`}`;
  }
  return `<div style="position:relative;background:radial-gradient(ellipse at 50% 85%,rgba(89,216,255,.2),transparent 65%)">
    <svg viewBox="0 0 362 300" width="100%" role="img" aria-label="Mapa holográfico">
      <g stroke="#59d8ff" fill="none" opacity=".25"><ellipse cx="181" cy="190" rx="165" ry="62"/><ellipse cx="181" cy="190" rx="112" ry="42"/><ellipse cx="181" cy="190" rx="60" ry="22"/><line x1="16" y1="190" x2="346" y2="190"/><line x1="181" y1="128" x2="181" y2="252"/></g>
      <ellipse cx="300" cy="80" rx="60" ry="30" fill="#a879ff" opacity=".08"/>
      ${route}${planets}
      <path d="M126 270 H236 L256 298 H106Z" fill="#14120e" stroke="#ff9f2e" stroke-opacity=".6"/><ellipse cx="181" cy="270" rx="55" ry="7" fill="#59d8ff" opacity=".4"/>
    </svg>
    <div class="lbl" style="position:absolute;left:0;top:0">Proyección · sector 7</div>
    <div style="position:absolute;right:0;top:0;font-size:10px;letter-spacing:2px" class="ok">${S.items.pliegue2 ? "PLIEGUE II" : "PLIEGUE I"}</div></div>
  ${card}<button class="btn2" id="list">Ver lista de sistemas</button>`;
};
function sysSheet() {
  return { title: "Sistemas conocidos", kind: "Registro", body: G.PLANETS.map((p) => `<button class="p opt" data-go="${p.id}">${A.planetOrb(p, 54)}<div style="flex:1"><div style="display:flex;justify-content:space-between;gap:8px"><b class="h" style="font-size:13px">${p.name}</b><span style="font-size:10px;letter-spacing:2px" class="${S.bases[p.id] ? "ok" : G.inRange(S, p.id) ? "" : "rare"}">${S.bases[p.id] ? "● BASE" : p.id === S.ship.at ? "AQUÍ" : G.inRange(S, p.id) ? G.jumpCost(S, p.id) + " COMB" : "FUERA DE ALCANCE"}</span></div><div class="dim" style="font-size:12px">${p.kind} · radiación ${p.rad}</div></div></button>`).join(""),
    bind: (el) => el.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { mapSel = b.dataset.go; closeSheet(); go("map"); })) };
}
function warp(p) {
  $("#warpt").textContent = "Rumbo a " + p.name; $("#warp").classList.add("on");
  const t = setInterval(() => { if (!S.ship.jump) { clearInterval(t); $("#warp").classList.remove("on"); mapSel = null; go("cab"); toast("Llegaste a " + p.name); } }, 200);
}

// 4. base: the field, drawn once per change and animated every frame
const SLOTXY = [[180, 300], [72, 262], [288, 262], [58, 362], [302, 362], [128, 418], [232, 418], [180, 212]];
let fieldSig = "", animIds = [];
function baseView() {
  const ids = Object.keys(S.bases);
  if (!ids.length) {
    if (fieldSig === "none") return; fieldSig = "none";
    $("#view").innerHTML = `<div class="p" style="padding:16px;display:flex;flex-direction:column;gap:12px"><div class="h" style="font-size:16px;font-weight:900">Sin base todavía</div><div class="dim" style="font-size:13px">Desde la cabina, sobre un planeta, toca «Establecer base». La nave baja, se despliega y se convierte en tu cuartel.</div><button class="btn" id="tocab">Ir a la cabina</button></div>`;
    $("#tocab").onclick = () => go("cab"); return;
  }
  if (!S.bases[baseSel]) baseSel = S.bases[S.ship.at] ? S.ship.at : ids[0];
  const pid = baseSel, p = G.P[pid], b = S.bases[pid], e = G.energy(S, pid), cf = G.crewFactor(S, pid);
  const sig = pid + "|" + JSON.stringify(b.buildings.map((x) => [x.type, x.slot, x.done >= 1])) + JSON.stringify(b.jobs) + G.visibleVeins(S, pid).length + ids.join();
  const hud = `<div style="display:flex;gap:8px;align-items:center"><div style="flex:1"><div class="lbl">// ${p.name} · base</div><div class="h" style="font-weight:900;font-size:18px;margin-top:2px">Operación minera</div></div>
    <div style="text-align:right;font-size:10px;letter-spacing:2px;line-height:1.7"><span class="${cf < 0.8 ? "no" : "ok"}">TURNO ${G.shiftHours(S, pid)} H · RINDE ${Math.round(cf * 100)} %</span><br><span class="${e.f < 1 ? "no" : "dim"}">ENERGÍA ${rate(e.prod - e.cons)}</span> · <span class="${G.stored(S) >= G.capacity(S) ? "no" : "dim"}">BODEGA ${Math.round((100 * G.stored(S)) / G.capacity(S))} %</span></div></div>`;
  if (sig !== fieldSig || !$("#field")) {
    fieldSig = sig;
    $("#view").innerHTML = (ids.length > 1 ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${ids.map((id) => `<button class="${id === pid ? "btn" : "btn2"}" style="width:auto;padding:8px 16px;font-size:10px" data-b="${id}">${G.P[id].name}</button>`).join("")}</div>` : "") + `<div id="bhud">${hud}</div><div class="field" id="field">${fieldSVG(pid)}</div><div class="dim" style="font-size:12px;text-align:center">Toca una veta, una máquina, un edificio o un terreno libre (+)</div>`;
    document.querySelectorAll("[data-b]").forEach((x) => (x.onclick = () => { baseSel = x.dataset.b; fieldSig = ""; render(); }));
    $("#field").addEventListener("click", fieldTap);
  } else $("#bhud").innerHTML = hud;
  for (const x of b.buildings) { const r = document.getElementById("pr" + x.slot); if (r) r.setAttribute("stroke-dasharray", `${x.done * 113} 200`); }
  for (const v of G.visibleVeins(S, pid)) { const r = document.getElementById("vl" + v.id); if (r) r.setAttribute("width", Math.max(0, (36 * b.veins[v.id]) / v.size)); }
}
function depot(b) { const bod = b.buildings.find((x) => x.type === "bodega" && x.done >= 1); return SLOTXY[(bod || b.buildings[0]).slot]; }
function fieldSVG(pid) {
  const p = G.P[pid], b = S.bases[pid];
  let seed = [...pid].reduce((a, c) => a + c.charCodeAt(0), 0); const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  let rocks = ""; for (let i = 0; i < 9; i++) rocks += A.rock(20 + r() * 320, 40 + r() * 400, 6 + r() * 9, i + 3);
  const dep = depot(b);
  let roads = "", veins = "", jobs = "", crew = "", blds = "", power = "";
  animIds = [];
  for (const v of G.visibleVeins(S, pid)) {
    const worked = b.jobs.filter((j) => j.vein === v.id);
    const road = `M${v.x} ${v.y + 10} Q${(v.x + dep[0]) / 2 + 30} ${(v.y + dep[1]) / 2} ${dep[0]} ${dep[1] - 10}`;
    if (worked.length && !v.crop) roads += `<path d="${road}" stroke="#1f140e" stroke-opacity=".7" stroke-width="16" fill="none" stroke-linecap="round"/><path d="${road}" stroke="#ff9f2e" stroke-opacity=".7" stroke-width="2" stroke-dasharray="6 6" fill="none"/>`;
    veins += `<g data-t="vein" data-id="${v.id}" transform="translate(${v.x} ${v.y})"><circle r="38" fill="transparent"/>${A.vein(v, b.veins[v.id] / v.size)}${v.crop ? "" : `<rect x="-18" y="22" width="36" height="3" fill="#1e1a14"/><rect id="vl${v.id}" x="-18" y="22" width="${(36 * b.veins[v.id]) / v.size}" height="3" fill="${A.matColor(v.mat)}"/>`}${A.tag(0, 36, v.crop ? "CULTIVO" : matName(v.mat).toUpperCase(), v.deep ? "#a879ff" : "#f1e9dc")}</g>`;
    worked.forEach((j, i) => {
      jobs += `<g data-t="job" data-id="${j.id}" id="m${j.id}" transform="translate(${v.x} ${v.y})">${A.machine(j.type, false)}</g>`;
      animIds.push({ id: j.id, v, i, type: j.type });
      if (G.MACH[j.type].crew) crew += A.crewman(v.x - 24 + i * 12, v.y + 16) + A.crewman(v.x - 16 + i * 12, v.y + 22);
    });
  }
  for (let i = 0; i < G.SLOTS; i++) {
    const [x, y] = SLOTXY[i], bl = b.buildings.find((q) => q.slot === i);
    if (!bl) { blds += `<g data-t="slot" data-id="${i}" transform="translate(${x} ${y})"><path d="M0 -20 l22 12 v20 l-22 12 l-22 -12 v-20z" fill="rgba(255,159,46,.05)" stroke="#ff9f2e" stroke-opacity=".5" stroke-dasharray="4 4"/><text y="7" text-anchor="middle" font-size="20" fill="#ff9f2e" opacity=".75">+</text></g>`; continue; }
    if (["paneles", "colector", "reactor"].includes(bl.type) && bl.done >= 1) power += `<path d="M${x} ${y} L${SLOTXY[0][0]} ${SLOTXY[0][1]}" stroke="#59d8ff" stroke-opacity=".5" stroke-width="1.5"/>`;
    blds += `<g data-t="bld" data-id="${i}" transform="translate(${x} ${y})" opacity="${bl.done >= 1 ? 1 : 0.55}"><circle r="32" fill="transparent"/>${A.building(bl.type)}${bl.done < 1 ? `<circle r="18" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="4"/><circle id="pr${i}" r="18" fill="none" stroke="#ff9f2e" stroke-width="4" stroke-dasharray="${bl.done * 113} 200" transform="rotate(-90)"/>` : ""}</g>${A.tag(x, y + 42, G.BUILD[bl.type].name.toUpperCase())}`;
  }
  return `<svg viewBox="0 0 360 470" role="img" aria-label="Base en ${p.name}">
    <defs><pattern id="gr" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" stroke="#ff9f2e" stroke-opacity=".06" fill="none"/></pattern>
    <radialGradient id="fog" cx="50%" cy="50%" r="72%"><stop offset=".6" stop-color="#07080c" stop-opacity="0"/><stop offset="1" stop-color="#07080c" stop-opacity=".95"/></radialGradient>
    <pattern id="rad" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V10" stroke="#ff4d5e" stroke-opacity=".14" stroke-width="3"/></pattern></defs>
    <rect width="360" height="470" fill="${p.ground}"/><rect width="360" height="470" fill="url(#gr)"/>
    ${p.rad === "alta" || p.rad === "extrema" ? `<rect width="360" height="470" fill="url(#rad)"/>` : ""}
    <path d="M0 0 H360 V34 Q300 56 250 40 Q200 26 160 46 Q110 60 70 40 Q30 24 0 44Z" fill="#000" opacity=".35"/>
    ${rocks}${roads}${power}${veins}${blds}${crew}${jobs}
    <rect width="360" height="470" fill="url(#fog)" pointer-events="none"/>
  </svg>`;
}
// machines go to the vein, dig, and come back loaded to the store (only for the eye)
function animate() {
  if (view === "base" && baseSel && S.bases[baseSel]) {
    const b = S.bases[baseSel], dep = depot(b), now = performance.now() / 1000;
    for (const a of animIds) {
      const el = document.getElementById("m" + a.id); if (!el) continue;
      const j = b.jobs.find((q) => q.id === a.id), working = j && G.jobRate(S, baseSel, j) > 0;
      const ph = ((now + a.id * 3.7) % 16) / 16;
      const vx = a.v.x + 28 + a.i * 6, vy = a.v.y + 14 + a.i * 9, dx = dep[0] + 20, dy = dep[1] - 14;
      let x, y, ang, load = false;
      if (!working || a.type === "cosechadora") { const w = working ? Math.sin(now * 0.8 + a.id) * 18 : 0; x = a.v.x + w; y = a.v.y + 4 + a.i * 10; ang = working && Math.cos(now * 0.8 + a.id) < 0 ? 180 : 0; }
      else if (ph < 0.3) { const k = ph / 0.3; x = dx + (vx - dx) * k; y = dy + (vy - dy) * k; ang = Math.atan2(vy - dy, vx - dx) * 57.3; }
      else if (ph < 0.6) { x = vx + Math.sin(now * 8) * 1.5; y = vy; ang = 200; }
      else if (ph < 0.92) { const k = (ph - 0.6) / 0.32; x = vx + (dx - vx) * k; y = vy + (dy - vy) * k; ang = Math.atan2(dy - vy, dx - vx) * 57.3; load = true; }
      else { x = dx; y = dy; ang = 0; }
      el.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(0)})`);
      if (el.dataset.load !== String(load)) { el.dataset.load = String(load); el.innerHTML = A.machine(a.type, load); }
    }
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
function fieldTap(ev) {
  const g = ev.target.closest("[data-t]"); if (!g) return;
  const t = g.dataset.t, id = g.dataset.id, pid = baseSel;
  if (t === "vein") openSheet(() => veinSheet(pid, id), true);
  if (t === "job") openSheet(() => jobSheet(pid, +id), true);
  if (t === "slot") openSheet(() => buildSheet(pid, +id));
  if (t === "bld") openSheet(() => bldSheet(pid, +id), true);
}

/* ---------- sheets ---------- */
let sheetSig = "";
function openSheet(fn, live) {
  sheetFn = fn; sheetFn.live = !!live;
  const d = fn(); if (!d) return closeSheet();
  sheetSig = d.title + d.body;
  $("#sheet").innerHTML = `<div class="p"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div><div class="lbl" style="color:#59d8ff">// ${d.kind}</div><div class="h" style="font-weight:900;font-size:17px;margin-top:2px">${d.title}</div></div><button class="x" aria-label="Cerrar">×</button></div>${d.body}</div>`;
  $("#sheet").classList.add("on"); $("#veil").classList.add("on");
  $("#sheet .x").onclick = closeSheet;
  if (d.bind) d.bind($("#sheet"));
}
function closeSheet() { sheetFn = null; $("#sheet").classList.remove("on"); $("#veil").classList.remove("on"); }
$("#veil").onclick = closeSheet;
function refreshSheet() {
  if (!sheetFn || !sheetFn.live) return;
  const d = sheetFn(); if (!d) return closeSheet();
  if (d.title + d.body === sheetSig) return;
  const sc = $("#sheet>.p").scrollTop; openSheet(sheetFn, true); $("#sheet>.p").scrollTop = sc;
}
function veinSheet(pid, id) {
  const v = G.P[pid].veins.find((x) => x.id === id), b = S.bases[pid]; if (!b) return null;
  const jobs = b.jobs.filter((j) => j.vein === id), tier = G.MATS[v.mat] ? G.MATS[v.mat].tier : 0;
  const types = Object.keys(G.MACH).filter((t) => G.canWork(t, v));
  const total = jobs.reduce((a, j) => a + G.jobRate(S, pid, j), 0), left = b.veins[id];
  return { kind: v.crop ? "Suelo fértil" : "Fuente de mineral", title: v.crop ? "Cultivo" : "Veta de " + matName(v.mat).toLowerCase() + (v.deep ? " · profunda" : ""),
    body: (v.crop ? kv("Produce", "alimentos", "ok") : `<div style="display:flex;justify-content:space-between;font-size:12px"><span class="dim">Reserva</span><b>${fmt(left)} / ${fmt(v.size)}</b></div>${bar(left / v.size, A.matColor(v.mat))}` + kv("Rareza", G.TIER[tier], tier >= 2 ? "rare" : "")) +
      kv("Pureza", Math.round(v.purity * 100) + " %") + kv("Extrayendo", jobs.length ? `${jobs.length} máquina${jobs.length > 1 ? "s" : ""} · ${rate(total)}/min` : "nadie", jobs.length ? "ok" : "") +
      (!v.crop && total > 0 ? kv("Se agota en", "~" + Math.max(1, Math.round(left / total)) + " min (se repone lento)") : "") +
      (G.P[pid].veins.some((x) => x.deep) && !G.anyBuilt(S, "laboratorio") && !v.deep ? `<div class="rare" style="font-size:12px">Hay ecos de algo más profundo en este planeta. Un laboratorio podría identificarlo.</div>` : "") +
      `<div class="lbl">Poner a trabajar</div><div class="g2">${types.map((t) => { const free = G.machinesFree(S, t); return `<button class="${free ? "btn" : "btn2"}" data-as="${t}" ${free ? "" : "disabled"} style="font-size:10px;padding:12px 6px">${G.MACH[t].name} · ${free} libre${free === 1 ? "" : "s"}</button>`; }).join("")}</div>` +
      (jobs.length ? `<button class="btn2" data-un="${jobs[jobs.length - 1].id}">Retirar una máquina</button>` : ""),
    bind: (el) => {
      el.querySelectorAll("[data-as]").forEach((x) => (x.onclick = () => { if (act(G.assign(S, pid, x.dataset.as, id), G.MACH[x.dataset.as].name + " a trabajar")) refreshSheet(); }));
      const u = el.querySelector("[data-un]"); if (u) u.onclick = () => { act(G.unassign(S, pid, +u.dataset.un), "Máquina retirada"); refreshSheet(); };
    } };
}
function jobSheet(pid, id) {
  const b = S.bases[pid], j = b && b.jobs.find((x) => x.id === id); if (!j) return null;
  const v = G.P[pid].veins.find((x) => x.id === j.vein), m = G.MACH[j.type], r = G.jobRate(S, pid, j), e = G.energy(S, pid), cf = G.crewFactor(S, pid);
  const why = r === 0 ? (b.veins[v.id] <= 0 ? "veta agotada" : "bodegas llenas") : [m.crew && cf < 1 ? "tripulación al " + Math.round(cf * 100) + " %" : "", e.f < 1 ? "energía al " + Math.round(e.f * 100) + " %" : ""].filter(Boolean).join(" · ") || "a pleno";
  return { kind: "Máquina", title: m.name + " " + String(id).padStart(2, "0"),
    body: kv("Trabaja en", v.crop ? "cultivo" : "veta de " + matName(v.mat).toLowerCase()) + kv("Rinde", rate(r) + " " + (v.crop ? "alimentos" : matName(v.mat).toLowerCase()) + "/min", r ? "ok" : "no") + kv("Estado", why, why === "a pleno" ? "ok" : "no") +
      kv("Operadores", m.crew ? m.crew + " tripulantes" : "ninguno (autónomo)") + kv("Energía", m.ene + "/min") + `<button class="btn2" id="unj">Retirar de la veta</button>`,
    bind: (el) => { el.querySelector("#unj").onclick = () => { act(G.unassign(S, pid, id), "Máquina retirada"); closeSheet(); }; } };
}
function buildSheet(pid, slot) {
  const b = S.bases[pid]; if (!b || b.buildings.some((x) => x.slot === slot)) return null;
  const types = Object.entries(G.BUILD).filter(([k, d]) => k !== "cuartel" && (!d.gas || G.P[pid].gas));
  return { kind: "Terreno libre", title: "¿Qué construir aquí?", body: types.map(([k, d]) => { const ok = G.has(S, d.cost), lock = d.needs === "lab" && !G.missionDone(S, "m7"); return `<button class="p opt" data-bk="${k}" ${ok && !lock ? "" : "disabled"}><svg width="56" height="50" viewBox="-32 -30 64 56" aria-hidden="true">${A.building(k)}</svg><div style="flex:1"><b class="h" style="font-size:12px">${d.name}</b><div class="dim" style="font-size:12px">${d.note}</div><div style="font-size:11px" class="${ok && !lock ? "ok" : "no"}">${lock ? "Se abre al reunir hierro, cobre, silicio y titanio" : costTxt(d.cost) + " · " + d.time + " s"}</div></div></button>`; }).join(""),
    bind: (el) => el.querySelectorAll("[data-bk]").forEach((x) => (x.onclick = () => { if (act(G.build(S, pid, x.dataset.bk, slot), "Construyendo: " + G.BUILD[x.dataset.bk].name.toLowerCase())) closeSheet(); })) };
}
function bldSheet(pid, slot) {
  const b = S.bases[pid], bl = b && b.buildings.find((x) => x.slot === slot); if (!bl) return null;
  const d = G.BUILD[bl.type], e = G.energy(S, pid), inc = G.income(S);
  let body = bl.done < 1 ? `<div style="display:flex;justify-content:space-between;font-size:12px"><span class="dim">Construyendo</span><b>${Math.floor(bl.done * 100)} %</b></div>${bar(bl.done, "#ff9f2e")}` : `<div class="dim" style="font-size:13px">${d.note}</div>`;
  if (bl.type === "bodega" || bl.type === "cuartel") {
    const st = G.stored(S), cap = G.capacity(S), parts = Object.keys(G.MATS).filter((k) => S.inv[k] >= 1);
    const net = Object.keys(G.MATS).reduce((a, k) => a + Math.max(0, inc[k]), 0);
    body += `<div class="lbl">Bodegas de todas tus bases</div><div style="display:flex;height:14px;background:#1e1a14">${parts.map((k) => `<div style="width:${(100 * S.inv[k]) / cap}%;background:${A.matColor(k)}"></div>`).join("")}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11px" class="dim">${parts.map((k) => `<span><b style="color:${A.matColor(k)}">■</b> ${G.MATS[k].name} ${fmt(S.inv[k])}</span>`).join("")}</div>` +
      kv("Ocupación", fmt(st) + " / " + fmt(cap), st >= cap ? "no" : "") + kv("Entra", Object.keys(G.MATS).filter((k) => inc[k] > 0).map((k) => rate(inc[k]) + " " + G.MATS[k].name.toLowerCase()).join(" · ") || "nada", "ok") + kv("Se llena en", st >= cap ? "llena" : net > 0 ? "~" + Math.ceil((cap - st) / net) + " min" : "—", st >= cap ? "no" : "");
  }
  if (["paneles", "colector", "reactor", "cuartel"].includes(bl.type)) {
    const items = [["Máquinas", b.jobs.reduce((a, j) => a + G.MACH[j.type].ene, 0)], ["Hábitat", G.built(b, "habitat")], ["Laboratorio", G.built(b, "laboratorio")]].filter((x) => x[1] > 0);
    body += `<div class="lbl">Energía de esta base</div><div class="g2"><div class="slot"><b class="h ok" style="font-size:17px">${rate(e.prod)}</b><span>PRODUCE /MIN</span></div><div class="slot ${e.f < 1 ? "bad" : ""}"><b class="h ${e.f < 1 ? "no" : ""}" style="font-size:17px">−${e.cons.toFixed(1).replace(".", ",")}</b><span>CONSUME /MIN</span></div></div>` +
      items.map(([t, v]) => kv(t, "−" + v + "/min")).join("") + kv("Luz del planeta", Math.round(G.P[pid].luz * 100) + " %") + (e.f < 1 ? `<div class="no" style="font-size:12px">Falta energía: todo rinde al ${Math.round(e.f * 100)} %. Construye paneles${G.P[pid].gas ? " o un colector" : ""}.</div>` : `<div class="ok" style="font-size:12px">Energía suficiente</div>`);
  }
  return { kind: "Edificio", title: d.name, body };
}

// 5. factory
VIEWS.fab = () => {
  binders = [];
  const head = `<div><div class="lbl">// Fábrica</div><div class="h" style="font-weight:900;font-size:22px;margin-top:4px">Fabricar</div></div>`;
  if (!G.anyBuilt(S, "fabrica")) return head + `<div class="p" style="padding:16px;display:flex;flex-direction:column;gap:8px"><div class="h" style="font-size:14px">Sin fábrica</div><div class="dim" style="font-size:13px">Construye una fábrica en cualquier base (${costTxt(G.BUILD.fabrica.cost)}). Ahí se fabrican máquinas, módulos de base y motores.</div></div>`;
  binders.push(() => document.querySelectorAll("[data-mk]").forEach((x) => (x.onclick = () => act(G.craft(S, x.dataset.mk), "Fabricando: " + (G.MACH[x.dataset.mk] || G.ITEMS[x.dataset.mk]).name.toLowerCase()))));
  const cur = S.craft ? `<div class="p" style="padding:14px;display:flex;flex-direction:column;gap:8px;box-shadow:inset 0 0 0 1px #59d8ff"><div style="display:flex;justify-content:space-between"><span class="lbl" style="color:#59d8ff">En la línea</span><b class="h" style="font-size:11px">${Math.ceil(S.craft.left)} s</b></div><b class="h" style="font-size:15px">${(G.MACH[S.craft.key] || G.ITEMS[S.craft.key]).name}</b>${bar(1 - S.craft.left / S.craft.total, "#59d8ff")}</div>` : "";
  return head + cur + [...Object.entries(G.MACH), ...Object.entries(G.ITEMS)].map(([k, d]) => {
    const lock = d.needs === "lab" && !G.anyBuilt(S, "laboratorio"), rare = k === "pesada" || k === "pliegue2";
    const rows = Object.entries(d.cost).map(([m, n]) => { const have = S.inv[m] || 0, ok = have >= n; return `<div style="display:flex;flex-direction:column;gap:4px;padding:8px 10px;background:#101217;box-shadow:inset 0 0 0 1px ${ok ? "rgba(89,216,255,.5)" : "rgba(255,77,94,.7)"}"><div style="display:flex;justify-content:space-between;font-size:12px"><b class="h" style="font-size:10px">${G.MATS[m].name}</b><b class="${ok ? "ok" : "no"}">${fmt(have)}/${n}</b></div>${ok ? "" : `<div class="dim" style="font-size:10px">Dónde: ${whereIs(m)}</div>`}</div>`; }).join("");
    const can = !lock && !S.craft && G.has(S, d.cost), own = G.MACH[k] ? S.machines[k] : S.items[k];
    const icon = G.MACH[k] ? A.machine(k) : `<path d="M0 -16 l16 9 v14 l-16 9 l-16 -9 v-14z" fill="none" stroke="${rare ? "#a879ff" : "#ff9f2e"}" stroke-width="2"/>`;
    return `<div class="p" style="padding:14px;display:flex;flex-direction:column;gap:10px${rare ? ";box-shadow:inset 0 0 0 1px rgba(168,121,255,.6)" : ""}">
      <div style="display:flex;gap:12px;align-items:center"><svg width="56" height="40" viewBox="-28 -20 56 40" aria-hidden="true">${icon}</svg><div style="flex:1"><b class="h ${rare ? "rare" : ""}" style="font-size:13px">${d.name}</b><div class="dim" style="font-size:12px">${d.note} · tienes ${own}</div></div><span class="dim" style="font-size:11px">${d.time} s</span></div>
      <div class="g2">${rows}</div>
      ${lock ? `<div class="rare" style="font-size:12px">Necesita un laboratorio</div>` : `<button class="btn" data-mk="${k}" ${can ? "" : "disabled"}>${S.craft ? "Fábrica ocupada" : can ? "Fabricar" : "Faltan materiales"}</button>`}</div>`;
  }).join("");
};

/* ---------- start ---------- */
function welcome(r) {
  const got = Object.entries(r.gained).filter(([k, v]) => v >= 1 && G.MATS[k]).map(([k, v]) => "+" + fmt(v) + " " + G.MATS[k].name.toLowerCase());
  const m = Math.round(r.dt / 60);
  toast(`Mientras no estabas (${m >= 60 ? Math.floor(m / 60) + " h " : ""}${m % 60} min): ${got.length ? got.join(", ") : "nada nuevo"}`);
}
S = load();
if (S) { if (S.ship.jump) S.ship.jump.left = Math.min(S.ship.jump.left, 1); const r = G.catchUp(S); if (r.dt > 60) setTimeout(() => welcome(r), 400); view = Object.keys(S.bases).length ? "base" : "cab"; }
else { S = G.newGame(); setTimeout(() => toast("Orbitando Kalon. Revisa los indicadores y establece tu base."), 300); }
let lastMission = G.currentMission(S) && G.currentMission(S).id;
window.__galaxia = { get S() { return S; }, G, go, render };
render(true);
let tick = 0;
setInterval(() => {
  G.advance(S, 1); S.t = Date.now();
  const m = G.currentMission(S);
  if (m && m.id !== lastMission) { toast("Misión cumplida · siguiente: " + m.t); lastMission = m.id; }
  else if (!m && lastMission) { toast("¡Todas las misiones cumplidas!"); lastMission = null; }
  render(); refreshSheet();
  if (++tick % 5 === 0) save();
}, 1000);
