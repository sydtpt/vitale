import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AGG_VERSION } from '../constants/agg-version';
import type { Impressao, LinhaDaImpressao } from '../ia/imprimir';
import {
  ARQUIVO_COLUMNS,
  ContaTrocadaNaImpressao, EDICAO_COLUMNS, EdicaoMudouNaImpressao, fetchArquivoDeEdicoes, fetchEdicao,
  portasDaEdicao, precisaErrata,
  toCadernoImpresso,
  type ArquivoRow, type CadernoImpresso, type EdicaoRow,
} from './edicoes-ia';

/**
 * **O PostgREST devolve só o que foi pedido**, e os fakes daqui fazem o mesmo.
 *
 * Um fake que ecoasse a linha inteira, ignorando o argumento do `.select()`,
 * deixaria os testes verdes com `caderno`, `posicao` ou `metrica_lider` fora da
 * string `COLUMNS` — e o que chegaria à tela em produção seria `undefined`.
 * Projetando, a coluna esquecida vira `undefined` **aqui**, e as asserções de
 * mapeamento reprovam.
 */
function projetar(linha: EdicaoRow, cols: string): Record<string, unknown> {
  const pedidas = cols.split(',').map((c) => c.trim());
  const out: Record<string, unknown> = {};
  for (const c of pedidas) {
    if (!(c in linha)) throw new Error(`coluna pedida que a tabela não tem: ${c}`);
    out[c] = (linha as unknown as Record<string, unknown>)[c];
  }
  return out;
}

/**
 * Banco de mentira da GRAVAÇÃO: `rpc`, e a LEITURA da tabela — que a guarda da
 * concorrência (Story 2.2) faz duas vezes, no `buscar` e de novo antes de gravar.
 * Escrever na tabela direto explode: a gravação passa pela função
 * `edicao_imprimir`, e mais nada.
 *
 * **Devolve linhas diferentes das enviadas**, de propósito. Se o fake ecoasse a
 * carga, o teste do mapeamento seria uma tautologia: passaria igual com a porta
 * devolvendo o próprio payload. Devolvendo outras linhas, a asserção mede o que
 * interessa — que a edição sai do que o banco respondeu.
 *
 * `tabela` é o que a leitura devolve, e é mutável: é por ela que um teste faz
 * "outro hospedeiro" imprimir entre o `buscar` e o `gravar`. **A leitura responde
 * por período** — os `.eq()` filtram de verdade, como no PostgREST —, e cada
 * leitura guarda os filtros que pediu: é o que deixa o teste do período trocado
 * morder, em vez de passar porque o fake devolve a tabela inteira a qualquer um.
 */
function fakeRpc(
  devolve: EdicaoRow[] | null,
  erro: Error | null = null,
  dono: string | null = 'u-1',
  tabela: EdicaoRow[] = [],
) {
  const capturado: {
    chamadas: { fn: string; args: Record<string, unknown> }[];
    leituras: number;
    filtrosDasLeituras: Record<string, unknown>[];
  } = { chamadas: [], leituras: 0, filtrosDasLeituras: [] };
  const escritaDireta = () => {
    throw new Error('a gravação tocou a tabela direto — ela passa por edicao_imprimir');
  };
  const db = {
    // A sessão do cliente — de quem a função gravaria, via `auth.uid()`.
    auth: {
      getSession: async () => ({ data: { session: dono === null ? null : { user: { id: dono } } }, error: null }),
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      capturado.chamadas.push({ fn, args });
      return { data: devolve, error: erro };
    },
    from: () => ({
      select: () => {
        const filtros: Record<string, unknown> = {};
        const alvo = {
          eq: (coluna: string, valor: unknown) => {
            filtros[coluna] = valor;
            return alvo;
          },
          order: async () => {
            capturado.leituras += 1;
            capturado.filtrosDasLeituras.push(filtros);
            const casa = (l: EdicaoRow) =>
              Object.entries(filtros).every(([c, v]) => (l as unknown as Record<string, unknown>)[c] === v);
            return { data: tabela.filter(casa).sort((a, b) => a.posicao - b.posicao), error: null };
          },
        };
        return alvo;
      },
      upsert: escritaDireta,
      insert: escritaDireta,
      update: escritaDireta,
      delete: escritaDireta,
    }),
  };
  return { db: db as unknown as SupabaseClient, capturado, tabela };
}

