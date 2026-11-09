"""Dial Espejo · Laboratorio de pronósticos NBA.

1) Modelo por figura: perfil de cada figura (volatilidad propia; sesgo, localía, sensibilidad al rival y riesgo de
   dejar el partido encogidos hacia el promedio de la liga; playoffs encogidos hacia su temporada regular).
2) Búsqueda libre de patrones: gradient boosting sobre el error del modelo, con validación 2023-24 y 2024-25 y la
   temporada 2025-26 bajo llave (se mira una sola vez, al final).
Todo con información disponible antes de cada partido. Lee Supabase solo con la llave pública (lectura).
Uso: python lab/nba_lab.py            (datos reales)
     python lab/nba_lab.py --synthetic (prueba local con datos inventados)
"""
import json, math, os, sys, time, traceback
import numpy as np
import pandas as pd

OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)
SB = "https://yfjaznujnvkqgdlbnviu.supabase.co"
KEY = os.environ.get("SB_KEY", "")
TRAIN_MAX, VALID, HOLD = 2023, (2024, 2025), 2026   # temporadas por año de término
SIG = 13.6
LOG = []


def log(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True)
    LOG.append(s)


# ---------------------------------------------------------------- datos
def fetch(table, select, filt="", order="id"):
    import requests
    H = {"apikey": KEY, "Authorization": "Bearer " + KEY}
    rows, off = [], 0
    while True:
        for attempt in range(5):
            try:
                r = requests.get(f"{SB}/rest/v1/{table}?select={select}{filt}&order={order}&limit=1000&offset={off}", headers=H, timeout=90)
                r.raise_for_status()
                break
            except Exception as e:  # reintento simple
                if attempt == 4:
                    raise
                time.sleep(3 * (attempt + 1))
        d = r.json()
        rows += d
        if len(d) < 1000:
            break
        off += 1000
    log(f"{table}: {len(rows)} filas")
    return pd.DataFrame(rows)


def load_real():
    games = fetch("dial_fc_games", "id,season,season_type,start_time,home,away,home_score,away_score,status,neutral,feat",
                  "&sport=eq.nba&status=eq.post&season=gte.2017")
    ab = fetch("dial_fc_game_abs", "game_id,home_abs,away_abs", order="game_id")
    box = fetch("dial_fc_box", "game_id,team,athlete_id,name,pos,min,pts,reb,ast,stl,blk,tov,fgm,fga,ftm,fta,oreb,pf",
                "&min=gt.0", order="game_id,athlete_id")
    thr = fetch("dial_fc_thr", "*", order="posg")
    return games, ab, box, thr


