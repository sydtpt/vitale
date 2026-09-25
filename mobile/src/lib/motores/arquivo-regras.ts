/**
 * O **retrato** da última corrida da bancada: tudo o que o cartão mostra, numa estrutura
 * que sai do aparelho por cabo em vez de por foto.
 *
 * ## Por que existe
 *
 * Os resultados da bancada vivem só em memória — o anel e os cartões de cada motor. Para
 * mandar um resultado a quem o analisa, o dono tirava print; e ao trocar de app para enviar
 * a imagem, o iOS **matava o Orbe em segundo plano** (o `.app` tem 6,9 GB e é o candidato
 * óbvio ao despejo), levando a corrida inteira com ele. Uma corrida do peso aberto custa de
 * dez minutos a meia hora de tela acesa; perdê-la na troca de app é perder a medição, não o
 * print. E vamos medir muito mais: a receita mista de quantização, o Qwen3-8B, a esteira de
 * motores.
 *
 * ## O que é puro aqui, e o que não é
 *
 * **Só a montagem.** Este módulo não escreve em disco, não abre rede e não lê estado: ele
 * recebe o que a corrida produziu e devolve o objeto e o texto JSON, que é o que tem teste
 * ({@link emJson}). A escrita fica em `./arquivo.ts`, na borda, com o `expo-file-system` —
 * o molde de `amostras-regras.ts`, que é onde moram as decisões que dão para tomar sem tela.
 *
 * ## O resumo não se recalcula
 *
 * As três contas da comparação — {@link resumoDaCorrida}, {@link linhaDoResumo} e
 * {@link amostrasDivergentes} — são do núcleo (`packages/shared/src/bancada/corrida.ts`) e
 * são chamadas daqui, não reescritas. É a mesma regra do `./texto.ts` do núcleo: uma
 * mediana escrita duas vezes é "86,4%" de um lado e "86.4%" do outro, e o arquivo existe
 * justamente para ser comparado com o relatório do Mac. Por causa disso este arquivo entra
 * em `QUEM_MEDE_NO_APP`, a lista da barreira da régua no `architecture.test.ts`.
 *
 * ## Nada disto sai do aparelho por si
 *
 * A tela afirma, em voz alta e em três lugares, que *nada sai do aparelho* — e alguém vai
 * estranhar um arquivo. O princípio é sobre **não transmitir**, não sobre não persistir: o
 * retrato fica no container do app, que só o dono alcança, com o aparelho desbloqueado e
 * ligado ao Mac dele (`xcrun devicectl device copy from --domain-type appDataContainer`).
 * Nenhuma rede é aberta, nenhuma nuvem é notificada, nenhum backup é pedido. Quem tira o
 * arquivo de lá é o dono, com um cabo na mão — que é exatamente o que ele fazia com o print,
 * só sem perder a corrida no caminho.
 */
import {
  SEM_MODELO,
  amostrasDivergentes,
  linhaDoResumo,
  resumoDaCorrida,
  type LinhaDoRelatorio,
  type MotorId,
  type RecursoId,
  type ResumoDaCorrida,
} from '@vitale/shared';
import type { ContextoDaAmostra, CorridaMedida } from './amostra';
import type { Linha } from './amostras';

/**
 * O nome do arquivo, dentro de `Documents/` do container.
 *
 * **Estável e previsível de propósito**: quem o lê de fora o lê por nome
 * (`devicectl … --source Documents/bancada-ultima-corrida.json`), e um nome com data ou
 * com hash obrigaria a listar o diretório antes de cada cópia.
 */
export const NOME_DO_ARQUIVO = 'bancada-ultima-corrida.json';

/**
 * O caminho **dentro do container de dados do app** — o que o `devicectl` recebe em
 * `--source`.
 *
 * Escrito aqui, ao lado do nome, porque é o endereço que sai do aparelho: a tela o mostra
 * e o `./arquivo.ts` o cumpre. Duas grafias dele envelheceriam em separado, e o sintoma
 * seria uma cópia que não acha nada sem dizer por quê.
 */
