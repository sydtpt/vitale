// A casca do pacote da Apple — a única coisa que o Orbe compila contra `apple/coreai-models`
// (story 5.8, ADR 0047).
//
// **Por que ela existe.** O código que transforma peso aberto em frase não vem no iOS: o
// `CoreAI` do sistema é runtime de tensores (entra `NDArray`, sai `NDArray`), e quem escreve
// texto é o `CoreAILanguageModel`, do pacote Swift `apple/coreai-models` — que arrasta
// tokenizador, amostragem, KV-cache e uma gramática em C++, num grafo de mais de vinte
// pacotes. Módulo Expo local só linka por `.podspec`, e o CocoaPods **não tem atributo de
// dependência de Swift Package**. Então o grafo é compilado uma vez, fora do app, e o que
// entra no pod é binário.
//
// **Por que ela é fina de propósito.** O `internal import` abaixo é o truque inteiro: com
// `-enable-library-evolution`, a `.swiftinterface` gerada não cita `CoreAILanguageModels`, e
// quem consome este módulo precisa de **um** arquivo de interface — nada de `.swiftmodule` de
// Jinja, Tokenizers, NIO, XGrammar nem dos mapas de módulo em C dos alvos do meio. Trocar
// `internal` por `public` aqui faria o pod exigir o grafo inteiro de volta, e a vendorização
// deixaria de caber num `SWIFT_INCLUDE_PATHS`.
//
// **O que NÃO mora aqui.** Nenhuma decisão do Orbe: nem classe de falha, nem tabela erro →
// classe, nem contrato JSON. Isso tudo vive em
// `mobile/modules/on-device-engine/ios/MotorCoreAI.swift`, que é fonte no repositório e que as
// barreiras do `architecture.test.ts` leem. Este arquivo é compilado para dentro de um `.a`
// que ninguém lê — então ele carrega o mínimo que um binário opaco pode carregar: abrir a
// pasta e devolver uma sessão. O erro sai **descrito**, não classificado: o nome do tipo, a
// descrição, o domínio e o código do `NSError`, para o lado que se lê fazer a tabela.
//
// Compilado por `scripts/coreai/montar.sh`.

public import Foundation
public import FoundationModels
internal import CoreAILanguageModels

/// Em que passo o carregamento falhou. Vocabulário da casca, não do Orbe: quem o traduz em
/// classe de falha é o `MotorCoreAI.swift`, com teste.
public enum OrbeCoreAIFase: String, Sendable {
  case carga
}

/// O que deu errado ao abrir os pesos, em tipos que só o `Foundation` conhece.
///
/// O erro original vem de um módulo que o consumidor não enxerga (é isso que o `internal
/// import` compra), então ele atravessa **descrito**: o nome do tipo, a descrição, e o par
/// domínio/código do `NSError` quando há. Nenhum deles decide nada aqui.
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

public enum OrbeCoreAI {
  /// Abre os pesos da pasta e devolve uma sessão do Foundation Models, pronta para o
  /// `respond(to:)` que o `MotorCoreAI` chama.
  ///
  /// **Uma sessão nova por pedido** é regra da ponte, e quem a cumpre é quem chama: esta
  /// função abre uma sessão por chamada e não guarda nada.
  ///
  /// `url` aponta para a **pasta do bundle** — a que tem `metadata.json` —, não para o
  /// `.aimodel` de dentro.
  public static func sessao(pesosEm url: URL, instrucoes: String?) async throws -> LanguageModelSession {
    do {
      let modelo = try await CoreAILanguageModel(resourcesAt: url)
      return LanguageModelSession(model: modelo, instructions: instrucoes.map { Instructions($0) })
    } catch {
      let ns = error as NSError
      throw OrbeCoreAIErro(
        fase: .carga,
        nomeDoTipo: String(reflecting: type(of: error)),
        descricao: String(describing: error),
        dominio: ns.domain,
        codigo: ns.code
      )
    }
  }
}
