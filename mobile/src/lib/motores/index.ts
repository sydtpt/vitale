/**
 * O ponto de injeção do app (guarda (1) do `architecture.test.ts`, ADR 0047).
 *
 * **Este é o único arquivo do app que nomeia a function.** A catraca "uma porta
 * por hospedeiro" reconhece `mobile/src/lib/motores/`, e é ela que impede a
 * terceira cópia do cliente da `ia-narrar`: o app teve duas — `edicao-ia.ts`
 * (saiu na 1.9; desde a 1.10 a impressão usa o `motorPara` daqui) e
 * `services/route-name.ts` (sai na 5.7) —, cada uma lendo o erro do seu jeito, e
 * nas duas o ramo que lia o corpo de erro era código morto.
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
  RECURSOS,
  STATUS_POR_CLASSE,
  criarMotorDeNuvem,
  formatarMotorId,
  lerMotorId,
  lerMotoresDeNuvemAprovados,
  motoresSemRecursoConhecido,
  type CorpoDaFalha,
  type CorpoDoPedido,
  type Motor,
  type MotorDeNuvemAprovado,
  type MotorId,
  type RecursoId,
  type RespostaDoTransporte,
  type Transporte,
} from '@vitale/shared';
import { supabase } from '../supabase';
import {
  esquecerListaAprovada,
  guardarListaAprovada,
  idsConhecidosDe,
  listaAprovada,
  listaVencida,
  type ListaAprovada,
} from './catalogo';

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
 * Uma **narração** por vez — não uma chamada por vez.
 *
 * A fila é dos motores, e só deles: `buscarMotoresAprovados` chama a function
 * por fora dela, de propósito. São coisas de peso diferente — a narração custa
 * 13,6 s de mediana e crédito Prepay, a lista é a leitura de um `secret` que
 * volta em milissegundos — e enfileirar a segunda atrás da primeira faria a
 * leitura esperar a narração em curso para descobrir o catálogo de que ela
 * mesma precisa.
 *
 * A fila era do `Motor` e passou a ser do transporte na 5.6, porque agora há um
 * motor por `MotorId`: cada variante nomeada carrega o seu `motor` no corpo, e
 * são objetos diferentes. Se a fila continuasse em cada um, duas variantes
 * escolhidas em telas diferentes (a `/sono/saude` e a bancada) sairiam ao mesmo
 * tempo — duas chamadas pagas, que é exatamente o que a serialização impede.
 *
 * A fila encadeia mesmo quando a anterior falha: um transporte que rejeitasse
 * deixaria o motor mudo para sempre se a corrente quebrasse na primeira falha.
 */
function serializar(transporte: Transporte): Transporte {
  let fila: Promise<unknown> = Promise.resolve();
  return (corpo) => {
    const proxima = fila.then(
      () => transporte(corpo),
      () => transporte(corpo),
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
 * **Um motor por id, e o id vai no corpo** (5.6). `nuvem:padrao` é a exceção
 * declarada: ele *é* "o servidor escolhe", então o corpo sai sem `motor` e a
 * function resolve pelo padrão dela — o mesmo corpo de antes da 5.6, byte por
 * byte, que é o que faz a janela entre o build novo e o deploy da function nova
 * não custar nada.
 *
 * Os motores são memoizados por id para que `motorPara(x) === motorPara(x)`: a
 * tela de desenvolvimento guarda o motor entre renders, e um objeto novo a cada
 * chamada faria um efeito seu disparar sem nada ter mudado.
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
  const transporte = serializar(criarTransporte(chamar, prazoMs));
  const porId = new Map<string, Motor>();
  return (id) => {
    const lido = lerMotorId(id);
    if (lido?.tipo !== 'nuvem') return undefined;
    const chave = formatarMotorId(lido);
    const guardado = porId.get(chave);
    if (guardado) return guardado;
    const motor = criarMotorDeNuvem(transporte, lido.variante === 'padrao' ? undefined : chave);
    porId.set(chave, motor);
    return motor;
  };
}

/**
 * O ponto de injeção do app, um só — para a `/sono/saude`, a impressão da revista
 * e a tela de desenvolvimento dividirem a mesma fila de chamadas.
 */
export const motorPara: (id: MotorId) => Motor | undefined = criarMotorPara();

/* ── a lista de motores aprovados, do servidor (ADR 0048, story 5.6) ─────── */

/**
 * O prazo da busca da lista — bem menor que o da narração.
 *
 * A narração espera 13,6 s na mediana porque um modelo está escrevendo; a lista é
 * a leitura de um `secret` e volta em milissegundos. E ela está **no caminho da
 * leitura**: a cadeia só se resolve depois que o app sabe o que conhece. Um prazo
 * longo aqui transformaria uma rede ruim numa tela parada antes mesmo de a
 * primeira chamada de modelo sair.
 */
export const PRAZO_DA_LISTA_MS = 10_000;

/** A busca da lista: o mesmo cliente, sem corpo, no verbo que a function atende. */
export type ChamarLista = (
  signal: AbortSignal,
) => Promise<{
  readonly data: unknown;
  readonly error: unknown;
  readonly response?: { readonly status: number; json(): Promise<unknown> };
}>;

const buscarNaFunction: ChamarLista = (signal) =>
  supabase.functions.invoke(FUNCTION, { method: 'GET', signal });

/**
 * A lista aprovada, do servidor — ou `null` quando a leitura não deu.
 *
 * **Nunca lança, e `null` não é lista vazia.** São dois fatos diferentes e o
 * catálogo os trata de formas diferentes: vazia com instante é "o servidor
 * respondeu e não há nenhuma variante nomeada"; `null` é "não consegui
 * perguntar". Só a segunda continua tentando.
 *
 * Cai em `null` em tudo que não for um 2xx cujo corpo se leia — inclusive no
 * **405 da function ainda não deployada** (AC 3): entre o build novo e o deploy,
 * o app pergunta, leva um método não atendido e segue com `nuvem:padrao`, sem
 * nada na tela e sem nada quebrado.
 *
 * A leitura de verdade é `lerMotoresDeNuvemAprovados`, no núcleo — a mesma que o
 * servidor usa para ler o `secret`. Duas leituras seriam duas ideias do que é
 * uma entrada válida.
 */
export async function buscarMotoresAprovados(
  chamar: ChamarLista = buscarNaFunction,
  prazoMs: number = PRAZO_DA_LISTA_MS,
): Promise<readonly MotorDeNuvemAprovado[] | null> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), prazoMs);
  try {
    let r: Awaited<ReturnType<ChamarLista>>;
    try {
      r = await chamar(controle.signal);
    } catch {
      return null;
    }
    if (r.error != null) return null;
    const corpo = r.data;
    if (typeof corpo !== 'object' || corpo === null) return null;
    // **A chave tem de estar lá, e ser lista.** `lerMotoresDeNuvemAprovados`
    // devolve `[]` para `undefined` (`Array.isArray(undefined)` é falso), e
    // aceitar isso faria um 2xx de corpo inesperado — um portal cativo, um
    // gateway, a function velha respondendo 200 a um GET — virar "o servidor
    // disse que não há nenhum", carimbado por dez minutos. O módulo inteiro se
    // apoia na distinção entre `null` (não consegui perguntar) e vazio
    // (perguntei, não há); confundi-las aqui a destrói na origem.
    const brutos = (corpo as { motores?: unknown }).motores;
    if (!Array.isArray(brutos)) return null;
    return lerMotoresDeNuvemAprovados(brutos);
  } finally {
    clearTimeout(relogio);
  }
}

