/**
 * A **parede de capas** — o arquivo das edições impressas, montado (Story 2.4b).
 *
 * O arquivo tem 39 meses impressos e, até esta story, a única porta até eles era
 * o cartão do período corrente: para ver junho de 2023 era preciso saber que ele
 * existe e navegar até lá. Folhear não existia.
 *
 * A parede é a resposta, e a tese dela é do mockup aprovado em 07/09/2026
 * (`mockups/key-arquivo.html`): *"a grade é uma parede de capas, não um seletor
 * de data"*. Nenhum calendário, nenhuma roda de mês, nenhum campo de intervalo —
 * o que se reconhece é a capa. E é só com as capas **lado a lado** que a textura
 * que o Épico 2 promete aparece: 13 dos 21 meses até mar/2025 não têm foto,
 * contra 19 de 20 depois. *2023 tem que parecer 2023.*
 *
 * ## O que este módulo faz, e o que não faz
 *
 * Faz a **montagem**: junta o inventário (`fetchArquivoDeEdicoes`), as capas
 * carimbadas (`fetchCapasDoArquivo`) e os textos dos meses
 * (`fetchManchetesDosMeses`), filtra, ordena e fatia em linhas de duas. Puro:
 * não lê banco, não desenha e não decide cor.
 *
 * **Não** resolve foto nem rota. As duas são ponteiro para fora do banco — a
 * biblioteca do iPhone e `activity_routes` — e quem as junta é o hospedeiro, que
 * também as lê **em lote**, uma chamada por coisa. A parede não abre uma leitura
 * por célula, e uma barreira de código-fonte no celular cobra isso.
 *
 * ## Três decisões do dono (24/09/2026)
 *
 * - **Mês na parede.** É o grão em que a capa existe e em que a textura muda.
 * - **Ano como quatro tiras**, no lugar da capa que ele não tem: *"o anuário não
 *   tem capa: as quatro tiras são a capa do ano"*
 *   (`docs/specs/revista-retrospectiva/cadernos.md`). Ver {@link tirasDoAno}.
 * - **Trimestre não entra** — e a semana também não: a parede é do que se folheia,
 *   e 52 semanas por ano afogariam os doze meses que carregam a textura. Elas
 *   continuam impressas e continuam abrindo pela rota; só não têm ladrilho.
 */
import { chamadaDoTexto } from './chamada';
import { legendaQueAcrescenta, rotuloDaEdicao } from './capa';
import type { Capa } from '../data/edicoes-capa';
import type { EdicaoNoArquivo, TextosDaEdicao, TipoComEdicao } from '../data/edicoes-ia';
import { CADERNO_IDS, type CadernoId } from '../period/cadernos';
import { offsetDoInicio } from '../period/bounds';

/** Quantas capas por fileira — as duas colunas de 173 px do mockup. */
export const COLUNAS_DA_PAREDE = 2;

/** Os doze meses de uma tira do anuário. */
export const MESES_DO_ANO = 12;

/** O tipo de período que vira ladrilho. Ver o cabeçalho: trimestre e semana ficam de fora. */
const TIPO_DO_LADRILHO: TipoComEdicao = 'month';

/** O tipo de período que vira as quatro tiras. */
const TIPO_DO_ANUARIO: TipoComEdicao = 'year';

/* ── o que a parede recebe ───────────────────────────────────────────────── */

/**
 * As três leituras em lote que a parede consome — **uma por coisa**, nenhuma por
 * célula.
 *
 * Elas são independentes de propósito: o inventário diz *que edições existem*, as
 * capas dizem *o que cada uma mostra* e os textos dizem *o que ela diz*. Uma capa
 * sem edição não vira ladrilho (a parede é o arquivo das edições, não das capas),
 * e uma edição sem capa vira ladrilho em papel — as duas tabelas não têm chave
 * estrangeira entre si, e o carimbo sobrevive aos cadernos que cobria.
 */
export interface AcervoDaParede {
  /** Todas as edições do usuário, agrupadas por período. */
  readonly arquivo: readonly EdicaoNoArquivo[];
  /** Todas as capas carimbadas. Tipos que a parede não desenha são ignorados. */
  readonly capas: readonly Capa[];
  /** Os textos das edições de mês — a fonte da manchete. */
  readonly textos: readonly TextosDaEdicao[];
}

