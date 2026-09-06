import { Injectable, computed, inject, signal } from '@angular/core';
import { fetchGear, type Gear } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';

/**
 * As bicicletas do usuário, no web (ADR 0033).
 *
 * Só leitura: cadastrar e aposentar é captura, e captura vive no celular — a
 * web é para análise. A pergunta "de qual bike foi esta pedalada" não fica
 * aqui: é `gearForActivity` do núcleo, que a página chama com `gears` mais a
 * atividade.
 */
@Injectable({ providedIn: 'root' })
export class GearStore {
  private readonly auth = inject(AuthService);

  private readonly _gears = signal<Gear[]>([]);
  private readonly _loaded = signal(false);
  private readonly _loading = signal(false);

  readonly gears = computed(() => this._gears());
  readonly loaded = computed(() => this._loaded());

  async load(force = false): Promise<void> {
    if (!force && (this._loaded() || this._loading())) return;
    const userId = this.auth.user()?.id;
    if (!userId) return;
    this._loading.set(true);
    try {
      this._gears.set(await fetchGear(supabase, userId));
      this._loaded.set(true);
    } catch {
      // Sem bicicleta cadastrada a tela some sozinha; não vale um erro na cara.
    } finally {
      this._loading.set(false);
    }
  }
}
