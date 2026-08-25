import { describe, it, expect } from '@jest/globals';
import { aggregateSleepNights } from '../health-buckets';
import type { Sample } from '../health-buckets';
import { aggregateSleep } from '../health-aggregate';

/** Chaves de `stages` que descrevem a noite sem compor o tempo dormido. */
const NOT_ASLEEP = new Set(['awake', 'inbed', 'onset']);

/** Soma só dos estágios que compõem o total dormido — deve fechar com `value`. */
const asleepStages = (stages: Record<string, number> = {}) =>
  Object.entries(stages)
    .filter(([k]) => !NOT_ASLEEP.has(k))
    .reduce((a, [, v]) => a + v, 0);

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

describe('aggregateSleepNights — detalhamento por estágio', () => {
  it('separa deep/rem/core e a soma fecha com o total da noite', () => {
    const out = aggregateSleepNights([
      sample('CORE', '2026-05-21T23:00:00', '2026-05-22T01:00:00'), // 2h
      sample('DEEP', '2026-05-22T01:00:00', '2026-05-22T02:30:00'), // 1h30
      sample('REM', '2026-05-22T02:30:00', '2026-05-22T05:00:00'), // 2h30
    ]);
    expect(out[0].stages).toBeDefined();
    expect(out[0].stages!.core).toBeCloseTo(2);
    expect(out[0].stages!.deep).toBeCloseTo(1.5);
    expect(out[0].stages!.rem).toBeCloseTo(2.5);
    expect(asleepStages(out[0].stages)).toBeCloseTo(out[0].value);
  });

  it('não conta o mesmo minuto duas vezes quando fontes discordam do estágio', () => {
    // Watch diz DEEP 23:00→01:00; Garmin diz CORE 00:00→02:00. A hora sobreposta
    // (00:00→01:00) só pode pertencer a um: o mais específico (DEEP) leva.
    const out = aggregateSleepNights([
      sample('DEEP', '2026-05-21T23:00:00', '2026-05-22T01:00:00'),
      sample('CORE', '2026-05-22T00:00:00', '2026-05-22T02:00:00'),
    ]);
    expect(out[0].value).toBeCloseTo(3); // união 23:00→02:00
    expect(out[0].stages!.deep).toBeCloseTo(2);
    expect(out[0].stages!.core).toBeCloseTo(1); // só 01:00→02:00
    expect(asleepStages(out[0].stages)).toBeCloseTo(3);
  });

  it('marca como unspecified o sono de fonte sem hipnograma', () => {
    const out = aggregateSleepNights([
      sample('ASLEEP', '2026-05-21T23:00:00', '2026-05-22T05:00:00'),
    ]);
    expect(out[0].stages!.unspecified).toBeCloseTo(6);
    expect(out[0].stages!.deep).toBeUndefined();
    expect(asleepStages(out[0].stages)).toBeCloseTo(out[0].value);
  });

  it('reporta os despertares fora do total dormido', () => {
    const out = aggregateSleepNights([
      sample('ASLEEP', '2026-05-21T23:00:00', '2026-05-22T05:00:00'), // 6h
      sample('AWAKE', '2026-05-22T02:00:00', '2026-05-22T02:30:00'), // 30min
    ]);
    expect(out[0].value).toBeCloseTo(5.5);
    expect(out[0].stages!.awake).toBeCloseTo(0.5);
    // `awake` não entra na soma do que foi dormido.
    expect(asleepStages(out[0].stages)).toBeCloseTo(5.5);
  });

  it('não credita a nenhum estágio o tempo em que se estava acordado', () => {
    // REM cobre 02:00→05:00, mas 30min dentro dela são AWAKE.
    const out = aggregateSleepNights([
      sample('CORE', '2026-05-21T23:10:00', '2026-05-22T02:00:00'),
      sample('REM', '2026-05-22T02:00:00', '2026-05-22T05:00:00'),
      sample('AWAKE', '2026-05-22T03:00:00', '2026-05-22T03:30:00'),
    ]);
    expect(out[0].stages!.rem).toBeCloseTo(2.5); // 3h − 30min acordado
    expect(asleepStages(out[0].stages)).toBeCloseTo(out[0].value);
  });
});

