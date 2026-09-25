/**
 * Acesso à tabela `edicoes_ia` — dono único (AD-4).
 * Spec: docs/specs/ia-analitica/spec.md · ADRs 0038 e 0040 · Story 1.9.
 *
 * **A edição é uma linha por CADERNO**, não por período. A chave é
 * `(user_id, tipo_periodo, inicio, fim, caderno)` e a ordem do miolo é a coluna
 * `posicao` — coluna, e não array, porque um array com a ordem do conjunto
 * guardado em cada parte é uma chance de divergir por linha.
 *
 * Este módulo só lê e grava linhas: quem decide *se* um período merece edição é
 * o `periodoFechado` (`period/fechado.ts`), quem decide se um texto pode virar
 * edição é a conferência do descritor, percorrida pelo orquestrador, e quem
 * decide a ORDEM é o `ordenarCadernos` (`ia/ranqueamento.ts`) — na impressão
 * (`ia/imprimir.ts`), uma vez, e nunca no caminho de leitura. A leitura tira a ordem de `posicao` e pronto; se ela
 * recalculasse, ajustar um peso do ranqueamento em novembro reordenaria agosto
 * sozinho, que é reescrita silenciosa de período fechado.
 *
 * A leitura de **um** período (`fetchEdicao`) não pagina de propósito: são até
 * quatro linhas. A do **arquivo inteiro** ({@link fetchArquivoDeEdicoes}, Story
 * 2.3) pagina, e tem de paginar: são ~68 períodos por ano (52 semanas + 12 meses
 * + 4 estações) e até quatro cadernos em cada, então o teto de 1000 linhas do
 * PostgREST é alcançado por volta do quarto ano — calado.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { AGG_VERSION } from '../constants/agg-version';
import type { LinhaDaImpressao, PeriodoDaEdicao, PortasDaImpressao } from '../ia/imprimir';
import { CADERNO_IDS, isCadernoId, type CadernoId } from '../period/cadernos';
import type { PeriodKind } from '../period/bounds';
import { fetchAllPages } from './paginate';

/**
 * Os tipos de período que **podem** ter edição — a mesma lista do CHECK de
 * `tipo_periodo`, nas duas tabelas, cobrada pelo `architecture.test.ts`.
 *
 * `all` fica de fora porque período que nunca fecha não tem edição, por
 * definição. A consequência é de tela e não é detalhe: o Total não é um período
 * "ainda não escrito", é um período que **nunca** terá linha — e anunciar
 * pendência nele seria prometer uma edição que não pode existir.
 */
export type TipoComEdicao = Exclude<PeriodKind, 'all'>;

export const TIPOS_COM_EDICAO: readonly TipoComEdicao[] =
  Object.freeze(['week', 'month', 'season', 'year']);

export function temEdicao(kind: PeriodKind): kind is TipoComEdicao {
  return (TIPOS_COM_EDICAO as readonly string[]).includes(kind);
}

export function isTipoComEdicao(v: unknown): v is TipoComEdicao {
  return typeof v === 'string' && (TIPOS_COM_EDICAO as readonly string[]).includes(v);
}

/**
 * Linha como o PostgREST a devolve (snake_case).
 *
 * **`tipo_periodo` e `caderno` são `string` aqui de propósito, e só aqui.** Esta
 * interface descreve o que chega do fio, não o que o domínio aceita: apertá-la
 * para a união seria afirmar, no sistema de tipos, uma garantia que o transporte
 * não dá — e, pior, tornaria desnecessária a conferência que `toCadernoImpresso`
 * faz. É a mesma escolha de `CapaRow.natureza`, pelo mesmo motivo. O aperto vive
 * do outro lado da fronteira: em {@link CadernoImpresso}, na linha da impressão
 * e nos parâmetros, onde `'mounth'` deixa de compilar.
 */
