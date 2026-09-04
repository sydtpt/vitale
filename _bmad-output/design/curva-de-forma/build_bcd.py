# -*- coding: utf-8 -*-
import json
C = json.load(open("chart.json"))
CW = json.load(open("chart_web.json"))
exec(open("common.py").read())

# ── B · O Número Primeiro ─────────────────────────────────────────────────
fr, en = C["fresco"], C["enterrado"]
logic_b = f"""
const D = {{
  fresco: {{ saldo: {fr['hoje']['tsb']}, base: {fr['hoje']['ctl']}, cansaco: {fr['hoje']['atl']},
    rotulo: 'FRESCO', frase: 'Dá para forçar hoje.', cor: '{T['green']}',
    detalhe: 'O cansaço caiu 36 pontos em nove dias e a base segurou em 93. É a melhor janela desde julho.',
    segs: {json.dumps([{'d': s['d'], 'cor': (T['green'] if s['sign'] > 0 else T['red'])} for s in fr['spark']['segs']])},
    zero: {fr['spark']['zero']}, ex: {fr['spark']['endX']}, ey: {fr['spark']['endY']}, dot: '{T['green']}',
    alerta: false }},
  enterrado: {{ saldo: {en['hoje']['tsb']}, base: {en['hoje']['ctl']}, cansaco: {en['hoje']['atl']},
    rotulo: 'ENTERRADO', frase: 'Hoje é dia de perna leve.', cor: '{T['red']}',
    detalhe: 'Duas semanas de bloco levaram o cansaço a 156. A base subiu 15 no mesmo período, então o buraco é planejado.',
    segs: {json.dumps([{'d': s['d'], 'cor': (T['green'] if s['sign'] > 0 else T['red'])} for s in en['spark']['segs']])},
    zero: {en['spark']['zero']}, ex: {en['spark']['endX']}, ey: {en['spark']['endY']}, dot: '{T['red']}',
    alerta: false }},
  cobertura: {{ saldo: {fr['hoje']['tsb']}, base: {fr['hoje']['ctl']}, cansaco: {fr['hoje']['atl']},
    rotulo: 'SEM CONFIRMAR', frase: 'Faltam 12 dias de treino.', cor: '{T['ink3']}',
    detalhe: 'A última atividade sincronizada é de 22 de agosto. Sem dado, a curva conta silêncio como descanso e o saldo sobe sozinho.',
    segs: {json.dumps([{'d': s['d'], 'cor': (T['green'] if s['sign'] > 0 else T['red'])} for s in fr['spark']['segs']])},
    zero: {fr['spark']['zero']}, ex: {fr['spark']['endX']}, ey: {fr['spark']['endY']}, dot: '{T['ink4']}',
    alerta: true }},
}};
class Component extends DCLogic {{
  renderVals() {{
    const d = D[this.props.estado ?? 'fresco'];
    return {{ ...d, saldoTxt: (d.saldo > 0 ? '+' : '') + d.saldo,
      basePct: Math.round(d.base / 2) + '%', cansPct: Math.round(d.cansaco / 2) + '%' }};
  }}
}}"""
PROPS = ('{"estado":{"editor":"enum","options":["fresco","enterrado","cobertura"],'
         '"default":"fresco","section":"Estado"}}')

