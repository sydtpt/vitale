# -*- coding: utf-8 -*-
"""Proposta B com carrossel de altura fixa. 3 temas × 2 esquemas."""
import json
C = json.load(open("chart.json"))
BAR = json.load(open("bar_colors.json"))
KEY = {('orbe','light'):'orbe-light',('clean','light'):'clean-light',('cleanElev','light'):'elev-light',
       ('orbe','dark'):'orbe-dark',('clean','dark'):'clean-dark',('cleanElev','dark'):'elev-dark'}
exec(open("common.py").read())

ROLE = {
 "light": dict(green="#6FA86A", red="#E05C5C", rose="#E26A8A", inkRole="#1F1B16",
               alertBg="#FFE3D2", alertIcon="#D9491B"),
 "dark":  dict(green="#7FB97A", red="#F07A7A", rose="#E87B98", inkRole="#767065",
               alertBg="#3A241A", alertIcon="#FF6A3C"),
}
BRAND = dict(primary="#F25C2B", deep="#D9491B", soft="#FFE3D2")
N = {
 ("orbe","light"): dict(bg="#FFF7EE", surface="#FFFFFF", mute="#F6ECDC", warm="#FFEFD9",
   ink="#1F1B16", ink2="#5C534A", ink3="#9C928A", ink4="#C6BCAE", line="#EFE6D8", hairline="#EFE6D8"),
 ("orbe","dark"): dict(bg="#14110D", surface="#1E1A15", mute="#241E18", warm="#262019",
   ink="#F6EFE6", ink2="#BDB3A6", ink3="#8A8074", ink4="#5C554B", line="#2E2820", hairline="#1E1A15"),
 ("clean","light"): dict(bg="#FFFFFF", surface="#FFFFFF", mute="#F4F4F6", warm="#FAFAFB",
   ink="#101012", ink2="#55555C", ink3="#7C7C85", ink4="#B8B8C0", line="#EAEAEC", hairline="#E1E1E6"),
 ("clean","dark"): dict(bg="#000000", surface="#000000", mute="#16161A", warm="#121216",
   ink="#F5F5F7", ink2="#A0A0A8", ink3="#7C7C86", ink4="#52525A", line="#26262B", hairline="#31313A"),
 ("cleanElev","light"): dict(bg="#FFFFFF", surface="#F7F7F8", mute="#F1F1F3", warm="#FAFAFB",
   ink="#101012", ink2="#55555C", ink3="#7C7C85", ink4="#B8B8C0", line="#EAEAEC", hairline="#E7E7EA"),
 ("cleanElev","dark"): dict(bg="#000000", surface="#1A1A1D", mute="#232327", warm="#1F1F23",
   ink="#F5F5F7", ink2="#A0A0A8", ink3="#7C7C86", ink4="#52525A", line="#2A2A30", hairline="#1A1A1D"),
}
RAIL_H = 206   # altura fixa do trilho — a razão de ser desta mudança

def slide_chrome(tema, esq, n):
    """A casca do slide. No claro é card comum (decisão aprovada); no escuro segue o tema."""
    shadow = SHADOW if (tema == "orbe" and esq == "light") else "none"
    border = "none" if n["hairline"] == n["surface"] else f"1px solid {n['hairline']}"
    if tema == "clean":   # separa por contorno: o slide ativo usa a linha da marca
        return dict(bg=n["bg"], border=f"1.5px solid {BRAND['primary']}", shadow="none",
                    eyebrow=(BRAND["deep"] if esq == "light" else BRAND["soft"]))
    if esq == "dark":     # orbe e elevado no escuro: degrau de superfície
        return dict(bg=n["warm"], border="none", shadow="none", eyebrow=BRAND["soft"])
    return dict(bg=n["surface"], border=border, shadow=shadow, eyebrow=n["ink2"])

