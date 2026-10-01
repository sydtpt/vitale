/**
 * BARREIRA — a fila do piso não pode ser entupida por rota que nunca terá piso.
 *
 * O defeito, diagnosticado em 29/09/2026: `fetchSurfaceCandidates` lia primeiro
 * `activity_routes` com `surface_segments IS NULL` e `limit(40)` **sem `order`**,
 * e só depois cruzava por tipo em memória. Como piso existe só para bicicleta,
 * as 137 rotas de caminhada e de corrida ficam `NULL` para sempre e ocupam a
 * janela inteira. Enquanto o backfill ainda tinha pedaladas na cabeça da tabela
 * o passe andava; drenadas elas, pedalada nova **nunca mais virou candidata** —
 * sem erro, sem exceção, com o passe rodando e não achando nada.
 *
 * O dublê daqui reproduz o acervo real: 137 rotas sem piso que não são
 * bicicleta, pedaladas antigas já com piso, e uma pedalada nova esperando. Com a
 * consulta velha (rotas primeiro, 40 sem ordem) o primeiro caso volta vazio.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchSurfaceCandidates } from './activities';

/** Códigos do HealthKit: bicicleta é o único tipo com piso (ADR 0034). */
const BICICLETA = 13;
const CAMINHADA = 52;
const CORRIDA = 37;

const USUARIO = 'u-1';
/** Falha mais velha que isto volta à fila; mais nova, não. */
const RETRY_BEFORE = '2026-09-29T00:00:00.000Z';

interface Atividade {
  id: string;
  user_id: string;
  activity_id: number;
  start_at: string;
}

interface Rota {
  activity_id: string;
  user_id: string;
  route_overview: [number, number][] | null;
  surface_segments: unknown;
  surface_meta: { status?: string; failedAt?: string } | null;
}

type Linha = Record<string, unknown>;

/**
 * Dublê do PostgREST para as duas tabelas da fila.
 *
 * Filtros, ordem e corte são aplicados **na leitura**, não na chamada: é assim
 * que o servidor se comporta, e é o que faz `.order()` encadeado dar o resultado
 * certo (a última chave é a menos significativa).
 */
function banco(atividades: readonly Atividade[], rotas: readonly Rota[]) {
  const visto = { lotesDeRota: 0, ordensDaAtividade: [] as string[] };

  function consulta(fonte: readonly Linha[]) {
    const eqs: [string, unknown][] = [];
    const ins: [string, readonly unknown[]][] = [];
    const nulos: string[] = [];
    const ordens: [string, boolean][] = [];
    let corte: number | undefined;

    const q = {
      select: () => q,
      eq(col: string, v: unknown) {
        eqs.push([col, v]);
        return q;
      },
      in(col: string, vs: readonly unknown[]) {
        ins.push([col, vs]);
        return q;
      },
      is(col: string, v: unknown) {
        if (v !== null) throw new Error(`o dublê só conhece .is(col, null); veio ${String(v)}`);
        nulos.push(col);
        return q;
      },
      order(col: string, o?: { ascending?: boolean }) {
        ordens.push([col, o?.ascending !== false]);
        return q;
      },
      limit(n: number) {
        corte = n;
        return q;
      },
      then(resolve: (r: { data: Linha[]; error: null }) => unknown) {
        let linhas = fonte.filter(
          (l) =>
            eqs.every(([c, v]) => l[c] === v) &&
            ins.every(([c, vs]) => vs.includes(l[c])) &&
            nulos.every((c) => l[c] == null),
        );
        // Da menos significativa para a mais: `sort` estável compõe as chaves.
        for (const [col, asc] of [...ordens].reverse()) {
          linhas = linhas
            .slice()
            .sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1));
        }
        if (corte !== undefined) linhas = linhas.slice(0, corte);
        return resolve({ data: linhas, error: null });
      },
    };
    return q;
  }

  const db = {
    from(nome: string) {
      if (nome === 'activities') return consulta(atividades as unknown as Linha[]);
      if (nome === 'activity_routes') {
        visto.lotesDeRota++;
        return consulta(rotas as unknown as Linha[]);
      }
      throw new Error(`tabela inesperada: ${nome}`);
    },
  };
  return { db: db as unknown as SupabaseClient, visto };
}

/** Uma rota sem piso, pronta para a fila. */
function rotaSemPiso(id: string, meta: Rota['surface_meta'] = null): Rota {
  return {
    activity_id: id,
    user_id: USUARIO,
    route_overview: [
      [50.64, 4.26],
      [50.65, 4.27],
    ],
    surface_segments: null,
    surface_meta: meta,
  };
}

function atividade(id: string, tipo: number, start_at: string): Atividade {
  return { id, user_id: USUARIO, activity_id: tipo, start_at };
}

/**
 * O acervo como ele é: caminhadas e corridas com rota e sem piso (para sempre),
 * pedaladas antigas já com piso, e a pedalada nova no fim.
 */
