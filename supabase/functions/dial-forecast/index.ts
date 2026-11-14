// Dial Espejo · Pronósticos (piloto NBA).
// Incorpora partidos de ESPN, actualiza el rating Elo de cada equipo, guarda pronósticos antes de cada partido,
// los evalúa después y registra la causa probable de cada desvío. El modelo es una lista de variables con
// coeficientes (dial_fc_model.params): agregar una variable = calcularla en features() y sumarla al ajuste.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SPORT = "nba";
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

// ---------- utilidades ----------
const DAY = 86400000;
const dayNum = (iso: string) => Math.floor((Date.parse(iso) - 6 * 3600000) / DAY); // día de juego (hora de EE.UU.)
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
function erf(x: number) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
const r1 = (x: number) => Math.round(x * 10) / 10;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

async function espn(path: string) {
  const r = await fetch(`${ESPN}/${path}`, {
    headers: { "User-Agent": "Mozilla/5.0 (DialEspejo)", Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`ESPN ${r.status} ${path}`);
  return await r.json();
}

// ---------- ingesta ----------
type Game = {
  id: string; sport: string; season: number; season_type: number; start_time: string;
  home: string; away: string; home_name: string | null; away_name: string | null;
  home_score: number | null; away_score: number | null; status: string; neutral?: boolean; feat?: any; updated_at?: string;
};
function parseEvents(j: any): Game[] {
  const out: Game[] = [];
  for (const e of j?.events || []) {
    const c = e.competitions?.[0];
    const stype = Number(e.season?.type);
    if (!c || ![2, 3, 5].includes(stype)) continue;
    const h = c.competitors?.find((x: any) => x.homeAway === "home");
    const a = c.competitors?.find((x: any) => x.homeAway === "away");
    if (!h || !a) continue;
    const hid = Number(h.team?.id), aid = Number(a.team?.id);
    if (!(hid >= 1 && hid <= 30 && aid >= 1 && aid <= 30)) continue; // fuera All-Star y amistosos
    const t = e.status?.type || c.status?.type || {};
    const status = t.completed ? "post" : t.state === "in" ? "in" : t.state === "post" ? "ppd" : "pre";
    out.push({
      id: String(e.id), sport: SPORT, season: Number(e.season?.year), season_type: stype, start_time: e.date,
      home: h.team.abbreviation, away: a.team.abbreviation,
      home_name: h.team.displayName ?? null, away_name: a.team.displayName ?? null,
      home_score: status === "pre" ? null : Number(h.score ?? 0),
      away_score: status === "pre" ? null : Number(a.score ?? 0),
      status, neutral: !!c.neutralSite || (e.date >= "2020-07-25" && e.date <= "2020-10-15"), // burbuja 2020: sin local real
      updated_at: new Date().toISOString(),
    });
  }
  return out;
}
// ESPN acepta un día (AAAAMMDD) o un mes (AAAAMM) por consulta
async function ingestKeys(keys: string[]) {
  const counts: Record<string, number> = {};
  for (const k of keys) {
    const rows = parseEvents(await espn(`scoreboard?dates=${k}&limit=1000`));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("dial_fc_games").upsert(rows.slice(i, i + 500), { onConflict: "id" });
      if (error) throw error;
    }
    counts[k] = rows.length;
  }
  return counts;
}
const dayKeys = (fromT: number, toT: number) => { const k: string[] = []; for (let t = fromT; t <= toT; t += DAY) k.push(ymd(t)); return k; };
function monthKeys(from: string, to: string) { // "2016-10" .. "2017-06"
  const k: string[] = []; let [y, m] = from.split("-").map(Number); const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) { k.push(`${y}${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  return k;
}
async function loadGames(): Promise<Game[]> {
  const out: Game[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("dial_fc_games")
      .select("id,sport,season,season_type,start_time,home,away,home_name,away_name,home_score,away_score,status,neutral")
      .eq("sport", SPORT).order("start_time").order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...(data as Game[]));
    if (data!.length < 1000) break;
  }
  return out;
}
// reporte de bajas: estado de cada jugador por equipo (Out, Doubtful, Questionable, Day-To-Day…)
async function injuries(nameToAbbr: Map<string, string>) {
  const out = new Map<string, { out: number; names: string[]; list: { name: string; status: string }[] }>();
  try {
    const j = await espn("injuries");
    for (const tb of j?.injuries || []) {
      const abbr = tb.team?.abbreviation || nameToAbbr.get(tb.displayName) ||
        tb.injuries?.[0]?.athlete?.team?.abbreviation;
      if (!abbr) continue;
      const list = (tb.injuries || []).map((x: any) => ({ name: x.athlete?.displayName, status: String(x.status || x.type?.description || "") })).filter((x: any) => x.name);
      const outs = list.filter((x: any) => /^out$/i.test(x.status));
      out.set(abbr, { out: outs.length, names: outs.map((x: any) => x.name).slice(0, 6), list });
    }
  } catch (_) { /* sin datos de bajas: el pronóstico sigue */ }
  return out;
}
// probabilidad de jugar según el estado del reporte
const playProb = (st: string) => /out|suspen/i.test(st) ? 0 : /doubt/i.test(st) ? 0.25 : /question/i.test(st) ? 0.5 : /day/i.test(st) ? 0.6 : /probable/i.test(st) ? 0.9 : 1;

// planilla de un partido (ESPN) → filas de dial_fc_box
const numx = (x: any) => { const n = parseInt(String(x ?? ""), 10); return Number.isFinite(n) ? n : null; };
const pairx = (x: any) => { const [a, b] = String(x ?? "").split("-"); return [numx(a), numx(b)]; };
function parseBox(gameId: string, j: any) {
  const rows: any[] = [];
  for (const tp of j?.boxscore?.players || []) {
    const team = tp.team?.abbreviation, st = tp.statistics?.[0];
    if (!team || !st) continue;
    const lab: string[] = (st.labels || st.names || []).map((x: string) => String(x).toUpperCase());
    for (const a of st.athletes || []) {
      const s = a.stats || [], g = (k: string) => (lab.indexOf(k) >= 0 ? s[lab.indexOf(k)] : null);
      const [fgm, fga] = pairx(g("FG")), [fg3m, fg3a] = pairx(g("3PT")), [ftm, fta] = pairx(g("FT"));
      const dnp = !!a.didNotPlay || !s.length || numx(g("MIN")) === 0;
      if (!a.athlete?.id) continue;
      rows.push({ game_id: gameId, team, athlete_id: String(a.athlete.id), name: a.athlete.displayName ?? null,
        pos: a.athlete.position?.abbreviation ?? null, starter: !!a.starter, dnp, reason: a.reason ?? null,
        min: dnp ? 0 : numx(g("MIN")), pts: numx(g("PTS")), reb: numx(g("REB")), ast: numx(g("AST")), stl: numx(g("STL")),
        blk: numx(g("BLK")), tov: numx(g("TO")), fgm, fga, fg3m, fg3a, ftm, fta, oreb: numx(g("OREB")), pf: numx(g("PF")),
        pm: numx(String(g("+/-") ?? "").replace("+", "")) });
    }
  }
  return rows;
}
// planillas de los partidos recién terminados y recálculo de jugadores y ausencias de la temporada
async function refreshBoxes(season: number) {
  const { data: gs } = await db.from("dial_fc_games").select("id").eq("sport", SPORT).eq("status", "post").eq("box", false)
    .gte("start_time", new Date(Date.now() - 6 * DAY).toISOString()).limit(40);
  let n = 0;
  for (let i = 0; i < (gs || []).length; i += 8) {
    const res = await Promise.all(gs!.slice(i, i + 8).map(async (g) => {
      try { return { id: g.id, rows: parseBox(g.id, await espn(`summary?event=${g.id}`)) }; } catch (_) { return null; }
    }));
    for (const r of res) {
      if (!r || r.rows.length < 10) continue;
      const { error } = await db.from("dial_fc_box").upsert(r.rows, { onConflict: "game_id,athlete_id" });
      if (!error) { await db.from("dial_fc_games").update({ box: true }).eq("id", r.id); n++; }
    }
  }
  const { error } = await db.rpc("dial_fc_refresh", { p_from: season });
  if (error) throw error;
  return n;
}
async function loadAbs() {
  const m = new Map<string, any>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("dial_fc_game_abs").select("game_id,home_abs,away_abs").order("game_id").range(from, from + 999);
    if (error) throw error;
    for (const r of data!) m.set(r.game_id, r);
    if (data!.length < 1000) break;
  }
  return m;
}

// fuerza de jugadores previa a cada partido (local - visita) y su erraticidad, de dial-fc-players
async function loadPl() {
  const m = new Map<string, { m: number; v: number }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("dial_fc_game_pl").select("game_id,pl_margin,pl_var,n_players").order("game_id").range(from, from + 999);
    if (error) throw error;
    for (const r of data!) if (r.n_players >= 10) m.set(r.game_id, { m: r.pl_margin, v: r.pl_var });
    if (data!.length < 1000) break;
  }
  return m;
}
// actualiza el rating de jugadores con los partidos recién terminados (función dial-fc-players)
async function stepPlayers(adminKey: string) {
  try {
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/dial-fc-players?n=200&loops=2`, {
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "x-admin-key": adminKey },
      signal: AbortSignal.timeout(60000),
    });
    return r.ok ? (await r.json()).total : -1;
  } catch (_) { return -1; }
}

