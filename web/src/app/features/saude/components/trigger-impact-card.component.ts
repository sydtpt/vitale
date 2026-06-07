import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { healthMetricById } from '@vitale/shared';
import { HealthStore } from '../data/health.store';
import { HabitsStore } from '@features/habits/data/habits.store';
import { RegistrosStore } from '@features/registros/data/registros.store';
import { formatHealthValue } from '../data/health-format';
import { triggerImpact } from '../data/trigger-impact';

/** Métricas de bem-estar a cruzar + polaridade (subir é pior?). */
const WELLNESS: { metric: string; higherIsWorse: boolean }[] = [
  { metric: 'fcRepouso', higherIsWorse: true },
  { metric: 'vfc', higherIsWorse: false },
  { metric: 'sono', higherIsWorse: false },
];

interface TriggerVM {
  id: string;
  name: string;
  icon: string;
  color: string;
  since: string;            // 'YYYY-MM-DD'
  eventDays: ReadonlySet<string>;
}

interface ImpactRowVM {
  label: string;
  enough: boolean;
  withStr: string;
  withoutStr: string;
  deltaStr: string;
  tone: 'good' | 'bad' | 'neutral';
  n: string;
}

@Component({
  selector: 'rt-trigger-impact-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trigger-impact-card.component.html',
  styleUrl: './trigger-impact-card.component.scss',
})
export class TriggerImpactCardComponent {
  private readonly health = inject(HealthStore);
  private readonly habits = inject(HabitsStore);
  private readonly registros = inject(RegistrosStore);

  /** Gatilho selecionado (id); null = primeiro disponível. */
  private readonly selectedId = signal<string | null>(null);

  constructor() {
    void this.health.load();
    void this.habits.load();
    void this.registros.load();
  }

  /** Gatilhos = hábitos-ruins (valor > 0 no dia) + registros (marcados no dia). */
  protected readonly triggers = computed<TriggerVM[]>(() => {
    const out: TriggerVM[] = [];

    for (const h of this.habits.habits().filter((x) => x.bad)) {
      const eventDays = new Set(
        this.habits.logsFor(h.id).filter((l) => l.value > 0).map((l) => l.logDate),
      );
      out.push({ id: `h:${h.id}`, name: h.name, icon: h.icon, color: h.color, since: h.createdAt.slice(0, 10), eventDays });
    }

    for (const r of this.registros.registros()) {
      const eventDays = new Set(this.registros.logsFor(r.id).map((l) => l.logDate));
      out.push({ id: `r:${r.id}`, name: r.name, icon: r.icon, color: r.color, since: r.createdAt.slice(0, 10), eventDays });
    }

    return out;
  });

  protected readonly selected = computed<TriggerVM | null>(() => {
    const list = this.triggers();
    if (list.length === 0) return null;
    return list.find((t) => t.id === this.selectedId()) ?? list[0];
  });

  protected select(id: string): void {
    this.selectedId.set(id);
  }

  /** Impacto do gatilho selecionado sobre cada métrica de bem-estar. */
  protected readonly rows = computed<ImpactRowVM[]>(() => {
    const t = this.selected();
    if (!t) return [];
    const out: ImpactRowVM[] = [];

    for (const { metric, higherIsWorse } of WELLNESS) {
      const meta = healthMetricById(metric);
      const values = this.health.valuesByDay(metric);
      if (!meta || values.size === 0) continue;

      const im = triggerImpact(metric, t.eventDays, values, t.since);

      if (!im.enough) {
        out.push({ label: meta.label, enough: false, withStr: '', withoutStr: '', deltaStr: '', tone: 'neutral', n: `${im.nWith} dia(s) com` });
        continue;
      }

      const delta = im.delta as number;
      const sign = delta >= 0 ? '+' : '−';
      const deltaStr = `${sign}${formatHealthValue(meta, Math.abs(delta))}`;
      const pct = im.deltaPct ?? 0;
      let tone: ImpactRowVM['tone'] = 'neutral';
      if (Math.abs(pct) >= 2) tone = (higherIsWorse ? delta > 0 : delta < 0) ? 'bad' : 'good';

      out.push({
        label: meta.label,
        enough: true,
        withStr: formatHealthValue(meta, im.withMean),
        withoutStr: formatHealthValue(meta, im.withoutMean),
        deltaStr,
        tone,
        n: `${im.nWith} com · ${im.nWithout} sem`,
      });
    }

    return out;
  });

  protected isSelected(id: string): boolean {
    return this.selected()?.id === id;
  }
}
