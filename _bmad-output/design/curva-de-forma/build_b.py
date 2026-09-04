# -*- coding: utf-8 -*-
"""Proposta B · O Número Primeiro — nos dois esquemas, com a direção da Sally."""
import json
C = json.load(open("chart.json"))
exec(open("common.py").read())

L = dict(  # claro
    bg="#FFF7EE", surface="#FFFFFF", mute="#F6ECDC", warm="#FFEFD9",
    ink="#1F1B16", ink2="#5C534A", ink3="#9C928A", line="#EFE6D8",
    heroBg="#1F1B16", heroEyebrow="#FFE3D2", heroInk="#FFFFFF",
    heroInk2="rgba(255,255,255,0.62)", heroInk3="rgba(255,255,255,0.45)",
    heroZero="rgba(255,255,255,0.22)", heroLine="rgba(255,255,255,0.16)",
    green="#6FA86A", red="#E05C5C", rose="#E26A8A", baseFill="#1F1B16",
    alertBg="#FFEFD9", alertIcon="#D9491B", shadow=SHADOW, cardBorder="none",
)
D = dict(  # escuro
    bg="#14110D", surface="#1E1A15", mute="#241E18", warm="#262019",
    ink="#F6EFE6", ink2="#BDB3A6", ink3="#8A8074", line="#2E2820",
    heroBg="#262019", heroEyebrow="#FFE3D2", heroInk="#F6EFE6",
    heroInk2="#BDB3A6", heroInk3="#8A8074",
    heroZero="rgba(246,239,230,0.18)", heroLine="rgba(246,239,230,0.12)",
    green="#7FB97A", red="#F07A7A", rose="#E87B98", baseFill="#767065",
    alertBg="#3A241A", alertIcon="#FF6A3C", shadow="none", cardBorder="none",
)

