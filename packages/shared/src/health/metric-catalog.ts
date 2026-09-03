/**
 * Catálogo de metadados das métricas de saúde (Apple Health).
 *
 * Fonte ÚNICA, sem dependência nativa: o mobile (`config/health-metrics.ts`)
 * importa estes metadados e só acrescenta ícone + `fetch` (react-native-health)
 * + `format`; o web os consome diretamente para renderizar a feature Saúde.
 * Não inclui lógica — só descreve cada métrica (alinhado a `health_daily.metric`).
 */

export type HealthMetricKind = 'cumulative' | 'discrete';
export type HealthCategoryId = 'atividade' | 'coracao' | 'corpo' | 'sono' | 'nutricao';

export interface HealthCategoryMeta {
  id: HealthCategoryId;
  label: string;
}

export interface HealthMetricMeta {
  id: string;
  label: string;
  category: HealthCategoryId;
  /** Unidade exibida (ex.: 'bpm', 'kcal'). Vazia quando adimensional (IMC, anéis). */
  unit: string;
  /** cumulative = soma no dia; discrete = média/min/max no dia. */
  kind: HealthMetricKind;
  /** Casas decimais ao formatar (0 quando ausente). */
  decimals?: number;
  /** Texto auxiliar do que a métrica representa. */
  caption?: string;
}

export const HEALTH_CATEGORIES: HealthCategoryMeta[] = [
  { id: 'atividade', label: 'Atividade' },
  { id: 'coracao', label: 'Coração' },
  { id: 'corpo', label: 'Corpo' },
  { id: 'sono', label: 'Sono' },
  { id: 'nutricao', label: 'Nutrição' },
];

export const HEALTH_METRICS: HealthMetricMeta[] = [
  // ── Atividade ──────────────────────────────────────────────
  { id: 'passos', label: 'Passos', category: 'atividade', unit: 'passos', kind: 'cumulative', caption: 'Contagem diária' },
  { id: 'distancia', label: 'Distância', category: 'atividade', unit: 'km', kind: 'cumulative', caption: 'Caminhada + corrida' },
  { id: 'andares', label: 'Andares', category: 'atividade', unit: 'andares', kind: 'cumulative', caption: 'Lances de escada subidos' },
  { id: 'energia', label: 'Energia ativa', category: 'atividade', unit: 'kcal', kind: 'cumulative', caption: 'Calorias de movimento' },
  { id: 'exercicio', label: 'Min. de exercício', category: 'atividade', unit: 'min', kind: 'cumulative', caption: 'Anel de exercício' },
  { id: 'aneis', label: 'Anéis de atividade', category: 'atividade', unit: '', kind: 'discrete', caption: 'Mover · Exercício · Em pé' },

  // ── Coração ────────────────────────────────────────────────
  { id: 'fc', label: 'Freq. cardíaca', category: 'coracao', unit: 'bpm', kind: 'discrete', caption: 'Batimentos por minuto' },
  { id: 'fcRepouso', label: 'FC em repouso', category: 'coracao', unit: 'bpm', kind: 'discrete', caption: 'Em descanso' },
  // Duas fontes na mesma métrica (ADR 0026): SDNN do Apple Watch, RMSSD do Garmin via
  // intervals.icu. `health_daily.extra.kind` diz qual escala cada linha carrega.
  { id: 'vfc', label: 'Variabilidade (VFC)', category: 'coracao', unit: 'ms', kind: 'discrete', caption: 'HRV — SDNN (Apple) · RMSSD (intervals.icu)' },
  { id: 'vo2max', label: 'VO₂ máx', category: 'coracao', unit: 'mL/kg·min', kind: 'discrete', decimals: 1, caption: 'Capacidade aeróbica' },
  { id: 'spo2', label: 'Oxigênio (SpO₂)', category: 'coracao', unit: '%', kind: 'discrete', caption: 'Saturação de oxigênio' },
  { id: 'respiracao', label: 'Freq. respiratória', category: 'coracao', unit: 'resp/min', kind: 'discrete', caption: 'Respirações por minuto' },
  { id: 'pressao', label: 'Pressão arterial', category: 'coracao', unit: 'mmHg', kind: 'discrete', caption: 'Sistólica / diastólica' },

  // ── Corpo ──────────────────────────────────────────────────
  { id: 'peso', label: 'Peso', category: 'corpo', unit: 'kg', kind: 'discrete', decimals: 1, caption: 'Massa corporal' },
  { id: 'imc', label: 'IMC', category: 'corpo', unit: '', kind: 'discrete', decimals: 1, caption: 'Índice de massa corporal' },
  { id: 'gordura', label: '% de gordura', category: 'corpo', unit: '%', kind: 'discrete', decimals: 1, caption: 'Percentual de gordura' },
  { id: 'massaMagra', label: 'Massa magra', category: 'corpo', unit: 'kg', kind: 'discrete', decimals: 1, caption: 'Massa corporal magra' },
  { id: 'cintura', label: 'Cintura', category: 'corpo', unit: 'cm', kind: 'discrete', decimals: 1, caption: 'Circunferência da cintura' },

  // ── Sono ───────────────────────────────────────────────────
  { id: 'sono', label: 'Sono', category: 'sono', unit: 'h', kind: 'cumulative', caption: 'Horas dormidas por noite' },

  // ── Nutrição ───────────────────────────────────────────────
  { id: 'agua', label: 'Água', category: 'nutricao', unit: 'L', kind: 'cumulative', decimals: 2, caption: 'Ingestão de água' },
  { id: 'calorias', label: 'Calorias', category: 'nutricao', unit: 'kcal', kind: 'cumulative', caption: 'Energia consumida' },
  { id: 'macros', label: 'Macronutrientes', category: 'nutricao', unit: 'g', kind: 'cumulative', caption: 'Proteína · Carbo · Gordura' },
  { id: 'proteina', label: 'Proteína', category: 'nutricao', unit: 'g', kind: 'cumulative', caption: 'Proteína consumida' },
];

export function healthMetricById(id: string): HealthMetricMeta | undefined {
  return HEALTH_METRICS.find((m) => m.id === id);
}

export function healthMetricsByCategory(id: HealthCategoryId): HealthMetricMeta[] {
  return HEALTH_METRICS.filter((m) => m.category === id);
}
