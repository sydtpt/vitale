/**
 * O acesso a `activity_photos` — a leitura por id, que é a ponte entre a capa
 * carimbada e a imagem que a rota da revista desenha (Story 1.13).
 *
 * `edicoes_capa` guarda `foto_id` e o instante da captura — **valor, nunca
 * ponteiro**, porque o `localIdentifier` do PhotoKit não é estável (ADR 0037). Mas
 * desenhar exige o ponteiro de hoje, e é `fetchPhotoById` que o traz. O que se
 * protege aqui é o contrato dessa consulta:
 *
 * - **filtra pelo dono**, além do id: sem `user_id` a RLS seria a única rede, e
 *   uma barreira de servidor não é lugar de regra de leitura;
 * - **`null` é resposta legítima**, e não erro — a foto pode ter saído do acervo, e
 *   a capa cai para o papel com a legenda carimbada;
 * - **os `numeric` do Postgres chegam como string** e voltam número, senão a
 *   comparação de distância na legenda ficaria lexicográfica.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPhotoById } from './activity-photos';

function linha(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p-1',
    activity_id: 'a-1',
    asset_id: 'ph-abc',
    taken_at: '2026-08-14T10:38:00.000Z',
    lat: '50.641',
    lng: '4.262',
    media_type: 'photo',
    duration_s: null,
    route_index: 120,
    route_distance_m: '31100.5',
    offset_m: '4',
    on_route: true,
    state: 'linked',
    is_cover: false,
    ...over,
  };
}

/** Molde do `fakeCapa` do módulo irmão: guarda o que foi pedido, responde o que se mandar. */
function fakeFoto(data: Record<string, unknown> | null, erro: Error | null = null) {
  const capturado: { tabela?: string; colunas?: string; filtros: Record<string, unknown> } = { filtros: {} };
  const alvo = {
    eq(coluna: string, valor: unknown) {
      capturado.filtros[coluna] = valor;
      return alvo;
    },
    // `id` é a chave primária: uma linha é o máximo que existe.
    maybeSingle: async () => ({ data: erro ? null : data, error: erro }),
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

describe('fetchPhotoById', () => {
  it('pede a linha pelo dono E pelo id', async () => {
    const { db, capturado } = fakeFoto(linha());
    await fetchPhotoById(db, 'u-1', 'p-1');
    assert.equal(capturado.tabela, 'activity_photos');
    assert.deepEqual(capturado.filtros, { user_id: 'u-1', id: 'p-1' });
  });

  it('pede as colunas que o modelo lê — inclusive o ponteiro e o tipo de mídia', async () => {
    const { db, capturado } = fakeFoto(linha());
    await fetchPhotoById(db, 'u-1', 'p-1');
    const pedidas = capturado.colunas!.split(',').map((c) => c.trim());
    for (const c of ['id', 'asset_id', 'taken_at', 'media_type', 'duration_s']) {
      assert.ok(pedidas.includes(c), `a consulta não pede ${c} — chegaria undefined na tela`);
    }
  });

  it('devolve a foto já mapeada, com os numeric virados número', async () => {
    const { db } = fakeFoto(linha());
    const p = await fetchPhotoById(db, 'u-1', 'p-1');
    assert.equal(p?.assetId, 'ph-abc');
    assert.equal(p?.mediaType, 'photo');
    assert.equal(p?.takenAt, Date.parse('2026-08-14T10:38:00.000Z'));
    assert.equal(p?.routeDistanceM, 31100.5);
    assert.equal(p?.lat, 50.641);
  });

  it('o vídeo atravessa com a duração — é o pôster que a capa desenha', async () => {
    const { db } = fakeFoto(linha({ media_type: 'video', duration_s: '12.5' }));
    const p = await fetchPhotoById(db, 'u-1', 'p-1');
    assert.equal(p?.mediaType, 'video');
    assert.equal(p?.durationS, 12.5);
  });

  /**
   * A linha saiu do acervo — e isso **não é erro**: a cura da ADR 0037 reendereça
   * ponteiro trocado, não ressuscita registro apagado. A capa cai para o papel com
   * a legenda carimbada, que continua dizendo onde o período aconteceu.
   */
  it('linha que não existe mais devolve null, e não lança', async () => {
    const { db } = fakeFoto(null);
    assert.equal(await fetchPhotoById(db, 'u-1', 'sumiu'), null);
  });

  it('propaga o erro do banco', async () => {
    const { db } = fakeFoto(null, new Error('rls'));
    await assert.rejects(() => fetchPhotoById(db, 'u-1', 'p-1'), /rls/);
  });
});
