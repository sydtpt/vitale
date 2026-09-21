import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CASOS_DA_SAUDE } from '../sleep/caso';
import type { LinhaDoRelatorio } from './linha';
import {
  MOTIVOS_FORA_DA_MEDIDA,
  ORDEM_DOS_CASOS,
  REGRA_DA_JANELA_MEDIDA,
  VEREDITOS,
  agregar,
  foraDaMedida,
  mediana,
  medidasDoPortao,
  resumoDaCobertura,
  vereditoDe,
} from './medidas';

/**
 * O fecho e as quatro medidas da ADR 0050, no núcleo (story 5.13).
 *
 * **A mesma régua.** Os números esperados aqui são os que o relatório do Mac já dava para
 * esta mesma lista de linhas (`scripts/bancada/relatorio.test.ts`, que continua passando,
 * agora sobre esta função). Na subida, os seis relatórios reais com a coluna do aparelho
 * foram recontados por esta função e deram as medidas que tinham sido gravadas neles.
 */

function linha(p: Partial<LinhaDoRelatorio> = {}): LinhaDoRelatorio {
  return {
    range: '7d',
    offset: 0,
    alcance: 'periodo',
    caso: 'duas',
    hashDoPedido: 'a'.repeat(64),
    desfecho: 'ok',
    ms: 812,
    template: 'A duração e a regularidade empatam no ponto mais baixo.',
    ...p,
  };
}

describe('a ordem dos casos', () => {
  it('é a própria lista do caso, não uma cópia — um caso novo lá aparece aqui sozinho', () => {
    assert.equal(ORDEM_DOS_CASOS, CASOS_DA_SAUDE);
  });

  it('o fecho sai nessa ordem, e o caso fora da lista aparece no fim em vez de sumir', () => {
    const linhas = [...CASOS_DA_SAUDE].reverse().map((caso) => linha({ caso }));
    assert.deepEqual(agregar(linhas).porCaso.map((c) => c.caso), [...CASOS_DA_SAUDE]);
    const a = agregar([linha({ caso: 'duas' }), linha({ caso: 'inventado' as never })]);
    assert.deepEqual(a.porCaso.map((c) => c.caso), ['duas', 'inventado']);
  });
});

describe('o fecho', () => {
  it('todo desfecho tem veredito, e a falha junta as classes e o defeito', () => {
    assert.equal(vereditoDe('ok'), 'aprovada');
    assert.equal(vereditoDe('reprovada'), 'reprovada');
    assert.equal(vereditoDe('recusa-do-modelo'), 'recusa');
    assert.equal(vereditoDe('template'), 'template');
    assert.equal(vereditoDe('mudo'), 'mudo');
    for (const d of ['indisponivel', 'capacidade', 'janela', 'guarda', 'saida-invalida', 'transitoria', 'defeito'] as const) {
      assert.equal(vereditoDe(d), 'falha', d);
    }
    assert.deepEqual([...VEREDITOS], ['aprovada', 'reprovada', 'recusa', 'falha', 'template', 'mudo']);
  });

  it('por regra conta só o que reprovou; por classe, as falhas e o defeito', () => {
    const a = agregar([
      linha({ desfecho: 'ok', problemas: [{ regra: 'forma', detalhe: 'uma ressalva' }] }),
      linha({ desfecho: 'recusa-do-modelo', problemas: [{ regra: 'recusa', detalhe: 'desculpe' }] }),
      linha({ desfecho: 'reprovada', problemas: [{ regra: 'algarismo', detalhe: 'escreveu 7' }] }),
      linha({ desfecho: 'reprovada', problemas: [{ regra: 'algarismo', detalhe: 'escreveu 8' }, { regra: 'marcador', detalhe: 'x' }] }),
      linha({ desfecho: 'transitoria' }),
      linha({ desfecho: 'defeito' }),
    ]);
    assert.deepEqual(a.porRegra, [{ regra: 'algarismo', vezes: 2 }, { regra: 'marcador', vezes: 1 }]);
    assert.deepEqual(a.porClasse, [
      { classe: 'defeito', vezes: 1 },
      { classe: 'recusa-do-modelo', vezes: 1 },
      { classe: 'transitoria', vezes: 1 },
    ]);
    assert.equal(a.total, 6);
    assert.equal(a.porVeredito.aprovada, 1);
    assert.equal(a.porVeredito.falha, 2);
  });
});

