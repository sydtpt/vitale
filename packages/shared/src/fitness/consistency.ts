/**
 * Grade de consistência: um dia por célula, contra a meta diária.
 *
 * ## Por que não reusa o `buildHeatmap` da Retrospectiva
 *
 * O outro heatmap parece o mesmo e não é. Ele lê a métrica de `RetroInput.health`
 * e busca a meta em `HEALTH_TARGETS`, que hoje só conhece `sono`. E os limiares
 * do `heatStep` de lá são ±7/16/25% em torno da meta — calibrados para "7 h de
 * sono", onde errar um quarto é muito.
 *
 * Exercício não se comporta assim. O valor vai de 0 a três vezes a meta no mesmo
 * mês, e **um dia de descanso é −100%**: naquela escala ele cairia no mesmo
 * passo de um dia 26% abaixo, apagando a distinção que a grade existe para
 * mostrar. Daí uma escala própria, com um passo reservado para "não treinou".
 *
 * O **componente** de grade é o mesmo (`HeatmapGrid` no mobile); é só o cálculo
 * que precisava ser outro.
 *
 * ## O que a célula mede
 *
 * Segundos de **esforço** (`effectiveSeconds`), não tempo de relógio — a mesma
 * grandeza que o gráfico de barras compara com a meta da OMS. Uma hora de yoga
 * e uma hora de intervalado não valem o mesmo, e a grade não deveria dizer que
 * valem.
 */
import type { Activity } from '../models';
import { effectiveSeconds, weeklyTargetSeconds, DEFAULT_WEEKLY_TARGET_MIN } from '../health/who-activity';
import { localDateStr } from '../date/local';
import { mondayOf } from '../week/recap';

/** Negativo = abaixo da meta, 0 = em cima dela, positivo = acima. */
export type ConsistencyStep = -3 | -2 | -1 | 0 | 1 | 2;

export interface ConsistencyDay {
  /** 'YYYY-MM-DD' local. */
  day: string;
  /** 0 = segunda … 6 = domingo — a convenção da grade, não a do `Date`. */
  weekday: number;
  /** Segundos de esforço do dia (0 = não treinou). */
  effectiveS: number;
  step: ConsistencyStep;
}

export interface ActivityConsistency {
  days: ConsistencyDay[];
  /** Células vazias antes da primeira, para a grade começar na segunda-feira. */
  pad: number;
  /** Meta diária em segundos de esforço. */
  targetS: number;
  /** Dias com algum treino. */
  activeDays: number;
  /** Dias que bateram a meta diária. */
  metDays: number;
  /** Maior sequência de dias consecutivos com treino. */
  longestStreak: number;
}

/**
 * O passo divergente.
 *
 * `-3` é reservado para **zero**: não treinar não é "treinar pouco", e a cor
 * mais forte de um lado da escala é o lugar certo para isso num painel cujo
 * assunto é aparecer.
 */
export function consistencyStep(effectiveS: number, targetS: number): ConsistencyStep {
  if (effectiveS <= 0) return -3;
  if (targetS <= 0) return 0;
  const r = effectiveS / targetS;
  if (r < 0.5) return -2;
  if (r < 1) return -1;
  if (r < 1.5) return 0;
  if (r < 2.5) return 1;
  return 2;
}

/**
 * @param weeks Semanas exibidas, **alinhadas em segunda-feira**, terminando na
 *   semana corrente.
 *
 * O alinhamento é o que faz a grade não ter buraco à esquerda. Uma janela de "N
 * dias atrás até hoje" começa num dia da semana qualquer, e a grade de 7 colunas
 * precisa empurrar a primeira célula para a coluna certa — as células vazias
 * antes dela são justamente esse empurrão. Começando numa segunda, o `pad` é
 * sempre zero.
 *
 * As células que faltam no fim da última linha são os dias que **ainda não
 * aconteceram**. Essas ficam de fora: desenhá-las como "sem treino" seria
 * afirmar sobre o futuro.
 */
export function buildActivityConsistency(
  activities: Activity[],
  weeklyTargetMin: number = DEFAULT_WEEKLY_TARGET_MIN,
  weeks = 5,
  now: Date = new Date(),
): ActivityConsistency {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Segunda da semana corrente, recuada `weeks - 1` semanas.
  const start = mondayOf(today);
  start.setDate(start.getDate() - (weeks - 1) * 7);
  const days = Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1;

  // dia local → segundos de esforço
  const perDay = new Map<string, number>();
  for (const a of activities) {
    if (a.hidden) continue;
    const key = localDateStr(new Date(a.startAt));
    perDay.set(key, (perDay.get(key) ?? 0) + effectiveSeconds(a));
  }

  const targetS = weeklyTargetSeconds('day', today, weeklyTargetMin);

  const out: ConsistencyDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const effS = perDay.get(localDateStr(d)) ?? 0;
    out.push({
      day: localDateStr(d),
      // `getDay()` põe domingo em 0; a grade começa na segunda.
      weekday: (d.getDay() + 6) % 7,
      effectiveS: effS,
      step: consistencyStep(effS, targetS),
    });
  }

  let longestStreak = 0;
  let run = 0;
  for (const d of out) {
    run = d.effectiveS > 0 ? run + 1 : 0;
    if (run > longestStreak) longestStreak = run;
  }

  return {
    days: out,
    // Zero por construção — a janela começa numa segunda. Continua sendo
    // derivado, e não fixado em 0, para não mentir se a âncora mudar.
    pad: out.length ? out[0].weekday : 0,
    targetS,
    activeDays: out.filter((d) => d.effectiveS > 0).length,
    metDays: out.filter((d) => d.effectiveS >= targetS).length,
    longestStreak,
  };
}
