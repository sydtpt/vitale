import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SleepPeriod } from '../models';
import {
  DIMENSION_LABEL, coverageNote, nightScore, periodScore, type SleepDimensionKey, type SleepScore,
} from '../sleep/score';
import type { PacoteDeFatos } from './pacote';
import { VOCABULARIO_PROIBIDO, verificarTexto, type SubconjuntoProibido } from './verificar';

/**
 * A lista de termos proibidos com dono (AD-6, story 5.2).
 *
 * Três coisas se provam aqui: `causa` é a `CAUSA` de antes, sem tirar nem pôr —
 * é o que garante que a revista reprova exatamente o que reprovava —; os
 * subconjuntos novos são os da spec; e nenhum termo casa, **por palavra
 * inteira**, com o texto que a Saúde do sono já escreve. Esse é o casamento que
 * a 5.3 vai usar ao compô-los, e um termo que casasse com a frase do template
 * reprovaria o próprio piso.
 */

/** A `CAUSA` privada de `ia/verificar.ts` até a 5.2, copiada daquela versão. */
const CAUSA_DE_ANTES = [
  'porque', 'por causa', 'devido a', 'devido à', 'graças a', 'graças à',
  'resultou em', 'levou a', 'levou à', 'provocou', 'causou', 'causa disso',
  'em função de', 'em razão de', 'fez com que', 'por conta de',
];

/** Colidem com texto legítimo da Saúde do sono, e por isso ficaram de fora. */
const FORA_DE_PROPOSITO = ['nota', 'ponto', 'seguidas', 'máximo', 'comparar'];

describe('VOCABULARIO_PROIBIDO', () => {
  it('causa é a CAUSA de antes, termo a termo e na mesma ordem', () => {
    assert.deepEqual([...VOCABULARIO_PROIBIDO.causa], CAUSA_DE_ANTES);
  });

  it('os subconjuntos são os seis da spec, com os termos da spec', () => {
    assert.deepEqual(Object.keys(VOCABULARIO_PROIBIDO), [
      'causa', 'conselho', 'elogio', 'placar', 'tendencia-e-meta', 'comparacao',
    ]);
    assert.deepEqual([...VOCABULARIO_PROIBIDO.conselho], [
      'continue assim', 'tente dormir mais', 'vale a pena acompanhar de perto', 'que tal', 'experimente',
      'verifique suas conexões', 'recomendo', 'sugiro',
    ]);
    assert.deepEqual([...VOCABULARIO_PROIBIDO.elogio], ['parabéns', 'continue assim', 'conquista']);
    assert.deepEqual([...VOCABULARIO_PROIBIDO.placar], ['placar', 'score', 'pontuação', 'pontos', 'de 0 a 100', 'saldo']);
    assert.deepEqual([...VOCABULARIO_PROIBIDO['tendencia-e-meta']], [
      'melhorou', 'piorou', 'melhora', 'piora', 'streak', 'meta', 'seta',
    ]);
    assert.deepEqual([...VOCABULARIO_PROIBIDO.comparacao], [
      'outras pessoas', 'a maioria das pessoas', 'média da população', 'norma clínica', 'para a sua idade',
    ]);
  });

  it('cada termo em minúsculas, sem espaço nas pontas, sem repetição no subconjunto', () => {
    // `causa` casa contra `texto.toLowerCase()`: um termo com maiúscula nunca casaria.
    for (const [nome, termos] of Object.entries(VOCABULARIO_PROIBIDO)) {
      assert.equal(new Set(termos).size, termos.length, nome);
      for (const t of termos) assert.equal(t, t.toLowerCase().trim(), `${nome}: "${t}"`);
    }
  });

  it('o que ficou de fora de propósito não está em subconjunto nenhum', () => {
    const todos = new Set(Object.values(VOCABULARIO_PROIBIDO).flat().map(dobrar));
    for (const t of FORA_DE_PROPOSITO) assert.equal(todos.has(dobrar(t)), false, t);
  });

  it('o nome de subconjunto é tipo', () => {
    const ok: SubconjuntoProibido = 'tendencia-e-meta';
    // @ts-expect-error — "nota" ficou de fora de propósito, e não é subconjunto.
    const fora: SubconjuntoProibido = 'nota';
    assert.ok(ok && fora);
  });

  it('é congelado, o objeto e cada subconjunto — quem importa não afrouxa a conferência', () => {
    assert.ok(Object.isFrozen(VOCABULARIO_PROIBIDO));
    for (const [nome, termos] of Object.entries(VOCABULARIO_PROIBIDO)) assert.ok(Object.isFrozen(termos), nome);
  });
});

/* ── a revista compõe só causa ── */

