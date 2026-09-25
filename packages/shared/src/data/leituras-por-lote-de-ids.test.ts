/**
 * As leituras **por lista de ids** fatiam a lista? — o outro teto do transporte.
 *
 * ## Por que não bastava o arquivo irmão
 *
 * `paginacao-das-leituras.test.ts` mede o teto de **mil linhas**, que corta
 * calado. Este mede o teto da **URL**, que é outro problema com outra resposta —
 * e confundir os dois produz a guarda errada, que foi exatamente o que aconteceu
 * na primeira entrega da Story 2.4b: `fetchRouteOverviewPairs` nasceu paginada,
 * com um caso de teste encenando 1001 linhas para um `.in(['a-1'])`. Impossível
 * pelo schema: `activity_id` é único em `activity_routes`, então **um id nunca
 * devolve duas linhas**. Para cruzar as mil linhas seriam precisos mais de mil
 * ids — e aí o que estoura primeiro é a query string, que volta 414 em vez de
 * cortar em silêncio.
 *
 * A guarda certa, então, é **fatiar a lista de ids antes de perguntar**, e é ela
 * que este arquivo cobra. O precedente é `fetchMediaCounts`, que virou RPC
 * justamente por não caber num `.in()`: o Histórico de Ciclismo tem 338
 * atividades de id textual.
 *
 * O dublê daqui **não** emula corte nenhum: ele registra as fatias pedidas. Uma
 * leitura que mandasse a lista inteira de uma vez aparece aqui como uma fatia só
 * de 450 ids, e reprova com a diferença à vista.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IDS_POR_LOTE } from './paginate';
import { fetchRouteOverviewPairs } from './activities';
import { fetchPhotosByIds } from './activity-photos';

type Linha = Record<string, unknown>;

/**
 * O dublê que **registra as fatias**. Ele responde só o que a fatia pediu, como o
 * servidor: uma leitura que ignorasse o recorte veria linhas que não pediu.
 */
function bancoQueRegistraFatias(tabela: string, coluna: string, linhas: readonly Linha[]) {
  const fatias: string[][] = [];
  const ordens: string[] = [];
  const db = {
    from(nome: string) {
      if (nome !== tabela) throw new Error(`tabela inesperada: ${nome}`);
      let pedidos: string[] = [];
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        in(col: string, ids: string[]) {
          if (col !== coluna) throw new Error(`coluna inesperada no in(): ${col}`);
          pedidos = [...ids];
          fatias.push(pedidos);
          return consulta;
        },
        order(col: string) {
          ordens.push(col);
          return consulta;
        },
        then<A>(ok: (r: { data: unknown; error: unknown }) => A): Promise<A> {
          const pedidas = new Set(pedidos);
          const data = linhas.filter((l) => pedidas.has(String(l[coluna])));
          return Promise.resolve().then(() => ok({ data, error: null }));
        },
      };
      return consulta;
    },
  };
  return { db: db as unknown as SupabaseClient, fatias, ordens };
}

/** Mais que uma fatia cheia e meia: o resto prova que a última fatia não se perde. */
const QUANTOS = IDS_POR_LOTE * 2 + 7;

const id = (k: number): string => `id-${String(k).padStart(4, '0')}`;

const casos: readonly {
  readonly nome: string;
  readonly tabela: string;
  readonly coluna: string;
  readonly linha: (k: number) => Linha;
  readonly ler: (db: SupabaseClient, ids: string[]) => Promise<{ length: number }>;
}[] = [
  {
    nome: 'fetchPhotosByIds',
    tabela: 'activity_photos',
    coluna: 'id',
    linha: (k) => ({
      id: id(k), activity_id: 'a-1', asset_id: `ph-${k}`, taken_at: '2026-08-14T12:38:00.000Z',
      lat: null, lng: null, media_type: 'photo', duration_s: null, route_index: null,
      route_distance_m: null, offset_m: null, on_route: true, state: 'linked', is_cover: false,
    }),
    ler: (db, ids) => fetchPhotosByIds(db, 'u-1', ids),
  },
  {
    nome: 'fetchRouteOverviewPairs',
    tabela: 'activity_routes',
    coluna: 'activity_id',
    linha: (k) => ({ activity_id: id(k), route_overview: [[50.6, 4.3], [50.7, 4.4]] }),
    ler: (db, ids) => fetchRouteOverviewPairs(db, 'u-1', ids),
  },
];

