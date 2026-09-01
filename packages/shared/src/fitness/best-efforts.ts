/**
 * Recordes por distância: quem foi o melhor, e em que lugar esta corrida ficou.
 *
 * ## O dado já estava gravado
 *
 * `Activity.bestEfforts` não é o recorde histórico — é calculado **por treino**,
 * no sync, com janela deslizante sobre o track (`computeBestEffortsFromPoints`
 * em `streams.ts`). A linha de uma corrida de 20 km carrega o melhor 1 km, 5 km
 * e 10 km que aconteceram *dentro dela*. Até aqui, o único consumidor era o
 * `running-highlights` de cada app, que percorre tudo e guarda o mínimo — o
 * número por corrida nunca chegou a uma tela.
 *
 * ## Por que o ranqueamento mora aqui
 *
 * A medalha vai aparecer em duas telas: no detalhe da atividade ("esta corrida
 * foi o seu 2º melhor 5 km") e, por trás, na página do tipo. Escrito duas vezes,
 * é questão de tempo até o detalhe chamar de prata o que a página chama de
 * bronze. `running-highlights.ts` já está duplicado entre web e mobile e na
 * lista `DEFERRED` do `architecture.test.ts`; esta é a parte pura dele, e é só
 * ela que sobe — `value`/`caption` formatados continuam onde estão.
 *
 * ## Cada esporte compete consigo mesmo
 *
 * O ranking filtra por `activityId` (o código do esporte). Um 5 km de bicicleta
 * não disputa com um 5 km de corrida — a pergunta "foi o meu melhor 5 km?" só
 * tem sentido dentro do mesmo esporte.
 */
import type { Activity } from '../models';
import { BEST_EFFORT_TARGETS } from './streams';

export interface BestEffortDistance {
  /** Chave estável do jsonb `best_efforts` — a mesma que o sync escreve. */
  key: string;
  meters: number;
  /** Rótulo de exibição. */
  label: string;
}

const LABELS: Record<string, string> = {
  '1000': '1 km',
  '5000': '5 km',
  '10000': '10 km',
  '20000': '20 km',
  half: 'Meia maratona',
  '30000': '30 km',
  '40000': '40 km',
  marathon: 'Maratona',
};

/**
 * As distâncias padrão, com rótulo, na ordem crescente.
 *
 * As chaves e os metros vêm de `BEST_EFFORT_TARGETS` — a tabela que o sync usa
 * para **escrever** o jsonb. Antes havia quatro cópias desta lista (núcleo sem
 * rótulo, web, mobile e os editores de Metas), e a da web pedia em comentário
 * que "DEVEM casar" com a do mobile. Uma chave nova no sync que não aparecesse
 * aqui seria gravada e nunca lida; aqui, ela apareceria sem rótulo — o que o
 * teste pega.
 */
export const BEST_EFFORT_DISTANCES: readonly BestEffortDistance[] = BEST_EFFORT_TARGETS.map(
  (t) => ({ key: t.key, meters: t.meters, label: LABELS[t.key] ?? t.key }),
);

export type MedalRank = 1 | 2 | 3;

/**
 * Participantes mínimos para uma distância ter pódio.
 *
 * Com dois, a prata é a pior das duas; com um, o ouro é o único. Abaixo disto o
 * número continua aparecendo (é o tempo daquela corrida, e é real) — só não
 * vira medalha, porque medalha promete uma disputa.
 */
export const MIN_CONTEST_SIZE = 3;

export interface RankedEffort {
  /** `Activity.id` — a linha, não o esporte. */
  id: string;
  secs: number;
  startAt: string;
  /**
   * Posição em ranking de competição ("1224"): empatados dividem a posição e a
   * seguinte é pulada. Dois 22:14 são dois ouros, não um ouro e uma prata.
   */
  rank: number;
}

function effortOf(a: Activity, key: string): number | undefined {
  const v = a.bestEfforts?.[key];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * Todas as atividades de um esporte que têm aquela distância, da mais rápida à
 * mais lenta. Ocultas ficam fora — quem está fora das métricas está fora do
 * pódio.
 */
export function rankBestEfforts(
  activities: readonly Activity[],
  sportId: number,
  distanceKey: string,
): RankedEffort[] {
  const rows: { id: string; secs: number; startAt: string }[] = [];
  for (const a of activities) {
    if (a.hidden || a.activityId !== sportId) continue;
    const secs = effortOf(a, distanceKey);
    if (secs !== undefined) rows.push({ id: a.id, secs, startAt: a.startAt });
  }
  // Empate no tempo desempata pela data, só para a ordem de exibição ser
  // estável — a posição, essa continua dividida.
  rows.sort((x, y) => x.secs - y.secs || x.startAt.localeCompare(y.startAt));

  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.secs > rows[i - 1].secs) rank = i + 1;
    return { ...r, rank };
  });
}

/**
 * Em que lugar `activity` ficou naquela distância — `1 | 2 | 3`, ou `null`.
 *
 * `null` cobre três casos, e os três querem dizer "sem medalha", não "sem
 * dado": a corrida não tem aquela distância; ficou abaixo do 3º; ou a distância
 * tem menos de `MIN_CONTEST_SIZE` participantes.
 */
export function bestEffortRank(
  activities: readonly Activity[],
  activity: Activity,
  distanceKey: string,
): MedalRank | null {
  const ranking = rankBestEfforts(activities, activity.activityId, distanceKey);
  if (ranking.length < MIN_CONTEST_SIZE) return null;
  const mine = ranking.find((r) => r.id === activity.id);
  if (!mine || mine.rank > 3) return null;
  return mine.rank as MedalRank;
}

/** Uma distância padrão que coube dentro de uma corrida, com o lugar dela. */
export interface SegmentInside extends BestEffortDistance {
  secs: number;
  /** Ritmo daquele trecho, em segundos por quilômetro. */
  secPerKm: number;
  rank: MedalRank | null;
}

/**
 * As distâncias que **couberam** dentro de `activity`, na ordem crescente, cada
 * uma com o tempo, o ritmo e a medalha.
 *
 * "Coube" é a presença da chave em `bestEfforts`: o sync só escreve as
 * distâncias que o track cobriu, então a lista é exatamente o que aconteceu
 * naquela corrida — nada de "42 km dentro de um 10 km".
 *
 * Recebe a população inteira porque a medalha é uma comparação; sem ela a lista
 * seria só números, que é o que a tela mostra quando não há pódio.
 */
export function segmentsInside(activities: readonly Activity[], activity: Activity): SegmentInside[] {
  const out: SegmentInside[] = [];
  for (const d of BEST_EFFORT_DISTANCES) {
    const secs = effortOf(activity, d.key);
    if (secs === undefined) continue;
    out.push({
      ...d,
      secs,
      secPerKm: secs / (d.meters / 1000),
      rank: bestEffortRank(activities, activity, d.key),
    });
  }
  return out;
}
