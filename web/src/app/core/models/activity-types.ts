/**
 * Metadados de exibição dos tipos de treino na web (label, slug, ícone, cor).
 * Espelha `getActivityMeta`/`GPS_ACTIVITY_IDS` de mobile/src/lib/workout-types.ts,
 * porém com ícones do IconComponent web e cores do design system.
 *
 * Mantenha os labels idênticos ao mobile para coerência entre plataformas.
 */
import { T } from '@vitale/shared';

export interface TypeMeta {
  activityId: number;
  label: string;
  slug: string;
  icon: string;
  color: string;
  hasDistance: boolean;
}

/** Atividades outdoor que costumam ter distância/rota (corrida, trilha, ciclismo, caminhada). */
export const GPS_ACTIVITY_IDS = new Set<number>([13, 24, 37, 52]);

interface BaseMeta {
  label: string;
  icon: string;
  color: string;
}

const BASE: Record<number, BaseMeta> = {
  11: { label: 'Cross Training', icon: 'dumbbell', color: T.primaryDeep },
  13: { label: 'Ciclismo', icon: 'bike', color: T.blue },
  16: { label: 'Elíptico', icon: 'trend', color: T.green },
  20: { label: 'Funcional', icon: 'dumbbell', color: T.casa },
  24: { label: 'Trilha', icon: 'hiking', color: T.green },
  35: { label: 'Remo', icon: 'dumbbell', color: T.blue },
  37: { label: 'Corrida', icon: 'run', color: T.primary },
  44: { label: 'Escadas', icon: 'arrow-u', color: T.casa },
  46: { label: 'Natação', icon: 'swim', color: T.blue },
  50: { label: 'Musculação', icon: 'dumbbell', color: T.ink },
  52: { label: 'Caminhada', icon: 'walk', color: T.yellow },
  57: { label: 'Yoga', icon: 'yoga', color: T.green },
  59: { label: 'Core', icon: 'dumbbell', color: T.rose },
  63: { label: 'HIIT', icon: 'flame', color: T.primaryDeep },
  66: { label: 'Pilates', icon: 'yoga', color: T.rose },
  73: { label: 'Cardio', icon: 'flame', color: T.rose },
  82: { label: 'Pickleball', icon: 'target', color: T.yellow },
};

const DEFAULT: BaseMeta = { label: 'Treino', icon: 'dumbbell', color: T.ink2 };

export function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
}

export function metaForActivity(activityId: number): TypeMeta {
  const base = BASE[activityId] ?? DEFAULT;
  return {
    activityId,
    label: base.label,
    slug: slugify(base.label),
    icon: base.icon,
    color: base.color,
    hasDistance: GPS_ACTIVITY_IDS.has(activityId),
  };
}

/** Todos os tipos de atividade conhecidos, ordenados por label — p/ selects/dropdowns. */
export const ALL_ACTIVITY_TYPES: TypeMeta[] = Object.keys(BASE)
  .map((id) => metaForActivity(Number(id)))
  .sort((a, b) => a.label.localeCompare(b.label));

/** Resolve um slug de rota de volta para o label do tipo (ex.: "corrida" → "Corrida"). */
export function labelForSlug(slug: string): string | undefined {
  const labels = [...Object.values(BASE).map((b) => b.label), DEFAULT.label];
  return labels.find((l) => slugify(l) === slug);
}

/** Resolve um slug de rota para o código HealthKit do tipo (ex.: "corrida" → 37). */
export function activityIdForSlug(slug: string): number | undefined {
  const entry = Object.entries(BASE).find(([, b]) => slugify(b.label) === slug);
  return entry ? Number(entry[0]) : undefined;
}