/** O período de {@link IMPRESSAO}, como a sequência o passa a `buscar`. */
const PERIODO = { tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31' } as const;

/**
 * Grava pela porta **como a sequência grava**: `buscar` primeiro, depois `gravar`,
 * nas mesmas portas. Desde a 2.2 `gravar` sem `buscar` antes é recusado — a porta
 * não saberia que conjunto a impressão viu.
 */
async function gravarComoASequencia(db: SupabaseClient, impressao: Impressao): Promise<CadernoImpresso[]> {
  const portas = portasDaEdicao(db, 'u-1');
  await portas.buscar(PERIODO);
  return portas.gravar(impressao);
}

/**
 * O fake da LEITURA. A cadeia termina em `.order()`, e não em `.maybeSingle()`:
 * é ele quem faz a prova negativa da story valer. Devolver `.maybeSingle()` para
 * a leitura estoura aqui com `not a function` — o teste de várias linhas reprova
 * sem que ninguém precise lembrar de escrever uma asserção sobre isso.
 */
function fakeLeitura(linhas: EdicaoRow[]) {
  const capturado: {
    filtros: Record<string, unknown>; ordem?: { coluna: string; asc?: boolean }; colunas?: string;
  } = { filtros: {} };
  const alvo = {
    eq(coluna: string, valor: unknown) {
      capturado.filtros[coluna] = valor;
      return alvo;
    },
    order(coluna: string, opcoes?: { ascending?: boolean }) {
      capturado.ordem = { coluna, asc: opcoes?.ascending };
      // O PostgREST devolve as linhas na ordem pedida — o fake honra isso, para
      // o teste não passar por acidente da ordem em que foram escritas.
      const asc = opcoes?.ascending !== false;
      const ordenadas = [...linhas].sort((a, b) => (asc ? 1 : -1) * (a.posicao - b.posicao));
      return Promise.resolve({
        data: ordenadas.map((l) => projetar(l, capturado.colunas!)),
        error: null,
      });
    },
  };
  const db = {
    from: () => ({
      select: (cols: string) => {
        capturado.colunas = cols;
        return alvo;
      },
    }),
  };
  return { db: db as unknown as SupabaseClient, capturado };
}

/** Uma linha plausível, com valores que NÃO coincidem com os da entrada. */
function linhaDoBanco(over: Partial<EdicaoRow> = {}): EdicaoRow {
  return {
    user_id: 'u-do-banco',
    tipo_periodo: 'season',
    inicio: '2026-06-01',
    fim: '2026-08-31',
    caderno: 'coracao',
    posicao: 3,
    texto: 'o que o banco tinha',
    provedor: 'provedor-do-banco',
    modelo: 'modelo-do-banco',
    prompt_versao: 42,
    pacote_versao: 43,
    motivo_de_parada: 'STOP',
    tokens_entrada: 1,
    tokens_saida: 2,
    agg_version_no_momento: 7,
    metrica_lider: 'fc_repouso',
    gerado_em: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

const LINHA: LinhaDaImpressao = {
  caderno: 'movimento',
  texto: 'Agosto teve 21 atividades.',
  provedor: 'provedor-do-cliente',
  modelo: 'modelo-do-cliente',
  promptVersao: 2,
  pacoteVersao: 1,
  motivoDeParada: 'STOP',
  tokensEntrada: 100,
  tokensSaida: 200,
  metricaLider: 'distancia',
};

const IMPRESSAO: Impressao = {
  tipoPeriodo: 'month',
  inicio: '2026-08-01',
  fim: '2026-08-31',
  ordem: ['movimento', 'sono'],
  linhas: [LINHA, { ...LINHA, caderno: 'sono', metricaLider: null }],
};

function caderno(over: Partial<CadernoImpresso> = {}): CadernoImpresso {
  return { ...toCadernoImpresso(linhaDoBanco()), ...over };
}

describe('COLUMNS — o que se pede ao PostgREST', () => {
  /**
   * A asserção que os dez testes de comportamento **não** fazem sozinhos: eles
   * medem o que sai do mapeamento, e o mapeamento só pode mapear o que foi
   * pedido. Sem esta comparação, tirar `metrica_lider` da string deixaria tudo
   * verde até a tela mostrar vazio — o modo de falha mais barato de escrever e o
   * mais caro de achar.
   */
  it('pede exatamente as colunas que a linha tem', () => {
    const pedidas = EDICAO_COLUMNS.split(',').map((c) => c.trim()).sort();
    const daLinha = Object.keys(linhaDoBanco()).sort();
    assert.deepEqual(pedidas, daLinha);
  });

  it('as três colunas novas da 1.9 estão na lista', () => {
    const pedidas = new Set(EDICAO_COLUMNS.split(',').map((c) => c.trim()));
    for (const c of ['caderno', 'posicao', 'metrica_lider']) {
      assert.ok(pedidas.has(c), `COLUMNS não pede ${c}`);
    }
  });

  it('a leitura pede exatamente EDICAO_COLUMNS', async () => {
    const leitura = fakeLeitura([linhaDoBanco({ posicao: 1 })]);
    await fetchEdicao(leitura.db, 'u-1', 'month', '2026-08-01', '2026-08-31');
    assert.equal(leitura.capturado.colunas, EDICAO_COLUMNS);
  });
});

describe('fetchEdicao — a edição é o conjunto dos cadernos', () => {
  /**
   * O caso que a migração cria e que o build antigo não sobrevive: quatro linhas
   * para o mesmo período. Com `.maybeSingle()` isto era PGRST116 **ao abrir** a
   * Retrospectiva, não só ao gravar.
   */
  it('devolve as quatro linhas do período, na ordem de posicao', async () => {
    const { db, capturado } = fakeLeitura([
      linhaDoBanco({ caderno: 'rotina', posicao: 4 }),
      linhaDoBanco({ caderno: 'sono', posicao: 2 }),
      linhaDoBanco({ caderno: 'movimento', posicao: 1 }),
      linhaDoBanco({ caderno: 'coracao', posicao: 3 }),
    ]);
    const e = await fetchEdicao(db, 'u-1', 'month', '2026-08-01', '2026-08-31');

    assert.deepEqual(e.map((c) => c.caderno), ['movimento', 'sono', 'coracao', 'rotina']);
    assert.deepEqual(e.map((c) => c.posicao), [1, 2, 3, 4]);
    // A ordem é pedida ao banco, não calculada aqui: `ordenarCadernos` é função
    // de impressão, e a leitura nunca a chama.
    assert.deepEqual(capturado.ordem, { coluna: 'posicao', asc: true });
  });

  it('filtra pelo período inteiro — nenhum dos quatro campos some', async () => {
    const { db, capturado } = fakeLeitura([linhaDoBanco({ posicao: 1 })]);
    await fetchEdicao(db, 'u-1', 'month', '2026-08-01', '2026-08-31');
    assert.deepEqual(capturado.filtros, {
      user_id: 'u-1',
      tipo_periodo: 'month',
      inicio: '2026-08-01',
      fim: '2026-08-31',
    });
  });

  /** Edição parcial: dois cadernos, posições 1 e 2. É o caso comum, não a exceção. */
  it('devolve os dois cadernos de uma edição parcial', async () => {
    const { db } = fakeLeitura([
      linhaDoBanco({ caderno: 'sono', posicao: 2 }),
      linhaDoBanco({ caderno: 'movimento', posicao: 1 }),
    ]);
    const e = await fetchEdicao(db, 'u-1', 'month', '2026-08-01', '2026-08-31');
    assert.deepEqual(e.map((c) => c.caderno), ['movimento', 'sono']);
  });

  it('período sem edição devolve lista vazia, não nulo', async () => {
    const { db } = fakeLeitura([]);
    assert.deepEqual(await fetchEdicao(db, 'u-1', 'month', '2026-08-01', '2026-08-31'), []);
  });

  it('mapeia as três colunas novas — caderno, posição e a métrica líder', async () => {
    const { db } = fakeLeitura([linhaDoBanco({ caderno: 'sono', posicao: 1, metrica_lider: 'duracao' })]);
    const [c] = await fetchEdicao(db, 'u-1', 'month', '2026-08-01', '2026-08-31');
    assert.equal(c.caderno, 'sono');
    assert.equal(c.posicao, 1);
    assert.equal(c.metricaLider, 'duracao');
  });

  /**
   * Nulo é declaração, não ausência de campo: o caderno que entrou pela lápide
   * não teve métrica líder, e a leitura precisa dizer isso em vez de inventar
   * uma sentinela.
   */
  it('métrica líder nula chega como null, não como undefined', async () => {
    const { db } = fakeLeitura([linhaDoBanco({ posicao: 1, metrica_lider: null })]);
    const [c] = await fetchEdicao(db, 'u-1', 'month', '2026-08-01', '2026-08-31');
    assert.equal(c.metricaLider, null);
    assert.ok('metricaLider' in c);
  });

  it('propaga o erro do banco em vez de devolver edição vazia', async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq() { return this; },
          order: async () => ({ data: null, error: new Error('rls') }),
        }),
      }),
    } as unknown as SupabaseClient;
    await assert.rejects(() => fetchEdicao(db, 'u-1', 'month', '2026-08-01', '2026-08-31'), /rls/);
  });

  /**
   * A prova de que a projeção do fake morde: pedir menos devolve menos, e o
   * mapeamento não tem de onde tirar o que não veio. É este mecanismo que faz o
   * teste de `COLUMNS` acima ser mais que uma comparação de strings.
   */
  it('coluna que não é pedida chega como undefined — é assim que o fake morde', async () => {
    const { db } = fakeLeitura([linhaDoBanco({ posicao: 1 })]);
    const semCaderno = EDICAO_COLUMNS.split(',')
      .filter((c) => c.trim() !== 'metrica_lider').join(',');
    const cru = await (db as unknown as {
      from: (t: string) => { select: (c: string) => {
        eq: (a: string, b: unknown) => unknown;
        order: (c: string, o: unknown) => Promise<{ data: Record<string, unknown>[] }>;
      } };
    }).from('edicoes_ia').select(semCaderno).order('posicao', { ascending: true });
    assert.ok(!('metrica_lider' in cru.data[0]));
  });
});

