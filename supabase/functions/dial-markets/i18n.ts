// Dial Espejo · Mercados: textos en español, inglés y portugués. El cálculo se hace una vez (en español) y
// cada idioma se arma aquí a partir de los mismos datos; en inglés también se cambia el formato de los números.

export type RD = {
  k: number; g: string | null; ups: number; nn: number; regs: [string, string][];
  mv: { id: string; n: string; s: string; z: number } | null;
  cyc: { cv: string; inv: boolean; hy: string; hs: string; rc: string } | null;
  chl: { hg: string | null; cl: string | null; clv: string; ch: string | null } | null;
};
type Lang = "es" | "en" | "pt";

// "1.317,9" → "1,317.9" y "pb" → "bp" (solo inglés)
export function num(s: string, lang: string): string {
  if (lang !== "en" || typeof s !== "string") return s;
  return s.replace(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+/g, (m) => m.replace(/\./g, "§").replace(/,/g, ".").replace(/§/g, ","))
    .replace(/ pb\b/g, " bp").replace(/\bs\/d\b/g, "n/a");
}

const REG: Record<Lang, Record<string, string>> = {
  es: { na: "EE.UU. y Canadá", la: "Latinoamérica", eu: "Europa", as: "Asia-Pacífico", me: "Medio Oriente" },
  en: { na: "US and Canada", la: "Latin America", eu: "Europe", as: "Asia-Pacific", me: "Middle East" },
  pt: { na: "EUA e Canadá", la: "América Latina", eu: "Europa", as: "Ásia-Pacífico", me: "Oriente Médio" },
};
const HZN: Record<Lang, string[]> = {
  es: ["en el día", "en la semana", "en el mes", "en el trimestre", "en el año"],
  en: ["on the day", "this week", "this month", "this quarter", "this year"],
  pt: ["no dia", "na semana", "no mês", "no trimestre", "no ano"],
};

