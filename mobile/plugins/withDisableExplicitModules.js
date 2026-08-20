/**
 * Desliga "Explicit Modules" (Xcode 16+) — o scanner de dependências dele
 * falha ao resolver headers da libc++ (`<functional>`, `<cassert>`) para
 * pods com C++ pesado como `NitroModules`/`ReactNativeHealthkit`, mesmo eles
 * compilando normalmente com o build system clássico. Erro visto na EAS:
 *
 *   Clang dependency scanner failure: ... 'functional' file not found
 *   could not build module 'NitroModules'
 *   Compilation search paths unable to resolve module dependency:
 *   'ReactNativeHealthkit' (in target 'Orbe' from project 'Orbe')
 *
 * É um bug conhecido da feature em vários pods CocoaPods com C++/Objective-C++
 * (não específico desta lib), inclusive relatado como bug do próprio Xcode 26
 * beta pela comunidade Swift Forums. `CLANG_ENABLE_EXPLICIT_MODULES = NO`
 * sozinho **não bastou** — testado localmente, o erro persistiu idêntico. O
 * ponto de falha real é "clang dependency scanning" disparado pelo próprio
 * Swift Driver ao importar um pod C++/Swift (`import ReactNativeHealthkit`
 * no AppDelegate.swift) — mecanismo separado, com sua própria chave:
 * `SWIFT_ENABLE_EXPLICIT_MODULES`. Desligando as duas.
 * Precisa nos dois lugares: no projeto dos Pods (via `post_install`, que já
 * existe no Podfile gerado) e no target do app em si — o erro aponta o
 * target 'Orbe', não só um pod.
 */
const { withPodfile, withXcodeProject } = require('@expo/config-plugins');

const withDisableExplicitModulesPods = (config) =>
  withPodfile(config, (mod) => {
    let { contents } = mod.modResults;

    if (!contents.includes('CLANG_ENABLE_EXPLICIT_MODULES')) {
      const anchor = 'post_install do |installer|\n';
      const idx = contents.indexOf(anchor);
      if (idx !== -1) {
        const insertAt = idx + anchor.length;
        const snippet =
          "    installer.pods_project.targets.each do |target|\n" +
          "      target.build_configurations.each do |build_config|\n" +
          "        build_config.build_settings['CLANG_ENABLE_EXPLICIT_MODULES'] = 'NO'\n" +
          "        build_config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'\n" +
          "      end\n" +
          "    end\n";
        contents = contents.slice(0, insertAt) + snippet + contents.slice(insertAt);
      }
    }

    mod.modResults.contents = contents;
    return mod;
  });

const withDisableExplicitModulesApp = (config) =>
  withXcodeProject(config, (mod) => {
    mod.modResults.updateBuildProperty('CLANG_ENABLE_EXPLICIT_MODULES', 'NO');
    mod.modResults.updateBuildProperty('SWIFT_ENABLE_EXPLICIT_MODULES', 'NO');
    return mod;
  });

const withDisableExplicitModules = (config) =>
  withDisableExplicitModulesApp(withDisableExplicitModulesPods(config));

module.exports = withDisableExplicitModules;