/**
 * A função `edicao_imprimir` como a migração a declara: os parâmetros e as colunas
 * do `jsonb_to_recordset` que lê a carga.
 *
 * **Lido do SQL, e não escrito aqui.** Uma lista à mão seria a terceira cópia do
 * mesmo vocabulário — a migração, a porta e o teste —, e a comparação passaria a
 * ser entre duas coisas que a mesma pessoa escreveu na mesma hora. Vale a última
 * migração que define a função.
 *
 * **E nunca compara contra uma definição velha**, no molde da barreira do CHECK de
 * `motivo_de_parada`. Toda migração que (re)define, altera ou derruba a função
 * "mexe nela"; se o leitor não a entende — tipo com parênteses na assinatura,
 * `p_linhas` renomeado, recordset que ele não acha, `drop` sem recriar —, e ela
 * vem depois da última que ele entendeu, o teste falha dizendo qual. Seguir verde
 * com a definição de antes é o único desfecho errado.
 */
interface FuncaoLida {
  arquivo: string;
  parametros: string[];
  colunas: string[];
}

const MEXE_NA_FUNCAO =
  /\b(?:create(?:\s+or\s+replace)?|alter|drop)\s+function\s+(?:if\s+exists\s+)?(?:public\.)?"?edicao_imprimir"?\b/i;

function lerFuncaoDasMigracoes(migracoes: readonly { arquivo: string; sql: string }[]): FuncaoLida {
  let vigente: FuncaoLida | null = null;
  const ilegiveis: string[] = [];
  for (const { arquivo, sql: bruto } of [...migracoes].sort((a, b) => a.arquivo.localeCompare(b.arquivo))) {
    const sql = bruto.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
    if (!MEXE_NA_FUNCAO.test(sql)) continue;
    const assinatura =
      /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?edicao_imprimir\s*\(([^)]*)\)\s*returns/i.exec(sql);
    const parametros = assinatura
      ? assinatura[1].split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean)
      : [];
    const recordsets = [...sql.matchAll(/jsonb_to_recordset\s*\(\s*p_linhas\s*\)\s*as\s+\w+\s*\(([^)]*)\)/gi)]
      .map((m) => m[1].split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean).sort());
    const largura = recordsets.length > 0 ? Math.max(...recordsets.map((r) => r.length)) : 0;
    if (!assinatura || !parametros.includes('p_linhas') || largura < 2) {
      ilegiveis.push(arquivo);
      continue;
    }
    const largos = recordsets.filter((r) => r.length === largura);
    // O corpo lê a carga mais de uma vez (a guarda e o insert): todas as leituras
    // largas têm de concordar, senão a guarda confere um formato e o insert grava outro.
    for (const r of largos) assert.deepEqual(r, largos[0], `${arquivo}: dois recordsets largos divergem`);
    vigente = { arquivo, parametros, colunas: largos[0] };
  }
  const depois = ilegiveis.filter((f) => vigente === null || f > vigente.arquivo);
  assert.deepEqual(
    depois,
    [],
    `migração que mexe em edicao_imprimir e que o leitor do teste não entende: ${depois.join(', ')}. ` +
      'Ensine a forma nova a lerFuncaoDasMigracoes — o teste não pode comparar a carga com a definição de antes.',
  );
  assert.ok(vigente, 'nenhuma migração define edicao_imprimir — o teste da carga ficou sem alvo');
  return vigente;
}