def load_synthetic(seed=1):
    rng = np.random.default_rng(seed)
    teams = ["ATL", "BOS", "DEN", "GS", "LAL", "MIA", "NY", "PHX", "SA", "UTAH"]
    rows, box, gid = [], [], 0
    strength = {t: rng.normal(0, 4) for t in teams}
    roster = {t: [f"{t}{i}" for i in range(8)] for t in teams}
    base_val = {p: rng.normal(10, 5) for t in teams for p in roster[t]}
    for season in range(2017, 2027):
        day = pd.Timestamp(f"{season - 1}-10-20", tz="UTC")
        for n in range(240):
            h, a = rng.choice(teams, 2, replace=False)
            gid += 1
            po = 3 if n > 220 else 2
            m = strength[h] - strength[a] + 2 + rng.normal(0, 13)
            hs = int(110 + m / 2 + rng.normal(0, 5)); as_ = int(hs - round(m))
            if as_ == hs: as_ -= 1
            st = day + pd.Timedelta(days=n // 3)
            feat = {"hca": 1, "d": (strength[h] - strength[a]), "hb2b": int(rng.random() < .15), "ab2b": int(rng.random() < .15),
                    "form": rng.normal(0, 3), "exp_total": 220 + rng.normal(0, 5), "league": 220, "po": int(po == 3),
                    "month": st.month, "gp_h": n // 5, "gp_a": n // 5, "elo_h": 1500 + 28 * strength[h], "elo_a": 1500 + 28 * strength[a],
                    "alt": int(h in ("DEN", "UTAH")), "derby": 0, "div": int(rng.random() < .3)}
            rows.append({"id": str(gid), "season": season, "season_type": po, "start_time": st.isoformat(), "home": h, "away": a,
                         "home_score": hs, "away_score": as_, "status": "post", "neutral": False, "feat": feat})
            for t in (h, a):
                for p in roster[t][:7]:
                    gs = base_val[p] + rng.normal(0, 7)
                    box.append({"game_id": str(gid), "team": t, "athlete_id": p, "name": p, "pos": rng.choice(["G", "F", "C"]),
                                "min": int(max(5, rng.normal(30, 6))), "pts": int(max(0, gs)), "reb": 5, "ast": 3, "stl": 1, "blk": 0,
                                "tov": 2, "fgm": 6, "fga": 12, "ftm": 3, "fta": 4, "oreb": 1, "pf": 2})
    games = pd.DataFrame(rows)
    ab = pd.DataFrame([{"game_id": r["id"], "home_abs": [], "away_abs": []} for r in rows])
    thr = pd.DataFrame([{"posg": p, "p95": 15, "p85": 12, "p65": 9} for p in ("G", "F", "C")])
    return games, ab, pd.DataFrame(box), thr


# ---------------------------------------------------------------- utilidades de evaluación
def Phi(z):
    return 0.5 * (1 + np.vectorize(math.erf)(z / math.sqrt(2)))


def evaluate(df, mcol, scol=None):
    y = df["margin"].values
    m = df[mcol].values
    s = df[scol].values if scol else np.full(len(df), SIG)
    p = np.clip(Phi(m / s), 1e-4, 1 - 1e-4)
    win = (y > 0).astype(float)
    return {"n": int(len(df)), "acierto": round(float(((m > 0) == (y > 0)).mean()), 4),
            "mae": round(float(np.abs(y - m).mean()), 3),
            "brier": round(float(((p - win) ** 2).mean()), 5),
            "logloss": round(float(-(win * np.log(p) + (1 - win) * np.log(1 - p)).mean()), 5)}


def split_eval(df, mcol, scol=None):
    out = {}
    for name, mask in (("todo", np.ones(len(df), bool)), ("regular", df["po"].values == 0), ("playoffs", df["po"].values == 1)):
        if mask.sum() >= 20:
            out[name] = evaluate(df[mask], mcol, scol)
    return out


# ---------------------------------------------------------------- base: modelo activo (ausencias) reajustado solo con entrenamiento
def abs_feats(row, side):
    lst = row[side] if isinstance(row[side], list) else []
    s = {"s": 0, "s1": 0, "a": 0, "b": 0}
    for x in lst:
        t, k = x.get("t"), x.get("k", 99)
        if t == "s":
            s["s"] += 1
            if k <= 2: s["s1"] += 1
        elif t == "a": s["a"] += 1
        elif t == "b": s["b"] += 1
    return s


def build_games(games, ab):
    g = games.copy()
    g["start_time"] = pd.to_datetime(g["start_time"], utc=True)
    F = pd.json_normalize(g["feat"]).add_prefix("f_")
    g = pd.concat([g.drop(columns=["feat"]).reset_index(drop=True), F], axis=1)
    g = g.merge(ab, left_on="id", right_on="game_id", how="left")
    for side, pre in (("home_abs", "h"), ("away_abs", "a")):
        A = pd.DataFrame([abs_feats(r, side) for _, r in g.iterrows()])
        for c in A.columns: g[f"{pre}abs_{c}"] = A[c].values
    for c in ("s", "s1", "a", "b"):
        g[f"x{c}"] = g[f"aabs_{c}"] - g[f"habs_{c}"]
    g["margin"] = g["home_score"] - g["away_score"]
    g["total"] = g["home_score"] + g["away_score"]
    g["po"] = (g["season_type"] == 3).astype(int)
    g["f_hca"] = g.get("f_hca", 1).fillna(1)
    return g.sort_values("start_time").reset_index(drop=True)


BASE_VARS = ["f_hca", "f_d", "f_hb2b", "f_ab2b", "f_form", "xs", "xs1", "xa", "xb"]


def ols(X, y):
    X = np.asarray(X, float)
    return np.linalg.lstsq(X.T @ X + 1e-6 * len(X) * np.eye(X.shape[1]), X.T @ y, rcond=None)[0]


# ---------------------------------------------------------------- calendario: descanso, densidad, viajes, rachas
COORD = {"ATL": (33.76, -84.40, -5), "BOS": (42.37, -71.06, -5), "BKN": (40.68, -73.98, -5), "CHA": (35.23, -80.84, -5), "CHI": (41.88, -87.67, -6),
         "CLE": (41.50, -81.69, -5), "DAL": (32.79, -96.81, -6), "DEN": (39.75, -105.01, -7), "DET": (42.34, -83.06, -5), "GS": (37.77, -122.39, -8),
         "HOU": (29.75, -95.36, -6), "IND": (39.76, -86.16, -5), "LAC": (33.95, -118.34, -8), "LAL": (34.04, -118.27, -8), "MEM": (35.14, -90.05, -6),
         "MIA": (25.78, -80.19, -5), "MIL": (43.05, -87.92, -6), "MIN": (44.98, -93.28, -6), "NO": (29.95, -90.08, -6), "NY": (40.75, -73.99, -5),
         "OKC": (35.46, -97.52, -6), "ORL": (28.54, -81.38, -5), "PHI": (39.90, -75.17, -5), "PHX": (33.45, -112.07, -7), "POR": (45.53, -122.67, -8),
         "SAC": (38.58, -121.50, -8), "SA": (29.43, -98.44, -6), "TOR": (43.64, -79.38, -5), "UTAH": (40.77, -111.90, -7), "WSH": (38.90, -77.02, -5)}


def km(a, b):
    if a not in COORD or b not in COORD: return 0.0
    (la1, lo1, _), (la2, lo2, _) = COORD[a], COORD[b]
    p1, p2 = math.radians(la1), math.radians(la2)
    d = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(d))


