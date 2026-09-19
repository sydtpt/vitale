---
title: 'Story 5.10 — A coluna do aparelho na bancada (metade do Mac do marco B)'
type: 'feature'
created: '2026-09-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: '3d774c08efb974b661f5d8bd6f211babc9909cfb'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-4-a-bancada-no-mac-marco-a.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A bancada mede o template e a nuvem, e o modelo do próprio aparelho (Apple Foundation Models) segue sendo uma linha sintética `indisponivel` — ninguém sabe se ele passaria no portão da ADR 0050, e a 5.9 não pode gastar build ligando no iPhone um motor que nunca foi medido. A sonda de fidelidade da AD-7 também não existe.

**Approach:** Nasce `mobile/modules/on-device-engine/ios/Engine.swift` — a ponte, sem estado e sem domínio —, compilado **sem cópia** por uma CLI Swift local da bancada, que conversa por uma linha de JSON por pedido. A bancada ganha a coluna `aparelho:sistema`, a sonda (um descritor próprio, rodado pelo orquestrador em `medicao`) e, no relatório, as quatro medidas da ADR 0050 **sem limiar e sem veredito**. As guardas (3) e (4) da AD-10 nascem com o arquivo.

## Boundaries & Constraints

**Always:**
- `Engine.swift` importa **só** `Foundation` e `FoundationModels`; recebe a string de `serializarPedido` num `Codable` único e devolve **uma** linha JSON: sucesso `{texto, provedor, modelo, plataforma, buildDoSistema, tokens?}` ou falha `{classe, detalhe?, naoMapeado?}`. Uma sessão nova por pedido; janela de `contextSize` em execução.
- A tabela erro → classe segue a AD-4 e mora no `Engine.swift`: não elegível / Apple Intelligence desligada / modelo não pronto / pesos ausentes → `indisponivel`; idioma, guia, capacidade e esquema que a ponte não converte → `capacidade`; contexto excedido → `janela`; guardrail → `guarda`; recusa → `recusa-do-modelo`; conteúdo que não se decodifica → `saida-invalida`; taxa, concorrência e timeout → `transitoria`; **o resto e todo `@unknown default` → `transitoria` com `naoMapeado` e o nome cru**. `LanguageModelError` e os tipos do 27 atrás de `#if compiler(>=6.4)` + `#available(macOS 27, iOS 27, *)`; `GenerationError` (deprecado) só no ramo 26.
- Guardrail `padrao` → `.default`, `permissivo` → `.permissiveContentTransformations` (só existe com saída texto). Amostragem `gulosa` → `.greedy`. Saída esquema → `DynamicGenerationSchema` a partir do `Esquema` do fio, e o texto devolvido é o `jsonString`.
- A tradução da linha para `Resposta | Falha` é **do núcleo**, pura e testada (`ia/aparelho.ts`, no molde de `ia/nuvem.ts`): assinatura `tipo: 'aparelho'`; linha ilegível ou fora do contrato → `transitoria` `naoMapeado`.
- A sonda é um **descritor** (`descritorDaSondaDaSaude`, em `sleep/`): só pede nos casos com `nomear` (`uma`, `duas`, `fora-do-empate`), manda as dimensões medidas com os pontos e pede **uma** dimensão por esquema de enum fechado; `conferir` aprova se a escolha está em `nomear`. Nunca entra em `CATALOGO_DE_RECURSOS`, nunca grava, nunca vira produto.
- A CLI é compilada **localmente** por `swiftc` direto sobre os dois fontes (sem Package.swift, sem symlink, sem cópia), para `scripts/bancada/aparelho/.build/` (fora do git). Nenhum teste de `scripts/` nem do CI chama `swift`: o processo é injetado.
- Chamada do aparelho não é paga: não entra na conta nem no aviso de gasto da nuvem.

**Ask First:**
- Subir qualquer teto ou mexer em lista de liberação das guardas **além** de pôr `aparelho` em `PORTA_DE_IA`.
- Mudar `Pedido`, `Resposta`, `Falha` ou `Descritor` além de acréscimo; tocar o pedido da Saúde do sono.
- Rodar a bancada com `nuvem:` (é chamada paga).

**Never:**
- Nada do app: cola do Expo, `expo-module.config.json`, `package.json` do módulo, `catalogo.ts`, `motores/index.ts`, telas, `app.base.json`, `runtimeVersion` — é a 5.9. O `Engine.swift` entra em `mobile/modules/` **sem ser linkado**.
- Fixar, sugerir ou calcular veredito do portão; mudar `cadeiaPadrao`; versionar relatório ou acervo (dado de saúde).
- Modelo de servidor na ponte (Private Cloud Compute ou qualquer pacote de provedor).

## I/O & Edge-Case Matrix

