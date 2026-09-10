---
review: verificacao
alvo: ARCHITECTURE-SPINE.md (motores-do-orbe, status draft, 10/09/2026)
lente: verificação — cada decisão comprometida foi pesquisada/checada contra a realidade, ou afirmada de memória?
data: 2026-09-10
método: leitura do repositório (worktree docs/motores-arquitetura e ios/ gerado da árvore principal), comandos locais, documentação da Apple em JSON, npm, API REST do GitHub, Supabase CLI (só leitura), e quatro experimentos de compilação Swift num diretório temporário. Nenhum arquivo do repositório foi editado além deste.
---

# Revisão de verificação — Os motores do Orbe

## Veredito

**As versões locais e os fatos de iOS 26 conferem; o que não confere é o iOS 27, que chega em quatro dias
e foi pesquisado só pela metade.** Tudo o que a espinha afirma sobre a máquina, o `package.json`, o alvo
16.4, a `ia-narrar` e o `@react-native-ai/apple` está correto e reproduzi. Os fatos de iOS 26 da Foundation
Models também conferem, com uma correção pequena (`contextSize`). O problema está no que ficou de fora da
pesquisa sobre o iOS 27 e em três afirmações de mecanismo que os testes desmentem:

- o iOS 27 sai em **14/09/2026** com um modelo de aparelho **novo**;
- a mesma linha `model:` passa a aceitar **modelos de servidor** (Private Cloud Compute, pacotes da
  Anthropic e do Google);
- a recusa em geração de texto **não lança erro**;
- `#if canImport` não protege símbolo de SDK mais novo dentro do mesmo módulo;
- a CLI do SwiftPM não compila arquivo fora da raiz do pacote;
- o `coreai-models` exige iOS 27 como **alvo mínimo**.

Nenhum desses achados derruba o paradigma. Mas quatro regras (AD-3, AD-4, AD-5 e AD-11) precisam de
texto novo antes do registro.

---

## Achados, do mais grave ao menos grave

### V-1 — ALTO · o iOS 27 chega em 14/09 com outro modelo, e a espinha está presa ao 26

**O que a espinha afirma:** a Stack diz "janela de 4.096 tokens no iOS 26" e "macOS da bancada 26.6.2". A
AD-11 diz que "a premissa de que o modelo do Mac é o do iPhone é conferida por uma amostra de 20 pedidos
no aparelho".

**O que a realidade diz:**

