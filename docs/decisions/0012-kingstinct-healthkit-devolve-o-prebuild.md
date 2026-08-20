# 0012 — Troca para @kingstinct/react-native-healthkit devolve o prebuild

**Status:** aceita
**Data:** 2026-08-19

## Contexto

A ADR 0009 fixou `mobile/ios/` como versionado porque `react-native-health` não tinha config plugin do Expo: a entrega em background do HealthKit dependia de uma linha editada à mão em `AppDelegate.swift` (`RCTAppleHealthKit().initializeBackgroundObservers(bridge)`), e um `expo prebuild` limpo a apagaria.

A mesma ADR já registrava a saída limpa como disponível: "escrever um config plugin para react-native-health... custa escrever e manter o plugin". O plano de migração para Expo SDK 57 (`_bmad-output/planning-artifacts/plano-migracao-react-native.md`) tornou essa saída barata por outro caminho — troca de biblioteca, não plugin caseiro — porque `react-native-health` também reprova no `expo-doctor` para New Architecture (parado desde 15/10/2024, sem `codegenConfig`, módulo bridge legado) e o RN 0.82+ remove a arquitetura legada por completo.

`@kingstinct/react-native-healthkit` 14.x resolve as duas coisas: é um módulo Nitro (New Architecture nativa) **e** vem com config plugin. O plugin injeta `BackgroundDeliveryManager.shared.setupBackgroundObservers()` no `AppDelegate` gerado — um `HKObserverQuery` direto contra `HKHealthStore`, sem depender de `RCTBridge`. É relevante porque a ADR 0009 nomeou justamente essa dependência (`factory.bridge` podendo virar nil sob New Architecture) como o modo de falha silenciosa que motivava manter `ios/` sob controle manual.

## Decisão

`mobile/ios/` volta a ser gerado por `expo prebuild` — sai do git. O adaptador novo (`kingstinct-provider.ts`, atrás da porta `health-source/contract.ts` da Fase 1) substitui `legacy-provider.ts` como implementação ativa em `active.ts`; o antigo continua no repositório para rollback de uma linha.

## Alternativas rejeitadas

**Escrever um config plugin para `react-native-health`** (a saída que a 0009 já apontava). Resolveria o mesmo problema sem trocar de biblioteca, mas não resolve o risco de New Architecture — a lib seguiria sem `codegenConfig`, dependente da camada de interop que a equipe do RN mantém "por ora". Trocar de biblioteca custa uma reescrita de adaptador (já isolada pela porta da Fase 1); escrever e manter um plugin próprio custaria indefinidamente.

**Manter `react-native-health` e só religar `newArchEnabled`** (Estratégia A do plano de migração). É o caminho mais barato se sobreviver ao portão 3 da Fase 1 (sincronização em background funcionando com o app fechado, sob New Architecture, no SDK 54) — mas essa troca de biblioteca foi feita de forma eletiva, antes desse portão rodar, porque o plano já apontava a Estratégia B como a saída definitiva independente do resultado.

## Consequências

`mobile/ios/` **nunca** se edita à mão — volta a valer a regra geral (a mesma que a 0009 já aplicava a `patches/`), só que agora reforçada pela ferramenta: qualquer edição manual não sobrevive ao próximo `expo prebuild --clean`.

Subir a SDK do Expo volta a ser bump de verdade (`expo prebuild --clean` regenerando do zero), não merge de projeto nativo — o custo que a 0009 atribuía a manter `ios/` versionado desaparece a partir daqui.

A entrega em background passa a depender de `configureBackgroundTypes` ter rodado pelo menos uma vez em JS (persiste a config em `UserDefaults`; o `AppDelegate` gerado lê isso no próximo cold launch, antes da ponte JS subir) — ver `healthkit-observer.ts::startActivitySync`. Sem essa primeira chamada bem-sucedida, não há observers registrados no boot seguinte.

O fallback por cabo da 0009 (`xcodebuild -allowProvisioningUpdates` + `devicectl`) continua válido — ele parte de `mobile/ios` como projeto Xcode normal, gerado ou versionado tanto faz.
