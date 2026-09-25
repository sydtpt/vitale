/**
 * Acesso à tabela `edicoes_capa` — dono único (AD-4).
 * AD-3 da espinha da revista · Story 1.9 cria a forma, a Story 1.13 carimba.
 *
 * **A Story 1.13 abriu a escrita** ({@link gravarCapa}). Quem *decide* a capa é o
 * núcleo (`revista/capa.ts`), quem a *grava* é esta porta, e quem a chama é a
 * impressão **inteira** — a parcial não toca capa existente.
 *
 * **A Story 1.16 acrescentou o porquê** ({@link MotivoDaCapa}) e a atividade da
 * foto, e um segundo chamador: a **troca** que o dono faz na ficha da capa. Ela
 * passa pela mesma porta — mesma guarda de sessão, mesmo carimbo de hora —, e
 * recarimba a capa e só: o texto, a ordem e as assinaturas da edição não mudam.
 *
 * ## Por que tabela, e não coluna em `edicoes_ia`
 *
 * A capa tem grão de **edição**; `edicoes_ia` tem grão de caderno. Uma coluna lá
 * seriam até quatro cópias da mesma capa — o mesmo padrão que o contrato recusou
 * para a ordem —, e a parede do arquivo passaria a varrer até 1.744 linhas e
 * desduplicar de quatro em quatro para desenhar 436 capas.
 *
 * ## Valores resolvidos, nunca ponteiros a re-derivar
 *
 * `coverOf` lê `isCover` e `state === 'linked'`, os dois mutáveis depois da
 * impressão — a estrela muda, o vínculo automático de 40 m muda, o `ph://` some
 * da biblioteca. Sem carimbo, a foto de agosto vira outra em outubro, contra
 * *período fechado congela*. Por isso o que fica gravado é a natureza, a
 * identidade do escolhido e **a legenda já formatada** — que continua imprimindo,
 * e servindo de descrição textual, mesmo quando a imagem não resolve mais.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ContaTrocadaNaImpressao, type TipoComEdicao } from './edicoes-ia';
import { fetchAllPages } from './paginate';

/**
 * As três naturezas de capa, e a terceira não é sobra.
 *
 * `foto` só existe a partir de 2026; `tracado` é a rota do próprio período; e
 * `grade` é a grade diária de quando não há nem foto nem rota. Sem a terceira,
 * 2023 não teria capa nenhuma — e é a textura das capas que registra quando ele
 * passou a fotografar.
 */
export type NaturezaDaCapa = 'foto' | 'tracado' | 'grade';

/**
 * As três, como valor — é esta lista que o CHECK de `edicoes_capa.natureza`
 * repete, e é contra ela que a barreira do `architecture.test.ts` cobra o banco.
 * Sem um valor a comparar, "a mesma lista, letra por letra" seria só um
 * comentário de SQL.
 */
export const NATUREZAS_DA_CAPA: readonly NaturezaDaCapa[] =
  Object.freeze(['foto', 'tracado', 'grade']);

export function isNaturezaDaCapa(v: unknown): v is NaturezaDaCapa {
  return typeof v === 'string' && (NATUREZAS_DA_CAPA as readonly string[]).includes(v);
}

/**
 * **Por que** esta capa (Story 1.16) — carimbado junto com ela, nunca re-derivado.
 *
 * O porquê não pode ser reconstruído depois: `coverOf` lê `isCover` e o vínculo,
 * e os dois mudam depois da impressão. Perguntar em outubro "a foto tinha
 * estrela?" responderia sobre outubro. Por isso ele sai **da escolha**, no instante
 * em que ela acontece, e fica gravado como valor.
 *
 * - `estrela` — a foto escolhida tinha a estrela do dono (ela vence a regra do app);
 * - `rajada` — o meio da maior rajada do período, sem estrela nenhuma;
 * - `unica` — era a única foto elegível e vinculada do período;
 * - `trocada` — o dono trocou a capa na ficha: ato dele, não escolha do app;
 * - `sem-foto` — natureza `tracado` ou `grade`: não havia foto que fosse capa.
 */
export type MotivoDaCapa = 'estrela' | 'rajada' | 'unica' | 'trocada' | 'sem-foto';

