// Os testes da ponte, sem modelo (story 5.10) — local, fora do CI.
//
//     pnpm --filter @vitale/scripts aparelho:testar
//
// Compilado junto com `mobile/modules/on-device-engine/ios/Engine.swift` (o mesmo arquivo
// que a CLI e o app compilam, sem cópia) num executável próprio. Nenhum teste aqui chama o
// modelo: a tabela erro → classe é testável sem ele porque tem duas metades — o `switch`
// sobre o erro da Apple produz um identificador, e o identificador vira classe por uma função
// pura. As duas metades são percorridas aqui; a segunda, inteira.
//
// Também provam o que a ponte recusa **antes** de tocar o modelo: o pedido ilegível, o
// esquema com palavra que ela não converte, o guardrail permissivo com saída guiada. E que a
// saída é sempre **uma** linha, no contrato que `ia/aparelho.ts` lê.

import Foundation
import FoundationModels

@main
struct Testes {
  static func main() async {
    let p = Placar()

    print("a tabela identificador → classe (a metade pura)")
    let tabela: [(ErroDoModelo, ClasseDeFalha)] = [
      (.sistemaAntigo, .indisponivel),
      (.naoElegivel, .indisponivel),
      (.inteligenciaDesligada, .indisponivel),
      (.modeloNaoPronto, .indisponivel),
      (.pesosAusentes, .indisponivel),
      (.idiomaNaoSuportado, .capacidade),
      (.guiaNaoSuportado, .capacidade),
      (.capacidadeNaoSuportada, .capacidade),
      (.conteudoNaoSuportado, .capacidade),
      (.esquemaNaoConvertido, .capacidade),
      (.pedidoIlegivel, .capacidade),
      (.contextoExcedido, .janela),
      (.guardrail, .guarda),
      (.recusa, .recusaDoModelo),
      (.conteudoIlegivel, .saidaInvalida),
      (.respostaVazia, .saidaInvalida),
      (.taxa, .transitoria),
      (.concorrencia, .transitoria),
      (.prazo, .transitoria),
      (.naoMapeado("Algo.novo"), .transitoria),
    ]
    for (id, classe) in tabela {
      p.igual("\(id) → \(classe.rawValue)", Engine.classe(de: id), classe)
    }

    print("o não mapeado leva o nome cru, e só ele leva a marca")
    let naoMapeada = Engine.falhaDe(.naoMapeado("FoundationModels.Novo.caso"), detalhe: "o texto")
    p.igual("naoMapeado é transitoria", naoMapeada.classe, .transitoria)
    p.igual("naoMapeado marca", naoMapeada.naoMapeado, true)
    p.conferir("naoMapeado leva o nome cru", naoMapeada.detalhe?.contains("FoundationModels.Novo.caso") == true, naoMapeada.detalhe ?? "nil")
    for (id, _) in tabela {
      if case .naoMapeado = id { continue }
      p.igual("\(id) não marca naoMapeado", Engine.falhaDe(id, detalhe: nil).naoMapeado, nil)
    }

    print("as classes são as sete do fio, com a grafia do fio")
    let todas: [ClasseDeFalha] = [.indisponivel, .capacidade, .janela, .guarda, .recusaDoModelo, .saidaInvalida, .transitoria]
    p.igual(
      "valores brutos",
      todas.map(\.rawValue),
      ["indisponivel", "capacidade", "janela", "guarda", "recusa-do-modelo", "saida-invalida", "transitoria"]
    )

    await provarOMotorCoreAI(p)

    print("o erro → identificador (a metade do switch)")
    // Cancelamento não está na tabela da AD-4: é "o resto", e o anel precisa saber.
    if case .naoMapeado(let cru) = Engine.identificar(CancellationError()) {
      p.conferir("CancellationError é naoMapeado, com o nome cru", cru.contains("CancellationError"), cru)
    } else {
      p.conferir("CancellationError é naoMapeado", false)
    }
    let estranho = Engine.identificar(ErroEstranho())
    if case .naoMapeado(let cru) = estranho {
      p.conferir("erro desconhecido leva o nome do tipo", cru.contains("ErroEstranho"), cru)
    } else {
      p.conferir("erro desconhecido vira naoMapeado", false, "\(estranho)")
    }
    if #available(macOS 26, iOS 26, *) {
      let esquema = GenerationSchema.SchemaError.emptyTypeChoices(schema: "Resposta", context: .init(debugDescription: "vazio"))
      p.igual("SchemaError", Engine.identificar(esquema), .esquemaNaoConvertido)
      p.igual("não elegível", Engine.identificador(de: .deviceNotEligible), .naoElegivel)
      p.igual("Apple Intelligence desligada", Engine.identificador(de: .appleIntelligenceNotEnabled), .inteligenciaDesligada)
      p.igual("modelo não pronto", Engine.identificador(de: .modelNotReady), .modeloNaoPronto)
      ramo26(p)
    }
    #if compiler(>=6.4)
    if #available(macOS 27, iOS 27, *) {
      ramo27(p)
    }
    #endif

    print("o que a ponte recusa antes de tocar o modelo")
    conferirPreparo(p, "a string de serializarPedido, saída texto", pedidoCanonico(saida: SAIDA_TEXTO), nil)
    conferirPreparo(p, "o esquema da sonda", pedidoCanonico(saida: SAIDA_DA_SONDA), nil)
    conferirPreparo(p, "linha que não é JSON", "isto não é um pedido", .capacidade)
    conferirPreparo(p, "linha vazia", "", .capacidade)
    conferirPreparo(p, "amostragem desconhecida", pedidoCanonico(saida: SAIDA_TEXTO, amostragem: "quente"), .capacidade)
    conferirPreparo(p, "guardrail desconhecido", pedidoCanonico(saida: SAIDA_TEXTO, guardrails: "nenhum"), .capacidade)
    conferirPreparo(p, "permissivo com saída guiada", pedidoCanonico(saida: SAIDA_DA_SONDA, guardrails: "permissivo"), .capacidade)
    conferirPreparo(p, "permissivo com texto passa", pedidoCanonico(saida: SAIDA_TEXTO, guardrails: "permissivo"), nil)
    conferirPreparo(
      p,
      "palavra que a ponte não converte",
      pedidoCanonico(saida: "{\"esquema\":{\"format\":\"date\",\"type\":\"string\"},\"tipo\":\"esquema\"}"),
      .capacidade
    )
    conferirPreparo(
      p,
      "tipo fora do subconjunto",
      pedidoCanonico(saida: "{\"esquema\":{\"type\":\"null\"},\"tipo\":\"esquema\"}"),
      .capacidade
    )
    conferirPreparo(p, "saída esquema sem esquema", pedidoCanonico(saida: "{\"tipo\":\"esquema\"}"), .capacidade)
    conferirPreparo(
      p,
      "chave de topo que o fio não declara",
      "{\"amostragem\":\"gulosa\",\"guardrails\":\"padrao\",\"saida\":{\"tipo\":\"texto\"},\"sistema\":\"s\",\"temperatura\":1,\"usuario\":\"u\"}",
      .capacidade
    )
    conferirPreparo(p, "chave desconhecida dentro da saída", pedidoCanonico(saida: "{\"formato\":\"md\",\"tipo\":\"texto\"}"), .capacidade)
    conferirPreparo(
      p,
      "sem a versão do descritor também passa",
      "{\"amostragem\":\"gulosa\",\"guardrails\":\"padrao\",\"saida\":{\"tipo\":\"texto\"},\"sistema\":\"s\",\"usuario\":\"u\"}",
      nil
    )
    if case .failure(let f) = Engine.preparar("{\"amostragem\":\"gulosa\",\"guardrails\":\"padrao\",\"saida\":{\"tipo\":\"texto\"},\"sistema\":\"s\",\"temperatura\":1,\"usuario\":\"u\"}") {
      p.conferir("a recusa nomeia a chave", f.detalhe?.contains("temperatura") == true, f.detalhe ?? "nil")
    }

    if #available(macOS 26, iOS 26, *) {
      print("a conversão de esquema, sem modelo")
      for (nome, esquema) in [
        ("o da sonda", "{\"properties\":{\"dimensao\":{\"enum\":[\"duracao\",\"horario\"],\"type\":\"string\"}},\"required\":[\"dimensao\"],\"type\":\"object\"}"),
        ("inteiro com faixa", "{\"maximum\":2,\"minimum\":0,\"type\":\"integer\"}"),
        ("lista de booleanos", "{\"items\":{\"type\":\"boolean\"},\"maxItems\":3,\"minItems\":1,\"type\":\"array\"}"),
        ("objeto aninhado", "{\"properties\":{\"a\":{\"properties\":{\"b\":{\"type\":\"string\"}},\"type\":\"object\"},\"c\":{\"enum\":[\"x\"],\"type\":\"string\"}},\"type\":\"object\"}"),
        // `a` é array de objetos (o item se chamaria …_a_item) e `a_item` é objeto: o mesmo
        // nome pelo caminho. Com nomes únicos, converte em vez de virar capacidade.
        ("nomes que colidiriam pelo caminho", "{\"properties\":{\"a\":{\"items\":{\"properties\":{\"x\":{\"type\":\"boolean\"}},\"type\":\"object\"},\"type\":\"array\"},\"a_item\":{\"properties\":{\"y\":{\"type\":\"boolean\"}},\"type\":\"object\"}},\"type\":\"object\"}"),
      ] {
        let e = try? JSONDecoder().decode(EsquemaDoFio.self, from: Data(esquema.utf8))
        guard let e else {
          p.conferir("\(nome) decodifica", false)
          continue
        }
        switch Engine.esquemaDaSessao(e) {
        case .success: p.conferir("\(nome) converte", true)
        case .failure(let f): p.conferir("\(nome) converte", false, f.detalhe ?? "")
        }
      }
      for (nome, esquema) in [
        ("objeto sem propriedade", "{\"properties\":{},\"type\":\"object\"}"),
        ("required que não é propriedade", "{\"properties\":{\"a\":{\"type\":\"string\"}},\"required\":[\"b\"],\"type\":\"object\"}"),
        ("enum vazio", "{\"enum\":[],\"type\":\"string\"}"),
        ("minimum maior que maximum", "{\"maximum\":1,\"minimum\":2,\"type\":\"integer\"}"),
      ] {
        let e = try? JSONDecoder().decode(EsquemaDoFio.self, from: Data(esquema.utf8))
        guard let e else {
          p.conferir("\(nome) decodifica", false)
          continue
        }
        switch Engine.esquemaDaSessao(e) {
        case .success: p.conferir("\(nome) é capacidade", false, "converteu")
        case .failure(let f): p.igual("\(nome) é capacidade", f.classe, .capacidade)
        }
      }
    }

    print("os nomes do esquema dinâmico")
    var usados = Set<String>()
    p.igual("o primeiro nome é o do caminho", Engine.nomeUnico("R_a_item", &usados), "R_a_item")
    p.igual("o repetido ganha sufixo", Engine.nomeUnico("R_a_item", &usados), "R_a_item_2")
    p.igual("e o seguinte, outro", Engine.nomeUnico("R_a_item", &usados), "R_a_item_3")

    print("a saída é uma linha, no contrato de ia/aparelho.ts")
    let boa = Engine.codificar(.resposta(RespostaDoFio(
      texto: "Uma frase.\nCom quebra.",
      provedor: Engine.provedor,
      modelo: Engine.modelo,
      plataforma: Engine.plataforma(),
      buildDoSistema: Engine.buildDoSistema(),
      tokens: TokensDoFio(entrada: 71, saida: 5)
    )))
    p.conferir("resposta numa linha só", !boa.contains("\n"), boa)
    let lida = objeto(boa)
    p.conferir("resposta é JSON", lida != nil, boa)
    p.igual("texto volta inteiro", lida?["texto"] as? String, "Uma frase.\nCom quebra.")
    p.igual(
      "chaves da resposta",
      lida.map { Set($0.keys) },
      Set(["texto", "provedor", "modelo", "plataforma", "buildDoSistema", "tokens"])
    )
    let tokens = lida?["tokens"] as? [String: Any]
    p.igual("tokens", [tokens?["entrada"] as? Int, tokens?["saida"] as? Int], [71, 5])
    let semTokens = objeto(Engine.codificar(.resposta(RespostaDoFio(
      texto: "x", provedor: "p", modelo: "m", plataforma: "macOS 27.0", buildDoSistema: "27A1", tokens: nil
    ))))
    p.conferir("sem tokens, a chave some", semTokens?["tokens"] == nil)

    let ruim = Engine.codificar(.falha(Engine.falhaDe(.guardrail, detalhe: "bloqueou")))
    p.conferir("falha numa linha só", !ruim.contains("\n"), ruim)
    let lidaRuim = objeto(ruim)
    p.igual("classe com a grafia do fio", lidaRuim?["classe"] as? String, "guarda")
    p.conferir("falha mapeada não leva naoMapeado", lidaRuim?["naoMapeado"] == nil, ruim)
    let crua = objeto(Engine.codificar(.falha(Engine.falhaDe(.naoMapeado("X.y"), detalhe: nil))))
    p.igual("naoMapeado é true no fio", crua?["naoMapeado"] as? Bool, true)
    p.conferir(
      "detalhe comprido é cortado",
      (Engine.falhaDe(.prazo, detalhe: String(repeating: "a", count: 5_000)).detalhe?.count ?? 0) <= Engine.limiteDoDetalhe + 1
    )
    p.conferir("resposta vazia é saida-invalida", {
      if case .falha(let f) = Engine.resposta("  \n ", tokens: nil, provedor: Engine.provedor) { return f.classe == .saidaInvalida }
      return false
    }())

    print("o modelo da assinatura (story 5.9)")
    if case .resposta(let r) = Engine.resposta("x", tokens: nil, provedor: Engine.provedor) {
      p.igual("sem variante, o nome genérico", r.modelo, Engine.modelo)
    } else {
      p.conferir("a resposta com texto é resposta", false)
    }
    if case .resposta(let r) = Engine.resposta("x", tokens: nil, provedor: Engine.provedor, modelo: "AFM 3 Core Advanced") {
      p.igual("com variante, a variante", r.modelo, "AFM 3 Core Advanced")
    } else {
      p.conferir("a resposta com variante é resposta", false)
    }

    print("o diagnóstico (story 5.9)")
    if #available(macOS 26, iOS 26, *) {
      p.igual("não elegível", Engine.motivoDoDiagnostico(.deviceNotEligible), "deviceNotEligible")
      p.igual("Apple Intelligence desligada", Engine.motivoDoDiagnostico(.appleIntelligenceNotEnabled), "appleIntelligenceNotEnabled")
      p.igual("modelo não pronto", Engine.motivoDoDiagnostico(.modelNotReady), "modelNotReady")
    }
    let d = Engine.diagnosticar()
    // O que esta máquina diz — é a mesma pergunta que o iPhone vai responder no seletor.
    let linhaDoDiagnostico = Engine.diagnostico()
    print("    (este Mac: \(linhaDoDiagnostico))")
    if d.disponivel {
      p.conferir("disponível não traz motivo", d.motivo == nil, d.motivo ?? "")
      p.conferir("disponível traz a janela, positiva", (d.janela ?? 0) > 0, "\(String(describing: d.janela))")
      #if compiler(>=6.4)
      if #available(macOS 27, iOS 27, *) {
        p.conferir("no 27, disponível traz a variante", !(d.variante ?? "").isEmpty, "\(String(describing: d.variante))")
      }
      #endif
    } else {
      p.conferir("indisponível traz o motivo", !(d.motivo ?? "").isEmpty)
      p.conferir("indisponível não traz variante nem janela", d.variante == nil && d.janela == nil)
    }
    p.conferir("o diagnóstico numa linha só", !linhaDoDiagnostico.contains("\n"), linhaDoDiagnostico)
    let lidoDiagnostico = objeto(linhaDoDiagnostico)
    p.conferir("o diagnóstico é JSON", lidoDiagnostico != nil, linhaDoDiagnostico)
    p.conferir("disponivel é booleano", lidoDiagnostico?["disponivel"] is Bool, linhaDoDiagnostico)
    p.conferir(
      "as chaves do diagnóstico são as do contrato",
      Set(lidoDiagnostico?.keys.map { $0 } ?? []).isSubset(of: ["disponivel", "motivo", "variante", "janela", "plataforma", "buildDoSistema"]),
      linhaDoDiagnostico
    )
    let cheio = objeto(Engine.codificar(DiagnosticoDoFio(
      disponivel: true, motivo: nil, variante: "AFM 3 Core", janela: 8_192, plataforma: "iOS 27.0", buildDoSistema: "27A1"
    )))
    p.igual("o disponível codifica variante e janela", [cheio?["variante"] as? String, (cheio?["janela"] as? Int).map(String.init)], ["AFM 3 Core", "8192"])
    p.conferir("o disponível não codifica motivo", cheio?["motivo"] == nil)
    let fora = objeto(Engine.codificar(DiagnosticoDoFio(
      disponivel: false, motivo: "modelNotReady", variante: nil, janela: nil, plataforma: "iOS 27.0", buildDoSistema: "27A1"
    )))
    p.igual("o indisponível codifica o motivo", fora?["motivo"] as? String, "modelNotReady")
    p.conferir("o indisponível não codifica variante nem janela", fora?["variante"] == nil && fora?["janela"] == nil)

    let reserva = objeto(Engine.diagnosticoDeReserva)
    p.conferir("a linha de reserva do diagnóstico é JSON", reserva != nil, Engine.diagnosticoDeReserva)
    p.conferir("e fica fora do contrato — sem disponivel, o núcleo a lê como ilegível", reserva?["disponivel"] == nil)

    print("a assinatura do sistema")
    p.conferir("plataforma diz o sistema e a versão", Engine.plataforma().contains(" "), Engine.plataforma())
    p.conferir("build do sistema não é vazio", !Engine.buildDoSistema().isEmpty)

    print("")
    if p.falharam.isEmpty {
      print("\(p.passaram) conferências passaram.")
      exit(0)
    }
    print("\(p.falharam.count) de \(p.passaram + p.falharam.count) falharam:")
    for f in p.falharam { print("  - \(f)") }
    exit(1)
  }

  /// O preparo de uma linha: `nil` é "passa"; uma classe é a recusa esperada.
  static func conferirPreparo(_ p: Placar, _ nome: String, _ linha: String, _ esperado: ClasseDeFalha?) {
    switch (Engine.preparar(linha), esperado) {
    case (.success, nil):
      p.conferir(nome, true)
    case (.success, let classe?):
      p.conferir(nome, false, "passou, e devia ser \(classe.rawValue)")
    case (.failure(let f), nil):
      p.conferir(nome, false, "recusou com \(f.classe.rawValue): \(f.detalhe ?? "")")
    case (.failure(let f), let classe?):
      p.igual(nome, f.classe, classe)
      p.conferir("\(nome) diz por quê", !(f.detalhe ?? "").isEmpty)
    }
  }

  /// O ramo do 26 — deprecado junto com o tipo que ele lê.
  @available(macOS, introduced: 26, deprecated: 27)
  @available(iOS, introduced: 26, deprecated: 27)
  static func ramo26(_ p: Placar) {
    typealias G = LanguageModelSession.GenerationError
    let ctx = G.Context(debugDescription: "x")
    let casos: [(G, ErroDoModelo)] = [
      (.exceededContextWindowSize(ctx), .contextoExcedido),
      (.assetsUnavailable(ctx), .pesosAusentes),
      (.guardrailViolation(ctx), .guardrail),
      (.unsupportedGuide(ctx), .guiaNaoSuportado),
      (.unsupportedLanguageOrLocale(ctx), .idiomaNaoSuportado),
      (.decodingFailure(ctx), .conteudoIlegivel),
      (.rateLimited(ctx), .taxa),
      (.concurrentRequests(ctx), .concorrencia),
      (.refusal(G.Refusal(transcriptEntries: []), ctx), .recusa),
    ]
    for (erro, id) in casos {
      p.igual("26: GenerationError → \(id)", Engine.identificarNo26(erro), id)
    }
    if case .naoMapeado = Engine.identificarNo26(ErroEstranho()) {
      p.conferir("26: erro desconhecido é naoMapeado", true)
    } else {
      p.conferir("26: erro desconhecido é naoMapeado", false)
    }
  }

  #if compiler(>=6.4)
  @available(macOS 27, iOS 27, *)
  static func ramo27(_ p: Placar) {
    typealias L = LanguageModelError
    let casos: [(any Error, ErroDoModelo)] = [
      (L.contextSizeExceeded(.init(contextSize: 4096, tokenCount: 5000, debugDescription: "x")), .contextoExcedido),
      (L.rateLimited(.init(resetDate: nil, debugDescription: "x")), .taxa),
      (L.guardrailViolation(.init(debugDescription: "x")), .guardrail),
      (L.refusal(.init(explanation: "não", debugDescription: "x")), .recusa),
      (L.unsupportedCapability(.init(capability: .guidedGeneration, debugDescription: "x")), .capacidadeNaoSuportada),
      (L.unsupportedTranscriptContent(.init(unsupportedContent: [], debugDescription: "x")), .conteudoNaoSuportado),
      (L.unsupportedGenerationGuide(.init(schemaName: nil, debugDescription: "x")), .guiaNaoSuportado),
      (L.unsupportedLanguageOrLocale(.init(languageCode: Locale.LanguageCode("tlh"), debugDescription: "x")), .idiomaNaoSuportado),
      (L.timeout(.init(debugDescription: "x")), .prazo),
      (LanguageModelSession.Error.concurrentRequests, .concorrencia),
      (LanguageModelSession.Error.transcriptMutationWhileResponding, .concorrencia),
      (SystemLanguageModel.Error.assetsUnavailable(.init(debugDescription: "x")), .pesosAusentes),
      (GeneratedContent.ParsingError(rawContent: "{", debugDescription: "x"), .conteudoIlegivel),
    ]
    for (erro, id) in casos {
      p.igual("27: \(String(reflecting: type(of: erro))) → \(id)", Engine.identificar(erro), id)
    }
    // No 27, o que os tipos novos não reconhecem ainda passa pelo `GenerationError` —
    // deprecado, mas a Apple ainda pode lançá-lo na transição — antes de virar naoMapeado.
    // E o detalhe diz que veio pelo tipo antigo.
    let velho = legado()
    p.igual("27: GenerationError ainda é reconhecido pelo ramo antigo", Engine.identificar(velho), .taxa)
    p.conferir("27: e o detalhe diz que veio pelo tipo antigo", Engine.veioPeloTipoAntigo(velho))
    let falha = Engine.falhaDe(Engine.identificar(velho), lancado: velho)
    p.igual("27: a classe é a da tabela, não naoMapeado", falha.naoMapeado, nil)
    p.conferir(
      "27: o detalhe nomeia o tipo antigo",
      falha.detalhe?.contains("tipo antigo") == true && falha.detalhe?.contains("GenerationError") == true,
      falha.detalhe ?? "nil"
    )
    p.conferir("27: o tipo novo não é marcado como antigo", !Engine.veioPeloTipoAntigo(L.timeout(.init(debugDescription: "x"))))
    // E o que nenhum dos dois reconhece continua naoMapeado, com o nome cru.
    if case .naoMapeado(let cru) = Engine.identificar(ErroEstranho()) {
      p.conferir("27: o desconhecido de verdade segue naoMapeado", cru.contains("ErroEstranho"), cru)
    } else {
      p.conferir("27: o desconhecido de verdade segue naoMapeado", false)
    }
  }

  @available(macOS, introduced: 26, deprecated: 27)
  @available(iOS, introduced: 26, deprecated: 27)
  static func legado() -> any Error {
    LanguageModelSession.GenerationError.rateLimited(.init(debugDescription: "x"))
  }
  #endif

  /// O motor de **peso aberto** (story 5.8), percorrido **sem biblioteca e sem modelo**.
  ///
  /// É o ponto do desenho: a tabela dele classifica uma `FalhaDaCarga` de tipos do
  /// `Foundation` — não o erro do pacote da Apple, que este binário não enxerga. Aqui o
  /// arquivo é compilado sem `ORBE_COREAI`, exatamente como no simulador e num build sem a
  /// vendorização, e é por isso que o caminho "indisponível com motivo" também se prova.
  @MainActor
  static func provarOMotorCoreAI(_ p: Placar) async {
    print("o motor de peso aberto: o nome dos pesos vira caminho (story 5.8)")
    for bom in ["smollm2-135m", "qwen3_0_6b", "a", "MODELO.1"] {
      p.conferir("aceita \(bom)", MotorCoreAI.nomeValido(bom))
    }
    // O nome vem do JS e vira caminho: sem a régua, um `..` sairia da pasta de recursos.
    for ruim in ["", "..", "../pesos", "a/b", ".oculto", "com espaço", "a\u{0000}b", String(repeating: "x", count: 129)] {
      p.conferir("recusa \(ruim.debugDescription)", !MotorCoreAI.nomeValido(ruim))
    }

    print("a falha de carga → identificador → classe")
    let carga: [(MotorCoreAI.FalhaDaCarga, ErroDoModelo)] = [
      (.init(nomeDoTipo: "CoreAI.Erro", descricao: "não abriu", dominio: "CoreAI", codigo: 3), .pesosAusentes),
      (.init(nomeDoTipo: "CoreAI.Erro", descricao: "x", dominio: MotorCoreAI.dominioPosix, codigo: MotorCoreAI.codigoSemMemoria), .capacidadeNaoSuportada),
      // A rede do sniffing, declarada como tal no fonte.
      (.init(nomeDoTipo: "CoreAI.Erro", descricao: "Out of memory while specializing", dominio: "CoreAI", codigo: 1), .capacidadeNaoSuportada),
      (.init(nomeDoTipo: "CoreAI.Erro", descricao: "Memory limit exceeded", dominio: "", codigo: 0), .capacidadeNaoSuportada),
      // E a régua é estreita de propósito: um nome de tipo em camelCase não dispara o
      // sniffing — só a prosa do erro dispara.
      (.init(nomeDoTipo: "CoreAI.MemoryLimitError", descricao: "x", dominio: "", codigo: 0), .pesosAusentes),
      (.init(nomeDoTipo: "CoreAI.Erro", descricao: "cannot allocate 4 GB", dominio: "", codigo: 0), .capacidadeNaoSuportada),
      (.init(nomeDoTipo: "CoreAI.Erro", descricao: "o arquivo está corrompido", dominio: "NSCocoaErrorDomain", codigo: 260), .pesosAusentes),
    ]
    for (f, id) in carga {
      p.igual("carga \(f.nomeDoTipo)/\(f.dominio) \(f.codigo) → \(id)", MotorCoreAI.identificar(f), id)
    }
    // Memória é `capacidade` (o aparelho atende, este peso não cabe); o resto recua.
    p.igual("memória vira capacidade", Engine.classe(de: .capacidadeNaoSuportada), .capacidade)
    p.igual("o resto da carga vira indisponivel", Engine.classe(de: .pesosAusentes), .indisponivel)
    let linhaDaCarga = MotorCoreAI.falhaDaCarga(carga[0].0)
    p.igual("a falha de carga é indisponivel", linhaDaCarga.classe, .indisponivel)
    p.conferir("e o detalhe nomeia o tipo e o domínio", linhaDaCarga.detalhe?.contains("CoreAI.Erro · CoreAI 3") == true, linhaDaCarga.detalhe ?? "nil")

    print("a pasta dos pesos, sobre o disco de verdade")
    let raiz = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("orbe-coreai-\(UUID().uuidString)")
    let gerente = FileManager.default
    let pasta = raiz.appendingPathComponent(MotorCoreAI.pastaDosPesos).appendingPathComponent("smollm2-135m")
    try? gerente.createDirectory(at: pasta, withIntermediateDirectories: true)
    defer { try? gerente.removeItem(at: raiz) }

    func motivoDe(_ e: MotorCoreAI.EstadoDosPesos) -> String? {
      if case .falta(let motivo, _) = e { return motivo }
      return nil
    }

    p.igual("sem raiz de recursos: semPesos", motivoDe(MotorCoreAI.estadoDaPasta("smollm2-135m", raiz: nil)), MotorCoreAI.motivoSemPesos)
    p.igual("nome inválido: semPesos", motivoDe(MotorCoreAI.estadoDaPasta("../fuga", raiz: raiz)), MotorCoreAI.motivoSemPesos)
    p.igual("pasta que não existe: semPesos", motivoDe(MotorCoreAI.estadoDaPasta("outro-modelo", raiz: raiz)), MotorCoreAI.motivoSemPesos)
    // A pasta existe e não é um bundle de Core AI — a linha "corrompida" da matriz.
    p.igual("sem ficha: pesosIlegiveis", motivoDe(MotorCoreAI.estadoDaPasta("smollm2-135m", raiz: raiz)), MotorCoreAI.motivoPesosIlegiveis)
    let ficha = pasta.appendingPathComponent(MotorCoreAI.arquivoDaFicha)
    try? Data("{ isto não é json".utf8).write(to: ficha)
    p.igual("ficha ilegível: pesosIlegiveis", motivoDe(MotorCoreAI.estadoDaPasta("smollm2-135m", raiz: raiz)), MotorCoreAI.motivoPesosIlegiveis)

    try? Data("{\"language\":{\"max_context_length\":4096}}".utf8).write(to: ficha)
    if case .pronto(let url, let janela) = MotorCoreAI.estadoDaPasta("smollm2-135m", raiz: raiz) {
      p.igual("com ficha: pronto, com a janela dela", janela, 4096)
      p.conferir("e aponta para a pasta, não para o .aimodel", url.lastPathComponent == "smollm2-135m", url.path)
    } else {
      p.conferir("com ficha: pronto", false)
    }
    // Janela ausente não impede gerar — ela é detalhe de tela.
    try? Data("{\"language\":{}}".utf8).write(to: ficha)
    if case .pronto(_, let janela) = MotorCoreAI.estadoDaPasta("smollm2-135m", raiz: raiz) {
      p.igual("ficha sem janela: pronto mesmo assim", janela, nil)
    } else {
      p.conferir("ficha sem janela: pronto mesmo assim", false)
    }

    print("as três portas devolvem uma linha do contrato, sem biblioteca")
    let diagnostico = MotorCoreAI.diagnostico(pesos: "smollm2-135m")
    let lido = objeto(diagnostico)
    p.conferir("o diagnóstico é uma linha JSON", lido != nil, diagnostico)
    p.igual("e diz que não atende (sem biblioteca, aqui)", lido?["disponivel"] as? Bool, false)
    let motivo = lido?["motivo"] as? String ?? ""
    p.conferir("com um motivo que o app conhece", MotorCoreAI.motivos().contains(motivo), motivo)
    p.conferir("o diagnóstico não atravessa duas linhas", !diagnostico.contains("\n"))

    let resposta = await MotorCoreAI.responder(pesos: "smollm2-135m", pedido: pedidoCanonico(saida: SAIDA_TEXTO))
    let falha = objeto(resposta)
    p.igual("sem biblioteca, responder é indisponivel", falha?["classe"] as? String, ClasseDeFalha.indisponivel.rawValue)
    p.conferir("e o detalhe diz por quê", (falha?["detalhe"] as? String)?.isEmpty == false, resposta)
    p.conferir("e nunca lança", !resposta.isEmpty)

    // O pedido ilegível é recusado **antes** dos pesos: a conversão é a mesma do Engine.
    let ilegivel = await MotorCoreAI.responder(pesos: "smollm2-135m", pedido: "{\"sistema\":1}")
    p.igual("pedido ilegível continua capacidade", objeto(ilegivel)?["classe"] as? String, ClasseDeFalha.capacidade.rawValue)

    // Sem a biblioteca não há cache a olhar — e "não dá para saber" **não é** "não compilado".
    // É esta distinção que impede a tela de oferecer Compilar num Mac, num simulador ou num
    // build que nunca rodou o `montar.sh`.
    let compilacao = MotorCoreAI.compilacao(pesos: "smollm2-135m")
    let daCompilacao = objeto(compilacao)
    p.conferir("a compilação é uma linha JSON", daCompilacao != nil, compilacao)
    p.conferir("sem biblioteca, ela NÃO diz `compilado`", daCompilacao?["compilado"] == nil, compilacao)
    let motivoDaCompilacao = daCompilacao?["motivo"] as? String ?? ""
    p.conferir("e o motivo é um que o app conhece", MotorCoreAI.motivos().contains(motivoDaCompilacao), motivoDaCompilacao)
    p.conferir("a compilação não atravessa duas linhas", !compilacao.contains("\n"))

    // Sem a biblioteca, compilar também não inventa: a quarta porta devolve a mesma falta que a
    // terceira, e **não** diz que a compilação falhou — ninguém chegou a carregar peso nenhum.
    let compilar = await MotorCoreAI.compilar(pesos: "smollm2-135m")
    let daCompilacaoForcada = objeto(compilar)
    p.conferir("compilar devolve uma linha JSON", daCompilacaoForcada != nil, compilar)
    p.conferir("sem biblioteca, compilar NÃO diz `compilado`", daCompilacaoForcada?["compilado"] == nil, compilar)
    let motivoDeCompilar = daCompilacaoForcada?["motivo"] as? String ?? ""
    p.conferir("e o motivo é um que o app conhece", MotorCoreAI.motivos().contains(motivoDeCompilar), motivoDeCompilar)
    p.conferir(
      "e NÃO é o de compilação que falhou — nada foi carregado",
      motivoDeCompilar != MotorCoreAI.motivoNaoCompilou,
      motivoDeCompilar
    )
    p.conferir("compilar não atravessa duas linhas", !compilar.contains("\n"))

    print("os cinco motivos são uma lista fechada e sem repetição")
    p.igual("são cinco", MotorCoreAI.motivos().count, 5)
    p.igual("sem repetição", Set(MotorCoreAI.motivos()).count, 5)
  }
}