function funcaoDaMigracao(): FuncaoLida {
  const dir = join(import.meta.dirname, '..', '..', '..', '..', 'supabase', 'migrations');
  return lerFuncaoDasMigracoes(
    readdirSync(dir).filter((f) => f.endsWith('.sql')).map((arquivo) => ({
      arquivo, sql: readFileSync(join(dir, arquivo), 'utf8'),
    })),
  );
}

describe('o leitor da função nas migrações — nunca contra a definição velha', () => {
  const corpo = `
    begin
      select 1 from jsonb_to_recordset(p_linhas) as l(caderno text);
      insert into t select * from jsonb_to_recordset(p_linhas) as l(caderno text, texto text, metrica_lider text);
    end`;
  const legivel = (params = 'p_tipo_periodo text, p_ordem text[], p_linhas jsonb') =>
    `create or replace function public.edicao_imprimir(${params}) returns setof public.edicoes_ia as $fn$ ${corpo} $fn$;`;

  it('lê a definição legível', () => {
    const f = lerFuncaoDasMigracoes([{ arquivo: '1.sql', sql: legivel() }]);
    assert.deepEqual(f, { arquivo: '1.sql', parametros: ['p_tipo_periodo', 'p_ordem', 'p_linhas'], colunas: ['caderno', 'metrica_lider', 'texto'] });
  });

  it('a mais nova legível vence; grant e comment não são definição', () => {
    const f = lerFuncaoDasMigracoes([
      { arquivo: '1.sql', sql: legivel() },
      { arquivo: '2.sql', sql: legivel('p_inicio date, p_linhas jsonb') },
      { arquivo: '3.sql', sql: 'grant execute on function public.edicao_imprimir(text, jsonb) to authenticated;' },
    ]);
    assert.equal(f.arquivo, '2.sql');
  });

  it('a ilegível ANTES da legível não atrapalha', () => {
    const f = lerFuncaoDasMigracoes([
      { arquivo: '1.sql', sql: 'create function public.edicao_imprimir(p numeric(10,2)) returns void as $$ $$;' },
      { arquivo: '2.sql', sql: legivel() },
    ]);
    assert.equal(f.arquivo, '2.sql');
  });

  const depoisIlegivel: readonly (readonly [string, string])[] = [
    ['tipo com parênteses', legivel('p_valor numeric(10,2), p_linhas jsonb')],
    ['p_linhas renomeado', legivel('p_tipo_periodo text, p_cadernos jsonb').replace(/p_linhas/g, 'p_cadernos')],
    ['drop sem recriar', 'drop function if exists public.edicao_imprimir(text, date, date, text[], jsonb);'],
    ['alter', 'alter function public.edicao_imprimir(text, date, date, text[], jsonb) rename to imprimir_edicao;'],
  ];
  for (const [nome, sql] of depoisIlegivel) {
    it(`reprova, dizendo qual, a posterior que não entende: ${nome}`, () => {
      assert.throws(
        () => lerFuncaoDasMigracoes([{ arquivo: '1.sql', sql: legivel() }, { arquivo: '2.sql', sql }]),
        /não entende: 2\.sql/,
      );
    });
  }
});

