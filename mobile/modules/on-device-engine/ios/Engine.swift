// A ponte do aparelho — Swift nosso, sem estado e sem domínio (AD-3, AD-4, ADR 0047).
//
// Recebe **uma** string — a de `serializarPedido` (`packages/shared/src/ia/motor.ts`), o
// pedido canônico — e devolve **uma** linha JSON:
//
//     sucesso  {"buildDoSistema":…,"modelo":…,"plataforma":…,"provedor":…,"texto":…,"tokens":{…}}
//     falha    {"classe":…,"detalhe":…,"naoMapeado":true}
//
// Quem traduz essa linha em `Resposta | Falha` é o núcleo (`ia/aparelho.ts`), com teste;
// quem decide o que fazer com a falha é o orquestrador, pela classe. O que mora aqui é só
// o que tem de morar perto do SDK: a sessão, a amostragem, o guardrail, a conversão de
// esquema e a tabela erro → classe.
//
// **Sem estado.** Uma sessão nova por pedido; nada sobrevive entre duas chamadas. A janela
// é lida de `contextSize` em execução, nunca de constante.
//
// **Só dois imports**, e a guarda (4) do `architecture.test.ts` cobra: nada de
// `ExpoModulesCore` (a cola do Expo é outro arquivo, `OnDeviceEngineModule.swift`, e só
// repassa) e nada de modelo de servidor — a ponte só instancia pesos que rodam no aparelho.
//
// **Compilado sem cópia** por dois hospedeiros: a CLI da bancada (`scripts/bancada/aparelho/`,
// `swiftc` direto sobre este caminho) e o módulo Expo do app (story 5.9, o pod
// `OnDeviceEngine`, com a cola no mesmo pod — é por isso que `Engine` pode ser `internal`).
// Este arquivo não sabe qual dos dois o chamou.
//
// **Duas portas, as duas sem lançar:** `responder(pedido)` (a geração) e `diagnostico()` (o
// que o seletor mostra antes de pedir qualquer coisa: se o modelo atende, qual variante e que
// janela — ou por que não).

import Foundation
import FoundationModels

// MARK: - As classes de falha

/// As sete classes de falha do Orbe, com o valor bruto de cada uma **escrito à mão**.
///
/// É a mesma lista de `CLASSES_DE_FALHA` (`packages/shared/src/ia/fio.ts`), e a guarda (3)
/// do `architecture.test.ts` exige a igualdade — um valor a menos, a mais ou com outra
/// grafia reprova a suíte do núcleo. O valor bruto é explícito em todo caso de propósito:
/// o implícito seria o nome Swift (`recusaDoModelo`), que não é a grafia do fio.
enum ClasseDeFalha: String, Encodable, Sendable {
  case indisponivel = "indisponivel"
  case capacidade = "capacidade"
  case janela = "janela"
  case guarda = "guarda"
  case recusaDoModelo = "recusa-do-modelo"
  case saidaInvalida = "saida-invalida"
  case transitoria = "transitoria"
}

// MARK: - O que deu errado, antes de virar classe

/// O erro **reconhecido**, no vocabulário da ponte.
///
/// A tabela tem duas metades, e é isso que a torna testável sem modelo: o `switch` sobre o
/// erro da Apple produz um destes identificadores (`Engine.identificar`), e o identificador
/// vira classe por uma função pura (`Engine.classe(de:)`). A segunda metade não depende de
/// sistema, de SDK nem de modelo carregado — `testes.swift` a percorre inteira.
enum ErroDoModelo: Equatable, Sendable {
  // indisponivel: o motor não atende pedido nenhum agora.
  case sistemaAntigo
  case naoElegivel
  case inteligenciaDesligada
  case modeloNaoPronto
  case pesosAusentes
  // capacidade: atende, mas não este pedido.
  case idiomaNaoSuportado
  case guiaNaoSuportado
  case capacidadeNaoSuportada
  case conteudoNaoSuportado
  case esquemaNaoConvertido
  case pedidoIlegivel
  // janela: o pedido não cabe.
  case contextoExcedido
  // guarda: o guardrail bloqueou.
  case guardrail
  // recusa-do-modelo: o modelo recusou (na geração guiada, pelo erro).
  case recusa
  // saida-invalida: a resposta não se lê.
  case conteudoIlegivel
  case respostaVazia
  // transitoria: o mesmo pedido pode dar certo depois.
  case taxa
  case concorrencia
  case prazo
  /// Erro que a ponte não reconhece — um caso novo da Apple, ou um `@unknown default`.
  /// Leva o nome cru: é por ele que o anel mapeia o caso depois (AD-4).
  case naoMapeado(String)
}

// MARK: - O pedido, como o fio o manda

/// O pedido decodificado — o `Codable` único da ponte. Espelha `Pedido` do núcleo, mais a
/// `versaoDoDescritor` que `serializarPedido` acrescenta (lida, e não usada).
///
/// **Chave desconhecida recusa**, como no esquema: um pedido que cresceu do lado do núcleo
/// sem a ponte saber seria atendido pela metade, calado. Ele vira `capacidade`, e a guarda
/// do contrato no `architecture.test.ts` cobra que os campos daqui são as chaves do `Pedido`.
struct PedidoDoFio: Decodable, Sendable {
  let sistema: String
  let usuario: String
  let amostragem: String
  let guardrails: String
  let saida: SaidaDoFio
  let versaoDoDescritor: Int?

