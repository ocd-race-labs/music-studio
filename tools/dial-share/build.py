"""Vistas previas para compartir radios de Dial Espejo (WhatsApp, iMessage, etc.).
Genera public/dial-espejo/og/<slug>.jpg (500x500: visor digital con la radio, favoritas y panal) y public/dial-espejo/r/<slug>/index.html
con las etiquetas og de cada radio; esa página redirige a la app (?r=<slug>).
Uso: python3 tools/dial-share/build.py   (correr de nuevo al agregar o renombrar radios)"""
import re, json, math, html, pathlib, unicodedata, asyncio, base64
ROOT = pathlib.Path(__file__).resolve().parents[2]
APP = ROOT / "public/dial-espejo"
SITE = "https://ocd-race-labs.github.io/music-studio/dial-espejo/"
src = (APP / "index.html").read_text()

FAM = {k: (n, c) for k, n, c in re.findall(r'(\w+):\["([^"]+)","[^"]+","(#[0-9A-Fa-f]{6})",\d+\]', src.split("const FAM=", 1)[1].split(";", 1)[0])}
CN = dict(re.findall(r'(\w\w):"([^"]+)"', src.split("const CN=", 1)[1].split("}", 1)[0]))
ST = []
for line in src.splitlines():
    if "=`" in line: line = line.split("=`", 1)[1]
    f = line.split("|")
    if len(f) >= 12 and f[3] in FAM and re.fullmatch(r"[A-Z]{2}", f[2] or ""):
        ST.append(dict(n=f[0], cc=f[2], g=f[3], fm=f[8]))

def slug(n):
    n = unicodedata.normalize("NFD", n)
    n = "".join(c for c in n if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", n))

def font(n):
    return base64.b64encode((pathlib.Path(__file__).parent / "fonts" / n).read_bytes()).decode()

FONTS = "".join(f"@font-face{{font-family:{f};font-weight:{w};src:url(data:font/woff2;base64,{font(n)})}}" for f, w, n in [
    ("Sora", 600, "sora-latin-600-normal.woff2"), ("Sora", 500, "sora-latin-500-normal.woff2"), ("Doto", 800, "doto-latin-800-normal.woff2"),
    ("STM", 400, "share-tech-mono-latin-400-normal.woff2"), ("GM", 500, "geist-mono-latin-500-normal.woff2")])
LC, LC2, LC3 = "#B5F23D", "#4FD9F0", "#FFC94A"   # tema por defecto de la app: radio, noticias, deportes

def hive(color):
    out = []
    for q, r in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1)]:
        x = 90 + 34 * math.sqrt(3) * (q + r / 2); y = 90 + 34 * 1.5 * r
        pts = " ".join(f"{x + 31*math.cos(math.radians(60*i-30)):.1f},{y + 31*math.sin(math.radians(60*i-30)):.1f}" for i in range(6))
        c = q == 0 and r == 0
        out.append(f'<polygon points="{pts}" fill="{color}" fill-opacity="{1 if c else .22}" stroke="{color}" stroke-opacity="{1 if c else .6}" stroke-width="2"/>')
    out.append('<path d="M83 78 L101 90 L83 102Z" fill="#07070A"/>')
    return f'<svg viewBox="0 0 180 180" width="180" height="180">{"".join(out)}</svg>'

