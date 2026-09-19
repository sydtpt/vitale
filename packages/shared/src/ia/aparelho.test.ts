import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { APARELHO_SISTEMA, CLASSES_DE_FALHA } from './fio';
import {
  CHAVES_DO_DIAGNOSTICO,
  MOTIVOS_DO_APARELHO,
  criarMotorDoAparelho,
  ehMotivoDoAparelho,
  lerDiagnosticoDoAparelho,
  pedidoParaAPonte,
  traduzirDoAparelho,
  type TransporteDoAparelho,
} from './aparelho';
import { ehFalha, serializarPedido, type Falha, type Motor, type Pedido, type Resposta } from './motor';
import { ler, type Descritor } from './orquestrar';

/**
 * A tradução da linha da ponte do aparelho (story 5.10) — a tabela inteira, no molde
 * de `nuvem.test.ts`. As linhas aqui são as que o `Engine.swift` escreve (o
 * `testes.swift` da bancada prova o lado de lá, com as mesmas chaves).
 */

const PEDIDO: Pedido = {
  sistema: 'as regras',
  usuario: 'o caso',
  amostragem: 'gulosa',
  saida: { tipo: 'texto' },
  guardrails: 'padrao',
};

/** O que a ponte escreve numa resposta boa. */
const BOA = {
  buildDoSistema: '26A428',
  modelo: 'modelo-do-sistema',
  plataforma: 'macOS 27.0',
  provedor: 'prov-a',
  texto: 'Uma frase sobre o sono.',
  tokens: { entrada: 71, saida: 5 },
};

const linha = (x: unknown): string => JSON.stringify(x);

function comoFalha(x: Resposta | Falha): Falha {
  assert.ok(ehFalha(x), `esperava falha, veio ${JSON.stringify(x)}`);
  return x as Falha;
}

function comoResposta(x: Resposta | Falha): Resposta {
  assert.ok(!ehFalha(x), `esperava resposta, veio ${JSON.stringify(x)}`);
  return x as Resposta;
}

describe('traduzirDoAparelho — a resposta', () => {
  it('a linha boa vira Resposta assinada como aparelho, com plataforma, build e tokens', () => {
    const r = comoResposta(traduzirDoAparelho(linha(BOA)));
    assert.equal(r.texto, BOA.texto);
    assert.deepEqual(r.assinatura, {
      tipo: 'aparelho',
      provedor: 'prov-a',
      modelo: 'modelo-do-sistema',
      plataforma: 'macOS 27.0',
      buildDoSistema: '26A428',
    });
    assert.deepEqual(r.tokens, { entrada: 71, saida: 5 });
  });

  it('sem tokens, a resposta vale e não inventa contagem', () => {
    const { tokens: _t, ...semTokens } = BOA;
    const r = comoResposta(traduzirDoAparelho(linha(semTokens)));
    assert.equal(r.tokens, undefined);
  });

  it('os opcionais malformados ficam de fora — a frase não se perde por diagnóstico', () => {
    const r = comoResposta(traduzirDoAparelho(linha({ ...BOA, plataforma: 7, buildDoSistema: '', tokens: { entrada: -1, saida: 'x' } })));
    assert.deepEqual(r.assinatura, { tipo: 'aparelho', provedor: 'prov-a', modelo: 'modelo-do-sistema' });
    assert.equal(r.tokens, undefined);
  });

  it('o texto com quebra de linha volta inteiro — a quebra viaja escapada no JSON', () => {
    const r = comoResposta(traduzirDoAparelho(linha({ ...BOA, texto: 'uma\nduas' })));
    assert.equal(r.texto, 'uma\nduas');
  });
});

