import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivitiesStore } from '../data/activities.store';
import { buildOverview, earliestActivityYear, overviewYears, totalsDelta, type Metric, type Period } from '../data/overview';
import { latestAvailableOffset } from '@vitale/shared';

/** Contra o que a variação dos tiles compara — a janela anterior, do mesmo tamanho. */
const PREVIOUS_WORD: Record<Period, string> = {
  semana: 'os 7 dias anteriores',
  mes: 'as 5 semanas anteriores',
  meses12: 'os 12 meses anteriores',
  ano: 'o ano anterior',
  sempre: '',
};
import { PeriodSelectorComponent } from './period-selector.component';
import { StackedBarChartComponent } from './stacked-bar-chart.component';
import { ChartPaletteService } from '@core/services/chart-palette.service';
import { PreferencesService } from '@core/services/preferences.service';

/**
 * Anos desmarcados nos botões do período "Sempre". Preferência local do navegador
 * (como a paleta): `user_preferences` é só leitura na web, então sincronizar exigiria
 * escrita + migration. Guardamos os DESMARCADOS para que um ano novo entre sozinho.
 */
const YEARS_KEY = 'vitale.historyYearsOff';

function readHiddenYears(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(YEARS_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { off?: unknown };
      if (Array.isArray(v.off)) return new Set(v.off.filter((y): y is string => typeof y === 'string'));
    }
  } catch {
    /* localStorage indisponível — segue sem persistir */
  }
  return new Set();
}

@Component({
  selector: 'rt-overview-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PeriodSelectorComponent, StackedBarChartComponent],
  templateUrl: './overview-card.component.html',
  styleUrl: './overview-card.component.scss',
})
export class OverviewCardComponent {
  private readonly store = inject(ActivitiesStore);
  protected readonly palette = inject(ChartPaletteService);
  private readonly prefs = inject(PreferencesService);

  protected readonly period = signal<Period>('meses12');
  protected readonly metric = signal<Metric>('count');
  /** Tipos ocultados via clique na legenda. */
  protected readonly hidden = signal<ReadonlySet<string>>(new Set());
  /** Navegação do período "Ano": 0 = ano corrente, negativo = anos anteriores. */
  protected readonly yearOffset = signal(0);
  /** Anos desligados no período "Sempre" — persistidos no navegador. */
  protected readonly hiddenYears = signal<ReadonlySet<string>>(readHiddenYears());

  // Capturado uma vez: `new Date()` dentro do computed reavaliaria a cada leitura.
  private readonly now = new Date();

  /** Totais, barras e legenda já excluem os tipos ocultos (legenda mantém todos). */
  protected readonly overview = computed(() =>
    buildOverview(
      this.store.activities(), this.period(), this.metric(),
      this.now, this.hidden(), this.weeklyTargetMin(), this.yearOffset(), this.hiddenYears(),
    ),
  );

  // ---- Navegação por ano ----

  protected readonly isYear = computed(() => this.period() === 'ano');
  protected readonly yearLabel = computed(() => `${this.now.getFullYear() + this.yearOffset()}`);
  /** Teto para frente vem do shared (ano corrente disponível ao vivo → 0). */
  protected readonly canNextYear = computed(
    () => this.yearOffset() < latestAvailableOffset(this.now, 'year'),
  );
  /** Piso: primeiro ano com dados — sem isso navega-se para anos vazios sem fim. */
  protected readonly canPrevYear = computed(() => {
    const first = earliestActivityYear(this.store.activities());
    if (first === undefined) return false;
    return this.now.getFullYear() + this.yearOffset() > first;
  });

  protected prevYear(): void {
    if (this.canPrevYear()) this.yearOffset.update((o) => o - 1);
  }

  protected nextYear(): void {
    if (this.canNextYear()) this.yearOffset.update((o) => o + 1);
  }

  protected setPeriod(p: Period): void {
    this.period.set(p);
    this.yearOffset.set(0); // volta ao ano corrente ao trocar de período
  }

  // ---- Botões de ano do período "Sempre" ----

  protected readonly isAll = computed(() => this.period() === 'sempre');
  /** Todos os anos com histórico — os desligados continuam listados, só apagados. */
  protected readonly years = computed(() => overviewYears(this.store.activities()));

  protected isYearOn(year: number): boolean {
    return !this.hiddenYears().has(`${year}`);
  }

  protected toggleYear(year: number): void {
    const key = `${year}`;
    const next = new Set(this.hiddenYears());
    if (next.has(key)) {
      next.delete(key);
    } else {
      // Desligar o último ano ligado deixaria o gráfico e os totais vazios: no-op.
      if (this.years().every((y) => y === year || next.has(`${y}`))) return;
      next.add(key);
    }
    this.hiddenYears.set(next);
    try {
      localStorage.setItem(YEARS_KEY, JSON.stringify({ off: [...next] }));
    } catch {
      /* localStorage indisponível — mantém só em memória */
    }
  }

