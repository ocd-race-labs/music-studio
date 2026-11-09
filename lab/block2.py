"""Bloque 2: filtro de Kalman para equipos (ataque y defensa por separado) con volatilidad propia por equipo.
Cada equipo tiene su incertidumbre; si sus resultados se alejan seguido de lo pronosticado, su volatilidad sube y su rating
se acerca más rápido a lo reciente. Se compara con el modelo actual (Elo + ausencias, peso a lo reciente, dispersión calibrada).
Hiperparámetros elegidos en validación 2024-25; la temporada 2025-26 se mira una vez al final.
"""
import itertools, json, math, os, sys, traceback
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
import nba_lab as L
from block1 import metr, by_phase, wls

log = L.log


def kalman(g, R=130.0, q=0.6, shrink=0.75, p_season=9.0, adapt=True, alpha=0.08, vmax=3.0, hca=2.0, abs_adj=None, p0=25.0):
    """Recorre los partidos en orden y devuelve, para cada uno, el pronóstico previo (margen, total, varianza del margen)."""
    st = {}  # equipo -> dict(o, d, Po, Pd, vol, season, last_day)
    league = 110.0
    out_m, out_t, out_v, out_vol = [], [], [], []
    for r in g.itertuples(index=False):
        day = r.start_time.value / 8.64e13
        for t in (r.home, r.away):
            s = st.get(t)
            if s is None:
                s = st[t] = {"o": 0.0, "d": 0.0, "Po": p0, "Pd": p0, "vol": 1.0, "season": r.season, "day": day}
            if s["season"] != r.season:          # nueva temporada: vuelve parcialmente al promedio y crece la incertidumbre
                s["o"] *= shrink; s["d"] *= shrink
                s["Po"] += p_season; s["Pd"] += p_season
                s["season"] = r.season
            gap = max(min(day - s["day"], 10.0), 1.0)
            qq = q * (s["vol"] if adapt else 1.0) * gap ** 0.5
            s["Po"] += qq; s["Pd"] += qq
            s["day"] = day
        h, a = st[r.home], st[r.away]
        hc = 0.0 if r.neutral else hca
        adj = abs_adj[r.Index_] if abs_adj is not None else 0.0   # efecto esperado de las ausencias (margen local)
        eh = league + hc / 2 + h["o"] - a["d"] + adj / 2
        ea = league - hc / 2 + a["o"] - h["d"] - adj / 2
        var_m = h["Po"] + a["Pd"] + a["Po"] + h["Pd"]
        out_m.append(eh - ea); out_t.append(eh + ea); out_v.append(var_m); out_vol.append((h["vol"], a["vol"]))
        if r.home_score is None or (isinstance(r.home_score, float) and math.isnan(r.home_score)):
            continue
        # actualización con los puntos de cada equipo
        z2 = []
        for pts, exp, att, dfn in ((r.home_score, eh, h, a), (r.away_score, ea, a, h)):
            e = pts - exp
            S = att["Po"] + dfn["Pd"] + R
            ko, kd = att["Po"] / S, dfn["Pd"] / S
            att["o"] += ko * e; dfn["d"] -= kd * e
            att["Po"] *= (1 - ko); dfn["Pd"] *= (1 - kd)
            z2.append(e * e / S)
        if adapt:   # volatilidad: promedio móvil de la sorpresa normalizada de cada equipo
            for tm, zz in ((h, z2[0] / 2 + z2[1] / 2), (a, z2[0] / 2 + z2[1] / 2)):
                tm["vol"] = float(np.clip((1 - alpha) * tm["vol"] + alpha * zz, 0.5, vmax))
        league += 0.003 * ((r.home_score + r.away_score) / 2 - league)
    return np.array(out_m), np.array(out_t), np.array(out_v), np.array(out_vol)


def ll_raw(m, y, mask):
    best = 9e9
    for s in np.arange(10, 16.01, 0.5):
        p = np.clip(L.Phi(m[mask] / s), 1e-4, 1 - 1e-4); w = (y[mask] > 0)
        ll = float(-(w * np.log(p) + (1 - w) * np.log(1 - p)).mean())
        best = min(best, ll)
    return best