/* ── o ladrilho ──────────────────────────────────────────────────────────── */

/** Uma capa de mês na parede. */
export interface LadrilhoDaParede {
  readonly tipoPeriodo: TipoComEdicao;
  readonly inicio: string;
  readonly fim: string;
  /**
   * A chave do período — `month\0…\0…`. É a identidade do ladrilho na lista
   * virtualizada e nos mapas de foto e de rota.
   *
   * **Inclui o `fim`, e isso não é zelo**: a chave primária de `edicoes_ia` é
   * `(user_id, tipo_periodo, inicio, fim, caderno)`, então duas edições de mês
   * com o mesmo `inicio` e `fim` diferente são possíveis. Com a chave pelo
   * `inicio` só, elas colidiriam — e uma `FlatList` com chave repetida desenha uma
   * célula no lugar da outra, sem erro e sem nada vermelho.
   */
  readonly chave: string;
  /**
   * O período por extenso — `"Agosto de 2026"`. É o que o leitor de tela ouve; o
   * rótulo **visível** é o curto, e quem o escreve é o hospedeiro (a grafia curta
   * é de tela, e não de domínio).
   */
  readonly rotulo: string;
  /**
   * A chamada do **primeiro caderno visível** — a mesma manchete da capa da rota,
   * pela mesma função (`chamadaDoTexto`, dono único).
   *
   * `null` quando nenhum caderno visível está impresso, ou quando o texto do
   * primeiro não fecha frase nenhuma. Nunca string vazia.
   */
  readonly manchete: string | null;
  /**
   * A capa carimbada, ou `null` — e aí o ladrilho é papel com o rótulo.
   *
   * **Passa inteira, sem ser reinterpretada.** Quem escolhe o desenhista é
   * `desenhoDaCapa` (`revista/desenho.ts`), com a rota e a grade que o hospedeiro
   * trouxer.
   */
  readonly capa: Capa | null;
  /**
   * A legenda carimbada, **quando ela acrescenta** — ou `null`.
   *
   * É o que o ladrilho mostra quando não há imagem: a foto que saiu da biblioteca
   * e a capa em papel continuam dizendo *o que a capa era*. A supressão é a mesma
   * da capa da rota (`legendaQueAcrescenta`): a `grade` carimba o rótulo do
   * período como legenda, e repeti-lo embaixo escreveria "Agosto de 2026" duas
   * vezes no mesmo ladrilho.
   */
  readonly legenda: string | null;
  /**
   * O `offset` do período em relação ao relógio de quem montou — o que a grade da
   * capa precisa (`gradeDoPeriodo`).
   *
   * `null` quando o início não é o primeiro dia de um mês, que o banco torna
   * impossível: a coluna é `date` e a chave é o período. Com `null`, o ladrilho
   * de natureza `grade` cai para o papel, em vez de desenhar um mês que não é o
   * dele.
   */
  readonly offset: number | null;
}

/* ── as quatro tiras do ano ──────────────────────────────────────────────── */

/**
 * Um mês numa tira do anuário — **o que `metrica_lider` diz daquele caderno
 * naquele mês**.
 *
 * Três estados, e o do meio é o que faz a coluna nulável valer a pena:
 *
 * - `ausente` — o caderno não saiu naquele mês. Sem edição, ou a edição existe e
 *   não o teve;
 * - `sem-metrica` — o caderno saiu e **nenhuma métrica liderou** (`metrica_lider`
 *   nulo): ele entrou pela lápide, ou nada dele passou no portão de amostra.
 *   *Nulo é declaração, não omissão* — e por isso não se confunde com `ausente`;
 * - `metrica` — o caderno saiu liderado por esta chave.
 */
export type CelulaDaTira =
  | { readonly estado: 'ausente' }
  | { readonly estado: 'sem-metrica' }
  | {
      readonly estado: 'metrica';
      readonly metrica: string;
      /**
       * A métrica é **outra** que a do mês anterior que teve uma.
       *
       * É o que faz a tira falar da *identidade* do líder, e não só da presença
       * dele: sem isto, doze meses liderados pelo mesmo fato e doze meses
       * trocando de fato a cada mês desenhariam exatamente a mesma barra, e a
       * promessa de *"quatro batimentos paralelos"* seria só uma frase. Falso no
       * primeiro mês com métrica do ano: não há antes com que comparar.
       */
      readonly mudou: boolean;
    };

