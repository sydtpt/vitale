import { triggerImpact, MIN_DAYS_PER_SIDE } from './trigger-impact';

function days(map: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(map));
}

describe('triggerImpact', () => {
  it('calcula diferença de médias com × sem o gatilho', () => {
    const values = days({
      '2026-06-01': 60, '2026-06-02': 60, '2026-06-03': 60, // sem evento
      '2026-06-04': 66, '2026-06-05': 66, '2026-06-06': 66, // com evento
    });
    const events = new Set(['2026-06-04', '2026-06-05', '2026-06-06']);
    const r = triggerImpact('fcRepouso', events, values);
    expect(r.enough).toBe(true);
    expect(r.withMean).toBe(66);
    expect(r.withoutMean).toBe(60);
    expect(r.delta).toBe(6);
    expect(r.deltaPct).toBeCloseTo(10, 5);
    expect(r.nWith).toBe(3);
    expect(r.nWithout).toBe(3);
  });

  it('marca enough=false e zera médias quando falta amostra de um lado', () => {
    const values = days({ '2026-06-01': 60, '2026-06-02': 60, '2026-06-03': 60, '2026-06-04': 66 });
    const events = new Set(['2026-06-04']); // só 1 dia com evento (< MIN)
    const r = triggerImpact('fcRepouso', events, values);
    expect(MIN_DAYS_PER_SIDE).toBe(3);
    expect(r.enough).toBe(false);
    expect(r.withMean).toBeNull();
    expect(r.delta).toBeNull();
    expect(r.nWith).toBe(1);
    expect(r.nWithout).toBe(3);
  });

  it('respeita sinceDate: ignora dias anteriores à idade do gatilho', () => {
    const values = days({
      '2026-05-01': 50, '2026-05-02': 50, '2026-05-03': 50, // antes do sinceDate → ignorados
      '2026-06-01': 60, '2026-06-02': 60, '2026-06-03': 60,
      '2026-06-04': 66, '2026-06-05': 66, '2026-06-06': 66,
    });
    const events = new Set(['2026-06-04', '2026-06-05', '2026-06-06']);
    const r = triggerImpact('fcRepouso', events, values, '2026-06-01');
    expect(r.nWithout).toBe(3); // só junho conta, não os 50s de maio
    expect(r.withoutMean).toBe(60);
  });

  it('deltaPct é null quando a base (sem evento) é 0', () => {
    const values = days({
      '2026-06-01': 0, '2026-06-02': 0, '2026-06-03': 0,
      '2026-06-04': 5, '2026-06-05': 5, '2026-06-06': 5,
    });
    const events = new Set(['2026-06-04', '2026-06-05', '2026-06-06']);
    const r = triggerImpact('vfc', events, values);
    expect(r.delta).toBe(5);
    expect(r.deltaPct).toBeNull();
  });
});