def schedule_feats(g):
    last = {}  # equipo -> estado
    rows = []
    for r in g.itertuples(index=False):
        day = (r.start_time - pd.Timedelta(hours=6)).normalize()
        venue = r.home
        out = {}
        for side, t in (("h", r.home), ("a", r.away)):
            st = last.get(t)
            if st is None or st["season"] != r.season:
                st = {"season": r.season, "days": [], "venue": t, "streak": 0, "m3": [], "road": 0}
            rest = (day - st["days"][-1]).days if st["days"] else 7
            dens = sum(1 for d in st["days"] if (day - d).days <= 7)
            out[f"{side}_rest"] = min(rest, 7)
            out[f"{side}_dens7"] = dens
            out[f"{side}_travel"] = km(st["venue"], venue)
            out[f"{side}_tz"] = (COORD.get(venue, (0, 0, -6))[2] - COORD.get(t, (0, 0, -6))[2])
            out[f"{side}_streak"] = st["streak"]
            out[f"{side}_m3"] = float(np.mean(st["m3"])) if st["m3"] else 0.0
            out[f"{side}_road"] = st["road"] if side == "a" else 0
            last[t] = st
        rows.append(out)
        # actualizar con el resultado
        for side, t in (("h", r.home), ("a", r.away)):
            st = last[t]
            m = r.margin if side == "h" else -r.margin
            st["days"] = (st["days"] + [day])[-10:]
            st["venue"] = venue
            st["streak"] = (st["streak"] + 1 if st["streak"] >= 0 else 1) if m > 0 else (st["streak"] - 1 if st["streak"] <= 0 else -1)
            st["m3"] = (st["m3"] + [m])[-3:]
            st["road"] = st["road"] + 1 if side == "a" else 0
    S = pd.DataFrame(rows)
    for c in S.columns: g[c] = S[c].values
    g["rest_diff"] = g["h_rest"] - g["a_rest"]
    return g


# ---------------------------------------------------------------- perfiles por figura (sin fuga)
def game_score(b):
    return (b.pts + 0.4 * b.fgm - 0.7 * b.fga - 0.4 * (b.fta - b.ftm) + 0.7 * b.oreb + 0.3 * (b.reb - b.oreb)
            + b.stl + 0.7 * b.ast + 0.7 * b.blk - 0.4 * b.pf - b.tov)