body_b = f"""
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
      <svg viewBox="-4 -4 330 48" width="100%" height="44" style="display: block">
        <line x1="0" y1="{{{{zero}}}}" x2="322" y2="{{{{zero}}}}" stroke="rgba(255,255,255,0.22)" stroke-width="0.8" stroke-dasharray="3 3"></line>
        <sc-for list="{{{{segs}}}}" as="seg" hint-placeholder-count="6">
          <path d="{{{{seg.d}}}}" fill="none" stroke="{{{{seg.cor}}}}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"></path>
        </sc-for>
        <circle cx="{{{{ex}}}}" cy="{{{{ey}}}}" r="3" fill="{{{{dot}}}}"></circle>
      </svg>
      <div style="display: flex; justify-content: space-between; font-family: {MONO}; font-size: 10.5px; color: rgba(255,255,255,0.5)">
        <span>42 dias</span><span>hoje</span>
      </div>
    </div>
  </div>

  <sc-if value="{{{{alerta}}}}" hint-placeholder-val="{{{{ true }}}}">
    <div style="background: {T['warm']}; border-radius: 16px; padding: 10px 12px; display: flex; align-items: center; gap: 10px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{T['primaryDeep']}" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5"></path><path d="M12 16.4v.2"></path></svg>
      <div style="flex: 1; font-size: 12.5px; line-height: 17px; color: {T['ink2']}">Última atividade em 22 de agosto. Abra Conexões para sincronizar.</div>
    </div>
  </sc-if>

  {card_open()}
    <div style="display: flex; align-items: center; justify-content: space-between">
      <div style="font-size: 12.5px; font-weight: 700; letter-spacing: 0.6px; color: {T['ink2']}">DE ONDE VEM</div>
      <div style="font-size: 12px; color: {T['ink3']}">esforço por semana</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px">
      {bar_row('Base 42 d', '{{basePct}}', T['ink'], '{{base}}')}
      {bar_row('Cansaço 7 d', '{{cansPct}}', T['rose'], '{{cansaco}}')}
    </div>
    <div style="font-size: 12.5px; line-height: 17px; color: {T['ink2']}">{{{{detalhe}}}}</div>
  {card_close()}

  <div style="margin-top: auto; background: {T['surface']}; border-radius: 20px; min-height: 52px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; box-shadow: {SHADOW}">
    <div style="font-size: 13.5px; font-weight: 600; color: {T['ink']}">Ver a curva completa</div>
    {chevron()}
  </div>
</div>
"""
open("Numero.dc.html", "w").write(head() + body_b + script(PROPS, logic_b) + TAIL)

# ── C · O Ano em Forma ────────────────────────────────────────────────────
ano = C["ano"]
CELL, GAP = 4.8, 1.35
STEP = CELL + GAP
def tint(v):
    if v <= -40: return T['red']
    if v <= -15: return "rgba(224,92,92,0.45)"
    if v < 8:    return T['mute']
    if v < 22:   return "rgba(111,168,106,0.55)"
    return T['green']

sel = min(range(len(ano) - 12), key=lambda i: ano[i])
cells, weeks = [], 53
for w in range(weeks):
    for d in range(7):
        i = w * 7 + d
        if i >= len(ano): continue
        vazio = i >= len(ano) - 12
        fill = "#FFFFFF" if vazio else tint(ano[i])
        stroke = f' stroke="{T["line"]}" stroke-width="0.6"' if vazio else ""
        cells.append(f'<rect x="{round(w*STEP,2)}" y="{round(d*STEP,2)}" width="{CELL}" height="{CELL}" rx="1.2" fill="{fill}"{stroke}></rect>')
        if i == sel:
            cells.append(f'<rect x="{round(w*STEP-2.1,2)}" y="{round(d*STEP-2.1,2)}" width="{CELL+4.2}" height="{CELL+4.2}" rx="2.6" fill="none" stroke="{T["ink"]}" stroke-width="1.1"></rect>')
grid = "\n          ".join(cells)
MESES = ["set","out","nov","dez","jan","fev","mar","abr","mai","jun","jul","ago"]
labels = "\n          ".join(
    f'<text x="{round(k*4.42*STEP,1)}" y="8" font-family="{SANS}" font-size="8.5" fill="{T["ink3"]}">{m}</text>'
    for k, m in enumerate(MESES))

