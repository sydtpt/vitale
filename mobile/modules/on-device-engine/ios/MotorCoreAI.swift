// O motor de **peso aberto** no aparelho (story 5.8, AD-3, AD-4, ADR 0047).
//
// O irmão do `Engine.swift`: mesmo contrato JSON, mesmas sete classes, mesma tabela erro →
// classe — e um modelo diferente do outro lado. Onde o `Engine` instancia o modelo **do
// sistema** (a Apple escolhe, nós não trocamos), este abre uma **pasta de pesos** que veio no
// binário e a entrega ao Foundation Models pela casca `OrbeCoreAI`.
//
// **Nada é duplicado.** A conversão do pedido, o subconjunto de esquema, a tabela erro →
// classe, o `enum ClasseDeFalha`, o corte do detalhe e a codificação da linha continuam sendo
// do `Engine` — este arquivo os chama. O que é dele, e só dele: achar a pasta, dizer por que
// ela não serve, e traduzir a falha de **carga** (que o `Engine` nunca vê, porque o modelo do
// sistema não se carrega).
//
// **A casca é vendorizada, e por isso ela não decide nada.** O `CoreAILanguageModel` vem do
// pacote Swift `apple/coreai-models`, que o CocoaPods não sabe consumir; ele é compilado fora
// do app por `scripts/coreai/montar.sh` e entra no pod como `.a` + `.swiftinterface`. Um
// binário que ninguém lê não pode guardar regra do Orbe: a casca devolve a falha
// **descrita** (nome do tipo, descrição, domínio e código), e quem a classifica é
// {@link identificar}, aqui, em fonte que as barreiras leem e que a bancada percorre sem
// biblioteca nenhuma.
//
// **Compilado em dois modos, de propósito:**
//
//   com `ORBE_COREAI`    o pod do iPhone, com a biblioteca vendorizada presente (o podspec
//                        só define a macro quando o `.a` está lá)
//   sem `ORBE_COREAI`    o simulador, um build sem a vendorização, e a CLI da bancada no Mac
//                        (`scripts/bancada/aparelho/`), que compila este arquivo para
//                        percorrer a tabela sem modelo
//
// Sem a macro o motor continua existindo e continua respondendo — `indisponivel`, com o
// motivo em palavras. Um motor que sumisse da lista faria o seletor mentir por omissão.
//
// **O Core AI é do aparelho, não do simulador.** Medido em 21/09/2026 (Xcode 27.0): o
// `CoreAI.framework` está no `iPhoneOS27.0.sdk` e **não** está no `iPhoneSimulator27.0.sdk` —
// o `FoundationModels` está nos dois. Não é escolha nossa; é o SDK.

import Foundation
import FoundationModels
#if ORBE_COREAI
import OrbeCoreAI
#endif

enum MotorCoreAI {
  /// Quem forneceu os pesos, na assinatura — o `<provedor>` de `aparelho:<provedor>/<pesos>`
  /// (`packages/shared/src/ia/fio.ts`). O `modelo` da assinatura é o nome dos pesos.
  static let provedor = "coreai"

  /// A pasta do bundle onde o podspec põe os pesos. Cada conjunto é uma subpasta com o nome
  /// que o id carrega: `pesos/smollm2-135m/`.
  static let pastaDosPesos = "pesos"

  /// A ficha do conjunto — é a presença dela que diz que a pasta é um bundle de Core AI, e é
  /// dela que sai a janela. `CoreAILanguageModel(resourcesAt:)` aponta para a pasta que a tem.
  static let arquivoDaFicha = "metadata.json"

  // MARK: os motivos, como a ponte os escreve

  /// Os quatro motivos do Core AI, espelhados em `MOTIVOS_DO_COREAI` (`ia/aparelho.ts`) e
  /// postos em palavras por `mobile/src/lib/motores/catalogo.ts`. A guarda do vocabulário no
  /// `architecture.test.ts` exige a igualdade: um motivo novo de um lado só viraria "motivo
  /// desconhecido" na tela do dono, calado.
  static func motivos() -> [String] {
    [motivoSemBiblioteca, motivoSimulador, motivoSemPesos, motivoPesosIlegiveis]
  }

