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
  home_score: number | null; away_score: number | null; status: string; feat?: any; updated_at?: string;
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
      status, updated_at: new Date().toISOString(),
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
      .select("id,sport,season,season_type,start_time,home,away,home_name,away_name,home_score,away_score,status")
      .eq("sport", SPORT).order("start_time").order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...(data as Game[]));
    if (data!.length < 1000) break;
  }
  return out;
}
// bajas: jugadores declarados "Out" por equipo
async function injuries(nameToAbbr: Map<string, string>) {
  const out = new Map<string, { out: number; names: string[] }>();
  try {
    const j = await espn("injuries");
    for (const tb of j?.injuries || []) {
      const abbr = tb.team?.abbreviation || nameToAbbr.get(tb.displayName) ||
        tb.injuries?.[0]?.athlete?.team?.abbreviation;
      if (!abbr) continue;
      const outs = (tb.injuries || []).filter((x: any) => /^out$/i.test(String(x.status || x.type?.description || "")));
      out.set(abbr, { out: outs.length, names: outs.map((x: any) => x.athlete?.displayName).filter(Boolean).slice(0, 6) });
    }
  } catch (_) { /* sin datos de bajas: el pronóstico sigue */ }
  return out;
}

// ---------- variables previas al partido ----------
const DEF_ELO = { k: 20, hca: 70, revert: 0.75, mean: 1505, pts_per_elo: 28 };
type Team = { elo: number; season: number; pf: number; pa: number; lastDay: number; recent: number[]; gp: number; w: number; l: number; name: string | null };
function features(games: Game[], eloP = DEF_ELO) {
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
    const f = {
      elo_h: r1(h.elo), elo_a: r1(a.elo),
      d: (h.elo - a.elo) / eloP.pts_per_elo,                  // diferencia de fuerza, en puntos
      hb2b: h.lastDay === day - 1 ? 1 : 0, ab2b: a.lastDay === day - 1 ? 1 : 0,
      form: avg(h.recent) - avg(a.recent),                     // margen medio últimos 10, local menos visita
      exp_total: (h.pf + a.pa) / 2 + (a.pf + h.pa) / 2,
      league, po: g.season_type === 3 ? 1 : 0,
      gp_h: h.gp, gp_a: a.gp, month: new Date(g.start_time).getUTCMonth() + 1,
    };
    feats.set(g.id, f);
    h.lastDay = day; a.lastDay = day;
    if (g.status === "post" && g.home_score != null && g.away_score != null) {
      const mov = g.home_score - g.away_score, tot = g.home_score + g.away_score;
      const dr = h.elo + eloP.hca - a.elo;
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
const M_VARS = ["const", "d", "hb2b", "ab2b", "form"];
const T_VARS = ["const", "exp_total", "league", "po", "b2b"];
const val = (f: any, v: string) => (v === "const" ? 1 : v === "b2b" ? f.hb2b + f.ab2b : Number(f[v] ?? 0));
function ols(X: number[][], y: number[], ridge = 1e-6) {
  const p = X[0].length;
  const A = Array.from({ length: p }, () => new Array(p + 1).fill(0));
  for (let i = 0; i < X.length; i++) {
    const x = X[i];
    for (let r = 0; r < p; r++) { A[r][p] += x[r] * y[i]; for (let c = 0; c < p; c++) A[r][c] += x[r] * x[c]; }
  }
  for (let r = 1; r < p; r++) A[r][r] += ridge * X.length;
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < p; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let j = c; j <= p; j++) A[r][j] -= k * A[c][j]; }
  }
  return A.map((row, i) => row[p] / row[i]);
}
type Row = { g: Game; f: any; margin: number; total: number };
function fit(rows: Row[]) {
  const mc = ols(rows.map((r) => M_VARS.map((v) => val(r.f, v))), rows.map((r) => r.margin));
  const tc = ols(rows.map((r) => T_VARS.map((v) => val(r.f, v))), rows.map((r) => r.total));
  const margin = Object.fromEntries(M_VARS.map((v, i) => [v, r3(mc[i])]));
  const total = Object.fromEntries(T_VARS.map((v, i) => [v, r3(tc[i])]));
  const res = rows.map((r) => r.margin - M_VARS.reduce((s, v) => s + margin[v] * val(r.f, v), 0));
  const sigma = Math.sqrt(avg(res.map((x) => x * x)));
  const meanMargin = avg(rows.map((r) => r.margin));
  return { margin, total, sigma: r3(sigma), base_margin: r3(meanMargin), elo: DEF_ELO, n_train: rows.length };
}
function predict(f: any, P: any) {
  const contrib: Record<string, number> = {};
  let m = 0;
  for (const v of Object.keys(P.margin)) { const c = P.margin[v] * val(f, v); contrib[v] = r1(c); m += c; }
  let t = 0;
  for (const v of Object.keys(P.total)) t += P.total[v] * val(f, v);
  return { p: Phi(m / P.sigma), margin: m, total: t, contrib };
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
function predRow(g: Game, f: any, P: any, version: string, kind: string, outs?: Map<string, any>) {
  const x = predict(f, P);
  const ho = outs?.get(g.home), ao = outs?.get(g.away);
  return {
    game_id: g.id, sport: SPORT, kind, model_version: version, start_time: g.start_time, season: g.season,
    season_type: g.season_type, home: g.home, away: g.away,
    p_home: r3(x.p), pred_margin: r1(x.margin), pred_total: r1(x.total),
    factors: {
      contrib: x.contrib, elo_h: f.elo_h, elo_a: f.elo_a, hb2b: f.hb2b, ab2b: f.ab2b, form: r1(f.form),
      exp_total: r1(f.exp_total), league: r1(f.league),
      ...(ho || ao ? { bajas_local: ho?.names || [], bajas_visita: ao?.names || [] } : {}),
    },
    home_out: outs ? (ho?.out ?? 0) : null, away_out: outs ? (ao?.out ?? 0) : null,
    updated_at: new Date().toISOString(),
  };
}

// Recalcula todo: variables, backtest de referencia (ajuste 2018-2023, prueba desde 2024) y modelo activo con toda la historia.
async function rebuild() {
  const games = await loadGames();
  const { feats, teams } = features(games);
  const done = games.filter(completed).filter((g) => g.season >= 2018);
  const train = done.filter((g) => g.season <= 2023).map((g) => toRow(g, feats.get(g.id)));
  const test = done.filter((g) => g.season >= 2024);
  const PB = fit(train);
  const btRows: any[] = [], mrows: any[] = [];
  for (const g of test) {
    const f = feats.get(g.id);
    const pr: any = predRow(g, f, PB, "baseline-2018-2023", "backtest");
    Object.assign(pr, evaluate(pr, g, f));
    btRows.push(pr);
    mrows.push({ p: pr.p_home, m: pr.pred_margin, t: pr.pred_total, am: pr.actual_margin, at: pr.actual_total, league: f.league, po: f.po, month: f.month });
  }
  const mt = metrics(mrows, PB.base_margin);
  const P = fit(done.map((g) => toRow(g, feats.get(g.id))));
  const version = `nba-v1-${new Date().toISOString().slice(0, 10)}`;
  await db.from("dial_fc_model").update({ active: false }).eq("sport", SPORT);
  const { error: me } = await db.from("dial_fc_model").upsert([
    { version: "baseline-2018-2023", sport: SPORT, active: false, params: PB, metrics: mt, notes: "Ajuste 2018-2023, probado desde 2023-24 en partidos que no vio." },
    { version, sport: SPORT, active: true, params: P, metrics: { backtest: mt }, notes: "Modelo activo: coeficientes con toda la historia desde 2017-18." },
  ], { onConflict: "version" });
  if (me) throw me;
  await upsertChunks("dial_fc_predictions", btRows, "game_id,kind");
  const gRows = games.filter((g) => feats.has(g.id)).map((g) => ({ ...g, feat: roundFeat(feats.get(g.id)) }));
  await upsertChunks("dial_fc_games", gRows, "id", 1000);
  await upsertChunks("dial_fc_ratings", ratingsRows(teams), "sport,team");
  return { games: games.length, train: train.length, test: test.length, baseline: PB, metrics: mt, active: version, params: P };
}
const roundFeat = (f: any) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === "number" ? r3(v as number) : v]));

