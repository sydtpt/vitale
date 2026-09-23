/**
 * A leitura dos fatos do silêncio — o envelope da função `metricas_silencio`
 * (Story 2.7).
 *
 * O que se protege aqui é a **fronteira** entre o Postgres e o detector:
 *
 * - a função é chamada pelo nome, com o piso que o núcleo possui;
 * - o `jsonb` do banco vira a forma do domínio — `outra_chegou` é `outraChegou`,
 *   e o `count(*)` chega número mas é convertido, porque `numeric` viria texto;
 * - linha sem forma **sai**, em vez de virar uma lápide com data `undefined`;
 * - `error` do PostgREST **lança** (é o envelope do precedente), e quem o engole
 *   é a leitura da Retrospectiva — o último teste aqui é a prova de que a
 *   função que ainda não foi aplicada no banco não derruba a edição.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PISO_DE_SILENCIO_DIAS, lapidesDoAcervo } from '../period/lapides';
import { AGORA, USUARIO, VO2MAX_PAROU_EM, bancoFalso } from '../period/__tests__/contrato-da-edicao';
import { fetchSilencioDasMetricas } from './health-daily';
import { esquecerAvisosDaRetro, fetchDadosDaRetro } from './retro-dados';

/** Um banco que responde o `rpc` com o que se mandar, e guarda o que foi pedido. */
function fakeRpc(data: unknown, erro: Error | null = null) {
  const capturado: { fn?: string; args?: Record<string, unknown> } = {};
  const db = {
    async rpc(fn: string, args: Record<string, unknown>) {
      capturado.fn = fn;
      capturado.args = args;
      return { data: erro ? null : data, error: erro };
    },
  };
  return { db: db as unknown as SupabaseClient, capturado };
}

const LINHA = {
  metrica: 'aneis',
  primeira: '2025-01-01',
  ultima: '2026-08-17',
  medidas: 564,
  silencios: [{ de: '2026-08-18', ate: '2026-09-23', dias: 37, outra_chegou: true }],
};

describe('fetchSilencioDasMetricas', () => {
  it('chama a função pelo nome, com o piso que o núcleo possui', async () => {
    const { db, capturado } = fakeRpc([]);
    await fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS);
    assert.equal(capturado.fn, 'metricas_silencio');
    assert.deepEqual(capturado.args, { p_piso_dias: 30 });
  });

  it('traduz a forma do Postgres para a do domínio — e `primeira` não atravessa', async () => {
    const { db } = fakeRpc([LINHA]);
    // Sem `primeiraISO`: nenhuma regra a lê, e um campo que ninguém confere é um
    // campo em que alguém confia um dia.
    assert.deepEqual(await fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS), [{
      metrica: 'aneis',
      ultimaISO: '2026-08-17',
      medidas: 564,
      silencios: [{ de: '2026-08-18', ate: '2026-09-23', dias: 37, outraChegou: true }],
    }]);
  });

  it('a contagem que vier como texto vira número — `numeric` do PostgREST é string', async () => {
    const { db } = fakeRpc([{ ...LINHA, medidas: '564' }]);
    const [m] = await fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS);
    assert.strictEqual(m!.medidas, 564);
  });

  /**
   * **O defeito que falharia ABERTO.** `Number({})` e `Number('abc')` são `NaN`,
   * e toda comparação com `NaN` é falsa — inclusive `medidas < MINIMO_DE_MEDIDAS`.
   * Uma contagem podre passaria pela regra das dez medidas e **ganharia lápide**,
   * que é o oposto do que o detector promete. Coagir para zero também não serve:
   * zero passa na regra por ser menor que dez. A métrica inteira sai.
   */
  it('contagem que não é número descarta a métrica — nunca vira NaN nem zero', async () => {
    for (const medidas of [{}, 'abc', [], true, null, undefined, Number.NaN]) {
      const { db } = fakeRpc([{ ...LINHA, medidas }]);
      assert.deepEqual(
        await fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS), [],
        `medidas = ${JSON.stringify(medidas) ?? String(medidas)} passou`,
      );
    }
  });

  it('a métrica sem última medida sai: ela não tem morte para datar', async () => {
    const { db } = fakeRpc([LINHA, { ...LINHA, metrica: 'spo2', ultima: null }]);
    const out = await fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS);
    assert.deepEqual(out.map((m) => m.metrica), ['aneis']);
  });

  it('última medida que não é dia de calendário sai — ela viraria a data da lápide', async () => {
    for (const ultima of ['2026-02-30', '2026-13-01', 'ontem', '']) {
      const { db } = fakeRpc([{ ...LINHA, ultima }]);
      assert.deepEqual(await fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS), [], `ultima = "${ultima}"`);
    }
  });

  it('a métrica fica mesmo sem `primeira` — ela não é lida por regra nenhuma', async () => {
    const { db } = fakeRpc([{ ...LINHA, primeira: null }]);
    const out = await fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS);
    assert.deepEqual(out.map((m) => m.metrica), ['aneis']);
  });

  /**
   * `dias` decide a morte, `de` elege o silêncio corrente por comparação de
   * texto (`de > ultima`) e `ate` separa o fechado do aberto. Os três se
   * conferem: data que não é dia de calendário compararia como texto qualquer, e
   * intervalo invertido não é silêncio nenhum.
   */
  it('silêncio sem a forma inteira sai, e o resto da métrica fica', async () => {
    const bom = { de: '2026-08-18', ate: '2026-09-23', dias: 37, outra_chegou: true };
    const podres = [
      { ...bom, ate: null },
      { ...bom, de: null },
      { ...bom, de: '2026-02-30' },
      { ...bom, ate: '2026-13-40' },
      // Invertido: `ate` antes de `de`.
      { ...bom, de: '2026-09-23', ate: '2026-08-18' },
      { ...bom, dias: 'muitos' },
      { ...bom, dias: {} },
      { ...bom, dias: 0 },
    ];
    for (const podre of podres) {
      const { db } = fakeRpc([{ ...LINHA, silencios: [podre, bom] }]);
      const [m] = await fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS);
      assert.deepEqual(m!.silencios, [
        { de: '2026-08-18', ate: '2026-09-23', dias: 37, outraChegou: true },
      ], `passou: ${JSON.stringify(podre)}`);
    }
  });

  it('`silencios` nulo ou fora de forma é lista vazia, nunca explosão', async () => {
    for (const s of [null, undefined, '[]', 7]) {
      const { db } = fakeRpc([{ ...LINHA, silencios: s }]);
      const [m] = await fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS);
      assert.deepEqual(m!.silencios, [], `silencios = ${JSON.stringify(s)}`);
    }
  });

  it('`outra_chegou` só é verdade quando o banco diz `true` — nulo é "não se sabe", e não vale', async () => {
    const { db } = fakeRpc([{
      ...LINHA, silencios: [{ de: '2026-08-18', ate: '2026-09-23', dias: 37, outra_chegou: null }],
    }]);
    const [m] = await fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS);
    assert.equal(m!.silencios[0]!.outraChegou, false);
  });

  it('resposta vazia é acervo vazio', async () => {
    const { db } = fakeRpc(null);
    assert.deepEqual(await fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS), []);
  });

  it('erro do banco lança — é o envelope do precedente (`activity_media_counts`)', async () => {
    const erro = new Error('function public.metricas_silencio(integer) does not exist');
    const { db } = fakeRpc(null, erro);
    await assert.rejects(() => fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS), (e: unknown) => e === erro);
  });
});

