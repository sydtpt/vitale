/**
 * Score de prontidão/bem-estar (0–100) — derivação pura, sem I/O.
 * Combina sono, FC em repouso e VFC (ambas vs. baseline) e anéis de atividade.
 * Componentes ausentes são ignorados e os pesos renormalizados.
 *
 * Usado por web (a partir do histórico em `health_daily`) e mobile (em memória).
 */

export interface ReadinessInput {
  /** Horas dormidas na noite. */
  sleepHours?: number | null;
  /** FC em repouso do dia (bpm) e baseline (média móvel recente). */
  restingHr?: number | null;
  restingHrBaseline?: number | null;
  /** VFC do dia (ms) e baseline (média móvel recente). */
  hrv?: number | null;
  hrvBaseline?: number | null;
  /** Frações 0..1 de meta cumprida nos anéis (mover/exercício/em pé). */
  ringsPct?: number[] | null;
}

export interface ReadinessComponent {
  key: 'sono' | 'fcRepouso' | 'vfc' | 'aneis';
  label: string;
  /** Sub-score 0–100. */
  score: number;
  /** Peso relativo (antes da renormalização). */
  weight: number;
}

export interface ReadinessScore {
  /** 0–100 (média ponderada dos componentes presentes); 0 se nenhum. */
  total: number;
  components: ReadinessComponent[];
  /**
   * Fração 0–1 do peso total que estava disponível.
   *
   * A média renormaliza sobre os componentes presentes, então um score sem VFC
   * **parece** tão confiável quanto um completo. Foi o que aconteceu na prática: a
   * VFC parou de chegar em 17/07/2026 (o Garmin não escreve HRV no Apple Health) e
   * a prontidão passou a rodar com 75% da informação sem avisar ninguém.
   *
   * Quem exibe o score deve exibir isto quando for < 1.
   */
  coverage: number;
  /** Componentes que faltaram. Vazio quando `coverage === 1`. */
  missing: ReadinessComponent['key'][];
}

/** Meta de sono (h) para o sub-score chegar a 100. */
const SLEEP_TARGET_H = 8;
/** Penalidade por bpm de FC repouso acima da baseline. */
const HR_PENALTY_PER_BPM = 4;

const WEIGHTS = { sono: 0.3, fcRepouso: 0.25, vfc: 0.25, aneis: 0.2 } as const;

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function isNum(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n);
}

/**
 * Média móvel das últimas `window` leituras válidas (ignora null/undefined).
 * Use a série histórica EXCLUINDO o dia corrente para obter a baseline.
 */
export function rollingBaseline(values: (number | null | undefined)[], window = 7): number | null {
  const valid = values.filter(isNum);
  if (valid.length === 0) return null;
  const slice = valid.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function computeReadiness(input: ReadinessInput): ReadinessScore {
  const components: ReadinessComponent[] = [];

  if (isNum(input.sleepHours)) {
    components.push({
      key: 'sono',
      label: 'Sono',
      score: clamp((input.sleepHours / SLEEP_TARGET_H) * 100),
      weight: WEIGHTS.sono,
    });
  }

  if (isNum(input.restingHr) && isNum(input.restingHrBaseline) && input.restingHrBaseline > 0) {
    const delta = input.restingHr - input.restingHrBaseline; // acima da baseline = pior
    components.push({
      key: 'fcRepouso',
      label: 'FC em repouso',
      score: clamp(100 - delta * HR_PENALTY_PER_BPM),
      weight: WEIGHTS.fcRepouso,
    });
  }

  if (isNum(input.hrv) && isNum(input.hrvBaseline) && input.hrvBaseline > 0) {
    const rel = (input.hrv - input.hrvBaseline) / input.hrvBaseline; // acima da baseline = melhor
    components.push({
      key: 'vfc',
      label: 'Variabilidade (VFC)',
      score: clamp(50 + rel * 100),
      weight: WEIGHTS.vfc,
    });
  }

  if (input.ringsPct && input.ringsPct.length > 0) {
    const pcts = input.ringsPct.filter(isNum).map((p) => clamp(p * 100));
    if (pcts.length > 0) {
      components.push({
        key: 'aneis',
        label: 'Anéis de atividade',
        score: pcts.reduce((a, b) => a + b, 0) / pcts.length,
        weight: WEIGHTS.aneis,
      });
    }
  }

  const totalWeight = components.reduce((a, c) => a + c.weight, 0);
  const total =
    totalWeight > 0
      ? Math.round(components.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight)
      : 0;

  const pesoCheio = Object.values(WEIGHTS).reduce((a, w) => a + w, 0);
  const presentes = new Set(components.map((c) => c.key));
  const missing = (Object.keys(WEIGHTS) as ReadinessComponent['key'][]).filter(
    (k) => !presentes.has(k),
  );

  return { total, components, coverage: totalWeight / pesoCheio, missing };
}