export interface EdicaoRow {
  user_id: string;
  tipo_periodo: string;
  inicio: string;
  fim: string;
  caderno: string;
  posicao: number;
  texto: string;
  provedor: string;
  modelo: string;
  prompt_versao: number;
  pacote_versao: number;
  motivo_de_parada: string;
  tokens_entrada: number;
  tokens_saida: number;
  agg_version_no_momento: number;
  metrica_lider: string | null;
  gerado_em: string;
}

/**
 * Um caderno impresso — uma linha de `edicoes_ia`, com assinatura própria.
 *
 * A assinatura é por linha porque a errata é por linha: o caderno de Sono fica
 * velho sem tocar no de Movimento.
 */
export interface CadernoImpresso {
  tipoPeriodo: TipoComEdicao;
  inicio: string;
  fim: string;
  caderno: CadernoId;
  /** 1 a N sobre os cadernos que a edição TEM. Congelada na última impressão. */
  posicao: number;
  texto: string;
  /** A linha de crédito (ADR 0040) — quem escreveu, com o quê, quando. */
  provedor: string;
  modelo: string;
  promptVersao: number;
  pacoteVersao: number;
  aggVersionNoMomento: number;
  /**
   * A chave da métrica que liderou o ranqueamento (AD-17), ou `null`.
   *
   * **Nulo é declaração, não omissão**: "nenhuma métrica liderou" — o caderno
   * entrou pela lápide, ou nada dele passou no portão de amostra. O anuário do
   * Épico 3 lê isso como lacuna declarada; uma sentinela inventaria uma chave
   * que não existe.
   */
  metricaLider: string | null;
  geradoEm: string;
}

/**
 * A edição de um período: os cadernos que ela tem, **na ordem gravada**.
 *
 * Vazia quer dizer "ainda não impressa". Nunca são necessariamente quatro — 22
 * dos 39 meses do backfill têm um caderno só.
 */
export type Edicao = readonly CadernoImpresso[];

/**
 * As colunas pedidas ao PostgREST.
 *
 * Uma coluna esquecida aqui não é erro: é `undefined` chegando ao mapeamento e
 * seguindo para a tela. `edicoes-ia.test.ts` compara esta lista com as chaves de
 * {@link EdicaoRow} e projeta as linhas do fake por ela, para que esquecer
 * `caderno`, `posicao` ou `metrica_lider` reprove em vez de passar verde.
 */
export const EDICAO_COLUMNS = 'user_id,tipo_periodo,inicio,fim,caderno,posicao,texto,provedor,modelo,'
  + 'prompt_versao,pacote_versao,motivo_de_parada,tokens_entrada,tokens_saida,'
  + 'agg_version_no_momento,metrica_lider,gerado_em';

const COLUMNS = EDICAO_COLUMNS;

/**
 * Linha do Postgres → caderno. **Conferido, não convertido por `as`.**
 *
 * Simétrico ao `toCapa` do módulo irmão, e pelo mesmo argumento escrito lá: os
 * CHECKs tornam o valor desconhecido impossível, o que faz do cast a escrita mais
 * tentadora e a pior. No dia em que um CHECK for afrouxado — ou em que a linha
 * vier de outro lugar, um backfill, um `psql` à mão —, o valor estranho atravessa
 * até a tela e o sintoma aparece longe daqui: um caderno sem nome, uma edição que
 * não desenha. Explodir alto na fronteira é o comportamento certo para um estado
 * que o banco afirma não existir.
 *
 * A entrega anterior escrevia `r.caderno as CadernoId` — exatamente o cast que o
 * módulo irmão recusa por escrito, na mesma entrega.
 */
