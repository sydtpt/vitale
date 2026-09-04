/**
 * Posicionar uma noite na **hora do dia**.
 *
 * ## A pergunta que faltava
 *
 * O Orbe sempre soube dizer *quantas horas* se dormiu. Nunca soube dizer *a que
 * horas* — `aggregateSleepNights` calculava o instante em que se apagou e o
 * descartava, gravando o horário de acordar duas vezes. Sem hora do dia,
 * regularidade, jetlag social, midpoint e cronotipo são todos incalculáveis.
 *
 * Este módulo é a base geométrica do `sleep timing chart`: dado um período, onde
 * ele começa e termina num eixo de hora do dia, e onde caem os buracos de
 * vigília dentro dele.
 *
 * ## O eixo começa às 18h, não à meia-noite
 *
 * Uma noite atravessa a virada do dia. Num eixo 00→24 ela apareceria partida em
 * duas — o fim no topo, o começo no rodapé — que é o oposto do que o gráfico
 * quer mostrar. A origem às 18h coloca a noite inteira num bloco contínuo e
 * deixa a madrugada no meio do eixo, onde ela é lida sem esforço.
 *
 * A escolha tem um limite honesto: um período que comece antes das 18h (um
 * cochilo da tarde, uma noite virada) sai do eixo. `axisPosition` devolve o
 * valor real mesmo assim, e quem desenha decide recortar — ver `fitsAxis`.
 *
 * ## Fuso: a conta é sobre `tzOffset`, nunca sobre o relógio do aparelho
 *
 * Todo instante é gravado em UTC e carrega o offset local **do momento em que
 * aconteceu**. Ler a hora do dia com os getters locais do JS daria a hora de
 * *onde o aparelho está agora* — o que faz uma viagem reescrever o passado. As
 * funções aqui deslocam o instante pelo `tzOffset` do próprio período e leem em
 * UTC, então uma noite dormida em Bruxelas continua tendo sido dormida em
 * Bruxelas depois de um voo.
 */

import type { Awakening, SleepPeriod } from '../models';

const MS_H = 3_600_000;

/** Origem do eixo do timing chart: 18:00 local. Ver o cabeçalho. */
export const SLEEP_AXIS_ORIGIN_H = 18;

/** Horas do eixo (a janela inteira, de 18h a 18h do dia seguinte). */
export const SLEEP_AXIS_SPAN_H = 24;

/**
 * Hora do dia (0–24, fracionária) de um instante, no fuso em que ele ocorreu.
 *
 * Desloca o UTC pelo offset e lê em UTC — nunca usa o fuso do aparelho.
 */
export function localHourOf(iso: string, tzOffset: number): number {
  const shifted = new Date(new Date(iso).getTime() + tzOffset * 60_000);
  return (
    shifted.getUTCHours() +
    shifted.getUTCMinutes() / 60 +
    shifted.getUTCSeconds() / 3600
  );
}

/**
 * Posição de um instante no eixo do timing chart, em horas desde a origem.
 *
 * Sempre em `[0, 24)`: 23h40 com origem 18 vira 5,67; 07h10 vira 13,17.
 */
export function axisPosition(
  iso: string,
  tzOffset: number,
  originH: number = SLEEP_AXIS_ORIGIN_H,
): number {
  const h = localHourOf(iso, tzOffset) - originH;
  return ((h % 24) + 24) % 24;
}

/** Uma barra do timing chart, em coordenada de eixo. */
export interface TimingBar {
  /** Topo — o instante em que apagou. */
  onset: number;
  /** Base — o instante em que acordou. */
  wake: number;
  /** Janela na cama, quando a fonte a mede de verdade. `null` = não sei. */
  bed: { from: number; to: number } | null;
  /**
   * Buracos de vigília, em coordenada de eixo. `null` quando a fonte não
   * reporta vigília — estado diferente de `[]`, que é "não houve".
   */
  holes: { from: number; to: number }[] | null;
  /**
   * `false` quando a noite não cabe no eixo (começou antes da origem, ou passou
   * de 24 h). Quem desenha decide recortar ou pular; o dado continua correto.
   */
  fitsAxis: boolean;
}

/**
 * Projeta um período no eixo do timing chart.
 *
 * A barra é sempre desenhada de `onset` a `wake`; a vigília **não** encurta a
 * barra, ela a fura. Encurtar mentiria sobre a hora de acordar.
 */
