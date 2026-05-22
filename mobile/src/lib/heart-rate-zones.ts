/**
 * Cálculo do tempo em cada zona de FC a partir das amostras de frequência
 * cardíaca de um treino.
 *
 * Usa **reserva de FC (Karvonen)** — mais acertiva que % da FCmáx pura porque
 * incorpora a FC de repouso medida:
 *   %FCR = (FC − FCrep) / (FCmáx − FCrep)
 * O ponto cai na zona cujo limite superior (`HR_ZONES[i].max`) é o primeiro acima
 * do %FCR; a última zona capta o restante. Sem FCrep, vira % da FCmáx (FCrep=0).
 *
 * O tempo é a soma dos intervalos entre amostras consecutivas, atribuído à zona
 * da amostra que abre o intervalo. Lacunas grandes (pausa/sem dados) são
 * descartadas para não inflar o total.
 *
 * Módulo puro (sem dependência nativa) — testável isoladamente. Consumido pelo
 * sync, que tem as amostras de FC do treino em mãos.
 */
import { HR_ZONES } from '@vitale/shared';

/** Amostra de FC: batimentos por minuto num instante (epoch ms). */
export interface HrSample {
  bpm: number;
  t: number;
}

export interface HrZoneParams {
  /** FC máxima estimada (bpm). Tipicamente 220 − idade. */
  maxHr: number;
  /** FC de repouso (bpm). Ausente/0 ⇒ cálculo cai para % da FCmáx. */
  restHr?: number;
}

/** Intervalo (s) acima do qual o gap entre amostras é considerado pausa, não tempo ativo. */
const MAX_GAP_S = 60;

/** Índice da zona para uma fração de reserva de FC. A última zona capta o resto. */
function zoneIndexForFrac(frac: number): number {
  const i = HR_ZONES.findIndex((z) => frac < z.max);
  return i < 0 ? HR_ZONES.length - 1 : i;
}

/**
 * Tempo (s) em cada zona de FC. Mapa chave→segundos só com as zonas que tiveram
 * tempo. Vazio se faltam amostras ou parâmetros válidos.
 */
export function computeHrZones(
  samples: HrSample[],
  params: HrZoneParams,
): Record<string, number> {
  const valid = samples
    .filter((s) => Number.isFinite(s.bpm) && s.bpm > 0 && Number.isFinite(s.t))
    .sort((a, b) => a.t - b.t);
  if (valid.length < 2) return {};

  const restHr = params.restHr && params.restHr > 0 ? params.restHr : 0;
  const reserve = params.maxHr - restHr;
  if (!(reserve > 0)) return {};

  const out: Record<string, number> = {};
  for (let i = 0; i < valid.length - 1; i++) {
    const dt = (valid[i + 1].t - valid[i].t) / 1000;
    if (dt <= 0 || dt > MAX_GAP_S) continue;
    const frac = (valid[i].bpm - restHr) / reserve;
    const key = HR_ZONES[zoneIndexForFrac(frac)].key;
    out[key] = (out[key] ?? 0) + dt;
  }

  const rounded: Record<string, number> = {};
  for (const [k, v] of Object.entries(out)) {
    const s = Math.round(v);
    if (s > 0) rounded[k] = s;
  }
  return rounded;
}

/**
 * FCmáx a partir da idade (220 − idade). Sem idade, usa o fallback (190 bpm),
 * suficiente para uma estimativa de zonas até o usuário ter idade no Health.
 */
export function maxHrFromAge(age?: number, fallback = 190): number {
  return age && age > 0 && age < 120 ? 220 - age : fallback;
}