// ---------- variables previas al partido ----------
const ALT = new Set(["DEN", "UTAH"]); // canchas en altura
const CITY: Record<string, string> = { LAL: "LA", LAC: "LA", NY: "NY", BKN: "NY" }; // clásicos de la misma ciudad
const DIV: Record<string, string> = {};
for (const [d, ts] of Object.entries({ atl: "BOS BKN NY PHI TOR", cen: "CHI CLE DET IND MIL", se: "ATL CHA MIA ORL WSH", nw: "DEN MIN OKC POR UTAH", pac: "GS LAC LAL PHX SAC", sw: "DAL HOU MEM NO SA" }))
  for (const t of ts.split(" ")) DIV[t] = d;
const DEF_ELO = { k: 20, hca: 70, revert: 0.75, mean: 1505, pts_per_elo: 28 };
type Team = { elo: number; season: number; pf: number; pa: number; lastDay: number; recent: number[]; gp: number; w: number; l: number; name: string | null };
function features(games: Game[], eloP = DEF_ELO, abs?: Map<string, any>, pl?: Map<string, { m: number; v: number }>) {
  const S = new Map<string, Team>();
  let league = 215; // promedio móvil del total de puntos de la liga
  const feats = new Map<string, any>();
  const team = (abbr: string, season: number, name: string | null) => {
    let t = S.get(abbr);
    if (!t) { t = { elo: 1500, season, pf: league / 2, pa: league / 2, lastDay: -99, recent: [], gp: 0, w: 0, l: 0, name }; S.set(abbr, t); }
    if (t.season !== season) { // nueva temporada: el rating vuelve parcialmente al promedio
      t.elo = eloP.revert * t.elo + (1 - eloP.revert) * eloP.mean;
      t.pf = 0.5 * t.pf + 0.25 * league; t.pa = 0.5 * t.pa + 0.25 * league;
      t.recent = []; t.gp = 0; t.w = 0; t.l = 0; t.season = season;
    }
    if (name) t.name = name;
    return t;
  };
  for (const g of games) {
    if (g.status === "ppd") continue;
    const day = dayNum(g.start_time);
    const h = team(g.home, g.season, g.home_name), a = team(g.away, g.season, g.away_name);
    const hca = g.neutral ? 0 : 1;
    const f = {
      h: g.home, a: g.away, hca,
      alt: hca && ALT.has(g.home) ? 1 : 0,
      derby: hca && CITY[g.home] && CITY[g.home] === CITY[g.away] ? 1 : 0,
      div: hca && DIV[g.home] === DIV[g.away] ? 1 : 0,
      elo_h: r1(h.elo), elo_a: r1(a.elo),
      d: (h.elo - a.elo) / eloP.pts_per_elo,                  // diferencia de fuerza, en puntos
      hb2b: h.lastDay === day - 1 ? 1 : 0, ab2b: a.lastDay === day - 1 ? 1 : 0,
      form: avg(h.recent) - avg(a.recent),                     // margen medio últimos 10, local menos visita
      exp_total: (h.pf + a.pa) / 2 + (a.pf + h.pa) / 2,
      league, po: g.season_type === 3 ? 1 : 0,
      gp_h: h.gp, gp_a: a.gp, month: new Date(g.start_time).getUTCMonth() + 1,
      abs_h: abs?.get(g.id)?.home_abs || [], abs_a: abs?.get(g.id)?.away_abs || [],
      plm: pl?.get(g.id)?.m ?? 0, plv: pl?.get(g.id)?.v ?? 0, has_pl: pl?.has(g.id) ? 1 : 0,
      fin: g.season_type === 2 && Math.max(h.gp, a.gp) >= 72 ? 1 : 0,   // cierre de temporada regular: más incierto
    };
    feats.set(g.id, f);
    h.lastDay = day; a.lastDay = day;
    if (g.status === "post" && g.home_score != null && g.away_score != null) {
      const mov = g.home_score - g.away_score, tot = g.home_score + g.away_score;
      const dr = h.elo + (g.neutral ? 0 : eloP.hca) - a.elo;
      const pH = 1 / (1 + 10 ** (-dr / 400));
      const wd = mov > 0 ? dr : -dr;
      const mult = ((Math.abs(mov) + 3) ** 0.8) / (7.5 + 0.006 * wd);
      const delta = eloP.k * mult * ((mov > 0 ? 1 : 0) - pH);
      h.elo += delta; a.elo -= delta;
      const al = 0.08;
      h.pf += al * (g.home_score - h.pf); h.pa += al * (g.away_score - h.pa);
      a.pf += al * (g.away_score - a.pf); a.pa += al * (g.home_score - a.pa);
      league += 0.005 * (tot - league);
      h.recent.push(mov); a.recent.push(-mov);
      if (h.recent.length > 10) h.recent.shift();
      if (a.recent.length > 10) a.recent.shift();
      h.gp++; a.gp++;
      if (mov > 0) { h.w++; a.l++; } else { a.w++; h.l++; }
    }
  }
  return { feats, teams: S, league };
}

