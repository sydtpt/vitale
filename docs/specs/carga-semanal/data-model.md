# Data-model: Carga Semanal

> Derivação **pura**, sem persistência nova. Entrada = `Activity[]` (já em memória no `ActivitiesStore`). Saída = view-models para o card.

## Sem migration

Nada novo no Supabase nem no `@vitale/shared`. A feature consome:
- [`Activity.hrZones`](../../../packages/shared/src/models/index.ts#L201-L206) — `Record<'z1'..'z5', segundos>`, opcional.
- [`Activity.startAt`](../../../packages/shared/src/models/index.ts) — ISO, usado para bucketizar por semana.
- [`HR_ZONES`](../../../packages/shared/src/health/hr-zones.ts) — chave, label e cor de cada zona.

## Tipos derivados (`weekly-load.ts`)

```ts
/** Uma semana da janela móvel, pronta para o StackedBarChartComponent. */
interface WeekLoadBucket {
  key: string;        // 'YYYY-MM-DD' da segunda-feira (estável, ordenável)
  label: string;      // 'dd/mm' da segunda
  total: number;      // soma de segundos em todas as zonas na semana
  segments: { label: string; color: string; value: number }[]; // Z1..Z5, value>0
}

/** Distribuição leve/forte da semana corrente. */
interface Polarization {
  easyS: number;      // Z1 + Z2 (segundos)
  hardS: number;      // Z4 + Z5 (segundos)
  totalS: number;     // todas as zonas
  easyPct: number;    // easyS / totalS * 100 (0 se totalS=0)
}

interface WeeklyLoad {
  buckets: WeekLoadBucket[];   // 8, ordem cronológica (mais antiga → atual)
  polarization: Polarization;  // da última semana (a atual)
  /** true quando Z4+Z5 da semana atual > 1.5× baseline das anteriores (≥2 semanas com dado). */
  highLoadAlert: boolean;
}
```

`WeekLoadBucket` é **estruturalmente compatível** com `OverviewBucket` → entra direto no `StackedBarChartComponent` com `metric="duration"` (formata segundos como horas).

## Regras de cálculo (puras)

- **Semana** = segunda 00:00 local a domingo 23:59 local. `key`/`label` derivam da segunda-feira.
- **Janela** = 8 semanas terminando na semana que contém `now` (default `new Date()`, injetável para teste).
- **Soma por zona** = Σ `activity.hrZones[zKey]` dos treinos cuja `startAt` cai na semana; zonas ausentes contam 0.
- **Polarização** = sobre a semana atual; `easyPct = totalS > 0 ? easyS/totalS*100 : 0`.
- **Alerta** = `baseline = média de (Z4+Z5) das semanas anteriores com total>0`; alerta sse `≥2` semanas válidas no baseline **e** `hardS_atual > 1.5 * baseline`.