def main():
    games, ab, box, thr = L.load_real()
    g = L.build_games(games, ab)
    g = g.sort_values("start_time").reset_index(drop=True)
    g["Index_"] = np.arange(len(g))
    g = g.rename(columns={"Index_": "Index_"})
    y = g["margin"].values.astype(float)
    tot = g["total"].values.astype(float)
    tr = ((g["season"] >= 2018) & (g["season"] <= L.TRAIN_MAX)).values
    v1 = (g["season"] == L.VALID[0]).values
    v2 = (g["season"] == L.VALID[1]).values
    va = v1 | v2
    ho = (g["season"] == L.HOLD).values
    rep = {}

    # --- modelo actual (bloque 1): Elo + ausencias, peso a lo reciente, dispersión elegida
    X = g[L.BASE_VARS].values.astype(float)
    wts = 0.5 ** ((L.TRAIN_MAX - g["season"].values) / 1.0)
    b0 = wls(X[tr], y[tr], wts[tr])
    m0 = X @ b0
    abs_vars = ["xs", "xs1", "xa", "xb"]
    abs_eff = g[abs_vars].values @ b0[[L.BASE_VARS.index(v) for v in abs_vars]]   # efecto de ausencias en el margen

    # --- búsqueda de hiperparámetros del filtro (validación 2023-24: log loss del margen del filtro por sí solo)
    grid = list(itertools.product([110.0, 140.0], [0.3, 0.8, 1.5], [0.6, 0.8], [4.0, 12.0], [False, True]))
    res = []
    for R, q, sh, ps, ad in grid:
        km, kt, kv, _ = kalman(g, R=R, q=q, shrink=sh, p_season=ps, adapt=ad, abs_adj=abs_eff)
        res.append({"R": R, "q": q, "shrink": sh, "p_season": ps, "adapt": ad, "ll_v1": round(ll_raw(km, y, v1), 5)})
    res.sort(key=lambda r: r["ll_v1"])
    rep["busqueda_top"] = res[:8]
    best_fixed = next(r for r in res if not r["adapt"])
    best_adapt = next(r for r in res if r["adapt"])
    log("mejor fijo", best_fixed, "mejor adaptativo", best_adapt)

    variants = {}
    for name, hp in (("kalman_fijo", best_fixed), ("kalman_adaptativo", best_adapt)):
        km, kt, kv, vol = kalman(g, R=hp["R"], q=hp["q"], shrink=hp["shrink"], p_season=hp["p_season"], adapt=hp["adapt"], abs_adj=abs_eff)
        g[f"{name}_m"], g[f"{name}_t"], g[f"{name}_v"] = km, kt, kv
        g[f"{name}_volh"], g[f"{name}_vola"] = vol[:, 0], vol[:, 1]
        variants[name] = hp

    # --- modelos finales: el margen del filtro reemplaza al Elo y la forma; mismas variables de cansancio y ausencias
    def fit_eval(name, cols, sd_extra=None):
        Xk = np.column_stack([np.ones(len(g))] + [g[c].values.astype(float) for c in cols])
        b = wls(Xk[tr], y[tr], wts[tr]); m = Xk @ b
        # dispersión elegida en validación 2023-24 (con o sin la incertidumbre del filtro)
        best = None
        for s in np.arange(9.5, 16.01, 0.25):
            sd = np.sqrt(s * s + (g[sd_extra].values if sd_extra else 0))
            ll = metr(y[v1], m[v1], L.Phi(m[v1] / sd[v1] if sd_extra else m[v1] / s))["logloss"]
            if best is None or ll < best[1]: best = (s, ll)
        s = best[0]
        sd = np.sqrt(s * s + (g[sd_extra].values if sd_extra else 0))
        g[f"m_{name}"] = m; g[f"p_{name}"] = L.Phi(m / sd)
        return {"coef": dict(zip(["const"] + cols, np.round(b, 3).tolist())), "sigma": float(s)}

    base_cols = ["f_d", "f_hb2b", "f_ab2b", "f_form", "xs", "xs1", "xa", "xb"]
    info = {"actual": fit_eval("actual", base_cols)}
    for name in variants:
        cols = [f"{name}_m", "f_hb2b", "f_ab2b", "xs", "xs1", "xa", "xb"]
        info[name] = fit_eval(name, cols)
        info[name + "+incertidumbre"] = fit_eval(name + "_inc", cols, sd_extra=f"{name}_v")
    rep["modelos"] = info

    def evaluate(mask):
        return {k: by_phase(g[mask], f"m_{k2}", f"p_{k2}") for k, k2 in
                (("actual", "actual"), ("kalman_fijo", "kalman_fijo"), ("kalman_adaptativo", "kalman_adaptativo"),
                 ("kalman_adaptativo+incertidumbre", "kalman_adaptativo_inc"))}
    rep["validacion_2024_25"] = evaluate(v2)
    early = (g["f_gp_h"].fillna(99) < 10).values
    rep["validacion_inicio_temporada"] = {k: metr(y[v2 & early], g[f"m_{k}"].values[v2 & early], g[f"p_{k}"].values[v2 & early])
                                          for k in ("actual", "kalman_adaptativo")}
    # totales
    rep["totales_val_mae"] = {"actual": round(float(np.abs(tot[v2] - g["f_exp_total"].values[v2] - 0).mean()), 2),
                              "kalman_adaptativo": round(float(np.abs(tot[v2] - (g["kalman_adaptativo_t"].values[v2])).mean()), 2)}
    # equipos con más volatilidad aprendida al final de 2024-25 (ilustrativo)
    last = g[v2].groupby("home").tail(1)
    rep["volatilidad_equipos_fin_2024_25"] = sorted([{"equipo": r.home, "volatilidad": round(float(r.kalman_adaptativo_volh), 2)} for r in last.itertuples()],
                                                    key=lambda x: -x["volatilidad"])[:8]

    # --- una mirada a la temporada bajo llave
    rep["bajo_llave_2025_26"] = evaluate(ho)
    rep["bajo_llave_inicio_temporada"] = {k: metr(y[ho & early], g[f"m_{k}"].values[ho & early], g[f"p_{k}"].values[ho & early])
                                          for k in ("actual", "kalman_adaptativo")}
    rep["totales_bajo_llave_mae"] = {"actual": round(float(np.abs(tot[ho] - g["f_exp_total"].values[ho]).mean()), 2),
                                     "kalman_adaptativo": round(float(np.abs(tot[ho] - g["kalman_adaptativo_t"].values[ho]).mean()), 2)}
    rep["hiperparametros"] = variants
    rep["log"] = L.LOG
    with open(os.path.join(L.OUT, "block2.json"), "w") as fh:
        json.dump(rep, fh, ensure_ascii=False, indent=1, default=float)
    log("listo")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        tb = traceback.format_exc(); print(tb)
        with open(os.path.join(L.OUT, "error_block2.txt"), "w") as fh:
            fh.write(tb + "\n\n" + "\n".join(L.LOG))