/** Um caderno sem número nenhum: a conferência só tem palavras a julgar. */
const SEM_NUMERO: PacoteDeFatos = {
  versao: 2, caderno: 'rotina', rotulo: 'Rotina',
  periodo: {
    tipo: 'month', rotulo: 'Agosto 2026', rotuloAnterior: 'Julho 2026',
    inicioISO: '2026-08-01', fimISO: '2026-08-31', fechado: true, diasNoPeriodo: 31, luz: null,
  },
  metricas: [], tendencias: [], textos: [], cobertura: null, correlacoes: [], eventos: [], lacunas: [], semDado: true,
};

const daCausa = (texto: string) => verificarTexto(texto, SEM_NUMERO).problemas.filter((p) => p.regra === 'causa');

describe('verificarTexto compõe só causa', () => {
  it('cada termo de causa reprova, com o próprio termo no detalhe', () => {
    for (const termo of VOCABULARIO_PROIBIDO.causa) {
      const texto = `O vento mudou ${termo} a frente fria.`;
      assert.ok(!/\d/.test(texto));
      assert.ok(daCausa(texto).some((p) => p.detalhe === `afirma causa: "${termo}"`), termo);
    }
  });

  it('os outros subconjuntos não entram: metade, melhora, pioram, pontos, saldo e meta não são causa', () => {
    // Morde se a regra 2 passar a ler `Object.values(VOCABULARIO_PROIBIDO).flat()`:
    // por trecho, "meta" casaria com "metade" e os outros com eles mesmos.
    const texto = 'Metade das noites teve melhora, as tardes pioram, os pontos e o saldo ficaram longe da meta.';
    assert.deepEqual(daCausa(texto), []);
  });
});

/* ── o corpus da Saúde do sono ── */

