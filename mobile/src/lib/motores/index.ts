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
 *
 * **E é o único lugar do app que carrega a ponte do aparelho** (story 5.9, ADR
 * 0047): o módulo nativo `OnDeviceEngine`, por `requireOptionalNativeModule`, uma
 * vez. Sem ele — um build anterior à 5.9, o jest — o aparelho é `indisponivel`,
 * nunca exceção; fora do iOS, ele nem existe. Com ele (o iPhone, e também o
 * simulador de um build desta branch), o aparelho ganha motor, com fila própria e
 * prazo, e o seletor ganha o diagnóstico — relido enquanto não disser "disponível".
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import {
  RECURSOS,
  STATUS_POR_CLASSE,
  criarMotorDeNuvem,
  criarMotorDoAparelho,
  formatarMotorId,
  lerDiagnosticoDoAparelho,
  lerMotorId,
  lerMotoresDeNuvemAprovados,
  motoresSemRecursoConhecido,
  type CorpoDaFalha,
  type CorpoDoPedido,
  type MarcaDaChamada,
  type Falha,
  type Motor,
  type MotorDeNuvemAprovado,
  type MotorId,
  type RecursoId,
  type RespostaDoTransporte,
  type Transporte,
  type TransporteDoAparelho,
} from '@vitale/shared';
import { supabase } from '../supabase';
import { anel } from './anel';
import {
  PONTE_AUSENTE,
  PONTE_CONSULTANDO,
  PONTE_FORA_DO_IOS,
  esquecerListaAprovada,
  guardarListaAprovada,
  idsConhecidosDe,
  listaAprovada,
  listaVencida,
  type EstadoDaPonte,
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

/* ── a ponte do aparelho (story 5.9) ─────────────────────────────────────── */

/**
 * O que a cola do Expo expõe (`OnDeviceEngineModule.swift`). Cada função só
 * repassa ao Swift — a tradução da linha é do núcleo (`ia/aparelho.ts`), e a tabela
 * erro → classe é do `Engine.swift`.
 */
export interface PonteDoAparelho {
  /** A string de `serializarPedido` entra; a linha de resposta ou de falha sai. */
  responder(pedido: string): Promise<string>;
  /** Se o modelo do sistema atende, qual variante e que janela — ou por quê não. */
  diagnostico(): Promise<string>;
}

/**
 * Os nomes das funções da cola, como este arquivo as chama. A barreira da cola no
 * `architecture.test.ts` lê esta lista e exige que sejam exatamente os
 * `AsyncFunction("…")` do Swift: um nome trocado de um lado só daria `undefined is
 * not a function` no iPhone — uma `transitoria` não mapeada a cada toque.
 *
 * A tupla é conferida pelo compilador nos dois sentidos, como `CHAVES_DO_PEDIDO`: um
 * nome que a interface não tem não entra, e um membro novo da interface não compila
 * até entrar aqui.
 */
export const FUNCOES_DA_PONTE = ['responder', 'diagnostico'] as const satisfies readonly (keyof PonteDoAparelho)[];
type SobraDaPonte = Exclude<keyof PonteDoAparelho, (typeof FUNCOES_DA_PONTE)[number]>;
const _ponteInteira: [SobraDaPonte] extends [never] ? true : SobraDaPonte = true;
void _ponteInteira;

/**
 * O módulo nativo, carregado **uma vez**. `null` quando o build não o tem: o
 * `requireOptionalNativeModule` não lança nesse caso, e o `try` é a rede contra um
 * carregador que um dia lance — o aparelho ausente é `indisponivel`, nunca exceção.
 * O nome é o `Name(…)` da cola; a barreira da cola no `architecture.test.ts` exige
 * que os dois lados digam o mesmo.
 */
function carregarAPonte(): PonteDoAparelho | null {
  try {
    return requireOptionalNativeModule<PonteDoAparelho>('OnDeviceEngine');
  } catch {
    return null;
  }
}

const PONTE: PonteDoAparelho | null = carregarAPonte();

/** A linha de falha que o transporte do aparelho escreve quando o prazo estoura. */
function linhaDoPrazo(prazoMs: number): string {
  const f: Falha = {
    classe: 'transitoria',
    detalhe: `o prazo de ${Math.round(prazoMs / 1000)} s estourou; o aparelho termina o pedido antes de atender o próximo`,
  };
  return JSON.stringify(f);
}

/** Quantos prazos a vez espera uma chamada nativa que não volta, antes de passar adiante. */
export const PRAZOS_ATE_SOLTAR_A_VEZ = 3;

/**
 * O que só o hospedeiro sabe das chamadas ao aparelho (story 5.13) — o gêmeo do
 * `RegistroDoHospedeiro` da bancada do Mac (`scripts/bancada/motores.ts`), com o mesmo
 * sentido, para a amostra do iPhone contar pela mesma régua:
 *
 *  - **frio**: a chamada que subiu o modelo — a primeira que chega ao aparelho neste
 *    processo do app. Conta como medida, e fica fora da mediana.
 *  - **doHospedeiro**: a falha que o app fabricou, e não o modelo — o prazo estourado
 *    (no aparelho ou ainda esperando a vez) e a chamada nativa que rejeitou (o
 *    `Engine.swift` nunca lança: uma rejeição é a cola ou a ponte do Expo, não o modelo).
 *    Fica fora da medida, contada à parte.
 *
 * **Uma marca por chamada, na ordem em que elas encerram** — e não dois contadores. Com
 * contadores, quem mede tem de subtrair "antes" de "depois", e basta uma segunda chamada
 * encerrar dentro da janela (o prazo de um pedido que ainda espera a vez, por exemplo)
 * para a fria ou o prazo caírem na linha errada, sem ninguém ver. Carimbando a chamada,
 * quem mede consome as marcas daquela janela: uma, e é dela; nenhuma, e não houve chamada;
 * mais de uma, e a medição **diz que não sabe** em vez de escolher.
 *
 * Memória, e só memória: nada disto sai do aparelho.
 */
export interface RegistroDoAparelho {
  /** As chamadas já encerradas, na ordem — quem mede lê por fatia. */
  readonly marcas: readonly MarcaDaChamada[];
  /** Carimba uma chamada encerrada. Só o transporte chama. */
  registrar(marca: MarcaDaChamada): void;
}

export function novoRegistroDoAparelho(): RegistroDoAparelho {
  const marcas: MarcaDaChamada[] = [];
  return {
    get marcas(): readonly MarcaDaChamada[] {
      return marcas;
    },
    registrar: (marca) => {
      marcas.push(marca);
    },
  };
}

export interface OpcoesDoTransporteDoAparelho {
  /** Quanto a vez espera uma chamada que não volta. Padrão: {@link PRAZOS_ATE_SOLTAR_A_VEZ} prazos. */
  readonly tetoMs?: number;
  /** Onde fica o rastro de uma vez solta à força — o anel, no app. */
  readonly anotar?: (texto: string) => void;
  /** Onde contar as chamadas frias e as falhas que o transporte fabricou. */
  readonly registro?: RegistroDoAparelho;
}

/**
 * O transporte do aparelho: **um pedido por vez**, e com prazo.
 *
 * Um por vez porque o modelo do sistema é um só, e duas telas pedindo juntas (a
 * `/sono/saude` e a bancada, ou dois toques em janelas diferentes) fariam o segundo
 * pedido disputar o primeiro: o segundo **espera**. O prazo é o mesmo da nuvem
 * ({@link PRAZO_MS}), e estourar é `transitoria` — o mesmo contrato: cai no piso sem
 * recuar.
 *
 * **O prazo conta do toque, e a vez só passa quando o aparelho termina.** Uma
 * chamada nativa não se cancela: se a vez passasse no estouro, o pedido seguinte
 * iria ao modelo enquanto ele ainda escreve o anterior. Então quem estourou recebe
 * a falha na hora, mas a fila espera o aparelho de verdade; e **quem estourar ainda
 * esperando a vez nem chega a ir ao aparelho**. Assim nenhum toque espera mais que o
 * prazo, e o modelo não atende dois.
 *
 * **Com um teto.** Uma chamada que nunca volta trancaria a fila pela sessão inteira.
 * Depois de `tetoMs` (três prazos, por padrão) a vez passa adiante mesmo com a
 * chamada viva, e fica o rastro no anel. O preço é conhecido e aceito: o pedido
 * seguinte pode encontrar o modelo ainda ocupado e receber `concorrência` da ponte —
 * que ela traduz em `transitoria`, o mesmo piso sem recuo. Um pedido que falha por
 * agora é melhor que um aparelho mudo até o app fechar.
 *
 * Nunca rejeita por conta própria: a exceção da ponte sobe como veio, e
 * `criarMotorDoAparelho` a converte em `transitoria` não mapeada, com o nome cru.
 *
 * **E carimba cada chamada** (story 5.13), em `opcoes.registro`: ao encerrar, ela vira uma
 * marca — fria (subiu o modelo) e/ou do hospedeiro (prazo estourado, ponte que rejeitou).
 * O carimbo sai **antes** de a promessa resolver, para a medição achar a marca desta
 * janela assim que o `await` volta ({@link RegistroDoAparelho}).
 */
export function criarTransporteDoAparelho(
  responder: (pedido: string) => Promise<string>,
  prazoMs: number = PRAZO_MS,
  opcoes: OpcoesDoTransporteDoAparelho = {},
): TransporteDoAparelho {
  const tetoMs = opcoes.tetoMs ?? PRAZOS_ATE_SOLTAR_A_VEZ * prazoMs;
  const anotar = opcoes.anotar ?? (() => undefined);
  const registro = opcoes.registro ?? novoRegistroDoAparelho();
  /** Quantas chamadas já chegaram ao aparelho — zero quer dizer que a próxima é fria. */
  let servidas = 0;
  let fila: Promise<void> = Promise.resolve();
  return (pedido) =>
    new Promise<string>((resolver, rejeitar) => {
      let encerrado = false;
      // A marca desta chamada, carimbada **no instante em que ela encerra** — é o que faz
      // a fria e o prazo caírem na janela certa mesmo com outra chamada no meio.
      let frio = false;
      const encerrar = (doHospedeiro: boolean, entregar: () => void): void => {
        encerrado = true;
        clearTimeout(relogio);
        registro.registrar({ frio, doHospedeiro });
        entregar();
      };
      const relogio = setTimeout(() => {
        if (!encerrado) encerrar(true, () => resolver(linhaDoPrazo(prazoMs)));
      }, prazoMs);
      fila = fila.then(async () => {
        // O prazo estourou antes de a vez chegar: o pedido não vai ao aparelho.
        if (encerrado) return;
        if (servidas === 0) frio = true;
        servidas += 1;
        let soltar: () => void = () => undefined;
        const aVezPassa = new Promise<void>((r) => {
          soltar = r;
        });
        const teto = setTimeout(() => {
          anotar(
            `o aparelho não devolveu um pedido em ${Math.round(tetoMs / 1000)} s; a vez passou adiante com a ` +
              'chamada ainda viva — o próximo pedido pode receber concorrência (transitoria)',
          );
          soltar();
        }, tetoMs);
        const chamada = (async () => {
          try {
            const linha = await responder(pedido);
            if (!encerrado) encerrar(false, () => resolver(linha));
          } catch (e) {
            // O `Engine.swift` nunca lança: quem rejeita é a cola ou a ponte do Expo — o
            // hospedeiro, não o modelo.
            if (!encerrado) encerrar(true, () => rejeitar(e));
          }
        })();
        await Promise.race([chamada, aVezPassa]);
        clearTimeout(teto);
      });
    });
}

/**
 * O registro do transporte do aparelho deste processo — um só, como o motor, e é por isso
 * que ele fica aqui: a amostra lê **as marcas das chamadas que o app de fato fez**, e não
 * as de um transporte paralelo que ninguém usa.
 */
const REGISTRO_DO_APARELHO: RegistroDoAparelho = novoRegistroDoAparelho();

/**
 * As marcas das chamadas ao aparelho nesta sessão — a fria e as que o app fabricou. É o
 * que a amostra da tela de desenvolvimento consome, por janela, para marcar a linha
 * (story 5.13). Só leitura: quem carimba é o transporte.
 */
export const registroDoAparelho: RegistroDoAparelho = REGISTRO_DO_APARELHO;

/**
 * O `motorPara` do app: um motor de nuvem para todo `MotorId` de nuvem, o motor do
 * aparelho para `aparelho:sistema` quando a ponte está no build, e nada para o resto.
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
 * O **aparelho** (5.9) tem motor quando o módulo nativo está no build, com a sua
 * fila e o seu prazo. Sem o módulo, não há motor: pedi-lo dá tentativa sintética
 * `indisponivel`, sem chamada nenhuma, e a assinatura da tela diz isso em palavras.
 * Com o módulo e o modelo fora (Apple Intelligence desligada, modelo não pronto),
 * há motor — e quem responde `indisponivel`, com o motivo, é a própria ponte. Os
 * pesos abertos (`aparelho:<provedor>/<pesos>`, a 5.8) não têm motor ainda.
 */
export function criarMotorPara(
  chamar: Chamar = chamarAFunction,
  prazoMs: number = PRAZO_MS,
  ponte: PonteDoAparelho | null = PONTE,
  registro: RegistroDoAparelho = REGISTRO_DO_APARELHO,
): (id: MotorId) => Motor | undefined {
  const transporte = serializar(criarTransporte(chamar, prazoMs));
  const doAparelho =
    ponte === null
      ? undefined
      : criarMotorDoAparelho(
          criarTransporteDoAparelho((p) => ponte.responder(p), prazoMs, { anotar: anel.anotar, registro }),
        );
  const porId = new Map<string, Motor>();
  return (id) => {
    const lido = lerMotorId(id);
    if (lido?.tipo === 'aparelho') return lido.variante === 'sistema' ? doAparelho : undefined;
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

/* ── o diagnóstico do aparelho (story 5.9) ────────────────────────────────── */

/**
 * O prazo do diagnóstico. Ele não abre sessão nem gera nada — só pergunta ao SDK o
 * que ele já sabe —, então volta em milissegundos; o prazo existe para o seletor
 * nunca ficar em "consultando…" para sempre.
 */
export const PRAZO_DO_DIAGNOSTICO_MS = 10_000;

/** O diagnóstico da ponte, visto pelas telas. */
export interface LeitorDaPonte {
  /** O que já se sabe, sem esperar: ausente, fora do iOS, consultando ou o último lido. */
  agora(): EstadoDaPonte;
  /** O diagnóstico: o último lido, ou a primeira leitura. Nunca rejeita. */
  garantir(): Promise<EstadoDaPonte>;
  /**
   * Lê de novo **se o último não disse "disponível"** — é o que a tela de motores chama
   * ao ganhar foco e quando o app volta ao primeiro plano. Disponível não é relido na
   * sessão; leitura em voo é compartilhada. Nunca rejeita.
   */
  reconsultar(): Promise<EstadoDaPonte>;
}

/**
 * O leitor do diagnóstico.
 *
 * **Uma vez por sessão, enquanto disser "disponível".** O que não é disponível pode
 * ser passageiro — `modelNotReady` enquanto o sistema baixa o modelo, a Apple
 * Intelligence desligada que o dono liga nos Ajustes, um prazo estourado —, então
 * esse resultado fica em cache só até alguém pedir para reconsultar: a tela de
 * motores ao ganhar foco, e o app ao voltar ao primeiro plano. Durante a releitura,
 * `agora()` continua mostrando o último lido, sem piscar em "consultando".
 *
 * Fora do contrato, rejeitado ou sem resposta no prazo, o diagnóstico é
 * **ilegível** — o seletor o mostra como indisponível, com "o aparelho não
 * respondeu como esperado". A linha crua vai junto, para a tela de desenvolvimento.
 *
 * Fora da fila do motor, de propósito: a fila é das gerações, e o diagnóstico não
 * pode esperar um pedido de 15 s para dizer se o modelo existe.
 *
 * Fora do iOS não há o que perguntar: o modelo só existe no iPhone.
 */
export function criarLeitorDaPonte(
  ponte: PonteDoAparelho | null,
  prazoMs: number = PRAZO_DO_DIAGNOSTICO_MS,
  plataforma: string = Platform.OS,
): LeitorDaPonte {
  const fixo = plataforma !== 'ios' ? PONTE_FORA_DO_IOS : ponte === null ? PONTE_AUSENTE : null;
  if (fixo !== null || ponte === null) {
    const estado = fixo ?? PONTE_AUSENTE;
    return { agora: () => estado, garantir: () => Promise.resolve(estado), reconsultar: () => Promise.resolve(estado) };
  }
  let lido: EstadoDaPonte | null = null;
  let emVoo: Promise<EstadoDaPonte> | null = null;

  const ler = async (): Promise<EstadoDaPonte> => {
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const noPrazo = new Promise<null>((r) => {
      relogio = setTimeout(() => r(null), prazoMs);
    });
    try {
      const linha = await Promise.race([ponte.diagnostico(), noPrazo]);
      if (linha === null) {
        return {
          tipo: 'lido',
          diagnostico: { estado: 'ilegivel', detalhe: `o diagnóstico não voltou em ${Math.round(prazoMs / 1000)} s` },
        };
      }
      return { tipo: 'lido', diagnostico: lerDiagnosticoDoAparelho(linha), cru: String(linha) };
    } catch (e) {
      return { tipo: 'lido', diagnostico: { estado: 'ilegivel', detalhe: `a ponte lançou — ${mensagem(e)}` } };
    } finally {
      clearTimeout(relogio);
    }
  };

  const disponivel = (e: EstadoDaPonte | null): boolean => e?.tipo === 'lido' && e.diagnostico.estado === 'disponivel';

  const reconsultar = (): Promise<EstadoDaPonte> => {
    if (emVoo) return emVoo;
    if (lido !== null && disponivel(lido)) return Promise.resolve(lido);
    const voo = ler().then((e) => {
      lido = e;
      if (emVoo === voo) emVoo = null;
      return e;
    });
    emVoo = voo;
    return voo;
  };

  return {
    agora: () => lido ?? PONTE_CONSULTANDO,
    garantir: () => (lido !== null ? Promise.resolve(lido) : reconsultar()),
    reconsultar,
  };
}

/** O diagnóstico da ponte deste build — o que o seletor e a bancada leem. */
export const ponteDoAparelho: LeitorDaPonte = criarLeitorDaPonte(PONTE);

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
