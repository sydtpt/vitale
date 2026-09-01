/**
 * A tendência do seu melhor por distância: "estou diminuindo?"
 *
 * ## Por que por distância, e não ritmo médio
 *
 * O objetivo declarado é baixar minutos por quilômetro. Ritmo médio de corrida
 * não serve para medir isso: um 20 km leve tem ritmo pior que um 5 km forte,
 * sempre — um mês de treino longo apareceria como regressão. A única leitura
 * comparável consigo mesma é o ritmo **na mesma distância**, e é isso que
 * `bestEfforts` guarda por treino.
 *
 * ## O que a série é
 *
 * Um ponto por mês: o melhor tempo naquela distância entre as corridas daquele
 * mês. Mês sem corrida que tenha coberto a distância fica `null` — e quem
 * desenha **não** liga os vizinhos por cima do buraco, porque isso inventaria
 * uma progressão que não aconteceu. O recorde de sempre vem à parte, como linha
 * de referência: é o chão que a série tenta encostar.
 */
import type { Activity } from '../models';
import { localDateStr } from '../date/local';
import { BEST_EFFORT_DISTANCES, rankBestEfforts, type BestEffortDistance, type RankedEffort } from './best-efforts';

export interface EffortTrendBucket {
  /** 'YYYY-MM' local. */
  key: string;
  /** "jan", "fev"… */
  label: string;
  /** Primeiro dia do mês, em ms — para quem plota no eixo de tempo. */
  date: number;
  /** Melhor tempo do mês naquela distância; `null` = nenhuma corrida cobriu. */
  secs: number | null;
  /** A corrida que fez esse tempo, para navegar. */
  id: string | null;
}

export interface EffortTrend {
  /** Da mais antiga à atual, `months` meses. */
  buckets: EffortTrendBucket[];
  /** O melhor de sempre naquela distância — a linha de referência. */
  record: RankedEffort | null;
  /** Meses com ponto. Zero significa "esta distância não tem série ainda". */
  measured: number;
}

/** "jan", "fev"… pelo Intl — o núcleo já tem duas tabelas privadas disto; não vai a terceira. */
function monthLabel(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

function monthKey(d: Date): string {
  return localDateStr(d).slice(0, 7);
}

/**
 * As distâncias em que este esporte tem pelo menos uma marca — o seletor só
 * oferece o que existe. Oferecer "Maratona" a quem nunca correu uma seria um
 * botão que abre um gráfico vazio.
 */
export function distancesWithData(activities: readonly Activity[], sportId: number): BestEffortDistance[] {
  return BEST_EFFORT_DISTANCES.filter((d) => rankBestEfforts(activities, sportId, d.key).length > 0);
}

export function bestEffortTrend(
  activities: readonly Activity[],
  sportId: number,
  distanceKey: string,
  months = 12,
  now: Date = new Date(),
): EffortTrend {
  const ranked = rankBestEfforts(activities, sportId, distanceKey);
  const record = ranked[0] ?? null;

  // mês → melhor da lista (que já vem da mais rápida à mais lenta).
  const bestByMonth = new Map<string, RankedEffort>();
  for (const r of ranked) {
    const k = monthKey(new Date(r.startAt));
    if (!bestByMonth.has(k)) bestByMonth.set(k, r);
  }

  const buckets: EffortTrendBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const best = bestByMonth.get(monthKey(d));
    buckets.push({
      key: monthKey(d),
      label: monthLabel(d),
      date: d.getTime(),
      secs: best?.secs ?? null,
      id: best?.id ?? null,
    });
  }

  return { buckets, record, measured: buckets.filter((b) => b.secs !== null).length };
}
