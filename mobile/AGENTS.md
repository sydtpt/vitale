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
