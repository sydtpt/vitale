import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DURATION_FULL_H,
  SCORE_COVERAGE_FLOOR,
  coverageNote,
  filterByRange,
  periodScore,
  rangeBounds,
  rangeNights,
  type SonoRange,
} from '@vitale/shared';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SonoStore } from '../data/sono.store';
import { SonoPeriodNavComponent } from '../components/period-nav.component';
import { SleepScoreDimsComponent } from '../components/sleep-score-dims.component';

/**
 * /sono/saude na web — a mesma tela do mobile, recomposta em duas colunas: a
 * contagem à esquerda, a origem de cada linha à direita.
 *
 * Ela existe separada da noite por definição, não por gosto: regularidade é uma
 * relação **entre** noites. A noite conta quatro dimensões; o período conta
 * cinco. Nenhum cálculo nasce aqui — `periodScore` e `rangeNights` vêm de
 * `@vitale/shared/sleep`, e a tela só escreve (ADR 0036).
 */
@Component({
  selector: 'rt-sono-saude-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, SonoPeriodNavComponent, SleepScoreDimsComponent],
  templateUrl: './sono-saude-page.component.html',
  styleUrl: './sono-saude-page.component.scss',
})
export class SonoSaudePageComponent {
  protected readonly store = inject(SonoStore);
  protected readonly DURATION_FULL_H = DURATION_FULL_H;
  protected readonly floorPct = Math.round(SCORE_COVERAGE_FLOOR * 100);

  /** Começa em 7 dias: a quinta dimensão é a razão da tela e ela precisa de noites seguidas. */
  protected readonly range = signal<SonoRange>('7d');
  protected readonly offset = signal(0);

  constructor() {
    if (this.store.state() === 'idle') void this.store.load();
  }

  protected readonly nights = computed(() =>
    filterByRange(this.store.periods(), this.range(), new Date(), this.offset()),
  );
  protected readonly expected = computed(() => rangeNights(this.range(), new Date(), this.offset()));

  protected readonly score = computed(() => {
    const { since } = rangeBounds(this.range(), new Date(), this.offset());
    // A base olha para ANTES do período: se ele se comparasse consigo mesmo, a
    // continuidade seria sempre a própria mediana e a dimensão não diria nada.
    const all = this.store.periods();
    const history = since === null ? all : all.filter((p) => p.wakeDay < since);
    return periodScore(this.nights(), this.expected(), this.store.sleepRatings(), history);
  });

  protected readonly note = computed(() => coverageNote(this.score()) ?? undefined);
  protected readonly lowCoverage = computed(() => {
    const s = this.score();
    return !s.scored && s.coverage !== null && s.coverage.nights > 0;
  });

  protected setRange(r: SonoRange): void {
    this.range.set(r);
    this.offset.set(0);
  }
}