body_c = f"""
<div style="width: 390px; height: 844px; background: {T['bg']}; padding: 54px 16px 16px; display: flex; flex-direction: column; gap: 14px; overflow: hidden">

  <div style="display: flex; flex-direction: column; gap: 2px">
    <div style="font-size: 13px; letter-spacing: 0.9px; color: {T['ink3']}; font-weight: 600">TREINO · 12 MESES</div>
    <div style="font-family: {SERIF}; font-size: 34px; line-height: 42px; color: {T['ink']}">O ano em forma</div>
  </div>

  {card_open(gap=14)}
    <div style="display: flex; flex-direction: column; gap: 1px">
      <div style="font-size: 12.5px; font-weight: 700; letter-spacing: 0.6px; color: {T['ink2']}">SALDO, DIA A DIA</div>
      <div style="font-size: 12px; color: {T['ink3']}">cada quadrado é um dia · arraste para percorrer</div>
    </div>

    <svg viewBox="-3 -3 334 61" width="100%" height="60" style="display: block">
      {labels}
      <g transform="translate(0, 12)">
          {grid}
      </g>
    </svg>

    <div style="display: flex; align-items: center; justify-content: space-between">
      <div style="font-size: 11.5px; color: {T['ink3']}">Dívida</div>
      <div style="display: flex; align-items: center; gap: 3px">
        <span style="width: 13px; height: 13px; border-radius: 2px; background: {T['red']}; display: block"></span>
        <span style="width: 13px; height: 13px; border-radius: 2px; background: rgba(224,92,92,0.45); display: block"></span>
        <span style="width: 13px; height: 13px; border-radius: 2px; background: {T['mute']}; display: block"></span>
        <span style="width: 13px; height: 13px; border-radius: 2px; background: rgba(111,168,106,0.55); display: block"></span>
        <span style="width: 13px; height: 13px; border-radius: 2px; background: {T['green']}; display: block"></span>
      </div>
      <div style="font-size: 11.5px; color: {T['ink3']}">Sobra</div>
    </div>
    <div style="display: flex; align-items: center; gap: 7px; padding-top: 2px">
      <span style="width: 13px; height: 13px; border-radius: 2px; background: #FFFFFF; border: 1px solid {T['line']}; display: block"></span>
      <span style="font-size: 11.5px; color: {T['ink3']}">Sem atividade sincronizada · 12 dias em aberto</span>
    </div>
  {card_close()}

  {card_open(gap=10)}
    <div style="display: flex; align-items: center; gap: 8px">
      <div style="width: 44px; height: 44px; border-radius: 12px; background: {T['mute']}; display: flex; align-items: center; justify-content: center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{T['ink2']}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 1px; align-items: center">
        <div style="font-size: 12.5px; font-weight: 700; letter-spacing: 0.6px; color: {T['ink2']}">18 DE JULHO</div>
        <div style="font-size: 12px; color: {T['ink3']}">pico de dívida do ano</div>
      </div>
      <div style="font-family: {SERIF}; font-size: 36px; line-height: 36px; color: {T['red']}">-78</div>
      <div style="width: 44px; height: 44px; border-radius: 12px; background: {T['mute']}; display: flex; align-items: center; justify-content: center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{T['ink2']}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"></path></svg>
      </div>
    </div>
    <div style="height: 1px; background: {T['line']}"></div>
    {bar_row('Base 42 d', '54%', T['ink'], '108')}
    {bar_row('Cansaço 7 d', '93%', T['rose'], '186')}
    <div style="font-size: 12.5px; line-height: 17px; color: {T['ink2']}">Semana da Vuelta em casa: 4 dias seguidos acima de 150 de esforço. O saldo levou 19 dias para voltar ao zero.</div>
  {card_close()}

  <div style="margin-top: auto; display: flex; gap: 8px">
    <div style="flex: 1; background: {T['surface']}; border-radius: 16px; min-height: 56px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: center; gap: 1px; box-shadow: {SHADOW}">
      <div style="font-family: {MONO}; font-size: 17px; font-weight: 600; color: {T['ink']}">61</div>
      <div style="font-size: 11.5px; color: {T['ink3']}">dias em sobra</div>
    </div>
    <div style="flex: 1; background: {T['surface']}; border-radius: 16px; min-height: 56px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: center; gap: 1px; box-shadow: {SHADOW}">
      <div style="font-family: {MONO}; font-size: 17px; font-weight: 600; color: {T['ink']}">4</div>
      <div style="font-size: 11.5px; color: {T['ink3']}">blocos fechados</div>
    </div>
    <div style="flex: 1; background: {T['surface']}; border-radius: 16px; min-height: 56px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: center; gap: 1px; box-shadow: {SHADOW}">
      <div style="font-family: {MONO}; font-size: 17px; font-weight: 600; color: {T['ink']}">19 d</div>
      <div style="font-size: 11.5px; color: {T['ink3']}">maior volta ao zero</div>
    </div>
  </div>
</div>
"""
open("Ano.dc.html", "w").write(head() + body_c + TAIL)
print("Numero.dc.html + Ano.dc.html ok")
