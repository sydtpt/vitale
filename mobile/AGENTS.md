<!-- bmad:context -->
<!-- Verificado em 2026-08-17 contra b8de47e. Mantido por bmad-project-context;
     edições dentro deste bloco são substituídas no refresh. -->

## mobile (@vitale/mobile)

App Expo / React Native. Rotas file-based (Expo Router) em `src/app/`, stores Zustand em
`src/store/`. Regras gerais do repositório: `../AGENTS.md`.

## Running and verifying

- Valide com `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` (37 suítes, 379 testes hoje).
- `pnpm lint` falha no mobile: `eslint` não está instalado.
- Teste de lógica pura mora em `src/lib/__tests__/*.test.ts`; 16 deles exercitam
  `@vitale/shared`, que o jest daqui resolve. O shared também tem teste próprio — ver
  `packages/shared/AGENTS.md`.

## Conventions that differ from defaults

- Não importe `react-native-reanimated`, **mesmo estando instalado**: anime com
  `Animated` do React Native. Desde o SDK 56 ele está na árvore de novo porque o
  `expo-router` depende de `react-native-drawer-layout`, que o exige como peer
  obrigatório — ou seja, "está lá" não é sinal de que o projeto o adotou. A
  decisão de não usá-lo segue de pé: [ADR 0010](../docs/decisions/0010-sem-reanimated-no-mobile.md).
  Ele e o `react-native-worklets` ficam pinados nas versões que o SDK ativo
  publica; resolver por conta própria quebra o peer do `expo-modules-core`.
- Não declare `react-native-worklets/plugin` no `babel.config.js`: o
  `babel-preset-expo` já o adiciona sozinho quando o pacote está instalado.
- **`mobile/src/lib/motores/` é o único lugar do app que pode nomear a
  `ia-narrar`** — e o único que constrói transporte para ela. Quem precisa falar
  com modelo pede um motor ao `motorPara` de lá e passa pelo `ler` do orquestrador
  (`@vitale/shared`), que já sabe montar o pedido, recuar, conferir e cair no
  piso. É o que impede o quarto cliente da function: o app já teve dois, cada um
  lendo o erro do seu jeito — e nos dois o ramo que lia o corpo de erro era
  código morto, porque o cliente da function **lança** em todo não-2xx.
  `lib/edicao-ia.ts` não fala mais com a `ia-narrar` (a impressão usa o
  `motorPara` daqui); sobra `services/route-name.ts`, que sai na 5.7. A catraca
  "uma porta por hospedeiro" do `architecture.test.ts` cobra, com teto 1.
  Na mesma pasta: o prazo de 60 s da chamada, o catálogo de motores conhecidos, a
  preferência por recurso (`vitale:motores-preferencia`) e o anel de diagnóstico,
  que é memória e nunca sai do aparelho.
- **O catálogo de motores não é mais uma constante** (5.6). Parte dele vem do
  servidor: a lista de motores de nuvem aprovados por recurso (ADR 0048), lida por
  `GET ia-narrar` e cacheada com instante. Use `catalogoDoRecurso(recurso)` de
  `lib/motores/` — nunca `idsConhecidos` direto — antes de chamar `resolverCadeia`:
  o id que só a lista conhece seria descartado calado, e a escolha do dono viraria
  o padrão sem nada explicando. Falha na leitura custa **só** as variantes
  nomeadas: `sem-modelo`, `aparelho:sistema` e `nuvem:padrao` continuam de pé.
- **A ponte do aparelho é um módulo Expo local, `mobile/modules/on-device-engine/`**
  (5.9, ADR 0047), e o nome nativo dele é **`OnDeviceEngine`** — o `Name(…)` da cola, o
  que `mobile/src/lib/motores/index.ts` carrega e o que a guarda (1) reconhece. Só
  aquela pasta o carrega, numa chamada, e **sempre por `requireOptionalNativeModule`**:
  sem o módulo (o jest, um build anterior à 5.9) ele devolve `null` e o aparelho é
  `indisponivel`; `requireNativeModule` lançaria, e é barrado em todo `mobile/src`. O
  simulador de um build desta branch **tem** o módulo (o autolinking é o mesmo); fora do
  iOS o aparelho aparece com motivo próprio ("só existe no iPhone").
  A cola `OnDeviceEngineModule.swift` **só repassa** ao `Engine.swift` (`responder`,
  `diagnostico`) — sem `catch`, sem literal de classe, sem decisão, só
  `import ExpoModulesCore`, e com os nomes exatos de `FUNCOES_DA_PONTE`. A tradução e a
  tabela erro → classe moram no `Engine.swift`, que a bancada compila e testa no Mac. O
  módulo tem **dois `.swift`, numa lista fechada** (Engine e cola), e
  `PrivateCloudComputeLanguageModel` em **lugar nenhum** dele: no iPhone, sem o
  entitlement gerenciado `com.apple.developer.private-cloud-compute`, o framework derruba
  o app em vez de devolver erro — foi provado e o experimento saiu em 19/09 (emenda da ADR
  0047). Se o PCC voltar um dia, é `nuvem:`, nunca a ponte. E **nenhum `.ts`/`.js` dentro
  de `mobile/modules/`**: seria uma porta para a ponte fora da vista das guardas. Tudo isso são barreiras do `architecture.test.ts`. O
  seletor lê a disponibilidade do diagnóstico da ponte (`ponteDoAparelho`), relido ao
  focar a tela e ao voltar ao primeiro plano enquanto não disser "disponível".
