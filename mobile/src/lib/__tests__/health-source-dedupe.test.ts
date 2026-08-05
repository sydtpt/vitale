import { describe, it, expect } from '@jest/globals';
import { dedupeBySource, bucketize } from '../health-format';
import type { Sample } from '../health-format';

const sample = (source: string, start: string, value: number): Sample => ({
  value,
  start,
  end: start,
  source,
});

const total = (samples: Sample[]) => samples.reduce((a, s) => a + s.value, 0);

describe('dedupeBySource', () => {
  it('fica com a fonte de maior total em vez de somar (o bug da dupla contagem)', () => {
    // iPhone e Garmin contam o MESMO dia: soma ingênua = 14.500; correto ≈ 9.000.
    const out = dedupeBySource([
      sample('com.apple.health', '2026-08-04T09:00:00', 4000),
      sample('com.apple.health', '2026-08-04T18:00:00', 5000),
      sample('com.garmin.connect', '2026-08-04T09:00:00', 2500),
      sample('com.garmin.connect', '2026-08-04T18:00:00', 3000),
    ]);
    expect(total(out)).toBe(9000);
    expect(out.every((s) => s.source === 'com.apple.health')).toBe(true);
  });

  it('decide fonte por dia — o vencedor de ontem não manda no de hoje', () => {
    const out = dedupeBySource([
      sample('iphone', '2026-08-03T10:00:00', 8000),
      sample('garmin', '2026-08-03T10:00:00', 3000),
      sample('iphone', '2026-08-04T10:00:00', 2000),
      sample('garmin', '2026-08-04T10:00:00', 9000),
    ]);
    expect(total(out)).toBe(17000);
    expect(out.map((s) => s.source)).toEqual(['iphone', 'garmin']);
  });

  it('não mexe em dia de fonte única', () => {
    const only = [sample('iphone', '2026-08-04T10:00:00', 1200)];
    expect(dedupeBySource(only)).toEqual(only);
  });

  it('preserva as amostras cruas — os buckets por hora continuam válidos', () => {
    const out = dedupeBySource([
      sample('iphone', '2026-08-04T09:30:00', 4000),
      sample('iphone', '2026-08-04T18:15:00', 5000),
      sample('garmin', '2026-08-04T09:30:00', 1000),
    ]);
    const buckets = bucketize(out, 'day', 'cumulative', new Date('2026-08-04T23:00:00'));
    expect(buckets[9].value).toBe(4000);
    expect(buckets[18].value).toBe(5000);
    expect(buckets[12].empty).toBe(true);
  });

  it('trata amostras sem fonte como um grupo só (não descarta nada)', () => {
    const out = dedupeBySource([
      { value: 300, start: '2026-08-04T08:00:00', end: '2026-08-04T08:00:00' },
      { value: 700, start: '2026-08-04T20:00:00', end: '2026-08-04T20:00:00' },
    ]);
    expect(total(out)).toBe(1000);
  });

  it('devolve lista vazia para entrada vazia', () => {
    expect(dedupeBySource([])).toEqual([]);
  });
});
