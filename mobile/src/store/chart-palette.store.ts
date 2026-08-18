import { create } from 'zustand';
import { getJSON, setJSON } from '../lib/local-store';
import { DEFAULT_CHART_PALETTE_ID, isChartPaletteId } from '@vitale/shared';

/** Preferência puramente local/cosmética (não sincroniza com Supabase). */
const KEY = 'vitale.chartPalette';

interface ChartPaletteState {
  paletteId: string;
  setPalette: (id: string) => void;
}

export const useChartPaletteStore = create<ChartPaletteState>((set) => {
  // Hidrata do armazenamento local em background. Sem flash perceptível: o default
  // já é a paleta padrão. Um id salvo que não existe mais (paletas removidas) cai
  // no default pelo isChartPaletteId.
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
