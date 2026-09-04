# -*- coding: utf-8 -*-
T = dict(
    bg="#FFF7EE", bgWeb="#FAF3E6", surface="#FFFFFF", warm="#FFEFD9", mute="#F6ECDC",
    ink="#1F1B16", ink2="#5C534A", ink3="#9C928A", ink4="#C6BCAE",
    line="#EFE6D8", lineDeep="#E3D7C2",
    primary="#F25C2B", primaryDeep="#D9491B", primarySoft="#FFE3D2",
    green="#6FA86A", greenSoft="#E2EFD9", rose="#E26A8A", roseSoft="#FBE2E8",
    blue="#6E8CC9", yellow="#F5B946", red="#E05C5C",
)
GREEN_SOFT = "#E2EFD9"
RED_SOFT = "rgba(224,92,92,0.20)"
SANS = "'Manrope', system-ui, -apple-system, sans-serif"
SERIF = "'Instrument Serif', Georgia, serif"
MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
SHADOW = "0 1px 2px rgba(31,27,22,.05), 0 10px 24px -18px rgba(31,27,22,.4)"
FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&'
         'family=Geist+Mono:wght@400;500;600&display=swap">')

def head(extra=""):
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
    {extra}
  </style>
</helmet>"""

TAIL = "</x-dc>\n</body>\n</html>\n"

def script(props, logic):
    return f"<script data-dc-script data-props='{props}'>{logic}\n</script>\n"

def card_open(gap=12, pad=16):
    return (f'<div style="background: {T["surface"]}; border-radius: 20px; padding: {pad}px; '
            f'display: flex; flex-direction: column; gap: {gap}px; box-shadow: {SHADOW}">')

def card_close():
    return "</div>"

def bar_row(label, pct, color, value):
    return f"""<div style="display: flex; align-items: center; gap: 10px">
      <div style="width: 92px; font-size: 12.5px; color: {T['ink2']}">{label}</div>
      <div style="flex: 1; height: 8px; border-radius: 4px; background: {T['mute']}; overflow: hidden">
        <div style="height: 8px; border-radius: 4px; background: {color}; width: {pct}"></div>
      </div>
      <div style="width: 34px; text-align: right; font-family: {MONO}; font-weight: 600; font-size: 12.5px; color: {T['ink']}">{value}</div>
    </div>"""

def legend_chip(swatch, label):
    return (f'<div style="display: flex; align-items: center; gap: 6px">{swatch}'
            f'<span style="font-size: 11.5px; color: {T["ink2"]}">{label}</span></div>')

def chevron(color=None):
    c = color or T['ink3']
    return (f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{c}" '
            f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="M9 18l6-6-6-6"></path></svg>')
