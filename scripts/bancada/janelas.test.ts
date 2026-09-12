/**
 * As janelas e a amostra — puros, offline, e iguais em qualquer fuso.
 *
 * O acervo é sintético e construído aqui: nenhum dado de produção entra no git
 * (AD-8). As contagens são conferidas contra a aritmética do calendário escrita à
 * mão no próprio teste — oráculo independente da implementação.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SleepPeriod, SonoRange } from '@vitale/shared';
import {
  ALCANCES_MEDIDOS,
  LIMITE_DA_AMOSTRA,
  amostraDaNuvem,
  chaveDaJanela,
  enumerarJanelas,
  passosPorAlcance,
} from './janelas.ts';

/* ── o acervo sintético ── */

const BXL = 120;

/** Uma noite que acorda em `wakeDay`, apagando às `onsetH` locais da véspera. */
function noite(wakeDay: string, onsetH = 23.5, durH = 7.5, awakeMin = 0): SleepPeriod {
  const ancora = new Date(`${wakeDay}T00:00:00Z`);
  if (onsetH >= 12) ancora.setUTCDate(ancora.getUTCDate() - 1);
  const onsetMs = ancora.getTime() + onsetH * 3_600_000 - BXL * 60_000;
  const wakeMs = onsetMs + (durH + awakeMin / 60) * 3_600_000;
  return {
    userId: 'u',
    onsetAt: new Date(onsetMs).toISOString(),
    wakeAt: new Date(wakeMs).toISOString(),
    inBedAt: null,
    inBedEnd: null,
    tzOffset: BXL,
    wakeDay,
    asleepH: durH,
    awakenings: awakeMin === 0 ? [] : [
      {
        from: new Date(onsetMs + 3_600_000).toISOString(),
        to: new Date(onsetMs + 3_600_000 + awakeMin * 60_000).toISOString(),
      },
    ],
    stages: null,
    stageSegments: null,
  };
}