| Cenário | Estado | Esperado | Erro |
|---|---|---|---|
| Aparelho escreve | Apple Intelligence ativo, pedido texto | `Resposta` `tipo: 'aparelho'` com tokens; a linha segue a conferência do descritor | N/A |
| Aparelho fora | não elegível, desligado ou modelo não pronto | `indisponivel` com o motivo no `detalhe` | linha, nunca queda da execução |
| Pedido grande | contexto excedido | `janela`; o orquestrador repete com o pedido curto se houver | N/A |
| Guardrail / recusa | a Apple bloqueia ou recusa | `guarda` / `recusa-do-modelo` | N/A |
| Erro desconhecido | caso novo da Apple ou `@unknown default` | `transitoria` + `naoMapeado` + nome cru | N/A |
| Esquema que a ponte não converte | palavra ou forma sem `DynamicGenerationSchema` | `capacidade` | N/A |
| CLI ausente ou não compila | primeira execução, `swiftc` falha | linha sintética `indisponivel` com o motivo | a execução continua |
| CLI trava | sem resposta até `PRAZO_MS` | `transitoria`; processo reiniciado para o próximo | N/A |
| Linha ilegível da CLI | não-JSON ou fora do contrato | `transitoria` `naoMapeado` | N/A |
| Sonda acerta / erra | escolha dentro / fora de `nomear` | `ok` / `reprovada` com a escolha e o esperado | N/A |
| Sonda sem o que perguntar | caso sem `nomear` | `mudo` — não conta | N/A |

</frozen-after-approval>

## Code Map

- **Prova de viabilidade (19/09, scratchpad):** um `main.swift` com `import FoundationModels`, compilado por `swiftc -O` nesta máquina (Xcode 27.0, Swift 6.4, macOS 27.0), rodou: `availability` = `available`, `contextSize` 4096, texto guloso em ~3,9 s frio, `usage` 71/5, e `DynamicGenerationSchema(name:anyOf:)` devolveu `{"dimensao": "horario"}`. CLI de terceiro faz inferência — o entitlement privado do `/usr/bin/fm` não é exigido.
- SDK: `MacOSX.sdk/.../FoundationModels.swiftmodule/arm64e-apple-macos.swiftinterface` — `SystemLanguageModel(useCase:guardrails:)` L389, `Availability`/`UnavailableReason` (3 casos, não `@frozen`) L352-374, `contextSize` L441, `tokenCount` (26.4) L410, `respond(to:options:)` e `respond(to:schema:…)` L2089-2123, `Response.usage` (27) L1968, `GenerationOptions(samplingMode:)` L3200, `DynamicGenerationSchema` L3151-3183, `GeneratedContent.jsonString` L1336, `GenerationError` (deprecado no 27) L3528-3570 com o substituto de cada caso, `LanguageModelError` (27, não `@frozen`) L1527, `LanguageModelSession.Error`/`SystemLanguageModel.Error`/`GeneratedContent.ParsingError` (27).
- `packages/shared/src/ia/motor.ts:45-52` `Pedido`; `:57-65` `AssinaturaDoMotor` (`plataforma?`, `buildDoSistema?`); `:85-104` `Resposta`/`Falha`; `:288-306` `canonico`, `serializarPedido` — **é esta string que a ponte decodifica**.
- `packages/shared/src/ia/fio.ts:44-52` `CLASSES_DE_FALHA`; `:74` `APARELHO_SISTEMA`; `:170-192` `Esquema` e as palavras aceitas; `:293` `conformeAoEsquema`.
- `packages/shared/src/ia/nuvem.ts:121-185` — `traduzirDaNuvem` e `criarMotorDeNuvem(transporte)`: o molde de `ia/aparelho.ts`.
- `packages/shared/src/ia/orquestrar.ts:124-146` `Descritor`; `:327-338` `foraDaPorta` (exige `assinatura.tipo` igual ao do `MotorId`); `:630-705` `medicao`.
- `packages/shared/src/sleep/caso.ts:37-110` `CASOS_DA_SAUDE`, `CasoDaSaude` (`nomear`), `casoDaSaude`; `sleep/leitura.ts:742-768` `descritorDaSaudeDoSono` — o molde do descritor da sonda (não tocar nele).
- `packages/shared/src/architecture.test.ts` — guarda (1) `:1787-1828` (`PONTOS_DE_INJECAO` aceita `scripts/*/motores.ts`; `IMPORTA_A_PONTE` já reconhece `on-device-engine`); guarda (2) `:1305-1403` (`foundationmodels` proibido **no núcleo**); a metade de funções da (3) `:1486-1529` (a da 5.6 — a do Swift é a outra metade); (7) `:1855-2033`, `PORTA_DE_IA` `:1912`, `ehDescritor` `:2033` (nome com prefixo `descritor` é livre). `walkExt` `:1097` lê `.swift`; `semComentario` `:90` não trata `"""`.
- `scripts/bancada/motores.ts:233-260` `motoresDaBancada` (devolve `undefined` para o aparelho — `:228-231`), `PRAZO_MS` `:59`. `bancada.ts:490-501` conta de gasto (hoje soma o aparelho), `:516-522` aviso do marco B, `:530` `motorPara` sem sessão = `SEM_NENHUM_MOTOR`. `medir.ts:176-263` o laço. `relatorio.ts:137-160` `LinhaDoRelatorio`, `:230-239` `Agregados`, `:511-594` o Markdown. Testes que afirmam a ausência: `motores.test.ts:212-215`, `bancada.test.ts:130-132`. README `:172-174`.
- `docs/decisions/0050-*.md:42-55` — as quatro condições (aprovação ≥ 90% com `ok`, sete casos nos dois alcances, nenhuma aprovada idêntica ao template, mediana ≤ 20 s).
- Acervo real exportado em 12/09: `~/Orbe-dados/sono-2026-09-12/` (fora do repo) — a medição usa `--export`, sem rede.