def star_games(box, g, thr):
    b = box.copy()
    for c in ("min", "pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "ftm", "fta", "oreb", "pf"):
        b[c] = pd.to_numeric(b[c], errors="coerce").fillna(0)
    b["gs"] = game_score(b)
    p = b["pos"].fillna("").str[0]
    b["posg"] = np.where(p == "C", "C", np.where(p.isin(["F", "S"]), "F", "G"))
    meta = g[["id", "start_time", "season", "po", "home", "away", "f_elo_h", "f_elo_a"]].rename(columns={"id": "game_id"})
    b = b.merge(meta, on="game_id", how="inner").sort_values(["athlete_id", "start_time"])
    # promedio previo dentro de la temporada (mín. 8 partidos) o temporada anterior
    grp = b.groupby(["athlete_id", "season"])
    b["n_prev"] = grp.cumcount()
    b["gs_prev"] = grp["gs"].transform(lambda s: s.shift().expanding().mean())
    b["min_prev"] = grp["min"].transform(lambda s: s.shift().expanding().mean())
    prev = b.groupby(["athlete_id", "season"]).agg(gs_ps=("gs", "mean"), min_ps=("min", "mean"), n_ps=("gs", "size")).reset_index()
    prev["season"] += 1
    b = b.merge(prev, on=["athlete_id", "season"], how="left")
    use_prev = (b["n_prev"] < 8) & (b["n_ps"] >= 20)
    b["prior"] = np.where(b["n_prev"] >= 8, b["gs_prev"], np.where(use_prev, b["gs_ps"], np.nan))
    b["pmin"] = np.where(b["n_prev"] >= 8, b["min_prev"], np.where(use_prev, b["min_ps"], np.nan))
    t = thr.set_index("posg")
    b["p85"] = b["posg"].map(t["p85"]).astype(float)
    s = b[(b["prior"] >= b["p85"]) & (b["pmin"] >= 25)].copy()
    s["dev"] = s["gs"] - s["prior"]
    s["home_side"] = (s["team"] == s["home"]).astype(int)
    s["opp"] = np.where(s["home_side"] == 1, s["f_elo_a"], s["f_elo_h"]).astype(float)
    s["opp_c"] = (s["opp"] - 1500) / 100
    s["exit"] = (s["min"] < 0.6 * s["pmin"]).astype(int)
    return s.sort_values("start_time").reset_index(drop=True)


def reliability_n0(s, col, by="athlete_id", min_n=60):
    """n0 = varianza del ruido por observación / varianza real entre jugadores (solo entrenamiento)."""
    agg = s.groupby(by)[col].agg(["mean", "var", "size"])
    agg = agg[agg["size"] >= min_n]
    if len(agg) < 10: return 1e9, 0.0
    noise = agg["var"].mean()
    tau2 = max(agg["mean"].var() - (agg["var"] / agg["size"]).mean(), 1e-6)
    return noise / tau2, tau2


def profile_features(s, g):
    """Para cada figura y partido: rasgos estimados solo con partidos anteriores; playoffs encogidos a su temporada regular."""
    tr = s[s["season"] <= TRAIN_MAX]
    tr_n = tr[tr["exit"] == 0]
    pop = {"vol2": float(tr_n["dev"].var()), "exit": float(tr["exit"].mean()),
           "loc": float(tr_n[tr_n.home_side == 1]["dev"].mean() - tr_n[tr_n.home_side == 0]["dev"].mean()),
           "slope": float(np.polyfit(tr_n["opp_c"], tr_n["dev"], 1)[0]), "exit_dev": float(tr[tr.exit == 1]["dev"].mean())}
    n0 = {}
    n0["bias"], _ = reliability_n0(tr_n, "dev")
    tr_n2 = tr_n.assign(d2=(tr_n["dev"] - tr_n["dev"].mean()) ** 2)
    n0["vol"], _ = reliability_n0(tr_n2, "d2")
    n0["exit"], _ = reliability_n0(tr, "exit")
    n0["loc"] = 4 * n0["bias"]          # diferencia de dos medias: ~4 veces más ruido
    n0["slope"] = n0["bias"] * 2
    n0["po"] = n0["bias"]               # desviación propia en playoffs respecto de su temporada regular
    log("n0 (partidos para confiar 50% en lo propio):", {k: round(v, 1) for k, v in n0.items()}, "población:", {k: round(v, 3) for k, v in pop.items()})

    acc = {}
    feats = []
    for r in s.itertuples(index=False):
        a = acc.setdefault(r.athlete_id, {"n": 0, "sd": 0., "sd2": 0., "nh": 0, "sh": 0., "na": 0, "sa": 0., "sx": 0., "sxx": 0., "sxy": 0.,
                                          "ne": 0, "nt": 0, "npo": 0, "spo": 0.})
        n = a["n"]
        bias = a["sd"] / (n + n0["bias"]) if n else 0.0
        mean = a["sd"] / n if n else 0.0
        var_i = (a["sd2"] / n - mean ** 2) if n > 2 else pop["vol2"]
        w = n / (n + n0["vol"])
        vol2 = w * var_i + (1 - w) * pop["vol2"]
        loc_i = (a["sh"] / a["nh"] - a["sa"] / a["na"]) if a["nh"] > 3 and a["na"] > 3 else pop["loc"]
        wl = min(a["nh"], a["na"]) / (min(a["nh"], a["na"]) + n0["loc"])
        loc = wl * loc_i + (1 - wl) * pop["loc"]
        denom = a["n"] * a["sxx"] - a["sx"] ** 2
        slope_i = (a["n"] * a["sxy"] - a["sx"] * a["sd"]) / denom if a["n"] > 10 and denom > 1e-6 else pop["slope"]
        ws = n / (n + n0["slope"])
        slope = ws * slope_i + (1 - ws) * pop["slope"]
        ex = (a["ne"] + pop["exit"] * n0["exit"]) / (a["nt"] + n0["exit"])
        po_dev = a["spo"] / (a["npo"] + n0["po"]) if a["npo"] else 0.0
        side = 1 if r.home_side == 1 else -1
        # desvío esperado sobre lo que ya captura el modelo por equipo (solo la parte propia de la figura)
        exp_dev = bias + (loc - pop["loc"]) * (0.5 if side == 1 else -0.5) + (slope - pop["slope"]) * r.opp_c \
            + (ex - pop["exit"]) * pop["exit_dev"] + (po_dev if r.po == 1 else 0.0)
        feats.append({"game_id": r.game_id, "team": r.team, "home_side": r.home_side, "exp_dev": exp_dev, "vol2": vol2 * (1 + 0 * r.po), "exit_p": ex})
        # actualizar con el resultado de este partido
        a["nt"] += 1; a["ne"] += int(r.exit)
        if r.exit == 0:
            dv = r.dev - (po_dev if r.po == 1 else 0)
            if r.po == 1:
                a["npo"] += 1; a["spo"] += r.dev - bias
            else:
                a["n"] += 1; a["sd"] += r.dev; a["sd2"] += r.dev ** 2
                a["sx"] += r.opp_c; a["sxx"] += r.opp_c ** 2; a["sxy"] += r.opp_c * r.dev
                if r.home_side == 1: a["nh"] += 1; a["sh"] += r.dev
                else: a["na"] += 1; a["sa"] += r.dev
    P = pd.DataFrame(feats)
    agg = P.groupby(["game_id", "home_side"]).agg(dev=("exp_dev", "sum"), vol2=("vol2", "sum"), n=("exp_dev", "size"),
                                                   vmax=("vol2", "max"), exitp=("exit_p", "sum")).reset_index()
    H = agg[agg.home_side == 1].drop(columns="home_side").add_prefix("h_star_").rename(columns={"h_star_game_id": "id"})
    A = agg[agg.home_side == 0].drop(columns="home_side").add_prefix("a_star_").rename(columns={"a_star_game_id": "id"})
    g = g.merge(H, on="id", how="left").merge(A, on="id", how="left")
    for c in [c for c in g.columns if "_star_" in c]: g[c] = g[c].fillna(0)
    g["star_dev"] = g["h_star_dev"] - g["a_star_dev"]
    g["star_vol2"] = g["h_star_vol2"] + g["a_star_vol2"]
    g["star_vmax"] = np.maximum(g["h_star_vmax"], g["a_star_vmax"])
    return g, {"poblacion": pop, "n0": n0}


# ---------------------------------------------------------------- principal
def main():
    synthetic = "--synthetic" in sys.argv
    games, ab, box, thr = load_synthetic() if synthetic else load_real()
    g = build_games(games, ab)
    g = g[g["season"] >= 2018].reset_index(drop=True) if not synthetic else g
    g = schedule_feats(g)
    tr = g["season"] <= TRAIN_MAX
    va = g["season"].isin(VALID)
    ho = g["season"] == HOLD
    log("partidos:", len(g), "entrenamiento:", int(tr.sum()), "validación:", int(va.sum()), "bajo llave:", int(ho.sum()))

    # 1) base reajustada con entrenamiento
    coef = ols(g.loc[tr, BASE_VARS].values, g.loc[tr, "margin"].values)
    g["pred_base"] = g[BASE_VARS].values @ coef
    sig_base = float(np.sqrt(((g.loc[tr, "margin"] - g.loc[tr, "pred_base"]) ** 2).mean()))
    g["sd_base"] = sig_base
    report = {"base_coef": dict(zip(BASE_VARS, np.round(coef, 3).tolist())), "sigma_base": round(sig_base, 3)}

    # 2) modelo por figura
    s = star_games(box, g, thr)
    log("actuaciones de figuras:", len(s), "jugadores:", s["athlete_id"].nunique())
    g, prof = profile_features(s, g)
    report["perfiles"] = prof
    res = g["margin"] - g["pred_base"]
    c_dev = float(np.polyfit(g.loc[tr, "star_dev"], res[tr], 1)[0])
    g["pred_fig"] = g["pred_base"] + c_dev * g["star_dev"]
    r2 = (g["margin"] - g["pred_fig"]) ** 2
    Xv = np.column_stack([np.ones(tr.sum()), g.loc[tr, "star_vol2"], g.loc[tr, "po"]])
    cv = ols(Xv, r2[tr].values)
    g["sd_fig"] = np.sqrt(np.clip(cv[0] + cv[1] * g["star_vol2"] + cv[2] * g["po"], 80, 400))
    report["figura"] = {"pts_margen_por_desvio_esperado": round(c_dev, 3), "varianza": {"base": round(cv[0], 2), "por_volatilidad": round(cv[1], 4), "playoffs": round(cv[2], 2)}}
    report["validacion"] = {"base": split_eval(g[va], "pred_base", "sd_base"), "figura": split_eval(g[va], "pred_fig", "sd_fig")}
    log("validación base   ", report["validacion"]["base"])
    log("validación figura ", report["validacion"]["figura"])

    # 3) búsqueda libre de patrones sobre el error del modelo por figura
    import lightgbm as lgb
    feats = ["f_d", "f_hb2b", "f_ab2b", "f_form", "f_exp_total", "f_league", "po", "f_month", "f_gp_h", "f_gp_a", "f_elo_h", "f_elo_a",
             "f_alt", "f_derby", "f_div", "xs", "xa", "xb", "habs_s", "aabs_s", "h_rest", "a_rest", "rest_diff", "h_dens7", "a_dens7",
             "h_travel", "a_travel", "h_tz", "a_tz", "h_streak", "a_streak", "h_m3", "a_m3", "a_road",
             "h_star_n", "a_star_n", "star_dev", "star_vol2", "star_vmax", "h_star_exitp", "a_star_exitp"]
    feats = [f for f in feats if f in g.columns]
    for f in feats: g[f] = pd.to_numeric(g[f], errors="coerce").astype(float)
    y = (g["margin"] - g["pred_fig"]).values
    params = dict(objective="regression", learning_rate=0.02, num_leaves=8, min_data_in_leaf=200, feature_fraction=0.7,
                  bagging_fraction=0.8, bagging_freq=1, lambda_l2=10.0, verbose=-1, seed=7)
    dtr = lgb.Dataset(g.loc[tr, feats], y[tr]); dva = lgb.Dataset(g.loc[va, feats], y[va])
    booster = lgb.train(params, dtr, num_boost_round=2000, valid_sets=[dva], callbacks=[lgb.early_stopping(100, verbose=False)])
    best_it = booster.best_iteration or 0
    log("boosting: mejores rondas", best_it)
    g["gb"] = booster.predict(g[feats], num_iteration=best_it) if best_it > 0 else 0.0
    # cuánto creerle al boosting: factor elegido en validación
    best_k, best_mae = 0.0, None
    for k in np.linspace(0, 1.5, 16):
        mae = float(np.abs(g.loc[va, "margin"] - (g.loc[va, "pred_fig"] + k * g.loc[va, "gb"])).mean())
        if best_mae is None or mae < best_mae - 1e-9: best_k, best_mae = float(k), mae
    g["pred_gb"] = g["pred_fig"] + best_k * g["gb"]
    # patrones de incertidumbre: boosting sobre el error al cuadrado (log)
    e2 = np.log1p((g["margin"] - g["pred_gb"]) ** 2)
    dtr2 = lgb.Dataset(g.loc[tr, feats], e2[tr]); dva2 = lgb.Dataset(g.loc[va, feats], e2[va])
    b2 = lgb.train(params, dtr2, num_boost_round=2000, valid_sets=[dva2], callbacks=[lgb.early_stopping(100, verbose=False)])
    it2 = b2.best_iteration or 0
    if it2 > 0:
        z = b2.predict(g[feats], num_iteration=it2)
        # calibrar a varianza real con una recta en entrenamiento
        cz = ols(np.column_stack([np.ones(tr.sum()), z[tr]]), ((g["margin"] - g["pred_gb"]) ** 2)[tr].values)
        g["sd_gb"] = np.sqrt(np.clip(cz[0] + cz[1] * z, 80, 400))
    else:
        g["sd_gb"] = g["sd_fig"]
    report["boosting"] = {"rondas_margen": best_it, "factor_validacion": round(best_k, 2), "rondas_incertidumbre": it2}
    report["validacion"]["boosting"] = split_eval(g[va], "pred_gb", "sd_gb")
    log("validación boost  ", report["validacion"]["boosting"])

    # importancia y patrones (con datos de entrenamiento + validación; descripción en palabras después)
    if best_it > 0:
        imp = booster.feature_importance("gain", iteration=best_it)
        top = sorted(zip(feats, imp), key=lambda x: -x[1])[:12]
        report["importancia_margen"] = [{"variable": f, "ganancia": round(float(v), 1)} for f, v in top]
        try:
            import shap
            sample = g.loc[tr | va, feats].sample(min(3000, int((tr | va).sum())), random_state=1)
            iv = shap.TreeExplainer(booster).shap_interaction_values(sample)
            m = np.abs(iv).mean(0); np.fill_diagonal(m, 0)
            pairs = sorted(((feats[i], feats[j], float(m[i, j])) for i in range(len(feats)) for j in range(i + 1, len(feats))), key=lambda x: -x[2])[:10]
            report["interacciones"] = [{"a": a, "b": b, "fuerza": round(v, 4)} for a, b, v in pairs]
        except Exception as e:
            report["interacciones_error"] = str(e)
    if it2 > 0:
        imp2 = b2.feature_importance("gain", iteration=it2)
        report["importancia_incertidumbre"] = [{"variable": f, "ganancia": round(float(v), 1)} for f, v in sorted(zip(feats, imp2), key=lambda x: -x[1])[:10]]

    # patrones simples por tramos: error medio del modelo por figura según cada variable (entrenamiento vs validación vs bajo llave)
    pats = []
    resid = g["margin"] - g["pred_fig"]
    for f in feats:
        x = g[f]
        if x.nunique() < 2: continue
        try:
            q = pd.qcut(x.rank(method="first"), 5, labels=False)
        except Exception:
            continue
        for b in range(5):
            m_tr = resid[tr & (q == b)].mean(); m_va = resid[va & (q == b)].mean(); m_ho = resid[ho & (q == b)].mean()
            n_tr = int((tr & (q == b)).sum()); n_va = int((va & (q == b)).sum())
            if n_va < 100: continue
            z_tr = m_tr / (13.6 / math.sqrt(max(n_tr, 1))); z_va = m_va / (13.6 / math.sqrt(n_va))
            if abs(z_tr) >= 2.5 and abs(z_va) >= 2 and np.sign(m_tr) == np.sign(m_va):
                lo, hi = float(x[q == b].min()), float(x[q == b].max())
                pats.append({"variable": f, "tramo": [round(lo, 2), round(hi, 2)], "efecto_entrenamiento": round(float(m_tr), 2),
                             "efecto_validacion": round(float(m_va), 2), "efecto_bajo_llave": round(float(m_ho), 2) if ho.any() else None,
                             "n_validacion": n_va})
    report["patrones_por_tramo"] = pats

    # 4) temporada bajo llave: una sola mirada al final
    if ho.any():
        report["bajo_llave"] = {k: split_eval(g[ho], m, sd) for k, m, sd in
                                (("base", "pred_base", "sd_base"), ("figura", "pred_fig", "sd_fig"), ("boosting", "pred_gb", "sd_gb"))}
        log("bajo llave", json.dumps(report["bajo_llave"]))
    # perfiles finales de figuras conocidas (con toda la historia)
    report["log"] = LOG
    with open(os.path.join(OUT, "report.json"), "w") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1, default=float)
    log("listo")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        tb = traceback.format_exc()
        print(tb)
        with open(os.path.join(OUT, "error.txt"), "w") as fh:
            fh.write(tb + "\n\n" + "\n".join(LOG))
        sys.exit(0)