export function toCadernoImpresso(r: EdicaoRow): CadernoImpresso {
  if (!isCadernoId(r.caderno)) {
    throw new Error(
      `caderno desconhecido: ${JSON.stringify(r.caderno)} — os quatro são `
      + `${CADERNO_IDS.join(', ')}, e o CHECK de edicoes_ia.caderno deveria ter recusado este.`,
    );
  }
  if (!isTipoComEdicao(r.tipo_periodo)) {
    throw new Error(
      `tipo de período sem edição possível: ${JSON.stringify(r.tipo_periodo)} — os quatro são `
      + `${TIPOS_COM_EDICAO.join(', ')}, e o CHECK de edicoes_ia.tipo_periodo deveria ter recusado este.`,
    );
  }
  return {
    tipoPeriodo: r.tipo_periodo,
    inicio: r.inicio,
    fim: r.fim,
    caderno: r.caderno,
    posicao: r.posicao,
    texto: r.texto,
    provedor: r.provedor,
    modelo: r.modelo,
    promptVersao: r.prompt_versao,
    pacoteVersao: r.pacote_versao,
    aggVersionNoMomento: r.agg_version_no_momento,
    metricaLider: r.metrica_lider,
    geradoEm: r.gerado_em,
  };
}

/**
 * A edição de um período — os cadernos impressos, ordenados por `posicao`.
 *
 * **Sem `maybeSingle`, e isso é o ponto da Story 1.9.** Enquanto a chave era o
 * período, uma linha era o máximo possível; com o caderno na chave, o mesmo
 * período casa até quatro e `.maybeSingle()` passa a lançar PGRST116 — quebrando
 * a tela **ao abrir**, não só ao gravar.
 *
 * A ordem vem do banco, não de `ordenarCadernos`: ela congelou na impressão.
 */
export async function fetchEdicao(
  db: SupabaseClient,
  userId: string,
  tipoPeriodo: TipoComEdicao,
  inicio: string,
  fim: string,
): Promise<CadernoImpresso[]> {
  const { data, error } = await db
    .from('edicoes_ia')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('tipo_periodo', tipoPeriodo)
    .eq('inicio', inicio)
    .eq('fim', fim)
    .order('posicao', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as EdicaoRow[]).map(toCadernoImpresso);
}

/* ── o arquivo inteiro (Story 2.3) ───────────────────────────────────────── */

/**
 * Uma linha do arquivo, como o PostgREST a devolve — o recorte de
 * {@link EdicaoRow} que {@link ARQUIVO_COLUMNS} pede.
 *
 * Declarada como `Pick`, e não à mão: é o que faz o teste "pede exatamente as
 * colunas que a linha tem" valer para o arquivo como já valia para a edição —
 * uma coluna na string e fora do tipo (ou o contrário) para de compilar aqui.
 */
export type ArquivoRow = Pick<
  EdicaoRow,
  'tipo_periodo' | 'inicio' | 'fim' | 'caderno' | 'posicao' | 'prompt_versao' | 'pacote_versao'
>;

/** Um caderno no arquivo, sem o texto — o que {@link fetchArquivoDeEdicoes} traz. */
export interface CadernoNoArquivo {
  readonly caderno: CadernoId;
  readonly posicao: number;
  /**
   * A versão do **prompt** com que este caderno foi escrito.
   *
   * As duas versões estão aqui porque elas respondem a perguntas diferentes, e a
   * impressão em massa faz as duas (Story 2.8): `pacoteVersao` separa a edição
   * antiga da já reimpressa numa campanha de **números** (a 2.6 mudou o que o
   * pacote carrega); `promptVersao` separa o caderno escrito com o texto de
   * antes do escrito com o de hoje, que é o critério de uma campanha de
   * **palavras** — a concordância de `1 dias` mudou o prompt e não tocou num
   * número sequer.
   */
  readonly promptVersao: number;
  /**
   * A versão do pacote com que este caderno foi escrito.
   *
   * É o que separa uma edição **antiga** de uma já reimpressa: as onze edições
   * do arquivo em 23/09/2026 estão todas no pacote 3, e a 2.6 levou o pacote a
   * 4. Quem decide o que fazer com isso é o hospedeiro da impressão em massa.
   */
  readonly pacoteVersao: number;
}

