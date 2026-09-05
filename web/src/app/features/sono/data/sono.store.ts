import { Injectable, computed, inject, signal } from '@angular/core';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import {
  awakeSeries,
  fetchDailyRatingsSince,
  fetchSleepPeriodsSince,
  localDateStr,
  type AwakeNight,
  type SleepPeriod,
} from '@vitale/shared';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Janela das **notas**, em dias — a mesma do mobile e da Retrospectiva: abaixo de
 * 90 o `n` por nota do par percepção × medição fica pequeno demais para mostrar.
 * Os **períodos** vêm inteiros, como no mobile: as subviews (12m, ano, e o ◀ que
 * anda um período do próprio tamanho) precisam do histórico todo, e são ~300
 * linhas paginadas — barato.
 */
export const SONO_WINDOW_DAYS = 90;
/** Noites no timing chart — as mesmas 14 do mobile; a web não redesenha, recompõe. */
export const TIMING_NIGHTS = 14;
/** Noites no relógio de vigília e na série de tempo acordado. */
export const AWAKE_NIGHTS = 30;

export interface NotaGroup {
  nota: number;
  n: number;
  min: number;
  max: number;
  mean: number;
}

function windowStart(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return localDateStr(d);
}

/** Os N dias de acordar terminando em `last`, inclusive — com os sem noite. */
export function lastDays(last: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${last}T12:00:00`);
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(localDateStr(x));
  }
  return out;
}

/** "6h52" — horas decimais para o rótulo que o app usa. */
export function hm(hours: number): string {
  const m = Math.round(hours * 60);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

export function dayLabel(day: string, long = false): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: long ? 'long' : 'short',
    day: 'numeric',
    month: long ? 'long' : 'short',
  });
}

/**
 * Fonte única do sono na web. Um fetch dos períodos e um das notas da janela;
 * tudo o mais deriva por computed() — e o que é cálculo de sono vem do núcleo
 * (`@vitale/shared/sleep`), nunca nasce aqui (plan.md: "nenhum cálculo de sono
 * nasce em web/").
 */
@Injectable({ providedIn: 'root' })
export class SonoStore {
  private readonly auth = inject(AuthService);

  private readonly _periods = signal<SleepPeriod[]>([]);
  private readonly _ratings = signal<Record<string, number>>({});
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);

  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loading = computed(() => this._state() === 'loading' || this._state() === 'idle');
  readonly isEmpty = computed(() => this._state() === 'loaded' && this._periods().length === 0);

  /** Períodos da janela, em ordem cronológica. */
  readonly periods = this._periods.asReadonly();
  /** Nota 1–5 dada ao acordar, por dia de acordar. */
  readonly sleepRatings = this._ratings.asReadonly();

  /** A noite mais recente — o topo da tela. */
  readonly last = computed<SleepPeriod | null>(() => this._periods().at(-1) ?? null);
  readonly timingDays = computed(() => {
    const l = this.last();
    return l ? lastDays(l.wakeDay, TIMING_NIGHTS) : [];
  });
  readonly recent = computed(() => this._periods().slice(-AWAKE_NIGHTS));
  readonly awakeSeries = computed<AwakeNight[]>(() => awakeSeries(this.recent()).slice(-TIMING_NIGHTS));
  /** Noites da lista, mais recente primeiro. */
  readonly nights = computed(() => [...this.recent()].reverse());

  /** Por nota, o intervalo e a média das horas dormidas — o par que só o Orbe tem. */
  readonly groups = computed<NotaGroup[]>(() => {
    const by = new Map<number, number[]>();
    const ratings = this._ratings();
    for (const p of this._periods()) {
      const nota = ratings[p.wakeDay];
      if (nota == null) continue;
      const arr = by.get(nota) ?? [];
      arr.push(p.asleepH);
      by.set(nota, arr);
    }
    return [1, 2, 3, 4, 5]
      .filter((n) => by.has(n))
      .map((n) => {
        const hs = by.get(n)!;
        return {
          nota: n,
          n: hs.length,
          min: Math.min(...hs),
          max: Math.max(...hs),
          mean: hs.reduce((a, b) => a + b, 0) / hs.length,
        };
      });
  });
  readonly groupsTotal = computed(() => this.groups().reduce((a, g) => a + g.n, 0));

  /** O período de um dia de acordar; num dia com dois, o que acordou por último. */
  byDay(wakeDay: string): SleepPeriod | undefined {
    return [...this._periods()].reverse().find((p) => p.wakeDay === wakeDay);
  }

  async load(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    this._state.set('loading');
    this._error.set(null);
    try {
      const [periods, ratings] = await Promise.all([
        fetchSleepPeriodsSince(supabase, userId, '2000-01-01'),
        fetchDailyRatingsSince(supabase, userId, windowStart(SONO_WINDOW_DAYS)),
      ]);
      const map: Record<string, number> = {};
      for (const r of ratings) if (r.sleepQuality != null) map[r.day] = r.sleepQuality;
      this._periods.set(periods);
      this._ratings.set(map);
      this._state.set('loaded');
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Erro ao carregar o sono.');
      this._state.set('error');
    }
  }
}