// Indicadores: nombre y lectura según la señal (f favorable, n neutral, a alerta)
const IND: Record<"en" | "pt", Record<string, [string, string, string, string]>> = {
  en: {
    vix: ["VIX (S&P 500 implied volatility)", "Calm: below 16 the market isn't paying for protection.", "Moderate fear; above 25 it tends to come with sharp falls.", "High fear: above 25 the market pays up for protection."],
    rv: ["S&P 500 realized volatility (21 days)", "Below its historical average of about 16%.", "Close to its historical average of 16%.", "Above 20%: large daily swings."],
    tnx: ["US 10-year Treasury", "Down more than 40 bp in 3 months: cheaper capital.", "No rate shock in the last 3 months.", "Up more than 40 bp in 3 months: dearer capital, a drag on stocks."],
    curve: ["10-year minus 3-month curve", "Healthy slope: no recession signal.", "Positive but flat: weak recession signal.", "Inverted: the classic recession predictor."],
    rec: ["US recession probability, 12 months", "Low: below 25%.", "Middle; above 40% has historically preceded recessions.", "Above 40%: a level that has historically preceded recessions."],
    hy: ["US high-yield spread", "Tight: credit sees no stress. It is the most reliable leading signal.", "Mid-range: credit starts asking for more premium.", "Above 6%: credit is pricing stress."],
    nfci: ["Financial conditions (NFCI)", "Below zero: looser than average.", "Close to the historical average.", "Above zero: tighter than average."],
    dxy: ["Global dollar (DXY)", "Weakening: eases funding for emerging markets.", "Stable over the last 3 months.", "Strengthening: tightens global funding and weighs on emerging markets."],
    em: ["Emerging-market corporate bond spread", "Emerging-market risk contained.", "Emerging-market risk mid-range.", "Emerging-market risk elevated."],
    clp: ["Dollar in Chile (USD/CLP)", "The peso is appreciating.", "Peso stable over the last 3 months.", "The peso lost more than 4% in 3 months."],
    hg: ["Copper (USD/lb)", "Rising: firm industrial demand; good for Chile.", "Stable: no signal from Chinese demand.", "Falling: weak industrial demand; bad for Chile."],
    bz: ["Brent crude (USD/barrel)", "", "No price shock in 3 months.", "A move of more than 25% in 3 months: oil shocks precede recessions."],
    gc: ["Gold (USD/oz)", "", "No rush to safety.", "Up more than 10% in 3 months: safe-haven demand."],
    cape: ["Shiller CAPE, S&P 500", "Cheap valuation: historically, better 10-year returns.", "Mid-range valuation.", "Very demanding valuation: points to low 10-year returns, not 1-year."],
    ecy: ["Equity risk premium (excess CAPE yield)", "Good compensation for risk versus bonds.", "Risk compensation mid-range.", "Little compensation for risk versus inflation-linked bonds."],
    br: ["Breadth: markets above their 200-day average", "Uptrend with a broad base across the 21 markets.", "Mixed trend across markets.", "Most markets below their long-term trend."],
  },
  pt: {
    vix: ["VIX (volatilidade implícita do S&P 500)", "Calmaria: abaixo de 16 o mercado não paga por proteção.", "Medo moderado; acima de 25 costuma acompanhar quedas fortes.", "Medo alto: acima de 25 o mercado paga caro por proteção."],
    rv: ["Volatilidade realizada do S&P 500 (21 dias)", "Abaixo da média histórica de cerca de 16%.", "Perto da média histórica de 16%.", "Acima de 20%: oscilações diárias grandes."],
    tnx: ["Treasury dos EUA de 10 anos", "Caiu mais de 40 pb em 3 meses: capital mais barato.", "Sem choque de juros nos últimos 3 meses.", "Subiu mais de 40 pb em 3 meses: capital mais caro, pesa nas ações."],
    curve: ["Curva 10 anos menos 3 meses", "Inclinação saudável: sem sinal de recessão.", "Positiva mas plana: sinal fraco de recessão.", "Invertida: o preditor clássico de recessão."],
    rec: ["Probabilidade de recessão nos EUA em 12 meses", "Baixa: abaixo de 25%.", "Intermediária; acima de 40% historicamente antecede recessões.", "Acima de 40%: nível que historicamente antecede recessões."],
    hy: ["Spread high yield dos EUA", "Estreito: o crédito não vê estresse. É o sinal antecedente mais confiável.", "Na faixa média: o crédito começa a pedir mais prêmio.", "Acima de 6%: o crédito precifica estresse."],
    nfci: ["Condições financeiras (NFCI)", "Abaixo de zero: mais folgadas que a média.", "Perto da média histórica.", "Acima de zero: mais restritivas que a média."],
    dxy: ["Dólar global (DXY)", "Enfraquece: alivia o financiamento dos emergentes.", "Estável nos últimos 3 meses.", "Fortalece: aperta o financiamento global e pesa nos emergentes."],
    em: ["Spread de bonds corporativos emergentes", "Risco emergente contido.", "Risco emergente na faixa média.", "Risco emergente elevado."],
    clp: ["Dólar no Chile (USD/CLP)", "O peso se valoriza.", "Peso estável nos últimos 3 meses.", "O peso perdeu mais de 4% em 3 meses."],
    hg: ["Cobre (USD/lb)", "Sobe: demanda industrial firme; favorece o Chile.", "Estável: sem sinal da demanda chinesa.", "Cai: demanda industrial fraca; prejudica o Chile."],
    bz: ["Petróleo Brent (USD/barril)", "", "Sem choque de preço em 3 meses.", "Movimento de mais de 25% em 3 meses: choques de petróleo antecedem recessões."],
    gc: ["Ouro (USD/oz)", "", "Sem corrida para o refúgio.", "Sobe mais de 10% em 3 meses: demanda de refúgio."],
    cape: ["CAPE de Shiller, S&P 500", "Valuation barato: historicamente, retornos melhores em 10 anos.", "Valuation na faixa média.", "Valuation muito exigente: indica retornos baixos em 10 anos, não em 1 ano."],
    ecy: ["Prêmio de risco das ações (CAPE em excesso)", "Boa compensação pelo risco frente aos títulos.", "Compensação pelo risco na faixa média.", "Pouca compensação pelo risco frente aos títulos indexados."],
    br: ["Amplitude: bolsas acima da média de 200 dias", "Tendência de alta com base ampla entre as 21 bolsas.", "Tendência mista entre bolsas.", "Maioria das bolsas abaixo da tendência de longo prazo."],
  },
};
const GRP: Record<"en" | "pt", Record<string, string>> = {
  en: { "Riesgo y volatilidad": "Risk and volatility", "Tasas y ciclo": "Rates and cycle", "Crédito y liquidez": "Credit and liquidity", "Dólar y emergentes": "Dollar and emerging markets", "Materias primas": "Commodities", "Valoración y tendencia": "Valuation and trend" },
  pt: { "Riesgo y volatilidad": "Risco e volatilidade", "Tasas y ciclo": "Juros e ciclo", "Crédito y liquidez": "Crédito e liquidez", "Dólar y emergentes": "Dólar e emergentes", "Materias primas": "Commodities", "Valoración y tendencia": "Valuation e tendência" },
};
const FXN: Record<"en" | "pt", Record<string, string>> = {
  en: { USD: "US dollar", CLP: "Chilean peso", EUR: "Euro", GBP: "Pound sterling", JPY: "Japanese yen", CNY: "Chinese yuan", CHF: "Swiss franc", CAD: "Canadian dollar", AUD: "Australian dollar", KRW: "South Korean won", INR: "Indian rupee", BRL: "Brazilian real", MXN: "Mexican peso", ARS: "Argentine peso", COP: "Colombian peso", PEN: "Peruvian sol", DKK: "Danish krone", HKD: "Hong Kong dollar", TWD: "Taiwan dollar", SAR: "Saudi riyal" },
  pt: { USD: "Dólar americano", CLP: "Peso chileno", EUR: "Euro", GBP: "Libra esterlina", JPY: "Iene japonês", CNY: "Yuan chinês", CHF: "Franco suíço", CAD: "Dólar canadense", AUD: "Dólar australiano", KRW: "Won sul-coreano", INR: "Rupia indiana", BRL: "Real brasileiro", MXN: "Peso mexicano", ARS: "Peso argentino", COP: "Peso colombiano", PEN: "Sol peruano", DKK: "Coroa dinamarquesa", HKD: "Dólar de Hong Kong", TWD: "Dólar taiwanês", SAR: "Rial saudita" },
};
const CONE: Record<Lang, Record<string, string>> = {
  es: { ACWI: "MSCI Mundo", CHL: "MSCI Chile en pesos" }, en: { ACWI: "MSCI World", CHL: "MSCI Chile in pesos" }, pt: { ACWI: "MSCI Mundo", CHL: "MSCI Chile em pesos" },
};
const HOW: Record<Lang, Record<string, string>> = {
  es: { lr: "promedio de 10 años mezclado con el retorno de largo plazo de las acciones (7%)", cape: "promedio de 10 años mezclado con el retorno implícito en el CAPE (1/CAPE más inflación)" },
  en: { lr: "the 10-year average blended with the long-run equity return (7%)", cape: "the 10-year average blended with the return implied by the CAPE (1/CAPE plus inflation)" },
  pt: { lr: "média de 10 anos combinada com o retorno de longo prazo das ações (7%)", cape: "média de 10 anos combinada com o retorno implícito no CAPE (1/CAPE mais inflação)" },
};
const CO: Record<"en" | "pt", [string, string][]> = {
  en: [["Treasury 10a", "10y Treasury"], ["Dólar", "Dollar"], ["Petróleo", "Oil"], ["Cobre", "Copper"], ["Oro", "Gold"]],
  pt: [["Treasury 10a", "Treasury 10a"], ["Dólar", "Dólar"], ["Petróleo", "Petróleo"], ["Cobre", "Cobre"], ["Oro", "Ouro"]],
};
const SRC: Record<Lang, string[]> = {
  es: ["Yahoo Finance (índices, tasas, monedas, materias primas)", "FRED, Fed de St. Louis (spreads, NFCI, curva, tasa real)", "multpl.com (CAPE de Shiller)"],
  en: ["Yahoo Finance (indices, rates, currencies, commodities)", "FRED, St. Louis Fed (spreads, NFCI, curve, real rate)", "multpl.com (Shiller CAPE)"],
  pt: ["Yahoo Finance (índices, juros, moedas, commodities)", "FRED, Fed de St. Louis (spreads, NFCI, curva, juro real)", "multpl.com (CAPE de Shiller)"],
};

