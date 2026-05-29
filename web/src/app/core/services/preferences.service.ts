import { Injectable, effect, inject, signal } from '@angular/core';
import { DEFAULT_MAP_STYLE, resolveMapStyle, type MapStyle } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';

/**
 * Preferências de app do usuário, carregadas da tabela `user_preferences`.
 * Atualmente expõe só o estilo de mapa (escolhido no app mobile); a web
 * apenas reflete a escolha. Recarrega quando o usuário autenticado muda.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly auth = inject(AuthService);

  /** Estilo de mapa atual; cai no padrão enquanto carrega ou se ausente. */
  readonly mapStyle = signal<MapStyle>(DEFAULT_MAP_STYLE);

  constructor() {
    effect(
      () => {
        const user = this.auth.user();
        if (!user) {
          this.mapStyle.set(DEFAULT_MAP_STYLE);
          return;
        }
        void this.load(user.id);
      },
      { allowSignalWrites: true },
    );
  }

  private async load(userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('map_style')
      .eq('id', userId)
      .maybeSingle();
    if (error) return; // tabela/coluna ausente → mantém o padrão
    this.mapStyle.set(resolveMapStyle(data?.map_style));
  }
}
