import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MotorId } from '../ia/fio';
import type { LinhaDoRelatorio } from './linha';
import { amostrasDivergentes, linhaDoResumo, resumoDaCorrida, type CorridaDaAmostra } from './corrida';

/**
 * A corrida da amostra com nome (fatia 5).
 *
 * As contas são as de `./medidas.ts`, já cobertas lá; o que se prova aqui é o que a fatia
 * acrescenta — que a medida sai com o motor dentro, que a linha de comparação diz a taxa
 * pelos mesmos formatos do relatório do Mac, e que duas corridas de tamanhos diferentes
 * não passam por comparáveis.
 */

const QWEN = 'aparelho:coreai/qwen3-1.7b' as MotorId;
const TUCANO = 'aparelho:coreai/tucano2-1.5b' as MotorId;

function linha(p: Partial<LinhaDoRelatorio> = {}): LinhaDoRelatorio {
  return {
    range: '7d',
    offset: 0,
    alcance: 'periodo',
    caso: 'duas',
    hashDoPedido: 'a'.repeat(64),
    desfecho: 'ok',
    ms: 9_800,
    template: 'A duração e a regularidade empatam no ponto mais baixo.',
    frase: 'A noite foi curta, e o horário variou.',
    ...p,
  };
}

/** Uma corrida de `n` janelas, uma por passo, todas aprovadas. */
function corrida(motor: MotorId, n: number, p: Partial<LinhaDoRelatorio> = {}): CorridaDaAmostra {
  return { motor, linhas: Array.from({ length: n }, (_, offset) => linha({ offset, ...p })) };
}

describe('o resumo de uma corrida', () => {
  it('carrega o motor e as três medidas que são um número só', () => {
    const r = resumoDaCorrida({
      motor: QWEN,
      linhas: [
        linha({ ms: 12_000, frio: true }),
        linha({ offset: 1, ms: 9_000 }),
        linha({ offset: 2, ms: 10_600 }),
        // Fora da medida: o prazo que o hospedeiro fabricou não é reprovação do modelo.
        linha({ offset: 3, desfecho: 'transitoria', doHospedeiro: true, frase: undefined }),
        linha({ offset: 4, desfecho: 'reprovada', frase: undefined }),
      ],
    });
    assert.equal(r.motor, QWEN);
    assert.equal(r.janelas, 5);
    assert.equal(r.medidas, 4);
    assert.equal(r.aprovadas, 3);
    assert.equal(r.aprovacao, '75,0%');
    // A fria fica fora da mediana; sobram 9.000 e 10.600.
    assert.equal(r.medianaMs, 9_800);
    assert.equal(r.identicasAoTemplate, 0);
  });

  it('a aprovada igual ao template é contada, e sem medida a taxa é `—` (nunca 0%)', () => {
    const igual = resumoDaCorrida(corrida(QWEN, 2, { frase: linha().template }));
    assert.equal(igual.identicasAoTemplate, 2);
    const vazia = resumoDaCorrida({ motor: QWEN, linhas: [] });
    assert.equal(vazia.aprovacao, '—');
    assert.equal(vazia.medianaMs, null);
  });

  it('a corrida que não aconteceu guarda o motivo — ela não some do resultado', () => {
    const r = resumoDaCorrida({ motor: TUCANO, linhas: [], recusa: 'o compilado deste modelo não está mais no aparelho' });
    assert.equal(r.recusa, 'o compilado deste modelo não está mais no aparelho');
    assert.equal(r.janelas, 0);
  });
});

describe('a linha de comparação', () => {
  it('diz de quem é a medida, a taxa e a mediana — nesta ordem, sem veredito nenhum', () => {
    const texto = linhaDoResumo(resumoDaCorrida(corrida(QWEN, 4)), 'Qwen3 1.7B');
    assert.equal(
      texto,
      'Qwen3 1.7B · 4 de 4 medidas aprovadas (100,0%) · mediana 9,8 s · 0 idênticas ao template · 4 janelas',
    );
    // Nenhuma palavra de julgamento: quem aprova é o dono, lendo as quatro condições.
    for (const palavra of ['passou', 'reprovou', 'aprovado', 'melhor', 'pior']) {
      assert.ok(!texto.includes(palavra), `a linha de comparação deu veredito: ${palavra}`);
    }
  });

  it('a recusada diz que não mediu, em vez de mostrar zeros com cara de medida', () => {
    const r = resumoDaCorrida({ motor: TUCANO, linhas: [], recusa: 'a Apple Intelligence está desligada' });
    assert.equal(linhaDoResumo(r, 'Tucano2 1.5B'), 'Tucano2 1.5B · não mediu: a Apple Intelligence está desligada');
  });
});

describe('duas corridas só se comparam sobre a mesma amostra', () => {
  it('as mesmas janelas, na mesma ordem: nada a dizer', () => {
    assert.equal(amostrasDivergentes([corrida(QWEN, 22), corrida(TUCANO, 22)]), null);
  });

  it('a corrida parada no meio mede um prefixo — e as taxas deixam de se comparar', () => {
    const aviso = amostrasDivergentes([corrida(QWEN, 22), corrida(TUCANO, 7)], (m) => (m === QWEN ? 'Qwen3 1.7B' : 'Tucano2 1.5B'));
    assert.ok(aviso !== null);
    assert.match(aviso, /Qwen3 1\.7B 22 · Tucano2 1\.5B 7/);
    assert.match(aviso, /não se comparam/);
  });

  it('mesmo tamanho não basta: o que conta são os passos medidos', () => {
    const outra: CorridaDaAmostra = { motor: TUCANO, linhas: [linha({ range: '4s', offset: 0 }), linha({ range: '4s', offset: 1 })] };
    assert.ok(amostrasDivergentes([corrida(QWEN, 2), outra]) !== null);
  });

  it('uma corrida só, ou a recusada ao lado de uma que mediu, não divergem de nada', () => {
    assert.equal(amostrasDivergentes([corrida(QWEN, 22)]), null);
    assert.equal(amostrasDivergentes([corrida(QWEN, 22), { motor: TUCANO, linhas: [], recusa: 'não compilado' }]), null);
    assert.equal(amostrasDivergentes([]), null);
  });

  it('sem nome, o id serve de nome — o núcleo não conhece o catálogo do app', () => {
    const aviso = amostrasDivergentes([corrida(QWEN, 3), corrida(TUCANO, 1)]);
    assert.ok(aviso?.includes(QWEN));
  });
});