async function activeModel() {
  const { data, error } = await db.from("dial_fc_model").select("*").eq("sport", SPORT).eq("active", true)
    .order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0];
}

// Ciclo normal: trae resultados y calendario, evalúa lo vencido, pronostica las próximas 36 horas.
async function auto() {
  const now = Date.now();
  const ingested = Object.values(await ingestKeys(dayKeys(now - 3 * DAY, now + 2 * DAY))).reduce((a, b) => a + b, 0);
  let model = await activeModel();
  if (!model) { await rebuild(); model = await activeModel(); }
  const games = await loadGames();
  const { feats, teams } = features(games, model.params.elo || DEF_ELO);
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
    preds = upcoming.map((g) => predRow(g, feats.get(g.id), model.params, model.version, "live", outs.size ? outs : undefined));
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
    const done = games.filter(completed).filter((g) => g.season >= 2018);
    const P = fit(done.map((g) => toRow(g, feats.get(g.id))));
    const version = `nba-v1-${new Date().toISOString().slice(0, 10)}`;
    await db.from("dial_fc_model").update({ active: false }).eq("sport", SPORT);
    await db.from("dial_fc_model").upsert({ version, sport: SPORT, active: true, params: P, metrics: model.metrics, notes: "Recalibración mensual." }, { onConflict: "version" });
    refit = version;
  }
  return { ingested, evaluated: evals.length, predicted: preds.length, model: model.version, refit };
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
    } else if (action === "rebuild") out = await rebuild();
    else if (action === "probe") {
      const j = await espn(u.searchParams.get("p") || "injuries");
      out = { sample: JSON.stringify(j).slice(0, 4000) };
    } else if (action === "auto") out = await auto();
    else return json({ error: "acción desconocida" }, 400);
    await finish(true, action === "probe" ? null : out);
    return json(out);
  } catch (e) {
    const msg = String((e as any)?.message || e);
    await finish(false, { error: msg });
    return json({ error: msg }, 500);
  }
});
