/**
 * Recap em linguagem natural da semana — destaques rankeados ("Você treinou 3×",
 * "Dormiu melhor (+0h32)", "Gastou −12%"). Derivação 100% pura, compartilhada por
 * web e mobile; recebe os recaps já calculados (ver `recap.ts`) e produz frases
 * prontas em PT-BR com tom (good/bad/neutral), ícone neutro e prioridade.
 *
 * O ícone é um nome neutro mapeado por plataforma (lucide no web, Ionicons no
 * mobile). Não depende de Angular/React.
 */
import type { RecapValue, MetricRecap, ActivityRecap } from './recap';

export type HighlightTone = 'good' | 'bad' | 'neutral';

/** Ícone neutro do destaque — cada plataforma mapeia para seu set. */
export type HighlightIcon =
  | 'workout' | 'distance' | 'sleep' | 'heart' | 'hrv'
  | 'habit' | 'warning' | 'money';

export interface WeekHighlight {
  id: string;
  tone: HighlightTone;
  icon: HighlightIcon;
  /** Frase pronta para render. */
  text: string;
  /** Ordenação decrescente; maior = mais relevante. */
  priority: number;
}

/** Uma métrica de saúde no recap + metadados de formatação/polaridade. */
export interface HealthHighlightInput {
  /** id da métrica (ex.: 'sono', 'fcRepouso', 'vfc'). */
  metric: string;
  label: string;
  recap: MetricRecap;
  /** Subir é ruim? (FC repouso = true; sono/VFC = false). */
  higherIsWorse: boolean;
  icon: HighlightIcon;
  /** Casas decimais ao formatar o delta (sono = 1, FC/VFC = 0). */
  decimals?: number;
  /** Sufixo da unidade no texto (ex.: 'h', ' bpm', ' ms'). */
  unit?: string;
}

export interface WeekHighlightInput {
  /** Recap de atividades da semana (de `activityRecap`). */
  activities?: ActivityRecap;
  /** Métricas de saúde (sono/FC/VFC…). */
  health?: HealthHighlightInput[];
  /** Hábitos bons — subir é bom. */
  goodHabits?: { name: string; recap: RecapValue }[];
  /** Hábitos ruins / registros — subir é ruim. */
  badHabits?: { name: string; recap: RecapValue }[];
  /** Gasto da semana (R$) — subir é ruim. Opcional (sem store de transações ainda). */
  spend?: RecapValue;
}

/** Delta relativo (abs) abaixo deste % conta como estável → tom neutro. */
const FLAT_PCT = 2;

function toneFor(delta: number | null, deltaPct: number | null, higherIsWorse: boolean): HighlightTone {
  if (delta == null || delta === 0) return 'neutral';
  if (deltaPct != null && Math.abs(deltaPct) < FLAT_PCT) return 'neutral';
  const worse = higherIsWorse ? delta > 0 : delta < 0;
  return worse ? 'bad' : 'good';
}

function priorityOf(deltaPct: number | null, fallback: number): number {
  return deltaPct != null ? Math.abs(deltaPct) : fallback;
}

function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** "melhor"/"pior"/"igual" conforme tom — para frases de saúde. */
function compareWord(tone: HighlightTone): string {
  if (tone === 'good') return 'melhor';
  if (tone === 'bad') return 'pior';
  return 'estável';
}

/**
 * Gera 3–5 destaques rankeados por magnitude do delta. Inclui só o que tem dado
 * suficiente: atividades com treino na semana, métricas com média atual, hábitos
 * com evento em alguma das duas semanas.
 */
