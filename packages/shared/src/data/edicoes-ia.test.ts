import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AGG_VERSION } from '../constants/agg-version';
import {
  precisaErrata, toEdicao, upsertEdicao,
  type Edicao, type EdicaoInput, type EdicaoRow,
} from './edicoes-ia';

/**
 * Banco de mentira que **devolve linha diferente da enviada**, de propósito.
 *
 * Se o fake ecoasse o que recebeu, o teste do mapeamento seria uma tautologia:
 * passaria igual com `toEdicao` devolvendo o próprio payload. Devolvendo outra
 * linha, a asserção mede o que interessa — que a edição sai do que o banco
 * respondeu, não do que o cliente mandou.
 */
function fakeDb(devolve: EdicaoRow) {
  const capturado: { tabela?: string; linha?: Record<string, unknown>; opcoes?: unknown } = {};
  const db = {
    from(tabela: string) {
      capturado.tabela = tabela;
      return {
        upsert(linha: Record<string, unknown>, opcoes: unknown) {
          capturado.linha = linha;
          capturado.opcoes = opcoes;
          return { select: () => ({ single: async () => ({ data: devolve, error: null }) }) };
        },
      };
    },
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
    texto: 'o que o banco tinha',
    provedor: 'provedor-do-banco',
    modelo: 'modelo-do-banco',
    prompt_versao: 42,
    pacote_versao: 43,
    motivo_de_parada: 'STOP',
    tokens_entrada: 1,
    tokens_saida: 2,
    agg_version_no_momento: 7,
    gerado_em: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

const ENTRADA: EdicaoInput = {
  tipoPeriodo: 'month',
  inicio: '2026-08-01',
  fim: '2026-08-31',
  texto: 'Agosto teve 21 atividades.',
  provedor: 'provedor-do-cliente',
  modelo: 'modelo-do-cliente',
  promptVersao: 2,
  pacoteVersao: 1,
  motivoDeParada: 'STOP',
  tokensEntrada: 100,
  tokensSaida: 200,
};

function edicao(over: Partial<Edicao> = {}): Edicao {
  return { ...toEdicao(linhaDoBanco()), ...over };
}

describe('upsertEdicao — o carimbo da agregação', () => {
  it('grava a versão vigente sem que ninguém a informe', async () => {
    const { db, capturado } = fakeDb(linhaDoBanco());
    await upsertEdicao(db, 'u-1', ENTRADA);

    assert.equal(capturado.tabela, 'edicoes_ia');
    // O ponto inteiro da story: a linha nasce com a versão, não com nulo.
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
    const e = await upsertEdicao(db, 'u-1', ENTRADA);

    assert.deepEqual(e, {
      tipoPeriodo: 'season',
      inicio: '2026-06-01',
      fim: '2026-08-31',
      texto: 'o que o banco tinha',
      provedor: 'provedor-do-banco',
      modelo: 'modelo-do-banco',
      promptVersao: 42,
      pacoteVersao: 43,
      aggVersionNoMomento: 7,
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
    assert.equal(precisaErrata(edicao({ aggVersionNoMomento: 9 }), 10), true);
  });

  it('não marca nada enquanto a agregação não muda', () => {
    assert.equal(precisaErrata(edicao({ aggVersionNoMomento: 9 }), 9), false);
  });

  /**
   * As 7 edições em produção têm nulo na coluna: foram impressas antes de o
   * carimbo existir. Nulo é "não foi medido", não "igual" — e também não é
   * "diferente": sem saber contra o quê comparar, não há errata a declarar.
   */
  it('linha legada, com nulo, não vira errata', () => {
    assert.equal(precisaErrata(edicao({ aggVersionNoMomento: null }), 9), false);
  });

  /**
   * Zero é uma medida, não uma ausência. Este teste existe para travar a troca
   * do `!= null` por um `if (e.aggVersionNoMomento && …)`, que é a escrita mais
   * natural e engoliria o zero junto com o nulo.
   */
  it('zero é medida: difere de 9, logo é errata', () => {
    assert.equal(precisaErrata(edicao({ aggVersionNoMomento: 0 }), 9), true);
  });

  it('e zero contra zero continua sendo "igual"', () => {
    assert.equal(precisaErrata(edicao({ aggVersionNoMomento: 0 }), 0), false);
  });
});
