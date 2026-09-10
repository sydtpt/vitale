import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES_DE_FALHA, STATUS_POR_CLASSE, type ClasseDeFalha, type CorpoDoPedido } from './fio';
import { CONCLUSAO, ehFalha, type Falha, type Pedido, type Resposta } from './motor';
import {
  CLASSE_POR_STATUS,
  corpoDoPedido,
  criarMotorDeNuvem,
  traduzirDaNuvem,
  type RespostaDoTransporte,
  type Transporte,
} from './nuvem';

/**
 * A tabela de tradução da nuvem, com os corpos que a `ia-narrar` devolve HOJE
 * (`supabase/functions/ia-narrar/index.ts`) e os que ela passa a devolver na 5.6.
 * O motor de nuvem tem de ler os dois com a mesma tabela.
 */

/**
 * O que a `ia-narrar` manda HOJE numa resposta boa. O motivo de parada é o literal
 * que ela repassa do provedor (`finishReason`), e não `CONCLUSAO`: se alguém mudar
 * a constante sem mudar a borda, este teste tem de ficar vermelho — com a
 * constante aqui, ele seguiria verde enquanto a produção quebra.
 */
const BOM = {
  texto: 'Uma frase sobre o sono.',
  provedor: 'prov-a',
  modelo: 'modelo-1-0925',
  motivoDeParada: 'STOP',
  tokens: { entrada: 812, saida: 64 },
  uso: { qualquerCoisa: 1 },
};

describe('o fio de hoje', () => {
  it('o motivo de conclusão que a function repassa é o valor de CONCLUSAO', () => {
    assert.equal(BOM.motivoDeParada, CONCLUSAO);
    comoResposta(traduzirDaNuvem({ status: 200, corpo: BOM }));
  });

  it('classe: null numa resposta boa é ausência — a resposta vale', () => {
    const r = comoResposta(traduzirDaNuvem({ status: 200, corpo: { ...BOM, classe: null } }));
    assert.equal(r.texto, BOM.texto);
  });
});

function comoFalha(x: Resposta | Falha): Falha {
  assert.ok(ehFalha(x), `esperava falha, veio ${JSON.stringify(x)}`);
  return x as Falha;
}

function comoResposta(x: Resposta | Falha): Resposta {
  assert.ok(!ehFalha(x), `esperava resposta, veio ${JSON.stringify(x)}`);
  return x as Resposta;
}

const classe = (r: RespostaDoTransporte) => comoFalha(traduzirDaNuvem(r)).classe;

