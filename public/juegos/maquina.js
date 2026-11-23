/* Jugar contra la máquina: the level picker shared by every game's start screen.
   Maquina.html(opts) returns the block; Maquina.bind(root, onPick) wires it; onPick(level 1..3, or 0 with no levels). */
(function () {
  "use strict";
  const NAMES = ["", "Fácil", "Medio", "Difícil"];
  const css = `.cpu{display:grid;gap:6px}.cpu .lv{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.cpu .lv button{border:none;border-radius:14px;min-height:46px;font:inherit;font-weight:800;font-size:15px;color:#1d1f23;cursor:pointer}
.cpu .lv button[data-lv="1"]{background:#d9f2e1}.cpu .lv button[data-lv="2"]{background:#fff0c2}.cpu .lv button[data-lv="3"]{background:#fde2e1}
.cpu .one{border:none;border-radius:14px;min-height:46px;font:inherit;font-weight:800;font-size:15px;background:#e3ecfb;color:#1d1f23;width:100%}
.cpu .why{font-size:12px;color:#6c6f75;font-weight:600}`;
  let styled = false;
  function html(opts) {
    opts = opts || {};
    if (!styled) { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); styled = true; }
    const lbl = opts.label || "Contra la máquina";
    if (opts.noLevels) return `<div class="cpu"><label class="lbl">${lbl}</label><button class="one" data-lv="0">🤖 Jugar contra la máquina</button>${opts.note ? `<span class="why">${opts.note}</span>` : ""}</div>`;
    return `<div class="cpu"><label class="lbl">${lbl}</label><div class="lv">${[1, 2, 3].map((k) => `<button data-lv="${k}">${NAMES[k]}</button>`).join("")}</div>${opts.note ? `<span class="why">${opts.note}</span>` : ""}</div>`;
  }
  function bind(root, onPick) {
    (root || document).querySelectorAll(".cpu [data-lv]").forEach((b) => (b.onclick = () => onPick(+b.dataset.lv)));
  }
  const label = (lv) => (lv ? "Máquina · " + NAMES[lv] : "Máquina");
  window.Maquina = { html, bind, label, NAMES };
})();
