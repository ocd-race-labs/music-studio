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
    const s = E.newGame("MAQ", { id: me.pid || "yo-local", name: me.name || "Tú", keyHash: "-" });
    for (let i = 0; i < o.opponents; i++) E.join(s, { id: "bot" + i, name: (o.names && o.names[i]) || NAMES[i] + " 🤖", keyHash: "-" });
    s.version = 0;
    let timer = null, stuck = 0;
    const show = () => o.onChange(view(s, 0));
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
      s.version++; step(); return view(s, 0);
    }
    return { s, call, step, show };
  }
  window.Local = { table, NAMES };
})();