describe('traduzirDaNuvem — a tabela', () => {
  it('cada status da tabela vira a sua classe', () => {
    const esperado: [number, ClasseDeFalha][] = [
      [503, 'indisponivel'], [401, 'indisponivel'], [403, 'indisponivel'],
      [413, 'janela'],
      [502, 'transitoria'], [429, 'transitoria'], [504, 'transitoria'],
      [400, 'capacidade'], [422, 'capacidade'],
    ];
    for (const [status, c] of esperado) {
      const f = comoFalha(traduzirDaNuvem({ status, corpo: null }));
      assert.equal(f.classe, c, `HTTP ${status}`);
      assert.equal(f.naoMapeado, undefined, `HTTP ${status}`);
    }
    // E a tabela exportada é exatamente essa — nenhum status a mais escondido nela.
    assert.deepEqual(
      Object.entries(CLASSE_POR_STATUS).sort(([a], [b]) => Number(a) - Number(b)),
      esperado.map(([s, c]) => [String(s), c] as [string, ClasseDeFalha]).sort(([a], [b]) => Number(a) - Number(b)),
    );
  });

  it('sem rede é indisponivel', () => {
    assert.deepEqual(traduzirDaNuvem({ semRede: true }), { classe: 'indisponivel', detalhe: 'sem rede' });
    assert.deepEqual(traduzirDaNuvem({ semRede: true, detalhe: 'offline' }), { classe: 'indisponivel', detalhe: 'offline' });
  });

  it('status fora da tabela vira transitoria com naoMapeado', () => {
    for (const status of [500, 405, 418, 409, 301, 100, 0, 599]) {
      const f = comoFalha(traduzirDaNuvem({ status, corpo: { error: 'x' } }));
      assert.equal(f.classe, 'transitoria', `HTTP ${status}`);
      assert.equal(f.naoMapeado, true, `HTTP ${status}`);
      assert.match(f.detalhe ?? '', new RegExp(`HTTP ${status}`));
    }
  });

  it('um corpo com classe válida vence o status', () => {
    for (const c of CLASSES_DE_FALHA) {
      // Com o status que a 5.6 fixa, com um status que diria outra coisa, e até num 2xx.
      for (const status of [STATUS_POR_CLASSE[c], 503, 502, 422, 200]) {
        const f = comoFalha(traduzirDaNuvem({ status, corpo: { classe: c, detalhe: 'do servidor' } }));
        assert.deepEqual(f, { classe: c, detalhe: 'do servidor' }, `${c} em HTTP ${status}`);
      }
    }
  });

  it('classe que o núcleo não conhece: o status decide, e o anel fica sabendo', () => {
    const f = comoFalha(traduzirDaNuvem({ status: 503, corpo: { classe: 'cota-esgotada' } }));
    assert.equal(f.classe, 'indisponivel');
    assert.equal(f.naoMapeado, true);
    const g = comoFalha(traduzirDaNuvem({ status: 200, corpo: { ...BOM, classe: 'nova' } }));
    assert.equal(g.classe, 'transitoria');
    assert.equal(g.naoMapeado, true);
  });

  it('lido só pelo status, cada status fixado por classe dá uma classe segura', () => {
    // Sem o corpo, a classe exata se perde, mas nunca para uma que aumente a
    // exposição ou grave: 422 recua (capacidade), 502 cai no piso (transitoria).
    for (const c of CLASSES_DE_FALHA) {
      const lida = classe({ status: STATUS_POR_CLASSE[c], corpo: null });
      assert.ok(Object.prototype.hasOwnProperty.call(CLASSE_POR_STATUS, STATUS_POR_CLASSE[c]), c);
      if (c === 'indisponivel' || c === 'janela' || c === 'capacidade' || c === 'transitoria') assert.equal(lida, c);
      else assert.ok(lida === 'capacidade' || lida === 'transitoria', `${c} → ${lida}`);
    }
  });

  it('o detalhe é diagnóstico: o mesmo status com outro detalhe dá a mesma classe', () => {
    assert.equal(classe({ status: 502, corpo: { error: 'narracao_falhou', detalhe: 'HTTP 429 do provedor' } }), 'transitoria');
    assert.equal(classe({ status: 502, corpo: { error: 'narracao_falhou', detalhe: 'guardrail bloqueou' } }), 'transitoria');
    assert.equal(classe({ status: 400, corpo: { error: 'prompt_vazio' } }), 'capacidade');
    assert.equal(classe({ status: 400, corpo: { error: 'json_invalido' } }), 'capacidade');
  });
});

describe('traduzirDaNuvem — o 2xx', () => {
  it('conclusão vira Resposta, com a assinatura de quem respondeu e os tokens', () => {
    const r = comoResposta(traduzirDaNuvem({ status: 200, corpo: BOM }));
    assert.deepEqual(r, {
      texto: 'Uma frase sobre o sono.',
      assinatura: { tipo: 'nuvem', provedor: 'prov-a', modelo: 'modelo-1-0925' },
      tokens: { entrada: 812, saida: 64 },
    });
    // O motivo de parada para na borda: a Resposta não o carrega.
    assert.equal('motivoDeParada' in r, false);
  });

  it('tokens ilegíveis ficam de fora, sem derrubar a resposta', () => {
    const r = comoResposta(traduzirDaNuvem({ status: 200, corpo: { ...BOM, tokens: { entrada: 'x' } } }));
    assert.equal(r.tokens, undefined);
  });

  it('motivo de parada que não é conclusão é saida-invalida, com o motivo cru no detalhe', () => {
    for (const motivo of ['MAX_TOKENS', 'SAFETY', 'DESCONHECIDO', 'stop', '', undefined, null, 1]) {
      const f = comoFalha(traduzirDaNuvem({ status: 200, corpo: { ...BOM, motivoDeParada: motivo } }));
      assert.equal(f.classe, 'saida-invalida', String(motivo));
      assert.match(f.detalhe ?? '', new RegExp(String(motivo)));
    }
  });

  it('sem texto é saida-invalida', () => {
    for (const texto of ['', '   \n', undefined, null, 42]) {
      assert.equal(classe({ status: 200, corpo: { ...BOM, texto } }), 'saida-invalida', JSON.stringify(texto));
    }
  });

  it('sem assinatura é saida-invalida — resposta sem autor não se grava', () => {
    assert.equal(classe({ status: 200, corpo: { ...BOM, provedor: undefined } }), 'saida-invalida');
    assert.equal(classe({ status: 200, corpo: { ...BOM, modelo: '' } }), 'saida-invalida');
  });

  it('corpo ilegível é saida-invalida', () => {
    for (const corpo of [null, undefined, 'Uma frase sobre o sono.', ['a'], 7]) {
      assert.equal(classe({ status: 200, corpo }), 'saida-invalida', JSON.stringify(corpo));
    }
  });

  it('qualquer 2xx vale, não só o 200', () => {
    comoResposta(traduzirDaNuvem({ status: 201, corpo: BOM }));
    assert.equal(classe({ status: 204, corpo: null }), 'saida-invalida');
  });

  it('o que o transporte devolveu fora do contrato é transitoria não mapeada', () => {
    for (const bruto of [null, undefined, 'x', {}, { status: '200', corpo: BOM }]) {
      const f = comoFalha(traduzirDaNuvem(bruto as unknown as RespostaDoTransporte));
      assert.equal(f.classe, 'transitoria', JSON.stringify(bruto));
      assert.equal(f.naoMapeado, true, JSON.stringify(bruto));
    }
  });
});

