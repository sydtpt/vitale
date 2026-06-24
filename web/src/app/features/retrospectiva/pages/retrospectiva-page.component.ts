import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import {
  T,
  localDateStr,
  periodBounds,
  latestAvailableOffset,
  type PeriodKind,
  type RecapValue,
  type HighlightIcon,
  type RetroHealthRow,
  type MonthBucket,
} from '@vitale/shared';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { IconComponent } from '@core/services/icon.component';
import { RetroStore } from '../data/retro.store';

/** Ícone neutro do shared → nome do set `rt-icon`. */
const ICON_MAP: Record<HighlightIcon, string> = {
  workout: 'dumbbell', distance: 'run', sleep: 'moon', heart: 'heart',
  hrv: 'trend', habit: 'target', warning: 'flag', money: 'wallet',
};

interface DeltaVM { text: string; tone: 'good' | 'bad' | 'neutral' }
interface KpiVM { icon: string; color: string; label: string; value: string; delta: DeltaVM }

const KIND_LABEL: Record<PeriodKind, string> = { week: 'Semana', month: 'Mês', year: 'Ano' };

@Component({
  selector: 'rt-retrospectiva-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent],
  templateUrl: './retrospectiva-page.component.html',
  styleUrl: './retrospectiva-page.component.scss',
})
export class RetrospectivaPageComponent {
  protected readonly T = T;
  protected readonly kinds: PeriodKind[] = ['week', 'month', 'year'];
  protected readonly kindLabel = KIND_LABEL;

  private readonly store = inject(RetroStore);
  private readonly now = new Date();

  protected readonly kind = signal<PeriodKind>('week');
  protected readonly offset = signal<number>(latestAvailableOffset(this.now, 'week'));

  protected readonly state = this.store.state;

  constructor() {
    // Busca os dados a partir do início do período anterior ao selecionado.
    effect(() => {
      const k = this.kind();
      const o = this.offset();
      const since = localDateStr(periodBounds(this.now, k, o - 1).start);
      void this.store.ensure(since);
    });
  }

  protected setKind(k: PeriodKind): void {
    if (k === this.kind()) return;
    this.kind.set(k);
    this.offset.set(latestAvailableOffset(this.now, k));
  }

  protected readonly canNext = computed(() => this.offset() < latestAvailableOffset(this.now, this.kind()));
  protected prev(): void { this.offset.update((o) => o - 1); }
  protected next(): void { if (this.canNext()) this.offset.update((o) => o + 1); }

  protected readonly summary = computed(() => this.store.summary(this.now, this.kind(), this.offset()));
  protected readonly highlights = computed(() => this.store.highlights(this.now, this.kind(), this.offset()).slice(0, 6));
  protected readonly isYear = computed(() => this.kind() === 'year');
  protected readonly buckets = computed<MonthBucket[]>(() => this.isYear() ? this.store.yearByMonth(this.now, this.offset()) : []);

  /** Máximos por métrica para normalizar as barras do ano. */
  protected readonly bucketMax = computed(() => {
    const b = this.buckets();
    const max = (sel: (m: MonthBucket) => number) => Math.max(1, ...b.map(sel));
    return {
      workouts: max((m) => m.workouts),
      distanceKm: max((m) => m.distanceKm),
      tasks: max((m) => m.tasks),
      spend: max((m) => m.spend),
    };
  });

  protected readonly kpis = computed<KpiVM[]>(() => {
    const s = this.summary();
    return [
      { icon: 'dumbbell', color: T.primary, label: 'Treinos', value: `${s.fitness.count.current}`, delta: this.delta(s.fitness.count, false) },
      { icon: 'check', color: T.green, label: 'Tarefas', value: `${s.tasks.total.current}`, delta: this.delta(s.tasks.total, false) },
      { icon: 'run', color: T.blue, label: 'Distância', value: this.km(s.fitness.distanceM.current), delta: this.delta(s.fitness.distanceM, false) },
      { icon: 'wallet', color: T.ink, label: 'Compras', value: this.brl(s.purchases.spend.current), delta: this.delta(s.purchases.spend, true) },
    ];
  });

  // ── helpers de formatação ──
  protected iconFor(icon: HighlightIcon): string { return ICON_MAP[icon]; }
  protected num(n: number, d = 0): string { return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  protected km(m: number): string { return `${this.num(m / 1000, 1)} km`; }
  protected brl(v: number): string { return `R$ ${this.num(v)}`; }
  protected pct(v: number): string { return `${this.num(v * 100)}%`; }

  protected dur(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
  }

  /** Badge de variação vs período anterior. */
  protected delta(r: RecapValue, higherIsWorse: boolean): DeltaVM {
    if (r.delta === 0) return { text: '—', tone: 'neutral' };
    const worse = higherIsWorse ? r.delta > 0 : r.delta < 0;
    const sign = r.delta > 0 ? '+' : '−';
    const text = r.deltaPct != null
      ? `${sign}${this.num(Math.abs(r.deltaPct))}%`
      : `${sign}${this.num(Math.abs(r.delta))}`;
    return { text, tone: worse ? 'bad' : 'good' };
  }

  /** Valor + delta de uma métrica de saúde (média do período). */
  protected healthValue(row: RetroHealthRow): string {
    return row.recap.current == null ? '—' : `${this.num(row.recap.current, row.decimals)}${row.unit}`;
  }
  protected healthDelta(row: RetroHealthRow): DeltaVM {
    const r = row.recap;
    if (r.current == null || r.delta == null) return { text: '', tone: 'neutral' };
    const worse = row.higherIsWorse ? r.delta > 0 : r.delta < 0;
    const sign = r.delta >= 0 ? '+' : '−';
    return { text: `${sign}${this.num(Math.abs(r.delta), row.decimals)}${row.unit}`, tone: r.delta === 0 ? 'neutral' : worse ? 'bad' : 'good' };
  }

  protected trendIcon(t: 'up' | 'down' | 'flat'): string {
    return t === 'up' ? '▲' : t === 'down' ? '▼' : '–';
  }

  protected barPct(v: number, max: number): number { return Math.round((v / max) * 100); }
}
