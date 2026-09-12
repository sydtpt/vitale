import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CASOS_DA_SAUDE, casoDaSaude, type CasoDaSaude, type NomeDoCaso } from './caso';
import {
  DIMENSION_LABEL,
  SCORE_COVERAGE_FLOOR,
  type SleepCoverage,
  type SleepDimensionKey,
  type SleepScore,
} from './score';

/**
 * A partição da AD-7 (guarda 5 da AD-10): toda combinação de ponto × presença,
 * na noite e no período, cai em exatamente um caso.
 *
 * O "exatamente um" não sai de ler a própria função — ela devolve um caso por
 * construção. Sai de sete predicados escritos aqui **sem precedência**, cada um
 * com a definição da CAP-13 por inteiro: para cada combinação, um e só um deles
 * vale, e é o que `casoDaSaude` devolveu. Se a precedência esconder um buraco
 * (uma combinação que nenhuma definição cobre) ou uma sobreposição, isto morde.
 */

const NOITE: readonly SleepDimensionKey[] = ['duracao', 'continuidade', 'horario', 'percepcao'];
const PERIODO: readonly SleepDimensionKey[] = ['duracao', 'continuidade', 'horario', 'regularidade', 'percepcao'];
const VALORES: readonly (number | null)[] = [null, 0, 1, 2];

/** Uma contagem montada à mão, com a mesma soma e o mesmo `scored` de `tally` em `score.ts`. */
function contagem(
  chaves: readonly SleepDimensionKey[],
  pontos: readonly (number | null)[],
  coverage: SleepCoverage | null,
): SleepScore {
  // Lista curta dava `points: undefined` — nem `null` nem ponto: o teste passava
  // medindo uma dimensão que não existe.
  if (pontos.length !== chaves.length) {
    throw new RangeError(`${chaves.length} dimensões, e vieram ${pontos.length} pontos`);
  }
  const dimensions = chaves.map((key, i) => ({
    key,
    label: DIMENSION_LABEL[key],
    points: pontos[i],
    fact: pontos[i] === null ? '—' : `fato de ${key}`,
    ...(pontos[i] === null ? { absent: 'não medida' } : {}),
  }));
  const medidas = dimensions.filter((d) => d.points !== null);
  const covered = coverage === null || coverage.ratio >= SCORE_COVERAGE_FLOOR;
  return {
    dimensions,
    points: medidas.reduce((s, d) => s + (d.points ?? 0), 0),
    max: medidas.length * 2,
    coverage,
    scored: medidas.length > 0 && covered,
  };
}

/** Todas as combinações de `VALORES` em `n` posições. */
function combinacoes(n: number): (number | null)[][] {
  if (n === 0) return [[]];
  return combinacoes(n - 1).flatMap((resto) => VALORES.map((v) => [...resto, v]));
}

/**
 * As definições da CAP-13, cada uma inteira — nenhuma depende da ordem. Sem
 * medida é sem contagem, diga o `scored` o que disser (story 5.3): não há o que
 * comparar, e a frase de medidas-insuficientes contaria "zero dimensões".
 */
const DEFINICOES: Readonly<Record<NomeDoCaso, (s: SleepScore) => boolean>> = {
  'sem-contagem': (s) => !s.scored || medidasDe(s).length === 0,
  'medidas-insuficientes': (s) => s.scored && medidasDe(s).length === 1,
  'tudo-no-maximo': (s) => s.scored && medidasDe(s).length >= 2 && medidasDe(s).every((p) => p === 2),
  'todas-iguais': (s) => {
    const m = medidasDe(s);
    return s.scored && m.length >= 2 && m.every((p) => p === m[0]) && m[0] < 2;
  },
  uma: (s) => s.scored && medidasDe(s).length >= 2 && noMinimo(s) === 1,
  duas: (s) => s.scored && noMinimo(s) === 2 && acimaDoMinimo(s) > 0,
  'fora-do-empate': (s) => s.scored && noMinimo(s) >= 3 && acimaDoMinimo(s) > 0,
};

function medidasDe(s: SleepScore): number[] {
  return s.dimensions.filter((d) => d.points !== null).map((d) => d.points as number);
}

function noMinimo(s: SleepScore): number {
  const m = medidasDe(s);
  return m.filter((p) => p === Math.min(...m)).length;
}

function acimaDoMinimo(s: SleepScore): number {
  return medidasDe(s).length - noMinimo(s);
}

