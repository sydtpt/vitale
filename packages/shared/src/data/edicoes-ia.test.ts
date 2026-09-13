import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AGG_VERSION } from '../constants/agg-version';
import {
  EDICAO_COLUMNS, fetchEdicao, precisaErrata, toCadernoImpresso, upsertEdicao,
  type CadernoImpresso, type EdicaoInput, type EdicaoRow,
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
 * Banco de mentira que **devolve linha diferente da enviada**, de propósito.
 *
 * Se o fake ecoasse o que recebeu, o teste do mapeamento seria uma tautologia:
 * passaria igual com `toCadernoImpresso` devolvendo o próprio payload.
 * Devolvendo outra linha, a asserção mede o que interessa — que o caderno sai do
 * que o banco respondeu, não do que o cliente mandou.
 */
function fakeDb(devolve: EdicaoRow) {
  const capturado: {
    tabela?: string; linha?: Record<string, unknown>; opcoes?: unknown; colunas?: string;
  } = {};
  const db = {
    from(tabela: string) {
      capturado.tabela = tabela;
      return {
        upsert(linha: Record<string, unknown>, opcoes: unknown) {
          capturado.linha = linha;
          capturado.opcoes = opcoes;
          return {
            select: (cols: string) => {
              capturado.colunas = cols;
              return { single: async () => ({ data: projetar(devolve, cols), error: null }) };
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as SupabaseClient, capturado };
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

const ENTRADA: EdicaoInput = {
  tipoPeriodo: 'month',
  inicio: '2026-08-01',
  fim: '2026-08-31',
  caderno: 'movimento',
  posicao: 1,
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

  it('a leitura e a gravação pedem a mesma lista', async () => {
    const leitura = fakeLeitura([linhaDoBanco({ posicao: 1 })]);
    await fetchEdicao(leitura.db, 'u-1', 'month', '2026-08-01', '2026-08-31');
    const escrita = fakeDb(linhaDoBanco());
    await upsertEdicao(escrita.db, 'u-1', ENTRADA);
    assert.equal(leitura.capturado.colunas, escrita.capturado.colunas);
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

describe('upsertEdicao — a chave nova e o carimbo da agregação', () => {
  /**
   * A chave velha (`user_id,tipo_periodo,inicio,fim`) vira 42P10 depois da
   * migração: não existe mais constraint única com esses quatro. O erro chega
   * como "there is no unique or exclusion constraint matching the ON CONFLICT
   * specification", que não aponta para lugar nenhum.
   */
  it('casa o conflito pela chave que inclui o caderno', async () => {
    const { db, capturado } = fakeDb(linhaDoBanco());
    await upsertEdicao(db, 'u-1', ENTRADA);
    assert.deepEqual(capturado.opcoes, { onConflict: 'user_id,tipo_periodo,inicio,fim,caderno' });
  });

  it('grava caderno, posição e a métrica líder', async () => {
    const { db, capturado } = fakeDb(linhaDoBanco());
    await upsertEdicao(db, 'u-1', ENTRADA);
    assert.equal(capturado.tabela, 'edicoes_ia');
    assert.equal(capturado.linha!.caderno, 'movimento');
    assert.equal(capturado.linha!.posicao, 1);
    assert.equal(capturado.linha!.metrica_lider, 'distancia');
  });

  it('nulo da métrica líder é gravado como nulo, não omitido', async () => {
    const { db, capturado } = fakeDb(linhaDoBanco({ metrica_lider: null }));
    await upsertEdicao(db, 'u-1', { ...ENTRADA, metricaLider: null });
    assert.ok('metrica_lider' in capturado.linha!);
    assert.equal(capturado.linha!.metrica_lider, null);
  });

  it('grava a versão vigente da agregação sem que ninguém a informe', async () => {
    const { db, capturado } = fakeDb(linhaDoBanco());
    await upsertEdicao(db, 'u-1', ENTRADA);

    // O ponto inteiro da 1.1: a linha nasce com a versão, não com nulo — e desde
    // a 1.9 a coluna é `not null`, então nulo aqui morreria no banco.
    assert.equal(capturado.linha!.agg_version_no_momento, AGG_VERSION);
    assert.notEqual(capturado.linha!.agg_version_no_momento, null);
  });

  it('ignora a versão que um hospedeiro tente empurrar', async () => {
    const { db, capturado } = fakeDb(linhaDoBanco());
    // `tsc` já recusa este objeto — `EdicaoInput` não tem o campo, e é assim que
    // a garantia é dada. O cast força o caso mesmo assim, para provar que a
    // gravação não tem uma segunda porta por onde o valor errado entre em JS.
    await upsertEdicao(db, 'u-1', { ...ENTRADA, aggVersionNoMomento: 1 } as EdicaoInput);
    assert.equal(capturado.linha!.agg_version_no_momento, AGG_VERSION);
  });

  it('devolve a linha do banco, não o que foi enviado', async () => {
    const { db } = fakeDb(linhaDoBanco());
    const c = await upsertEdicao(db, 'u-1', ENTRADA);

    assert.deepEqual(c, {
      tipoPeriodo: 'season',
      inicio: '2026-06-01',
      fim: '2026-08-31',
      caderno: 'coracao',
      posicao: 3,
      texto: 'o que o banco tinha',
      provedor: 'provedor-do-banco',
      modelo: 'modelo-do-banco',
      promptVersao: 42,
      pacoteVersao: 43,
      aggVersionNoMomento: 7,
      metricaLider: 'fc_repouso',
      geradoEm: '2026-09-01T00:00:00.000Z',
    });
  });

  it('propaga o erro do banco em vez de devolver edição vazia', async () => {
    const db = {
      from: () => ({
        upsert: () => ({
          select: () => ({ single: async () => ({ data: null, error: new Error('rls') }) }),
        }),
      }),
    } as unknown as SupabaseClient;
    await assert.rejects(() => upsertEdicao(db, 'u-1', ENTRADA), /rls/);
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
