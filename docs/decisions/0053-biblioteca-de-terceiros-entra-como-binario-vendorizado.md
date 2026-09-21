# 0053 — Biblioteca de terceiros entra no repositório como binário vendorizado, atrás de uma casca fina

**Status:** aceita
**Data:** 2026-09-21

## Contexto

Para rodar **peso aberto** no iPhone (story 5.8), o app precisa do `CoreAILanguageModel`, que vem do pacote Swift `apple/coreai-models`. Ele não é um arquivo: o produto `CoreAILM` arrasta `CoreAIShared`, uma ponte em C++ para o `xgrammar`, o `swift-transformers` da Hugging Face e, por baixo, `swift-jinja`, `swift-huggingface`, `swift-crypto`, NIO, `yyjson` — mais de vinte pacotes, de três donos, com licenças BSD-3, Apache-2.0 e MIT.

E há um portão de empacotamento, verificado em 21/09/2026:

- **O CocoaPods não tem atributo de dependência de Swift Package.** O guia de sintaxe do podspec lista `dependency` (pods e subspecs) e, para vendorizar, `vendored_frameworks`, `vendored_libraries` e `source_files`. Não há `swift_package`.
- **O autolinking do Expo só conhece podspec.** A config Apple de `expo-modules-autolinking` tem `modules`, `podspecPath` e `podspec`; nenhuma chave de Swift Package.
- **A ponte é um pod** (ADR 0047, `mobile/modules/on-device-engine/`), e é lá que o motor tem de morar — as barreiras do `architecture.test.ts` leem aquele diretório.

Este é o primeiro binário de terceiro que entraria no repositório. Não havia precedente.

## Decisão

**O grafo é compilado uma vez, fora do app, e o que entra no repositório é binário — atrás de uma casca fina, escrita por nós, cujo fonte fica versionado.**

Três partes:

1. **A casca** (`scripts/coreai/OrbeCoreAI.swift`, ~30 linhas). Ela importa o pacote com **`internal import`** e expõe uma função cuja assinatura só usa `Foundation` e `FoundationModels`. Compilada com `-enable-library-evolution`, a `.swiftinterface` que sai **não cita** `CoreAILanguageModels`.
2. **O montador** (`scripts/coreai/montar.sh`), que clona o pacote numa **revisão fixa**, compila o grafo para `iphoneos` com `xcodebuild`, compila a casca e junta tudo num `.a`.
3. **O vendorizado** (`mobile/modules/on-device-engine/ios/vendor/ios-arm64/`): `libOrbeCoreAI.a` (21,3 MiB) e `OrbeCoreAI.swiftinterface`. **Versionados**, e dentro do hash do `runtimeVersion` — é código nativo que entra no binário.

**A casca é o ponto, e o `internal import` é o motivo.** Sem ela, o pod precisaria dos vinte e tantos `.swiftmodule` do grafo e dos mapas de módulo em C de `yyjson`, `CXGrammar` e `XGrammar`, com caminhos de checkout do SwiftPM dentro do `SWIFT_INCLUDE_PATHS`. Com ela, precisa de **um arquivo de interface**. Foi medido nos dois sentidos: sem a casca, um consumidor falha em cadeia (`missing required module 'yyjson'`, depois `'CXGrammar'`); com ela, o mesmo consumidor compila com a interface sozinha no `-I`.

**Um binário opaco não guarda regra do Orbe.** A casca devolve o erro **descrito** — nome do tipo, descrição, domínio e código do `NSError` —, e quem o traduz em classe de falha é `MotorCoreAI.identificar`, que é fonte aqui, que as barreiras leem e que a bancada percorre **sem a biblioteca**. O que está no `.a` é o pacote da Apple e a cola de abrir a pasta; nada mais.

**As guardas que vêm junto:**

