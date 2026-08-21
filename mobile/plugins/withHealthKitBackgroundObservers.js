/**
 * Corrige DOIS bugs do config plugin de `@kingstinct/react-native-healthkit`
 * 14.0.2 (`withAppDelegatePlugin`):
 *
 * 1. Regex de uma linha só (`/func application\(.+didFinishLaunchingWithOptions.+\{\)\n/`)
 *    para achar onde injetar a chamada de setup. O `AppDelegate.swift` que o
 *    Expo SDK 54 gera quebra essa assinatura em várias linhas — a regex não
 *    casa, o `.replace()` não muda nada. Sem erro, sem log.
 * 2. Deixa a chamada como `BackgroundDeliveryManager.shared.setupBackgroundObservers()`
 *    direto do Swift, o que exige `import ReactNativeHealthkit` — e esse
 *    módulo `requires cplusplus` (ver `withCppModulemapFix.js`). Fazer o
 *    Swift do target inteiro suportar isso via `SWIFT_OBJC_INTEROP_MODE =
 *    objcxx` tem efeito colateral: liga interop C++ pra TODO Swift do
 *    target, inclusive o `ExpoModulesProvider.swift` do autolinking, que
 *    puxa `glog` — e o `glog` quebra sob módulos C++ estritos (bug aberto na
 *    comunidade RN desde 2018, sem correção limpa conhecida). Confirmado com
 *    build local antes de descartar essa rota.
 *
 * A saída: nenhum import Swift de `ReactNativeHealthkit`. A chamada vai por
 * uma ponte Objective-C++ (`HealthKitBackgroundBridge.h/.mm`, ver
 * `withHealthKitObjcxxBridge.js`) — `.mm` já compila em modo C++ por
 * natureza do tipo de arquivo, sem precisar ligar interop no target inteiro,
 * então não arrasta o `glog` junto. O Swift só chama a função C exposta via
 * bridging header, igual qualquer outra ponte Objective-C clássica do RN.
 *
 * Este plugin roda depois do deles e faz a MESMA inserção por busca de
 * substring em vez de regex — imune a quebra de linha na assinatura. Sem
 * isso, cada `expo prebuild --clean` voltaria a gerar um AppDelegate sem a
 * chamada de setup, exatamente o modo de falha que a troca de lib existe
 * para fechar (ADR 0012).
 */
const { withAppDelegate } = require('expo/config-plugins');

const SETUP_CALL = '    hk_setup_background_observers()\n';

const withHealthKitBackgroundObservers = (config) =>
  withAppDelegate(config, (mod) => {
    let { contents } = mod.modResults;

    if (!contents.includes('hk_setup_background_observers')) {
      const anchor = contents.indexOf('didFinishLaunchingWithOptions');
      const brace = anchor === -1 ? -1 : contents.indexOf('{', anchor);
      if (brace !== -1) {
        const insertAt = brace + 1;
        contents = contents.slice(0, insertAt) + '\n' + SETUP_CALL + contents.slice(insertAt);
      }
    }

    mod.modResults.contents = contents;
    return mod;
  });

module.exports = withHealthKitBackgroundObservers;