/** Uma tira: um caderno, os doze meses do ano. */
export interface TiraDoAno {
  readonly caderno: CadernoId;
  /** Sempre doze, de janeiro a dezembro. */
  readonly celulas: readonly CelulaDaTira[];
  /** Em quantos meses o caderno saiu. Daqui, para ninguém varrer as células de novo. */
  readonly meses: number;
}

/**
 * As quatro tiras de um ano — **lidas de `metrica_lider`, nunca recalculadas**.
 *
 * O contrato é de `cadernos.md`: *"São quatro tiras de doze meses, uma por
 * caderno, na cor do caderno. Cada tira mede o fato que liderou o ranqueamento
 * daquele caderno naquele mês — a tira e a ordem falam do mesmo número, e o ano
 * se lê como quatro batimentos paralelos."*
 *
 * **Os doze valores saem dos doze meses, e não do anuário.** A edição do ano tem
 * uma linha por caderno, com um `metrica_lider` só — doze valores não existem
 * nela. É por isso que esta função varre o arquivo dos **meses** daquele ano.
 *
 * **E por que ler, e não recalcular:** recalcular seria inventar um ranqueamento
 * novo a cada abertura da parede, e a edição impressa — que congelou a ordem em
 * `posicao` — deixaria de concordar com a tira que a anuncia.
 *
 * As quatro saem **sempre**, na ordem do catálogo, inclusive as de zero meses: a
 * tira vazia é a resposta de que aquele caderno não saiu no ano, e escondê-la
 * faria três tiras parecerem os quatro cadernos.
 *
 * O silêncio do dono (Story 2.5) **não** entra aqui: ele é preferência de
 * leitura, e a tira é registro do que foi impresso. Calar o Sono na Diagramação
 * não apaga os nove meses em que ele liderou 2025.
 */
export function tirasDoAno(
  arquivo: readonly EdicaoNoArquivo[],
  ano: number,
): TiraDoAno[] {
  /** caderno → mês (0–11) → a métrica lida, ou `null` para "liderou ninguém". */
  const porCaderno = new Map<CadernoId, Map<number, string | null>>();
  /**
   * A tira tem **doze células**, uma por mês civil, e o banco permite duas
   * edições de mês no mesmo mês (o `fim` faz parte da chave). Uma célula não cabe
   * duas: a que vence é a do período que **termina depois**, e o critério é
   * escrito porque a alternativa — a última que o laço encontrar — muda com a
   * ordem em que o PostgREST devolveu as linhas.
   */
  const fimNoMes = new Map<number, string>();
  for (const e of [...arquivo].sort((a, b) => (a.fim < b.fim ? -1 : a.fim > b.fim ? 1 : 0))) {
    if (e.tipoPeriodo !== TIPO_DO_LADRILHO) continue;
    if (anoDoInicio(e.inicio) !== ano) continue;
    const mes = mesDoInicio(e.inicio);
    if (mes === null) continue;
    const jaVisto = fimNoMes.get(mes);
    if (jaVisto !== undefined && jaVisto !== e.fim) {
      console.warn(
        `[revista] duas edições de mês em ${ano}-${String(mes + 1).padStart(2, '0')} `
        + `(fim ${jaVisto} e ${e.fim}); a tira do anuário mostra a que termina depois.`,
      );
    }
    fimNoMes.set(mes, e.fim);
    for (const c of e.cadernos) {
      let meses = porCaderno.get(c.caderno);
      if (!meses) {
        meses = new Map();
        porCaderno.set(c.caderno, meses);
      }
      meses.set(mes, c.metricaLider);
    }
  }

  return CADERNO_IDS.map((caderno) => {
    const meses = porCaderno.get(caderno);
    const celulas: CelulaDaTira[] = [];
    let anterior: string | null = null;
    let saiu = 0;
    for (let mes = 0; mes < MESES_DO_ANO; mes += 1) {
      if (!meses?.has(mes)) {
        celulas.push(AUSENTE);
        continue;
      }
      saiu += 1;
      const metrica = meses.get(mes) ?? null;
      if (metrica === null) {
        // O caderno saiu calado. `anterior` **não** é zerado: a continuidade que
        // a tira mostra é entre métricas, e um mês sem líder não é uma troca de
        // líder — é um mês sem líder.
        celulas.push(SEM_METRICA);
        continue;
      }
      celulas.push({ estado: 'metrica', metrica, mudou: anterior !== null && anterior !== metrica });
      anterior = metrica;
    }
    return { caderno, celulas, meses: saiu };
  });
}

