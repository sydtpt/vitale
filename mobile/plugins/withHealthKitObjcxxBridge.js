/**
 * Ponte Objective-C++ pro `BackgroundDeliveryManager` do
 * `@kingstinct/react-native-healthkit`, pra fugir do problema descrito em
 * `withHealthKitBackgroundObservers.js`: o Swift do target `Orbe` não pode
 * `import ReactNativeHealthkit` (o módulo `requires cplusplus`) sem ligar
 * `SWIFT_OBJC_INTEROP_MODE = objcxx` pro target inteiro — o que quebra o
 * `glog` via `ExpoModulesProvider.swift` do autolinking (bug aberto na
 * comunidade RN desde 2018).
 *
 * Um arquivo `.mm` compila em Objective-C++ por natureza da extensão — já
 * tem "cplusplus" disponível sem precisar de nenhum ajuste de target, e sem
 * afetar a compilação de nenhum outro arquivo Swift do projeto.
 *
 * Tentativa 1 (abandonada): `#import "ReactNativeHealthkit-Swift.h"`, o
 * header Swift-gerado do pod. Ele mora em `<BUILT_PRODUCTS_DIR>/
 * ReactNativeHealthkit/Swift Compatibility Header/` — um caminho com
 * espaço. Testado localmente: o Xcode deste projeto quebra QUALQUER
 * `HEADER_SEARCH_PATHS` com espaço na hora de gravar o response file do
 * clang — "Compatibility" e "Header" saem como tokens `-I` soltos, mesmo
 * com aspas e mesmo escapando o espaço. Confirmado que é sistêmico: os
 * caminhos "Swift Compatibility Header" que o PRÓPRIO CocoaPods gera pra
 * outros pods (EXManifests, Expo, ExpoModulesCore…) têm o mesmo corte —
 * só não quebra nada porque nada mais importa esses headers diretamente.
 *
 * Solução: não importar o header nenhum. `BackgroundDeliveryManager` é
 * `@objc public class ... : NSObject` — em runtime é uma classe Objective-C
 * de verdade, com ABI compatível. Basta declarar a MESMA interface aqui
 * (sem `@implementation` — o símbolo real vem linkado da lib estática do
 * pod) pro compilador gerar as chamadas certas. É a técnica clássica de
 * forward-declaration ObjC, e evita depender de nenhum diretório de build
 * gerado ou de header search path.
 *
 * Uma pegadinha a mais: por padrão o Swift exporta a classe pro runtime ObjC
 * com o nome ofuscado `_TtC20ReactNativeHealthkit25BackgroundDeliveryManager`
 * (confirmado com `nm` no `.o` compilado), não `BackgroundDeliveryManager`
 * puro — o linker não encontrava `_OBJC_CLASS_$_BackgroundDeliveryManager`.
 * Precisa de `@objc(BackgroundDeliveryManager)` explícito na declaração da
 * classe pra forçar o nome sem ofuscação — patch em
 * `patches/@kingstinct+react-native-healthkit+14.0.2.patch` (patch-package),
 * já que o pod referencia o source do `node_modules` direto, sem cópia.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod, IOSConfig } = require('expo/config-plugins');

const HEADER_NAME = 'HealthKitBackgroundBridge.h';
const IMPL_NAME = 'HealthKitBackgroundBridge.mm';

const HEADER_CONTENTS = `#ifndef HealthKitBackgroundBridge_h
#define HealthKitBackgroundBridge_h

#ifdef __cplusplus
extern "C" {
#endif

void hk_setup_background_observers(void);

#ifdef __cplusplus
}
#endif

#endif /* HealthKitBackgroundBridge_h */
`;

const IMPL_CONTENTS = `#import "${HEADER_NAME}"
#import <Foundation/Foundation.h>

// Forward-declaration da superfície @objc de BackgroundDeliveryManager
// (ReactNativeHealthkit, ios/BackgroundDeliveryManager.swift). Sem
// @implementation de propósito — a classe real é Swift, já linkada pela
// lib estática do pod; isto só dá ao compilador o formato das chamadas.
@interface BackgroundDeliveryManager : NSObject
@property(class, nonatomic, readonly, strong) BackgroundDeliveryManager *shared;
- (void)setupBackgroundObservers;
@end

void hk_setup_background_observers(void) {
  [[BackgroundDeliveryManager shared] setupBackgroundObservers];
}
`;

const withHealthKitObjcxxBridgeHeader = (config) =>
  withDangerousMod(config, [
    'ios',
    (mod) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
      const headerPath = path.join(mod.modRequest.platformProjectRoot, projectName, HEADER_NAME);
      fs.writeFileSync(headerPath, HEADER_CONTENTS, 'utf8');
      return mod;
    },
  ]);

const withHealthKitObjcxxBridgeImpl = (config) =>
  IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
    filePath: IMPL_NAME,
    contents: IMPL_CONTENTS,
    overwrite: true,
  });

/** Deixa a função visível pro Swift do AppDelegate sem nenhum `import`. */
const withHealthKitObjcxxBridgingHeader = (config) =>
  withDangerousMod(config, [
    'ios',
    (mod) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
      const bridgingHeaderPath = path.join(
        mod.modRequest.platformProjectRoot,
        projectName,
        `${projectName}-Bridging-Header.h`,
      );
      if (fs.existsSync(bridgingHeaderPath)) {
        const contents = fs.readFileSync(bridgingHeaderPath, 'utf8');
        if (!contents.includes(HEADER_NAME)) {
          fs.writeFileSync(bridgingHeaderPath, `${contents}#import "${HEADER_NAME}"\n`, 'utf8');
        }
      }
      return mod;
    },
  ]);

const withHealthKitObjcxxBridge = (config) =>
  withHealthKitObjcxxBridgingHeader(withHealthKitObjcxxBridgeImpl(withHealthKitObjcxxBridgeHeader(config)));

module.exports = withHealthKitObjcxxBridge;
