/**
 * Sobe o alvo mínimo do iOS para **27.0** (story 5.8).
 *
 * ## Por que
 *
 * O `CoreAILanguageModel`, que transforma peso aberto em frase, vem do pacote Swift
 * `apple/coreai-models`. O manifesto dele declara `platforms: [.iOS("27.0")]` e o fonte
 * **não tem uma única anotação `@available`** — toda a proteção de versão do pacote está no
 * manifesto. Vendorizando o binário (ver `mobile/modules/on-device-engine/ios/OnDeviceEngine.podspec`),
 * o manifesto some do caminho: se o alvo do app não subir junto, a proteção desaparece e o
 * app tentaria abrir `CoreAI.framework` num sistema que não o tem.
 *
 * O dono decidiu isso em 21/09/2026: o app é só dele, e ele está no 27. **O preço é
 * declarado, não escondido — o app deixa de instalar abaixo do iOS 27.**
 *
 * ## Onde o número mora
 *
 * Em dois lugares, e os dois precisam mudar, senão o CocoaPods e o Xcode discordam:
 *
 *  - `ios/Podfile.properties.json` → `ios.deploymentTarget`. É daí que o `platform :ios` do
 *    Podfile gerado sai (`podfile_properties['ios.deploymentTarget'] || '16.4'`), e é ele que
 *    o `pod install` usa para todos os pods.
 *  - o `IPHONEOS_DEPLOYMENT_TARGET` de cada configuração do projeto gerado.
 *
 * Tudo por config plugin, porque `mobile/ios/` é gerado (ADR 0012): editar à mão some no
 * próximo `expo prebuild --clean`. E por plugin **nosso**, e não pelo `expo-build-properties`:
 * o repositório já resolve esses ajustes com plugins escritos aqui (`withUISceneLifecycle`,
 * `withCppModulemapFix`, …), e uma dependência npm a mais para escrever um número seria
 * superfície nova sem ganho.
 */
const { withPodfileProperties, withXcodeProject } = require('expo/config-plugins');

/** O alvo mínimo. Um lugar só; os dois escritores leem daqui. */
const ALVO = '27.0';

const withAlvoMinimoIOS27 = (config) => {
  config = withPodfileProperties(config, (c) => {
    c.modResults['ios.deploymentTarget'] = ALVO;
    return c;
  });

  config = withXcodeProject(config, (c) => {
    const projeto = c.modResults;
    const configuracoes = projeto.pbxXCBuildConfigurationSection();
    for (const chave of Object.keys(configuracoes)) {
      const bloco = configuracoes[chave];
      // As entradas de comentário (`<uuid>_comment`) não são blocos.
      if (!bloco || typeof bloco !== 'object' || !bloco.buildSettings) continue;
      // Só onde o alvo já é declarado: escrever a chave onde ela não estava faria o
      // Xcode herdar de outro lugar e o número divergir sem ninguém ver.
      if (bloco.buildSettings.IPHONEOS_DEPLOYMENT_TARGET === undefined) continue;
      bloco.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = ALVO;
    }
    return c;
  });

  return config;
};

module.exports = withAlvoMinimoIOS27;
module.exports.ALVO_MINIMO_IOS = ALVO;
