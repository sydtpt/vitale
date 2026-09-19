// A CLI da bancada para o motor do aparelho (story 5.10, AD-11).
//
// Toda a ponte está em `mobile/modules/on-device-engine/ios/Engine.swift`, compilado junto
// com este arquivo **sem cópia** (`swiftc` direto sobre os dois caminhos, com os argumentos
// de `argumentosDoSwiftc` em `scripts/bancada/motores.ts`). Aqui mora só o protocolo:
//
//     ao nascer     {"pronto":true}
//     entra         {"id":7,"pedido":"<a string de serializarPedido>"}
//     sai           {"id":7,"linha":<o JSON que o Engine devolveu>}
//
// **O `pronto` é a prova de que o processo nasceu de verdade.** Um binário que o `dyld` não
// carrega é criado pelo sistema e morre antes do `main`: sem esta linha, o hospedeiro o
// confundiria com um processo vivo. **O `id` pareia pergunta e resposta**: uma linha a mais,
// ou fora de ordem, não vira a resposta de outro pedido — o hospedeiro exige o mesmo id, e
// o que diverge encerra o processo.
//
// **Um processo vivo, não um por pedido.** A primeira resposta de um processo novo leva
// segundos a mais (o modelo sobe); subir o processo a cada pedido mediria a carga, não o
// motor. A sessão continua nova a cada pedido — quem garante isso é o `Engine`, que segue
// puro: a string do pedido entra, a linha sai.
//
// Toda linha recebe resposta, inclusive a ilegível: quem está do outro lado espera uma
// linha por linha, e uma que ficasse sem par pararia a medição até o prazo.

import Foundation

/// O envelope que o hospedeiro manda. Sem ele legível, a resposta sai com `id` nulo — e o
/// hospedeiro, que esperava um número, trata como divergência.
struct Envelope: Decodable {
  let id: Int
  let pedido: String
}

@main
struct CLI {
  static func main() async {
    let saida = FileHandle.standardOutput
    let escrever = { (linha: String) in saida.write(Data((linha + "\n").utf8)) }

    escrever("{\"pronto\":true}")
    while let entrada = readLine(strippingNewline: true) {
      let envelope = try? JSONDecoder().decode(Envelope.self, from: Data(entrada.utf8))
      // A ponte decide o que fazer com um pedido ilegível; aqui só se repassa o que veio.
      let linha = await Engine.responder(envelope?.pedido ?? entrada)
      escrever("{\"id\":\(envelope.map { String($0.id) } ?? "null"),\"linha\":\(linha)}")
    }
  }
}