- **A invariante é conferida na montagem.** O `montar.sh` reprova se a `.swiftinterface` citar o pacote — trocar `internal import` por `import` compila ali e só quebraria no build do app.
- **A procedência é escrita e lida.** `vendor/PROCEDENCIA.txt` grava a revisão do pacote, o alvo, o compilador e **as licenças dos três donos**; o podspec a lê no `pod install` e avisa se o compilador desta máquina não for o que montou o `.a`, ou se o `.a` for mais velho que o fonte da casca.
- **Sem data no arquivo.** Ele mora dentro da árvore hasheada: um carimbo de tempo faria remontar a mesma revisão pedir um `runtimeVersion` novo sem nada ter mudado.
- **O ramo que só o binário exercita tem teste.** `aparelho:testar` compila um segundo binário com `-D ORBE_COREAI` contra uma **casca falsa** (`scripts/bancada/aparelho/casca-falsa.swift`) que espelha a superfície pública da de verdade. Sem isso, aquele ramo só seria compilado pelo build do app, que não afirma nada.
- **O `.a` faltando é dito com todas as letras**, e não como divergência de hash.

**Ausência é degradação, não quebra.** O podspec decide por `File.exist?`: sem o `.a`, a macro `ORBE_COREAI` não é definida, o pod compila igual, e o motor de peso aberto aparece no seletor **indisponível com motivo**. Um pod que só compilasse com o binário faria a falta dele quebrar o app inteiro.

**Uma fatia só, `ios-arm64`** — o `CoreAI.framework` não existe no SDK do simulador ([ADR 0052](0052-o-alvo-minimo-do-ios-sobe-para-27.md)).

## Consequências

- **21,3 MiB de binário de terceiro no git, para sempre.** É o preço, e é conhecido. Fica abaixo do teto de 100 MB por arquivo do GitHub, ao contrário dos **pesos** — que por isso ficam fora do git e fora do hash.
- **Refazer o `.a` pede `runtimeVersion` novo, mesmo sem mudança de fonte.** Está certo que peça: é um binário novo.
- **Atualizar o pacote é editar uma revisão e rodar um script.** E é uma mudança nativa, com tudo o que isso implica.
- **A obrigação de licença é nossa.** Ela foi um dos argumentos para descartar a saída dos fontes copiados, e não some na saída que venceu — por isso está no `PROCEDENCIA.txt`.

## Alternativas rejeitadas

**Config plugin adicionando o Swift Package ao projeto gerado.** **Impossível, não frágil**: o motor mora num *pod*, e um pacote adicionado ao alvo do *app* não é visível para o alvo do *pod* — o `import` não resolveria. Para valer, o SPM teria de entrar no `Pods.xcodeproj`, que o `pod install` regera depois do prebuild, fora do alcance de um config plugin. Mover o motor para fora do pod contraria a ADR 0047 e apaga as barreiras.

**Copiar os fontes dos pacotes para dentro do pod.** Cinco pacotes diretos e mais de vinte transitivos, um em C++, com licenças de três donos. E mataria uma barreira: a lista fechada de `.swift` do módulo (`SWIFT_DO_MODULO`) varre **todo** `mobile/modules/`, e centenas de fontes vendorizados a tornariam impossível de manter — que é como barreira morre.

**`.xcframework` vendorizado.** Um **dinâmico** exige um pacote-embrulho, `archive` com library evolution no grafo inteiro (que falha fácil com interop C++) e assinatura/embed no app. Um **estático** com Swift não tem forma canônica de carregar `.swiftmodule` num `.xcframework`. A casca fina entrega o mesmo isolamento com dois arquivos e nenhuma cerimônia — e a `.swiftinterface`, por ser texto, é auditável.

**Expor a casca com `@_exported import` ou com o tipo do pacote na assinatura.** Qualquer uma das duas devolve o pacote à interface, e com ele os vinte `.swiftmodule` de volta ao `SWIFT_INCLUDE_PATHS`. A assinatura da casca usa só `Foundation` e `FoundationModels` **de propósito**.
