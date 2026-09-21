# A ponte do aparelho como módulo Expo local (story 5.9, ADR 0047; peso aberto na 5.8).
#
# O autolinking do SDK 57 varre `mobile/modules/`, exige o `expo-module.config.json` na raiz
# do módulo e **um `.podspec` num subdiretório** — sem este arquivo o módulo não linka, e
# nada avisa: o app só acharia `requireOptionalNativeModule('OnDeviceEngine')` nulo.
#
# Os três `.swift` desta pasta entram no mesmo pod: o `Engine.swift` (a ponte do modelo do
# sistema, que a CLI da bancada também compila, sem cópia), o `MotorCoreAI.swift` (o motor de
# peso aberto, que a bancada compila junto, sem a biblioteca) e a cola
# `OnDeviceEngineModule.swift`. Mesmo pod é o que deixa o `Engine` continuar `internal`.
# Nenhum modelo de servidor entra aqui (AD-3, e a emenda da ADR 0047) — a barreira do módulo
# no `architecture.test.ts` cobra. Mudar qualquer arquivo de `mobile/modules/` muda o binário:
# a barreira do runtime exige subir o `runtimeVersion` junto (`mobile/modules/runtime.json`).
#
# **O alvo é iOS 27 desde a 5.8.** O pacote `apple/coreai-models`, de onde vem o
# `CoreAILanguageModel`, declara `platforms: [.iOS("27.0")]` e **não tem uma única anotação
# `@available`**: compilar contra alvo menor apagaria a proteção de versão que o pacote
# inteiro delega ao manifesto. O `FoundationModels` continua ligado de forma fraca — ele é do
# 26, e a linkagem fraca não custa nada agora que o piso é 27.
#
# ## A vendorização do Core AI (story 5.8)
#
# **O CocoaPods não tem atributo de dependência de Swift Package**, e o autolinking do Expo só
# conhece `podspecPath`/`podspec`. Então o grafo do `apple/coreai-models` — mais de vinte
# pacotes, um deles em C++ — é compilado **fora** do app por `scripts/coreai/montar.sh`, e o
# que entra aqui são dois arquivos:
#
#     vendor/ios-arm64/libOrbeCoreAI.a            o grafo inteiro, já ligado por módulo
#     vendor/ios-arm64/OrbeCoreAI.swiftinterface  a interface da casca, e só ela
#
# A casca (`scripts/coreai/OrbeCoreAI.swift`) importa o pacote com `internal import` e é
# compilada com `-enable-library-evolution`: a interface que sai **não cita**
# `CoreAILanguageModels`. É por isso que este pod precisa de um `SWIFT_INCLUDE_PATHS` com um
# arquivo dentro, em vez dos vinte e tantos `.swiftmodule` e dos mapas de módulo em C do grafo.
#
# **Tudo condicional ao SDK do aparelho.** O `CoreAI.framework` está no `iPhoneOS27.0.sdk` e
# **não está** no `iPhoneSimulator27.0.sdk` (medido em 21/09/2026, Xcode 27.0) — no simulador
# o pacote nem compila, e um `.a` de device no link do simulador daria "building for iOS
# Simulator, but linking object file built for iOS". Então a macro `ORBE_COREAI`, a busca da
# biblioteca e a da interface valem só para `sdk=iphoneos*`, e o `MotorCoreAI.swift` se
# compila sozinho para o outro lado — respondendo `indisponivel`, com motivo.
#
# **E tudo condicional ao arquivo existir.** `montar.sh` não roda no CI (lá não há Xcode) e o
# `.a` pode faltar num clone novo. Sem ele a macro não é definida, o pod compila igual, e o
# motor de peso aberto aparece no seletor apagado dizendo por quê. Um pod que só compilasse
# com o binário faria a ausência dele quebrar o app inteiro.
#
# Sem `package.json` de propósito: o autolinking não o exige, e o nome e a versão moram aqui.

