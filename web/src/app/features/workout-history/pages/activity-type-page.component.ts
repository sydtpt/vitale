import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgStyle } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fillsCards, ridesByCountry } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { ThemeService } from '@core/theme/theme.service';
import { activityIdForSlug, labelForSlug } from '@core/models/activity-types';
import { ActivitiesStore } from '../data/activities.store';
import {
  buildActivityList,
  EMPTY_FILTERS,
  filtersToQueryParams,
  queryParamsToFilters,
  type ActivityFilters,
  type SortDir,
  type SortKey,
} from '../data/activity-list';
import { fmtDuration, fmtKcal, fmtKm } from '../data/format';
import { activityHighlights, type ActivityHighlight } from '../data/running-highlights';
import { ActivityFiltersComponent } from '../components/activity-filters.component';
import { ActivityItemComponent } from '../components/activity-item.component';
import { TypeEvolutionCardComponent } from '../components/type-evolution-card.component';

@Component({
  selector: 'rt-activity-type-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NgStyle,
    IconComponent,
    ActivityFiltersComponent,
    ActivityItemComponent,
    TypeEvolutionCardComponent,
  ],
  templateUrl: './activity-type-page.component.html',
  styleUrl: './activity-type-page.component.scss',
})
export class ActivityTypePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly store = inject(ActivitiesStore);
  private readonly theme = inject(ThemeService);

  private readonly _slug = signal('');

  protected readonly filters = signal<ActivityFilters>({ ...EMPTY_FILTERS });
  protected readonly sort = signal<SortKey>('date');
  protected readonly dir = signal<SortDir>('desc');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly view = signal<'list' | 'cards'>('list');

  protected readonly slug = computed(() => this._slug());
  protected readonly label = computed(() => labelForSlug(this._slug()));
  protected readonly summary = computed(() =>
    this.store.typeSummaries().find((s) => s.slug === this._slug()),
  );
  /** Recordes do tipo (corrida/ciclismo) — de todo o histórico. `[]` p/ os demais. */
  protected readonly highlights = computed(() => {
    const id = activityIdForSlug(this._slug());
    return id != null ? activityHighlights(this.store.activities(), id) : [];
  });
  /** Linha 1 — distâncias (maior, últimos 12 meses, total). */
  protected readonly summaryHighlights = computed(() =>
    this.highlights().filter((h) => h.group === 'summary'),
  );
  /** Linha 2 — recordes por distância (best efforts), em ordem decrescente. */
  protected readonly recordHighlights = computed(() =>
    this.highlights().filter((h) => h.group === 'record'),
  );
  protected readonly showDistance = computed(() => this.summary()?.hasDistance ?? true);

  /**
   * A casca do cartão de recorde sai do tema, não do esquema: temas sem degrau
   * de superfície (Clean) pintam a cor na borda em vez do preenchimento. Ver
   * `fillsCards()` no shared e a ADR 0022.
   */
  protected readonly cardsFilled = computed(() =>
    fillsCards(this.theme.themeId(), this.theme.scheme()),
  );

  /**
   * Estilo do cartão de um destaque, resolvido do tema ativo.
   *
   * Lê o hex de `tokens()` em vez de montar `var(--role-${h.role}-soft)`: nome
   * de variável construído por interpolação escapa da barreira de variáveis CSS
   * do `architecture.test.ts`, que só consegue casar nomes literais. Um `-sofft`
   * digitado errado passaria calado. Aqui o compilador pega.
   */
  protected hlSkin(h: ActivityHighlight): Record<string, string> {
    const r = this.theme.tokens().roles[h.role];
    return this.cardsFilled()
      ? { background: r.soft, borderColor: 'transparent' }
      : { background: 'transparent', borderColor: r.accent };
  }

  /** Cor do valor: `on` dentro do tint, `text` sobre a página. Pisos diferentes. */
  protected hlValueColor(h: ActivityHighlight): string {
    const r = this.theme.tokens().roles[h.role];
    return this.cardsFilled() ? r.on : r.text;
  }

  /**
   * Países já cruzados por atividades deste tipo (com `cities` enriquecidas).
   * Vazio ⇒ o botão "Visão detalhada" não aparece (nada geográfico a mostrar).
   */
  protected readonly countries = computed(() => {
    const id = activityIdForSlug(this._slug());
    if (id == null) return [];
    return ridesByCountry(this.store.activities().filter((a) => a.activityId === id));
  });

  protected readonly result = computed(() =>
    buildActivityList(this.store.activities(), this.label() ?? '', {
      filters: this.filters(),
      sort: this.sort(),
      dir: this.dir(),
      page: this.page(),
      pageSize: this.pageSize(),
    }),
  );

  protected readonly sortValue = computed(() => `${this.sort()}-${this.dir()}`);

  protected readonly fmtKm = fmtKm;
  protected readonly fmtDuration = fmtDuration;
  protected readonly fmtKcal = fmtKcal;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((pm) => {
      this._slug.set(pm.get('slug') ?? '');
      this.page.set(1);
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((qpm) => {
      const params: Record<string, string | string[] | null> = {};
      qpm.keys.forEach((key) => {
        params[key] = qpm.get(key);
      });

      this.filters.set(queryParamsToFilters(params));
      this.sort.set((qpm.get('sort') as SortKey) ?? 'date');
      this.dir.set((qpm.get('dir') as SortDir) ?? 'desc');
    });

    void this.store.load();
  }

  protected setFilters(f: ActivityFilters): void {
    this.filters.set(f);
    this.page.set(1);
    this.updateQueryParams();
  }

  protected onSort(e: Event): void {
    const [key, dir] = (e.target as HTMLSelectElement).value.split('-');
    this.sort.set(key as SortKey);
    this.dir.set(dir as SortDir);
    this.page.set(1);
    this.updateQueryParams();
  }

  private updateQueryParams(): void {
    const queryParams = filtersToQueryParams(this.filters());
    queryParams['sort'] = this.sort();
    queryParams['dir'] = this.dir();

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
  }
}
