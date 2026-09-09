import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { RetroSummary } from './retro';
import type { RecapValue, MetricRecap } from '../week/recap';
import { montarPacotes } from '../ia/pacote';
import type { PacoteDeFatos } from '../ia/pacote';
import {
  CADERNOS,
  CADERNO_IDS,
  cadernoDaMetricaDeSaude,
  cadernoDef,
  isCadernoId,
  rotuloDoCaderno,
} from './cadernos';
import type { CadernoId } from './cadernos';

/**
 * O catálogo é lei — e lei que ninguém cobra é prosa.
 *
 * `cadernos.md` diz, campo a campo, a que caderno cada dado pertence, e
 * `CADERNOS` transcreve isso com uma marca por linha: `noPacote`. Este arquivo
 * liga cada marca a um **predicado sobre a montagem real**, para que ela não
 * possa mentir.
 *
 * Não é zelo abstrato: a primeira versão do catálogo afirmava entregar "esforço
 * duro" (`RetroFitness.hardMin`) e "o gasto derivado por unit_price", e nenhum
 * dos dois chegava ao pacote. As duas linhas passaram meses de revisão humana
 * sem que ninguém notasse, porque `noPacote` era um booleano que ninguém lia.
 */

/* ── fábricas ── */

function recap(current: number, prior: number): RecapValue {
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null };
}

function metrica(current: number, prior: number, n = 30): MetricRecap {
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null, n };
}

const VAZIO = recap(0, 0);

/**
 * Um período **cheio**: cada linha marcada `noPacote: true` tem dado aqui.
 *
 * É de propósito mais rico que o agosto real de `ia/pacote.test.ts` — agosto não
 * tem hábito nem registro nenhum, e um catálogo conferido contra um período sem
 * hábitos aprovaria a linha "hábitos" sem nunca a exercitar.
 */
function periodoCheio(): RetroSummary {
  const esporte = (id: number) => ({
    activityId: id,
    sessions: recap(7, 11),
    distanceM: recap(333_000, 820_000),
    movingS: recap(81_720, 190_000),
    elevationM: recap(2_140, 1_800),
    calories: VAZIO,
    speedMps: { current: null, prior: null },
    longest: null,
    bestEfforts: [],
  });
  const habito = (id: string, name: string, bad: boolean) => ({
    id, name, bad, unit: 'L', unitPrice: 11,
    recap: recap(12, 9), total: recap(6, 4), perDay: 0.2, perDayDays: 31,
  });
  return {
    kind: 'month',
    offset: -1,
    label: 'Agosto',
    startISO: '2026-08-01',
    endISO: '2026-08-31',
    tasks: { total: recap(44, 39), byModule: [] },
    habits: {
      good: [habito('h-agua', 'Água', false)],
      bad: [habito('h-cerveja', 'Cerveja', true)],
    },
    registros: [{ id: 'r-corte', name: 'Corte de cabelo', recap: recap(1, 2), everyDays: 31 }],
    fitness: {
      count: recap(21, 17),
      distanceM: recap(435_000, 862_000),
      durationS: recap(144_360, 245_520),
      calories: VAZIO,
      hardMin: recap(310, 480),
      floors: recap(539, 500),
      steps: recap(537_847, 500_000),
      byType: [],
    },
    sports: { cycling: esporte(13), running: esporte(37) },
    health: [
      {
        metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'moon' as never,
        decimals: 2, unit: 'h', recap: metrica(7.03, 6.89, 27), trend: 'up',
      },
      {
        metric: 'fcRepouso', label: 'FC de repouso', higherIsWorse: true, icon: 'heart' as never,
        decimals: 1, unit: 'bpm', recap: metrica(48.1, 49, 29), trend: 'down',
      },
      {
        metric: 'vfc', label: 'VFC', higherIsWorse: false, icon: 'hrv' as never,
        decimals: 0, unit: 'ms', recap: metrica(64, 61, 22), trend: 'up',
      },
    ],
    ratings: { sleep: metrica(3.72, 3.39, 30), day: metrica(4, 3.82, 30) },
    purchases: { count: recap(9, 6), spend: recap(214.5, 180), byCat: [] },
    adherence: { done: 44, total: 51 },
    sleep: null,
    sleepTriggers: null,
  } as RetroSummary;
}

const PACOTES = montarPacotes({ resumo: periodoCheio(), agora: new Date('2026-09-06T19:00:00') });

function pacote(id: CadernoId): PacoteDeFatos {
  return PACOTES.find((p) => p.caderno === id)!;
}

const temChave = (id: CadernoId, chave: string) => () =>
  pacote(id).metricas.some((f) => f.chave === chave);

const temPrefixo = (id: CadernoId, prefixo: string) => () =>
  pacote(id).metricas.some((f) => f.chave.startsWith(prefixo));

/**
 * Um predicado por linha marcada `noPacote: true`. A chave é o `campo` do
 * catálogo, para que renomear a linha sem acertar o predicado também reprove.
 */
const ENTREGUE: Readonly<Record<string, () => boolean>> = {
  // Sono
  'nota × medição': () => temChave('sono', 'nota_sono')() && temChave('sono', 'sono')(),
  // Movimento
  'km · tempo': () => temChave('movimento', 'distancia')() && temChave('movimento', 'tempo')(),
  'elevação': temPrefixo('movimento', 'ciclismo.elevacao'),
  'passos e andares': () => temChave('movimento', 'passos_dia')() && temChave('movimento', 'andares')(),
  // Coração
  'FC de repouso': temChave('coracao', 'fcRepouso'),
  'VFC': temChave('coracao', 'vfc'),
  // Rotina
  'hábitos — dias com registro': temPrefixo('rotina', 'habito.'),
  'registros': temPrefixo('rotina', 'registro.'),
  'notas do dia': temChave('rotina', 'nota_dia'),
  'compras e gasto do período': () =>
    temChave('rotina', 'compras')() && temChave('rotina', 'gasto')(),
};