def build(P, out, title_hint):
    fr, en = C["fresco"], C["enterrado"]
    def segs(sp):
        return json.dumps([{"d": s["d"], "cor": (P["green"] if s["sign"] > 0 else P["red"])}
                           for s in sp["segs"]])
    logic = f"""
const S = {{
  fresco: {{ saldo: {fr['hoje']['tsb']}, base: {fr['hoje']['ctl']}, cansaco: {fr['hoje']['atl']},
    frase: 'Dá para forçar hoje.', numCor: '{P['green']}', dot: '{P['green']}',
    detalhe: 'O cansaço caiu 36 pontos em nove dias e a base segurou em 93. É a melhor janela desde julho.',
    segs: {segs(fr['spark'])}, zero: {fr['spark']['zero']},
    ex: {fr['spark']['endX']}, ey: {fr['spark']['endY']},
    selo: '', seloCor: '', vago: false, alerta: false }},
  enterrado: {{ saldo: {en['hoje']['tsb']}, base: {en['hoje']['ctl']}, cansaco: {en['hoje']['atl']},
    frase: 'Hoje é dia de perna leve.', numCor: '{P['red']}', dot: '{P['red']}',
    detalhe: 'Duas semanas de bloco levaram o cansaço a 156. A base subiu 15 no mesmo período, então o buraco é planejado.',
    segs: {segs(en['spark'])}, zero: {en['spark']['zero']},
    ex: {en['spark']['endX']}, ey: {en['spark']['endY']},
    selo: '', seloCor: '', vago: false, alerta: false }},
  cobertura: {{ saldo: {fr['hoje']['tsb']}, base: {fr['hoje']['ctl']}, cansaco: {fr['hoje']['atl']},
    frase: 'Não dá para confiar neste número.', numCor: '{P['heroInk3']}', dot: '{P['heroInk3']}',
    detalhe: 'A última atividade sincronizada é de 22 de agosto. Sem dado, a curva conta silêncio como descanso e o saldo sobe sozinho.',
    segs: {segs(fr['spark'])}, zero: {fr['spark']['zero']},
    ex: {fr['spark']['endX']}, ey: {fr['spark']['endY']},
    selo: '12 DIAS SEM SINCRONIZAR', seloCor: '{P['heroInk3']}', vago: true, alerta: true }},
}};
class Component extends DCLogic {{
  renderVals() {{
    const d = S[this.props.estado ?? 'fresco'];
    return {{ ...d, saldoTxt: (d.saldo > 0 ? '+' : '') + d.saldo,
      basePct: Math.round(d.base / 2) + '%', cansPct: Math.round(d.cansaco / 2) + '%',
      temSelo: d.selo.length > 0 }};
  }}
}}"""
    props = ('{"estado":{"editor":"enum","options":["fresco","enterrado","cobertura"],'
             '"default":"' + ('cobertura' if title_hint == 'escuro' else 'fresco') + '","section":"Estado"}}')

    card = (f'background: {P["surface"]}; border-radius: 20px; padding: 16px; '
            f'display: flex; flex-direction: column; gap: 12px; box-shadow: {P["shadow"]}')

    body = f"""
<div style="width: 390px; height: 844px; background: {P['bg']}; padding: 54px 16px 16px; display: flex; flex-direction: column; gap: 14px; overflow: hidden">

  <div style="display: flex; flex-direction: column; gap: 2px">
    <div style="font-size: 13px; letter-spacing: 0.9px; color: {P['ink3']}; font-weight: 600">QUINTA, 3 DE SETEMBRO</div>
    <div style="font-family: {SERIF}; font-size: 34px; line-height: 42px; color: {P['ink']}">Bom dia, Sydnei</div>
  </div>

  <div style="background: {P['heroBg']}; border-radius: 24px; padding: 18px; display: flex; flex-direction: column; gap: 14px">
    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px">
      <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0">
        <div style="font-size: 12px; letter-spacing: 0.4px; font-weight: 600; color: {P['heroEyebrow']}">FORMA DE HOJE</div>
        <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 2px">
          <span style="font-family: {SERIF}; font-size: 42px; line-height: 46px; color: {{{{numCor}}}}">{{{{saldoTxt}}}}</span>
          <span style="font-size: 18px; color: {P['heroInk2']}">de saldo</span>
        </div>
        <div style="font-size: 14px; line-height: 19px; color: {P['heroInk']}; margin-top: 3px">{{{{frase}}}}</div>
      </div>
      <sc-if value="{{{{temSelo}}}}" hint-placeholder-val="{{{{ true }}}}">
        <div style="display: flex; align-items: center; gap: 5px; max-width: 96px">
          <span style="width: 6px; height: 6px; border-radius: 999px; background: {{{{seloCor}}}}; flex: none"></span>
          <span style="font-size: 9.5px; letter-spacing: 0.5px; font-weight: 700; line-height: 12px; color: {{{{seloCor}}}}">{{{{selo}}}}</span>
        </div>
      </sc-if>
    </div>

    <div style="display: flex; flex-direction: column; gap: 5px">
      <svg viewBox="-10 -4 336 48" width="100%" height="46" style="display: block">
        <line x1="0" y1="{{{{zero}}}}" x2="322" y2="{{{{zero}}}}" stroke="{P['heroZero']}" stroke-width="0.8" stroke-dasharray="3 3"></line>
        <text x="-10" y="{{{{zero}}}}" dy="3.2" font-family="{MONO}" font-size="8" fill="{P['heroInk3']}">0</text>
        <sc-for list="{{{{segs}}}}" as="seg" hint-placeholder-count="6">
          <path d="{{{{seg.d}}}}" fill="none" stroke="{{{{seg.cor}}}}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"></path>
        </sc-for>
        <circle cx="{{{{ex}}}}" cy="{{{{ey}}}}" r="3" fill="{{{{dot}}}}"></circle>
      </svg>
      <div style="display: flex; justify-content: space-between; font-family: {MONO}; font-size: 10.5px; color: {P['heroInk3']}">
        <span>42 dias</span><span>hoje</span>
      </div>
    </div>
  </div>

  <sc-if value="{{{{alerta}}}}" hint-placeholder-val="{{{{ true }}}}">
    <div style="background: {P['alertBg']}; border-radius: 16px; padding: 11px 13px; display: flex; align-items: center; gap: 10px; min-height: 44px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{P['alertIcon']}" stroke-width="1.8" stroke-linecap="round" style="flex: none"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5"></path><path d="M12 16.4v.2"></path></svg>
      <div style="flex: 1; font-size: 12.5px; line-height: 17px; color: {P['ink2']}">Última atividade em 22 de agosto. Abra Conexões para sincronizar.</div>
      {chevron(P['ink3'])}
    </div>
  </sc-if>

  <div style="{card}">
    <div style="display: flex; align-items: center; justify-content: space-between">
      <div style="font-size: 12.5px; font-weight: 700; letter-spacing: 0.6px; color: {P['ink2']}">DE ONDE VEM</div>
      <div style="font-size: 12px; color: {P['ink3']}">esforço por semana</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px">
      <div style="display: flex; align-items: center; gap: 10px">
        <div style="width: 92px; font-size: 12.5px; color: {P['ink2']}">Base 42 d</div>
        <div style="flex: 1; height: 8px; border-radius: 4px; background: {P['mute']}; overflow: hidden">
          <div style="height: 8px; border-radius: 4px; background: {P['baseFill']}; width: {{{{basePct}}}}"></div>
        </div>
        <div style="width: 34px; text-align: right; font-family: {MONO}; font-weight: 600; font-size: 12.5px; color: {P['ink']}">{{{{base}}}}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px">
        <div style="width: 92px; font-size: 12.5px; color: {P['ink2']}">Cansaço 7 d</div>
        <div style="flex: 1; height: 8px; border-radius: 4px; background: {P['mute']}; overflow: hidden">
          <div style="height: 8px; border-radius: 4px; background: {P['rose']}; width: {{{{cansPct}}}}"></div>
        </div>
        <div style="width: 34px; text-align: right; font-family: {MONO}; font-weight: 600; font-size: 12.5px; color: {P['ink']}">{{{{cansaco}}}}</div>
      </div>
    </div>
    <div style="font-size: 12.5px; line-height: 17px; color: {P['ink2']}">{{{{detalhe}}}}</div>
  </div>

  <div style="margin-top: auto; background: {P['surface']}; border-radius: 20px; min-height: 52px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; box-shadow: {P['shadow']}">
    <div style="font-size: 13.5px; font-weight: 600; color: {P['ink']}">Ver a curva completa</div>
    {chevron(P['ink3'])}
  </div>
</div>
"""
    open(out, "w").write(head() + body + script(props, logic) + TAIL)

build(L, "Main.dc.html", "claro")
build(D, "Escuro.dc.html", "escuro")
print("Main.dc.html (claro) + Escuro.dc.html ok")