/** As coberturas de um período: vazio, abaixo do piso, no piso e acima. */
const COBERTURAS: readonly SleepCoverage[] = [
  { nights: 0, expected: 7, ratio: 0 },
  { nights: 3, expected: 7, ratio: 3 / 7 },
  { nights: 7, expected: 10, ratio: SCORE_COVERAGE_FLOOR },
  { nights: 7, expected: 7, ratio: 1 },
];

function confereUmCaso(s: SleepScore, contexto: string): CasoDaSaude {
  const valem = CASOS_DA_SAUDE.filter((c) => DEFINICOES[c](s));
  assert.equal(valem.length, 1, `${contexto}: ${valem.length} definições valem (${valem.join(', ')})`);
  const caso = casoDaSaude(s);
  assert.equal(caso.caso, valem[0], contexto);
  return caso;
}

describe('a partição (AD-7)', () => {
  it('a noite: as 256 combinações de ponto × presença nas quatro dimensões', () => {
    const vistos = new Set<NomeDoCaso>();
    for (const pontos of combinacoes(NOITE.length)) {
      vistos.add(confereUmCaso(contagem(NOITE, pontos, null), `noite ${JSON.stringify(pontos)}`).caso);
    }
    // Não-vácuo: a noite alcança todos os casos — o sem-contagem pela noite sem medida.
    assert.deepEqual([...vistos].sort(), [...CASOS_DA_SAUDE].sort());
  });

  it('o período: as 1.024 combinações nas cinco dimensões, sob cada cobertura', () => {
    let n = 0;
    const vistos = new Set<NomeDoCaso>();
    for (const coverage of COBERTURAS) {
      for (const pontos of combinacoes(PERIODO.length)) {
        const s = contagem(PERIODO, pontos, coverage);
        vistos.add(confereUmCaso(s, `período ${JSON.stringify(pontos)} ${JSON.stringify(coverage)}`).caso);
        n += 1;
      }
    }
    assert.equal(n, 4 * 4 ** 5);
    assert.deepEqual([...vistos].sort(), [...CASOS_DA_SAUDE].sort());
  });

  it('os casos são os sete da CAP-13, na ordem da precedência', () => {
    assert.deepEqual([...CASOS_DA_SAUDE], [
      'sem-contagem', 'medidas-insuficientes', 'tudo-no-maximo', 'todas-iguais', 'uma', 'duas', 'fora-do-empate',
    ]);
  });

  it('o scored que discorda do dado: toda combinação com o flag trocado ainda cai num caso só', () => {
    // `nightScore` e `periodScore` não produzem isto; o tipo admite, e a frase
    // não pode mentir por causa dele.
    let n = 0;
    const casos: readonly [readonly SleepDimensionKey[], readonly (SleepCoverage | null)[]][] = [
      [NOITE, [null]],
      [PERIODO, COBERTURAS],
    ];
    for (const [chaves, coberturas] of casos) {
      for (const coverage of coberturas) {
        for (const pontos of combinacoes(chaves.length)) {
          const certo = contagem(chaves, pontos, coverage);
          const s = { ...certo, scored: !certo.scored };
          const c = confereUmCaso(s, `flag trocado ${JSON.stringify(pontos)} ${JSON.stringify(coverage)}`);
          n += 1;
          // Fora de sem-contagem há sempre o que contar por extenso — nunca zero.
          if (c.caso !== 'sem-contagem') assert.ok(c.medidas >= 1);
          // Cobertura só com noite, com medida e abaixo do piso.
          if (c.caso === 'sem-contagem' && c.motivo === 'cobertura') {
            assert.ok(coverage !== null && coverage.nights > 0 && coverage.ratio < SCORE_COVERAGE_FLOOR && c.medidas > 0);
          }
          if (c.caso === 'sem-contagem' && c.motivo === 'sem-noite') assert.equal(coverage?.nights, 0);
        }
      }
    }
    assert.equal(n, 4 ** 4 + 4 * 4 ** 5);
  });
});