  /// A biblioteca vendorizada não está neste build (`montar.sh` nunca rodou, ou o `.a` saiu).
  static let motivoSemBiblioteca = "semBiblioteca"
  /// O simulador não tem `CoreAI.framework`. Motivo próprio porque "não está neste build"
  /// seria falso: lá ela nunca vai estar.
  static let motivoSimulador = "simulador"
  /// O build não traz esta pasta de pesos.
  static let motivoSemPesos = "semPesos"
  /// A pasta existe e não é um bundle de Core AI — sem ficha, ou com ficha que não se lê.
  static let motivoPesosIlegiveis = "pesosIlegiveis"

  // MARK: o nome dos pesos

  /// Os caracteres que um nome de pesos pode ter. Ele vem do JS e vira **caminho**: sem esta
  /// régua, um `../../` escolhido na preferência sairia da pasta de recursos. É a mesma
  /// forma que `lerMotorId` aceita num segmento, apertada para nome de arquivo.
  static func nomeValido(_ pesos: String) -> Bool {
    if pesos.isEmpty { return false }
    if pesos.count > 128 { return false }
    if pesos.hasPrefix(".") { return false }
    let permitidos = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
    return pesos.unicodeScalars.allSatisfy { permitidos.contains($0) }
  }

  // MARK: onde estão os pesos

  /// O que se sabe da pasta antes de tocar no modelo.
  enum EstadoDosPesos: Equatable, Sendable {
    /// A pasta está lá e tem ficha. `janela` sai da ficha quando ela a declara.
    case pronto(URL, janela: Int?)
    /// Não dá: o motivo (um de {@link motivos}) e o detalhe em prosa.
    case falta(motivo: String, detalhe: String)
  }

  /// O motivo que não depende de pasta nenhuma: a biblioteca fora do build, o simulador.
  /// `nil` quer dizer "a biblioteca está aqui, pode procurar a pasta".
  static func motivoDaBiblioteca() -> (motivo: String, detalhe: String)? {
    #if targetEnvironment(simulator)
    return (motivoSimulador, "o CoreAI.framework não existe no SDK do simulador — o peso aberto só roda no iPhone")
    #elseif !ORBE_COREAI
    return (motivoSemBiblioteca, "a biblioteca do Core AI não foi vendorizada neste build (scripts/coreai/montar.sh)")
    #else
    return nil
    #endif
  }

  /// Onde o bundle guarda um conjunto de pesos. Dois lugares, nesta ordem: a subpasta que o
  /// podspec cria (`pesos/<nome>`) e a raiz dos recursos (`<nome>`), porque o copiador de
  /// recursos do CocoaPods já achatou hierarquia antes e o sintoma seria "não tenho modelo"
  /// num build que tem.
  static func candidatos(_ pesos: String, raiz: URL?) -> [URL] {
    guard let raiz else { return [] }
    return [
      raiz.appendingPathComponent(pastaDosPesos, isDirectory: true).appendingPathComponent(pesos, isDirectory: true),
      raiz.appendingPathComponent(pesos, isDirectory: true),
    ]
  }

  /// A janela declarada na ficha (`language.max_context_length`), ou `nil`. Nunca lança: a
  /// ficha ilegível já foi tratada antes, e uma janela ausente não impede gerar.
  static func janelaDaFicha(_ ficha: URL) -> Int? {
    guard let dados = try? Data(contentsOf: ficha),
          let lido = try? JSONSerialization.jsonObject(with: dados) as? [String: Any],
          let lingua = lido["language"] as? [String: Any],
          let janela = lingua["max_context_length"] as? Int,
          janela > 0
    else { return nil }
    return janela
  }

