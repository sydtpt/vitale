---
title: 'Splash usa a arte do ícone do app'
type: 'bugfix'
created: '2026-08-18'
status: 'done'
baseline_commit: 'f79a0ffbb2c9689d460096f5ee2902af978e351b'
review_loop_iteration: 0
context:
  - '{project-root}/docs/decisions/0009-ios-versionado-workflow-bare.md'
  - '{project-root}/mobile/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No cold start o app mostra um quadrado laranja chapado 200×200 — o `splash-icon.png` placeholder do template Expo, nunca substituído — em vez da marca Orbe que já é o ícone. O sintoma é intermitente porque `_layout.tsx:14` segura a splash até as fontes carregarem: fonte quente, o quadrado passa batido; fonte fria, fica na tela.

**Approach:** Apontar a splash para `assets/images/icon.png` e regenerar os assets nativos que o storyboard de fato desenha. A chave `splash` do `app.json` é consumida em *prebuild*, não em runtime — editá-la sozinha não corrige nada. Como `expo prebuild` no repo apagaria a edição manual do `AppDelegate.swift` (ADR 0009), o prebuild roda numa cópia descartável e só o imageset gerado volta para `mobile/ios/`.

## Boundaries & Constraints

**Always:**
- Bytes que entram em `mobile/ios/` vêm do `expo prebuild`, nunca desenhados à mão — é o que preserva o espírito do ADR 0009.
- Prebuild roda só no scratchpad, sobre cópia de `mobile/` sem `ios/`.
- `AppDelegate.swift` byte-idêntico ao final — a linha 32 é a razão do workflow bare.
- Diff em `mobile/ios/` limitado a `SplashScreenLegacy.imageset/`.

**Ask First:**
- Prebuild gerou o formato novo (`SplashScreenLogo.imageset` + storyboard reescrito) em vez do legacy: HALTAR — migrar de formato é decisão nativa maior que este fix.
- `SplashScreen.storyboard` gerado diverge do versionado além do `width`/`height` do `<image>` em `<resources>` (metadado cosmético): HALTAR e mostrar o diff.

**Never:**
- Rodar `npx expo prebuild` dentro de `mobile/`.
- Tocar em `ios/Pods/`, `ios/build/` ou no `.xcodeproj`.
- Bumpar `runtimeVersion`: o contrato JS↔nativo não muda e o bump orfanaria a lane OTA `preview` à toa.
- Mexer em `AppIcon.appiconset` ou `adaptive-icon.png`. Não há `android/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cold start pós-rebuild | App morto, binário novo | Marca Orbe aspect-fit sobre `#FFF7EE`; funde com o fundo porque o `icon.png` já tem esse cream | N/A |
| Fonte fria segura a splash | `preventAutoHideAsync()` ativo até `_layout.tsx:32` | Marca Orbe pelo tempo extra — sem quadrado laranja em nenhum instante | N/A |
| Só `eas update`, sem rebuild | Binário antigo + JS novo | Splash **segue** a antiga: o asset é nativo. Esperado, não é regressão | Avisar que exige rebuild |

</frozen-after-approval>

## Code Map

- `mobile/app.json:16-20` — bloco `splash`; linha 17 é a **única** referência a `splash-icon.png` no repo (grep confirmado). `resizeMode: contain` e `backgroundColor: #FFF7EE` já corretos.
- `mobile/assets/images/icon.png` — 1024×1024, 56740 B, marca Orbe sobre `#FFF7EE`. Novo alvo. Byte-idêntico a `adaptive-icon.png`.
- `mobile/assets/images/splash-icon.png` — 200×200, 593 B, quadrado laranja, 19/mai. A remover.
- `mobile/ios/Vitale/Images.xcassets/SplashScreenLegacy.imageset/` — `image.png`, `image@2x.png`, `image@3x.png`, todos 200×200 / 538 B, assados 20/mai; `Contents.json` com `"author": "expo"`. **É o que a tela realmente mostra.** Os 4 versionados.
- `mobile/ios/Vitale/SplashScreen.storyboard` — `imageView` com `image="SplashScreenLegacy"`, `scaleAspectFit`, ancorado nas 4 bordas, fundo `SplashScreenBackground`. Read-only salvo o gate acima.
- `mobile/ios/Vitale/Images.xcassets/SplashScreenBackground.colorset` — já `rgb(255,247,238)`. Read-only.
- `mobile/ios/Vitale/AppDelegate.swift:32` — `RCTAppleHealthKit().initializeBackgroundObservers(bridge)`, protegida pelo ADR 0009. Verificar intacta ao final.
- `mobile/src/app/_layout.tsx:14,32` — `preventAutoHideAsync()` / `hideAsync()`; explica a intermitência. Sem mudança.
- `mobile/.gitignore` — ignora `ios/Pods/`, `ios/build/`, xcuserdata; o resto de `ios/` é versionado (23 arquivos).

