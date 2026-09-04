/**
 * O adaptador do mobile: das duas fontes de dado ao `ReadinessInput`.
 *
 * A fórmula em si mora em `packages/shared/src/health/readiness.test.ts` — aqui
 * se testa só o que é do aparelho: juntar as summaries do HealthKit (7 dias,
 * frescas) com as linhas de `health_daily` (365 dias, o histórico), datar cada
 * sinal, e não misturar SDNN com RMSSD ao montar a baseline.
 */
import { describe, it, expect } from '@jest/globals';
import { READINESS_BASELINE_DAYS, type HealthDaily } from '@vitale/shared';
import {
  buildReadinessInput,
  latestAndBaselineFromRows,
  readinessFromSummaries,
} from '../health-readiness';
import type { Sample } from '../health-buckets';

// Sexta-feira 04/09/2026, 10:00 local.
const NOW = new Date(2026, 8, 4, 10, 0, 0);

/** 'YYYY-MM-DD' local de `n` dias atrás. */
function dayAgo(n: number): string {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Amostra do HealthKit às 07:00 locais de `n` dias atrás. */
function hkSample(n: number, value: number, extra?: number): Sample {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n, 7, 0, 0);
  return { value, start: d.toISOString(), end: d.toISOString(), extra };
}

/** Linha de `health_daily` de uma métrica qualquer. */
function row(metric: string, n: number, value: number | null, extra?: Record<string, unknown>): HealthDaily {
  return { userId: 'u1', day: dayAgo(n), metric, value, count: 1, extra };
}

/** Linha `'vfc'` gravada pela ponte do intervals.icu (RMSSD). */
function vfcRow(n: number, value: number | null, source = 'intervals', kind = 'rmssd'): HealthDaily {
  return row('vfc', n, value, { source, kind });
}

/** Linha `'vfc'` do Apple Health: SDNN, e sem `extra` — o sync não escreve um. */
function appleRow(n: number, value: number): HealthDaily {
  return row('vfc', n, value);
}

describe('latestAndBaselineFromRows', () => {
  it('último valor + baseline longa excluindo o dia corrente', () => {
    const rows = [8, 7, 6, 5, 4, 3, 2, 1, 0].map((n) => vfcRow(n, 40 + n));
    const r = latestAndBaselineFromRows(rows, 'vfc', NOW);
    expect(r.latest).toBe(40);
    // Todos os 8 anteriores entram: a janela agora é de 90 dias, não de 7.
    expect(r.baseline).toBeCloseTo((41 + 42 + 43 + 44 + 45 + 46 + 47 + 48) / 8);
    expect(r.ageDays).toBe(0);
  });

  it('a baseline curta olha só as duas semanas, e viaja ao lado da longa', () => {
    const rows = [40, 20, 5, 1, 0].map((n) => vfcRow(n, 50));
    // Uma leitura destoante a 40 dias entra na longa e não na curta.
    const comOutlier = latestAndBaselineFromRows([vfcRow(40, 200), ...rows.slice(1)], 'vfc', NOW);
    expect(comOutlier.baseline!).toBeGreaterThan(comOutlier.baselineShort!);
    expect(comOutlier.baselineShort).toBe(50);
  });

  it('ordena por dia e ignora valor nulo', () => {
    const r = latestAndBaselineFromRows([vfcRow(0, 50), vfcRow(2, 60), vfcRow(1, null)], 'vfc', NOW);
    expect(r.latest).toBe(50);
    expect(r.baseline).toBe(60);
  });

  it('uma linha só não vira baseline — o componente fica de fora', () => {
    // Com `baseline = latest` o componente marcaria exatamente 50 com peso
    // cheio e `coverage` iria a 1, que é o número que existe para avisar que
    // falta informação. Na primeira noite a resposta honesta é não pontuar.
    const uma = latestAndBaselineFromRows([vfcRow(0, 55)], 'vfc', NOW);
    expect(uma).toEqual({ latest: 55, baseline: null, baselineShort: null, ageDays: 0 });

    const nenhuma = latestAndBaselineFromRows([], 'vfc', NOW);
    expect(nenhuma).toEqual({ latest: null, baseline: null, baselineShort: null, ageDays: null });
  });

  it('a baseline só usa leituras do mesmo tipo de medida', () => {
    // O Apple grava SDNN e o Garmin RMSSD, em escalas diferentes: misturar
    // faria a prontidão ler a troca de unidade como queda fisiológica.
    const misto = latestAndBaselineFromRows(
      [appleRow(3, 90), appleRow(2, 92), vfcRow(1, 45), vfcRow(0, 44)],
      'vfc',
      NOW,
    );
    expect(misto.latest).toBe(44);
    expect(misto.baseline).toBe(45);

    // Uma noite RMSSD depois de uma semana de SDNN: sem par do mesmo tipo, sem baseline.
    const virada = latestAndBaselineFromRows([appleRow(2, 90), appleRow(1, 92), vfcRow(0, 45)], 'vfc', NOW);
    expect(virada.latest).toBe(45);
    expect(virada.baseline).toBeNull();
  });

  it('filtra por métrica: a lista inteira da store não vira baseline de VFC', () => {
    const rows = [row('passos', 1, 9000), vfcRow(1, 46), vfcRow(0, 44)];
    const r = latestAndBaselineFromRows(rows, 'vfc', NOW);
    expect(r.latest).toBe(44);
    expect(r.baseline).toBe(46);
  });
});