export function toTimingBar(
  p: SleepPeriod,
  originH: number = SLEEP_AXIS_ORIGIN_H,
): TimingBar {
  const pos = (iso: string): number => axisPosition(iso, p.tzOffset, originH);
  const onset = pos(p.onsetAt);
  const wake = pos(p.wakeAt);

  const bed =
    p.inBedAt && p.inBedEnd ? { from: pos(p.inBedAt), to: pos(p.inBedEnd) } : null;

  const holes =
    p.awakenings === null
      ? null
      : p.awakenings.map((a) => ({ from: pos(a.from), to: pos(a.to) }));

  // Cabe quando tudo que a barra desenha corre para baixo sem dar a volta no
  // eixo. `bed` entra na conta porque ela é desenhada junto e pode extrapolar
  // dos dois lados.
  const ordered = wake > onset;
  const bedFits = bed === null || (bed.to > bed.from && bed.from <= onset + 1e-9);

  return { onset, wake, bed, holes, fitsAxis: ordered && bedFits };
}

/**
 * Faixa do eixo que contém todas as barras, com folga.
 *
 * Sem isso o gráfico desenharia 24 h para mostrar 8 — a noite viraria uma tira
 * fina no meio de um campo vazio. Devolve `[from, to]` em horas de eixo.
 */
export function axisRange(
  bars: readonly TimingBar[],
  paddingH = 0.5,
): { from: number; to: number } {
  const usable = bars.filter((b) => b.fitsAxis);
  if (usable.length === 0) return { from: 4, to: 16 }; // 22h → 10h, um default legível

  let from = Infinity;
  let to = -Infinity;
  for (const b of usable) {
    from = Math.min(from, b.bed ? Math.min(b.onset, b.bed.from) : b.onset);
    to = Math.max(to, b.bed ? Math.max(b.wake, b.bed.to) : b.wake);
  }
  return {
    from: Math.max(0, from - paddingH),
    to: Math.min(SLEEP_AXIS_SPAN_H, to + paddingH),
  };
}

/**
 * Midpoint do sono: o ponto médio entre apagar e acordar.
 *
 * É a base do cronotipo e do jetlag social, e a única das métricas de horário
 * que faz sentido exibir sozinha — "o meio da sua noite anda às 3h40".
 */
export function sleepMidpoint(p: SleepPeriod): Date {
  const a = new Date(p.onsetAt).getTime();
  const b = new Date(p.wakeAt).getTime();
  return new Date((a + b) / 2);
}

/** Midpoint como hora do dia local (0–24), no fuso do próprio período. */
export function midpointHour(p: SleepPeriod): number {
  return localHourOf(sleepMidpoint(p).toISOString(), p.tzOffset);
}

/**
 * Latência: quanto tempo entre deitar e apagar, em minutos.
 *
 * **Gravada, nunca exibida como número** (spec §5). A tela mostra os dois
 * relógios e deixa o usuário ler o buraco; um rótulo "32 min para pegar no
 * sono" todo dia é o número mais ortossônico que existe. Isto existe para o
 * cruzamento com a percepção, não para a manchete.
 *
 * `null` quando a fonte não mede a hora de deitar.
 */
export function latencyMin(p: SleepPeriod): number | null {
  if (!p.inBedAt) return null;
  const ms = new Date(p.onsetAt).getTime() - new Date(p.inBedAt).getTime();
  return ms > 0 ? ms / 60_000 : 0;
}

/**
 * Piso abaixo do qual a hora de deitar não é medição.
 *
 * Fontes que derivam a janela "na cama" do próprio sono abrem `INBED` junto com
 * o `onset` — o Garmin faz isso em 41 de 42 noites medidas. Espelha
 * `MIN_ONSET_MS` de `mobile/src/lib/health-buckets.ts`.
 */
export const MIN_BEDTIME_GAP_MIN = 1;

/**
 * Se a hora de deitar pode ser mostrada como tal.
 *
 * `in_bed_at` é gravado cru, porque a duração da janela é grandeza real mesmo
 * quando o instante não é. Esta é a única função que decide se a tela escreve
 * "Deitou 22h28" ou "Deitou --:--" — a regra mora aqui, e não em cada tela.
 */
export function bedtimeMeasured(p: SleepPeriod): boolean {
  const lat = latencyMin(p);
  return lat !== null && lat >= MIN_BEDTIME_GAP_MIN;
}

/**
 * Eficiência: dormindo ÷ na cama.
 *
 * A pesquisa competitiva listou esta métrica como incalculável por falta do
 * denominador. O Orbe grava o denominador desde `AGG_VERSION` 4 — o que faltava
 * era alguém ler. `null` quando não há janela de cama medida.
 */
export function efficiency(p: SleepPeriod): number | null {
  if (!p.inBedAt || !p.inBedEnd) return null;
  const bedH = (new Date(p.inBedEnd).getTime() - new Date(p.inBedAt).getTime()) / MS_H;
  return bedH > 0 ? p.asleepH / bedH : null;
}

/** Duração de um trecho acordado, em minutos. */
export function awakeningMin(a: Awakening): number {
  return (new Date(a.to).getTime() - new Date(a.from).getTime()) / 60_000;
}
