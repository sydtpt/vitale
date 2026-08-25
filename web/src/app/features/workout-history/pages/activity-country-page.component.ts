import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { ActivityRoutePoint } from '@vitale/shared';
import {
  activitiesInCountry,
  citiesInCountry,
  countryAt,
  countryShares,
  countryStats,
  countryViewport,
  ridesByCountry,
  routesInCountry,
} from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { activityIdForSlug, labelForSlug } from '@core/models/activity-types';
import { ActivitiesStore } from '../data/activities.store';
import { fmtDuration, fmtKm } from '../data/format';
import { ActivityItemComponent } from '../components/activity-item.component';
import { CountryMapComponent } from '../components/country-map.component';
import { CountryPickerComponent } from '../components/country-picker.component';
import { CountryCityListComponent } from '../components/country-city-list.component';
import { CountryStatsComponent } from '../components/country-stats.component';

/**
 * Visão detalhada por país (feature mapa-por-pais). Resolve 0/1/N países a
 * partir das atividades do tipo (`:slug`) e do `?country=`: sem país e 1 só →
 * abre direto; N → grade de seleção; com país → mapa de todas as rotas + lista
 * de cidades + lista de treinos daquele país. Só web; a lógica de agregação
 * mora no shared (reusável no mobile depois).
 */
@Component({
  selector: 'rt-activity-country-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    ActivityItemComponent,
    CountryMapComponent,
    CountryPickerComponent,
    CountryCityListComponent,
    CountryStatsComponent,
  ],
  templateUrl: './activity-country-page.component.html',
  styleUrl: './activity-country-page.component.scss',
})
export class ActivityCountryPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly store = inject(ActivitiesStore);

  private readonly _slug = signal('');
  private readonly _country = signal('');

  protected readonly slug = computed(() => this._slug());
  protected readonly label = computed(() => labelForSlug(this._slug()));
  private readonly activityId = computed(() => activityIdForSlug(this._slug()));

  /** Atividades deste tipo (base de toda agregação da tela). */
  private readonly typeActivities = computed(() => {
    const id = this.activityId();
    return id == null ? [] : this.store.activities().filter((a) => a.activityId === id);
  });

  /** Países já cruzados (grade de seleção + cabeçalho). */
  protected readonly countries = computed(() => ridesByCountry(this.typeActivities()));
  /** Código selecionado (uppercase), ou '' quando nenhum. */
  protected readonly selected = computed(() => this._country().toUpperCase());
  protected readonly summary = computed(() =>
    this.countries().find((c) => c.code === this.selected()),
  );

  /** Treinos do país selecionado, mais recentes primeiro. */
  protected readonly rides = computed(() =>
    this.selected() ? activitiesInCountry(this.typeActivities(), this.selected()) : [],
  );
  /** Cidades distintas do país selecionado. */
  protected readonly cities = computed(() =>
    this.selected() ? citiesInCountry(this.typeActivities(), this.selected()) : [],
  );
  /** Rotas GPS carregadas em lote para o país atual, por id do treino. */
  private readonly routesById = signal<ReadonlyMap<string, ActivityRoutePoint[]>>(new Map());
  protected readonly routesLoading = signal(false);
  private routesKey = '';

  /** As linhas do mapa: rotas recortadas ao território do país, pelo mesmo
   *  critério do rateio. Uma pedalada que só encostou aqui entra só com o
   *  trecho que aconteceu aqui — e o enquadramento segue junto. */
  protected readonly routes = computed(() =>
    routesInCountry(this.rides(), this.routesById(), this.selected(), countryAt),
  );

  /** Fração de cada pedalada que aconteceu dentro do país — o que impede uma
   *  rota cross-border de somar seus km inteiros nos dois lados. Enquanto as
   *  rotas não chegam, `countryShares` cai no rateio por cidades e a faixa já
   *  nasce aproximada, convergindo depois. */
  protected readonly stats = computed(() =>
    countryStats(
      this.rides(),
      countryShares(this.rides(), this.routesById(), this.selected(), countryAt),
    ),
  );

  /** Enquadramento do mapa: bbox do país (piso) esticado até as rotas (±buffer). */
  protected readonly viewport = computed(() =>
    this.selected() ? countryViewport(this.selected(), this.routes()) : null,
  );

  protected readonly fmtKm = fmtKm;
  protected readonly fmtDuration = fmtDuration;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((pm) => {
      this._slug.set(pm.get('slug') ?? '');
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((qpm) => {
      this._country.set(qpm.get('country') ?? '');
    });

    void this.store.load();

    // Auto-seleção quando há exatamente 1 país e nenhum na URL (US1).
    effect(() => {
      if (this.store.loading() || this._country()) return;
      const cs = this.countries();
      if (cs.length === 1) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { country: cs[0].code },
          replaceUrl: true,
        });
      }
    });

    // Carrega as rotas do país selecionado em lote quando ele muda.
    effect(() => {
      const code = this.selected();
      const rides = this.rides();
      const key = `${code}:${rides.map((r) => r.id).join(',')}`;
      if (!code) {
        this.routesById.set(new Map());
        this.routesKey = '';
        return;
      }
      if (key === this.routesKey) return;
      this.routesKey = key;
      void this.fetchRoutes(rides.map((r) => r.id));
    });
  }

  private async fetchRoutes(ids: string[]): Promise<void> {
    this.routesLoading.set(true);
    try {
      // Overviews reduzidos (route_overview) — leves o bastante p/ dezenas de
      // rotas juntas sem estourar o timeout; o mapa de país não precisa de
      // resolução cheia, e o rateio só precisa de proporção.
      this.routesById.set(await this.store.loadRouteOverviews(ids));
    } catch {
      this.routesById.set(new Map());
    } finally {
      this.routesLoading.set(false);
    }
  }

  /** Troca de país sem sair da tela (US5) — só atualiza o `?country=`. */
  protected selectCountry(code: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { country: code },
      replaceUrl: false,
    });
  }
}