export function buildWeekHighlights(input: WeekHighlightInput): WeekHighlight[] {
  const out: WeekHighlight[] = [];

  // ── Treinos ─────────────────────────────────────────────
  const act = input.activities;
  if (act && act.count.current > 0) {
    const c = act.count;
    const deltaTxt = c.delta === 0 ? 'igual à semana passada'
      : `${c.delta > 0 ? '+' : '−'}${Math.abs(c.delta)} vs. semana passada`;
    out.push({
      id: 'workouts',
      tone: toneFor(c.delta, c.deltaPct, false),
      icon: 'workout',
      text: `${c.current} treino${c.current > 1 ? 's' : ''} nesta semana · ${deltaTxt}`,
      priority: priorityOf(c.deltaPct, c.current * 10),
    });

    const dist = act.distanceM;
    if (dist.current > 0) {
      const km = (v: number) => `${fmtNum(v / 1000, 1)} km`;
      out.push({
        id: 'distance',
        tone: toneFor(dist.delta, dist.deltaPct, false),
        icon: 'distance',
        text: `${km(dist.current)} percorridos · ${dist.delta >= 0 ? '+' : '−'}${km(Math.abs(dist.delta))}`,
        priority: priorityOf(dist.deltaPct, 20),
      });
    }
  }

  // ── Saúde (sono/FC/VFC…) ────────────────────────────────
  for (const h of input.health ?? []) {
    const r = h.recap;
    if (r.current == null || r.delta == null) continue;
    const tone = toneFor(r.delta, r.deltaPct, h.higherIsWorse);
    const sign = r.delta >= 0 ? '+' : '−';
    const unit = h.unit ?? '';
    const deltaTxt = `${sign}${fmtNum(Math.abs(r.delta), h.decimals ?? 0)}${unit}`;
    const pct = r.deltaPct != null ? ` (${r.deltaPct >= 0 ? '+' : '−'}${fmtNum(Math.abs(r.deltaPct))}%)` : '';
    out.push({
      id: `health-${h.metric}`,
      tone,
      icon: h.icon,
      text: `${h.label} ${compareWord(tone)}: ${deltaTxt}${pct}`,
      priority: priorityOf(r.deltaPct, 5),
    });
  }

  // ── Hábitos bons ────────────────────────────────────────
  for (const g of input.goodHabits ?? []) {
    const r = g.recap;
    if (r.current === 0 && r.prior === 0) continue;
    const tone = toneFor(r.delta, r.deltaPct, false);
    if (tone === 'neutral') continue;
    const deltaTxt = r.delta === 0 ? '' : ` (${r.delta > 0 ? '+' : '−'}${Math.abs(r.delta)})`;
    out.push({
      id: `good-${g.name}`,
      tone,
      icon: 'habit',
      text: `${g.name}: ${r.current}× nesta semana${deltaTxt}`,
      priority: priorityOf(r.deltaPct, 3),
    });
  }

  // ── Hábitos ruins / registros ───────────────────────────
  for (const b of input.badHabits ?? []) {
    const r = b.recap;
    if (r.current === 0 && r.prior === 0) continue;
    const tone = toneFor(r.delta, r.deltaPct, true);
    if (tone === 'neutral') continue;
    const deltaTxt = r.delta === 0 ? '' : ` (${r.delta > 0 ? '+' : '−'}${Math.abs(r.delta)})`;
    out.push({
      id: `bad-${b.name}`,
      tone,
      icon: 'warning',
      text: `${b.name}: ${r.current}× nesta semana${deltaTxt}`,
      priority: priorityOf(r.deltaPct, 4),
    });
  }

  // ── Gasto ───────────────────────────────────────────────
  const spend = input.spend;
  if (spend && (spend.current > 0 || spend.prior > 0)) {
    const tone = toneFor(spend.delta, spend.deltaPct, true);
    const brl = (v: number) => `R$ ${fmtNum(v)}`;
    const pct = spend.deltaPct != null
      ? `${spend.deltaPct >= 0 ? '+' : '−'}${fmtNum(Math.abs(spend.deltaPct))}% vs. semana passada`
      : 'sem base de comparação';
    out.push({
      id: 'spend',
      tone,
      icon: 'money',
      text: `${brl(spend.current)} gastos · ${pct}`,
      priority: priorityOf(spend.deltaPct, 8),
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
