import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchActivities } from '../data/activities';
import { EdicaoMudouNaImpressao, portasDaEdicao } from '../data/edicoes-ia';
import { fetchDadosDaRetro } from '../data/retro-dados';
import { localDateStr } from '../date/local';
import { imprimir, type ResultadoDaImpressao } from '../ia/imprimir';
import { resolverCadeia } from '../ia/motor';
import { montarPacote } from '../ia/pacote';
import { montarPrompt } from '../ia/prompt';
import { sha256Hex } from '../ia/sha256';
import { CADERNO_IDS } from './cadernos';
import { descritorDaRetrospectiva } from '../ia/retrospectiva';
import type { Activity, TodoOccurrence } from '../models';
import { isDailyRecurrence } from '../todo/logic';
import { offsetDoInicio, retroSince, type PeriodKind } from './bounds';
import { buildRetrospective, type RetroHealthMetric, type RetroInput } from './retro';
import {
  HEALTH_SPECS,
  SEM_DADOS_DA_RETRO,
  entradaDaRetrospectiva,
  recortarNaJanela,
  retroInputDe,
  type DadosDaRetro,
} from './retro-dados';
import {
  AGORA,
  FIM,
  GABARITO,
  INICIO,
  JANELA,
  JANELA_LARGA,
  NASCEU_DEPOIS_DE_MAIO,
  OFFSET,
  TIPO,
  USUARIO,
  VO2MAX_PAROU_EM,
  bancoFalso,
  coletorDeHashes,
  motorParaDaFixture,
  transporteDaFixture,
  cadernoImpressoDeMaio,
  type TabelaDaFixture,
} from './__tests__/contrato-da-edicao';

/**
 * A entrada da Retrospectiva no núcleo (Story 2.2) — o corte da janela, a paridade
 * com a store do celular de antes, e a impressão da fixture contra o gabarito que o
 * celular e o script também cobram.
 */

/* ── a store antiga, como oráculo ────────────────────────────────────────── */

/**
 * O `buildInput` e a conversão das tarefas de `mobile/src/store/retro.store.ts`
 * **como eram antes da 2.2** — copiados, sem corte, sobre as atividades já sem as
 * ocultas (a store as tirava pela store das atividades).
 *
 * É o oráculo da paridade: sobre dados buscados na janela exata, a entrada nova tem
 * de ser a antiga, byte a byte. A única diferença permitida é o corte (decisão 2a do
 * dono), e ela só aparece com uma janela mais larga carregada.
 */
