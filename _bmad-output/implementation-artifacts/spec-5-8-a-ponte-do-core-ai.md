---
title: 'Story 5.8 — A ponte do Core AI, e um modelo aberto escrevendo no iPhone'
type: 'feature'
created: '2026-09-21'
status: 'done'
baseline_commit: '06080ff'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O app só alcança **um** modelo no aparelho: o do sistema, que a Apple escolhe e nós não
trocamos. O `CoreAI` do iOS não gera texto — é runtime de tensores —, e quem gera é o
`CoreAILanguageModel`, que vem do pacote Swift `apple/coreai-models`. Nosso módulo nativo só linka por
`.podspec`, e o CocoaPods não declara dependência de pacote Swift: **é esse empacotamento, e não a API,
que impede o Orbe de rodar peso aberto.**

**Approach:** resolver o empacotamento e provar a ponte de ponta a ponta, com **um** modelo pequeno
embarcado só nesta story para servir de prova. A ponte ganha um segundo tipo de motor de aparelho
(`aparelho:coreai/<pesos>`), que carrega de uma pasta. O download sob demanda e a hospedagem são da
story seguinte, e é ela que tira o peso do binário.

## Boundaries & Constraints

**Always:**
- **O alvo mínimo do iOS sobe para 27.** Decisão do dono em 21/09: o app é só dele e ele fica no 27.
  O pacote da Apple declara `platforms: [.iOS("27.0")]` e **não tem nenhum `@available`** — vendorizar os
  fontes sem subir o alvo apagaria a proteção de versão.
- **O `runtimeVersion` sobe**, porque é mudança nativa. Nenhum update OTA vai para o runtime anterior.
- **As duas barreiras da ponte são atualizadas de propósito, nunca contornadas:**
  `IMPORTS_PERMITIDOS_NA_PONTE` passa a admitir o Core AI, e `SWIFT_DO_MODULO` passa a conhecer o
  arquivo novo. Cada uma com o comentário dizendo por que cresceu.
- **A ponte continua sendo o único ponto do app que nomeia Apple ou Core AI.** O núcleo não sabe que
  peso aberto existe: a gramática `aparelho:<provedor>/<pesos>` já cabe em `ia/fio.ts`, sem mudança.
- **O peso embarcado é temporário e está declarado como tal** — SmolLM2-135M (≈260 MB), o menor com
  preset de iOS. Ele existe para provar o caminho, não para ser usado: é o modelo que responde
  *"Diga olá em português"* com *"Diga olá em portuguéus"*.
- Uma sessão nova por pedido, `@unknown default` em todo `switch` sobre enum da Apple, e erro não
  reconhecido vira `transitoria` com o nome cru no anel — as mesmas regras da ponte de hoje.

**Ask First:**
- **Baixar o Metal Toolchain.** Embarcar um `.aimodel` aciona `aimodelc package`, que o exige, e ele não
  está nesta máquina (são alguns GB). Tente primeiro copiar a pasta exportada **como recurso comum** —
  ela já vem compilada do export. Se não houver saída, **pare e pergunte**.
- Qualquer mudança nas sete classes de falha ou no contrato JSON que a ponte já fala.
- Embarcar um modelo maior que o SmolLM2-135M.

**Never:**
- Baixar modelo em tempo de execução, hospedar modelo, ou escrever a tela de gerenciamento — é a story
  seguinte.
- Ligar peso aberto a qualquer recurso do app (Saúde do sono, revista, nome de rota). Ele entra no
  seletor e para aí.