describe('o tipo (AD-7)', () => {
  it('nomear tem o tamanho do caso, e o switch sobre caso é exaustivo', () => {
    /** Quantas a frase nomeia — o `switch` tem de cobrir os sete, ou não compila. */
    const nomeadas = (c: CasoDaSaude): number => {
      switch (c.caso) {
        case 'sem-contagem':
        case 'medidas-insuficientes':
        case 'tudo-no-maximo':
        case 'todas-iguais': {
          // @ts-expect-error — quem não nomeia tem tupla vazia.
          const nenhuma: SleepDimensionKey = c.nomear[0];
          return nenhuma === undefined ? 0 : -1;
        }
        case 'uma': {
          const [so] = c.nomear;
          // @ts-expect-error — `uma` nomeia uma só.
          const outra: SleepDimensionKey = c.nomear[1];
          return so !== undefined && outra === undefined ? 1 : -1;
        }
        case 'duas': {
          const [a, b] = c.nomear;
          // @ts-expect-error — `duas` nomeia duas, nem uma a mais.
          const terceira: SleepDimensionKey = c.nomear[2];
          return a !== undefined && b !== undefined && terceira === undefined ? 2 : -1;
        }
        case 'fora-do-empate': {
          // Ao menos uma de fora: o primeiro elemento é da tupla, não `undefined`.
          const primeira: SleepDimensionKey = c.nomear[0];
          return primeira ? c.nomear.length : -1;
        }
        default: {
          const nunca: never = c;
          return nunca;
        }
      }
    };
    for (const pontos of combinacoes(PERIODO.length)) {
      const c = casoDaSaude(contagem(PERIODO, pontos, COBERTURAS[3]));
      assert.equal(nomeadas(c), c.nomear.length, JSON.stringify(pontos));
    }
  });
});