function inputDaStoreAntiga(
  s: DadosDaRetro,
  visiveis: Activity[],
  now: Date,
  kind: PeriodKind,
  offset: number,
): RetroInput {
  const antigos: Omit<RetroHealthMetric, 'valuesByDay'>[] = [
    { metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'sleep', decimals: 1, unit: 'h' },
    { metric: 'vfc', label: 'VFC', higherIsWorse: false, icon: 'hrv', decimals: 0, unit: ' ms' },
    { metric: 'fcRepouso', label: 'FC repouso', higherIsWorse: true, icon: 'heart', decimals: 0, unit: ' bpm' },
  ];

  // ── o `ensure` de antes: a conversão das tarefas
  const tmplById = new Map(s.templates.map((t) => [t.id, t]));
  const tasks: { doneDay: string; module: string }[] = [];
  const purchases: { doneDay: string; cat?: string; price?: number; name: string }[] = [];
  const dailyDays = new Map<string, Set<string>>();
  for (const o of s.occurrences) {
    if (!o.doneAt) continue;
    const tmpl = tmplById.get(o.templateId);
    if (!tmpl) continue;
    const doneDay = localDateStr(new Date(o.doneAt));
    tasks.push({ doneDay, module: tmpl.module });
    if (isDailyRecurrence(tmpl.recurrence)) {
      let d = dailyDays.get(tmpl.id);
      if (!d) { d = new Set(); dailyDays.set(tmpl.id, d); }
      d.add(doneDay);
    }
    if (tmpl.module === 'compras') {
      const meta = tmpl.meta ?? {};
      purchases.push({
        doneDay,
        cat: typeof meta['cat'] === 'string' ? (meta['cat'] as string) : undefined,
        price: typeof meta['price'] === 'number' ? (meta['price'] as number) : undefined,
        name: tmpl.name,
      });
    }
  }
  const dailyTasks = s.templates
    .filter((t) => t.active && isDailyRecurrence(t.recurrence))
    .map((t) => ({ id: t.id, name: t.name, days: dailyDays.get(t.id) ?? new Set<string>(), createdOn: t.createdOn }));

  // ── o `buildInput` de antes
  const byMetric = new Map<string, Map<string, number>>();
  for (const r of s.health) {
    if (r.value == null) continue;
    let m = byMetric.get(r.metric);
    if (!m) { m = new Map(); byMetric.set(r.metric, m); }
    m.set(r.day, Number(r.value));
  }
  const sleepMap = new Map<string, number>();
  const dayMap = new Map<string, number>();
  for (const r of s.ratings) {
    if (r.sleepQuality != null) sleepMap.set(r.day, r.sleepQuality);
    if (r.dayQuality != null) dayMap.set(r.day, r.dayQuality);
  }
  const logsByHabit = new Map<string, Map<string, number>>();
  for (const l of s.habitLogs) {
    let m = logsByHabit.get(l.habitId);
    if (!m) { m = new Map(); logsByHabit.set(l.habitId, m); }
    m.set(l.logDate, l.value);
  }
  const daysByRegistro = new Map<string, string[]>();
  for (const l of s.registroLogs) {
    const arr = daysByRegistro.get(l.registroId) ?? [];
    arr.push(l.logDate);
    daysByRegistro.set(l.registroId, arr);
  }
  return {
    now, kind, offset,
    activities: visiveis,
    health: antigos.map((spec) => ({ ...spec, valuesByDay: byMetric.get(spec.metric) ?? new Map() })),
    floorsByDay: byMetric.get('andares'),
    stepsByDay: byMetric.get('passos'),
    ratingsSleep: sleepMap,
    ratingsDay: dayMap,
    habits: s.habits.map((h) => ({ id: h.id, name: h.name, bad: h.bad, unit: h.unit, unitPrice: h.unitPrice, createdOn: h.createdOn, logsByDay: logsByHabit.get(h.id) ?? new Map() })),
    registros: s.registros.map((r) => ({ id: r.id, name: r.name, createdOn: r.createdOn, days: daysByRegistro.get(r.id) ?? [] })),
    tasks,
    dailyTasks,
    // A Story 2.6 acrescentou o marco das séries. A store de antes não o tinha —
    // ele entra no oráculo pela mesma conta, porque o que este teste mede é a
    // CONVERSÃO dos dados, não o inventário de campos do `RetroInput`; sem ele, a
    // paridade reprovaria a story em vez de reprovar uma divergência de conta.
    taskSeries: s.templates.map((t) => ({ createdOn: t.createdOn, module: t.module })),
    purchases,
    sleepPeriods: s.sleepPeriods,
  };
}

/* ── o acervo da fixture ─────────────────────────────────────────────────── */

async function acervo(since: string) {
  const b = bancoFalso();
  const [dados, atividades] = await Promise.all([fetchDadosDaRetro(b.db, USUARIO, since), fetchActivities(b.db, USUARIO)]);
  return { dados, atividades, visiveis: atividades.filter((a) => !a.hidden) };
}

const CADEIA = resolverCadeia(descritorDaRetrospectiva, null, []);

/** Imprime maio pelo núcleo, sobre o banco dado, e devolve o que o gabarito compara. */
async function imprimirMaio(
  b: ReturnType<typeof bancoFalso>,
  entrada = entradaDaRetrospectiva(SEM_DADOS_DA_RETRO, [], AGORA, TIPO, OFFSET),
  transporte = transporteDaFixture(),
): Promise<{ resultado: ResultadoDaImpressao<unknown>; hashes: Partial<Record<string, string>> }> {
  const c = coletorDeHashes();
  const resultado = await imprimir(entrada, portasDaEdicao(b.db, USUARIO), {
    cadeia: CADEIA,
    motorPara: motorParaDaFixture(transporte),
    registrar: c.registrar,
    aoComecar: c.aoComecar,
    agora: () => AGORA,
  });
  return { resultado, hashes: c.hashes };
}

