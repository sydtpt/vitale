import { describe, it, expect } from '@jest/globals';
import { computeReadiness, rollingBaseline, type HealthDaily } from '@vitale/shared';
import { buildReadinessInput, latestAndBaselineFromRows, readinessFromSummaries } from '../health-readiness';
import type { Sample } from '../health-buckets';

describe('rollingBaseline', () => {
  it('média das últimas N leituras válidas, ignorando nulos', () => {
    expect(rollingBaseline([60, null, 62, undefined, 64], 7)).toBeCloseTo(62);
  });

  it('respeita a janela', () => {
    expect(rollingBaseline([10, 20, 30, 40], 2)).toBeCloseTo(35);
  });

  it('null quando não há leituras válidas', () => {
    expect(rollingBaseline([null, undefined])).toBeNull();
  });
});

describe('computeReadiness', () => {
  it('sono perfeito + FC/VFC na baseline + anéis cheios ≈ alto', () => {
    const r = computeReadiness({
      sleepHours: 8,
      restingHr: 55,
      restingHrBaseline: 55,
      hrv: 60,
      hrvBaseline: 60,
      ringsPct: [1, 1, 1],
    });
    // sono 100*.3 + fc 100*.25 + vfc 50*.25 + anéis 100*.2 = 87.5 → 88
    expect(r.total).toBe(88);
    expect(r.components).toHaveLength(4);
  });

  it('FC acima da baseline derruba o componente', () => {
    const r = computeReadiness({ restingHr: 65, restingHrBaseline: 55 });
    const fc = r.components.find((c) => c.key === 'fcRepouso');
    expect(fc?.score).toBe(60); // 100 - 10*4
    expect(r.total).toBe(60); // único componente presente
  });

  it('renormaliza pesos com componentes ausentes', () => {
    const r = computeReadiness({ sleepHours: 4 }); // só sono (50)
    expect(r.components).toHaveLength(1);
    expect(r.total).toBe(50);
  });

  it('sem entradas → total 0 e sem componentes', () => {
    const r = computeReadiness({});
    expect(r.total).toBe(0);
    expect(r.components).toHaveLength(0);
  });

  it('anéis acima de 100% são limitados', () => {
    const r = computeReadiness({ ringsPct: [1.5, 1, 0.5] });
    const a = r.components.find((c) => c.key === 'aneis');
    expect(a?.score).toBeCloseTo((100 + 100 + 50) / 3);
  });
});

/* ───────────── Fallback da VFC para `health_daily` (ADR 0026) ───────────── */

// Sexta-feira 04/09/2026, 10:00 local.
const NOW = new Date(2026, 8, 4, 10, 0, 0);

/** 'YYYY-MM-DD' local de `n` dias atrás. */
function dayAgo(n: number): string {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Amostra do HealthKit às 07:00 locais de `n` dias atrás. */
function hkSample(n: number, value: number): Sample {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n, 7, 0, 0);
  return { value, start: d.toISOString(), end: d.toISOString() };
}

/** Linha `'vfc'` de `health_daily` gravada pela ponte do intervals.icu. */
function vfcRow(n: number, value: number | null, source = 'intervals', kind = 'rmssd'): HealthDaily {
  return {
    userId: 'u1',
    day: dayAgo(n),
    metric: 'vfc',
    value,
    count: 1,
    extra: { source, kind },
  };
}

/** Linha do Apple Health: SDNN, e sem `extra` — o sync do mobile não escreve um. */
function appleRow(n: number, value: number): HealthDaily {
  return { userId: 'u1', day: dayAgo(n), metric: 'vfc', value, count: 1 };
}

