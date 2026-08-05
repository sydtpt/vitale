/**
 * Minutos "de esforço" — modelo da OMS aplicado às atividades do Orbe.
 *
 * A OMS enuncia a diretriz para adultos de duas formas equivalentes: **150–300
 * min/semana de atividade moderada** *ou* **75–150 min de vigorosa**, na razão de que
 * 1 min vigoroso vale 2 moderados. Este módulo usa a segunda âncora: **1 min vigoroso
 * = 1 min de esforço**, e o moderado vale meio. Tempo bruto não serve para comparar
 * com a meta (60 min de yoga não valem 60 min de corrida), então cada atividade é
 * convertida em segundos ponderados por intensidade, comparáveis com a linha da meta
 * no gráfico de Duração.
 *
 * Ancorar no vigoroso — e não no moderado — é o que garante a invariante que o gráfico
 * precisa: **o esforço nunca passa da duração**, então a linha nunca sobe acima da
 * barra que a sustenta. A barra é o tempo no relógio; a linha, quanto dele contou.
 *
 * O peso sai de duas fontes, nesta ordem:
 *   1. **Zonas de FC** (`activities.hr_zones`) — o que realmente aconteceu no treino.
 *   2. **Tabela de MET por tipo** — fallback para o tempo sem cobertura de FC.
 * As duas se combinam proporcionalmente em `effectiveSeconds`, sem limiar de corte,
 * e o resultado passa por um **piso** dado pela própria tabela de MET (ver
 * `effectiveSeconds`): as zonas só podem somar, nunca derrubar o treino abaixo do
 * que o seu tipo vale por padrão.
 *
 * Sem lógica de UI aqui — só dados e funções puras (ver `hr-zones.ts` para as faixas).
 */
import type { Activity } from '../models/index';

/**
 * Faixa recomendada pela OMS (min/semana), para adultos 18–64, na âncora vigorosa —
 * equivale aos 150–300 min moderados da outra formulação. Serve de referência na UI de
 * configuração: o ganho de saúde é grande até ~75 e começa a saturar depois de ~150.
 */
export const WHO_RANGE_MIN = 75;
export const WHO_RANGE_MAX = 150;

/**
 * Meta semanal padrão em minutos de esforço, usada quando o usuário não configurou a
 * sua. Fica dentro da faixa da OMS, na parte de baixo — é um alvo que dá para sustentar
 * toda semana, não um teto. Configurável em `UserPreferences.weeklyActivityTargetMin`.
 */
export const DEFAULT_WEEKLY_TARGET_MIN = 95;

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
 * Topo da escala: 1 min vigoroso = 1 min de esforço. **Nenhum peso pode passar daqui** —
 * é disso que sai a garantia `effectiveSeconds(a) <= a.durationS`, que o gráfico de
 * Duração usa para manter a linha de esforço dentro da barra.
 */
export const MAX_WEIGHT = 1;

/** Moderado vale metade do vigoroso — a equivalência 2:1 da OMS. */
export const MODERATE_WEIGHT = 0.5;

/**
 * Peso de cada zona de FC: fração de cada segundo que conta como segundo de esforço.
 *
 * A OMS define moderado como ~64–76% da FCmáx e vigoroso como ~77%+. Mapeado nas
 * zonas do Orbe (frações da FCmáx, ver `HR_ZONES`): z1 fica abaixo do limiar e não
 * conta; z2 atravessa os 64% e conta metade do moderado; z3 é moderado; z4/z5 são
 * vigorosos e contam cheio.
 */