/* ── a fixture ───────────────────────────────────────────────────────────── */

describe('a fixture do contrato', () => {
  it('a janela, o período e o offset dela são os que o núcleo calcula', () => {
    assert.equal(localDateStr(retroSince(AGORA, TIPO, OFFSET)), JANELA);
    assert.equal(offsetDoInicio(AGORA, TIPO, INICIO), OFFSET);
    assert.ok(localDateStr(retroSince(AGORA, 'year', 0)) >= JANELA_LARGA, 'a janela larga não cobre a do Ano');
  });

  it('há dado antes da janela, e uma atividade oculta no mês — senão o corte e o hidden não teriam o que mostrar', async () => {
    const { dados, atividades } = await acervo(JANELA_LARGA);
    assert.ok(dados.sleepPeriods.some((p) => p.wakeDay < JANELA));
    assert.ok(dados.health.some((r) => r.day < JANELA));
    assert.ok(dados.occurrences.some((o) => o.doneAt! < JANELA));
    assert.ok(atividades.some((a) => a.hidden && a.startAt.startsWith('2026-05')));
  });

  /**
   * A via da lápide, de ponta a ponta (Story 2.7): o VO₂max da fixture cala em
   * maio, o detector o declara morto, e `entradaDaRetrospectiva` leva a lápide
   * — sem que o resumo mude número nenhum, porque nenhuma métrica com lápide
   * entra nas `HEALTH_SPECS`.
   */
  it('a métrica que morreu em maio chega à entrada como lápide, e é do período', async () => {
    const { dados, atividades } = await acervo(JANELA);
    assert.ok(dados.silencios!.some((m) => m.metrica === 'vo2max'), 'a fixture perdeu a métrica que morre');
    const entrada = entradaDaRetrospectiva(dados, atividades, AGORA, TIPO, OFFSET);
    assert.deepEqual(entrada.lapides, [{ metrica: 'vo2max', ultimaMedidaISO: VO2MAX_PAROU_EM }]);
    assert.ok(VO2MAX_PAROU_EM >= INICIO && VO2MAX_PAROU_EM <= FIM, 'a morte saiu de maio — a lápide deixaria de liderar');
  });

  it('a janela carregada não muda a lápide: o silêncio é a vida da métrica, e não se corta', async () => {
    const [larga, exata] = await Promise.all([acervo(JANELA_LARGA), acervo(JANELA)]);
    assert.deepEqual(larga.dados.silencios, exata.dados.silencios);
    assert.deepEqual(recortarNaJanela(larga.dados, JANELA).silencios, larga.dados.silencios);
  });

  /**
   * O não medido de ponta a ponta (Story 2.6): do banco falso ao prompt.
   *
   * `h-alongar` nasceu depois do fim de maio e é marcado desde então. A linha dele
   * chega ao resumo como qualquer outra — hábito não é filtrado por contagem zero
   * —, e é o **marco** que decide que ela não vira número. Os dois vizinhos, que
   * nasceram em 2025, seguem com número.
   */
  it('o hábito que nasceu depois do fim do período entra no pacote sem número, e não chega ao prompt', async () => {
    const { dados, atividades } = await acervo(JANELA);
    const resumo = buildRetrospective(retroInputDe(dados, atividades, AGORA, TIPO, OFFSET));
    assert.ok(NASCEU_DEPOIS_DE_MAIO > FIM, 'a fixture perdeu o hábito nascido depois de maio');
    // O marco das séries saiu do banco, e é anterior a maio. O DIA exato não se
    // afirma: `createdOn` é o dia local do `created_at`, e o fuso de quem roda o
    // move — a fixture só garante o mesmo dia de UTC−11 a UTC+12 (ver o cabeçalho
    // dela). O que importa aqui é o lado do marco, não o dígito.
    assert.ok(resumo.marcos?.tarefas != null && resumo.marcos.tarefas < INICIO, 'o marco das séries não saiu do banco');

    const rotina = montarPacote({ resumo, agora: AGORA }, 'rotina');
    const fato = (chave: string) => rotina.metricas.find((f) => f.chave === chave);
    assert.ok(fato('habito.h-alongar'), 'a linha do hábito novo não chegou ao pacote');
    assert.equal(fato('habito.h-alongar')!.atual, null, 'maio não teve "0 dias de alongamento" — não tinha o hábito');
    assert.equal(typeof fato('habito.h-cerveja')!.atual, 'number', 'o hábito de 2025 perdeu o número');
    assert.equal(typeof fato('tarefas')!.atual, 'number', 'as tarefas nasceram em 2025 e têm número');
    assert.equal(montarPrompt(rotina).usuario.includes('Alongar'), false, 'o hábito sem número foi ao prompt');
  });
});