// ---------- modelo ----------
// Variantes que compiten en la prueba histórica; gana la que mejor pronostica partidos que no vio.
const BASE_VARS = ["hca", "d", "hb2b", "ab2b", "form"];
// (las variantes de localía específica, altura, rivalidad y peso propio por figura ya fueron descartadas en pruebas anteriores)
const ABS_VARS = [...BASE_VARS, "xs", "xs1", "xa", "xb"];
const VARIANTS: Record<string, string[]> = {
  "base": BASE_VARS,
  "ausencias": ABS_VARS,
  "jugadores": [...ABS_VARS, "plm"],
  "jugadores+incertidumbre": [...ABS_VARS, "plm"],
  // fase de temporada: la diferencia de fuerza pesa más al cierre de la regular; localía propia de playoffs
  "fase": [...ABS_VARS, "plm", "dl"],
  "fase+playoffs": [...ABS_VARS, "plm", "dl", "poh"],
};
// (total por fase, segunda mitad y enero, probado el 2026-11-09: sin mejora, descartado;
//  total por ritmo × eficiencia, probado el 2026-11-14: no agrega sobre puntos a favor y en contra, descartado)
const T_BY: Record<string, string[]> = {};
// conjuntos de variables para el total de puntos: compiten por error medio en temporadas no vistas
const TOTAL_SETS: Record<string, string[]> = {
  "actual": ["const", "exp_total", "league", "po", "b2b", "early"],
  "bajas": ["const", "exp_total", "league", "po", "b2b", "early", "ts", "ta"],   // estrellas y muy buenos que no juegan, de ambos equipos
};
// sin incertidumbre extra en el cierre de temporada
const NO_FIN = new Set<string>();
// variantes cuya dispersión depende del partido: erraticidad de los jugadores y cierre de temporada
const VAR_TERMS = new Set(["jugadores+incertidumbre", "fase", "fase+playoffs"]);
// ausencias: suma ponderada (w = probabilidad de no jugar; 1 si ya se sabe), visita menos local
const absW = (l: any[], fn: (x: any) => boolean) => (l || []).reduce((s, x) => s + (fn(x) ? (x.w ?? 1) : 0), 0);
const absD = (f: any, fn: (x: any) => boolean) => absW(f.abs_a, fn) - absW(f.abs_h, fn);
const plW = (l: any[], P: any) => (l || []).reduce((s, x) => s + (x.w ?? 1) * (P.player_g[x.id] || 0), 0);
const T_VARS = ["const", "exp_total", "league", "po", "b2b", "early"];
const SIG = 13.4; // desviación típica del margen de un partido
function val(f: any, v: string, P?: any) {
  if (v === "const") return 1;
  if (v === "b2b") return f.hb2b + f.ab2b;
  if (v === "early") return (f.gp_h ?? 99) + (f.gp_a ?? 99) < 8 ? 1 : 0;
  if (v === "team") return P?.team_g ? (f.hca ?? 1) * ((P.team_g[f.h] || 0) + (P.team_g[f.a] || 0)) / 2 : 0;
  if (v === "pair") return P?.pair_g ? (f.hca ?? 1) * (P.pair_g[`${f.h}-${f.a}`] || 0) : 0;
  if (v === "hca") return f.hca ?? 1;
  if (v === "dl") return f.po ? 0 : f.d * Math.min(Math.max(((f.gp_h ?? 0) + (f.gp_a ?? 0)) / 2 - 50, 0) / 32, 1);
  if (v === "poh") return (f.po || 0) * (f.hca ?? 1);
  if (v === "late") return !f.po && ((f.gp_h ?? 0) + (f.gp_a ?? 0)) / 2 >= 50 ? 1 : 0;
  if (v === "jan") return !f.po && f.month === 1 ? 1 : 0;
  if (v === "ts") return absW(f.abs_h, (x) => x.t === "s") + absW(f.abs_a, (x) => x.t === "s");
  if (v === "ta") return absW(f.abs_h, (x) => x.t === "a") + absW(f.abs_a, (x) => x.t === "a");
  if (v === "xs") return absD(f, (x) => x.t === "s");
  if (v === "xs1") return absD(f, (x) => x.t === "s" && x.k <= 2);
  if (v === "xa") return absD(f, (x) => x.t === "a");
  if (v === "xb") return absD(f, (x) => x.t === "b");
  if (v === "pl") return P?.player_g ? plW(f.abs_a, P) - plW(f.abs_h, P) : 0;
  return Number(f[v] ?? 0);
}
function ols(X: number[][], y: number[], ridge = 1e-6, w?: number[]) {
  const p = X[0].length;
  const A = Array.from({ length: p }, () => new Array(p + 1).fill(0));
  for (let i = 0; i < X.length; i++) {
    const x = X[i], wi = w ? w[i] : 1;
    for (let r = 0; r < p; r++) { A[r][p] += wi * x[r] * y[i]; for (let c = 0; c < p; c++) A[r][c] += wi * x[r] * x[c]; }
  }
  for (let r = 0; r < p; r++) A[r][r] += ridge * X.length;
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < p; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let j = c; j <= p; j++) A[r][j] -= k * A[c][j]; }
  }
  return A.map((row, i) => row[p] / row[i]);
}
type Row = { g: Game; f: any; margin: number; total: number };
const predM = (f: any, P: any) => Object.keys(P.margin).reduce((s, v) => s + P.margin[v] * val(f, v, P), 0);
// Peso a lo reciente: cada temporada hacia atrás pesa la mitad (media vida de 1 temporada, elegida en validación)
const HALF_LIFE = 1;
function fit(rows: Row[], mvars: string[], eff: any = {}) {
  const P0 = { ...eff };
  const last = Math.max(...rows.map((r) => r.g.season));
  const w = rows.map((r) => 0.5 ** ((last - r.g.season) / HALF_LIFE));
  const mc = ols(rows.map((r) => mvars.map((v) => val(r.f, v, P0))), rows.map((r) => r.margin), 1e-6, w);
  const TV: string[] = eff.tvars || T_VARS;
  const tc = ols(rows.map((r) => TV.map((v) => val(r.f, v))), rows.map((r) => r.total), 1e-6, w);
  const margin = Object.fromEntries(mvars.map((v, i) => [v, r3(mc[i])]));
  const total = Object.fromEntries(TV.map((v, i) => [v, r3(tc[i])]));
  const P: any = { margin, total, ...eff };
  const res = rows.map((r) => r.margin - predM(r.f, P));
  P.sigma = r3(Math.sqrt(avg(res.map((x) => x * x))));
  // dispersión para la probabilidad: la que mejor predice quién gana (log loss) en las dos últimas temporadas del ajuste
  const recent = rows.map((r, i) => ({ m: r.margin - res[i], y: r.margin > 0 ? 1 : 0, s: r.g.season })).filter((x) => x.s >= last - 1);
  let bestS = P.sigma, bestLL = Infinity;
  for (let sg = 9.5; sg <= 16.01; sg += 0.25) {
    const ll = avg(recent.map((x) => { const p = Math.min(Math.max(Phi(x.m / sg), 1e-4), 1 - 1e-4); return -(x.y * Math.log(p) + (1 - x.y) * Math.log(1 - p)); }));
    if (ll < bestLL) { bestLL = ll; bestS = sg; }
  }
  P.sigma_p = bestS;
  if (eff.var_terms) { // s² + a·erraticidad + b·cierre de temporada, elegidos por log loss
    const rr = rows.map((r, i) => ({ m: r.margin - res[i], y: r.margin > 0 ? 1 : 0, s: r.g.season, v: r.f.plv || 0, fin: r.f.fin || 0 })).filter((x) => x.s >= last - 1);
    let best = [bestLL, bestS, 0, 0];
    for (let sg = 5; sg <= 14.01; sg += 0.25) for (const a of [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8]) for (const b of (eff.no_fin ? [0] : [0, 10, 25, 45])) {
      const ll = avg(rr.map((x) => { const p = Math.min(Math.max(Phi(x.m / Math.sqrt(sg * sg + a * x.v + b * x.fin)), 1e-4), 1 - 1e-4); return -(x.y * Math.log(p) + (1 - x.y) * Math.log(1 - p)); }));
      if (ll < best[0]) best = [ll, sg, a, b];
    }
    P.sigma_p = best[1]; P.var_a = best[2]; P.var_fin = best[3];
  }
  delete P.var_terms; delete P.tvars; delete P.no_fin;
  P.base_margin = r3(avg(rows.filter((r) => r.f.hca !== 0).map((r) => r.margin)));
  P.elo = DEF_ELO; P.n_train = rows.length;
  return P;
}
// Localía específica: solo entra donde es significativa (|z| ≥ umbral) y encogida según cuánto ruido trae.
function effects(rows: Row[], P: any, wantPair: boolean) {
  const home = rows.filter((r) => r.f.hca === 1).map((r) => ({ r, e: r.margin - predM(r.f, P) }));
  const acc: Record<string, { sh: number; nh: number; sa: number; na: number }> = {};
  for (const { r, e } of home) {
    (acc[r.g.home] ??= { sh: 0, nh: 0, sa: 0, na: 0 }); (acc[r.g.away] ??= { sh: 0, nh: 0, sa: 0, na: 0 });
    acc[r.g.home].sh += e; acc[r.g.home].nh++; acc[r.g.away].sa += -e; acc[r.g.away].na++;
  }
  const raw = Object.entries(acc).map(([t, a]) => ({ t, g: a.sh / a.nh - a.sa / a.na, se2: SIG * SIG * (1 / a.nh + 1 / a.na) }));
  const mg = avg(raw.map((x) => x.g));
  const tau2 = Math.max(0, avg(raw.map((x) => (x.g - mg) ** 2)) - avg(raw.map((x) => x.se2)));
  const team_g: Record<string, number> = {}, team_z: Record<string, number> = {};
  for (const x of raw) {
    const z = (x.g - mg) / Math.sqrt(x.se2); team_z[x.t] = r1(z);
    if (Math.abs(z) >= 2 && tau2 > 0) team_g[x.t] = r3((x.g - mg) * tau2 / (tau2 + x.se2));
  }
  const out: any = { team_g, team_z, team_tau: r3(Math.sqrt(tau2)) };
  if (wantPair) {
    const P1 = { ...P, team_g, margin: { ...P.margin, team: 1 } };
    const pa: Record<string, { s: number; n: number }> = {};
    for (const { r } of home) { const k = `${r.g.home}-${r.g.away}`; (pa[k] ??= { s: 0, n: 0 }); pa[k].s += r.margin - predM(r.f, P1); pa[k].n++; }
    const pr = Object.entries(pa).map(([k, a]) => ({ k, m: a.s / a.n, se2: SIG * SIG / a.n }));
    const pt2 = Math.max(0, avg(pr.map((x) => x.m * x.m)) - avg(pr.map((x) => x.se2)));
    const pair_g: Record<string, number> = {};
    for (const x of pr) if (Math.abs(x.m) / Math.sqrt(x.se2) >= 2.5 && pt2 > 0) pair_g[x.k] = r3(x.m * pt2 / (pt2 + x.se2));
    out.pair_g = pair_g; out.pair_tau = r3(Math.sqrt(pt2));
  }
  return out;
}
// Peso propio de cada jugador sobre el promedio de su nivel: solo con 30+ ausencias y |z| ≥ 2, encogido según el ruido.
function playerEffects(rows: Row[], P: any) {
  const acc: Record<string, { s: number; n: number; name: string }> = {};
  for (const r of rows) {
    if (!r.f.abs_h.length && !r.f.abs_a.length) continue;
    const e = r.margin - predM(r.f, P);
    for (const x of r.f.abs_h) { (acc[x.id] ??= { s: 0, n: 0, name: x.n }); acc[x.id].s += e; acc[x.id].n++; }
    for (const x of r.f.abs_a) { (acc[x.id] ??= { s: 0, n: 0, name: x.n }); acc[x.id].s -= e; acc[x.id].n++; }
  }
  const pr = Object.entries(acc).filter(([, a]) => a.n >= 30).map(([id, a]) => ({ id, name: a.name, n: a.n, m: a.s / a.n, se2: SIG * SIG / a.n }));
  const tau2 = Math.max(0, avg(pr.map((x) => x.m * x.m)) - avg(pr.map((x) => x.se2)));
  const player_g: Record<string, number> = {}, player_n: Record<string, string> = {};
  for (const x of pr) if (tau2 > 0 && Math.abs(x.m) / Math.sqrt(x.se2) >= 2) { player_g[x.id] = r3(-x.m * tau2 / (tau2 + x.se2)); player_n[x.id] = x.name; }
  return { player_g, player_n, player_tau: r3(Math.sqrt(tau2)) };
}
function fitVariant(rows: Row[], name: string, tset?: string) {
  const vars = VARIANTS[name];
  const simple = vars.filter((v) => v !== "team" && v !== "pair" && v !== "pl");
  const tv = tset && TOTAL_SETS[tset] ? TOTAL_SETS[tset] : T_BY[name];
  let P = fit(rows, simple, { ...(VAR_TERMS.has(name) ? { var_terms: true } : {}), ...(tv ? { tvars: tv } : {}), ...(NO_FIN.has(name) ? { no_fin: true } : {}) });
  if (vars.includes("pl")) P = fit(rows, vars, playerEffects(rows, P));
  else if (vars.length !== simple.length) P = fit(rows, vars, effects(rows, P, vars.includes("pair")));
  P.variant = name; if (tset) P.tset = tset;
  return P;
}
function predict(f: any, P: any) {
  const contrib: Record<string, number> = {};
  let m = 0;
  for (const v of Object.keys(P.margin)) { const c = P.margin[v] * val(f, v, P); contrib[v] = r1(c); m += c; }
  let t = 0;
  for (const v of Object.keys(P.total)) t += P.total[v] * val(f, v);
  const s0 = P.sigma_p || P.sigma;
  const sd0 = Math.sqrt(s0 * s0 + (P.var_a || 0) * (f.plv || 0) + (P.var_fin || 0) * (f.fin || 0)); // erraticidad y cierre de temporada
  const sd = Math.sqrt(sd0 * sd0 + (f.extra_var || 0)); // dudas del reporte: pronóstico menos seguro
  return { p: Phi(m / sd), margin: m, total: t, contrib, sd, sd0 };
}

