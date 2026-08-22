import { Injectable, computed, inject, signal } from '@angular/core';
import type { CulturaItem } from '@vitale/shared';
import {
  CULTURA_TIPOS,
  contagemPorEstado,
  contagemPorTipo,
  distribuicaoDeNotas,
  fetchCulturaItems,
  janelaIntersecta,
  localDateStr,
  paradosEmAndamento,
  rankingIndicadores,
} from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Recorte temporal do acervo. `tudo` ignora janela. */
export type Periodo = 'mes' | 'ano' | 'tudo';

/**
 * Fonte única do módulo Cultura no web. Um fetch de `cultura_items`; todo o
 * resto deriva por `computed()`.
 *
 * As agregações vêm de `cultura/analytics` no núcleo, não daqui: são puras,
 * testadas pelo runner do shared, e assim a página e um eventual recorte no
 * mobile nunca divergem sobre o que "parado há mais tempo" significa.
 */
@Injectable({ providedIn: 'root' })
export class CulturaStore {
  private readonly auth = inject(AuthService);

  private readonly _itens = signal<CulturaItem[]>([]);
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);
  private readonly _periodo = signal<Periodo>('tudo');

  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  readonly periodo = this._periodo.asReadonly();
  readonly loading = computed(() => this._state() === 'loading' || this._state() === 'idle');
  readonly isEmpty = computed(() => this._state() === 'loaded' && this._itens().length === 0);

  readonly itens = this._itens.asReadonly();
  readonly tipos = CULTURA_TIPOS;

  /**
   * Itens dentro do período. `tudo` devolve a estante inteira; os demais
   * filtram por interseção de JANELA (CAP-5), o que exclui o que está em
   * `quero` — item que você ainda não começou não pertence a um período.
   */
  readonly noPeriodo = computed(() => {
    const p = this._periodo();
    if (p === 'tudo') return this._itens();
    const hoje = localDateStr();
    const de = p === 'mes' ? `${hoje.slice(0, 7)}-01` : `${hoje.slice(0, 4)}-01-01`;
    return this._itens().filter((i) => janelaIntersecta(i, de, hoje, hoje));
  });

  readonly porTipo = computed(() => contagemPorTipo(this.noPeriodo()));
  readonly porEstado = computed(() => contagemPorEstado(this._itens()));
  readonly notas = computed(() => distribuicaoDeNotas(this.noPeriodo()));

  /** Parados e indicadores olham a estante INTEIRA: são perguntas sem recorte. */
  readonly parados = computed(() => paradosEmAndamento(this._itens(), localDateStr()));
  readonly indicadores = computed(() => rankingIndicadores(this._itens()));

  readonly totalNoPeriodo = computed(() => this.noPeriodo().length);

  setPeriodo(p: Periodo): void {
    this._periodo.set(p);
  }

  async load(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    this._state.set('loading');
    this._error.set(null);
    try {
      this._itens.set(await fetchCulturaItems(supabase, userId));
      this._state.set('loaded');
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'falha ao carregar');
      this._state.set('error');
    }
  }
}