/* ── a leitura ───────────────────────────────────────────────────────────── */

/**
 * Metade dos dados não é entrada. Antes da 2.2 a store do celular falsificava as
 * nove leituras uma a uma, e uma falha em qualquer delas era coberta ali; desde que
 * a store falsifica `fetchDadosDaRetro` inteira, é aqui que a rejeição se prova —
 * sobre as leituras de verdade, contra o banco da fixture.
 */
describe('fetchDadosDaRetro — rejeita quando uma das nove falha', () => {
  const nove: readonly (readonly [TabelaDaFixture, string])[] = [
    ['health_daily', 'com janela'],
    ['daily_ratings', 'com janela'],
    ['habits', 'resumo, sem janela'],
    ['habit_logs', 'com janela'],
    ['registros', 'resumo, sem janela'],
    ['registro_logs', 'com janela'],
    ['todo_templates', 'resumo, sem janela'],
    ['todo_occurrences', 'com janela, por instante'],
    ['sleep_periods', 'com janela'],
  ];
  for (const [tabela, tipo] of nove) {
    it(`${tabela} (${tipo}) falha: a leitura inteira rejeita com o erro do banco`, async () => {
      const erro = new Error(`PostgREST recusou ${tabela}`);
      const b = bancoFalso({ falhar: { [tabela]: erro } });
      await assert.rejects(() => fetchDadosDaRetro(b.db, USUARIO, JANELA), (e: unknown) => e === erro);
      assert.equal(b.leituras[tabela], 1, `${tabela} não foi lida — o teste não mediu a falha dela`);
    });
  }

  it('sem falha, as nove são lidas uma vez cada — e a décima também', async () => {
    const b = bancoFalso();
    await fetchDadosDaRetro(b.db, USUARIO, JANELA);
    for (const [tabela] of nove) assert.equal(b.leituras[tabela], 1, tabela);
    assert.equal(b.leituras['metricas_silencio'], 1, 'os fatos do silêncio (Story 2.7)');
  });

  /**
   * A décima é a exceção, e é declarada: ela responde por uma função que pode não
   * existir no banco ainda, e a edição sem ela é a edição de antes da 2.7. A prova
   * de que a falha dela não derruba as nove está em `data/health-daily.test.ts`,
   * junto com o envelope da leitura.
   */
  it('a décima não está na lista das que derrubam a leitura', () => {
    assert.equal(nove.some(([t]) => String(t) === 'metricas_silencio'), false);
    assert.equal(nove.length, 9);
  });
});

/* ── o corte ─────────────────────────────────────────────────────────────── */

const NOITE = { userId: USUARIO, onsetAt: '', wakeAt: '', inBedAt: null, inBedEnd: null, tzOffset: 120, asleepH: 7, awakenings: [], stages: null, stageSegments: null };
const concluida = (id: string, doneAt: string | undefined): TodoOccurrence =>
  ({ id, templateId: 't', dueDate: null, status: 'done', doneAt, createdAt: '2026-01-01T00:00:00+00:00' });