/** O dia `n` dias depois de `dia`, em calendário puro. */
function mais(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const HOJE = '2026-09-10';

/**
 * Onze semanas até hoje, com buracos e com duração, horário e vigília variando —
 * para as janelas caírem em casos diferentes e a amostra ter o que escolher.
 */
function arquivo(): { noites: SleepPeriod[]; notas: Record<string, number> } {
  const noites: SleepPeriod[] = [];
  const notas: Record<string, number> = {};
  for (let i = 0; i < 80; i += 1) {
    const dia = mais('2026-06-23', i);
    if (i % 9 === 4 || (i > 30 && i < 38)) continue;
    noites.push(noite(dia, 22.6 + (i % 5) * 0.45, 5.6 + (i % 4) * 0.7, (i * 7) % 41));
    if (i % 3 !== 0) notas[dia] = 1 + (i % 5);
  }
  return { noites, notas };
}

const { noites: ACERVO, notas: NOTAS } = arquivo();
const PRIMEIRO = [...ACERVO].map((p) => p.wakeDay).sort()[0] ?? '';

/* ── a enumeração ── */

describe('enumerarJanelas', () => {
  const janelas = enumerarJanelas(ACERVO, NOTAS, HOJE);

  it('mede os quatro alcances da tela, e o ano fica fora', () => {
    assert.deepEqual([...new Set(janelas.map((j) => j.range))], [...ALCANCES_MEDIDOS]);
    assert.equal(janelas.some((j) => (j.range as SonoRange) === 'ano'), false);
  });

  it('as noites são uma janela cada, e só as de até hoje', () => {
    const noites = janelas.filter((j) => j.range === 'ultima');
    assert.equal(noites.length, ACERVO.filter((p) => p.wakeDay <= HOJE).length);
    assert.deepEqual(noites.map((j) => j.offset), noites.map((_, k) => k));
    for (const j of noites) assert.equal(j.alcance, 'noite');
  });

  it('noite depois de hoje não vira janela — a bancada relê o passado, não o futuro', () => {
    const comFuturo = [...ACERVO, noite(mais(HOJE, 3)), noite(mais(HOJE, 9))];
    const so = enumerarJanelas(comFuturo, NOTAS, HOJE).filter((j) => j.range === 'ultima');
    assert.equal(so.length, janelas.filter((j) => j.range === 'ultima').length);
  });

  it('cada período anda até a janela acabar antes da primeira noite — oráculo por calendário', () => {
    // O oráculo: o passo `k` de 7d cobre [hoje−7k−6, hoje−7k]; ele conta enquanto a
    // ponta de cima não for anterior à primeira noite gravada. `offset` 0 é a janela
    // corrente, que está sempre aberta e por isso sempre conta.
    const esperado = (passo: (k: number) => string): number => {
      let n = 1;
      while (passo(n) >= PRIMEIRO) n += 1;
      return n;
    };
    const mes = (k: number): string => {
      const d = new Date(`${HOJE}T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - 12 * k);
      return d.toISOString().slice(0, 10);
    };
    const conta = (range: SonoRange): number => janelas.filter((j) => j.range === range).length;
    assert.equal(conta('7d'), esperado((k) => mais(HOJE, -7 * k)));
    assert.equal(conta('4s'), esperado((k) => mais(HOJE, -28 * k)));
    assert.equal(conta('12m'), esperado(mes));
    for (const j of janelas.filter((x) => x.range !== 'ultima')) assert.equal(j.alcance, 'periodo');
  });

  it('toda janela sai classificada, e o caso é do núcleo', () => {
    const casos = new Set(janelas.map((j) => j.caso));
    assert.ok(casos.size > 1, `o acervo sintético caiu num caso só (${[...casos].join(', ')}) — o teste ficou cego`);
    for (const j of janelas) {
      assert.ok(j.caso.length > 0);
      if (j.caso === 'sem-contagem') assert.ok(j.motivo !== undefined, `${chaveDaJanela(j)} sem motivo`);
      else assert.equal(j.motivo, undefined);
    }
  });

  it('a ordem é a do relatório: alcance declarado, e o passo mais recente primeiro', () => {
    const ordem = janelas.map((j) => ALCANCES_MEDIDOS.indexOf(j.range));
    assert.deepEqual(ordem, [...ordem].sort((a, b) => a - b));
    for (const range of ALCANCES_MEDIDOS) {
      const passos = janelas.filter((j) => j.range === range).map((j) => j.offset);
      assert.deepEqual(passos, [...passos].sort((a, b) => a - b));
    }
  });

  it('acervo vazio não tem janela — e não lança', () => {
    assert.deepEqual(enumerarJanelas([], {}, HOJE), []);
    assert.deepEqual(enumerarJanelas([noite(mais(HOJE, 5))], {}, HOJE), []);
  });

  it('é determinística, e não muda o acervo', () => {
    const antes = JSON.stringify([ACERVO, NOTAS]);
    assert.deepEqual(enumerarJanelas(ACERVO, NOTAS, HOJE), janelas);
    assert.equal(JSON.stringify([ACERVO, NOTAS]), antes);
  });

  it('o mesmo dia dá as mesmas janelas em qualquer fuso', () => {
    const antes = process.env['TZ'];
    const porFuso = new Map<string, string>();
    try {
      for (const tz of ['UTC', 'Europe/Brussels', 'Pacific/Kiritimati', 'America/Sao_Paulo']) {
        process.env['TZ'] = tz;
        porFuso.set(tz, JSON.stringify(enumerarJanelas(ACERVO, NOTAS, HOJE)));
      }
      // Não-vácuo: o processo trocou de fuso mesmo.
      process.env['TZ'] = 'Pacific/Kiritimati';
      const la = new Date(2026, 8, 10, 12).getTime();
      process.env['TZ'] = 'America/Sao_Paulo';
      assert.notEqual(new Date(2026, 8, 10, 12).getTime(), la, 'o processo não trocou de fuso — o teste ficou vácuo');
    } finally {
      if (antes === undefined) delete process.env['TZ'];
      else process.env['TZ'] = antes;
    }
    assert.equal(new Set(porFuso.values()).size, 1, [...porFuso.keys()].join(', '));
  });

  it('passosPorAlcance descreve o que foi enumerado', () => {
    const passos = passosPorAlcance(janelas);
    assert.equal(passos.reduce((s, p) => s + p.passos, 0), janelas.length);
    for (const p of passos) assert.equal(p.passos, janelas.filter((j) => j.range === p.range).length);
    assert.deepEqual(passosPorAlcance([]), []);
  });

  it('dia que não é dia lança, como na entrada do núcleo', () => {
    assert.throws(() => enumerarJanelas(ACERVO, NOTAS, '2026-02-30'), RangeError);
    assert.throws(() => enumerarJanelas(ACERVO, NOTAS, '10/09/2026'), RangeError);
  });
});

/* ── a amostra ── */

describe('amostraDaNuvem', () => {
  const janelas = enumerarJanelas(ACERVO, NOTAS, HOJE);
  const grupo = (j: { caso: string; alcance: string }): string => `${j.caso}|${j.alcance}`;

  it('leva no máximo `limite` por caso x alcance', () => {
    for (const limite of [1, 2, 3]) {
      const a = amostraDaNuvem(janelas, limite);
      const porGrupo = new Map<string, number>();
      for (const j of a) porGrupo.set(grupo(j), (porGrupo.get(grupo(j)) ?? 0) + 1);
      for (const [g, n] of porGrupo) assert.ok(n <= limite, `${g} levou ${n} com limite ${limite}`);
    }
  });

  it('cobre todo caso x alcance que o acervo tem — nenhum fica sem medição', () => {
    const todos = new Set(janelas.map(grupo));
    const na = new Set(amostraDaNuvem(janelas).map(grupo));
    assert.deepEqual([...na].sort(), [...todos].sort());
  });

  it('no padrão, a amostra cabe nas 28 chamadas que as Design Notes declaram', () => {
    assert.equal(LIMITE_DA_AMOSTRA, 2);
    // 7 casos x 2 alcances x 2 janelas.
    assert.ok(amostraDaNuvem(janelas).length <= 28, `a amostra saiu com ${amostraDaNuvem(janelas).length}`);
  });

  it('escolhe as mais recentes: passo menor ganha, e o empate vai para o alcance mais curto', () => {
    for (const j of amostraDaNuvem(janelas, 1)) {
      const doGrupo = janelas.filter((x) => grupo(x) === grupo(j));
      const menor = Math.min(...doGrupo.map((x) => x.offset));
      assert.equal(j.offset, menor, `${chaveDaJanela(j)} não é o passo mais recente de ${grupo(j)}`);
      const empatados = doGrupo.filter((x) => x.offset === menor);
      const maisCurto = empatados.sort((a, b) => ALCANCES_MEDIDOS.indexOf(a.range) - ALCANCES_MEDIDOS.indexOf(b.range))[0];
      assert.ok(maisCurto);
      assert.equal(j.range, maisCurto.range);
    }
  });

  it('sai na ordem do relatório, e é determinística', () => {
    const a = amostraDaNuvem(janelas);
    const ordem = a.map((j) => [ALCANCES_MEDIDOS.indexOf(j.range), j.offset] as const);
    assert.deepEqual(ordem, [...ordem].sort((x, y) => x[0] - y[0] || x[1] - y[1]));
    assert.deepEqual(amostraDaNuvem(janelas), a);
  });

  it('limite 0 é amostra vazia — nenhuma chamada sai', () => {
    assert.deepEqual(amostraDaNuvem(janelas, 0), []);
  });

  it('limite que não é inteiro >= 0 lança', () => {
    for (const limite of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => amostraDaNuvem(janelas, limite), RangeError, `limite ${limite}`);
    }
  });

  it('toda janela da amostra é uma das enumeradas', () => {
    const chaves = new Set(janelas.map(chaveDaJanela));
    for (const j of amostraDaNuvem(janelas, 3)) assert.ok(chaves.has(chaveDaJanela(j)));
  });
});