/** Uma edição do arquivo, em forma reduzida: a chave e os cadernos que ela tem. */
export interface EdicaoNoArquivo {
  readonly tipoPeriodo: TipoComEdicao;
  readonly inicio: string;
  readonly fim: string;
  /** Na ordem gravada (`posicao`). Nunca vazio: uma edição sem caderno não tem linha. */
  readonly cadernos: readonly CadernoNoArquivo[];
}

/**
 * As colunas do arquivo — **sem o `texto`**, que é o grosso da linha e não serve
 * para decidir o que imprimir. Quem quer o texto de uma edição chama
 * {@link fetchEdicao} para aquele período.
 *
 * Mesma guarda de {@link EDICAO_COLUMNS}: `edicoes-ia.test.ts` compara esta
 * string com as chaves de {@link ArquivoRow} e projeta as linhas do fake por
 * ela. Uma coluna esquecida aqui não é erro — é `undefined` chegando ao
 * agrupamento, e os dois casos custam dinheiro em direções opostas:
 *
 * - `pacote_versao` indefinido faz toda edição parecer **não reimpressa**
 *   (`undefined > 3` é falso), e a campanha da 2.3 pagaria quatro chamadas por
 *   período já renovado;
 * - `prompt_versao` indefinido é **pior**: `undefined >= 6` também é falso, e aí
 *   toda edição do arquivo parece atrasada — a campanha de um caderno (2.8)
 *   pagaria uma chamada por período, em todos eles, sem nada ter mudado.
 *
 * Por isso {@link fetchArquivoDeEdicoes} não confia na coluna: as duas versões
 * passam por `Number.isInteger` na mesma varredura que confere `caderno` e
 * `tipo_periodo`, e uma linha estragada explode alto em vez de virar uma corrida.
 */
export const ARQUIVO_COLUMNS = 'tipo_periodo,inicio,fim,caderno,posicao,prompt_versao,pacote_versao';

/**
 * **Todas** as edições do usuário, agrupadas por período e em ordem cronológica
 * — o inventário que a impressão em massa cruza com os períodos fechados
 * (Story 2.3).
 *
 * Ao contrário de {@link fetchEdicao}, que lê um período, esta leitura **cresce
 * com o tempo**: são ~68 períodos por ano e até quatro cadernos em cada, e o
 * teto de 1000 linhas do PostgREST é alcançado por volta do quarto ano — sem
 * erro nenhum, com linhas faltando em ordem indefinida. Por isso passa por
 * `fetchAllPages` com **ordenação total**: `(inicio, tipo_periodo, fim,
 * caderno)` cobre a chave primária menos o `user_id`, que está fixo no filtro —
 * são as mesmas quatro colunas da chave, noutra ordem de leitura, e é a
 * unicidade delas que torna a ordem total.
 *
 * A ordem devolvida é a do arquivo — pelo `inicio`, e dentro dele pelo tipo —,
 * não a da impressão: quem ordena a corrida é `periodosFechadosDesde`
 * (`period/periodos.ts`), pelo fim do período.
 */
