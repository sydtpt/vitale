# 0009 — `mobile/ios/` versionado (workflow bare)

**Status:** aceita
**Data:** 2026-05-23

## Contexto

O app precisava rodar no iPhone fora da rede de casa, sem depender do Metro na LAN. O backend já é Supabase na nuvem, então faltava só o JS deixar de vir do dev server — caminho natural, EAS Build com distribuição interna.

O bloqueio: `AppDelegate.swift` carrega uma edição manual, `RCTAppleHealthKit().initializeBackgroundObservers(bridge)`, e `react-native-health` **não tem config plugin do Expo**. Um prebuild limpo apagaria essa linha e quebraria o HealthKit em background.

## Decisão

`mobile/ios/` passa a ser versionado — workflow bare. Removido do `.gitignore` da raiz; o `mobile/.gitignore` ignora apenas `Pods/`, `build/` e `xcuserdata`.

Assim o EAS builda o nativo exato que funciona, em vez de regenerá-lo.

## Alternativas rejeitadas

**Escrever um config plugin para `react-native-health`.** Devolveria o prebuild e manteria o `ios/` fora do git. É a saída limpa e segue disponível — custa escrever e manter o plugin.

**Managed workflow sem os observers de background.** Sacrificaria a sincronização em background do HealthKit, que é a razão de o app existir no pulso.

## Consequências

`mobile/ios/` **nunca** se edita à mão — a alteração vai pela ferramenta que o gera. O mesmo vale para `patches/`.

Subir a SDK do Expo deixa de ser um bump: vira trabalho de prebuild e merge do projeto nativo. É o que torna caro o salto de Expo 54 para mais recente.

Mudança só de JS sai por `eas update --branch preview`, com runtime fixo em "1.0.0". Mudança nativa exige rebuild e bump do runtime em dois lugares: `Expo.plist` e `app.json`.

Existe fallback por cabo quando a cota do EAS estoura, validado em 29/07/2026: `xcodebuild` com `-allowProvisioningUpdates` a partir de `mobile/ios`, e depois `xcrun devicectl device install`. O `npx expo run:ios --configuration Release` **não** serve — não passa a flag de provisioning e falha na assinatura, embora bundle o JS antes de falhar.
