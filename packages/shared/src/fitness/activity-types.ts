/**
 * Labels canônicos dos tipos de treino (códigos HealthKit) — fonte única.
 *
 * Web (`core/models/activity-types.ts`) e mobile (`lib/workout-types.ts`) leem
 * daqui e só acrescentam o que é específico da plataforma (ícone, cor).
 * Adicione/edite labels somente aqui.
 */
export const ACTIVITY_TYPE_LABELS: Record<number, string> = {
  11: 'Cross Training',
  13: 'Ciclismo',
  16: 'Elíptico',
  20: 'Funcional',
  24: 'Trilha',
  35: 'Remo',
  37: 'Corrida',
  44: 'Escadas',
  46: 'Natação',
  50: 'Musculação',
  52: 'Caminhada',
  57: 'Yoga',
  59: 'Core',
  63: 'HIIT',
  66: 'Pilates',
  73: 'Cardio',
  82: 'Pickleball',
};

/** Label de tipos não mapeados (HealthKit tem dezenas de códigos raros). */
export const DEFAULT_ACTIVITY_LABEL = 'Treino';

/** Label do tipo de atividade; `DEFAULT_ACTIVITY_LABEL` quando desconhecido. */
export function activityTypeLabel(activityId: number): string {
  return ACTIVITY_TYPE_LABELS[activityId] ?? DEFAULT_ACTIVITY_LABEL;
}