export const CAMINHO_NO_CONTAINER = `Documents/${NOME_DO_ARQUIVO}`;

/**
 * A versão do formato.
 *
 * Sobe quando um campo **muda de sentido** — não quando um nasce. Quem lê o arquivo de fora
 * tem de saber se `ms` continua sendo milissegundos; a duração do vídeo já custou essa
 * lição, quando a API nova passou a entregar em ms o que o código lia em s.
 */
export const VERSAO_DO_ARQUIVO = 1;

/** Um motor no arquivo: o id que o relatório do Mac usa e o nome que a tela escreve. */
export interface MotorNoArquivo {
  readonly id: MotorId;
  readonly nome: string;
}

/** O que as duas formas de corrida compartilham no topo. */
interface CabecalhoDoRetrato {
  readonly versao: number;
  /** Quando a corrida terminou, em ISO — o instante que o dono casa com o que viu na tela. */
  readonly em: string;
  readonly leitura: RecursoId;
  /** Quem entrou, na ordem em que correu. */
  readonly motores: readonly MotorNoArquivo[];
}

/**
 * Uma coluna da comparação de **uma janela**: a linha inteira como a tela a recebeu, mais o
 * nome do motor e a régua ao lado.
 *
 * O template é repetido em cada coluna, e não escrito uma vez no topo: é a mesma decisão do
 * cartão da tela — o que faz a comparação é a adjacência. Uma coluna copiada daqui sem a
 * régua dela é um texto sem nada contra o que julgá-lo.
 */
export interface ColunaNoArquivo extends Linha {
  readonly nome: string;
  /** A frase do template desta janela, quando a leitura tem régua e ela foi medida. */
  readonly template?: string;
}

/** A comparação de uma janela: um caso, um motor por coluna. */
export interface RetratoDeUmaJanela extends CabecalhoDoRetrato {
  readonly tipo: 'uma-janela';
  readonly caso: { readonly chave: string; readonly rotulo: string };
  readonly colunas: readonly ColunaNoArquivo[];
}

/** Uma corrida da amostra no arquivo: o resumo já calculado e as janelas, uma a uma. */
export interface CorridaNoArquivo {
  readonly motor: MotorId;
  readonly nome: string;
  /** Parou antes da última janela: as medidas do resumo são só do que foi medido. */
  readonly parcial: boolean;
  /** Por que parou antes do fim, quando não foi o toque em "parar". */
  readonly motivo?: string;
  /** A corrida que não aconteceu, e o motivo — ela vale tanto quanto uma que aconteceu. */
  readonly recusa?: string;
  readonly inicio: string;
  readonly fim: string;
  readonly duracaoMs: number;
  /** As três medidas que se comparam entre motores, pelas contas do núcleo. */
  readonly resumo: ResumoDaCorrida;
  /** A mesma linha que o cartão "lado a lado" escreve, para copiar e colar sem traduzir. */
  readonly resumoEmTexto: string;
  readonly janelas: readonly LinhaDoRelatorio[];
}

/** A amostra de N janelas: uma corrida por motor, sobre a mesma amostra. */
export interface RetratoDaAmostra extends CabecalhoDoRetrato {
  readonly tipo: 'amostra';
  /** O que a medição usou — o mesmo para todas as corridas da sessão. */
  readonly contexto: ContextoDaAmostra;
  readonly duracaoMs: number;
  /**
   * As corridas mediram as mesmas janelas? Em palavras quando não, `null` quando a
   * comparação é legítima — a armadilha de ler duas taxas sobre acervos diferentes.
   */
  readonly divergencia: string | null;
  readonly corridas: readonly CorridaNoArquivo[];
}

/** O retrato, nas duas formas que a bancada produz. */
export type RetratoDaBancada = RetratoDeUmaJanela | RetratoDaAmostra;

