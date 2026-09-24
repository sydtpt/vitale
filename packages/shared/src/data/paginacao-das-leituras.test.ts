/**
 * As leituras **sem janela** cruzam o teto de mil linhas do PostgREST?
 * Story 2.3, e o defeito que ela fecha.
 *
 * ## Por que um teste próprio, e não um caso em cada módulo
 *
 * Quatro leituras cresceram até aqui sem paginação — os três resumos da
 * Retrospectiva (hábitos, registros, séries) e o arquivo inteiro da revista. Elas
 * não têm `since`: trazem o acervo todo, e ele cresce com o tempo. Acima de 1000
 * linhas o PostgREST **corta sem erro e sem ordem definida**, e o sintoma não é
 * uma tela vazia: é o telefone e o script lendo subconjuntos diferentes, com a
 * edição deixando de ser a mesma e nenhum teste ficando vermelho.
 *
 * O dublê daqui **emula o corte**: sem `.range()`, ele devolve as primeiras mil
 * linhas e mais nada, calado — exatamente como o servidor. Então reverter
 * qualquer uma das quatro para um `.select()` puro reprova aqui, com a diferença
 * à vista (1000 contra 1001), em vez de passar verde.
 *
 * ## E a ordenação total
 *
 * Paginar sem ordem total é pior que não paginar: dentro de um bloco de linhas
 * empatadas a ordem é livre, e ela pode mudar entre uma página e a seguinte —
 * linhas na fronteira somem ou vêm duas vezes. Por isso cada caso confere também
 * **qual é o último critério de ordenação**, que tem de ser único por linha.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PAGE_SIZE } from './paginate';
import { fetchArquivoDeEdicoes } from './edicoes-ia';
import { fetchHabitSummaries } from './habits';
import { fetchRegistroSummaries } from './registros';
import { fetchTodoTemplates, fetchTodoTemplateSummaries } from './todo-templates';

type Linha = Record<string, unknown>;

/** Quantas linhas cada caso semeia: uma a mais que o teto, para a segunda página ter uma. */
const LINHAS = PAGE_SIZE + 1;

/**
 * O dublê do PostgREST, com o **corte implícito**.
 *
 * - `.range(lo, hi)` fatia, como o servidor;
 * - **sem `.range`**, devolve `PAGE_SIZE` linhas e para — que é o comportamento
 *   real, e é o que faz este teste ter alvo;
 * - `.order(col)` é registrado, para o caso conferir a ordem total;
 * - `.select(cols)` projeta, como o servidor: coluna que a string não pede chega
 *   à leitura como `undefined`.
 */
function bancoQueCorta(tabela: string, linhas: readonly Linha[]) {
  const pedidos: { colunas: string | undefined; ordens: string[]; faixas: [number, number][] }[] = [];
  const db = {
    from(nome: string) {
      if (nome !== tabela) throw new Error(`tabela inesperada: ${nome}`);
      const pedido = { colunas: undefined as string | undefined, ordens: [] as string[], faixas: [] as [number, number][] };
      pedidos.push(pedido);
      const consulta = {
        select(cols?: string) {
          pedido.colunas = cols;
          return consulta;
        },
        eq: () => consulta,
        in: () => consulta,
        order(col: string) {
          pedido.ordens.push(col);
          return consulta;
        },
        range(lo: number, hi: number) {
          pedido.faixas.push([lo, hi]);
          return consulta;
        },
        then<A>(ok: (r: { data: unknown; error: unknown }) => A): Promise<A> {
          const faixa = pedido.faixas.at(-1);
          const cols = pedido.colunas && pedido.colunas.trim() !== '*'
            ? pedido.colunas.split(',').map((c) => c.trim())
            : null;
          // Sem `.range`, o teto implícito do servidor: as primeiras mil, calado.
          const fatia = faixa ? linhas.slice(faixa[0], faixa[1] + 1) : linhas.slice(0, PAGE_SIZE);
          const data = cols === null
            ? fatia.map((l) => ({ ...l }))
            : fatia.map((l) => Object.fromEntries(cols.map((c) => [c, l[c] ?? null])));
          return Promise.resolve().then(() => ok({ data, error: null }));
        },
      };
      return consulta;
    },
  };
  return { db: db as unknown as SupabaseClient, pedidos };
}

/** `id-0000` … — ordenável como texto, e único por linha. */
const id = (k: number): string => `id-${String(k).padStart(4, '0')}`;

