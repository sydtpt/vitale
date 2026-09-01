import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { ActivityRoutePoint, MetricKey } from '@vitale/shared';
import {
  METRIC_ROLE,
  elevationProfile,
  fillsCards,
  HR_ZONES,
  hrZoneRange,
  movingTimeFromRoutePoints,
  routeCursorAt,
  routeDistances,
  speedSeries,
} from '@vitale/shared';
import { NgStyle } from '@angular/common';
import { IconComponent } from '@core/services/icon.component';
import { ThemeService } from '@core/theme/theme.service';
import { metaForActivity } from '@core/models/activity-types';
import { ActivitiesStore } from '../data/activities.store';
import { ActivityMapComponent } from '../components/activity-map.component';
import { RouteProfileCardComponent } from '../components/route-profile-card.component';
import { formatClock, fmtDate, fmtDuration, fmtElevation, fmtKcal, fmtKm, formatRate, fmtTime, totalTimeS } from '../data/format';
import { activityRecordBadges, type RecordBadge } from '../data/running-highlights';

@Component({
  selector: 'rt-activity-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgStyle, IconComponent, ActivityMapComponent, RouteProfileCardComponent],
  templateUrl: './activity-detail-page.component.html',
  styleUrl: './activity-detail-page.component.scss',
})
export class ActivityDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly store = inject(ActivitiesStore);

  private readonly _id = signal('');
  protected readonly slug = signal('');

  protected readonly activity = computed(() => this.store.findById(this._id()));
  protected readonly meta = computed(() => {
    const a = this.activity();
    return a ? metaForActivity(a.activityId) : undefined;
  });
  /** "sem GPS" = sem rota e sem distância → tempo é editável. */
  protected readonly hasGps = computed(() => {
    const a = this.activity();
    return !!a && (a.hasRoute || (a.distanceM ?? 0) > 0);
  });

  /**
   * Tempo total (s): relógio de parede (fim − início) para atividades com GPS;
   * sem GPS, `durationS` é a duração editável e canônica.
   */
  protected readonly totalTimeS = computed(() => {
    const a = this.activity();
    if (!a) return 0;
    return this.hasGps() ? totalTimeS(a.startAt, a.endAt, a.durationS) : a.durationS;
  });
  /**
   * Tempo em movimento (s): derivado do track GPS (descarta paradas), com
   * fallback para o valor sincronizado e, por fim, a duração. Limitado ao total.
   */
  protected readonly movingTimeS = computed(() => {
    const a = this.activity();
    if (!a) return 0;
    const fromTrack = this.hasGps() ? movingTimeFromRoutePoints(this.routePoints()) : undefined;
    return Math.min(fromTrack ?? a.movingTimeS ?? a.durationS, this.totalTimeS());
  });
  /** Pace/velocidade/min-km calculado sobre o tempo em movimento (só com GPS). */
  protected readonly rate = computed(() => {
    const a = this.activity();
    return a && this.hasGps() ? formatRate(a.activityId, a.distanceM, this.movingTimeS()) : null;
  });
  /** Ganho de elevação formatado; null quando a atividade não tem o dado. */
  protected readonly elevation = computed(() => fmtElevation(this.activity()?.elevationM));

  /** Recordes que esta atividade detém (maior distância, best efforts). */
  protected readonly recordBadges = computed(() => {
    const a = this.activity();
    return a ? activityRecordBadges(this.store.activities(), a) : [];
  });

  /**
   * Mesma casca da tira de Recordes: tema com degrau de superfície preenche a
   * pílula; tema de contorno pinta a cor na borda. Ver ADR 0022.
   */
  private readonly theme = inject(ThemeService);
  protected readonly badgesFilled = computed(() =>
    fillsCards(this.theme.themeId(), this.theme.scheme()),
  );

  /**
   * Acento do papel da métrica. É o número que carrega a cor — a web não tem os
   * ícones que o mobile usa na mesma tira, e inventar três só para isto pagaria
   * caro por um sinal que o próprio valor já dá.
   */
  protected metricColor(metric: MetricKey): string {
    return this.theme.tokens().roles[METRIC_ROLE[metric]].accent;
  }

  protected badgeSkin(b: RecordBadge): Record<string, string> {
    const r = this.theme.tokens().roles[b.role];
    return this.badgesFilled()
      ? { background: r.soft, borderColor: 'transparent', color: r.on }
      : { background: 'transparent', borderColor: r.accent, color: r.text };
  }

  /** Tempo em cada zona de FC (com %), ordenado por zona; null se sem dados. */
  protected readonly hrZones = computed(() => {
    const z = this.activity()?.hrZones;
    if (!z) return null;
    const total = HR_ZONES.reduce((sum, def) => sum + (z[def.key] ?? 0), 0);
    if (total <= 0) return null;
    const rows = HR_ZONES.map((def) => {
      const seconds = z[def.key] ?? 0;
      return {
        key: def.key,
        label: def.label,
        // O papel resolvido no tema ativo — antes era o hex cru do Orbe claro, e
        // a rampa era a única coisa da tela que não acompanhava paleta e esquema.
        color: this.theme.tokens().roles[def.role].accent,
        range: hrZoneRange(def),
        seconds,
        pct: Math.round((seconds / total) * 100),
        time: formatClock(seconds),
      };
    });
    return { rows, total };
  });

  protected readonly name = linkedSignal(() => this.activity()?.activityName ?? '');
  protected readonly durationMin = linkedSignal(() => Math.round((this.activity()?.durationS ?? 0) / 60));

  protected readonly routePoints = signal<ActivityRoutePoint[]>([]);
  protected readonly routeLoading = signal(false);
  private routeFor = '';

  /** Distância (m) sob o cursor do gráfico de perfil. `null` = sem cursor. */
  protected readonly cursorX = signal<number | null>(null);

  /**
   * A régua do scrub, recalculada só quando a rota muda. Sem isso, cada
   * `pointermove` refaria milhares de haversines e o ponto ficaria atrás do
   * mouse na rota longa.
   */
  private readonly scrubRuler = computed(() => {
    const pts = this.routePoints();
    return {
      pts,
      distances: routeDistances(pts),
      profile: elevationProfile(pts),
      speed: speedSeries(pts),
    };
  });

  /** Onde o cursor do gráfico cai no mapa. */
  protected readonly mapCursor = computed(() => {
    const x = this.cursorX();
    if (x === null) return null;
    const r = this.scrubRuler();
    return routeCursorAt(r.pts, r.distances, x, r.profile, r.speed);
  });

  protected readonly listQueryParams = signal<Record<string, string>>({});

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly togglingStats = signal(false);
  protected readonly statsError = signal<string | null>(null);
  /** true quando a atividade conta nas estatísticas (não está oculta). */
  protected readonly inStats = computed(() => !this.activity()?.hidden);

  protected readonly fmtDate = fmtDate;
  protected readonly fmtTime = fmtTime;
  protected readonly fmtKm = fmtKm;
  protected readonly fmtDuration = fmtDuration;
  protected readonly fmtKcal = fmtKcal;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((pm) => {
      this.slug.set(pm.get('slug') ?? '');
      this._id.set(pm.get('id') ?? '');
      this.saveError.set(null);
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((qpm) => {
      const params: Record<string, string> = {};
      qpm.keys.forEach((key) => {
        const val = qpm.get(key);
        if (val != null) params[key] = val;
      });
      this.listQueryParams.set(params);
    });

    void this.store.load();

    // Carrega a rota GPS quando a atividade (com rota) entra em cena.
    effect(() => {
      const a = this.activity();
      if (a?.hasRoute) void this.fetchRoute(a.id);
      else this.routePoints.set([]);
    });
  }

  private async fetchRoute(id: string): Promise<void> {
    if (this.routeFor === id) return;
    this.routeFor = id;
    this.routeLoading.set(true);
    try {
      this.routePoints.set(await this.store.loadRoute(id));
    } catch {
      this.routePoints.set([]);
    } finally {
      this.routeLoading.set(false);
    }
  }

  protected async toggleStats(): Promise<void> {
    const a = this.activity();
    if (!a || this.togglingStats()) return;
    this.togglingStats.set(true);
    this.statsError.set(null);
    try {
      await this.store.setHidden(a.id, !a.hidden);
    } catch (e) {
      this.statsError.set((e as Error).message);
    } finally {
      this.togglingStats.set(false);
    }
  }

  protected onName(e: Event): void { this.name.set((e.target as HTMLInputElement).value); }
  protected onDuration(e: Event): void {
    const n = (e.target as HTMLInputElement).valueAsNumber;
    this.durationMin.set(Number.isNaN(n) ? 0 : n);
  }

  protected async save(): Promise<void> {
    const a = this.activity();
    if (!a) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const patch: { activityName?: string | null; durationS?: number } = {
        activityName: this.name().trim() || null,
      };
      if (!this.hasGps()) patch.durationS = Math.max(0, Math.round(this.durationMin()) * 60);
      await this.store.updateActivity(a.id, patch);
      await this.router.navigate(['/workout-history', this.slug()], { queryParams: this.listQueryParams() });
    } catch (e) {
      this.saveError.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
