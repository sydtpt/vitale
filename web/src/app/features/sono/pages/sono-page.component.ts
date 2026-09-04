import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { awakeMinOf, bedtimeMeasured, clockLabel, type SleepPeriod } from '@vitale/shared';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SonoStore, TIMING_NIGHTS, dayLabel, hm } from '../data/sono.store';
import { SleepTimingChartComponent } from '../components/sleep-timing-chart.component';
import { AwakeningsClockComponent } from '../components/awakenings-clock.component';

/**
 * A tela de sono na web — a mesma composição aprovada no mobile, em coluna: ① os
 * relógios (o fato), ② o timing chart (a forma), ③ os despertares, ④ a nota
 * contra a medição. Sem score, sem streak, sem seta. Ver docs/specs/sono/spec.md.
 *
 * Nenhum cálculo de sono nasce aqui: tudo vem de `@vitale/shared/sleep` pelo
 * `SonoStore`. Cor pela variável do papel `blue` — sono é categoria, não módulo
 * (ADR 0031).
 */
@Component({
  selector: 'rt-sono-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, PageHeaderComponent, SleepTimingChartComponent, AwakeningsClockComponent],
  templateUrl: './sono-page.component.html',
  styleUrl: './sono-page.component.scss',
})
export class SonoPageComponent {
  protected readonly store = inject(SonoStore);
  protected readonly TIMING_NIGHTS = TIMING_NIGHTS;
  protected readonly hm = hm;
  protected readonly dayLabel = dayLabel;
  protected readonly clockLabel = clockLabel;
  protected readonly awakeMinOf = awakeMinOf;

  constructor() {
    void this.store.load();
  }

  /** A noite do topo, com o que a tela escreve dela. */
  protected readonly top = computed(() => {
    const p = this.store.last();
    if (!p) return null;
    const bedOk = bedtimeMeasured(p);
    const bedH = p.inBedAt && p.inBedEnd
      ? (new Date(p.inBedEnd).getTime() - new Date(p.inBedAt).getTime()) / 3_600_000
      : null;
    const awake = awakeMinOf(p);
    return {
      p,
      bedOk,
      deitou: bedOk ? clockLabel(p.inBedAt!, p.tzOffset) : '--:--',
      apagou: clockLabel(p.onsetAt, p.tzOffset),
      acordou: clockLabel(p.wakeAt, p.tzOffset),
      dormindo: hm(p.asleepH),
      naCama: bedH != null ? hm(bedH) : null,
      acordado: awake != null && awake > 0 ? Math.round(awake) : null,
    };
  });

  /** Altura da barra de minutos acordado: 60 min = 40 px, piso de 2 px para não sumir. */
  protected seriesH(min: number): number {
    return Math.max(2, Math.min(40, (min / 60) * 40));
  }

  /** Escala do par nota × medição: 0–12 h, em percentual da largura. */
  protected pct(h: number): string {
    return `${Math.max(0, Math.min(100, (h / 12) * 100))}%`;
  }

  protected despertares(p: SleepPeriod): string {
    const awake = awakeMinOf(p);
    if (awake == null) return '';
    const n = p.awakenings?.length ?? 0;
    return n === 0 ? ' · sem despertar' : ` · ${n} ${n === 1 ? 'despertar' : 'despertares'}`;
  }

  protected pips(n: number): string {
    return '●'.repeat(n);
  }
}
