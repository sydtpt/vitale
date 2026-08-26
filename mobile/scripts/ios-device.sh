#!/usr/bin/env bash
#
# Build Release + instala no iPhone, sem EAS e sem Metro.
#
# ## Por que este script existe
#
# A receita está em `mobile/AGENTS.md` e na ADR 0009, mas tem armadilhas demais
# para se digitar de cabeça, e cada uma delas falha de um jeito que *parece*
# outra coisa:
#
#   - `expo run:ios --configuration Release` não passa `-allowProvisioningUpdates`
#     e quebra na assinatura — depois de já ter bundlado o JS, o que faz o erro
#     parecer um problema de JS.
#   - `xcodebuild | tail` sem `pipefail` devolve o status do `tail`: build
#     quebrado passa por bem-sucedido.
#   - `-destination id=<UDID>` exige o aparelho resolvível na hora de compilar;
#     `generic/platform=iOS` não.
#   - `-derivedDataPath` dentro de `~/Library/Developer/Xcode` acumula ~7 GB por
#     build limpo e já estourou o disco aqui.
#   - O túnel do `devicectl` cai sozinho; repetir o install resolve.
#
# **Nunca use `expo run:ios` / `expo start` para entregar.** Aquilo é Debug: o JS
# vem do Metro pela LAN e o app só funciona dentro de casa. Este script produz um
# `.app` autocontido (o bundle vai dentro), que roda em qualquer rede.
#
# ## Uso
#
#   pnpm mobile:device                 # build + instala + abre
#   pnpm mobile:device --prebuild      # força regerar mobile/ios/ antes
#   pnpm mobile:device --build-only    # só compila
#   pnpm mobile:device --no-launch     # instala e não abre
#   pnpm mobile:device --device <id>   # escolhe o aparelho (id, UDID ou nome)
#
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$MOBILE_DIR/ios"
# Fora de ~/Library de propósito (ver cabeçalho). `ios/` inteiro é gitignored.
DERIVED="$IOS_DIR/build"
APP_PATH="$DERIVED/Build/Products/Release-iphoneos/Orbe.app"
LOG="$DERIVED/xcodebuild.log"

FORCE_PREBUILD=0
BUILD_ONLY=0
LAUNCH=1
DEVICE_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--prebuild) FORCE_PREBUILD=1; shift ;;
    --build-only)  BUILD_ONLY=1; shift ;;
    --no-launch)   LAUNCH=0; shift ;;
    --device)      DEVICE_ARG="${2:-}"; shift 2 ;;
    -h|--help)     sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