describe('a ia-narrar de hoje, corpo a corpo', () => {
  it('lê cada saída da function e do gateway', () => {
    const casos: [RespostaDoTransporte, ClasseDeFalha | 'resposta'][] = [
      [{ status: 200, corpo: BOM }, 'resposta'],
      [{ status: 400, corpo: { error: 'json_invalido' } }, 'capacidade'],
      [{ status: 400, corpo: { error: 'prompt_vazio' } }, 'capacidade'],
      [{ status: 413, corpo: { error: 'prompt_muito_longo', max: 60_000 } }, 'janela'],
      [{ status: 503, corpo: { error: 'provedor_nao_configurado', detalhe: 'Error: AI_MODEL não configurado' } }, 'indisponivel'],
      [{ status: 502, corpo: { error: 'narracao_falhou', detalhe: 'Error: HTTP 429: quota' } }, 'transitoria'],
      [{ status: 401, corpo: { code: 401, message: 'Missing authorization header' } }, 'indisponivel'],
    ];
    for (const [r, esperado] of casos) {
      const t = traduzirDaNuvem(r);
      if (esperado === 'resposta') comoResposta(t);
      else assert.equal(comoFalha(t).classe, esperado, JSON.stringify(r));
    }
  });

  it('o detalhe carrega o erro da function, para a tela de desenvolvimento', () => {
    const f = comoFalha(traduzirDaNuvem({
      status: 503, corpo: { error: 'provedor_nao_configurado', detalhe: 'Error: AI_MODEL não configurado' },
    }));
    assert.equal(f.detalhe, 'HTTP 503 · provedor_nao_configurado: Error: AI_MODEL não configurado');
  });
});

describe('criarMotorDeNuvem', () => {
  const texto: Pedido = { sistema: 's', usuario: 'u', amostragem: 'gulosa', saida: { tipo: 'texto' }, guardrails: 'permissivo' };
  const esquema: Pedido = {
    sistema: 's', usuario: 'u', amostragem: 'padrao', guardrails: 'padrao',
    saida: { tipo: 'esquema', esquema: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] } },
  };

  it('manda o corpo que a function lê hoje, com json derivado da saída', async () => {
    const corpos: CorpoDoPedido[] = [];
    const motor = criarMotorDeNuvem(async (c) => {
      corpos.push(c);
      return { status: 200, corpo: BOM };
    });
    comoResposta(await motor(texto));
    comoResposta(await motor(esquema));
    assert.deepEqual(corpos, [
      { sistema: 's', usuario: 'u', json: false },
      { sistema: 's', usuario: 'u', json: true },
    ]);
    assert.deepEqual(corpoDoPedido(esquema), { sistema: 's', usuario: 'u', json: true });
  });

  it('traduz pela tabela o que o transporte devolve', async () => {
    const respostas: RespostaDoTransporte[] = [{ semRede: true }, { status: 413, corpo: null }, { status: 200, corpo: BOM }];
    let i = 0;
    const motor = criarMotorDeNuvem(async () => respostas[i++]);
    assert.equal(comoFalha(await motor(texto)).classe, 'indisponivel');
    assert.equal(comoFalha(await motor(texto)).classe, 'janela');
    assert.equal(comoResposta(await motor(texto)).texto, BOM.texto);
  });

  it('nunca rejeita: o transporte que lança vira transitoria não mapeada, com o nome cru', async () => {
    const lancadores: Transporte[] = [
      async () => {
        throw new TypeError('Network request failed');
      },
      () => {
        throw new Error('síncrono');
      },
      async () => {
        throw 'sem Error';
      },
    ];
    for (const invocar of lancadores) {
      const f = comoFalha(await criarMotorDeNuvem(invocar)(texto));
      assert.equal(f.classe, 'transitoria');
      assert.equal(f.naoMapeado, true);
    }
    const f = comoFalha(await criarMotorDeNuvem(lancadores[0])(texto));
    assert.match(f.detalhe ?? '', /TypeError: Network request failed/);
  });
});
