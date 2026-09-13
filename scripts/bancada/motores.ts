/**
 * O ponto de injeção da bancada (guarda (1) do `architecture.test.ts`, ADR 0047).
 *
 * **Este é o único arquivo da bancada que nomeia a function**, e o único que
 * constrói transporte. A catraca "uma porta por hospedeiro" reconhece
 * `scripts/<qualquer>/motores.ts`, e é ela que impede a terceira cópia do cliente
 * da `ia-narrar`: o app já teve duas, cada uma lendo o erro do seu jeito, e nas
 * duas o ramo que lia o corpo de erro era código morto.
 *
 * O que mora aqui é só **a chamada**: método, cabeçalho, corpo e a leitura do
 * status. Quem traduz status, corpo, conclusão e assinatura em `Resposta` ou
 * `Falha` é `criarMotorDeNuvem` (`ia/nuvem.ts`), no núcleo — uma tabela com teste,
 * não um `if` por hospedeiro.
 *
 * **Status não-2xx não é exceção**: é dado, e volta como `{ status, corpo }`. Só a
 * ausência de rede volta como `{ semRede: true }` — o que o núcleo traduz em
 * `indisponivel`, que recua sem aumentar exposição. **Estouro de prazo não é
 * ausência de rede**: ele volta como corpo de classe `transitoria`, igual ao app —
 * ver `prazoEstourado`.
 *
 * O token nunca aparece em `detalhe`: o que sobe para diagnóstico é o nome e a
 * mensagem do erro de rede, e o corpo que a function devolveu.
 */
import {
  STATUS_POR_CLASSE,
  criarMotorDeNuvem,
  lerMotorId,
  type CorpoDaFalha,
  type Motor,
  type MotorId,
  type RespostaDoTransporte,
  type Transporte,
} from '@vitale/shared';

/** A function de narração. O literal vive aqui, e em mais lugar nenhum da bancada. */
const FUNCTION = 'ia-narrar';

/** O que a bancada manda no corpo da chamada. */
interface ChamadaHttp {
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  /** O prazo. Sem ele, uma function pendurada pendura a medição inteira. */
  readonly signal: AbortSignal;
}

/**
 * O prazo de uma chamada de nuvem.
 *
 * Uma narração de uma frase leva segundos; um minuto é folga larga. O que este teto
 * compra não é velocidade — é **relatório**: sem ele, uma function pendurada para a
 * corrida de 28 chamadas para sempre e nada é escrito no disco. A janela aparece no
 * relatório com a causa, e as outras seguem sendo medidas.
 *
 * O mesmo valor do app (`mobile/src/lib/motores/index.ts`), de propósito: as duas
 * colunas da bancada só comparam motor se o prazo for o mesmo dos dois lados.
 */
export const PRAZO_MS = 60_000;

/** O pedaço de `Response` que o transporte lê. O `fetch` global cabe aqui. */
export interface RespostaHttp {
  readonly status: number;
  text(): Promise<string>;
}

/**
 * A chamada, injetável — é por ela que o teste exercita a tabela de status sem
 * abrir rede. O `fetch` do Node 22 satisfaz esta forma.
 */
export type Buscar = (url: string, init: ChamadaHttp) => Promise<RespostaHttp>;

/** O endereço da function num projeto Supabase. */
export function enderecoDaFunction(url: string): string {
  return `${url.replace(/\/+$/, '')}/functions/v1/${FUNCTION}`;
}

/** A marca que fica no lugar de um segredo, quando ele aparece num diagnóstico. */
export const OMITIDO = '<omitido>';

