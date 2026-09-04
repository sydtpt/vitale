import { describe, it, expect } from '@jest/globals';
import { diagnoseSleepNights, marcarNoitesVazias } from '../sleep-diagnostics';
import type { Sample } from '../health-buckets';

/** Amostra de sono: rótulo + janela local. `d` é o dia em que ACORDA. */
function s(label: string, d: number, hIni: number, hFim: number): Sample {
  const noite = new Date(2026, 7, d - 1, hIni, 0, 0);   // deitou no dia anterior
  const manha = new Date(2026, 7, d, hFim, 0, 0);
  return { value: 0, start: noite.toISOString(), end: manha.toISOString(), label };
}
/** Trecho dentro da mesma madrugada (não atravessa a meia-noite duas vezes). */
function trecho(label: string, d: number, hIni: number, hFim: number): Sample {
  return {
    value: 0,
    start: new Date(2026, 7, d, hIni, 0, 0).toISOString(),
    end: new Date(2026, 7, d, hFim, 0, 0).toISOString(),
    label,
  };
}

describe('diagnoseSleepNights', () => {
  it('noite normal com estágio detalhado vira ok, com as horas', () => {
    const d = diagnoseSleepNights([s('INBED', 10, 23, 7), s('CORE', 10, 23, 7)]);
    expect(d.nights).toHaveLength(1);
    expect(d.nights[0].verdict).toBe('ok');
    expect(d.nights[0].hours).toBeCloseTo(8, 1);
    expect(d.ok).toBe(1);
    expect(d.perdidas).toBe(0);
  });

  it('SÓ INBED é a noite que some calada — a hipótese das 54 noites perdidas', () => {
    const d = diagnoseSleepNights([s('INBED', 10, 23, 7)]);
    expect(d.nights[0].verdict).toBe('sem-estagio');
    expect(d.nights[0].samples).toBe(1);
    expect(d.nights[0].labels).toEqual({ INBED: 1 });
    expect(d.nights[0].hours).toBeNull();
    expect(d.perdidas).toBe(1);
  });

  it('INBED + AWAKE, sem nada dormindo, também é perda nossa', () => {
    const d = diagnoseSleepNights([s('INBED', 10, 23, 7), trecho('AWAKE', 10, 2, 3)]);
    expect(d.nights[0].verdict).toBe('sem-estagio');
    expect(Object.keys(d.nights[0].labels).sort()).toEqual(['AWAKE', 'INBED']);
  });

  it('sono inteiramente coberto por AWAKE cai como anulada, não como ok', () => {
    const d = diagnoseSleepNights([trecho('ASLEEP', 10, 2, 4), trecho('AWAKE', 10, 2, 4)]);
    expect(d.nights[0].verdict).toBe('anulada');
    expect(d.perdidas).toBe(1);
  });

  it('agrupa pelo dia em que ACORDOU, igual ao agregador', () => {
    // Deita 23h do dia 9, acorda 7h do dia 10 → a noite é do dia 10.
    const d = diagnoseSleepNights([s('ASLEEP', 10, 23, 7)]);
    expect(d.nights[0].day).toBe('2026-08-10');
  });

  it('lista a mais recente primeiro', () => {
    const d = diagnoseSleepNights([s('ASLEEP', 10, 23, 7), s('ASLEEP', 12, 23, 7)]);
    expect(d.nights.map((n) => n.day)).toEqual(['2026-08-12', '2026-08-10']);
  });

  it('sem amostra nenhuma não inventa noite', () => {
    const d = diagnoseSleepNights([]);
    expect(d.nights).toEqual([]);
    expect(d.perdidas).toBe(0);
  });
});

describe('marcarNoitesVazias', () => {
  it('preenche o intervalo pedido com as noites que não tiveram amostra', () => {
    const base = diagnoseSleepNights([s('ASLEEP', 10, 23, 7)]);
    const d = marcarNoitesVazias(base, '2026-08-08', '2026-08-12');
    expect(d.nights).toHaveLength(5);
    expect(d.semAmostra).toBe(4);
    expect(d.ok).toBe(1);
    expect(d.nights.find((n) => n.day === '2026-08-09')!.verdict).toBe('sem-amostra');
  });

  it('não reclassifica noite já diagnosticada', () => {
    const base = diagnoseSleepNights([s('INBED', 10, 23, 7)]);
    const d = marcarNoitesVazias(base, '2026-08-10', '2026-08-10');
    expect(d.nights).toHaveLength(1);
    expect(d.nights[0].verdict).toBe('sem-estagio');
    expect(d.semAmostra).toBe(0);
    expect(d.perdidas).toBe(1);
  });
});

