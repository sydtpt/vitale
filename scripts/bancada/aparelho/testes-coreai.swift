// Os testes do ramo **com** `ORBE_COREAI` (story 5.8) — local, fora do CI.
//
//     pnpm --filter @vitale/scripts aparelho:testar
//
// O irmão de `testes.swift`, num binário à parte, porque este é compilado **com a macro** e
// contra a casca falsa (`casca-falsa.swift`), que espelha a superfície pública da casca de
// verdade. Sem ele, o ramo de geração do `MotorCoreAI` não era compilado por nada no caminho
// de verificação — só pelo build do app, que não afirma nada.
//
// O que se prova aqui é o que o Orbe escreve **em volta** do modelo, e é tudo o que não
// depende de haver um modelo:
//
//   - a **assinatura**: `provedor` é o do peso aberto e `modelo` é o nome dos pesos. Este é o
//     teste que a revisão pediu: sem ele, apagar `provedor:` assinaria o texto do SmolLM2
//     como `apple / system-language-model`;
//   - a **falha de carga** virando classe, agora pelo caminho de verdade (o `catch` do
//     `OrbeCoreAIErro`), e não só pela tabela pura;
//   - a regra de **texto vazio**, que mora no `Engine` e vale para os dois motores.
//
// Quem prova que o modelo de verdade abre e gera é o iPhone.

import Foundation
import FoundationModels
import OrbeCoreAI

/// Uma pasta de pesos de mentira: só o `metadata.json`, que é o que o estado exige.
func pastaDePesos(_ nome: String, janela: Int = 4096) -> URL {
  let raiz = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("orbe-coreai-com-\(UUID().uuidString)")
  let pasta = raiz.appendingPathComponent(MotorCoreAI.pastaDosPesos).appendingPathComponent(nome)
  try? FileManager.default.createDirectory(at: pasta, withIntermediateDirectories: true)
  try? Data("{\"language\":{\"max_context_length\":\(janela)}}".utf8)
    .write(to: pasta.appendingPathComponent(MotorCoreAI.arquivoDaFicha))
  return raiz
}

@main
struct TestesDoCoreAI {
  static func main() async {
    let p = Placar()
    let pesos = "smollm2-135m"
    let raiz = pastaDePesos(pesos)
    defer { try? FileManager.default.removeItem(at: raiz) }
    let pedido = pedidoCanonico(saida: SAIDA_TEXTO)

    print("com a biblioteca: o diagnóstico enxerga os pesos")
    let diagnostico = objeto(MotorCoreAI.diagnostico(pesos: pesos, raiz: raiz))
    p.igual("disponível", diagnostico?["disponivel"] as? Bool, true)
    p.igual("a variante é o nome dos pesos", diagnostico?["variante"] as? String, pesos)
    p.igual("a janela vem da ficha", diagnostico?["janela"] as? Int, 4096)

    print("a assinatura do peso aberto — provedor e modelo são DELE")
    OrbeCoreAI.falhaNaCarga = nil
    OrbeCoreAI.textoDeMentira = "Nas últimas sete noites, a duração ficou abaixo das outras."
    let linha = await MotorCoreAI.responder(pesos: pesos, pedido: pedido, raiz: raiz)
    let r = objeto(linha)
    p.igual("sai texto", r?["texto"] as? String, OrbeCoreAI.textoDeMentira)
    p.igual("o provedor é o do peso aberto", r?["provedor"] as? String, MotorCoreAI.provedor)
    p.igual("o modelo é o nome dos pesos", r?["modelo"] as? String, pesos)
    // A regressão que este teste existe para pegar: a assinatura do modelo do sistema.
    p.conferir("e NÃO é a assinatura do modelo do sistema", (r?["provedor"] as? String) != Engine.provedor, linha)
    p.conferir("nem o nome genérico dele", (r?["modelo"] as? String) != Engine.modelo, linha)
    p.conferir("a resposta não traz classe", r?["classe"] == nil, linha)
    p.conferir("e é uma linha só", !linha.contains("\n"))

    print("texto vazio não é resposta — a regra é do Engine, e vale para os dois motores")
    OrbeCoreAI.textoDeMentira = "   "
    let vazia = objeto(await MotorCoreAI.responder(pesos: pesos, pedido: pedido, raiz: raiz))
    p.igual("vazio vira saida-invalida", vazia?["classe"] as? String, ClasseDeFalha.saidaInvalida.rawValue)
    OrbeCoreAI.textoDeMentira = "de volta ao normal"

    print("a falha de carga pelo caminho de verdade (o catch do OrbeCoreAIErro)")
    OrbeCoreAI.falhaNaCarga = OrbeCoreAIErro(
      fase: .carga, nomeDoTipo: "CoreAI.Erro", descricao: "o .aimodel não abriu", dominio: "CoreAI", codigo: 3
    )
    let carga = objeto(await MotorCoreAI.responder(pesos: pesos, pedido: pedido, raiz: raiz))
    p.igual("carga comum vira indisponivel", carga?["classe"] as? String, ClasseDeFalha.indisponivel.rawValue)
    p.conferir("e o detalhe traz a descrição da casca", (carga?["detalhe"] as? String)?.contains("não abriu") == true, String(describing: carga))

    OrbeCoreAI.falhaNaCarga = OrbeCoreAIErro(
      fase: .carga, nomeDoTipo: "CoreAI.Erro", descricao: "x",
      dominio: MotorCoreAI.dominioPosix, codigo: MotorCoreAI.codigoSemMemoria
    )
    let memoria = objeto(await MotorCoreAI.responder(pesos: pesos, pedido: pedido, raiz: raiz))
    p.igual("falta de memória vira capacidade", memoria?["classe"] as? String, ClasseDeFalha.capacidade.rawValue)
    OrbeCoreAI.falhaNaCarga = nil

    print("os pesos ausentes continuam sendo recusados ANTES de tocar a biblioteca")
    let semPasta = objeto(await MotorCoreAI.responder(pesos: "nao-existe", pedido: pedido, raiz: raiz))
    p.igual("pesos ausentes: indisponivel", semPasta?["classe"] as? String, ClasseDeFalha.indisponivel.rawValue)
    p.conferir("com o motivo dentro do detalhe", (semPasta?["detalhe"] as? String)?.contains(MotorCoreAI.motivoSemPesos) == true, String(describing: semPasta))

    print(p.falharam.isEmpty
      ? "\n\(p.passaram) conferências passaram (com ORBE_COREAI)."
      : "\n\(p.falharam.count) de \(p.passaram + p.falharam.count) falharam:\n  - " + p.falharam.joined(separator: "\n  - "))
    exit(p.falharam.isEmpty ? 0 : 1)
  }
}