export async function fetchArquivoDeEdicoes(
  db: SupabaseClient,
  userId: string,
): Promise<EdicaoNoArquivo[]> {
  const linhas = await fetchAllPages<ArquivoRow>(
    (lo, hi) =>
      db
        .from('edicoes_ia')
        .select(ARQUIVO_COLUMNS)
        .eq('user_id', userId)
        .order('inicio', { ascending: true })
        .order('tipo_periodo', { ascending: true })
        .order('fim', { ascending: true })
        .order('caderno', { ascending: true })
        .range(lo, hi),
  );
  const porPeriodo = new Map<string, { chave: EdicaoNoArquivo; cadernos: CadernoNoArquivo[] }>();
  const ordem: string[] = [];
  for (const r of linhas) {
    // Conferido, nunca convertido por `as` — o mesmo argumento de `toCadernoImpresso`.
    if (!isCadernoId(r.caderno)) {
      throw new Error(
        `caderno desconhecido no arquivo: ${JSON.stringify(r.caderno)} — os quatro são ${CADERNO_IDS.join(', ')}.`,
      );
    }
    if (!isTipoComEdicao(r.tipo_periodo)) {
      throw new Error(
        `tipo de período sem edição possível no arquivo: ${JSON.stringify(r.tipo_periodo)} — os quatro são `
        + `${TIPOS_COM_EDICAO.join(', ')}.`,
      );
    }
    // As duas versões são **números que decidem gasto**, e uma coluna ausente
    // (ou um `null` da tabela) chegaria aqui como `undefined` e faria toda
    // comparação de versão ser falsa — a corrida pagaria o arquivo inteiro
    // achando que nada foi renovado. Conferido, nunca convertido: mesmo
    // argumento de `caderno` e `tipo_periodo`, logo acima.
    for (const [coluna, valor] of [['prompt_versao', r.prompt_versao], ['pacote_versao', r.pacote_versao]] as const) {
      if (!Number.isInteger(valor)) {
        throw new Error(
          `${coluna} não é inteiro no arquivo (${r.tipo_periodo} ${r.inicio}, caderno ${r.caderno}): `
          + `${JSON.stringify(valor)}. É por estes números que a impressão em massa decide o que reimprimir.`,
        );
      }
    }
    const chave = `${r.tipo_periodo}\u0000${r.inicio}\u0000${r.fim}`;
    let grupo = porPeriodo.get(chave);
    if (!grupo) {
      const cadernos: CadernoNoArquivo[] = [];
      grupo = { chave: { tipoPeriodo: r.tipo_periodo, inicio: r.inicio, fim: r.fim, cadernos }, cadernos };
      porPeriodo.set(chave, grupo);
      ordem.push(chave);
    }
    grupo.cadernos.push({
      caderno: r.caderno,
      posicao: r.posicao,
      promptVersao: r.prompt_versao,
      pacoteVersao: r.pacote_versao,
    });
  }
  for (const grupo of porPeriodo.values()) grupo.cadernos.sort((a, b) => a.posicao - b.posicao);
  return ordem.map((c) => porPeriodo.get(c)!.chave);
}

/**
 * Uma linha da carga de `edicao_imprimir` — as colunas do `jsonb_to_recordset`
 * da função, na grafia do banco.
 *
 * `edicoes-ia.test.ts` compara estas chaves com o recordset **lido da
 * migração**: uma coluna que a função passe a exigir e que falte aqui reprova lá,
 * e não em produção com "linha recusada".
 */
export interface LinhaDaCarga {
  caderno: CadernoId;
  texto: string;
  provedor: string;
  modelo: string;
  prompt_versao: number;
  pacote_versao: number;
  motivo_de_parada: string;
  tokens_entrada: number;
  tokens_saida: number;
  agg_version_no_momento: number;
  metrica_lider: string | null;
}

/** A linha que a sequência entregou, virada carga — com a versão da agregação carimbada aqui. */
function paraCarga(l: LinhaDaImpressao): LinhaDaCarga {
  return {
    caderno: l.caderno,
    texto: l.texto,
    provedor: l.provedor,
    modelo: l.modelo,
    prompt_versao: l.promptVersao,
    pacote_versao: l.pacoteVersao,
    motivo_de_parada: l.motivoDeParada,
    tokens_entrada: l.tokensEntrada,
    tokens_saida: l.tokensSaida,
    agg_version_no_momento: AGG_VERSION,
    // Escrito mesmo quando nulo: a função recusa a linha sem a chave.
    metrica_lider: l.metricaLider,
  };
}

/**
 * A conta trocou entre o começo da impressão e a gravação: a sessão do client não é
 * mais de quem a impressão leu. Nada foi gravado. Ver {@link portasDaEdicao}.
 */
