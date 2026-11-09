// Dial Espejo · Pronósticos: rating de impacto por jugador que aprende partido a partido (orden cronológico).
// Para cada partido terminado guarda, ANTES de actualizar, la fuerza de los jugadores (local - visita, pts) y su erraticidad,
// y luego ajusta el rating de cada jugador con el margen real (filtro de Kalman) y su perfil (nivel, volumen, minutos, erraticidad).
// Parámetros elegidos en el laboratorio (bloque 3, validación 2023-24/2024-25).
import { createClient } from "jsr:@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

const R = 170, Q = 0.02, P_SEASON = 3, REVERT = 0.8, HL = 20, N0 = 10, P_NEW = 16;
const ALPHA = 1 - Math.pow(0.5, 1 / HL);
const PRIOR = { c: -0.989, lvl: 0.276, use: -22.262, mpg: 0.04 };
const THR = { a: 11.166, b: 6.349, x: 0.686, y: 1.038 };
const SEG_VAR: Record<string, number> = { AX: 54.5, AY: 77.6, BX: 33.0, BY: 39.0, BZ: 59.6, CX: 14.8, CY: 23.2, CZ: 19.4 };
const prior = (lvl: number, use: number, mpg: number) => PRIOR.c + PRIOR.lvl * lvl + PRIOR.use * use + PRIOR.mpg * mpg;
const segment = (p: any) => {
  const cv = Math.sqrt(Math.max(p.m2 - p.lvl * p.lvl, 0)) / Math.max(p.lvl, 1);
  return (p.lvl >= THR.a ? "A" : p.lvl >= THR.b ? "B" : "C") + (cv <= THR.x ? "X" : cv <= THR.y ? "Y" : "Z");
};
const gscore = (b: any) => b.pts + 0.4 * b.fgm - 0.7 * b.fga - 0.4 * (b.fta - b.ftm) + 0.7 * b.oreb + 0.3 * (b.reb - b.oreb)
  + b.stl + 0.7 * b.ast + 0.7 * b.blk - 0.4 * b.pf - b.tov;

async function inChunks<T>(ids: string[], size: number, f: (c: string[]) => Promise<T[]>) {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...(await f(ids.slice(i, i + size))));
  return out;
}