describe('recortarNaJanela — os predicados do banco', () => {
  const since = '2026-03-12';
  const dados: DadosDaRetro = {
    health: [{ day: '2026-03-11', metric: 'sono', value: 7 }, { day: '2026-03-12', metric: 'sono', value: 6 }],
    ratings: [{ day: '2026-03-11', sleepQuality: 3, dayQuality: 3 }, { day: '2026-03-12', sleepQuality: 4, dayQuality: null }],
    habits: [{ id: 'h', name: 'H', bad: false, unit: 'un' }],
    habitLogs: [{ id: 'a', habitId: 'h', logDate: '2026-03-11', value: 1 }, { id: 'b', habitId: 'h', logDate: '2026-03-12', value: 2 }],
    registros: [{ id: 'r', name: 'R' }],
    registroLogs: [{ id: 'a', registroId: 'r', logDate: '2026-03-11' }, { id: 'b', registroId: 'r', logDate: '2026-03-12' }],
    templates: [{ id: 't', name: 'T', module: 'casa', recurrence: { kind: 'none' }, createdOn: '2026-01-01', active: true }],
    occurrences: [
      concluida('antes', '2026-03-11T23:59:59+00:00'),
      concluida('borda', '2026-03-12T00:00:00+00:00'),
      concluida('micro', '2026-03-12T00:00:00.000001+00:00'),
      // 00:30 em Bruxelas no dia `since` é 22:30 UTC da véspera: o banco não a devolve.
      concluida('bruxelas-meia-noite', '2026-03-12T00:30:00+02:00'),
      // 01:30 de Lisboa no inverno (UTC+1) é 00:30 UTC do dia `since`: o banco devolve.
      concluida('lisboa', '2026-03-12T01:30:00+01:00'),
      concluida('sem-instante', undefined),
    ],
    sleepPeriods: [
      // A noite pertence ao dia de acordar: começou na véspera de `since`, e fica.
      { ...NOITE, onsetAt: '2026-03-11T22:00:00+00:00', wakeAt: '2026-03-12T05:00:00+00:00', wakeDay: '2026-03-12' },
      { ...NOITE, onsetAt: '2026-03-10T22:00:00+00:00', wakeAt: '2026-03-11T05:00:00+00:00', wakeDay: '2026-03-11' },
    ],
  };
  const r = recortarNaJanela(dados, since);

  it('saúde e notas: dia com dia, `since` incluso', () => {
    assert.deepEqual(r.health.map((x) => x.day), ['2026-03-12']);
    assert.deepEqual(r.ratings.map((x) => x.day), ['2026-03-12']);
  });

  it('hábitos e registros: `log_date` com dia, `since` incluso', () => {
    assert.deepEqual(r.habitLogs.map((x) => x.id), ['b']);
    assert.deepEqual(r.registroLogs.map((x) => x.id), ['b']);
  });

  it('noites: pelo dia de acordar, não pelo instante em que começaram', () => {
    assert.deepEqual(r.sleepPeriods.map((p) => p.wakeDay), ['2026-03-12']);
  });

  it('tarefas: pelo INSTANTE, contra a meia-noite UTC de `since` — a borda da sessão do PostgREST', () => {
    assert.deepEqual(r.occurrences.map((o) => o.id), ['borda', 'micro', 'lisboa']);
  });

  it('a tarefa das 00:30 de Bruxelas sai qualquer que seja o fuso de quem corta', () => {
    // O corte não lê o fuso do processo: o dia LOCAL desta tarefa é `since` em Bruxelas,
    // e ainda assim ela sai, porque o banco não a teria devolvido.
    const so = recortarNaJanela({ ...SEM_DADOS_DA_RETRO, occurrences: [concluida('x', '2026-03-12T00:30:00+02:00')] }, since);
    assert.equal(so.occurrences.length, 0);
  });

  it('os três resumos não têm janela: hábitos, registros e séries passam inteiros', () => {
    assert.equal(r.habits, dados.habits);
    assert.equal(r.registros, dados.registros);
    assert.equal(r.templates, dados.templates);
  });

  it('idempotente, e cortar depois de uma janela larga dá a janela exata', () => {
    assert.deepEqual(recortarNaJanela(r, since), r);
    assert.deepEqual(recortarNaJanela(recortarNaJanela(dados, '2026-03-01'), since), r);
  });

  it('sobre o banco da fixture, cortar a janela larga dá o que o banco devolve para a exata — os nove predicados', async () => {
    const [larga, exata] = await Promise.all([acervo(JANELA_LARGA), acervo(JANELA)]);
    assert.ok(larga.dados.health.length > exata.dados.health.length, 'a janela larga não trouxe nada a mais');
    assert.deepEqual(recortarNaJanela(larga.dados, JANELA), exata.dados);
  });
});