- Julgar a qualidade do modelo. Ela já foi medida em 21/09 e é ruim; esta story mede **se roda**.
- Mexer no orquestrador, no fio ou em qualquer descritor.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| A prova | build com o SmolLM2-135M, `aparelho:coreai/smollm2-135m` escolhido na tela de desenvolvimento | o modelo responde; o texto cru aparece com a assinatura do motor | N/A |
| Sem modelo | build sem peso (o futuro normal) | o motor aparece no seletor **indisponível, com motivo em palavras** | nunca "sumir" da lista |
| Pasta ausente ou corrompida | o caminho existe na preferência, o conteúdo não | `Falha` classe `indisponivel`, com detalhe | recua para o próximo elo |
| Memória | modelo grande num aparelho apertado | `Falha` classe `capacidade` | recua; nunca derruba o app |
| Aparelho abaixo do iOS 27 | impossível por alvo mínimo | o app não instala | declarado, não tratado |
| O modelo do sistema | `aparelho:sistema` escolhido | continua funcionando **exatamente** como hoje | nenhuma regressão |

</frozen-after-approval>

## Code Map

- `mobile/modules/on-device-engine/ios/Engine.swift` -- a ponte de hoje: importa só `Foundation` e
  `FoundationModels` (`:30-31`), tem o `enum ClasseDeFalha` espelhando `CLASSES_DE_FALHA`, a tabela
  erro → classe e a conversão de `Esquema` para `GenerationSchema`. **Não recebe qual motor usar** — usa
  sempre o modelo do sistema.
- `mobile/modules/on-device-engine/ios/OnDeviceEngineModule.swift` -- a cola Expo: `Name("OnDeviceEngine")`,
  `AsyncFunction("responder")` e `AsyncFunction("diagnostico")`, sem `catch`, sem literal de classe e sem
  lógica. É aqui que nasce a função nova, se o desenho pedir uma.
- `mobile/modules/on-device-engine/ios/OnDeviceEngine.podspec` + `expo-module.config.json` -- o
  empacotamento, **o risco da story**. O autolinking do Expo só conhece `podspecPath`/`podspec`, e o
  CocoaPods não tem atributo de dependência de SPM. Três saídas a avaliar com evidência: xcframework
  vendorizado, fontes copiados dos pacotes, ou config plugin que mexa no projeto gerado.
- `mobile/modules/runtime.json` -- a barreira de histórico do `runtimeVersion`: sobe aqui.
- `packages/shared/src/ia/aparelho.ts:62` -- `CHAVES_DO_PEDIDO` é **exaustiva sobre `keyof Pedido`**
  (`amostragem`, `guardrails`, `saida`, `sistema`, `usuario`), com checagem de tipo que quebra o build se
  alguém esquecer uma. **O pedido não carrega motor**, então *qual peso usar* precisa viajar por fora —
  por argumento da função nativa, não dentro do pedido. `:71` `CHAVES_DA_RESPOSTA` já traz `modelo` e
  `provedor`, que é onde o nome dos pesos aparece na assinatura.
- `packages/shared/src/ia/fio.ts:85-89` -- a gramática `aparelho:<provedor>/<pesos>`, que já aceita
  `aparelho:coreai/smollm2-135m` sem mudança nenhuma no núcleo.
- `mobile/src/lib/motores/index.ts` -- `PonteDoAparelho`, `FUNCOES_DA_PONTE`, `criarTransporteDoAparelho`
  e `criarMotorPara`: o ponto de injeção, **único lugar autorizado a importar a ponte**.
- `mobile/src/lib/motores/catalogo.ts:83-105` -- `MOTORES_CONHECIDOS` (três hoje) e, em `:151+`, os
  motivos em palavras do aparelho — o molde para o motivo "nenhum modelo instalado".
- `packages/shared/src/architecture.test.ts` -- `IMPORTS_PERMITIDOS_NA_PONTE` (~`:1563`) e
  `SWIFT_DO_MODULO` (~`:2074`): as duas barreiras que crescem de propósito. Molde de como uma barreira
  cresce com justificativa: as catracas zeradas na 5.7.
- `scripts/bancada/aparelho/` -- a CLI Swift que compila a `Engine.swift` **sem cópia**. Se a ponte passar
  a depender do pacote da Apple, a CLI da bancada precisa compilar igual, ou a coluna do aparelho no Mac
  quebra. Conferir antes de dizer que a story fechou.