// ---------- evaluación ----------
function evaluate(pr: any, g: Game, f: any) {
  const am = g.home_score! - g.away_score!, at = g.home_score! + g.away_score!;
  const correct = (pr.p_home >= 0.5) === (am > 0);
  const favHome = pr.p_home >= 0.5, pfav = Math.max(pr.p_home, 1 - pr.p_home);
  const em = am - pr.pred_margin, et = at - pr.pred_total;
  const causes: string[] = [];
  if (!correct && pfav >= 0.7) causes.push("sorpresa con favorito claro");
  if (!correct && f && ((favHome && f.hb2b) || (!favHome && f.ab2b))) causes.push("favorito en back-to-back");
  if (pr.home_out != null && pr.away_out != null) {
    const favOut = favHome ? pr.home_out : pr.away_out, dogOut = favHome ? pr.away_out : pr.home_out;
    if (!correct && favOut - dogOut >= 2) causes.push("bajas del favorito");
    if (correct && dogOut - favOut >= 3) causes.push("bajas del rival");
  }
  if (Math.abs(em) >= 20) causes.push("margen muy distinto al esperado");
  if (Math.abs(et) >= 25) causes.push(et > 0 ? "muchos más puntos de lo esperado" : "muchos menos puntos de lo esperado");
  if (!correct && !causes.length) causes.push(pfav < 0.6 ? "partido parejo" : "desvío sin causa identificada");
  return {
    actual_margin: am, actual_total: at, correct, err_margin: r1(em), err_total: r1(et), causes,
    evaluated_at: new Date().toISOString(),
  };
}
function metrics(rows: { p: number; m: number; t: number; am: number; at: number; league: number; po: number; month: number }[], baseMargin: number) {
  const n = rows.length;
  if (!n) return { n: 0 };
  const acc = avg(rows.map((r) => ((r.p >= 0.5) === (r.am > 0) ? 1 : 0)));
  const bins: any[] = [];
  for (const [lo, hi] of [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.01]]) {
    const b = rows.filter((r) => { const q = Math.max(r.p, 1 - r.p); return q >= lo && q < hi; });
    if (b.length) bins.push({ desde: lo, hasta: Math.min(hi, 1), n: b.length,
      prob_media: r3(avg(b.map((r) => Math.max(r.p, 1 - r.p)))),
      acierto: r3(avg(b.map((r) => ((r.p >= 0.5) === (r.am > 0) ? 1 : 0)))) });
  }
  const sub = (fn: (r: any) => boolean) => { const b = rows.filter(fn); return b.length ? { n: b.length, acierto: r3(avg(b.map((r) => ((r.p >= 0.5) === (r.am > 0) ? 1 : 0)))) } : null; };
  return {
    n,
    acierto: r3(acc),
    acierto_local: r3(avg(rows.map((r) => (r.am > 0 ? 1 : 0)))),
    mae_margen: r1(avg(rows.map((r) => Math.abs(r.am - r.m)))),
    mae_margen_ref: r1(avg(rows.map((r) => Math.abs(r.am - baseMargin)))),
    mae_total: r1(avg(rows.map((r) => Math.abs(r.at - r.t)))),
    mae_total_ref: r1(avg(rows.map((r) => Math.abs(r.at - r.league)))),
    brier: r3(avg(rows.map((r) => (r.p - (r.am > 0 ? 1 : 0)) ** 2))),
    calibracion: bins,
    octubre: sub((r) => r.month === 10 && !r.po),
    playoffs: sub((r) => r.po === 1),
  };
}

