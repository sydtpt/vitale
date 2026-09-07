/**
 * Piso das rotas — a visão global: janela de período, soma e os fatos.
 *
 * O detalhe de uma pedalada lê `Activity.surfaceMix` direto; o que fica aqui é
 * o que a página de Ciclismo precisa para somar N pedaladas num período e
 * dizer, em uma frase, o que a soma significa. Puro: a tela passa as
 * atividades já filtradas por tipo e por bicicleta (a lente é dela).
 */
import type { Activity } from '../models';
import { SURFACE_CATEGORIES, sumSurfaceMix, surfaceShares, type SurfaceCategory, type SurfaceMix } from './classify';

export type SurfaceRange = '4s' | '12s' | 'ano' | 'tudo';

export const SURFACE_RANGES: readonly { id: SurfaceRange; label: string; days?: number }[] = [
  { id: '4s', label: '4 sem', days: 28 },
  { id: '12s', label: '12 sem', days: 84 },
  { id: 'ano', label: 'Ano' },
  { id: 'tudo', label: 'Tudo' },
];

/** 'YYYY-MM-DD' do instante no fuso do aparelho — a mesma régua da herança de bike. */
function localDate(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

export interface SurfaceWindow {
  /** 'YYYY-MM-DD' inclusivos; ausentes em "tudo". */
  from?: string;
  to?: string;
  label: string;
}

/** A janela de um período: rolante para 4/12 semanas, calendário para o ano. */
export function surfaceWindow(range: SurfaceRange, today: Date = new Date()): SurfaceWindow {
  if (range === 'tudo') return { label: 'todo o histórico' };
  if (range === 'ano') {
    const y = today.getFullYear();
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
  }
  const days = SURFACE_RANGES.find((r) => r.id === range)?.days ?? 28;
  const to = new Date(today);
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: localDate(from), to: localDate(to), label: `${fmtDM(from)} a ${fmtDM(to)}` };
}

