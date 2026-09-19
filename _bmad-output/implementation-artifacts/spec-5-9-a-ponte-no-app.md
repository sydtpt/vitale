---
title: 'Story 5.9 — A ponte no app: o modelo do aparelho no iPhone, e a escolha em Configurações'
type: 'feature'
created: '2026-09-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: '164c6397945686ecc376e401e64291275d3c0eb4'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-10-a-coluna-do-aparelho-na-bancada.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-5-o-botao-ler-e-a-escolha-do-motor-marco-a.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O `Engine.swift` existe (5.10) e mede no Mac, mas no iPhone o modelo do aparelho é um item apagado em `/configuracoes/motores` — "a ponte ainda não existe neste build". O dono não sabe **que modelo o aparelho dele tem** (a variante AFM 3 Core ou Core Advanced, a janela), nem pode escolhê-lo e apertar "Ler". O foco do Épico 5 é essa ponte; a Saúde do sono é só o recurso de teste.

**Approach:** O `Engine.swift` vira um módulo Expo local com uma cola sem lógica; o ponto de injeção do app o carrega por `requireOptionalNativeModule` e passa a entregar motor para `aparelho:sistema`. A ponte ganha um **diagnóstico** — disponível ou por quê não, variante e janela —, que o seletor mostra numa linha simples. O `runtimeVersion` sobe e o build é próprio. O pedido da Saúde continua o **v1**. No mesmo build vai um **teste descartável do Private Cloud Compute** na tela de desenvolvimento, para o próprio iPhone dizer se o dono tem acesso a ele (do Mac, ele recusou com 1046).

## Boundaries & Constraints

**Always:**
- **A cola não tem lógica:** `OnDeviceEngineModule.swift` só declara `Name("OnDeviceEngine")` e `AsyncFunction` que repassam — duas ao `Engine` (`responder(pedido) -> String` e `diagnostico() -> String`) e uma ao experimento do PCC (abaixo). Sem `catch`, sem literal de classe, sem decisão — a barreira nova cobra.
- **O diagnóstico mora no `Engine.swift`**, como função pura sobre o SDK, e sai em JSON: `{disponivel, motivo?, variante?, janela?, plataforma, buildDoSistema}`. `motivo` é um dos três de `UnavailableReason` (ou o do `@unknown default`); `variante` é o `displayName` (só iOS/macOS 27, atrás de `#if compiler(>=6.4)` + `#available`); `janela` é `contextSize`. O mesmo contrato de campos entre Swift e TS da 5.10 passa a cobrir o diagnóstico.
- A **resposta** passa a levar a variante em `modelo` quando ela existir (senão continua `system-language-model`), para a assinatura e a bancada dizerem qual modelo escreveu.
- **Só `mobile/src/lib/motores/` carrega o módulo**, e o módulo se chama `OnDeviceEngine` (é o nome que a guarda (1) reconhece). Sem módulo — build velho, simulador, teste —, o aparelho é `indisponivel`, nunca exceção.
- **O aparelho atende um pedido por vez** (fila própria) e tem prazo: estourou, `transitoria` — o mesmo contrato da nuvem.
- **A disponibilidade do aparelho no seletor é a do diagnóstico**, lida uma vez por sessão; o motivo sai em palavras: aparelho não elegível, Apple Intelligence desligada, modelo ainda não pronto, ponte ausente neste build.
- **A linha de detalhe é simples** e segue o estilo que a tela já usa na linha do motivo: `AFM 3 Core Advanced · janela de 8.192 tokens`. O dono revisa a tela com UX depois — nada de desenho novo agora.
- **`runtimeVersion` sobe** (1.0.5 → 1.0.6): nenhum update com código da ponte vai para o runtime anterior.
- O app continua abrindo em iOS abaixo do 26 (o alvo é 16.4): o `FoundationModels` é ligado de forma fraca.
- **O teste do PCC é experimento, isolado e descartável** (exceção à AD-3 decidida pelo dono em 19/09): mora num arquivo Swift **separado** do `Engine.swift` (`ExperimentoDoPCC.swift`), exposto pela cola como uma terceira `AsyncFunction` que só repassa, e chamado **só** por um botão na tela de desenvolvimento. Manda um texto fixo e neutro ("Diga olá.") — **nunca dado de saúde** — e mostra cru o que voltou: disponibilidade, cota, resposta ou o erro com o código. Não vira motor, não entra no catálogo nem no seletor, e o arquivo e o botão levam no comentário que são para apagar ou promover depois do veredito.

**Ask First:**
- Mudar a assinatura de `Motor`, `Pedido`, `Resposta`, o orquestrador ou o pedido da Saúde.
- Qualquer mudança visual além da linha de detalhe; publicar `eas update`.
- Subir teto de guarda ou abrir exceção em lista de liberação.

