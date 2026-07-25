/**
 * Zonas de frequência cardíaca — definição única compartilhada por web e mobile.
 *
 * O tempo em cada zona é derivado das amostras de FC do treino no mobile (sync) e
 * gravado em `activities.hr_zones` (jsonb, chave da zona → segundos). Esta tabela
 * descreve só a faixa, o rótulo e a cor — a regra de cálculo vive no mobile
 * (`heart-rate-zones.ts`) e no shared (`fitness/streams.ts`). Sem lógica de
 * negócio aqui, só dados.
 *
 * As fronteiras `min`/`max` são frações da **FC máxima** (mesmo modelo padrão do
 * Garmin, para as zonas do Orbe baterem com o relógio):
 *   %FCmáx = FC / FCmáx
 * A última zona tem `max = Infinity` (capta tudo acima de 90%); a primeira capta
 * também o que está abaixo de 50% (aquecimento/repouso) — ver o cálculo no mobile.
 */
export interface HrZoneDef {
  /** Chave estável usada no jsonb `hr_zones` e nas leituras (web/mobile). */
  key: string;
  /** Rótulo de exibição. */
  label: string;
  /** Limite inferior como fração da FC máxima (só para o rótulo de faixa). */
  min: number;
  /** Limite superior (exclusivo) como fração da FC máxima; bucketização. */
  max: number;
  /** Cor da zona (frio → quente), alinhada ao design system. */
  color: string;
}

/** As 5 zonas padrão, da mais leve à mais intensa. Ordem = ordem de exibição. */
export const HR_ZONES: HrZoneDef[] = [
  { key: 'z1', label: 'Recuperação', min: 0.5, max: 0.6, color: '#6E8CC9' },
  { key: 'z2', label: 'Aeróbico leve', min: 0.6, max: 0.7, color: '#6FA86A' },
  { key: 'z3', label: 'Aeróbico', min: 0.7, max: 0.8, color: '#F5B946' },
  { key: 'z4', label: 'Limiar', min: 0.8, max: 0.9, color: '#F25C2B' },
  { key: 'z5', label: 'Máximo', min: 0.9, max: Infinity, color: '#D9491B' },
];

export function hrZoneByKey(key: string): HrZoneDef | undefined {
  return HR_ZONES.find((z) => z.key === key);
}

/** Rótulo de faixa em %, ex.: "50–60%" ou "90%+" para a última zona. */
export function hrZoneRange(zone: HrZoneDef): string {
  const lo = Math.round(zone.min * 100);
  if (!Number.isFinite(zone.max)) return `${lo}%+`;
  return `${lo}–${Math.round(zone.max * 100)}%`;
}
