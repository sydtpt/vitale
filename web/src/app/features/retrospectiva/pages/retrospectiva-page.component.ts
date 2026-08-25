import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import {
  T,
  localDateStr,
  retroSince,
  buildRetroLede,
  YEAR_SERIES,
  MONTH_FULL_PT,
  type YearSerieKey,
  latestAvailableOffset,
  habitCalories,
  type PeriodKind,
  type RecapValue,
  type HighlightIcon,
  type RetroHabitRow,
  type RetroHealthRow,
  type RetroRegistroRow,
  type MonthBucket,
  type SportStats,
  type SportBestEffort,
} from '@vitale/shared';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { IconComponent } from '@core/services/icon.component';
import { formatClock } from '@features/workout-history/data/format';
import { RetroStore } from '../data/retro.store';
import { HeatmapGridComponent } from '../components/heatmap-grid.component';
import { TaskGridStripComponent } from '../components/task-grid-strip.component';

/** Ícone neutro do shared → nome do set `rt-icon`. */
const ICON_MAP: Record<HighlightIcon, string> = {
  workout: 'dumbbell', distance: 'run', sleep: 'moon', heart: 'heart',
  hrv: 'trend', habit: 'target', warning: 'flag', money: 'wallet',
};

interface DeltaVM { text: string; tone: 'good' | 'bad' | 'neutral' }
interface KpiVM { icon: string; color: string; label: string; value: string; delta: DeltaVM }

const KIND_LABEL: Record<PeriodKind, string> = {
  week: 'Semana', month: 'Mês', season: 'Estação', year: 'Ano', all: 'Total',
};

/** Cabeçalho da manchete — nomeia o período contado, como a chamada de um jornal. */
const LEDE_EYEBROW: Record<PeriodKind, string> = {
  week: 'A semana em poucas frases',
  month: 'O mês em poucas frases',
  season: 'A estação em poucas frases',
  year: 'O ano em poucas frases',
  all: 'Tudo até aqui, em poucas frases',
};

@Component({
  selector: 'rt-retrospectiva-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, HeatmapGridComponent, TaskGridStripComponent],
  templateUrl: './retrospectiva-page.component.html',
  styleUrl: './retrospectiva-page.component.scss',
})
export class RetrospectivaPageComponent {
  protected readonly T = T;
  protected readonly kinds: PeriodKind[] = ['week', 'month', 'season', 'year', 'all'];
  protected readonly kindLabel = KIND_LABEL;

  private readonly store = inject(RetroStore);
  private readonly now = new Date();

  protected readonly kind = signal<PeriodKind>('week');
  protected readonly offset = signal<number>(latestAvailableOffset(this.now, 'week'));

  protected readonly state = this.store.state;

