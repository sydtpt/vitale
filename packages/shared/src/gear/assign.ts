/**
 * De qual bicicleta foi esta pedalada — a regra, num lugar só (ADR 0033).
 *
 * Duas fontes, nesta ordem:
 *  1. `activity.gearId` — override explícito (usuário ou provider). Se apontar
 *     para um gear que não veio na lista, a resposta é "não sei", não a herança:
 *     alguém afirmou uma bike específica e ela não está aqui.
 *  2. Herança pela data: o gear cujo `activityTypes` inclui o tipo da atividade
 *     e cuja janela [activeFrom, activeTo] contém o DIA LOCAL do início.
 *
 * Janelas sobrepostas são erro de cadastro, mas não podem derrubar a tela: vence
 * a de `activeFrom` mais recente, porque "comecei a usar a nova" é a afirmação
 * mais recente do usuário.
 *
 * O dia é o LOCAL do aparelho, não o UTC: uma pedalada às 23h30 de 29/05 em
 * Bruxelas é 21h30 UTC — o mesmo dia — mas o caso inverso (00h30 local = dia
 * anterior em UTC) existe, e a fronteira entre bikes é declarada em dias locais.
 */
import type { Activity, Gear, GearStyle } from '../models';

/** Os estilos, na ordem em que a tela os oferece, com o rótulo que ela mostra. */
export const GEAR_STYLES: readonly { id: GearStyle; label: string }[] = [
  { id: 'gravel', label: 'Gravel' },
  { id: 'road', label: 'Estrada' },
  { id: 'mtb', label: 'MTB' },
  { id: 'city', label: 'Urbana' },
  { id: 'other', label: 'Outra' },
];

export function gearStyleLabel(style?: GearStyle): string | undefined {
  return GEAR_STYLES.find((s) => s.id === style)?.label;
}

/** 'YYYY-MM-DD' do instante no fuso do aparelho. */
export function activityLocalDate(startAt: string): string {
  const d = new Date(startAt);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

/** A janela do gear contém este dia? `activeTo` nulo = ainda em uso. */
export function gearWindowContains(gear: Pick<Gear, 'activeFrom' | 'activeTo'>, ymd: string): boolean {
  return gear.activeFrom <= ymd && (gear.activeTo == null || ymd <= gear.activeTo);
}

type ActivityRef = Pick<Activity, 'activityId' | 'startAt' | 'gearId'>;

export function gearForActivity(gears: readonly Gear[], activity: ActivityRef): Gear | undefined {
  if (activity.gearId) return gears.find((g) => g.id === activity.gearId);
  const day = activityLocalDate(activity.startAt);
  let best: Gear | undefined;
  for (const g of gears) {
    if (!g.activityTypes.includes(activity.activityId)) continue;
    if (!gearWindowContains(g, day)) continue;
    if (!best || g.activeFrom > best.activeFrom) best = g;
  }
  return best;
}

/** Uma bicicleta "em uso" é a que tem a janela aberta. É isso que a tela chama de padrão. */
export function isGearOpen(gear: Pick<Gear, 'activeTo'>): boolean {
  return gear.activeTo == null;
}

/** 'YYYY-MM-DD' do dia anterior — fecha a janela da bike que sai sem deixar vão nem sobreposição. */
export function dayBefore(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export interface GearWindowChange {
  id: string;
  /** Presente quando a janela precisa reabrir (bike aposentada que volta a ser padrão). */
  activeFrom?: string;
  activeTo: string | null;
}

/**
 * O que muda quando uma bicicleta vira a padrão a partir de `from`.
 *
 * "Padrão" é o nome de tela para **a janela aberta** — não há um campo separado,
 * e é de propósito: dois lugares dizendo qual bicicleta está em uso é um lugar
 * a mais para discordarem. Quem é padrão é quem não tem data de fim.
 *
 * A escolhida abre (e reabre, se estava aposentada); toda outra que estivesse
 * aberta fecha no dia anterior a `from` — sem vão e sem sobreposição, que é o
 * que mantém a herança por data sem ambiguidade.
 *
 * Uma bicicleta cuja janela **começa depois** de `from` não é fechada: fechá-la
 * criaria uma janela invertida (fim antes do início). Esse caso vira uma
 * sobreposição legítima, resolvida pelo `activeFrom` mais recente e, no limite,
 * pela exceção por pedalada.
 */
export function planDefaultGear(
  gears: readonly Gear[],
  id: string,
  from: string,
): GearWindowChange[] {
  const changes: GearWindowChange[] = [];
  const target = gears.find((g) => g.id === id);
  if (!target) return changes;
  if (target.activeTo !== null) changes.push({ id: target.id, activeTo: null });

  const close = dayBefore(from);
  for (const g of gears) {
    if (g.id === id || !isGearOpen(g)) continue;
    // Fechar antes de a bike ter começado inverteria a janela.
    if (close < g.activeFrom) continue;
    changes.push({ id: g.id, activeTo: close });
  }
  return changes;
}

export interface GearUsage {
  gear: Gear;
  /** Atividades atribuídas a este gear (override ou herança). */
  count: number;
  distanceM: number;
  /** ISO do início da primeira e da última atividade; ausentes quando `count` é 0. */
  firstAt?: string;
  lastAt?: string;
}

/**
 * Quanto cada gear rodou. Recebe as atividades que a tela considera (quem chama
 * já tirou as ocultas). Gear sem atividade sai com `count` 0 — a tela decide se
 * mostra.
 */
export function gearUsage(gears: readonly Gear[], activities: readonly Activity[]): GearUsage[] {
  const acc = new Map<string, GearUsage>();
  for (const g of gears) acc.set(g.id, { gear: g, count: 0, distanceM: 0 });
  for (const a of activities) {
    const g = gearForActivity(gears, a);
    if (!g) continue;
    const u = acc.get(g.id)!;
    u.count += 1;
    u.distanceM += a.distanceM ?? 0;
    if (!u.firstAt || a.startAt < u.firstAt) u.firstAt = a.startAt;
    if (!u.lastAt || a.startAt > u.lastAt) u.lastAt = a.startAt;
  }
  return [...acc.values()];
}
