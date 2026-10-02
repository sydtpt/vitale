/**
 * As portas da Presença, cobradas no que elas prometem ao chamador.
 *
 * Três coisas aqui existem porque errá-las não dá erro — dá número errado:
 *   - o `onConflict` de `place_days` precisa ser a chave do índice `nulls not
 *     distinct`, senão o lugar "fora" duplica a cada recálculo (em SQL, nulo ≠ nulo);
 *   - `fetchPlaceDays` é a leitura longa e **tem** que paginar: um ano com três
 *     lugares passa de 1000 linhas, que é exatamente o teto que a tabela existe para
 *     evitar;
 *   - `mudarDeEndereco` não pode editar `lat`/`lng` da linha, por mais tentador que
 *     seja: isso preserva a métrica e apaga a história de onde era a casa.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  VISITAS_POR_LOTE,
  enviarVisitas,
  fetchPlaceDays,
  gravarPlaceDays,
  type VisitaParaEnviar,
} from './presence';
import { mudarDeEndereco, vigenteEm, type Lugar } from './places';

function visita(over: Partial<VisitaParaEnviar> = {}): VisitaParaEnviar {
  return {
    placeId: 'p-casa',
    source: 'geofence',
    clientEventId: 'p-casa:enter:2026-09-07T14:33:00.000Z',
    arrivedAt: '2026-09-07T14:33:00.000Z',
    departedAt: '2026-09-08T09:28:00.000Z',
    departedSource: 'geofence',
    tz: 'Europe/Brussels',
    ...over,
  };
}

function fakeUpsert() {
  const chamadas: Array<{ tabela: string; linhas: unknown[]; opcoes: unknown }> = [];
  const db = {
    from(tabela: string) {
      return {
        upsert(linhas: unknown[], opcoes: unknown) {
          chamadas.push({ tabela, linhas, opcoes });
          return Promise.resolve({ error: null });
        },
      };
    },
  } as unknown as SupabaseClient;
  return { db, chamadas };
}

describe('enviarVisitas', () => {
  it('deduplica por client_event_id, não por id', async () => {
    const { db, chamadas } = fakeUpsert();
    await enviarVisitas(db, 'u1', [visita()]);
    assert.equal(chamadas[0]!.tabela, 'visits');
    assert.deepEqual(chamadas[0]!.opcoes, { onConflict: 'user_id,client_event_id' });
    const linha = chamadas[0]!.linhas[0] as Record<string, unknown>;
    assert.equal(linha['user_id'], 'u1');
    assert.equal(linha['client_event_id'], 'p-casa:enter:2026-09-07T14:33:00.000Z');
    assert.equal(linha['status'], 'provisional', 'nasce provisional, como o modelo manda');
  });

  it('a visita aberta sobe com departed_at nulo — e não como agora', async () => {
    const { db, chamadas } = fakeUpsert();
    await enviarVisitas(db, 'u1', [visita({ departedAt: null, departedSource: null })]);
    const linha = chamadas[0]!.linhas[0] as Record<string, unknown>;
    assert.equal(linha['departed_at'], null);
    assert.equal(linha['departed_source'], null);
  });

  it('quebra em lotes', async () => {
    const { db, chamadas } = fakeUpsert();
    const muitas = Array.from({ length: VISITAS_POR_LOTE + 7 }, (_, i) =>
      visita({ clientEventId: `e${i}` }),
    );
    const n = await enviarVisitas(db, 'u1', muitas);
    assert.equal(n, muitas.length);
    assert.equal(chamadas.length, 2);
    assert.equal(chamadas[0]!.linhas.length, VISITAS_POR_LOTE);
    assert.equal(chamadas[1]!.linhas.length, 7);
  });
});

describe('gravarPlaceDays', () => {
  it('usa a chave do índice nulls-not-distinct, senão o lugar "fora" duplica', async () => {
    const { db, chamadas } = fakeUpsert();
    await gravarPlaceDays(db, 'u1', [
      { day: '2026-09-15', placeId: null, identidade: null, seconds: 15000.4, arrivals: 0, inferredEdges: 0 },
    ]);
    assert.deepEqual(chamadas[0]!.opcoes, { onConflict: 'user_id,day,place_id' });
    const linha = chamadas[0]!.linhas[0] as Record<string, unknown>;
    assert.equal(linha['place_id'], null, 'nulo é o lugar "fora", não ausência de dado');
    assert.equal(linha['seconds'], 15000, 'segundo é inteiro no banco');
  });

  it('carrega a identidade junto, que é por onde a métrica agrega', async () => {
    const { db, chamadas } = fakeUpsert();
    await gravarPlaceDays(db, 'u1', [
      { day: '2026-09-15', placeId: 'p-casa', identidade: 'casa', seconds: 100, arrivals: 1, inferredEdges: 0 },
    ]);
    assert.equal((chamadas[0]!.linhas[0] as Record<string, unknown>)['identidade'], 'casa');
  });

  it('lista vazia não chama o banco', async () => {
    const { db, chamadas } = fakeUpsert();
    await gravarPlaceDays(db, 'u1', []);
    assert.equal(chamadas.length, 0);
  });
});

describe('fetchPlaceDays', () => {
  it('pagina — o rollup de um ano passa do teto que ele existe para evitar', async () => {
    const faixas: Array<[number, number]> = [];
    const db = {
      from() {
        const alvo = {
          select: () => alvo,
          eq: () => alvo,
          gte: () => alvo,
          lte: () => alvo,
          order: () => alvo,
          range(from: number, to: number) {
            faixas.push([from, to]);
            // Primeira página cheia, segunda curta: é a única condição de parada
            // confiável, já que a resposta não traz contagem total.
            const n = faixas.length === 1 ? 1000 : 95;
            return Promise.resolve({ data: Array.from({ length: n }, () => ({})), error: null });
          },
        };
        return alvo;
      },
    } as unknown as SupabaseClient;

    const linhas = await fetchPlaceDays(db, 'u1', '2026-01-01', '2026-12-31');
    assert.equal(linhas.length, 1095);
    assert.deepEqual(faixas, [
      [0, 999],
      [1000, 1999],
    ]);
  });
});

/* ── a exigência do dono: mudar de casa sem perder métrica ──────────────── */