describe('traduzirDoAparelho — a falha', () => {
  it('cada uma das sete classes chega como veio', () => {
    for (const classe of CLASSES_DE_FALHA) {
      const f = comoFalha(traduzirDoAparelho(linha({ classe, detalhe: `o motivo de ${classe}` })));
      assert.equal(f.classe, classe);
      assert.equal(f.detalhe, `o motivo de ${classe}`);
      assert.equal(f.naoMapeado, undefined, classe);
    }
  });

  it('o aparelho fora — não elegível, desligado, modelo não pronto — é indisponivel com o motivo', () => {
    const f = comoFalha(traduzirDoAparelho(linha({ classe: 'indisponivel', detalhe: 'modelo do sistema indisponível: modelNotReady' })));
    assert.equal(f.classe, 'indisponivel');
    assert.match(f.detalhe ?? '', /modelNotReady/);
  });

  it('o naoMapeado da ponte passa adiante, com o nome cru no detalhe', () => {
    const f = comoFalha(traduzirDoAparelho(linha({ classe: 'transitoria', detalhe: 'Mod.Erro.novo: x', naoMapeado: true })));
    assert.equal(f.classe, 'transitoria');
    assert.equal(f.naoMapeado, true);
    assert.match(f.detalhe ?? '', /Mod\.Erro\.novo/);
  });

  it('naoMapeado que não é `true` não marca', () => {
    for (const valor of [false, 'true', 1, null]) {
      assert.equal(comoFalha(traduzirDoAparelho(linha({ classe: 'guarda', naoMapeado: valor }))).naoMapeado, undefined, String(valor));
    }
  });

  it('detalhe vazio ou que não é texto fica de fora', () => {
    assert.equal(comoFalha(traduzirDoAparelho(linha({ classe: 'janela', detalhe: '' }))).detalhe, undefined);
    assert.equal(comoFalha(traduzirDoAparelho(linha({ classe: 'janela', detalhe: 42 }))).detalhe, undefined);
  });
});

describe('traduzirDoAparelho — a linha fora do contrato', () => {
  /** O que a ponte e o núcleo divergindo produz: transitoria, e o anel fica sabendo. */
  function foraDoContrato(entrada: unknown, onde: RegExp): void {
    const f = comoFalha(traduzirDoAparelho(entrada));
    assert.equal(f.classe, 'transitoria', JSON.stringify(entrada));
    assert.equal(f.naoMapeado, true, JSON.stringify(entrada));
    assert.match(f.detalhe ?? '', onde);
  }

  it('linha que não é JSON', () => {
    foraDoContrato('Illegal instruction: 4', /não é JSON/);
    foraDoContrato('', /não é JSON/);
  });

  it('linha que é JSON mas não é objeto', () => {
    for (const x of ['[1,2]', '"texto"', '42', 'null']) foraDoContrato(x, /não é um objeto/);
  });

  it('valor que nem é texto', () => {
    foraDoContrato(undefined, /não é texto/);
    foraDoContrato({ texto: 'x' }, /não é texto/);
  });

  it('classe que o núcleo não conhece', () => {
    foraDoContrato(linha({ classe: 'inventada', detalhe: 'o que a ponte disse' }), /inventada.*o que a ponte disse/);
  });

  it('sem classe e sem texto, ou com texto vazio', () => {
    foraDoContrato(linha({ provedor: 'p', modelo: 'm' }), /não traz texto nem classe/);
    foraDoContrato(linha({ ...BOA, texto: '   ' }), /não traz texto nem classe/);
  });

  it('texto sem assinatura', () => {
    foraDoContrato(linha({ texto: 'x' }), /sem assinatura/);
    foraDoContrato(linha({ ...BOA, provedor: '' }), /sem assinatura/);
    foraDoContrato(linha({ ...BOA, modelo: 3 }), /sem assinatura/);
  });
});

