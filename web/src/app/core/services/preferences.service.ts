import { Injectable, effect, inject, signal } from '@angular/core';
import {
  DEFAULT_MAP_STYLE,
  DEFAULT_WEEKLY_TARGET_MIN,
  referenceLineColors,
  resolveMapStyle,
  resolveWeeklyTargetMin,
  type MapStyle,
  type ReferenceLineColors,
} from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';

/**
 * Preferências de app do usuário, carregadas da tabela `user_preferences`.
 * Só leitura: quem edita é o app mobile; a web apenas reflete as escolhas.
 * Recarrega quando o usuário autenticado muda.
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

  constructor() {
    effect(
      () => {
        const user = this.auth.user();
        if (!user) {
          this.mapStyle.set(DEFAULT_MAP_STYLE);
          this.weeklyActivityTargetMin.set(DEFAULT_WEEKLY_TARGET_MIN);
          this.referenceLines.set(referenceLineColors(undefined));
          return;
        }
        void this.load(user.id);
      },
      { allowSignalWrites: true },
    );
  }

  private async load(userId: string): Promise<void> {
    // `select('*')` em vez de listar colunas: a web roda contra bancos onde uma
    // migration recente pode não ter sido aplicada, e pedir uma coluna inexistente
    // faria o PostgREST rejeitar a query inteira (perdendo até o map_style).
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) return; // tabela ausente → mantém os padrões
    this.mapStyle.set(resolveMapStyle(data?.['map_style']));
    this.weeklyActivityTargetMin.set(resolveWeeklyTargetMin(data?.['weekly_activity_target_min']));
    this.referenceLines.set(referenceLineColors(data?.['reference_line_scheme']));
  }
}
