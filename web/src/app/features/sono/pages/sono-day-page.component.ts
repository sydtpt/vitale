import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { awakeMinOf, bedtimeMeasured, clockLabel, type SleepPeriod } from '@vitale/shared';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SonoStore, dayLabel, hm } from '../data/sono.store';

/** Estágios na ordem da faixa, com o rótulo que o usuário lê e a variável de cor. */
const STAGES = [
  { key: 'deep', label: 'Profundo', color: 'var(--role-blue-text)' },
  { key: 'rem', label: 'REM', color: 'var(--role-blue)' },
  { key: 'core', label: 'Leve', color: 'var(--role-blue-soft)' },
  { key: 'unspecified', label: 'Sem estágio', color: 'var(--ink-4)' },
] as const;

interface StageVM { key: string; label: string; color: string; hours: number; flex: number; }
interface HoleVM { left: string; width: string; }

/**
 * O detalhe de uma noite (CAP-4). Duas faixas, e a diferença entre elas é o que
 * o dado sustenta: a linha do tempo real — sono do apagar ao acordar, com os
 * despertares cortando nas posições em que ocorreram — e a composição por
 * estágio em proporção, porque o que se grava são horas por estágio, não
 * intervalos. O rótulo de incerteza não é rodapé.
 */
@Component({
  selector: 'rt-sono-day-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, PageHeaderComponent],
  templateUrl: './sono-day-page.component.html',
  styleUrl: './sono-day-page.component.scss',
})
export class SonoDayPageComponent {
  protected readonly store = inject(SonoStore);
  private readonly route = inject(ActivatedRoute);
  protected readonly day = this.route.snapshot.paramMap.get('day') ?? '';
  protected readonly hm = hm;
  protected readonly dayLabel = dayLabel;
  protected readonly clockLabel = clockLabel;

  constructor() {
    if (this.store.state() === 'idle') void this.store.load();
  }

  protected readonly p = computed<SleepPeriod | undefined>(() => this.store.byDay(this.day));
  protected readonly nota = computed(() => this.store.sleepRatings()[this.day] ?? null);
  protected readonly bedOk = computed(() => { const p = this.p(); return p ? bedtimeMeasured(p) : false; });

  protected readonly awakeText = computed(() => {
    const p = this.p();
    if (!p) return '';
    const min = awakeMinOf(p);
    if (min == null) return 'Seu relógio não reporta despertares nesta noite.';
    const n = p.awakenings?.length ?? 0;
    if (n === 0) return 'Sem despertar registrado.';
    return `${n} ${n === 1 ? 'despertar' : 'despertares'} · ${Math.round(min)} min acordado`;
  });

  /** Os buracos da linha do tempo, em percentual do apagar→acordar. */
  protected readonly holes = computed<HoleVM[]>(() => {
    const p = this.p();
    if (!p) return [];
    const start = new Date(p.onsetAt).getTime();
    const span = Math.max(new Date(p.wakeAt).getTime() - start, 1);
    return (p.awakenings ?? []).map((a) => {
      const l = ((new Date(a.from).getTime() - start) / span) * 100;
      const w = ((new Date(a.to).getTime() - new Date(a.from).getTime()) / span) * 100;
      return { left: `${Math.max(0, l)}%`, width: `${Math.max(0.4, w)}%` };
    });
  });

  protected readonly stages = computed<StageVM[]>(() => {
    const s = this.p()?.stages;
    if (!s) return [];
    const total = STAGES.reduce((a, st) => a + (s[st.key] ?? 0), 0);
    if (total <= 0) return [];
    return STAGES.filter((st) => (s[st.key] ?? 0) > 0).map((st) => ({
      key: st.key, label: st.label, color: st.color, hours: s[st.key] ?? 0, flex: (s[st.key] ?? 0) / total,
    }));
  });
}
