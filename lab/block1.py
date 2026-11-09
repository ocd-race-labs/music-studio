"""Bloque 1: castigos (qué error se optimiza), peso a lo reciente, calibración y referencia de mercado.
Se elige todo con validación (2023-24 y 2024-25); la temporada 2025-26 se mira una vez al final.
"""
import json, math, os, sys, time, traceback
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
import nba_lab as L

DATA = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA, exist_ok=True)
log = L.log


# ---------------------------------------------------------------- mercado (ESPN pickcenter), con caché en el repo
def odds_one(gid):
    import requests
    for attempt in range(4):
        try:
            r = requests.get(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={gid}",
                             headers={"User-Agent": "Mozilla/5.0 (DialEspejo lab)"}, timeout=30)
            if r.status_code == 404:
                return {"id": gid}
            r.raise_for_status()
            j = r.json()
            break
        except Exception:
            time.sleep(2 * (attempt + 1))
    else:
        return {"id": gid, "err": 1}
    out = {"id": gid}
    pcs = j.get("pickcenter") or []
    if not pcs:
        return out
    pc = pcs[0]
    out["prov"] = (pc.get("provider") or {}).get("name")
    out["spread"] = pc.get("spread")
    out["ou"] = pc.get("overUnder")
    ho, ao = pc.get("homeTeamOdds") or {}, pc.get("awayTeamOdds") or {}
    out["home_fav"] = ho.get("favorite")
    out["ml_h"] = ho.get("moneyLine")
    out["ml_a"] = ao.get("moneyLine")
    out["details"] = pc.get("details")
    return out


def load_odds(ids):
    path = os.path.join(DATA, "odds.csv")
    have = pd.read_csv(path, dtype={"id": str}) if os.path.exists(path) else pd.DataFrame(columns=["id"])
    todo = [i for i in ids if i not in set(have["id"])]
    log("cuotas en caché:", len(have), "por traer:", len(todo))
    if todo:
        rows = []
        with ThreadPoolExecutor(12) as ex:
            for k, r in enumerate(ex.map(odds_one, todo)):
                rows.append(r)
                if k % 2000 == 0: log("  cuotas", k)
        have = pd.concat([have, pd.DataFrame(rows)], ignore_index=True)
        have.to_csv(path, index=False)
    return have


def ml_prob(ml):
    ml = float(ml)
    return 100 / (ml + 100) if ml > 0 else -ml / (-ml + 100)


def market_cols(g, odds):
    o = odds.copy()
    o["id"] = o["id"].astype(str)
    g = g.merge(o, on="id", how="left")
    sp = pd.to_numeric(g.get("spread"), errors="coerce")
    fav = g.get("home_fav")
    # el 'spread' de ESPN va desde el local: negativo si el local es favorito; se valida con la marca de favorito
    mk = -sp
    if fav is not None:
        favb = fav.map(lambda x: True if str(x).lower() == "true" else (False if str(x).lower() == "false" else np.nan))
        wrong = (favb == True) & (mk < 0) | (favb == False) & (mk > 0)
        mk = np.where(wrong, -mk, mk)
    g["mkt_margin"] = mk
    ph = g["ml_h"].map(lambda x: ml_prob(x) if pd.notna(x) and str(x) not in ("", "nan") else np.nan)
    pa = g["ml_a"].map(lambda x: ml_prob(x) if pd.notna(x) and str(x) not in ("", "nan") else np.nan)
    g["mkt_p"] = ph / (ph + pa)                       # sin el margen de la casa
    g["mkt_total"] = pd.to_numeric(g.get("ou"), errors="coerce")
    return g


# ---------------------------------------------------------------- métricas con probabilidad explícita
def metr(y, m, p):
    p = np.clip(p, 1e-4, 1 - 1e-4)
    w = (y > 0).astype(float)
    return {"n": int(len(y)), "acierto": round(float(((p >= .5) == (y > 0)).mean()), 4),
            "mae": round(float(np.abs(y - m).mean()), 3) if m is not None else None,
            "brier": round(float(((p - w) ** 2).mean()), 5),
            "logloss": round(float(-(w * np.log(p) + (1 - w) * np.log(1 - p)).mean()), 5)}


def by_phase(df, mcol, pcol):
    out = {}
    for name, mask in (("todo", np.ones(len(df), bool)), ("regular", df["po"].values == 0), ("playoffs", df["po"].values == 1)):
        d = df[mask]
        if len(d) >= 20:
            out[name] = metr(d["margin"].values, d[mcol].values if mcol else None, d[pcol].values)
    return out