say() { printf '\033[1m▸ %s\033[0m\n' "$1"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

BUNDLE_ID="$(python3 -c "
import json,sys
d=json.load(open('$MOBILE_DIR/app.base.json'))['expo']
print(d['ios']['bundleIdentifier'])
")"

# ── 1. prebuild só quando precisa ────────────────────────────────────────────
# `mobile/ios/` é gerado (ADR 0012). Regerar à toa custa minutos e um pod install;
# não regerar quando a config mudou embute config velha no app, que é pior.
# Então: compara mtime do projeto nativo com o de tudo que o alimenta.
needs_prebuild() {
  [[ $FORCE_PREBUILD -eq 1 ]] && return 0
  [[ -d "$IOS_DIR" ]] || return 0
  local proj="$IOS_DIR/Orbe.xcodeproj/project.pbxproj"
  [[ -f "$proj" ]] || return 0
  local input
  for input in "$MOBILE_DIR/app.base.json" "$MOBILE_DIR/app.config.js" \
               "$MOBILE_DIR/package.json" "$MOBILE_DIR"/plugins/*.js; do
    [[ -e "$input" ]] || continue
    [[ "$input" -nt "$proj" ]] && return 0
  done
  return 1
}

if needs_prebuild; then
  say "prebuild (config nativa mudou ou ios/ não existe)"
  (cd "$MOBILE_DIR" && pnpm exec expo prebuild --platform ios --clean)
else
  say "prebuild dispensado — nada nativo mudou desde a última geração"
fi

# ── 2. build Release ─────────────────────────────────────────────────────────
mkdir -p "$DERIVED"
say "compilando Release (log: ${LOG/#$MOBILE_DIR\//mobile/})"
# `set -o pipefail` está ligado no topo: se o xcodebuild falhar, o status
# sobrevive ao `tee` e o script morre aqui, como tem que ser.
if ! (cd "$IOS_DIR" && xcodebuild \
        -workspace Orbe.xcworkspace \
        -scheme Orbe \
        -configuration Release \
        -destination 'generic/platform=iOS' \
        -derivedDataPath "$DERIVED" \
        -allowProvisioningUpdates \
        build) > "$LOG" 2>&1; then
  echo
  grep -E "error:|BUILD FAILED|Provisioning|Signing" "$LOG" | tail -20 >&2 || true
  die "build falhou — log completo em $LOG"
fi

[[ -d "$APP_PATH" ]] || die "build terminou sem erro mas não achei $APP_PATH"
say "app pronto: $(du -sh "$APP_PATH" | cut -f1) — bundle embutido, não depende do Metro"

[[ $BUILD_ONLY -eq 1 ]] && exit 0

# ── 3. escolher o aparelho ───────────────────────────────────────────────────
DEV_JSON="$DERIVED/devices.json"
xcrun devicectl list devices --json-output "$DEV_JSON" >/dev/null 2>&1 \
  || die "xcrun devicectl não respondeu"

DEVICE_ID="$(python3 -c "
import json,sys
want = sys.argv[1] if len(sys.argv) > 1 else ''
devs = json.load(open('$DEV_JSON'))['result']['devices']
ios = [d for d in devs if d['hardwareProperties'].get('platform') == 'iOS']
if want:
    for d in ios:
        if want in (d.get('identifier'), d['hardwareProperties'].get('udid'),
                    d['deviceProperties'].get('name')):
            print(d['identifier']); sys.exit(0)
    sys.exit(1)
# Sem escolha explícita: só resolve sozinho se houver exatamente um.
if len(ios) == 1:
    print(ios[0]['identifier'])
else:
    sys.exit(2)
" "$DEVICE_ARG")" || {
  echo "aparelhos iOS pareados:" >&2
  python3 -c "
import json
for d in json.load(open('$DEV_JSON'))['result']['devices']:
    if d['hardwareProperties'].get('platform') == 'iOS':
        print('  {}  {}  ({})'.format(
            d['deviceProperties'].get('name'),
            d.get('identifier'),
            d['connectionProperties'].get('pairingState')))
" >&2
  die "escolha um com --device <id|udid|nome>"
}

# ── 4. instalar, com repetição ───────────────────────────────────────────────
# O cabo é opcional: o devicectl instala pelo túnel de rede local com o telefone
# só pareado por Wi-Fi. O túnel cai sozinho às vezes — daí a repetição.
install_once() {
  xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH" 2>&1
}

for attempt in 1 2 3; do
  say "instalando (tentativa $attempt/3)"
  if OUT="$(install_once)"; then
    say "instalado"
    break
  fi
  echo "$OUT" | tail -6 >&2
  if grep -q "DeviceLocked\|kAMDMobileImageMounterDeviceLocked" <<<"$OUT"; then
    die "o iPhone está bloqueado — desbloqueie a tela e rode de novo"
  fi
  # Queda de túnel é transitória; o resto não vale repetir.
  if ! grep -qE "Connection reset by peer|CoreDeviceError 4000|tunnel" <<<"$OUT"; then
    die "install falhou por um motivo que não é queda de túnel (acima)"
  fi
  [[ $attempt -eq 3 ]] && die "o túnel caiu 3 vezes — confira Wi-Fi e se o telefone está desbloqueado"
  sleep 3
done

# ── 5. abrir ─────────────────────────────────────────────────────────────────
if [[ $LAUNCH -eq 1 ]]; then
  say "abrindo $BUNDLE_ID"
  xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID" >/dev/null \
    || echo "instalou, mas não consegui abrir daqui — abra pelo ícone" >&2
fi

say "pronto"
