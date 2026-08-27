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

/** Negativo = abaixo da meta, 0 = em cima dela, positivo = acima. */
export type ConsistencyStep = -3 | -2 | -1 | 0 | 1 | 2;

export interface ConsistencyDay {
  /** 'YYYY-MM-DD' local. */
  day: string;
  /**
   * 0 = segunda … 6 = domingo.
   *
   * A grade **não** é mais um calendário — a coluna não significa dia da semana.
   * O campo continua aqui porque a leitura ao tocar a célula diz "12 · terça", e
   * essa informação some se ela não vier junto do dia.
   */
  weekday: number;
  /** Segundos de esforço do dia (0 = não treinou). */
  effectiveS: number;
  step: ConsistencyStep;
}

/**
 * Um bloco de sete dias — uma linha da grade.
 *
 * Não é "a semana" no sentido do calendário: a janela é corrida, então o bloco
 * começa no dia da semana em que a janela começou. São sete dias contíguos, que
 * é o que a comparação com a meta semanal precisa.
 */
export interface ConsistencyBlock {
  /** Primeiro e último dia do bloco, 'YYYY-MM-DD' local. */
  start: string;
  end: string;
  /** Segundos de esforço somados nos sete dias. */
  effectiveS: number;
}

export interface ActivityConsistency {
  /** `weeks × 7` dias, do mais antigo ao mais recente. Sempre cheio. */
  days: ConsistencyDay[];
  /** Meta diária em segundos de esforço. */
  targetS: number;
  /** Dias com algum treino. */
  activeDays: number;
  /** Dias que bateram a meta diária. */
  metDays: number;
  /** Maior sequência de dias consecutivos com treino. */
  longestStreak: number;
  /** Esforço somado na janela inteira. */
  totalS: number;
  /** Meta da janela inteira — `targetS × days`. O denominador do score. */
  targetTotalS: number;
  /**
   * O mesmo somatório para a janela imediatamente anterior, do mesmo tamanho.
   *
   * Zero aqui não distingue "mês parado" de "app novo, sem histórico" — por isso
   * quem exibe a variação usa `totalsDelta`, que devolve `null` quando a base é
   * zero em vez de inventar um crescimento infinito.
   */
  previousTotalS: number;
  /** Um bloco por linha da grade, do mais antigo ao mais recente. */
  blocks: ConsistencyBlock[];
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
 * @param weeks Linhas da grade. A janela é **corrida**: `weeks × 7` dias
 *   terminando **ontem**, sem alinhamento com o dia da semana.
 *
 * Duas escolhas que valem registro, porque a primeira versão fazia o contrário:
 *
 * **A grade não é um calendário.** Ancorar a primeira célula numa segunda-feira
 * deixava a última linha pela metade (os dias que ainda não aconteceram) e fazia
 * a contagem de células variar conforme o dia em que se olhasse. Sem
 * alinhamento, `weeks × 7` preenche sempre `weeks` linhas cheias — em troca, a
 * coluna deixa de significar dia da semana, e quem quiser o dia toca a célula.
 *
 * **A última célula é ontem.** Hoje ainda está correndo: enquanto o treino do
 * dia não acontece, a célula mais visível da grade seria a menos verdadeira,
 * afirmando "parado" sobre um dia que nem terminou. A janela só mostra dias
 * fechados.
 */
export function buildActivityConsistency(
  activities: Activity[],
  weeklyTargetMin: number = DEFAULT_WEEKLY_TARGET_MIN,
  weeks = 4,
  now: Date = new Date(),
): ActivityConsistency {
  // Ontem, à meia-noite local: o último dia fechado.
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const days = weeks * 7;

  // dia local → segundos de esforço
  const perDay = new Map<string, number>();
  for (const a of activities) {
    if (a.hidden) continue;
    const key = localDateStr(new Date(a.startAt));
    perDay.set(key, (perDay.get(key) ?? 0) + effectiveSeconds(a));
  }

  const targetS = weeklyTargetSeconds('day', end, weeklyTargetMin);

  const out: ConsistencyDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    const effS = perDay.get(localDateStr(d)) ?? 0;
    out.push({
      day: localDateStr(d),
      // `getDay()` põe domingo em 0; aqui segunda é 0.
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

  // Uma linha da grade = um bloco. A correspondência é visual de propósito: a
  // barrinha embaixo do score diz de onde veio a linha logo acima dela.
  const blocks: ConsistencyBlock[] = [];
  for (let i = 0; i < out.length; i += 7) {
    const slice = out.slice(i, i + 7);
    blocks.push({
      start: slice[0].day,
      end: slice[slice.length - 1].day,
      effectiveS: slice.reduce((s, d) => s + d.effectiveS, 0),
    });
  }

  // Os `days` dias anteriores ao primeiro da janela.
  let previousTotalS = 0;
  for (let i = days; i < days * 2; i++) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    previousTotalS += perDay.get(localDateStr(d)) ?? 0;
  }

  return {
    days: out,
    targetS,
    activeDays: out.filter((d) => d.effectiveS > 0).length,
    metDays: out.filter((d) => d.effectiveS >= targetS).length,
    longestStreak,
    totalS: out.reduce((s, d) => s + d.effectiveS, 0),
    targetTotalS: targetS * days,
    previousTotalS,
    blocks,
  };
}
