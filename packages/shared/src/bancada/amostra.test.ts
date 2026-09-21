import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SleepPeriod } from '../models';
import { casoDaSaude } from '../sleep/caso';
import { entradaDaSaude } from '../sleep/leitura';
import {
  ALCANCES_MEDIDOS,
  LIMITE_DA_AMOSTRA,
  REGRA_DA_AMOSTRA,
  amostraDaNuvem,
  chaveDoPasso,
  enumerarJanelas,
  noiteMaisAntiga,
  passosPorAlcance,
  type JanelaClassificada,
} from './amostra';

/**
 * A amostra da bancada, agora no núcleo (story 5.13) — o que o Mac e o iPhone leem daqui.
 *
 * O comportamento inteiro da enumeração continua provado onde nasceu
 * (`scripts/bancada/janelas.test.ts`, que agora exercita esta mesma função). Aqui ficam o
 * contrato que o iPhone passou a depender dele: a identidade da regra, o endereço do passo
 * e, sobretudo, **por que as notas têm de estar inteiras antes de enumerar** — uma nota a
 * menos muda o caso, e a amostra do iPhone deixaria de ser a do Mac.
 *
 * Acervo sintético, construído aqui: nenhum dado de produção no git (AD-8).
 */

const BXL = 120;

function noite(wakeDay: string, onsetH = 23.5, durH = 7.5): SleepPeriod {
  const ancora = new Date(`${wakeDay}T00:00:00Z`);
  if (onsetH >= 12) ancora.setUTCDate(ancora.getUTCDate() - 1);
  const onsetMs = ancora.getTime() + onsetH * 3_600_000 - BXL * 60_000;
  return {
    userId: 'u',
    onsetAt: new Date(onsetMs).toISOString(),
    wakeAt: new Date(onsetMs + durH * 3_600_000).toISOString(),
    inBedAt: null,
    inBedEnd: null,
    tzOffset: BXL,
    wakeDay,
    asleepH: durH,
    awakenings: [],
    stages: null,
    stageSegments: null,
  };
}