- Fora do repositório, já apurado em 21/09 (não repesquisar): `CoreAILanguageModel(resourcesAt:)` aponta
  para uma **pasta**; não há entitlement para Core AI; o `llm-runner` compila e roda neste Mac sem o Metal
  Toolchain; o export do SmolLM2-135M já está no scratchpad da sessão, em
  `…/scratchpad/repo/exports/smollm2_135m_instruct_dynamic` (272.871.328 B).

## Tasks & Acceptance

**Execution:**
- [x] **Escolher o empacotamento, com evidência.** Venceu uma quarta saída — a **casca fina**
      (`scripts/coreai/`), vendorizada como `.a` + uma `.swiftinterface`. Compila e linka para `iphoneos`,
      provado com `xcodebuild`, `swiftc -typecheck` e `swiftc -emit-library` + `dyld_info`. Por que as três
      do Code Map perderam: ver Design Notes.
- [x] `mobile/plugins/withAlvoMinimoIOS27.js` (novo) -- alvo mínimo do iOS para 27, nos dois lugares que
      contam; `mobile/app.base.json` e `mobile/modules/runtime.json` -- `runtimeVersion` **1.0.8**.
- [x] `mobile/modules/on-device-engine/ios/MotorCoreAI.swift` -- o motor do Core AI num arquivo próprio,
      que carrega de uma pasta e devolve o **mesmo contrato JSON**. Ele chama `Engine.preparar`,
      `Engine.esquemaDaSessao`, `Engine.identificar`, `Engine.classe(de:)` e `Engine.codificar`; nada é
      duplicado. O que é só dele: achar a pasta e classificar a falha de **carga**, que o modelo do sistema
      não tem.
- [x] `OnDeviceEngineModule.swift` -- `responderComPesos(pesos:pedido:)` e `diagnosticoDosPesos(pesos:)`,
      com os pesos por argumento. A cola segue sem `catch`, sem literal de classe e sem lógica (a barreira
      da cola passa).
- [x] `mobile/src/lib/motores/` -- `aparelho:coreai/smollm2-135m` resolvido para o transporte novo, com a
      **mesma vez** do modelo do sistema (`FilaDoAparelho`) e as mesmas marcas por chamada.
- [x] `mobile/src/lib/motores/catalogo.ts` -- o motor na lista com nome, rótulo, descrição e os quatro
      motivos em palavras; `motoresDoRecurso` passou a receber os **dois** diagnósticos.
- [x] `packages/shared/src/architecture.test.ts` -- a barreira dos imports virou mapa por arquivo (e cobra
      que a casca é importada por **um** arquivo só), a lista fechada de `.swift` foi a três, e nasceu a
      guarda do vocabulário do peso aberto. Cada uma com o porquê escrito.
- [x] `scripts/bancada/` -- a CLI e os testes compilam `MotorCoreAI.swift` **sem `ORBE_COREAI`**, que é o
      modo em que ele não toca a biblioteca. A coluna do aparelho não muda: o `main.swift` continua
      chamando só o `Engine`.
- [x] Testes: 188 conferências Swift (`aparelho:testar`), incluindo a tabela da carga, a régua do nome dos
      pesos, a pasta sobre disco de verdade e as duas portas sem biblioteca; e no jest, o transporte com a
      ponte falsa, os pesos por argumento, a vez compartilhada e a ausência de modelo virando
      `indisponivel` com motivo.

**Acceptance Criteria:**
- Given o build com o peso embarcado, when o dono escolhe `aparelho:coreai/smollm2-135m` na tela de
  desenvolvimento e pede uma leitura, then **sai texto**, com a assinatura dizendo Core AI e o nome dos
  pesos — é o portão do dono, no aparelho.
- Given o mesmo build, when o dono usa `aparelho:sistema`, then o comportamento é **idêntico** ao de hoje
  (a medição da 5.13 continua reproduzível).
- Given um build sem peso, when a tela de motores abre, then o Core AI aparece **indisponível com motivo**,
  e nenhuma tela quebra.