const casos: readonly {
  readonly nome: string;
  readonly tabela: string;
  readonly linha: (k: number) => Linha;
  readonly ler: (db: SupabaseClient) => Promise<{ length: number }>;
  /** O último critério de ordenação — o desempate que torna a ordem total. */
  readonly desempate: string;
}[] = [
  {
    nome: 'fetchHabitSummaries',
    tabela: 'habits',
    linha: (k) => ({ id: id(k), name: `h${k}`, bad: false, unit: 'un', created_at: '2026-01-01T10:00:00+00:00', unit_price: null }),
    ler: (db) => fetchHabitSummaries(db, 'u-1'),
    desempate: 'id',
  },
  {
    nome: 'fetchRegistroSummaries',
    tabela: 'registros',
    linha: (k) => ({ id: id(k), name: `r${k}`, created_at: '2026-01-01T10:00:00+00:00' }),
    ler: (db) => fetchRegistroSummaries(db, 'u-1'),
    desempate: 'id',
  },
  {
    nome: 'fetchTodoTemplateSummaries',
    tabela: 'todo_templates',
    linha: (k) => ({
      id: id(k), name: `t${k}`, module: 'casa', meta: null,
      recurrence: { kind: 'weekly', weekdays: [1] }, created_at: '2026-01-01T10:00:00+00:00', active: true,
    }),
    ler: (db) => fetchTodoTemplateSummaries(db, 'u-1'),
    desempate: 'id',
  },
  {
    nome: 'fetchTodoTemplates',
    tabela: 'todo_templates',
    linha: (k) => ({
      id: id(k), name: `t${k}`, icon: null, color: null, module: 'casa',
      recurrence: { kind: 'weekly', weekdays: [1] }, overdue: 'carry', cancel_policy: 'manual',
      meter: null, meter_at_last_done: null, linked_activity_id: null, on_complete: null,
      trigger_only: null, start_date: null, start_time: null, end_time: null, meta: null,
      // `sort` empata de propósito: é por isso que o desempate por `id` existe.
      active: true, sort: 1, created_at: '2026-01-01T10:00:00+00:00',
    }),
    ler: (db) => fetchTodoTemplates(db, 'u-1'),
    desempate: 'id',
  },
  {
    nome: 'fetchArquivoDeEdicoes',
    tabela: 'edicoes_ia',
    // Uma edição por linha: o agrupamento devolve 1001 edições de um caderno.
    linha: (k) => ({
      tipo_periodo: 'week', inicio: `2020-01-${String((k % 28) + 1).padStart(2, '0')}`,
      // As duas versões: a leitura confere que são inteiras, porque é por elas
      // que a impressão em massa decide o gasto.
      fim: '2020-01-31', caderno: 'sono', posicao: 1, prompt_versao: 6, pacote_versao: 4,
      // Distingue as linhas sem mudar a chave que o agrupamento usa.
      user_id: 'u-1', texto: `t${k}`,
    }),
    ler: (db) => fetchArquivoDeEdicoes(db, 'u-1').then((e) => ({ length: e.reduce((s, x) => s + x.cadernos.length, 0) })),
    desempate: 'caderno',
  },
];

describe('as leituras sem janela cruzam o teto de mil linhas', () => {
  for (const caso of casos) {
    it(`${caso.nome} devolve as ${LINHAS}, e não as primeiras ${PAGE_SIZE}`, async () => {
      const linhas = Array.from({ length: LINHAS }, (_, k) => caso.linha(k));
      const { db, pedidos } = bancoQueCorta(caso.tabela, linhas);
      const lido = await caso.ler(db);
      assert.equal(
        lido.length,
        LINHAS,
        `${caso.nome} parou no teto do PostgREST: leu ${lido.length} de ${LINHAS}. `
          + 'A leitura tem de passar por fetchAllPages com range e ordenação total.',
      );
      // Duas páginas: a cheia e a que tem a sobra — é assim que `fetchAllPages` para.
      const faixas = pedidos.flatMap((p) => p.faixas);
      assert.deepEqual(faixas, [[0, PAGE_SIZE - 1], [PAGE_SIZE, PAGE_SIZE * 2 - 1]], `${caso.nome}: as faixas pedidas`);
    });

    it(`${caso.nome} ordena por ${caso.desempate} no fim — sem isso a página seguinte pula linha`, async () => {
      const linhas = Array.from({ length: 3 }, (_, k) => caso.linha(k));
      const { db, pedidos } = bancoQueCorta(caso.tabela, linhas);
      await caso.ler(db);
      const ordens = pedidos[0]?.ordens ?? [];
      assert.ok(ordens.length > 0, `${caso.nome} não ordenou nada — a paginação fica sem ordem`);
      assert.equal(
        ordens.at(-1),
        caso.desempate,
        `${caso.nome}: o último critério é ${String(ordens.at(-1))}, e ele tem de ser único por linha`,
      );
    });
  }
});

describe('a prova negativa: o dublê de fato corta', () => {
  it('sem `.range`, ele devolve mil linhas e nada acusa — que é o defeito', async () => {
    const linhas = Array.from({ length: LINHAS }, (_, k) => ({ id: id(k) }));
    const { db } = bancoQueCorta('habits', linhas);
    // Uma leitura escrita à moda antiga: `select`/`eq`/`order`, sem `range`.
    const r = (await (db as unknown as {
      from: (t: string) => { select: (c: string) => { eq: (a: string, b: string) => { order: (c: string) => PromiseLike<{ data: unknown[] }> } } };
    }).from('habits').select('id').eq('user_id', 'u-1').order('id')) as { data: unknown[] };
    assert.equal(r.data.length, PAGE_SIZE, 'o dublê não está cortando — o teste acima ficaria sem alvo');
  });
});
