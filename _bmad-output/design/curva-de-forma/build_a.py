# -*- coding: utf-8 -*-
"""Artboard A · A Faixa — gráfico completo com o vão tingido pelo sinal."""
import json
C = json.load(open("chart.json"))
exec(open("common.py").read())

def frame_js(k, fr):
    fills = ",".join(
        "{d:'%s',cor:'%s'}" % (f["d"], GREEN_SOFT if f["sign"] > 0 else RED_SOFT)
        for f in fr["fills"])
    return f"""  {k}: {{
    ctl: '{fr['ctl']}', atl: '{fr['atl']}', area: '{fr['ctlArea']}',
    fills: [{fills}],
    x: {fr['hoje']['x']}, yc: {fr['hoje']['yc']}, ya: {fr['hoje']['ya']},
    y1: {min(fr['hoje']['yc'], fr['hoje']['ya'])}, y2: {max(fr['hoje']['yc'], fr['hoje']['ya'])},
    base: {fr['hoje']['ctl']}, cansaco: {fr['hoje']['atl']}, saldo: {fr['hoje']['tsb']} }}"""

logic = f"""
const F = {{
{frame_js('fr', C['fresco'])},
{frame_js('en', C['enterrado'])}
}};
const ESTADO = {{
  fresco:    {{ f: 'fr', titulo: 'Fresco',
    frase: 'Base mantida e cansaço em queda. Melhor janela para um teste desde julho.',
    cor: '{T['green']}', tint: '{T['greenSoft']}', alerta: false }},
  enterrado: {{ f: 'en', titulo: 'Enterrado',
    frase: 'Segunda semana de bloco. O saldo negativo é planejado, mas já passou de -40.',
    cor: '{T['red']}', tint: 'rgba(224,92,92,0.16)', alerta: false }},
  cobertura: {{ f: 'fr', titulo: 'Sem confirmar',
    frase: 'Doze dias sem atividade sincronizada. A curva está lendo o silêncio como descanso.',
    cor: '{T['ink3']}', tint: '{T['mute']}', alerta: true }},
}};
class Component extends DCLogic {{
  renderVals() {{
    const e = ESTADO[this.props.estado ?? 'fresco'];
    const f = F[e.f];
    return {{ ...e, ...f,
      saldoTxt: (f.saldo > 0 ? '+' : '') + f.saldo,
      basePct: Math.round(f.base / 2) + '%',
      cansPct: Math.round(f.cansaco / 2) + '%' }};
  }}
}}"""

PROPS = ('{"estado":{"editor":"enum","options":["fresco","enterrado","cobertura"],'
         '"default":"fresco","section":"Estado"}}')

body = f"""
<div style="width: 390px; height: 844px; background: {T['bg']}; padding: 54px 16px 16px; display: flex; flex-direction: column; gap: 14px; overflow: hidden">

  <div style="display: flex; flex-direction: column; gap: 2px">
    <div style="font-size: 13px; letter-spacing: 0.9px; color: {T['ink3']}; font-weight: 600">TREINO</div>
    <div style="font-family: {SERIF}; font-size: 34px; line-height: 42px; color: {T['ink']}">Forma</div>
  </div>

  {card_open()}
    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px">
      <div style="display: flex; flex-direction: column; gap: 1px">
        <div style="font-size: 12.5px; font-weight: 700; letter-spacing: 0.6px; color: {T['ink2']}">SALDO DE FORMA</div>
        <div style="font-size: 12px; color: {T['ink3']}">últimos 90 dias · esforço por semana</div>
      </div>
      <div style="font-family: {SERIF}; font-size: 36px; line-height: 36px; color: {{{{cor}}}}">{{{{saldoTxt}}}}</div>
    </div>

    <div style="position: relative">
      <svg viewBox="-5 -5 336 160" width="100%" height="152" style="display: block">
        <sc-for list="{{{{fills}}}}" as="fill" hint-placeholder-count="4">
          <path d="{{{{fill.d}}}}" fill="{{{{fill.cor}}}}"></path>
        </sc-for>
        <path d="{{{{area}}}}" fill="{T['ink']}" opacity="0.05"></path>
        <path d="{{{{ctl}}}}" fill="none" stroke="{T['ink']}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
        <path d="{{{{atl}}}}" fill="none" stroke="{T['rose']}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="4 3"></path>
        <line x1="{{{{x}}}}" y1="{{{{y1}}}}" x2="{{{{x}}}}" y2="{{{{y2}}}}" stroke="{T['lineDeep']}" stroke-width="1"></line>
        <circle cx="{{{{x}}}}" cy="{{{{yc}}}}" r="3.5" fill="{T['ink']}"></circle>
        <circle cx="{{{{x}}}}" cy="{{{{ya}}}}" r="3.5" fill="{T['rose']}"></circle>
      </svg>
      <sc-if value="{{{{alerta}}}}" hint-placeholder-val="{{{{ true }}}}">
        <div style="position: absolute; right: 0; top: 0; bottom: 0; width: 46px; background: repeating-linear-gradient(135deg, rgba(198,188,174,0.35) 0 3px, transparent 3px 7px); border-left: 1px dashed {T['ink4']}"></div>
      </sc-if>
    </div>

    <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap">
      {legend_chip('<span style="width: 14px; height: 2px; background: %s; border-radius: 1px; display: block"></span>' % T['ink'], 'Base 42 d')}
      {legend_chip('<span style="width: 14px; height: 0; border-top: 2px dashed %s; display: block"></span>' % T['rose'], 'Cansaço 7 d')}
      {legend_chip('<span style="width: 12px; height: 10px; background: %s; border-radius: 2px; display: block"></span>' % GREEN_SOFT, 'Sobra')}
      {legend_chip('<span style="width: 12px; height: 10px; background: %s; border-radius: 2px; display: block"></span>' % RED_SOFT, 'Dívida')}
    </div>
  {card_close()}

  {card_open()}
    {bar_row('Base 42 d', '{{basePct}}', T['ink'], '{{base}}')}
    {bar_row('Cansaço 7 d', '{{cansPct}}', T['rose'], '{{cansaco}}')}
    <div style="height: 1px; background: {T['line']}"></div>
    <div style="display: flex; align-items: center; gap: 10px">
      <div style="width: 92px; font-size: 12.5px; font-weight: 600; color: {T['ink2']}">Meta semanal</div>
      <div style="flex: 1; font-size: 12px; color: {T['ink3']}">a referência que o Orbe já usa</div>
      <div style="width: 34px; text-align: right; font-family: {MONO}; font-weight: 600; font-size: 12.5px; color: {T['ink3']}">95</div>
    </div>
  {card_close()}

  <div style="background: {{{{tint}}}}; border-left: 3px solid {{{{cor}}}}; border-radius: 16px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px">
    <div style="font-size: 13px; font-weight: 700; color: {{{{cor}}}}">{{{{titulo}}}}</div>
    <div style="font-size: 12.5px; line-height: 17px; color: {T['ink2']}">{{{{frase}}}}</div>
  </div>

  <div style="margin-top: auto; display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 0 4px">
    <div style="font-size: 12.5px; color: {T['ink3']}">Constantes 42 / 7 · ajustáveis</div>
    {chevron()}
  </div>
</div>
"""
open("Main.dc.html", "w").write(head() + body + script(PROPS, logic) + TAIL)
print("Main.dc.html ok")