/**
 * O outro sentido da mentira, para as duas linhas que já mentiram uma vez.
 *
 * Uma marca `false` que na verdade está no pacote é tão errada quanto o
 * contrário, e o teste das marcas `true` nunca a pegaria.
 */
const AUSENTE: Readonly<Record<string, () => boolean>> = {
  // `hardMin` existe no RetroSummary e o fixture o preenche; se um dia alguém o
  // montar, esta linha reprova até a marca virar.
  'esforço duro': () => pacote('movimento').metricas.every(
    (f) => !/esfor|hard|duro/i.test(f.chave) && !/esfor|duro/i.test(f.rotulo),
  ),
  // `unitPrice` está no fixture (11 €/L). Um gasto derivado apareceria como
  // fato novo em Rotina, com euro na unidade.
  'hábitos — o gasto derivado por unit_price': () => pacote('rotina').metricas.every(
    (f) => !(f.chave.startsWith('habito.') && f.unidade !== 'dias'),
  ),
};

/* ── vocabulário ── */

describe('CadernoId — o vocabulário com dono único', () => {
  it('são quatro, minúsculas sem acento, na ordem do catálogo', () => {
    assert.deepEqual([...CADERNO_IDS], ['sono', 'movimento', 'coracao', 'rotina']);
    for (const id of CADERNO_IDS) assert.match(id, /^[a-z]+$/);
  });

  it('isCadernoId recusa o que não é caderno — inclusive a lua', () => {
    for (const bom of CADERNO_IDS) assert.equal(isCadernoId(bom), true);
    // `caderno='lua'` é o que a AD-5 manda para `lua_execucoes`, não para cá.
    for (const mau of ['lua', 'coração', 'Sono', 'saude', '', null, 7]) {
      assert.equal(isCadernoId(mau), false, `"${String(mau)}" não é caderno`);
    }
  });

  it('cadernoDef e rotuloDoCaderno respondem por todos', () => {
    for (const id of CADERNO_IDS) {
      assert.equal(cadernoDef(id).id, id);
      assert.ok(rotuloDoCaderno(id).length > 0);
    }
    assert.equal(rotuloDoCaderno('coracao'), 'Coração');
  });

  it('saúde se parte pelo mapa, e o padrão é Coração', () => {
    assert.equal(cadernoDaMetricaDeSaude('sono'), 'sono');
    assert.equal(cadernoDaMetricaDeSaude('fcRepouso'), 'coracao');
    assert.equal(cadernoDaMetricaDeSaude('vfc'), 'coracao');
    // O que resta de health_daily depois que o sono sai é assunto do Coração.
    assert.equal(cadernoDaMetricaDeSaude('metrica-que-ainda-nao-existe'), 'coracao');
  });
});

/* ── o catálogo contra a montagem ── */

describe('o catálogo é cobrado, não prometido', () => {
  const todas = CADERNOS.flatMap((c) => c.fontes.map((f) => ({ caderno: c.id, ...f })));

  it('nenhum campo aparece em dois cadernos — dono único vale para o dado também', () => {
    const campos = todas.map((f) => f.campo);
    assert.equal(new Set(campos).size, campos.length, `campo repetido em ${campos.join(' · ')}`);
  });

  it('todo caderno declara pelo menos uma fonte', () => {
    for (const c of CADERNOS) assert.ok(c.fontes.length > 0, `${c.id} sem fonte`);
  });

  it('toda linha marcada `noPacote: true` tem predicado — marca nova sem prova reprova', () => {
    const semPredicado = todas.filter((f) => f.noPacote && !(f.campo in ENTREGUE));
    assert.deepEqual(
      semPredicado.map((f) => f.campo), [],
      'acrescentar uma linha entregue sem ligá-la à montagem devolve o catálogo à prosa',
    );
  });

  it('toda linha marcada `noPacote: true` REALMENTE está no pacote', () => {
    const mentindo = todas
      .filter((f) => f.noPacote && !ENTREGUE[f.campo]())
      .map((f) => `${f.caderno}: "${f.campo}"`);
    assert.deepEqual(
      mentindo, [],
      'o catálogo afirma entregar campo que a montagem não emite — '
      + 'ausência declarada vale mais que entrega falsamente afirmada',
    );
  });

  it('as duas linhas que já mentiram continuam ausentes, e declaradas', () => {
    for (const campo of Object.keys(AUSENTE)) {
      const linha = todas.find((f) => f.campo === campo);
      assert.ok(linha, `a linha "${campo}" sumiu do catálogo`);
      assert.equal(linha!.noPacote, false, `"${campo}" foi marcada como entregue`);
      assert.ok(linha!.nota, 'ausência sem nota não diz ao próximo por que ela é ausência');
      assert.equal(AUSENTE[campo](), true, `"${campo}" está no pacote e a marca não virou`);
    }
  });

  it('toda linha `noPacote: false` que não é uma delas ao menos tem fonte nomeada', () => {
    for (const f of todas.filter((x) => !x.noPacote)) {
      assert.ok(f.fonte.length > 0, `"${f.campo}" sem fonte`);
    }
  });
});
