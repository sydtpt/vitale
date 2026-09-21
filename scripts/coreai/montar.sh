#!/usr/bin/env bash
#
# `scripts/coreai/montar.sh` — monta a biblioteca vendorizada do Core AI (story 5.8).
#
# O pod `OnDeviceEngine` precisa do `CoreAILanguageModel`, que mora no pacote Swift
# `apple/coreai-models`. O CocoaPods não sabe consumir Swift Package, e o autolinking do Expo
# só conhece `.podspec` — então o grafo é compilado **aqui**, uma vez, e o que entra no pod é:
#
#     mobile/modules/on-device-engine/ios/vendor/ios-arm64/libOrbeCoreAI.a
#     mobile/modules/on-device-engine/ios/vendor/ios-arm64/OrbeCoreAI.swiftinterface
#     mobile/modules/on-device-engine/ios/vendor/ios-arm64/*.bundle   (recursos dos pacotes)
#
# **Uma fatia só, e não por economia.** O `CoreAI.framework` **não existe no SDK do
# simulador** — medido em 21/09/2026, Xcode 27.0:
#
#     iPhoneOS27.0.sdk/System/Library/Frameworks/CoreAI.framework        existe
#     iPhoneSimulator27.0.sdk/System/Library/Frameworks/CoreAI.framework não existe
#
# (o `FoundationModels` existe nos dois — é só o Core AI que é do aparelho). Tentar a fatia do
# simulador falha em `CoreAIShared` com *"Unable to resolve module dependency: 'CoreAI'"*. Por
# isso o pod compila o `MotorCoreAI.swift` só para `iphoneos`, e no simulador o motor aparece
# no seletor indisponível, com motivo — nunca some da lista.
#
# **A `.swiftinterface` é o ponto.** O `OrbeCoreAI.swift` importa o pacote com `internal
# import`; compilado com `-enable-library-evolution`, a interface que sai não cita
# `CoreAILanguageModels`. É por isso que o pod precisa de **um** arquivo de interface em vez
# dos vinte e tantos `.swiftmodule` e dos mapas de módulo em C do grafo.
#
# Nada disto roda no CI (lá não há Xcode nem rede para o pacote). É comando de máquina do
# dono, antes de um build de entrega, e o resultado é binário — não fonte.
#
#     ./scripts/coreai/montar.sh
#
# O diretório de trabalho (clone + DerivedData, alguns GB) sai de `ORBE_COREAI_TRABALHO`, e o
# padrão é temporário de propósito: ele não é fonte e não deve voltar para o repositório.

set -euo pipefail

# A revisão do pacote da Apple contra a qual este binário foi montado. Fixa: o `.swiftmodule`
# e o `.a` são de um compilador e de um fonte, e "main" não é endereço.
REVISAO="3f109efd54273391f9fd9f5f5b3d8c6e99836d55"
PACOTE="https://github.com/apple/coreai-models.git"
# O alvo mínimo do app desde a 5.8. O pacote declara `platforms: [.iOS("27.0")]` e não tem um
# único `@available`: compilar contra alvo menor apagaria a proteção de versão.
ALVO="27.0"

AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
DESTINO="$RAIZ/mobile/modules/on-device-engine/ios/vendor"
TRABALHO="${ORBE_COREAI_TRABALHO:-${TMPDIR:-/tmp}/orbe-coreai}"
CLONE="$TRABALHO/coreai-models"
DD="$TRABALHO/dd"

echo "==> trabalho em $TRABALHO"
mkdir -p "$TRABALHO"

if [ ! -d "$CLONE/.git" ]; then
  echo "==> clonando $PACOTE"
  git clone "$PACOTE" "$CLONE"
fi
git -C "$CLONE" fetch --all --tags --quiet || true
git -C "$CLONE" checkout --quiet "$REVISAO"
echo "==> pacote em $(git -C "$CLONE" rev-parse --short HEAD)"