export const HR_ZONE_WEIGHTS: Record<string, number> = {
  z1: 0,
  z2: MODERATE_WEIGHT / 2,
  z3: MODERATE_WEIGHT,
  z4: MAX_WEIGHT,
  z5: MAX_WEIGHT,
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

/** MET assumido para tipos fora da tabela (equivale a moderado). */
export const DEFAULT_ACTIVITY_MET = 4.0;

/** Peso do que é leve demais para a diretriz aeróbica: um quarto do moderado. */
const LIGHT_WEIGHT = MODERATE_WEIGHT / 4;

/**
 * MET → peso em minutos de esforço.
 *
 * Abaixo de 3 MET a atividade é leve e fica fora da diretriz aeróbica da OMS
 * (conta pouco, mas não zero — ainda é movimento). De 3 a 6 MET é moderado. Acima de
 * 6 é vigoroso, com rampa contínua até o teto em 10 MET, para separar uma corrida
 * (~9.8 MET) de uma pedalada (~6.8 MET) em vez de achatar as duas no teto.
 */
export function metToWeight(met: number): number {
  if (met < 3) return LIGHT_WEIGHT;
  if (met < 6) return MODERATE_WEIGHT;
  return Math.min(MAX_WEIGHT, MODERATE_WEIGHT + (met - 6) / 8);
}

/**
 * Peso fixo por tipo, sobrepondo o que sairia do MET. Necessário porque `metToWeight`
 * é uma escada (leve · moderado · rampa) e não produz valores intermediários abaixo de
 * moderado.
 *
 * **57 Yoga → 0.375.** A prática aqui é Ashtanga/power, não o Hatha de 2.5 MET que a
 * tabela assume. É uma escolha deliberada com uma tensão conhecida: as sessões que
 * *têm* FC medem z1, o que puxaria para perto de zero. Mantemos 0.75 porque (a) o
 * sensor óptico de pulso é pouco confiável em yoga — pressão nas mãos, punho dobrado
 * — e (b) a OMS trata fortalecimento muscular como pilar separado (dias/semana), que
 * este app ainda não tem; sem ele, a carga real do yoga não apareceria em lugar
 * nenhum. Se esse pilar for criado, reavaliar: contar nos dois seria contar duas vezes.
 *
 * Com o piso de `effectiveSeconds`, este peso vale para a sessão inteira — inclusive
 * a que tem FC gravada, que antes zerava por medir z1. As zonas seguem podendo
 * levantar o valor (yoga em z4 conta cheio), nunca derrubá-lo abaixo de 0.375.
 */
export const ACTIVITY_WEIGHT_OVERRIDE: Record<number, number> = {
  57: 0.375,
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
 * Tempo que conta para o piso: o de movimento quando existe, senão a duração.
 *
 * O piso multiplica um tempo por um peso fixo, então tempo parado seria pago cheio
 * — num pedal urbano isso é semáforo virando crédito de saúde. `movingTimeS` corrige
 * (só existe para tipos com GPS; nos demais a duração já é o tempo ativo).
 *
 * O `min` não é defensivo à toa: há linhas no histórico com tempo de movimento maior
 * que a própria duração (yoga com 15 724 s numa sessão de 3 600 s, de fonte que não
 * deveria nem preencher o campo). O piso nunca pode pagar mais do que o relógio marcou.
 */
function activeSeconds(a: Activity, durationS: number): number {
  const moving = a.movingTimeS;
  if (typeof moving === 'number' && Number.isFinite(moving) && moving > 0) {
    return Math.min(durationS, moving);
  }
  return durationS;
}

/**
 * Segundos de esforço de uma atividade.
 *
 * **Garantia: `0 <= effectiveSeconds(a) <= a.durationS`.** Ela não vem de nenhum clamp
 * aqui dentro — cai sozinha de todo peso ser `<= MAX_WEIGHT` (1): `byZones` não passa do
 * trecho coberto porque a soma das zonas é reescalada, `uncoveredS * peso` não passa de
 * `uncoveredS`, e o piso multiplica um tempo que já é `<= durationS`. É o que mantém a
 * linha de esforço dentro da barra no gráfico de Duração. Quem mexer nos pesos precisa
 * preservar o teto, ou a invariante quebra em silêncio.
 *
 * Híbrido por construção: o trecho coberto por zonas de FC é pontuado pelo esforço
 * real; o restante (treino sem sensor, ou gravação parcial) cai na tabela de MET do
 * tipo. FC completa → 100% zonas; sem FC → 100% tabela; cobertura parcial → mistura
 * proporcional, sem constante de limiar.
 *
 * **Piso.** O resultado nunca fica abaixo de `tempo ativo × peso do tipo`. Sem ele o
 * modelo tem uma inversão: gravar FC pode valer MENOS que não gravar. Um pedal de
 * 71 km com FC em 100% do tempo, quase todo em z1, dava ~10 min de esforço; o mesmo
 * pedal sem o relógio caía inteiro na tabela de MET e dava 140 min. Medir só pode
 * acrescentar informação, nunca punir — e a leitura canônica da OMS (como os
 * questionários GPAQ/IPAQ a aplicam) é justamente tipo × duração, sem olhar FC.
 *
 * O `max` preserva o ganho das zonas: um intervalado em z4/z5 supera o piso e conta
 * mais que o padrão do tipo. As zonas premiam o que foi forte; o piso protege o que
 * foi longo.
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
      byZones += seconds * scale * (HR_ZONE_WEIGHTS[key] ?? MODERATE_WEIGHT);
    }
  }

  const coveredS = Math.min(durationS, rawZoneS);
  const uncoveredS = Math.max(0, durationS - coveredS);
  const weight = activityWeight(a.activityId);
  const byIntensity = byZones + uncoveredS * weight;

  return Math.max(byIntensity, activeSeconds(a, durationS) * weight);
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
