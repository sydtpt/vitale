/**
 * O ponto de injeção do app — a chamada, o prazo, e o que eles entregam ao núcleo.
 *
 * **Por que este arquivo tem de existir.** Esta é a única tradução de erro entre a
 * edge function e o núcleo que roda no aparelho, e o sintoma de ela estar errada não
 * é um teste vermelho: é **o motivo errado escrito em palavras na tela do dono** —
 * exatamente o que a decisão 5 dele compra. "A nuvem não atendeu" quando ela recusou,
 * ou "falhou por agora" quando o JWT venceu.
 *
 * **Nenhum teste aqui abre rede:** o `Chamar` é injetado, que é a intenção com que
 * ele foi declarado. O que se prova é a composição inteira — transporte mais a
 * tradução do núcleo (`criarMotorDeNuvem`), que é quem tem a tabela.
 *
 * O desembrulho depende de um contrato da **versão 2.106 do `@supabase/functions-js`**,
 * e é por isso que ele é exercitado aqui: em todo não-2xx o cliente *lança*
 * (`FunctionsHttpError`) e devolve o `Response` em `error.context`, repetido em
 * `response` do resultado — o corpo de erro **ainda não foi lido**. As duas cópias
 * antigas do cliente no app não sabiam disso, e nas duas o ramo que lia o corpo de
 * erro era código morto. Se uma versão futura parar de anexar o `Response`, é aqui
 * que se descobre.
 */
import { describe, it, expect, jest } from '@jest/globals';

// O módulo constrói o client do Supabase no import (é o hospedeiro da chamada
// real). Aqui quem chama é o `Chamar` injetado, então o client nunca é usado.
jest.mock('../supabase', () => ({ supabase: {} }));

import {
  APARELHO_SISTEMA,
  NUVEM_PADRAO,
  SEM_MODELO,
  criarMotorDeNuvem,
  type Falha,
  type Pedido,
  type Resposta,
} from '@vitale/shared';
import { PRAZO_MS, criarMotorPara, criarTransporte, type Chamar } from '../motores';

const PEDIDO: Pedido = {
  sistema: 'as regras',
  usuario: 'o caso',
  amostragem: 'gulosa',
  saida: { tipo: 'texto' },
  guardrails: 'padrao',
};

const CORPO_BOM = {
  texto: 'Nos últimos 7 dias, a duração fica abaixo das outras.',
  provedor: 'prov-a',
  modelo: 'modelo-1',
  motivoDeParada: 'STOP',
  tokens: { entrada: 310, saida: 24 },
};

/** O erro que o cliente lança em todo não-2xx, com o `Response` anexado. */
function erroHttp(status: number, corpo: unknown, ilegivel = false): Awaited<ReturnType<Chamar>> {
  const response = {
    status,
    json: async () => {
      if (ilegivel) throw new SyntaxError('Unexpected token < in JSON');
      return corpo;
    },
  };
  // O cliente devolve o erro E o `Response`, sem ter lido o corpo.
  return { data: null, error: Object.assign(new Error(`status ${status}`), { context: response }), response };
}

type Resultado =
  | { readonly ok: unknown; readonly status?: number }
  | { readonly http: number; readonly corpo?: unknown; readonly ilegivel?: true }
  | { readonly semResponse: unknown }
  | { readonly lanca: unknown }
  | { readonly pendura: true };

/** Uma chamada falsa: grava o que recebeu e devolve o que o teste mandar. */
function chamada(resultado: Resultado) {
  const vistas: { corpo: unknown; signal: AbortSignal }[] = [];
  const chamar: Chamar = async (corpo, signal) => {
    vistas.push({ corpo, signal });
    if ('lanca' in resultado) throw resultado.lanca;
    if ('pendura' in resultado) {
      // Pendura até o aborto — é o que uma function travada faz.
      return new Promise((_, rejeitar) => {
        signal.addEventListener('abort', () => rejeitar(new Error('AbortError: aborted')));
      });
    }
    if ('ok' in resultado) return { data: resultado.ok, error: null, response: { status: resultado.status ?? 200, json: async () => resultado.ok } };
    if ('semResponse' in resultado) return { data: null, error: resultado.semResponse };
    return erroHttp(resultado.http, resultado.corpo, resultado.ilegivel);
  };
  return { chamar, vistas };
}

const ehFalha = (x: Resposta | Falha): x is Falha => 'classe' in x;

