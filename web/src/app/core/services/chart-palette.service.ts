import { Injectable, signal } from '@angular/core';
import { DEFAULT_CHART_PALETTE_ID, isChartPaletteId, remapChartColor } from '@vitale/shared';

/** Preferência puramente local/cosmética da paleta dos gráficos (localStorage;
 * não sincroniza com Supabase). Espelha o chart-palette.store do mobile. */
const KEY = 'vitale.chartPalette';

@Injectable({ providedIn: 'root' })
export class ChartPaletteService {
  readonly paletteId = signal<string>(readInitial());

  setPalette(id: string): void {
    if (!isChartPaletteId(id)) return;
    this.paletteId.set(id);
    try {
      localStorage.setItem(KEY, JSON.stringify({ id }));
    } catch {
      /* localStorage indisponível — mantém só em memória */
    }
  }

  /** Remapeia uma cor-base para a paleta ativa. Reativo: lê o signal. */
  remap(hex: string): string {
    return remapChartColor(hex, this.paletteId());
  }
}

function readInitial(): string {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as { id?: string };
      if (v?.id && isChartPaletteId(v.id)) return v.id;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CHART_PALETTE_ID;
}
