// A cola do Expo (story 5.9, AD-3, ADR 0047) — e nada mais.
//
// Cada função **só repassa** ao `Engine`: a string do pedido vai e a linha dele volta ao JS
// intacta, e o diagnóstico idem. Sem `catch`, sem literal de classe de falha, sem decisão: a
// tabela erro → classe e o diagnóstico moram no `Engine.swift`, com teste, e são os mesmos que
// a bancada mede no Mac.
// Uma cola que pensasse seria uma segunda tabela, fora do teste e fora da CLI — a bancada
// mediria uma coisa e o iPhone faria outra. A barreira da cola no `architecture.test.ts`
// cobra, e cobra também o nome: `OnDeviceEngine` é o que o ponto de injeção do app
// (`mobile/src/lib/motores/`) carrega por `requireOptionalNativeModule`, e o que a guarda (1)
// reconhece.
//
// Mora no mesmo pod que o `Engine.swift` e o `MotorCoreAI.swift` (`OnDeviceEngine.podspec`
// pega todo `.swift` desta pasta, e a barreira fecha a lista nesses três), e é por isso que
// os dois podem continuar `internal`. Os nomes das funções são os de `FUNCOES_DA_PONTE`, em
// `mobile/src/lib/motores/index.ts` — a barreira compara.
//
// **Cinco portas, dois motores** (story 5.8; a quinta veio com o estado de compilação). As
// duas primeiras são o modelo **do sistema**, que não se escolhe; as três últimas são o **peso
// aberto**, que se escolhe pelo nome — daí o argumento. Qual peso usar viaja por fora do pedido
// de propósito: `CHAVES_DO_PEDIDO`
// (`ia/aparelho.ts`) é exaustiva sobre `keyof Pedido`, e enfiar um campo ali mudaria o hash
// do pedido (AD-11) por uma razão que não é o pedido.

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

    // O mesmo pedido canônico, contra os pesos abertos que o nome indica.
    AsyncFunction("responderComPesos") { (pesos: String, pedido: String) async -> String in
      await MotorCoreAI.responder(pesos: pesos, pedido: pedido)
    }

    // Se estes pesos estão neste build, e com que janela — ou por que não.
    AsyncFunction("diagnosticoDosPesos") { (pesos: String) async -> String in
      MotorCoreAI.diagnostico(pesos: pesos)
    }

    // Se estes pesos já estão compilados para o chip — sem disparar compilação nenhuma.
    AsyncFunction("compilacaoDosPesos") { (pesos: String) async -> String in
      MotorCoreAI.compilacao(pesos: pesos)
    }
  }
}
