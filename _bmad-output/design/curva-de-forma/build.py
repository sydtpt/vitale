# -*- coding: utf-8 -*-
"""Gera os .dc.html das propostas da Curva de forma, com os caminhos SVG reais."""
import json

C = json.load(open("chart.json"))

T = dict(
    bg="#FFF7EE", bgWeb="#FAF3E6", surface="#FFFFFF", warm="#FFEFD9", mute="#F6ECDC",
    ink="#1F1B16", ink2="#5C534A", ink3="#9C928A", ink4="#C6BCAE",
    line="#EFE6D8", lineDeep="#E3D7C2",
    primary="#F25C2B", primaryDeep="#D9491B", primarySoft="#FFE3D2",
    green="#6FA86A", greenSoft="#E2EFD9", rose="#E26A8A", roseSoft="#FBE2E8",
    blue="#6E8CC9", yellow="#F5B946", red="#E05C5C",
)
FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&'
         'family=Geist+Mono:wght@400;500;600&display=swap">')
SANS = "'Manrope', system-ui, -apple-system, sans-serif"
SERIF = "'Instrument Serif', Georgia, serif"
MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

def head(extra_css=""):
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  {FONTS}
  <style>
    body {{ margin: 0; font-family: {SANS}; -webkit-font-smoothing: antialiased; }}
    a {{ color: {T['primary']}; text-decoration: none; }}
    a:hover {{ color: {T['primaryDeep']}; }}
    * {{ box-sizing: border-box; }}
    {extra_css}
  </style>
</helmet>"""

TAIL = "</x-dc>\n</body>\n</html>\n"

def fills_svg(frame, opacity_pos=".9", opacity_neg=".9"):
    out = []
    for f in frame["fills"]:
        col = T["greenSoft"] if f["sign"] > 0 else "rgba(224,92,92,0.20)"
        op = opacity_pos if f["sign"] > 0 else opacity_neg
        out.append(f'<path d="{f["d"]}" fill="{col}" opacity="{op}"></path>')
    return "\n        ".join(out)

def chart_svg(frame, w=326, h=150, show_cursor=True):
    return f"""<svg viewBox="0 0 {w} {h}" width="100%" height="{h}" style="display: block; overflow: visible">
        {fills_svg(frame)}
        <path d="{frame['ctlArea']}" fill="{T['ink']}" opacity="0.045"></path>
        <path d="{frame['ctl']}" fill="none" stroke="{T['ink']}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
        <path d="{frame['atl']}" fill="none" stroke="{T['rose']}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="4 3"></path>
        {'<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="1"></line>' % (frame['hoje']['x'], min(frame['hoje']['yc'], frame['hoje']['ya']), frame['hoje']['x'], max(frame['hoje']['yc'], frame['hoje']['ya']), T['lineDeep']) if show_cursor else ''}
        <circle cx="{frame['hoje']['x']}" cy="{frame['hoje']['yc']}" r="3.5" fill="{T['ink']}"></circle>
        <circle cx="{frame['hoje']['x']}" cy="{frame['hoje']['ya']}" r="3.5" fill="{T['rose']}"></circle>
      </svg>"""

# ── A · Faixa ──────────────────────────────────────────────────────────────
def artboard_a():
    fr, en = C["fresco"], C["enterrado"]
    props = ('{"estado":{"editor":"enum","options":["fresco","enterrado","cobertura"],'
             '"default":"fresco","section":"Estado"}}')
    logic = f"""
const DADOS = {{
  fresco: {{ base: {fr['hoje']['ctl']}, cansaco: {fr['hoje']['atl']}, saldo: {fr['hoje']['tsb']},
    titulo: 'Fresco', frase: 'Base mantida e cansaço baixo. Janela boa para um teste ou uma prova.',
    cor: '{T['green']}', tint: '{T['greenSoft']}' }},
  enterrado: {{ base: {en['hoje']['ctl']}, cansaco: {en['hoje']['atl']}, saldo: {en['hoje']['tsb']},
    titulo: 'Enterrado', frase: 'Segunda semana de bloco. O saldo negativo é esperado, mas já passou de -40.',
    cor: '{T['red']}', tint: 'rgba(224,92,92,0.16)' }},
  cobertura: {{ base: {fr['hoje']['ctl']}, cansaco: {fr['hoje']['atl']}, saldo: {fr['hoje']['tsb']},
    titulo: 'Sem confirmar', frase: 'Doze dias sem atividade sincronizada. A curva está lendo isso como descanso.',
    cor: '{T['ink3']}', tint: '{T['mute']}' }},
}};
class Component extends DCLogic {{
  renderVals() {{
    const k = this.props.estado ?? 'fresco';
    const d = DADOS[k];
    return {{
      ...d,
      saldoTxt: (d.saldo > 0 ? '+' : '') + d.saldo,
      curva: k === 'enterrado' ? 'en' : 'fr',
      alerta: k === 'cobertura',
    }};
  }}
}}"""
    return head() + f"""