- O iOS 27, o macOS 27 e o watchOS 27 saem na **segunda, 14/09/2026**
  ([MacRumors, 09/09](https://www.macrumors.com/2026/09/09/apple-announces-ios-27-release-date/);
  [AppleInsider](https://appleinsider.com/articles/26/09/09/ios-27-arrives-on-september-14-heres-what-youll-get)).
- O Xcode 27 **RC** está disponível desde **09/09**
  ([Apple Developer News](https://developer.apple.com/news/?id=k1mtkt1k)): build 27A266a, Swift 6.4, e
  exige macOS 26.6 ([xcodereleases.com/data.json](https://xcodereleases.com/data.json)). Roda nesta máquina.
- A sessão 241 da WWDC26 diz: *"This release comes with a new on-device model, rebuilt from the ground up"*.
  A amostra de código em 2:46 imprime `print(model.contextSize) // 8192`. A sessão acrescenta que as APIs
  do 26.4 servem *"to adapt your app to the hardware it's running on"*
  ([developer.apple.com/videos/play/wwdc2026/241](https://developer.apple.com/videos/play/wwdc2026/241/)).
- A Apple manda re-testar os prompts a cada versão do sistema, porque *"the model changes when a person
  updates to iOS 27"* ([Foundation Models updates](https://developer.apple.com/documentation/updates/foundationmodels)).
  Também avisa que o modelo antigo só fica disponível no programa beta
  ([Updating prompts for new model versions](https://developer.apple.com/documentation/foundationmodels/updating-prompts-for-new-model-versions)).

**Consequência:** o golden set medido no macOS 26.6.2 mede um modelo que o iPhone abandona assim que
atualizar. O "4.096" pode virar 8.192, e pode variar por aparelho. A amostra de 20 pedidos da AD-11 só vale
com o mesmo major.minor do sistema nas duas pontas. Ainda não verifiquei qual tipo de erro chega a um
binário feito com Xcode 26.6 rodando no iOS 27 (ver "Não verificável").

**Correção sugerida:**

1. Acrescentar à Stack uma linha "iOS/macOS 27 — público em 14/09/2026; modelo novo; `contextSize` de
   8.192 na amostra da WWDC26; Xcode 27 RC desde 09/09".
2. Na AD-11, fixar que bancada e iPhone rodam o **mesmo major.minor** de sistema, e que o relatório grava
   a versão de SO de cada lado.
3. Na AD-3, fixar que a janela é sempre lida de `contextSize` em tempo de execução, nunca uma constante.
4. Levar ao dono **antes da F1** a escolha da linha de base: congelar os aparelhos no 26.x até a POC
   fechar, ou subir tudo para o 27 e medir lá.

### V-2 — ALTO · no iOS 27 a linha `model:` também aceita modelos de servidor, e a AD-5 tem um furo

**O que a espinha afirma:** "a porta TypeScript escolhe o **tipo** de motor (sem modelo, aparelho, nuvem);
a linha `model:` [...] escolhe os **pesos** (o modelo do sistema, depois Core AI)". O `MotorId`
`aparelho:<pesos>` põe tudo o que passa pela ponte no regime aparelho. A AD-5 ordena os regimes pelo tipo.

**O que a realidade diz:**

- No iOS 27, `LanguageModelSession(model:)` recebe `some LanguageModel`. O protocolo existe *"to use any
  large language model — server or on-device"*
  ([updates](https://developer.apple.com/documentation/updates/foundationmodels);
  [LanguageModel](https://developer.apple.com/documentation/foundationmodels/languagemodel)).
- `PrivateCloudComputeLanguageModel` (iOS 27) é o modelo de servidor da Apple, com 32K de janela e
  raciocínio. Troca-se *"a single line of code"*: `LanguageModelSession(model: PrivateCloudComputeLanguageModel())`.
  Pede entitlement gerenciado
  ([Adding server-side intelligence with PCC](https://developer.apple.com/documentation/foundationmodels/adding-server-side-intelligence-with-private-cloud-compute)).
- A WWDC26 anuncia que *"Anthropic, and Google are both publishing Swift packages"* para entrar pela mesma
  linha (sessão 241, capítulo "Partner model integrations").

**Consequência:** a espinha trata a linha `model:` como lugar de pesos locais, mas o próprio framework a
anuncia como a troca de uma linha para a nuvem. O movimento natural na F5 é pôr o PCC ali. Nesse caso, o
PCC entraria como `aparelho:pcc`, passaria na verificação de regime da AD-5 e mandaria dado de saúde (Art.
9 do RGPD, usuário na Bélgica — ADR 0040) para fora sem tabela de regime. Pacotes de provedor na ponte
trariam também chave no app, contra a AD-6 herdada. As guardas da AD-10 leem só o TypeScript do núcleo e
os literais de classe do Swift. Nenhuma lê os imports da ponte.

**Correção sugerida:**

1. Na AD-3 ou na AD-5, dizer que **o regime é propriedade dos pesos, não do hospedeiro que os executa**. A
   ponte só instancia pesos que rodam no aparelho (`SystemLanguageModel`, Core AI/MLX locais).
2. O PCC, se um dia entrar, é `nuvem:apple/pcc`: regime nuvem, com tabela de regime (ADR 0040) e lista do
   servidor (AD-9).
3. Na guarda (3) da AD-10, acrescentar uma **allowlist de imports** do Swift da ponte (`Foundation`,
   `FoundationModels`, `ExpoModulesCore`, `CoreAI*`) e proibir o literal `PrivateCloudCompute`.

### V-3 — ALTO · a recusa em geração de texto chega como texto normal, e a AD-4 e a AD-6 não a pegam

**O que a espinha afirma:** a AD-4 põe `recusa` como classe que a ponte traduz na borda. A AD-6, no regime
interpolado, diz que "a conferência reprova dígito e marcador fora do conjunto".

**O que a realidade diz:**

- Na doc da Apple: *"When you generate a string response and the model refuses a request, it generates a
  message that might begin with a refusal like 'Sorry, I can't help with that…'. You might not be able to
  programmatically determine whether a string response is a normal response or a refusal"*. O erro
  `refusal` só é lançado em **geração guiada**
  ([Improving the safety of generative model output](https://developer.apple.com/documentation/foundationmodels/improving-the-safety-of-generative-model-output)).
- No modo permissivo é explícito: *"the model may still sometimes refuse [...] in which case it generates a
  String refusal message"*
  ([permissiveContentTransformations](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel/guardrails/permissivecontenttransformations)).

**Consequência:** com `saida: texto`, a ponte não tem como emitir `recusa`. Uma frase como "Desculpe, não
posso ajudar com isso" não tem dígito nem marcador fora do conjunto, então passa na conferência como
escrita e vira a leitura na tela. Saúde e sono são exatamente o tipo de tema em que o modelo recusa.

**Correção sugerida:**

1. Na AD-6, a conferência passa a exigir **presença**, e não só ausência: os marcadores obrigatórios do
   caso e as dimensões que o caso manda nomear.
2. A falta disso vira `recusa` ou `saida-invalida` no orquestrador, e não na ponte.
3. Alternativa: a Saúde do sono usa `esquema`, em que a recusa lança erro. Registrar na AD-4 que, para
   `texto`, quem classifica a recusa é a conferência.

### V-4 — MÉDIO · `#if canImport` é a guarda errada; `#available` só de iOS quebra o build da bancada

**O que a espinha afirma (AD-3):** "Tudo fica atrás de `#available(iOS 26, *)`; símbolos de SDK mais novo
(`tokenCount` do 26.4, Core AI) ficam atrás de `#if canImport`."

**O que os testes mostram:** fiz dois experimentos com `swift build`, no Xcode 26.6 / Swift 6.3.3.

1. `LanguageModelError` dentro de `#if canImport(FoundationModels)` **não compila**: `cannot find type
   'LanguageModelError' in scope`. O `canImport` é verdadeiro no SDK 26.5, porque o módulo existe. A
   mesma guarda com `#if compiler(>=6.4)` compila. O Swift 6.4 é o do Xcode 27, pelo xcodereleases.
2. `if #available(iOS 26.4, *) { … tokenCount(for:) }` **não compila para macOS**: `'tokenCount(for:)'
   is only available in macOS 26.4 or newer`. O `*` resolve para o alvo mínimo do macOS.

**Outros fatos da API:**

- No SDK 26.5, `tokenCount(for:)` é `@available(iOS 26.4, macOS 26.4)`. Como o Xcode 26.6 já o tem, o
  problema dele é **de execução**, não de compilação. A issue #227 do `callstackincubator/ai` ("fails to
  compile on Xcode 26.2") é o sintoma de usar a guarda errada.
- O `contextSize` é `@available(iOS 26.0)` com `@backDeployed(before: iOS 26.4)`: no 26.0–26.3 devolve
  4096 fixo (interface do SDK e
  [doc](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel/contextsize)).
  Logo, a linha "`tokenCount` e `contextSize` 26.4+" da Stack está **parcialmente errada**.

**Correção sugerida:** reescrever a regra da AD-3 com três guardas.

- **Execução:** `#available(iOS 26.x, macOS 26.x, *)`, sempre com os dois sistemas, porque o mesmo
  arquivo compila no Mac.
- **Símbolo novo dentro de `FoundationModels`** (`LanguageModelError`, `LanguageModel`, `usage`):
  `#if compiler(>=6.4)`.
- **Módulo novo inteiro** (`CoreAI`): `#if canImport`.

Na Stack, corrigir para "`contextSize` 26.0+ (back-deploy); `tokenCount` 26.4+".

### V-5 — MÉDIO · "a CLI Swift compila o arquivo da ponte, sem cópia" não funciona como está escrito

**O que a espinha afirma (AD-11 e Seed):** a CLI em `scripts/bancada-motores/swift/` compila, com
`swift build`, o arquivo que mora em `mobile/modules/on-device-engine/`.

**O que o teste mostra:**

- Um `Package.swift` com `path:` apontando para fora da raiz dá `error: target 'Engine' in package
  'swift' is outside the package root`.
- Com um **symlink** dentro do pacote apontando para o arquivo da ponte, o build passa e a CLI roda.
  Testei.
- O arquivo compartilhado não pode importar `ExpoModulesCore`, porque o SwiftPM da bancada não o tem.

**Correção sugerida:** a AD-11 passa a dizer:

- o núcleo da ponte é um arquivo **sem `ExpoModulesCore`**, e o `Module` da Expo fica em outro arquivo;
- a CLI o alcança por symlink versionado (ou por `swiftc` direto);
- as guardas de disponibilidade incluem macOS (ver V-4).

### V-6 — MÉDIO · o "vocabulário proibido" que a AD-6 manda compor não existe além de `causa`

**O que a espinha afirma:** a linha AD-3 herdada diz "o vocabulário proibido (conselho, causa, placar) já
tem dono em `ia/verificar.ts`". A AD-6 diz que ele "vem das listas de `ia/verificar.ts`, compostas e nunca
reescritas".

**O que o código mostra:** `packages/shared/src/ia/verificar.ts` tem uma lista só de vocabulário proibido,
a `CAUSA` (linha 46). As outras (`B1_GENERICO`, `B2_VOCAB`, `B3_VOCAB`) são de base, e nenhuma é
exportada. Não há lista de conselho, de placar nem de comparação com outras pessoas: `grep -ciE
"conselho|placar|outras pessoas"` dá **0**. A proibição de conselho existe só como **instrução no prompt**
(`ia/prompt.ts:338-339`), que não é conferência mecânica. O `routes/verificar.ts` também não tem essas
listas.

**Correção sugerida:** a F0 **cria** as listas de conselho, placar e comparação com um dono (em
`ia/verificar.ts`) e as exporta. A frase "compostas e nunca reescritas" passa a valer a partir daí. A
linha herdada deixa de dizer que elas "já têm dono".

### V-7 — MÉDIO (F5) · o Core AI não é "a troca de uma linha" com o alvo 16.4

**O que a espinha afirma:** o Core AI entra pela linha `model:` atrás de `#if canImport`, com o
"Deferred" decidindo só os pesos e a memória.

**O que a realidade diz:**

- `CoreAILanguageModel` **não está no SDK**. Está no pacote aberto `apple/coreai-models`, módulo
  `CoreAILanguageModels`
  ([Running a Core AI model in a Foundation Models session](https://developer.apple.com/documentation/foundationmodels/running-a-core-ai-model-in-a-foundation-models-session):
  *"requires macOS 27, iOS 27, and Xcode 27 or later"*).
- O `Package.swift` do pacote declara `platforms: [.macOS("27.0"), .iOS("27.0")]` e depende de
  `huggingface/swift-transformers` e `mlc-ai/xgrammar` (C++, com `linkedLibrary("c++")`), segundo o
  `raw.githubusercontent.com/apple/coreai-models/main/Package.swift`.
- O SwiftPM **recusa** dependência com mínimo maior que o do alvo. Testei: *"requires macos 26.0, but
  depends on the product 'A' which requires macos 27.0"*. O `#if canImport` não ajuda, porque a falha é
  na resolução.
- O módulo da ponte é pod (CocoaPods). Trazer SPM exige o `spm_dependency` do RN, que existe no
  `react_native_pods.rb:339` do 0.86.
- A imagem da EAS para o `sdk-57` é o Xcode 26.6
  ([Expo build infrastructure](https://docs.expo.dev/build-reference/infrastructure/)), então não há
  Xcode 27 no EAS para esta SDK.

**Correção sugerida:** a linha do Core AI no Deferred ganha as condições reais. Na F5 é preciso escolher
entre:

- subir o alvo mínimo do app para iOS 27 (barato para um usuário só, mas é decisão);
- vendorizar o pacote (licença BSD-3);
- escrever uma conformidade própria de `LanguageModel` sobre o framework `CoreAI`.

Em qualquer caso, com Xcode 27 fora do EAS da SDK 57.

### V-8 — MÉDIO · "motivo de parada" não existe no motor de aparelho

**O que a espinha afirma (convenção "Resposta"):** a resposta tem texto, assinatura, motivo de parada e
tokens quando houver, e um motivo de parada que não seja conclusão vira `saida-invalida`.

**O que a realidade diz:**

- `LanguageModelSession.Response` no SDK 26.5 tem só `content`, `rawContent` e `transcriptEntries`: não há
  motivo de parada. A contagem de tokens da resposta, `usage`, é **iOS 27**
  ([doc](https://developer.apple.com/documentation/foundationmodels/languagemodelsession/response/usage)).
- A Apple avisa que `maximumResponseTokens` corta em silêncio: *"A cat is a small."*
  ([Managing the context window](https://developer.apple.com/documentation/foundationmodels/managing-the-context-window)).

**Correção sugerida:** a convenção passa a dizer que no aparelho não há motivo de parada. O pedido de
texto não usa `maximumResponseTokens`, ou então a conferência detecta frase incompleta. A ponte devolve
tokens só com `tokenCount(for:)` (26.4+) ou `usage` (27).

### V-9 — BAIXO · precisões

- **Expo.** O lock e a instalação estão em `57.0.20`, mas o npm já tem **57.0.21** como `latest`. A versão
  que governa a "Expo Modules API" é o `expo-modules-core` **57.0.16** (lock). Sugiro "57.0.20 (lock) ·
  expo-modules-core 57.0.16".
- **Alvo 16.4.** É o **padrão do template** da SDK 57: `Expo.podspec` com `:ios => '16.4'` e o
  `project.pbxproj` do `template.tgz`. O `app.base.json` não o fixa, então um upgrade de SDK o move
  sozinho. Vale dizer isso na Stack.
- **ia-narrar "sem SDK".** Não há SDK de provedor, o que confirma a espinha. Mas ela importa, de forma
  transitiva, `npm:@supabase/supabase-js@2` pelo `_shared/auth.ts` (só para usar `json` e `preflight`),
  e esse import existe desde 15/07 (commit `742c570`). A frase da ADR 0040 "as quatro edge functions já
  não têm importação externa nenhuma" era imprecisa quando foi escrita. Não muda a espinha.
- **`UnavailableReason`** não é `@frozen` (é `@frozen` só o `Availability`). O `switch` da ponte precisa
  de `@unknown default`. O PCC tem outra razão, `.systemNotReady`.
- **Guardrails são do modelo, não do pedido.** No Swift, eles entram por
  `SystemLanguageModel(useCase:guardrails:)` (interface do SDK, linha 581). A Apple diz *"Guardrails are
  a safety system tied to a specific model"*, e os do PCC não são configuráveis. Pesos do Core AI não
  têm guardrail da Apple. O campo do `Pedido` deve ser **intenção** (como a espinha já diz do `json?`),
  e a ponte o ignora ou recusa para pesos sem guardrail.
- **Alternativas da Apple que a pesquisa não avaliou para a bancada:** o framework **Evaluations**
  (iOS/macOS 27), a CLI **`fm`** (macOS 27) e o **Python SDK** (mar/2026)
  ([updates](https://developer.apple.com/documentation/updates/foundationmodels); sessão 241). Não
  invalidam a AD-11, que quer o *mesmo Swift*, mas merecem uma linha de "considerado e por que não".

---

## Afirmação por afirmação

Status: **C** = confirmada · **P** = parcialmente correta / imprecisa · **D** = desatualizada ·
**E** = errada · **N** = não verificável daqui.

### Stack

| Afirmação | Status | Fonte | Correção |
|---|---|---|---|
| Foundation Models iOS 26.0+ | C | [doc raiz JSON](https://developer.apple.com/tutorials/data/documentation/foundationmodels.json) (iOS 26.0; watchOS 27.0) | — |
| `tokenCount` e `contextSize` 26.4+ | P | interface do SDK 26.5 (`@backDeployed(before: iOS 26.4)` no `contextSize`); [doc contextSize](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel/contextsize) | `contextSize` 26.0+ (back-deploy); `tokenCount` 26.4+ |
| Janela de 4.096 no iOS 26 | C, mas D em 4 dias | sonda local (`contextSize` = 4096); [Managing the context window](https://developer.apple.com/documentation/foundationmodels/managing-the-context-window); WWDC26 241 (`// 8192`) | acrescentar o iOS 27; ler em runtime (V-1) |
| Core AI e `LanguageModel`: iOS 27 + Xcode 27 | C | [LanguageModel](https://developer.apple.com/documentation/foundationmodels/languagemodel) (27.0); [Core AI](https://developer.apple.com/documentation/coreai) (27.0); artigo do Core AI (macOS 27, iOS 27, Xcode 27) | acrescentar pacote SPM com mínimo iOS 27 (V-7) |
| Xcode 26.6 (SDK iOS 26.5) | C | `xcodebuild -version` → 26.6 / 17F113; `xcrun --show-sdk-version` → 26.5; Swift 6.3.3 | registrar que o Xcode 27 RC existe desde 09/09 |
| Alvo mínimo iOS 16.4 | C | `mobile/ios/Podfile:25`; `Orbe.xcodeproj/project.pbxproj` (4× 16.4); `Expo.podspec` e template | é padrão do template, não decisão (V-9) |
| Expo SDK 57.0.20 | C | `mobile/package.json` `~57.0.20`; `node_modules/expo` 57.0.20; `pnpm-lock.yaml` | npm `latest` = 57.0.21; `expo-modules-core` 57.0.16 |
| React Native 0.86.3 | C | `package.json`, lock, `node_modules` | último patch da 0.86 (24/08); 0.87.1 existe, fora da SDK 57 |
| macOS 26.6.2, Apple Silicon, Apple Intelligence ativo | C | `sw_vers` 26.6.2 / 25G83; `uname -m` arm64; sonda: `availability = available` | — |
| ia-narrar em produção desde 06/09, sem SDK | C | `supabase functions list`: ACTIVE, v5, `created_at` 2026-09-06T18:54Z, `verify_jwt: true`; `narrador.ts` só com `fetch` | nuance do supabase-js transitivo (V-9) |
| `@react-native-ai/apple` 0.12.0 | C | `npm view` → 0.12.0 (28/01/2026), `@ai-sdk/provider ^3.0.5` | — |

### Regras e premissas de tecnologia

| Afirmação | Status | Fonte | Nota |
|---|---|---|---|
| A linha `model:` escolhe os pesos (sistema, depois Core AI) | P | iOS 26: `init(model: SystemLanguageModel = .default …)` na interface do SDK; iOS 27: `some LanguageModel`, incluindo servidor | V-2 |
| Módulo Expo local em `mobile/modules/…`, autolinkado, sobrevive ao prebuild | C | `expo-modules-autolinking` 57.0.12, `autolinkingOptions.js:172`: `nativeModulesDir` padrão `./modules`; [docs.expo.dev/modules/get-started](https://docs.expo.dev/modules/get-started/) | `mobile/modules/` ainda não existe |
| Inline modules desde a SDK 56, experimentais | C | [Inline modules reference](https://docs.expo.dev/modules/inline-modules-reference/): *"experimental and available in Expo SDK 56 and later. The API is subject to breaking changes"* | o changelog da SDK 57 não muda o status |
| Nativo não vai por OTA | C | docs de módulos Expo | — |
| `UnavailableReason` com 3 casos | C | interface do SDK 26.5 (linhas 558-561); [doc](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel/availability-swift.enum/unavailablereason) | não é `@frozen` (V-9) |
| `GenerationError` deprecado no iOS 27 → `LanguageModelError` | C | [GenerationError](https://developer.apple.com/documentation/foundationmodels/languagemodelsession/generationerror) (`deprecatedAt` 27.0); [LanguageModelError](https://developer.apple.com/documentation/foundationmodels/languagemodelerror): contextSizeExceeded, rateLimited, refusal, timeout, guardrailViolation, unsupportedCapability, unsupportedTranscriptContent, unsupportedGenerationGuide, unsupportedLanguageOrLocale | também `SystemLanguageModel.Error` (assetsUnavailable) e `LanguageModelSession.Error` (concurrentRequests, transcriptMutationWhileResponding), ambos 27.0 |
| Pegar os tipos novos exige Xcode 27 | C | teste local (V-4): o tipo não existe no SDK 26.5 | — |
| `permissiveContentTransformations` só para String | C | [doc](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel/guardrails/permissivecontenttransformations): *"When you generate responses other than String, this mode behaves the same way as default"* | a recusa vira texto (V-3) |
| `DynamicGenerationSchema` para esquema em tempo de execução | C | interface do SDK (iOS 26.0; `.null` e nil explícito só no 26.4); `respond(to:schema:)` → `GeneratedContent.jsonString` | JSON Schema → dinâmico já implementado no `AppleLLMImpl.swift:467+` |
| Sessão nova por pedido evita `concurrentRequests` | C | o erro é de uso da sessão (`LanguageModelSession.Error`, iOS 27) | — |
| Pacote de terceiro fixa `SystemLanguageModel.default`, disponibilidade booleana | C | `AppleLLMImpl.swift` (main): linhas 24-27 (`isAvailable() -> Bool`), 44, 54, 80, 91, 147, 158 | — |
| (memlog) PRs 212/213 mergeados e não publicados; 225/228 abertos; issue 227 aberta; último push 07/07 | C | `api.github.com/repos/callstackincubator/ai` e `/issues/{n}` | — |
| Assinatura "no aparelho, o modelo é a versão do iOS" | C | [Updating prompts…](https://developer.apple.com/documentation/foundationmodels/updating-prompts-for-new-model-versions) (a Apple versiona o prompt por `#available`) | a bancada grava a versão do macOS também |
| A lista em `secrets` troca de modelo sem deploy (AD-9) | C | [Supabase secrets](https://supabase.com/docs/guides/functions/secrets): *"You don't need to re-deploy after setting your secrets"* | — |
| JWT do usuário na nuvem | C | `config.toml` `[functions.ia-narrar] verify_jwt = true`; deploy com `verify_jwt: true`; [Supabase auth](https://supabase.com/docs/guides/functions/auth): a plataforma valida JWT HS256 e assimétrico | a bancada manda o JWT em `Authorization` e a chave publishable em `apikey` |
| Barreira por lista manual `['ia','routes']` e regex de fornecedores | C | `architecture.test.ts:759-778` | — |
| `apple` é vocabulário de domínio no sono | C | `grep -rli apple packages/shared/src/sleep` → 7 arquivos (score, awakenings, retro, markers…) | nenhuma palavra da lista nova (qwen, llama, mlx…) aparece em `sleep/` fora de comentário |
| Duas cópias do cliente da `ia-narrar` com truncagem diferente | C | `edicao-ia.ts:49-50` lança; `route-name.ts:71` repassa | — |
| `ChamadorDeModelo` em `routes/nomear.ts` | C | `nomear.ts:36` (tipado com `PromptDeNome`, e vai precisar generalizar) | — |
| `toFixed` da percepção em `score.ts` | C | `score.ts:498` `noteAvg.toFixed(1)` | — |
| `formatarNumero`, `local-store.ts` (AsyncStorage), `sync-breadcrumbs.ts` | C | `ia/prompt.ts`; `mobile/src/lib/local-store.ts:5`; `mobile/src/lib/sync-breadcrumbs.ts` | — |
| Vocabulário proibido (conselho, causa, placar) já tem dono em `ia/verificar.ts` | E | `verificar.ts`: só a lista `CAUSA` | V-6 |
| Espinha da revista AD-12/13/14 como citadas | C | `architecture-Orbe-revista-2026-09-08/ARCHITECTURE-SPINE.md:333-390` | — |
| ADRs 0036, 0038, 0040, 0041 e 0042 aceitas; regra 4 da 0036 | C | `docs/decisions/*` (Status: aceita); 0036 §"As seis regras", item 4 | — |
| Workspace de scripts ainda não existe | C | `pnpm-workspace.yaml`: só `packages/*`, `web`, `mobile` | coerente com a AD-11 |
| Spotlight como ferramenta (Deferred) | C | WWDC26 241: *"a search tool powered by Spotlight for implementing fully local Retrieval-Augmented Generation"* | é iOS 27, o mesmo portão do Core AI |

### A sonda no Mac, reproduzida

`swift fm_probe.swift`, rodado num diretório temporário:

```
availability: available
isAvailable: true
contextSize: 4096
supportsLocale pt_BR: true
supportedLanguages count: 23
```

Bate linha a linha com a entrada "MEDIDO NO MAC" do memlog. Não gerei texto.

---

## O que não pude verificar

- **Mac = iPhone.** Não sei se o modelo do macOS 26.6.2 é o mesmo do iOS do iPhone 17 Pro. Nem sei qual
  iOS o telefone roda hoje.
- **Erros no iOS 27.** Não sei qual tipo de erro (`GenerationError` ou `LanguageModelError`) um binário
  feito com Xcode 26.6 recebe no iOS 27. Isso só se prova no aparelho, depois de atualizar: provocar um
  estouro de janela e um guardrail e ver o que chega.
- **Janela no iPhone 17 Pro.** Não sei qual `contextSize` o iPhone 17 Pro terá no iOS 27. A WWDC mostra
  8.192 numa amostra e sugere dependência de hardware.
- **Expo e Xcode 27.** Não sei se a Expo SDK 57 compila com o Xcode 27. A EAS não oferece imagem 27 para
  o `sdk-57`, e o `expo@58` ainda é canary (58.0.0-canary-20260909).
- **Peso fraco do framework.** Não sei se o `FoundationModels` fica fracamente ligado sem
  `weak_frameworks` com alvo 16.4. O pacote da Callstack faz o mesmo com alvo 15.1 e sem
  `weak_frameworks`, o que é indício de que funciona. Só um aparelho abaixo do iOS 26 provaria, e o
  único aparelho do dono é um iPhone 17 Pro, então o risco é teórico.
- **Números de produção.** Não re-rodei os 85% / 15% das janelas da AD-7 (dado de saúde em produção,
  fora da lente). Estão coerentes com a entrada "MEDIDO EM PRODUÇÃO" do memlog.
- **Versão deployada.** Não sei se a `ia-narrar` v5 é byte a byte o `index.ts` do HEAD. O último deploy é
  de 07/09 15:17 UTC, compatível com o último commit que a toca (`acf10c8`, 07/09).

## Uma observação fora da lente

A AD-5 permite recuo "para regime igual", e nuvem → nuvem é regime igual. Com a AD-9 abrindo vários
motores de nuvem, uma cadeia `nuvem:google/… → nuvem:outro/…` reintroduz o **"multi-provedor ativo
(fallback automático)"** que a ADR 0040 rejeitou em "Alternativas". Vale a espinha dizer se isso é uma
superação intencional.

## Experimentos, para reproduzir

Todos rodaram no scratchpad da sessão, fora do repositório:

1. `swift fm_probe.swift`: a sonda de disponibilidade.
2. SwiftPM com `path:` fora da raiz: dá erro; com symlink, compila e roda.
3. `LanguageModelError` sob `#if canImport(FoundationModels)`: dá erro; sob `#if compiler(>=6.4)`,
   compila.
4. `#available(iOS 26.4, *)` com `tokenCount` num alvo macOS 26.0: dá erro.
5. Pacote com mínimo macOS 27 como dependência de um alvo macOS 26: o SwiftPM recusa.
