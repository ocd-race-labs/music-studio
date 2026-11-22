// Juegos en casa: the player's profile, shared by every game on this device.
// It keeps the name, the background colour and a subtle "it's your turn" alert (sound, vibration or both).
// Use: <script src="../perfil.js"></script>, then Perfil.open() for the settings sheet and
// Perfil.turn(isMyTurn) on every render; the alert fires only when the turn passes to you.
(function () {
  const KEY = "juegos-perfil";
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const P = Object.assign({ bg: "original", sound: "gota", vib: "none" }, load(KEY) || {});

  // mid-dark tones: white text and the light panels read well on all of them
  const BG = {
    original: { name: "Original" },
    madera: { name: "Madera", c: ["#d6aa6f", "#c99a5e", "#b98748"], grain: true },
    pano: { name: "Paño verde", c: ["#2a7350", "#1f5a3e", "#174a33"] },
    petroleo: { name: "Petróleo", c: ["#2b6f78", "#1f5560", "#17434c"] },
    noche: { name: "Azul noche", c: ["#33467a", "#263661", "#1b284b"] },
    ciruela: { name: "Ciruela", c: ["#6a3f73", "#53315b", "#3f2546"] },
    burdeo: { name: "Burdeo", c: ["#8a3442", "#6f2735", "#561d29"] },
    terracota: { name: "Terracota", c: ["#b5603f", "#9a4c30", "#7d3b24"] },
    grafito: { name: "Grafito", c: ["#4a4e57", "#373a42", "#26282e"] },
  };
  const SOUNDS = { none: "Sin sonido", gota: "Gota", campana: "Campanita", madera: "Toc de madera", burbuja: "Burbuja", soplo: "Soplido" };
  const VIBS = { none: "Sin vibración", uno: "Un toque", dos: "Dos toques", suave: "Pulso largo suave" };

  /* ---------- background ---------- */
  let styleEl;
  function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  function applyBg() {
    const t = BG[P.bg];
    if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "perfil-bg"; (document.head || document.documentElement).appendChild(styleEl); }
    if (!t || !t.c) { styleEl.textContent = ""; return; }
    const [l, m, d] = t.c;
    const grain = t.grain ? "repeating-linear-gradient(92deg,rgba(255,255,255,.05) 0 2px,transparent 2px 9px),repeating-linear-gradient(88deg,rgba(90,50,10,.07) 0 1px,transparent 1px 23px)," : "";
    styleEl.textContent = `html{background:${m}!important}
body{background:${grain}radial-gradient(ellipse at 50% 15%,${l},${m} 50%,${d})!important;background-attachment:fixed!important}
header{background:${hexA(d, 0.92)}!important}`;
    const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = m;
  }

  /* ---------- sounds: quiet, short, soft attack ---------- */
  let ctx;
  function ac() {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    // iPhone: play as media so the silent switch does not mute the alert the player chose
    try { if (navigator.audioSession && navigator.audioSession.type !== "playback") navigator.audioSession.type = "playback"; } catch (e) {}
    if (!ctx) ctx = new A();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  // iOS starts audio only inside a tap: wake it on the first one
  const unlock = () => { const c = ac(); if (c) { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } };
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });

  function tone(c, t, f1, f2, dur, peak, type) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function play(name) {
    const c = ac(); if (!c || name === "none") return;
    const t = c.currentTime + 0.01;
    if (name === "gota") tone(c, t, 1150, 720, 0.18, 0.16);
    else if (name === "campana") { tone(c, t, 1318, 1318, 0.5, 0.09); tone(c, t + 0.09, 1760, 1760, 0.55, 0.07); }
    else if (name === "madera") { tone(c, t, 520, 380, 0.08, 0.22, "triangle"); }
    else if (name === "burbuja") tone(c, t, 380, 760, 0.13, 0.15);
    else if (name === "soplo") {
      const n = c.createBufferSource(), b = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      n.buffer = b;
      const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.8;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.09); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      n.connect(f).connect(g).connect(c.destination); n.start(t); n.stop(t + 0.32);
    }
  }
  // Android vibrates through navigator.vibrate; iPhone (iOS 18+) gives a light haptic tap when a switch control toggles
  const hasVibrate = () => typeof navigator.vibrate === "function";
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const canVibrate = () => hasVibrate() || isIOS;
  let sw;
  function tapIOS() {
    if (!sw) {
      sw = document.createElement("label");
      sw.setAttribute("aria-hidden", "true");
      sw.style.cssText = "position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
      const i = document.createElement("input"); i.type = "checkbox"; i.setAttribute("switch", ""); sw.appendChild(i);
      document.body.appendChild(sw);
    }
    sw.click();
  }
  function buzz(name) {
    if (name === "none") return;
    if (hasVibrate()) { try { navigator.vibrate({ uno: 18, dos: [14, 70, 14], suave: 45 }[name]); } catch (e) {} return; }
    if (!isIOS) return;
    tapIOS();
    if (name === "dos") setTimeout(tapIOS, 120);
  }
  function alertNow() { play(P.sound); buzz(P.vib); }

  // fire only when the turn comes to me, not on every render
  let wasMine = null;
  function turn(mine) {
    mine = !!mine;
    if (wasMine === false && mine) alertNow();
    wasMine = mine;
  }

  /* ---------- settings sheet ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CSS = `#perfil-sheet{position:fixed;inset:0;z-index:100;background:rgba(10,12,16,.5);display:flex;align-items:flex-end;justify-content:center;font-family:Sora,system-ui,sans-serif;color:#1d1f23}
#perfil-sheet .in{background:#fbfbfa;width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));display:grid;gap:14px;animation:pf-up .22s ease-out}
@keyframes pf-up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
#perfil-sheet h2{font-size:20px;font-weight:800;display:flex;align-items:center}
#perfil-sheet h2 span{flex:1}
#perfil-sheet .x{border:none;background:#eeefef;border-radius:12px;width:40px;height:40px;font-size:20px;font-weight:800;font-family:inherit}
#perfil-sheet .lbl{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#6c6f75;margin-bottom:6px}
#perfil-sheet input{font:inherit;font-size:17px;padding:12px 14px;border-radius:12px;border:1.5px solid #d5d6d8;width:100%;box-sizing:border-box}
#perfil-sheet .sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
#perfil-sheet .sw button{border:none;border-radius:14px;height:58px;color:#fff;font:inherit;font-size:12px;font-weight:800;display:flex;align-items:flex-end;padding:7px 9px;text-shadow:0 1px 2px rgba(0,0,0,.4);box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
#perfil-sheet .sw button.on{box-shadow:0 0 0 3px #fbfbfa,0 0 0 5px #1d1f23}
#perfil-sheet .sw .orig{background:repeating-linear-gradient(135deg,#c99a5e 0 14px,#1f5a3e 14px 28px)}
#perfil-sheet .opts{display:flex;flex-wrap:wrap;gap:8px}
#perfil-sheet .opts button{border:none;border-radius:999px;padding:10px 14px;font:inherit;font-size:14px;font-weight:700;background:#eeefef;color:#1d1f23;min-height:42px}
#perfil-sheet .opts button.on{background:#1d1f23;color:#fff}
#perfil-sheet .note{font-size:12px;color:#6c6f75;margin-top:6px}
#perfil-sheet .ok{border:none;border-radius:14px;min-height:48px;font:inherit;font-weight:800;font-size:16px;background:#1d1f23;color:#fff}`;
  function open() {
    if (document.getElementById("perfil-sheet")) return;
    if (!document.getElementById("perfil-css")) { const s = document.createElement("style"); s.id = "perfil-css"; s.textContent = CSS; document.head.appendChild(s); }
    const yo = load("juegos-yo") || {};
    const el = document.createElement("div");
    el.id = "perfil-sheet";
    const sw = (k, t) => `<button data-bg="${k}" class="${P.bg === k ? "on" : ""} ${t.c ? "" : "orig"}" style="${t.c ? `background:linear-gradient(160deg,${t.c[0]},${t.c[2]})` : ""}">${t.name}</button>`;
    const opt = (attr, map, cur) => Object.entries(map).map(([k, n]) => `<button data-${attr}="${k}" class="${cur === k ? "on" : ""}">${n}</button>`).join("");
    el.innerHTML = `<div class="in" role="dialog" aria-label="Tu perfil">
      <h2><span>Tu perfil</span><button class="x" aria-label="Cerrar">✕</button></h2>
      <div><div class="lbl">Tu nombre</div><input id="pf-name" maxlength="24" placeholder="Ej: Magda" value="${esc(yo.name || "")}"></div>
      <div><div class="lbl">Fondo de los juegos</div><div class="sw">${Object.entries(BG).map(([k, t]) => sw(k, t)).join("")}</div>
        <div class="note">«Original» deja a cada juego con su propio fondo.</div></div>
      <div><div class="lbl">Aviso cuando es tu turno · sonido</div><div class="opts" id="pf-s">${opt("s", SOUNDS, P.sound)}</div></div>
      <div><div class="lbl">Aviso cuando es tu turno · vibración</div><div class="opts" id="pf-v">${opt("v", VIBS, P.vib)}</div>
        <div class="note">${hasVibrate() ? "Toca una opción para probarla. Se puede usar sonido y vibración juntos." : isIOS ? "En iPhone es un toque suave (necesita iOS 18 o más nuevo, y la vibración del sistema activada). El sonido suena aunque el teléfono esté en silencio." : "Este equipo no puede vibrar; usa sonido."}</div></div>
      <button class="ok">Listo</button></div>`;
    document.body.appendChild(el);
    const keep = () => save(KEY, P);
    const close = () => {
      const n = el.querySelector("#pf-name").value.trim().slice(0, 24);
      if (n) { const y = load("juegos-yo") || {}; y.name = n; save("juegos-yo", y); }
      el.remove(); keep();
      document.dispatchEvent(new CustomEvent("perfil-cambio", { detail: { name: n } }));
    };
    el.querySelector(".x").onclick = close;
    el.querySelector(".ok").onclick = close;
    el.onclick = (e) => { if (e.target === el) close(); };
    el.querySelectorAll("[data-bg]").forEach((b) => b.onclick = () => {
      P.bg = b.dataset.bg; keep(); applyBg();
      el.querySelectorAll("[data-bg]").forEach((x) => x.classList.toggle("on", x === b));
    });
    el.querySelectorAll("[data-s]").forEach((b) => b.onclick = () => {
      P.sound = b.dataset.s; keep(); play(P.sound);
      el.querySelectorAll("[data-s]").forEach((x) => x.classList.toggle("on", x === b));
    });
    el.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => {
      P.vib = b.dataset.v; keep(); buzz(P.vib);
      el.querySelectorAll("[data-v]").forEach((x) => x.classList.toggle("on", x === b));
    });
  }

  // a change made in another tab shows up here too
  window.addEventListener("storage", (e) => { if (e.key === KEY) { Object.assign(P, load(KEY) || {}); applyBg(); } });
  applyBg();
  window.Perfil = { open, turn, test: alertNow, get: () => Object.assign({}, P) };
})();