<div style="width: 390px; height: 844px; background: {T['bg']}; padding: 54px 16px 16px; display: flex; flex-direction: column; gap: 14px; overflow: hidden">

  <div style="display: flex; flex-direction: column; gap: 2px">
    <div style="font-size: 13px; letter-spacing: 0.9px; color: {T['ink3']}; font-weight: 600">TREINO</div>
    <div style="font-family: {SERIF}; font-size: 34px; line-height: 42px; color: {T['ink']}">Forma</div>
  </div>

  <div style="background: {T['surface']}; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 1px 2px rgba(31,27,22,.05), 0 10px 24px -18px rgba(31,27,22,.4)">

    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px">
      <div style="display: flex; flex-direction: column; gap: 1px">
        <div style="font-size: 12.5px; font-weight: 700; letter-spacing: 0.6px; color: {T['ink2']}">SALDO DE FORMA</div>
        <div style="font-size: 12px; color: {T['ink3']}">base 42 dias · cansaço 7 dias</div>
      </div>
      <div style="display: flex; align-items: baseline; gap: 4px">
        <div style="font-family: {SERIF}; font-size: 36px; line-height: 36px; color: {{{{cor}}}}">{{{{saldoTxt}}}}</div>
      </div>
    </div>

    <div style="position: relative">
      <sc-if value="{{{{alerta}}}}" hint-placeholder-val="{{{{ true }}}}">
        <div style="position: absolute; right: 0; top: 0; bottom: 18px; width: 44px; background: repeating-linear-gradient(135deg, {T['mute']} 0 4px, transparent 4px 8px); border-left: 1px dashed {T['ink4']}; z-index: 2"></div>
      </sc-if>
      <sc-if value="{{{{ curva }}}}" hint-placeholder-val="fr"></sc-if>
      <div style="display: {{{{}}}}">
      </div>
      __CHART__
    </div>

    <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap">
      <div style="display: flex; align-items: center; gap: 6px">
        <span style="width: 14px; height: 2px; background: {T['ink']}; border-radius: 1px; display: block"></span>
        <span style="font-size: 11.5px; color: {T['ink2']}">Base</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px">
        <span style="width: 14px; height: 0; border-top: 2px dashed {T['rose']}; display: block"></span>
        <span style="font-size: 11.5px; color: {T['ink2']}">Cansaço</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px">
        <span style="width: 12px; height: 10px; background: {T['greenSoft']}; border-radius: 2px; display: block"></span>
        <span style="font-size: 11.5px; color: {T['ink2']}">Sobra</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px">
        <span style="width: 12px; height: 10px; background: rgba(224,92,92,0.20); border-radius: 2px; display: block"></span>
        <span style="font-size: 11.5px; color: {T['ink2']}">Dívida</span>
      </div>
    </div>
  </div>

  <div style="background: {T['surface']}; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 1px 2px rgba(31,27,22,.05), 0 10px 24px -18px rgba(31,27,22,.4)">
    <div style="display: flex; align-items: center; gap: 10px">
      <div style="width: 92px; font-size: 12.5px; color: {T['ink2']}">Base</div>
      <div style="flex: 1; height: 8px; border-radius: 4px; background: {T['mute']}; overflow: hidden">
        <div style="height: 8px; border-radius: 4px; background: {T['ink']}; width: 62%"></div>
      </div>
      <div style="width: 34px; text-align: right; font-family: {MONO}; font-weight: 600; font-size: 12.5px; color: {T['ink']}">{{{{base}}}}</div>
    </div>
    <div style="display: flex; align-items: center; gap: 10px">
      <div style="width: 92px; font-size: 12.5px; color: {T['ink2']}">Cansaço</div>
      <div style="flex: 1; height: 8px; border-radius: 4px; background: {T['mute']}; overflow: hidden">
        <div style="height: 8px; border-radius: 4px; background: {T['rose']}; width: 38%"></div>
      </div>
      <div style="width: 34px; text-align: right; font-family: {MONO}; font-weight: 600; font-size: 12.5px; color: {T['ink']}">{{{{cansaco}}}}</div>
    </div>
    <div style="height: 1px; background: {T['line']}; margin: 2px 0"></div>
    <div style="display: flex; align-items: center; gap: 10px">
      <div style="width: 92px; font-size: 12.5px; color: {T['ink2']}; font-weight: 600">Meta semanal</div>
      <div style="flex: 1; font-size: 12px; color: {T['ink3']}">a referência do Orbe</div>
      <div style="width: 34px; text-align: right; font-family: {MONO}; font-weight: 600; font-size: 12.5px; color: {T['ink3']}">95</div>
    </div>
  </div>

  <div style="background: {{{{tint}}}}; border-left: 3px solid {{{{cor}}}}; border-radius: 16px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px">
    <div style="font-size: 13px; font-weight: 700; color: {{{{cor}}}}">{{{{titulo}}}}</div>
    <div style="font-size: 12.5px; line-height: 17px; color: {T['ink2']}">{{{{frase}}}}</div>
  </div>

  <div style="margin-top: auto; display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 0 4px">
    <div style="font-size: 12.5px; color: {T['ink3']}">Constantes 42 / 7 · ajustáveis</div>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{T['ink3']}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"></path></svg>
  </div>