**Never:**
- Private Cloud Compute como motor, ou pesos abertos (a 5.8) — nenhum modelo além do sistema **escreve** leitura; o PCC só aparece no teste descartável.
- `index.ts` ou qualquer `.ts` dentro de `mobile/modules/` (seria porta fora da vista da guarda).
- O pedido v2 da 5.11; migração; build compartilhado com outra story.

## I/O & Edge-Case Matrix

| Cenário | Estado | Esperado | Erro |
|---|---|---|---|
| Aparelho pronto | iPhone com Apple Intelligence e o módulo | seletor mostra "Modelo do aparelho" disponível com `variante · janela`; escolhê-lo e apertar "Ler" traz a frase do aparelho ou o piso com o motivo | N/A |
| Apple Intelligence desligada | diagnóstico `appleIntelligenceNotEnabled` | aparelho apagado com o motivo em palavras | não selecionável |
| Modelo não pronto / não elegível | idem | idem, cada um com a sua frase | não selecionável |
| Módulo ausente | build sem a ponte, jest, simulador | `requireOptionalNativeModule` devolve `null`; aparelho apagado, "a ponte não está neste build"; `motorPara` → `undefined` | nunca exceção |
| Diagnóstico ilegível | JSON fora do contrato | tratado como indisponível, com o motivo "o aparelho não respondeu como esperado" | nunca exceção |
| Pedido demora | sem resposta no prazo | `transitoria`; a leitura cai no piso | N/A |
| Dois pedidos juntos | toque repetido em janelas diferentes | o segundo espera o primeiro (fila do aparelho) | N/A |
| Retrospectiva | recurso que grava | aparelho continua barrado por `admite` — nada muda | N/A |
| Teste do PCC | botão na tela de desenvolvimento | mostra disponibilidade, cota e a resposta a "Diga olá." ou o erro com código | erro é resultado, nunca exceção na tela |

</frozen-after-approval>

## Code Map

- `mobile/modules/on-device-engine/ios/Engine.swift` — `enum Engine` (273, `internal`: a cola tem de estar **no mesmo pod**); `responder(_:) async -> String` (284-286, nunca lança); `executar` (288); `SaidaDaPonte` (253); `codificar` (704-717); disponibilidade em `gerar` (458-460) e `identificador(de:)` (530-538); `contextSize` (470); `resposta(_:tokens:rastro:)` (512-525) com `modelo` fixo em `"system-language-model"` (277); `plataforma()` (722) e `buildDoSistema()` (736). `variant` ainda não é lido.
- `scripts/bancada/aparelho/main.swift:44` — `await Engine.responder(...)`: o molde da cola. A CLI compila `Engine.swift` direto; a cola **não** entra nela.
- Expo SDK 57 local module: autolinking varre `mobile/modules/` (`expo-modules-autolinking/src/commands/autolinkingOptions.ts:277-281`), exige `expo-module.config.json` (`findModules.ts:13-47`) e **um `.podspec` num subdiretório** (`platforms/apple/apple.ts:36-65`) — sem ele não linka e nada avisa. `package.json` não é obrigatório. Molde de config: `expo-glass-effect` (`{"platforms":["apple"],"apple":{"modules":["GlassEffectModule"]}}`); molde de podspec: `ExpoGlassEffect.podspec` (`dependency 'ExpoModulesCore'`, `static_framework = true`, `source_files`); molde de módulo: `expo-haptics/ios/HapticsModule.swift`; `AsyncFunction` com `async`: `expo-modules-core/ios/Api/Factories/ConcurrentFunctionFactories.swift:20-31`. `requireOptionalNativeModule` vem de `'expo'` e devolve `null` sem lançar (também no jest-expo).
- `packages/shared/src/ia/aparelho.ts` — `TransporteDoAparelho` (32), `pedidoParaAPonte` (47), listas de chaves (58-71), `traduzirDoAparelho` (130), `criarMotorDoAparelho` (179, já converte exceção em `transitoria`). O leitor puro do diagnóstico nasce aqui.
- `mobile/src/lib/motores/index.ts` — `criarMotorPara` (236-252; a recusa do aparelho na **244**), `motorPara` (258), `serializar` (202-215, tipada para o transporte da nuvem), `PRAZO_MS` (70), `catalogoDoRecurso` (410). Comentário do marco B: 231-234.
- `mobile/src/lib/motores/catalogo.ts` — `MOTORES_CONHECIDOS` (54-77; o aparelho estático e indisponível em 62-69), `motoresDoRecurso` (200), `motorDisponivel` (239), `nomeDoMotor` (272), `HOSPEDAGEM` (306), `motivoDeBloqueio` (347-366). O arquivo é puro: o estado da ponte entra por parâmetro, lido em `index.ts`.
- `mobile/src/app/configuracoes/motores/index.tsx` — laço por recurso (136-161), `LinhaDoMotor` (192-228: `name` 217, `sub` 218, `motivo` 219; estilos 251-255); efeito com `vivo` (69-83) é o molde da leitura assíncrona. Comentário do marco B: 33-36. `bancada.tsx:295-300` mostra `provedor · modelo`.
- `mobile/app.base.json:10` `runtimeVersion` "1.0.5" (único lugar). `mobile/scripts/ios-device.sh:84-107` — o bump do `app.base.json` dispara prebuild; usar `--prebuild` por segurança. Alvo iOS 16.4 (`ios/Podfile:25`).
- `packages/shared/src/architecture.test.ts` — `walk` só `.ts/.tsx` (47-61), `mobileFiles` só `mobile/src` (64); guarda (1) `PONTOS_DE_INJECAO` (2223), `IMPORTA_A_PONTE` (2236-2244, reconhece `'OnDeviceEngine'`); `ENGINE_SWIFT` (1551), guardas (3) 1749 e (4) 1766, contrato do fio 1883 — **nenhuma olha a cola**.
- Testes que mudam: `mobile/src/lib/__tests__/motores-catalogo.test.ts:50-60, 107-113`; `motores-porta.test.ts:226-229`. Continuam valendo: `motores-catalogo.test.ts:43-48, 115-129`.
- Comentários a atualizar: `index.ts:231-234`, `catalogo.ts:9-12`, `index.tsx:33-36`, `mobile/AGENTS.md:48`.