// Las cuatro frases de la lectura ejecutiva
export function lines(lang: string, D: RD): string[] {
  const l = (["es", "en", "pt"].includes(lang) ? lang : "es") as Lang, n = (s: string | null) => num(s ?? "s/d", l), h = HZN[l][D.k];
  const iname = (id: string, es: string) => (l === "es" ? es : IND[l][id]?.[0] || es);
  const regs = D.regs.map(([r, v]) => `${REG[l][r] || r} ${n(v)}`).join(", ");
  const out: string[] = [];
  const W = { es: "MSCI Mundo", en: "MSCI World", pt: "MSCI Mundo" }[l];
  out.push({
    es: `<b>${W} ${n(D.g)} ${h}.</b> Suben ${D.ups} de ${D.nn} bolsas; ${regs}.`,
    en: `<b>${W} ${n(D.g)} ${h}.</b> ${D.ups} of ${D.nn} markets up; ${regs}.`,
    pt: `<b>${W} ${n(D.g)} ${h}.</b> Sobem ${D.ups} de ${D.nn} bolsas; ${regs}.`,
  }[l]);
  if (D.mv) {
    const z = D.mv.z, nm = iname(D.mv.id, D.mv.n);
    const q = { es: z >= 2 ? "un movimiento poco habitual (fuera del 95% de los casos de los últimos años)." : z >= 1 ? "un movimiento algo mayor que lo normal." : "dentro de lo normal.",
      en: z >= 2 ? "an unusual move (outside 95% of cases in recent years)." : z >= 1 ? "a somewhat larger move than normal." : "within the normal range.",
      pt: z >= 2 ? "um movimento pouco comum (fora de 95% dos casos dos últimos anos)." : z >= 1 ? "um movimento um pouco maior que o normal." : "dentro do normal." }[l];
    out.push({ es: `<b>Lo que más se movió: ${nm}</b>, ${n(D.mv.s)} ${h}; ${q}`, en: `<b>Biggest mover: ${nm}</b>, ${n(D.mv.s)} ${h}; ${q}`, pt: `<b>O que mais se moveu: ${nm}</b>, ${n(D.mv.s)} ${h}; ${q}` }[l]);
  }
  if (D.cyc) {
    const c = D.cyc, st = { es: { f: "sin estrés", a: "con estrés", n: "zona media" }, en: { f: "no stress", a: "under stress", n: "mid-range" }, pt: { f: "sem estresse", a: "com estresse", n: "faixa média" } }[l][c.hs] || "";
    out.push({
      es: `<b>Ciclo y crédito:</b> curva 10a-3m en ${c.cv} (${c.inv ? "invertida" : "positiva"}), spread high yield en ${c.hy} (${st}) y probabilidad de recesión a 12 meses de ${c.rc}.`,
      en: `<b>Cycle and credit:</b> 10y-3m curve at ${n(c.cv)} (${c.inv ? "inverted" : "positive"}), high-yield spread at ${n(c.hy)} (${st}) and a 12-month recession probability of ${n(c.rc)}.`,
      pt: `<b>Ciclo e crédito:</b> curva 10a-3m em ${c.cv} (${c.inv ? "invertida" : "positiva"}), spread high yield em ${c.hy} (${st}) e probabilidade de recessão em 12 meses de ${c.rc}.`,
    }[l]);
  }
  if (D.chl) {
    const c = D.chl;
    out.push({
      es: `<b>Chile:</b> cobre ${n(c.hg)}, dólar ${n(c.cl)} (${c.clv}) y MSCI Chile en pesos ${n(c.ch)} ${h}.`,
      en: `<b>Chile:</b> copper ${n(c.hg)}, dollar ${n(c.cl)} (${n(c.clv)}) and MSCI Chile in pesos ${n(c.ch)} ${h}.`,
      pt: `<b>Chile:</b> cobre ${n(c.hg)}, dólar ${n(c.cl)} (${c.clv}) e MSCI Chile em pesos ${n(c.ch)} ${h}.`,
    }[l]);
  }
  return out;
}

