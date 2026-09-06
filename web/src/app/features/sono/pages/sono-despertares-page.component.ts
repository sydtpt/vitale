import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  SLEEP_AXIS_ORIGIN_H,
  awakeByWeekday,
  awakeFacts,
  awakeningDurations,
  awakeningsByHour,
  filterByRange,
  periodSummary,
  type SonoRange,
} from '@vitale/shared';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SonoStore } from '../data/sono.store';
import { SonoPeriodNavComponent } from '../components/period-nav.component';
import { PeriodAveragesComponent } from '../components/period-averages.component';
import { FactsListComponent } from '../components/facts-list.component';
import { AwakeningsClockComponent } from '../components/awakenings-clock.component';

interface BarVM { key: string; h: number; opacity: number; label: string; n: string; fds: boolean; unknown: boolean; }

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const TRACK = 56;

/**
 * /sono/despertares na web — a subview de CAP-7: *quando* acordo e por *quanto*
 * tempo, no período navegável. Quatro leituras da mesma matéria-prima: a
 * densidade por hora (o relógio de vigília), em quantas noites por hora, a
 * duração de cada despertar, e por dia da semana. Tudo é vigília, e vigília é
 * amarelo; o fim de semana é rótulo em tinta forte, não cor de barra.
 *
 * Sem score, sem índice de fragmentação (spec §6). A tela mostra e não conclui.
 */
@Component({
  selector: 'rt-sono-despertares-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, SonoPeriodNavComponent, PeriodAveragesComponent, FactsListComponent, AwakeningsClockComponent],
  templateUrl: './sono-despertares-page.component.html',
  styleUrl: './sono-despertares-page.component.scss',
})
export class SonoDespertaresPageComponent {
  protected readonly store = inject(SonoStore);
  protected readonly range = signal<SonoRange>('4s');
  protected readonly offset = signal(0);

  constructor() {
    if (this.store.state() === 'idle') void this.store.load();
  }

  protected readonly nights = computed(() => filterByRange(this.store.periods(), this.range(), new Date(), this.offset()));
  protected readonly summary = computed(() => periodSummary(this.nights()));
  protected readonly reporting = computed(() => this.nights().filter((n) => n.awakenings !== null).length);
  protected readonly facts = computed(() => awakeFacts(this.nights()));

  /** Faixas de hora contíguas da primeira à última com despertar, contando noites. */
  protected readonly hourBars = computed<BarVM[]>(() => {
    const byHour = awakeningsByHour(this.nights());
    if (byHour.length === 0) return [];
    const from = byHour[0].from;
    const to = byHour[byHour.length - 1].from;
    const max = Math.max(1, ...byHour.map((b) => b.nights));
    const out: BarVM[] = [];
    for (let h = from; h <= to; h += 1) {
      const n = byHour.find((b) => b.from === h)?.nights ?? 0;
      out.push({
        key: String(h),
        h: Math.max(2, (n / max) * TRACK),
        opacity: n ? 0.45 + 0.55 * (n / max) : 0.15,
        label: h % 2 === 0 ? `${String((SLEEP_AXIS_ORIGIN_H + h) % 24).padStart(2, '0')}h` : '',
        n: '',
        fds: false,
        unknown: false,
      });
    }
    return out;
  });

  protected readonly durationBars = computed<BarVM[]>(() => {
    const ds = awakeningDurations(this.nights());
    const max = Math.max(1, ...ds.map((d) => d.count));
    return ds.map((d) => ({ key: d.label, h: Math.max(2, (d.count / max) * TRACK), opacity: 1, label: d.label, n: String(d.count), fds: false, unknown: false }));
  });

  protected readonly dowBars = computed<BarVM[]>(() => {
    const ds = awakeByWeekday(this.nights());
    const max = Math.max(1, ...ds.map((d) => d.avgMin ?? 0));
    return ds.map((d) => ({
      key: String(d.weekday),
      h: d.avgMin == null ? TRACK : Math.max(2, (d.avgMin / max) * TRACK),
      opacity: 1,
      label: DOW[d.weekday],
      n: d.avgMin == null ? '—' : String(Math.round(d.avgMin)),
      fds: d.weekday === 0 || d.weekday === 6,
      unknown: d.avgMin == null,
    }));
  });

  protected setRange(r: SonoRange): void {
    this.range.set(r);
    this.offset.set(0);
  }
}