  /// O estado dos pesos: a biblioteca, o nome, a pasta e a ficha — nesta ordem, porque é a
  /// ordem em que uma resposta é útil. Puro sobre o sistema de arquivos; sem SDK e sem modelo.
  static func estado(_ pesos: String, raiz: URL? = Bundle.main.resourceURL) -> EstadoDosPesos {
    if let bloqueio = motivoDaBiblioteca() {
      return .falta(motivo: bloqueio.motivo, detalhe: bloqueio.detalhe)
    }
    return estadoDaPasta(pesos, raiz: raiz)
  }

  /// A metade que **só olha o disco** — separada de {@link estado} para ser percorrida no Mac,
  /// onde a biblioteca nunca está presente e o atalho de cima responderia por ela.
  static func estadoDaPasta(_ pesos: String, raiz: URL?) -> EstadoDosPesos {
    if !nomeValido(pesos) {
      return .falta(motivo: motivoSemPesos, detalhe: "o nome dos pesos não é um nome de pasta: \(Engine.cortado(pesos))")
    }
    let procurados = candidatos(pesos, raiz: raiz)
    if procurados.isEmpty {
      return .falta(motivo: motivoSemPesos, detalhe: "o bundle não tem pasta de recursos")
    }
    // **Varre todos os candidatos antes de desistir.** Um `return` no primeiro que existe e
    // não serve faria a lista de candidatos não servir para nada: bastaria uma pasta `pesos/`
    // vazia para o caminho achatado — a razão de a lista existir — nunca ser tentado. A falta
    // guardada é a do **último** candidato que ao menos existia, porque ela é mais específica
    // que "este build não traz os pesos".
    let gerente = FileManager.default
    var ultimaFalta: EstadoDosPesos?
    for pasta in procurados {
      var eDiretorio: ObjCBool = false
      guard gerente.fileExists(atPath: pasta.path, isDirectory: &eDiretorio), eDiretorio.boolValue else { continue }
      let ficha = pasta.appendingPathComponent(arquivoDaFicha)
      guard gerente.fileExists(atPath: ficha.path) else {
        ultimaFalta = .falta(
          motivo: motivoPesosIlegiveis,
          detalhe: "a pasta \(pesos) existe em \(pasta.path) e não tem \(arquivoDaFicha) — não é um bundle de Core AI"
        )
        continue
      }
      guard let dados = try? Data(contentsOf: ficha), (try? JSONSerialization.jsonObject(with: dados)) != nil else {
        ultimaFalta = .falta(motivo: motivoPesosIlegiveis, detalhe: "o \(arquivoDaFicha) de \(pasta.path) não se lê como JSON")
        continue
      }
      return .pronto(pasta, janela: janelaDaFicha(ficha))
    }
    return ultimaFalta ?? .falta(motivo: motivoSemPesos, detalhe: "este build não traz os pesos \(pesos)")
  }

  // MARK: a falha de carga → o identificador (a tabela pura)

  /// O que a casca contou sobre uma falha ao **abrir** os pesos.
  ///
  /// Em tipos que só o `Foundation` conhece, de propósito: o erro de verdade vem de um módulo
  /// que este arquivo não enxerga (é isso que o `internal import` da casca compra), e a tabela
  /// abaixo precisa ser percorrida **sem a biblioteca e sem modelo** — é o que a bancada faz
  /// no Mac (`scripts/bancada/aparelho/testes.swift`).
  struct FalhaDaCarga: Equatable, Sendable {
    let nomeDoTipo: String
    let descricao: String
    let dominio: String
    let codigo: Int
  }

  /// O domínio e o código de "acabou a memória", como o POSIX os escreve. É o único caso que
  /// a carga distingue por número; o resto é prosa, e prosa não decide.
  static let dominioPosix = "NSPOSIXErrorDomain"
  static let codigoSemMemoria = 12 // ENOMEM

