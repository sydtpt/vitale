import { create } from 'zustand';
import { getJSON, setJSON } from '../lib/local-store';
import { DEFAULT_CHART_PALETTE_ID, isChartPaletteId } from '../lib/chart-palettes';

/** Preferência puramente local/cosmética (não sincroniza com Supabase). */
const KEY = 'vitale.chartPalette';

interface ChartPaletteState {
  paletteId: string;
  setPalette: (id: string) => void;
}

export const useChartPaletteStore = create<ChartPaletteState>((set) => {
  // Hidrata do armazenamento local em background. O default ('atual') já é a paleta
  // atual do app, então não há flash perceptível enquanto carrega.
  void getJSON<{ id: string }>(KEY).then((v) => {
    if (v?.id && isChartPaletteId(v.id)) set({ paletteId: v.id });
  });
  return {
    paletteId: DEFAULT_CHART_PALETTE_ID,
    setPalette: (id) => {
      set({ paletteId: id });
      void setJSON(KEY, { id });
    },
  };
});