/**
 * Os cinco, como valor — é esta lista que o CHECK de `edicoes_capa.motivo` repete,
 * e é contra ela que a barreira do `architecture.test.ts` cobra o banco, no molde
 * de {@link NATUREZAS_DA_CAPA}.
 */
export const MOTIVOS_DA_CAPA: readonly MotivoDaCapa[] =
  Object.freeze(['estrela', 'rajada', 'unica', 'trocada', 'sem-foto']);

export function isMotivoDaCapa(v: unknown): v is MotivoDaCapa {
  return typeof v === 'string' && (MOTIVOS_DA_CAPA as readonly string[]).includes(v);
}

/** Linha como o PostgREST a devolve (snake_case). */
export interface CapaRow {
  user_id: string;
  tipo_periodo: string;
  inicio: string;
  fim: string;
  natureza: string;
  foto_id: string | null;
  foto_taken_at: string | null;
  rota_activity_id: string | null;
  legenda: string;
  carimbada_em: string;
  /** Nulo nas capas carimbadas antes da Story 1.16 — e só nelas. */
  motivo: string | null;
  foto_activity_id: string | null;
}

export interface Capa {
  tipoPeriodo: string;
  inicio: string;
  fim: string;
  natureza: NaturezaDaCapa;
  /** `activity_photos.id` — só na natureza `foto`. */
  fotoId: string | null;
  /**
   * O instante da captura: a **chave de cura** da ADR 0037.
   *
   * O `localIdentifier` do PhotoKit não é estável entre aparelhos; o instante é.
   * Guardá-lo é o que permite re-casar a imagem depois de um Quick Start.
   */
  fotoTakenAt: string | null;
  /** `activities.id` da rota desenhada — só na natureza `tracado`. */
  rotaActivityId: string | null;
  /** Já formatada — "Ittre · km 31,1 · 12:38". Não são três campos. */
  legenda: string;
  carimbadaEm: string;
  /**
   * Por que esta capa — ver {@link MotivoDaCapa}.
   *
   * **`null` é declaração, não esquecimento**: a capa foi carimbada antes da Story
   * 1.16, quando o app ainda não guardava o porquê. Ele não é reconstruído — a
   * ficha diz exatamente isso.
   */
  motivo: MotivoDaCapa | null;
  /**
   * A atividade da foto da capa (`activities.id`) — só na natureza `foto`.
   *
   * É o que a ficha usa para dizer em que atividade a foto foi tirada e por onde a
   * rota passou. Nulo quando a foto já tinha saído do acervo no backfill da
   * migração, ou nas naturezas sem foto.
   */
  fotoActivityId: string | null;
}

/** Ver a nota de `EDICAO_COLUMNS`: coluna esquecida aqui vira `undefined` na tela. */
export const CAPA_COLUMNS = 'user_id,tipo_periodo,inicio,fim,natureza,foto_id,foto_taken_at,'
  + 'rota_activity_id,legenda,carimbada_em,motivo,foto_activity_id';

const COLUMNS = CAPA_COLUMNS;

/**
 * Linha do Postgres → capa. **A natureza é conferida, não convertida por `as`.**
 *
 * O CHECK torna o valor desconhecido impossível — o que faz do cast a escrita
 * mais tentadora e a pior: no dia em que o CHECK for afrouxado, ou em que a linha
 * vier de outro lugar, o valor estranho atravessa até a tela e o sintoma aparece
 * longe daqui, como uma capa que não desenha. Explodir alto na fronteira é o
 * comportamento certo para um estado que o banco afirma não existir.
 */