const AUSENTE: CelulaDaTira = { estado: 'ausente' };
const SEM_METRICA: CelulaDaTira = { estado: 'sem-metrica' };

/* ── os itens da lista ───────────────────────────────────────────────────── */

/**
 * O que a lista rolante desenha — e ela rola linhas, não células: a virtualização
 * é no molde do `SeletorDaCapa`, onde 372 fotos derrubaram a tela quando eram
 * montadas de uma vez.
 */
export type ItemDaParede =
  /**
   * A régua do ano: o número e um filete.
   *
   * *"O ano só aparece como régua fina entre as fileiras — agrupa sem virar
   * controle"* (mockup). Ela não é seletor, não é filtro e não é tocável: sem
   * ela, a parede de 39 meses é uma escada de capas sem marco nenhum; com ela
   * virando botão, a parede volta a ser o seletor de data que a tese recusa.
   */
  | { readonly tipo: 'regua'; readonly chave: string; readonly ano: number }
  /** O anuário — as quatro tiras, no lugar da capa que o ano não tem. */
  | {
      readonly tipo: 'anuario';
      readonly chave: string;
      readonly ano: number;
      readonly inicio: string;
      readonly fim: string;
      /** `"2025"` — o rótulo do período, pela mesma função da capa. */
      readonly rotulo: string;
      readonly tiras: readonly TiraDoAno[];
    }
  /** Uma fileira de até {@link COLUNAS_DA_PAREDE} capas de mês. */
  | { readonly tipo: 'linha'; readonly chave: string; readonly ladrilhos: readonly LadrilhoDaParede[] };

export interface OpcoesDaParede {
  /** O relógio de quem monta — é dele que sai o `offset` de cada ladrilho. */
  readonly now: Date;
  /**
   * Os cadernos que o dono não silenciou (Story 2.5). Ausente ⇒ os quatro, o
   * mesmo idioma de `OpcoesDaImpressao.cadernos`.
   */
  readonly visiveis?: readonly CadernoId[];
}

/** `month\0 2026-08-01\0 2026-08-31` — a chave de um período, sem separador ambíguo. */
function chaveDoPeriodo(tipo: string, inicio: string, fim: string): string {
  return `${tipo}\u0000${inicio}\u0000${fim}`;
}

/** Uma edição que vira ladrilho, com a capa carimbada já casada. */
interface EdicaoComCapa {
  readonly edicao: EdicaoNoArquivo;
  readonly capa: Capa | null;
}

/** O que a parede tem do acervo: os ladrilhos (meses) e os anuários (anos). */
interface AcervoRecortado {
  readonly ladrilhos: readonly EdicaoComCapa[];
  readonly anuarios: readonly EdicaoNoArquivo[];
}

/**
 * **A regra do que entra na parede, escrita uma vez** — e a razão de ela existir
 * separada de {@link montarParede}.
 *
 * Dois consumidores fazem a mesma pergunta por caminhos diferentes: a montagem
 * desenha os ladrilhos, e {@link ponteirosDaParede} decide que fotos e que rotas
 * buscar para eles. Enquanto cada um repetia o filtro, o modo de falha era mudo e
 * certo: no dia em que o trimestre entrasse na parede, um desenharia o ladrilho e
 * o outro não buscaria a foto dele — um quadro cinza para sempre, sem erro
 * nenhum. Aqui a regra é uma, e um teste comparativo cobra que os dois a leiam.
 *
 * O mapa de capas é construído **uma vez por chamada**, e não por ladrilho.
 */
