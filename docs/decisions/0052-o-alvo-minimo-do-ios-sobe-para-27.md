# 0052 — O alvo mínimo do iOS sobe para 27, e o app deixa de instalar abaixo disso

**Status:** aceita
**Data:** 2026-09-21

## Contexto

A story 5.8 pôs **peso aberto** no aparelho: um modelo que não é o do sistema, escolhido por nós, rodando pelo Core AI. O código que transforma peso aberto em frase não vem no iOS — o `CoreAI` do SDK é runtime de tensores (entra `NDArray`, sai `NDArray`) — e mora no pacote Swift `apple/coreai-models`, BSD-3.

Três fatos do SDK, medidos nesta máquina em 21/09/2026 (macOS 27.0, Xcode 27.0 / 27A266a):

- O `Package.swift` do pacote declara `platforms: [.macOS("27.0"), .iOS("27.0")]`, e o fonte **não tem uma única anotação `@available`**. Toda a proteção de versão do pacote está no manifesto.
- O `CoreAI.framework` existe em `iPhoneOS27.0.sdk/System/Library/Frameworks/` e **não existe** em `iPhoneSimulator27.0.sdk`. O `FoundationModels` existe nos dois.
- O alvo do app era **16.4**, herdado do template do Expo (`podfile_properties['ios.deploymentTarget'] || '16.4'`).

O empacotamento escolhido ([ADR 0053](0053-biblioteca-de-terceiros-entra-como-binario-vendorizado.md)) compila o pacote fora do app e vendoriza o binário. **É aí que o problema nasce:** vendorizado, o manifesto sai do caminho. Sem `@available` no fonte e sem o manifesto, nada mais impede o app de chamar o Core AI num sistema que não o tem — e a falha seria em execução, no aparelho, não no build.

O `runtimeVersion` do app estava em 1.0.7, e o dono está no iOS 27 desde 15/09 ([ADR 0051](0051-o-app-adota-o-ciclo-por-cena-porque-o-sdk-27-o-exige.md), que já obrigou a um build próprio com o SDK 27).

## Decisão

**O alvo mínimo do iOS do app passa a ser 27.0.** Decisão do dono, em 21/09/2026, com o preço declarado: **o app deixa de instalar em qualquer iPhone abaixo do iOS 27**. Ele tem um iPhone, e ele está no 27.

O número é escrito por um config plugin nosso, `mobile/plugins/withAlvoMinimoIOS27.js`, porque `mobile/ios/` é gerado ([ADR 0012](0012-kingstinct-healthkit-devolve-o-prebuild.md)). Ele grava nos **dois** lugares que contam, e não em um:

- `ios/Podfile.properties.json` → `ios.deploymentTarget`, de onde sai o `platform :ios` do Podfile gerado e, com ele, o alvo de todos os pods;
- o `IPHONEOS_DEPLOYMENT_TARGET` de cada configuração do projeto gerado que já o declarava — só onde já existia, para não criar a chave onde o Xcode herda de outro lugar.

**O número é o mesmo em três arquivos, e há barreira comparando os três**: o plugin, o `s.platforms` do `OnDeviceEngine.podspec` e o `ALVO` de `scripts/coreai/montar.sh` (o alvo com que a biblioteca vendorizada e a `.swiftinterface` são compiladas). Divergir é calado e caro — um podspec em 26 com biblioteca em 27 dá *"module compiled for a newer version"* no meio de um build de vinte minutos; um plugin em 26 com podspec em 27 dá um app que instala onde o `CoreAI.framework` não existe.

**O simulador não perde nada que já tivesse.** Como o Core AI não está no SDK dele, o motor de peso aberto é compilado fora ali (`ORBE_COREAI` e o link são condicionais a `[sdk=iphoneos*]`) e aparece no seletor **indisponível, com motivo em palavras** — nunca some da lista. O modelo do sistema, que é do `FoundationModels`, continua como era.

Conferido em 21/09, depois do `expo prebuild`: `ios.deploymentTarget` em `27.0`, quatro ocorrências de `IPHONEOS_DEPLOYMENT_TARGET = 27.0` e nenhuma de `16.4` no projeto gerado, o pod `OnDeviceEngine` em 27.0, e `pnpm mobile:device --build-only` verde.

## Consequências

- **Um `runtimeVersion` novo (1.0.8), obrigatoriamente.** Mudança nativa: nenhum `eas update` feito com este JS pode chegar a um binário do 1.0.7.
- **Build próprio.** Como em toda mudança nativa deste projeto, o app tem de ser recompilado e reinstalado; não há caminho por OTA.
- **Os pods que declaravam menos continuam menos.** O `react_native_post_install` baixa vários pods para o mínimo suportado por eles (15.1), e isso é normal e não afeta nada: o que precisa de 27 é o pod da ponte, e ele está em 27.
- **O `#available` deixa de ser necessário no Core AI, e continua necessário no resto.** O `Engine.swift` (modelo do sistema) segue com as guardas de 26 e 27 que já tinha, porque a CLI da bancada o compila com alvo `macos26.0` de propósito — é ela que garante que todo símbolo do 27 esteja atrás de `#available`.

## Alternativas rejeitadas

**Manter 16.4 e pôr `@available(iOS 27)` em volta do nosso código.** Protege o nosso lado e não o do pacote: os fontes vendorizados não têm anotação nenhuma, e o `.a` já está compilado para 27. Um app com alvo 16.4 linkando uma biblioteca de 27 é um erro de link, não uma guarda.

**Vendorizar o pacote com alvo menor.** Não compila: o manifesto recusa, e forçar por `-target` deixaria o código do pacote sem a proteção de versão que ele delega ao manifesto — exatamente o buraco que esta ADR fecha.

**Linkar o `CoreAI.framework` de forma fraca e manter 16.4.** Resolveria o `dyld` (foi medido: `-weak_framework CoreAI` linka com `-platform_version ios 16.4 27.0`), mas não resolve o pacote: ele chama símbolos do 27 sem guarda, e o app quebraria ao tocar o botão num iPhone antigo, não ao abrir. Trocar um erro de instalação por um crash em uso é pior.

**Usar `expo-build-properties`.** Faria o mesmo com uma dependência npm a mais, para escrever um número. O repositório já resolve ajustes nativos com plugins escritos aqui (`withUISceneLifecycle`, `withCppModulemapFix`, `withDisableExplicitModules`, …); um plugin de trinta linhas é menos superfície que um pacote.