/** A composição inteira: o transporte do app mais a tradução do núcleo. */
async function pelaNuvem(resultado: Resultado, prazoMs = PRAZO_MS) {
  const { chamar, vistas } = chamada(resultado);
  const motor = criarMotorDeNuvem(criarTransporte(chamar, prazoMs));
  return { saida: await motor(PEDIDO), vistas };
}

describe('a chamada', () => {
  it('manda o corpo que a function lê: o par e a intenção de JSON', async () => {
    const { vistas } = await pelaNuvem({ ok: CORPO_BOM });
    expect(vistas).toHaveLength(1);
    expect(vistas[0].corpo).toEqual({ sistema: PEDIDO.sistema, usuario: PEDIDO.usuario, json: false });
  });

  it('sempre leva um signal — é por ele que o prazo aborta a requisição', async () => {
    const { vistas } = await pelaNuvem({ ok: CORPO_BOM });
    expect(vistas[0].signal.aborted).toBe(false);
    expect(typeof vistas[0].signal.addEventListener).toBe('function');
  });
});

describe('status e corpo viram classe', () => {
  it('2xx bem formado é resposta assinada, com os tokens', async () => {
    const { saida } = await pelaNuvem({ ok: CORPO_BOM });
    expect(ehFalha(saida)).toBe(false);
    const r = saida as Resposta;
    expect(r.texto).toBe(CORPO_BOM.texto);
    expect(r.assinatura).toEqual({ tipo: 'nuvem', provedor: 'prov-a', modelo: 'modelo-1' });
    expect(r.tokens).toEqual(CORPO_BOM.tokens);
  });

  /** A tabela inteira, pela composição. A dona dela é `ia/nuvem.ts`. */
  const PORTAO: readonly (readonly [number, string])[] = [
    [401, 'indisponivel'], // o gateway, antes de a function rodar (verify_jwt)
    [403, 'indisponivel'],
    [503, 'indisponivel'],
    [413, 'janela'],
    [400, 'capacidade'],
    [422, 'capacidade'],
    [429, 'transitoria'],
    [502, 'transitoria'],
    [504, 'transitoria'],
  ];

  for (const [status, classe] of PORTAO) {
    it(`HTTP ${status} é ${classe}`, async () => {
      const { saida } = await pelaNuvem({ http: status, corpo: { error: 'o que a function disse' } });
      expect(ehFalha(saida)).toBe(true);
      expect((saida as Falha).classe).toBe(classe);
      expect((saida as Falha).detalhe).toContain(`HTTP ${status}`);
      expect((saida as Falha).naoMapeado).toBeUndefined();
    });
  }

  it('status fora da tabela é transitoria, e o anel fica sabendo', async () => {
    const { saida } = await pelaNuvem({ http: 418, corpo: { error: 'bule' } });
    expect((saida as Falha).classe).toBe('transitoria');
    expect((saida as Falha).naoMapeado).toBe(true);
  });

  it('classe no corpo decide, qualquer que seja o status (a 5.6)', async () => {
    const { saida } = await pelaNuvem({ http: 422, corpo: { classe: 'recusa-do-modelo', detalhe: 'o modelo recusou' } });
    expect((saida as Falha).classe).toBe('recusa-do-modelo');
  });

  it('2xx truncado é saida-invalida, com o motivo cru', async () => {
    const { saida } = await pelaNuvem({ ok: { ...CORPO_BOM, motivoDeParada: 'MAX_TOKENS' } });
    expect((saida as Falha).classe).toBe('saida-invalida');
    expect((saida as Falha).detalhe).toContain('MAX_TOKENS');
  });

  it('corpo de erro que não é JSON: vale o status, e o corpo não derruba nada', async () => {
    // Um HTML de gateway. `response.json()` lança, e o transporte engole — a
    // resposta é ilegível, não falta de rede.
    const { saida } = await pelaNuvem({ http: 502, ilegivel: true });
    expect((saida as Falha).classe).toBe('transitoria');
    expect((saida as Falha).detalhe).toContain('HTTP 502');
  });

  it('2xx cujo corpo não é objeto é saida-invalida', async () => {
    const { saida } = await pelaNuvem({ ok: '<html>502 Bad Gateway</html>' });
    expect((saida as Falha).classe).toBe('saida-invalida');
  });

  it('erro sem Response anexado é falta de rede — indisponivel, que recua', async () => {
    const { saida } = await pelaNuvem({ semResponse: new TypeError('Network request failed') });
    expect((saida as Falha).classe).toBe('indisponivel');
    expect((saida as Falha).detalhe).toContain('TypeError');
  });

  it('o cliente rejeitando (em vez de devolver o erro) também é falta de rede', async () => {
    const { saida } = await pelaNuvem({ lanca: new TypeError('fetch is not a function') });
    expect((saida as Falha).classe).toBe('indisponivel');
    expect((saida as Falha).detalhe).toContain('TypeError');
  });
});