/** Minúsculas e sem acento — a dobra que o casamento da 5.3 faz. */
function dobrar(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * O termo aparece no texto como **palavra inteira**, com o acento dobrado dos
 * dois lados? É o casamento exigido dos subconjuntos novos — escrito aqui só
 * para medir o corpus; o de produção é da 5.3.
 */
function casaPorPalavra(texto: string, termo: string): boolean {
  const t = dobrar(termo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${t}(?![\\p{L}\\p{N}])`, 'u').test(dobrar(texto));
}

const BXL = 120;

/**
 * Noite que acorda em `wakeDay`, apagando às `onsetH` locais. No molde de
 * `sleep/awake-shape.test.ts`: `onsetH >= 12` cai na véspera; abaixo disso é a
 * madrugada do próprio `wakeDay` — senão uma noite que apaga à 0h24 acordaria no
 * dia anterior ao que ela diz.
 */
function noite(wakeDay: string, onsetH = 23.5, durH = 7.5, awakeMin: number | null = 0): SleepPeriod {
  const ancora = new Date(`${wakeDay}T00:00:00Z`);
  if (onsetH >= 12) ancora.setUTCDate(ancora.getUTCDate() - 1);
  const onsetMs = ancora.getTime() + onsetH * 3_600_000 - BXL * 60_000;
  const wakeMs = onsetMs + (durH + (awakeMin ?? 0) / 60) * 3_600_000;
  const awakenings: SleepPeriod['awakenings'] = awakeMin === null
    ? null
    : awakeMin === 0
      ? []
      : [{
        from: new Date(onsetMs + 3_600_000).toISOString(),
        to: new Date(onsetMs + 3_600_000 + awakeMin * 60_000).toISOString(),
      }];
  return {
    userId: 'u', onsetAt: new Date(onsetMs).toISOString(), wakeAt: new Date(wakeMs).toISOString(),
    inBedAt: null, inBedEnd: null, tzOffset: BXL, wakeDay, asleepH: durH, awakenings,
    stages: null, stageSegments: null,
  };
}

/** `n` noites terminando em `ultimo`, uma por dia. */
function noites(ultimo: string, n: number, onsetH = 23.5, durH = 7.5, awakeMin: number | null = 0): SleepPeriod[] {
  const d = new Date(`${ultimo}T12:00:00Z`);
  return Array.from({ length: n }, (_, k) => {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() - (n - 1 - k));
    return noite(x.toISOString().slice(0, 10), onsetH, durH, awakeMin);
  });
}

const notas = (periodos: readonly SleepPeriod[], nota: number) =>
  Object.fromEntries(periodos.map((p) => [p.wakeDay, nota]));

/**
 * O que a Saúde escreve hoje, gerado pelas funções dela e não copiado delas: os
 * rótulos, os fatos e as ausências de `nightScore`/`periodScore` (os dois ramos
 * de cada dimensão) e a nota de cobertura.
 */
function textosDaSaude(): { scores: SleepScore[]; textos: string[] } {
  const historico = noites('2026-08-19', 20, 23.5, 7.5, 12);
  const semana = noites('2026-08-31', 7, 23.6, 6.4, 25);
  const scores = [
    nightScore(noite('2026-08-20', 23.5, 7.5, null), [], null),        // sem despertares, sem base, sem nota
    nightScore(noite('2026-08-20', 23.5, 6.2, 0), [], 3),              // sem base; "0 despertares"; nota
    nightScore(noite('2026-08-20', 0.4, 7.9, 15), historico, 4),       // com base: "1 despertar", "meio"
    periodScore([], 7),                                                // "sem noites no período"
    periodScore(noites('2026-08-07', 3), 7),                           // abaixo do piso; sem regularidade
    periodScore(semana, 7, notas(semana, 4), [...historico, ...semana]), // "seguidas", "notas", "≥ 7h"
    periodScore(semana, 7, { [semana[0].wakeDay]: 2 }),               // "1 nota"
  ];
  const textos = [
    ...Object.values(DIMENSION_LABEL),
    ...scores.flatMap((s) => s.dimensions.flatMap((d) => [d.label, d.fact, d.absent ?? ''])),
    ...scores.map((s) => coverageNote(s) ?? ''),
  ].filter((t) => t !== '' && t !== '—');
  return { scores, textos };
}

/**
 * As frases dos casos da CAP-13 (`docs/specs/sono/spec.md`), como o template as
 * vai escrever — as citadas entre aspas na spec e as descrições de cada caso.
 * A palavra de proibição da própria spec ("sem elogio") não entra: não é texto
 * que a Saúde escreve.
 */
const FRASES_DOS_CASOS = [
  'os últimos 12 meses têm 53% das noites gravadas — poucas para contar',  // sem-contagem
  'menos de duas dimensões medidas: não há o que comparar',               // medidas-insuficientes
  'tudo no máximo',                                                       // tudo-no-maximo
  'todas as medidas no mesmo ponto abaixo de 2',                          // todas-iguais
  'as quatro dimensões medidas estão no mesmo ponto',                     // todas-iguais
  'a dimensão mais baixa, com o fato cru dela',                           // uma
  'as duas empatadas',                                                    // duas
  'três ou mais empatadas no mínimo',                                     // fora-do-empate
  'só o horário está no máximo',                                          // fora-do-empate
];

describe('o corpus da Saúde do sono', () => {
  const { scores, textos } = textosDaSaude();
  const corpus = [...textos, ...FRASES_DOS_CASOS];

  it('não é vácuo: cada dimensão aparece medida e não medida, com o fato e o motivo', () => {
    for (const key of Object.keys(DIMENSION_LABEL) as SleepDimensionKey[]) {
      const ds = scores.flatMap((s) => s.dimensions).filter((d) => d.key === key);
      assert.ok(ds.some((d) => d.absent), `${key}: nenhuma ausência no corpus`);
      assert.ok(ds.some((d) => d.points !== null && d.fact !== '—'), `${key}: nenhum fato medido no corpus`);
    }
    assert.ok(scores.some((s) => coverageNote(s)?.includes('abaixo do piso')), 'a nota de cobertura baixa');
  });

  it('o casamento é por palavra inteira, com o acento dobrado', () => {
    assert.ok('metade'.includes('meta'));
    assert.equal(casaPorPalavra('metade', 'meta'), false);
    assert.equal(casaPorPalavra('pioram', 'piora'), false);
    assert.equal(casaPorPalavra('consistente', 'tente dormir mais'), false);
    assert.equal(casaPorPalavra('Bateu a meta.', 'meta'), true);
    assert.equal(casaPorPalavra('PARABENS pelo mês', 'parabéns'), true);
  });

  it('o que ficou de fora de propósito casa, sim, com o corpus — é por isso que ficou de fora', () => {
    // O controle positivo: sem ele, um corpus que não contivesse as frases da
    // Saúde passaria o teste abaixo sem medir nada.
    for (const t of FORA_DE_PROPOSITO) {
      assert.ok(corpus.some((texto) => casaPorPalavra(texto, t)), `"${t}" não aparece no corpus`);
    }
  });

  it('nenhum termo proibido casa, por palavra inteira, com o texto que a Saúde escreve', () => {
    const colisoes: string[] = [];
    for (const [nome, termos] of Object.entries(VOCABULARIO_PROIBIDO)) {
      for (const termo of termos) {
        for (const texto of corpus) {
          if (casaPorPalavra(texto, termo)) colisoes.push(`${nome}: "${termo}" em "${texto}"`);
        }
      }
    }
    assert.deepEqual(colisoes, []);
  });
});
