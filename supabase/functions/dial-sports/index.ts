// Dial Espejo · Deportes: puente de solo lectura hacia datos públicos de ESPN (fútbol, ligas de EE.UU., F1) y del sitio oficial de MotoGP.
// Solo deja pasar rutas y parámetros conocidos, para que no sirva como proxy abierto.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (b: unknown, status = 200, age = 120) =>
  new Response(typeof b === "string" ? b : JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": `public, max-age=${age}` } });

// p = ruta relativa; h = site | web
const PATH = /^apis\/(v2|site\/v2|site\/v3)\/sports\/(soccer|basketball|football|hockey|baseball|racing)\/[a-z0-9._]+\/(standings|scoreboard|leaders|statistics)$/;
// MotoGP: API pública de resultados de motogp.com (temporadas → eventos → categorías → sesiones → clasificación; posiciones del campeonato)
const MGP = /^motogp\/v1\/results\/(seasons|events|categories|sessions|standings|session\/[0-9a-f-]{36}\/classification)$/;
const KEYS = new Set(["level", "dates", "season", "seasontype", "limit", "group", "week", "seasonUuid", "eventUuid", "categoryUuid", "isFinished", "test"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);
  const p = (u.searchParams.get("p") || "").replace(/^\/+/, "");
  const mgp = MGP.test(p);
  if (!mgp && !PATH.test(p)) return json({ error: "ruta no permitida" }, 400);
  const host = mgp ? "api.motogp.pulselive.com" : u.searchParams.get("h") === "web" ? "site.web.api.espn.com" : "site.api.espn.com";
  const q = new URLSearchParams();
  for (const [k, v] of u.searchParams) if (KEYS.has(k) && /^[0-9a-z.,-]{1,40}$/i.test(v)) q.set(k, v);
  const target = `https://${host}/${p}${[...q].length ? "?" + q : ""}`;
  try {
    const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 (DialEspejo)", Accept: "application/json" }, signal: AbortSignal.timeout(9000) });
    const t = await r.text();
    if (!r.ok) return json({ error: "fuente " + r.status }, 502, 30);
    return json(t, 200, /scoreboard|classification/.test(p) ? 60 : 300);
  } catch (_) {
    return json({ error: "sin conexión con la fuente" }, 502, 15);
  }
});