vendor_dir = File.join(__dir__, 'vendor', 'ios-arm64')
lib_coreai = File.join(vendor_dir, 'libOrbeCoreAI.a')
iface_coreai = File.join(vendor_dir, 'OrbeCoreAI.swiftinterface')
tem_coreai = File.exist?(lib_coreai) && File.exist?(iface_coreai)

# **Alguém tem de avisar, porque o silêncio aqui custa um build inteiro.**
#
# `tem_coreai` é lido **no instante do `pod install`**. Rodar `montar.sh` depois do prebuild
# produz um app sem Core AI e sem uma palavra: o motor de peso aberto apareceria no seletor
# dizendo "a biblioteca do Core AI não foi montada neste build", e o dono passaria vinte
# minutos de build descobrindo isso na tela. E um `.a` mais velho que a casca é pior ainda —
# compila, linka, e roda código que não é o que está no repositório.
#
# `Pod::UI` é a saída do CocoaPods; fora dele (um `podspec lint`, um script) ele pode não
# existir, e aí o aviso cai para o `warn` do Ruby.
#
# **Lambda, e não `def`.** O CocoaPods avalia este arquivo dentro do módulo `Pod`, e um `def`
# aqui vira método privado de instância desse módulo — chamá-lo sem receptor explode com
# `undefined method 'orbe_avisar' for module Pod`. E explode **só quando o aviso dispara**,
# que é o caminho que quase nunca roda: medido em 21/09/2026, o `pod install` quebrou na
# primeira vez que a biblioteca ficou velha. Um aviso que derruba o `pod install` é pior que
# não avisar.
orbe_avisar = lambda do |mensagem|
  if defined?(Pod::UI)
    Pod::UI.warn(mensagem)
  else
    warn("[OnDeviceEngine] #{mensagem}")
  end
end

if tem_coreai
  casca = File.join(__dir__, '..', '..', '..', '..', 'scripts', 'coreai', 'OrbeCoreAI.swift')
  if File.exist?(casca) && File.mtime(casca) > File.mtime(lib_coreai)
    orbe_avisar.call(
      'a biblioteca vendorizada do Core AI é MAIS VELHA que scripts/coreai/OrbeCoreAI.swift — ' \
      'o app vai rodar o binário antigo. Rode ./scripts/coreai/montar.sh e refaça o pod install.',
    )
  end
  # A ficha é lida, não só escrita: o compilador com que o `.a` foi montado tem de ser o desta
  # máquina, porque a `.swiftinterface` é sensível à versão dele — divergir dá "module compiled
  # with a different version", e a mensagem não diz de onde veio o binário.
  ficha = File.join(__dir__, 'vendor', 'PROCEDENCIA.txt')
  if File.exist?(ficha)
    montado_com = File.read(ficha)[/Apple Swift version [^\n]+/]
    atual = `xcrun swiftc --version 2>/dev/null`[/Apple Swift version [^\n]+/]
    if montado_com && atual && montado_com != atual
      orbe_avisar.call(
        "a biblioteca do Core AI foi montada com \"#{montado_com}\" e esta máquina tem \"#{atual}\". " \
        'A .swiftinterface é sensível à versão do compilador — rode ./scripts/coreai/montar.sh de novo.',
      )
    end
  else
    orbe_avisar.call('vendor/PROCEDENCIA.txt não está aqui — não sei de que revisão nem de que compilador veio o .a.')
  end
else
  orbe_avisar.call(
    'a biblioteca do Core AI não está vendorizada: o app compila, e o motor de peso aberto aparece no ' \
    'seletor indisponível. Para ter o peso aberto, rode ./scripts/coreai/montar.sh antes do pod install.',
  )
end