describe('aggregateSleepNights — tempo na cama e latência (insônia de início)', () => {
  it('mede quanto tempo levou para pegar no sono', () => {
    // Deitou 22:30, apagou 01:00 → 2h30 rolando na cama, 4h dormidas.
    const out = aggregateSleepNights([
      sample('INBED', '2026-05-21T22:30:00', '2026-05-22T05:00:00'),
      sample('CORE', '2026-05-22T01:00:00', '2026-05-22T05:00:00'),
    ]);
    expect(out[0].value).toBeCloseTo(4);
    expect(out[0].stages!.onset).toBeCloseTo(2.5);
    expect(out[0].stages!.inbed).toBeCloseTo(6.5);
  });

  it('distingue noite curta por insônia de noite curta por deitar tarde', () => {
    // Mesmas 4h dormidas do teste acima, mas deitou 01:00 e apagou na hora.
    const out = aggregateSleepNights([
      sample('INBED', '2026-05-22T01:00:00', '2026-05-22T05:00:00'),
      sample('CORE', '2026-05-22T01:00:00', '2026-05-22T05:00:00'),
    ]);
    expect(out[0].value).toBeCloseTo(4); // total idêntico…
    expect(out[0].stages!.onset).toBeUndefined(); // …mas sem latência nenhuma
  });

  it('ancora no INBED que cobre o adormecer, ignorando o de outra noite', () => {
    const out = aggregateSleepNights([
      sample('INBED', '2026-05-20T22:00:00', '2026-05-21T06:00:00'), // noite anterior
      sample('INBED', '2026-05-21T23:00:00', '2026-05-22T05:00:00'),
      sample('CORE', '2026-05-21T23:40:00', '2026-05-22T05:00:00'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].stages!.onset).toBeCloseTo(40 / 60);
  });

  it('aceita a fonte que encerra o INBED no instante em que se apaga', () => {
    const out = aggregateSleepNights([
      sample('INBED', '2026-05-21T23:00:00', '2026-05-21T23:45:00'),
      sample('CORE', '2026-05-21T23:45:00', '2026-05-22T05:00:00'),
    ]);
    expect(out[0].stages!.onset).toBeCloseTo(0.75);
  });

  it('não grava latência quando a fonte não separa cama de sono (Garmin: INBED 1s antes)', () => {
    // Assinatura real do Garmin, medida em 19/19 noites de ago/2026: o INBED abre
    // 1 segundo antes do sono. Não é medida, é constante — gravar 0 se disfarçaria
    // de "apagou na hora".
    const out = aggregateSleepNights([
      sample('INBED', '2026-05-21T22:59:59', '2026-05-22T05:00:00'),
      sample('CORE', '2026-05-21T23:00:00', '2026-05-22T05:00:00'),
    ]);
    expect(out[0].stages!.onset).toBeUndefined();
    // `inbed` presente + `onset` ausente = a fonte não separa. Estado distinto
    // de não haver dado de cama nenhum (aí os dois somem).
    expect(out[0].stages!.inbed).toBeDefined();
  });

  it('aceita a latência a partir de 1 minuto', () => {
    const out = aggregateSleepNights([
      sample('INBED', '2026-05-21T22:59:00', '2026-05-22T05:00:00'),
      sample('CORE', '2026-05-21T23:00:00', '2026-05-22T05:00:00'),
    ]);
    expect(out[0].stages!.onset).toBeCloseTo(1 / 60);
  });

  it('preserva a menor latência real já vista no histórico (90s do Apple Watch)', () => {
    const out = aggregateSleepNights([
      sample('INBED', '2026-05-21T22:58:30', '2026-05-22T05:00:00'),
      sample('CORE', '2026-05-21T23:00:00', '2026-05-22T05:00:00'),
    ]);
    expect(out[0].stages!.onset).toBeCloseTo(1.5 / 60);
  });

  it('não inventa latência quando a fonte não grava INBED', () => {
    const out = aggregateSleepNights([
      sample('CORE', '2026-05-21T23:00:00', '2026-05-22T05:00:00'),
    ]);
    expect(out[0].stages!.onset).toBeUndefined();
    expect(out[0].stages!.inbed).toBeUndefined();
  });

  it('mantém a latência fora do total dormido', () => {
    const out = aggregateSleepNights([
      sample('INBED', '2026-05-21T22:00:00', '2026-05-22T05:00:00'),
      sample('CORE', '2026-05-21T23:00:00', '2026-05-22T05:00:00'),
    ]);
    expect(asleepStages(out[0].stages)).toBeCloseTo(out[0].value);
  });
});

describe('aggregateSleep → linha de health_daily', () => {
  it('leva o detalhamento por estágio para o extra', () => {
    const nights = aggregateSleepNights([
      sample('CORE', '2026-05-21T23:00:00', '2026-05-22T01:00:00'),
      sample('DEEP', '2026-05-22T01:00:00', '2026-05-22T05:00:00'),
    ]);
    const rows = aggregateSleep(nights, 'u1');
    expect(rows).toHaveLength(1);
    expect(rows[0].metric).toBe('sono');
    expect(rows[0].value).toBeCloseTo(6);
    expect(rows[0].extra).toEqual(
      expect.objectContaining({ core: expect.any(Number), deep: expect.any(Number) }),
    );
  });

  it('deixa o extra nulo quando não houve estágio nenhum', () => {
    const rows = aggregateSleep(
      [{ value: 6, start: '2026-05-22T05:00:00', end: '2026-05-22T05:00:00', label: 'ASLEEP' }],
      'u1',
    );
    expect(rows[0].extra).toBeNull();
  });
});
