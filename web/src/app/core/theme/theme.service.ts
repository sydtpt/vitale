import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  cssVars,
  resolveBrand,
  resolvePalette,
  resolveTheme,
  resolveTokens,
  shadowVars,
  upsertUserPreferences,
  type BrandId,
  type ColorScheme,
  type PaletteId,
  type ThemeId,
} from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { PreferencesService } from '@core/services/preferences.service';

/** Preferência de esquema; `system` segue o sistema operacional. */
export type AppTheme = 'system' | 'light' | 'dark';

/** Espelho local dos quatro eixos, para a primeira pintura não piscar. */
const CACHE_KEY = 'vitale.theme';

interface Cached {
  theme: AppTheme;
  themeId: ThemeId;
  paletteId: PaletteId;
  brandId: BrandId;
}

/**
 * Aplica o sistema de temas na web escrevendo as variáveis CSS no `:root`.
 *
 * **Runtime, não CSS estático.** São 144 combinações de ~60 tokens; emiti-las
 * como folha de estilo daria dezenas de milhares de declarações para usar uma.
 * Escrever no `:root` custa uma passada de `setProperty` e mantém uma fonte só —
 * a mesma que o mobile consome. Os 811 `var(--…)` que a web já tinha continuam
 * valendo sem tocar em componente nenhum.
 *
 * O `styles.scss` mantém os valores do Orbe claro no `:root` como piso: se este
 * serviço não rodar, a página aparece como sempre apareceu em vez de sem estilo.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly auth = inject(AuthService);
  private readonly prefs = inject(PreferencesService);

  private readonly cached = readCache();

  readonly theme = signal<AppTheme>(this.cached.theme);
  readonly themeId = signal<ThemeId>(this.cached.themeId);
  readonly paletteId = signal<PaletteId>(this.cached.paletteId);
  readonly brandId = signal<BrandId>(this.cached.brandId);

  /** O que o sistema operacional pede, quando a preferência é `system`. */
  private readonly systemDark = signal(prefersDark());

  /** Esquema efetivo, já resolvido. */
  readonly scheme = computed<ColorScheme>(() => {
    const pref = this.theme();
    if (pref !== 'system') return pref;
    return this.systemDark() ? 'dark' : 'light';
  });

  readonly tokens = computed(() =>
    resolveTokens(this.themeId(), this.scheme(), this.paletteId(), this.brandId()),
  );

  constructor() {
    // A preferência do sistema muda sem recarregar a página (o usuário troca no
    // SO com a aba aberta); sem este listener, `system` só valeria no boot.
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener('change', (e) => this.systemDark.set(e.matches));

    // Espelha o que a PreferencesService carregou do Supabase.
    effect(
      () => {
        const p = this.prefs.appearance();
        if (!p) return;
        this.theme.set(p.theme);
        this.themeId.set(p.themeId);
        this.paletteId.set(p.paletteId);
        this.brandId.set(p.brandId);
        writeCache({
          theme: p.theme,
          themeId: p.themeId,
          paletteId: p.paletteId,
          brandId: p.brandId,
        });
      },
      { allowSignalWrites: true },
    );

    effect(() => this.apply());
  }

  /** Escreve tudo no `:root`. Chamado a cada mudança de qualquer eixo. */
  private apply(): void {
    const root = document.documentElement;
    const scheme = this.scheme();
    const vars = {
      ...cssVars(this.tokens()),
      ...shadowVars(this.themeId(), scheme),
    };
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);

    // Controles nativos, barra de rolagem e `autofill` do navegador seguem isto;
    // sem ele, um input continua branco no modo escuro.
    root.style.colorScheme = scheme;
    root.dataset['scheme'] = scheme;
    root.dataset['theme'] = this.themeId();
    root.dataset['palette'] = this.paletteId();
    root.dataset['brand'] = this.brandId();
  }

  /**
   * Grava a escolha e sincroniza com o Supabase.
   *
   * A `PreferencesService` é somente leitura por convenção ("quem edita é o
   * mobile"), e aqui a convenção se abre de propósito: obrigar a pegar o celular
   * para escurecer o desktop é UX ruim. É o único ponto de escrita da web.
   */
  async update(patch: Partial<Omit<Cached, never>>): Promise<void> {
    if (patch.theme) this.theme.set(patch.theme);
    if (patch.themeId) this.themeId.set(resolveTheme(patch.themeId).id);
    if (patch.paletteId) this.paletteId.set(resolvePalette(patch.paletteId).id);
    if (patch.brandId) this.brandId.set(resolveBrand(patch.brandId).id);

    const next: Cached = {
      theme: this.theme(),
      themeId: this.themeId(),
      paletteId: this.paletteId(),
      brandId: this.brandId(),
    };
    writeCache(next);

    const user = this.auth.user();
    if (!user) return;
    try {
      await upsertUserPreferences(supabase, user.id, {
        theme: next.theme,
        theme_id: next.themeId,
        palette_id: next.paletteId,
        brand_id: next.brandId,
      });
    } catch (e) {
      // Falha de rede não derruba a escolha local — ela já está no cache.
      console.warn('[tema] não sincronizou a preferência:', e);
    }
  }
}

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function readCache(): Cached {
  const padrao: Cached = {
    theme: 'system',
    themeId: 'orbe',
    paletteId: 'orbe',
    brandId: 'laranja',
  };
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return padrao;
    const v = JSON.parse(raw) as Partial<Cached>;
    return {
      theme: v.theme ?? padrao.theme,
      themeId: resolveTheme(v.themeId).id,
      paletteId: resolvePalette(v.paletteId).id,
      brandId: resolveBrand(v.brandId).id,
    };
  } catch {
    return padrao;
  }
}

function writeCache(v: Cached): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(v));
  } catch {
    /* localStorage indisponível — segue só em memória */
  }
}
