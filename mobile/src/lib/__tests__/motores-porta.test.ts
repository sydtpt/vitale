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
import {
  APARELHO_COREAI_SMOLLM2,
  MOTIVO_DO_COREAI_EM_PALAVRAS,
  PESOS_ABERTOS,
  motorConhecido,
  motoresDoRecurso,
} from '../motores/catalogo';
import {
  PRAZO_MS,
  criarLeitorDaCompilacao,
  criarLeitorDaPonte,
  criarMotorPara,
  criarTransporte,
  criarTransporteDoAparelho,
  motorPara as motorParaDoApp,
  ponteDoAparelho,
  type Chamar,
  type PonteDoAparelho,
} from '../motores';

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

/** O que o Engine.swift escreve numa resposta boa, no iPhone com o 27. */
const LINHA_BOA = {
  texto: 'Uma frase do aparelho.',
  provedor: 'prov-a',
  modelo: 'AFM 3 Core',
  plataforma: 'iOS 27.0',
  buildDoSistema: '27A1',
};

/**
 * Uma ponte falsa: o `responder` que o teste mandar, e o que ela recebeu.
 *
 * As duas portas do **peso aberto** (5.8) repassam para as mesmas funções, carimbando os
 * pesos no que foi visto — é assim que o teste prova que o nome viaja por argumento, e não
 * dentro do pedido.
 */