describe('lerDiagnosticoDoAparelho (story 5.9)', () => {
  /** O que a ponte escreveu no Mac em 19/09 (`aparelho:testar`). */
  const PRONTO = { buildDoSistema: '26A428', disponivel: true, janela: 4096, plataforma: 'macOS 27.0', variante: 'AFM 3 Core' };

  it('disponível: variante, janela e a assinatura do sistema', () => {
    assert.deepEqual(lerDiagnosticoDoAparelho(linha(PRONTO)), {
      estado: 'disponivel',
      variante: 'AFM 3 Core',
      janela: 4096,
      plataforma: 'macOS 27.0',
      buildDoSistema: '26A428',
    });
  });

  it('disponível antes do 27: sem variante, e continua disponível', () => {
    const { variante: _v, ...semVariante } = PRONTO;
    const d = lerDiagnosticoDoAparelho(linha(semVariante));
    assert.equal(d.estado, 'disponivel');
    assert.equal('variante' in d, false);
  });

  it('os opcionais malformados ficam de fora — "o modelo atende" não se perde por eles', () => {
    for (const [campo, valor] of [
      ['variante', '   '],
      ['variante', 3],
      ['janela', 0],
      ['janela', -1],
      ['janela', 4096.5],
      ['janela', '4096'],
    ] as const) {
      const d = lerDiagnosticoDoAparelho(linha({ ...PRONTO, [campo]: valor }));
      assert.equal(d.estado, 'disponivel', `${campo}=${String(valor)}`);
      assert.equal(campo in d, false, `${campo}=${String(valor)} entrou`);
    }
  });

  it('cada motivo de indisponibilidade chega como a ponte o disse — as palavras são do app', () => {
    for (const motivo of ['deviceNotEligible', 'appleIntelligenceNotEnabled', 'modelNotReady', 'sistemaAntigo', 'Mod.Motivo: .novo']) {
      assert.deepEqual(lerDiagnosticoDoAparelho(linha({ disponivel: false, motivo, plataforma: 'iOS 27.0', buildDoSistema: '27A1' })), {
        estado: 'indisponivel',
        motivo,
        plataforma: 'iOS 27.0',
        buildDoSistema: '27A1',
      });
    }
  });

  it('indisponível ignora variante e janela que tenham vindo junto', () => {
    const d = lerDiagnosticoDoAparelho(linha({ disponivel: false, motivo: 'modelNotReady', variante: 'x', janela: 9 }));
    assert.deepEqual(d, { estado: 'indisponivel', motivo: 'modelNotReady' });
  });

  it('fora do contrato é ilegível, nunca exceção', () => {
    const casos: readonly (readonly [unknown, RegExp])[] = [
      [undefined, /não é texto/],
      [{ disponivel: true }, /não é texto/],
      ['Illegal instruction: 4', /não é JSON/],
      ['', /não é JSON/],
      ['[true]', /não é um objeto/],
      ['null', /não é um objeto/],
      [linha({ variante: 'x' }), /não diz se o modelo atende/],
      [linha({ disponivel: 'true' }), /não diz se o modelo atende/],
      [linha({ disponivel: false }), /não diz por quê/],
      [linha({ disponivel: false, motivo: '' }), /não diz por quê/],
      [linha({ disponivel: false, motivo: 7 }), /não diz por quê/],
    ];
    for (const [entrada, onde] of casos) {
      const d = lerDiagnosticoDoAparelho(entrada);
      assert.equal(d.estado, 'ilegivel', JSON.stringify(entrada));
      if (d.estado === 'ilegivel') assert.match(d.detalhe, onde, JSON.stringify(entrada));
    }
  });

  it('a linha de reserva do Engine (o codificador falhou) é ilegível, não um motivo desconhecido', () => {
    // O literal de `Engine.diagnosticoDeReserva`; a guarda do contrato passa o do Swift por aqui também.
    const d = lerDiagnosticoDoAparelho('{"erro":"a ponte não codificou o diagnóstico"}');
    assert.equal(d.estado, 'ilegivel');
    if (d.estado === 'ilegivel') assert.match(d.detalhe, /não codificou/);
  });

  it('os motivos que a ponte conhece são os quatro, e só eles', () => {
    assert.deepEqual([...MOTIVOS_DO_APARELHO].sort(), ['appleIntelligenceNotEnabled', 'deviceNotEligible', 'modelNotReady', 'sistemaAntigo']);
    for (const m of MOTIVOS_DO_APARELHO) assert.equal(ehMotivoDoAparelho(m), true, m);
    for (const m of ['', 'constructor', 'toString', 'Mod.Motivo: .novo', 'modelnotready']) assert.equal(ehMotivoDoAparelho(m), false, m);
  });

  it('as chaves lidas são as do contrato — a guarda as compara com o Swift', () => {
    assert.deepEqual([...CHAVES_DO_DIAGNOSTICO].sort(), ['buildDoSistema', 'disponivel', 'janela', 'motivo', 'plataforma', 'variante']);
  });
});