</div>
""" + f"""<script data-dc-script data-props='{props}'>{logic}
</script>
""" + TAIL

# ── B · Número primeiro ────────────────────────────────────────────────────
def artboard_b():
    fr, en = C["fresco"], C["enterrado"]
    props = ('{"estado":{"editor":"enum","options":["fresco","enterrado","cobertura"],'
             '"default":"fresco","section":"Estado"}}')
    logic = f"""
const D = {{
  fresco: {{ saldo: {fr['hoje']['tsb']}, base: {fr['hoje']['ctl']}, cansaco: {fr['hoje']['atl']},
    rotulo: 'FRESCO', frase: 'Dá para forçar hoje.',
    detalhe: 'Cansaço caiu 22 pontos em nove dias e a base segurou. É a melhor janela desde julho.',
    cor: '{T['green']}', spark: '{fr['spark']['d']}', zero: {fr['spark']['zero']},
    ex: {fr['spark']['endX']}, ey: {fr['spark']['endY']}, cobertura: false }},
  enterrado: {{ saldo: {en['hoje']['tsb']}, base: {en['hoje']['ctl']}, cansaco: {en['hoje']['atl']},
    rotulo: 'ENTERRADO', frase: 'Hoje é dia de perna leve.',
    detalhe: 'Duas semanas de bloco puxaram o cansaço para 156. A base subiu 15, então o buraco é planejado.',
    cor: '{T['red']}', spark: '{en['spark']['d']}', zero: {en['spark']['zero']},
    ex: {en['spark']['endX']}, ey: {en['spark']['endY']}, cobertura: false }},
  cobertura: {{ saldo: {fr['hoje']['tsb']}, base: {fr['hoje']['ctl']}, cansaco: {fr['hoje']['atl']},
    rotulo: 'SEM CONFIRMAR', frase: 'Faltam 12 dias de treino.',
    detalhe: 'A última atividade sincronizada é de 22 de agosto. Sem dado, a curva conta como descanso e o saldo sobe sozinho.',
    cor: '{T['ink3']}', spark: '{fr['spark']['d']}', zero: {fr['spark']['zero']},
    ex: {fr['spark']['endX']}, ey: {fr['spark']['endY']}, cobertura: true }},
}};
class Component extends DCLogic {{
  renderVals() {{
    const d = D[this.props.estado ?? 'fresco'];
    return {{ ...d, saldoTxt: (d.saldo > 0 ? '+' : '') + d.saldo,
      basePct: Math.round(d.base / 2) + '%', cansPct: Math.round(d.cansaco / 2) + '%' }};
  }}
}}"""
    return head() + f"""