  static let chaves: Set<String> = ["sistema", "usuario", "amostragem", "guardrails", "saida", "versaoDoDescritor"]

  struct SaidaDoFio: Decodable, Sendable {
    let tipo: String
    let esquema: EsquemaDoFio?

    static let chaves: Set<String> = ["tipo", "esquema"]

    init(from decoder: any Decoder) throws {
      let c = try decoder.container(keyedBy: ChaveDoFio.self)
      try recusarDesconhecidas(c, permitidas: Self.chaves, onde: "saida")
      self.tipo = try c.decode(String.self, forKey: ChaveDoFio("tipo"))
      self.esquema = try c.decodeIfPresent(EsquemaDoFio.self, forKey: ChaveDoFio("esquema"))
    }
  }

  init(from decoder: any Decoder) throws {
    let c = try decoder.container(keyedBy: ChaveDoFio.self)
    try recusarDesconhecidas(c, permitidas: Self.chaves, onde: "pedido")
    self.sistema = try c.decode(String.self, forKey: ChaveDoFio("sistema"))
    self.usuario = try c.decode(String.self, forKey: ChaveDoFio("usuario"))
    self.amostragem = try c.decode(String.self, forKey: ChaveDoFio("amostragem"))
    self.guardrails = try c.decode(String.self, forKey: ChaveDoFio("guardrails"))
    self.saida = try c.decode(SaidaDoFio.self, forKey: ChaveDoFio("saida"))
    self.versaoDoDescritor = try c.decodeIfPresent(Int.self, forKey: ChaveDoFio("versaoDoDescritor"))
  }
}

/// Uma chave qualquer do JSON — para ler o objeto e conferir o que veio a mais.
struct ChaveDoFio: CodingKey {
  let stringValue: String
  var intValue: Int? { nil }
  init(stringValue: String) { self.stringValue = stringValue }
  init?(intValue: Int) { nil }
  init(_ s: String) { self.stringValue = s }
}

/// A chave que o fio não declara é recusa, não silêncio.
func recusarDesconhecidas(_ c: KeyedDecodingContainer<ChaveDoFio>, permitidas: Set<String>, onde: String) throws {
  for chave in c.allKeys where !permitidas.contains(chave.stringValue) {
    throw ErroDoPedido.chave(chave.stringValue, onde)
  }
}

/// Por que o pedido não se lê — além do JSON quebrado.
enum ErroDoPedido: Error, CustomStringConvertible {
  case chave(String, String)

  var description: String {
    switch self {
    case .chave(let k, let onde): return "chave desconhecida \"\(k)\" no \(onde)"
    }
  }
}

/// O subconjunto fechado de JSON Schema de `ia/fio.ts`. **Palavra desconhecida não é
/// ignorada**: um tradutor que pula o que não conhece entrega ao modelo um esquema diferente
/// do que o recurso declarou, calado. Ela vira `capacidade`, pelo erro de decodificação.
struct EsquemaDoFio: Decodable, Sendable {
  let tipo: String
  /// Em ordem de nome — o fio é canônico, e a ordem de geração tem de ser a mesma sempre.
  let propriedades: [(nome: String, esquema: EsquemaDoFio)]
  let obrigatorias: [String]
  let opcoes: [String]?
  let minimo: Int?
  let maximo: Int?
  let itens: [EsquemaDoFio]
  let minItens: Int?
  let maxItens: Int?

  /// As palavras de cada tipo — a mesma tabela `PALAVRAS` do fio.
  static let palavras: [String: Set<String>] = [
    "object": ["type", "properties", "required"],
    "string": ["type", "enum"],
    "integer": ["type", "minimum", "maximum"],
    "boolean": ["type"],
    "array": ["type", "items", "minItems", "maxItems"],
  ]

  typealias Chave = ChaveDoFio

  init(from decoder: any Decoder) throws {
    let c = try decoder.container(keyedBy: Chave.self)
    let tipo = try c.decode(String.self, forKey: Chave("type"))
    guard let permitidas = Self.palavras[tipo] else {
      throw ErroDeConversao.tipo(tipo)
    }
    for chave in c.allKeys where !permitidas.contains(chave.stringValue) {
      throw ErroDeConversao.palavra(chave.stringValue, tipo)
    }
    self.tipo = tipo
    if c.contains(Chave("properties")) {
      let p = try c.nestedContainer(keyedBy: Chave.self, forKey: Chave("properties"))
      self.propriedades = try p.allKeys
        .sorted { $0.stringValue < $1.stringValue }
        .map { (nome: $0.stringValue, esquema: try p.decode(EsquemaDoFio.self, forKey: $0)) }
    } else {
      self.propriedades = []
    }
    self.obrigatorias = try c.decodeIfPresent([String].self, forKey: Chave("required")) ?? []
    self.opcoes = try c.decodeIfPresent([String].self, forKey: Chave("enum"))
    self.minimo = try c.decodeIfPresent(Int.self, forKey: Chave("minimum"))
    self.maximo = try c.decodeIfPresent(Int.self, forKey: Chave("maximum"))
    if c.contains(Chave("items")) {
      self.itens = [try c.decode(EsquemaDoFio.self, forKey: Chave("items"))]
    } else {
      self.itens = []
    }
    self.minItens = try c.decodeIfPresent(Int.self, forKey: Chave("minItems"))
    self.maxItens = try c.decodeIfPresent(Int.self, forKey: Chave("maxItems"))
  }
}

