/**
 * Minutos "moderados equivalentes" — modelo da OMS aplicado às atividades do Orbe.
 *
 * A diretriz da OMS para adultos é **150–300 min/semana de atividade moderada**, com a
 * equivalência de que 1 min vigoroso vale 2 min moderados. Tempo bruto não serve
 * para comparar com essa meta: 60 min de yoga não valem 60 min de corrida. Este
 * módulo converte a duração de cada atividade em segundos ponderados por
 * intensidade, para que a linha de esforço do gráfico de Duração seja comparável
 * com a linha da meta.
 *
 * O peso sai de duas fontes, nesta ordem:
 *   1. **Zonas de FC** (`activities.hr_zones`) — o que realmente aconteceu no treino.
 *   2. **Tabela de MET por tipo** — fallback para o tempo sem cobertura de FC.
 * As duas se combinam proporcionalmente em `effectiveSeconds`, sem limiar de corte.
 *
 * Sem lógica de UI aqui — só dados e funções puras (ver `hr-zones.ts` para as faixas).
 */
import type { Activity } from '../models/index';

/**
 * Faixa recomendada pela OMS (min/semana de atividade moderada), para adultos 18–64.
 * Serve de referência na UI de configuração — o ganho de saúde é grande até ~150 e
 * começa a saturar depois de ~300.
 */
export const WHO_RANGE_MIN = 150;
export const WHO_RANGE_MAX = 300;

/**
 * Meta semanal padrão em minutos moderados equivalentes, usada quando o usuário não
 * configurou a sua. Fica dentro da faixa da OMS, na parte de baixo — é um alvo que
 * dá para sustentar toda semana, não um teto. Configurável em
 * `UserPreferences.weeklyActivityTargetMin`.
 */
export const DEFAULT_WEEKLY_TARGET_MIN = 190;

/** Limites aceitos para a meta configurável (espelham o check da migration). */
export const MIN_WEEKLY_TARGET_MIN = 30;
export const MAX_WEEKLY_TARGET_MIN = 1500;

/**
 * Normaliza a meta vinda das preferências: descarta valor ausente, não-finito ou
 * fora dos limites, caindo no padrão. Usar sempre antes de exibir/calcular.
 */
export function resolveWeeklyTargetMin(raw: number | null | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_WEEKLY_TARGET_MIN;
  if (raw < MIN_WEEKLY_TARGET_MIN || raw > MAX_WEEKLY_TARGET_MIN) return DEFAULT_WEEKLY_TARGET_MIN;
  return Math.round(raw);
}

/**
 * Peso de cada zona de FC: fração de cada segundo que conta como segundo moderado.
 *
 * A OMS define moderado como ~64–76% da FCmáx e vigoroso como ~77%+. Mapeado nas
 * zonas do Orbe (frações da FCmáx, ver `HR_ZONES`): z1 fica abaixo do limiar e não
 * conta; z2 atravessa os 64% e conta metade; z3 é moderado; z4/z5 são vigorosos e
 * valem o dobro.
 */
export const HR_ZONE_WEIGHTS: Record<string, number> = {
  z1: 0,
  z2: 0.5,
  z3: 1,
  z4: 2,
  z5: 2,
};

/**
 * MET aproximado por tipo de atividade (código HealthKit), do *Compendium of
 * Physical Activities*. Só a intensidade típica — o peso é derivado por
 * `metToWeight`, para não manter duas tabelas em sincronia.
 *
 * Mantenha as chaves alinhadas com `BASE` de web/src/app/core/models/activity-types.ts.
 */
export const ACTIVITY_MET: Record<number, number> = {
  11: 6.0, // Cross Training
  13: 6.8, // Ciclismo
  16: 5.0, // Elíptico
  20: 5.0, // Funcional
  24: 5.3, // Trilha
  35: 6.0, // Remo
  37: 9.8, // Corrida
  44: 8.0, // Escadas
  46: 7.0, // Natação
  50: 5.0, // Musculação
  52: 4.3, // Caminhada
  57: 2.5, // Yoga
  59: 3.8, // Core
  63: 8.0, // HIIT
  66: 2.8, // Pilates
  73: 6.0, // Cardio
  82: 4.8, // Pickleball
};

/** MET assumido para tipos fora da tabela (equivale a moderado, peso 1). */
export const DEFAULT_ACTIVITY_MET = 4.0;

/**
 * MET → peso em minutos moderados equivalentes.
 *
 * Abaixo de 3 MET a atividade é leve e fica fora da diretriz aeróbica da OMS
 * (conta pouco, mas não zero — ainda é movimento). De 3 a 6 MET é moderado (1x).
 * Acima de 6 é vigoroso, com rampa contínua até o teto de 2x, para separar uma
 * corrida (~9.8 MET) de uma pedalada (~6.8 MET) em vez de achatar as duas no 2x.
 */
