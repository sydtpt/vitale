/**
 * De qual bicicleta foi esta pedalada — a regra, num lugar só (ADR 0034).
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
import type { Activity, Gear } from '../models';

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
