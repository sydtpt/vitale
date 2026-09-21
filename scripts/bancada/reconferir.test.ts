/**
 * A reconferência: as medidas gravadas num relatório contra as recalculadas (story 5.13).
 *
 * Puro e offline — o relatório é montado aqui. O que se prova é que a comparação **acha**
 * uma divergência (senão ela seria um carimbo de aprovação que nunca reprova) e que ela
 * não acusa nada quando os números fecham.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { APARELHO_SISTEMA, SEM_MODELO, type MotorId } from '@vitale/shared';
import { reconferir } from './reconferir.ts';
import {
  montarManifesto,
  montarRelatorio,
  sha256De,
  type CorpoDoManifesto,
  type LinhaDoRelatorio,
  type Relatorio,
} from './relatorio.ts';

const CORPO: CorpoDoManifesto = {
  recurso: 'saude-do-sono',
  versaoDoDescritor: 1,
  hoje: '2026-09-19',
  acervo: {
    noites: { arquivo: 'sleep_periods.json', linhas: 295, sha256: sha256De('as noites') },
    notas: { arquivo: 'daily_ratings.json', linhas: 120, sha256: sha256De('as notas') },
    sha256: sha256De('o acervo'),
  },
  janelas: [{ range: '7d', passos: 2 }],
  amostra: { regra: 'recentes-por-caso-e-alcance', versaoDaRegra: 1, limite: 2, janelas: 2 },
  motores: [SEM_MODELO, APARELHO_SISTEMA],
};

function linha(p: Partial<LinhaDoRelatorio> = {}): LinhaDoRelatorio {
  return {
    range: '7d',
    offset: 0,
    alcance: 'periodo',
    caso: 'duas',
    hashDoPedido: 'a'.repeat(64),
    desfecho: 'ok',
    ms: 900,
    template: 'A duração e a regularidade empatam no ponto mais baixo.',
    frase: 'Uma frase nova.',
    ...p,
  };
}

function relatorio(linhas: readonly LinhaDoRelatorio[]): Relatorio {
  return montarRelatorio({
    recurso: 'saude-do-sono',
    sistema: { plataforma: 'darwin', versao: '27.0.0' },
    manifesto: montarManifesto(CORPO),
    geradoEm: '2026-09-19T10:00:00.000Z',
    pedidos: { ['a'.repeat(64)]: { sistema: 'as regras', usuario: 'o caso' } },
    colunas: [
      { motor: SEM_MODELO as MotorId, linhas: linhas.map((l) => ({ ...l, desfecho: 'template' as const, ms: 0 })) },
      { motor: APARELHO_SISTEMA as MotorId, linhas },
    ],
  });
}

describe('a reconferência', () => {
  const linhas = [
    linha({ desfecho: 'ok', ms: 12_000, frio: true }),
    linha({ desfecho: 'reprovada', ms: 9_000, offset: 1, problemas: [{ regra: 'algarismo', detalhe: 'escreveu 7' }] }),
    linha({ desfecho: 'transitoria', ms: 60_000, offset: 2, doHospedeiro: true }),
  ];

  it('um relatório coerente não acusa nada — e as contas foram feitas de verdade', () => {
    const x = reconferir(relatorio(linhas));
    assert.deepEqual(x.divergencias, []);
    assert.equal(x.colunas, 2);
    // Não-vácua: duas colunas, com as medidas só na de modelo — três comparações.
    assert.equal(x.conferidas, 3);
  });

  it('acha a divergência, e diz qual coluna, o que estava gravado e o que a régua dá', () => {
    const r = relatorio(linhas);
    const coluna = r.colunas.find((c) => c.motor === APARELHO_SISTEMA);
    assert.ok(coluna?.medidas, 'a coluna do aparelho não tem medidas — o fixture mudou');
    // Um relatório gravado por uma régua diferente: a aprovação está inflada.
    const adulterado: Relatorio = {
      ...r,
      colunas: r.colunas.map((c) =>
        c.motor === APARELHO_SISTEMA && c.medidas ? { ...c, medidas: { ...c.medidas, aprovadas: 3 } } : c,
      ),
    };
    const x = reconferir(adulterado);
    assert.equal(x.divergencias.length, 1);
    const d = x.divergencias[0]!;
    assert.equal(d.coluna, APARELHO_SISTEMA);
    assert.match(d.onde, /ADR 0050/);
    assert.match(d.gravado, /"aprovadas":3/);
    assert.match(d.recalculado, /"aprovadas":1/);
  });

  it('o fecho também é conferido — um agregado adulterado não passa', () => {
    const r = relatorio(linhas);
    const adulterado: Relatorio = {
      ...r,
      colunas: r.colunas.map((c) =>
        c.motor === APARELHO_SISTEMA ? { ...c, agregados: { ...c.agregados, total: 99 } } : c,
      ),
    };
    const x = reconferir(adulterado);
    assert.equal(x.divergencias.length, 1);
    assert.equal(x.divergencias[0]?.onde, 'agregados');
  });
});