async function step(limit: number) {
  const { data: games, error } = await db.rpc("dial_fc_pl_next", { n: limit });
  if (error) throw new Error(error.message);
  if (!games?.length) return { procesados: 0 };
  const ids = games.map((g: any) => g.id);
  // planilla de los partidos (solo quienes jugaron), paginada
  const box = await inChunks(ids, 60, async (c) => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("dial_fc_box")
        .select("game_id,team,athlete_id,name,min,pts,reb,ast,stl,blk,tov,fgm,fga,ftm,fta,oreb,pf")
        .in("game_id", c).gt("min", 0).order("game_id").order("athlete_id").range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  });
  const byGame = new Map<string, any[]>();
  for (const b of box) {
    for (const k of ["min", "pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "ftm", "fta", "oreb", "pf"]) b[k] = Number(b[k] ?? 0);
    (byGame.get(b.game_id) || byGame.set(b.game_id, []).get(b.game_id)!).push(b);
  }
  const aids = [...new Set(box.map((b) => b.athlete_id))];
  const st = new Map<string, any>();
  for (const s of await inChunks(aids, 150, async (c) => {
    const { data, error } = await db.from("dial_fc_pstate").select("*").in("athlete_id", c);
    if (error) throw new Error(error.message);
    return data || [];
  })) st.set(s.athlete_id, s);

  const touched = new Set<string>(), gout: any[] = [];
  for (const g of games) {
    const rows = byGame.get(g.id) || [];
    if (rows.length < 10) { gout.push({ game_id: g.id, pl_margin: 0, pl_var: 0, n_players: rows.length }); continue; }
    // porción de jugadas de cada jugador dentro de su equipo
    const tu: Record<string, number> = {};
    for (const b of rows) { b.use = b.fga + 0.44 * b.fta + b.tov; tu[b.team] = (tu[b.team] || 0) + b.use; }
    const side: Record<number, [any, any][]> = { 1: [], 0: [] };
    for (const b of rows) {
      let p = st.get(b.athlete_id);
      if (!p) { p = { athlete_id: b.athlete_id, r: prior(0, 0, 0), p: P_NEW, lvl: 0, use: 0, mpg: 0, m2: 0, n: 0, season: g.season }; st.set(b.athlete_id, p); }
      if (p.season !== g.season) { p.r = REVERT * p.r + (1 - REVERT) * prior(p.lvl, p.use, p.mpg); p.p += P_SEASON; p.season = g.season; }
      p.p += Q;
      side[b.team === g.home ? 1 : 0].push([b, p]);
    }
    const strength = (lst: [any, any][]) => {
      const em = lst.map(([, p]) => Math.max(p.n >= 3 ? p.mpg : 20, 1));
      const sum = em.reduce((a, x) => a + x, 0);
      let s = 0, w = 0;
      lst.forEach(([, p], i) => {
        const e = em[i] * 240 / sum;
        s += e / 48 * p.r;
        let v = p.n >= 3 ? p.m2 - p.lvl * p.lvl : 50;
        if (p.n < 60) { const k = p.n / (p.n + N0); v = k * v + (1 - k) * (SEG_VAR[segment(p)] ?? 50); }
        w += (e / 48) ** 2 * Math.max(v, 1);
      });
      return [s, w];
    };
    const [sh, wh] = strength(side[1]), [sa, wa] = strength(side[0]);
    gout.push({ game_id: g.id, pl_margin: sh - sa, pl_var: wh + wa, n_players: rows.length });
    // ajuste del rating con el margen real
    const xs: [number, any][] = [...side[1].map(([b, p]) => [b.min / 48, p] as [number, any]), ...side[0].map(([b, p]) => [-b.min / 48, p] as [number, any])];
    const pred = xs.reduce((a, [x, p]) => a + x * p.r, 0) + (g.neutral ? 0 : 2);
    const S = xs.reduce((a, [x, p]) => a + x * x * p.p, 0) + R;
    const err = g.margin - pred;
    for (const [x, p] of xs) { const k = p.p * x / S; p.r += k * err; p.p = Math.max(p.p - k * x * p.p, 0.05); }
    // perfil dinámico
    for (const [b, p] of [...side[1], ...side[0]]) {
      p.n += 1;
      const a = Math.max(ALPHA, 1 / p.n), gs = gscore(b), us = b.use / Math.max(tu[b.team], 1);
      p.lvl += a * (gs - p.lvl); p.m2 += a * (gs * gs - p.m2); p.use += a * (us - p.use); p.mpg += a * (b.min - p.mpg);
      p.name = b.name; p.team = b.team; p.last_game = g.start_time;
      touched.add(b.athlete_id);
    }
  }
  const states = [...touched].map((id) => {
    const p = st.get(id);
    return { athlete_id: id, name: p.name, team: p.team, season: p.season, r: p.r, p: p.p, lvl: p.lvl, use: p.use, mpg: p.mpg, m2: p.m2, n: p.n, last_game: p.last_game };
  });
  const { error: e2 } = await db.rpc("dial_fc_pl_save", { states, games: gout });
  if (e2) throw new Error(e2.message);
  return { procesados: gout.length, jugadores: states.length, hasta: games[games.length - 1].start_time };
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const { data: sec } = await db.from("dial_fc_secrets").select("value").eq("name", "admin_key").maybeSingle();
  if (!sec?.value || req.headers.get("x-admin-key") !== sec.value) return json({ error: "no autorizado" }, 403);
  const n = Math.min(Number(u.searchParams.get("n") || 150), 400), loops = Math.min(Number(u.searchParams.get("loops") || 8), 30);
  const t0 = Date.now(); let total = 0, last: any = null;
  try {
    for (let i = 0; i < loops && Date.now() - t0 < 100000; i++) {
      last = await step(n); total += last.procesados;
      if (!last.procesados) break;
    }
  } catch (e) { return json({ error: String(e), total }, 500); }
  const { count } = await db.from("dial_fc_games").select("id", { count: "exact", head: true })
    .eq("sport", "nba").eq("status", "post").eq("box", true).gte("season", 2017);
  const { count: done } = await db.from("dial_fc_game_pl").select("game_id", { count: "exact", head: true });
  return json({ total, ultimo: last, hechos: done, con_planilla: count, ms: Date.now() - t0 });
});
