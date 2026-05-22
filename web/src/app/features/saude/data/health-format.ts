/**
 * Formatação e helpers de data para a feature Saúde (web).
 * Os agregados diários vêm de `health_daily`; aqui só formatamos para exibição.
 */
import type { HealthMetricMeta } from '@vitale/shared';

/** Data local 'YYYY-MM-DD' (não UTC). */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Últimas N datas locais (mais antiga → hoje). */
export function lastNDates(n: number, today: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(localDateStr(d));
  }
  return out;
}

function formatHoursMin(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}

/** Número com separador pt-BR e casas do catálogo. */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Formata o valor diário de uma métrica para exibição.
 * Casos especiais espelham o mobile: distância (metros→km), sono (h/min).
 */
export function formatHealthValue(meta: HealthMetricMeta, value: number | null): string {
  if (value == null) return '—';
  if (meta.id === 'distancia') {
    return value >= 1000 ? `${formatNumber(value / 1000, 2)} km` : `${formatNumber(Math.round(value))} m`;
  }
  if (meta.id === 'sono') return formatHoursMin(value);
  const num = formatNumber(value, meta.decimals ?? 0);
  return meta.unit ? `${num} ${meta.unit}` : num;
}

/** Pontos de uma polyline SVG normalizada (sparkline). '' se < 2 pontos. */
export function sparkPoints(values: number[], w = 88, h = 26): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1);
  return values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ');
}
