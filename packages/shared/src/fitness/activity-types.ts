/**
 * Labels canônicos dos tipos de treino (códigos HealthKit) — fonte única.
 *
 * Web (`core/models/activity-types.ts`) e mobile (`lib/workout-types.ts`) leem
 * daqui e só acrescentam o que é específico da plataforma (ícone, cor).
 * Adicione/edite labels somente aqui.
 */
import type { WorkoutKind } from '../health/readiness-advice';
import type { PaletteRoles } from '../theme/palettes';

/** Papel cromático de série de gráfico. */
type ChartRole = keyof PaletteRoles;

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

/**
 * Classificação dos tipos de treino por intensidade, para casar uma atividade
 * sincronizada com o `kind` de um treino planejado.
 *
 * Os quatro conjuntos são **disjuntos por contrato** — `activity-types.test.ts` impõe.
 * Sem isso a ordem de checagem em `kindForActivity` decide o resultado em silêncio:
 * um id em dois conjuntos fica inalcançável no segundo e ninguém percebe.
 */

/** Outdoor com rota GPS: ciclismo, trilha, corrida, caminhada. */
export const GPS_ACTIVITY_IDS = new Set<number>([13, 24, 37, 52]);

/** Aeróbicos sem GPS: natação, cardio, HIIT, elíptico, escadas, pickleball, remo. */
export const ENDURANCE_IDS = new Set<number>([46, 73, 63, 16, 44, 82, 35]);

/** Força: cross training, funcional, musculação, core. */
export const STRENGTH_IDS = new Set<number>([11, 20, 50, 59]);

/** Baixa intensidade: yoga, pilates. */
export const EASY_IDS = new Set<number>([57, 66]);

/** Intensidade de uma atividade sincronizada. `'none'` quando o tipo não classifica. */
export function kindForActivity(activityId: number): WorkoutKind {
  if (GPS_ACTIVITY_IDS.has(activityId) || ENDURANCE_IDS.has(activityId)) return 'endurance';
  if (STRENGTH_IDS.has(activityId)) return 'strength';
  if (EASY_IDS.has(activityId)) return 'easy';
  return 'none';
}

/** Atividade que costuma gravar rota GPS. */
export function hasGpsRoute(activityId: number): boolean {
  return GPS_ACTIVITY_IDS.has(activityId);
}

/**
 * Tipo de treino → **papel cromático**, não hex.
 *
 * Antes disso, web e mobile guardavam cada um a sua tabela de cor por
 * atividade, escrita em hex — o mobile com 18 literais em `lib/workout-types.ts`.
 * Duas cópias que precisavam concordar, e nenhuma delas conseguia responder à
 * paleta escolhida pelo usuário. Guardar o papel resolve as duas coisas: a cor
 * sai de `resolveTokens(...).roles[papel]` no tema e paleta ativos.
 *
 * Atividades da mesma família compartilham papel de propósito — ciclismo, remo
 * e natação são todas `blue`. São 17 tipos para 8 papéis; agrupar por família é
 * o que mantém o gráfico legível.
 */
export const ACTIVITY_ROLE: Record<number, ChartRole> = {
  11: 'deep',    // Cross Training
  13: 'blue',    // Ciclismo
  16: 'green',   // Elíptico
  20: 'brown',   // Funcional
  24: 'green',   // Trilha
  35: 'blue',    // Remo
  37: 'orange',  // Corrida
  44: 'brown',   // Escadas
  46: 'blue',    // Natação
  50: 'ink',     // Musculação
  52: 'yellow',  // Caminhada
  57: 'green',   // Yoga
  59: 'rose',    // Core
  63: 'deep',    // HIIT
  66: 'rose',    // Pilates
  73: 'rose',    // Cardio
  82: 'yellow',  // Pickleball
};

/** Papel de um tipo de atividade; `undefined` quando o tipo é desconhecido. */
export function activityRole(activityId: number): ChartRole | undefined {
  return ACTIVITY_ROLE[activityId];
}