/** O erro como texto, antes de passar pelo `semSegredo`. */
function mensagem(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

/**
 * O segredo fora do diagnóstico.
 *
 * O `detalhe` de uma falha viaja até o relatório e até o anel, e a mensagem de um
 * erro de rede não é nossa: ela pode carregar a URL completa, o cabeçalho ou o que
 * a biblioteca achou de incluir. Um token num relatório é um token vazado, e o
 * relatório é o arquivo que o dono abre e manda para si mesmo. Trocar por marca
 * custa uma linha; confiar na mensagem do `fetch` custa o token.
 */
export function semSegredo(texto: string, segredos: readonly string[]): string {
  let out = texto;
  for (const s of segredos) if (s.length > 0) out = out.split(s).join(OMITIDO);
  return out;
}

/**
 * O estouro do prazo, no vocabulário do núcleo.
 *
 * Cópia deliberada de `prazoEstourado` do app (`mobile/src/lib/motores/index.ts`),
 * e a razão de ela existir dos dois lados é a mesma: `CorpoDaFalha` é a forma
 * declarada de "falha com classe", e a tabela de `traduzirDaNuvem` diz que a classe
 * do corpo decide qualquer que seja o status — então o hospedeiro dizer
 * `transitoria` aqui é **usar** o contrato, não falsificar uma resposta HTTP.
 *
 * `transitoria`, e não `indisponivel`: timeout está na definição de `transitoria`
 * no núcleo ("o mesmo pedido no mesmo motor pode dar certo depois"). A diferença
 * não é de rótulo, é de caminho — `transitoria` cai no piso sem repetir, e
 * `indisponivel` recua para o próximo elo da cadeia. Enquanto a bancada dizia
 * `indisponivel` e o app dizia `transitoria`, a mesma chamada travada produzia
 * caminhos diferentes no Mac e no iPhone, e a comparação entre as duas colunas
 * deixava de ser sobre o motor.
 */
function prazoEstourado(prazoMs: number): RespostaDoTransporte {
  const corpo: CorpoDaFalha = {
    classe: 'transitoria',
    detalhe: `o prazo de ${Math.round(prazoMs / 1000)} s estourou`,
  };
  return { status: STATUS_POR_CLASSE.transitoria, corpo };
}

/**
 * O transporte da nuvem: POST com o JWT do usuário no `Authorization`.
 *
 * O `apikey` vai junto porque é o que o gateway do Supabase exige antes de olhar
 * o JWT; sem ele, o 401 viria do gateway e a medição diria `indisponivel` sem que
 * a function tenha rodado (`verify_jwt = true`, `supabase/config.toml`).
 *
 * Corpo que não é JSON volta como `corpo: undefined` — e o núcleo o lê como
 * `saida-invalida` num 2xx, ou usa só o status num erro. Engolir o erro de
 * `JSON.parse` aqui é o certo: um HTML de gateway não é falha de transporte, é
 * resposta ilegível.
 */
export function transporteDaNuvem(
  url: string,
  /** O JWT **de agora** — função, porque a sessão renova (ver `supabase.ts`). */
  tokenAtual: () => Promise<string>,
  chaveAnonima: string,
  buscar: Buscar = fetch,
  prazoMs: number = PRAZO_MS,
  /** Os outros segredos a redigir — o refresh token, sobretudo, que não expira em uma hora. */
  segredosExtra: readonly string[] = [],
): Transporte {
  const alvo = enderecoDaFunction(url);
  return async (corpo): Promise<RespostaDoTransporte> => {
    let token: string;
    try {
      token = await tokenAtual();
    } catch (e) {
      // A sessão venceu e não renovou: nenhuma chamada sai, e isto não é falha do
      // modelo. `indisponivel` recua sem subir exposição e sem gravar.
      return { semRede: true, detalhe: semSegredo(mensagem(e), [chaveAnonima, ...segredosExtra]) };
    }
    // Os dois segredos saem de TODO diagnóstico deste transporte — inclusive do
    // corpo que a function devolveu: se o gateway ecoar o `Authorization` num erro,
    // o JWT desceria até `Falha.detalhe` e até o arquivo que o dono abre.
    const segredos = [token, chaveAnonima, ...segredosExtra];
    const diagnostico = (e: unknown): string => semSegredo(mensagem(e), segredos);

    // O prazo vai por um controle NOSSO, e não por `AbortSignal.timeout`: abortando
    // nós mesmos, sabemos que o aborto foi nosso e classificamos o estouro como
    // `transitoria`. Deixar o runtime abortar devolve um `TimeoutError` que aqui
    // seria indistinguível de "a rede caiu", e viraria `indisponivel` — a classe
    // errada, e a que o app não usa.
    const controle = new AbortController();
    let estourou = false;
    const relogio = setTimeout(() => {
      estourou = true;
      controle.abort();
    }, prazoMs);

    let r: RespostaHttp;
    try {
      r = await buscar(alvo, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: chaveAnonima,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(corpo),
        signal: controle.signal,
      });
    } catch (e) {
      if (estourou) return prazoEstourado(prazoMs);
      // Sem rede de verdade: a chamada nem chegou a ter status.
      return { semRede: true, detalhe: diagnostico(e) };
    } finally {
      clearTimeout(relogio);
    }
    let cru = '';
    try {
      cru = await r.text();
    } catch (e) {
      // O status chegou e o corpo não: é resposta, não falta de rede.
      return { status: r.status, corpo: { detalhe: diagnostico(e) } };
    }
    let lido: unknown;
    try {
      lido = cru.trim() === '' ? undefined : JSON.parse(semSegredo(cru, segredos));
    } catch {
      lido = undefined;
    }
    return { status: r.status, corpo: lido };
  };
}

/**
 * O `motorPara` da bancada: um motor de nuvem para todo `MotorId` de nuvem, e
 * nada para o resto.
 *
 * O **aparelho** não tem motor aqui de propósito — é o marco B, que depende do
 * macOS 27 e da ponte Swift. Pedi-lo hoje dá tentativa sintética `indisponivel`,
 * sem chamada de rede: o orquestrador o marca como "o hospedeiro não entregou
 * este motor", e a linha do relatório diz isso.
 */
export function motoresDaBancada(
  s: {
    readonly url: string;
    readonly tokenAtual: () => Promise<string>;
    readonly chaveAnonima: string;
    /** Todo segredo da credencial, para nenhum deles chegar a `detalhe` (a `Sessao` os traz). */
    readonly segredos?: readonly string[];
  },
  buscar?: Buscar,
  prazoMs?: number,
): (id: MotorId) => Motor | undefined {
  const nuvem = criarMotorDeNuvem(
    transporteDaNuvem(s.url, s.tokenAtual, s.chaveAnonima, buscar, prazoMs, s.segredos ?? []),
  );
  return (id) => (lerMotorId(id)?.tipo === 'nuvem' ? nuvem : undefined);
}

/**
 * O hospedeiro sem motor nenhum — o caminho de `--export`, que não abre rede.
 * Todo motor pedido vira tentativa sintética `indisponivel`.
 */
export const SEM_NENHUM_MOTOR: (id: MotorId) => Motor | undefined = () => undefined;
