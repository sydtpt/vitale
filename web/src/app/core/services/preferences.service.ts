import { Injectable, effect, inject, signal } from '@angular/core';
import {
  APP_THEMES,
  resolveBrand,
  resolvePalette,
  resolveTheme,
  DEFAULT_MAP_STYLE,
  DEFAULT_WEEKLY_TARGET_MIN,
  referenceLineColors,
  resolveMapStyle,
  resolveWeeklyTargetMin,
  type BrandId,
  type MapStyle,
  type PaletteId,
  type AppTheme,
  type ReferenceLineColors,
  type ThemeId,
} from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { fetchUserPreferencesRow } from '@vitale/shared';

/**
 * Preferências de app do usuário, carregadas da tabela `user_preferences`.
 * Recarrega quando o usuário autenticado muda.
 *
 * Só leitura, com **uma exceção**: a `ThemeService` grava os quatro eixos de
 * aparência. A convenção antiga era "quem edita é o mobile", e ela se abre aqui
 * de propósito — obrigar a pegar o celular para escurecer o desktop é UX ruim.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly auth = inject(AuthService);

  /** Estilo de mapa atual; cai no padrão enquanto carrega ou se ausente. */
  readonly mapStyle = signal<MapStyle>(DEFAULT_MAP_STYLE);

  /** Meta semanal de atividade (min de esforço); padrão se não configurada. */
  readonly weeklyActivityTargetMin = signal<number>(DEFAULT_WEEKLY_TARGET_MIN);

  /** Cores das linhas de referência do gráfico de duração. */
  readonly referenceLines = signal<ReferenceLineColors>(referenceLineColors(undefined));

  /**
   * Os quatro eixos de aparência, como vieram do banco. `null` enquanto a
   * leitura não voltou — a `ThemeService` usa o cache local até lá, para a
   * primeira pintura não piscar.
   */
  readonly appearance = signal<{
    theme: AppTheme;
    themeId: ThemeId;
    paletteId: PaletteId;
    brandId: BrandId;
  } | null>(null);

  constructor() {
    effect(
      () => {
        const user = this.auth.user();
        if (!user) {
          this.mapStyle.set(DEFAULT_MAP_STYLE);
          this.weeklyActivityTargetMin.set(DEFAULT_WEEKLY_TARGET_MIN);
          this.referenceLines.set(referenceLineColors(undefined));
          this.appearance.set(null);
          return;
        }
        void this.load(user.id);
      },
      { allowSignalWrites: true },
    );
  }

  private async load(userId: string): Promise<void> {
    let data: Record<string, unknown> | null;
    try {
      data = await fetchUserPreferencesRow(supabase, userId);
    } catch {
      return; // leitura falhou → mantém os padrões
    }
    this.mapStyle.set(resolveMapStyle(data?.['map_style'] as string | null | undefined));
    this.weeklyActivityTargetMin.set(
      resolveWeeklyTargetMin(data?.['weekly_activity_target_min'] as number | null | undefined),
    );
    this.referenceLines.set(
      referenceLineColors(data?.['reference_line_scheme'] as string | null | undefined),
    );
    // A lista vem do núcleo em vez de repetida aqui: enumerar os valores à mão
    // fez `solar`, escolhido no celular, chegar na web como `system` calado.
    const theme = (data?.['theme'] as AppTheme | undefined) ?? 'system';
    this.appearance.set({
      theme: APP_THEMES.includes(theme) ? theme : 'system',
      themeId: resolveTheme(data?.['theme_id'] as string | null | undefined).id,
      paletteId: resolvePalette(data?.['palette_id'] as string | null | undefined).id,
      brandId: resolveBrand(data?.['brand_id'] as string | null | undefined).id,
    });
  }
}