function recortarAcervo(acervo: AcervoDaParede): AcervoRecortado {
  const capaDe = new Map<string, Capa>();
  for (const c of acervo.capas) capaDe.set(chaveDoPeriodo(c.tipoPeriodo, c.inicio, c.fim), c);

  const ladrilhos: EdicaoComCapa[] = [];
  const anuarios: EdicaoNoArquivo[] = [];
  for (const e of acervo.arquivo) {
    if (e.tipoPeriodo !== TIPO_DO_LADRILHO && e.tipoPeriodo !== TIPO_DO_ANUARIO) continue;
    // Impossível pela coluna `date` do Postgres, e por isso **não lança**: a
    // montagem roda dentro do render, e uma exceção aqui seria a parede inteira
    // caindo por uma linha. Sai da parede, e o motivo vai para o log.
    if (anoDoInicio(e.inicio) === null) {
      console.warn(
        `[revista] período com início ilegível fora da parede: ${e.tipoPeriodo} ${JSON.stringify(e.inicio)}.`,
      );
      continue;
    }
    if (e.tipoPeriodo === TIPO_DO_ANUARIO) anuarios.push(e);
    else ladrilhos.push({ edicao: e, capa: capaDe.get(chaveDoPeriodo(e.tipoPeriodo, e.inicio, e.fim)) ?? null });
  }
  return { ladrilhos, anuarios };
}

/** Por que a parede está vazia — duas causas, e a tela diz frases diferentes. */
export type MotivoDoVazio =
  /** Nada foi impresso ainda. */
  | 'sem-edicao'
  /** Há edições, mas nenhuma que a parede desenhe: só semanas e trimestres. */
  | 'sem-ladrilho';

/**
 * Por que a parede saiu vazia (Story 2.4b).
 *
 * *Nada impresso* e *nada que a parede desenhe* são coisas diferentes, e dizer a
 * primeira frase no segundo caso é mentir: o dono que imprimiu doze semanas leria
 * "nenhuma edição foi escrita ainda" com doze edições no banco, e concluiria que
 * a impressão não funcionou.
 *
 * Só faz sentido quando {@link montarParede} devolveu lista vazia — é a resposta
 * à pergunta *por quê*, não a *se*.
 */
export function motivoDoVazio(acervo: AcervoDaParede): MotivoDoVazio {
  return acervo.arquivo.length === 0 ? 'sem-edicao' : 'sem-ladrilho';
}

/** O ano de um início `YYYY-MM-DD`, ou `null` se a data não se lê. */
function anoDoInicio(inicio: string): number | null {
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(inicio);
  return m ? Number(m[1]) : null;
}

/** O mês (0–11) de um início `YYYY-MM-DD`, ou `null` se a data não se lê. */
function mesDoInicio(inicio: string): number | null {
  const m = /^\d{4}-(\d{2})-\d{2}$/.exec(inicio);
  if (!m) return null;
  const mes = Number(m[1]) - 1;
  return mes >= 0 && mes < MESES_DO_ANO ? mes : null;
}

/**
 * A parede, montada — **a ordem é do arquivo de uma revista**: o ano decrescente;
 * dentro dele o anuário primeiro, porque as quatro tiras *são* a capa do ano; e
 * depois os meses, do mais recente para o mais antigo.
 *
 * Quem abre a parede está em agosto de 2026 e desce no tempo. Quando cruza para
 * 2025, a régua anuncia o ano, o anuário o resume, e os doze meses vêm abaixo —
 * dezembro primeiro. É a mesma direção do dedo do começo ao fim, e é ela que faz
 * a mudança de textura na fronteira dos anos ser **o assunto da tela**.
 *
 * O que fica de fora, e por quê:
 *
 * - **período sem edição** — a parede é o arquivo do que foi impresso, e *abrir
 *   só lê*: um ladrilho vazio convidando a imprimir poria o ato pago numa lista
 *   de miniaturas, que é exatamente o que a 1.11 tirou do cartão;
 * - **semana e trimestre** — ver o cabeçalho do módulo;
 * - **capa órfã** — uma capa cuja edição não está no arquivo não vira nada. As
 *   duas tabelas não têm chave estrangeira entre si (o carimbo guarda valor, não
 *   ponteiro), então uma capa sobrevive aos cadernos que cobria; desenhá-la seria
 *   um ladrilho bonito que abre uma edição que não existe mais;
 * - **período com data ilegível** — impossível pela coluna `date` do Postgres, e
 *   por isso não derruba a tela: ele sai da parede e o motivo vai para o log. Uma
 *   exceção aqui seria lançada dentro do render.
 */
