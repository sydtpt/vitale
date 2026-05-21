/**
 * Conjunto canônico de ícones de hábito — fonte única de verdade.
 *
 * O campo `icon` de `CounterHabit`/`Habit` guarda um destes nomes. Web renderiza
 * via `<rt-icon>` (SVG) e mobile mapeia para Ionicons (`habitIconToIonicon`).
 * Manter web e mobile alinhados: adicione/edite ícones somente aqui.
 */
export const HABIT_ICONS = [
  // Bebidas / hidratação
  'droplet', 'coffee', 'beer', 'wine', 'cheers',
  // Comida
  'utensils', 'apple', 'pizza', 'flame',
  // Exercício
  'dumbbell', 'run', 'walk', 'bike', 'swim', 'yoga', 'footprints',
  // Saúde / corpo
  'heart', 'pill', 'tooth', 'smile', 'brain', 'leaf',
  // Rotina / lazer
  'book', 'music', 'gamepad', 'tv', 'phone',
  'cigarette', 'moon', 'sun', 'wind', 'shower',
  // Outros
  'sparkle', 'target', 'flag', 'bell',
] as const;

export type HabitIconName = (typeof HABIT_ICONS)[number];

/** Ícone padrão para um novo hábito. */
export const DEFAULT_HABIT_ICON: HabitIconName = 'droplet';
