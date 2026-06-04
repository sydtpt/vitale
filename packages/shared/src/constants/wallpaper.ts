/**
 * Papéis de parede (fundos de tela) do app — variantes em retrato (mobile),
 * com formas ancoradas no topo (header) e no rodapé (tab bar).
 * Fonte única reutilizada pelo mobile (seletor em Aparência + camada de fundo).
 *
 * - `flat`        — fundo creme sólido (`bg`); o padrão histórico do app.
 * - `headerGlow`  — brilho concentrado no topo, fundo limpo embaixo.
 * - `bottomBlob`  — blobs orgânicos subindo do rodapé + 1 círculo e 1 anel no topo.
 * - `cornerRings` — anéis concêntricos saindo do canto superior direito.
 * - `hills`       — camadas de ondas sobrepostas no rodapé.
 * - `mesh`        — malha de 5 glows soft difusos. O mais colorido.
 * - `contourV`    — curvas de nível verticais correndo de cima a baixo.
 * - `bars`        — pílulas arredondadas soltas, sangrando pelas laterais.
 *
 * As cores de cada fundo vêm dos tokens do tema (claro/escuro), então cada
 * variante adapta automaticamente ao esquema ativo.
 */
export type Wallpaper =
  | 'flat'
  | 'headerGlow'
  | 'bottomBlob'
  | 'cornerRings'
  | 'hills'
  | 'mesh'
  | 'contourV'
  | 'bars';

/** Lista ordenada com rótulo curto exibido no seletor de Aparência. */
export const WALLPAPERS: ReadonlyArray<{ id: Wallpaper; label: string }> = [
  { id: 'flat', label: 'Flat' },
  { id: 'headerGlow', label: 'Header' },
  { id: 'bottomBlob', label: 'Blob' },
  { id: 'cornerRings', label: 'Arcos' },
  { id: 'hills', label: 'Colinas' },
  { id: 'mesh', label: 'Mesh' },
  { id: 'contourV', label: 'Curvas' },
  { id: 'bars', label: 'Barras' },
];

const WALLPAPER_IDS = new Set<string>(WALLPAPERS.map((w) => w.id));

/** Papel de parede aplicado quando o usuário ainda não escolheu. */
export const DEFAULT_WALLPAPER: Wallpaper = 'flat';

/** Resolve um papel de parede (com fallback seguro) a partir de um valor possivelmente inválido/ausente. */
export function resolveWallpaper(value: string | null | undefined): Wallpaper {
  return value && WALLPAPER_IDS.has(value) ? (value as Wallpaper) : DEFAULT_WALLPAPER;
}