# Uma fatia: <nome da pasta de destino> <destination do xcodebuild> <sufixo do SDK> <triple>
montar_fatia() {
  local nome="$1" destino="$2" sdk="$3" triple="$4"
  local produtos="$DD/Build/Products/Release-$sdk"
  local mapas="$DD/Build/Intermediates.noindex/GeneratedModuleMaps-$sdk"
  local saida="$DESTINO/$nome"

  echo "==> [$nome] compilando o grafo do pacote"
  ( cd "$CLONE" && xcodebuild -scheme CoreAILM -configuration Release \
      -destination "$destino" -derivedDataPath "$DD" \
      -skipPackagePluginValidation -skipMacroValidation build >/dev/null )

  echo "==> [$nome] compilando a casca OrbeCoreAI"
  local tmp="$TRABALHO/casca-$nome"
  rm -rf "$tmp" && mkdir -p "$tmp"
  local cc=()
  for m in "$mapas"/*.modulemap; do cc+=(-Xcc "-fmodule-map-file=$m"); done
  # Os dois alvos em C do grafo que não passam pelos mapas gerados: a ponte C do xgrammar
  # (fonte do próprio pacote) e o xgrammar (dependência). Sem eles o `import` do pacote
  # reclama de "missing required module".
  cc+=(-Xcc "-fmodule-map-file=$CLONE/swift/Sources/lib/CXGrammar/include/module.modulemap")
  cc+=(-Xcc "-I$CLONE/swift/Sources/lib/CXGrammar/include")
  cc+=(-Xcc "-fmodule-map-file=$DD/SourcePackages/checkouts/xgrammar/include/module.modulemap")
  cc+=(-Xcc "-I$DD/SourcePackages/checkouts/xgrammar/include")

  # **As flags são uma lista só, usada nas duas invocações.** Repetidas à mão, a interface e o
  # objeto podem divergir em silêncio — e divergir aqui quer dizer um `.a` que não casa com a
  # `.swiftinterface` que o pod lê.
  #
  # `-parse-as-library`: sem ele, **um arquivo Swift solto vira `main.swift`** e o objeto sai
  # com um símbolo `_main` dentro. Ele fica escondido no `.a` até o link do app, que então
  # morre com `duplicate symbol '_main'` contra o `AppDelegate.o` — a 20 minutos de build de
  # distância da causa (medido em 21/09/2026).
  #
  # `-enable-library-evolution`: é ele que faz sair uma `.swiftinterface`, e é ela que carrega
  # a invariante do empacotamento (ver a conferência logo abaixo).
  local flags=(
    -enable-library-evolution -parse-as-library
    -module-name OrbeCoreAI -target "$triple" -swift-version 6 -O
    -enable-upcoming-feature MemberImportVisibility
    -enable-experimental-feature Lifetimes
    -I "$produtos" "${cc[@]}"
  )

  xcrun --sdk "$sdk" swiftc \
    -emit-module -emit-module-path "$tmp/OrbeCoreAI.swiftmodule" \
    -emit-module-interface-path "$tmp/OrbeCoreAI.swiftinterface" \
    "${flags[@]}" "$AQUI/OrbeCoreAI.swift"

  xcrun --sdk "$sdk" swiftc -c -o "$tmp/OrbeCoreAI.o" "${flags[@]}" "$AQUI/OrbeCoreAI.swift"

  # **A invariante que sustenta o empacotamento inteiro**: a interface não cita o pacote da
  # Apple. É o `internal import` da casca que compra isso; trocá-lo por um `import` normal
  # compilaria aqui, e só quebraria no build do app — com o pod pedindo vinte e tantos
  # `.swiftmodule` que ninguém vendorizou. Uma linha de `grep` fecha.
  if grep -qE '^import +(CoreAILanguageModels|CoreAIShared|Tokenizers|CXGrammar)\b' "$tmp/OrbeCoreAI.swiftinterface"; then
    echo "==> [$nome] ERRO: a .swiftinterface cita o pacote da Apple — o 'internal import' da casca caiu" >&2
    grep -nE '^import ' "$tmp/OrbeCoreAI.swiftinterface" >&2
    exit 1
  fi

  # A rede contra a reincidência: um `_main` no objeto da casca não pode entrar no `.a`.
  if xcrun nm -g "$tmp/OrbeCoreAI.o" | grep -qE ' T _main$'; then
    echo "==> [$nome] ERRO: a casca saiu com _main — faltou -parse-as-library" >&2
    exit 1
  fi

  echo "==> [$nome] juntando o .a"
  rm -rf "$saida" && mkdir -p "$saida"
  # Todo `.o` do grafo mais a casca. São objetos já ligados por módulo (um por alvo do
  # pacote); o `libtool -static` os junta num arquivo que o linkador do app poda.
  xcrun --sdk "$sdk" libtool -static -o "$saida/libOrbeCoreAI.a" "$produtos"/*.o "$tmp/OrbeCoreAI.o"
  cp "$tmp/OrbeCoreAI.swiftinterface" "$saida/OrbeCoreAI.swiftinterface"
  # Os `.bundle` que o SwiftPM gera para os alvos com recurso (`Bundle.module`). Sem eles, um
  # alvo que leia o próprio bundle em execução aborta — e a falha só apareceria no aparelho.
  for b in "$produtos"/*.bundle; do [ -e "$b" ] && cp -R "$b" "$saida/"; done
  echo "==> [$nome] pronto: $(du -h "$saida/libOrbeCoreAI.a" | cut -f1)"
}

montar_fatia "ios-arm64" "generic/platform=iOS" "iphoneos" "arm64-apple-ios$ALVO"

# A ficha do que foi vendorizado.
#
# **Sem data, de propósito.** Este arquivo mora dentro de `mobile/modules/`, que a barreira do
# runtime hasheia: um carimbo de tempo faria remontar a mesma revisão, com o mesmo Xcode, pedir
# um `runtimeVersion` novo sem que interface nativa nenhuma tivesse mudado — o oposto do que a
# barreira existe para dizer. O que fica aqui é só o que **decide** o binário: a revisão do
# pacote, o alvo e o compilador (a `.swiftinterface` é sensível à versão dele).
#
# As licenças ficam junto porque a obrigação veio com o binário: o `.a` leva o grafo inteiro
# dentro, e os dois `.bundle` ao lado são a prova visível disso. Foi um dos argumentos para
# descartar a saída dos fontes copiados, e ele não some na saída que venceu.
cat > "$DESTINO/PROCEDENCIA.txt" <<FIM
apple/coreai-models @ $REVISAO
alvo iOS $ALVO · fatia ios-arm64 (o CoreAI.framework nao existe no SDK do simulador)
montado por scripts/coreai/montar.sh
$(xcrun swiftc --version 2>/dev/null | grep -m1 'Apple Swift version')
$(xcodebuild -version | tr '\n' ' ')

libOrbeCoreAI.a leva, ligado estaticamente, o grafo do produto CoreAILM:

  apple/coreai-models          BSD-3-Clause      https://github.com/apple/coreai-models
  huggingface/swift-transformers  Apache-2.0     https://github.com/huggingface/swift-transformers
  huggingface/swift-huggingface   Apache-2.0     https://github.com/huggingface/swift-huggingface
  huggingface/swift-jinja         Apache-2.0     https://github.com/huggingface/swift-jinja
  mlc-ai/xgrammar                 Apache-2.0     https://github.com/mlc-ai/xgrammar
  apple/swift-crypto              Apache-2.0     https://github.com/apple/swift-crypto
  apple/swift-nio + swift-collections/numerics/atomics/algorithms/log/system  Apache-2.0
  ibireme/yyjson                  MIT            https://github.com/ibireme/yyjson
  mattt/EventSource               MIT            https://github.com/mattt/EventSource

Os .bundle ao lado (swift-crypto_Crypto, swift-transformers_Hub) sao recursos desses
pacotes, copiados para o app pelo mesmo podspec.
FIM

echo "==> vendorizado em $DESTINO"