## Tasks & Acceptance

**Execution:**
- [ ] `mobile/modules/on-device-engine/expo-module.config.json`, `ios/OnDeviceEngine.podspec`, `ios/OnDeviceEngineModule.swift` — o módulo, com o `FoundationModels` fraco.
- [ ] `mobile/modules/on-device-engine/ios/Engine.swift` — `diagnostico()` e a variante em `modelo`; `scripts/bancada/aparelho/testes.swift` cobre o diagnóstico.
- [ ] `packages/shared/src/ia/aparelho.ts` + teste — `lerDiagnosticoDoAparelho(json)` puro, com as chaves exportadas.
- [ ] `packages/shared/src/architecture.test.ts` — o contrato de campos cobre o diagnóstico; barreira da cola (sem `catch`, sem literal de classe, `Name("OnDeviceEngine")`, só `import ExpoModulesCore`); nenhum `.ts` em `mobile/modules/`.
- [ ] `mobile/src/lib/motores/index.ts` + `catalogo.ts` + testes — o módulo carregado uma vez, o transporte do aparelho com fila e prazo, `motorPara` do aparelho, o diagnóstico em cache de sessão, o aparelho dinâmico no catálogo com motivo em palavras e a linha de detalhe.
- [ ] `mobile/src/app/configuracoes/motores/index.tsx` — a linha de detalhe e o motivo vindos do diagnóstico.
- [ ] `mobile/modules/on-device-engine/ios/ExperimentoDoPCC.swift` + a terceira função da cola + um botão em `mobile/src/app/configuracoes/motores/bancada.tsx` — o teste descartável do PCC; a barreira da cola continua valendo (ela só repassa), e a guarda (4) continua olhando só o `Engine.swift`.
- [ ] `mobile/app.base.json` — `runtimeVersion` 1.0.6. `mobile/AGENTS.md` — a regra da cola e do nome do módulo.
- [ ] Build Release próprio (`pnpm mobile:device --build-only --prebuild`), da branch, conferindo que o módulo linkou (o `OnDeviceEngine` no provider gerado) — a instalação no iPhone é do dono.

**Acceptance Criteria:**
- Given o build instalado no iPhone, when o dono abre Configurações → Motores, then vê o modelo do aparelho disponível (ou o porquê), com a variante e a janela — é a resposta a "que modelo eu tenho".
- Given o modelo do aparelho escolhido para a Saúde do sono, when ele aperta "Ler", then a assinatura diz que o aparelho escreveu (com a variante) ou por que caiu no template; e a tela de desenvolvimento mostra o texto cru do aparelho ao lado da nuvem.
- Given a tela de desenvolvimento, when o dono toca "Testar Private Cloud Compute", then vê se o iPhone dele tem acesso ao PCC — a resposta ou o erro com código —, e é isso que decide se a 5.12 volta.
- Given a suíte da máquina, when roda, then passa, com as barreiras novas verdes e o app compilando no jest sem o módulo nativo.

## Spec Change Log

## Design Notes

**Por que a cola não pode pensar:** a AD-3 diz que a ponte é o único lugar que nomeia a Apple e que a tradução mora no `Engine.swift`, com teste. Uma cola com `catch` ou com decisão seria uma segunda tabela, fora do teste e fora da CLI — a bancada mediria uma coisa e o iPhone faria outra.