  /// Uma falha de carga → identificador do `Engine`. Pura e exaustiva sobre o que sabemos
  /// distinguir:
  ///
  ///   memória              → `capacidadeNaoSuportada` (o aparelho atende, este peso não cabe)
  ///   qualquer outra carga → `pesosAusentes` (`indisponivel`: recua para o próximo elo)
  ///
  /// **Por que o resto todo é `indisponivel`.** Uma carga que falha é sempre "este motor não
  /// atende pedido nenhum agora" — pasta corrompida, especialização que não passou, disco.
  /// Nenhuma delas melhora repetindo o mesmo pedido, e todas melhoram indo para o próximo
  /// elo da cadeia. Chamar isso de `transitoria` prenderia a leitura no piso.
  static func identificar(_ f: FalhaDaCarga) -> ErroDoModelo {
    if f.dominio == dominioPosix && f.codigo == codigoSemMemoria { return .capacidadeNaoSuportada }
    if pareceFaltaDeMemoria(f) { return .capacidadeNaoSuportada }
    return .pesosAusentes
  }

  /// A rede da memória, para quando ela não vem como `ENOMEM`.
  ///
  /// **É sniffing de texto, e está declarado como tal.** O erro de alocação do Core AI não
  /// tem domínio nem código estáveis documentados, e o preço de errar para os dois lados é
  /// assimétrico: chamar falta de memória de `indisponivel` só recua um elo, enquanto o
  /// contrário não existe (nenhuma outra falha de carga diz "memory"). Quando houver um
  /// código estável, ele sobe para {@link identificar} e isto sai.
  static func pareceFaltaDeMemoria(_ f: FalhaDaCarga) -> Bool {
    let texto = "\(f.nomeDoTipo) \(f.descricao)".lowercased()
    return texto.contains("out of memory")
      || texto.contains("memory limit")
      || texto.contains("insufficient memory")
      || texto.contains("cannot allocate")
  }

  /// A falha de carga, já como linha do fio. O detalhe leva a descrição da casca **cortada**
  /// pelo mesmo limite do `Engine`.
  static func falhaDaCarga(_ f: FalhaDaCarga) -> FalhaDoFio {
    let par = f.dominio.isEmpty ? f.nomeDoTipo : "\(f.nomeDoTipo) · \(f.dominio) \(f.codigo)"
    return Engine.falhaDe(identificar(f), detalhe: "os pesos não abriram (\(par)): \(f.descricao)")
  }

  /// A falta virando falha do fio — a mesma para as duas portas.
  static func falhaDaFalta(motivo: String, detalhe: String) -> FalhaDoFio {
    Engine.falhaDe(.pesosAusentes, detalhe: "\(motivo): \(detalhe)")
  }

  // MARK: as duas portas

  /// A porta da geração: o nome dos pesos e o pedido canônico entram, uma linha JSON sai.
  /// Nunca lança — como a do `Engine`.
  ///
  /// `raiz` existe para a bancada: no app é sempre a pasta de recursos do bundle, e a cola
  /// chama a forma de dois argumentos. Sem ela, o ramo com `ORBE_COREAI` só seria exercível
  /// num iPhone, que é onde ele estava sem nenhuma guarda.
  static func responder(pesos: String, pedido: String, raiz: URL? = Bundle.main.resourceURL) async -> String {
    Engine.codificar(await executar(pesos: pesos, pedido: pedido, raiz: raiz))
  }

  /// A porta do diagnóstico: o que o seletor mostra antes de pedir qualquer coisa. **A mesma
  /// linha** que o modelo do sistema devolve (`DiagnosticoDoFio`), para o núcleo ler os dois
  /// com um leitor só. A `variante` é o nome dos pesos; a `janela`, a da ficha.
  static func diagnostico(pesos: String, raiz: URL? = Bundle.main.resourceURL) -> String {
    Engine.codificar(diagnosticar(pesos: pesos, raiz: raiz))
  }

