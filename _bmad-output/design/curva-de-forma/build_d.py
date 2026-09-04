# -*- coding: utf-8 -*-
import json
CW = json.load(open("chart_web.json"))
exec(open("common.py").read())
fr = CW["fresco"]

fills = "\n          ".join(
    f'<path d="{f["d"]}" fill="{GREEN_SOFT if f["sign"] > 0 else RED_SOFT}"></path>'
    for f in fr["fills"])

SC = CW['fresco']['scrub']
SX = SC['x']
def nav(label, active=False, group=False):
    if group:
        return (f'<div style="font-size: 10.5px; font-weight: 700; letter-spacing: 0.8px; '
                f'color: {T["ink4"]}; padding: 14px 12px 5px">{label}</div>')
    bg = f"background: {T['warm']}; " if active else ""
    col = T['ink'] if active else T['ink2']
    fw = "600" if active else "500"
    return (f'<div style="{bg}border-radius: 10px; min-height: 34px; padding: 0 12px; '
            f'display: flex; align-items: center; font-size: 13.5px; font-weight: {fw}; color: {col}">{label}</div>')

def stat(label, value, color=None):
    return f"""<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 0">
        <span style="font-size: 12.5px; color: {T['ink2']}">{label}</span>
        <span style="font-family: {MONO}; font-weight: 600; font-size: 13.5px; color: {color or T['ink']}">{value}</span>
      </div>"""