**Por que o pedido fica o v1:** a nuvem está aprovada com ele (ADR 0050). A 5.11 mostrou que a v2 faz o modelo pequeno copiar o exemplo; o dono quer primeiro ver o modelo **do iPhone** — que pode ser a variante *Advanced* — com o pedido de sempre, na tela de desenvolvimento, lado a lado com a nuvem.

**Por que o PCC entra só como teste:** do Mac ele se anuncia `available` e recusa o pedido (`ModelManagerError 1046`); a pesquisa de 09/09 diz que o acesso é de app publicado no Small Business Program. O build da 5.9 já vai acontecer, então o próprio iPhone responde com prova em vez de suposição. A AD-3 proíbe a ponte de tocar modelo de servidor para que nenhum dado saia por ela; o experimento respeita o motivo da regra — texto fixo, sem dado — e fica fora do `Engine.swift`, que é o que as guardas (3) e (4) cobrem.

**Fora desta story, registrados:** a amostra automática de 20 pedidos que compara iPhone e Mac por hash (AD-11) — por ora a tela de desenvolvimento mostra o hash de cada medição, e a comparação é à mão; a revisão de UX da tela de motores pelo dono; os pesos abertos (5.8).

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test`
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test && pnpm --filter @vitale/scripts aparelho:testar`
- `pnpm --filter @vitale/web build`
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest`
- `pnpm mobile:device --build-only --prebuild` — build Release próprio; o provider gerado lista o `OnDeviceEngine`.

**Manual checks:**
- No iPhone: Configurações → Motores mostra a variante e a janela; escolher o aparelho e apertar "Ler" na Saúde do sono; comparar na tela de desenvolvimento — **portão do dono**.

## Suggested Review Order

**A ponte — o que o iPhone passa a responder**

- O diagnóstico: disponível ou por quê, a variante e a janela, numa linha JSON.
  [`Engine.swift:330`](../../mobile/modules/on-device-engine/ios/Engine.swift#L330)

- A variante lida do SDK, aparada, e o nome genérico quando ela não existe.
  [`Engine.swift:376`](../../mobile/modules/on-device-engine/ios/Engine.swift#L376)

- A cola do Expo: o nome que a guarda reconhece e três funções que só repassam.
  [`OnDeviceEngineModule.swift:21`](../../mobile/modules/on-device-engine/ios/OnDeviceEngineModule.swift#L21)

- O experimento do PCC, isolado, com o único texto que ele pode mandar.
  [`ExperimentoDoPCC.swift:23`](../../mobile/modules/on-device-engine/ios/ExperimentoDoPCC.swift#L23)

**O app — carregar, enfileirar, escolher**

- O carregador que não lança, no único ponto que pode chamá-lo.
  [`motores/index.ts:278`](../../mobile/src/lib/motores/index.ts#L278)

- O transporte do aparelho: um por vez, prazo, e a vez solta depois do teto.
  [`motores/index.ts:331`](../../mobile/src/lib/motores/index.ts#L331)

- O diagnóstico por sessão, relido quando não está disponível.
  [`motores/index.ts:475`](../../mobile/src/lib/motores/index.ts#L475)

- O motivo em palavras, exaustivo sobre a lista do núcleo, e a linha de detalhe.
  [`catalogo.ts:151`](../../mobile/src/lib/motores/catalogo.ts#L151)

- O seletor: a linha de detalhe só quando o motor está livre.
  [`motores/index.tsx:238`](../../mobile/src/app/configuracoes/motores/index.tsx#L238)

- O botão do PCC, com uma chamada viva por vez.
  [`bancada.tsx:345`](../../mobile/src/app/configuracoes/motores/bancada.tsx#L345)

**O contrato e as barreiras**

- O leitor puro do diagnóstico e a lista de motivos com dono no núcleo.
  [`aparelho.ts:262`](../../packages/shared/src/ia/aparelho.ts#L262)

- Os motivos, o nome genérico e a linha de reserva lidos do Swift e comparados.
  [`architecture.test.ts:2045`](../../packages/shared/src/architecture.test.ts#L2045)

- A cola só repassa, com os nomes que o app chama; três `.swift`, nem um a mais.
  [`architecture.test.ts:2276`](../../packages/shared/src/architecture.test.ts#L2276)

- Uma carga só da ponte, e nenhuma fora do ponto de injeção.
  [`architecture.test.ts:2328`](../../packages/shared/src/architecture.test.ts#L2328)

- Mudar o nativo exige subir o `runtimeVersion` junto.
  [`architecture.test.ts:2448`](../../packages/shared/src/architecture.test.ts#L2448)

**A decisão registrada**

- A emenda da ADR 0047: o experimento, o que ele pode e o que não pode.
  [`0047-…md:127`](../../docs/decisions/0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md#L127)