<div style="width: 390px; height: 844px; background: {T['bg']}; padding: 54px 16px 16px; display: flex; flex-direction: column; gap: 14px; overflow: hidden">

  <div style="display: flex; flex-direction: column; gap: 2px">
    <div style="font-size: 13px; letter-spacing: 0.9px; color: {T['ink3']}; font-weight: 600">QUINTA, 3 DE SETEMBRO</div>
    <div style="font-family: {SERIF}; font-size: 34px; line-height: 42px; color: {T['ink']}">Bom dia, Sydnei</div>
  </div>

  <div style="background: {T['ink']}; border-radius: 24px; padding: 18px; display: flex; flex-direction: column; gap: 14px">
    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px">
      <div style="display: flex; flex-direction: column; gap: 2px; flex: 1">
        <div style="font-size: 12px; letter-spacing: 0.4px; font-weight: 600; color: {T['primarySoft']}">FORMA DE HOJE</div>
        <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 2px">
          <span style="font-family: {SERIF}; font-size: 42px; line-height: 46px; color: #FFFFFF">{{{{saldoTxt}}}}</span>
          <span style="font-size: 18px; color: rgba(255,255,255,0.6)">de saldo</span>
        </div>
        <div style="font-size: 14px; color: rgba(255,255,255,0.85); margin-top: 2px">{{{{frase}}}}</div>
      </div>
      <div style="border: 1px solid rgba(255,255,255,0.22); border-radius: 999px; padding: 4px 10px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.6px; color: {{{{cor}}}}; white-space: nowrap">{{{{rotulo}}}}</div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 6px">
      <svg viewBox="0 0 126 34" width="100%" height="46" preserveAspectRatio="none" style="display: block">
        <line x1="0" y1="{{{{zero}}}}" x2="126" y2="{{{{zero}}}}" stroke="rgba(255,255,255,0.22)" stroke-width="0.6" stroke-dasharray="2 2"></line>
        <path d="{{{{spark}}}}" fill="none" stroke="{{{{cor}}}}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>
        <circle cx="{{{{ex}}}}" cy="{{{{ey}}}}" r="2.6" fill="{{{{cor}}}}"></circle>
      </svg>
      <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: rgba(255,255,255,0.5); font-family: {MONO}">
        <span>42 dias</span><span>hoje</span>
      </div>
    </div>
  </div>

  <sc-if value="{{{{cobertura}}}}" hint-placeholder-val="{{{{ true }}}}">
    <div style="background: {T['warm']}; border-radius: 16px; padding: 10px 12px; display: flex; align-items: center; gap: 10px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{T['primaryDeep']}" stroke-width="1.8" stroke-linecap="round"><path d="M12 8v5"></path><path d="M12 16.5v.5"></path><circle cx="12" cy="12" r="9"></circle></svg>
      <div style="font-size: 12.5px; line-height: 17px; color: {T['ink2']}; flex: 1">Última atividade em 22 de agosto. Reabra o Conexões para sincronizar.</div>
    </div>
  </sc-if>

  <div style="background: {T['surface']}; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 1px 2px rgba(31,27,22,.05), 0 10px 24px -18px rgba(31,27,22,.4)">
    <div style="display: flex; align-items: center; justify-content: space-between">
      <div style="font-size: 12.5px; font-weight: 700; letter-spacing: 0.6px; color: {T['ink2']}">DE ONDE VEM</div>
      <div style="font-size: 12px; color: {T['ink3']}">esforço por semana</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px">
      <div style="display: flex; align-items: center; gap: 10px">
        <div style="width: 92px; font-size: 12.5px; color: {T['ink2']}">Base 42 d</div>
        <div style="flex: 1; height: 8px; border-radius: 4px; background: {T['mute']}; overflow: hidden">
          <div style="height: 8px; border-radius: 4px; background: {T['ink']}; width: {{{{basePct}}}}"></div>
        </div>
        <div style="width: 34px; text-align: right; font-family: {MONO}; font-weight: 600; font-size: 12.5px; color: {T['ink']}">{{{{base}}}}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px">
        <div style="width: 92px; font-size: 12.5px; color: {T['ink2']}">Cansaço 7 d</div>
        <div style="flex: 1; height: 8px; border-radius: 4px; background: {T['mute']}; overflow: hidden">
          <div style="height: 8px; border-radius: 4px; background: {T['rose']}; width: {{{{cansPct}}}}"></div>
        </div>
        <div style="width: 34px; text-align: right; font-family: {MONO}; font-weight: 600; font-size: 12.5px; color: {T['ink']}">{{{{cansaco}}}}</div>
      </div>
    </div>
    <div style="font-size: 12.5px; line-height: 17px; color: {T['ink2']}">{{{{detalhe}}}}</div>
  </div>

  <div style="margin-top: auto; background: {T['surface']}; border-radius: 20px; min-height: 52px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 2px rgba(31,27,22,.05)">
    <div style="font-size: 13.5px; font-weight: 600; color: {T['ink']}">Ver a curva completa</div>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{T['ink3']}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"></path></svg>
  </div>
</div>
""" + f"""<script data-dc-script data-props='{props}'>{logic}
</script>
""" + TAIL

open("_a.tmp", "w").write(artboard_a().replace("__CHART__", chart_svg(C["fresco"])))
open("_b.tmp", "w").write(artboard_b())
print("parciais ok")