describe('as leituras por lista de ids fatiam antes de perguntar', () => {
  for (const caso of casos) {
    it(`${caso.nome} corta a lista em fatias de ${IDS_POR_LOTE}`, async () => {
      const ids = Array.from({ length: QUANTOS }, (_, k) => id(k));
      const { db, fatias } = bancoQueRegistraFatias(
        caso.tabela, caso.coluna, ids.map((_, k) => caso.linha(k)),
      );
      const lido = await caso.ler(db, ids);
      assert.equal(lido.length, QUANTOS, `${caso.nome} perdeu linhas ao fatiar`);
      assert.deepEqual(
        fatias.map((f) => f.length),
        [IDS_POR_LOTE, IDS_POR_LOTE, QUANTOS - IDS_POR_LOTE * 2],
        `${caso.nome}: uma fatia só é a lista inteira na URL — 414, não corte calado`,
      );
      // As fatias cobrem a lista, sem repetir e sem pular.
      assert.deepEqual(fatias.flat(), ids, `${caso.nome}: as fatias não cobrem a lista`);
    });

    it(`${caso.nome} não vai ao banco com lista vazia`, async () => {
      const { db, fatias } = bancoQueRegistraFatias(caso.tabela, caso.coluna, []);
      assert.deepEqual(await caso.ler(db, []), []);
      assert.deepEqual(fatias, [], `${caso.nome} pediu ao banco para receber zero linhas`);
    });

    it(`${caso.nome} ordena pela coluna da chave — resposta estável entre chamadas`, async () => {
      const ids = [id(2), id(0), id(1)];
      const { db, ordens } = bancoQueRegistraFatias(
        caso.tabela, caso.coluna, ids.map((_, k) => caso.linha(k)),
      );
      await caso.ler(db, ids);
      assert.deepEqual(ordens, [caso.coluna], `${caso.nome}: a ordenação pedida`);
    });
  }
});

/**
 * A prova de que o problema é real: uma lista que caberia numa fatia não é
 * fatiada, e uma que não cabe é. Sem esta, um `IDS_POR_LOTE` enorme passaria nos
 * casos acima por nunca cortar nada.
 */
describe('o limite tem efeito', () => {
  it('lista menor que o limite vai numa fatia só', async () => {
    const ids = Array.from({ length: IDS_POR_LOTE }, (_, k) => id(k));
    const { db, fatias } = bancoQueRegistraFatias(
      'activity_routes', 'activity_id', ids.map((_, k) => ({ activity_id: id(k), route_overview: [] })),
    );
    await fetchRouteOverviewPairs(db, 'u-1', ids);
    assert.deepEqual(fatias.map((f) => f.length), [IDS_POR_LOTE]);
  });

  it('um id a mais já parte em duas', async () => {
    const ids = Array.from({ length: IDS_POR_LOTE + 1 }, (_, k) => id(k));
    const { db, fatias } = bancoQueRegistraFatias(
      'activity_routes', 'activity_id', ids.map((_, k) => ({ activity_id: id(k), route_overview: [] })),
    );
    await fetchRouteOverviewPairs(db, 'u-1', ids);
    assert.deepEqual(fatias.map((f) => f.length), [IDS_POR_LOTE, 1]);
  });
});

/**
 * `fetchPhotosByIds` **não filtra por estado**, e isso é o ponto dela: a foto que
 * o dono desligou depois do carimbo continua sendo a capa daquela edição. A
 * leitura por atividade (`fetchPhotosForActivities`) filtra `linked`, e era daí
 * que vinha o buraco que a Story 2.4b fechou.
 */
describe('fetchPhotosByIds traz a foto desligada', () => {
  it('a capa que o dono desligou depois do carimbo continua achável', async () => {
    const { db } = bancoQueRegistraFatias('activity_photos', 'id', [{
      id: 'f-1', activity_id: 'a-1', asset_id: 'ph-1', taken_at: '2026-08-14T12:38:00.000Z',
      lat: null, lng: null, media_type: 'photo', duration_s: null, route_index: null,
      route_distance_m: null, offset_m: null, on_route: true, state: 'dismissed', is_cover: false,
    }]);
    const fotos = await fetchPhotosByIds(db, 'u-1', ['f-1']);
    assert.deepEqual(fotos.map((f) => [f.id, f.state]), [['f-1', 'dismissed']]);
  });
});
