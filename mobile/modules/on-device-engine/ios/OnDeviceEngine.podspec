# A ponte do aparelho como módulo Expo local (story 5.9, ADR 0047).
#
# O autolinking do SDK 57 varre `mobile/modules/`, exige o `expo-module.config.json` na raiz
# do módulo e **um `.podspec` num subdiretório** — sem este arquivo o módulo não linka, e
# nada avisa: o app só acharia `requireOptionalNativeModule('OnDeviceEngine')` nulo.
#
# Os três `.swift` desta pasta entram no mesmo pod: o `Engine.swift` (a ponte, que a CLI da
# bancada também compila, sem cópia), a cola `OnDeviceEngineModule.swift` e o experimento
# descartável do PCC — o único arquivo do pod que toca modelo de servidor, com texto fixo, e
# para apagar ou promover depois do veredito do dono (emenda da ADR 0047). Mesmo pod é o que
# deixa o `Engine` continuar `internal`. Mudar qualquer arquivo de `mobile/modules/` muda o
# binário: a barreira do runtime exige subir o `runtimeVersion` junto (`mobile/modules/runtime.json`).
#
# O `FoundationModels` é ligado **de forma fraca**: o alvo do app é o iOS 16.4, e sem isto o
# `dyld` recusaria abrir o app em todo sistema que não tem o framework (abaixo do 26). O uso
# está todo atrás de `#available(iOS 26…)` no código.
#
# Sem `package.json` de propósito: o autolinking não o exige, e o nome e a versão moram aqui.
Pod::Spec.new do |s|
  s.name           = 'OnDeviceEngine'
  s.version        = '1.0.0'
  s.summary        = 'A ponte do Orbe para o modelo de linguagem do sistema, e o teste descartável do PCC.'
  s.description    = 'Módulo Expo local: o Engine.swift (só pesos que rodam no aparelho), a cola sem lógica e, por ora, o ExperimentoDoPCC.swift — teste descartável do Private Cloud Compute, com texto fixo e sem dado do dono (exceção à AD-3, ADR 0047).'
  s.license        = 'UNLICENSED'
  s.author         = 'Orbe'
  s.homepage       = 'https://github.com/sydtpt/life-organizer'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: 'https://github.com/sydtpt/life-organizer.git' }

  # O mesmo modo de linguagem com que a CLI da bancada compila o `Engine.swift`
  # (`argumentosDoSwiftc`, `-swift-version 6`): o que a bancada mede é o que o app roda.
  s.swift_version  = '6.0'

  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'FoundationModels'

  s.static_framework = true
  s.source_files = '**/*.swift'
end