function lugar(over: Partial<Lugar> = {}): Lugar {
  return {
    id: 'p1',
    identidade: 'casa',
    kind: 'home',
    label: 'Casa',
    lat: 50.87,
    lng: 4.37,
    radiusM: 400,
    geofenceRadiusM: 150,
    geofenceSlot: 0,
    module: 'casa',
    isPrivate: false,
    activeFrom: '2025-01-24',
    activeTo: '2026-06-20',
    derived: true,
    ...over,
  };
}

describe('vigenteEm', () => {
  const lugares = [
    lugar(),
    lugar({ id: 'p2', activeFrom: '2026-06-21', activeTo: null, lat: 50.9, derived: false }),
  ];

  it('acha o endereço que valia naquele dia', () => {
    assert.equal(vigenteEm(lugares, 'casa', '2026-03-10')!.id, 'p1');
    assert.equal(vigenteEm(lugares, 'casa', '2026-09-15')!.id, 'p2');
  });

  it('a borda pertence a quem a declara', () => {
    assert.equal(vigenteEm(lugares, 'casa', '2026-06-20')!.id, 'p1');
    assert.equal(vigenteEm(lugares, 'casa', '2026-06-21')!.id, 'p2');
  });

  it('antes da primeira vigência, ninguém', () => {
    assert.equal(vigenteEm(lugares, 'casa', '2024-12-31'), undefined);
  });

  it('identidade desconhecida não devolve a casa por engano', () => {
    assert.equal(vigenteEm(lugares, 'escritorio', '2026-09-15'), undefined);
  });
});

describe('mudarDeEndereco', () => {
  it('fecha a vigente na véspera e abre outra com a MESMA identidade', async () => {
    const atualizacoes: Array<Record<string, unknown>> = [];
    const insercoes: Array<Record<string, unknown>> = [];
    const db = {
      from() {
        const alvo: Record<string, unknown> = {
          update(row: Record<string, unknown>) {
            atualizacoes.push(row);
            return alvo;
          },
          insert(row: Record<string, unknown>) {
            insercoes.push(row);
            return Promise.resolve({ error: null });
          },
          select: () => alvo,
          eq: () => alvo,
          is: () => alvo,
          order: () => alvo,
          then: (resolver: (v: unknown) => unknown) =>
            resolver({ data: [{ id: 'p1', user_id: 'u1', identidade: 'casa', kind: 'home', label: 'Casa', lat: 50.87, lng: 4.37, radius_m: 400, geofence_radius_m: 150, geofence_slot: 0, module: 'casa', is_private: false, active_from: '2025-01-24', active_to: null, derived: true }], error: null }),
        };
        return alvo;
      },
    } as unknown as SupabaseClient;

    await mudarDeEndereco(db, 'u1', 'casa', {
      lat: 50.9,
      lng: 4.4,
      geofenceRadiusM: 150,
      a_partir_de: '2026-06-21',
    });

    assert.deepEqual(atualizacoes, [{ active_to: '2026-06-20' }], 'fecha na véspera, não no dia');
    assert.equal(insercoes.length, 1);
    assert.equal(insercoes[0]!['identidade'], 'casa', 'a identidade é o que atravessa');
    assert.equal(insercoes[0]!['active_from'], '2026-06-21');
    assert.equal(insercoes[0]!['derived'], false, 'endereço dado pelo dono, não derivado');
    assert.equal(insercoes[0]!['geofence_slot'], 0, 'herda a vaga do iOS: é o mesmo lugar');
    assert.ok(
      !atualizacoes.some((u) => 'lat' in u || 'lng' in u),
      'NUNCA edita a coordenada da linha antiga — isso apagaria a história das rotas',
    );
  });
});
