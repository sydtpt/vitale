import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { HabitIconName } from '@vitale/shared';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Mapeia cada ícone canônico (`HABIT_ICONS` do shared, renderizado como SVG no
 * web) para o nome Ionicons equivalente no mobile. Fonte da lista: `@vitale/shared`.
 * Ao adicionar um ícone no shared, adicione a entrada aqui também.
 */
const HABIT_ICON_IONICON: Record<HabitIconName, IoniconName> = {
  // Bebidas / hidratação
  droplet: 'water-outline',
  coffee: 'cafe-outline',
  beer: 'beer-outline',
  wine: 'wine-outline',
  cheers: 'pint-outline',
  // Comida
  utensils: 'restaurant-outline',
  apple: 'nutrition-outline',
  pizza: 'pizza-outline',
  flame: 'flame-outline',
  // Exercício
  dumbbell: 'barbell-outline',
  run: 'fitness-outline',
  walk: 'walk-outline',
  bike: 'bicycle-outline',
  swim: 'body-outline',
  yoga: 'accessibility-outline',
  footprints: 'footsteps-outline',
  // Saúde / corpo
  heart: 'heart-outline',
  pill: 'medkit-outline',
  tooth: 'medical-outline',
  smile: 'happy-outline',
  brain: 'bulb-outline',
  leaf: 'leaf-outline',
  // Rotina / lazer
  book: 'book-outline',
  music: 'musical-notes-outline',
  gamepad: 'game-controller-outline',
  tv: 'tv-outline',
  phone: 'phone-portrait-outline',
  cigarette: 'logo-no-smoking',
  moon: 'moon-outline',
  sun: 'sunny-outline',
  wind: 'cloud-outline',
  shower: 'rainy-outline',
  // Outros
  sparkle: 'sparkles-outline',
  target: 'locate-outline',
  flag: 'flag-outline',
  bell: 'notifications-outline',
};

/** Compat: hábitos antigos guardavam nomes Ionicons direto — passam adiante. */
const LEGACY_ICON_IONICON: Record<string, IoniconName> = {
  cafe: 'cafe-outline',
  fitness: 'fitness-outline',
  bed: 'bed-outline',
  nutrition: 'nutrition-outline',
  water: 'water-outline',
};

const FALLBACK: IoniconName = 'ellipse-outline';

/** Resolve o nome do ícone de um hábito para um glifo Ionicons válido. */
export function habitIconToIonicon(name: string | undefined | null): IoniconName {
  if (!name) return FALLBACK;
  return HABIT_ICON_IONICON[name as HabitIconName] ?? LEGACY_ICON_IONICON[name] ?? FALLBACK;
}