export class ContaTrocadaNaImpressao extends Error {
  constructor(esperado: string, naSessao: string | null) {
    super(
      `a impressão começou para ${esperado} e a sessão agora é de ${naSessao ?? 'ninguém'} — `
      + 'nada foi gravado, para o texto de um dono não cair na edição de outro',
    );
    this.name = 'ContaTrocadaNaImpressao';
  }
}

/** "month 2026-08-01 a 2026-08-31". */
function periodoEmTexto(p: PeriodoDaEdicao): string {
  return `${p.tipoPeriodo} ${p.inicio} a ${p.fim}`;
}

/**
 * A porta não pode gravar sobre o que a impressão leu: os cadernos do período
 * mudaram entre o `buscar` e o `gravar`, o `gravar` pediu outro período, ou não
 * houve `buscar` para este `gravar` (nenhum, ou um que outra gravação já usou).
 *
 * **Não afirma a causa.** A edição que mudou pode ter sido impressa por outro
 * hospedeiro, ou apagada, ou alterada pelo próprio telefone — a porta só vê que o
 * conjunto de agora não é o que ela leu. Nada foi gravado, e nada foi apagado.
 *
 * - `vistos`: os cadernos que `buscar` devolveu — `null` quando não houve `buscar`.
 * - `agora`: os que a releitura achou — `null` quando não chegou a reler.
 * - `periodoLido`: o período do `buscar`, quando o `gravar` pediu outro; senão `null`.
 */
export class EdicaoMudouNaImpressao extends Error {
  readonly vistos: readonly CadernoId[] | null;
  readonly agora: readonly CadernoId[] | null;
  readonly periodoLido: PeriodoDaEdicao | null;

  constructor(
    vistos: readonly CadernoId[] | null,
    agora: readonly CadernoId[] | null,
    periodoTrocado: { readonly lido: PeriodoDaEdicao; readonly pedido: PeriodoDaEdicao } | null = null,
  ) {
    const lista = (cs: readonly CadernoId[]) => (cs.length === 0 ? 'nenhum' : cs.join(', '));
    super(
      vistos === null
        ? 'gravar veio sem buscar antes — a porta não sabe que cadernos a impressão viu, e nada foi gravado'
        : periodoTrocado !== null
          ? `gravar pediu ${periodoEmTexto(periodoTrocado.pedido)}, e o buscar leu ${periodoEmTexto(periodoTrocado.lido)} — `
            + 'a porta só grava o período que a impressão leu, e nada foi gravado'
          : `os cadernos deste período mudaram entre a leitura e a gravação (lidos: ${lista(vistos)}; agora: `
            + `${lista(agora ?? [])}) — outro hospedeiro imprimiu ou apagou, e nada foi gravado`,
    );
    this.name = 'EdicaoMudouNaImpressao';
    this.vistos = vistos;
    this.agora = agora;
    this.periodoLido = periodoTrocado?.lido ?? null;
  }
}

/** O conjunto de cadernos, como lista ordenada pelo catálogo — comparável por igualdade. */
function conjuntoDe(cadernos: readonly { readonly caderno: CadernoId }[]): CadernoId[] {
  const presentes = new Set(cadernos.map((c) => c.caderno));
  return CADERNO_IDS.filter((c) => presentes.has(c));
}

