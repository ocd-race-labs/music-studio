// Dial Espejo · Mercados: lectura ejecutiva de los mercados del mundo y proyección trimestral a 2 años.
// Fuentes públicas y gratuitas: Yahoo Finance (índices, tasas, monedas, materias primas), FRED de la Fed de St. Louis
// (spreads de crédito, condiciones financieras, curva y tasa real; los trae la base con dial_mkt_fred_refresh) y
// multpl.com (CAPE de Shiller). Todo se calcula aquí y se guarda 20 minutos; la app solo lee.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (b: unknown, status = 200, age = 300) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": `public, max-age=${age}` } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" };
const TTL = 20 * 60000;

type Pt = { t: number; v: number }; // t = día (días desde 1970, UTC)
type Ser = Pt[];
const DAYMS = 86400000;
const today = () => Math.floor(Date.now() / DAYMS);
const iso = (t: number) => new Date(t * DAYMS).toISOString().slice(0, 10);

// ---------- números ----------
function erf(x: number) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
}
const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const quant = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

// valor vigente en el día t (última observación <= t)
function at(s: Ser, t: number): number | null {
  let lo = 0, hi = s.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  return r < 0 ? null : s[r].v;
}
const last = (s: Ser) => s[s.length - 1];

// ---------- fuentes ----------
async function yahoo(sym: string): Promise<Ser> {
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=10y&interval=1d`, { headers: UA, signal: AbortSignal.timeout(12000) });
      if (!r.ok) continue;
      const j = await r.json(); const x = j?.chart?.result?.[0]; if (!x) continue;
      const ts: number[] = x.timestamp || [], c: (number | null)[] = x.indicators?.quote?.[0]?.close || [];
      const off = x.meta?.gmtoffset || 0; const out: Ser = [];
      ts.forEach((t, i) => { const v = c[i]; if (v != null && isFinite(v) && v > 0) { const d = Math.floor((t + off) / 86400); if (out.length && last(out).t === d) last(out).v = v; else out.push({ t: d, v }); } });
      if (out.length) return out;
    } catch (_) { /* siguiente host */ }
  }
  return [];
}
async function cape(): Promise<Ser> {
  try {
    const r = await fetch("https://www.multpl.com/shiller-pe/table/by-month", { headers: UA, signal: AbortSignal.timeout(10000) });
    const h = await r.text(); const out: Ser = [];
    for (const m of h.matchAll(/<td>([A-Z][a-z]{2} \d{1,2}, \d{4})<\/td>\s*<td>[^0-9<]*([0-9]+\.[0-9]+)/g)) {
      const t = Math.floor(Date.parse(m[1] + " UTC") / DAYMS); if (isFinite(t)) out.push({ t, v: +m[2] });
    }
    return out.sort((a, b) => a.t - b.t).filter((p) => p.t > today() - 365 * 11);
  } catch (_) { return []; }
}
async function fred(): Promise<Record<string, Ser>> {
  const { data: st } = await db.from("dial_mkt_state").select("updated_at").eq("key", "fred").maybeSingle();
  if (!st || Date.now() - Date.parse(st.updated_at) > 12 * 3600000) { try { await db.rpc("dial_mkt_fred_refresh"); } catch (_) { /* sigue con lo guardado */ } }
  const out: Record<string, Ser> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("dial_mkt_fred").select("series,d,v").order("series").order("d").range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data) (out[r.series] ||= []).push({ t: Math.floor(Date.parse(r.d) / DAYMS), v: r.v });
    if (data.length < 1000) break;
  }
  return out;
}

// ---------- universo ----------
// Bolsas: [símbolo, nombre, bandera, región]
const EXCH: [string, string, string, string][] = [
  ["^GSPC", "S&P 500", "🇺🇸", "na"], ["^IXIC", "Nasdaq", "🇺🇸", "na"], ["^DJI", "Dow Jones", "🇺🇸", "na"], ["^GSPTSE", "S&P/TSX", "🇨🇦", "na"],
  ["CHL", "MSCI Chile", "🇨🇱", "la"], ["^BVSP", "Ibovespa", "🇧🇷", "la"], ["^MXX", "S&P/BMV IPC", "🇲🇽", "la"],
  ["^FTSE", "FTSE 100", "🇬🇧", "eu"], ["^GDAXI", "DAX", "🇩🇪", "eu"], ["^FCHI", "CAC 40", "🇫🇷", "eu"], ["^SSMI", "SMI", "🇨🇭", "eu"], ["^IBEX", "IBEX 35", "🇪🇸", "eu"], ["FTSEMIB.MI", "FTSE MIB", "🇮🇹", "eu"],
  ["^N225", "Nikkei 225", "🇯🇵", "as"], ["000001.SS", "Shanghai", "🇨🇳", "as"], ["^HSI", "Hang Seng", "🇭🇰", "as"], ["^KS11", "KOSPI", "🇰🇷", "as"], ["^NSEI", "Nifty 50", "🇮🇳", "as"], ["^AXJO", "S&P/ASX 200", "🇦🇺", "as"], ["^TWII", "TAIEX", "🇹🇼", "as"],
  ["^TASI.SR", "Tadawul", "🇸🇦", "me"],
];
const REG: Record<string, string> = { na: "EE.UU. y Canadá", la: "Latinoamérica", eu: "Europa", as: "Asia-Pacífico", me: "Medio Oriente" };
const MACRO = ["ACWI", "^STOXX50E", "^VIX", "^TNX", "DX-Y.NYB", "CLP=X", "HG=F", "BZ=F", "GC=F", "ECH"];
const CONE: [string, string][] = [["ACWI", "MSCI Mundo"], ["^GSPC", "S&P 500"], ["CHL", "MSCI Chile en pesos"], ["^BVSP", "Ibovespa"], ["^STOXX50E", "Euro Stoxx 50"], ["^N225", "Nikkei 225"]];
const HZ = [1, 7, 30, 91, 365]; // día (observación anterior), semana, mes, trimestre, año
const HZN = ["en el día", "en la semana", "en el mes", "en el trimestre", "en el año"];

// ---------- formato ----------
const nf = (x: number, d = 1) => x.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
const sg = (x: number, d = 1) => (x > 0 ? "+" : x < 0 ? "−" : "") + nf(Math.abs(x), d);
type Kind = "pct" | "pb" | "pp" | "pt" | "abs2" | "abs1";
function delta(kind: Kind, a: number, b: number) {
  if (kind === "pct") { const x = (a / b - 1) * 100; return { x, s: sg(x, 1) + "%" }; }
  if (kind === "pb") { const x = (a - b) * 100; return { x, s: sg(x, 0) + " pb" }; }
  if (kind === "pp") { const x = a - b; return { x, s: sg(x, 1) + " pp" }; }
  if (kind === "pt") { const x = a - b; return { x, s: sg(x, 1) + " pts" }; }
  if (kind === "abs2") { const x = a - b; return { x, s: sg(x, 2) }; }
  const x = a - b; return { x, s: sg(x, 1) };
}
// cambio del valor vigente en t respecto de hace h días (h=1: observación anterior)
function chg(s: Ser, t: number, h: number, kind: Kind) {
  let i = s.length - 1; while (i >= 0 && s[i].t > t) i--; if (i < 1) return null;
  const a = s[i].v; const b = h === 1 ? s[i - 1].v : at(s, s[i].t - h); if (b == null) return null;
  return delta(kind, a, b);
}

// ---------- modelo GARCH(1,1) ----------
function garch(r: number[]) {
  const v0 = mean(r.map((x) => x * x)); let best = { a: 0.08, b: 0.9, ll: -Infinity };
  for (let a = 0.02; a <= 0.3; a += 0.02) for (let b = 0.5; b <= 0.98; b += 0.02) {
    if (a + b >= 0.995) continue; const w = v0 * (1 - a - b); let h = v0, ll = 0;
    for (const x of r) { ll += -0.5 * (Math.log(h) + (x * x) / h); h = w + a * x * x + b * h; }
    if (ll > best.ll) best = { a, b, ll };
  }
  const w = v0 * (1 - best.a - best.b); const hs: number[] = []; let h = v0;
  for (const x of r) { hs.push(h); h = w + best.a * x * x + best.b * h; }
  const z = r.map((x, i) => x / Math.sqrt(hs[i])); const zm = mean(z), zs = sd(z);
  return { a: best.a, b: best.b, w, v0, hs, hNext: h, z: z.map((x) => (x - zm) / zs) };
}
function weekly(s: Ser): Ser {
  const out: Ser = []; for (const p of s) { const wk = Math.floor((p.t + 3) / 7); if (out.length && Math.floor((last(out).t + 3) / 7) === wk) last(out).t = p.t, last(out).v = p.v; else out.push({ ...p }); }
  return out;
}

// ---------- cálculo principal ----------
async function compute() {
  const syms = [...new Set([...EXCH.map((e) => e[0]).filter((s) => s !== "CHL"), ...MACRO])];
  const got = await Promise.all(syms.map((s) => yahoo(s)));
  const Y: Record<string, Ser> = {}; syms.forEach((s, i) => (Y[s] = got[i]));
  const [F, CA] = await Promise.all([fred(), cape()]);
  // MSCI Chile en pesos = ECH (USD) × dólar en Chile
  Y["CHL"] = (Y["ECH"] || []).map((p) => { const c = at(Y["CLP=X"] || [], p.t); return c ? { t: p.t, v: p.v * c } : null; }).filter(Boolean) as Ser;
  const T = today();

  // Series derivadas
  const spx = Y["^GSPC"]; const rv: Ser = [];
  for (let i = 21; i < spx.length; i++) { const r: number[] = []; for (let k = i - 20; k <= i; k++) r.push(Math.log(spx[k].v / spx[k - 1].v)); rv.push({ t: spx[i].t, v: sd(r) * Math.sqrt(252) * 100 }); }
  const cur = F["T10Y3M"] || []; const rec: Ser = [];
  for (let i = 20; i < cur.length; i++) { const m = mean(cur.slice(i - 20, i + 1).map((p) => p.v)); rec.push({ t: cur[i].t, v: Phi(-0.5333 - 0.6330 * m) * 100 }); }
  const ecy: Ser = CA.map((p) => { const r = at(F["DFII10"] || [], p.t); return r == null ? null : { t: p.t, v: 100 / p.v - r }; }).filter(Boolean) as Ser;
  // Amplitud: % de bolsas sobre su media de 200 sesiones (semanal hacia atrás, diaria al final)
  const sma: Record<string, Ser> = {};
  for (const [s] of EXCH) { const x = Y[s] || []; const o: Ser = []; let acc = 0; for (let i = 0; i < x.length; i++) { acc += x[i].v; if (i >= 200) acc -= x[i - 200].v; if (i >= 199) o.push({ t: x[i].t, v: acc / 200 }); } sma[s] = o; }
  const bdays: number[] = []; for (let t = T - 3650; t < T - 14; t += 7) bdays.push(t); for (let t = T - 14; t <= T; t++) bdays.push(t);
  const br: Ser = bdays.map((t) => { let n = 0, up = 0; for (const [s] of EXCH) { const v = at(Y[s] || [], t), m = at(sma[s], t); if (v != null && m != null) { n++; if (v > m) up++; } } return n >= 10 ? { t, v: (up / n) * 100 } : null; }).filter(Boolean) as Ser;
  const brDedup: Ser = []; for (const p of br) { if (brDedup.length && last(brDedup).v === p.v && p.t - last(brDedup).t < 3) continue; brDedup.push(p); }

  // Indicadores: [id, grupo, nombre, serie, kind del cambio, decimales, unidad, regla, fuente]
  type Rule = (v: number, s: Ser, t: number) => "f" | "n" | "a";
  const c3 = (s: Ser, t: number, k: Kind) => chg(s, t, 91, k)?.x ?? 0;
  const IND: { id: string; g: string; n: string; s: Ser; k: Kind; d: number; u: string; rule: Rule; txt: Record<string, string>; src: string }[] = [
    { id: "vix", g: "Riesgo y volatilidad", n: "VIX (volatilidad implícita S&P 500)", s: Y["^VIX"], k: "pt", d: 1, u: "", rule: (v) => (v < 16 ? "f" : v > 25 ? "a" : "n"),
      txt: { f: "Calma: bajo 16 el mercado no paga por protegerse.", n: "Miedo moderado; sobre 25 suele acompañar caídas fuertes.", a: "Miedo alto: sobre 25 el mercado paga caro por protegerse." }, src: "Whaley (2000); Rey (2013), ciclo financiero global" },
    { id: "rv", g: "Riesgo y volatilidad", n: "Volatilidad realizada S&P 500 (21 días)", s: rv, k: "pp", d: 1, u: "%", rule: (v) => (v < 12 ? "f" : v > 20 ? "a" : "n"),
      txt: { f: "Bajo su promedio histórico cercano a 16%.", n: "Cerca de su promedio histórico de 16%.", a: "Sobre 20%: oscilaciones diarias grandes." }, src: "Andersen y Bollerslev (1998)" },
    { id: "tnx", g: "Tasas y ciclo", n: "Treasury EE.UU. 10 años", s: Y["^TNX"], k: "pb", d: 2, u: "%", rule: (_v, s, t) => { const c = c3(s, t, "pb"); return c > 40 ? "a" : c < -40 ? "f" : "n"; },
      txt: { f: "Bajó más de 40 pb en 3 meses: abarata el capital.", n: "Sin shock de tasas en los últimos 3 meses.", a: "Subió más de 40 pb en 3 meses: encarece el capital y castiga a las acciones." }, src: "Fama y French (1989)" },
    { id: "curve", g: "Tasas y ciclo", n: "Curva 10 años menos 3 meses", s: cur, k: "pb", d: 2, u: " pp", rule: (v) => (v < 0 ? "a" : v > 1 ? "f" : "n"),
      txt: { f: "Curva con pendiente sana: sin señal de recesión.", n: "Positiva pero plana: señal de recesión débil.", a: "Invertida: el predictor clásico de recesión." }, src: "Estrella y Mishkin (1998)" },
    { id: "rec", g: "Tasas y ciclo", n: "Probabilidad de recesión EE.UU. a 12 meses", s: rec, k: "pp", d: 0, u: "%", rule: (v) => (v > 40 ? "a" : v < 25 ? "f" : "n"),
      txt: { f: "Baja: bajo 25%.", n: "Intermedia; sobre 40% históricamente precede recesiones.", a: "Sobre 40%: nivel que históricamente precede recesiones." }, src: "Modelo probit de la curva, Fed de Nueva York" },
    { id: "hy", g: "Crédito y liquidez", n: "Spread high yield EE.UU.", s: F["BAMLH0A0HYM2"] || [], k: "pb", d: 2, u: "%", rule: (v) => (v < 4 ? "f" : v > 6 ? "a" : "n"),
      txt: { f: "Estrecho: el crédito no ve estrés. Es la señal adelantada más confiable.", n: "En zona media: el crédito empieza a pedir más premio.", a: "Sobre 6%: el crédito descuenta estrés." }, src: "Gilchrist y Zakrajšek (2012)" },
    { id: "nfci", g: "Crédito y liquidez", n: "Condiciones financieras (NFCI)", s: F["NFCI"] || [], k: "abs2", d: 2, u: "", rule: (v) => (v < -0.3 ? "f" : v > 0 ? "a" : "n"),
      txt: { f: "Bajo cero: condiciones más holgadas que el promedio.", n: "Cerca del promedio histórico.", a: "Sobre cero: condiciones más restrictivas que el promedio." }, src: "Fed de Chicago; Brave y Butters (2011)" },
    { id: "dxy", g: "Dólar y emergentes", n: "Dólar global (DXY)", s: Y["DX-Y.NYB"], k: "pct", d: 1, u: "", rule: (_v, s, t) => { const c = c3(s, t, "pct"); return c > 3 ? "a" : c < -3 ? "f" : "n"; },
      txt: { f: "Se debilita: alivia el financiamiento de emergentes.", n: "Estable en los últimos 3 meses.", a: "Se fortalece: endurece el financiamiento global y resta a emergentes." }, src: "Bruno y Shin (2015)" },
    { id: "em", g: "Dólar y emergentes", n: "Spread de bonos corporativos emergentes", s: F["BAMLEMCBPIOAS"] || [], k: "pb", d: 2, u: "%", rule: (v) => (v < 2.5 ? "f" : v > 4 ? "a" : "n"),
      txt: { f: "Riesgo emergente contenido.", n: "Riesgo emergente en zona media.", a: "Riesgo emergente elevado." }, src: "ICE BofA vía FRED; Longstaff et al. (2011)" },
    { id: "clp", g: "Dólar y emergentes", n: "Dólar en Chile (USD/CLP)", s: Y["CLP=X"], k: "pct", d: 0, u: "", rule: (_v, s, t) => { const c = c3(s, t, "pct"); return c > 4 ? "a" : c < -4 ? "f" : "n"; },
      txt: { f: "El peso se aprecia.", n: "Peso estable en los últimos 3 meses.", a: "El peso se deprecia más de 4% en 3 meses." }, src: "Chen, Rogoff y Rossi (2010)" },
    { id: "hg", g: "Materias primas", n: "Cobre (USD/lb)", s: Y["HG=F"], k: "pct", d: 2, u: "", rule: (_v, s, t) => { const c = c3(s, t, "pct"); return c > 5 ? "f" : c < -5 ? "a" : "n"; },
      txt: { f: "Sube: demanda industrial firme; favorece a Chile.", n: "Estable: sin señal de la demanda china.", a: "Cae: demanda industrial débil; resta a Chile." }, src: "Hamilton (2015); Chen, Rogoff y Rossi (2010)" },
    { id: "bz", g: "Materias primas", n: "Petróleo Brent (USD/barril)", s: Y["BZ=F"], k: "pct", d: 1, u: "", rule: (_v, s, t) => { const c = c3(s, t, "pct"); return Math.abs(c) > 25 ? "a" : "n"; },
      txt: { f: "", n: "Sin shock de precio en 3 meses.", a: "Movimiento de más de 25% en 3 meses: los shocks de petróleo anteceden recesiones." }, src: "Hamilton (1983, 2009)" },
    { id: "gc", g: "Materias primas", n: "Oro (USD/oz)", s: Y["GC=F"], k: "pct", d: 0, u: "", rule: (_v, s, t) => (c3(s, t, "pct") > 10 ? "a" : "n"),
      txt: { f: "", n: "Sin huida masiva a refugio.", a: "Sube más de 10% en 3 meses: demanda de refugio." }, src: "Baur y Lucey (2010)" },
    { id: "cape", g: "Valoración y tendencia", n: "CAPE de Shiller, S&P 500", s: CA, k: "abs1", d: 1, u: "", rule: (v) => (v > 30 ? "a" : v < 20 ? "f" : "n"),
      txt: { f: "Valoración barata: históricamente, mejores retornos a 10 años.", n: "Valoración en zona media.", a: "Valoración muy exigente: anticipa retornos bajos a 10 años, no a 1 año." }, src: "Campbell y Shiller (1988); Shiller (2000)" },
    { id: "ecy", g: "Valoración y tendencia", n: "Prima de riesgo accionario (CAPE en exceso)", s: ecy, k: "pp", d: 1, u: "%", rule: (v) => (v < 1.5 ? "a" : v > 3.5 ? "f" : "n"),
      txt: { f: "Buena compensación por tomar riesgo frente a bonos.", n: "Compensación por riesgo en zona media.", a: "Poca compensación por tomar riesgo frente a bonos indexados." }, src: "Shiller, Black y Jivraj (2020)" },
    { id: "br", g: "Valoración y tendencia", n: "Amplitud: bolsas sobre su media de 200 días", s: brDedup, k: "pp", d: 0, u: "%", rule: (v) => (v > 60 ? "f" : v < 40 ? "a" : "n"),
      txt: { f: "Tendencia alcista con base amplia entre las 21 bolsas.", n: "Tendencia mixta entre bolsas.", a: "Mayoría de bolsas bajo su tendencia de largo plazo." }, src: "Moskowitz, Ooi y Pedersen (2012); Faber (2007)" },
  ];
  const sigAt = (x: typeof IND[0], t: number) => { const v = at(x.s, t); return v == null ? null : x.rule(v, x.s, t); };
  const SV = { f: 100, n: 50, a: 0 } as Record<string, number>;
  const scoreAt = (t: number) => { const v = IND.map((x) => sigAt(x, t)).filter(Boolean).map((k) => SV[k!]); return Math.round(mean(v)); };

  const inds = IND.filter((x) => x.s.length).map((x) => {
    const L = last(x.s); const win = x.s.filter((p) => p.t > T - 3650); const pct = Math.round((win.filter((p) => p.v <= L.v).length / win.length) * 100);
    const yrs = Math.max(1, Math.round((T - win[0].t) / 365));
    const sgn = x.rule(L.v, x.s, L.t);
    // z del cambio en cada horizonte vs su distribución histórica
    const d = HZ.map((h) => {
      const c = chg(x.s, L.t, h, x.k); if (!c) return null;
      const hist: number[] = []; const step = Math.max(1, Math.floor(x.s.length / 400));
      for (let i = x.s.length - 1; i > 0; i -= step) { const cc = chg(x.s, x.s[i].t, h, x.k); if (cc) hist.push(cc.x); }
      const z = hist.length > 20 ? c.x / (sd(hist) || 1) : 0;
      return { s: c.s, x: c.x, z: Math.round(z * 10) / 10 };
    });
    const v = x.id === "clp" ? "$" + nf(L.v, 0) : nf(L.v, x.d) + x.u;
    return { id: x.id, g: x.g, n: x.n, v, raw: L.v, asof: iso(L.t), pct, yrs, sg: sgn, txt: x.txt[sgn], src: x.src, d };
  });
  const I = Object.fromEntries(inds.map((i) => [i.id, i]));

  // Bolsas y regiones por horizonte
  const ex = EXCH.map(([s, n, f, r]) => ({ s, n, f, r, d: HZ.map((h) => { const x = Y[s] || []; const L = x.length ? last(x).t : 0; return L ? chg(x, L, h, "pct")?.x ?? null : null; }) }));
  const glob = HZ.map((h) => { const x = Y["ACWI"]; return chg(x, last(x).t, h, "pct"); });
  const read = HZ.map((_h, k) => {
    const sc = scoreAt(T), sc0 = k ? scoreAt(T - HZ[k]) : scoreAt(T - 1);
    const ups = ex.filter((e) => (e.d[k] ?? 0) > 0).length, nn = ex.filter((e) => e.d[k] != null).length;
    const regs = Object.keys(REG).map((r) => { const v = ex.filter((e) => e.r === r && e.d[k] != null).map((e) => e.d[k]!); return v.length ? { r: REG[r], v: mean(v) } : null; }).filter(Boolean) as { r: string; v: number }[];
    regs.sort((a, b) => b.v - a.v);
    const g = glob[k];
    const L: string[] = [];
    L.push(`<b>MSCI Mundo ${g ? g.s : "s/d"} ${HZN[k]}.</b> Suben ${ups} de ${nn} bolsas; ${regs.map((x) => `${x.r} ${sg(x.v, 1)}%`).join(", ")}.`);
    const mv = inds.filter((i) => i.d[k]).sort((a, b) => Math.abs(b.d[k]!.z) - Math.abs(a.d[k]!.z))[0];
    if (mv) { const z = Math.abs(mv.d[k]!.z); L.push(`<b>Lo que más se movió: ${mv.n}</b>, ${mv.d[k]!.s} ${HZN[k]}; ${z >= 2 ? "un movimiento poco habitual (fuera del 95% de los casos de los últimos años)." : z >= 1 ? "un movimiento algo mayor que lo normal." : "dentro de lo normal."}`); }
    const cv = I.curve, hy = I.hy, rc = I.rec;
    if (cv && hy && rc) L.push(`<b>Ciclo y crédito:</b> curva 10a-3m en ${cv.v} (${cv.raw < 0 ? "invertida" : "positiva"}), spread high yield en ${hy.v} (${hy.sg === "f" ? "sin estrés" : hy.sg === "a" ? "con estrés" : "zona media"}) y probabilidad de recesión a 12 meses de ${rc.v}.`);
    const hg = I.hg, cl = I.clp, ch = ex.find((e) => e.s === "CHL");
    if (hg && cl && ch) L.push(`<b>Chile:</b> cobre ${hg.d[k]?.s ?? "s/d"}, dólar ${cl.d[k]?.s ?? "s/d"} (${cl.v}) y MSCI Chile en pesos ${ch.d[k] != null ? sg(ch.d[k]!, 1) + "%" : "s/d"} ${HZN[k]}.`);
    return { score: sc, prev: sc0, lines: L };
  });

  // Puntos de inflexión: días en que el MSCI Mundo se movió más de 2,5 desviaciones según su volatilidad del momento
  const aw = Y["ACWI"]; const ar: number[] = []; for (let i = 1; i < aw.length; i++) ar.push(Math.log(aw[i].v / aw[i - 1].v));
  const gd = garch(ar);
  const evs: { t: string; r: number; z: number; co: string[]; k: number }[] = [];
  for (let i = 0; i < ar.length; i++) {
    const z = ar[i] / Math.sqrt(gd.hs[i]); const t = aw[i + 1].t; if (Math.abs(z) < 2.5 || t < T - 366) continue;
    const co: string[] = [];
    const add = (lbl: string, s: Ser, kind: Kind) => { const c = chg(s, t, 1, kind); if (c && at(s, t) != null && (s.find((p) => p.t === t))) co.push(`${lbl} ${c.s}`); };
    add("VIX", Y["^VIX"], "pt"); add("Treasury 10a", Y["^TNX"], "pb"); add("Dólar", Y["DX-Y.NYB"], "pct"); add("Petróleo", Y["BZ=F"], "pct"); add("Cobre", Y["HG=F"], "pct"); add("Oro", Y["GC=F"], "pct");
    const rg = ex.map((e) => ({ n: e.f + " " + e.n, c: chg(Y[e.s] || [], t, 1, "pct") })).filter((x) => x.c).sort((a, b) => (z < 0 ? a.c!.x - b.c!.x : b.c!.x - a.c!.x)).slice(0, 3).map((x) => `${x.n} ${x.c!.s}`);
    const k = T - t <= 1 ? 0 : T - t <= 7 ? 1 : T - t <= 30 ? 2 : T - t <= 91 ? 3 : 4;
    evs.push({ t: iso(t), r: Math.round((Math.exp(ar[i]) - 1) * 1000) / 10, z: Math.round(z * 10) / 10, co: [...co, ...rg], k });
  }
  evs.sort((a, b) => (a.t < b.t ? 1 : -1));

  // Cono: GARCH(1,1) semanal con simulación histórica filtrada (Barone-Adesi et al., 1999)
  const capeNow = CA.length ? last(CA).v : null;
  const cones = CONE.map(([s, n]) => {
    const w = weekly((Y[s] || []).filter((p) => p.t > T - 3650 - 14)); if (w.length < 200) return null;
    const r: number[] = []; for (let i = 1; i < w.length; i++) r.push(Math.log(w[i].v / w[i - 1].v));
    const g = garch(r); const hist = mean(r) * 52, prior = Math.log(1.07);
    let mu = 0.5 * hist + 0.5 * prior; let how = "promedio de 10 años mezclado con el retorno de largo plazo de las acciones (7%)";
    if (s === "^GSPC" && capeNow) { mu = 0.5 * hist + 0.5 * Math.log(1 + 1 / capeNow + 0.025); how = "promedio de 10 años mezclado con el retorno implícito en el CAPE (1/CAPE más inflación)"; }
    const y1 = w.length > 53 ? Math.log(last(w).v / w[w.length - 53].v) : 0; mu += y1 > 0 ? 0.01 : -0.01;
    mu = Math.max(-0.05, Math.min(0.15, mu)); const muw = mu / 52;
    const S0 = last(w).v, N = 3000, W = 104, rnd = mulberry(hash(s + iso(T)));
    const lv: number[][] = Array.from({ length: 8 }, () => []); let below = 0;
    for (let p = 0; p < N; p++) {
      let h = g.hNext, x = 0, mn = 0;
      for (let k = 1; k <= W; k++) { const z = g.z[Math.floor(rnd() * g.z.length)]; const e = Math.sqrt(h) * z; x += muw + e; h = g.w + g.a * e * e + g.b * h; if (k <= 52) mn = Math.min(mn, x); if (k % 13 === 0) lv[k / 13 - 1].push(x); }
      if (mn < Math.log(0.8)) below++;
    }
    const P = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95];
    const fc = lv.map((a, q) => { const td = T + Math.round((q + 1) * 91.3); const d = new Date(td * DAYMS); return { q: q + 1, target: iso(td), lbl: `${Math.floor(d.getUTCMonth() / 3) + 1}T${String(d.getUTCFullYear()).slice(2)}`, p: P.map((pp) => Math.round(S0 * Math.exp(quant(a, pp)) * 100) / 100) }; });
    const up = (q: number) => Math.round((lv[q - 1].filter((x) => x > 0).length / N) * 100);
    // Precisión histórica: banda del 80% a 1 año, recalculada cada 4 semanas en los últimos años
    const lr = Math.log(1); let inn = 0, tot = 0, in95 = 0; const lvar = g.w / (1 - g.a - g.b);
    for (let i = 104; i + 52 < r.length; i += 4) {
      const h1 = g.w + g.a * r[i] ** 2 + g.b * g.hs[i]; let hs = 0; for (let k = 1; k <= 52; k++) hs += lvar + (g.a + g.b) ** (k - 1) * (h1 - lvar);
      const real = Math.log(w[i + 53].v / w[i + 1].v), c = muw * 52 + lr; const sdv = Math.sqrt(hs);
      tot++; if (Math.abs(real - c) <= 1.2816 * sdv) inn++; if (Math.abs(real - c) <= 1.96 * sdv) in95++;
    }
    const hw = w.filter((p) => p.t > T - 7 * 78).map((p) => ({ t: iso(p.t), v: Math.round(p.v * 100) / 100 }));
    return { s, n, S0, asof: iso(last(w).t), hist: hw, fc, pUp4: up(4), pUp8: up(8), pDD: Math.round((below / N) * 100), med1: Math.round((Math.exp(quant(lv[3], 0.5)) - 1) * 1000) / 10, mu: Math.round(mu * 1000) / 10, volA: Math.round(Math.sqrt(lvar * 52) * 1000) / 10, how, bt: { n: tot, c80: tot ? Math.round((inn / tot) * 100) : null, c95: tot ? Math.round((in95 / tot) * 100) : null }, garch: { a: Math.round(g.a * 100) / 100, b: Math.round(g.b * 100) / 100 } };
  }).filter(Boolean) as any[];

  // Seguimiento: guarda el pronóstico de hoy y evalúa los que ya vencieron
  const rows = cones.flatMap((c) => c.fc.map((f: any) => ({ made_on: iso(T), symbol: c.s, q: f.q, target_date: f.target, level0: c.S0, p05: f.p[0], p10: f.p[1], p25: f.p[2], p50: f.p[3], p75: f.p[4], p90: f.p[5], p95: f.p[6] })));
  await db.from("dial_mkt_forecasts").upsert(rows, { onConflict: "made_on,symbol,q", ignoreDuplicates: true });
  const { data: due } = await db.from("dial_mkt_forecasts").select("made_on,symbol,q,target_date").is("realized", null).lte("target_date", iso(T - 1)).limit(500);
  for (const d of due || []) { const src = Y[d.symbol]; const v = src ? at(src, Math.floor(Date.parse(d.target_date) / DAYMS)) : null; if (v != null) await db.from("dial_mkt_forecasts").update({ realized: v, evaluated_at: new Date().toISOString() }).match({ made_on: d.made_on, symbol: d.symbol, q: d.q }); }
  const { data: ev } = await db.from("dial_mkt_forecasts").select("symbol,p10,p90,realized,made_on").not("realized", "is", null).limit(5000);
  const { data: first } = await db.from("dial_mkt_forecasts").select("made_on").order("made_on").limit(1);
  const track = { first: first?.[0]?.made_on || iso(T), n: ev?.length || 0, c80: ev?.length ? Math.round((ev.filter((e: any) => e.realized >= e.p10 && e.realized <= e.p90).length / ev.length) * 100) : null };

  return { at: new Date().toISOString(), read, inds, evs, cones, track,
    sources: ["Yahoo Finance (índices, tasas, monedas, materias primas)", "FRED, Fed de St. Louis (spreads, NFCI, curva, tasa real)", "multpl.com (CAPE de Shiller)"] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const force = new URL(req.url).searchParams.get("fresh") === "1";
  const { data: st } = await db.from("dial_mkt_state").select("payload,updated_at").eq("key", "payload").maybeSingle();
  if (st?.payload && !force && Date.now() - Date.parse(st.updated_at) < TTL) return json(st.payload);
  try {
    const p = await compute();
    await db.from("dial_mkt_state").upsert({ key: "payload", payload: p, updated_at: new Date().toISOString() });
    return json(p);
  } catch (e) {
    if (st?.payload) return json({ ...st.payload, stale: true }, 200, 60);
    return json({ error: "No se pudieron calcular los mercados: " + String(e).slice(0, 200) }, 502, 15);
  }
});
