/**
 * Metadados de exibição dos tipos de treino na web (label, slug, ícone, cor).
 * Espelha `getActivityMeta`/`GPS_ACTIVITY_IDS` de mobile/src/lib/workout-types.ts,
 * porém com ícones do IconComponent web e cores do design system.
 *
 * Mantenha os labels idênticos ao mobile para coerência entre plataformas.
 */
import { ACTIVITY_TYPE_LABELS, DEFAULT_ACTIVITY_LABEL, activityTypeLabel, T } from '@vitale/shared';

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
  icon: string;
  color: string;
}

/** Ícone/cor por tipo; o label vem do shared (`ACTIVITY_TYPE_LABELS`). */
const BASE: Record<number, BaseMeta> = {
  11: { icon: 'dumbbell', color: T.primaryDeep },
  13: { icon: 'bike', color: T.blue },
  16: { icon: 'trend', color: T.green },
  20: { icon: 'dumbbell', color: T.casa },
  24: { icon: 'hiking', color: T.green },
  35: { icon: 'dumbbell', color: T.blue },
  37: { icon: 'run', color: T.primary },
  44: { icon: 'arrow-u', color: T.casa },
  46: { icon: 'swim', color: T.blue },
  50: { icon: 'dumbbell', color: T.ink },
  52: { icon: 'walk', color: T.yellow },
  57: { icon: 'yoga', color: T.green },
  59: { icon: 'dumbbell', color: T.rose },
  63: { icon: 'flame', color: T.primaryDeep },
  66: { icon: 'yoga', color: T.rose },
  73: { icon: 'flame', color: T.rose },
  82: { icon: 'target', color: T.yellow },
};

const DEFAULT: BaseMeta = { icon: 'dumbbell', color: T.ink2 };

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
  const label = activityTypeLabel(activityId);
  return {
    activityId,
    label,
    slug: slugify(label),
    icon: base.icon,
    color: base.color,
    hasDistance: GPS_ACTIVITY_IDS.has(activityId),
  };
}

/** Todos os tipos de atividade conhecidos, ordenados por label — p/ selects/dropdowns. */
export const ALL_ACTIVITY_TYPES: TypeMeta[] = Object.keys(ACTIVITY_TYPE_LABELS)
  .map((id) => metaForActivity(Number(id)))
  .sort((a, b) => a.label.localeCompare(b.label));

/** Resolve um slug de rota de volta para o label do tipo (ex.: "corrida" → "Corrida"). */
export function labelForSlug(slug: string): string | undefined {
  const labels = [...Object.values(ACTIVITY_TYPE_LABELS), DEFAULT_ACTIVITY_LABEL];
  return labels.find((l) => slugify(l) === slug);
}

/** Resolve um slug de rota para o código HealthKit do tipo (ex.: "corrida" → 37). */
export function activityIdForSlug(slug: string): number | undefined {
  const entry = Object.entries(ACTIVITY_TYPE_LABELS).find(([, label]) => slugify(label) === slug);
  return entry ? Number(entry[0]) : undefined;
}