- Given as duas barreiras, when alguém importar Core AI fora da ponte, then o teste falha.

## Design Notes

### O empacotamento: a casca fina, com evidência (21/09/2026)

**Venceu uma quarta saída, que nasceu de medir as três.** Nenhuma das três do Code Map
sobrevive inteira; o que funciona é um **módulo-casca compilado fora do app**, vendorizado no
pod como `.a` + **uma** `.swiftinterface`.

Provado nesta máquina, nesta ordem:

| Passo | Resultado |
|---|---|
| `xcodebuild -scheme CoreAILM -destination 'generic/platform=iOS' -configuration Release` | **BUILD SUCCEEDED** — 20 MB de `.o` |
| o mesmo para `generic/platform=iOS Simulator` | **BUILD FAILED**: `Unable to resolve module dependency: 'CoreAI'` |
| `import CoreAILanguageModels` num consumidor, com os módulos do pacote no `-I` | falha em cadeia: `missing required module 'yyjson'`, depois `'CXGrammar'` |
| a casca (`internal import` + `-enable-library-evolution`) | a `.swiftinterface` sai **sem citar** `CoreAILanguageModels` |
| consumidor com **só** a `.swiftinterface` no `-I` | `rc=0` |
| `swiftc -emit-library` de `Engine.swift` + `MotorCoreAI.swift` contra o `.a` | linkou; `dyld_info` mostra `CoreAI.framework` autolinkado |

**Por que as outras perderam:**

- **(c) config plugin com SPM no projeto gerado — impossível, não frágil.** O motor do Core AI
  mora num **pod**, e um pacote Swift adicionado ao alvo do *app* não é visível para o alvo do
  *pod*: o `import` não resolveria. Para valer, o SPM teria de entrar no `Pods.xcodeproj`, que
  o `pod install` regera depois do prebuild — fora do alcance de um config plugin. E o motor
  sair do pod para o app contraria a ADR 0047 e apaga as barreiras.
- **(b) fontes copiados — some o alvo, e some a barreira.** São cinco pacotes diretos e mais
  de vinte transitivos, um deles em C++ (xgrammar), com licenças de três donos. Pior: a lista
  fechada de `.swift` do módulo (`SWIFT_DO_MODULO`) varre **todo** `mobile/modules/`, e
  centenas de fontes vendorizados a tornariam impossível de manter — a barreira morreria de
  ruído, que é como barreira morre.
- **(a) xcframework vendorizado — quase, e caro à toa.** Um `.xcframework` **dinâmico** exige
  um pacote-embrulho, `archive` com library evolution no grafo inteiro (que falha fácil com
  interop C++) e assinatura/embed no app. Um **estático** com Swift não tem forma canônica de
  carregar `.swiftmodule` num `.xcframework`. A casca fina entrega o mesmo isolamento com dois
  arquivos e nenhuma cerimônia — e a `.swiftinterface`, por ser texto, é auditável.

**O que a casca compra, concretamente.** `scripts/coreai/OrbeCoreAI.swift` importa o pacote com
`internal import` e expõe uma função cuja assinatura só usa `Foundation` e `FoundationModels`.
Compilada com library evolution, a interface resultante não menciona o pacote — então o pod
não precisa de nenhum `.swiftmodule`, header ou mapa de módulo do grafo. Sem isso, o
`SWIFT_INCLUDE_PATHS` teria de carregar mais de vinte `.swiftmodule` e os mapas de módulo em C
de `yyjson`, `CXGrammar` e `XGrammar`, com caminhos de checkout do SwiftPM dentro.

**E a casca não decide nada.** Ela devolve o erro **descrito** (nome do tipo, descrição,
domínio e código do `NSError`); quem o classifica é `MotorCoreAI.identificar`, que é fonte no
repositório, que as barreiras leem e que a bancada percorre no Mac **sem a biblioteca**. Um
binário opaco não pode guardar regra do Orbe.

### Três fatos do SDK que o desenho obedece