- **Mexer em `mobile/modules/` muda o binário — sobe o `runtimeVersion` junto.** A
  barreira do runtime calcula o sha256 dos fontes do módulo e o compara com a última
  entrada de `mobile/modules/runtime.json`, que tem de ser o `runtimeVersion` do
  `mobile/app.base.json`. Para atualizar: suba o `runtimeVersion` do `app.base.json`,
  rode `pnpm --filter @vitale/shared test` — a falha imprime o hash de hoje — e
  **acrescente** ao fim do `historico` `{ "runtimeVersion": "<o novo>", "fontes":
  "<o hash>" }`. O histórico não aceita runtime nem hash repetido. Só enquanto um runtime
  nunca foi entregue (nenhum build instalado, nenhum `eas update`) vale trocar o hash da
  última entrada no lugar em vez de acrescentar — e isso é decisão sua, visível no diff.
  Build próprio, e nenhum `eas update` com código da ponte vai ao runtime anterior.
- **Não chame as funções de um descritor** (`montarPedido`, `interpretar`,
  `conferir`, `montarFrase`, `semModelo`, `pedidoCurto`) de dentro de uma tela ou
  de um serviço: essa sequência existe uma vez só, no orquestrador. Uma barreira
  do `architecture.test.ts` cobra por AST, então nem colchete nem desestruturação
  passam.

<!-- /bmad:context -->

## Build local para device (fora da EAS)

**Use `pnpm mobile:device`.** O script `mobile/scripts/ios-device.sh` faz build
Release, instala e abre, com todas as pegadinhas abaixo já codificadas — inclusive
pular o prebuild quando nada nativo mudou e repetir o install quando o túnel cai.
`--build-only`, `--no-launch`, `--prebuild` e `--device <id|udid|nome>` ajustam os
passos; `--help` mostra tudo.

A receita crua continua aqui porque ela documenta o **porquê**, e o script só
executa. A [ADR 0009](../docs/decisions/0009-ios-versionado-workflow-bare.md)
registrou a base; o que segue são as pegadinhas que só apareceram depois da
[ADR 0012](../docs/decisions/0012-kingstinct-healthkit-devolve-o-prebuild.md),
quando `mobile/ios/` passou a ser gerado.

```bash
cd mobile && pnpm exec expo prebuild --platform ios --clean
cd ios && xcodebuild -workspace Orbe.xcworkspace -scheme Orbe \
  -configuration Release -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates build
xcrun devicectl device install app --device <UDID> <caminho>/Orbe.app
```

- **Nunca entregue com o Metro na LAN.** `expo run:ios`, `expo start` e
  `pnpm mobile:ios` são Debug: o JS vem do dev server e o app só funciona dentro
  de casa. Entrega é sempre Release, que é autocontido.

- **Não use `expo run:ios --configuration Release`**: não passa a flag de
  provisioning e quebra na assinatura — depois de já ter feito o bundle do JS.
- **Nunca `xcodebuild | tail`** sem `set -o pipefail`. O status vira o do `tail`
  e um build quebrado passa por bem-sucedido.
- **O iPhone precisa estar desbloqueado** no `install`, senão falha em
  `kAMDMobileImageMounterDeviceLocked`. O build em si não precisa do aparelho.
- **Com o Xcode 27, o app só abre com o ciclo por cena.** Sem o plugin
  `plugins/withUISceneLifecycle.js`, ele compila, instala e morre ao abrir, em
  `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`
  ([ADR 0051](../docs/decisions/0051-o-app-adota-o-ciclo-por-cena-porque-o-sdk-27-o-exige.md)).
  O plugin não move a criação da janela para a cena: o lançamento em background
  do HealthKit não tem cena, e é ele que precisa do JS de pé.
- **`pnpm install` pode quebrar o build sem mudar config nenhuma.** O
  `Podfile.lock` guarda o caminho de cada módulo nativo com a versão do pnpm no
  nome; troca de versão apaga o diretório e o Xcode para em `CpResource … No such
  file or directory`. O script regera sozinho quando um caminho sumiu; na mão,
  é `--prebuild`.
- **O `devicectl` do Xcode 27 lista os simuladores como pareados.** O script
  filtra só aparelho físico; na receita crua, use o identificador do iPhone.
- `DEVELOPMENT_TEAM` some a cada `prebuild` (o projeto Xcode é gerado). O plugin
  `plugins/withDevelopmentTeam.js` repõe; aceita override por `APPLE_TEAM_ID`.
- O canal de OTA vinha da EAS. Sem ela, `updates.requestHeaders` no app config é
  o que mantém `eas update` alcançando o build — sem isso, toda mudança de JS
  vira rebuild nativo.