// Arma la respuesta en el idioma pedido a partir del cálculo guardado
// deno-lint-ignore no-explicit-any
export function localize(p: any, lang: string): any {
  const l = (["es", "en", "pt"].includes(lang) ? lang : "es") as Lang;
  const n = (s: string) => num(s, l);
  // deno-lint-ignore no-explicit-any
  const out: any = { ...p, lang: l, sources: SRC[l] };
  // deno-lint-ignore no-explicit-any
  out.read = (p.read || []).map((r: any) => ({ score: r.score, prev: r.prev, lines: r.D ? lines(l, r.D) : r.lines }));
  // deno-lint-ignore no-explicit-any
  out.cones = (p.cones || []).map((c: any) => ({ ...c, n: CONE[l][c.s] || c.n, how: HOW[l][c.how] || c.how }));
  if (l === "es") return out;
  // deno-lint-ignore no-explicit-any
  out.inds = (p.inds || []).map((i: any) => {
    const t = IND[l][i.id]; const k = { f: 1, n: 2, a: 3 }[i.sg as "f" | "n" | "a"];
    // deno-lint-ignore no-explicit-any
    return { ...i, n: t?.[0] || i.n, g: GRP[l][i.g] || i.g, txt: (t && t[k]) || i.txt, v: n(i.v), d: (i.d || []).map((d: any) => (d ? { ...d, s: n(d.s) } : d)) };
  });
  // deno-lint-ignore no-explicit-any
  const fxd = (x: any) => (x ? { ...x, d: x.d.map((d: any) => (d ? { ...d, s: n(d.s) } : d)) } : x);
  // deno-lint-ignore no-explicit-any
  // deno-lint-ignore no-explicit-any
  out.cos = (p.cos || []).map((i: any) => ({ ...i, ipo: i.ipo ? { ...i.ipo, s: n(i.ipo.s) } : null, d: (i.d || []).map((d: any) => (d ? { ...d, s: n(d.s) } : d)) }));
  // deno-lint-ignore no-explicit-any
  out.countries = (p.countries || []).map((c: any) => ({ ...c, idx: c.idx.map((i: any) => ({ ...i, d: (i.d || []).map((d: any) => (d ? { ...d, s: n(d.s) } : d)) })) }));
  out.fx = (p.fx || []).map((f: any) => ({ ...f, n: FXN[l][f.c] || f.n, usd: fxd(f.usd), clp: fxd(f.clp) }));
  // deno-lint-ignore no-explicit-any
  out.evs = (p.evs || []).map((e: any) => ({ ...e, co: e.co.map((c: string) => { let x = c; for (const [a, b] of CO[l]) if (x.startsWith(a + " ")) { x = b + x.slice(a.length); break; } return n(x); }) }));
  return out;
}
