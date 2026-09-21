// O apoio compartilhado pelos dois binários de teste da ponte (story 5.8).
//
// Eram do `testes.swift`, e saíram dele quando nasceu o segundo binário: o de **com**
// `ORBE_COREAI` (`testes-coreai.swift`), que é compilado contra a casca falsa. Dois `@main`
// não cabem num executável, então os dois arquivos de teste não podem ser compilados juntos —
// e duas cópias do placar divergiriam na primeira vez que alguém mexesse numa.
//
// Sem `@main` de propósito: este arquivo entra nos dois binários.

import Foundation
import FoundationModels

final class Placar {
  var passaram = 0
  var falharam: [String] = []

  func conferir(_ nome: String, _ condicao: Bool, _ detalhe: @autoclosure () -> String = "") {
    if condicao {
      passaram += 1
      print("  ok \(nome)")
    } else {
      falharam.append(nome)
      let d = detalhe()
      print("  FALHOU \(nome)\(d.isEmpty ? "" : " — \(d)")")
    }
  }

  func igual<T: Equatable>(_ nome: String, _ obtido: T, _ esperado: T) {
    conferir(nome, obtido == esperado, "obtido \(obtido), esperado \(esperado)")
  }
}

/// Uma linha de saída lida de volta como objeto JSON.
func objeto(_ linha: String) -> [String: Any]? {
  guard let dados = linha.data(using: .utf8) else { return nil }
  return (try? JSONSerialization.jsonObject(with: dados)) as? [String: Any]
}

/// O pedido como `serializarPedido` o escreve: chaves ordenadas, com a versão do descritor.
func pedidoCanonico(saida: String, guardrails: String = "padrao", amostragem: String = "gulosa") -> String {
  "{\"amostragem\":\"\(amostragem)\",\"guardrails\":\"\(guardrails)\",\"saida\":\(saida),"
    + "\"sistema\":\"as regras\",\"usuario\":\"o caso\",\"versaoDoDescritor\":1}"
}

let SAIDA_TEXTO = "{\"tipo\":\"texto\"}"
/// O esquema da sonda de fidelidade, na forma canônica do fio.
let SAIDA_DA_SONDA =
  "{\"esquema\":{\"properties\":{\"dimensao\":{\"enum\":[\"duracao\",\"horario\",\"percepcao\"],\"type\":\"string\"}},"
  + "\"required\":[\"dimensao\"],\"type\":\"object\"},\"tipo\":\"esquema\"}"

struct ErroEstranho: Error {}

