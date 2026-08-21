# Guia de upgrade de plataforma

> Como subir o Expo SDK / React Native no Orbe. Derivado da espinha
> ([AD-14 a AD-18](../_bmad-output/planning-artifacts/architecture/architecture-Orbe-2026-08-17/ARCHITECTURE-SPINE.md))
> e do que a migração 54 → 57 custou na prática, em 20–21/08/2026.
>
> **Público:** você daqui a alguns meses, ou um agente. Escrito para quem não
> tem o contexto fresco.

## Quando subir

Um release *stable* atrás do mais novo (AD-16). A Expo solta SDK a cada ~4 meses
e mantém as três últimas — N-1 deixa folga e evita ser cobaia.

**A exceção que precisa ser lembrada:** se o release mais novo corrigir um
defeito que afeta o app, sobe direto. Não é hipótese — o SDK 56 carrega a
regressão de memória do Hermes V1, corrigida só no 57. Ficar em N-1 naquele
momento significaria sentar em cima do defeito. O `expo-doctor` acusa esse tipo
de coisa; leia as falhas dele antes de decidir a versão alvo.

## A ordem que funciona

```bash
pnpm add expo@~<versao>
pnpm exec expo install --fix && pnpm exec expo install --fix -- --save-dev
pnpm install
```

O `expo install --fix` reescreve as versões *depois* do install, então o
`pnpm install` final é o que faz o lockfile refletir o que ele decidiu.

Este bloco já foi bem maior. Sob npm, era preciso subir `react` e `react-native`
num `overrides` da raiz no mesmo commit, e regenerar o lockfile na ordem certa —
errar produzia duplicatas que não falhavam o build, só o `tsc` ou o app em
runtime. A [ADR 0016](decisions/0016-pnpm-isolado-substitui-npm-workspaces.md)
eliminou a classe inteira: sob resolução isolada não há árvore plana onde dois
workspaces colidam.

**O que passou a exigir atenção no lugar:** dependência nova precisa ser
declarada no workspace que a usa. Não existe mais carona. Se o `tsc` reclamar de
um módulo que "sempre esteve lá", quase certamente ele nunca foi declarado —
declare, não haste.

## Validar os três workspaces

Não só o que motivou a mudança. O lockfile é compartilhado, então uma troca
feita pelo mobile chega no web e no shared (AD-17).

O `.github/workflows/ci.yml` roda exatamente isto a cada push — mas rode local
antes de empurrar um upgrade, porque o ciclo de ida e volta pelo CI é lento e um
upgrade costuma quebrar em vários lugares de uma vez.

```bash
pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test
pnpm --filter @vitale/web build && pnpm --filter @vitale/web test
cd mobile && pnpm exec tsc --noEmit && pnpm exec jest && pnpm dlx expo-doctor
```

Foi exatamente esse passo que faltou: os testes do mobile rodaram o tempo todo e
o build do web quebrou assim mesmo, porque o TypeScript 6 que veio com o SDK 57
foi hasteado para a raiz e o `@angular/compiler-cli` passou a resolvê-lo.

**Leia as falhas novas do `expo-doctor`.** Foi ele que apontou os plugins que o
SDK passou a exigir, o `@react-navigation` incompatível com o expo-router 56 e a
regressão do Hermes. Nada disso aparece em `tsc` nem em teste.

## Os patches

Dois, e os dois são frágeis por construção (AD-18):

| Patch | O que sustenta | Se cair |
| --- | --- | --- |
| `@kingstinct/react-native-healthkit` | entrega em background do HealthKit ([ADR 0013](decisions/0013-background-do-healthkit-exige-patch-na-lib.md)) | não quebra build nem teste — **para de chegar dado** |
| `@supabase/supabase-js` | neutraliza o `import()` de OpenTelemetry que o Metro não resolve | erro de bundle, longe da causa |

Ambos vivem em `patchedDependencies`, no `pnpm-workspace.yaml`, com chave por
**faixa** de versão. Se o pacote subir dentro da faixa, o pnpm tenta aplicar e
falha alto se o conteúdo mudou; se sair da faixa, o patch fica sem uso e o
install cai do mesmo jeito. Em nenhum caminho o patch some calado — que era o
risco real sob `patch-package`.

Se o `@kingstinct/react-native-healthkit` mudar de versão, **reverifique em
device**. Reaplicar não basta: o que se perde é invisível em build e em teste.

## O portão de verdade é o aparelho

Compilar e instalar por cabo (a receita completa e as pegadinhas estão em
[`mobile/AGENTS.md`](../mobile/AGENTS.md)):

```bash
cd mobile && pnpm exec expo prebuild --platform ios --clean
cd ios && xcodebuild -workspace Orbe.xcworkspace -scheme Orbe \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath <fora-de-~/Library> -allowProvisioningUpdates build
xcrun devicectl device install app --device <UDID> <caminho>/Orbe.app
```

Suba o `runtimeVersion` no `app.base.json` — é mudança nativa.

**Os três portões:**

1. App abre; telas, navegação e mapas funcionam.
2. Aba Saúde popula (leitura do HealthKit sob demanda).
3. **Sync em background com o app fechado.** Feche o app, gere um treino no
   Apple Health, espere. Confirme nos dois lugares: o log em Configurações →
   Dados (`sync-breadcrumbs`) e o `created_at` em `activities` no Supabase.

### Os três portões não bastam

Esta é a lição mais cara da migração 54 → 57, e vale repetir porque contraria a
intuição de "está tudo verde".

Os três portões passaram — e a exportação de imagem estava quebrada. O
`saveToLibraryAsync` da `expo-media-library` passou a **lançar** em runtime no
SDK 57. Build verde, `tsc` verde, 379 testes verdes, feature morta.

É a terceira vez que essa forma de falha aparece nesta base: a entrega em
background (ADR 0013), o patch do supabase aplicado na cópia errada, e a
galeria. **Ao subir SDK, exercite também as features que tocam API de
plataforma:** exportar e compartilhar, galeria, câmera, notificações.

## Se algo quebrar e você não souber de onde veio

- **Sync em background:** o log em Configurações → Dados, antes de qualquer
  suposição. Ele separa "o iOS não acordou o app" de "acordou e não achou nada".
- **Regressão que pode ser anterior:** monte um worktree no commit de antes e
  compare, em vez de deduzir. Foi assim que se provou que o build do web tinha
  quebrado na migração e não era dívida antiga:

  ```bash
  git worktree add --detach /tmp/pre <commit-de-antes>
  cd /tmp/pre && pnpm install && pnpm --filter @vitale/web build
  ```

- **Não subiu um degrau de cada vez?** Aí não dá para separar as causas. Se
  pulou SDKs, volte ao commit do degrau do meio e teste isolado.