/** A busca em voo, para dois pedidos simultâneos não virarem duas chamadas. */
let emVoo: Promise<ListaAprovada | null> | null = null;

/**
 * A lista em cache, buscando-a quando falta ou venceu.
 *
 * Duas leituras e o seletor podem pedi-la ao mesmo tempo no arranque; a promessa
 * em voo é compartilhada para que isso seja **uma** ida à rede.
 *
 * Falha de leitura **não apaga** o que já estava guardado: o que o servidor disse
 * da última vez continua sendo a melhor informação que o app tem, e jogá-la fora
 * faria o motor escolhido pelo dono sumir do seletor no primeiro soluço de rede.
 */
export function garantirListaAprovada(
  buscar: () => Promise<readonly MotorDeNuvemAprovado[] | null> = () => buscarMotoresAprovados(),
  agora: () => number = () => Date.now(),
): Promise<ListaAprovada | null> {
  const atual = listaAprovada();
  if (!listaVencida(agora(), atual)) return Promise.resolve(atual);
  if (emVoo) return emVoo;
  emVoo = buscar()
    .then((motores) => {
      if (motores === null) return listaAprovada();
      avisarDoTypo(motores);
      return guardarListaAprovada(motores, agora());
    })
    .catch(() => listaAprovada())
    .finally(() => {
      emVoo = null;
    });
  return emVoo;
}

/**
 * O aviso do erro de operação mais provável: um recurso com typo no secret.
 *
 * `saude_do_sono` em vez de `saude-do-sono` produz uma entrada **válida** — id
 * legível, lista não vazia — que nunca casa com recurso nenhum. O motor some do
 * seletor sem erro e sem rastro. A function não pode cobrar isso (ela não
 * conhece `RecursoId`: `ia/fio.ts` não importa nada, para sempre), então quem
 * cobra é o aparelho, que é onde o sumiço acontece.
 *
 * Uma vez por busca — a cada dez minutos, no pior caso —, e nunca em `render`.
 */
function avisarDoTypo(motores: readonly MotorDeNuvemAprovado[]): void {
  for (const a of motoresSemRecursoConhecido(motores, RECURSOS)) {
    console.warn(
      `motores: "${a.motor}" foi aprovado para ${JSON.stringify(a.recursos)}, ` +
        `e nenhum deles é um recurso conhecido (${RECURSOS.join(', ')}). ` +
        `Ele não vai aparecer em seletor nenhum — confira o secret NUVEM_MOTORES_APROVADOS.`,
    );
  }
}

/**
 * Esquece o que foi lido **e** a busca em voo.
 *
 * As duas juntas, porque esquecer só o cache deixaria uma busca pendente gravando
 * por cima logo em seguida — o arranque de um teste seguinte herdaria a resposta
 * do anterior.
 */
export function esquecerLista(): void {
  emVoo = null;
  esquecerListaAprovada();
}
// Quem chama hoje é o arranque de teste. Não há ligação com troca de sessão — a
// lista é do projeto, não do usuário, e quando isso mudar é aqui que ela entra.

/**
 * O catálogo deste recurso, já fundido — o que vai ao `resolverCadeia`.
 *
 * É assíncrono de propósito. A preferência do dono pode nomear uma variante que
 * só a lista do servidor conhece, e `resolverCadeia` descarta calada a
 * preferência que o catálogo não contém: resolver antes de perguntar faria a
 * escolha dele virar o padrão, sem nada dizer. Uma ida à rede a cada dez minutos
 * é barata perto disso.
 */
export async function catalogoDoRecurso(recurso: RecursoId): Promise<readonly MotorId[]> {
  return idsConhecidosDe(recurso, await garantirListaAprovada());
}
