/**
 * Estimativa calórica grosseira para hábitos contadores de consumo (cerveja,
 * hoje). Não é nutrição: é ordem de grandeza para dar sentido ao total do
 * período na Retrospectiva ("12,5 L" sozinho não diz nada).
 *
 * Derivação pura — só nome + unidade + total, sem tocar em persistência.
 */

/**
 * Cervejas de casa (Bélgica). `kcalPerL` cruza duas fontes que discordam em
 * ~10%: o rótulo do fabricante e a estimativa por composição
 * (6,9 kcal/g de álcool × ABV × 0,789 + 4 kcal/g de carboidrato). Ficam no meio
 * — a margem real de qualquer estimativa dessas é ±15%.
 *
 * `mlPerUnit` é o copo padrão: 25 cl para o pintje de lager, 33 cl para a IPA.
 */
export interface BeerStyle {
  id: string;
  label: string;
  abv: number;
  kcalPerL: number;
  mlPerUnit: number;
}

export const BEERS: readonly BeerStyle[] = [
  { id: 'stella', label: 'Stella Artois', abv: 5.2, kcalPerL: 450, mlPerUnit: 250 },
  { id: 'jupiler', label: 'Jupiler', abv: 5.2, kcalPerL: 430, mlPerUnit: 250 },
  { id: 'bbp-ipa', label: 'BBP IPA', abv: 6.5, kcalPerL: 600, mlPerUnit: 330 },
];

/**
 * Mistura assumida quando o log não diz qual cerveja foi — e hoje nunca diz:
 * `habit_logs` guarda só litros. Duas lagers para uma IPA.
 */
export const DEFAULT_BEER_MIX: Readonly<Record<string, number>> = {
  stella: 0.4, jupiler: 0.4, 'bbp-ipa': 0.2,
};

function blend(mix: Readonly<Record<string, number>>, sel: (b: BeerStyle) => number): number {
  let total = 0;
  let weight = 0;
  for (const b of BEERS) {
    const w = mix[b.id] ?? 0;
    total += sel(b) * w;
    weight += w;
  }
  return weight > 0 ? total / weight : 0;
}

/** ≈472 kcal/L — média ponderada da `DEFAULT_BEER_MIX`. */
export const BEER_KCAL_PER_L = Math.round(blend(DEFAULT_BEER_MIX, (b) => b.kcalPerL));

/** ≈266 ml — copo médio da mesma mistura, para hábitos contados em unidades. */
export const BEER_ML_PER_UNIT = Math.round(blend(DEFAULT_BEER_MIX, (b) => b.mlPerUnit));

/**
 * Piso e teto da estimativa: só lager mais leve vs. só IPA. Serve para dizer
 * "entre X e Y kcal" quando a precisão importa mais que a brevidade.
 */
export const BEER_KCAL_PER_L_RANGE: readonly [number, number] = [
  Math.min(...BEERS.map((b) => b.kcalPerL)),
  Math.max(...BEERS.map((b) => b.kcalPerL)),
];

/** Densidade calórica por nome de hábito (normalizado), em kcal por litro. */
const KCAL_BY_HABIT: { keyword: string; kcalPerL: number; mlPerUnit: number }[] = [
  { keyword: 'cerveja', kcalPerL: BEER_KCAL_PER_L, mlPerUnit: BEER_ML_PER_UNIT },
];

/** minúsculas sem acento, para casar 'Cerveja' / 'CERVEJA' / 'cerveja artesanal'. */
function normalize(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Total do hábito convertido em litros; null quando a unidade não é de volume. */
function litersOf(unit: string, total: number, mlPerUnit: number): number | null {
  const u = normalize(unit).trim();
  if (u === 'l') return total;
  if (u === 'ml') return total / 1000;
  // 'un' ou vazio: o hábito conta copos/garrafas, não volume.
  if (u === 'un' || u === '') return (total * mlPerUnit) / 1000;
  return null;
}

/**
 * kcal estimadas para o total acumulado de um hábito, ou null quando não há
 * densidade conhecida para o nome ou a unidade não é de volume/contagem.
 *
 * Unidades aceitas: `L`, `ml` (volume direto) e `un` / vazio (× copo padrão).
 */
export function habitCalories(name: string, unit: string, total: number): number | null {
  if (!(total > 0)) return null;
  const n = normalize(name);
  const entry = KCAL_BY_HABIT.find(
    (e) => new RegExp(`(^|[^a-z])${e.keyword}([^a-z]|$)`).test(n),
  );
  if (!entry) return null;

  const liters = litersOf(unit, total, entry.mlPerUnit);
  return liters == null ? null : Math.round(liters * entry.kcalPerL);
}

/**
 * Faixa min–max das kcal do hábito (só lager leve … só IPA), ou null nos mesmos
 * casos de `habitCalories`. A UI usa quando quer mostrar a incerteza.
 */
export function habitCaloriesRange(
  name: string, unit: string, total: number,
): readonly [number, number] | null {
  if (habitCalories(name, unit, total) == null) return null;
  const liters = litersOf(unit, total, BEER_ML_PER_UNIT);
  if (liters == null) return null;
  const [lo, hi] = BEER_KCAL_PER_L_RANGE;
  return [Math.round(liters * lo), Math.round(liters * hi)];
}
