import json, math, random

random.seed(7)
# 126 dias de carga diária em "esforço" (unidade do Orbe; meta semanal 95).
# Semana típica de ciclista/corredor amador: 2 dias off, 1 longo, 1 forte.
pattern = [0, 14, 22, 0, 18, 34, 12]   # seg..dom, soma 100
load = []
for w in range(18):
    if w in (6, 7):        blk = 1.20   # bloco forte
    elif w in (8,):        blk = 0.62   # semana de recuperação
    elif w in (13, 14):    blk = 1.28   # segundo bloco, mais duro
    elif w in (15,):       blk = 0.52   # taper
    else:                  blk = 1.0
    for d in pattern:
        v = d * blk * random.uniform(0.82, 1.18)
        load.append(round(max(0.0, v), 1))

def ewma(xs, n):
    a, out, prev = 2 / (n + 1), [], None
    for x in xs:
        prev = x if prev is None else prev + a * (x - prev)
        out.append(prev)
    return out

# Escala semanal-equivalente (×7) para conversar com a meta semanal de 95.
ctl = [v * 7 for v in ewma(load, 42)]
atl = [v * 7 for v in ewma(load, 7)]
tsb = [c - a for c, a in zip(ctl, atl)]

import os
W, H, PADT, PADB = (840.0, 260.0, 14.0, 22.0) if os.environ.get("WEB") else (326.0, 150.0, 10.0, 18.0)
WIN = 90                                  # janela desenhada
def frame(end):
    s = slice(end - WIN, end)
    c, a, t = ctl[s], atl[s], tsb[s]
    lo, hi = min(min(c), min(a)), max(max(c), max(a))
    lo, hi = lo - 8, hi + 8
    def X(i): return round(i * (W / (WIN - 1)), 2)
    def Y(v): return round(PADT + (hi - v) * (H - PADT - PADB) / (hi - lo), 2)
    def line(vals): return "M " + " L ".join(f"{X(i)} {Y(v)}" for i, v in enumerate(vals))
    # regiões de sinal constante entre as duas curvas, com cruzamento interpolado
    regions, cur, sign = [], [], None
    for i in range(WIN):
        s_i = 1 if c[i] >= a[i] else -1
        if sign is None: sign, cur = s_i, [i]
        elif s_i == sign: cur.append(i)
        else:
            regions.append((sign, cur)); sign, cur = s_i, [cur[-1], i]
    regions.append((sign, cur))
    fills = []
    for sg, idxs in regions:
        if len(idxs) < 2: continue
        top = " L ".join(f"{X(i)} {Y(c[i])}" for i in idxs)
        bot = " L ".join(f"{X(i)} {Y(a[i])}" for i in reversed(idxs))
        fills.append({"sign": sg, "d": f"M {top} L {bot} Z"})
    base = f"{line(c)} L {X(WIN-1)} {Y(lo)} L {X(0)} {Y(lo)} Z"
    return {
        "ctl": line(c), "atl": line(a), "ctlArea": base, "fills": fills,
        "hoje": {"ctl": round(c[-1]), "atl": round(a[-1]), "tsb": round(t[-1]),
                 "x": X(WIN-1), "yc": Y(c[-1]), "ya": Y(a[-1])},
        "zeroY": Y(0) if lo < 0 < hi else None,
    }

# dois "hojes" na MESMA série: um fresco (pós-taper) e um enterrado (fim de bloco)
best = max(range(WIN + 5, len(tsb)), key=lambda i: tsb[i])
worst = min(range(WIN + 5, len(tsb)), key=lambda i: tsb[i])
out = {"fresco": frame(best + 1), "enterrado": frame(worst + 1)}

# faísca de 42 dias (saldo), no tamanho real de render, segmentada por sinal
def spark(end, w=322.0, h=40.0, pad=5.0):
    ss = tsb[end - 42:end]
    lo, hi = min(ss) - 4, max(ss) + 4
    def X(i): return round(i * (w / 41), 2)
    def Y(v): return round(pad + (hi - v) * (h - 2 * pad) / (hi - lo), 2)
    zero = round(pad + (hi - 0) * (h - 2 * pad) / (hi - lo), 2)
    # quebra em trechos de sinal constante, interpolando o cruzamento
    segs, cur, sign = [], [], None
    pts = []
    for i, v in enumerate(ss):
        pts.append((X(i), Y(v), v))
    for i, (x, y, v) in enumerate(pts):
        sg = 1 if v >= 0 else -1
        if sign is None: sign, cur = sg, [(x, y)]
        elif sg == sign: cur.append((x, y))
        else:
            px, py, pv = pts[i - 1]
            t = pv / (pv - v) if (pv - v) else 0
            cx, cy = round(px + (x - px) * t, 2), zero
            cur.append((cx, cy)); segs.append((sign, cur))
            sign, cur = sg, [(cx, cy), (x, y)]
    segs.append((sign, cur))
    return {"segs": [{"sign": sg, "d": "M " + " L ".join(f"{x} {y}" for x, y in pl)}
                     for sg, pl in segs if len(pl) > 1],
            "zero": zero, "endX": X(41), "endY": Y(ss[-1]), "w": w, "h": h}

out["fresco"]["spark"] = spark(best + 1)
out["enterrado"]["spark"] = spark(worst + 1)

# heatmap anual do saldo: 53 semanas × 7 dias, valores de tsb reciclados
year = (tsb * 3)[:371]
out["ano"] = [round(v) for v in year]

# ponto de scrub (web): o dia mais negativo DENTRO da janela desenhada
import datetime
HOJE = datetime.date(2026, 9, 3)
MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"]
for k, endi in (("fresco", best + 1), ("enterrado", worst + 1)):
    sl = slice(endi - WIN, endi)
    c, a, t = ctl[sl], atl[sl], tsb[sl]
    j = min(range(10, WIN - 6), key=lambda i: t[i])
    lo, hi = min(min(c), min(a)) - 8, max(max(c), max(a)) + 8
    X = lambda i: round(i * (W / (WIN - 1)), 2)
    Y = lambda v: round(PADT + (hi - v) * (H - PADT - PADB) / (hi - lo), 2)
    d = HOJE - datetime.timedelta(days=(WIN - 1 - j) + (len(tsb) - endi))
    out[k]["scrub"] = {"x": X(j), "yc": Y(c[j]), "ya": Y(a[j]),
                       "base": round(c[j]), "cansaco": round(a[j]), "saldo": round(t[j]),
                       "data": f"{d.day} DE {['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'][d.month-1]}"}
# rótulos do eixo x, reais
for k, endi in (("fresco", best + 1),):
    outd = []
    for frac in (0, 0.2, 0.4, 0.6, 0.8, 1.0):
        i = round(frac * (WIN - 1))
        d = HOJE - datetime.timedelta(days=(WIN - 1 - i) + (len(tsb) - endi))
        outd.append("hoje" if frac == 1.0 else f"{d.day} {MES[d.month-1]}")
    out["eixo"] = outd
out["escala"] = {"min": round(min(tsb)), "max": round(max(tsb))}
json.dump(out, open(os.environ.get("OUT", "chart.json"), "w"), indent=1)
print("fresco:", out["fresco"]["hoje"], "| enterrado:", out["enterrado"]["hoje"])
print("escala saldo:", out["escala"])
