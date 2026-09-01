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
  /**
   * Papel cromático da zona (frio → quente).
   *
   * **É o papel que manda, não o hex.** A rampa declarava cinco hex crus que por
   * acaso eram as cores-base do Orbe, e quem desenhava usava direto: o resultado
   * é que a rampa era a única coisa da tela que **não** acompanhava a paleta nem
   * o esquema — trocar para Néon mudava o gráfico acima e deixava as zonas no
   * Orbe claro, e no modo escuro elas ficavam com o contraste de um fundo que
   * não existia mais.
   */
  role: 'blue' | 'green' | 'yellow' | 'orange' | 'deep';
  /**
   * A cor no vocabulário do Orbe — a língua franca de `remapChartColor`.
   *
   * Continua aqui porque é o que o `weekly-load` já devolve nos segmentos e o
   * que o `StackedBarChart` traduz. Para desenhar, prefira resolver o `role`
   * pelo tema ativo; este campo é a ponte para quem ainda fala em hex.
   */
  color: string;
}

/** As 5 zonas padrão, da mais leve à mais intensa. Ordem = ordem de exibição. */
export const HR_ZONES: HrZoneDef[] = [
  { key: 'z1', label: 'Recuperação', min: 0.5, max: 0.6, role: 'blue', color: '#6E8CC9' },
  { key: 'z2', label: 'Aeróbico leve', min: 0.6, max: 0.7, role: 'green', color: '#6FA86A' },
  { key: 'z3', label: 'Aeróbico', min: 0.7, max: 0.8, role: 'yellow', color: '#F5B946' },
  { key: 'z4', label: 'Limiar', min: 0.8, max: 0.9, role: 'orange', color: '#F25C2B' },
  { key: 'z5', label: 'Máximo', min: 0.9, max: Infinity, role: 'deep', color: '#D9491B' },
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