describe('o prazo', () => {
  it('chamada pendurada estoura e vira transitoria, não indisponivel', async () => {
    // `transitoria` cai no piso sem repetir; `indisponivel` recuaria para o próximo
    // elo, que é o que um aborto lido como "sem rede" faria.
    const { saida } = await pelaNuvem({ pendura: true }, 10);
    expect((saida as Falha).classe).toBe('transitoria');
    expect((saida as Falha).detalhe).toContain('prazo');
    expect((saida as Falha).naoMapeado).toBeUndefined();
  });

  it('o aborto chega à chamada — a requisição é cancelada, não só ignorada', async () => {
    const { vistas } = await pelaNuvem({ pendura: true }, 10);
    expect(vistas[0].signal.aborted).toBe(true);
  });

  it('o prazo do app é o mesmo da bancada: o que ela mediu é o que a tela espera', () => {
    expect(PRAZO_MS).toBe(60_000);
  });

  it('resposta dentro do prazo não é abortada', async () => {
    const { saida, vistas } = await pelaNuvem({ ok: CORPO_BOM }, 10_000);
    expect(ehFalha(saida)).toBe(false);
    expect(vistas[0].signal.aborted).toBe(false);
  });
});

describe('o motorPara do app', () => {
  it('entrega motor para a nuvem, simbólica e nomeada', () => {
    const motorPara = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar);
    expect(motorPara(NUVEM_PADRAO)).toBeDefined();
    expect(motorPara('nuvem:acme/modelo-9')).toBeDefined();
  });

  it('não entrega motor para o aparelho — é o marco B, e não há ponte neste build', () => {
    const motorPara = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar);
    expect(motorPara(APARELHO_SISTEMA)).toBeUndefined();
  });

  it('não entrega motor para sem-modelo nem para id ilegível', () => {
    const motorPara = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar);
    expect(motorPara(SEM_MODELO)).toBeUndefined();
    expect(motorPara('lixo' as never)).toBeUndefined();
  });

  it('é o mesmo motor para todo id de nuvem — a fila é uma só', () => {
    const motorPara = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar);
    expect(motorPara(NUVEM_PADRAO)).toBe(motorPara('nuvem:acme/modelo-9'));
  });

  it('a fila não deixa duas chamadas se sobrepor', async () => {
    // Duas chamadas pagas ao mesmo tempo para uma tela que mostra uma frase é o que
    // a serialização existe para impedir. O teste conta quantas estão dentro ao
    // mesmo tempo, não quantas saíram.
    let dentro = 0;
    let maximo = 0;
    const chamar: Chamar = async () => {
      dentro += 1;
      maximo = Math.max(maximo, dentro);
      await new Promise((r) => setTimeout(r, 5));
      dentro -= 1;
      return { data: CORPO_BOM, error: null, response: { status: 200, json: async () => CORPO_BOM } };
    };
    const motor = criarMotorPara(chamar)(NUVEM_PADRAO)!;

    await Promise.all([motor(PEDIDO), motor(PEDIDO), motor(PEDIDO)]);
    expect(maximo).toBe(1);
  });

  it('uma chamada que falha não tranca a fila para as seguintes', async () => {
    let n = 0;
    const chamar: Chamar = async () => {
      n += 1;
      if (n === 1) throw new Error('a primeira quebrou');
      return { data: CORPO_BOM, error: null, response: { status: 200, json: async () => CORPO_BOM } };
    };
    const motor = criarMotorPara(chamar)(NUVEM_PADRAO)!;

    const [primeira, segunda] = await Promise.all([motor(PEDIDO), motor(PEDIDO)]);
    expect((primeira as Falha).classe).toBe('indisponivel');
    expect(ehFalha(segunda)).toBe(false);
  });
});