describe('portasDaEdicao — a gravação é a função do banco, numa chamada', () => {
  it('a leitura do SQL acha o que procura (não-vacuidade)', () => {
    const f = funcaoDaMigracao();
    assert.ok(f.parametros.length >= 5, `parâmetros lidos: ${JSON.stringify(f.parametros)}`);
    assert.ok(f.colunas.length >= 10, `colunas lidas: ${JSON.stringify(f.colunas)}`);
    assert.ok(f.colunas.includes('metrica_lider') && f.colunas.includes('agg_version_no_momento'));
  });

  /**
   * O ponto do teste: a chave que a função lê e a porta não manda chega nula e é
   * recusada em produção ("linha recusada — sem …"); a que a porta manda e a
   * função não lê é descartada calada. As duas direções, contra a migração.
   */
  it('as chaves da carga são exatamente as colunas do recordset da migração', async () => {
    const { db, capturado } = fakeRpc([]);
    await gravarComoASequencia(db, IMPRESSAO);
    const { arquivo, parametros, colunas } = funcaoDaMigracao();

    assert.equal(capturado.chamadas.length, 1);
    const { fn, args } = capturado.chamadas[0];
    assert.equal(fn, 'edicao_imprimir');
    assert.deepEqual(Object.keys(args).sort(), [...parametros].sort(), `parâmetros de ${arquivo}`);
    const linhas = args.p_linhas as Record<string, unknown>[];
    assert.equal(linhas.length, 2);
    for (const l of linhas) assert.deepEqual(Object.keys(l).sort(), colunas, `recordset de ${arquivo}`);
  });

  it('manda o período, a ordem e as linhas — a ordem inteira, não só a dos regenerados', async () => {
    const { db, capturado } = fakeRpc([]);
    await gravarComoASequencia(db, { ...IMPRESSAO, ordem: ['coracao', 'movimento', 'sono'] });
    const { args } = capturado.chamadas[0];
    assert.equal(args.p_tipo_periodo, 'month');
    assert.equal(args.p_inicio, '2026-08-01');
    assert.equal(args.p_fim, '2026-08-31');
    assert.deepEqual(args.p_ordem, ['coracao', 'movimento', 'sono']);
    assert.ok(Array.isArray(args.p_ordem));
    const [primeira] = args.p_linhas as Record<string, unknown>[];
    assert.deepEqual(primeira, {
      caderno: 'movimento',
      texto: 'Agosto teve 21 atividades.',
      provedor: 'provedor-do-cliente',
      modelo: 'modelo-do-cliente',
      prompt_versao: 2,
      pacote_versao: 1,
      motivo_de_parada: 'STOP',
      tokens_entrada: 100,
      tokens_saida: 200,
      agg_version_no_momento: AGG_VERSION,
      metrica_lider: 'distancia',
    });
  });

  it('carimba a versão vigente da agregação sem que ninguém a informe', async () => {
    const { db, capturado } = fakeRpc([]);
    await gravarComoASequencia(db, IMPRESSAO);
    for (const l of capturado.chamadas[0].args.p_linhas as Record<string, unknown>[]) {
      assert.equal(l.agg_version_no_momento, AGG_VERSION);
    }
  });

  it('ignora a versão que um hospedeiro tente empurrar', async () => {
    const { db, capturado } = fakeRpc([]);
    // `tsc` já recusa este objeto — a linha da impressão não tem o campo, e é assim
    // que a garantia é dada. O cast força o caso mesmo assim, para provar que a
    // porta não tem uma segunda entrada por onde o valor errado passe em JS.
    const empurrada = { ...LINHA, aggVersionNoMomento: 1, agg_version_no_momento: 1 } as LinhaDaImpressao;
    await gravarComoASequencia(db, { ...IMPRESSAO, ordem: ['movimento'], linhas: [empurrada] });
    const [l] = capturado.chamadas[0].args.p_linhas as Record<string, unknown>[];
    assert.equal(l.agg_version_no_momento, AGG_VERSION);
    assert.ok(!('aggVersionNoMomento' in l));
  });

  it('nulo da métrica líder é escrito como nulo, não omitido — a função recusa a chave ausente', async () => {
    const { db, capturado } = fakeRpc([]);
    await gravarComoASequencia(db, IMPRESSAO);
    const [, sono] = capturado.chamadas[0].args.p_linhas as Record<string, unknown>[];
    assert.ok('metrica_lider' in sono);
    assert.equal(sono.metrica_lider, null);
  });

  it('devolve a edição que o banco respondeu, não o que foi enviado', async () => {
    const { db } = fakeRpc([
      linhaDoBanco({ caderno: 'coracao', posicao: 1 }),
      linhaDoBanco({ caderno: 'rotina', posicao: 2, metrica_lider: null }),
    ]);
    const e = await gravarComoASequencia(db, IMPRESSAO);
    assert.deepEqual(e.map((c) => [c.caderno, c.posicao, c.metricaLider]), [
      ['coracao', 1, 'fc_repouso'],
      ['rotina', 2, null],
    ]);
    assert.deepEqual(e[0], toCadernoImpresso(linhaDoBanco({ caderno: 'coracao', posicao: 1 })));
  });

  it('a linha devolvida passa pela conferência de toCadernoImpresso', async () => {
    const { db } = fakeRpc([linhaDoBanco({ caderno: 'lua' })]);
    await assert.rejects(() => gravarComoASequencia(db, IMPRESSAO), /caderno desconhecido/);
  });

  it('propaga o erro do banco em vez de devolver edição vazia', async () => {
    const { db } = fakeRpc(null, new Error('linha recusada'));
    await assert.rejects(() => gravarComoASequencia(db, IMPRESSAO), /linha recusada/);
  });

  it('a sessão é do dono: grava', async () => {
    const { db, capturado } = fakeRpc([], null, 'u-1');
    await gravarComoASequencia(db, IMPRESSAO);
    assert.equal(capturado.chamadas.length, 1);
  });

  /**
   * A conta trocou durante a impressão: a função gravaria para `auth.uid()`, que já
   * é outro dono. O texto escrito sobre os dados de `u-1` não pode cair na edição de
   * `u-2` — e nem na de ninguém, se a sessão caiu.
   */
  it('a sessão é de outra conta, ou de ninguém: lança nomeado, e a função não é chamada', async () => {
    for (const dono of ['u-2', null]) {
      const { db, capturado } = fakeRpc([], null, dono);
      await assert.rejects(
        () => gravarComoASequencia(db, IMPRESSAO),
        (e: unknown) => e instanceof ContaTrocadaNaImpressao && e.name === 'ContaTrocadaNaImpressao',
      );
      assert.equal(capturado.chamadas.length, 0, `dono ${String(dono)}: o rpc foi chamado`);
    }
  });

  it('erro ao ler a sessão também não grava', async () => {
    const { db, capturado } = fakeRpc([]);
    (db as unknown as { auth: { getSession: () => Promise<unknown> } }).auth.getSession = async () => ({
      data: { session: null }, error: new Error('sessão ilegível'),
    });
    await assert.rejects(() => gravarComoASequencia(db, IMPRESSAO), /sessão ilegível/);
    assert.equal(capturado.chamadas.length, 0);
  });

  it('buscar é fetchEdicao: o período inteiro, do dono, na ordem gravada', async () => {
    const { db, capturado } = fakeLeitura([
      linhaDoBanco({ caderno: 'sono', posicao: 2 }),
      linhaDoBanco({ caderno: 'movimento', posicao: 1 }),
    ]);
    const e = await portasDaEdicao(db, 'u-1').buscar({ tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31' });
    assert.deepEqual(e.map((c) => c.caderno), ['movimento', 'sono']);
    assert.deepEqual(capturado.filtros, { user_id: 'u-1', tipo_periodo: 'month', inicio: '2026-08-01', fim: '2026-08-31' });
  });
});

/**
 * A guarda da impressão concorrente (Story 2.2).
 *
 * Entre o `buscar` e o `gravar` há uma chamada paga por caderno. Se outro
 * hospedeiro grava o mesmo período nesse intervalo, o caderno dele não está na
 * `ordem` desta impressão — e a função apaga todo caderno fora da ordem. A porta
 * relê antes de chamar a função, e recusa se o conjunto mudou.
 */
describe('portasDaEdicao — a guarda contra impressão concorrente', () => {
  const impresso = (caderno: string, posicao: number, periodo: { inicio: string; fim: string } = PERIODO) =>
    linhaDoBanco({ user_id: 'u-1', tipo_periodo: 'month', inicio: periodo.inicio, fim: periodo.fim, caderno, posicao });
  const JULHO = { tipoPeriodo: 'month', inicio: '2026-07-01', fim: '2026-07-31' } as const;

  it('o conjunto igual ao que o buscar viu grava — relendo uma vez antes do rpc, o período do gravar', async () => {
    const { db, capturado } = fakeRpc([], null, 'u-1', [impresso('sono', 1), impresso('movimento', 2)]);
    const portas = portasDaEdicao(db, 'u-1');
    await portas.buscar(PERIODO);
    assert.equal(capturado.leituras, 1);
    await portas.gravar(IMPRESSAO);
    assert.equal(capturado.leituras, 2, 'gravar não releu a edição antes da função');
    assert.deepEqual(capturado.filtrosDasLeituras[1], {
      user_id: 'u-1', tipo_periodo: 'month', inicio: '2026-08-01', fim: '2026-08-31',
    });
    assert.equal(capturado.chamadas.length, 1);
  });

  /**
   * O período trocado. Julho tem **o mesmo conjunto** que agosto, e o fake responde
   * por período: sem a conferência do período, a releitura de julho acharia sono e
   * movimento, igual ao que o `buscar` de agosto viu, e a função gravaria julho com
   * uma ordem montada sobre agosto.
   */
  it('o gravar pede outro período que não o lido: lança, sem reler e sem chamar a função', async () => {
    const tabela = [
      impresso('sono', 1), impresso('movimento', 2),
      impresso('sono', 1, JULHO), impresso('movimento', 2, JULHO),
    ];
    const { db, capturado } = fakeRpc([], null, 'u-1', tabela);
    const portas = portasDaEdicao(db, 'u-1');
    await portas.buscar(PERIODO);
    await assert.rejects(
      () => portas.gravar({ ...IMPRESSAO, ...JULHO }),
      (e: unknown) => {
        assert.ok(e instanceof EdicaoMudouNaImpressao, String(e));
        assert.deepEqual(e.periodoLido, PERIODO);
        assert.equal(e.agora, null);
        assert.match(e.message, /month 2026-07-01 a 2026-07-31/);
        assert.match(e.message, /nada foi gravado/);
        return true;
      },
    );
    assert.equal(capturado.leituras, 1, 'releu julho — a conferência do período não veio antes');
    assert.equal(capturado.chamadas.length, 0);
    // O mesmo gravar, sobre o período lido, grava: é o período que recusou, não o conjunto.
    await portas.gravar(IMPRESSAO);
    assert.equal(capturado.chamadas.length, 1);
  });

  it('um gravar por buscar: depois de um rpc que deu certo, o segundo gravar sem novo buscar lança', async () => {
    const { db, capturado } = fakeRpc([], null, 'u-1', [impresso('sono', 1)]);
    const portas = portasDaEdicao(db, 'u-1');
    await portas.buscar(PERIODO);
    await portas.gravar(IMPRESSAO);
    assert.equal(capturado.chamadas.length, 1);
    await assert.rejects(
      () => portas.gravar(IMPRESSAO),
      (e: unknown) => e instanceof EdicaoMudouNaImpressao && e.vistos === null && /sem buscar/.test(e.message),
    );
    assert.equal(capturado.chamadas.length, 1, 'o segundo gravar chegou à função');
    // Um buscar novo devolve a porta ao estado de gravar.
    await portas.buscar(PERIODO);
    await portas.gravar(IMPRESSAO);
    assert.equal(capturado.chamadas.length, 2);
  });

  it('o rpc que falha não consome o buscar: a mesma porta grava depois', async () => {
    const { db, capturado } = fakeRpc([], new Error('linha recusada'), 'u-1', [impresso('sono', 1)]);
    const portas = portasDaEdicao(db, 'u-1');
    await portas.buscar(PERIODO);
    await assert.rejects(() => portas.gravar(IMPRESSAO), /linha recusada/);
    await assert.rejects(() => portas.gravar(IMPRESSAO), /linha recusada/);
    assert.equal(capturado.chamadas.length, 2);
  });

  it('a mensagem não afirma a causa: diz que os cadernos mudaram e que nada foi gravado', async () => {
    const tabela = [impresso('sono', 1)];
    const { db } = fakeRpc([], null, 'u-1', tabela);
    const portas = portasDaEdicao(db, 'u-1');
    await portas.buscar(PERIODO);
    tabela.splice(0, 1);
    await assert.rejects(
      () => portas.gravar(IMPRESSAO),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.match(e.message, /mudaram entre a leitura e a gravação/);
        assert.match(e.message, /outro hospedeiro imprimiu ou apagou/);
        assert.match(e.message, /nada foi gravado/);
        return true;
      },
    );
  });

  it('a mesma edição em outra ordem é o mesmo conjunto — a posição não é o que a guarda compara', async () => {
    const tabela = [impresso('sono', 1), impresso('movimento', 2)];
    const { db, capturado } = fakeRpc([], null, 'u-1', tabela);
    const portas = portasDaEdicao(db, 'u-1');
    await portas.buscar(PERIODO);
    tabela.splice(0, tabela.length, impresso('movimento', 1), impresso('sono', 2));
    await portas.gravar(IMPRESSAO);
    assert.equal(capturado.chamadas.length, 1);
  });

  const mudancas: readonly (readonly [string, (t: EdicaoRow[]) => void, string[]])[] = [
    ['outro hospedeiro gravou um caderno novo', (t) => { t.push(impresso('coracao', 3)); }, ['sono', 'movimento', 'coracao']],
    ['outro hospedeiro tirou um caderno', (t) => { t.splice(1, 1); }, ['sono']],
    ['a edição foi apagada', (t) => { t.splice(0, t.length); }, []],
  ];
  for (const [nome, mudar, agora] of mudancas) {
    it(`${nome}: lança EdicaoMudouNaImpressao, e a função não é chamada`, async () => {
      const tabela = [impresso('sono', 1), impresso('movimento', 2)];
      const { db, capturado } = fakeRpc([], null, 'u-1', tabela);
      const portas = portasDaEdicao(db, 'u-1');
      await portas.buscar(PERIODO);
      mudar(tabela);
      await assert.rejects(
        () => portas.gravar(IMPRESSAO),
        (e: unknown) => {
          assert.ok(e instanceof EdicaoMudouNaImpressao, String(e));
          assert.equal(e.name, 'EdicaoMudouNaImpressao');
          assert.deepEqual([...(e.vistos ?? [])].sort(), ['movimento', 'sono']);
          assert.deepEqual([...(e.agora ?? [])].sort(), [...agora].sort());
          return true;
        },
      );
      assert.equal(capturado.chamadas.length, 0, 'o rpc foi chamado sobre uma edição que mudou');
    });
  }

  it('a primeira impressão de um período vazio grava, e a que chega depois de outra lança', async () => {
    const tabela: EdicaoRow[] = [];
    const { db, capturado } = fakeRpc([], null, 'u-1', tabela);
    const portas = portasDaEdicao(db, 'u-1');
    await portas.buscar(PERIODO);
    // O outro hospedeiro imprimiu o mesmo período enquanto esta impressão chamava o modelo.
    tabela.push(impresso('rotina', 1));
    await assert.rejects(() => portas.gravar(IMPRESSAO), EdicaoMudouNaImpressao);
    assert.equal(capturado.chamadas.length, 0);
  });

  it('gravar sem buscar antes lança sem reler e sem chamar a função', async () => {
    const { db, capturado } = fakeRpc([]);
    await assert.rejects(
      () => portasDaEdicao(db, 'u-1').gravar(IMPRESSAO),
      (e: unknown) => e instanceof EdicaoMudouNaImpressao && e.vistos === null && /sem buscar/.test(e.message),
    );
    assert.equal(capturado.leituras, 0);
    assert.equal(capturado.chamadas.length, 0);
  });

  it('a conta é conferida antes do conjunto: sessão de outro dono lança ContaTrocadaNaImpressao, sem reler', async () => {
    const { db, capturado } = fakeRpc([], null, 'u-2');
    const portas = portasDaEdicao(db, 'u-1');
    await portas.buscar(PERIODO);
    await assert.rejects(() => portas.gravar(IMPRESSAO), ContaTrocadaNaImpressao);
    assert.equal(capturado.leituras, 1, 'releu a edição antes de conferir a conta');
    assert.equal(capturado.chamadas.length, 0);
  });

  it('o buscar de uma porta não vale para outra — uma porta por impressão', async () => {
    const { db, capturado } = fakeRpc([]);
    await portasDaEdicao(db, 'u-1').buscar(PERIODO);
    await assert.rejects(() => portasDaEdicao(db, 'u-1').gravar(IMPRESSAO), EdicaoMudouNaImpressao);
    assert.equal(capturado.chamadas.length, 0);
  });
});

describe('precisaErrata — o que conta como desatualizado', () => {
  it('marca errata quando a agregação subiu depois da impressão', () => {
    assert.equal(precisaErrata(caderno({ aggVersionNoMomento: 9 }), 10), true);
  });

  it('não marca nada enquanto a agregação não muda', () => {
    assert.equal(precisaErrata(caderno({ aggVersionNoMomento: 9 }), 9), false);
  });

  /**
   * Zero é uma medida, não uma ausência. Este teste existe para travar a troca
   * do `!= null` por um `if (c.aggVersionNoMomento && …)`, que é a escrita mais
   * natural e engoliria o zero junto com o nulo.
   */
  it('zero é medida: difere de 9, logo é errata', () => {
    assert.equal(precisaErrata(caderno({ aggVersionNoMomento: 0 }), 9), true);
  });

  it('e zero contra zero continua sendo "igual"', () => {
    assert.equal(precisaErrata(caderno({ aggVersionNoMomento: 0 }), 0), false);
  });

  /**
   * A coluna nova não entra na conta. Errata é "o número embaixo do texto
   * mudou"; `metrica_lider` é o que liderou a ordem, e ele não sustenta número
   * nenhum — um caderno de lápide, com líder nulo, tem exatamente a mesma
   * elegibilidade a errata que qualquer outro.
   */
  it('a métrica líder não muda a errata — nula ou preenchida', () => {
    const comLider = caderno({ aggVersionNoMomento: 9, metricaLider: 'fc_repouso' });
    const semLider = caderno({ aggVersionNoMomento: 9, metricaLider: null });
    assert.equal(precisaErrata(comLider, 10), precisaErrata(semLider, 10));
    assert.equal(precisaErrata(semLider, 10), true);
    assert.equal(precisaErrata(semLider, 9), false);
  });

  /**
   * **O caso do nulo saiu, e a saída é a notícia.** Ele existia porque as 7
   * linhas legadas tinham nulo na coluna; a migração as apagou e tornou a coluna
   * `not null`, então o estado deixou de ser alcançável. Um teste que só se
   * escrevia com `as unknown as` para fabricar o estado proibido não mede o
   * código: mede o cast.
   *
   * O que sobrou no lugar é a distinção que continua viva — zero contra
   * ausência —, coberta pelos dois casos acima.
   */
  it('a comparação é de igualdade, não de verdade', () => {
    // Se alguém trocar `!==` por um `&&` de verdade, este par deixa de casar.
    assert.equal(precisaErrata(caderno({ aggVersionNoMomento: 0 }), 0), false);
    assert.equal(precisaErrata(caderno({ aggVersionNoMomento: 0 }), 1), true);
  });
});

/* ── o arquivo inteiro (Story 2.3) ───────────────────────────────────────── */

/**
 * O fake do ARQUIVO. A cadeia termina em `.range()`, e não em `.order()`: a
 * leitura do arquivo cresce com o tempo e **tem** de paginar (ver
 * `paginacao-das-leituras.test.ts`, que mede o corte de mil linhas). Uma versão
 * sem `range` estoura aqui com `not a function`, em vez de passar verde.
 *
 * Projeta pelas colunas pedidas, como o PostgREST — é o que faz a asserção de
 * `ARQUIVO_COLUMNS` morder — e devolve as linhas **fora de ordem**, para o
 * agrupamento ter de ordenar por `posicao` em vez de herdar a ordem da escrita.
 */
function fakeArquivo(linhas: ArquivoRow[]) {
  const capturado: { colunas?: string; ordens: string[] } = { ordens: [] };
  const alvo = {
    eq: () => alvo,
    order(coluna: string) {
      capturado.ordens.push(coluna);
      return alvo;
    },
    range(lo: number, hi: number) {
      return Promise.resolve({
        data: linhas.slice(lo, hi + 1).map((l) => projetar(l as unknown as EdicaoRow, capturado.colunas!)),
        error: null,
      });
    },
  };
  const db = {
    from: () => ({
      select: (cols: string) => {
        capturado.colunas = cols;
        return alvo;
      },
    }),
  };
  return { db: db as unknown as SupabaseClient, capturado };
}

const noArquivo = (over: Partial<ArquivoRow> = {}): ArquivoRow => ({
  tipo_periodo: 'month', inicio: '2026-08-01', fim: '2026-08-31',
  caderno: 'sono', posicao: 1, prompt_versao: 5, pacote_versao: 3, ...over,
});

describe('ARQUIVO_COLUMNS — a mesma guarda de EDICAO_COLUMNS', () => {
  it('pede exatamente as colunas que a linha do arquivo tem', () => {
    const pedidas = ARQUIVO_COLUMNS.split(',').map((c) => c.trim()).sort();
    assert.deepEqual(pedidas, Object.keys(noArquivo()).sort());
  });

  it('não pede o texto — é o grosso da linha, e não decide o que imprimir', () => {
    assert.ok(!ARQUIVO_COLUMNS.split(',').includes('texto'));
  });

  it('a leitura pede exatamente ARQUIVO_COLUMNS', async () => {
    const f = fakeArquivo([noArquivo()]);
    await fetchArquivoDeEdicoes(f.db, 'u-1');
    assert.equal(f.capturado.colunas, ARQUIVO_COLUMNS);
  });
});

describe('fetchArquivoDeEdicoes — o inventário agrupado por período', () => {
  it('agrupa por (tipo, início, fim) e ordena os cadernos por posição', async () => {
    const f = fakeArquivo([
      noArquivo({ caderno: 'rotina', posicao: 3 }),
      noArquivo({ caderno: 'sono', posicao: 1, prompt_versao: 6, pacote_versao: 4 }),
      noArquivo({ caderno: 'movimento', posicao: 2 }),
      noArquivo({ tipo_periodo: 'year', inicio: '2025-01-01', fim: '2025-12-31', caderno: 'coracao', posicao: 1 }),
    ]);
    const arquivo = await fetchArquivoDeEdicoes(f.db, 'u-1');
    assert.equal(arquivo.length, 2);
    // As duas versões chegam separadas: é por `promptVersao` que o `--caderno`
    // da massa (Story 2.8) decide, e por `pacoteVersao` que a campanha da 2.3
    // decide. Uma linha com uma nova e a outra velha prova que não se confundem.
    assert.deepEqual(arquivo[0], {
      tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31',
      cadernos: [
        { caderno: 'sono', posicao: 1, promptVersao: 6, pacoteVersao: 4 },
        { caderno: 'movimento', posicao: 2, promptVersao: 5, pacoteVersao: 3 },
        { caderno: 'rotina', posicao: 3, promptVersao: 5, pacoteVersao: 3 },
      ],
    });
    assert.equal(arquivo[1]?.tipoPeriodo, 'year');
  });

  it('dois períodos com o mesmo início e tipos diferentes não se misturam', async () => {
    const f = fakeArquivo([
      noArquivo({ tipo_periodo: 'month', inicio: '2026-07-01', fim: '2026-07-31' }),
      noArquivo({ tipo_periodo: 'season', inicio: '2026-07-01', fim: '2026-09-30' }),
    ]);
    const arquivo = await fetchArquivoDeEdicoes(f.db, 'u-1');
    assert.deepEqual(arquivo.map((e) => e.tipoPeriodo), ['month', 'season']);
  });

  it('a ordem total é (inicio, tipo_periodo, fim, caderno) — a chave menos o dono', async () => {
    const f = fakeArquivo([noArquivo()]);
    await fetchArquivoDeEdicoes(f.db, 'u-1');
    assert.deepEqual(f.capturado.ordens, ['inicio', 'tipo_periodo', 'fim', 'caderno']);
  });

  it('arquivo vazio é lista vazia, não erro', async () => {
    const f = fakeArquivo([]);
    assert.deepEqual(await fetchArquivoDeEdicoes(f.db, 'u-1'), []);
  });

  it('caderno desconhecido explode alto — o CHECK deveria tê-lo recusado', async () => {
    const f = fakeArquivo([noArquivo({ caderno: 'financas' })]);
    await assert.rejects(() => fetchArquivoDeEdicoes(f.db, 'u-1'), /caderno desconhecido no arquivo/);
  });

  it('tipo de período sem edição possível explode alto', async () => {
    const f = fakeArquivo([noArquivo({ tipo_periodo: 'all' })]);
    await assert.rejects(() => fetchArquivoDeEdicoes(f.db, 'u-1'), /tipo de período sem edição possível/);
  });

  /**
   * As duas versões decidem **gasto**, e uma coluna ausente chegaria como
   * `undefined`: toda comparação de versão sairia falsa, e a corrida em massa
   * pagaria o arquivo inteiro achando que nada foi renovado. O `prompt_versao` é
   * o pior dos dois, porque a campanha de um caderno (2.8) percorre **todas** as
   * edições, e não os cinco períodos nomeados.
   */
  it('versão que não é inteiro explode alto — é por elas que a massa decide o gasto', async () => {
    for (const coluna of ['prompt_versao', 'pacote_versao'] as const) {
      for (const ruim of [undefined, null, 'seis', Number.NaN, 6.5]) {
        const f = fakeArquivo([noArquivo({ [coluna]: ruim } as unknown as Partial<ArquivoRow>)]);
        await assert.rejects(
          () => fetchArquivoDeEdicoes(f.db, 'u-1'),
          new RegExp(`${coluna} não é inteiro no arquivo`),
          `${coluna} = ${JSON.stringify(ruim)}`,
        );
      }
    }
  });
});
