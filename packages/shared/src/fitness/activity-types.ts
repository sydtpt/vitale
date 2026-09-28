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

/* ─────────────────── Os irmãos de um tipo (correção à mão) ─────────────────── */

/**
 * Os tipos que o seletor do detalhe oferece sem abrir folha — os **irmãos de
 * família** do tipo atual, na ordem fixa em que aparecem na tela.
 *
 * A família é a de `activityFamily` (fitness/dedupe), e não uma lista nova: é a
 * mesma vizinhança que o dedupe já usa para casar "o mesmo treino rotulado
 * diferente entre ecossistemas", que é exatamente o erro que o dono corrige aqui
 * — o Apple Watch grava trilha como "Caminhada ao ar livre".
 *
 * `generic` devolve só o próprio tipo, e essa é a decisão: a família genérica
 * tem onze membros (HIIT, Cardio, Yoga, Pilates, Musculação…) e enfileirá-los
 * daria uma tela de chips em vez de um atalho. Para esses, o caminho é a folha
 * com a lista inteira — `KNOWN_ACTIVITY_IDS`.
 *
 * A ordem é fixa de propósito: o chip não pode pular de lugar quando a escolha
 * muda, senão o segundo toque cai no tipo errado.
 */
const FAMILY_SIBLINGS: Record<string, readonly number[]> = {
  foot: [37, 24, 52], // Corrida · Trilha · Caminhada
  cycle: [13],
  swim: [46],
  row: [35],
};

/** Códigos HK das famílias nomeadas — o mesmo recorte de `activityFamily`. */
const FAMILY_OF: Record<number, string> = {
  37: 'foot', 24: 'foot', 52: 'foot',
  13: 'cycle',
  46: 'swim',
  35: 'row',
};

/**
 * Irmãos de família de um tipo, em ordem fixa. Sempre inclui o próprio tipo —
 * inclusive um código desconhecido, que precisa de um chip para o dono ver de
 * onde está saindo.
 */
export function activitySiblings(activityId: number): number[] {
  const irmaos = FAMILY_SIBLINGS[FAMILY_OF[activityId] ?? ''];
  if (irmaos) return [...irmaos];
  return [activityId];
}

/** Todos os tipos com label, em ordem alfabética — a lista da folha "Outro…". */
export const KNOWN_ACTIVITY_IDS: readonly number[] = Object.keys(ACTIVITY_TYPE_LABELS)
  .map(Number)
  .sort((a, b) => ACTIVITY_TYPE_LABELS[a].localeCompare(ACTIVITY_TYPE_LABELS[b], 'pt-BR'));