## Tasks & Acceptance

**Execution:**
- [x] `mobile/app.json` — trocar `splash.image` para `./assets/images/icon.png`; preservar `resizeMode` e `backgroundColor`.
- [x] `<scratchpad>/splash-prebuild/` — copiar `mobile/` sem `ios/`, `node_modules/`, `.expo/`; ligar `node_modules` ao hoisted da raiz.
- [x] `<scratchpad>/splash-prebuild/` — `npx expo prebuild -p ios --no-install`; confirmar que saiu `SplashScreenLegacy.imageset`, senão HALTAR.
- [x] `mobile/ios/Vitale/Images.xcassets/SplashScreenLegacy.imageset/` — copiar os 3 PNGs + `Contents.json` gerados por cima dos atuais.
- [x] `mobile/ios/Vitale/SplashScreen.storyboard` — diffar contra o gerado; transplantar só se a divergência for o `width`/`height` do `<image>`.
- [x] `mobile/assets/images/splash-icon.png` — deletar; sem referências após a task 1.
- [x] `<scratchpad>/splash-prebuild/` — remover ao final.
- [x] `mobile/src/lib/__tests__/splash-assets.test.ts` — guard de regressão (fora do plano original; ver Change Log).

**Acceptance Criteria:**
- Dado o repo pós-fix, quando `grep -rn "splash-icon" mobile/`, então zero resultados e o arquivo não existe.
- Dado o imageset transplantado, quando `sips -g pixelWidth` nos 3 PNGs, então 1024×1024 em cada (não mais 200×200).
- Dado `git diff --stat mobile/ios/`, então só `SplashScreenLegacy.imageset/` aparece.
- Dado `git diff mobile/ios/Vitale/AppDelegate.swift`, então saída vazia.
- Dado `mobile/app.json`, então `runtimeVersion` segue `"1.0.0"`, casando com `EXUpdatesRuntimeVersion` no `Expo.plist`.

## Spec Change Log

- 2026-08-19 — Execução. Dois achados que não alteram o intent:
  - `SplashScreen.storyboard` gerado saiu **byte-idêntico** ao versionado (o `<image
    name="SplashScreenLegacy" width="414" height="736"/>` é fixo no template do Expo, não
    derivado do PNG). Nenhum transplante foi necessário; o gate do "Ask First" não disparou.
  - O prebuild na sandbox gera `ios/Orbe/` (nome do app), não `ios/Vitale/` (nome histórico
    do projeto versionado). Só o `SplashScreenLegacy.imageset/` atravessou, então a diferença
    de pasta não vaza para `mobile/ios/`.
  - `.env` foi excluído da cópia para a sandbox (não listado no spec): `app.config.js` tem
    fallback `?? ''` para as vars do Supabase e prebuild não as consome.

- 2026-08-19 — Matrix Test Audit. As 3 linhas da I/O Matrix descrevem launch screen nativo e
  **não são cobríveis por teste local** — defeito de planejamento meu (o template mandava
  deletar a seção quando não há I/O real). Decisão do Sydnei: manter as linhas como verificação
  de device e adicionar um guard de regressão. `splash-assets.test.ts` cobre o que *é* local:
  - `splash.image === icon` — teria pego o bug original. Provado em vermelho contra `f79a0ff`.
  - dimensão do imageset nativo == dimensão da arte de origem — pega o *drift* (config trocada,
    imageset não regenerado), que é como o bug reincide. Provado em vermelho no cenário
    `app.json` corrigido + imageset velho.
  - Limite honesto: o teste de dimensão **não** teria pego o estado original, onde origem e
    nativo eram consistentemente 200×200. Quem pega aquele caso é a asserção `splash.image === icon`.