def card(l1, l2, l3, color, favs):
    e = html.escape
    rows = "".join(f'<div class="fr"><i style="background:{c}"></i><b>{e(n)}</b><u></u></div>' for n, c in favs)
    return f"""<html><head><style>{FONTS}
html,body{{margin:0;width:500px;height:500px;overflow:hidden;background:#07070A}}
.c{{width:500px;height:500px;box-sizing:border-box;padding:26px;display:grid;grid-template-rows:auto auto 1fr;gap:18px;background:radial-gradient(90% 60% at 50% 0%,{LC}14,transparent 70%),#07070A;font-family:Sora;color:#EDEDF2}}
.hd{{display:flex;align-items:center;justify-content:space-between}}
.b{{font:600 25px Sora}} .b i{{font-style:normal;color:{LC}}}
.lv{{font:500 13px GM;letter-spacing:.14em;color:#9A9AA8;display:flex;align-items:center;gap:8px}} .lv:before{{content:"";width:8px;height:8px;border-radius:50%;background:#FF4D4D;box-shadow:0 0 10px #FF4D4D}}
.lcd{{padding:9px;border-radius:22px;background:linear-gradient(180deg,#1b1c20,#0c0d10);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 12px 30px -14px #000}}
.scr{{position:relative;overflow:hidden;border-radius:14px;padding:16px 18px 15px;display:grid;gap:7px;isolation:isolate;background:radial-gradient(120% 140% at 30% 20%,#141a0c,#040405 80%);box-shadow:inset 0 0 0 1px #000,inset 0 0 0 2px rgba(255,255,255,.05),inset 0 4px 14px rgba(0,0,0,.85),0 0 22px -10px {LC}}}
.scr:before{{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(circle,{LC}1A .7px,transparent 1.1px) 0 0/3px 3px,repeating-linear-gradient(0deg,rgba(0,0,0,.3) 0 1px,transparent 1px 3px)}}
.scr:after{{content:"";position:absolute;left:0;right:0;top:0;height:45%;background:linear-gradient(180deg,rgba(255,255,255,.07),transparent)}}
.chip{{justify-self:start;padding:1px 8px;border:1px solid {LC2}73;border-radius:4px;font:400 15px/1.3 STM;letter-spacing:.06em;color:{LC2};text-shadow:0 0 6px {LC2}8C}}
.l1{{font:800 54px/1.04 Doto;text-transform:uppercase;color:{LC};text-shadow:0 0 1px {LC},0 0 10px {LC}99;white-space:nowrap;overflow:hidden}}
.l2{{font:800 25px/1.15 Doto;text-transform:uppercase;color:{LC2};text-shadow:0 0 7px {LC2}73;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.l3{{font:400 15px STM;letter-spacing:.08em;text-transform:uppercase;color:{LC3};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.bt{{display:grid;grid-template-columns:1fr 150px;gap:16px;align-items:center;min-height:0}}
.fv{{border:1px solid rgba(237,237,242,.09);border-radius:18px;padding:12px 14px;display:grid;gap:9px;background:#0E0E12}}
.fh{{font:500 11.5px GM;letter-spacing:.14em;color:#77778A}}
.fr{{display:flex;align-items:center;gap:10px;min-width:0}} .fr i{{flex:none;width:9px;height:9px;border-radius:50%}}
.fr b{{flex:1;min-width:0;font:500 17px Sora;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.fr u{{flex:none;width:24px;height:24px;border-radius:50%;border:1px solid rgba(237,237,242,.18);position:relative}}
.fr u:after{{content:"";position:absolute;left:9px;top:7px;border-left:8px solid #EDEDF2;border-top:5px solid transparent;border-bottom:5px solid transparent}}
.hv svg{{width:150px;height:150px}}
</style></head><body><div class="c">
<div class="hd"><div class="b">Dial <i>Espejo</i></div><div class="lv">EN VIVO</div></div>
<div class="lcd"><div class="scr"><div class="chip">TOCA ▶ PARA ESCUCHAR</div><div class="l1" id="l1">{e(l1)}</div><div class="l2">{e(l2)}</div><div class="l3">{e(l3)}</div></div></div>
<div class="bt"><div class="fv"><div class="fh">FAVORITAS</div>{rows}</div><div class="hv">{hive(color)}</div></div>
</div></body></html>"""
FIT = """async()=>{await document.fonts.ready;const t=document.getElementById("l1");let f=54;const set=v=>{f=v;t.style.fontSize=v+"px"};
while(t.scrollWidth>t.clientWidth&&f>36)set(f-2);
if(t.scrollWidth>t.clientWidth){t.style.whiteSpace="normal";set(42);while((t.scrollHeight>f*1.04*2+4||t.scrollWidth>t.clientWidth)&&f>22)set(f-2)}}"""

def favs_for(s):
    same = [x for x in ST if x["g"] == s["g"] and x["n"] != s["n"]]
    other = [x for x in ST if x["g"] != s["g"]]
    pick = (same[:2] + other[:1]) if len(same) >= 2 else (same + other)[:3]
    return [(x["n"], FAM[x["g"]][1]) for x in pick]

async def render():
    from playwright.async_api import async_playwright
    out = APP / "og"; out.mkdir(exist_ok=True)
    jobs = [("dial-espejo", "Dial Espejo", "Radios de Chile y el mundo", "Por afinidad · un toque", "#EDEDF2",
             [(ST[0]["n"], FAM[ST[0]["g"]][1]), ("Hot 97", FAM["hiphop"][1]), ("KEXP", FAM["rock"][1])])]
    for s in ST:
        fam, col = FAM[s["g"]]
        l2 = fam + (f' · {s["fm"]} FM' if s["fm"] else "")
        jobs.append((slug(s["n"]), s["n"], l2, CN.get(s["cc"], s["cc"]), col, favs_for(s)))
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        p = await b.new_page(viewport={"width": 500, "height": 500})
        for name, l1, l2, l3, col, fv in jobs:
            await p.set_content(card(l1, l2, l3, col, fv)); await p.evaluate(FIT)
            await p.screenshot(path=str(out / f"{name}.jpg"), type="jpeg", quality=82)
        await b.close()

def pages():
    out = APP / "r"; n = 0
    for s in ST:
        sl = slug(s["n"]); fam, _ = FAM[s["g"]]
        desc = " · ".join(x for x in [fam, CN.get(s["cc"], s["cc"]), f'{s["fm"]} FM' if s["fm"] else ""] if x) + ". Toca y escucha en Dial Espejo."
        e = html.escape; url = f"{SITE}r/{sl}/"; app = f"../../?r={sl}"
        d = out / sl; d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(f'''<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>{e(s["n"])} · Dial Espejo</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="{e(desc)}">
<meta property="og:site_name" content="Dial Espejo">
<meta property="og:title" content="{e(s["n"])}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}og/{sl}.jpg">
<meta property="og:image:width" content="500"><meta property="og:image:height" content="500">
<meta name="twitter:card" content="summary">
<meta http-equiv="refresh" content="0;url={app}">
<script>location.replace("{app}")</script>
</head><body style="background:#07070A"><a href="{app}" style="color:#EDEDF2">{e(s["n"])} en Dial Espejo</a></body></html>
''')
        n += 1
    (APP / "r" / "slugs.json").write_text(json.dumps(sorted(slug(s["n"]) for s in ST)))
    return n

if __name__ == "__main__":
    asyncio.run(render())
    print(len(ST) + 1, "imágenes ·", pages(), "páginas de radio")