// ---------- acciones ----------
async function upsertChunks(table: string, rows: any[], onConflict: string, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + size), { onConflict });
    if (error) throw error;
  }
}
function ratingsRows(teams: Map<string, Team>) {
  return [...teams.entries()].map(([abbr, t]) => ({
    sport: SPORT, team: abbr, team_name: t.name, elo: r1(t.elo), season: t.season, games: t.gp, wins: t.w, losses: t.l,
    extra: { pts_favor: r1(t.pf), pts_contra: r1(t.pa), forma10: r1(avg(t.recent)) }, updated_at: new Date().toISOString(),
  }));
}
const completed = (g: Game) => g.status === "post" && g.home_score != null && g.away_score != null;
const toRow = (g: Game, f: any): Row => ({ g, f, margin: g.home_score! - g.away_score!, total: g.home_score! + g.away_score! });
// puntos que resta cada baja según el modelo (nivel, inicio de la ausencia y peso propio)
function absPts(x: any, P: any) {
  const c = P.margin || {};
  const v = (x.t === "s" ? c.xs || 0 : x.t === "a" ? c.xa || 0 : x.t === "b" ? c.xb || 0 : 0) + (x.t === "s" && x.k <= 2 ? c.xs1 || 0 : 0) +
    (c.pl && P.player_g ? c.pl * (P.player_g[x.id] || 0) : 0);
  return r1(v);
}
function predRow(g: Game, f: any, P: any, version: string, kind: string, outs?: Map<string, any>) {
  const x = predict(f, P);
  const ho = outs?.get(g.home), ao = outs?.get(g.away);
  const usesAbs = "xs" in (P.margin || {});
  const bajas = usesAbs ? [...(f.abs_h || []).map((b: any) => ({ ...b, eq: g.home })), ...(f.abs_a || []).map((b: any) => ({ ...b, eq: g.away }))]
    .map((b: any) => ({ n: b.n, eq: b.eq, t: b.t, k: b.k, w: b.w ?? 1, st: b.st ?? null, pts: absPts(b, P) })).filter((b: any) => b.pts > 0) : [];
  return {
    game_id: g.id, sport: SPORT, kind, model_version: version, start_time: g.start_time, season: g.season,
    season_type: g.season_type, home: g.home, away: g.away,
    p_home: r3(x.p), pred_margin: r1(x.margin), pred_total: r1(x.total),
    factors: {
      contrib: x.contrib, elo_h: f.elo_h, elo_a: f.elo_a, hb2b: f.hb2b, ab2b: f.ab2b, form: r1(f.form),
      exp_total: r1(f.exp_total), league: r1(f.league),
      ...(ho || ao ? { bajas_local: ho?.names || [], bajas_visita: ao?.names || [] } : {}),
      ...(bajas.length ? { bajas_calc: bajas } : {}),
      ...(f.extra_var ? { sd: r1(x.sd), sd_base: r1(x.sd0) } : {}),
      ...(f.pl_live ? { jugadores: f.pl_live } : {}),
    },
    home_out: outs ? (ho?.out ?? 0) : null, away_out: outs ? (ao?.out ?? 0) : null,
    updated_at: new Date().toISOString(),
  };
}