export function montarParede(
  acervo: AcervoDaParede,
  opcoes: OpcoesDaParede,
): ItemDaParede[] {
  const visiveis = opcoes.visiveis ?? CADERNO_IDS;
  const { ladrilhos: doAcervo, anuarios } = recortarAcervo(acervo);

  const textoDe = new Map<string, TextosDaEdicao>();
  for (const t of acervo.textos) textoDe.set(chaveDoPeriodo(t.tipoPeriodo, t.inicio, t.fim), t);

  /** ano → o que a parede tem dele. */
  const porAno = new Map<number, { anuario: EdicaoNoArquivo | null; meses: EdicaoComCapa[] }>();
  const doAno = (ano: number) => {
    let a = porAno.get(ano);
    if (!a) {
      a = { anuario: null, meses: [] };
      porAno.set(ano, a);
    }
    return a;
  };
  // `anoDoInicio` já foi conferido no recorte: aqui ele não volta nulo.
  for (const a of anuarios) doAno(anoDoInicio(a.inicio) ?? 0).anuario = a;
  for (const l of doAcervo) doAno(anoDoInicio(l.edicao.inicio) ?? 0).meses.push(l);

  const itens: ItemDaParede[] = [];
  for (const ano of [...porAno.keys()].sort((a, b) => b - a)) {
    const { anuario, meses } = porAno.get(ano)!;
    itens.push({ tipo: 'regua', chave: `regua|${ano}`, ano });
    if (anuario) {
      itens.push({
        tipo: 'anuario',
        // Pelo período inteiro, e não só pelo início: a chave primária admite dois
        // anos com o mesmo `inicio` e `fim` diferente, e chave repetida numa
        // `FlatList` desenha uma célula no lugar da outra, calada.
        chave: `anuario|${chaveDoPeriodo(anuario.tipoPeriodo, anuario.inicio, anuario.fim)}`,
        ano,
        inicio: anuario.inicio,
        fim: anuario.fim,
        rotulo: rotuloDaEdicao(TIPO_DO_ANUARIO, anuario.inicio),
        tiras: tirasDoAno(acervo.arquivo, ano),
      });
    }
    // Do mais recente para o mais antigo. Dentro de um ano o início é ordenável
    // como texto — todos têm o mesmo `YYYY-` na frente —, e o `fim` desempata as
    // duas edições que comecem no mesmo dia.
    const ordenados = [...meses].sort((a, b) => cmpDesc(
      `${a.edicao.inicio}\u0000${a.edicao.fim}`,
      `${b.edicao.inicio}\u0000${b.edicao.fim}`,
    ));
    const ladrilhos = ordenados.map((l) => ladrilhoDe(l, textoDe, visiveis, opcoes.now));
    for (let i = 0; i < ladrilhos.length; i += COLUNAS_DA_PAREDE) {
      const fileira = ladrilhos.slice(i, i + COLUNAS_DA_PAREDE);
      itens.push({ tipo: 'linha', chave: `linha|${fileira[0].chave}`, ladrilhos: fileira });
    }
  }
  return itens;
}

