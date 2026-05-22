import { describe, it, expect } from '@jest/globals';
import { aggregateSleepNights } from '../health-format';
import type { Sample } from '../health-format';

const sample = (label: string, start: string, end: string): Sample => ({
  value: 0,
  start,
  end,
  label,
});

describe('aggregateSleepNights', () => {
  it('une fontes sobrepostas em vez de somar (o bug do ~2×)', () => {
    // Watch (CORE+DEEP) e iPhone (ASLEEP genérico) cobrem o MESMO período: 23:00→05:00.
    // Soma ingênua = 6 + 3 + 3 = 12h; união = 6h.
    const out = aggregateSleepNights([
      sample('ASLEEP', '2026-05-21T23:00:00', '2026-05-22T05:00:00'),
      sample('CORE', '2026-05-21T23:00:00', '2026-05-22T02:00:00'),
      sample('DEEP', '2026-05-22T02:00:00', '2026-05-22T05:00:00'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBeCloseTo(6);
  });

  it('subtrai os trechos acordado', () => {
    const out = aggregateSleepNights([
      sample('ASLEEP', '2026-05-21T23:00:00', '2026-05-22T05:00:00'), // 6h
      sample('AWAKE', '2026-05-22T02:00:00', '2026-05-22T02:30:00'), // -30min
    ]);
    expect(out[0].value).toBeCloseTo(5.5);
  });

  it('ignora "na cama" (INBED)', () => {
    const out = aggregateSleepNights([
      sample('INBED', '2026-05-21T22:30:00', '2026-05-22T06:00:00'),
      sample('CORE', '2026-05-21T23:00:00', '2026-05-22T05:00:00'), // 6h
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBeCloseTo(6);
  });

  it('atribui a noite ao dia em que se acordou', () => {
    const out = aggregateSleepNights([
      sample('CORE', '2026-05-21T23:00:00', '2026-05-22T05:00:00'),
    ]);
    const wake = new Date(out[0].start);
    expect(wake.getDate()).toBe(22); // acordou dia 22, não 21
  });

  it('prioriza estágios detalhados: descarta o ASLEEP genérico mais largo do iPhone', () => {
    // Watch mede 23:10→05:00 (5h50) com 30min acordado → 5h20.
    // iPhone grava um ASLEEP grosseiro 22:50→05:30 (6h40) sobrepondo tudo → descartado.
    const out = aggregateSleepNights([
      sample('ASLEEP', '2026-05-21T22:50:00', '2026-05-22T05:30:00'),
      sample('CORE', '2026-05-21T23:10:00', '2026-05-22T02:00:00'),
      sample('REM', '2026-05-22T02:00:00', '2026-05-22T05:00:00'),
      sample('AWAKE', '2026-05-22T03:00:00', '2026-05-22T03:30:00'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBeCloseTo(5 + 20 / 60); // 5h20, não as ~6h40 do bloco grosseiro
  });

  it('usa o ASLEEP genérico quando não há estágios detalhados (aparelho antigo)', () => {
    const out = aggregateSleepNights([
      sample('ASLEEP', '2026-05-21T23:00:00', '2026-05-22T05:00:00'),
    ]);
    expect(out[0].value).toBeCloseTo(6);
  });

  it('mantém o genérico de uma sessão que o relógio não cobriu (sem sobreposição)', () => {
    // Soneca da tarde só no iPhone, separada da noite medida pelo Watch.
    const out = aggregateSleepNights([
      sample('CORE', '2026-05-21T23:00:00', '2026-05-22T05:00:00'), // noite (Watch) → 6h
      sample('ASLEEP', '2026-05-22T14:00:00', '2026-05-22T15:00:00'), // soneca (iPhone) → 1h
    ]);
    expect(out).toHaveLength(1); // mesma data de despertar (22)
    expect(out[0].value).toBeCloseTo(7);
  });

  it('separa noites distintas', () => {
    const out = aggregateSleepNights([
      sample('CORE', '2026-05-20T23:00:00', '2026-05-21T05:00:00'),
      sample('CORE', '2026-05-21T23:00:00', '2026-05-22T05:00:00'),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].value).toBeCloseTo(6);
    expect(out[1].value).toBeCloseTo(6);
  });
});