describe('criarMotorDoAparelho', () => {
  it('manda à ponte a string de serializarPedido — o pedido canônico, numa linha', async () => {
    const vistas: string[] = [];
    const motor = criarMotorDoAparelho(async (p) => {
      vistas.push(p);
      return linha(BOA);
    });
    comoResposta(await motor(PEDIDO));
    assert.deepEqual(vistas, [pedidoParaAPonte(PEDIDO)]);
    const enviado = vistas[0] ?? '';
    assert.equal(enviado.includes('\n'), false, 'a linha do pedido atravessou duas linhas');
    // É a mesma forma canônica do hash: chaves ordenadas, o pedido inteiro.
    assert.equal(enviado, serializarPedido(PEDIDO, 0));
    const lido = JSON.parse(enviado) as Record<string, unknown>;
    assert.deepEqual(Object.keys(lido), [...Object.keys(lido)].sort());
    assert.equal(lido['sistema'], 'as regras');
    assert.deepEqual(lido['saida'], { tipo: 'texto' });
  });

  it('o pedido com esquema viaja com o esquema — é ele que a ponte converte', async () => {
    const guiado: Pedido = {
      ...PEDIDO,
      saida: { tipo: 'esquema', esquema: { type: 'object', properties: { d: { type: 'string', enum: ['a', 'b'] } }, required: ['d'] } },
      guardrails: 'padrao',
    };
    const lido = JSON.parse(pedidoParaAPonte(guiado)) as { saida: unknown };
    assert.deepEqual(lido.saida, guiado.saida);
  });

  it('nunca rejeita: o transporte que lança vira transitoria não mapeada, com o nome cru', async () => {
    const motor = criarMotorDoAparelho(async () => {
      throw new TypeError('o processo sumiu');
    });
    const f = comoFalha(await motor(PEDIDO));
    assert.equal(f.classe, 'transitoria');
    assert.equal(f.naoMapeado, true);
    assert.match(f.detalhe ?? '', /TypeError: o processo sumiu/);
  });

  it('o prazo e a CLI ausente chegam como linha de falha do hospedeiro, e a classe dele vale', async () => {
    for (const [classe, detalhe] of [
      ['transitoria', 'o prazo de 60 s estourou'],
      ['indisponivel', 'a CLI não compilou'],
    ] as const) {
      const motor = criarMotorDoAparelho(async () => linha({ classe, detalhe }));
      const f = comoFalha(await motor(PEDIDO));
      assert.equal(f.classe, classe);
      assert.equal(f.detalhe, detalhe);
    }
  });
});

describe('pelo orquestrador, em medição', () => {
  /** Um descritor mínimo, só para passar pela porta de verdade. */
  const eco: Descritor<null, string> = {
    recurso: 'saude-do-sono',
    versao: 1,
    regimeDeNumeros: 'interpolado',
    regimeMaximo: 'aparelho',
    cadeiaPadrao: ['sem-modelo'],
    grava: false,
    montarPedido: () => PEDIDO,
    interpretar: (r) => r.texto,
    conferir: () => ({ ok: true }),
    montarFrase: (v) => v,
    semModelo: () => ({ frase: 'o piso' }),
  };

  async function medir(transporte: TransporteDoAparelho) {
    let t = 0;
    const motores: Record<string, Motor> = { [APARELHO_SISTEMA]: criarMotorDoAparelho(transporte) };
    return ler(eco, null, {
      modo: 'medicao',
      motor: APARELHO_SISTEMA,
      motorPara: (id) => motores[id],
      registrar: () => undefined,
      agora: () => new Date((t += 100)),
    });
  }

  it('a assinatura `aparelho` passa pela porta — o orquestrador recusaria outro tipo', async () => {
    const m = await medir(async () => linha(BOA));
    assert.equal(m.tipo, 'tentativa');
    if (m.tipo !== 'tentativa') return;
    assert.equal(m.desfecho, 'ok');
    assert.equal(m.resposta?.assinatura.tipo, 'aparelho');
    assert.equal(m.resposta?.assinatura.buildDoSistema, '26A428');
    assert.deepEqual(m.resposta?.tokens, { entrada: 71, saida: 5 });
  });

  it('a falha da ponte é o desfecho, com o detalhe na trilha', async () => {
    const m = await medir(async () => linha({ classe: 'janela', detalhe: 'o pedido ocupa 5000 tokens' }));
    assert.equal(m.tipo, 'tentativa');
    if (m.tipo !== 'tentativa') return;
    assert.equal(m.desfecho, 'janela');
    assert.equal(m.trilha[0]?.detalhe, 'o pedido ocupa 5000 tokens');
  });
});