function mesmoConjunto(a: readonly CadernoId[], b: readonly CadernoId[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

function mesmoPeriodo(a: PeriodoDaEdicao, b: PeriodoDaEdicao): boolean {
  return a.tipoPeriodo === b.tipoPeriodo && a.inicio === b.inicio && a.fim === b.fim;
}

/**
 * As portas da edição. O `buscar` daqui devolve os cadernos **inteiros** — o
 * `PortasDaImpressao` só promete o `caderno` de cada um, porque é só isso que a
 * sequência lê; o hospedeiro que quiser comparar assinaturas (o `--sem-gravar` do
 * script) lê o resto daqui.
 */
export interface PortasDaEdicao extends PortasDaImpressao<CadernoImpresso[]> {
  buscar(periodo: PeriodoDaEdicao): Promise<CadernoImpresso[]>;
}

/**
 * As duas portas da impressão, ligadas a um cliente — é o que o hospedeiro passa
 * a `imprimir` (`ia/imprimir.ts`).
 *
 * - **`buscar`** é `fetchEdicao`: os cadernos já impressos do período, na ordem
 *   gravada. É por ele que a sequência não apaga o texto de um caderno cuja
 *   regeneração caiu no piso.
 * - **`gravar`** é a função `edicao_imprimir`, numa chamada, com o conjunto
 *   inteiro. Ela grava o texto dos regenerados, ajusta a posição de todos e apaga
 *   o caderno que saiu (AD-4) — a única escrita em `edicoes_ia` que existe. A
 *   linha devolvida é a edição relida, mapeada por `toCadernoImpresso`.
 *
 * **Não há mais porta de escrita direta.** O `upsertEdicao` da 1.9 gravava um
 * caderno por vez, contornando a função e a contiguidade das posições, e saiu na
 * 1.10. Uma barreira do `architecture.test.ts` cobra que `edicao_imprimir` só
 * seja nomeada aqui, que nenhum `.upsert/.insert/.update/.delete` alcance
 * `edicoes_ia`, e que `.gravar` só seja lido pela sequência.
 *
 * **A versão da agregação é lida aqui, nunca recebida.** Ela chegava por quatro
 * passagens opcionais em fila (tela → store → adaptador → campo) e o que chegava
 * era `undefined`: as 7 edições antigas tinham nulo na coluna, e nenhuma era
 * elegível a errata. Tornar a passagem obrigatória fecharia a *omissão* e deixaria
 * aberto o *valor errado* — `PACOTE_VERSAO` é `number`, sai do mesmo barril e
 * compilaria no lugar dela. A linha da sequência não tem o campo, e a carga o
 * carimba de `AGG_VERSION` no ponto de gravação; uma barreira cobra que o literal
 * da coluna não apareça em código fora de `data/`.
 *
 * **O dono é conferido antes de gravar.** `buscar` lê com o `userId` passado, e a
 * função grava para `auth.uid()` — a sessão do cliente no instante do `rpc`. Uma
 * impressão leva um minuto ou mais, e se a conta trocar nesse meio o texto
 * escrito sobre os dados de um dono cairia na edição do outro. `gravar` relê a
 * sessão e, se ela não é mais de `userId`, lança {@link ContaTrocadaNaImpressao}
 * sem chamar a função.
 *
 * **O que a impressão leu também é conferido antes de gravar** (Story 2.2). A
 * sequência monta a `ordem` a partir do que `buscar` viu, e a função apaga todo
 * caderno fora da ordem. Entre o `buscar` e o `gravar` há uma chamada paga por
 * caderno — minutos —, e se a edição do período mudar nesse intervalo (o iPhone e
 * o script imprimem, desde a 2.2; o telefone também apaga), o caderno que apareceu
 * não está na ordem desta impressão e seria apagado. Por isso `buscar` guarda o
 * **período e o conjunto** que leu, e `gravar`, depois da conferência da conta,
 * recusa com {@link EdicaoMudouNaImpressao}, sem chamar a função, quando:
 *
 * - não houve `buscar` para este `gravar` — nenhum, ou um que uma gravação anterior
 *   já usou: **um `gravar` por `buscar`**, e o estado zera depois de um `rpc` que deu
 *   certo;
 * - o `gravar` pede outro período que não o lido — a ordem foi montada sobre outra
 *   edição;
 * - a releitura do período acha outro conjunto de cadernos.
 *
 * **Estreita a janela, não a fecha.** Ela vai de minutos para uma ida e volta ao
 * banco; fechá-la pede que a própria função receba o conjunto visto e recuse, que
 * é migração (deferred-work, a entrada da concorrência da 1.10). Só o conjunto
 * conta: um caderno regravado pelo outro hospedeiro, com o conjunto igual, não é
 * perdido — a função grava só o texto dos regenerados desta impressão.
 *
 * **Uma `portasDaEdicao` por impressão**, como os dois hospedeiros já fazem: o que
 * foi lido é estado da impressão.
 */
export function portasDaEdicao(db: SupabaseClient, userId: string): PortasDaEdicao {
  // O que a impressão leu — estado desta impressão, e por isso uma porta por impressão.
  let lido: { readonly periodo: PeriodoDaEdicao; readonly cadernos: readonly CadernoId[] } | null = null;
  return {
    buscar: async (p) => {
      const edicao = await fetchEdicao(db, userId, p.tipoPeriodo, p.inicio, p.fim);
      lido = { periodo: { tipoPeriodo: p.tipoPeriodo, inicio: p.inicio, fim: p.fim }, cadernos: conjuntoDe(edicao) };
      return edicao;
    },
    gravar: async (i) => {
      const sessao = await db.auth.getSession();
      if (sessao.error) throw sessao.error;
      const naSessao = sessao.data.session?.user?.id ?? null;
      if (naSessao !== userId) throw new ContaTrocadaNaImpressao(userId, naSessao);

      const visto = lido;
      if (visto === null) throw new EdicaoMudouNaImpressao(null, null);
      const pedido: PeriodoDaEdicao = { tipoPeriodo: i.tipoPeriodo, inicio: i.inicio, fim: i.fim };
      if (!mesmoPeriodo(visto.periodo, pedido)) {
        throw new EdicaoMudouNaImpressao(visto.cadernos, null, { lido: visto.periodo, pedido });
      }
      const agora = conjuntoDe(await fetchEdicao(db, userId, i.tipoPeriodo, i.inicio, i.fim));
      if (!mesmoConjunto(visto.cadernos, agora)) throw new EdicaoMudouNaImpressao(visto.cadernos, agora);

      const { data, error } = await db.rpc('edicao_imprimir', {
        p_tipo_periodo: i.tipoPeriodo,
        p_inicio: i.inicio,
        p_fim: i.fim,
        p_ordem: [...i.ordem],
        p_linhas: i.linhas.map(paraCarga),
      });
      if (error) throw error;
      // Um `gravar` por `buscar`: o que foi lido serviu a esta gravação, e só a ela.
      lido = null;
      return ((data ?? []) as unknown as EdicaoRow[]).map(toCadernoImpresso);
    },
  };
}

/**
 * O caderno está **desatualizado** quando a agregação que o sustentava mudou.
 *
 * Não dispara regravação: dispara a errata. O jornal não reescreve terça — marca
 * que o número mudou e deixa o leitor decidir se quer a edição nova.
 *
 * Por caderno, e não por edição, porque a assinatura é por linha. `metrica_lider`
 * não entra na conta: ele é o que liderou, não o que sustentava o número.
 *
 * **Sem guarda de nulo, e isso é consequência da migração.** Ela apagou as 7
 * linhas legadas e tornou a coluna `not null`: "não foi medido" deixou de ser um
 * estado possível desta coluna, que é a exceção nomeada da gramática de ausência
 * (AD-16). Um `!= null` aqui seria uma condição sempre verdadeira fingindo ser
 * uma regra — e o teste dela só existiria com um cast para fabricar o estado que
 * o banco proíbe.
 *
 * O que continua sendo regra é a comparação ser `!==` e não verdade: **zero é uma
 * medida**, e `if (c.aggVersionNoMomento && …)` a engoliria junto com o nulo.
 */
export function precisaErrata(c: CadernoImpresso, aggVersionAtual: number): boolean {
  return c.aggVersionNoMomento !== aggVersionAtual;
}
