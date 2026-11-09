// Dial Espejo · Pronósticos: carga por tandas la planilla de cada partido NBA (ESPN) en dial_fc_box.
import { createClient } from "jsr:@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const num = (x: any) => { const n = parseInt(String(x ?? ""), 10); return Number.isFinite(n) ? n : null; };
const pair = (x: any) => { const [a, b] = String(x ?? "").split("-"); return [num(a), num(b)]; };

function parse(gameId: string, j: any) {
  const rows: any[] = [];
  for (const tp of j?.boxscore?.players || []) {
    const team = tp.team?.abbreviation;
    const st = tp.statistics?.[0];
    if (!team || !st) continue;
    const lab: string[] = (st.labels || st.names || []).map((s: string) => String(s).toUpperCase());
    const ix = (k: string) => lab.indexOf(k);
    for (const a of st.athletes || []) {
      const s = a.stats || [];
      const g = (k: string) => (ix(k) >= 0 ? s[ix(k)] : null);
      const [fgm, fga] = pair(g("FG")), [fg3m, fg3a] = pair(g("3PT")), [ftm, fta] = pair(g("FT"));
      const dnp = !!a.didNotPlay || !s.length || num(g("MIN")) === 0;
      rows.push({
        game_id: gameId, team, athlete_id: String(a.athlete?.id ?? ""), name: a.athlete?.displayName ?? null,
        pos: a.athlete?.position?.abbreviation ?? null, starter: !!a.starter, dnp, reason: a.reason ?? null,
        min: dnp ? 0 : num(g("MIN")), pts: num(g("PTS")), reb: num(g("REB")), ast: num(g("AST")), stl: num(g("STL")),
        blk: num(g("BLK")), tov: num(g("TO")), fgm, fga, fg3m, fg3a, ftm, fta, oreb: num(g("OREB")), pf: num(g("PF")),
        pm: num(String(g("+/-") ?? "").replace("+", "")),
      });
    }
  }
  return rows.filter((r) => r.athlete_id);
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const { data: sec } = await db.from("dial_fc_secrets").select("value").eq("name", "admin_key").maybeSingle();
  if (!sec?.value || req.headers.get("x-admin-key") !== sec.value) return json({ error: "no autorizado" }, 403);
  const n = Math.min(Number(u.searchParams.get("n") || 200), 400), par = 10;
  const { data: games, error } = await db.from("dial_fc_games").select("id")
    .eq("sport", "nba").eq("status", "post").eq("box", false).gte("season", 2018)
    .order("start_time", { ascending: false }).limit(n);
  if (error) return json({ error: error.message }, 500);
  let ok = 0, fail = 0, players = 0;
  const t0 = Date.now();
  for (let i = 0; i < (games || []).length && Date.now() - t0 < 110000; i += par) {
    const chunk = games!.slice(i, i + par);
    const res = await Promise.all(chunk.map(async (g) => {
      try {
        const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${g.id}`,
          { headers: { "User-Agent": "Mozilla/5.0 (DialEspejo)" }, signal: AbortSignal.timeout(15000) });
        if (!r.ok) return null;
        return { id: g.id, rows: parse(g.id, await r.json()) };
      } catch (_) { return null; }
    }));
    const good = res.filter((x) => x && x.rows.length >= 10) as { id: string; rows: any[] }[];
    fail += chunk.length - good.length;
    const rows = good.flatMap((x) => x.rows);
    if (rows.length) {
      const { error: e1 } = await db.from("dial_fc_box").upsert(rows, { onConflict: "game_id,athlete_id" });
      if (e1) return json({ error: e1.message, ok, fail }, 500);
      await db.from("dial_fc_games").update({ box: true }).in("id", good.map((x) => x.id));
    }
    ok += good.length; players += rows.length;
  }
  const { count } = await db.from("dial_fc_games").select("id", { count: "exact", head: true })
    .eq("sport", "nba").eq("status", "post").eq("box", false).gte("season", 2018);
  return json({ ok, fail, players, pendientes: count, ms: Date.now() - t0 });
});