describe('a janela medida — uma regra só, escrita ao lado dos números', () => {
  it('entra a que chegou ao modelo; fica fora, por motivo e nesta ordem, a que não chegou ou foi do hospedeiro', () => {
    assert.equal(foraDaMedida(linha({ desfecho: 'ok' })), null);
    assert.equal(foraDaMedida(linha({ desfecho: 'transitoria' })), null, 'a transitória do motor é medida');
    assert.equal(foraDaMedida(linha({ desfecho: 'ok', frio: true })), null, 'a fria é medida — só sai da mediana');
    assert.equal(foraDaMedida(linha({ desfecho: 'mudo' })), 'semChamada');
    assert.equal(foraDaMedida(linha({ desfecho: 'indisponivel', sintetica: true })), 'sintetica');
    assert.equal(foraDaMedida(linha({ desfecho: 'defeito' })), 'defeito');
    assert.equal(foraDaMedida(linha({ desfecho: 'indisponivel' })), 'indisponivel');
    assert.equal(foraDaMedida(linha({ desfecho: 'transitoria', doHospedeiro: true })), 'doHospedeiro');
    assert.deepEqual([...MOTIVOS_FORA_DA_MEDIDA], ['semChamada', 'sintetica', 'defeito', 'indisponivel', 'doHospedeiro']);
    assert.match(REGRA_DA_JANELA_MEDIDA, /chegou ao modelo/);
  });

  it('mediana: ímpar é o do meio; par, a média dos dois do meio; vazia, nula', () => {
    assert.equal(mediana([3, 1, 2]), 2);
    assert.equal(mediana([4, 1, 3, 2]), 2.5);
    assert.equal(mediana([]), null);
  });
});

describe('as quatro medidas da ADR 0050 — os números que o Mac já dava', () => {
  const linhas = [
    linha({ caso: 'uma', alcance: 'noite', range: 'ultima', desfecho: 'ok', ms: 9000, frio: true, frase: 'Uma frase nova.' }),
    linha({ caso: 'uma', alcance: 'periodo', desfecho: 'ok', ms: 3000, frase: 'A duração e a regularidade empatam no ponto mais baixo.' }),
    linha({ caso: 'duas', alcance: 'periodo', desfecho: 'reprovada', ms: 5000 }),
    linha({ caso: 'duas', alcance: 'periodo', desfecho: 'indisponivel', ms: 0, sintetica: true }),
    linha({ caso: 'duas', alcance: 'periodo', desfecho: 'defeito', ms: 0 }),
    linha({ caso: 'duas', alcance: 'periodo', desfecho: 'indisponivel', ms: 40, detalhe: 'modelNotReady' }),
    linha({ caso: 'duas', alcance: 'periodo', desfecho: 'transitoria', ms: 60_000, doHospedeiro: true }),
    linha({ caso: 'duas', alcance: 'noite', range: 'ultima', desfecho: 'transitoria', ms: 7000 }),
  ];
  const m = medidasDoPortao(linhas);

  it('aprovação sobre as medidas, e o que ficou fora contado à parte — a soma fecha', () => {
    assert.equal(m.janelas, 8);
    assert.equal(m.medidas, 4);
    assert.equal(m.aprovadas, 2);
    assert.deepEqual(m.foraDaMedida, { semChamada: 0, sintetica: 1, defeito: 1, indisponivel: 1, doHospedeiro: 1 });
    assert.equal(m.medidas + Object.values(m.foraDaMedida).reduce((a, b) => a + b, 0), m.janelas);
  });

  it('cobertura, idênticas e mediana (sem a fria)', () => {
    assert.deepEqual(m.cobertura.map((c) => c.caso), [...CASOS_DA_SAUDE]);
    assert.deepEqual(m.cobertura.find((c) => c.caso === 'duas'), {
      caso: 'duas',
      noite: { amostra: 1, aprovadas: 0 },
      periodo: { amostra: 5, aprovadas: 0 },
    });
    assert.equal(m.identicasAoTemplate, 1);
    assert.equal(m.frias, 1);
    assert.equal(m.naMediana, 3);
    assert.equal(m.medianaMs, 5000);
  });

  it('não carrega limiar nem veredito — só números', () => {
    assert.deepEqual(Object.keys(m).sort(), [
      'aprovadas', 'cobertura', 'foraDaMedida', 'frias', 'identicasAoTemplate', 'janelas', 'medianaMs', 'medidas', 'naMediana',
    ]);
  });

  it('a cobertura em uma linha: presentes, com aprovada e as combinações sem janela', () => {
    const r = resumoDaCobertura(m);
    assert.equal(r.combinacoes, 14);
    assert.equal(r.presentes, 4);
    assert.equal(r.comAprovada, 2);
    assert.equal(r.semJanela.length, 10);
    assert.ok(r.semJanela.includes('sem-contagem/noite') && r.semJanela.includes('fora-do-empate/período'));
    assert.ok(!r.semJanela.includes('uma/noite') && !r.semJanela.includes('duas/período'));
  });
});