describe('as duas fontes juntas', () => {
  it('o HealthKit vence o dia, e a tabela estende a baseline para trás', () => {
    // O relógio tem a semana; a tabela tem o trimestre. A baseline de 90 dias
    // que o núcleo pede só existe porque as duas entram.
    const summaries = { fcRepouso: [hkSample(1, 55), hkSample(0, 48)] };
    const rows = Array.from({ length: 60 }, (_, k) => row('fcRepouso', k + 2, 56));
    // Mesmo dia de hoje na tabela, com outro valor: o HealthKit tem de vencer.
    rows.push(row('fcRepouso', 0, 99));

    const input = buildReadinessInput(summaries, { fcRepouso: rows }, NOW);
    expect(input.restingHr).toBe(48);
    // 55 (relógio, ontem) + 60 leituras de 56 na tabela.
    expect(input.restingHrBaseline).toBeCloseTo((55 + 60 * 56) / 61);
    expect(input.ageDays?.fcRepouso).toBe(0);
  });

  it('sem tabela, as summaries sozinhas ainda montam o sinal', () => {
    const input = buildReadinessInput({ fcRepouso: [hkSample(1, 55), hkSample(0, 56)] }, undefined, NOW);
    expect(input.restingHr).toBe(56);
    expect(input.restingHrBaseline).toBe(55);
  });

  it('HealthKit sem VFC e tabela com linhas: o componente aparece', () => {
    const summaries = { sono: [hkSample(0, 7.5)], fcRepouso: [hkSample(1, 55), hkSample(0, 56)] };
    const rows = [3, 2, 1, 0].map((n) => vfcRow(n, 50 + n));

    const sem = readinessFromSummaries(summaries, undefined, NOW);
    expect(sem.missing).toContain('vfc');

    const com = readinessFromSummaries(summaries, { vfc: rows }, NOW);
    const input = buildReadinessInput(summaries, { vfc: rows }, NOW);
    expect(input.hrv).toBe(50);
    expect(input.hrvBaseline).toBeCloseTo((51 + 52 + 53) / 3);
    expect(com.components.map((c) => c.key)).toContain('vfc');
    expect(com.coverage).toBeGreaterThan(sem.coverage);
  });

  it('HealthKit com VFC: vence, e a tabela só completa o passado', () => {
    const summaries = { vfc: [hkSample(1, 60), hkSample(0, 62)] };
    const input = buildReadinessInput(summaries, { vfc: [vfcRow(0, 45), vfcRow(1, 44)] }, NOW);
    expect(input.hrv).toBe(62);
    // As linhas do intervals são RMSSD e a leitura de hoje é SDNN: fora da baseline.
    expect(input.hrvBaseline).toBe(60);
  });

  it('linha datada no futuro não vira leitura de hoje', () => {
    // O ingest busca até amanhã por causa do fuso do atleta; se uma linha assim
    // escapar, ela não pode passar à frente da leitura de hoje.
    const input = buildReadinessInput({}, { vfc: [vfcRow(1, 46), vfcRow(0, 44), vfcRow(-1, 70)] }, NOW);
    expect(input.hrv).toBe(44);
    expect(input.hrvBaseline).toBe(46);
  });

  it('a lista inteira da store não contamina a VFC', () => {
    const input = buildReadinessInput({}, { vfc: [row('passos', 0, 9000), vfcRow(1, 46), vfcRow(0, 44)] }, NOW);
    expect(input.hrv).toBe(44);
    expect(input.hrvBaseline).toBe(46);
  });

  it('nada em lugar nenhum: sinal ausente, sem idade', () => {
    const input = buildReadinessInput({}, { vfc: [] }, NOW);
    expect(input.hrv).toBeNull();
    expect(input.ageDays?.vfc).toBeNull();
    expect(readinessFromSummaries({}, { vfc: [] }, NOW).components).toHaveLength(0);
  });
});

