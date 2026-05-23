import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { ActivityRoutePoint } from '@vitale/shared';
import { HR_ZONES, hrZoneRange } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { metaForActivity } from '@core/models/activity-types';
import { ActivitiesStore } from '../data/activities.store';
import { ActivityMapComponent } from '../components/activity-map.component';
import { fmtClock, fmtDate, fmtDuration, fmtKcal, fmtKm, fmtRate, fmtTime, totalTimeS } from '../data/format';
import { movingTimeFromRoutePoints } from '../data/moving-time';
import { activityRecordBadges } from '../data/running-highlights';

@Component({
  selector: 'rt-activity-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, ActivityMapComponent],
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
    return a && this.hasGps() ? fmtRate(a.activityId, a.distanceM, this.movingTimeS()) : null;
  });

  /** Recordes que esta atividade detém (maior distância, best efforts). */
  protected readonly recordBadges = computed(() => {
    const a = this.activity();
    return a ? activityRecordBadges(this.store.activities(), a) : [];
  });

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
        color: def.color,
        range: hrZoneRange(def),
        seconds,
        pct: Math.round((seconds / total) * 100),
        time: fmtClock(seconds),
      };
    });
    return { rows, total };
  });

  protected readonly name = linkedSignal(() => this.activity()?.activityName ?? '');
  protected readonly durationMin = linkedSignal(() => Math.round((this.activity()?.durationS ?? 0) / 60));

  protected readonly routePoints = signal<ActivityRoutePoint[]>([]);
  protected readonly routeLoading = signal(false);
  private routeFor = '';

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
