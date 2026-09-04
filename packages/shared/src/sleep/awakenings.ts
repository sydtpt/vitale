/**
 * O relógio de vigília: **quando** a noite quebra.
 *
 * ## A pergunta que ninguém responde
 *
 * Todo produto da categoria diz *quantas vezes* você acordou, e alguns dizem
 * *quanto tempo*. Nenhum diz **a que horas**. E é essa a pergunta com resposta
 * acionável: "eu acordo sempre às 3h" é um padrão; "você acordou 4 vezes" é uma
 * contagem.
 *
 * Este módulo sobrepõe os despertares de várias noites num único eixo de hora do
 * dia e conta quantas noites coincidem em cada faixa. O gráfico que sai é uma
 * banda de densidade, não uma contagem empilhada: o que importa é *em que ponto
 * da noite* isso se repete.
 *
 * ## Os três estados, carregados até a tela
 *
 * `awakenings` tem três valores possíveis e eles significam coisas diferentes:
 * `null` (a fonte não reporta), `[]` (reporta e não houve) e `[…]` (os
 * intervalos). Colapsar os dois primeiros em "zero despertares" faria a tela
 * afirmar "você dormiu direto" quando a verdade é "não sei".
 *
 * Isso não é hipótese: das 312 noites em produção, **233 da era Apple Watch
 * reportam vigília** (média de 60 min, máximo de 3h19, 43% acima de uma hora) e
 * **as 42 da era Garmin não reportam nenhuma**. A feature nasce lendo o passado.
 *
 * ## O que este módulo deliberadamente NÃO faz
 *
 * Não existe índice de fragmentação, score, nem penalidade. Cruzando o tempo
 * acordado com a nota que o usuário dá ao acordar, a relação corre **ao
 * contrário** do que qualquer score assumiria — nota 3 com 37 min acordado, nota
 * 5 com 83 min. Com n = 13 isso é ruído, e é exatamente por isso: pontuar
 * vigília seria construir, com lastro medido, o defeito nº 1 da categoria.
 */

import type { SleepPeriod } from '../models';
import { SLEEP_AXIS_ORIGIN_H, SLEEP_AXIS_SPAN_H, axisPosition } from './timing';

/** O que a fonte contou sobre vigília na janela analisada. */
export type AwakeCoverage =
  /** Nenhuma noite da janela reporta vigília — a tela precisa dizer isso. */
  | 'unreported'
  /** Reportam, e não houve nenhum despertar. */
  | 'none'
  /** Reportam, e houve. */
  | 'reported';

/** Uma faixa do relógio de vigília. */
export interface AwakeBin {
  /** Início da faixa, em horas de eixo desde a origem. */
  from: number;
  /** Fim da faixa. */
  to: number;
  /** Quantas noites distintas têm vigília tocando esta faixa. */
  nights: number;
  /** `nights` normalizado pelas noites que reportam — 0 a 1. */
  density: number;
}

export interface AwakeClock {
  bins: AwakeBin[];
  coverage: AwakeCoverage;
  /** Noites da janela cujo `awakenings` não é `null`. Denominador da densidade. */
  nightsReporting: number;
  /** Noites da janela, no total. */
  nightsTotal: number;
  /** Maior `nights` entre as faixas — o pico do relógio. */
  peakNights: number;
}

const DEFAULT_BIN_MIN = 15;

/**
 * Monta o relógio de vigília de uma janela de noites.
 *
 * Cada despertar pinta **todas** as faixas que ele atravessa, e cada noite conta
 * no máximo uma vez por faixa — senão uma única noite com um despertar longo
 * dominaria o gráfico e ele deixaria de medir repetição.
 */
export function buildAwakeClock(
  periods: readonly SleepPeriod[],
  binMin: number = DEFAULT_BIN_MIN,
  originH: number = SLEEP_AXIS_ORIGIN_H,
): AwakeClock {
  const binH = binMin / 60;
  const count = Math.round(SLEEP_AXIS_SPAN_H / binH);
  const nights = Array.from({ length: count }, () => new Set<string>());

  const reporting = periods.filter((p) => p.awakenings !== null);
  let anyAwakening = false;

  for (const p of reporting) {
    for (const a of p.awakenings ?? []) {
      anyAwakening = true;
      const from = axisPosition(a.from, p.tzOffset, originH);
      const durH =
        (new Date(a.to).getTime() - new Date(a.from).getTime()) / 3_600_000;
      // Percorre por passo de faixa em vez de usar a posição do fim: um despertar
      // que atravesse a volta do eixo teria `to < from` e o intervalo sairia
      // invertido.
      const steps = Math.max(1, Math.ceil(durH / binH));
      for (let s = 0; s < steps; s += 1) {
        const idx = Math.floor((((from + s * binH) % SLEEP_AXIS_SPAN_H) / binH)) % count;
        nights[idx].add(p.onsetAt);
      }
    }
  }

  const nightsReporting = reporting.length;
  const bins: AwakeBin[] = nights.map((set, i) => ({
    from: i * binH,
    to: (i + 1) * binH,
    nights: set.size,
    density: nightsReporting > 0 ? set.size / nightsReporting : 0,
  }));

  const coverage: AwakeCoverage =
    nightsReporting === 0 ? 'unreported' : anyAwakening ? 'reported' : 'none';

  return {
    bins,
    coverage,
    nightsReporting,
    nightsTotal: periods.length,
    peakNights: bins.reduce((m, b) => Math.max(m, b.nights), 0),
  };
}

/**
 * A faixa em que a vigília mais se repete — o "eu acordo sempre às…".
 *
 * `null` quando não há repetição digna do nome: um pico de uma noite só não é
 * padrão, é uma noite. O piso de duas noites é deliberadamente baixo porque a
 * tela mostra o `n` junto e deixa o usuário julgar.
 */
export function peakAwakeWindow(clock: AwakeClock, minNights = 2): AwakeBin | null {
  if (clock.coverage !== 'reported') return null;
  let best: AwakeBin | null = null;
  for (const b of clock.bins) {
    if (b.nights >= minNights && (best === null || b.nights > best.nights)) best = b;
  }
  return best;
}

/** Série de minutos acordados por noite, para a leitura 3 de CAP-5. */
export interface AwakeNight {
  wakeDay: string;
  /** `null` quando a fonte não reporta — a série tem buraco, não zero. */
  awakeMin: number | null;
}

/**
 * Minutos acordados por noite, em ordem cronológica.
 *
 * Sem meta e sem faixa de referência, por decisão de produto: a série existe
 * para o usuário ver se a vigília está crescendo, não para ele bater um alvo.
 */
export function awakeSeries(periods: readonly SleepPeriod[]): AwakeNight[] {
  const byDay = new Map<string, { sum: number; reports: boolean }>();
  for (const p of periods) {
    const cur = byDay.get(p.wakeDay) ?? { sum: 0, reports: false };
    if (p.awakenings !== null) {
      cur.reports = true;
      for (const a of p.awakenings) {
        cur.sum += (new Date(a.to).getTime() - new Date(a.from).getTime()) / 60_000;
      }
    }
    byDay.set(p.wakeDay, cur);
  }

  return [...byDay.entries()]
    .map(([wakeDay, v]) => ({ wakeDay, awakeMin: v.reports ? v.sum : null }))
    .sort((a, b) => a.wakeDay.localeCompare(b.wakeDay));
}
