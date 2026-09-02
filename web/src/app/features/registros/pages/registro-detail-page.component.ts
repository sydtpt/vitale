import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DEFAULT_HABIT_ICON,
  DIAS_ABREV_SEG,
  MESES_ABREV,
  MESES_INICIAIS,
  buildRegistroDetail,
  localDateStr,
  moduleOf,
  toggleDateIn,
  yearHeatmap,
  type Period,
  type RegistroHeatCell,
  type TodoModule,
} from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { ThemeService } from '@core/theme/theme.service';
import { PeriodSelectorComponent } from '@features/workout-history/components/period-selector.component';
import { RegistrosStore } from '../data/registros.store';
import { MODULE_LABEL } from '../data/registro-logic';
import { RegistroEditorComponent } from '../components/registro-editor.component';
import { RegistroYearHeatmapComponent } from '../components/registro-year-heatmap.component';

/**
 * Última escolha de período, por navegador (padrão localStorage do
 * `overview-card`). Default `meses12`, não `semana`: registro esparso abriria
 * vazio em 7d. Mesma chave e forma `{ period }` do detalhe mobile.
 */
const PERIOD_KEY = 'vitale.registroDetailPeriod';
const DEFAULT_PERIOD: Period = 'meses12';
// `satisfies` prende o espelho ao union `Period`: um valor a mais ou digitado
// errado deixa de compilar (um a menos continua invisível — é espelho, não prova).
const PERIOD_VALUES = ['semana', 'mes', 'meses12', 'ano', 'sempre'] as const satisfies readonly Period[];

function readStoredPeriod(): Period {
  try {
    const raw = localStorage.getItem(PERIOD_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { period?: unknown };
      if (typeof v.period === 'string' && (PERIOD_VALUES as readonly string[]).includes(v.period)) {
        return v.period as Period;
      }
    }
  } catch {
    /* localStorage indisponível — segue no default, só memória */
  }
  return DEFAULT_PERIOD;
}

/** Geometria do gráfico de barras — viewBox fixo, como o stacked-bar-chart. */
const CHART = { w: 720, h: 210, padL: 26, padR: 10, padT: 20, padB: 24 } as const;

interface ChartBar {
  key: string;
  label: string;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
}

/**
 * Detalhe de um registro na web — métricas por período + heatmap anual
 * clicável (SPEC-registros CAP-5/6/7).
 *
 * A página só renderiza: toda derivação vem de `buildRegistroDetail` /
 * `yearHeatmap` no núcleo, sobre o histórico completo em memória — alternar
 * período não refaz fetch nenhum. O clique numa célula ≤ hoje do heatmap
 * alterna a marca daquele dia (otimista, revert em erro); é o pedaço do CAP-7
 * que só existe aqui, com a precisão do mouse.
 */