/// Por que um esquema do fio não virou esquema do SDK.
enum ErroDeConversao: Error, CustomStringConvertible {
  case tipo(String)
  case palavra(String, String)
  case forma(String)

  var description: String {
    switch self {
    case .tipo(let t): return "tipo fora do subconjunto: \(t)"
    case .palavra(let p, let t): return "palavra desconhecida \"\(p)\" num esquema \(t)"
    case .forma(let m): return m
    }
  }
}

// MARK: - A saída, como o fio a lê

struct TokensDoFio: Encodable, Equatable, Sendable {
  let entrada: Int
  let saida: Int
}

struct RespostaDoFio: Encodable, Sendable {
  let texto: String
  let provedor: String
  let modelo: String
  let plataforma: String
  let buildDoSistema: String
  let tokens: TokensDoFio?
}

struct FalhaDoFio: Encodable, Error, Sendable {
  let classe: ClasseDeFalha
  let detalhe: String?
  /// Só `true` ou ausente — o fio não tem `naoMapeado: false`.
  let naoMapeado: Bool?
}

enum SaidaDaPonte: Sendable {
  case resposta(RespostaDoFio)
  case falha(FalhaDoFio)
}

// MARK: - O diagnóstico, como o fio o lê

/// O que o app precisa saber do modelo do sistema **antes** de pedir qualquer coisa: se ele
/// atende — e, se atende, qual variante e que janela; se não, por quê. Uma linha JSON, lida
/// por `lerDiagnosticoDoAparelho` (`ia/aparelho.ts`); a guarda do contrato no
/// `architecture.test.ts` cobra que os campos daqui são as chaves que o núcleo lê.
///
/// Os opcionais saem do JSON quando nulos (o `Encodable` sintetizado os pula).
struct DiagnosticoDoFio: Encodable, Equatable, Sendable {
  let disponivel: Bool
  /// Só quando indisponível: o nome de um dos três casos de `UnavailableReason`,
  /// `sistemaAntigo` abaixo do 26, ou o nome cru do caso que este build não conhece.
  let motivo: String?
  /// Só quando disponível, e só no 27: o `displayName` da variante ("AFM 3 Core").
  let variante: String?
  /// Só quando disponível: a janela, em tokens, lida de `contextSize`.
  let janela: Int?
  let plataforma: String
  let buildDoSistema: String
}

// MARK: - O pedido preparado

/// O pedido traduzido para as opções do SDK, **antes** de tocar o modelo. Separado de
/// `gerar` para a conversão ser testável sem Apple Intelligence ligada.
struct PedidoPreparado {
  let sistema: String
  let usuario: String
  let gulosa: Bool
  let permissivo: Bool
  /// Presente só com saída `esquema`.
  let esquema: EsquemaDoFio?
}

// MARK: - A ponte

enum Engine {
  /// Quem forneceu os pesos, na assinatura. É o único lugar do aparelho que nomeia a Apple.
  static let provedor = "apple"
  /// O modelo do sistema, na variante de uso geral — o que `aparelho:sistema` escolhe. É o
  /// `modelo` da assinatura só quando a variante não se lê (antes do 27); no 27 a assinatura
  /// leva o `displayName` dela, para a tela e a bancada dizerem **qual** modelo escreveu.
  static let modelo = "system-language-model"

  /// O motivo do diagnóstico abaixo do 26: não há modelo do sistema para perguntar.
  static let motivoSistemaAntigo = "sistemaAntigo"

  /// A linha que o diagnóstico devolve se o codificador falhar (inalcançável com os tipos de
  /// `DiagnosticoDoFio`). **Fora do contrato de propósito** — sem `disponivel` —, para o núcleo
  /// a ler como ilegível ("o aparelho não respondeu como esperado") e não como um motivo que
  /// ninguém conhece. A barreira do contrato passa esta string pelo leitor do núcleo e exige isso.
  static let diagnosticoDeReserva = "{\"erro\":\"a ponte não codificou o diagnóstico\"}"

  /// O limite de um `detalhe`. O texto do SDK é diagnóstico, não relatório: cortado, ele
  /// ainda diz o que foi; inteiro, um erro verborrágico empurraria o relatório para o lado.
  static let limiteDoDetalhe = 1_000

  /// A porta da ponte: a string do pedido entra, uma linha JSON sai. Nunca lança.
  static func responder(_ pedido: String) async -> String {
    codificar(await executar(pedido))
  }