## Tasks & Acceptance

**Execution:**
- [x] `mobile/modules/on-device-engine/ios/Engine.swift` — a ponte: `Codable` do pedido canônico, disponibilidade, sessão por pedido, amostragem, guardrail, conversão de esquema, tabela erro → classe, `enum ClasseDeFalha: String` com valores brutos explícitos, saída numa linha JSON.
- [x] `scripts/bancada/aparelho/main.swift` — o laço stdin → `Engine` → stdout, uma linha por pedido. `scripts/bancada/aparelho/testes.swift` — executável de teste local, compilado junto com o `Engine.swift`: a tabela é testável sem modelo porque o `switch` sobre o erro produz um identificador e a tabela identificador → classe é função pura. `scripts/package.json` ganha `aparelho:testar` (fora do CI); `.gitignore` ganha `.build/`.
- [x] `packages/shared/src/ia/aparelho.ts` + teste — `traduzirDoAparelho(linha)` e `criarMotorDoAparelho(transporte)`; `index.ts` exporta.
- [x] `packages/shared/src/sleep/sonda.ts` + teste — `descritorDaSondaDaSaude`, cobrindo as linhas da sonda na matriz.
- [x] `packages/shared/src/architecture.test.ts` — (3), metade Swift: acha o enum em `Engine.swift` (reprova se não achar) e exige igualdade com `CLASSES_DE_FALHA`; (4): imports do `Engine.swift` só da lista `{Foundation, FoundationModels}`; `aparelho` entra em `PORTA_DE_IA`.
- [x] `scripts/bancada/motores.ts` + teste — o transporte do processo (compila se faltar ou se o fonte for mais novo, reinicia no prazo), injetável; `motoresDaBancada` passa a entregar `aparelho:sistema`.
- [x] `scripts/bancada/bancada.ts`, `medir.ts`, `relatorio.ts` + testes — `motorPara` do aparelho **com ou sem sessão**; `--sonda` roda o descritor da sonda para cada coluna de modelo pedida; a conta de gasto ignora o aparelho; o relatório ganha, por coluna de modelo, a assinatura (plataforma e build do sistema) e as quatro medidas da ADR 0050, sem limiar; o aviso do marco B sai.
- [x] `scripts/bancada/README.md` — como compilar, rodar e ler a coluna do aparelho e a sonda.

**Acceptance Criteria:**
- Given o Mac no macOS 27 com Apple Intelligence ativo, when o dono roda `--export ~/Orbe-dados/sono-2026-09-12 --motor aparelho:sistema --sonda`, then o relatório sai com a coluna do aparelho, a sonda e as quatro medidas — e nenhuma chamada paga.
- Given o `Engine.swift` perde um valor do enum, ganha um import proibido ou some, when a suíte do shared roda, then (3) e (4) reprovam.
- Given os comandos do portão da máquina, when rodam, then passam sem que nenhum toque em Swift — e o app continua compilando igual.

## Spec Change Log

## Design Notes

**Por que `swiftc` direto e não SwiftPM:** a revisão V-5 da espinha provou que o SwiftPM recusa alvo fora da raiz do pacote; as saídas eram symlink versionado ou `swiftc` sobre os caminhos. Dois arquivos não pedem um pacote, e sem symlink não há o que quebrar num clone.

**Por que um processo vivo, e não um por pedido:** a primeira resposta do spike levou ~3,9 s frio. Subir o modelo a cada pedido mediria a carga, não o motor, e envenenaria a condição de mediana ≤ 20 s. O app da 5.9 também mantém o processo; a sessão continua nova a cada pedido.

**Por que a sonda é descritor:** a AD-2 proíbe hospedeiro montando pedido ou conferindo fora do orquestrador, e a guarda (7) já libera todo nome com prefixo `descritor` — a sonda entra pela porta que existe, sem mexer em lista.