- Direcione o `-derivedDataPath` para fora de `~/Library/Developer/Xcode`: cada
  build limpo custa ~7 GB e o acúmulo já estourou o disco aqui.

## Subir o Expo SDK

Desde a [ADR 0016](../docs/decisions/0016-pnpm-isolado-substitui-npm-workspaces.md)
o gerenciador é pnpm com resolução isolada, e o ritual encolheu — não há mais
`overrides` para manter em dia:

```bash
# 1. bump do `expo`   2. alinhar o resto pelo SDK
pnpm add expo@~<versao>
pnpm exec expo install --fix && pnpm exec expo install --fix -- --save-dev
pnpm install
```

- **O `--fix` reescreve versões depois do install**, então rode `pnpm install` no
  fim para o lockfile refletir o que ele decidiu.
- **Dependência nova precisa ser declarada no workspace que a usa.** Sob
  isolamento não existe carona: se o SDK passar a exigir um pacote que os config
  plugins ou os testes importam, ele entra no `mobile/package.json`. Os config
  plugins importam de `expo/config-plugins` (sub-export do `expo`), **não** de
  `@expo/config-plugins` — o `expo-doctor` reprova a segunda forma.
- **Patch entra em `patchedDependencies`** no `pnpm-workspace.yaml`, com chave por
  **faixa** de versão. Versão exata que deixa de casar é pulada em silêncio;
  faixa faz o pnpm tentar aplicar e falhar alto se o conteúdo mudou. Patch
  declarado que não aplicou derruba o install.
- **`pnpm dlx expo-doctor` está em 21/21 e o CI o bloqueia.** Foi ele que apontou os
  plugins que o SDK passou a exigir, o `@react-navigation` incompatível com o
  expo-router 56, a regressão do Hermes V1 e o `@expo/config-plugins` importado do
  lugar errado — nenhum aparece em `tsc`
  ou teste. Falha nova dele é sinal, não ruído: o único falso positivo que ele
  tinha (o app config) foi eliminado renomeando `app.json` para `app.base.json`,
  que o `app.config.js` importa — a config resolvida é idêntica.
- **Os 3 portões em device continuam sendo o portão de verdade** (ver o plano de
  migração). Passar nos três ainda não garante a feature toda: no SDK 57 o
  `saveToLibraryAsync` da `expo-media-library` passou a **lançar** em runtime e
  derrubou a exportação do share composer, com build, `tsc` e 379 testes verdes.

## Tema: duas armadilhas que já custaram caro

**O fundo da navegação não é o `contentStyle`.** O `Stack` aceita
`contentStyle: { backgroundColor: 'transparent' }`, mas isso governa só o
CONTEÚDO da tela. O container nativo da pilha é pintado à parte, com o
`colors.background` do tema de navegação (`nativeContainerStyle` em
`NativeStackView.native.js` do expo-router) — `rgb(242,242,242)` no
`DefaultTheme`, opaco. Enquanto ele não for transparente, **nenhuma camada
desenhada atrás da navegação aparece**: foi assim que os papéis de parede
ficaram invisíveis, com todo o resto correto. Ver o `NavThemeProvider` em
`src/app/_layout.tsx`.

**`BlurView` com `tint="default"` segue o SISTEMA, não o app.** É
`UIBlurEffectStyleRegular`, que lê a trait collection do iOS. Isso passou
despercebido enquanto `userInterfaceStyle` era `light` no app config e travava o
app em claro; virou defeito no instante em que passou a `automatic`. Use as
variantes de aparência fixa — `systemChromeMaterialLight` / `…Dark` — escolhidas
pelo esquema do app.

## Cor: onde ela pode e onde não pode nascer

Cor nasce em `packages/shared/src/theme` e chega por `resolveTokens()` /
`moduleOf()`. Quatro eixos independentes: **tema** (neutros), **esquema**
(claro/escuro), **paleta** (módulos e séries) e **marca** (o cromo — FAB, CTA,
toggle).

- **Não leia tema no escopo do módulo.** `colors`, `MOD`, `moduleColors()` e as
  constantes históricas do núcleo (`surfaces`, `ink`, `brand`, `accents`, `T`)
  resolvem no momento da leitura; num `StyleSheet.create` de módulo isso é o
  import, e a folha congela. Embrulhe em `themed(() => …)` ou use
  `useThemedStyles`. `architecture.test.ts` cobra.
- **Eixo novo entra em dois lugares:** nas dependências do `useThemedStyles` e em
  `themedCacheKey()`. Esquecer um faz a tela não mudar, sem erro nenhum.
- **Dentro de um chip, use `onTint`, não `accent`.** Sobre o preenchimento cheio
  da marca, use `onPrimary`. O par `accent` sobre `tint` chegou a medir 1,55 de
  contraste no amarelo.

## Diagnóstico de sync em background

`src/lib/sync-breadcrumbs.ts` grava um log curto e persistente, lido em
Configurações → Dados. Existe porque o sync em background roda sem UI, sem
depurador e sem `console.log` alcançável — ver [ADR 0013](../docs/decisions/0013-background-do-healthkit-exige-patch-na-lib.md).
Ao investigar "não sincronizou", olhe o log antes de supor onde quebrou.
