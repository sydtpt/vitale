<!-- bmad:context -->
<!-- Verificado em 2026-08-17 contra b8de47e. Mantido por bmad-project-context;
     edições dentro deste bloco são substituídas no refresh. -->

## mobile (@vitale/mobile)

App Expo / React Native. Rotas file-based (Expo Router) em `src/app/`, stores Zustand em
`src/store/`. Regras gerais do repositório: `../AGENTS.md`.

## Running and verifying

- Valide com `cd mobile && npx tsc --noEmit && npx jest` (37 suítes, 377 testes hoje).
- `npm run lint` falha: `eslint` não está instalado.
- Teste de lógica pura mora em `src/lib/__tests__/*.test.ts`; 16 deles exercitam
  `@vitale/shared`, que o jest daqui resolve. O shared também tem teste próprio — ver
  `packages/shared/AGENTS.md`.

## Conventions that differ from defaults

- Não importe `react-native-reanimated`: desde o SDK 55 ele não está nem na árvore
  (o `overrides` da raiz fixa a RN, e o peer da 4.1.7 para na 0.82) — anime com
  `Animated` do React Native. Ver [ADR 0010](../docs/decisions/0010-sem-reanimated-no-mobile.md)
  e [ADR 0015](../docs/decisions/0015-overrides-fixam-copia-unica-e-versao-dos-patches.md).

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
- **Regenere o lockfile ao mudar `overrides`.** O npm ignora `overrides` novo
  contra lockfile existente — verificado na Fase 2. `rm package-lock.json` e
  reinstale, depois confira que há **uma** cópia de cada:
  `ls node_modules/react-native mobile/node_modules/react-native`.
- Cópia duplicada de `react` ou `react-native` não falha o build: falha o `tsc`
  (duas árvores de tipos) ou o app em runtime (dois Reacts, "Invalid hook call").

## Diagnóstico de sync em background

`src/lib/sync-breadcrumbs.ts` grava um log curto e persistente, lido em
Configurações → Dados. Existe porque o sync em background roda sem UI, sem
depurador e sem `console.log` alcançável — ver [ADR 0013](../docs/decisions/0013-background-do-healthkit-exige-patch-na-lib.md).
Ao investigar "não sincronizou", olhe o log antes de supor onde quebrou.
