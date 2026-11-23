// Juegos en casa: the "?" button. Each game gets up to two pages of picture-first instructions.
// Use: <script src="../ayuda.js"></script> and Ayuda.open("carioca").
(function () {
  const SYM = { "♠": "", "♣": "", "♥": "r", "♦": "r" };
  // a tiny playing card: c("7♥")
  const c = (t, cls = "") => { const s = t.slice(-1), r = t.slice(0, -1); return `<span class="ay-c ${SYM[s] ? "r" : ""} ${cls}"><b>${r}</b><i>${s}</i></span>`; };
  const cards = (...a) => `<span class="ay-cs">${a.map((x) => c(x)).join("")}</span>`;
  const back = (n = 1) => `<span class="ay-cs">${'<span class="ay-c bk"></span>'.repeat(n)}</span>`;
  const ck = (col, n = 1) => `<span class="ay-cs">${`<span class="ay-k ${col}"></span>`.repeat(n)}</span>`;
  const es = (n, e) => `<span class="ay-c es"><b>${n}</b><i>${e}</i></span>`;
  const big = (e) => `<span class="ay-e">${e}</span>`;
  const chip = (t) => `<span class="ay-chip">${t}</span>`;
  const arrow = `<span class="ay-ar">→</span>`;

  const G = {
    ludo: { name: "Ludo", pages: [
      { t: "Salir y avanzar", rows: [
        [chip("🎲 6") + arrow + big("🏁"), "Con un 6 sacas una ficha de tu casa a la salida."],
        [big("🔁"), "Avanzas lo que dice el dado. Das la vuelta al tablero y entras por tu pasillo de color a la meta."],
        [chip("🎲 6") + arrow + big("🎲"), "Con un 6 vuelves a tirar. Tres 6 seguidos: pierdes el turno."]] },
      { t: "Comer y ganar", rows: [
        [big("💥"), "Si caes donde hay una ficha rival, vuelve a su casa. Y tú tiras otra vez."],
        [big("★"), "En las salidas y en las estrellas nadie puede comerte."],
        [chip("Exacto"), "Para entrar a la meta necesitas el número justo."],
        [big("🏆"), "Gana quien lleva sus 4 fichas a la meta primero."]] },
    ] },
    escoba: { name: "Escoba", pages: [
      { t: "Sumar 15", rows: [
        [chip("1 … 7") + chip("Sota 8") , "Cada carta vale su número; la sota 8, el caballo 9 y el rey 10."],
        [es("5", "🍷") + arrow + es("3", "🪙") + es("7", "🪵"), "Juegas una carta y te llevas cartas de la mesa que sumen 15 con ella."],
        [big("🧹"), "Si te llevas todo lo de la mesa, es <b>escoba</b>: un punto."],
        [big("🃏"), "Si tu carta no suma 15 con nada, queda en la mesa."]] },
      { t: "Los puntos", rows: [
        [big("🧹"), "1 punto por cada escoba."],
        [back(3), "1 punto a quien tiene más cartas."],
        [es("4", "🪙") + es("6", "🪙"), "1 punto a quien tiene más oros."],
        [es("7", "🪙"), "1 punto a quien tiene el siete de oros."],
        [chip("Gana a 15"), "1 punto más por tener más sietes. Gana quien llega primero a 15 puntos."]] },
    ] },
    brisca: { name: "Brisca", pages: [
      { t: "Ganar la baza", rows: [
        [es("4", "🗡️") + chip("Triunfo"), "La carta dada vuelta marca el <b>triunfo</b>. Un triunfo le gana a cualquier otra pinta."],
        [chip("As · 3 · Rey · Caballo · Sota · 7 … 2"), "Así es el orden, de mayor a menor."],
        [es("12", "🍷") + arrow + es("1", "🍷"), "Sin triunfo, gana la más alta de la pinta que salió primero. No es obligatorio seguir la pinta."]] },
      { t: "Los puntos", rows: [
        [chip("As 11") + chip("3 10"), "Rey 4 · Caballo 3 · Sota 2 · el resto 0. En total hay 120 puntos."],
        [back(1) + arrow + big("✋"), "Quien gana la baza roba primero y sale en la siguiente."],
        [big("👥"), "Con 4 jugadores se juega en parejas: los compañeros quedan enfrentados."],
        [big("🏆"), "Gana la mano quien junta más de 60 puntos."]] },
    ] },
    bingo: { name: "Bingo", pages: [
      { t: "Cómo se juega", rows: [
        [big("🎱"), "El anfitrión saca los números; salen en el tablero de todos."],
        [big("✅"), "Toca en tu cartón los números que salen."],
        [big("📣"), "¿Completaste la figura? Aprieta el botón para reclamar."],
        [big("🏆"), "El anfitrión revisa tu cartón y confirma el premio."]] },
      { t: "Dos bingos", rows: [
        [chip("Lotería"), "Cartón de 3 filas y 9 columnas, números del 1 al 90. Premios: línea, dos líneas, cartón lleno."],
        [chip("Americano"), "Cartón de 5 × 5, números del 1 al 75. Premios con figuras: línea, L, cuadrado, cartón lleno…"],
        [big("🔊"), "«Activar voz» canta los números en voz alta."],
        [big("🔗"), "El anfitrión invita con «Copiar link» o WhatsApp."]] },
    ] },
    damas: { name: "Damas", pages: [
      { t: "Mover y comer", rows: [
        [ck("w") + arrow + big("↗"), "Los peones avanzan en diagonal, una casilla."],
        [ck("w") + ck("b") + arrow + ck("w"), "Para comer saltas sobre la pieza rival a la casilla vacía de atrás."],
        [big("❗"), "Comer es obligatorio. Si después puedes seguir comiendo, sigues."]] },
      { t: "La dama y el final", rows: [
        [ck("w") + arrow + big("👑"), "El peón que llega al fondo se corona dama."],
        [big("↗↙"), "La dama se mueve y come a lo largo de toda la diagonal."],
        [big("🏆"), "Gana quien deja al otro sin piezas o sin movimientos."]] },
    ] },
    carioca: { name: "Carioca", pages: [
      { t: "Los juegos", rows: [
        [cards("7♠", "7♥", "7♣"), "<b>Trío:</b> 3 cartas del mismo número."],
        [cards("4♥", "5♥", "6♥", "7♥"), "<b>Escala:</b> 4 seguidas de la misma pinta. Puede dar la vuelta: Q‑K‑A‑2."],
        [big("🃏"), "Un comodín por juego reemplaza cualquier carta."],
        [chip("9 rondas"), "Cada ronda pide otro contrato: dos tríos, un trío y una escala… hasta la escala real."]] },
      { t: "Tu turno", rows: [
        [back() + arrow + big("✋"), "1. Roba del mazo o del pozo."],
        [cards("7♠", "7♥", "7♣") + arrow + big("⬇"), "2. Bájate con el contrato de la ronda, si lo tienes."],
        [big("➕"), "3. Ya bajado, agrega cartas a cualquier juego de la mesa."],
        [c("K♣") + arrow + big("🗑"), "4. Bota una carta. Quien se queda sin cartas gana la ronda."],
        [chip("Puntos"), "Lo que queda en la mano: As 20 · J Q K 10 · 🃏 30 · el resto su número. Gana quien suma menos."]] },
    ] },
    nerviosito: { name: "Nerviosito", pages: [
      { t: "Contar y dar vuelta", rows: [
        [back(3), "Se reparte todo el mazo boca abajo. Nadie mira sus cartas."],
        [chip("As · Dos · Tres …"), "Por turno, das vuelta tu carta al centro mientras se cuenta. Después del Rey, de nuevo As."],
        [chip("«Siete»") + arrow + c("7♣"), "¿Coincide la carta con lo que se dijo?"],
        [big("✋"), "¡Todos tocan «¡Mano!» lo más rápido posible!"]] },
      { t: "Quién se lleva el pozo", rows: [
        [big("🐢"), "El último en poner la mano se lleva todas las cartas del centro."],
        [big("😴"), "Quien no la pone a tiempo, también."],
        [big("🙈"), "Poner la mano cuando no coincide: te llevas el pozo."],
        [big("🏆"), "Gana el primero que se queda sin cartas."]] },
    ] },
    ocholoco: { name: "Ocho loco", pages: [
      { t: "Qué carta puedes jugar", rows: [
        [c("K♥") + arrow + c("4♥"), "La misma pinta…"],
        [c("K♥") + arrow + c("K♠"), "…o el mismo número."],
        [c("8♣", "loco") + arrow + chip("♥ ♠ ♦ ♣"), "El <b>8 es loco</b>: va sobre cualquier carta y tú eliges la pinta que sigue."]] },
      { t: "Robar y ganar", rows: [
        [back(3) + arrow + chip("Pasar"), "¿No puedes o no quieres jugar? Roba hasta 3 cartas; después puedes pasar."],
        [big("🏆"), "Gana la ronda quien se queda sin cartas."],
        [chip("Puntos"), "Los demás suman su mano: 8 vale 50 · J Q K 10 · As 1 · el resto su número. Gana quien lleva menos."]] },
    ] },
    solitario: { name: "Solitario", pages: [
      { t: "La meta", rows: [
        [cards("A♠", "2♠", "3♠") + chip("… K"), "Arriba, sube las 4 pintas en orden, del As al Rey."],
        [cards("K♠", "Q♥", "J♣"), "En las columnas, baja de a un número alternando rojo y negro."],
        [c("K♦") + arrow + big("⬜"), "En una columna vacía solo puede ir un Rey."]] },
      { t: "Cómo se juega aquí", rows: [
        [big("👆"), "Toca una carta y se mueve sola a donde puede ir. Si tiembla, no tiene dónde ir."],
        [back() + arrow + c("9♦"), "Toca el mazo para sacar cartas (de a 1 o de a 3)."],
        [big("↶"), "«Deshacer» vuelve atrás. «Terminar ✓» sube todo cuando ya está todo a la vista."]] },
    ] },
    backgammon: { name: "Backgammon", pages: [
      { t: "La meta", rows: [
        [ck("w", 3) + arrow + big("🏠"), "Lleva tus 15 fichas a tu casa (abajo a la derecha) y sácalas. Gana quien las saca primero."],
        [big("↩"), "La flecha suave del tablero muestra hacia dónde avanzas."],
        [chip("🎲 3 · 5"), "Mueves una ficha 3 puntas y otra (o la misma) 5. Dobles: se juegan 4 veces."]] },
      { t: "Comer y bloquear", rows: [
        [ck("b", 2) + big("🚫"), "No puedes caer donde hay 2 o más fichas rivales."],
        [ck("w") + arrow + ck("b"), "Si caes sobre una ficha sola, la comes y va a la barra del centro."],
        [big("⬅"), "Con fichas en la barra, primero tienes que entrarlas."],
        [big("📤"), "Cuando todas tus fichas están en casa, empiezas a sacarlas."]] },
    ] },
  };

  const CSS = `#ayuda{position:fixed;inset:0;z-index:110;background:rgba(10,12,16,.55);display:flex;align-items:flex-end;justify-content:center;font-family:Sora,system-ui,sans-serif;color:#1d1f23}
#ayuda .in{background:#fbfbfa;width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:18px 16px calc(16px + env(safe-area-inset-bottom));display:grid;gap:14px;animation:ay-up .22s ease-out}
#ayuda.seen .in{animation:none}
@keyframes ay-up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
#ayuda .hd{display:flex;align-items:center;gap:8px}
#ayuda .hd small{font-size:12px;font-weight:800;color:#6c6f75;text-transform:uppercase;letter-spacing:.6px;display:block}
#ayuda .hd b{font-size:21px;font-weight:800;display:block}
#ayuda .hd div{flex:1}
#ayuda .x{border:none;background:#eeefef;border-radius:12px;width:40px;height:40px;font-size:19px;font-weight:800;font-family:inherit}
#ayuda .rows{display:grid;gap:10px}
#ayuda .row{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;background:#f1f1ef;border-radius:16px;padding:10px 12px}
#ayuda .row .v{display:flex;align-items:center;gap:4px;min-width:64px;justify-content:center}
#ayuda .row p{font-size:14px;line-height:1.4;font-weight:600}
#ayuda .ft{display:flex;align-items:center;gap:10px}
#ayuda .dots{flex:1;display:flex;gap:6px}
#ayuda .dots i{width:8px;height:8px;border-radius:50%;background:#d5d6d8}
#ayuda .dots i.on{background:#1d1f23;width:20px;border-radius:4px}
#ayuda .nx{border:none;border-radius:14px;min-height:46px;padding:0 20px;font:inherit;font-weight:800;font-size:15px;background:#1d1f23;color:#fff}
#ayuda .pv{border:none;border-radius:14px;min-height:46px;padding:0 16px;font:inherit;font-weight:800;font-size:15px;background:#eeefef}
.ay-cs{display:inline-flex;gap:2px}
.ay-c{width:26px;height:36px;border-radius:4px;background:#fff;box-shadow:0 1px 0 #cfd1d4,0 2px 4px rgba(0,0,0,.2);display:inline-grid;align-content:center;justify-items:center;line-height:1;color:#1d1f23}
.ay-c b{font-size:12px;font-weight:800}.ay-c i{font-style:normal;font-size:13px}
.ay-c.r{color:#d22f3a}
.ay-c.es i{font-size:14px}
.ay-c.loco{box-shadow:inset 0 0 0 2px #b18cff,0 2px 4px rgba(0,0,0,.2)}
.ay-c.bk{background:repeating-linear-gradient(45deg,#2f6fb5 0 4px,#2a63a3 4px 8px);box-shadow:inset 0 0 0 2px #fff,0 2px 4px rgba(0,0,0,.25)}
.ay-k{width:20px;height:20px;border-radius:50%;display:inline-block}
.ay-k.w{background:radial-gradient(circle at 35% 30%,#fff,#e6dcc8);box-shadow:0 2px 0 #b9ab90}
.ay-k.b{background:radial-gradient(circle at 35% 30%,#5b606a,#17181c);box-shadow:0 2px 0 #0d0e10}
.ay-e{font-size:26px;line-height:1}
.ay-ar{font-weight:800;color:#9a9ca1;margin:0 2px}
.ay-chip{background:#1d1f23;color:#fff;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;white-space:nowrap}`;

  function open(key) {
    const g = G[key]; if (!g || document.getElementById("ayuda")) return;
    if (!document.getElementById("ayuda-css")) { const s = document.createElement("style"); s.id = "ayuda-css"; s.textContent = CSS; document.head.appendChild(s); }
    const el = document.createElement("div"); el.id = "ayuda";
    let k = 0;
    const draw = () => {
      const p = g.pages[k], last = k === g.pages.length - 1;
      el.innerHTML = `<div class="in" role="dialog" aria-label="Cómo jugar ${g.name}">
        <div class="hd"><div><small>Cómo jugar ${g.name} · ${k + 1}/${g.pages.length}</small><b>${p.t}</b></div><button class="x" aria-label="Cerrar">✕</button></div>
        <div class="rows">${p.rows.map(([v, t]) => `<div class="row"><span class="v">${v}</span><p>${t}</p></div>`).join("")}</div>
        <div class="ft"><span class="dots">${g.pages.map((_, i) => `<i class="${i === k ? "on" : ""}"></i>`).join("")}</span>
          ${k ? `<button class="pv">‹ Atrás</button>` : ""}<button class="nx">${last ? "¡A jugar!" : "Siguiente ›"}</button></div></div>`;
      el.querySelector(".x").onclick = () => el.remove();
      el.querySelector(".nx").onclick = () => { if (last) el.remove(); else { k++; draw(); } };
      const pv = el.querySelector(".pv"); if (pv) pv.onclick = () => { k--; draw(); };
    };
    el.onclick = (e) => { if (e.target === el) el.remove(); };
    // swipe left and right between the pages
    let x0 = null;
    el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (dx < -50 && k < g.pages.length - 1) { k++; draw(); } else if (dx > 50 && k > 0) { k--; draw(); }
    });
    draw();
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("seen"), 300);
  }
  window.Ayuda = { open };
})();
