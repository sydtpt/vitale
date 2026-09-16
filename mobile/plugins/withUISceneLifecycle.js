/**
 * Adota o ciclo de vida por UIScene — exigido pelo SDK do iOS 27.
 *
 * ## Por que existe
 *
 * O Xcode 27 (SDK iOS 27) passou a exigir que o app adote o ciclo por cena. Sem
 * `UIApplicationSceneManifest` no `Info.plist`, o app compila, instala e **morre
 * ao abrir**, antes de qualquer JS: `EXC_BREAKPOINT` em
 * `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`, dentro de
 * `-[UIApplication workspace:didCreateScene:…]` (medido em 17/09/2026, iOS 27.0,
 * quatro crashes seguidos). O `AppDelegate` que o Expo 57 / RN 0.86 gera não
 * adota cena, e o `ExpoAppDelegate` não tem delegate de cena para oferecer.
 *
 * ## As três decisões
 *
 * 1. **A janela continua nascendo no `didFinishLaunching`, e a cena só a
 *    recebe.** O HealthKit acorda o app em background sem cena nenhuma (ADR
 *    0013), e é o `startReactNative` do `didFinishLaunching` que põe o JS de pé
 *    para o sync rodar. Mover a criação da janela para a cena deixaria o
 *    lançamento em background sem JS — o sync morreria calado. A cena, quando
 *    conecta, atribui `windowScene` à janela que já existe e a torna visível.
 * 2. **Links vão para o `AppDelegate`, como antes.** No ciclo por cena o iOS
 *    deixa de chamar `application(_:open:options:)` e
 *    `application(_:continue:restorationHandler:)`; chama os equivalentes da
 *    cena. Repassar ao `AppDelegate` mantém o `RCTLinkingManager` e o
 *    `LinkingAppDelegateSubscriber` do `expo-linking` (que guarda a URL inicial)
 *    recebendo exatamente o que recebiam — inclusive a URL do lançamento a frio,
 *    que chega em `connectionOptions`.
 * 3. **Ativo, inativo, frente e fundo também.** Com cena, o iOS não chama mais
 *    `applicationDidBecomeActive` e companhia no delegate do app, e é por eles
 *    que o `ExpoAppDelegate` avisa os subscribers dos módulos. As notificações
 *    de `UIApplication` (que o `AppState` do RN escuta) continuam sendo postadas
 *    pelo sistema; o repasse é só para o delegate.
 *
 * Tudo por config plugin, porque `mobile/ios/` é gerado (ADR 0012): editar à mão
 * some no próximo `expo prebuild --clean`.
 */
const { withInfoPlist, IOSConfig } = require('expo/config-plugins');

const SCENE_DELEGATE = 'SceneDelegate';

const SCENE_DELEGATE_CONTENTS = `// Gerado por mobile/plugins/withUISceneLifecycle.js — não edite à mão (ADR 0012).
internal import Expo
import UIKit

/// O ciclo de vida por cena que o SDK do iOS 27 exige. Ver o cabeçalho do plugin.
class ${SCENE_DELEGATE}: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    // A janela nasceu no didFinishLaunching, com o React Native dentro: o
    // lançamento em background (HealthKit) precisa do JS vivo sem cena nenhuma.
    // Aqui ela só ganha a cena e aparece.
    let janela = appDelegate?.window ?? UIWindow(windowScene: windowScene)
    janela.windowScene = windowScene
    appDelegate?.window = janela
    window = janela
    janela.makeKeyAndVisible()

    // O lançamento a frio por link chega aqui, e não em application(_:open:).
    for contexto in connectionOptions.urlContexts {
      abrir(contexto)
    }
    for atividade in connectionOptions.userActivities {
      continuar(atividade)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for contexto in URLContexts {
      abrir(contexto)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    continuar(userActivity)
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }

  private func abrir(_ contexto: UIOpenURLContext) {
    var opcoes: [UIApplication.OpenURLOptionsKey: Any] = [
      .openInPlace: contexto.options.openInPlace,
    ]
    if let origem = contexto.options.sourceApplication {
      opcoes[.sourceApplication] = origem
    }
    if let anotacao = contexto.options.annotation {
      opcoes[.annotation] = anotacao
    }
    _ = appDelegate?.application(UIApplication.shared, open: contexto.url, options: opcoes)
  }

  private func continuar(_ atividade: NSUserActivity) {
    _ = appDelegate?.application(UIApplication.shared, continue: atividade, restorationHandler: { _ in })
  }
}
`;

/** A cena única do app, declarada no Info.plist. */
const withSceneManifest = (config) =>
  withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: `$(PRODUCT_MODULE_NAME).${SCENE_DELEGATE}`,
          },
        ],
      },
    };
    return mod;
  });

/** O delegate da cena, como fonte do target do app. */
const withSceneDelegateSource = (config) =>
  IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
    filePath: `${SCENE_DELEGATE}.swift`,
    contents: SCENE_DELEGATE_CONTENTS,
    overwrite: true,
  });

const withUISceneLifecycle = (config) => withSceneDelegateSource(withSceneManifest(config));

module.exports = withUISceneLifecycle;