export function toCapa(r: CapaRow): Capa {
  if (!isNaturezaDaCapa(r.natureza)) {
    throw new Error(
      `natureza de capa desconhecida: ${JSON.stringify(r.natureza)} — as três são `
      + `${NATUREZAS_DA_CAPA.join(', ')}, e o CHECK de edicoes_capa.natureza deveria ter recusado esta.`,
    );
  }
  // O motivo, pela mesma régua: nulo é a capa anterior à 1.16 e passa; um valor
  // fora da lista é um estado que o CHECK afirma impossível, e explode aqui em vez
  // de virar uma ficha que diz a frase errada.
  if (r.motivo !== null && !isMotivoDaCapa(r.motivo)) {
    throw new Error(
      `motivo de capa desconhecido: ${JSON.stringify(r.motivo)} — os cinco são `
      + `${MOTIVOS_DA_CAPA.join(', ')}, e o CHECK de edicoes_capa.motivo deveria ter recusado este.`,
    );
  }
  return {
    tipoPeriodo: r.tipo_periodo,
    inicio: r.inicio,
    fim: r.fim,
    natureza: r.natureza,
    fotoId: r.foto_id,
    fotoTakenAt: r.foto_taken_at,
    rotaActivityId: r.rota_activity_id,
    legenda: r.legenda,
    carimbadaEm: r.carimbada_em,
    motivo: r.motivo,
    fotoActivityId: r.foto_activity_id,
  };
}

/**
 * A capa carimbada de um período, ou `null` se a edição ainda não foi impressa.
 *
 * `maybeSingle` aqui é **correto**, ao contrário de `fetchEdicao`: a chave desta
 * tabela é a edição inteira — `(user_id, tipo_periodo, inicio, fim)` —, então
 * uma linha é o máximo que existe. É `edicoes_ia` que ganhou o caderno na chave.
 */
export async function fetchCapa(
  db: SupabaseClient,
  userId: string,
  tipoPeriodo: string,
  inicio: string,
  fim: string,
): Promise<Capa | null> {
  const { data, error } = await db
    .from('edicoes_capa')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('tipo_periodo', tipoPeriodo)
    .eq('inicio', inicio)
    .eq('fim', fim)
    .maybeSingle();
  if (error) throw error;
  return data ? toCapa(data as unknown as CapaRow) : null;
}

/**
 * **Todas** as capas carimbadas do usuário, numa leitura — o que a parede do
 * arquivo desenha (Story 2.4b).
 *
 * ## Por que existe, sendo que `fetchCapa` já lê uma
 *
 * Porque a parede tem 39 células hoje, e uma leitura por célula é 39 idas ao
 * banco para desenhar uma tela — com a agravante de que elas chegam fora de
 * ordem e a parede ficaria preenchendo buracos enquanto o dedo rola. A regra da
 * story é literal: *uma leitura em lote por coisa, nunca uma por célula*, e uma
 * barreira de código-fonte no celular cobra que a parede não chame
 * {@link fetchCapa} nem `fetchPhotoById` de dentro de um ladrilho.
 *
 * ## Por que pagina
 *
 * Uma capa por **edição**, e são **69** períodos por ano com edição possível —
 * 52 semanas + 12 meses + 4 estações + 1 ano (70 nos anos ISO de 53 semanas). O
 * teto de 1000 linhas do PostgREST corta **sem erro e em ordem indefinida** — e o
 * sintoma seria a parede perdendo capas antigas em silêncio, que é exatamente o
 * que ela existe para mostrar. Por isso passa por `fetchAllPages` com ordenação
 * **total**: `(inicio, tipo_periodo, fim)` é a chave primária menos o `user_id`,
 * que está fixo no filtro.
 *
 * ## Por que NÃO filtra por tipo, sendo que a leitura irmã filtra
 *
 * `fetchManchetesDosMeses` (`edicoes-ia.ts`) recorta `tipo_periodo = 'month'` no
 * SQL, e esta não recorta nada. A diferença não é descuido: **filtra-se no SQL o
 * que é caro de trazer; recorta-se na montagem o que é barato.** Lá o `texto` é o
 * payload, e o filtro é o que separa dezenas de KB de centenas. Aqui a linha é
 * curta — nenhuma coluna de texto grande —, o acervo inteiro cabe numa página
 * por muitos anos, e não há nada a economizar; em troca, a leitura serve a quem
 * vier depois sem ter de crescer um parâmetro. Quem decide o que vira ladrilho é
 * `revista/parede.ts`, que já tem a regra.
 */
export async function fetchCapasDoArquivo(
  db: SupabaseClient,
  userId: string,
): Promise<Capa[]> {
  const linhas = await fetchAllPages<CapaRow>(
    (lo, hi) =>
      db
        .from('edicoes_capa')
        .select(COLUMNS)
        .eq('user_id', userId)
        .order('inicio', { ascending: true })
        .order('tipo_periodo', { ascending: true })
        .order('fim', { ascending: true })
        .range(lo, hi),
  );
  return linhas.map(toCapa);
}