describe('amostra degenerada — o caso de 03/08/2026', () => {
  /** Uma única amostra CORE com duração zero: o que apareceu no aparelho. */
  function zeroLen(label: string, d: number): Sample {
    const t = new Date(2026, 7, d, 3, 0, 0).toISOString();
    return { value: 0, start: t, end: t, label };
  }

  it('rótulo de sono sem intervalo válido não vira "AWAKE cobriu tudo"', () => {
    const diag = diagnoseSleepNights([zeroLen('CORE', 3)]);
    expect(diag.nights[0].verdict).toBe('degenerada');
    expect(diag.nights[0].labels).toEqual({ CORE: 1 });
    // Dado quebrado na origem não conta como perda nossa.
    expect(diag.perdidas).toBe(0);
    expect(diag.degeneradas).toBe(1);
  });

  it('anulada continua exigindo sono com duração de verdade', () => {
    const diag = diagnoseSleepNights([trecho('ASLEEP', 3, 2, 4), trecho('AWAKE', 3, 2, 4)]);
    expect(diag.nights[0].verdict).toBe('anulada');
    expect(diag.perdidas).toBe(1);
    expect(diag.degeneradas).toBe(0);
  });
});

/**
 * A auditoria de vigília.
 *
 * Existe porque `health_daily` tem `awake` em 233 das 270 noites da era Apple
 * Watch e em **0 das 42** da era Garmin, e duas explicações opostas cabem no
 * mesmo silêncio: a fonte não escreve, ou nós descartamos. Os dois testes abaixo
 * são exatamente esses dois mundos.
 */
describe('auditoria de despertares', () => {
  it('fonte em camadas (Apple Watch): o AWAKE cai dentro do sono e é creditado', () => {
    // Envelope ASLEEP genérico da noite inteira + estágios por cima + o AWAKE
    // no meio. O genérico não sobrepõe os detalhados aqui, então sobrevive e
    // atravessa o buraco — é o que faz a sobreposição existir.
    const d = diagnoseSleepNights([
      s('INBED', 10, 23, 7),
      trecho('CORE', 10, 0, 2),
      trecho('ASLEEP', 10, 2, 3), // cobre o mesmo trecho do AWAKE
      trecho('AWAKE', 10, 2, 3),
      trecho('CORE', 10, 3, 7),
    ]);
    const n = d.nights[0];
    expect(n.awake.samples).toBe(1);
    expect(n.awake.totalMin).toBeCloseTo(60, 0);
    expect(n.awake.keptMin).toBeCloseTo(60, 0);
    expect(d.awakeDescartado).toBe(0);
  });

  it('fonte em segmentos encostados (Garmin): o AWAKE no vão da noite é creditado', () => {
    // CORE · AWAKE · CORE, sem nada cobrindo o buraco. Antes de 04/09/2026 isto
    // creditava ZERO — 36 de 38 noites reais — porque a regra era de sobreposição
    // com cada intervalo dormindo. Agora é o vão de [onset, wake].
    const d = diagnoseSleepNights([
      s('INBED', 11, 23, 7),
      trecho('CORE', 11, 0, 2),
      trecho('AWAKE', 11, 2, 3),
      trecho('CORE', 11, 3, 7),
    ]);
    const n = d.nights[0];
    expect(n.verdict).toBe('ok');
    expect(n.awake.samples).toBe(1);
    expect(n.awake.totalMin).toBeCloseTo(60, 0);
    expect(n.awake.keptMin).toBeCloseTo(60, 0); // a vigília chega ao banco
    expect(d.awakeComAmostra).toBe(1);
    expect(d.awakeDescartado).toBe(0);
  });

  it('AWAKE antes de apagar não é despertar — é latência, e não entra no crédito', () => {
    // O diagnóstico agrupa pelo dia em que a amostra TERMINA (a regra do
    // agregador para atribuir a noite), então o AWAKE pré-sono precisa cruzar a
    // meia-noite para cair na mesma noite do CORE — 23h→00h, e o sono às 00h.
    const d = diagnoseSleepNights([
      s('INBED', 13, 22, 7),
      trecho('AWAKE', 12, 23, 24), // rolando na cama, antes do primeiro sono
      trecho('CORE', 13, 0, 7),
    ]);
    expect(d.nights).toHaveLength(1);
    const n = d.nights[0];
    expect(n.awake.totalMin).toBeCloseTo(60, 0);
    expect(n.awake.keptMin).toBe(0); // fora do vão [onset, wake]
    expect(d.awakeDescartado).toBe(1); // o audit acusa: há AWAKE na noite e crédito zero…
    // …e está certo em acusar? Não: este AWAKE é latência, não despertar. O
    // audit é um alarme grosso — "existe AWAKE e nada foi creditado" — e quem
    // lê a tela vê o horário e decide. Aceito como limite conhecido do audit.
  });

  it('sem amostra AWAKE, a auditoria fica zerada — é ausência na fonte, não perda', () => {
    const d = diagnoseSleepNights([s('INBED', 12, 23, 7), s('CORE', 12, 23, 7)]);
    expect(d.awakeComAmostra).toBe(0);
    expect(d.awakeDescartado).toBe(0);
  });

  it('noites vazias entram na conta sem sujar a auditoria', () => {
    const d = marcarNoitesVazias(
      diagnoseSleepNights([s('INBED', 12, 23, 7), s('CORE', 12, 23, 7)]),
      '2026-08-11',
      '2026-08-13',
    );
    expect(d.semAmostra).toBe(2);
    expect(d.awakeComAmostra).toBe(0);
    expect(d.nights.every((n) => n.awake.samples >= 0)).toBe(true);
  });
});