/* ── a falha que vira lápide nenhuma ─────────────────────────────────────── */

describe('a função que o banco não tem não derruba a edição', () => {
  it('a leitura da Retrospectiva entrega as nove, e o silêncio vazio', async () => {
    const erro = new Error('function public.metricas_silencio(integer) does not exist');
    const b = bancoFalso({ falharSilencio: erro });
    const dados = await fetchDadosDaRetro(b.db, USUARIO, '2026-03-12');
    assert.equal(b.leituras['metricas_silencio'], 1, 'a função nem foi chamada — o teste não mediu a falha');
    assert.ok(dados.health.length > 0, 'as outras nove caíram junto');
    assert.deepEqual(dados.silencios, []);
    assert.deepEqual(lapidesDoAcervo(dados.silencios, AGORA), []);
  });

  /**
   * Enquanto a migração não for aplicada — o estado **esperado** até o dono rodar
   * a janela — a leitura falha em toda abertura da Retrospectiva. Um aviso por
   * abertura afoga o log e ensina a ignorá-lo.
   */
  it('avisa uma vez por sessão, e separa "a função não existe" de "a leitura falhou"', async () => {
    const ditas: string[] = [];
    const real = console.warn;
    console.warn = (...args: unknown[]) => { ditas.push(String(args[0])); };
    try {
      esquecerAvisosDaRetro();
      const semFuncao = Object.assign(new Error('Could not find the function'), { code: 'PGRST202' });
      for (let k = 0; k < 3; k += 1) {
        await fetchDadosDaRetro(bancoFalso({ falharSilencio: semFuncao }).db, USUARIO, '2026-03-12');
      }
      assert.equal(ditas.length, 1, `avisou ${ditas.length} vezes: ${ditas.join(' | ')}`);
      assert.match(ditas[0]!, /ainda não existe no banco/);
      assert.match(ditas[0]!, /20260923120000/, 'o aviso não diz qual migração liga a lápide');

      // Outra causa, outro aviso — e também uma vez só.
      const rede = new Error('fetch failed');
      for (let k = 0; k < 3; k += 1) {
        await fetchDadosDaRetro(bancoFalso({ falharSilencio: rede }).db, USUARIO, '2026-03-12');
      }
      assert.equal(ditas.length, 2);
      assert.match(ditas[1]!, /não vieram/);
    } finally {
      console.warn = real;
      esquecerAvisosDaRetro();
    }
  });

  /**
   * A função filtra por `auth.uid()` e **não recebe `userId`**: sem sessão ela
   * devolve zero linhas *sem erro*, o `catch` não dispara, e a edição sairia sem
   * lápide sem nada avisar. Zero métricas não é "nenhum silêncio".
   */
  it('zero métricas avisa — é o caso "rodou sem sessão", que não vira erro', async () => {
    const ditas: string[] = [];
    const real = console.warn;
    console.warn = (...args: unknown[]) => { ditas.push(String(args[0])); };
    try {
      esquecerAvisosDaRetro();
      // Sem sessão, o banco falso não casa `user_id` e a função responde vazio.
      const b = bancoFalso({ dono: null });
      const dados = await fetchDadosDaRetro(b.db, USUARIO, '2026-03-12');
      assert.deepEqual(dados.silencios, []);
      assert.equal(ditas.length, 1);
      assert.match(ditas[0]!, /sem métrica nenhuma/);
      assert.match(ditas[0]!, /auth\.uid\(\)/);
    } finally {
      console.warn = real;
      esquecerAvisosDaRetro();
    }
  });

  it('sem a falha, os fatos chegam e a morte da fixture é detectada', async () => {
    const b = bancoFalso();
    const dados = await fetchDadosDaRetro(b.db, USUARIO, '2026-03-12');
    assert.equal(b.leituras['metricas_silencio'], 1);
    assert.deepEqual(
      lapidesDoAcervo(dados.silencios, AGORA),
      [{ metrica: 'vo2max', ultimaMedidaISO: VO2MAX_PAROU_EM }],
    );
  });
});