describe('a idade de cada sinal', () => {
  it('leitura velha ENTRA, datada — é o que deixa a tela mostrá-la apagada', () => {
    // Antes havia um corte duro de 7 dias e a leitura simplesmente sumia; o
    // cartão não tinha como dizer "anéis, de 18 dias atrás".
    const input = buildReadinessInput({}, { vfc: [vfcRow(11, 48), vfcRow(10, 46)] }, NOW);
    expect(input.hrv).toBe(46);
    expect(input.ageDays?.vfc).toBe(10);

    const score = readinessFromSummaries({}, { vfc: [vfcRow(11, 48), vfcRow(10, 46)] }, NOW);
    expect(score.stale).toEqual(['vfc']);
    expect(score.components).toHaveLength(1);
    expect(score.total).toBeNull();
  });

  it('acima de um mês a leitura deixa de existir', () => {
    // Velho é uma coisa; ausente é outra. Mostrar uma barra "de 300 dias"
    // sugeriria que há algo a recuperar ali.
    const input = buildReadinessInput({}, { vfc: [vfcRow(60, 48), vfcRow(45, 46)] }, NOW);
    expect(input.hrv).toBeNull();
    expect(input.ageDays?.vfc).toBeNull();
  });

  it('cada sinal tem a sua idade — o cenário de 04/09/2026', () => {
    // VFC do dia; sono e FC de domingo; anéis de dezoito dias atrás.
    const input = buildReadinessInput(
      {
        sono: [hkSample(4, 8.3)],
        fcRepouso: [hkSample(5, 50), hkSample(4, 46)],
        aneis: [hkSample(18, 500, 500)],
      },
      { vfc: [vfcRow(1, 40), vfcRow(0, 34)] },
      NOW,
    );
    expect(input.ageDays).toEqual({ sono: 4, fcRepouso: 4, vfc: 0, aneis: 18, carga: null });
  });
});

describe('os anéis', () => {
  it('são os do dia mais recente, não a média da semana', () => {
    // Varrer a janela inteira devolvia até 21 frações — sete dias de três anéis
    // — que o núcleo mediava como se fossem os anéis de hoje: um domingo cheio
    // segurava a nota de uma quarta parada.
    const input = buildReadinessInput(
      { aneis: [hkSample(2, 500, 500), hkSample(2, 30, 30), hkSample(0, 100, 500)] },
      undefined,
      NOW,
    );
    expect(input.ringsPct).toEqual([0.2]);
    expect(input.ageDays?.aneis).toBe(0);
  });

  it('meta zerada não divide, e sem amostra não há idade', () => {
    expect(buildReadinessInput({ aneis: [hkSample(0, 100, 0)] }, undefined, NOW).ringsPct).toEqual([0]);

    const vazio = buildReadinessInput({ aneis: [] }, undefined, NOW);
    expect(vazio.ringsPct).toEqual([]);
    expect(vazio.ageDays?.aneis).toBeNull();
  });
});

describe('a carga', () => {
  it('o ACWR entra como está, datado de hoje', () => {
    const input = buildReadinessInput({}, { acwr: 1.42 }, NOW);
    expect(input.acwr).toBe(1.42);
    expect(input.ageDays?.carga).toBe(0);
  });

  it('sem ACWR o componente não existe, e não finge idade', () => {
    const input = buildReadinessInput({}, { acwr: null }, NOW);
    expect(input.acwr).toBeNull();
    expect(input.ageDays?.carga).toBeNull();
    expect(readinessFromSummaries({}, {}, NOW).missing).toContain('carga');
  });

  it('a idade da carga é o silêncio desde a última atividade, não o fim da série', () => {
    // A curva termina em hoje mesmo com o sync parado, e o silêncio entra nela
    // como zeros: o ACWR desce para "abaixo do costume", que vale 100. Sem a
    // idade, sync parado SUSTENTARIA a nota com um sinal cheio.
    const parado = readinessFromSummaries({}, { acwr: 0.36, acwrAgeDays: 9 }, NOW);
    expect(parado.stale).toEqual(['carga']);
    expect(parado.components.find((c) => c.key === 'carga')?.score).toBe(100);
    expect(parado.total).toBeNull();

    const recente = readinessFromSummaries({}, { acwr: 0.36, acwrAgeDays: 1 }, NOW);
    expect(recente.stale).toEqual([]);
  });
});

describe('a baseline longa é de fato longa', () => {
  it('usa até 90 dias de histórico da tabela', () => {
    // O ponto da mudança: com as summaries de 7 dias a "baseline longa" seria a
    // curta com outro nome. São as linhas de `health_daily` que a tornam real.
    const rows = Array.from({ length: 100 }, (_, k) => row('fcRepouso', k + 1, 50 + (k < READINESS_BASELINE_DAYS ? 0 : 30)));
    const input = buildReadinessInput({ fcRepouso: [hkSample(0, 48)] }, { fcRepouso: rows }, NOW);
    // As leituras além dos 90 dias (e além do teto de 30 dias de idade não se
    // aplica aqui — o teto é do VALOR mais recente, não do passado) ficam de fora.
    expect(input.restingHrBaseline).toBe(50);
  });
});