function ponteFalsa(
  responder: (pedido: string) => Promise<string>,
  diagnostico: () => Promise<string> = async () => '{"disponivel":true}',
): PonteDoAparelho & { vistos: string[]; comPesos: string[] } {
  const vistos: string[] = [];
  const comPesos: string[] = [];
  return {
    vistos,
    comPesos,
    responder: (p) => {
      vistos.push(p);
      return responder(p);
    },
    diagnostico,
    responderComPesos: (pesos, p) => {
      comPesos.push(pesos);
      vistos.push(p);
      return responder(p);
    },
    diagnosticoDosPesos: (pesos) => {
      comPesos.push(pesos);
      return diagnostico();
    },
    compilacaoDosPesos: async (pesos) => {
      comPesos.push(pesos);
      return '{"compilado":true,"componentes":1,"compilados":1}';
    },
  };
}

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

  it('sem a ponte no build, não há motor do aparelho — e nada lança', () => {
    const motorPara = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar, PRAZO_MS, null);
    expect(motorPara(APARELHO_SISTEMA)).toBeUndefined();
  });

  it('no jest o módulo nativo não existe: o motorPara do app não entrega o aparelho, e a ponte é ausente', async () => {
    // É o "app compilando no jest sem o módulo nativo" da story 5.9: o
    // `requireOptionalNativeModule` devolveu `null` no import, sem lançar.
    expect(motorParaDoApp(APARELHO_SISTEMA)).toBeUndefined();
    expect(ponteDoAparelho.agora()).toEqual({ tipo: 'ausente' });
    expect(await ponteDoAparelho.garantir()).toEqual({ tipo: 'ausente' });
  });

  it('com a ponte, entrega o motor do aparelho — só para aparelho:sistema, e sempre o mesmo', async () => {
    const ponte = ponteFalsa(async () => JSON.stringify(LINHA_BOA));
    const motorPara = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar, PRAZO_MS, ponte);
    const aparelho = motorPara(APARELHO_SISTEMA);
    expect(aparelho).toBeDefined();
    expect(motorPara(APARELHO_SISTEMA)).toBe(aparelho);
    // Um peso aberto que este build não embarcou não tem motor (5.8): um nome qualquer
    // não pode virar caminho de arquivo do outro lado.
    expect(motorPara('aparelho:acme/pesos')).toBeUndefined();
    const r = (await aparelho!(PEDIDO)) as Resposta;
    expect(r.texto).toBe(LINHA_BOA.texto);
    expect(r.assinatura).toEqual({
      tipo: 'aparelho',
      provedor: 'prov-a',
      modelo: 'AFM 3 Core',
      plataforma: 'iOS 27.0',
      buildDoSistema: '27A1',
    });
    // O que foi à ponte é a string canônica do pedido — nada da nuvem.
    expect(ponte.vistos).toHaveLength(1);
    expect(JSON.parse(ponte.vistos[0])).toMatchObject({ sistema: PEDIDO.sistema, usuario: PEDIDO.usuario });
  });

  it('a falha da ponte chega com a classe dela; a exceção vira transitoria não mapeada', async () => {
    const fora = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar, PRAZO_MS, ponteFalsa(async () =>
      JSON.stringify({ classe: 'indisponivel', detalhe: 'modelo do sistema indisponível: appleIntelligenceNotEnabled' }),
    ))(APARELHO_SISTEMA)!;
    expect((await fora(PEDIDO)) as Falha).toEqual({
      classe: 'indisponivel',
      detalhe: 'modelo do sistema indisponível: appleIntelligenceNotEnabled',
    });
    const lanca = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar, PRAZO_MS, ponteFalsa(async () => {
      throw new Error('a ponte caiu');
    }))(APARELHO_SISTEMA)!;
    const f = (await lanca(PEDIDO)) as Falha;
    expect(f.classe).toBe('transitoria');
    expect(f.naoMapeado).toBe(true);
    expect(f.detalhe).toContain('a ponte caiu');
  });

  it('o peso aberto tem motor, e os pesos vão por argumento — nunca dentro do pedido (5.8)', async () => {
    const ponte = ponteFalsa(async () => JSON.stringify({ ...LINHA_BOA, provedor: 'coreai', modelo: PESOS_ABERTOS[0]!.pesos }));
    const motorPara = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar, PRAZO_MS, ponte);
    const coreai = motorPara(APARELHO_COREAI_SMOLLM2);
    expect(coreai).toBeDefined();
    // Memoizado como os outros, e **diferente** do motor do modelo do sistema.
    expect(motorPara(APARELHO_COREAI_SMOLLM2)).toBe(coreai);
    expect(coreai).not.toBe(motorPara(APARELHO_SISTEMA));

    const r = (await coreai!(PEDIDO)) as Resposta;
    expect(r.assinatura).toMatchObject({ tipo: 'aparelho', provedor: 'coreai', modelo: PESOS_ABERTOS[0]!.pesos });
    // O nome dos pesos foi por fora, e **o pedido não o carrega**: `CHAVES_DO_PEDIDO` é
    // exaustiva sobre `keyof Pedido`, e um campo a mais ali mudaria o hash do pedido (AD-11).
    expect(ponte.comPesos).toEqual([PESOS_ABERTOS[0]!.pesos]);
    expect(Object.keys(JSON.parse(ponte.vistos[0]) as object).sort()).toEqual([
      'amostragem',
      'guardrails',
      'saida',
      'sistema',
      'usuario',
      'versaoDoDescritor',
    ]);
  });

  it('os dois motores do aparelho dividem a mesma vez: o segundo espera o primeiro (5.8)', async () => {
    const emCurso: string[] = [];
    let soltar: (() => void) | null = null;
    const ponte = ponteFalsa(
      (p) =>
        new Promise<string>((r) => {
          emCurso.push(p);
          soltar = () => r(JSON.stringify(LINHA_BOA));
        }),
    );
    const respirar = () => new Promise((r) => setTimeout(r, 0));
    const motorPara = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar, PRAZO_MS, ponte);
    const doSistema = motorPara(APARELHO_SISTEMA)!(PEDIDO);
    const doPesoAberto = motorPara(APARELHO_COREAI_SMOLLM2)!(PEDIDO);
    await respirar();
    // Um só chegou ao aparelho: duas filas deixariam os dois subirem modelo ao mesmo tempo.
    expect(emCurso).toHaveLength(1);
    soltar!();
    await doSistema;
    await respirar();
    expect(emCurso).toHaveLength(2);
    soltar!();
    await doPesoAberto;
  });

  it('não entrega motor para sem-modelo nem para id ilegível', () => {
    const motorPara = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar);
    expect(motorPara(SEM_MODELO)).toBeUndefined();
    expect(motorPara('lixo' as never)).toBeUndefined();
  });

  /**
   * Era "o mesmo motor para todo id de nuvem" até a 5.6. Deixou de ser, e a
   * mudança é o ponto da story: cada variante nomeada carrega **o seu** `motor`
   * no corpo, então elas não podem ser o mesmo objeto. O que continua sendo um
   * só é a **fila** (o teste abaixo), que é o que aquela asserção protegia.
   */
  it('o mesmo id dá o mesmo motor — a tela guarda o objeto entre renders', () => {
    const motorPara = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar);
    expect(motorPara(NUVEM_PADRAO)).toBe(motorPara(NUVEM_PADRAO));
    expect(motorPara('nuvem:acme/modelo-9')).toBe(motorPara('nuvem:acme/modelo-9'));
  });

  it('ids diferentes dão motores diferentes — é o corpo que muda', () => {
    const motorPara = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar);
    expect(motorPara(NUVEM_PADRAO)).not.toBe(motorPara('nuvem:acme/modelo-9'));
  });

  it('a variante nomeada vai no corpo; `nuvem:padrao` não vai — é o corpo de sempre', async () => {
    // `nuvem:padrao` **é** "o servidor escolhe": mandá-lo no corpo seria pedir ao
    // servidor que resolvesse para o padrão dele, que é o que a ausência já diz.
    // Manter o corpo idêntico ao de antes da 5.6 é o que faz a janela entre o
    // build novo e o deploy da function nova não custar nada.
    const { chamar, vistas } = chamada({ ok: CORPO_BOM });
    const motorPara = criarMotorPara(chamar);
    await motorPara(NUVEM_PADRAO)!(PEDIDO);
    await motorPara('nuvem:acme/modelo-9')!(PEDIDO);
    expect(vistas[0].corpo).toEqual({ sistema: PEDIDO.sistema, usuario: PEDIDO.usuario, json: false });
    expect(vistas[1].corpo).toEqual({
      sistema: PEDIDO.sistema,
      usuario: PEDIDO.usuario,
      json: false,
      motor: 'nuvem:acme/modelo-9',
    });
  });

  it('a fila é uma só entre variantes — duas telas não pagam duas chamadas juntas', async () => {
    let dentro = 0;
    let maximo = 0;
    const chamar: Chamar = async () => {
      dentro += 1;
      maximo = Math.max(maximo, dentro);
      await new Promise((r) => setTimeout(r, 5));
      dentro -= 1;
      return { data: CORPO_BOM, error: null, response: { status: 200, json: async () => CORPO_BOM } };
    };
    const motorPara = criarMotorPara(chamar);
    await Promise.all([
      motorPara(NUVEM_PADRAO)!(PEDIDO),
      motorPara('nuvem:acme/modelo-9')!(PEDIDO),
      motorPara('nuvem:acme/outro')!(PEDIDO),
    ]);
    expect(maximo).toBe(1);
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

describe('o transporte do aparelho (story 5.9)', () => {
  it('um pedido por vez: o segundo espera o primeiro terminar no aparelho', async () => {
    let dentro = 0;
    let maximo = 0;
    const ordem: string[] = [];
    const transporte = criarTransporteDoAparelho(async (p) => {
      dentro += 1;
      maximo = Math.max(maximo, dentro);
      ordem.push(`começa ${p}`);
      await new Promise((r) => setTimeout(r, 5));
      ordem.push(`termina ${p}`);
      dentro -= 1;
      return `linha ${p}`;
    }, 1_000);
    const r = await Promise.all([transporte('a'), transporte('b'), transporte('c')]);
    expect(r).toEqual(['linha a', 'linha b', 'linha c']);
    expect(maximo).toBe(1);
    expect(ordem).toEqual(['começa a', 'termina a', 'começa b', 'termina b', 'começa c', 'termina c']);
  });

  it('o prazo estoura em transitoria, e a vez só passa quando o aparelho termina de verdade', async () => {
    let soltar: (linha: string) => void = () => undefined;
    const chamados: string[] = [];
    const transporte = criarTransporteDoAparelho((p) => {
      chamados.push(p);
      if (p === 'lento') return new Promise<string>((r) => (soltar = r));
      return Promise.resolve(`linha ${p}`);
    }, 20);

    const lento = await transporte('lento');
    const f = JSON.parse(lento) as Falha;
    expect(f.classe).toBe('transitoria');
    expect(f.detalhe).toContain('prazo');
    expect(f.naoMapeado).toBeUndefined();

    // O seguinte não vai ao aparelho enquanto o lento escreve — e estoura na espera.
    const esperando = await transporte('seguinte');
    expect((JSON.parse(esperando) as Falha).classe).toBe('transitoria');
    expect(chamados).toEqual(['lento']);

    // O aparelho termina o lento; a vez passa, e o próximo pedido é atendido.
    soltar('tarde demais');
    expect(await transporte('depois')).toBe('linha depois');
    expect(chamados).toEqual(['lento', 'depois']);
  });

  it('pedido cujo prazo estourou antes de a vez chegar não vai ao aparelho', async () => {
    const chamados: string[] = [];
    let soltar: (l: string) => void = () => undefined;
    const transporte = criarTransporteDoAparelho(
      (p) => {
        chamados.push(p);
        return p === 'primeiro' ? new Promise<string>((r) => (soltar = r)) : Promise.resolve(`linha ${p}`);
      },
      15,
      { tetoMs: 10_000 },
    );
    const primeiro = transporte('primeiro');
    const segundo = transporte('segundo');
    // Os dois estouram: o primeiro no aparelho, o segundo esperando a vez.
    expect((JSON.parse(await primeiro) as Falha).classe).toBe('transitoria');
    expect((JSON.parse(await segundo) as Falha).classe).toBe('transitoria');
    soltar('tarde');
    await new Promise((r) => setTimeout(r, 5));
    expect(chamados).toEqual(['primeiro']);
  });

  it('chamada que nunca volta: a vez passa adiante depois do teto, com rastro — e o seguinte é atendido', async () => {
    const notas: string[] = [];
    const chamados: string[] = [];
    const transporte = criarTransporteDoAparelho(
      (p) => {
        chamados.push(p);
        return p === 'trava' ? new Promise<string>(() => undefined) : Promise.resolve(`linha ${p}`);
      },
      10,
      { tetoMs: 30, anotar: (t) => notas.push(t) },
    );
    expect((JSON.parse(await transporte('trava')) as Falha).classe).toBe('transitoria');
    expect(notas).toEqual([]);
    await new Promise((r) => setTimeout(r, 40));
    expect(notas).toHaveLength(1);
    expect(notas[0]).toContain('concorrência');
    expect(await transporte('depois')).toBe('linha depois');
    expect(chamados).toEqual(['trava', 'depois']);
  });

  it('o teto padrão é três prazos', async () => {
    const notas: string[] = [];
    const transporte = criarTransporteDoAparelho(() => new Promise<string>(() => undefined), 10, { anotar: (t) => notas.push(t) });
    await transporte('trava');
    await new Promise((r) => setTimeout(r, 12));
    expect(notas).toEqual([]);
    await new Promise((r) => setTimeout(r, 20));
    expect(notas).toHaveLength(1);
  });

  it('uma ponte que rejeita não tranca a fila', async () => {
    let n = 0;
    const transporte = criarTransporteDoAparelho(async (p) => {
      n += 1;
      if (n === 1) throw new Error('quebrou');
      return `linha ${p}`;
    }, 1_000);
    const [primeira, segunda] = await Promise.allSettled([transporte('a'), transporte('b')]);
    expect(primeira.status).toBe('rejected');
    expect(segunda).toEqual({ status: 'fulfilled', value: 'linha b' });
  });

  it('pelo motor, o prazo do aparelho é transitoria — cai no piso sem recuar', async () => {
    const motor = criarMotorPara(chamada({ ok: CORPO_BOM }).chamar, 10, ponteFalsa(() => new Promise<string>(() => undefined)))(
      APARELHO_SISTEMA,
    )!;
    const f = (await motor(PEDIDO)) as Falha;
    expect(f.classe).toBe('transitoria');
    expect(f.detalhe).toContain('prazo');
  });
});

describe('o diagnóstico da ponte, uma vez por sessão (story 5.9)', () => {
  it('sem a ponte: ausente, sem esperar nada', async () => {
    const leitor = criarLeitorDaPonte(null);
    expect(leitor.agora()).toEqual({ tipo: 'ausente' });
    expect(await leitor.garantir()).toEqual({ tipo: 'ausente' });
  });

  it('com a ponte: consultando até voltar; lido uma vez, e as próximas devolvem o mesmo', async () => {
    let idas = 0;
    const leitor = criarLeitorDaPonte(
      ponteFalsa(async () => '', async () => {
        idas += 1;
        return '{"disponivel":true,"janela":8192,"variante":"AFM 3 Core Advanced","plataforma":"iOS 27.0","buildDoSistema":"27A1"}';
      }),
    );
    expect(leitor.agora()).toEqual({ tipo: 'consultando' });
    const [um, dois] = await Promise.all([leitor.garantir(), leitor.garantir()]);
    expect(um).toBe(dois);
    expect(await leitor.garantir()).toBe(um);
    expect(leitor.agora()).toBe(um);
    expect(idas).toBe(1);
    expect(um).toMatchObject({
      tipo: 'lido',
      diagnostico: { estado: 'disponivel', variante: 'AFM 3 Core Advanced', janela: 8192, plataforma: 'iOS 27.0', buildDoSistema: '27A1' },
    });
  });

  it('fora do iOS não pergunta nada: o aparelho é da plataforma, com ou sem módulo', async () => {
    let idas = 0;
    const leitor = criarLeitorDaPonte(ponteFalsa(async () => '', async () => {
      idas += 1;
      return '{"disponivel":true}';
    }), { prazoMs: 10, plataforma: 'android' });
    expect(leitor.agora()).toEqual({ tipo: 'fora-do-ios' });
    expect(await leitor.reconsultar()).toEqual({ tipo: 'fora-do-ios' });
    expect(await criarLeitorDaPonte(null, { prazoMs: 10, plataforma: 'android' }).garantir()).toEqual({ tipo: 'fora-do-ios' });
    expect(idas).toBe(0);
  });

  it('o que não é disponível é relido ao reconsultar; o disponível não, e a linha crua vem junto', async () => {
    const respostas = ['{"disponivel":false,"motivo":"modelNotReady"}', '{"disponivel":true,"janela":8192}'];
    let idas = 0;
    const leitor = criarLeitorDaPonte(ponteFalsa(async () => '', async () => respostas[Math.min(idas++, 1)]), { prazoMs: 1_000, plataforma: 'ios' });
    const primeiro = await leitor.garantir();
    expect(primeiro).toEqual({ tipo: 'lido', diagnostico: { estado: 'indisponivel', motivo: 'modelNotReady' }, cru: respostas[0] });
    // `garantir` não relê; `reconsultar` sim, porque o último não foi disponível.
    expect(await leitor.garantir()).toBe(primeiro);
    expect(idas).toBe(1);
    const segundo = await leitor.reconsultar();
    expect(idas).toBe(2);
    expect(segundo.tipo === 'lido' && segundo.diagnostico.estado).toBe('disponivel');
    // Durante e depois, `agora()` mostra o último lido, sem voltar a "consultando".
    expect(leitor.agora()).toBe(segundo);
    // Disponível não é relido na sessão.
    expect(await leitor.reconsultar()).toBe(segundo);
    expect(idas).toBe(2);
  });

  it('reconsultas simultâneas dividem uma leitura só', async () => {
    let idas = 0;
    const leitor = criarLeitorDaPonte(ponteFalsa(async () => '', async () => {
      idas += 1;
      return '{"disponivel":false,"motivo":"appleIntelligenceNotEnabled"}';
    }), { prazoMs: 1_000, plataforma: 'ios' });
    await Promise.all([leitor.reconsultar(), leitor.reconsultar(), leitor.garantir()]);
    expect(idas).toBe(1);
  });

  it('Apple Intelligence desligada: indisponível com o motivo cru — as palavras são do catálogo', async () => {
    const leitor = criarLeitorDaPonte(ponteFalsa(async () => '', async () => '{"disponivel":false,"motivo":"appleIntelligenceNotEnabled"}'));
    expect(await leitor.garantir()).toMatchObject({
      tipo: 'lido',
      diagnostico: { estado: 'indisponivel', motivo: 'appleIntelligenceNotEnabled' },
    });
  });

  it('fora do contrato, rejeitado ou sem resposta no prazo: ilegível, nunca exceção', async () => {
    const casos: readonly (readonly [() => Promise<string>, RegExp])[] = [
      [async () => 'Illegal instruction: 4', /não é JSON/],
      [async () => '{"disponivel":"sim"}', /não diz se o modelo atende/],
      [async () => {
        throw new TypeError('ponte.diagnostico is not a function');
      }, /a ponte lançou — TypeError/],
      [() => new Promise<string>(() => undefined), /não voltou em/],
    ];
    for (const [diagnostico, onde] of casos) {
      const e = await criarLeitorDaPonte(ponteFalsa(async () => '', diagnostico), { prazoMs: 10 }).garantir();
      expect(e.tipo).toBe('lido');
      if (e.tipo !== 'lido') continue;
      expect(e.diagnostico.estado).toBe('ilegivel');
      if (e.diagnostico.estado === 'ilegivel') expect(e.diagnostico.detalhe).toMatch(onde);
    }
  });
});

describe('os dois leitores de diagnóstico não se confundem (story 5.8)', () => {
  /** Uma ponte que registra **qual porta** foi perguntada, e com quê. */
  function ponteQueAnotaAPorta(respostas: { sistema: string; pesos: string }) {
    const perguntas: string[] = [];
    const ponte: PonteDoAparelho = {
      responder: async () => '',
      responderComPesos: async () => '',
      diagnostico: async () => {
        perguntas.push('diagnostico');
        return respostas.sistema;
      },
      diagnosticoDosPesos: async (pesos) => {
        perguntas.push(`diagnosticoDosPesos:${pesos}`);
        return respostas.pesos;
      },
      compilacaoDosPesos: async (pesos) => {
        perguntas.push(`compilacaoDosPesos:${pesos}`);
        return '{"compilado":false,"componentes":1,"compilados":0}';
      },
    };
    return { ponte, perguntas };
  }

  const SISTEMA_DE_PE = '{"disponivel":true,"variante":"AFM 3 Core Advanced","janela":8192}';
  const SEM_PESOS = '{"disponivel":false,"motivo":"semPesos"}';

  it('o leitor do peso aberto pergunta pela porta dos PESOS, com o nome deles', async () => {
    // Sem isto, tirar o `perguntar` do leitor compila, passa em tudo, e a linha "Peso
    // aberto" mostraria o estado do modelo do sistema — anunciando-se disponível.
    const { ponte, perguntas } = ponteQueAnotaAPorta({ sistema: SISTEMA_DE_PE, pesos: SEM_PESOS });
    const leitor = criarLeitorDaPonte(ponte, {
      plataforma: 'ios',
      perguntar: (p) => p.diagnosticoDosPesos(PESOS_ABERTOS[0]!.pesos),
    });
    await leitor.garantir();
    expect(perguntas).toEqual([`diagnosticoDosPesos:${PESOS_ABERTOS[0]!.pesos}`]);
  });

  it('e o do modelo do sistema pergunta pela porta dele', async () => {
    const { ponte, perguntas } = ponteQueAnotaAPorta({ sistema: SISTEMA_DE_PE, pesos: SEM_PESOS });
    await criarLeitorDaPonte(ponte, { plataforma: 'ios' }).garantir();
    expect(perguntas).toEqual(['diagnostico']);
  });

  it('os dois DISCORDAM sem se contaminar: sistema de pé, pesos ausentes', async () => {
    const { ponte } = ponteQueAnotaAPorta({ sistema: SISTEMA_DE_PE, pesos: SEM_PESOS });
    const doSistema = await criarLeitorDaPonte(ponte, { plataforma: 'ios' }).garantir();
    const doPesoAberto = await criarLeitorDaPonte(ponte, {
      plataforma: 'ios',
      perguntar: (p) => p.diagnosticoDosPesos(PESOS_ABERTOS[0]!.pesos),
    }).garantir();

    expect(doSistema.tipo === 'lido' && doSistema.diagnostico.estado).toBe('disponivel');
    expect(doPesoAberto.tipo === 'lido' && doPesoAberto.diagnostico.estado).toBe('indisponivel');

    // E o que o seletor mostra, que é onde a confusão apareceria.
    const conhecidos = motoresDoRecurso('saude-do-sono', { sistema: doSistema, coreai: doPesoAberto }, null);
    const sistema = motorConhecido(APARELHO_SISTEMA, conhecidos);
    const coreai = motorConhecido(APARELHO_COREAI_SMOLLM2, conhecidos);
    expect(sistema?.disponivel).toBe(true);
    expect(sistema?.detalhe).toBe('AFM 3 Core Advanced · janela de 8.192 tokens');
    expect(coreai?.disponivel).toBe(false);
    expect(coreai?.detalhe).toBeUndefined();
    expect(coreai?.motivo).toBe(MOTIVO_DO_COREAI_EM_PALAVRAS.semPesos);
  });
});

/**
 * O leitor da compilação — a terceira porta do peso aberto.
 *
 * O que precisa de cobertura aqui é a **diferença** contra o leitor do diagnóstico: aquele
 * para de perguntar assim que ouve "disponível", e este não pode parar nunca. `compilado`
 * volta a ser falso sozinho — o iOS atualiza e recompila tudo, ou purga o cache sob pressão de
 * espaço —, e um leitor que guardasse a resposta boa mostraria "compilado" depois de o sistema
 * ter jogado o compilado fora.
 */
describe('a compilação de um peso aberto, relida sempre', () => {
  /** Uma ponte que conta as idas a **cada** porta, e responde o que o teste mandar. */
  function ponteQueConta(compilacao: () => string) {
    const idas: string[] = [];
    const ponte: PonteDoAparelho = {
      responder: async () => '',
      responderComPesos: async () => '',
      diagnostico: async () => {
        idas.push('diagnostico');
        return '{"disponivel":true}';
      },
      diagnosticoDosPesos: async (pesos) => {
        idas.push(`diagnosticoDosPesos:${pesos}`);
        return '{"disponivel":true}';
      },
      compilacaoDosPesos: async (pesos) => {
        idas.push(`compilacaoDosPesos:${pesos}`);
        return compilacao();
      },
    };
    return { ponte, idas };
  }

  const PESOS = PESOS_ABERTOS[0]!.pesos;

  it('pergunta a porta da compilação, e só ela — não o diagnóstico', async () => {
    const { ponte, idas } = ponteQueConta(() => '{"compilado":true,"componentes":1,"compilados":1}');
    const leitor = criarLeitorDaCompilacao(ponte, PESOS, { plataforma: 'ios' });
    const lido = await leitor.reler();
    expect(idas).toEqual([`compilacaoDosPesos:${PESOS}`]);
    expect(lido).toEqual({
      tipo: 'lido',
      compilacao: { estado: 'compilado', componentes: 1, compilados: 1 },
      cru: '{"compilado":true,"componentes":1,"compilados":1}',
    });
  });

  it('"compilado" NÃO vira cache: a releitura seguinte pergunta de novo e pode dizer o contrário', async () => {
    const respostas = ['{"compilado":true,"componentes":1,"compilados":1}', '{"compilado":false,"componentes":1,"compilados":0}'];
    let vez = 0;
    const { ponte, idas } = ponteQueConta(() => respostas[Math.min(vez++, 1)]!);
    const leitor = criarLeitorDaCompilacao(ponte, PESOS, { plataforma: 'ios' });
    const primeiro = await leitor.reler();
    expect(primeiro.tipo === 'lido' && primeiro.compilacao.estado).toBe('compilado');
    // O iOS purgou o cache entre as duas leituras. É este caso que um leitor com memória perderia.
    const segundo = await leitor.reler();
    expect(idas.length).toBe(2);
    expect(segundo.tipo === 'lido' && segundo.compilacao.estado).toBe('nao-compilado');
    // `agora()` mostra o último lido, sem voltar a "consultando".
    expect(leitor.agora()).toBe(segundo);
  });

  it('releituras simultâneas dividem uma leitura só', async () => {
    const { ponte, idas } = ponteQueConta(() => '{"compilado":false,"componentes":1,"compilados":0}');
    const leitor = criarLeitorDaCompilacao(ponte, PESOS, { plataforma: 'ios' });
    await Promise.all([leitor.reler(), leitor.reler(), leitor.reler()]);
    expect(idas.length).toBe(1);
  });

  it('antes da primeira resposta é "consultando" — que não é "não compilado"', () => {
    const { ponte } = ponteQueConta(() => '{"compilado":true}');
    expect(criarLeitorDaCompilacao(ponte, PESOS, { plataforma: 'ios' }).agora()).toEqual({ tipo: 'consultando' });
  });

  it('sem a ponte e fora do iOS nem pergunta — e nenhum dos dois é "não compilado"', async () => {
    expect(await criarLeitorDaCompilacao(null, PESOS, { plataforma: 'ios' }).reler()).toEqual({ tipo: 'ausente' });
    const { ponte, idas } = ponteQueConta(() => '{"compilado":true}');
    expect(await criarLeitorDaCompilacao(ponte, PESOS, { plataforma: 'android' }).reler()).toEqual({ tipo: 'fora-do-ios' });
    expect(idas).toEqual([]);
  });

  it('fora do contrato, rejeitado ou sem resposta no prazo: ilegível, nunca exceção', async () => {
    const casos: readonly (readonly [() => Promise<string>, RegExp])[] = [
      [async () => 'não é JSON', /não é JSON/],
      [async () => '{"componentes":1}', /não diz se está compilado/],
      [async () => { throw new Error('a cola sumiu'); }, /a ponte lançou/],
      [() => new Promise<string>(() => undefined), /não voltou em/],
    ];
    for (const [compilacaoDosPesos, onde] of casos) {
      const ponte: PonteDoAparelho = {
        responder: async () => '',
        responderComPesos: async () => '',
        diagnostico: async () => '{"disponivel":true}',
        diagnosticoDosPesos: async () => '{"disponivel":true}',
        compilacaoDosPesos,
      };
      const e = await criarLeitorDaCompilacao(ponte, PESOS, { prazoMs: 10, plataforma: 'ios' }).reler();
      expect(e.tipo).toBe('lido');
      if (e.tipo !== 'lido') continue;
      expect(e.compilacao.estado).toBe('ilegivel');
      if (e.compilacao.estado === 'ilegivel') expect(e.compilacao.detalhe).toMatch(onde);
    }
  });
});
