// EXPERIMENTO DESCARTÁVEL — o teste do Private Cloud Compute (story 5.9).
//
// **Apagar ou promover depois do veredito do dono.** É uma exceção à AD-3 decidida por ele em
// 19/09/2026, registrada na emenda da ADR 0047 (o que pode, o que não pode, e como apagar):
// a ponte do aparelho não toca modelo de servidor, para que nenhum dado saia por ela. Este arquivo respeita o motivo da regra — manda um texto **fixo e neutro**, nunca dado
// de saúde — e fica fora do `Engine.swift`, que é o que as guardas (3) e (4) cobrem. Não é
// motor, não entra no catálogo nem no seletor, e só a tela de desenvolvimento o chama, por um
// botão (`mobile/src/app/configuracoes/motores/bancada.tsx`).
//
// A pergunta que ele responde é uma só: **o iPhone do dono tem acesso ao PCC?** Do Mac, em
// 19/09, o modelo se anunciou `available` com cota `belowLimit` e recusou o pedido com
// `ModelManagerError 1046` — o acesso que a Apple dá a app publicado no Small Business
// Program. O iPhone responde com prova, e é isso que decide se a 5.12 volta.
//
// Tudo o que volta é **dado cru**, numa linha JSON: disponibilidade, cota, a resposta ou o
// erro com domínio, código e a cadeia de erros subjacentes. O erro é resultado, nunca exceção.

import Foundation
import FoundationModels

enum ExperimentoDoPCC {
  /// O único texto que este experimento manda. Fixo, neutro, sem dado nenhum do dono.
  static let texto = "Diga olá."

  struct Resultado: Encodable, Sendable {
    var plataforma: String
    var buildDoSistema: String
    var enviado: String
    var disponibilidade: String?
    var cota: String?
    var resposta: String?
    var erro: String?
    var tipoDoErro: String?
    var dominio: String?
    var codigo: Int?
    /// Os erros de baixo, do mais próximo ao mais fundo: "domínio código".
    var subjacentes: [String]?
    var ms: Int?
  }

  static func rodar() async -> String {
    let codificador = JSONEncoder()
    codificador.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    let r = await medir()
    if let dados = try? codificador.encode(r), let linha = String(data: dados, encoding: .utf8) {
      return linha
    }
    return "{\"erro\":\"o experimento não codificou o resultado\"}"
  }

  static func medir() async -> Resultado {
    var r = Resultado(
      plataforma: Engine.plataforma(), buildDoSistema: Engine.buildDoSistema(), enviado: texto
    )
    #if compiler(>=6.4)
    if #available(iOS 27, macOS 27, *) {
      let modelo = PrivateCloudComputeLanguageModel()
      r.disponibilidade = String(describing: modelo.availability)
      r.cota = String(describing: modelo.quotaUsage)
      let inicio = Date()
      do {
        let sessao = LanguageModelSession(model: modelo)
        let resposta = try await sessao.respond(to: texto)
        r.resposta = resposta.content
      } catch {
        let ns = error as NSError
        r.erro = String(reflecting: error)
        r.tipoDoErro = String(reflecting: type(of: error))
        r.dominio = ns.domain
        r.codigo = ns.code
        r.subjacentes = subjacentes(de: ns)
      }
      r.ms = Int(Date().timeIntervalSince(inicio) * 1000)
      return r
    }
    #endif
    r.disponibilidade = "o Private Cloud Compute pede iOS 27 (e um build com o SDK 27)"
    return r
  }

  /// A cadeia de `NSUnderlyingErrorKey`, com teto — é nela que o 1046 do Mac apareceu.
  static func subjacentes(de erro: NSError) -> [String] {
    var out: [String] = []
    var atual = erro.userInfo[NSUnderlyingErrorKey] as? NSError
    while let e = atual, out.count < 6 {
      out.append("\(e.domain) \(e.code): \(e.localizedDescription)")
      atual = e.userInfo[NSUnderlyingErrorKey] as? NSError
    }
    return out
  }
}
