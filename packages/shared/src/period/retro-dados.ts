/**
 * A entrada da Retrospectiva — montada no núcleo, uma vez, para os dois hospedeiros
 * (Story 2.2).
 *
 * ## Por que saiu da store do celular
 *
 * As nove leituras, as `HEALTH_SPECS`, a conversão das tarefas e o `buildInput`
 * moravam em `mobile/src/store/retro.store.ts`. O script que imprime a edição fora
 * do telefone (`scripts/revista/imprimir.ts`) teria de reescrevê-los — duas
 * implementações da mesma conta, e a edição do Mac divergindo da do iPhone no dia
 * em que uma delas mudasse. Agora a conta mora aqui, e os dois a chamam.
 *
 * ## O corte da janela, e o que ele conserta
 *
 * A store buscava `since` para o período aberto e **não rebuscava** quando já tinha
 * uma janela mais larga na memória. Quem abria o Ano e depois o Mês tinha na
 * memória as noites do ano inteiro — e o quadro de gatilhos do Sono e a linha de
 * base da continuidade (`sleepTriggers` e `history`, em `period/retro.ts`) leem
 * **todas as noites carregadas**. O mesmo mês gerava resumos diferentes conforme o
 * que tinha sido aberto antes. {@link retroInputDe} corta os dados na janela
 * `retroSince` do período pedido, com **os mesmos predicados do banco**, e então a
 * janela carregada deixa de importar: janela larga dá a mesma entrada que a exata
 * (decisão 2a do dono, 21/09/2026).
 *
 * O corte repete o predicado de cada leitura em `data/`, e não o dia local:
 *
 * | leitura                 | coluna      | predicado no banco                          |
 * |-------------------------|-------------|---------------------------------------------|
 * | `health_daily`          | `day`       | `day >= since` (dia com dia)                |
 * | `daily_ratings`         | `day`       | `day >= since`                              |
 * | `habit_logs`            | `log_date`  | `log_date >= since`                         |
 * | `registro_logs`         | `log_date`  | `log_date >= since`                         |
 * | `sleep_periods`         | `wake_day`  | `wake_day >= since`                         |
 * | `todo_occurrences`      | `done_at`   | `done_at >= '${since}T00:00:00'` — INSTANTE |
 *
 * **A última é a armadilha.** `done_at` é `timestamptz`, e o literal sem fuso é lido
 * no fuso da sessão do PostgREST, que no Supabase é UTC. Então o corte compara o
 * instante com `${since}T00:00:00Z`. Cortar pelo dia local da conclusão reabriria a
 * diferença justo na borda: uma tarefa feita às 00:30 de Bruxelas no dia `since`
 * é, em UTC, do dia anterior — o banco não a devolve, e o corte também não pode
 * mantê-la.
 *
 * Os três resumos (hábitos, registros e séries de tarefa) não têm janela no banco,
 * e não são cortados. As **atividades** também não: os dois hospedeiros as leem
 * inteiras (`fetchActivities`, sem janela), então elas não dependem do que foi
 * aberto antes. O que se faz com elas aqui é tirar as **ocultas**, que o celular
 * já tirava pela store das atividades e que o script receberia cruas.
 *
 * Puro: não conhece banco, rede nem relógio — o `agora` chega de quem chama.
 */
import { localDateStr } from '../date/local';
import type { EntradaPacote } from '../ia/pacote';
import type {
  Activity,
  HabitLog,
  RegistroLog,
  SleepPeriod,
  TodoModule,
  TodoOccurrence,
  TodoRecurrence,
} from '../models';
import { isDailyRecurrence } from '../todo/logic';
import { retroSince, type PeriodKind } from './bounds';
import {
  buildRetrospective,
  type RetroDailyTask,
  type RetroHealthMetric,
  type RetroInput,
  type RetroPurchase,
  type RetroTask,
} from './retro';

/* ── os dados crus ───────────────────────────────────────────────────────── */

/** Uma linha de `health_daily` — só dia, métrica e valor (`fetchHealthDailyValues`). */
export interface ValorDeSaudeDaRetro {
  readonly day: string;
  readonly metric: string;
  readonly value: number | null;
}

/** As duas notas de um dia (`fetchDailyRatingScores`). */
export interface NotasDaRetro {
  readonly day: string;
  readonly sleepQuality: number | null;
  readonly dayQuality: number | null;
}

/** Um hábito, em forma reduzida (`fetchHabitSummaries`). */
export interface HabitoDaRetro {
  readonly id: string;
  readonly name: string;
  readonly bad: boolean;
  readonly unit: string;
  readonly createdOn?: string;
  readonly unitPrice?: number;
}

/** Um registro, em forma reduzida (`fetchRegistroSummaries`). */
export interface RegistroDaRetro {
  readonly id: string;
  readonly name: string;
  readonly createdOn?: string;
}

/** Uma série de tarefas, em forma reduzida (`fetchTodoTemplateSummaries`). */
export interface SerieDaRetro {
  readonly id: string;
  readonly name: string;
  readonly module: TodoModule;
  readonly meta?: Record<string, unknown>;
  readonly recurrence: TodoRecurrence;
  readonly createdOn: string;
  readonly active: boolean;
}