  static func diagnosticar(pesos: String, raiz: URL? = Bundle.main.resourceURL) -> DiagnosticoDoFio {
    switch estado(pesos, raiz: raiz) {
    case .falta(let motivo, _):
      return DiagnosticoDoFio(
        disponivel: false, motivo: motivo, variante: nil, janela: nil,
        plataforma: Engine.plataforma(), buildDoSistema: Engine.buildDoSistema()
      )
    case .pronto(_, let janela):
      return DiagnosticoDoFio(
        disponivel: true, motivo: nil, variante: pesos, janela: janela,
        plataforma: Engine.plataforma(), buildDoSistema: Engine.buildDoSistema()
      )
    }
  }

  static func executar(pesos: String, pedido: String, raiz: URL? = Bundle.main.resourceURL) async -> SaidaDaPonte {
    let preparado: PedidoPreparado
    switch Engine.preparar(pedido) {
    case .success(let p): preparado = p
    case .failure(let f): return .falha(f)
    }
    let pasta: URL
    switch estado(pesos, raiz: raiz) {
    case .falta(let motivo, let detalhe): return .falha(falhaDaFalta(motivo: motivo, detalhe: detalhe))
    case .pronto(let url, _): pasta = url
    }
    return await gerar(preparado, pesos: pesos, pasta: pasta)
  }

  #if ORBE_COREAI && !targetEnvironment(simulator)
  /// A geração, com a biblioteca presente.
  ///
  /// **Uma sessão nova por pedido**, como no `Engine`: a casca abre uma por chamada e nada
  /// sobrevive entre duas. O guardrail do pedido não tem efeito aqui — peso aberto não tem o
  /// guardrail da Apple —, e isso é dito no comentário em vez de virar falha: recusar o
  /// pedido por causa de um campo que não se aplica tiraria o motor do seletor por engano.
  static func gerar(_ p: PedidoPreparado, pesos: String, pasta: URL) async -> SaidaDaPonte {
    var esquema: GenerationSchema?
    if let e = p.esquema {
      switch Engine.esquemaDaSessao(e) {
      case .success(let s): esquema = s
      case .failure(let f): return .falha(f)
      }
    }

    let sessao: LanguageModelSession
    do {
      sessao = try await OrbeCoreAI.sessao(pesosEm: pasta, instrucoes: p.sistema)
    } catch let e as OrbeCoreAIErro {
      return .falha(falhaDaCarga(FalhaDaCarga(nomeDoTipo: e.nomeDoTipo, descricao: e.descricao, dominio: e.dominio, codigo: e.codigo)))
    } catch {
      let ns = error as NSError
      return .falha(falhaDaCarga(FalhaDaCarga(
        nomeDoTipo: String(reflecting: type(of: error)), descricao: String(describing: error),
        dominio: ns.domain, codigo: ns.code
      )))
    }

    let opcoes = GenerationOptions(samplingMode: p.gulosa ? .greedy : nil)
    do {
      if let esquema {
        let r = try await sessao.respond(to: p.usuario, schema: esquema, includeSchemaInPrompt: true, options: opcoes)
        return Engine.resposta(r.content.jsonString, tokens: Engine.tokensDe(r), provedor: provedor, modelo: pesos)
      }
      let r = try await sessao.respond(to: p.usuario, options: opcoes)
      return Engine.resposta(r.content, tokens: Engine.tokensDe(r), provedor: provedor, modelo: pesos)
    } catch {
      // A geração é do Foundation Models, como a do modelo do sistema: a mesma tabela lê os
      // dois erros. É por isso que este arquivo não tem tabela de geração própria.
      return .falha(Engine.falhaDe(Engine.identificar(error), lancado: error))
    }
  }
  #else
  /// Sem a biblioteca — ou no simulador — a geração não existe. `estado` já devolveu a falta
  /// antes de chegar aqui; este corpo é a rede, e diz o mesmo.
  static func gerar(_ p: PedidoPreparado, pesos: String, pasta: URL) async -> SaidaDaPonte {
    let bloqueio = motivoDaBiblioteca()
    return .falha(falhaDaFalta(
      motivo: bloqueio?.motivo ?? motivoSemBiblioteca,
      detalhe: bloqueio?.detalhe ?? "a biblioteca do Core AI não está neste build"
    ))
  }
  #endif
}
