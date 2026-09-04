/**
 * Regularidade de horário: SRI, midpoint social e jetlag social.
 *
 * ## Por que existe agora, se não é exibido no V1
 *
 * A tela de sono, por decisão de produto, **não exibe índice de regularidade**:
 * ela mostra o timing chart e deixa a regularidade aparecer como forma — barras
 * alinhadas parecem alinhadas. Um número a mais na tela seria mais um placar,
 * que é exatamente o que a spec recusa.
 *
 * Este módulo existe mesmo assim por dois motivos concretos. Primeiro, é o que
 * dá sentido ao `tzOffset` na migration: sem consumidor, o campo pareceria
 * excesso e alguém o cortaria. Segundo, é a métrica com maior poder preditivo
 * demonstrado na literatura — o SRI prediz mortalidade **mesmo depois de ajustar
 * por duração média e fragmentação** (UK Biobank, n = 88.975, HR 1,53 no
 * percentil 5 contra a mediana, 1,42 no modelo ajustado). Quando houver uma
 * segunda tela de tendência, ela nasce daqui, testada.
 *
 * ## Ressalva de citação, e ela é importante
 *
 * A definição operacional do SRI abaixo vem de Phillips et al. 2017, que **não
 * foi lido** — a fonte secundária consultada confirma a escala (−100 a +100) mas
 * não reproduz a fórmula. A implementação segue a definição corrente ("mesma
 * fase, 24 h depois"), que é coerente com a escala publicada, mas é **inferência
 * definicional, não citação verificada**.
 *
 * Consequência prática: `sleepRegularityIndex` não deve virar número exibido
 * antes de alguém conferir o original. Como forma — e é assim que a tela o usa —
 * a ordenação está certa mesmo se a constante estiver.
 *
 * ## Uso correto do argumento
 *
 * O paper mostra que o SRI **acrescenta informação que a duração não carrega**.
 * Ele não mostra que regularidade importa mais que dormir o suficiente — a
 * comparação de superioridade que ele faz é contra métricas de desvio-padrão.
 * Nenhum texto derivado daqui deve dizer o contrário.
 */

import type { SleepPeriod } from '../models';
import { localHourOf, sleepMidpoint } from './timing';

const MS_MIN = 60_000;

/** Resolução da série binária. 1 min é a convenção usual e cabe em memória. */
const EPOCH_MIN = 1;

/**
 * Série sono/vigília por época, em minutos, cobrindo o intervalo dos períodos.
 *
 * O SRI compara o estado em *t* com o estado em *t + 24 h*, então ele precisa da
 * série contínua — não de totais por noite. É isto que um esquema de durações
 * por dia torna impossível de reconstruir, e é a razão de `sleep_periods`
 * existir.
 *
 * A vigília dentro do período conta como **acordado**: uma noite com uma hora de
 * despertar não está dormindo naquela hora, e fingir que está inflaria o índice.
 */
export function sleepWakeSeries(
  periods: readonly SleepPeriod[],
): { startMs: number; asleep: Uint8Array } | null {
  if (periods.length === 0) return null;

  let min = Infinity;
  let max = -Infinity;
  for (const p of periods) {
    min = Math.min(min, new Date(p.onsetAt).getTime());
    max = Math.max(max, new Date(p.wakeAt).getTime());
  }
  const step = EPOCH_MIN * MS_MIN;
  const startMs = Math.floor(min / step) * step;
  const len = Math.ceil((max - startMs) / step) + 1;
  const asleep = new Uint8Array(len);

  for (const p of periods) {
    const from = Math.floor((new Date(p.onsetAt).getTime() - startMs) / step);
    const to = Math.ceil((new Date(p.wakeAt).getTime() - startMs) / step);
    asleep.fill(1, Math.max(0, from), Math.min(len, to));

    for (const a of p.awakenings ?? []) {
      const af = Math.floor((new Date(a.from).getTime() - startMs) / step);
      const at = Math.ceil((new Date(a.to).getTime() - startMs) / step);
      asleep.fill(0, Math.max(0, af), Math.min(len, at));
    }
  }

  return { startMs, asleep };
}

/**
 * Sleep Regularity Index: −100 a +100.
 *
 * Probabilidade percentual de estar no mesmo estado (dormindo ou acordado) em
 * dois instantes separados por 24 h, promediada sobre o registro. 100 = fase
 * idêntica todo dia; 0 = nenhuma relação; negativo = anti-fase.
 *
 * `null` quando não há sobreposição de 24 h suficiente — com menos de duas
 * noites o índice não significa nada.
 */
export function sleepRegularityIndex(periods: readonly SleepPeriod[]): number | null {
  const series = sleepWakeSeries(periods);
  if (!series) return null;

  const dayEpochs = (24 * 60) / EPOCH_MIN;
  const n = series.asleep.length - dayEpochs;
  if (n <= 0) return null;

  let same = 0;
  for (let i = 0; i < n; i += 1) {
    if (series.asleep[i] === series.asleep[i + dayEpochs]) same += 1;
  }
  return 200 * (same / n) - 100;
}

/** Midpoint de uma noite como hora do dia local, para agrupar por tipo de dia. */
function midpointH(p: SleepPeriod): number {
  return localHourOf(sleepMidpoint(p).toISOString(), p.tzOffset);
}

/** Sábado ou domingo no fuso do próprio período. */
function isFreeDay(p: SleepPeriod): boolean {
  const shifted = new Date(new Date(p.wakeAt).getTime() + p.tzOffset * 60_000);
  const dow = shifted.getUTCDay();
  return dow === 0 || dow === 6;
}

export interface SocialJetlag {
  /** Midpoint médio nos dias livres, em horas locais. */
  msf: number;
  /** Midpoint médio nos dias de trabalho. */
  msw: number;
  /** MSF corrigido pelo débito acumulado na semana (Roenneberg). */
  msfsc: number;
  /** |MSF − MSW|, em horas. É o número que se chama "jetlag social". */
  sjl: number;
  freeNights: number;
  workNights: number;
}

/**
 * Jetlag social — a distância entre o horário que o corpo escolhe e o que a
 * semana impõe.
 *
 * `MSF` = midpoint em dias livres · `MSFsc = MSF − (SD_livre − SD_semana)/2` ·
 * `SJL = |MSF − MSW|`.
 *
 * A correção do MSFsc existe porque quem dorme pouco na semana compensa no fim
 * de semana, e esse excesso empurra o midpoint para mais tarde do que a fase
 * real. Sem `tzOffset` correto, uma viagem entra aqui como jetlag social — que é
 * precisamente o erro que o campo evita.
 *
 * `null` com menos de uma noite de cada tipo.
 */
export function socialJetlag(periods: readonly SleepPeriod[]): SocialJetlag | null {
  const free = periods.filter(isFreeDay);
  const work = periods.filter((p) => !isFreeDay(p));
  if (free.length === 0 || work.length === 0) return null;

  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const msf = mean(free.map(midpointH));
  const msw = mean(work.map(midpointH));
  const sdFree = mean(free.map((p) => p.asleepH));
  const sdWork = mean(work.map((p) => p.asleepH));

  return {
    msf,
    msw,
    msfsc: msf - (sdFree - sdWork) / 2,
    sjl: Math.abs(msf - msw),
    freeNights: free.length,
    workNights: work.length,
  };
}