/**
 * Os resultados crus das nove leituras da Retrospectiva, como `data/` os devolve
 * (`fetchDadosDaRetro`, em `data/retro-dados.ts`).
 *
 * É o que o hospedeiro guarda — o celular na store, o script na memória do
 * processo. Ninguém lê os campos crus para desenhar: quem os transforma em
 * entrada é {@link retroInputDe}.
 */
export interface DadosDaRetro {
  readonly health: readonly ValorDeSaudeDaRetro[];
  readonly ratings: readonly NotasDaRetro[];
  readonly habits: readonly HabitoDaRetro[];
  readonly habitLogs: readonly HabitLog[];
  readonly registros: readonly RegistroDaRetro[];
  readonly registroLogs: readonly RegistroLog[];
  readonly templates: readonly SerieDaRetro[];
  /** Só as concluídas (`status = 'done'`), como `fetchDoneTodoOccurrencesSince` as devolve. */
  readonly occurrences: readonly TodoOccurrence[];
  /** As noites cujo dia de acordar é `since` ou depois. */
  readonly sleepPeriods: readonly SleepPeriod[];
}

/** Nada carregado ainda — o estado inicial de quem guarda os dados. */
export const SEM_DADOS_DA_RETRO: DadosDaRetro = Object.freeze({
  health: Object.freeze([]),
  ratings: Object.freeze([]),
  habits: Object.freeze([]),
  habitLogs: Object.freeze([]),
  registros: Object.freeze([]),
  registroLogs: Object.freeze([]),
  templates: Object.freeze([]),
  occurrences: Object.freeze([]),
  sleepPeriods: Object.freeze([]),
});

/* ── as métricas de saúde ────────────────────────────────────────────────── */

/**
 * As métricas de saúde da Retrospectiva, com polaridade e formatação.
 *
 * **Sempre as três**, com ou sem valor no período: o mês sem medida chega com as
 * linhas presentes e todo `atual` nulo, e é essa a forma que o caderno vazio lê
 * (`ranqueamento.test.ts`, "o caderno vazio com a forma que o celular manda").
 */
export const HEALTH_SPECS: readonly Omit<RetroHealthMetric, 'valuesByDay'>[] = Object.freeze([
  { metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'sleep', decimals: 1, unit: 'h' },
  { metric: 'vfc', label: 'VFC', higherIsWorse: false, icon: 'hrv', decimals: 0, unit: ' ms' },
  { metric: 'fcRepouso', label: 'FC repouso', higherIsWorse: true, icon: 'heart', decimals: 0, unit: ' bpm' },
]);

/* ── o corte ─────────────────────────────────────────────────────────────── */

/**
 * O instante em que a janela de `since` começa para `done_at`: a meia-noite UTC
 * do dia, que é como o PostgREST lê o literal `'${since}T00:00:00'` (ver o
 * cabeçalho).
 */
function inicioDaJanelaEmUtc(since: string): number {
  return Date.parse(`${since}T00:00:00Z`);
}

/**
 * Os dados cortados na janela que começa em `since` (`YYYY-MM-DD`), com os
 * predicados do banco — a tabela está no cabeçalho.
 *
 * Idempotente e monotônico: cortar em `since` o que já foi buscado desde `since`
 * não tira nada, e cortar o que foi buscado desde uma data anterior dá o que teria
 * sido buscado desde `since`. É isso que torna a janela carregada irrelevante.
 *
 * Tarefa sem `done_at` sai, como sai do banco (`NULL >= x` não é verdade); o
 * instante que não se lê também sai — ele não teria dia para cair.
 */
export function recortarNaJanela(dados: DadosDaRetro, since: string): DadosDaRetro {
  const desde = inicioDaJanelaEmUtc(since);
  return {
    health: dados.health.filter((r) => r.day >= since),
    ratings: dados.ratings.filter((r) => r.day >= since),
    habits: dados.habits,
    habitLogs: dados.habitLogs.filter((l) => l.logDate >= since),
    registros: dados.registros,
    registroLogs: dados.registroLogs.filter((l) => l.logDate >= since),
    templates: dados.templates,
    occurrences: dados.occurrences.filter((o) => o.doneAt != null && Date.parse(o.doneAt) >= desde),
    sleepPeriods: dados.sleepPeriods.filter((p) => p.wakeDay >= since),
  };
}

/* ── a entrada ───────────────────────────────────────────────────────────── */

