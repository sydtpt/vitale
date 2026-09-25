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
#   - Com o Xcode 27 (SDK iOS 27), app sem ciclo de vida por cena compila,
#     instala e **morre ao abrir**, antes de qualquer JS (ADR 0051). O script
#     recusa compilar com o 27 se o plugin `withUISceneLifecycle` não estiver no
#     app config.
#   - O `pod install` grava no `Podfile.lock` o caminho de cada módulo nativo
#     **com a versão** do pnpm (`.pnpm/expo-application@57.0.2_…`). Um
#     `pnpm install` que troca a versão apaga aquele diretório, e o build morre
#     em `CpResource … No such file or directory`, sem que nenhum arquivo de
#     config tenha mudado. O script confere os caminhos e regera quando algum
#     sumiu (17/09/2026).
#   - O `devicectl` do Xcode 27 lista os **simuladores** junto com o iPhone;
#     o script só considera aparelho físico.
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
  # Config igual não basta: o Pods aponta para diretórios com a versão no nome,
  # e um `pnpm install` que troca a versão os apaga sem tocar em config nenhuma.
  local lock="$IOS_DIR/Podfile.lock"
  [[ -f "$lock" ]] || return 0
  local caminho
  while IFS= read -r caminho; do
    if [[ ! -e "$IOS_DIR/$caminho" ]]; then
      echo "  módulo nativo sumiu do node_modules: $caminho" >&2
      return 0
    fi
  done < <(sed -n 's/^ *:path: "\(.*\)"$/\1/p' "$lock")
  return 1
}

# ── 0. o Xcode, e o que ele exige ────────────────────────────────────────────
# Sem `| head -1`: com `pipefail`, o `head` fecha o pipe, o xcodebuild morre de
# SIGPIPE e o script sai com 141 antes de dizer qualquer coisa.
XCODE_VERSION="$(xcodebuild -version 2>/dev/null)" || die "xcodebuild não respondeu — o Xcode está instalado e selecionado?"
XCODE_VERSION="${XCODE_VERSION%%$'\n'*}"
say "$XCODE_VERSION ($(xcode-select -p))"
XCODE_MAJOR="$(sed -n 's/^Xcode \([0-9]*\).*/\1/p' <<<"$XCODE_VERSION")"
if [[ "${XCODE_MAJOR:-0}" -ge 27 ]] \
   && ! grep -q "withUISceneLifecycle" "$MOBILE_DIR/app.base.json" "$MOBILE_DIR/app.config.js" 2>/dev/null; then
  die "o Xcode $XCODE_MAJOR exige o ciclo por cena, e o plugin withUISceneLifecycle não está no app config — o app compilaria e morreria ao abrir (ADR 0051)"
fi

if needs_prebuild; then
  say "prebuild (config nativa mudou ou ios/ não existe)"
  (cd "$MOBILE_DIR" && pnpm exec expo prebuild --platform ios --clean)
else
  say "prebuild dispensado — nada nativo mudou desde a última geração"
fi

# ── 2. build Release ─────────────────────────────────────────────────────────
mkdir -p "$DERIVED"

# **A pasta de pesos é apagada antes do build.** O `[CP] Copy Pods Resources` do
# CocoaPods copia por rsync **sem `--delete`**: ele acrescenta e sobrescreve, nunca
# remove. Trocar um modelo por outro deixava o anterior dentro do `.app` — em 24/09
# isso levou o app de 4,6 para 6,7 GB com dois `.aimodel` na mesma pasta, e a ficha
# do modelo passou a contar "0 de 2 componentes", com a compilação podendo pegar o
# arquivo errado. Aconteceu duas vezes no mesmo dia.
#
# Apagar só `pesos/` (e não o `.app` inteiro) mantém o build incremental: o que sai
# são gigabytes que o rsync repõe em segundos.
if [[ -d "$APP_PATH/pesos" ]]; then
  rm -rf "$APP_PATH/pesos"
fi

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
# Só aparelho físico: o devicectl do Xcode 27 lista os simuladores como pareados,
# e um .app de iphoneos não instala neles de qualquer jeito.
ios = [d for d in devs if d['hardwareProperties'].get('platform') == 'iOS'
       and d['hardwareProperties'].get('reality') != 'simulated']
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
    h = d['hardwareProperties']
    if h.get('platform') == 'iOS' and h.get('reality') != 'simulated':
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
  # 1011 = "não achei o aparelho": o Mac não enxerga o iPhone agora. É transitório
  # do mesmo jeito que a queda de túnel — o telefone acorda, entra na Wi-Fi, o
  # cabo assenta — só que demora mais. Repete com folga maior e diz o que fazer.
  if grep -qE "CoreDeviceError 1011|unable to locate a device" <<<"$OUT"; then
    [[ $attempt -eq 3 ]] && die "o Mac não enxergou o iPhone em 3 tentativas — desbloqueie a tela, confira o cabo ou a Wi-Fi, e rode de novo (o build já está pronto; a repetição é rápida)"
    echo "  o Mac não enxerga o iPhone — desbloqueie a tela e confira cabo/Wi-Fi; tentando de novo em 8 s" >&2
    sleep 8
    continue
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