/** Um instante da corrida como o arquivo o escreve. */
function instante(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * O retrato da comparação de **uma janela**.
 *
 * A régua sai das próprias linhas (a coluna `sem-modelo`), e não de um parâmetro: quem monta
 * o retrato e quem pinta o cartão têm de ler o mesmo template, senão o arquivo guarda uma
 * régua e a tela mostra outra.
 */
export function retratoDeUmaJanela(o: {
  readonly em: Date;
  readonly leitura: RecursoId;
  readonly caso: { readonly chave: string; readonly rotulo: string };
  readonly linhas: readonly Linha[];
  readonly nomeDe: (motor: MotorId) => string;
}): RetratoDeUmaJanela {
  const template = o.linhas.find((l) => l.motor === SEM_MODELO)?.frase;
  return {
    versao: VERSAO_DO_ARQUIVO,
    tipo: 'uma-janela',
    em: o.em.toISOString(),
    leitura: o.leitura,
    caso: o.caso,
    motores: o.linhas.map((l) => ({ id: l.motor, nome: o.nomeDe(l.motor) })),
    colunas: o.linhas.map((l) => ({
      ...l,
      nome: o.nomeDe(l.motor),
      // A régua não se repete dentro do bloco do próprio template — ali ela é a linha.
      ...(template !== undefined && l.motor !== SEM_MODELO ? { template } : {}),
    })),
  };
}

/** O retrato da **amostra**: o contexto uma vez, e uma corrida por motor. */
export function retratoDaAmostra(o: {
  readonly em: Date;
  readonly leitura: RecursoId;
  readonly contexto: ContextoDaAmostra;
  readonly corridas: readonly CorridaMedida[];
  readonly inicio: number;
  readonly fim: number;
  readonly nomeDe: (motor: MotorId) => string;
}): RetratoDaAmostra {
  return {
    versao: VERSAO_DO_ARQUIVO,
    tipo: 'amostra',
    em: o.em.toISOString(),
    leitura: o.leitura,
    motores: o.corridas.map((c) => ({ id: c.motor, nome: o.nomeDe(c.motor) })),
    contexto: o.contexto,
    duracaoMs: o.fim - o.inicio,
    divergencia: amostrasDivergentes(o.corridas, o.nomeDe),
    corridas: o.corridas.map((c) => {
      const resumo = resumoDaCorrida(c);
      const nome = o.nomeDe(c.motor);
      return {
        motor: c.motor,
        nome,
        parcial: c.parcial,
        ...(c.motivo !== undefined ? { motivo: c.motivo } : {}),
        ...(c.recusa !== undefined ? { recusa: c.recusa } : {}),
        inicio: instante(c.inicio),
        fim: instante(c.fim),
        duracaoMs: c.fim - c.inicio,
        resumo,
        resumoEmTexto: linhaDoResumo(resumo, nome),
        janelas: c.linhas,
      };
    }),
  };
}

/**
 * O retrato como texto.
 *
 * Indentado, porque o primeiro leitor é um par de olhos num `cat`: uma linha só de 100 kB
 * obrigaria a passar todo arquivo por um formatador antes de poder olhá-lo, e o arquivo
 * existe para ser lido no instante em que chega.
 *
 * Termina em `\n` pelo mesmo motivo: sem ele o prompt do shell cola na última chave.
 */
export function emJson(retrato: RetratoDaBancada): string {
  return `${JSON.stringify(retrato, null, 2)}\n`;
}

/**
 * **Vale gravar?** Uma corrida que não mediu nada não substitui a anterior.
 *
 * O arquivo é "a última corrida", e uma corrida nova apaga a de antes — então um toque que
 * não produziu coluna nenhuma (a fila vazia, o Parar antes da primeira, a leitura sem caso)
 * apagaria uma medição boa e deixaria um retrato vazio no lugar. É o único caso em que não
 * gravar é mais honesto que gravar.
 */
export function valeGuardar(retrato: RetratoDaBancada): boolean {
  return retrato.tipo === 'uma-janela' ? retrato.colunas.length > 0 : retrato.corridas.length > 0;
}
