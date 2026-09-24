// A casca falsa do Core AI — o módulo `OrbeCoreAI` do Mac (story 5.8).
//
// **Por que existe.** O `MotorCoreAI.swift` tem dois modos: com `ORBE_COREAI` (o iPhone, com
// a biblioteca vendorizada) e sem (o simulador, um clone sem `montar.sh`, e a bancada). Até
// aqui nada no caminho de verificação compilava o **primeiro** — a macro só existe no
// podspec. O resultado era um ramo inteiro sem guarda: apagar `provedor:` de uma chamada de
// `Engine.resposta` compilava, e o texto do peso aberto sairia assinado como
// `apple / system-language-model`, quebrando exatamente a tela que existe para distinguir os
// motores.
//
// Este arquivo é compilado como um módulo chamado `OrbeCoreAI` e entregue ao
// `MotorCoreAI.swift` com `-D ORBE_COREAI`. Ele espelha a **superfície pública** da casca de
// verdade (`scripts/coreai/OrbeCoreAI.swift`) — os mesmos nomes, os mesmos tipos —, e por
// dentro devolve uma sessão que escreve uma frase combinada, sem Core AI, sem pesos e sem
// rede. O que se prova com ele é o que o Orbe escreve em volta do modelo: a assinatura, a
// classe da falha de carga e o contrato da linha.
//
// **Não é a casca de verdade, e não tenta ser.** A de verdade abre 244 MiB de pesos pelo
// `CoreAILanguageModel`; esta abre nada. Quem prova que o modelo de verdade gera é o iPhone.
//
// Só a bancada compila este arquivo. Ele nunca entra no pod — a lista fechada de `.swift` do
// módulo (`architecture.test.ts`) tem três nomes, e nenhum é este.

public import Foundation
public import FoundationModels

/// Espelha `OrbeCoreAIFase` da casca de verdade.
public enum OrbeCoreAIFase: String, Sendable {
  case carga
  case inspecao
}

/// Espelha `OrbeCoreAICompilacao` da casca de verdade, campo por campo.
public struct OrbeCoreAICompilacao: Sendable, Equatable {
  public let componentes: Int
  public let compilados: Int

  public init(componentes: Int, compilados: Int) {
    self.componentes = componentes
    self.compilados = compilados
  }
}

/// Espelha `OrbeCoreAIErro` da casca de verdade, campo por campo.
public struct OrbeCoreAIErro: Error, Sendable {
  public let fase: OrbeCoreAIFase
  public let nomeDoTipo: String
  public let descricao: String
  public let dominio: String
  public let codigo: Int

  public init(fase: OrbeCoreAIFase, nomeDoTipo: String, descricao: String, dominio: String, codigo: Int) {
    self.fase = fase
    self.nomeDoTipo = nomeDoTipo
    self.descricao = descricao
    self.dominio = dominio
    self.codigo = codigo
  }
}

/// O modelo de mentira: ele não tem peso nenhum, só a frase que vai devolver.
///
/// Conformar `LanguageModel` de fora é público no 27 (a Apple documenta isso em "Bring an LLM
/// provider to the Foundation Models framework"), e é o mesmo encaixe que o
/// `CoreAILanguageModel` usa — então a sessão que sai daqui é uma `LanguageModelSession` de
/// verdade, e o `respond(to:)` que o `MotorCoreAI` chama é o do framework.
struct ModeloDeMentira: LanguageModel {
  typealias Executor = ExecutorDeMentira

  let texto: String

  var capabilities: LanguageModelCapabilities { LanguageModelCapabilities([]) }
  var executorConfiguration: String { texto }
}

struct ExecutorDeMentira: LanguageModelExecutor {
  typealias Model = ModeloDeMentira

  let configuration: String

  init(configuration: String) throws {
    self.configuration = configuration
  }

  func respond(
    to request: LanguageModelExecutorGenerationRequest,
    model: ModeloDeMentira,
    streamingInto channel: LanguageModelExecutorGenerationChannel
  ) async throws {
    await channel.send(.response(action: .appendText(model.texto, tokenCount: 1)))
  }
}

public enum OrbeCoreAI {
  /// O que a próxima sessão vai escrever. O teste troca isto antes de pedir.
  nonisolated(unsafe) public static var textoDeMentira = "uma frase do peso aberto"
  /// Quando não for `nil`, `sessao` lança isto em vez de abrir — é assim que o teste percorre
  /// a falha de **carga** sem ter um `.aimodel` corrompido à mão.
  nonisolated(unsafe) public static var falhaNaCarga: OrbeCoreAIErro?

  /// O que a próxima inspeção vai contar. `(1, 1)` é "compilado"; `(1, 0)`, "não compilado";
  /// `(0, 0)`, a pasta sem componente — os três desfechos que o `MotorCoreAI` distingue.
  nonisolated(unsafe) public static var contagemDeMentira = OrbeCoreAICompilacao(componentes: 1, compilados: 1)
  /// Quando não for `nil`, `compilacao` lança isto — a pasta que não se deixa listar.
  nonisolated(unsafe) public static var falhaNaInspecao: OrbeCoreAIErro?

  public static func sessao(pesosEm url: URL, instrucoes: String?) async throws -> LanguageModelSession {
    if let erro = falhaNaCarga { throw erro }
    return LanguageModelSession(model: ModeloDeMentira(texto: textoDeMentira), instructions: instrucoes.map { Instructions($0) })
  }

  /// Espelha `compilar(pesosEm:)` da casca de verdade. Usa o **mesmo** `falhaNaCarga` que a
  /// sessão, porque é o mesmo passo — a de verdade também carrega os pesos e também sai na
  /// fase `.carga`. Um segundo botão aqui deixaria os dois caminhos divergirem no teste sem
  /// divergirem no aparelho.
  public static func compilar(pesosEm url: URL) async throws {
    // A de verdade **gera um token** para forçar a especialização (abrir o modelo não
    // compila nada — medido em 24/09). O que a falsa precisa espelhar é a fase da falha,
    // e ela continua sendo `.carga`: a geração de um token dentro do `compilar` sai pelo
    // mesmo caminho que a carga, porque é o motor que não subiu.
    if let erro = falhaNaCarga { throw erro }
  }

  /// Espelha `compilacao(dosPesosEm:)` da casca de verdade. Não olha o disco: a de verdade
  /// pergunta ao cache do Core AI, e o que o Orbe decide é sobre os **números** que voltam.
  public static func compilacao(dosPesosEm url: URL) throws -> OrbeCoreAICompilacao {
    if let erro = falhaNaInspecao { throw erro }
    return contagemDeMentira
  }
}