- 2026-08-19 — **Correção: a afirmação acima sobre "pega o drift" estava errada.** O review
  provou empiricamente — trocou `image.png` por um PNG azul 1024×1024 e os 3 testes seguiram
  verdes. 1024×1024 é a dimensão de todo ícone de app, então igualdade de dimensão é satisfeita
  por construção para qualquer arte futura: o drift real (arte nova, imageset velho) passava
  despercebido. Guard reescrito:
  - Passou a ler `app.config.js` (a config que o Expo resolve) em vez de `app.json` cru — hoje
    coincidem, mas `app.config.js` espalha por cima e pode sobrescrever `splash`/`icon`.
  - Fechado com `ARTE_TRANSPLANTADA_SHA256`, hash fixado da arte que gerou o imageset. Trocar a
    arte falha o teste até rodar o prebuild em sandbox, transplantar e atualizar o hash. Falsificação
    do reviewer re-executada contra o guard novo: **agora falha**, como deve.
  - `pngSize` valida assinatura PNG; lista de arquivos derivada do `Contents.json` em vez de
    hardcoded; existência do imageset asseverada antes da leitura.
  - Byte-a-byte contra a origem não serve: o prebuild re-encoda (56740 B RGB → 65258 B RGBA).
  - `splash.image === icon` mantido, mas comentado no código como decisão reversível de produto,
    não invariante técnico — se a splash ganhar arte própria, é o teste que se ajusta.

- 2026-08-19 — `npx tsc --noEmit` ficou vermelho durante a execução, em
  `src/lib/healthkit-workouts.ts:93` e `src/store/fitness.store.ts:6`. **Não é deste fix:**
  passou com exit 0 nesta mesma sessão depois da implementação, e quebrou só quando uma sessão
  paralela modificou `healthkit-workouts.ts`. Nenhum dos dois arquivos está no diff deste spec.

## Design Notes

**Por que sandbox.** ADR 0009: `react-native-health` não tem config plugin, então prebuild limpo apaga os background observers do HealthKit — a razão de o app existir no pulso. O mesmo ADR proíbe editar `ios/` à mão. As duas regras colidem aqui; o sandbox satisfaz ambas.

**Por que `icon.png` e não sobrescrever o placeholder.** Fonte única, sem binário duplicado no git. O storyboard faz aspect-fit na tela inteira sobre `#FFF7EE`; como o `icon.png` tem esse mesmo cream de fundo, o planeta sai a ~60% da largura sem costura visível.

**Não sai por OTA.** Asset nativo: exige rebuild EAS (`preview`) ou o fallback por cabo do ADR 0009.

## Verification

**Commands:**
- `cd mobile && npx tsc --noEmit` — exit 0 (`npm run lint` da raiz está quebrado; ver AGENTS.md).
- `cd mobile && npx jest` — suíte verde, sem novas falhas.
- `cd mobile && npx expo config --type prebuild --json` — `splash.image` resolve para `assets/images/icon.png`.
- `git diff --stat mobile/ios/` — só `SplashScreenLegacy.imageset/`.

**Manual checks:**
- Abrir os 3 PNGs transplantados: marca Orbe, não quadrado laranja.
- A validação visual do cold start só acontece após rebuild nativo — nenhum comando local prova isso.

## Suggested Review Order

**A correção em si**

- A decisão inteira em uma linha: splash passa a compartilhar a arte do ícone.
  [`app.json:17`](../../mobile/app.json#L17)

- Quem realmente desenha o cold start — consome o imageset, não o `app.json`.
  [`SplashScreen.storyboard:20`](../../mobile/ios/Vitale/SplashScreen.storyboard#L20)

**O guard de regressão**

- O fecho de verdade: hash fixado da arte que gerou o imageset nativo.
  [`splash-assets.test.ts:25`](../../mobile/src/lib/__tests__/splash-assets.test.ts#L25)

- Lê a config que o Expo resolve, não o `app.json` cru que ela espalha.
  [`splash-assets.test.ts:9`](../../mobile/src/lib/__tests__/splash-assets.test.ts#L9)

- Decisão reversível de produto, marcada como tal — não invariante técnico.
  [`splash-assets.test.ts:58`](../../mobile/src/lib/__tests__/splash-assets.test.ts#L58)

- Lista derivada do manifesto: pega renomeio e variante dark de graça.
  [`splash-assets.test.ts:47`](../../mobile/src/lib/__tests__/splash-assets.test.ts#L47)

- Assinatura PNG validada: falha legível em vez de números de lixo.
  [`splash-assets.test.ts:36`](../../mobile/src/lib/__tests__/splash-assets.test.ts#L36)