  /** Linhas de referência só fazem sentido na métrica de duração. */
  protected readonly isDuration = computed(() => this.metric() === 'duration');
  protected readonly goalValue = computed(() =>
    this.isDuration() ? this.overview().targetS : undefined,
  );
  /** Meta prorrateada do bucket em curso — vira um degrau na linha. */
  protected readonly currentGoalValue = computed(() =>
    this.isDuration() ? this.overview().currentTargetS : undefined,
  );
  /** "/mês", "/dia"… no rótulo da linha: sem isso "14h" é lido como total do período. */
  protected readonly goalUnit = computed(() => `/${this.bucketWord()}`);

  /**
   * No período "Semana" as barras são diárias: as duas linhas viram retas na média
   * diária, para comparar com a meta sem estourar o eixo. Nos demais períodos cada
   * barra já é um ciclo fechado, então o esforço progride barra a barra.
   */
  protected readonly isDaily = computed(() => this.overview().granularity === 'day');
  /** Reta da média: aparece em todos os períodos, para comparar o patamar com a meta. */
  protected readonly effortFlat = computed(() =>
    this.isDuration() ? this.overview().effortAvgS : undefined,
  );
  /** Polilinha barra a barra: só onde cada barra é um ciclo fechado (mês/ano/sempre). */
  protected readonly showEffortSeries = computed(() => this.isDuration() && !this.isDaily());

  /** Nome do bucket, para "mês a mês" / "ano a ano" na legenda da progressão. */
  protected readonly bucketWord = computed(() => {
    switch (this.overview().granularity) {
      case 'day': return 'dia';
      case 'week': return 'semana';
      case 'month': return 'mês';
      case 'year': return 'ano';
    }
  });

  /** Rótulo da meta por granularidade, para o texto explicativo abaixo do gráfico. */
  protected readonly targetPer = computed(() => {
    switch (this.overview().granularity) {
      case 'day': return 'por dia';
      case 'week': return 'por semana';
      case 'month': return 'por mês';
      case 'year': return 'por ano';
    }
  });

  protected isHidden(label: string): boolean {
    return this.hidden().has(label);
  }

  protected toggleType(label: string): void {
    this.hidden.update((set) => {
      const next = new Set(set);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  protected readonly metrics: { value: Metric; label: string }[] = [
    { value: 'count', label: 'Atividades' },
    { value: 'duration', label: 'Duração' },
    { value: 'calories', label: 'Calorias' },
    { value: 'distance', label: 'Distância' },
  ];

  protected fmtGoal(s: number): string {
    const min = Math.round(s / 60);
    if (min < 60) return `${min} min`;
    return `${(s / 3600).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
  }

  /** Meta semanal cheia (configurável em Ajustes → Objetivos), que a reta diária dilui. */
  protected readonly weeklyTargetMin = this.prefs.weeklyActivityTargetMin;
  /** Cores das linhas de referência (esquema configurável em Ajustes). */
  protected readonly refLines = this.prefs.referenceLines;

  protected fmtDistance(m: number): string {
    return `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
  }

  protected fmtDuration(s: number): string {
    const h = Math.floor(s / 3600);
    const min = Math.round((s % 3600) / 60);
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  }

  protected fmtCalories(c: number): string {
    return `${Math.round(c).toLocaleString('pt-BR')} kcal`;
  }

  protected abs(n: number): number {
    return Math.abs(n);
  }

  /**
   * Os quatro tiles com a variação sobre a janela anterior.
   *
   * `delta` é `null` quando não há base — período "Sempre", ou janela anterior
   * zerada. A UI não inventa percentual: crescer a partir do nada não é
   * "↑ 100%", é uma conta que não existe.
   */
  protected readonly tiles = computed(() => {
    const o = this.overview();
    const p = o.previous;
    return [
      { label: 'Atividades', value: `${o.totals.count}`, delta: totalsDelta(o.totals.count, p?.count) },
      { label: 'Tempo', value: this.fmtDuration(o.totals.durationS), delta: totalsDelta(o.totals.durationS, p?.durationS) },
      { label: 'Calorias', value: this.fmtCalories(o.totals.calories), delta: totalsDelta(o.totals.calories, p?.calories) },
      { label: 'Distância', value: this.fmtDistance(o.totals.distanceM), delta: totalsDelta(o.totals.distanceM, p?.distanceM) },
    ];
  });

  /**
   * Contra o que a variação compara. Sem isto, "↑12%" deixa o leitor adivinhando
   * a janela. Vazio em "Sempre" — não existe um antes de todo o histórico.
   */
  protected readonly previousWord = computed(() => {
    if (!this.overview().previous) return '';
    return PREVIOUS_WORD[this.period()];
  });
}