function mais(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const HOJE = '2026-09-10';
const PRIMEIRA = '2026-06-01';

/** 100 dias com buracos, horários que variam e notas em dois terços das noites. */
function acervo(): { noites: SleepPeriod[]; notas: Record<string, number> } {
  const noites: SleepPeriod[] = [];
  const notas: Record<string, number> = {};
  for (let i = 0; i < 102; i += 1) {
    const dia = mais(PRIMEIRA, i);
    if (i % 11 === 5) continue;
    noites.push(noite(dia, 22.4 + (i % 6) * 0.4, 5.4 + (i % 5) * 0.6));
    if (i % 3 !== 0) notas[dia] = 1 + (i % 5);
  }
  return { noites, notas };
}

const { noites: NOITES, notas: NOTAS } = acervo();

describe('a regra da amostra, com a identidade que o manifesto do Mac registra', () => {
  it('o id e a versão são os que os manifestos já gravados carregam', () => {
    // Mudar qualquer um dos dois invalida todo manifesto anterior — é o papel deles, e
    // por isso não mudam sem o critério de amostraDaNuvem mudar junto.
    assert.equal(REGRA_DA_AMOSTRA.id, 'recentes-por-caso-e-alcance');
    assert.equal(REGRA_DA_AMOSTRA.versao, 1);
    assert.equal(LIMITE_DA_AMOSTRA, 2);
  });

  it('o passo é `range@offset` — o endereço que o iPhone e o relatório do Mac mostram', () => {
    assert.equal(chaveDoPasso({ range: '7d', offset: 0 }), '7d@0');
    assert.equal(chaveDoPasso({ range: 'ultima', offset: 12 }), 'ultima@12');
  });
});

describe('a noite mais antiga', () => {
  it('é o começo do acervo até hoje — a noite depois de hoje não conta', () => {
    assert.equal(noiteMaisAntiga(NOITES, HOJE), PRIMEIRA);
    assert.equal(noiteMaisAntiga([noite('2026-09-12'), noite('2026-09-03')], HOJE), '2026-09-03');
    assert.equal(noiteMaisAntiga([noite('2026-09-12')], HOJE), null);
    assert.equal(noiteMaisAntiga([], HOJE), null);
  });

  it('é de onde a enumeração parte: nenhuma janela de período acaba antes dela', () => {
    const janelas = enumerarJanelas(NOITES, NOTAS, HOJE);
    for (const j of janelas.filter((x) => x.alcance === 'periodo')) {
      const e = entradaDaSaude(NOITES, NOTAS, { range: j.range, offset: j.offset, hoje: HOJE });
      assert.ok(e.janela.until === null || e.janela.until >= PRIMEIRA, `${chaveDoPasso(j)} acaba antes da primeira noite`);
    }
  });
});

describe('as notas inteiras antes de enumerar (o portão da tela do iPhone)', () => {
  it('uma nota a menos numa noite do acervo muda o caso de alguma janela — a amostra deixaria de ser a do Mac', () => {
    const inteiras = enumerarJanelas(NOITES, NOTAS, HOJE);
    // As notas de 90 dias que a store carrega sozinha: o começo do acervo fica sem nota.
    const corte = mais(HOJE, -89);
    const parciais = Object.fromEntries(Object.entries(NOTAS).filter(([dia]) => dia >= corte));
    const cortadas = enumerarJanelas(NOITES, parciais, HOJE);
    assert.equal(cortadas.length, inteiras.length, 'as janelas são as mesmas — só o caso muda');
    const diferentes = inteiras.filter((j, i) => j.caso !== cortadas[i]?.caso);
    assert.ok(diferentes.length > 0, 'nenhum caso mudou — o acervo sintético não prova o portão; ajuste-o');
  });

  it('nota antes da noite mais antiga não muda caso nenhum — é por isso que o portão para nela', () => {
    const comNotaAntes = { ...NOTAS, [mais(PRIMEIRA, -1)]: 1, [mais(PRIMEIRA, -30)]: 5 };
    assert.deepEqual(enumerarJanelas(NOITES, comNotaAntes, HOJE), enumerarJanelas(NOITES, NOTAS, HOJE));
  });
});

describe('a amostra', () => {
  const janelas = enumerarJanelas(NOITES, NOTAS, HOJE);
  const grupo = (j: JanelaClassificada): string => `${j.caso}|${j.alcance}`;

  it('até `limite` por caso × alcance, as mais recentes, na ordem do relatório', () => {
    for (const limite of [1, 2, 6]) {
      const amostra = amostraDaNuvem(janelas, limite);
      const porGrupo = new Map<string, JanelaClassificada[]>();
      for (const j of janelas) porGrupo.set(grupo(j), [...(porGrupo.get(grupo(j)) ?? []), j]);
      for (const [g, todas] of porGrupo) {
        const escolhidas = amostra.filter((j) => grupo(j) === g);
        assert.equal(escolhidas.length, Math.min(limite, todas.length), `${g} com limite ${limite}`);
        const maisRecentes = [...todas].sort((a, b) => a.offset - b.offset || ALCANCES_MEDIDOS.indexOf(a.range) - ALCANCES_MEDIDOS.indexOf(b.range));
        assert.deepEqual(
          escolhidas.map(chaveDoPasso).sort(),
          maisRecentes.slice(0, limite).map(chaveDoPasso).sort(),
          `${g}: não são as mais recentes`,
        );
      }
      const ordem = amostra.map((j) => ALCANCES_MEDIDOS.indexOf(j.range) * 10_000 + j.offset);
      assert.deepEqual(ordem, [...ordem].sort((a, b) => a - b), 'fora da ordem do relatório');
    }
  });

  it('o caso de cada janela é o do núcleo — a amostra só o carrega', () => {
    for (const j of amostraDaNuvem(janelas)) {
      const e = entradaDaSaude(NOITES, NOTAS, { range: j.range, offset: j.offset, hoje: HOJE });
      assert.equal(j.caso, casoDaSaude(e.score).caso, chaveDoPasso(j));
      assert.equal(j.alcance, e.alcance, chaveDoPasso(j));
    }
  });

  it('limite 0 é amostra vazia; limite que não é inteiro ≥ 0 lança', () => {
    assert.deepEqual(amostraDaNuvem(janelas, 0), []);
    assert.throws(() => amostraDaNuvem(janelas, -1), RangeError);
    assert.throws(() => amostraDaNuvem(janelas, 1.5), RangeError);
  });

  it('os passos por alcance somam as janelas enumeradas', () => {
    const passos = passosPorAlcance(janelas);
    assert.equal(passos.reduce((s, p) => s + p.passos, 0), janelas.length);
    assert.deepEqual(passos.map((p) => p.range), ALCANCES_MEDIDOS.filter((r) => janelas.some((j) => j.range === r)));
  });

  it('hoje malformado lança — em vez de dar "nenhuma janela" como um acervo vazio', () => {
    assert.throws(() => enumerarJanelas(NOITES, NOTAS, '2026-9-10'), RangeError);
    assert.deepEqual(enumerarJanelas([], {}, HOJE), []);
  });
});