# Os pesos embarcados (temporários — a 5.9 os tira do binário e os baixa sob demanda). Cada
# conjunto é uma subpasta de `pesos/`, com o nome que o `MotorId` carrega
# (`aparelho:coreai/smollm2-135m` → `pesos/smollm2-135m/`).
#
# **Copiados como recurso comum, não como `.aimodel` do Xcode.** A regra de build
# `AIModel.xcspec` dispara `aimodelc package` para toda pasta `.aimodel` que entra numa fase
# "Copy Bundle Resources", e o `aimodelc` exige o Metal Toolchain — alguns GB que esta máquina
# não tem. Como `s.resources` de um pod estático, a pasta é copiada pelo script
# `[CP] Copy Pods Resources` (rsync), onde regra de build nenhuma se aplica. O export já vem
# compilado (`compilation.targets` vazio: a especialização é feita pelo `CoreAICompiler` do
# sistema, em execução), então nada se perde.
pesos_dir = File.join(__dir__, 'pesos')
recursos = []
recursos << 'pesos' if Dir.exist?(pesos_dir)
# Os `.bundle` que o SwiftPM gera para os alvos do grafo que têm recurso (`Bundle.module`).
recursos.concat(Dir.glob(File.join(vendor_dir, '*.bundle')).map { |b| "vendor/ios-arm64/#{File.basename(b)}" }) if tem_coreai

Pod::Spec.new do |s|
  s.name           = 'OnDeviceEngine'
  s.version        = '1.1.0'
  s.summary        = 'A ponte do Orbe para os modelos que rodam no aparelho: o do sistema e o de peso aberto.'
  s.description    = 'Módulo Expo local: o Engine.swift (modelo do sistema), o MotorCoreAI.swift (peso aberto via Core AI) e a cola sem lógica que os expõe ao app.'
  s.license        = 'UNLICENSED'
  s.author         = 'Orbe'
  s.homepage       = 'https://github.com/sydtpt/life-organizer'
  s.platforms      = { :ios => '27.0' }
  s.source         = { git: 'https://github.com/sydtpt/life-organizer.git' }

  # O mesmo modo de linguagem com que a CLI da bancada compila o `Engine.swift`
  # (`argumentosDoSwiftc`, `-swift-version 6`): o que a bancada mede é o que o app roda.
  s.swift_version  = '6.0'

  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'FoundationModels'

  s.static_framework = true
  s.source_files = '*.swift'
  s.preserve_paths = 'vendor/**/*', 'pesos/**/*'
  s.resources = recursos unless recursos.empty?

  if tem_coreai
    # Caminho **absoluto**, resolvido no `pod install`. O relativo teria de sair de
    # `$(PODS_ROOT)`, que é `mobile/ios/Pods` — três níveis acima e de volta para dentro de
    # `mobile/modules/`, um caminho que se quebra calado se a geração mudar de lugar. E
    # `ios/` é **gerado** (ADR 0012): o xcconfig com caminho de máquina nasce de novo a cada
    # `expo prebuild`, e nunca entra no repositório.
    vendor = vendor_dir

    # O alvo do **pod**: compila o `MotorCoreAI.swift` com a macro ligada e acha a interface
    # da casca.
    s.pod_target_xcconfig = {
      'SWIFT_ACTIVE_COMPILATION_CONDITIONS[sdk=iphoneos*]' => '$(inherited) ORBE_COREAI',
      'SWIFT_INCLUDE_PATHS[sdk=iphoneos*]' => "$(inherited) \"#{vendor}\"",
    }

    # O alvo do **app**: é ele que linka. Um pod estático não linka nada — ele é arquivado —,
    # então a biblioteca vendorizada tem de entrar aqui, ou o app sairia com os símbolos do
    # Core AI faltando. `-lc++` porque o xgrammar, dentro do `.a`, é C++.
    #
    # `-l` com condição de SDK, e não `vendored_libraries`: o atributo do CocoaPods não aceita
    # condição, e a fatia do simulador não existe (nem pode — não há `CoreAI.framework` lá).
    s.user_target_xcconfig = {
      'LIBRARY_SEARCH_PATHS[sdk=iphoneos*]' => "$(inherited) \"#{vendor}\"",
      'OTHER_LDFLAGS[sdk=iphoneos*]' => '$(inherited) -lOrbeCoreAI -lc++',
    }
  end
end