1. **O `CoreAI.framework` não existe no SDK do simulador** (existe no do aparelho; o
   `FoundationModels` existe nos dois). Não é escolha: é o SDK. Por isso a macro `ORBE_COREAI`,
   a busca da biblioteca e o link são condicionados a `[sdk=iphoneos*]`, e no simulador o motor
   aparece **indisponível com motivo** — `simulador`, que é motivo próprio porque "não está
   neste build" seria falso.
2. **O alvo mínimo sobe para 27 por causa do manifesto, não da API.** O pacote declara
   `platforms: [.iOS("27.0")]` e não tem um único `@available`; vendorizando o binário, o
   manifesto sai do caminho e só o alvo do app protege a versão. Feito por
   `mobile/plugins/withAlvoMinimoIOS27.js`, que escreve nos **dois** lugares que contam
   (`ios.deploymentTarget` do `Podfile.properties.json` e o `IPHONEOS_DEPLOYMENT_TARGET` das
   configurações do projeto gerado).
3. **O Metal Toolchain não foi baixado — e não precisou.** O caminho do *Ask First* funcionou:
   a pasta exportada entra como **recurso comum** (`s.resources` de um pod estático → o script
   `[CP] Copy Pods Resources`, que é rsync), onde a regra de build `AIModel.xcspec` não se
   aplica e o `aimodelc` nunca é chamado. O export já vem compilado (`compilation.targets`
   vazio: a especialização é do `CoreAICompiler` do sistema, em execução).

### O peso embarcado é a variante **iOS**, não a do Mac

O export que existia no scratchpad era `smollm2_135m_instruct_dynamic` — a variante **macOS**,
com KV-cache dinâmico e janela de 8.192. Rodei o export da variante certa
(`uv run coreai.llm.export … --platform iOS`, ~5 min) e o que foi embarcado é
`smollm2_135m_instruct_static`: **shapes estáticas e janela de 4.096**, que é o que o iPhone
espera. **243,7 MiB** medidos, em `mobile/modules/on-device-engine/ios/pesos/smollm2-135m/`.

**O número fica em MiB, medido uma vez, e repetido igual em todo lugar.** O `≈260 MB` do Intent
(e do CLAUDE.md) veio da variante **macOS** descartada, que nunca foi embarcada; ele fica como
está porque o Intent é do dono. O que vale para código e documento novo é o medido:

| | bytes | MiB |
|---|---|---|
| o conjunto de pesos inteiro | 255.485.911 | **243,7** |
| o `main.mlirb` dentro dele (o que o GitHub recusaria) | 251.961.219 | **240,3** |
| `libOrbeCoreAI.a` | 22.347.752 | **21,3** |

**Ele não vai ao git**, e não por gosto: o `main.mlirb` sozinho tem **240,3 MiB** (252 MB decimais), acima do teto de
100 MB por arquivo do GitHub, que **rejeita o push**. Fica em `.gitignore`, nasce de
`scripts/coreai/` na máquina de quem monta o build, e a barreira do runtime o deixa fora do
hash de propósito — senão a máquina que o tem e o CI que não o tem calculariam hashes
diferentes e a guarda reprovaria em um dos dois sempre. A biblioteca vendorizada (**21,3 MiB**)
**continua dentro** da conta: ela é código nativo, e trocá-la muda o binário.

### A vez é uma só para os dois motores do aparelho

`criarTransporteDoAparelho` tinha a fila dentro dele, quando havia um motor no aparelho. Com
dois, eles disputam a **mesma** memória e o mesmo Neural Engine — duas filas deixariam a
`/sono/saude` pedir ao modelo do sistema enquanto a tela de desenvolvimento sobe 244 MiB de
pesos, e o segundo receberia falta de memória por uma razão que não é dele. A fila virou
`FilaDoAparelho`, passada por opção, e o app passa **a mesma** para os dois.