function fmtDM(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function inSurfaceWindow(a: Pick<Activity, 'startAt'>, w: SurfaceWindow): boolean {
  if (!w.from || !w.to) return true;
  const day = localDate(new Date(a.startAt));
  return day >= w.from && day <= w.to;
}

export interface SurfaceSummary {
  mix: SurfaceMix;
  /** Atividades na janela; `withSurface` é o subconjunto que já tem piso calculado. */
  count: number;
  withSurface: number;
  shares: Record<SurfaceCategory, number>;
  /** liso + blocos + pavé. */
  pavedShare: number;
  /** cascalho + terra. */
  offroadShare: number;
  /** A pedalada mais fora do asfalto da janela (entre as que têm piso). */
  mostOffroad?: { activity: Activity; share: number };
}

/** Soma o piso das atividades de uma janela. Quem chama já filtrou tipo e bicicleta. */
export function summarizeSurface(activities: readonly Activity[], w: SurfaceWindow): SurfaceSummary {
  const inWin = activities.filter((a) => inSurfaceWindow(a, w));
  const withMix = inWin.filter((a) => a.surfaceMix && a.surfaceMix.total > 0);
  const mix = sumSurfaceMix(withMix.map((a) => a.surfaceMix));
  const shares = surfaceShares(mix);
  let mostOffroad: SurfaceSummary['mostOffroad'];
  for (const a of withMix) {
    const s = surfaceShares(a.surfaceMix!);
    const off = s.cascalho + s.terra;
    if (!mostOffroad || off > mostOffroad.share) mostOffroad = { activity: a, share: off };
  }
  return {
    mix,
    count: inWin.length,
    withSurface: withMix.length,
    shares,
    pavedShare: shares.liso + shares.blocos + shares.pave,
    offroadShare: shares.cascalho + shares.terra,
    mostOffroad,
  };
}

/** Rótulo de cada categoria na tela — blocos e pavé são um degrau só (decisão da mesa, 05/09). */
export const SURFACE_LABEL: Record<SurfaceCategory, string> = {
  liso: 'Asfalto e concreto',
  blocos: 'Blocos e pavé',
  pave: 'Blocos e pavé',
  cascalho: 'Cascalho',
  terra: 'Terra e trilha',
  desconhecido: 'Não especificado',
};

/** As linhas da legenda: quatro degraus fixos, e "não especificado" só quando existe. */
export interface SurfaceLegendRow {
  key: 'liso' | 'blocos' | 'cascalho' | 'terra' | 'desconhecido';
  label: string;
  meters: number;
  share: number;
}

export function surfaceLegend(mix: SurfaceMix): SurfaceLegendRow[] {
  const t = mix.total || 1;
  const rows: SurfaceLegendRow[] = [
    { key: 'liso', label: SURFACE_LABEL.liso, meters: mix.liso, share: mix.liso / t },
    { key: 'blocos', label: SURFACE_LABEL.blocos, meters: mix.blocos + mix.pave, share: (mix.blocos + mix.pave) / t },
    { key: 'cascalho', label: SURFACE_LABEL.cascalho, meters: mix.cascalho, share: mix.cascalho / t },
    { key: 'terra', label: SURFACE_LABEL.terra, meters: mix.terra, share: mix.terra / t },
  ];
  if (mix.desconhecido > 0) {
    rows.push({ key: 'desconhecido', label: SURFACE_LABEL.desconhecido, meters: mix.desconhecido, share: mix.desconhecido / t });
  }
  return rows;
}

/** Garante que a ordem das categorias é a da escada — a rampa de cor depende disso. */
export const SURFACE_ORDER: readonly SurfaceCategory[] = SURFACE_CATEGORIES;

// ─── Piso por estação ─────────────────────────────────────────────────────
//
// A série mês a mês foi descartada por medição: nas 138 pedaladas de produção,
// metade da variação entre meses é tamanho de amostra (fev/2026 tem UMA
// pedalada e apareceria como barra cheia). Somando os anos por estação, a barra
// mais magra tem 13 pedaladas e a mais gorda 56 — e a primavera anda em
// cascalho o dobro do inverno (11,7% contra 5,8%).
//
// Estação é do hemisfério NORTE, fixa: quem usa isto mora na Bélgica.

export type Season = 'inverno' | 'primavera' | 'verao' | 'outono';

export const SEASONS: readonly { id: Season; label: string }[] = [
  { id: 'inverno', label: 'Inverno' },
  { id: 'primavera', label: 'Primavera' },
  { id: 'verao', label: 'Verão' },
  { id: 'outono', label: 'Outono' },
];

/** A estação de um instante, no fuso do aparelho. */
export function seasonOf(startAt: string): Season {
  const m = new Date(startAt).getMonth() + 1;
  if (m === 12 || m <= 2) return 'inverno';
  if (m <= 5) return 'primavera';
  if (m <= 8) return 'verao';
  return 'outono';
}

export interface SeasonBucket {
  season: Season;
  label: string;
  mix: SurfaceMix;
  shares: Record<SurfaceCategory, number>;
  /** Pedaladas com piso nesta barra — é a honestidade dela. */
  rides: number;
  offroadShare: number;
}

/**
 * O piso por estação, na ordem do ano.
 *
 * Devolve **só as estações que a janela contém**, e é isso que decide a forma
 * do cartão. Medido: 4 semanas contêm 1 estação, 12 semanas contêm 1, o ano
 * contém 4. Com uma só, quem chama desenha a barra única de sempre; com duas ou
 * mais, as colunas. Nenhum chip novo e nenhuma altura nova — o miolo do cartão
 * responde ao que a janela tem dentro.
 */
export function surfaceBySeason(
  activities: readonly Activity[],
  w: SurfaceWindow,
): SeasonBucket[] {
  const withMix = activities
    .filter((a) => inSurfaceWindow(a, w))
    .filter((a) => a.surfaceMix && a.surfaceMix.total > 0);

  const out: SeasonBucket[] = [];
  for (const s of SEASONS) {
    const mine = withMix.filter((a) => seasonOf(a.startAt) === s.id);
    if (mine.length === 0) continue;
    const mix = sumSurfaceMix(mine.map((a) => a.surfaceMix));
    const shares = surfaceShares(mix);
    out.push({
      season: s.id,
      label: s.label,
      mix,
      shares,
      rides: mine.length,
      offroadShare: shares.cascalho + shares.terra,
    });
  }
  return out;
}

/**
 * A frase que o VoiceOver lê numa coluna — a alternativa acessível ao gráfico.
 * Não há tabela na tela: quem precisa, ouve.
 */
export function seasonAccessibilityLabel(b: SeasonBucket): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const rides = b.rides === 1 ? '1 pedalada' : `${b.rides} pedaladas`;
  return (
    `${b.label}, ${rides}. ${pct(b.shares.liso)} asfalto, ` +
    `${pct(b.shares.blocos + b.shares.pave)} blocos e pavé, ` +
    `${pct(b.shares.cascalho)} cascalho, ${pct(b.shares.terra)} terra.`
  );
}
