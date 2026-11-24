// The machine for Ajedrez: Stockfish 19 (lite, single thread) in a Web Worker, one request at a time.
// Levels: the two easiest mix in random moves on top of Stockfish's weakest setting; the middle two use
// Stockfish's own strength limit (UCI_Elo); the last one plays at full strength.

export const LEVELS = [
  { name: "Muy fácil", note: "~400 Elo · se equivoca seguido" },
  { name: "Fácil", note: "~800 Elo · un jugador de colegio" },
  { name: "Medio", note: "~1.400 Elo · aficionado de club" },
  { name: "Avanzado", note: "~2.000 Elo · jugador de torneo" },
  { name: "Campeón mundial", note: "más de 3.000 Elo" },
];
const SETTINGS = [
  { random: 0.45, skill: 0, go: "go depth 1" },
  { random: 0.12, skill: 3, go: "go depth 3" },
  { elo: 1400, go: "go movetime 400" },
  { elo: 2000, go: "go movetime 800" },
  { full: true, go: "go movetime 1500" },
];

export class Engine {
  constructor(path) {
    this.w = new Worker(path);
    this.lines = [];
    this.waiters = [];
    this.listeners = [];
    this.dead = false;
    this.w.onmessage = (e) => {
      const line = typeof e.data === "string" ? e.data : String(e.data);
      for (const f of this.listeners) f(line);
      for (const wt of this.waiters.slice()) if (wt.test(line)) { this.waiters.splice(this.waiters.indexOf(wt), 1); wt.done(line); }
    };
    this.w.onerror = () => { this.dead = true; for (const wt of this.waiters.splice(0)) wt.fail(new Error("engine")); };
    this.chain = this.init();
  }
  send(cmd) { this.w.postMessage(cmd); }
  wait(test, ms = 20000) {
    return new Promise((done, fail) => {
      const wt = { test, done: (l) => { clearTimeout(t); done(l); }, fail };
      const t = setTimeout(() => { const i = this.waiters.indexOf(wt); if (i >= 0) this.waiters.splice(i, 1); fail(new Error("timeout")); }, ms);
      this.waiters.push(wt);
    });
  }
  async init() {
    const ok = this.wait((l) => l === "uciok", 30000);
    this.send("uci");
    await ok;
  }
  // run one request after the previous one
  queue(fn) {
    const p = this.chain.then(fn, fn);
    this.chain = p.catch(() => {});
    return p;
  }
  // best move for fen with the given options → { from, to, promotion }
  best(fen, opt = {}) {
    return this.queue(async () => {
      if (this.dead) throw new Error("engine");
      const full = !opt.elo && opt.skill == null;
      this.send("setoption name UCI_LimitStrength value " + (opt.elo ? "true" : "false"));
      if (opt.elo) this.send("setoption name UCI_Elo value " + opt.elo);
      this.send("setoption name Skill Level value " + (full || opt.elo ? 20 : opt.skill));
      this.send("setoption name MultiPV value 1");
      const ready = this.wait((l) => l === "readyok");
      this.send("isready"); await ready;
      const bm = this.wait((l) => l.startsWith("bestmove"), 30000);
      this.send("position fen " + fen);
      this.send(opt.go || "go movetime " + (opt.movetime || 1000));
      const line = await bm;
      const uci = line.split(/\s+/)[1];
      if (!uci || uci === "(none)") return null;
      return { from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) };
    });
  }
  // full-strength look at a position: the n best moves with their score for the side to move
  // → [{ move: {from,to,promotion?}, cp, mate }] best first (cp in centipawns; mate in moves, negative when getting mated)
  analyse(fen, opt = {}) {
    const n = opt.multipv || 1;
    return this.queue(async () => {
      if (this.dead) throw new Error("engine");
      this.send("setoption name UCI_LimitStrength value false");
      this.send("setoption name Skill Level value 20");
      this.send("setoption name MultiPV value " + n);
      const ready = this.wait((l) => l === "readyok");
      this.send("isready"); await ready;
      const lines = {};
      const f = (l) => {
        if (!l.startsWith("info") || l.indexOf(" pv ") < 0 || /bound/.test(l)) return;
        const k = +((l.match(/ multipv (\d+)/) || [])[1] || 1);
        const sc = l.match(/ score (cp|mate) (-?\d+)/), pv = l.match(/ pv (\S+)/);
        if (!sc || !pv) return;
        lines[k] = { uci: pv[1], cp: sc[1] === "cp" ? +sc[2] : null, mate: sc[1] === "mate" ? +sc[2] : null };
      };
      this.listeners.push(f);
      const bm = this.wait((l) => l.startsWith("bestmove"), 30000);
      this.send("position fen " + fen);
      this.send(opt.depth ? "go depth " + opt.depth : "go movetime " + (opt.movetime || 800));
      try { await bm; } finally { this.listeners.splice(this.listeners.indexOf(f), 1); }
      this.send("setoption name MultiPV value 1");
      return Object.keys(lines).map(Number).sort((a, b) => a - b).map((k) => {
        const u = lines[k].uci;
        return { move: { from: u.slice(0, 2), to: u.slice(2, 4), ...(u[4] ? { promotion: u[4] } : {}) }, cp: lines[k].cp, mate: lines[k].mate };
      });
    });
  }
  // a move at one of the five levels; legal: chess.js verbose moves for the position
  levelMove(fen, level, legal) {
    const s = SETTINGS[level - 1] || SETTINGS[2];
    if (s.random && Math.random() < s.random && legal.length) {
      const m = legal[Math.floor(Math.random() * legal.length)];
      return Promise.resolve({ from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) });
    }
    return this.best(fen, { elo: s.elo, skill: s.full ? null : s.skill, go: s.go });
  }
}