@Component({
  selector: 'rt-registro-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    PeriodSelectorComponent,
    RegistroEditorComponent,
    RegistroYearHeatmapComponent,
  ],
  templateUrl: './registro-detail-page.component.html',
  styleUrl: './registro-detail-page.component.scss',
})
export class RegistroDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  protected readonly store = inject(RegistrosStore);

  @ViewChild(RegistroEditorComponent) editor!: RegistroEditorComponent;

  private readonly _id = signal('');
  protected readonly id = this._id.asReadonly();

  /** Histórico completo ('YYYY-MM-DD'); `null` = ainda não carregou. */
  protected readonly dates = signal<string[] | null>(null);
  private readonly fetchError = signal(false);
  /** Último toggle falhou? Some na próxima ação bem-sucedida. */
  protected readonly toggleError = signal(false);
  /** Dias com escrita em voo — barra o clique duplo na mesma célula. */
  private readonly pendingDays = signal<ReadonlySet<string>>(new Set());

  protected readonly period = signal<Period>(readStoredPeriod());
  /** Navegação de ano: 0 = corrente, negativo = anteriores. */
  protected readonly yearOffset = signal(0);

  // Âncora do relógio. É signal, não captura única: navegação por parâmetro
  // REUTILIZA o componente (é para isso que o paramMap está assinado), e um
  // `new Date()` de campo ficaria de ontem se a aba viveu através da
  // meia-noite — reavalia a cada mudança de rota, como o foco faz no mobile.
  private readonly now = signal(new Date());
  protected readonly todayStr = computed(() => localDateStr(this.now()));

  protected readonly registro = computed(() =>
    this.store.registros().find((r) => r.id === this._id()),
  );

  protected readonly detail = computed(() => {
    const d = this.dates();
    if (!d) return null;
    return buildRegistroDetail(d, this.period(), {
      now: this.now(),
      yearOffset: this.yearOffset(),
    });
  });

  protected readonly shownYear = computed(() => this.now().getFullYear() + this.yearOffset());

  protected readonly heat = computed(() => {
    const d = this.dates();
    return d ? yearHeatmap(d, this.shownYear()) : null;
  });

  /** Cor do módulo pelo papel — responde a tema, esquema e paleta (ADR 0018). */
  protected readonly mod = computed(() =>
    moduleOf(
      this.registro()?.color ?? '',
      this.theme.themeId(),
      this.theme.scheme(),
      this.theme.paletteId(),
    ),
  );

  protected readonly isYear = computed(() => this.period() === 'ano');
  protected readonly loading = computed(() => this.dates() === null && !this.fetchError());
  /** Erro só quando não há nada na tela — com dados, a falha de refetch é silenciosa. */
  protected readonly showError = computed(
    () => (this.fetchError() && this.dates() === null) || this.store.state() === 'error',
  );

  protected readonly WEEKDAY_LABELS = DIAS_ABREV_SEG;
  protected readonly MONTH_LABELS = MESES_INICIAIS;
  protected readonly DEFAULT_ICON = DEFAULT_HABIT_ICON;
  protected readonly CHART = CHART;

  /** Barras e grade do gráfico — eixo só em inteiros (contagens 0–3 são o caso comum). */
  protected readonly chart = computed(() => {
    const d = this.detail();
    if (!d) return null;
    const max = Math.max(...d.buckets.map((b) => b.value), 1);
    const step = Math.max(1, Math.ceil(max / 4));
    const top = Math.ceil(max / step) * step;
    const plotW = CHART.w - CHART.padL - CHART.padR;
    const plotH = CHART.h - CHART.padT - CHART.padB;
    const n = d.buckets.length;
    const slot = plotW / n;
    const bw = Math.min(44, slot * 0.62);

    const grid: { v: number; y: number }[] = [];
    for (let v = 0; v <= top; v += step) {
      grid.push({ v, y: CHART.padT + plotH - (v / top) * plotH });
    }

    const bars: ChartBar[] = d.buckets.map((b, i) => {
      const h = (b.value / top) * plotH;
      return {
        key: b.key,
        label: b.label,
        value: b.value,
        x: CHART.padL + slot * i + (slot - bw) / 2,
        y: CHART.padT + plotH - h,
        w: bw,
        h,
        cx: CHART.padL + slot * i + slot / 2,
      };
    });
    return { grid, bars };
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((pm) => {
      this._id.set(pm.get('id') ?? '');
      this.dates.set(null);
      this.fetchError.set(false);
      this.toggleError.set(false);
      this.pendingDays.set(new Set());
      this.now.set(new Date()); // reavalia "hoje" — o componente é reutilizado
      void this.loadDates();
    });

    // Deep link: hidrata o store sozinho (matriz de edge cases).
    void this.store.load();

    // Id inexistente devolve à lista — só depois de o store carregar de fato.
    effect(() => {
      if (this.store.state() === 'loaded' && this._id() && !this.registro()) {
        void this.router.navigate(['/registros']);
      }
    });
  }

  private async loadDates(): Promise<void> {
    const id = this._id();
    if (!id) return;
    try {
      const dates = await this.store.fetchAllDatesFor(id);
      if (id === this._id()) {
        this.dates.set(dates);
        this.fetchError.set(false);
      }
    } catch {
      // Guard de corrida: um fetch em voo que falha DEPOIS de navegar para
      // outro registro não pode sujar o estado do novo. Depois dele: com
      // dados na tela a falha é silenciosa; sem dados, vira o estado de erro
      // com "tentar de novo".
      if (id === this._id() && this.dates() === null) this.fetchError.set(true);
    }
  }

  protected retry(): void {
    if (this.store.state() === 'error') void this.store.load(true);
    this.fetchError.set(false);
    void this.loadDates();
  }

  protected setPeriod(p: Period): void {
    this.period.set(p);
    this.yearOffset.set(0); // volta ao ano corrente ao trocar de período
    try {
      localStorage.setItem(PERIOD_KEY, JSON.stringify({ period: p }));
    } catch {
      /* localStorage indisponível — mantém só em memória */
    }
  }

  protected prevYear(): void {
    if (this.detail()?.canPrevYear) this.yearOffset.update((o) => o - 1);
  }

  protected nextYear(): void {
    if (this.detail()?.canNextYear) this.yearOffset.update((o) => o + 1);
  }

  protected openEdit(): void {
    this.editor?.open();
  }

  /**
   * Alterna a marca de um dia do heatmap: otimista no cliente, persiste via
   * store; em erro de rede, reverte só aquele dia. Todas as métricas derivam
   * de `dates`, então gráfico, tiles e heatmap refletem na hora. As duas
   * transições (otimista e revert) são o `toggleDateIn` do núcleo, coberto
   * por `toggle.test.ts`. Vale também para registro ARQUIVADO, de propósito:
   * correção ≠ captura — só a lista esconde o Marcar (CAP-3/7).
   */
  protected async onToggle(cell: RegistroHeatCell): Promise<void> {
    const id = this._id();
    const cur = this.dates();
    const date = cell.date;
    if (!id || !cur || date > this.todayStr()) return; // futuro inerte (o componente já barra)
    if (this.pendingDays().has(date)) return;

    const marked = !cur.includes(date);
    this.dates.set(toggleDateIn(cur, date, marked));
    this.pendingDays.update((s) => new Set(s).add(date));
    try {
      await this.store.toggleDay(id, date, marked);
      if (id === this._id()) this.toggleError.set(false); // sucesso limpa o aviso
    } catch (e) {
      console.error('Erro ao marcar registro:', e);
      // Guard de corrida: se o usuário já navegou para outro registro, o
      // revert deste `date` corromperia o histórico do novo — só o aviso fica
      // de fora, junto. Revert desfaz só este dia (toggles concorrentes ficam).
      if (id === this._id()) {
        this.dates.update((d) => (d ? toggleDateIn(d, date, !marked) : d));
        this.toggleError.set(true);
      }
    } finally {
      this.pendingDays.update((s) => {
        const next = new Set(s);
        next.delete(date);
        return next;
      });
    }
  }

  protected moduleLabel(m: TodoModule): string {
    return MODULE_LABEL[m] ?? 'Geral';
  }

  protected fmtLast(days: number | null): string {
    if (days === null) return 'nunca';
    if (days === 0) return 'hoje';
    if (days === 1) return 'ontem';
    return `${days} dias`;
  }

  /** Frequência com 1 decimal e vírgula; barras e totais ficam inteiros. */
  protected fmtFreq(value: number): string {
    return value.toFixed(1).replace('.', ',');
  }

  /** Dias inteiros ("43 dias") ou "—" — métrica indisponível não some do layout. */
  protected fmtGap(days: number | null): string {
    return days === null ? '—' : `${Math.round(days)} dias`;
  }

  protected fmtDay(s: string): string {
    return `${Number(s.slice(8, 10))} ${MESES_ABREV[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
  }

  /** Delta absoluto (+1/−2), nunca percentual; `null` não renderiza (3 estados). */
  protected fmtDelta(delta: number): string {
    if (delta === 0) return '=';
    return delta > 0 ? `+${delta}` : `−${-delta}`;
  }

  protected deltaDir(delta: number): 'up' | 'down' | 'flat' {
    return delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  }

  protected miniMax(values: number[]): number {
    return Math.max(...values, 1);
  }
}
