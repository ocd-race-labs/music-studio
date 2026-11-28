/* Jugar contra la máquina in the card and table games: a table that lives only on this phone.
   It uses the same rules (engine.js) the server uses, so nothing changes in how the game looks or plays.
   Local.table({ E, apply, bot, level, opponents, names, onChange, view }) returns { call(action, extra), s }.
   apply(s, pi, action, extra, rand) mirrors the server's switch; bot(s, pi, level) returns the machine's next
   action for seat pi ({ action, ...extra }) or null when that seat has nothing to do right now.
   The machine reads only its own hand and what is on the table. */
(function () {
  "use strict";
  const NAMES = ["Máquina", "Robotina", "Chispa", "Tuerca", "Bit"];
  function table(o) {
    const E = o.E, rand = Math.random, view = o.view || ((s, pi) => E.view(s, pi));
    const me = o.me || {};
    let s = o.state;
    if (!s) {
      s = E.newGame("MAQ", { id: me.pid || "yo-local", name: me.name || "Tú", keyHash: "-" });
      for (let i = 0; i < o.opponents; i++) E.join(s, { id: "bot" + i, name: (o.names && o.names[i]) || NAMES[i] + " 🤖", keyHash: "-" });
      s.version = 0;
    }
    let timer = null, stuck = 0;
    // every change is kept on the phone, so leaving the game and coming back picks it up where it was
    const save = () => { if (o.key) try { localStorage.setItem(KEY + o.key, JSON.stringify({ s, level: o.level, at: Date.now() })); } catch (e) { /* storage full or off */ } };
    const show = () => { save(); o.onChange(view(s, 0)); };
    // the machine seats take their turns one action at a time, with a short pause so you can follow
    function step(delay) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        for (let pi = 1; pi < s.players.length; pi++) {
          let mv = null;
          try { mv = o.bot(s, pi, o.level); } catch (e) { console.error(e); }
          if (!mv) continue;
          try { o.apply(s, pi, mv.action, mv, rand); stuck = 0; }
          catch (e) { console.error("machine move refused", mv, e); if (++stuck > 3) return; continue; }
          s.version++; show(); step(o.pace || 850); return;
        }
        if (o.idle) o.idle(s);
      }, delay == null ? (o.pace || 850) : delay);
    }
    function call(action, extra) {
      if (action === "view") return view(s, 0);
      try { o.apply(s, 0, action, extra || {}, rand); }
      catch (e) { if (e && e.user) return { error: e.message }; console.error(e); return { error: "No se pudo" }; }
      s.version++; save(); step(); return view(s, 0);
    }
    if (o.state) step(300);
    return { s, call, step, show };
  }
  const KEY = "juegos-maq-";
  // the game against the machine kept on this phone, if there is one still being played
  function saved(key) {
    try {
      const d = JSON.parse(localStorage.getItem(KEY + key) || "null");
      if (!d || d.done) return null;
      if (d.s && (d.s.phase === "finished" || d.s.phase === "lobby")) return null;
      return d.s || d.g ? d : null;
    } catch (e) { return null; }
  }
  // the board games keep their own state: g is whatever they need to pick the game up again
  function keep(key, g, done, level, label) {
    try { localStorage.setItem(KEY + key, JSON.stringify({ g, done: !!done, level, label, at: Date.now() })); } catch (e) { /* storage full or off */ }
  }
  const LV = { 0: "", 1: "Fácil", 2: "Medio", 3: "Difícil" };
  function ago(t) { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "recién" : m < 60 ? "hace " + m + " min" : m < 1440 ? "hace " + Math.round(m / 60) + " h" : "hace " + Math.round(m / 1440) + " días"; }
  function resumeHTML(key) {
    const d = saved(key); if (!d) return "";
    const what = d.label || (LV[d.level] ? "Contra la máquina · " + LV[d.level] : "Contra la máquina");
    return `<button class="btn gold" id="maq-resume" style="justify-content:center">▶ Retomar tu partida</button>
      <p class="muted" style="margin:-4px 0 4px;font-size:13px;text-align:center">${what} · ${ago(d.at)}</p>`;
  }
  function bindResume(root, key, cb) { const b = root.querySelector("#maq-resume"); if (b) b.onclick = () => { const d = saved(key); if (d) cb(d); }; }
  window.Local = { table, NAMES, saved, keep, resumeHTML, bindResume };
})();