/** As tarefas concluídas viradas contagem por módulo, compras e séries diárias. */
function tarefasDe(dados: DadosDaRetro): {
  tasks: RetroTask[];
  purchases: RetroPurchase[];
  dailyTasks: RetroDailyTask[];
} {
  const serieDe = new Map(dados.templates.map((t) => [t.id, t]));
  const tasks: RetroTask[] = [];
  const purchases: RetroPurchase[] = [];
  // Dias de conclusão por série diária — o gatilho nomeado do cruzamento.
  const diasDaDiaria = new Map<string, Set<string>>();
  for (const o of dados.occurrences) {
    if (!o.doneAt) continue;
    const serie = serieDe.get(o.templateId);
    if (!serie) continue;
    // O dia da conclusão é o LOCAL de quem concluiu — o dia em que a tarefa foi
    // feita. Só o corte da janela é por instante, porque é o do banco.
    const doneDay = localDateStr(new Date(o.doneAt));
    tasks.push({ doneDay, module: serie.module });
    if (isDailyRecurrence(serie.recurrence)) {
      let dias = diasDaDiaria.get(serie.id);
      if (!dias) {
        dias = new Set();
        diasDaDiaria.set(serie.id, dias);
      }
      dias.add(doneDay);
    }
    if (serie.module === 'compras') {
      const meta = serie.meta ?? {};
      purchases.push({
        doneDay,
        cat: typeof meta['cat'] === 'string' ? (meta['cat'] as string) : undefined,
        price: typeof meta['price'] === 'number' ? (meta['price'] as number) : undefined,
        name: serie.name,
      });
    }
  }
  const dailyTasks = dados.templates
    .filter((t) => t.active && isDailyRecurrence(t.recurrence))
    .map((t) => ({ id: t.id, name: t.name, days: diasDaDiaria.get(t.id) ?? new Set<string>(), createdOn: t.createdOn }));
  return { tasks, purchases, dailyTasks };
}

/**
 * A entrada da Retrospectiva de um período — o `RetroInput` que o celular montava
 * na store, agora cortado na janela do período.
 *
 * `atividades` é o histórico **inteiro**, com as ocultas: elas saem aqui. `agora`
 * é o relógio de quem chama — a tela, ou o script —, e é dele que saem o período
 * (`tipo`, `offset`) e a janela (`retroSince`).
 */
export function retroInputDe(
  dados: DadosDaRetro,
  atividades: readonly Activity[],
  agora: Date,
  tipo: PeriodKind,
  offset: number,
): RetroInput {
  const d = recortarNaJanela(dados, localDateStr(retroSince(agora, tipo, offset)));

  const porMetrica = new Map<string, Map<string, number>>();
  for (const r of d.health) {
    if (r.value == null) continue;
    let m = porMetrica.get(r.metric);
    if (!m) {
      m = new Map();
      porMetrica.set(r.metric, m);
    }
    m.set(r.day, Number(r.value));
  }

  const notaDoSono = new Map<string, number>();
  const notaDoDia = new Map<string, number>();
  for (const r of d.ratings) {
    if (r.sleepQuality != null) notaDoSono.set(r.day, r.sleepQuality);
    if (r.dayQuality != null) notaDoDia.set(r.day, r.dayQuality);
  }

  const logsPorHabito = new Map<string, Map<string, number>>();
  for (const l of d.habitLogs) {
    let m = logsPorHabito.get(l.habitId);
    if (!m) {
      m = new Map();
      logsPorHabito.set(l.habitId, m);
    }
    m.set(l.logDate, l.value);
  }
  const diasPorRegistro = new Map<string, string[]>();
  for (const l of d.registroLogs) {
    const dias = diasPorRegistro.get(l.registroId) ?? [];
    dias.push(l.logDate);
    diasPorRegistro.set(l.registroId, dias);
  }

  const { tasks, purchases, dailyTasks } = tarefasDe(d);

  return {
    now: agora,
    kind: tipo,
    offset,
    activities: atividades.filter((a) => !a.hidden),
    health: HEALTH_SPECS.map((spec) => ({ ...spec, valuesByDay: porMetrica.get(spec.metric) ?? new Map() })),
    floorsByDay: porMetrica.get('andares'),
    stepsByDay: porMetrica.get('passos'),
    ratingsSleep: notaDoSono,
    ratingsDay: notaDoDia,
    habits: d.habits.map((h) => ({
      id: h.id,
      name: h.name,
      bad: h.bad,
      unit: h.unit,
      unitPrice: h.unitPrice,
      createdOn: h.createdOn,
      logsByDay: logsPorHabito.get(h.id) ?? new Map(),
    })),
    registros: d.registros.map((r) => ({
      id: r.id,
      name: r.name,
      createdOn: r.createdOn,
      days: diasPorRegistro.get(r.id) ?? [],
    })),
    tasks,
    dailyTasks,
    purchases,
    sleepPeriods: d.sleepPeriods,
  };
}

/**
 * O que o núcleo recebe para imprimir a edição de um período: o resumo e o relógio
 * — a mesma entrada que o celular monta em `useEntradaDaEdicao` (`{ resumo, agora }`),
 * e a que o script monta chamando esta função.
 */
export function entradaDaRetrospectiva(
  dados: DadosDaRetro,
  atividades: readonly Activity[],
  agora: Date,
  tipo: PeriodKind,
  offset: number,
): EntradaPacote {
  return { resumo: buildRetrospective(retroInputDe(dados, atividades, agora, tipo, offset)), agora };
}