/* ── a entrada ───────────────────────────────────────────────────────────── */

describe('retroInputDe — a entrada, cortada', () => {
  it('as HEALTH_SPECS são as três de sempre, na ordem de sempre', () => {
    assert.deepEqual(HEALTH_SPECS.map((h) => h.metric), ['sono', 'vfc', 'fcRepouso']);
  });

  it('as atividades ocultas saem — o script as recebe cruas do banco', async () => {
    const { dados, atividades, visiveis } = await acervo(JANELA);
    const input = retroInputDe(dados, atividades, AGORA, TIPO, OFFSET);
    assert.equal(input.activities.length, visiveis.length);
    assert.ok(input.activities.every((a) => !a.hidden));
    assert.ok(atividades.length > visiveis.length);
  });

  const periodos: readonly (readonly [PeriodKind, number])[] = [
    [TIPO, OFFSET], ['season', -1], ['year', 0], ['week', -1], ['all', 0],
  ];
  for (const [kind, offset] of periodos) {
    it(`paridade com a store antiga — ${kind} ${offset}, com os dados buscados na janela exata`, async () => {
      const since = localDateStr(retroSince(AGORA, kind, offset));
      const { dados, atividades, visiveis } = await acervo(since);
      const nova = retroInputDe(dados, atividades, AGORA, kind, offset);
      const antiga = inputDaStoreAntiga(dados, visiveis, AGORA, kind, offset);
      assert.deepStrictEqual(nova, antiga);
      assert.deepStrictEqual(buildRetrospective(nova), buildRetrospective(antiga));
    });
  }

  it('janela larga = janela exata: a mesma entrada e o mesmo resumo', async () => {
    const [larga, exata] = await Promise.all([acervo(JANELA_LARGA), acervo(JANELA)]);
    const deLarga = retroInputDe(larga.dados, larga.atividades, AGORA, TIPO, OFFSET);
    const deExata = retroInputDe(exata.dados, exata.atividades, AGORA, TIPO, OFFSET);
    assert.deepStrictEqual(deLarga, deExata);
    assert.deepStrictEqual(buildRetrospective(deLarga), buildRetrospective(deExata));
  });

  /**
   * A prova de que o teste acima mede alguma coisa: sem o corte — a store de antes
   * com a janela do Ano na memória —, o resumo de maio muda. É o defeito que a 2.2
   * conserta: o mesmo mês com resumos diferentes conforme o que foi aberto antes.
   */
  it('sem o corte, a janela larga muda o resumo de maio — o Sono lê todas as noites carregadas', async () => {
    const [larga, exata] = await Promise.all([acervo(JANELA_LARGA), acervo(JANELA)]);
    const semCorte = buildRetrospective(inputDaStoreAntiga(larga.dados, larga.visiveis, AGORA, TIPO, OFFSET));
    const comCorte = buildRetrospective(retroInputDe(exata.dados, exata.atividades, AGORA, TIPO, OFFSET));
    assert.notDeepStrictEqual(
      { sleep: semCorte.sleep, sleepTriggers: semCorte.sleepTriggers },
      { sleep: comCorte.sleep, sleepTriggers: comCorte.sleepTriggers },
    );
  });
});

