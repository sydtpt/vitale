# 0051 — O app adota o ciclo de vida por cena, porque o SDK do iOS 27 o exige

**Status:** aceita
**Data:** 2026-09-17

## Contexto

Em 15/09/2026 a App Store trocou o Xcode 26.6 pelo **Xcode 27.0** (27A266a), e ele passou a ser o único Xcode da máquina de build, só com o SDK do iOS 27. A espinha dos motores ainda previa "o app segue compilando com o Xcode 26.6", e a [ADR 0047](0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md) deixava em aberto se o 26.6 abriria no macOS 27. A pergunta deixou de existir: não sobrou um 26.6 para testar.

O último build de entrega que funcionou saiu do 26.6, na janela da story 1.9 (13/09). O primeiro com o 27 (17/09, story 1.10) compilou sem erro, instalou e **morreu ao abrir**, antes de qualquer JS. Foram quatro crashes seguidos no iOS 27.0, com a mesma assinatura: `EXC_BREAKPOINT` em `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`, dentro de `-[UIApplication workspace:didCreateScene:withTransitionContext:completion:]`.

O SDK 27 exige que o app adote o ciclo de vida por **UIScene**. O `Info.plist` gerado não tinha `UIApplicationSceneManifest`. O `AppDelegate` que o Expo 57 / React Native 0.86 gera cria a própria janela no `didFinishLaunching` e não adota cena, e o `ExpoAppDelegate` não traz delegate de cena para oferecer.

Duas restrições vinham de antes e condicionam a saída:

- **`mobile/ios/` é gerado** ([ADR 0012](0012-kingstinct-healthkit-devolve-o-prebuild.md)): qualquer mudança nativa entra por config plugin, ou some no próximo `expo prebuild --clean`.
- **O HealthKit acorda o app em background sem cena nenhuma** ([ADR 0013](0013-background-do-healthkit-exige-patch-na-lib.md)). O sync depende de o JS subir nesse lançamento, e hoje quem sobe o JS é o `startReactNative` do `didFinishLaunching`.

## Decisão

O app adota o ciclo por cena por um config plugin, `mobile/plugins/withUISceneLifecycle.js`. Ele declara no `Info.plist` uma cena única (`UIApplicationSupportsMultipleScenes: false`) e gera `SceneDelegate.swift` no target do app. Três regras moram nesse delegate:

1. **A janela continua nascendo no `didFinishLaunching`, e a cena só a recebe.** O `AppDelegate` gerado não muda: ele cria a janela e sobe o React Native como antes. Quando a cena conecta, ela atribui `windowScene` a essa janela e a torna visível. Assim o lançamento em background, que não tem cena, continua com o JS de pé para o sync.
2. **Links vão para o `AppDelegate`.** Com cena, o iOS deixa de chamar `application(_:open:options:)` e `application(_:continue:restorationHandler:)` e passa a chamar os equivalentes da cena. O delegate repassa os dois, inclusive a URL do lançamento a frio, que chega em `connectionOptions`. Com isso o `RCTLinkingManager` e o `LinkingAppDelegateSubscriber` do `expo-linking` (que guarda a URL inicial) recebem exatamente o que recebiam.
3. **Ativo, inativo, frente e fundo também vão para o `AppDelegate`.** O iOS não chama mais `applicationDidBecomeActive` e companhia no delegate do app, e é por eles que o `ExpoAppDelegate` avisa os subscribers dos módulos. As notificações de `UIApplication`, que o `AppState` do React Native escuta, o sistema continua postando.

Conferido no iPhone (iOS 27.0) em 17/09 com build Release do Xcode 27:
- o app abre;
- o JS avalia;
- a tarefa de geofence de Presença roda;
- o dono usou o app e imprimiu uma edição da Retrospectiva.

## Alternativas rejeitadas

**Voltar a compilar com o Xcode 26.6, lado a lado**, por `DEVELOPER_DIR`. Devolvia o app sem tocar no nativo, mas só adiava a dívida: a ponte Swift da story 5.5 (marco B) e o Core AI da 5.8 exigem o Xcode 27. Ninguém sabia se o 26.6 abria no macOS 27, e o download pedia login e ~10 GB para uma resposta incerta.

**Build na EAS com a imagem do Xcode 26.6 fixada.** Mesmo adiamento, com custo de cota e fila, e o build local por cabo, que é o caminho de entrega real deste projeto, continuaria quebrado.

**Criar a janela na cena**, como fazem os guias de migração genéricos. É a forma "canônica", mas o lançamento em background do HealthKit não conecta cena nenhuma. O React Native só subiria quando o dono abrisse o app, e o sync em background morreria sem erro, exatamente o modo de falha que a ADR 0013 existe para fechar.

## Consequências

**O Xcode 27 é a base do build local a partir daqui.** Todo build com ele precisa deste plugin; sem ele, o app compila e não abre. `xcodebuild -version` passa a ser a primeira coisa a olhar quando um build novo não abre.

**O `runtimeVersion` não sobe (fica 1.0.5).** A mudança é nativa, mas o contrato JS↔nativo não muda: nenhuma linha de JS depende do delegate de cena, então um JS publicado por OTA roda igual no binário antigo e no novo. O canal `preview` segue em `rollBackToEmbedded` desde a 1.9. Se um dia o JS passar a depender de cena (por exemplo, janelas múltiplas), aí o `runtimeVersion` sobe.

**A janela vira "key and visible" duas vezes num lançamento com tela:** no `startReactNative` e de novo quando a cena conecta. O console registra "Unbalanced calls to begin/end appearance transitions". Até aqui é inofensivo; se aparecer efeito visível (animação de entrada duplicada, `viewDidAppear` chamado duas vezes numa tela nativa), o conserto é não chamar `makeKeyAndVisible` no lançamento com cena.

**O que ainda não foi conferido:**
- o sync em background com o app fechado, que é o caminho mais sensível desta decisão;
- a volta do login do Google (`vitale://`);
- um link aberto a frio.

O login usa `openAuthSessionAsync`, que devolve a URL pela própria sessão de autenticação e não depende do repasse, mas o repasse existe para quem depender.

**Custa reverter pouco:** tirar o plugin do `app.base.json` e rodar `--prebuild`. Mas sem ele o app só volta a abrir se for compilado com um SDK anterior ao 27.

**Pré-requisito da 5.5 marco B e da 5.8.** A ponte Swift `on-device-engine` e o Core AI já nascem sobre o ciclo por cena. Nenhum dos dois precisa de janela própria, mas quem escrever a ponte não deve assumir `UIApplication.shared.delegate.window` como única fonte da janela: com cena, a fonte é `UIWindowScene.windows`.