/** Decrescente, estável e sem `localeCompare` — a ordem é de texto ASCII. */
function cmpDesc(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

/* ── os ponteiros que a parede busca fora ────────────────────────────────── */

/**
 * O que a parede precisa buscar **fora** das tabelas da revista — os ponteiros
 * que as capas carimbaram (Story 2.4b).
 *
 * `edicoes_capa` guarda **valor, nunca geometria e nunca imagem**: a capa de foto
 * guarda a atividade e o id da linha da foto; a de traçado, a atividade da rota.
 * Desenhar exige o ponteiro de hoje, e é isso que estas duas listas alimentam —
 * uma chamada cada, nunca uma por célula.
 */
export interface PonteirosDaParede {
  /**
   * `activity_photos.id` das capas de foto — o que `fetchPhotosByIds` lê.
   *
   * **Por id, e não pela atividade.** Perguntar pelas atividades traria todas as
   * fotos das pedaladas para escolher uma por capa, e ainda deixaria de fora a
   * que o dono desligou depois do carimbo — que continua sendo a capa. Ver o
   * TSDoc de `fetchPhotosByIds`.
   */
  readonly fotos: readonly string[];
  /** `activities.id` das capas de traçado — o que `fetchRouteOverviewPairs` lê. */
  readonly rotas: readonly string[];
}

/**
 * Os ponteiros dos ladrilhos que a parede **vai ter** — o mesmo cruzamento de
 * {@link montarParede}, e por isso mora ao lado dele.
 *
 * Varrer as capas direto pareceria mais simples e traria mais: capa órfã (a
 * edição saiu, o carimbo ficou), capa de semana, capa de trimestre — todas fora
 * da parede, e todas custando linha na consulta. Aqui o recorte é **o mesmo** de
 * {@link montarParede}, por construção (`recortarAcervo`), e um teste comparativo
 * o cobra: sem isso, o dia em que o trimestre entrasse na parede desenharia um
 * ladrilho cuja foto ninguém buscou.
 *
 * Sem `now`, de propósito: o que se busca não depende do relógio. Deduplicado,
 * porque duas capas podem apontar para a mesma atividade — e, no caso das fotos,
 * porque a mesma foto pode ser capa de dois períodos. Em ordem, para a lista ser
 * estável entre leituras.
 */
export function ponteirosDaParede(acervo: AcervoDaParede): PonteirosDaParede {
  const fotos = new Set<string>();
  const rotas = new Set<string>();
  // **O mesmo recorte de `montarParede`**, e não um filtro paralelo: ver
  // `recortarAcervo`. É isto que garante que todo ladrilho desenhado tenha o
  // ponteiro dele buscado.
  for (const { capa } of recortarAcervo(acervo).ladrilhos) {
    if (!capa) continue;
    if (capa.natureza === 'foto' && capa.fotoId) fotos.add(capa.fotoId);
    if (capa.natureza === 'tracado' && capa.rotaActivityId) rotas.add(capa.rotaActivityId);
  }
  return {
    fotos: [...fotos].sort(),
    rotas: [...rotas].sort(),
  };
}

function ladrilhoDe(
  { edicao: e, capa }: EdicaoComCapa,
  textoDe: ReadonlyMap<string, TextosDaEdicao>,
  visiveis: readonly CadernoId[],
  now: Date,
): LadrilhoDaParede {
  const chave = chaveDoPeriodo(e.tipoPeriodo, e.inicio, e.fim);
  const rotulo = rotuloDaEdicao(e.tipoPeriodo, e.inicio);
  return {
    tipoPeriodo: e.tipoPeriodo,
    inicio: e.inicio,
    fim: e.fim,
    chave,
    rotulo,
    manchete: mancheteDe(textoDe.get(chave), visiveis),
    capa,
    legenda: legendaQueAcrescenta(capa?.legenda ?? null, rotulo),
    offset: offsetDoInicio(now, e.tipoPeriodo, e.inicio),
  };
}

/**
 * A chamada do **primeiro caderno visível** — que é a manchete.
 *
 * `cadernos` chega ordenado por `posicao`, e a manchete é a chamada da primeira
 * linha que o dono não silenciou. Posição lida, nunca recalculada.
 *
 * **Não é `find(c => c.posicao === 1)`, e a diferença é a Story 2.5 inteira**:
 * procurar pelo VALOR 1 devolve `undefined` quando o líder está silenciado, e o
 * ladrilho ficaria mudo enquanto três cadernos visíveis falam dentro dele. O
 * buraco na numeração é esperado — silenciar nunca escreve, então a `posicao`
 * gravada não muda; quem pula o buraco é a leitura.
 *
 * É a mesma regra do `chamadaDaCapa` da store do celular, e o corte da frase é da
 * mesma `chamadaDoTexto`, que é dona única dela.
 */
function mancheteDe(
  textos: TextosDaEdicao | undefined,
  visiveis: readonly CadernoId[],
): string | null {
  return chamadaDoTexto(textos?.cadernos.find((c) => visiveis.includes(c.caderno))?.texto);
}
