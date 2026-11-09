"""Bloque 3: jugadores (perfiles dinámicos ABC-XYZ y rating de impacto que aprende partido a partido), rating de playoffs,
Kalman para totales e incertidumbre del cierre de temporada. Solo información previa a cada partido.
Elección en validación 2024-25 (y 2023-24 para la dispersión); 2025-26 bajo llave, mirada una vez.
"""
import json, math, os, sys, traceback
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
import nba_lab as L
from block1 import metr, by_phase, wls
from block2 import kalman

log = L.log
HL_GAMES = 20          # media vida (partidos) de los perfiles de jugador
N0 = 10                # partidos con los que el perfil propio pesa 50% frente al de su segmento


# ---------------------------------------------------------------- planilla con totales del equipo
def prep_box(box, g):
    b = box.copy()
    for c in ("min", "pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "ftm", "fta", "oreb", "pf"):
        b[c] = pd.to_numeric(b[c], errors="coerce").fillna(0.0)
    b = b[b["min"] > 0]
    b["gs"] = L.game_score(b)
    b["use"] = b["fga"] + 0.44 * b["fta"] + b["tov"]
    tt = b.groupby(["game_id", "team"]).agg(t_use=("use", "sum"), t_min=("min", "sum")).reset_index()
    b = b.merge(tt, on=["game_id", "team"])
    b["use_sh"] = b["use"] / b["t_use"].clip(lower=1)
    meta = g[["id", "start_time", "season", "po", "home", "away", "margin"]].rename(columns={"id": "game_id"})
    b = b.merge(meta, on="game_id")
    b["home_side"] = (b["team"] == b["home"]).astype(int)
    return b.sort_values(["start_time", "game_id"]).reset_index(drop=True)


# ---------------------------------------------------------------- perfiles dinámicos + rating de impacto (filtro por jugador)
class Player:
    __slots__ = ("lvl", "use", "mpg", "m2", "n", "r", "P", "season", "last")

    def __init__(self, prior_r, season):
        self.lvl = 0.0; self.use = 0.0; self.mpg = 0.0; self.m2 = 0.0; self.n = 0.0
        self.r = prior_r; self.P = 16.0; self.season = season; self.last = None


def run_players(b, g, seg_stats=None, box_prior=None, R=170.0, q=0.02, p_season=3.0, revert=0.8):
    """Una pasada cronológica. Para cada partido devuelve: fuerza de jugadores local-visita (pts), varianza de erraticidad,
    y los perfiles (para segmentar). seg_stats: medias por segmento para encoger perfiles con poca historia.
    box_prior: función (lvl, use, mpg) -> rating previo para jugadores nuevos."""
    a = 1 - 0.5 ** (1 / HL_GAMES)
    P = {}
    rows_by_game = {gid: grp for gid, grp in b.groupby("game_id", sort=False)}
    out = {}
    prof_rows = []
    for gr in g.itertuples(index=False):
        grp = rows_by_game.get(gr.id)
        if grp is None:
            continue
        side = {1: [], 0: []}
        for r in grp.itertuples(index=False):
            p = P.get(r.athlete_id)
            if p is None:
                pr = box_prior(0, 0, 0) if box_prior else 0.0
                p = P[r.athlete_id] = Player(pr, r.season)
            if p.season != r.season:
                pr = box_prior(p.lvl, p.use, p.mpg) if box_prior else 0.0
                p.r = revert * p.r + (1 - revert) * pr
                p.P += p_season; p.season = r.season
            p.P += q
            side[r.home_side].append((r, p))
        # minutos esperados: promedio móvil de cada jugador presente, reescalado a 240
        def strength(lst):
            em = np.array([max(p.mpg if p.n >= 3 else 20.0, 1.0) for r, p in lst])
            em = em * 240.0 / em.sum()
            s = sum(e / 48 * p.r for e, (r, p) in zip(em, lst))
            # erraticidad esperada del equipo (varianza de Game Score de los presentes, ponderada por minutos)
            w = 0.0
            for e, (r, p) in zip(em, lst):
                var = (p.m2 - p.lvl ** 2) if p.n >= 3 else 50.0
                if seg_stats is not None and p.n < 60:   # encoger hacia su segmento
                    seg = seg_stats.get(segment_of(p, seg_stats["_thr"]), {})
                    k = p.n / (p.n + N0)
                    var = k * var + (1 - k) * seg.get("var", 50.0)
                w += (e / 48) ** 2 * max(var, 1.0)
            return s, w, em
        sh, wh, emh = strength(side[1]); sa, wa, ema = strength(side[0])
        out[gr.id] = {"pl_margin": sh - sa, "pl_var": wh + wa}
        # registrar perfiles previos al partido (para segmentar y para el prior)
        for lst in (side[1], side[0]):
            for r, p in lst:
                if p.n >= 20 and r.season <= L.TRAIN_MAX:
                    prof_rows.append((r.athlete_id, r.season, p.lvl, p.use, p.mpg, max(p.m2 - p.lvl ** 2, 0), p.r))
        # actualización del rating de impacto con el margen real (filtro: más incertidumbre => ajuste más rápido)
        xs = [(r.min / 48.0, p) for r, p in side[1]] + [(-r.min / 48.0, p) for r, p in side[0]]
        hc = 0.0 if getattr(gr, "neutral", False) else 2.0
        pred = sum(x * p.r for x, p in xs) + hc
        S = sum(x * x * p.P for x, p in xs) + R
        e = gr.margin - pred
        for x, p in xs:
            k = p.P * x / S
            p.r += k * e
            p.P = max(p.P - k * x * p.P, 0.05)
        # perfiles: nivel (Game Score por partido), volumen (porción de jugadas), minutos, erraticidad
        for lst in (side[1], side[0]):
            for r, p in lst:
                p.n += 1
                aa = max(a, 1.0 / p.n)
                p.lvl += aa * (r.gs - p.lvl); p.m2 += aa * (r.gs ** 2 - p.m2)
                p.use += aa * (r.use_sh - p.use); p.mpg += aa * (r.min - p.mpg)
    return out, pd.DataFrame(prof_rows, columns=["athlete_id", "season", "lvl", "use", "mpg", "var", "r"])


def segment_of(p, thr):
    lvl, cv = p.lvl, math.sqrt(max(p.m2 - p.lvl ** 2, 0)) / max(p.lvl, 1.0)
    abc = "A" if lvl >= thr["a"] else ("B" if lvl >= thr["b"] else "C")
    xyz = "X" if cv <= thr["x"] else ("Y" if cv <= thr["y"] else "Z")
    return abc + xyz


def build_segments(prof):
    last = prof.groupby(["athlete_id", "season"]).tail(1)
    thr = {"a": float(last["lvl"].quantile(0.8)), "b": float(last["lvl"].quantile(0.5))}
    cv = np.sqrt(last["var"]) / last["lvl"].clip(lower=1)
    thr["x"], thr["y"] = float(cv.quantile(1 / 3)), float(cv.quantile(2 / 3))
    last = last.assign(abc=np.where(last["lvl"] >= thr["a"], "A", np.where(last["lvl"] >= thr["b"], "B", "C")),
                       xyz=np.where(cv <= thr["x"], "X", np.where(cv <= thr["y"], "Y", "Z")))
    last["seg"] = last["abc"] + last["xyz"]
    seg = {s: {"n": int(len(d)), "var": float(d["var"].mean()), "r": float(d["r"].mean()), "lvl": float(d["lvl"].mean())} for s, d in last.groupby("seg")}
    seg["_thr"] = thr
    return seg, last


# ---------------------------------------------------------------- rating de playoffs (últimos ~110 partidos, playoffs x3, sin volver al promedio)
def playoff_rating(g, hl=55):
    a = 1 - 0.5 ** (1 / hl)
    st = {}
    out = []
    for r in g.itertuples(index=False):
        h = st.setdefault(r.home, [0.0, 0.0]); w = st.setdefault(r.away, [0.0, 0.0])
        out.append(h[0] - w[0])
        m = r.margin - (0 if r.neutral else 2.0) - (h[0] - w[0])   # sorpresa respecto del propio rating
        wt = 3.0 if r.po == 1 else 1.0
        for t, s in ((h, 1), (w, -1)):
            aa = min(1.0, a * wt)
            t[0] += aa * s * m / 2
    return np.array(out)


def main():
    games, ab, box, thr = L.load_real()
    g = L.build_games(games, ab).sort_values("start_time").reset_index(drop=True)
    g["neutral"] = g["neutral"].fillna(False).astype(bool)
    b = prep_box(box, g)
    log("planilla:", len(b))
    y = g["margin"].values.astype(float); tot = g["total"].values.astype(float)
    tr = ((g["season"] >= 2018) & (g["season"] <= L.TRAIN_MAX)).values
    v1 = (g["season"] == L.VALID[0]).values; v2 = (g["season"] == L.VALID[1]).values
    ho = (g["season"] == L.HOLD).values
    wts = 0.5 ** ((L.TRAIN_MAX - g["season"].values) / 1.0)
    rep = {}

    # pasada 1: perfiles y rating sin prior -> segmentos y mapa "perfil -> rating previo" (solo entrenamiento)
    out1, prof = run_players(b, g)
    seg, last = build_segments(prof)
    Xp = np.column_stack([np.ones(len(last)), last["lvl"], last["use"], last["mpg"]])
    bp = np.linalg.lstsq(Xp, last["r"].values, rcond=None)[0]
    box_prior = lambda lvl, use, mpg: float(bp[0] + bp[1] * lvl + bp[2] * use + bp[3] * mpg)
    rep["segmentos"] = {k: v for k, v in seg.items()}
    rep["prior_por_perfil"] = {"const": round(bp[0], 3), "nivel": round(bp[1], 3), "volumen": round(bp[2], 3), "minutos": round(bp[3], 3)}
    log("segmentos", {k: v["n"] for k, v in seg.items() if k != "_thr"})

    # pasada 2: con prior por perfil y erraticidad encogida a su segmento
    out2, _ = run_players(b, g, seg_stats=seg, box_prior=box_prior)
    g["pl_margin"] = g["id"].map(lambda i: out2.get(i, {}).get("pl_margin", np.nan))
    g["pl_var"] = g["id"].map(lambda i: out2.get(i, {}).get("pl_var", np.nan))
    ok = g["pl_margin"].notna().values
    g["pl_margin"] = g["pl_margin"].fillna(0.0); g["pl_var"] = g["pl_var"].fillna(g["pl_var"].median())

    # rating de playoffs y Kalman para totales
    g["po_rating"] = playoff_rating(g)
    g["po_x"] = g["po"] * g["po_rating"]
    km, kt, kv, _ = kalman(g.assign(Index_=np.arange(len(g))), R=180.0, q=0.08, shrink=0.8, p_season=4.0, adapt=False)
    g["kal_total"] = kt
    g["fin"] = ((g["f_gp_h"].fillna(0) >= 72) & (g["season_type"] == 2)).astype(float)

    # ---- modelos de margen
    def fit(name, cols, var_cols=None):
        X = np.column_stack([np.ones(len(g))] + [g[c].values.astype(float) for c in cols])
        msk = tr & ok
        bb = wls(X[msk], y[msk], wts[msk]); m = X @ bb
        # dispersión: s0 + a*var_cols, elegida en 2023-24
        best = None
        grid_a = [0.0] if not var_cols else [0.0, 0.02, 0.05, 0.1, 0.2]
        for s in np.arange(9.5, 15.01, 0.25):
            for aa in grid_a:
                for bf in ([0.0] if "fin" not in (var_cols or []) else [0.0, 10.0, 25.0, 45.0]):
                    extra = 0.0
                    if var_cols:
                        if "pl_var" in var_cols: extra = extra + aa * g["pl_var"].values
                        if "fin" in var_cols: extra = extra + bf * g["fin"].values
                    sd = np.sqrt(s * s + extra)
                    ll = metr(y[v1], m[v1], L.Phi(m[v1] / (sd[v1] if np.ndim(sd) else sd)))["logloss"]
                    if best is None or ll < best[0]: best = (ll, s, aa, bf)
        _, s, aa, bf = best
        extra = 0.0
        if var_cols:
            if "pl_var" in var_cols: extra = extra + aa * g["pl_var"].values
            if "fin" in var_cols: extra = extra + bf * g["fin"].values
        sd = np.sqrt(s * s + extra)
        g[f"m_{name}"] = m; g[f"p_{name}"] = L.Phi(m / sd)
        return {"coef": dict(zip(["const"] + cols, np.round(bb, 3).tolist())), "sigma": float(s), "a_var": aa, "b_fin": bf}

    base = ["f_d", "f_hb2b", "f_ab2b", "f_form", "xs", "xs1", "xa", "xb"]
    info = {
        "actual": fit("actual", base),
        "jugadores": fit("jugadores", base + ["pl_margin"]),
        "jugadores_sin_niveles": fit("jugadores_sin_niveles", ["f_d", "f_hb2b", "f_ab2b", "pl_margin"]),
        "jugadores+playoffs": fit("jugadores_po", base + ["pl_margin", "po_x"]),
        "jugadores+incertidumbre": fit("jugadores_inc", base + ["pl_margin"], var_cols=["pl_var", "fin"]),
        "completo": fit("completo", base + ["pl_margin", "po_x"], var_cols=["pl_var", "fin"]),
    }
    rep["modelos"] = info
    names = [("actual", "actual"), ("jugadores", "jugadores"), ("jugadores_sin_niveles", "jugadores_sin_niveles"),
             ("jugadores+playoffs", "jugadores_po"), ("jugadores+incertidumbre", "jugadores_inc"), ("completo", "completo")]
    rep["validacion_2024_25"] = {k: by_phase(g[v2 & ok], f"m_{n}", f"p_{n}") for k, n in names}

    # ---- totales
    def tot_fit(cols):
        X = np.column_stack([np.ones(len(g))] + [g[c].values.astype(float) for c in cols])
        bb = wls(X[tr], tot[tr], wts[tr]); return X @ bb
    early = ((g["f_gp_h"].fillna(99) + g["f_gp_a"].fillna(99)) < 8).astype(float)
    g["early"] = early
    t0 = tot_fit(["f_exp_total", "f_league", "po", "early"])
    t1 = tot_fit(["f_exp_total", "f_league", "po", "early", "kal_total"])
    rep["totales_mae"] = {"validacion": {"actual": round(float(np.abs(tot - t0)[v2].mean()), 2), "con_kalman": round(float(np.abs(tot - t1)[v2].mean()), 2)},
                          "bajo_llave": {"actual": round(float(np.abs(tot - t0)[ho].mean()), 2), "con_kalman": round(float(np.abs(tot - t1)[ho].mean()), 2)}}

    # ---- segmentos de figuras conocidas al final del entrenamiento (ilustrativo)
    names_map = b.drop_duplicates("athlete_id").set_index("athlete_id")["name"].to_dict()
    lastn = last.assign(nombre=last["athlete_id"].map(names_map))
    pick = lastn[lastn["nombre"].isin(["Stephen Curry", "LeBron James", "Nikola Jokic", "Giannis Antetokounmpo", "Luka Doncic", "Joel Embiid",
                                       "Anthony Davis", "Kawhi Leonard", "Rudy Gobert", "Jayson Tatum", "Devin Booker", "James Harden"])]
    pick = pick.sort_values("season").groupby("nombre").tail(1)
    rep["segmentos_figuras_2022_23"] = [{"jugador": r.nombre, "segmento": r.seg, "nivel": round(r.lvl, 1), "volumen": round(r.use, 3),
                                         "erraticidad": round(math.sqrt(r.var), 1), "impacto_por_48": round(r.r, 2)} for r in pick.itertuples()]

    # ---- una mirada a la temporada bajo llave
    rep["bajo_llave_2025_26"] = {k: by_phase(g[ho & ok], f"m_{n}", f"p_{n}") for k, n in names}
    rep["log"] = L.LOG
    with open(os.path.join(L.OUT, "block3.json"), "w") as fh:
        json.dump(rep, fh, ensure_ascii=False, indent=1, default=float)
    log("listo")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        tb = traceback.format_exc(); print(tb)
        with open(os.path.join(L.OUT, "error_block3.txt"), "w") as fh:
            fh.write(tb + "\n\n" + "\n".join(L.LOG))
