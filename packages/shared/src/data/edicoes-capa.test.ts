import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CAPA_COLUMNS, fetchCapa, isNaturezaDaCapa, toCapa, NATUREZAS_DA_CAPA,
  type CapaRow,
} from './edicoes-capa';

/** Projeta pelo que foi pedido, como o PostgREST — ver a nota em `edicoes-ia.test.ts`. */
function projetar(linha: CapaRow, cols: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of cols.split(',').map((x) => x.trim())) {
    if (!(c in linha)) throw new Error(`coluna pedida que a tabela não tem: ${c}`);
    out[c] = (linha as unknown as Record<string, unknown>)[c];
  }
  return out;
}

function linhaDoBanco(over: Partial<CapaRow> = {}): CapaRow {
  return {
    user_id: 'u-do-banco',
    tipo_periodo: 'month',
    inicio: '2026-08-01',
    fim: '2026-08-31',
    natureza: 'foto',
    foto_id: 'f1e2d3c4-0000-4000-8000-000000000001',
    foto_taken_at: '2026-08-14T12:38:00.000Z',
    rota_activity_id: null,
    legenda: 'Ittre · km 31,1 · 12:38',
    carimbada_em: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

function fakeCapa(linha: CapaRow | null) {
  const capturado: { tabela?: string; colunas?: string; filtros: Record<string, unknown> } = {
    filtros: {},
  };
  const alvo = {
    eq(coluna: string, valor: unknown) {
      capturado.filtros[coluna] = valor;
      return alvo;
    },
    // A chave desta tabela É a edição inteira, então uma linha é o máximo que
    // existe e `maybeSingle` é correto aqui — ao contrário de `edicoes_ia`, que
    // ganhou o caderno na chave.
    maybeSingle: async () => ({
      data: linha ? projetar(linha, capturado.colunas!) : null,
      error: null,
    }),
  };
  const db = {
    from(tabela: string) {
      capturado.tabela = tabela;
      return {
        select(cols: string) {
          capturado.colunas = cols;
          return alvo;
        },
      };
    },
  };
  return { db: db as unknown as SupabaseClient, capturado };
}

describe('CAPA_COLUMNS', () => {
  it('pede exatamente as colunas que a linha tem', () => {
    assert.deepEqual(
      CAPA_COLUMNS.split(',').map((c) => c.trim()).sort(),
      Object.keys(linhaDoBanco()).sort(),
    );
  });
});

describe('isNaturezaDaCapa — o vocabulário fechado', () => {
  it('aceita as três, e só as três', () => {
    assert.deepEqual([...NATUREZAS_DA_CAPA], ['foto', 'tracado', 'grade']);
    for (const n of NATUREZAS_DA_CAPA) assert.equal(isNaturezaDaCapa(n), true);
  });

  it('recusa o que não é natureza', () => {
    for (const v of ['mapa', 'FOTO', '', null, undefined, 3, {}]) {
      assert.equal(isNaturezaDaCapa(v), false, `aceitou ${JSON.stringify(v)}`);
    }
  });
});

describe('toCapa — a linha vira capa', () => {
  it('mapeia snake para camel, com a identidade da foto', () => {
    assert.deepEqual(toCapa(linhaDoBanco()), {
      tipoPeriodo: 'month',
      inicio: '2026-08-01',
      fim: '2026-08-31',
      natureza: 'foto',
      fotoId: 'f1e2d3c4-0000-4000-8000-000000000001',
      // A chave de cura da ADR 0037 atravessa: sem ela a foto não se re-casa
      // depois de uma troca de iPhone.
      fotoTakenAt: '2026-08-14T12:38:00.000Z',
      rotaActivityId: null,
      legenda: 'Ittre · km 31,1 · 12:38',
      carimbadaEm: '2026-09-01T00:00:00.000Z',
    });
  });

  it('a capa de traçado não tem foto, e a de grade não tem nenhuma das duas', () => {
    const tracado = toCapa(linhaDoBanco({
      natureza: 'tracado', foto_id: null, foto_taken_at: null, rota_activity_id: 'a-42',
    }));
    assert.equal(tracado.natureza, 'tracado');
    assert.equal(tracado.rotaActivityId, 'a-42');
    assert.equal(tracado.fotoId, null);

    const grade = toCapa(linhaDoBanco({
      natureza: 'grade', foto_id: null, foto_taken_at: null, rota_activity_id: null,
    }));
    assert.equal(grade.natureza, 'grade');
    assert.equal(grade.fotoId, null);
    assert.equal(grade.rotaActivityId, null);
  });

  /**
   * O CHECK do banco torna isto impossível — e é por isso que o cast era a
   * escrita tentadora. Se o valor estranho chegasse, ele atravessaria até a tela
   * e o sintoma apareceria longe daqui.
   */
  it('natureza desconhecida explode na fronteira, em vez de virar cast', () => {
    assert.throws(
      () => toCapa(linhaDoBanco({ natureza: 'mapa' })),
      /natureza de capa desconhecida/,
    );
  });
});

describe('fetchCapa', () => {
  it('filtra pela chave da edição inteira', async () => {
    const { db, capturado } = fakeCapa(linhaDoBanco());
    await fetchCapa(db, 'u-1', 'month', '2026-08-01', '2026-08-31');
    assert.equal(capturado.tabela, 'edicoes_capa');
    assert.deepEqual(capturado.filtros, {
      user_id: 'u-1',
      tipo_periodo: 'month',
      inicio: '2026-08-01',
      fim: '2026-08-31',
    });
  });

  it('devolve a capa carimbada', async () => {
    const { db } = fakeCapa(linhaDoBanco());
    const c = await fetchCapa(db, 'u-1', 'month', '2026-08-01', '2026-08-31');
    assert.equal(c?.legenda, 'Ittre · km 31,1 · 12:38');
  });

  it('edição sem capa devolve null', async () => {
    const { db } = fakeCapa(null);
    assert.equal(await fetchCapa(db, 'u-1', 'month', '2026-08-01', '2026-08-31'), null);
  });

  it('propaga o erro do banco', async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq() { return this; },
          maybeSingle: async () => ({ data: null, error: new Error('rls') }),
        }),
      }),
    } as unknown as SupabaseClient;
    await assert.rejects(() => fetchCapa(db, 'u-1', 'month', '2026-08-01', '2026-08-31'), /rls/);
  });
});
