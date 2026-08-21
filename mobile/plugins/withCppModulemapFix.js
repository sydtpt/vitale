/**
 * `NitroModules` e `ReactNativeHealthkit` são pods C++ (headers `.hpp` como
 * `Null.hpp`, que faz `#include <functional>`), mas o `.modulemap` que o
 * CocoaPods gera pra eles é o padrão genérico:
 *
 *   module NitroModules {
 *     umbrella header "NitroModules-umbrella.h"
 *     export *
 *     module * { export * }
 *   }
 *
 * Sem `requires cplusplus`, nada força quem importa o módulo a compilar em
 * modo C++/Objective-C++. O Swift (`import ReactNativeHealthkit` no
 * AppDelegate.swift) importa via ClangImporter em modo Objective-C puro — e
 * nesse modo o SDK nem expõe os headers da libc++, daí
 * `'functional' file not found` / `'cassert' file not found` ao tentar
 * compilar o módulo (confirmado com build local: nem
 * `CLANG_ENABLE_EXPLICIT_MODULES=NO` nem `SWIFT_ENABLE_EXPLICIT_MODULES=NO`
 * mudam isso — o problema não é a feature de "explicit modules", é o modo de
 * linguagem usado pra montar o módulo em si).
 *
 * `requires cplusplus` é a forma padrão de um module map C++ exigir isso
 * (é o que o `CxxStdlib` da própria Apple usa). O CocoaPods não expõe essa
 * linha via podspec DSL — só dá pra injetar depois, no `.modulemap` gerado.
 *
 * Só isso não fecha o ciclo: com `requires cplusplus` presente, o build local
 * passou a falhar com um erro mais claro — "module 'NitroModules' requires
 * feature 'cplusplus'" — porque o target `Orbe` é Swift puro (nenhum `.mm`
 * próprio) e o Xcode não liga a interop C++ do Swift por padrão.
 *
 * `SWIFT_OBJC_INTEROP_MODE = objcxx` no target inteiro RESOLVE isso, mas tem
 * um efeito colateral sério: liga a interop C++ pra TODO Swift do target,
 * inclusive `ExpoModulesProvider.swift` (gerado pelo autolinking), que puxa
 * `Expo → React_RCTAppDelegate → glog` — e o `glog` tem um `#include`
 * dentro de `namespace google {}` que quebra sob módulos C++ estritos (bug
 * antigo e sem correção limpa conhecida, aberto desde RN 0.59). Por isso
 * ficou de fora daqui — ver ADR/decisão em andamento sobre a ponte
 * Objective-C++ como alternativa que não liga interop pro target inteiro.
 */
const { withPodfile } = require('expo/config-plugins');

const CPP_MODULES = ['NitroModules', 'ReactNativeHealthkit'];

const withCppModulemapFixPods = (config) =>
  withPodfile(config, (mod) => {
    let { contents } = mod.modResults;

    if (!contents.includes('requires cplusplus')) {
      const anchor = 'post_install do |installer|\n';
      const idx = contents.indexOf(anchor);
      if (idx !== -1) {
        const insertAt = idx + anchor.length;
        const modulesList = CPP_MODULES.map((name) => `'${name}'`).join(', ');
        const snippet =
          `    [${modulesList}].each do |pod_name|\n` +
          "      modulemap_path = File.join(installer.sandbox.target_support_files_dir(pod_name), \"#{pod_name}.modulemap\")\n" +
          "      next unless File.exist?(modulemap_path)\n" +
          "      map_contents = File.read(modulemap_path)\n" +
          "      next if map_contents.include?('requires cplusplus')\n" +
          "      patched_map = map_contents.sub(/(umbrella header \"[^\"]+\"\\n)/) { \"#{$1}  requires cplusplus\\n\" }\n" +
          "      File.write(modulemap_path, patched_map) if patched_map != map_contents\n" +
          "    end\n";
        contents = contents.slice(0, insertAt) + snippet + contents.slice(insertAt);
      }
    }

    mod.modResults.contents = contents;
    return mod;
  });

module.exports = withCppModulemapFixPods;