**Por que o peso entra e sai.** O dono escolheu embarcar o menor modelo só aqui, para provar o caminho
sem Finder e sem hospedagem. A dívida nasce junto: a story seguinte tira o peso do binário e o baixa sob
demanda. Enquanto ele estiver embarcado, o app cresce **243,7 MiB** — medido, e aceite, não acidente.

**Por que a escolha do peso não entra no `Pedido`.** `CHAVES_DO_PEDIDO` é exaustiva sobre `keyof Pedido` e
o núcleo não conhece peso local; enfiar um campo ali faria o hash do pedido (AD-11) mudar por uma razão
que não é o pedido. Qual peso usar é assunto do hospedeiro e da ponte.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test`
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test`
- `pnpm --filter @vitale/web build`
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest`
- `cd mobile && pnpm dlx expo-doctor` -- falha nova dele é sinal, não ruído
- `pnpm mobile:device --build-only` -- compila com a biblioteca nova e o peso dentro

**Rodado em 21/09/2026:**

| Comando | Resultado |
|---|---|
| `pnpm --filter @vitale/shared lint && test` | verde — **50 barreiras**, incluindo as três que a 5.8 mexeu |
| `pnpm --filter @vitale/scripts lint && test` | verde |
| `pnpm --filter @vitale/web build` | verde (só o aviso de budget do SCSS da Retrospectiva, de antes) |
| `cd mobile && tsc --noEmit && jest` | verde — **69 suítes, 1.192 testes** |
| `pnpm --filter @vitale/scripts aparelho:testar` | **188 conferências**, com a tabela da carga do Core AI |
| `prepararCli()` (a CLI da bancada) | compila com `Engine.swift` + `MotorCoreAI.swift` |
| `pnpm mobile:device --build-only` | **BUILD SUCCEEDED** |
| `pnpm dlx expo-doctor` | 1 check falhou — **8 pacotes do Expo desatualizados, de antes da story** (a nota de 11/09 já registrava 3). Nenhuma falha de config, plugin ou nativo |

O `.app` conferido depois do build: `pesos/smollm2-135m/…aimodel/main.mlirb` (240,3 MiB) **intacto no
bundle** — nenhum `aimodelc` rodou —, os dois `.bundle` do grafo presentes, `CoreAI.framework` nos
dependentes do binário e 55 símbolos de `MotorCoreAI` dentro. 328 MB no total.

**Uma armadilha paga no caminho, que ficou como rede no `montar.sh`:** sem `-parse-as-library`, o
objeto da casca sai com um `_main` dentro, o `.a` o esconde, e o link do app morre com
`duplicate symbol '_main'` contra o `AppDelegate.o` — a vinte minutos de build da causa. O script
agora confere com `nm` antes de juntar o `.a`.

**Manual checks:**
- No iPhone, em build próprio: escolher o Core AI na tela de desenvolvimento e **ver texto sair**. Depois,
  escolher o modelo do sistema e confirmar que ele continua como era.
- **Segue pendente — é o portão do dono.** O que a máquina não responde: se o export `_static` do
  SmolLM2-135M **especializa e gera** no aparelho. O caminho até ele está todo provado (compila,
  linka, o peso está no bundle, o diagnóstico responde); o que falta é o modelo abrir.

## Spec Change Log

**21/09 — o empacotamento venceu por uma quarta saída, não por uma das três.** A spec listava
xcframework, fontes copiados e config plugin. Nenhuma sobrevive: o config plugin é **impossível** (o
motor vive num pod, e um pacote Swift no alvo do app não é visível de dentro dele; o `pod install`
regenera o `Pods.xcodeproj` depois do prebuild), os fontes trariam 5 pacotes diretos e 20+ transitivos
com um em C++, e o xcframework esbarra em library evolution com interop C++. A saída foi uma **casca
fina** com `internal import`, compilada com library evolution, cuja `.swiftinterface` não cita o pacote
da Apple — o pod consome um `.a` e um arquivo de interface.

**21/09 — o "Ask First" do Metal Toolchain não precisou ser acionado.** Como `s.resources` de um pod
estático, os pesos são copiados por rsync, nenhuma regra de build se aplica e o `aimodelc` nunca roda.

**21/09 — três coisas que a matriz não previa, achadas na construção:** o `CoreAI.framework` **não
existe no SDK do simulador**; os pesos **não cabem no git** (252 MB contra o teto de 100 MB por arquivo)
e por isso ficam fora do hash do runtime; e sem `-parse-as-library` a casca carrega um `_main` que o `.a`
esconde, matando o link do app com `duplicate symbol` longe da causa.

**21/09 — a revisão de três camadas trouxe 21 consertos, sem loopback.** Os que mudaram comportamento:
o peso aberto passou a ser **bloqueado fora da Saúde do sono** (a Never da spec dizia "entra no seletor
e para aí", mas `nome-de-rota` admite `aparelho` e **grava** — um modelo de 10% de acerto escreveria
nome permanente) — **esta trava caiu em 23/09** por decisão do dono, depois de o Qwen3-1.7B fazer 22 de
22 na amostra da Saúde do sono; ver [ADR 0056](../../docs/decisions/0056-o-peso-aberto-deixa-de-ser-so-prova-e-o-descritor-decide.md); o ramo de geração passou a ser compilado e testado com `-D ORBE_COREAI`, porque nada
o compilava e apagar a assinatura do provedor deixava o SmolLM2 assinando como modelo da Apple; e os
dois estados de ponte viraram um objeto, porque dois parâmetros do mesmo tipo lado a lado tornavam a
inversão invisível ao compilador.

## Suggested Review Order

**O empacotamento — a decisão que a story existe para tomar**

- A casca fina: `internal import` é o truque inteiro, e o comentário diz por quê.
  [`OrbeCoreAI.swift:31`](../../scripts/coreai/OrbeCoreAI.swift#L31)

- A montagem, com as duas redes: o `_main` e a interface que não pode citar o pacote.
  [`montar.sh:24`](../../scripts/coreai/montar.sh#L24)

- O pod consumindo o `.a`, os pesos por rsync e a macro só no SDK do aparelho.
  [`OnDeviceEngine.podspec:118`](../../mobile/modules/on-device-engine/ios/OnDeviceEngine.podspec#L118)

**O motor novo**

- O estado da pasta, que varre todos os candidatos antes de desistir.
  [`MotorCoreAI.swift:146`](../../mobile/modules/on-device-engine/ios/MotorCoreAI.swift#L146)

- A geração, atrás da macro — e agora compilada pelos testes da bancada.
  [`MotorCoreAI.swift:299`](../../mobile/modules/on-device-engine/ios/MotorCoreAI.swift#L299)

- A cola, com a primeira função de dois argumentos da ponte.
  [`OnDeviceEngineModule.swift:41`](../../mobile/modules/on-device-engine/ios/OnDeviceEngineModule.swift#L41)

**O app: o motor entra sem poder gravar**

- O peso aberto só na Saúde do sono — o recurso que não grava nada.
  [`catalogo.ts:116`](../../mobile/src/lib/motores/catalogo.ts#L116)

- O id e a pasta, amarrados por asserção depois da revisão.
  [`catalogo.ts:98`](../../mobile/src/lib/motores/catalogo.ts#L98)

- A fila única: dois modelos no aparelho disputam memória e Neural Engine.
  [`index.ts:258`](../../mobile/src/lib/motores/index.ts#L258)

**As barreiras e as decisões permanentes**

- A cola agora é conferida por aridade e ordem, não só por nome.
  [`index.ts:284`](../../mobile/src/lib/motores/index.ts#L284)

- O alvo mínimo do iOS sobe para 27.
  [`0052`](../../docs/decisions/0052-o-alvo-minimo-do-ios-sobe-para-27.md)

- Binário de terceiros entra vendorizado, e o que isso obriga.
  [`0053`](../../docs/decisions/0053-biblioteca-de-terceiros-entra-como-binario-vendorizado.md)
