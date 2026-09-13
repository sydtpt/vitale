/**
 * O ponto de injeção do app (guarda (1) do `architecture.test.ts`, ADR 0047).
 *
 * **Este é o único arquivo do app que nomeia a function.** A catraca "uma porta
 * por hospedeiro" reconhece `mobile/src/lib/motores/`, e é ela que impede a
 * terceira cópia do cliente da `ia-narrar`: o app já tem duas — `edicao-ia.ts`
 * (sai na 1.10) e `services/route-name.ts` (sai na 5.7) —, cada uma lendo o erro
 * do seu jeito, e nas duas o ramo que lia o corpo de erro era código morto.
 *
 * O que mora aqui é só **a chamada**: o nome da function, o corpo e a leitura do
 * status. Quem traduz status, corpo, conclusão e assinatura em `Resposta` ou
 * `Falha` é `criarMotorDeNuvem` (`ia/nuvem.ts`), no núcleo — uma tabela com teste,
 * não um `if` por hospedeiro.
 *
 * **Status não-2xx não é exceção: é dado.** O cliente da function *lança* nesse
 * caso (`FunctionsHttpError`), e era justamente por isso que as duas cópias
 * antigas nunca liam o corpo de erro. Aqui o erro é desembrulhado de volta para
 * `{ status, corpo }`, lendo o `Response` que o cliente anexa, e só a ausência de
 * rede volta como `{ semRede: true }` — que o núcleo traduz em `indisponivel`,
 * que recua sem aumentar exposição e sem gravar.
 *
 * **Uma chamada de nuvem por vez.** O motor é serializado: a leitura da Saúde
 * leva 13,6 s na mediana (medição de 12/09), e duas chamadas simultâneas são
 * duas chamadas pagas para uma tela que mostra uma frase. O dedupe por toque
 * mora no hook; a serialização mora aqui, porque é propriedade do motor, não da
 * tela — a tela de desenvolvimento usa o mesmo motor.
 */
import {
  STATUS_POR_CLASSE,
  criarMotorDeNuvem,
  lerMotorId,
  type CorpoDaFalha,
  type CorpoDoPedido,
  type Motor,
  type MotorId,
  type RespostaDoTransporte,
  type Transporte,
} from '@vitale/shared';
import { supabase } from '../supabase';

/** A function de narração. O literal vive aqui, e em mais lugar nenhum do app. */
const FUNCTION = 'ia-narrar';

/**
 * O prazo de uma chamada de nuvem. O mesmo valor da bancada
 * (`scripts/bancada/motores.ts`), de propósito: o que a bancada mediu é o que a
 * tela vai esperar.
 *
 * **O que este teto compra não é velocidade — é o fim da espera.** A leitura leva
 * 13,6 s na mediana e 25,8 s no pior caso (12/09), e sem prazo uma chamada
 * pendurada deixa a vaga em `escrevendo` para sempre: o ícone fica desabilitado, a
 * chamada em curso nunca se encerra, e todo toque seguinte na mesma janela se junta
 * a uma promessa morta. Um minuto é folga larga sobre o pior caso medido.
 */
export const PRAZO_MS = 60_000;