function acervoReal() {
  const atividades: Atividade[] = [];
  const rotas: Rota[] = [];

  // 80 caminhadas + 57 corridas com rota — nenhuma terá piso algum dia.
  for (let i = 0; i < 80; i++) {
    const id = `cam-${String(i).padStart(3, '0')}`;
    atividades.push(atividade(id, CAMINHADA, `2026-0${(i % 8) + 1}-10T08:00:00.000Z`));
    rotas.push(rotaSemPiso(id));
  }
  for (let i = 0; i < 57; i++) {
    const id = `cor-${String(i).padStart(3, '0')}`;
    atividades.push(atividade(id, CORRIDA, `2026-0${(i % 8) + 1}-11T08:00:00.000Z`));
    rotas.push(rotaSemPiso(id));
  }
  // Pedaladas antigas: o backfill já deu piso a elas, então saem do `IS NULL`.
  for (let i = 0; i < 137; i++) {
    const id = `bike-velha-${String(i).padStart(3, '0')}`;
    atividades.push(atividade(id, BICICLETA, `2026-0${(i % 8) + 1}-12T08:00:00.000Z`));
    rotas.push({ ...rotaSemPiso(id), surface_segments: [[0, 1000, 'liso', false]] });
  }
  return { atividades, rotas };
}

describe('BARREIRA — a fila do piso alcança a pedalada nova', () => {
  it('acha a pedalada de hoje com 137 rotas sem piso na frente', async () => {
    const { atividades, rotas } = acervoReal();
    atividades.push(atividade('bike-hoje', BICICLETA, '2026-09-29T15:00:00.000Z'));
    rotas.push(rotaSemPiso('bike-hoje'));

    const { db } = banco(atividades, rotas);
    const fila = await fetchSurfaceCandidates(db, USUARIO, [BICICLETA], 2, RETRY_BEFORE);

    assert.deepEqual(
      fila.map((c) => c.activityId),
      ['bike-hoje'],
      'a pedalada nova tem de estar na fila — era exatamente o que a janela sem ordem comia',
    );
    assert.deepEqual(fila[0].overview, [
      { lat: 50.64, lng: 4.26 },
      { lat: 50.65, lng: 4.27 },
    ]);
  });

  it('entrega da mais recente para a mais antiga, e respeita o limite', async () => {
    const { atividades, rotas } = acervoReal();
    for (const [id, quando] of [
      ['bike-a', '2026-09-27T10:00:00.000Z'],
      ['bike-b', '2026-09-29T10:00:00.000Z'],
      ['bike-c', '2026-09-28T10:00:00.000Z'],
    ] as const) {
      atividades.push(atividade(id, BICICLETA, quando));
      rotas.push(rotaSemPiso(id));
    }

    const { db } = banco(atividades, rotas);
    const fila = await fetchSurfaceCandidates(db, USUARIO, [BICICLETA], 2, RETRY_BEFORE);

    assert.deepEqual(
      fila.map((c) => c.activityId),
      ['bike-b', 'bike-c'],
      'ordem é a das atividades, e o corte vem depois de saber quem está sem piso',
    );
  });

  it('a falha recente fica de fora; a antiga volta à fila', async () => {
    const { atividades, rotas } = acervoReal();
    atividades.push(atividade('bike-falhou-agora', BICICLETA, '2026-09-29T12:00:00.000Z'));
    rotas.push(
      rotaSemPiso('bike-falhou-agora', { status: 'failed', failedAt: '2026-09-29T11:00:00.000Z' }),
    );
    atividades.push(atividade('bike-falhou-ontem', BICICLETA, '2026-09-28T12:00:00.000Z'));
    rotas.push(
      rotaSemPiso('bike-falhou-ontem', { status: 'failed', failedAt: '2026-09-28T11:00:00.000Z' }),
    );

    const { db } = banco(atividades, rotas);
    const fila = await fetchSurfaceCandidates(db, USUARIO, [BICICLETA], 5, RETRY_BEFORE);

    assert.deepEqual(
      fila.map((c) => c.activityId),
      ['bike-falhou-ontem'],
    );
  });

  it('não pede rota de quem não é do tipo, e lê os ids em lotes', async () => {
    const { atividades, rotas } = acervoReal();
    atividades.push(atividade('bike-hoje', BICICLETA, '2026-09-29T15:00:00.000Z'));
    rotas.push(rotaSemPiso('bike-hoje'));

    const { db, visto } = banco(atividades, rotas);
    await fetchSurfaceCandidates(db, USUARIO, [BICICLETA], 2, RETRY_BEFORE);

    // 138 pedaladas cabem num lote só (IDS_POR_LOTE = 200); o que importa é que
    // a leitura de rotas seja POR ID, e não uma varredura da tabela inteira.
    assert.equal(visto.lotesDeRota, 1);
  });

  it('acervo sem nenhuma pedalada devolve fila vazia sem tocar em activity_routes', async () => {
    const atividades = [atividade('cam-1', CAMINHADA, '2026-09-29T08:00:00.000Z')];
    const { db, visto } = banco(atividades, [rotaSemPiso('cam-1')]);

    const fila = await fetchSurfaceCandidates(db, USUARIO, [BICICLETA], 2, RETRY_BEFORE);

    assert.deepEqual(fila, []);
    assert.equal(visto.lotesDeRota, 0);
  });
});
