<!-- bmad:context -->
<!-- Verificado em 2026-08-17 contra b8de47e. Mantido por bmad-project-context;
     edições dentro deste bloco são substituídas no refresh. -->

## mobile (@vitale/mobile)

App Expo / React Native. Rotas file-based (Expo Router) em `src/app/`, stores Zustand em
`src/store/`. Regras gerais do repositório: `../AGENTS.md`.

## Running and verifying

- Valide com `cd mobile && npx tsc --noEmit && npx jest` (37 suítes, 379 testes hoje).
- `npm run lint` falha: `eslint` não está instalado.
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

Quando a cota da EAS acaba, o caminho é cabo. A [ADR 0009](../docs/decisions/0009-ios-versionado-workflow-bare.md)
registrou a receita base; o que segue são as pegadinhas que só apareceram depois
da [ADR 0012](../docs/decisions/0012-kingstinct-healthkit-devolve-o-prebuild.md),
quando `mobile/ios/` passou a ser gerado.

```bash
cd mobile && npx expo prebuild --platform ios --clean
cd ios && xcodebuild -workspace Orbe.xcworkspace -scheme Orbe \
  -configuration Release -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates build
xcrun devicectl device install app --device <UDID> <caminho>/Orbe.app
```

- **Não use `npx expo run:ios --configuration Release`**: não passa a flag de
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

O `overrides` do `package.json` da **raiz** fixa `react` e `react-native` na
versão que o SDK ativo pina ([ADR 0015](../docs/decisions/0015-overrides-fixam-copia-unica-e-versao-dos-patches.md)).
Ele não é opcional e não se descobre sozinho:

- **Suba `react` e `react-native` no `overrides` no mesmo commit do bump.** Sem
  isso o npm resolve a versão velha e o app compila contra a RN errada — sem erro
  de instalação.
- **Todo pacote com patch entra no `overrides` em versão exata**, igual ao nome do
  arquivo em `patches/`. O `postinstall` roda `patch-package --error-on-fail`, então
  um patch que parou de aplicar derruba o `npm install` em vez de avisar.
- **Regenere o lockfile por último, depois do `expo install --fix`.** O npm ignora
  `overrides` novo contra lockfile existente (Fase 2), e o `--fix` reescreve as
  versões **depois** do install — regenerar antes dele deixa `mobile/node_modules`
  com as versões velhas e as duplicatas voltam (Fase 3). A ordem que funciona:

  ```bash
  # 1. bump do `expo` + `overrides` da raiz   2. alinhar o resto
  npm install && npx expo install --fix && npx expo install --fix -- --save-dev
  # 3. só então regenerar
  rm -f package-lock.json && rm -rf node_modules */node_modules && npm install
  ```

  Depois confira que há **uma** cópia de cada: `ls node_modules/react-native
  mobile/node_modules/react-native`.
- Cópia duplicada de `react` ou `react-native` não falha o build: falha o `tsc`
  (duas árvores de tipos) ou o app em runtime (dois Reacts, "Invalid hook call").
- **`npx expo-doctor` está em 21/21 e o CI o bloqueia.** Foi ele que apontou os
  plugins que o SDK passou a exigir, o `@react-navigation` incompatível com o
  expo-router 56 e a regressão de memória do Hermes V1 — nenhum aparece em `tsc`
  ou teste. Falha nova dele é sinal, não ruído: o único falso positivo que ele
  tinha (o app config) foi eliminado renomeando `app.json` para `app.base.json`,
  que o `app.config.js` importa — a config resolvida é idêntica.
- **Os 3 portões em device continuam sendo o portão de verdade** (ver o plano de
  migração). Passar nos três ainda não garante a feature toda: no SDK 57 o
  `saveToLibraryAsync` da `expo-media-library` passou a **lançar** em runtime e
  derrubou a exportação do share composer, com build, `tsc` e 379 testes verdes.

## Diagnóstico de sync em background

`src/lib/sync-breadcrumbs.ts` grava um log curto e persistente, lido em
Configurações → Dados. Existe porque o sync em background roda sem UI, sem
depurador e sem `console.log` alcançável — ver [ADR 0013](../docs/decisions/0013-background-do-healthkit-exige-patch-na-lib.md).
Ao investigar "não sincronizou", olhe o log antes de supor onde quebrou.