**A sonda, em uma frase:** o código sabe qual dimensão destoa (`nomear`); a sonda dá ao modelo os pontos e pergunta qual — se ele acerta, um dia poderia escolher; se erra, a regra da AD-7 (o motor nunca decide) ganha evidência.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test` — (3) e (4) verdes; a tradução e a sonda testadas.
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test` — sem `swift` em nenhum teste.
- `pnpm --filter @vitale/web build` — o núcleo mudou.
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` — o app não muda.
- `pnpm --filter @vitale/scripts aparelho:testar` — a tabela erro → classe, local.

**Manual checks:**
- A medição de verdade no Mac, com o acervo de 12/09, e o relatório escrito em `~/Orbe-dados/` — **portão do dono**, que lê e decide se a 5.9 vale o build.

## Suggested Review Order

**A ponte — o que o modelo do aparelho recebe e devolve**

- A entrada: uma linha canônica vira pedido, e o que volta é sempre uma linha — resposta ou falha.
  [`Engine.swift:288`](../../mobile/modules/on-device-engine/ios/Engine.swift#L288)

- As sete classes com valor bruto explícito — a guarda (3) compara com o fio.
  [`Engine.swift:36`](../../mobile/modules/on-device-engine/ios/Engine.swift#L36)

- A geração: sessão nova, janela conferida contra `contextSize`, amostragem e guardrail.
  [`Engine.swift:442`](../../mobile/modules/on-device-engine/ios/Engine.swift#L442)

- A tabela erro → classe, em duas metades: o `switch` dá o nome, a função pura dá a classe.
  [`Engine.swift:544`](../../mobile/modules/on-device-engine/ios/Engine.swift#L544)

- No 27, o que os tipos novos não reconhecem ainda passa pelo `GenerationError` antes de virar não mapeado.
  [`Engine.swift:578`](../../mobile/modules/on-device-engine/ios/Engine.swift#L578)

- O esquema do fio vira `DynamicGenerationSchema`, com nomes únicos e recusa do que não converte.
  [`Engine.swift:392`](../../mobile/modules/on-device-engine/ios/Engine.swift#L392)

**O contrato entre as duas línguas**

- O núcleo traduz a linha da ponte; tudo que foge do contrato é `transitoria` não mapeada.
  [`aparelho.ts:130`](../../packages/shared/src/ia/aparelho.ts#L130)

- As chaves que o TS lê, exportadas para a guarda comparar com os campos do Swift.
  [`aparelho.ts:58`](../../packages/shared/src/ia/aparelho.ts#L58)

- A guarda do contrato: campo renomeado de um lado reprova do outro.
  [`architecture.test.ts:1883`](../../packages/shared/src/architecture.test.ts#L1883)

**O processo da CLI**

- Um processo vivo, pareado por id, com o `pronto` que pega o binário que morre antes do `main`.
  [`motores.ts:562`](../../scripts/bancada/motores.ts#L562)

- A compilação local, com carimbo do toolchain e o macOS mínimo conferido antes.
  [`motores.ts:364`](../../scripts/bancada/motores.ts#L364)

- O processo de verdade, lido por `close`, e testado com um Node de mentira no lugar do Swift.
  [`motores.ts:450`](../../scripts/bancada/motores.ts#L450)

**A sonda de fidelidade**

- Um descritor: só pergunta onde o código nomeia, com as opções em permutação por janela.
  [`sonda.ts:164`](../../packages/shared/src/sleep/sonda.ts#L164)

- A barreira que a mantém fora dos apps.
  [`architecture.test.ts:1916`](../../packages/shared/src/architecture.test.ts#L1916)

**As medidas do portão, sem veredito**

- A regra única de "janela medida" — o que entra e o que fica de fora, contado à parte.
  [`relatorio.ts:383`](../../scripts/bancada/relatorio.ts#L383)

- As quatro medidas da ADR 0050, com a mediana só das chamadas não frias.
  [`relatorio.ts:451`](../../scripts/bancada/relatorio.ts#L451)

**A bancada**

- O plano da corrida, puro: colunas, sonda, pagas e locais — o que decide o teto.
  [`bancada.ts:388`](../../scripts/bancada/bancada.ts#L388)

- A sonda por janela, com o defeito virando linha.
  [`medir.ts:342`](../../scripts/bancada/medir.ts#L342)

**As guardas e os testes**

- (3) e (4): as classes e os imports do `Engine.swift`.
  [`architecture.test.ts:1749`](../../packages/shared/src/architecture.test.ts#L1749)

- O executável de teste local da tabela, com os mesmos argumentos do `swiftc` da CLI.
  [`testes.swift`](../../scripts/bancada/aparelho/testes.swift)