def build(tema, esq, out, estado, slide):
    n, r = N[(tema, esq)], ROLE[esq]
    bar = BAR[KEY[(tema, esq)]]
    s = slide_chrome(tema, esq, n)
    fr, en = C["fresco"], C["enterrado"]
    cardBorder = "none" if n["hairline"] == n["surface"] else f"1px solid {n['hairline']}"
    shadow = SHADOW if (tema == "orbe" and esq == "light") else "none"

    def segs(sp):
        return json.dumps([{"d": x["d"], "cor": (r["green"] if x["sign"] > 0 else r["red"])}
                           for x in sp["segs"]])
    logic = f"""
const S = {{
  fresco: {{ saldo: {fr['hoje']['tsb']}, base: {fr['hoje']['ctl']}, cansaco: {fr['hoje']['atl']},
    frase: 'Dá para forçar hoje.', numCor: '{r['green']}', dot: '{r['green']}',
    detalhe: 'O cansaço caiu 36 pontos em nove dias e a base segurou em 93.',
    segs: {segs(fr['spark'])}, zero: {fr['spark']['zero']},
    ex: {fr['spark']['endX']}, ey: {fr['spark']['endY']}, selo: '', vago: false }},
  enterrado: {{ saldo: {en['hoje']['tsb']}, base: {en['hoje']['ctl']}, cansaco: {en['hoje']['atl']},
    frase: 'Hoje é dia de perna leve.', numCor: '{r['red']}', dot: '{r['red']}',
    detalhe: 'Duas semanas de bloco levaram o cansaço a 156. A base subiu 15 no mesmo período.',
    segs: {segs(en['spark'])}, zero: {en['spark']['zero']},
    ex: {en['spark']['endX']}, ey: {en['spark']['endY']}, selo: '', vago: false }},
  cobertura: {{ saldo: {fr['hoje']['tsb']}, base: {fr['hoje']['ctl']}, cansaco: {fr['hoje']['atl']},
    frase: 'Não dá para confiar neste número.', numCor: '{n['ink3']}', dot: '{n['ink3']}',
    detalhe: 'Sem dado desde 22 de agosto, a curva conta silêncio como descanso.',
    segs: {segs(fr['spark'])}, zero: {fr['spark']['zero']},
    ex: {fr['spark']['endX']}, ey: {fr['spark']['endY']},
    selo: '12 DIAS SEM SINCRONIZAR', vago: true }},
}};
class Component extends DCLogic {{
  renderVals() {{
    const d = S[this.props.estado ?? '{estado}'];
    const c = this.props.cartao ?? '{slide}';
    return {{ ...d, saldoTxt: (d.saldo > 0 ? '+' : '') + d.saldo,
      basePct: Math.round(d.base / 2) + '%', cansPct: Math.round(d.cansaco / 2) + '%',
      temSelo: d.selo.length > 0, seloCor: '{n['ink3']}',
      ehHoje: c === 'hoje', ehOrigem: c === 'origem',
      pilulaA: c === 'hoje' ? '{n['ink2']}' : '{n['ink4']}',
      pilulaB: c === 'origem' ? '{n['ink2']}' : '{n['ink4']}',
      larguraA: c === 'hoje' ? '16px' : '6px',
      larguraB: c === 'origem' ? '16px' : '6px' }};
  }}
}}"""
    props = ('{"estado":{"editor":"enum","options":["fresco","enterrado","cobertura"],"default":"'
             + estado + '","section":"Estado"},'
             '"cartao":{"editor":"enum","options":["hoje","origem"],"default":"' + slide
             + '","section":"Estado"}}')

    slideBox = (f'position: absolute; inset: 0; background: {s["bg"]}; border: {s["border"]}; '
                f'box-shadow: {s["shadow"]}; border-radius: 24px; padding: 18px; '
                f'display: flex; flex-direction: column')
    linha = (f'background: {n["surface"]}; border: {cardBorder}; box-shadow: {shadow}; '
             f'border-radius: 20px; min-height: 56px; padding: 0 16px; display: flex; '
             f'align-items: center; gap: 12px')

    body = f"""
<div style="width: 390px; height: 844px; background: {n['bg']}; padding: 54px 16px 16px; display: flex; flex-direction: column; gap: 14px; overflow: hidden">

  <div style="display: flex; flex-direction: column; gap: 2px">
    <div style="font-size: 13px; letter-spacing: 0.9px; color: {n['ink3']}; font-weight: 600">QUINTA, 3 DE SETEMBRO</div>
    <div style="font-family: {SERIF}; font-size: 34px; line-height: 42px; color: {n['ink']}">Bom dia, Sydnei</div>
  </div>

  <div style="display: flex; flex-direction: column; gap: 9px">
    <div style="position: relative; height: {RAIL_H}px">

      <sc-if value="{{{{ehHoje}}}}" hint-placeholder-val="{{{{ true }}}}">
        <div style="{slideBox}; justify-content: space-between">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px">
            <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0">
              <div style="font-size: 12.5px; letter-spacing: 0.6px; font-weight: 700; color: {s['eyebrow']}">FORMA DE HOJE</div>
              <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 2px">
                <span style="font-family: {SERIF}; font-size: 42px; line-height: 46px; color: {{{{numCor}}}}">{{{{saldoTxt}}}}</span>
                <span style="font-size: 18px; color: {n['ink2']}">de saldo</span>
              </div>
              <div style="font-size: 14px; line-height: 19px; color: {n['ink']}; margin-top: 3px">{{{{frase}}}}</div>
            </div>
            <sc-if value="{{{{temSelo}}}}" hint-placeholder-val="{{{{ true }}}}">
              <div style="display: flex; align-items: center; gap: 5px; max-width: 96px">
                <span style="width: 6px; height: 6px; border-radius: 999px; background: {{{{seloCor}}}}; flex: none"></span>
                <span style="font-size: 9.5px; letter-spacing: 0.5px; font-weight: 700; line-height: 12px; color: {{{{seloCor}}}}">{{{{selo}}}}</span>
              </div>
            </sc-if>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px">
            <svg viewBox="-10 -4 336 48" width="100%" height="44" style="display: block">
              <line x1="0" y1="{{{{zero}}}}" x2="322" y2="{{{{zero}}}}" stroke="{n['line']}" stroke-width="0.8" stroke-dasharray="3 3"></line>
              <text x="-10" y="{{{{zero}}}}" dy="3.2" font-family="{MONO}" font-size="8" fill="{n['ink3']}">0</text>
              <sc-for list="{{{{segs}}}}" as="seg" hint-placeholder-count="6">
                <path d="{{{{seg.d}}}}" fill="none" stroke="{{{{seg.cor}}}}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"></path>
              </sc-for>
              <circle cx="{{{{ex}}}}" cy="{{{{ey}}}}" r="3" fill="{{{{dot}}}}"></circle>
            </svg>
            <sc-if value="{{{{vago}}}}" hint-placeholder-val="{{{{ true }}}}">
              <div style="display: flex; align-items: center; gap: 7px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="{r['alertIcon']}" stroke-width="2" stroke-linecap="round" style="flex: none"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5"></path><path d="M12 16.4v.2"></path></svg>
                <span style="font-size: 11.5px; color: {n['ink2']}; flex: 1">Abra Conexões para sincronizar</span>
                {chevron(n['ink3'])}
              </div>
            </sc-if>
            <sc-if value="{{{{ehHoje}}}}" hint-placeholder-val="{{{{ true }}}}">
              <div style="display: flex; justify-content: space-between; font-family: {MONO}; font-size: 10.5px; color: {n['ink3']}">
                <span>42 dias</span><span>hoje</span>
              </div>
            </sc-if>
          </div>
        </div>
      </sc-if>

      <sc-if value="{{{{ehOrigem}}}}" hint-placeholder-val="{{{{ true }}}}">
        <div style="{slideBox}; justify-content: space-between">
          <div style="display: flex; align-items: center; justify-content: space-between">
            <div style="font-size: 12.5px; letter-spacing: 0.6px; font-weight: 700; color: {s['eyebrow']}">DE ONDE VEM</div>
            <div style="font-size: 12px; color: {n['ink3']}">esforço por semana</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 9px">
            <div style="display: flex; align-items: center; gap: 10px">
              <div style="width: 92px; font-size: 12.5px; color: {n['ink2']}">Base 42 d</div>
              <div style="position: relative; flex: 1; height: 8px; border-radius: 4px; background: {n['mute']}">
                <div style="position: absolute; inset: 0; border-radius: 4px; overflow: hidden">
                  <div style="height: 8px; border-radius: 4px; background: {bar['base']}; width: {{{{basePct}}}}"></div>
                </div>
                <span style="position: absolute; left: 48%; top: -3px; width: 2px; height: 14px; border-radius: 1px; background: {bar['tick']}"></span>
              </div>
              <div style="width: 34px; text-align: right; font-family: {MONO}; font-weight: 600; font-size: 12.5px; color: {n['ink']}">{{{{base}}}}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px">
              <div style="width: 92px; font-size: 12.5px; color: {n['ink2']}">Cansaço 7 d</div>
              <div style="position: relative; flex: 1; height: 8px; border-radius: 4px; background: {n['mute']}">
                <div style="position: absolute; inset: 0; border-radius: 4px; overflow: hidden">
                  <div style="height: 8px; border-radius: 4px; background: {bar['cansaco']}; width: {{{{cansPct}}}}"></div>
                </div>
                <span style="position: absolute; left: 50.5%; top: -3px; width: 2px; height: 14px; border-radius: 1px; background: {bar['tick']}"></span>
              </div>
              <div style="width: 34px; text-align: right; font-family: {MONO}; font-weight: 600; font-size: 12.5px; color: {n['ink']}">{{{{cansaco}}}}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 7px">
              <span style="width: 2px; height: 11px; border-radius: 1px; background: {bar['tick']}; display: block; flex: none"></span>
              <span style="font-size: 11.5px; color: {n['ink3']}">o traço é a sua média dos últimos 90 dias</span>
            </div>
          </div>
          <div style="font-size: 12.5px; line-height: 17px; color: {n['ink2']}">{{{{detalhe}}}}</div>
        </div>
      </sc-if>

    </div>

    <div style="display: flex; justify-content: center; align-items: center; gap: 6px; height: 8px">
      <span style="width: {{{{larguraA}}}}; height: 6px; border-radius: 999px; background: {{{{pilulaA}}}}; display: block"></span>
      <span style="width: {{{{larguraB}}}}; height: 6px; border-radius: 999px; background: {{{{pilulaB}}}}; display: block"></span>
    </div>
  </div>

  <div style="{linha}">
    <svg width="26" height="26" viewBox="0 0 26 26" style="flex: none"><circle cx="13" cy="13" r="10" fill="none" stroke="{n['mute']}" stroke-width="4"></circle><circle cx="13" cy="13" r="10" fill="none" stroke="{BRAND['primary']}" stroke-width="4" stroke-linecap="round" stroke-dasharray="49 63" transform="rotate(-90 13 13)"></circle></svg>
    <div style="flex: 1; font-size: 13.5px; font-weight: 600; color: {n['ink']}">Anel do dia</div>
    <div style="font-family: {MONO}; font-size: 13px; color: {n['ink2']}">78/100</div>
    {chevron(n['ink3'])}
  </div>

  <div style="{linha}">
    <div style="flex: 1; display: flex; flex-direction: column; gap: 2px">
      <div style="font-size: 13.5px; font-weight: 600; color: {n['ink']}">Hábitos</div>
      <div style="font-size: 12px; color: {n['ink3']}">3 de 5 hoje</div>
    </div>
    <div style="display: flex; gap: 5px">
      <span style="width: 22px; height: 22px; border-radius: 7px; background: {r['green']}"></span>
      <span style="width: 22px; height: 22px; border-radius: 7px; background: {r['green']}"></span>
      <span style="width: 22px; height: 22px; border-radius: 7px; background: {r['green']}"></span>
      <span style="width: 22px; height: 22px; border-radius: 7px; background: {n['mute']}"></span>
      <span style="width: 22px; height: 22px; border-radius: 7px; background: {n['mute']}"></span>
    </div>
  </div>

  <div style="margin-top: auto; {linha}">
    <div style="flex: 1; font-size: 13.5px; font-weight: 600; color: {n['ink']}">Ver a curva completa</div>
    {chevron(n['ink3'])}
  </div>
</div>
"""
    open(out, "w").write(head() + body + script(props, logic) + TAIL)

build("orbe",      "light", "Main.dc.html",        "fresco",    "hoje")
build("clean",     "light", "CleanClaro.dc.html",  "fresco",    "origem")
build("cleanElev", "light", "ElevClaro.dc.html",   "enterrado", "hoje")
build("orbe",      "dark",  "Escuro.dc.html",      "cobertura", "hoje")
build("clean",     "dark",  "CleanEscuro.dc.html", "enterrado", "origem")
build("cleanElev", "dark",  "ElevEscuro.dc.html",  "fresco",    "origem")
print("6 artboards com carrossel ok")