export function metToWeight(met: number): number {
  if (met < 3) return 0.25;
  if (met < 6) return 1;
  return Math.min(2, 1 + (met - 6) / 4);
}

/**
 * Peso fixo por tipo, sobrepondo o que sairia do MET. Necessário porque `metToWeight`
 * é uma escada (0.25 · 1 · rampa) e não produz valores intermediários abaixo de
 * moderado.
 *
 * **57 Yoga → 0.75.** A prática aqui é Ashtanga/power, não o Hatha de 2.5 MET que a
 * tabela assume. É uma escolha deliberada com uma tensão conhecida: as sessões que
 * *têm* FC medem z1, o que puxaria para perto de zero. Mantemos 0.75 porque (a) o
 * sensor óptico de pulso é pouco confiável em yoga — pressão nas mãos, punho dobrado
 * — e (b) a OMS trata fortalecimento muscular como pilar separado (dias/semana), que
 * este app ainda não tem; sem ele, a carga real do yoga não apareceria em lugar
 * nenhum. Se esse pilar for criado, reavaliar: contar nos dois seria contar duas vezes.
 *
 * Só afeta o tempo **sem FC**: com batimentos gravados, as zonas continuam mandando.
 */
export const ACTIVITY_WEIGHT_OVERRIDE: Record<number, number> = {
  57: 0.75,
};

/** Peso de um tipo de atividade, usado quando não há FC para aquele trecho. */
export function activityWeight(activityId: number): number {
  const override = ACTIVITY_WEIGHT_OVERRIDE[activityId];
  if (override !== undefined) return override;
  return metToWeight(ACTIVITY_MET[activityId] ?? DEFAULT_ACTIVITY_MET);
}

function sumValues(rec: Record<string, number> | undefined): number {
  if (!rec) return 0;
  let total = 0;
  for (const v of Object.values(rec)) if (Number.isFinite(v) && v > 0) total += v;
  return total;
}

/**
 * Segundos moderados equivalentes de uma atividade.
 *
 * Híbrido por construção: o trecho coberto por zonas de FC é pontuado pelo esforço
 * real; o restante (treino sem sensor, ou gravação parcial) cai na tabela de MET do
 * tipo. FC completa → 100% zonas; sem FC → 100% tabela; cobertura parcial → mistura
 * proporcional, sem constante de limiar.
 */
export function effectiveSeconds(a: Activity): number {
  const durationS = Math.max(0, a.durationS ?? 0);
  if (!durationS) return 0;

  const zones = a.hrZones;
  // O jsonb pode somar mais que a duração (amostras sobrepostas de apps distintos).
  // Escalar mantém a proporção entre zonas sem inflar o total.
  const rawZoneS = sumValues(zones);
  const scale = rawZoneS > durationS ? durationS / rawZoneS : 1;

  let byZones = 0;
  if (zones) {
    for (const [key, seconds] of Object.entries(zones)) {
      if (!Number.isFinite(seconds) || seconds <= 0) continue;
      byZones += seconds * scale * (HR_ZONE_WEIGHTS[key] ?? 1);
    }
  }

  const coveredS = Math.min(durationS, rawZoneS);
  const uncoveredS = Math.max(0, durationS - coveredS);
  return byZones + uncoveredS * activityWeight(a.activityId);
}

/** Granularidade de um bucket do gráfico — define o prorrateio da meta da OMS. */
export type BucketGranularity = 'day' | 'week' | 'month' | 'year';

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function daysInYear(d: Date): number {
  const y = d.getFullYear();
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return leap ? 366 : 365;
}

/**
 * Fração de um bucket já decorrida (0–1); `1` quando o bucket já fechou.
 *
 * Serve para prorratear a meta do bucket **em curso**: comparar o mês corrente (ou
 * a semana/o ano correntes) com a meta cheia é injusto, porque a barra só tem os
 * dias que já aconteceram. Só o último bucket de um período pode estar em curso.
 */
export function elapsedFraction(start: Date, end: Date, now: Date): number {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / total));
}

/**
 * Meta **cheia** de um bucket, em segundos, prorrateada pela granularidade (segundos
 * porque é a unidade das barras de duração do gráfico).
 *
 * Devolve sempre o alvo completo do bucket. O desconto do bucket em curso é aplicado
 * por quem consome, multiplicando por `elapsedFraction` — assim o valor cheio segue
 * disponível para o rótulo ("14h/mês") enquanto a linha desce em degrau.
 */
export function weeklyTargetSeconds(
  granularity: BucketGranularity,
  bucketStart: Date,
  weeklyTargetMin: number = DEFAULT_WEEKLY_TARGET_MIN,
): number {
  const weekly = resolveWeeklyTargetMin(weeklyTargetMin) * 60;
  switch (granularity) {
    case 'day': return weekly / 7;
    case 'week': return weekly;
    case 'month': return (weekly / 7) * daysInMonth(bucketStart);
    case 'year': return (weekly / 7) * daysInYear(bucketStart);
  }
}