/**
 * A capa **decidida**, à espera do carimbo — o que `escolherCapa`
 * (`revista/capa.ts`) devolve e o que {@link gravarCapa} grava.
 *
 * É {@link Capa} menos o `carimbadaEm`, e a falta não é descuido: a hora do
 * carimbo é do ato de gravar, não da escolha. Quem a escolhesse antes gravaria o
 * instante em que o app montou a linha, que numa impressão de um minuto e meio
 * não é o mesmo instante.
 */
export interface CapaACarimbar {
  tipoPeriodo: TipoComEdicao;
  inicio: string;
  fim: string;
  natureza: NaturezaDaCapa;
  fotoId: string | null;
  fotoTakenAt: string | null;
  rotaActivityId: string | null;
  legenda: string;
  /**
   * **Nunca nulo aqui**, ao contrário de {@link Capa.motivo}: toda capa carimbada
   * a partir da 1.16 sabe por que foi escolhida. O nulo da coluna é só das duas
   * capas anteriores, e do build antigo, que grava sem a coluna.
   */
  motivo: MotivoDaCapa;
  fotoActivityId: string | null;
}

/**
 * Carimba a capa de uma edição — a **única** escrita em `edicoes_capa`.
 *
 * `upsert` pela chave da edição, e não `insert`: reimprimir a edição inteira
 * recarimba a mesma linha. O `carimbada_em` é escrito **à mão**, e não deixado ao
 * `default now()` da coluna: o padrão só vale na inserção, então o caminho de
 * atualização guardaria para sempre a hora da primeira impressão — e a capa
 * diria que é de agosto quando foi reescrita em outubro.
 *
 * **O dono é conferido antes de gravar**, com a mesma guarda de `portasDaEdicao`
 * e pelo mesmo motivo: a impressão leva um minuto ou mais, a linha vai para
 * `auth.uid()` pela RLS, e se a conta trocar nesse meio a capa escolhida sobre as
 * fotos de um dono cairia na edição do outro. Erra alto — {@link
 * ContaTrocadaNaImpressao} —, sem chamar o banco.
 *
 * **Quem decide se a falha é tolerável é o chamador.** A impressão a engole:
 * carimbar não é atômico com ela (decisão do dono, 17/09: ensinar
 * `edicao_imprimir` a receber capa é migração em produção), então se esta função
 * lançar a edição fica sem capa, o motivo vai para o log do hospedeiro e a
 * próxima impressão inteira recarimba — perda recuperável. A **troca** (1.16), ao
 * contrário, é ato do dono e falha em voz alta. Por isso esta função **lança**, em
 * vez de devolver nulo: um nulo calado aqui esconderia o motivo dos dois.
 */
export async function gravarCapa(
  db: SupabaseClient,
  userId: string,
  capa: CapaACarimbar,
): Promise<Capa> {
  const sessao = await db.auth.getSession();
  if (sessao.error) throw sessao.error;
  const naSessao = sessao.data.session?.user?.id ?? null;
  if (naSessao !== userId) throw new ContaTrocadaNaImpressao(userId, naSessao);

  const { data, error } = await db
    .from('edicoes_capa')
    .upsert(
      {
        user_id: userId,
        tipo_periodo: capa.tipoPeriodo,
        inicio: capa.inicio,
        fim: capa.fim,
        natureza: capa.natureza,
        foto_id: capa.fotoId,
        foto_taken_at: capa.fotoTakenAt,
        rota_activity_id: capa.rotaActivityId,
        legenda: capa.legenda,
        carimbada_em: new Date().toISOString(),
        // As duas da 1.16. Escritas SEMPRE, também na troca: um upsert que as
        // omitisse deixaria o motivo da capa anterior na linha nova.
        motivo: capa.motivo,
        foto_activity_id: capa.fotoActivityId,
      },
      { onConflict: 'user_id,tipo_periodo,inicio,fim' },
    )
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toCapa(data as unknown as CapaRow);
}
