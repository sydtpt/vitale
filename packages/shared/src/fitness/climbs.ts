/**
 * Subidas: onde a pedalada realmente escalou.
 *
 * ## O que isto responde que a elevação não responde
 *
 * O número de elevação de uma atividade é **ganho acumulado**: soma todo metro
 * subido, inclusive os que vieram de um sobe-e-desce que nunca virou uma subida.
 * Medido no histórico real: um passeio de 114 km marca 1.225 m de ganho e tem só
 * **396 m** em subidas contínuas; uma pedalada de 58 km marca 832 m e tem
 * **531 m**. A segunda escala mais que a primeira, e o número de elevação sozinho
 * diz o contrário. É essa diferença que este módulo torna visível.
 *
 * ## Como uma subida é reconhecida
 *
 * Andando pelo perfil, uma subida começa quando o terreno passa a ganhar altitude
 * e vai até o pico antes de uma queda maior que `CLIMB_TOLERATED_DROP_M`. A
 * tolerância existe porque subida de verdade tem respiro: um falso plano ou uma
 * descida de cinco metros no meio de dois quilômetros de rampa não encerra a
 * subida para quem está pedalando, e não deve encerrá-la aqui. Depois de fechada,
 * a candidata só é aceita se passar dos três pisos — extensão, ganho e
 * inclinação média.
 *
 * ## O score
 *
 * `ganho × inclinação média`, e a escolha tem consequência: entre 200 m de ganho
 * a 3% e 100 m a 6%, o score é o mesmo. É de propósito — o custo de uma subida
 * mora nos dois eixos, e nenhum deles sozinho ordena a lista do jeito que o corpo
 * ordena. Não é comparável com o de outras ferramentas; serve para ordenar as
 * subidas **de uma mesma atividade** e para comparar a mesma subida ao longo do
 * tempo. A unidade é arbitrária, como o strain de `training-load.ts`.
 *
 * ## O insumo
 *
 * Entra um `ElevationProfile` de `route-profile.ts` — a mesma série suavizada que
 * a tela de detalhe já desenha. Assim as faixas destacadas caem exatamente sobre
 * o traço que o usuário vê, e não sobre uma segunda versão do mesmo perfil.
 *
 * **`profileGainM` não é o `elevationM` da atividade.** O publicado vem do sync,
 * com a janela de suavização de `streams.ts`; este vem da janela do desenho.
 * Comparar `climbGainM` com o publicado misturaria duas suavizações — por isso a
 * fração honesta é contra o `profileGainM`, que veio da mesma série.
 */
import type { ElevationProfile } from './route-profile';

/** Ganho mínimo (m) para um trecho contar como subida. */
export const CLIMB_MIN_GAIN_M = 25;
/** Inclinação média mínima (%) para um trecho contar como subida. */
export const CLIMB_MIN_GRADE_PCT = 2.5;
/** Extensão mínima (m) — abaixo disto a inclinação vira ruído de GPS. */
export const CLIMB_MIN_LENGTH_M = 50;
/** Queda (m) tolerada dentro de uma subida antes de considerá-la encerrada. */
export const CLIMB_TOLERATED_DROP_M = 8;

export interface Climb {
  /** Distância acumulada (m) onde a subida começa. */
  startM: number;
  /** Distância acumulada (m) do topo. */
  endM: number;
  lengthM: number;
  gainM: number;
  /** Inclinação média (%), sempre positiva. */
  gradePct: number;
  /** `gainM × gradePct` — ordena a lista; unidade arbitrária. */
  score: number;
  /** Índices em `xs`/`ys` do perfil, para desenhar a faixa sem recalcular nada. */
  startIdx: number;
  endIdx: number;
}

export interface ClimbSummary {
  /** Subidas encontradas, da maior para a menor por `score`. */
  climbs: Climb[];
  /** Soma do ganho das subidas (m). */
  climbGainM: number;
  /**
   * Ganho acumulado de todo o perfil (m) — o denominador honesto de
   * `climbGainM`. Ver a nota do cabeçalho: **não** é o `elevationM` publicado.
   */
  profileGainM: number;
}

export interface ClimbOptions {
  minGainM?: number;
  minGradePct?: number;
  minLengthM?: number;
  toleratedDropM?: number;
}

/** Piso válido ou o padrão. Não finito, negativo e zero caem no padrão. */
function floorOr(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

/**
 * As subidas de um perfil de elevação.
 *
 * `profile` nulo (percurso plano ou sem amostras, ver `elevationProfile`) devolve
 * resumo vazio em vez de lançar — quem desenha esconde a seção.
 */
export function findClimbs(
  profile: ElevationProfile | null,
  options: ClimbOptions = {},
): ClimbSummary {
  const empty: ClimbSummary = { climbs: [], climbGainM: 0, profileGainM: 0 };
  if (!profile) return empty;

  const { xs, ys } = profile;
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return empty;

  const minGain = floorOr(options.minGainM, CLIMB_MIN_GAIN_M);
  const minGrade = floorOr(options.minGradePct, CLIMB_MIN_GRADE_PCT);
  const minLength = floorOr(options.minLengthM, CLIMB_MIN_LENGTH_M);
  const drop = floorOr(options.toleratedDropM, CLIMB_TOLERATED_DROP_M);

  let profileGainM = 0;
  for (let i = 1; i < n; i++) {
    const d = ys[i] - ys[i - 1];
    if (d > 0) profileGainM += d;
  }

  const climbs: Climb[] = [];
  let i = 0;
  while (i < n - 1) {
    // Só começa a olhar onde o terreno sobe.
    if (ys[i + 1] <= ys[i]) {
      i++;
      continue;
    }
    let j = i;
    let peakIdx = i;
    while (j < n - 1) {
      j++;
      if (ys[j] > ys[peakIdx]) peakIdx = j;
      else if (ys[peakIdx] - ys[j] > drop) break;
    }

    const gainM = ys[peakIdx] - ys[i];
    const lengthM = xs[peakIdx] - xs[i];
    if (lengthM >= minLength && gainM >= minGain) {
      const gradePct = (100 * gainM) / lengthM;
      if (gradePct >= minGrade) {
        climbs.push({
          startM: xs[i],
          endM: xs[peakIdx],
          lengthM,
          gainM,
          gradePct,
          score: gainM * gradePct,
          startIdx: i,
          endIdx: peakIdx,
        });
      }
    }
    // Retoma **no pico**: o que vem depois dele é descida, e a próxima subida
    // começa de lá. O `max` com `i + 1` garante avanço mesmo com pico no início.
    i = Math.max(peakIdx, i + 1);
  }

  climbs.sort((a, b) => b.score - a.score);
  const climbGainM = climbs.reduce((sum, c) => sum + c.gainM, 0);
  return { climbs, climbGainM, profileGainM };
}
