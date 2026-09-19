// A cola do Expo (story 5.9, AD-3, ADR 0047) — e nada mais.
//
// Cada função **só repassa** — duas ao `Engine` (a string do pedido vai, a linha dele volta ao
// JS intacta; e o diagnóstico) e uma ao experimento descartável do PCC, sem argumento nenhum. Sem `catch`, sem literal de classe de falha, sem decisão: a tabela erro → classe e
// o diagnóstico moram no `Engine.swift`, com teste, e são os mesmos que a bancada mede no Mac.
// Uma cola que pensasse seria uma segunda tabela, fora do teste e fora da CLI — a bancada
// mediria uma coisa e o iPhone faria outra. A barreira da cola no `architecture.test.ts`
// cobra, e cobra também o nome: `OnDeviceEngine` é o que o ponto de injeção do app
// (`mobile/src/lib/motores/`) carrega por `requireOptionalNativeModule`, e o que a guarda (1)
// reconhece.
//
// Mora no mesmo pod que o `Engine.swift` e o `ExperimentoDoPCC.swift` (`OnDeviceEngine.podspec`
// pega todo `.swift` desta pasta, e a barreira fecha a lista nesses três), e é por isso que o
// `Engine` pode continuar `internal`. Os nomes das funções são os de `FUNCOES_DA_PONTE`, em
// `mobile/src/lib/motores/index.ts` — a barreira compara.

import ExpoModulesCore

public class OnDeviceEngineModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OnDeviceEngine")

    // O pedido canônico entra; a linha de resposta ou de falha sai.
    AsyncFunction("responder") { (pedido: String) async -> String in
      await Engine.responder(pedido)
    }

    // A disponibilidade, a variante e a janela — o que o seletor mostra.
    AsyncFunction("diagnostico") { () -> String in
      Engine.diagnostico()
    }

    // EXPERIMENTO DESCARTÁVEL (exceção à AD-3, decidida pelo dono em 19/09/2026): o teste do
    // Private Cloud Compute da tela de desenvolvimento. Apagar esta função junto com
    // `ExperimentoDoPCC.swift` — ou promover os dois — depois do veredito do dono.
    AsyncFunction("experimentoDoPCC") { () async -> String in
      await ExperimentoDoPCC.rodar()
    }
  }
}