  /// A outra porta: o diagnóstico do modelo do sistema, numa linha JSON. Nunca lança, e não
  /// abre sessão — só pergunta ao SDK o que ele já sabe.
  static func diagnostico() -> String {
    codificar(diagnosticar())
  }

  // MARK: o diagnóstico

  static func diagnosticar() -> DiagnosticoDoFio {
    guard #available(iOS 26, macOS 26, *) else {
      return DiagnosticoDoFio(
        disponivel: false, motivo: motivoSistemaAntigo, variante: nil, janela: nil,
        plataforma: plataforma(), buildDoSistema: buildDoSistema()
      )
    }
    // O mesmo modelo que `gerar` instancia para um pedido de guardrail padrão.
    let modelo = modeloDoSistema(permissivo: false)
    if case .unavailable(let motivo) = modelo.availability {
      return DiagnosticoDoFio(
        disponivel: false, motivo: motivoDoDiagnostico(motivo), variante: nil, janela: nil,
        plataforma: plataforma(), buildDoSistema: buildDoSistema()
      )
    }
    // Variante e janela só com o modelo de pé: perguntar a um modelo que não atende é
    // perguntar a quem não sabe responder.
    return DiagnosticoDoFio(
      disponivel: true, motivo: nil, variante: variante(de: modelo), janela: modelo.contextSize,
      plataforma: plataforma(), buildDoSistema: buildDoSistema()
    )
  }

  /// O motivo de indisponibilidade, no diagnóstico: o nome do caso, escrito à mão (o
  /// `String(describing:)` de um enum não é contrato), ou o nome cru do caso que este build
  /// não conhece. Quem o põe em palavras é o app (`mobile/src/lib/motores/catalogo.ts`).
  @available(iOS 26, macOS 26, *)
  static func motivoDoDiagnostico(_ motivo: SystemLanguageModel.Availability.UnavailableReason) -> String {
    switch motivo {
    case .deviceNotEligible: return "deviceNotEligible"
    case .appleIntelligenceNotEnabled: return "appleIntelligenceNotEnabled"
    case .modelNotReady: return "modelNotReady"
    @unknown default: return nomeCru(motivo)
    }
  }

  /// A variante do modelo do sistema — "AFM 3 Core", "AFM 3 Core Advanced" —, ou `nil`
  /// antes do 27, que não a expõe. Símbolo novo dentro de `FoundationModels`: atrás do
  /// compilador **e** da disponibilidade.
  @available(iOS 26, macOS 26, *)
  static func variante(de modelo: SystemLanguageModel) -> String? {
    #if compiler(>=6.4)
    if #available(iOS 27, macOS 27, *) {
      // Aparado aqui, como o núcleo apara na leitura: a assinatura e o diagnóstico dizem o
      // mesmo nome, e um espaço ou uma quebra de linha do SDK não vira outro modelo.
      let nome = modelo.variant.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
      return nome.isEmpty ? nil : nome
    }
    #endif
    return nil
  }

  /// O modelo do sistema, na variante de uso geral, com o guardrail do pedido (AD-3).
  @available(iOS 26, macOS 26, *)
  static func modeloDoSistema(permissivo: Bool) -> SystemLanguageModel {
    SystemLanguageModel(
      useCase: .general,
      guardrails: permissivo ? .permissiveContentTransformations : .default
    )
  }

  static func executar(_ linha: String) async -> SaidaDaPonte {
    let preparado: PedidoPreparado
    switch preparar(linha) {
    case .success(let p): preparado = p
    case .failure(let f): return .falha(f)
    }
    guard #available(iOS 26, macOS 26, *) else {
      return falha(.sistemaAntigo, detalhe: "o modelo do sistema pede iOS 26 ou macOS 26")
    }
    return await gerar(preparado)
  }

  // MARK: a intenção do pedido → as opções

  /// Decodifica e traduz a intenção. Tudo o que a ponte recusa sem perguntar ao modelo sai
  /// daqui como `capacidade`: o pedido é legível para o núcleo e não para esta ponte.
  static func preparar(_ linha: String) -> Result<PedidoPreparado, FalhaDoFio> {
    let p: PedidoDoFio
    do {
      p = try JSONDecoder().decode(PedidoDoFio.self, from: Data(linha.utf8))
    } catch let e as ErroDeConversao {
      return .failure(falhaDe(.esquemaNaoConvertido, detalhe: e.description))
    } catch let e as ErroDoPedido {
      return .failure(falhaDe(.pedidoIlegivel, detalhe: e.description))
    } catch {
      return .failure(falhaDe(.pedidoIlegivel, detalhe: "o pedido não se decodifica: \(error)"))
    }

    let gulosa: Bool
    switch p.amostragem {
    case "gulosa": gulosa = true
    case "padrao": gulosa = false
    default: return .failure(falhaDe(.pedidoIlegivel, detalhe: "amostragem desconhecida: \(p.amostragem)"))
    }

    let permissivo: Bool
    switch p.guardrails {
    case "padrao": permissivo = false
    case "permissivo": permissivo = true
    default: return .failure(falhaDe(.pedidoIlegivel, detalhe: "guardrail desconhecido: \(p.guardrails)"))
    }

    switch p.saida.tipo {
    case "texto":
      if p.saida.esquema != nil {
        return .failure(falhaDe(.pedidoIlegivel, detalhe: "saída texto com esquema"))
      }
      return .success(PedidoPreparado(sistema: p.sistema, usuario: p.usuario, gulosa: gulosa, permissivo: permissivo, esquema: nil))
    case "esquema":
      guard let esquema = p.saida.esquema else {
        return .failure(falhaDe(.pedidoIlegivel, detalhe: "saída esquema sem esquema"))
      }
      // O modo permissivo só existe com saída texto: o tipo do núcleo já impede o par, e
      // quem o montar fora do tipo recebe a mesma recusa aqui.
      if permissivo {
        return .failure(falhaDe(.capacidadeNaoSuportada, detalhe: "o guardrail permissivo só existe com saída texto"))
      }
      return .success(PedidoPreparado(sistema: p.sistema, usuario: p.usuario, gulosa: gulosa, permissivo: false, esquema: esquema))
    default:
      return .failure(falhaDe(.pedidoIlegivel, detalhe: "saída desconhecida: \(p.saida.tipo)"))
    }
  }

  /// Um nome ainda não usado neste esquema. O caminho sozinho não basta: um array `a` dá
  /// `…_a_item` ao item, e uma propriedade chamada `a_item` daria o mesmo nome — e o SDK
  /// recusa tipo repetido, o que viraria `capacidade` por um detalhe de grafia.
  static func nomeUnico(_ base: String, _ usados: inout Set<String>) -> String {
    var nome = base
    var n = 2
    while usados.contains(nome) {
      nome = "\(base)_\(n)"
      n += 1
    }
    usados.insert(nome)
    return nome
  }

  /// O `Esquema` do fio → o esquema dinâmico do SDK. Os nomes saem do caminho e passam por
  /// `nomeUnico`, para dois objetos ou duas escolhas nunca colidirem.
  @available(iOS 26, macOS 26, *)
  static func dinamico(_ e: EsquemaDoFio, nome: String) throws -> DynamicGenerationSchema {
    var usados = Set<String>()
    return try dinamico(e, nome: nome, usados: &usados)
  }

  @available(iOS 26, macOS 26, *)
  static func dinamico(_ e: EsquemaDoFio, nome base: String, usados: inout Set<String>) throws -> DynamicGenerationSchema {
    // Só objeto e escolha levam nome no SDK; os outros não gastam nome nenhum.
    let nome = e.tipo == "object" || (e.tipo == "string" && e.opcoes != nil) ? nomeUnico(base, &usados) : base
    switch e.tipo {
    case "object":
      if e.propriedades.isEmpty { throw ErroDeConversao.forma("\(nome): objeto sem propriedade") }
      let nomes = Set(e.propriedades.map(\.nome))
      for r in e.obrigatorias where !nomes.contains(r) {
        throw ErroDeConversao.forma("\(nome): \"\(r)\" é obrigatória e não é propriedade")
      }
      var propriedades: [DynamicGenerationSchema.Property] = []
      for p in e.propriedades {
        propriedades.append(DynamicGenerationSchema.Property(
          name: p.nome,
          schema: try dinamico(p.esquema, nome: "\(nome)_\(p.nome)", usados: &usados),
          isOptional: !e.obrigatorias.contains(p.nome)
        ))
      }
      return DynamicGenerationSchema(name: nome, properties: propriedades)
    case "string":
      if let opcoes = e.opcoes {
        if opcoes.isEmpty { throw ErroDeConversao.forma("\(nome): enum vazio") }
        return DynamicGenerationSchema(name: nome, anyOf: opcoes)
      }
      return DynamicGenerationSchema(type: String.self)
    case "integer":
      var guias: [GenerationGuide<Int>] = []
      switch (e.minimo, e.maximo) {
      case let (min?, max?):
        if min > max { throw ErroDeConversao.forma("\(nome): minimum maior que maximum") }
        guias.append(.range(min...max))
      case let (min?, nil): guias.append(.minimum(min))
      case let (nil, max?): guias.append(.maximum(max))
      case (nil, nil): break
      }
      return DynamicGenerationSchema(type: Int.self, guides: guias)
    case "boolean":
      return DynamicGenerationSchema(type: Bool.self)
    case "array":
      guard let item = e.itens.first else { throw ErroDeConversao.forma("\(nome): array sem items") }
      if let min = e.minItens, let max = e.maxItens, min > max {
        throw ErroDeConversao.forma("\(nome): minItems maior que maxItems")
      }
      return DynamicGenerationSchema(
        arrayOf: try dinamico(item, nome: "\(nome)_item", usados: &usados),
        minimumElements: e.minItens,
        maximumElements: e.maxItens
      )
    default:
      throw ErroDeConversao.tipo(e.tipo)
    }
  }

  /// O esquema pronto para a sessão. O que não converte é `capacidade`.
  @available(iOS 26, macOS 26, *)
  static func esquemaDaSessao(_ e: EsquemaDoFio) -> Result<GenerationSchema, FalhaDoFio> {
    do {
      return .success(try GenerationSchema(root: dinamico(e, nome: "Resposta"), dependencies: []))
    } catch let erro as ErroDeConversao {
      return .failure(falhaDe(.esquemaNaoConvertido, detalhe: erro.description))
    } catch {
      return .failure(falhaDe(identificar(error), lancado: error))
    }
  }

  // MARK: a geração

  @available(iOS 26, macOS 26, *)
  static func gerar(_ p: PedidoPreparado) async -> SaidaDaPonte {
    var esquema: GenerationSchema?
    if let e = p.esquema {
      switch esquemaDaSessao(e) {
      case .success(let s): esquema = s
      case .failure(let f): return .falha(f)
      }
    }

    // O guardrail é intenção do pedido (AD-3).
    let modelo = modeloDoSistema(permissivo: p.permissivo)
    // `Availability` é `@frozen`: sem `switch`, e o motivo — que não é — passa pelo
    // `@unknown default` de `identificador(de:)`.
    if case .unavailable(let motivo) = modelo.availability {
      return falha(identificador(de: motivo), detalhe: "modelo do sistema indisponível: \(motivo)")
    }
    // Quem vai escrever, na assinatura: a variante quando ela se lê, o nome genérico antes.
    let nomeDoModelo = variante(de: modelo) ?? Engine.modelo

    // A janela, lida em execução. Sem contagem (antes do 26.4, ou se ela falhar), quem diz
    // que não coube é o erro do próprio SDK — a mesma classe, um passo depois. A contagem
    // é um piso (instruções, pedido e esquema; a resposta ainda vai ocupar o resto), e a
    // falha dela não para nada, mas fica no detalhe de qualquer falha que vier depois.
    var rastro: String?
    if #available(iOS 26.4, macOS 26.4, *) {
      do {
        let usados = try await tokensDoPedido(modelo, p, esquema: esquema)
        if usados >= modelo.contextSize {
          return falha(.contextoExcedido, detalhe: "o pedido ocupa ao menos \(usados) tokens, e a janela tem \(modelo.contextSize)")
        }
      } catch {
        rastro = "a contagem de tokens antes da chamada falhou (\(nomeCru(error)))"
      }
    }

    // Uma sessão nova por pedido: nenhum pedido vê o anterior.
    let sessao = LanguageModelSession(model: modelo, instructions: p.sistema)
    let opcoes = GenerationOptions(samplingMode: p.gulosa ? .greedy : nil)
    do {
      if let esquema {
        let r = try await sessao.respond(to: p.usuario, schema: esquema, includeSchemaInPrompt: true, options: opcoes)
        return resposta(r.content.jsonString, tokens: tokensDe(r), rastro: rastro, modelo: nomeDoModelo)
      }
      let r = try await sessao.respond(to: p.usuario, options: opcoes)
      return resposta(r.content, tokens: tokensDe(r), rastro: rastro, modelo: nomeDoModelo)
    } catch {
      return .falha(falhaDe(identificar(error), lancado: error, rastro: rastro))
    }
  }

  @available(iOS 26.4, macOS 26.4, *)
  static func tokensDoPedido(_ modelo: SystemLanguageModel, _ p: PedidoPreparado, esquema: GenerationSchema?) async throws -> Int {
    let instrucoes = try await modelo.tokenCount(for: Instructions(p.sistema))
    let usuario = try await modelo.tokenCount(for: Prompt(p.usuario))
    var doEsquema = 0
    if let esquema { doEsquema = try await modelo.tokenCount(for: esquema) }
    return instrucoes + usuario + doEsquema
  }

  @available(iOS 26, macOS 26, *)
  static func tokensDe<C: Generable>(_ r: LanguageModelSession.Response<C>) -> TokensDoFio? {
    #if compiler(>=6.4)
    if #available(iOS 27, macOS 27, *) {
      return TokensDoFio(entrada: r.usage.input.totalTokenCount, saida: r.usage.output.totalTokenCount)
    }
    #endif
    return nil
  }

  /// `modelo` é o que a assinatura leva: a variante, quando `gerar` a leu; o nome genérico,
  /// quando não.
  static func resposta(_ texto: String, tokens: TokensDoFio?, rastro: String? = nil, modelo: String = Engine.modelo) -> SaidaDaPonte {
    // Texto vazio não é resposta: a porta do núcleo exige texto, e o que volta sem ele não se lê.
    if texto.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      return falha(.respostaVazia, detalhe: ["o modelo devolveu texto vazio", rastro].compactMap { $0 }.joined(separator: " · "))
    }
    return .resposta(RespostaDoFio(
      texto: texto,
      provedor: provedor,
      modelo: modelo,
      plataforma: plataforma(),
      buildDoSistema: buildDoSistema(),
      tokens: tokens
    ))
  }

  // MARK: o erro → o identificador (o `switch` sobre a Apple)

  /// O motivo de indisponibilidade → identificador. `UnavailableReason` não é `@frozen`.
  @available(iOS 26, macOS 26, *)
  static func identificador(de motivo: SystemLanguageModel.Availability.UnavailableReason) -> ErroDoModelo {
    switch motivo {
    case .deviceNotEligible: return .naoElegivel
    case .appleIntelligenceNotEnabled: return .inteligenciaDesligada
    case .modelNotReady: return .modeloNaoPronto
    @unknown default: return .naoMapeado(nomeCru(motivo))
    }
  }

  /// Qualquer erro → identificador. No 27 os tipos novos primeiro; o que eles não
  /// reconhecem ainda passa pelo `GenerationError` — deprecado no 27, mas que a Apple ainda
  /// pode lançar na transição —, e só então vira `naoMapeado`. Antes do 27, só o antigo.
  /// Quando o 27 reconheceu pelo tipo antigo, o detalhe diz (`veioPeloTipoAntigo`).
  static func identificar(_ erro: any Error) -> ErroDoModelo {
    #if compiler(>=6.4)
    if #available(iOS 27, macOS 27, *) {
      if let id = identificarNo27(erro) { return id }
    }
    #endif
    // Fora do bloco do 27 de propósito: aqui o contexto é o do alvo mínimo, e chamar o ramo
    // deprecado não é aviso.
    if #available(iOS 26, macOS 26, *) {
      return identificarNo26(erro)
    }
    return .naoMapeado(nomeCru(erro))
  }

  /// No 27, o erro veio pelo `GenerationError`? É o que o detalhe precisa dizer: a Apple
  /// ainda lança o tipo deprecado, e é por isso que o ramo antigo não pode sumir.
  static func veioPeloTipoAntigo(_ erro: any Error) -> Bool {
    guard #available(iOS 26, macOS 26, *) else { return false }
    var no27 = false
    #if compiler(>=6.4)
    if #available(iOS 27, macOS 27, *) { no27 = true }
    #endif
    return no27 && ehDoTipoAntigo(erro)
  }

  @available(iOS, introduced: 26, deprecated: 27)
  @available(macOS, introduced: 26, deprecated: 27)
  static func ehDoTipoAntigo(_ erro: any Error) -> Bool {
    erro is LanguageModelSession.GenerationError
  }

  #if compiler(>=6.4)
  /// Os tipos do 27. `nil` é "não é nenhum deles" — e o erro segue para o ramo antigo.
  @available(iOS 27, macOS 27, *)
  static func identificarNo27(_ erro: any Error) -> ErroDoModelo? {
    if let e = erro as? LanguageModelError {
      switch e {
      case .contextSizeExceeded: return .contextoExcedido
      case .rateLimited: return .taxa
      case .guardrailViolation: return .guardrail
      case .refusal: return .recusa
      case .unsupportedCapability: return .capacidadeNaoSuportada
      case .unsupportedTranscriptContent: return .conteudoNaoSuportado
      case .unsupportedGenerationGuide: return .guiaNaoSuportado
      case .unsupportedLanguageOrLocale: return .idiomaNaoSuportado
      case .timeout: return .prazo
      @unknown default: return .naoMapeado(nomeCru(e))
      }
    }
    if let e = erro as? LanguageModelSession.Error {
      switch e {
      case .concurrentRequests: return .concorrencia
      case .transcriptMutationWhileResponding: return .concorrencia
      @unknown default: return .naoMapeado(nomeCru(e))
      }
    }
    if let e = erro as? SystemLanguageModel.Error {
      switch e {
      case .assetsUnavailable: return .pesosAusentes
      @unknown default: return .naoMapeado(nomeCru(e))
      }
    }
    if erro is GeneratedContent.ParsingError { return .conteudoIlegivel }
    if erro is GenerationSchema.SchemaError { return .esquemaNaoConvertido }
    return nil
  }
  #endif

  /// O ramo do 26 — e a rede do 27 para o tipo antigo. Deprecado junto com o
  /// `GenerationError`, para o compilador não acusar o uso do tipo deprecado que é
  /// justamente a razão de o ramo existir.
  @available(iOS, introduced: 26, deprecated: 27)
  @available(macOS, introduced: 26, deprecated: 27)
  static func identificarNo26(_ erro: any Error) -> ErroDoModelo {
    if let e = erro as? LanguageModelSession.GenerationError {
      switch e {
      case .exceededContextWindowSize: return .contextoExcedido
      case .assetsUnavailable: return .pesosAusentes
      case .guardrailViolation: return .guardrail
      case .unsupportedGuide: return .guiaNaoSuportado
      case .unsupportedLanguageOrLocale: return .idiomaNaoSuportado
      case .decodingFailure: return .conteudoIlegivel
      case .rateLimited: return .taxa
      case .concurrentRequests: return .concorrencia
      case .refusal: return .recusa
      @unknown default: return .naoMapeado(nomeCru(e))
      }
    }
    if erro is GenerationSchema.SchemaError { return .esquemaNaoConvertido }
    return .naoMapeado(nomeCru(erro))
  }

  // MARK: o identificador → a classe (a tabela pura)

  /// A tabela da AD-4, como função pura e exaustiva: um identificador novo não compila até
  /// ter classe. `naoMapeado` é `transitoria` — cai no piso sem repetir e sem gravar.
  static func classe(de erro: ErroDoModelo) -> ClasseDeFalha {
    switch erro {
    case .sistemaAntigo, .naoElegivel, .inteligenciaDesligada, .modeloNaoPronto, .pesosAusentes:
      return .indisponivel
    case .idiomaNaoSuportado, .guiaNaoSuportado, .capacidadeNaoSuportada, .conteudoNaoSuportado,
         .esquemaNaoConvertido, .pedidoIlegivel:
      return .capacidade
    case .contextoExcedido:
      return .janela
    case .guardrail:
      return .guarda
    case .recusa:
      return .recusaDoModelo
    case .conteudoIlegivel, .respostaVazia:
      return .saidaInvalida
    case .taxa, .concorrencia, .prazo, .naoMapeado:
      return .transitoria
    }
  }

  // MARK: a falha, e a linha

  static func falhaDe(_ erro: ErroDoModelo, detalhe: String?) -> FalhaDoFio {
    var d = detalhe
    var naoMapeado: Bool? = nil
    if case .naoMapeado(let cru) = erro {
      naoMapeado = true
      d = [cru, detalhe].compactMap { $0 }.joined(separator: " · ")
    }
    return FalhaDoFio(classe: classe(de: erro), detalhe: d.map(cortado), naoMapeado: naoMapeado)
  }

  /// A falha de um erro que o SDK lançou. O não mapeado já leva o nome cru no
  /// identificador; repetir a descrição seria ruído.
  static func falhaDe(_ id: ErroDoModelo, lancado: any Error, rastro: String? = nil) -> FalhaDoFio {
    var partes: [String] = []
    if case .naoMapeado = id {} else { partes.append(descricao(lancado)) }
    if veioPeloTipoAntigo(lancado) {
      partes.append("reconhecido pelo tipo antigo (\(nomeCru(lancado)))")
    }
    if let rastro { partes.append(rastro) }
    return falhaDe(id, detalhe: partes.isEmpty ? nil : partes.joined(separator: " · "))
  }

  static func falha(_ id: ErroDoModelo, detalhe: String?) -> SaidaDaPonte {
    .falha(falhaDe(id, detalhe: detalhe))
  }


  static func descricao(_ erro: any Error) -> String {
    (erro as? LocalizedError)?.errorDescription ?? String(describing: erro)
  }

  /// O nome cru de um valor: o tipo qualificado e a descrição dele.
  static func nomeCru(_ valor: Any) -> String {
    "\(String(reflecting: type(of: valor))): \(String(reflecting: valor))"
  }

  static func cortado(_ s: String) -> String {
    s.count <= limiteDoDetalhe ? s : String(s.prefix(limiteDoDetalhe)) + "…"
  }

  /// A saída numa linha. Com chaves ordenadas, e sem quebra: o `JSONEncoder` escapa o
  /// `\n` de dentro das strings, então o que sai daqui nunca atravessa duas linhas.
  static func codificar(_ saida: SaidaDaPonte) -> String {
    let codificador = JSONEncoder()
    codificador.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    do {
      let dados: Data
      switch saida {
      case .resposta(let r): dados = try codificador.encode(r)
      case .falha(let f): dados = try codificador.encode(f)
      }
      if let texto = String(data: dados, encoding: .utf8) { return texto }
    } catch {}
    // Inalcançável com strings e inteiros; se acontecer, a linha ainda é do contrato.
    return "{\"classe\":\"\(ClasseDeFalha.transitoria.rawValue)\",\"detalhe\":\"a ponte não codificou a saída\",\"naoMapeado\":true}"
  }

  /// O diagnóstico numa linha, com o mesmo codificador da saída.
  static func codificar(_ diagnostico: DiagnosticoDoFio) -> String {
    let codificador = JSONEncoder()
    codificador.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    if let dados = try? codificador.encode(diagnostico), let texto = String(data: dados, encoding: .utf8) {
      return texto
    }
    // Inalcançável com strings, inteiros e booleanos. Se acontecer, a linha fica fora do
    // contrato, e o núcleo a lê como ilegível.
    return diagnosticoDeReserva
  }

  // MARK: a assinatura do sistema

  /// "macOS 27.0", "iOS 27.1" — o sistema que forneceu o modelo.
  static func plataforma() -> String {
    let v = ProcessInfo.processInfo.operatingSystemVersion
    #if os(macOS)
    let nome = "macOS"
    #elseif os(iOS)
    let nome = "iOS"
    #else
    let nome = "outro"
    #endif
    let patch = v.patchVersion > 0 ? ".\(v.patchVersion)" : ""
    return "\(nome) \(v.majorVersion).\(v.minorVersion)\(patch)"
  }

  /// O build do sistema — o modelo muda com ele, então é ele que separa duas medições.
  static func buildDoSistema() -> String {
    let s = ProcessInfo.processInfo.operatingSystemVersionString
    if let r = s.range(of: "Build "), let fim = s[r.upperBound...].firstIndex(of: ")") {
      return String(s[r.upperBound..<fim])
    }
    return s
  }
}