// Recalcula todo: variables, prueba histórica de cada variante (ajuste 2017-18 a 2022-23, prueba desde 2023-24)
// y modelo activo con la variante ganadora y toda la historia.
async function rebuild(force?: string | null, dry = false) {
  const games = await loadGames();
  const [abs, pl] = await Promise.all([loadAbs(), loadPl()]);
  const { feats, teams } = features(games, DEF_ELO, abs, pl);
  const done = games.filter(completed).filter((g) => g.season >= 2018 && abs.has(g.id) && pl.has(g.id)); // solo partidos con planilla
  const train = done.filter((g) => g.season <= 2023).map((g) => toRow(g, feats.get(g.id)));
  const test = done.filter((g) => g.season >= 2024);
  // total de puntos: elegir el conjunto de variables con menor error medio en las temporadas no vistas
  const lastTr = Math.max(...train.map((r) => r.g.season));
  const wTr = train.map((r) => 0.5 ** ((lastTr - r.g.season) / HALF_LIFE));
  const totales: any = {};
  let tbest: any = null;
  for (const [tn, tv] of Object.entries(TOTAL_SETS)) {
    const c = ols(train.map((r) => tv.map((v) => val(r.f, v))), train.map((r) => r.total), 1e-6, wTr);
    const errs = test.map((g) => { const f = feats.get(g.id); return Math.abs(g.home_score! + g.away_score! - tv.reduce((s, v, i) => s + c[i] * val(f, v), 0)); });
    const bySeason: any = {};
    test.forEach((g, i) => { (bySeason[g.season] ??= []).push(errs[i]); });
    const mae = avg(errs);
    totales[tn] = { mae: Math.round(mae * 1000) / 1000, por_temporada: Object.fromEntries(Object.entries(bySeason).map(([k, e]: any) => [k, Math.round(avg(e) * 100) / 100])),
      coef: Object.fromEntries(tv.map((v, i) => [v, r3(c[i])])) };
    if (!tbest || mae < tbest.mae - 0.03) tbest = { name: tn, mae };   // una variante más compleja debe bajar al menos 0,03 pts
  }
  const tset = tbest.name;
  const variantes: any = { _totales: { elegido: tset, ...totales } };
  let best: any = null;
  for (const name of Object.keys(VARIANTS)) {
    const PB = fitVariant(train, name, tset);
    const btRows: any[] = [], mrows: any[] = [];
    for (const g of test) {
      const f = feats.get(g.id);
      const pr: any = predRow(g, f, PB, "baseline-2018-2023", "backtest");
      Object.assign(pr, evaluate(pr, g, f));
      btRows.push(pr);
      mrows.push({ p: pr.p_home, m: pr.pred_margin, t: pr.pred_total, am: pr.actual_margin, at: pr.actual_total, league: f.league, po: f.po, month: f.month, season: g.season });
    }
    const brier = avg(mrows.map((r) => (r.p - (r.am > 0 ? 1 : 0)) ** 2));
    const mae = avg(mrows.map((r) => Math.abs(r.am - r.m)));
    const mt = metrics(mrows, PB.base_margin);
    const grp = (fn: (r: any) => string) => { const o: any = {}; for (const r of mrows) (o[fn(r)] ??= []).push(r);
      return Object.fromEntries(Object.entries(o).map(([k, b]: any) => [k, { n: b.length, acierto: r3(avg(b.map((r: any) => ((r.p >= 0.5) === (r.am > 0) ? 1 : 0)))),
        brier: Math.round(avg(b.map((r: any) => (r.p - (r.am > 0 ? 1 : 0)) ** 2)) * 1e5) / 1e5, conf: r3(avg(b.map((r: any) => Math.max(r.p, 1 - r.p)))),
        mae_total: Math.round(avg(b.map((r: any) => Math.abs(r.at - r.t))) * 100) / 100 }])); };
    variantes[name] = { brier: Math.round(brier * 1e5) / 1e5, mae_margen: Math.round(mae * 1000) / 1000, acierto: mt.acierto,
      mae_total: Math.round(avg(mrows.map((r) => Math.abs(r.at - r.t))) * 100) / 100, sigma_p: PB.sigma_p, var_a: PB.var_a, var_fin: PB.var_fin,
      por_temporada: grp((r) => String(r.season)), por_fase: grp((r) => r.po ? "playoffs" : [10, 11, 12].includes(r.month) ? "oct-dic" : [1, 2].includes(r.month) ? "ene-feb" : "mar-abr"),
      coef: PB.margin, equipos: PB.team_g, cruces: PB.pair_g ? Object.keys(PB.pair_g).length : undefined };
    // gana la de menor Brier; una variante más compleja debe mejorar de verdad (parsimonia)
    const cand = { name, PB, btRows, mt, brier };
    if (force ? name === force : (!best || brier < best.brier - 0.0002)) best = cand;
  }
  if (dry) return { elegido: best.name, variantes };
  const P = fitVariant(done.map((g) => toRow(g, feats.get(g.id))), best.name, tset);
  const version = `nba-${best.name}-${new Date().toISOString().slice(0, 10)}`;
  await db.from("dial_fc_model").update({ active: false }).eq("sport", SPORT);
  const { error: me } = await db.from("dial_fc_model").upsert([
    { version: "baseline-2018-2023", sport: SPORT, active: false, params: best.PB, metrics: { ...best.mt, variantes }, notes: `Ajuste 2017-18 a 2022-23, probado desde 2023-24 en partidos que no vio. Variante: ${best.name}.` },
    { version, sport: SPORT, active: true, params: P, metrics: { backtest: best.mt, variantes }, notes: "Modelo activo: variante ganadora con toda la historia desde 2017-18." },
  ], { onConflict: "version" });
  if (me) throw me;
  await upsertChunks("dial_fc_predictions", best.btRows, "game_id,kind");
  const gRows = games.filter((g) => feats.has(g.id)).map((g) => ({ ...g, feat: roundFeat(feats.get(g.id)) }));
  await upsertChunks("dial_fc_games", gRows, "id", 1000);
  await upsertChunks("dial_fc_ratings", ratingsRows(teams), "sport,team");
  return { games: games.length, train: train.length, test: test.length, elegido: best.name, variantes, metrics: best.mt, active: version, params: P };
}
const roundFeat = (f: any) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== "abs_h" && k !== "abs_a").map(([k, v]) => [k, typeof v === "number" ? r3(v as number) : v]));