  constructor() {
    // Busca a partir do que o shared decidir: cobre o período anterior (exigido
    // pelos deltas) **e** a janela de análise de 90 dias (exigida pelos insights
    // cruzados). Ver docs/specs/retrospectiva/v2-jornal.md §2.1.
    effect(() => {
      const k = this.kind();
      const o = this.offset();
      const since = localDateStr(retroSince(this.now, k, o));
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
  // A manchete sai da lista **completa**; a exibida é a fatiada (spec v2 §3).
  private readonly allHighlights = computed(() => this.store.highlights(this.now, this.kind(), this.offset()));
  protected readonly highlights = computed(() => this.allHighlights().slice(0, 6));
  protected readonly lede = computed(() => buildRetroLede(this.allHighlights()));
  protected readonly ledeEyebrow = computed(() => LEDE_EYEBROW[this.kind()]);

  // ── Forma 02 · heatmap ──────────────────────────────────────────────────
  // Só onde uma célula por dia ainda é legível; um ano em células diárias vira
  // ruído, e o modo Ano já tem as barras.
  protected readonly heat = computed(() => {
    const k = this.kind();
    if (k !== 'week' && k !== 'month' && k !== 'season') return null;
    return this.store.heatmap(this.now, k, this.offset(), 'sono');
  });

  // ── Faixa das séries diárias ────────────────────────────────────────────
  // Semana e mês só. A faixa é UMA linha por tarefa, então N vira largura: 31
  // células já são finas, e uma estação (92) não caberia. É também o recorte que
  // a pergunta pede — "quantos dias por mês eu lembrei". Paridade com o mobile.
  protected readonly taskGrid = computed(() => {
    const k = this.kind();
    if (k !== 'week' && k !== 'month') return null;
    return this.store.taskGrid(this.now, k, this.offset());
  });

  // ── Forma 03 · seletor das seis séries do MonthBucket ───────────────────
  protected readonly series = YEAR_SERIES;
  protected readonly monthFull = MONTH_FULL_PT;
  protected readonly serieKey = signal<YearSerieKey>('workouts');
  protected readonly serie = computed(
    () => YEAR_SERIES.find((s) => s.key === this.serieKey()) ?? YEAR_SERIES[0],
  );
  protected readonly serieMax = computed(
    () => Math.max(1, ...this.buckets().map(this.serie().pick)),
  );

  /** Mês tocado — 12 barras não comportam rótulo em cada uma (spec v2 §5). */
  protected readonly selMonth = signal<number | null>(null);

  protected setSerie(k: YearSerieKey): void {
    this.serieKey.set(k);
    this.selMonth.set(null);
  }

  protected pickMonth(m: number): void {
    this.selMonth.update((cur) => (cur === m ? null : m));
  }

  protected serieVal(b: MonthBucket): string {
    return this.serie().fmt(this.serie().pick(b));
  }

  protected seriePct(b: MonthBucket): number {
    return Math.round((this.serie().pick(b) / this.serieMax()) * 100);
  }
  protected readonly isYear = computed(() => this.kind() === 'year');
  /** 'Total' não tem período anterior nem navegação ‹ ›. */
  protected readonly isAll = computed(() => this.kind() === 'all');
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
      // Passos, não distância: a distância já aparece no card de treinos e só conta
      // o que virou atividade — os passos medem o movimento do dia inteiro.
      { icon: 'footprints', color: T.blue, label: 'Passos', value: this.num(s.fitness.steps.current), delta: this.delta(s.fitness.steps, false) },
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
    // 'Total' não tem período anterior: prev degenerado faz delta === current,
    // então qualquer badge seria espúrio.
    if (this.isAll()) return { text: '', tone: 'neutral' };
    if (r.delta === 0) return { text: '—', tone: 'neutral' };
    const worse = higherIsWorse ? r.delta > 0 : r.delta < 0;
    const sign = r.delta > 0 ? '+' : '−';
    const text = r.deltaPct != null
      ? `${sign}${this.num(Math.abs(r.deltaPct))}%`
      : `${sign}${this.num(Math.abs(r.delta))}`;
    return { text, tone: worse ? 'bad' : 'good' };
  }

  // ── esportes (Ciclismo / Corrida) ──

  /** Tempo no formato relógio (`h:mm:ss` / `m:ss`) — recordes. */
  protected clock(seconds: number): string { return formatClock(seconds); }

  /** Velocidade média (ciclismo) a partir de m/s. */
  protected speedKmh(mps: number | null): string {
    return mps == null ? '—' : `${this.num(mps * 3.6, 1)} km/h`;
  }

  /** Pace médio (corrida) mm:ss/km a partir de m/s. */
  protected pace(mps: number | null): string {
    if (mps == null || mps <= 0) return '—';
    return `${formatClock(1000 / mps)} /km`;
  }

  /**
   * Delta de velocidade/pace vs período anterior. Maior m/s é melhor nos dois
   * esportes; no pace o delta é exibido em s/km (negativo = mais rápido).
   */
  protected speedDelta(sp: SportStats, asPace: boolean): DeltaVM {
    const { current, prior } = sp.speedMps;
    if (this.isAll() || current == null || prior == null) return { text: '', tone: 'neutral' };
    const tone: DeltaVM['tone'] = current === prior ? 'neutral' : current > prior ? 'good' : 'bad';
    if (asPace) {
      const diff = 1000 / current - 1000 / prior; // s/km; negativo = mais rápido
      if (Math.abs(diff) < 1) return { text: '—', tone: 'neutral' };
      return { text: `${diff > 0 ? '+' : '−'}${formatClock(Math.abs(diff))}/km`, tone };
    }
    const diff = (current - prior) * 3.6;
    if (Math.abs(diff) < 0.05) return { text: '—', tone: 'neutral' };
    return { text: `${diff > 0 ? '+' : '−'}${this.num(Math.abs(diff), 1)} km/h`, tone };
  }

  /** Delta de um recorde vs melhor do período anterior (menos tempo = melhor). */
  protected bestDelta(b: SportBestEffort): DeltaVM {
    if (this.isAll() || b.priorSeconds == null) return { text: '', tone: 'neutral' };
    const diff = b.seconds - b.priorSeconds;
    if (diff === 0) return { text: '—', tone: 'neutral' };
    return { text: `${diff > 0 ? '+' : '−'}${formatClock(Math.abs(diff))}`, tone: diff < 0 ? 'good' : 'bad' };
  }

  /** Data curta `dd/mm/aa` — 'Total' atravessa anos. */
  protected shortDate(iso: string): string {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
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

  // ── hábitos ──

  /** Quantidade de hábito: inteiro sem casas, fracionário com 1. */
  private qty(n: number): string {
    return Number.isInteger(n) ? this.num(n) : this.num(n, 1);
  }

  /** Total acumulado no período — "12,5 L". */
  protected habitTotal(h: RetroHabitRow): string {
    return h.unit ? `${this.qty(h.total.current)} ${h.unit}` : this.qty(h.total.current);
  }

  /** Linha de apoio: média diária + dias com registro (+ kcal estimadas). */
  protected habitSub(h: RetroHabitRow): string {
    const dias = `${h.recap.current} ${h.recap.current === 1 ? 'dia' : 'dias'}`;
    const kcal = habitCalories(h.name, h.unit, h.total.current);
    const extra = kcal == null ? '' : ` · ≈${this.num(kcal)} kcal`;
    if (h.perDayDays === 0) return `${dias}${extra}`;
    const media = h.unit ? `${this.qty(h.perDay)} ${h.unit}` : this.qty(h.perDay);
    return `${media}/dia · ${dias}${extra}`;
  }

  /** Linha de apoio do registro: frequência das marcações no período. */
  protected registroSub(r: RetroRegistroRow): string {
    if (r.recap.current === 0) return 'sem marcações neste período';
    if (r.everyDays <= 1) return 'todo dia';
    return `1× a cada ${this.qty(r.everyDays)} dias`;
  }

  protected trendIcon(t: 'up' | 'down' | 'flat'): string {
    return t === 'up' ? '▲' : t === 'down' ? '▼' : '–';
  }

  protected barPct(v: number, max: number): number { return Math.round((v / max) * 100); }
}