describe('latestAndBaselineFromRows', () => {
  it('último valor + baseline móvel de 7 excluindo o dia corrente', () => {
    const rows = [8, 7, 6, 5, 4, 3, 2, 1, 0].map((n) => vfcRow(n, 40 + n));
    const r = latestAndBaselineFromRows(rows);
    expect(r.latest).toBe(40);
    // 7 anteriores: 41..47
    expect(r.baseline).toBeCloseTo((41 + 42 + 43 + 44 + 45 + 46 + 47) / 7);
  });

  it('ordena por dia e ignora valor nulo', () => {
    const r = latestAndBaselineFromRows([vfcRow(0, 50), vfcRow(2, 60), vfcRow(1, null)]);
    expect(r.latest).toBe(50);
    expect(r.baseline).toBe(60);
  });

  it('uma linha só não vira baseline — o componente fica de fora', () => {
    // Com `baseline = latest` o componente marcaria exatamente 50 com peso
    // cheio e `coverage` iria a 1, que é o número que existe para avisar que
    // falta informação. Na primeira noite a resposta honesta é não pontuar.
    expect(latestAndBaselineFromRows([vfcRow(0, 55)])).toEqual({ latest: 55, baseline: null });
    expect(latestAndBaselineFromRows([])).toEqual({ latest: null, baseline: null });
  });

  it('a baseline só usa leituras do mesmo tipo de medida', () => {
    // O Apple grava SDNN e o Garmin RMSSD, em escalas diferentes: misturar
    // faria a prontidão ler a troca de unidade como queda fisiológica.
    const misto = latestAndBaselineFromRows([
      appleRow(3, 90),
      appleRow(2, 92),
      vfcRow(1, 45),
      vfcRow(0, 44),
    ]);
    expect(misto.latest).toBe(44);
    expect(misto.baseline).toBe(45);

    // Uma noite RMSSD depois de uma semana de SDNN: sem par do mesmo tipo, sem baseline.
    const virada = latestAndBaselineFromRows([appleRow(2, 90), appleRow(1, 92), vfcRow(0, 45)]);
    expect(virada).toEqual({ latest: 45, baseline: null });
  });

  it('filtra por métrica: a lista inteira da store não vira baseline de VFC', () => {
    const passos: HealthDaily = { userId: 'u1', day: dayAgo(1), metric: 'passos', value: 9000 };
    const r = latestAndBaselineFromRows([passos, vfcRow(1, 46), vfcRow(0, 44)], 'vfc');
    expect(r.latest).toBe(44);
    expect(r.baseline).toBe(46);
  });
});

describe('buildReadinessInput — fallback da VFC', () => {
  it('HealthKit sem VFC e tabela com linhas: componente VFC presente, coverage sobe', () => {
    const summaries = { sono: [hkSample(0, 7.5)], fcRepouso: [hkSample(1, 55), hkSample(0, 56)] };
    const rows = [3, 2, 1, 0].map((n) => vfcRow(n, 50 + n));

    const sem = readinessFromSummaries(summaries, undefined, NOW);
    expect(sem.missing).toContain('vfc');

    const com = readinessFromSummaries(summaries, { vfc: rows }, NOW);
    const input = buildReadinessInput(summaries, { vfc: rows }, NOW);
    expect(input.hrv).toBe(50);
    expect(input.hrvBaseline).toBeCloseTo((51 + 52 + 53) / 3);
    expect(com.components.map((c) => c.key)).toContain('vfc');
    expect(com.missing).not.toContain('vfc');
    expect(com.coverage).toBeGreaterThan(sem.coverage);
  });

  it('HealthKit com VFC: vence, e o fallback é ignorado', () => {
    const summaries = { vfc: [hkSample(1, 60), hkSample(0, 62)] };
    const input = buildReadinessInput(summaries, { vfc: [vfcRow(0, 45), vfcRow(1, 44)] }, NOW);
    expect(input.hrv).toBe(62);
    expect(input.hrvBaseline).toBe(60);
  });

  it('nada em lugar nenhum: componente ausente, como hoje', () => {
    const input = buildReadinessInput({}, { vfc: [] }, NOW);
    expect(input.hrv).toBeNull();
    expect(readinessFromSummaries({}, { vfc: [] }, NOW).components).toHaveLength(0);
    expect(buildReadinessInput({}, undefined, NOW).hrv).toBeNull();
  });

  it('só a janela de 7 dias conta: linha velha não vira "VFC de hoje"', () => {
    const velha = buildReadinessInput({}, { vfc: [vfcRow(7, 48), vfcRow(30, 52)] }, NOW);
    expect(velha.hrv).toBeNull();

    const beirada = buildReadinessInput({}, { vfc: [vfcRow(6, 48)] }, NOW);
    expect(beirada.hrv).toBe(48);
  });

  it('a fonte não decide nada — o que casa é o tipo da medida', () => {
    const mesmoKind = buildReadinessInput(
      {},
      { vfc: [vfcRow(1, 58, 'apple'), vfcRow(0, 57, 'intervals')] },
      NOW,
    );
    expect(mesmoKind.hrv).toBe(57);
    expect(mesmoKind.hrvBaseline).toBe(58);
  });

  it('linha datada no futuro não vira "VFC de hoje"', () => {
    // O ingest busca até amanhã por causa do fuso do atleta; se uma linha assim
    // escapar, ela não pode passar à frente da leitura de hoje.
    const input = buildReadinessInput({}, { vfc: [vfcRow(1, 46), vfcRow(0, 44), vfcRow(-1, 70)] }, NOW);
    expect(input.hrv).toBe(44);
    expect(input.hrvBaseline).toBe(46);
  });

  it('a lista inteira da store não contamina a VFC', () => {
    const passos: HealthDaily = { userId: 'u1', day: dayAgo(0), metric: 'passos', value: 9000 };
    const input = buildReadinessInput({}, { vfc: [passos, vfcRow(1, 46), vfcRow(0, 44)] }, NOW);
    expect(input.hrv).toBe(44);
    expect(input.hrvBaseline).toBe(46);
  });
});