body = f"""
<div style="width: 1440px; height: 900px; background: {T['bgWeb']}; display: flex; overflow: hidden; font-family: {SANS}">

  <div style="width: 220px; background: {T['surface']}; border-right: 1px solid {T['line']}; padding: 20px 12px; display: flex; flex-direction: column; gap: 1px">
    <div style="display: flex; align-items: center; gap: 9px; padding: 0 12px 12px">
      <div style="width: 30px; height: 30px; border-radius: 8px; background: {T['ink']}"></div>
      <div style="font-family: {SERIF}; font-size: 21px; color: {T['ink']}">Orbe</div>
    </div>
    {nav('VISÃO GERAL', group=True)}
    {nav('Semana')}
    {nav('Retrospectiva')}
    {nav('TREINO E SAÚDE', group=True)}
    {nav('Treinos')}
    {nav('Histórico')}
    {nav('Forma', active=True)}
    {nav('Saúde')}
    {nav('Recuperação')}
    {nav('Hábitos')}
    {nav('DIA A DIA', group=True)}
    {nav('Alimentação')}
    {nav('Tarefas')}
    {nav('Registros')}
  </div>

  <div style="flex: 1; padding: 32px; display: flex; flex-direction: column; gap: 20px; min-width: 0">

    <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 24px">
      <div style="display: flex; flex-direction: column; gap: 2px">
        <div style="font-size: 12.5px; letter-spacing: 0.9px; color: {T['ink3']}; font-weight: 600">TREINO E SAÚDE</div>
        <div style="font-family: {SERIF}; font-size: 40px; line-height: 46px; color: {T['ink']}">Forma</div>
      </div>
      <div style="display: flex; gap: 6px; background: {T['surface']}; border: 1px solid {T['line']}; border-radius: 999px; padding: 4px">
        <div style="border-radius: 999px; padding: 6px 14px; font-size: 12.5px; font-weight: 600; color: {T['ink3']}">6 semanas</div>
        <div style="border-radius: 999px; padding: 6px 14px; font-size: 12.5px; font-weight: 600; background: {T['ink']}; color: #FFFFFF">90 dias</div>
        <div style="border-radius: 999px; padding: 6px 14px; font-size: 12.5px; font-weight: 600; color: {T['ink3']}">12 meses</div>
      </div>
    </div>

    <div style="display: flex; gap: 24px; align-items: flex-start">

      <div style="width: 880px; background: {T['surface']}; border-radius: 20px; padding: 20px; display: flex; flex-direction: column; gap: 16px; box-shadow: {SHADOW}">
        <div style="display: flex; align-items: flex-start; justify-content: space-between">
          <div style="display: flex; flex-direction: column; gap: 1px">
            <div style="font-size: 12.5px; font-weight: 700; letter-spacing: 0.6px; color: {T['ink2']}">SALDO DE FORMA</div>
            <div style="font-size: 12.5px; color: {T['ink3']}">base 42 dias menos cansaço 7 dias · esforço por semana</div>
          </div>
          <div style="display: flex; align-items: center; gap: 18px">
            {legend_chip('<span style="width: 16px; height: 2px; background: %s; border-radius: 1px; display: block"></span>' % T['ink'], 'Base')}
            {legend_chip('<span style="width: 16px; height: 0; border-top: 2px dashed %s; display: block"></span>' % T['rose'], 'Cansaço')}
            {legend_chip('<span style="width: 12px; height: 10px; background: %s; border-radius: 2px; display: block"></span>' % GREEN_SOFT, 'Sobra')}
            {legend_chip('<span style="width: 12px; height: 10px; background: %s; border-radius: 2px; display: block"></span>' % RED_SOFT, 'Dívida')}
          </div>
        </div>

        <div style="position: relative">
          <svg viewBox="-6 -6 852 272" width="852" height="264" style="display: block">
            {fills}
            <path d="{fr['ctlArea']}" fill="{T['ink']}" opacity="0.05"></path>
            <path d="{fr['ctl']}" fill="none" stroke="{T['ink']}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"></path>
            <path d="{fr['atl']}" fill="none" stroke="{T['rose']}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="5 4"></path>
            <line x1="{SX}" y1="-6" x2="{SX}" y2="260" stroke="{T['lineDeep']}" stroke-width="1"></line>
            <circle cx="{SX}" cy="{SC['yc']}" r="4" fill="{T['ink']}"></circle>
            <circle cx="{SX}" cy="{SC['ya']}" r="4" fill="{T['rose']}"></circle>
            <circle cx="{fr['hoje']['x']}" cy="{fr['hoje']['yc']}" r="4" fill="{T['ink']}"></circle>
            <circle cx="{fr['hoje']['x']}" cy="{fr['hoje']['ya']}" r="4" fill="{T['rose']}"></circle>
          </svg>
          <div style="position: absolute; left: {SX + 16}px; top: 30px; background: {T['ink']}; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 5px; min-width: 148px">
            <div style="font-size: 11px; letter-spacing: 0.4px; color: {T['primarySoft']}; font-weight: 600">{SC['data']}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px">
              <span style="font-size: 12px; color: rgba(255,255,255,0.8)">Base</span>
              <span style="font-family: {MONO}; font-size: 12px; color: #FFFFFF">{SC['base']}</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px">
              <span style="font-size: 12px; color: rgba(255,255,255,0.8)">Cansaço</span>
              <span style="font-family: {MONO}; font-size: 12px; color: #FFFFFF">{SC['cansaco']}</span>
            </div>
            <div style="height: 1px; background: rgba(255,255,255,0.14)"></div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px">
              <span style="font-size: 12px; color: rgba(255,255,255,0.8)">Saldo</span>
              <span style="font-family: {MONO}; font-size: 12px; font-weight: 600; color: {T['red']}">{SC['saldo']}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; font-family: {MONO}; font-size: 11px; color: {T['ink3']}; border-top: 1px solid {T['line']}; padding-top: 10px">
          {''.join('<span>%s</span>' % e for e in CW['eixo'])}
        </div>
      </div>

      <div style="width: 252px; display: flex; flex-direction: column; gap: 16px">
        <div style="background: {T['ink']}; border-radius: 20px; padding: 18px; display: flex; flex-direction: column; gap: 4px">
          <div style="font-size: 11.5px; letter-spacing: 0.4px; font-weight: 600; color: {T['primarySoft']}">HOJE</div>
          <div style="display: flex; align-items: baseline; gap: 7px">
            <span style="font-family: {SERIF}; font-size: 44px; line-height: 48px; color: #FFFFFF">+{fr['hoje']['tsb']}</span>
            <span style="font-size: 15px; color: rgba(255,255,255,0.6)">de saldo</span>
          </div>
          <div style="font-size: 13px; color: rgba(255,255,255,0.85); line-height: 18px">Fresco. Base em {fr['hoje']['ctl']} e cansaço em {fr['hoje']['atl']}.</div>
        </div>

        <div style="background: {T['surface']}; border-radius: 20px; padding: 16px; box-shadow: {SHADOW}">
          <div style="font-size: 12.5px; font-weight: 700; letter-spacing: 0.6px; color: {T['ink2']}; padding-bottom: 4px">A SEMANA</div>
          {stat('Esforço acumulado', '78 / 95')}
          <div style="height: 1px; background: {T['line']}"></div>
          {stat('Polarização', '71% leve')}
          <div style="height: 1px; background: {T['line']}"></div>
          {stat('Prontidão de hoje', '82 / 100', T['green'])}
          <div style="height: 1px; background: {T['line']}"></div>
          {stat('Cobertura do dado', '3 de 4')}
        </div>

        <div style="background: {T['greenSoft']}; border-left: 3px solid {T['green']}; border-radius: 16px; padding: 12px 14px; display: flex; flex-direction: column; gap: 3px">
          <div style="font-size: 13px; font-weight: 700; color: {T['green']}">Janela aberta</div>
          <div style="font-size: 12.5px; line-height: 17px; color: {T['ink2']}">Saldo positivo há 6 dias e prontidão acima de 80. Bom momento para o teste de limiar que está no plano.</div>
        </div>

        <div style="background: {T['surface']}; border-radius: 20px; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; box-shadow: {SHADOW}">
          <span style="font-size: 13px; font-weight: 600; color: {T['ink']}">Constantes 42 / 7</span>
          {chevron()}
        </div>
      </div>
    </div>
  </div>
</div>
"""
open("Web.dc.html", "w").write(head() + body + TAIL)
print("Web.dc.html ok")