/* ── o núcleo contra o gabarito ──────────────────────────────────────────── */

describe('o núcleo imprime a fixture — o gabarito que o celular e o script também cobram', () => {
  it('bate o GABARITO: hash por caderno e a carga do rpc', async () => {
    const b = bancoFalso();
    const { dados, atividades } = await acervo(JANELA);
    const { resultado, hashes } = await imprimirMaio(b, entradaDaRetrospectiva(dados, atividades, AGORA, TIPO, OFFSET));
    assert.equal(resultado.estado, GABARITO.estado);
    assert.deepEqual(hashes, GABARITO.hashes);
    assert.equal(b.rpcs.length, 1);
    assert.equal(b.rpcs[0].fn, 'edicao_imprimir');
    assert.deepStrictEqual(b.rpcs[0].args, GABARITO.carga);
  });

  it('com a janela larga carregada, o mesmo GABARITO', async () => {
    const b = bancoFalso();
    const { dados, atividades } = await acervo(JANELA_LARGA);
    const { hashes } = await imprimirMaio(b, entradaDaRetrospectiva(dados, atividades, AGORA, TIPO, OFFSET));
    assert.deepEqual(hashes, GABARITO.hashes);
    assert.deepStrictEqual(b.rpcs[0].args, GABARITO.carga);
  });

  /**
   * O TEXTO do pedido, preso sozinho (Story 2.6).
   *
   * `GABARITO.hashes` mistura o texto e a versão do descritor: quem subisse
   * `PACOTE_VERSAO` e mudasse o prompt no mesmo commit acertaria o hash novo e
   * nada acusaria a mudança de texto. Este golden é só o `usuario` de cada
   * caderno, e por isso ele muda **só** quando o texto muda.
   */
  it('o TEXTO do pedido de cada caderno é o do gabarito — sem a versão do descritor no meio', async () => {
    const { dados, atividades } = await acervo(JANELA);
    // A entrada **inteira**, e não `{ resumo, agora }`: desde a Story 2.7 ela leva
    // as lápides, e é a lápide que muda o texto do Movimento. Montar o pacote sem
    // elas mediria um prompt que hospedeiro nenhum manda.
    const entrada = entradaDaRetrospectiva(dados, atividades, AGORA, TIPO, OFFSET);
    for (const caderno of CADERNO_IDS) {
      const usuario = montarPrompt(montarPacote(entrada, caderno)).usuario;
      const hash = sha256Hex(usuario);
      if (hash !== GABARITO.textos[caderno]) {
        console.log(`\n── o texto do caderno ${caderno} mudou (sha256 ${hash}) ──\n${usuario}\n`);
      }
      assert.equal(
        hash, GABARITO.textos[caderno],
        `o texto do pedido de ${caderno} mudou. Confira o texto impresso acima, decida se era `
        + `o pretendido, e só então atualize GABARITO.textos — com o motivo escrito no docblock dele.`,
      );
    }
  });

  /**
   * **Com lista vazia o prompt não muda um byte** (Story 1.7, repetida em três
   * docblocks) — e desde a 2.7 a fixture sempre tem lápide, então sem este
   * golden a frase deixou de ter quem a prove.
   *
   * Duas coisas, e as duas mordem: a entrada **sem** `lapides` dá exatamente o
   * mesmo texto que a entrada com `lapides: []` (ausente e vazia são a mesma
   * coisa), e esse texto é o do gabarito — em três cadernos, byte a byte, o
   * mesmo de quando há lápide.
   */
  it('sem lápide, o texto do pedido é o de antes da 2.7 — e lista vazia é o mesmo que ausente', async () => {
    const { dados, atividades } = await acervo(JANELA);
    const resumo = buildRetrospective(retroInputDe(dados, atividades, AGORA, TIPO, OFFSET));
    for (const caderno of CADERNO_IDS) {
      const semCampo = montarPrompt(montarPacote({ resumo, agora: AGORA }, caderno)).usuario;
      const listaVazia = montarPrompt(montarPacote({ resumo, agora: AGORA, lapides: [] }, caderno)).usuario;
      assert.equal(listaVazia, semCampo, `lista vazia mudou o prompt de ${caderno} — a seção entrou sem conteúdo`);
      assert.equal(
        sha256Hex(semCampo), GABARITO.textosSemLapide[caderno],
        `o texto SEM lápide de ${caderno} mudou. É o caminho da maioria dos períodos: confira se era `
        + 'o pretendido antes de atualizar GABARITO.textosSemLapide.',
      );
    }
  });

  it('a lápide entra só no caderno do mapa: os outros três têm o mesmo texto com e sem ela', () => {
    for (const caderno of CADERNO_IDS) {
      const igual = GABARITO.textos[caderno] === GABARITO.textosSemLapide[caderno];
      assert.equal(igual, caderno !== 'movimento', `${caderno}: com e sem lápide deviam ${caderno === 'movimento' ? 'diferir' : 'coincidir'}`);
    }
  });

  it('o reprovado não chega ao banco: o Coração tem hash, e não tem linha nem posição', () => {
    assert.ok(GABARITO.hashes.coracao);
    assert.ok(!GABARITO.carga.p_ordem.includes('coracao'));
    assert.ok(!GABARITO.carga.p_linhas.some((l) => l['caderno'] === 'coracao'));
  });

  /**
   * O gabarito morde: a entrada com a oculta dentro — o script que esquecesse o
   * `hidden` — tem outro pedido no Movimento.
   */
  it('com a atividade oculta dentro, o hash do Movimento diverge', async () => {
    const b = bancoFalso();
    const { dados, atividades } = await acervo(JANELA);
    const comOculta = { resumo: buildRetrospective({ ...retroInputDe(dados, atividades, AGORA, TIPO, OFFSET), activities: atividades }), agora: AGORA };
    const { hashes } = await imprimirMaio(b, comOculta);
    assert.notEqual(hashes.movimento, GABARITO.hashes.movimento);
    assert.equal(hashes.sono, GABARITO.hashes.sono);
  });

  it('a releitura é a edição gravada, na ordem da carga', async () => {
    const b = bancoFalso();
    const { dados, atividades } = await acervo(JANELA);
    const { resultado } = await imprimirMaio(b, entradaDaRetrospectiva(dados, atividades, AGORA, TIPO, OFFSET));
    assert.equal(resultado.estado, 'gravada');
    const edicao = (resultado as Extract<typeof resultado, { estado: 'gravada' }>).edicao as { caderno: string; posicao: number }[];
    // O Movimento em 1º pela lápide do período (Story 2.7); ver o GABARITO.
    assert.deepEqual(edicao.map((c) => [c.caderno, c.posicao]), [['movimento', 1], ['rotina', 2], ['sono', 3]]);
    assert.equal(b.tabelas.edicoes_ia.length, 3);
    assert.ok(b.tabelas.edicoes_ia.every((l) => l['inicio'] === INICIO && l['fim'] === FIM));
  });

  it('concorrência: outro hospedeiro grava entre o buscar e o gravar — lança, e a função não é chamada', async () => {
    const b = bancoFalso();
    const { dados, atividades } = await acervo(JANELA);
    // Enquanto esta impressão chama o modelo do segundo caderno, o outro hospedeiro grava o Coração.
    let pedidos = 0;
    const transporte = transporteDaFixture({
      aoPedir: () => {
        pedidos += 1;
        if (pedidos === 2) b.tabelas.edicoes_ia.push(cadernoImpressoDeMaio('coracao', 1));
      },
    });
    await assert.rejects(
      () => imprimirMaio(b, entradaDaRetrospectiva(dados, atividades, AGORA, TIPO, OFFSET), transporte),
      EdicaoMudouNaImpressao,
    );
    assert.equal(b.rpcs.length, 0);
    assert.deepEqual(b.tabelas.edicoes_ia.map((l) => l['caderno']), ['coracao'], 'o caderno do outro hospedeiro sumiu');
  });
});