describe('o que o caso carrega', () => {
  const periodo = (pontos: readonly (number | null)[], coverage: SleepCoverage = COBERTURAS[3]) =>
    casoDaSaude(contagem(PERIODO, pontos, coverage));
  const noite = (pontos: readonly (number | null)[]) => casoDaSaude(contagem(NOITE, pontos, null));

  it('toda combinação: `medidas` é quantas foram medidas, e dimensão não medida não entra', () => {
    for (const coverage of COBERTURAS) {
      for (const pontos of combinacoes(PERIODO.length)) {
        const c = periodo(pontos, coverage);
        const medidas = PERIODO.filter((_, i) => pontos[i] !== null);
        assert.equal(c.medidas, medidas.length);
        assert.deepEqual([...c.dimensoes], medidas);
        for (const k of c.nomear) assert.ok(medidas.includes(k), `${k} nomeada sem estar medida`);
      }
    }
  });

  it('uma: nomeia só a mais baixa', () => {
    const c = periodo([2, 1, 2, 0, 1]);
    assert.equal(c.caso, 'uma');
    assert.deepEqual([...c.nomear], ['regularidade']);
    assert.equal(c.medidas, 5);
  });

  it('uma: não medida não conta como mais baixa', () => {
    const c = noite([null, 2, 1, 2]);
    assert.equal(c.caso, 'uma');
    assert.deepEqual([...c.nomear], ['horario']);
    assert.equal(c.medidas, 3);
  });

  it('duas: nomeia as duas do empate, na ordem da contagem', () => {
    const c = periodo([0, 2, 1, 0, null]);
    assert.equal(c.caso, 'duas');
    assert.deepEqual([...c.nomear], ['duracao', 'regularidade']);
    assert.equal(c.medidas, 4);
  });

  it('fora-do-empate: nomeia as de fora — "no máximo" só se todas elas estão em 2', () => {
    const noMax = periodo([1, 1, 2, 1, 1]);
    assert.equal(noMax.caso, 'fora-do-empate');
    assert.deepEqual([...noMax.nomear], ['horario']);
    assert.ok(noMax.caso === 'fora-do-empate' && noMax.noMaximo === true);

    const acima = periodo([0, 0, 2, 0, 1]);
    assert.ok(acima.caso === 'fora-do-empate');
    assert.deepEqual([...acima.nomear], ['horario', 'percepcao']);
    assert.equal(acima.noMaximo, false, 'uma de fora em 1: "acima das outras", não "no máximo"');

    // As de fora todas em 1, com o empate em 0: acima, e não no máximo.
    const emUm = noite([0, 0, 0, 1]);
    assert.ok(emUm.caso === 'fora-do-empate');
    assert.equal(emUm.noMaximo, false);
  });

  it('todas-iguais: com a contagem real, nunca cinco fixo', () => {
    const c = noite([1, null, 1, 1]);
    assert.equal(c.caso, 'todas-iguais');
    assert.equal(c.medidas, 3);
    assert.deepEqual([...c.nomear], []);
    assert.equal(periodo([0, 0, null, null, null]).caso, 'todas-iguais', 'duas em zero também empatam no mesmo ponto');
  });

  it('tudo-no-maximo e medidas-insuficientes: a borda é a contagem de medidas', () => {
    assert.equal(periodo([2, 2, null, 2, 2]).caso, 'tudo-no-maximo');
    // Uma medida só, mesmo em 2, não é "tudo no máximo": não há o que comparar.
    assert.equal(noite([2, null, null, null]).caso, 'medidas-insuficientes');
    assert.equal(noite([0, null, null, null]).caso, 'medidas-insuficientes');
  });

  it('sem-contagem: o motivo diz o que a frase pode dizer', () => {
    const baixa = periodo([2, 1, 2, null, 1], COBERTURAS[1]);
    assert.ok(baixa.caso === 'sem-contagem');
    assert.equal(baixa.motivo, 'cobertura');
    assert.equal(baixa.medidas, 4, 'as medidas continuam contadas, só não viram caso');
    assert.deepEqual([...baixa.nomear], []);

    const vazio = periodo([null, null, null, null, null], COBERTURAS[0]);
    assert.ok(vazio.caso === 'sem-contagem');
    assert.equal(vazio.motivo, 'sem-noite');

    const semMedida = noite([null, null, null, null]);
    assert.ok(semMedida.caso === 'sem-contagem');
    assert.equal(semMedida.motivo, 'sem-medida');

    // No piso, sem nada medido: o periodScore não o produz, mas o tipo o admite,
    // e a frase não pode falar de cobertura baixa.
    const noPiso = periodo([null, null, null, null, null], COBERTURAS[2]);
    assert.ok(noPiso.caso === 'sem-contagem');
    assert.equal(noPiso.motivo, 'sem-medida');

    // Abaixo do piso sem nada medido: não há medida, e é isso que a frase diz.
    const baixaSemMedida = periodo([null, null, null, null, null], COBERTURAS[1]);
    assert.ok(baixaSemMedida.caso === 'sem-contagem');
    assert.equal(baixaSemMedida.motivo, 'sem-medida');
  });

  it('ponto fora de 0–2, ou que não é inteiro, é contagem que não existe: lança', () => {
    for (const ruim of [3, -1, 1.5, NaN, Infinity]) {
      assert.throws(() => casoDaSaude(contagem(NOITE, [ruim, 1, 2, 0], null)), RangeError, String(ruim));
      assert.throws(() => casoDaSaude(contagem(PERIODO, [2, 1, 2, 0, ruim], COBERTURAS[3])), RangeError, String(ruim));
    }
    // O controle: os três pontos que `tally` produz passam.
    for (const bom of [0, 1, 2]) assert.ok(casoDaSaude(contagem(NOITE, [bom, 1, 2, 0], null)));
  });

  it('o ajudante do teste lança quando faltam pontos — senão a dimensão a mais fica sem ponto', () => {
    assert.throws(() => contagem(NOITE, [0, 1, 2], null), RangeError);
    assert.throws(() => contagem(PERIODO, [0, 1, 2, 1, 2, 0], COBERTURAS[3]), RangeError);
  });

  it('a noite que não existe — uma esperada, nenhuma gravada — é sem-noite, não sem-medida', () => {
    // É a contagem que `entradaDaSaude` monta para `ultima` sem noite (story 5.3).
    const c = casoDaSaude(contagem(NOITE, [null, null, null, null], { nights: 0, expected: 1, ratio: 0 }));
    assert.ok(c.caso === 'sem-contagem');
    assert.equal(c.motivo, 'sem-noite');
    assert.equal(c.medidas, 0);
  });

  it('sem medida é sem-medida mesmo com scored — nunca medidas-insuficientes de zero', () => {
    const forjada = { ...contagem(NOITE, [null, null, null, null], null), scored: true };
    const c = casoDaSaude(forjada);
    assert.ok(c.caso === 'sem-contagem');
    assert.equal(c.motivo, 'sem-medida');
    assert.equal(c.medidas, 0);
  });

  it('cobertura só abaixo do piso: scored falso com o período no piso não vira "poucas para contar"', () => {
    const forjada = { ...contagem(PERIODO, [2, 1, 2, 0, 1], COBERTURAS[3]), scored: false };
    const c = casoDaSaude(forjada);
    assert.ok(c.caso === 'sem-contagem');
    assert.equal(c.motivo, 'sem-medida');
  });

  it('no piso exato a contagem vale: o caso não é sem-contagem', () => {
    assert.equal(periodo([2, 1, 2, 0, 1], COBERTURAS[2]).caso, 'uma');
  });
});