async function activeModel() {
  const { data, error } = await db.from("dial_fc_model").select("*").eq("sport", SPORT).eq("active", true)
    .order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0];
}

// Ciclo normal: trae resultados y calendario, evalúa lo vencido, pronostica las próximas 36 horas.
async function auto(adminKey: string) {
  const now = Date.now();
  const ingested = Object.values(await ingestKeys(dayKeys(now - 3 * DAY, now + 2 * DAY))).reduce((a, b) => a + b, 0);
  let model = await activeModel();
  if (!model) { await rebuild(); model = await activeModel(); }
  let games = await loadGames();
  const season = Math.max(...games.map((g) => g.season));
  let boxes = 0;
  try { boxes = await refreshBoxes(season); } catch (_) { /* sin planillas nuevas: se sigue con lo que hay */ }
  const plSteps = await stepPlayers(adminKey);
  const [abs, pl] = await Promise.all([loadAbs(), loadPl()]);
  const { feats, teams } = features(games, model.params.elo || DEF_ELO, abs, pl);
  const byId = new Map(games.map((g) => [g.id, g]));

  // 1) evaluar pronósticos vencidos
  const { data: pend, error: pe } = await db.from("dial_fc_predictions").select("*")
    .eq("sport", SPORT).eq("kind", "live").is("evaluated_at", null).lt("start_time", new Date(now).toISOString());
  if (pe) throw pe;
  const evals: any[] = [];
  for (const pr of pend || []) {
    const g = byId.get(pr.game_id);
    if (g && completed(g)) evals.push({ ...pr, ...evaluate(pr, g, feats.get(g.id)) });
  }
  if (evals.length) await upsertChunks("dial_fc_predictions", evals, "game_id,kind");

  // 2) pronosticar lo que viene (se actualiza hasta el inicio; después queda congelado)
  const upcoming = games.filter((g) => g.status === "pre" && Date.parse(g.start_time) > now && Date.parse(g.start_time) < now + 36 * 3600000);
  let preds: any[] = [];
  if (upcoming.length) {
    const nameToAbbr = new Map<string, string>();
    for (const g of games) { if (g.home_name) nameToAbbr.set(g.home_name, g.home); if (g.away_name) nameToAbbr.set(g.away_name, g.away); }
    const outs = await injuries(nameToAbbr);
    // bajas del reporte → jugadores con su nivel; las dudas entran con su probabilidad y agregan incertidumbre
    const { data: pls } = await db.from("dial_fc_players").select("athlete_id,name,team,tier,mpg,last_game").eq("season", season).in("tier", ["s", "a", "b"]).gte("mpg", 15);
    const byName = new Map((pls || []).map((p: any) => [`${p.team}|${p.name}`, p]));
    const P = model.params;
    const liveAbs = (team: string) => {
      const list: any[] = [];
      for (const it of outs.get(team)?.list || []) {
        const p = playProb(it.status), pl = byName.get(`${team}|${it.name}`);
        if (p >= 1 || !pl) continue;
        const missed = games.filter((x) => completed(x) && (x.home === team || x.away === team) && x.start_time > pl.last_game).length;
        list.push({ id: pl.athlete_id, n: pl.name, t: pl.tier, k: missed + 1, w: r3(1 - p), st: it.status, p });
      }
      return list;
    };
    // plantel de cada equipo con su rating de impacto (jugadores activos en las últimas 3 semanas)
    const { data: roster } = await db.from("dial_fc_pstate").select("athlete_id,name,team,r,lvl,m2,mpg,n")
      .gte("last_game", new Date(now - 21 * DAY).toISOString());
    const rosterOf = (team: string) => (roster || []).filter((p: any) => p.team === team);
    const injOf = (team: string) => new Map((outs.get(team)?.list || []).map((it: any) => [it.name, it.status]));
    const cPl = P.margin?.plm || 0;
    // fuerza esperada: minutos habituales por probabilidad de jugar, reescalados a 240; idem erraticidad
    const teamStr = (team: string, skip?: string, force?: string) => {
      const inj = injOf(team);
      const lst = rosterOf(team).map((p: any) => {
        const st = inj.get(p.name);
        let q = st ? playProb(String(st)) : 1;
        if (p.athlete_id === skip) q = 0; else if (p.athlete_id === force) q = 1;
        return { p, e: Math.max(p.n >= 3 ? p.mpg : 20, 1) * q, st, q: st ? playProb(String(st)) : 1 };
      });
      const sum = lst.reduce((a: number, x: any) => a + x.e, 0) || 1;
      let s = 0, v = 0;
      for (const x of lst) { const e = x.e * 240 / sum; s += e / 48 * x.p.r; v += (e / 48) ** 2 * Math.max(x.p.n >= 3 ? x.p.m2 - x.p.lvl ** 2 : 50, 1); }
      return { s, v, lst };
    };
    preds = upcoming.map((g) => {
      const f: any = { ...feats.get(g.id), abs_h: liveAbs(g.home), abs_a: liveAbs(g.away) };
      const H = teamStr(g.home), A = teamStr(g.away);
      if (H.lst.length >= 8 && A.lst.length >= 8) {
        f.plm = H.s - A.s; f.plv = H.v + A.v;
        // cuánto cambia la fuerza si cada jugador en duda juega o no
        const dud = (T: any, team: string, sign: number) => T.lst.filter((x: any) => x.q > 0 && x.q < 1).map((x: any) =>
          ({ id: x.p.athlete_id, name: x.p.name, p: x.q, d: sign * (teamStr(team, undefined, x.p.athlete_id).s - teamStr(team, x.p.athlete_id).s) }));
        f.pl_dud = [...dud(H, g.home, 1), ...dud(A, g.away, -1)];
        f.pl_live = { local: r1(H.s), visita: r1(A.s), n_local: H.lst.length, n_visita: A.lst.length };
      }
      // incertidumbre por dudas: efecto de la baja según el modelo (nivel y rating de impacto), con su probabilidad
      const dmap = new Map((f.pl_dud || []).map((x: any) => [x.id, x]));
      let ev = 0;
      for (const b of [...f.abs_h, ...f.abs_a].filter((b: any) => b.p > 0)) {
        const pd: any = dmap.get(b.id); dmap.delete(b.id);
        const d = absPts({ ...b }, P) + Math.abs(cPl * (pd?.d || 0));
        ev += d * d * b.p * (1 - b.p);
      }
      for (const pd of dmap.values() as any) ev += (cPl * pd.d) ** 2 * pd.p * (1 - pd.p);
      f.extra_var = ev;
      return predRow(g, f, P, model.version, "live", outs.size ? outs : undefined);
    });
    await upsertChunks("dial_fc_predictions", preds, "game_id,kind");
  }

  // 3) variables de los partidos recientes y próximos, ratings
  const recent = games.filter((g) => feats.has(g.id) && Math.abs(Date.parse(g.start_time) - now) < 4 * DAY)
    .map((g) => ({ ...g, feat: roundFeat(feats.get(g.id)) }));
  await upsertChunks("dial_fc_games", recent, "id");
  await upsertChunks("dial_fc_ratings", ratingsRows(teams), "sport,team");

  // 4) una vez al mes, recalcular coeficientes con toda la historia
  let refit = null;
  if (now - Date.parse(model.created_at) > 30 * DAY) {
    const done = games.filter(completed).filter((g) => g.season >= 2018 && abs.has(g.id) && (!("plm" in (model.params.margin || {})) || pl.has(g.id)));
    const P = fitVariant(done.map((g) => toRow(g, feats.get(g.id))), model.params.variant || "base", model.params.tset);
    const version = `nba-${P.variant}-${new Date().toISOString().slice(0, 10)}`;
    await db.from("dial_fc_model").update({ active: false }).eq("sport", SPORT);
    await db.from("dial_fc_model").upsert({ version, sport: SPORT, active: true, params: P, metrics: model.metrics, notes: "Recalibración mensual." }, { onConflict: "version" });
    refit = version;
  }
  return { ingested, boxes, jugadores: plSteps, evaluated: evals.length, predicted: preds.length, model: model.version, refit };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);
  const action = u.searchParams.get("action") || "auto";
  const hk = req.headers.get("x-admin-key");
  const { data: sec } = await db.from("dial_fc_secrets").select("value").eq("name", "admin_key").maybeSingle();
  const admin = !!sec?.value && hk === sec.value;
  const ADMIN_ONLY = new Set(["backfill", "rebuild", "probe"]);
  if (ADMIN_ONLY.has(action) && !admin) return json({ error: "no autorizado" }, 403);

  if (action === "auto" && !admin) { // la app lo llama al abrir NBA: como mucho una vez por hora
    const { data: last } = await db.from("dial_fc_runs").select("started_at").eq("sport", SPORT).eq("action", "auto")
      .eq("ok", true).order("started_at", { ascending: false }).limit(1);
    if (last?.[0] && Date.now() - Date.parse(last[0].started_at) < 55 * 60000) return json({ skipped: true, last: last[0].started_at });
  }
  const { data: run } = await db.from("dial_fc_runs").insert({ sport: SPORT, action }).select("id").single();
  const finish = async (ok: boolean, summary: any) => {
    if (run) await db.from("dial_fc_runs").update({ ok, summary, finished_at: new Date().toISOString() }).eq("id", run.id);
  };
  try {
    let out: any;
    if (action === "backfill") {
      out = { ingested: await ingestKeys(monthKeys(u.searchParams.get("from")!, u.searchParams.get("to")!)) };
    } else if (action === "rebuild") out = await rebuild(u.searchParams.get("variant"), u.searchParams.get("dry") === "1");
    else if (action === "probe") {
      const j = await espn(u.searchParams.get("p") || "injuries");
      out = { sample: JSON.stringify(j).slice(0, 4000) };
    } else if (action === "auto") out = await auto(sec!.value);
    else return json({ error: "acción desconocida" }, 400);
    await finish(true, action === "probe" ? null : out);
    return json(out);
  } catch (e) {
    const msg = String((e as any)?.message || e);
    await finish(false, { error: msg });
    return json({ error: msg }, 500);
  }
});