function mensagem(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

/**
 * O pedaço do cliente da function que o transporte usa: `{ data, error }` e,
 * quando houve resposta HTTP, o `Response` dela.
 *
 * **É contrato da versão 2.106 do `@supabase/functions-js`**, e é a razão de este
 * arquivo existir: em todo não-2xx o cliente **lança** (`FunctionsHttpError`) com o
 * `Response` em `error.context`, e o devolve também em `response` do resultado. Era
 * exatamente isso que as duas cópias antigas do cliente não sabiam — o ramo que
 * lia o corpo de erro nunca rodava.
 *
 * Injetável porque a tradução tem de ser exercitável sem rede: o sintoma de ela
 * estar errada é **o motivo errado escrito em palavras na tela do dono**.
 */
export type Chamar = (
  corpo: CorpoDoPedido,
  signal: AbortSignal,
) => Promise<{
  readonly data: unknown;
  readonly error: unknown;
  readonly response?: { readonly status: number; json(): Promise<unknown> };
}>;

/**
 * A chamada real: `functions.invoke`, com o Bearer injetado pelo client.
 *
 * O prazo vai pelo `signal`, e não pela opção `timeout` que a 2.106 também aceita:
 * abortando nós mesmos, sabemos que o aborto foi **nosso** e classificamos o
 * estouro como `transitoria`. Deixar o cliente abortar devolveria um erro de rede
 * indistinguível de "o wi-fi caiu", que o núcleo leria como `indisponivel` — classe
 * que recua, em vez de cair no piso.
 */
const chamarAFunction: Chamar = (corpo, signal) =>
  supabase.functions.invoke(FUNCTION, { body: corpo, signal });

/**
 * O estouro do prazo, no vocabulário do núcleo.
 *
 * `CorpoDaFalha` é a forma declarada de "falha com classe", e a tabela de
 * `traduzirDaNuvem` diz que a classe do corpo decide qualquer que seja o status —
 * então o hospedeiro dizer `transitoria` aqui é **usar** o contrato, não falsificar
 * uma resposta HTTP. O status vai no valor que a própria 5.6 vai emitir para essa
 * classe, para os dois concordarem.
 *
 * `transitoria`, e não `indisponivel`: timeout está na definição de `transitoria`
 * no núcleo ("o mesmo pedido no mesmo motor pode dar certo depois"). Ela cai no
 * piso sem repetir e sem gravar; `indisponivel` recuaria para o próximo elo.
 */
function prazoEstourado(prazoMs: number): RespostaDoTransporte {
  const corpo: CorpoDaFalha = {
    classe: 'transitoria',
    detalhe: `o prazo de ${Math.round(prazoMs / 1000)} s estourou`,
  };
  return { status: STATUS_POR_CLASSE.transitoria, corpo };
}

/**
 * O transporte: a chamada, o prazo, e nada mais.
 *
 * Nunca lança — a porta do núcleo trataria uma exceção como `transitoria` não
 * mapeada, que é pior informação do que a que temos aqui. Corpo que não é JSON
 * volta como `corpo: undefined`, e o núcleo o lê como `saida-invalida` num 2xx ou
 * usa só o status num erro: um HTML de gateway não é falha de transporte, é
 * resposta ilegível.
 */
export function criarTransporte(
  chamar: Chamar = chamarAFunction,
  prazoMs: number = PRAZO_MS,
): Transporte {
  return async (corpo): Promise<RespostaDoTransporte> => {
    const controle = new AbortController();
    let estourou = false;
    const relogio = setTimeout(() => {
      estourou = true;
      controle.abort();
    }, prazoMs);
    try {
      let r: Awaited<ReturnType<Chamar>>;
      try {
        r = await chamar(corpo, controle.signal);
      } catch (e) {
        // O cliente não deveria rejeitar (ele devolve `{ data, error }`), mas o
        // aborto chega por aqui, e um `fetch` trocado por um polyfill quebrado
        // rejeitaria. O prazo tem prioridade: só ele sabemos ter sido nosso.
        return estourou ? prazoEstourado(prazoMs) : { semRede: true, detalhe: mensagem(e) };
      }
      if (r.error == null) return { status: r.response?.status ?? 200, corpo: r.data };

      // Houve resposta HTTP (não-2xx, ou erro de relay): o status é dado, e o corpo
      // ainda não foi lido — o cliente lança antes de lê-lo.
      const resposta = r.response;
      if (resposta) {
        let lido: unknown;
        try {
          lido = await resposta.json();
        } catch {
          lido = undefined;
        }
        return { status: resposta.status, corpo: lido };
      }
      if (estourou) return prazoEstourado(prazoMs);
      return { semRede: true, detalhe: mensagem(r.error) };
    } finally {
      clearTimeout(relogio);
    }
  };
}

/**
 * Uma chamada por vez, no mesmo motor.
 *
 * A fila encadeia mesmo quando a anterior falha: a porta não rejeita, mas um
 * motor injetado de fora poderia — e uma fila que quebra na primeira falha
 * deixaria o motor mudo para sempre.
 */
function serializar(motor: Motor): Motor {
  let fila: Promise<unknown> = Promise.resolve();
  return (pedido) => {
    const proxima = fila.then(
      () => motor(pedido),
      () => motor(pedido),
    );
    fila = proxima.then(
      () => undefined,
      () => undefined,
    );
    return proxima;
  };
}

/**
 * O `motorPara` do app: um motor de nuvem para todo `MotorId` de nuvem, e nada
 * para o resto.
 *
 * O **aparelho** não tem motor aqui de propósito — é o marco B, que depende do
 * macOS 27 e da ponte Swift. Pedi-lo hoje dá tentativa sintética `indisponivel`,
 * sem nenhuma chamada de rede: o orquestrador a marca como "o hospedeiro não
 * entregou este motor", e a assinatura da tela diz isso em palavras.
 */
export function criarMotorPara(
  chamar: Chamar = chamarAFunction,
  prazoMs: number = PRAZO_MS,
): (id: MotorId) => Motor | undefined {
  const nuvem = serializar(criarMotorDeNuvem(criarTransporte(chamar, prazoMs)));
  return (id) => (lerMotorId(id)?.tipo === 'nuvem' ? nuvem : undefined);
}

/**
 * O ponto de injeção do app, um só — para a `/sono/saude` e para a tela de
 * desenvolvimento dividirem a mesma fila de chamadas.
 */
export const motorPara: (id: MotorId) => Motor | undefined = criarMotorPara();
