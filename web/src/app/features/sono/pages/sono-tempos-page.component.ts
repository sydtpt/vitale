import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  SONO_MARKERS,
  STAGE_LABEL,
  bucketFacts,
  bucketPeriods,
  filterByRange,
  nightFacts,
  periodSummary,
  rangeForm,
  stageFacts,
  type SonoRange,
} from '@vitale/shared';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SonoStore } from '../data/sono.store';
import { SonoPeriodNavComponent } from '../components/period-nav.component';
import { SonoSegmentedComponent, type SegOption } from '../components/sono-segmented.component';
import { PeriodAveragesComponent } from '../components/period-averages.component';
import { FactsListComponent } from '../components/facts-list.component';
import { SleepLegendComponent, type LegendItem } from '../components/sleep-legend.component';
import { SleepTimingChartComponent } from '../components/sleep-timing-chart.component';
import { SleepBucketsChartComponent } from '../components/sleep-buckets-chart.component';
import { SleepStagesStackComponent } from '../components/sleep-stages-stack.component';

type Mode = 'tempos' | 'estagios';
type StageView = 'hora' | 'total';

/** Os dias de acordar entre a primeira e a última noite, incluindo os sem noite. */
function calendarDays(first: string, last: string): string[] {
  const out: string[] = [];
  const d = new Date(`${first}T12:00:00`);
  const end = new Date(`${last}T12:00:00`);
  for (; d <= end; d.setDate(d.getDate() + 1)) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}

/**
 * /sono/tempos na web — a subview de CAP-7, a mesma composição do mobile em
 * coluna: médias no topo, o período navegável, e duas leituras — **Tempos**
 * (cama, sono, o vão com a marca amarela) e **Estágios**, em *na hora* (posição
 * real) e *total* (horas por noite). Nos períodos longos só existe o total.
 *
 * Nenhum cálculo nasce aqui: `filterByRange`, `periodSummary`, `bucketPeriods`
 * e os fatos vêm de `@vitale/shared/sleep`. Cor só por `--sleep-*`.
 */
@Component({
  selector: 'rt-sono-tempos-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, PageHeaderComponent, SonoPeriodNavComponent, SonoSegmentedComponent, PeriodAveragesComponent,
    FactsListComponent, SleepLegendComponent, SleepTimingChartComponent, SleepBucketsChartComponent, SleepStagesStackComponent,
  ],
  templateUrl: './sono-tempos-page.component.html',
  styleUrl: './sono-tempos-page.component.scss',
})
export class SonoTemposPageComponent {
  protected readonly store = inject(SonoStore);
  protected readonly MARKERS = SONO_MARKERS;
  protected readonly MODES: SegOption[] = [
    { value: 'tempos', label: 'Tempos' },
    { value: 'estagios', label: 'Estágios' },
  ];
  protected readonly VIEWS: SegOption[] = [
    { value: 'hora', label: 'na hora' },
    { value: 'total', label: 'total' },
  ];

  protected readonly range = signal<SonoRange>('4s');
  protected readonly offset = signal(0);
  protected readonly mode = signal<Mode>('tempos');
  protected readonly view = signal<StageView>('hora');

  constructor() {
    if (this.store.state() === 'idle') void this.store.load();
  }

  protected readonly nights = computed(() => filterByRange(this.store.periods(), this.range(), new Date(), this.offset()));
  protected readonly form = computed(() => rangeForm(this.range()));
  protected readonly summary = computed(() => periodSummary(this.nights()));
  protected readonly weekBuckets = computed(() => (this.form() === 'weeks' ? bucketPeriods(this.nights(), 'week') : []));
  protected readonly nightBuckets = computed(() => (this.form() === 'nights' ? bucketPeriods(this.nights(), 'night') : []));
  /** Composição (horas por estágio) em vez de posição: semanas sempre; noites quando "total". */
  protected readonly composition = computed(() => this.mode() === 'estagios' && (this.form() === 'weeks' || this.view() === 'total'));
  protected readonly hasSegments = computed(() => this.nights().some((n) => n.stageSegments && n.stageSegments.length > 0));

  protected readonly facts = computed(() => {
    if (this.mode() === 'estagios') return stageFacts(this.nights());
    return this.form() === 'weeks' ? bucketFacts(this.weekBuckets(), SONO_MARKERS) : nightFacts(this.nights());
  });

  protected readonly days = computed(() => {
    const ns = this.nights();
    if (this.form() !== 'nights' || ns.length === 0) return [];
    if (this.range() === 'ultima') return [ns[0].wakeDay];
    return calendarDays(ns[0].wakeDay, ns[ns.length - 1].wakeDay);
  });

  protected readonly legend = computed<LegendItem[]>(() => {
    if (this.mode() === 'estagios') {
      return [
        { kind: 'solid', color: 'var(--sleep-rem)', label: STAGE_LABEL.rem },
        { kind: 'solid', color: 'var(--sleep-light)', label: STAGE_LABEL.core },
        { kind: 'solid', color: 'var(--sleep-deep)', label: STAGE_LABEL.deep },
        { kind: 'hatch', color: 'var(--sleep-unknown)', label: STAGE_LABEL.unspecified },
        this.composition()
          ? { kind: 'solid', color: 'var(--sleep-awake)', label: 'despertar' }
          : { kind: 'gaptick', color: 'var(--sleep-awake)', label: 'despertar' },
      ];
    }
    if (this.form() === 'nights') {
      return [
        { kind: 'solid', color: 'var(--sleep-bed)', label: 'na cama' },
        { kind: 'solid', color: 'var(--sleep-sleep)', label: 'dormindo' },
        { kind: 'gaptick', color: 'var(--sleep-awake)', label: 'despertar' },
      ];
    }
    return [
      { kind: 'solid', color: 'var(--sleep-bed)', label: 'faixa p25–p75' },
      { kind: 'solid', color: 'var(--sleep-sleep)', label: 'mediana apagar→acordar' },
      { kind: 'solid', color: 'var(--sleep-awake)', label: 'min acordado/noite' },
    ];
  });

  protected setRange(r: SonoRange): void {
    this.range.set(r);
    this.offset.set(0);
  }
  protected setMode(v: string): void {
    this.mode.set(v as Mode);
  }
  protected setView(v: string): void {
    this.view.set(v as StageView);
  }
}