# ---------------------------------------------------------------- ajustes
def wls(X, y, w):
    W = w[:, None]
    A = X.T @ (X * W) + 1e-6 * len(X) * np.eye(X.shape[1])
    return np.linalg.solve(A, X.T @ (w * y))


def huber_fit(X, y, w, delta):
    b = wls(X, y, w)
    for _ in range(30):  # mínimos cuadrados reponderados
        r = y - X @ b
        hw = np.where(np.abs(r) <= delta, 1.0, delta / np.maximum(np.abs(r), 1e-9))
        nb = wls(X, y, w * hw)
        if np.max(np.abs(nb - b)) < 1e-6: break
        b = nb
    return b


def main():
    games, ab, box, thr = L.load_real()
    g = L.build_games(games, ab)
    g = g[g["season"] >= 2018].reset_index(drop=True)
    tr = (g["season"] <= L.TRAIN_MAX).values
    va = g["season"].isin(L.VALID).values
    ho = (g["season"] == L.HOLD).values
    X = g[L.BASE_VARS].values.astype(float)
    y = g["margin"].values.astype(float)
    rep = {}

    # --- variantes de castigo y peso a lo reciente: margen
    cands = {}
    last = L.TRAIN_MAX
    for hl in (None, 1, 2, 3, 5):
        w = np.ones(len(g)) if hl is None else 0.5 ** ((last - g["season"].values) / hl)
        for loss in ("cuadrado", "huber8", "huber12", "huber16"):
            b = wls(X[tr], y[tr], w[tr]) if loss == "cuadrado" else huber_fit(X[tr], y[tr], w[tr], float(loss[5:]))
            m = X @ b
            cands[(loss, hl)] = {"coef": b, "m": m}
    # sigma de la normal elegido en validación por log loss, para cada candidato
    best = None
    table = []
    for k, c in cands.items():
        m = c["m"]
        bs, bl = None, 1e9
        for s in np.arange(10.5, 16.01, 0.25):
            p = L.Phi(m[va] / s)
            ll = metr(y[va], m[va], p)["logloss"]
            if ll < bl: bs, bl = s, ll
        c["sigma"] = float(bs)
        mv = metr(y[va], m[va], L.Phi(m[va] / bs))
        table.append({"castigo": k[0], "media_vida_temporadas": k[1], "sigma": bs, **{f"val_{a}": v for a, v in mv.items() if a != "n"}})
        if best is None or mv["logloss"] < best[1]["logloss"] - 1e-5:
            best = (k, mv)
    rep["castigos_validacion"] = sorted(table, key=lambda r: r["val_logloss"])[:12]
    base_k = ("cuadrado", None)
    rep["elegido"] = {"castigo": best[0][0], "media_vida": best[0][1], "sigma": cands[best[0]]["sigma"]}
    log("elegido", rep["elegido"])

    # --- ajuste directo de la probabilidad (logística sobre las mismas variables + margen)
    from sklearn.linear_model import LogisticRegression
    win = (y > 0).astype(int)
    mb = cands[best[0]]["m"]
    lr = LogisticRegression(C=1.0, max_iter=2000).fit(np.column_stack([mb[tr], X[tr]]), win[tr])
    p_lr = lr.predict_proba(np.column_stack([mb, X]))[:, 1]

    # --- calibración (isotónica y Platt) ajustada en validación
    from sklearn.isotonic import IsotonicRegression
    p_best = L.Phi(mb / cands[best[0]]["sigma"])
    # para no calibrar sobre lo mismo que evalúa, se calibra con 2023-24 y se mide en 2024-25
    v1 = (g["season"] == L.VALID[0]).values; v2 = (g["season"] == L.VALID[1]).values
    iso = IsotonicRegression(out_of_bounds="clip", y_min=.01, y_max=.99).fit(p_best[v1], win[v1])
    platt = LogisticRegression(C=1e6, max_iter=1000).fit(np.log(p_best[v1] / (1 - p_best[v1])).reshape(-1, 1), win[v1])
    p_iso = iso.predict(p_best)
    p_platt = platt.predict_proba(np.log(p_best / (1 - p_best)).reshape(-1, 1))[:, 1]
    p_base = L.Phi(cands[base_k]["m"] / 13.6)
    g["m_base"], g["p_base"] = cands[base_k]["m"], p_base
    g["m_best"], g["p_best"] = mb, p_best
    g["p_lr"], g["p_iso"], g["p_platt"] = p_lr, p_iso, p_platt
    rep["validacion_2024_25"] = {k: by_phase(g[v2], m, p) for k, m, p in (("actual", "m_base", "p_base"), ("castigo_elegido", "m_best", "p_best"),
                                                                       ("logistica", "m_best", "p_lr"), ("isotonica", "m_best", "p_iso"), ("platt", "m_best", "p_platt"))}
    # calibración por tramos (validación 2024-25, modelo actual vs elegido)
    cal = []
    for lo, hi in ((.5, .6), (.6, .7), (.7, .8), (.8, .9), (.9, 1.01)):
        for name, pc in (("actual", "p_base"), ("elegido", "p_best")):
            q = np.maximum(g[pc], 1 - g[pc])
            msk = v2 & (q >= lo) & (q < hi)
            if msk.sum() > 20:
                ok = ((g[pc] >= .5) == (g["margin"] > 0))[msk].mean()
                cal.append({"modelo": name, "tramo": f"{int(lo*100)}-{int(min(hi,1)*100)}%", "n": int(msk.sum()), "prob_media": round(float(q[msk].mean()), 3), "acierto": round(float(ok), 3)})
    rep["calibracion_val"] = cal

    # --- totales: sesgo de inicio de temporada
    tot_res = g["total"] - (g["f_exp_total"] if "f_exp_total" in g else g["total"].mean())
    early = g["f_gp_h"].fillna(99) + g["f_gp_a"].fillna(99) < 8
    rep["totales_inicio_temporada"] = {"error_medio_primeros_4_partidos": round(float(tot_res[early].mean()), 2), "n": int(early.sum()),
                                       "error_medio_resto": round(float(tot_res[~early].mean()), 2)}

    # --- mercado
    odds = load_odds(g["id"].astype(str).tolist())
    g = market_cols(g, odds)
    has = g["mkt_p"].notna().values & g["mkt_margin"].notna().values
    rep["mercado_cobertura"] = {str(s): round(float(has[g["season"].values == s].mean()), 3) for s in sorted(g["season"].unique())}
    for nm, msk in (("validacion_2024_25", v2 & has), ("bajo_llave_2025_26", ho & has)):
        if msk.sum() > 50:
            d = g[msk]
            rep[f"vs_mercado_{nm}"] = {
                "mercado": by_phase(d, "mkt_margin", "mkt_p"),
                "actual": by_phase(d, "m_base", "p_base"),
                "elegido": by_phase(d, "m_best", "p_best"),
                "acuerdo_con_mercado_en_ganador": round(float(((d["p_best"] >= .5) == (d["mkt_p"] >= .5)).mean()), 3),
                "cuando_discrepamos": {"n": int(((d["p_best"] >= .5) != (d["mkt_p"] >= .5)).sum()),
                                       "acierta_modelo": round(float(((d["p_best"] >= .5) == (d["margin"] > 0))[(d["p_best"] >= .5) != (d["mkt_p"] >= .5)].mean()), 3)},
                "error_total_mercado": round(float(np.abs(d["total"] - d["mkt_total"]).mean()), 2),
            }

    # --- una sola mirada a la temporada bajo llave, con lo elegido en validación
    best_cal = min(("p_best", "p_iso", "p_platt", "p_lr"), key=lambda c: metr(y[v2], None, g[c].values[v2])["logloss"])
    rep["calibracion_elegida"] = best_cal
    rep["bajo_llave_2025_26"] = {"actual": by_phase(g[ho], "m_base", "p_base"), "nuevo": by_phase(g[ho], "m_best", best_cal)}
    rep["coef_elegido"] = dict(zip(L.BASE_VARS, np.round(cands[best[0]]["coef"], 3).tolist()))
    rep["log"] = L.LOG
    with open(os.path.join(L.OUT, "block1.json"), "w") as fh:
        json.dump(rep, fh, ensure_ascii=False, indent=1, default=float)
    log("listo")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        tb = traceback.format_exc(); print(tb)
        with open(os.path.join(L.OUT, "error_block1.txt"), "w") as fh:
            fh.write(tb + "\n\n" + "\n".join(L.LOG))
