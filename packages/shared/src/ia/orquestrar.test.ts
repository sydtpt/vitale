import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { APARELHO_SISTEMA, lerMotorId, NUVEM_PADRAO, SEM_MODELO, type ClasseDeFalha, type MotorId } from './fio';
import { hashDoPedido, resolverCadeia, type Cadeia, type Falha, type Motor, type Pedido, type Resposta } from './motor';
import {
  ler,
  type Descritor,
  type EventoDoAnel,
  type Leitura,
  type LeituraDoMotor,
  type LeituraDoPiso,
  type Medicao,
  type OpcoesDeMedicao,
  type OpcoesDeProduto,
  type ProblemaDaConferencia,
} from './orquestrar';
import type { Problema } from './verificar';

/**
 * A matriz de I/O da story 5.1, linha a linha, com motores falsos e relógio
 * injetado. O descritor falso é o menor que exercita tudo: a conferência reprova
 * algarismo (como o regime interpolado) e marca recusa quando o texto recusa.
 */

interface Fatos {
  readonly assunto: string;
  readonly mudo?: boolean;
}

interface Lido {
  readonly texto: string;
}

const FATOS: Fatos = { assunto: 'a noite' };

const pedidoDe = (usuario: string): Pedido => ({
  sistema: 'Escreva uma frase.',
  usuario,
  amostragem: 'gulosa',
  saida: { tipo: 'texto' },
  guardrails: 'padrao',
});

const PEDIDO = pedidoDe('Fale de a noite.');
const CURTO = pedidoDe('Curto: a noite.');

function descritor(extra: Partial<Descritor<Fatos, Lido>> = {}): Descritor<Fatos, Lido> {
  return {
    recurso: 'saude-do-sono',
    versao: 3,
    regimeDeNumeros: 'interpolado',
    regimeMaximo: 'nuvem',
    cadeiaPadrao: [APARELHO_SISTEMA, SEM_MODELO],
    grava: false,
    montarPedido: (f) => (f.mudo ? null : pedidoDe(`Fale de ${f.assunto}.`)),
    interpretar: (r) => ({ texto: r.texto }),
    conferir: (v) => {
      if (/não posso/i.test(v.texto)) {
        return { ok: false, problemas: [{ regra: 'recusa', detalhe: 'o texto recusa' }], recusa: true };
      }
      if (/\d/.test(v.texto)) return { ok: false, problemas: [{ regra: 'numero', detalhe: 'algarismo' }] };
      return { ok: true };
    },
    montarFrase: (v, f) => `${v.texto} (${f.assunto})`,
    semModelo: (f) => ({ frase: `Template sobre ${f.assunto}.` }),
    ...extra,
  };
}

const resposta = (texto: string): Resposta => ({
  texto,
  assinatura: { tipo: 'nuvem', provedor: 'prov-a', modelo: 'modelo-1' },
  tokens: { entrada: 10, saida: 5 },
});

const INICIO = Date.UTC(2026, 8, 10, 12, 0, 0);

function relogio() {
  let t = INICIO;
  return {
    agora: () => new Date(t),
    avancar: (ms: number) => {
      t += ms;
    },
  };
}

type Relogio = ReturnType<typeof relogio>;

/** Um passo do roteiro: o que o motor devolve, lança, ou um valor fora da porta. */
type Passo = Resposta | Falha | { readonly lanca: unknown } | { readonly foraDaPorta: unknown };

/** Um motor que segue o roteiro (o último passo se repete) e leva `ms` por chamada. */
function motorFalso(r: Relogio, roteiro: readonly Passo[], ms = 100) {
  const pedidos: Pedido[] = [];
  const motor: Motor = async (p) => {
    pedidos.push(p);
    r.avancar(ms);
    const passo = roteiro[Math.min(pedidos.length - 1, roteiro.length - 1)];
    if ('lanca' in passo) throw passo.lanca;
    if ('foraDaPorta' in passo) return passo.foraDaPorta as Resposta;
    return passo;
  };
  return { motor, pedidos };
}

/**
 * Uma borda de verdade assina com o próprio tipo: a ponte diz `aparelho`, o motor
 * de nuvem diz `nuvem`. O hospedeiro falso faz o mesmo com a resposta do roteiro,
 * para o tipo da assinatura casar com o id em que o motor foi entregue. O teste do
 * desencontro (P3) monta o seu hospedeiro sem isto.
 */
function assinarComo(id: MotorId, m: Motor): Motor {
  const tipo = lerMotorId(id)?.tipo;
  return async (p) => {
    const r = await m(p);
    const a = (r as { assinatura?: unknown }).assinatura;
    if ((tipo === 'aparelho' || tipo === 'nuvem') && typeof a === 'object' && a !== null) {
      return { ...(r as Resposta), assinatura: { ...(a as Resposta['assinatura']), tipo } };
    }
    return r;
  };
}

/** O hospedeiro falso: entrega motores por id, guarda o anel e quem foi pedido. */
function hospedeiro(motores: Readonly<Record<string, Motor | undefined>>, r: Relogio = relogio()) {
  const eventos: EventoDoAnel[] = [];
  const pedidosA: MotorId[] = [];
  const comuns = {
    motorPara: (id: MotorId) => {
      pedidosA.push(id);
      const m = motores[id];
      return m ? assinarComo(id, m) : undefined;
    },
    registrar: (e: EventoDoAnel) => {
      eventos.push(e);
    },
    agora: r.agora,
  };
  return {
    eventos,
    pedidosA,
    produto: (cadeia: Cadeia): OpcoesDeProduto => ({ modo: 'produto', cadeia, ...comuns }),
    medicao: (motor: MotorId): OpcoesDeMedicao => ({ modo: 'medicao', motor, ...comuns }),
  };
}

const CATALOGO: MotorId[] = [APARELHO_SISTEMA, NUVEM_PADRAO, 'aparelho:local/pesos-a', 'nuvem:prov-a/modelo-1'];

/** Cadeias só nascem da resolução — é justamente o que o tipo marcado garante. */
const cadeia = (padrao: readonly MotorId[], preferencia?: string): Cadeia =>
  resolverCadeia({ cadeiaPadrao: padrao, regimeMaximo: 'nuvem' }, preferencia, CATALOGO);

const DOIS = (): Cadeia => cadeia([NUVEM_PADRAO, APARELHO_SISTEMA, SEM_MODELO]);
const TRES = (): Cadeia => cadeia(['nuvem:prov-a/modelo-1', 'aparelho:local/pesos-a', APARELHO_SISTEMA, SEM_MODELO]);

function doMotor<V>(l: Leitura<V>): LeituraDoMotor<V> {
  assert.equal(l.origem, 'motor', JSON.stringify(l));
  return l as LeituraDoMotor<V>;
}

function doPiso<V>(l: Leitura<V>): LeituraDoPiso {
  assert.equal(l.origem, 'piso', JSON.stringify(l));
  return l as LeituraDoPiso;
}

function tentativa<V>(m: Medicao<V>): Extract<Medicao<V>, { tipo: 'tentativa' }> {
  assert.equal(m.tipo, 'tentativa', JSON.stringify(m));
  return m as Extract<Medicao<V>, { tipo: 'tentativa' }>;
}

describe('as cadeias do teste', () => {
  it('são as que a resolução constrói', () => {
    assert.deepEqual([...DOIS()], [NUVEM_PADRAO, APARELHO_SISTEMA, SEM_MODELO]);
    assert.deepEqual([...TRES()], ['nuvem:prov-a/modelo-1', 'aparelho:local/pesos-a', APARELHO_SISTEMA, SEM_MODELO]);
  });
});

describe('modo produto — a matriz', () => {
  it('resposta boa: o motor escreve; a assinatura ganha versão e instante; a trilha tem 1', async () => {
    const r = relogio();
    const nuvem = motorFalso(r, [resposta('Uma frase sobre o sono.')]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor }, r);
    const l = doMotor(await ler(descritor(), FATOS, h.produto(cadeia([NUVEM_PADRAO, SEM_MODELO]))));

    assert.equal(l.frase, 'Uma frase sobre o sono. (a noite)');
    assert.deepEqual(l.valor, { texto: 'Uma frase sobre o sono.' });
    assert.equal(l.motor, NUVEM_PADRAO);
    assert.deepEqual(l.resposta.assinatura, {
      tipo: 'nuvem', provedor: 'prov-a', modelo: 'modelo-1', versaoDoDescritor: 3, instante: '2026-09-10T12:00:00.100Z',
    });
    assert.deepEqual(l.resposta.tokens, { entrada: 10, saida: 5 });
    assert.equal(l.resposta.texto, 'Uma frase sobre o sono.');
    assert.deepEqual(l.trilha, [{ motor: NUVEM_PADRAO, desfecho: 'ok', ms: 100 }]);
    assert.deepEqual(nuvem.pedidos, [PEDIDO]);
    assert.deepEqual(h.pedidosA, [NUVEM_PADRAO]);
  });

  it('pedido mudo: nenhuma chamada; piso com causa mudo', async () => {
    const r = relogio();
    const nuvem = motorFalso(r, [resposta('nunca')]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor }, r);
    const l = doPiso(await ler(descritor(), { ...FATOS, mudo: true }, h.produto(cadeia([NUVEM_PADRAO, SEM_MODELO]))));

    assert.equal(l.causa, 'mudo');
    assert.deepEqual(l, { origem: 'piso', causa: 'mudo', trilha: [], frase: 'Template sobre a noite.' });
    assert.deepEqual(nuvem.pedidos, []);
    assert.deepEqual(h.pedidosA, []);
  });

  it('só template: a cadeia é [sem-modelo]; nenhuma chamada; piso com causa preferencia', async () => {
    const c = cadeia([NUVEM_PADRAO, SEM_MODELO], SEM_MODELO);
    assert.deepEqual([...c], [SEM_MODELO]);
    const r = relogio();
    const nuvem = motorFalso(r, [resposta('nunca')]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor }, r);
    const l = doPiso(await ler(descritor(), FATOS, h.produto(c)));

    assert.deepEqual(l, { origem: 'piso', causa: 'preferencia', trilha: [], frase: 'Template sobre a noite.' });
    assert.deepEqual(nuvem.pedidos, []);
    assert.deepEqual(h.pedidosA, []);
  });

  it('piso com ausência é piso válido', async () => {
    const d = descritor({ semModelo: () => ({ ausencia: 'período sem noites medidas' }) });
    const l = doPiso(await ler(d, { ...FATOS, mudo: true }, hospedeiro({}).produto(DOIS())));
    assert.deepEqual(l, { origem: 'piso', causa: 'mudo', trilha: [], ausencia: 'período sem noites medidas' });
  });

  it('motor ausente: tentativa sintética indisponivel, e a cadeia recua', async () => {
    const r = relogio();
    const aparelho = motorFalso(r, [resposta('Escrita no aparelho.')]);
    const h = hospedeiro({ [APARELHO_SISTEMA]: aparelho.motor }, r);
    const l = doMotor(await ler(descritor(), FATOS, h.produto(DOIS())));

    assert.equal(l.motor, APARELHO_SISTEMA);
    assert.equal(l.trilha.length, 2);
    assert.equal(l.trilha[0].motor, NUVEM_PADRAO);
    assert.equal(l.trilha[0].desfecho, 'indisponivel');
    assert.equal(l.trilha[0].sintetica, true);
    assert.equal(l.trilha[0].ms, 0);
    assert.deepEqual(l.trilha[1], { motor: APARELHO_SISTEMA, desfecho: 'ok', ms: 100 });
    assert.deepEqual(h.pedidosA, [NUVEM_PADRAO, APARELHO_SISTEMA]);
  });

  it('nenhum motor presente: todos sintéticos, e o piso diz indisponivel', async () => {
    const h = hospedeiro({});
    const l = doPiso(await ler(descritor(), FATOS, h.produto(DOIS())));
    assert.equal(l.causa, 'indisponivel');
    assert.deepEqual(l.trilha.map((t) => [t.motor, t.desfecho, t.sintetica]), [
      [NUVEM_PADRAO, 'indisponivel', true],
      [APARELHO_SISTEMA, 'indisponivel', true],
    ]);
  });

  for (const classe of ['indisponivel', 'capacidade'] as const) {
    it(`recua: ${classe} no primeiro, e o segundo escreve`, async () => {
      const r = relogio();
      const nuvem = motorFalso(r, [{ classe }], 100);
      const aparelho = motorFalso(r, [resposta('Escrita no aparelho.')], 250);
      const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor }, r);
      const l = doMotor(await ler(descritor(), FATOS, h.produto(DOIS())));

      assert.equal(l.motor, APARELHO_SISTEMA);
      assert.equal(l.frase, 'Escrita no aparelho. (a noite)');
      assert.deepEqual(l.trilha, [
        { motor: NUVEM_PADRAO, desfecho: classe, ms: 100 },
        { motor: APARELHO_SISTEMA, desfecho: 'ok', ms: 250 },
      ]);
      // O mesmo pedido nos dois: recuar não remonta nada.
      assert.deepEqual(nuvem.pedidos, [PEDIDO]);
      assert.deepEqual(aparelho.pedidos, [PEDIDO]);
    });
  }

  it('esgotada: todos recuam; o piso leva a classe do último, e a trilha, todos', async () => {
    const r = relogio();
    const casos: [ClasseDeFalha, ClasseDeFalha, ClasseDeFalha][] = [
      ['indisponivel', 'capacidade', 'indisponivel'],
      ['capacidade', 'indisponivel', 'capacidade'],
    ];
    for (const [a, b, c] of casos) {
      const h = hospedeiro({
        'nuvem:prov-a/modelo-1': motorFalso(r, [{ classe: a }]).motor,
        'aparelho:local/pesos-a': motorFalso(r, [{ classe: b }]).motor,
        [APARELHO_SISTEMA]: motorFalso(r, [{ classe: c }]).motor,
      }, r);
      const l = doPiso(await ler(descritor(), FATOS, h.produto(TRES())));
      assert.equal(l.causa, c);
      assert.deepEqual(l.trilha.map((t) => t.desfecho), [a, b, c]);
      assert.equal('frase' in l && l.frase, 'Template sobre a noite.');
    }
  });

  describe('janela', () => {
    const comCurto = (curto: (f: Fatos) => Pedido | null = () => CURTO) => descritor({ pedidoCurto: curto });

    it('repete uma vez, no mesmo motor, com o pedido curto', async () => {
      const r = relogio();
      const nuvem = motorFalso(r, [{ classe: 'janela' }, resposta('Coube no curto.')]);
      const aparelho = motorFalso(r, [resposta('nunca')]);
      const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor }, r);
      const l = doMotor(await ler(comCurto(), FATOS, h.produto(DOIS())));

      assert.equal(l.motor, NUVEM_PADRAO);
      assert.deepEqual(l.trilha, [
        { motor: NUVEM_PADRAO, desfecho: 'janela', ms: 100 },
        { motor: NUVEM_PADRAO, desfecho: 'ok', ms: 100, curto: true },
      ]);
      assert.deepEqual(nuvem.pedidos, [PEDIDO, CURTO]);
      assert.deepEqual(aparelho.pedidos, []);
      // A janela que foi repetida não é permanente: não há o que investigar.
      assert.equal(h.eventos[0].pedido, undefined);
      assert.equal(h.eventos[0].hashDoAnexado, undefined);
    });

    it('a segunda janela é permanente: piso janela, sem recuar; o anel recebe o curto, com o hash dele', async () => {
      const r = relogio();
      const nuvem = motorFalso(r, [{ classe: 'janela' }]);
      const aparelho = motorFalso(r, [resposta('nunca')]);
      const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor }, r);
      const l = doPiso(await ler(comCurto(), FATOS, h.produto(DOIS())));

      assert.equal(l.causa, 'janela');
      assert.deepEqual(l.trilha.map((t) => [t.desfecho, t.curto]), [['janela', undefined], ['janela', true]]);
      assert.equal(nuvem.pedidos.length, 2);
      assert.deepEqual(aparelho.pedidos, []);
      // P1: a janela que esgotou é permanente (AD-4), e o pedido é a prova.
      const e = h.eventos[0];
      assert.deepEqual(e.pedido, CURTO);
      assert.equal(e.hash, hashDoPedido(PEDIDO, 3));
      assert.equal(e.hashDoAnexado, hashDoPedido(CURTO, 3));
    });

    it('janela → curto → reprovada: o anel anexa o curto com o hash do curto, e guarda o hash da execução', async () => {
      const r = relogio();
      const nuvem = motorFalso(r, [{ classe: 'janela' }, resposta('Tem 3 algarismos.')]);
      const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor }, r);
      const l = doPiso(await ler(comCurto(), FATOS, h.produto(DOIS())));

      assert.equal(l.causa, 'reprovada');
      const e = h.eventos[0];
      // P2: quem lê o anel recalcula o hash a partir do corpo que tem na mão.
      assert.deepEqual(e.pedido, CURTO);
      assert.equal(e.hashDoAnexado, hashDoPedido(e.pedido!, 3));
      assert.equal(e.hash, hashDoPedido(PEDIDO, 3));
      assert.notEqual(e.hash, e.hashDoAnexado);
    });

    it('sem pedido curto é permanente: uma tentativa só', async () => {
      const semCurto = descritor();
      assert.equal(semCurto.pedidoCurto, undefined);
      for (const d of [semCurto, comCurto(() => null)]) {
        const r = relogio();
        const nuvem = motorFalso(r, [{ classe: 'janela' }, resposta('nunca')]);
        const aparelho = motorFalso(r, [resposta('nunca')]);
        const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor }, r);
        const l = doPiso(await ler(d, FATOS, h.produto(DOIS())));

        assert.equal(l.causa, 'janela');
        assert.equal(l.trilha.length, 1);
        assert.equal(nuvem.pedidos.length, 1);
        assert.deepEqual(aparelho.pedidos, []);
        // P1: sem curto, a janela é permanente desde a primeira — e o anexado é o pleno.
        assert.deepEqual(h.eventos[0].pedido, PEDIDO);
        assert.equal(h.eventos[0].hashDoAnexado, h.eventos[0].hash);
      }
    });

    it('a repetição curta segue a própria classe: indisponivel recua', async () => {
      const r = relogio();
      const nuvem = motorFalso(r, [{ classe: 'janela' }, { classe: 'indisponivel' }]);
      const aparelho = motorFalso(r, [resposta('Escrita no aparelho.')]);
      const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor }, r);
      const l = doMotor(await ler(comCurto(), FATOS, h.produto(DOIS())));
      assert.equal(l.motor, APARELHO_SISTEMA);
      assert.deepEqual(l.trilha.map((t) => t.desfecho), ['janela', 'indisponivel', 'ok']);
    });
  });

  for (const classe of ['guarda', 'recusa-do-modelo', 'saida-invalida'] as const) {
    it(`permanente: ${classe} não repete nem recua; o anel recebe o pedido`, async () => {
      const r = relogio();
      const nuvem = motorFalso(r, [{ classe, detalhe: 'texto cru do fornecedor' }]);
      const aparelho = motorFalso(r, [resposta('nunca')]);
      const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor }, r);
      const l = doPiso(await ler(descritor(), FATOS, h.produto(DOIS())));

      assert.equal(l.causa, classe);
      assert.deepEqual(l.trilha, [{ motor: NUVEM_PADRAO, desfecho: classe, ms: 100, detalhe: 'texto cru do fornecedor' }]);
      assert.equal(nuvem.pedidos.length, 1);
      assert.deepEqual(h.pedidosA, [NUVEM_PADRAO]);
      assert.equal(h.eventos.length, 1);
      assert.deepEqual(h.eventos[0].pedido, PEDIDO);
      assert.equal(h.eventos[0].causa, classe);
    });
  }

  it('a interpretação que devolve Falha decide do mesmo jeito que o motor', async () => {
    const r = relogio();
    const d = descritor({ interpretar: () => ({ classe: 'saida-invalida', detalhe: 'fora do esquema' }) });
    const nuvem = motorFalso(r, [resposta('{"x":1}')]);
    const aparelho = motorFalso(r, [resposta('nunca')]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor }, r);
    const l = doPiso(await ler(d, FATOS, h.produto(DOIS())));
    assert.equal(l.causa, 'saida-invalida');
    assert.equal(l.trilha[0].detalhe, 'fora do esquema');
    assert.deepEqual(aparelho.pedidos, []);
    assert.deepEqual(h.eventos[0].pedido, PEDIDO);
  });

  it('reprovada: os problemas vão na trilha; piso reprovada, sem recuar; o anel recebe o pedido', async () => {
    const r = relogio();
    const nuvem = motorFalso(r, [resposta('Você dormiu 7 horas.')]);
    const aparelho = motorFalso(r, [resposta('nunca')]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor }, r);
    const l = doPiso(await ler(descritor(), FATOS, h.produto(DOIS())));

    assert.equal(l.causa, 'reprovada');
    assert.deepEqual(l.trilha, [
      { motor: NUVEM_PADRAO, desfecho: 'reprovada', ms: 100, problemas: [{ regra: 'numero', detalhe: 'algarismo' }] },
    ]);
    assert.deepEqual(aparelho.pedidos, []);
    assert.deepEqual(h.eventos[0].pedido, PEDIDO);
  });

  it('recusa em texto: a conferência a marca, e a causa é recusa-do-modelo', async () => {
    const r = relogio();
    const nuvem = motorFalso(r, [resposta('Não posso comentar dados de saúde.')]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor }, r);
    const l = doPiso(await ler(descritor(), FATOS, h.produto(DOIS())));

    assert.equal(l.causa, 'recusa-do-modelo');
    assert.equal(l.trilha[0].desfecho, 'recusa-do-modelo');
    assert.deepEqual(l.trilha[0].problemas, [{ regra: 'recusa', detalhe: 'o texto recusa' }]);
    assert.deepEqual(h.eventos[0].pedido, PEDIDO);
  });

  it('passageira: transitoria não repete nem recua; o anel fica sem o pedido', async () => {
    const r = relogio();
    const nuvem = motorFalso(r, [{ classe: 'transitoria', detalhe: 'HTTP 429' }, resposta('nunca')]);
    const aparelho = motorFalso(r, [resposta('nunca')]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor }, r);
    const l = doPiso(await ler(descritor(), FATOS, h.produto(DOIS())));

    assert.equal(l.causa, 'transitoria');
    assert.equal(nuvem.pedidos.length, 1);
    assert.deepEqual(aparelho.pedidos, []);
    assert.equal(h.eventos[0].pedido, undefined);
    assert.equal(h.eventos[0].causa, 'transitoria');
  });

  it('erro não mapeado: continua transitoria, e o anel recebe o pedido', async () => {
    const r = relogio();
    const nuvem = motorFalso(r, [{ classe: 'transitoria', detalhe: 'HTTP 418', naoMapeado: true }]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor }, r);
    const l = doPiso(await ler(descritor(), FATOS, h.produto(DOIS())));

    assert.equal(l.causa, 'transitoria');
    assert.equal(l.trilha[0].naoMapeado, true);
    assert.deepEqual(h.eventos[0].pedido, PEDIDO);
  });

  it('não mapeado que recua ainda leva o pedido ao anel, mesmo que o seguinte escreva', async () => {
    const r = relogio();
    const nuvem = motorFalso(r, [{ classe: 'indisponivel', naoMapeado: true }]);
    const aparelho = motorFalso(r, [resposta('Escrita no aparelho.')]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor }, r);
    doMotor(await ler(descritor(), FATOS, h.produto(DOIS())));
    assert.deepEqual(h.eventos[0].pedido, PEDIDO);
    assert.equal(h.eventos[0].causa, undefined);
  });

  describe('defeito', () => {
    const erro = new Error('explodiu no hospedeiro');
    const casos: [string, Motor][] = [
      ['lança síncrono', () => { throw erro; }],
      ['rejeita', async () => { throw erro; }],
    ];
    for (const [nome, quebrado] of casos) {
      it(`o motor ${nome}: piso defeito, nunca transitoria; o anel recebe a pilha e o pedido`, async () => {
        const r = relogio();
        const aparelho = motorFalso(r, [resposta('nunca')]);
        const h = hospedeiro({ [NUVEM_PADRAO]: quebrado, [APARELHO_SISTEMA]: aparelho.motor }, r);
        const l = doPiso(await ler(descritor(), FATOS, h.produto(DOIS())));

        assert.equal(l.causa, 'defeito');
        assert.equal(l.trilha.length, 1);
        assert.equal(l.trilha[0].desfecho, 'defeito');
        assert.match(l.trilha[0].detalhe ?? '', /explodiu no hospedeiro/);
        assert.deepEqual(aparelho.pedidos, []);
        assert.equal(h.eventos.length, 1);
        assert.match(h.eventos[0].pilha ?? '', /explodiu no hospedeiro/);
        assert.match(h.eventos[0].pilha ?? '', /\n\s+at /);   // é a pilha, não só a mensagem
        assert.deepEqual(h.eventos[0].pedido, PEDIDO);
        assert.equal(h.eventos[0].causa, 'defeito');
      });
    }

    it('lançar algo que não é Error também é defeito', async () => {
      const h = hospedeiro({ [NUVEM_PADRAO]: () => { throw 'cadeia crua'; } });
      const l = doPiso(await ler(descritor(), FATOS, h.produto(DOIS())));
      assert.equal(l.causa, 'defeito');
      assert.equal(h.eventos[0].pilha, 'cadeia crua');
    });

    it('um valor fora da porta (nem resposta, nem falha com classe) é defeito', async () => {
      for (const fora of [{}, { classe: 'erro-inventado' }, null, 'texto solto', { texto: 'sem assinatura' }]) {
        const r = relogio();
        const h = hospedeiro({ [NUVEM_PADRAO]: motorFalso(r, [{ foraDaPorta: fora }]).motor }, r);
        const l = doPiso(await ler(descritor(), FATOS, h.produto(DOIS())));
        assert.equal(l.causa, 'defeito', JSON.stringify(fora));
      }
    });

    it('o ponto de injeção que lança também é defeito', async () => {
      const o: OpcoesDeProduto = {
        ...hospedeiro({}).produto(DOIS()),
        motorPara: () => {
          throw new Error('catálogo corrompido');
        },
      };
      const l = doPiso(await ler(descritor(), FATOS, o));
      assert.equal(l.causa, 'defeito');
      assert.equal(l.trilha.length, 1);
    });

    it('resposta sem texto, ou com assinatura incompleta, está fora da porta: defeito', async () => {
      const casos: [string, unknown][] = [
        ['texto vazio', { texto: '', assinatura: { tipo: 'nuvem', provedor: 'p', modelo: 'm' } }],
        ['texto em branco', { texto: '   ', assinatura: { tipo: 'nuvem', provedor: 'p', modelo: 'm' } }],
        ['sem provedor', { texto: 'Algo.', assinatura: { tipo: 'nuvem', provedor: '', modelo: 'm' } }],
        ['sem modelo', { texto: 'Algo.', assinatura: { tipo: 'nuvem', provedor: 'p' } }],
        ['tipo desconhecido', { texto: 'Algo.', assinatura: { tipo: 'servidor', provedor: 'p', modelo: 'm' } }],
      ];
      for (const [nome, fora] of casos) {
        // Hospedeiro cru: sem a assinatura automática, que mascararia o tipo desconhecido.
        const r = relogio();
        const cru = motorFalso(r, [{ foraDaPorta: fora }]).motor;
        const o: OpcoesDeProduto = {
          ...hospedeiro({}, r).produto(DOIS()),
          motorPara: (id) => (id === NUVEM_PADRAO ? cru : undefined),
        };
        const l = doPiso(await ler(descritor(), FATOS, o));
        assert.equal(l.causa, 'defeito', nome);
        assert.equal(l.trilha[0].desfecho, 'defeito', nome);
      }
    });

    it('a assinatura de outro tipo que o id pedido é defeito — a AD-5 não depende da honestidade do hospedeiro', async () => {
      // Um ponto de injeção que entrega a nuvem no lugar do aparelho, sem a
      // assinatura automática do hospedeiro falso: o dado teria saído do telefone.
      const r = relogio();
      const naNuvem = motorFalso(r, [resposta('Escrita na nuvem, dita como aparelho.')]);
      const o: OpcoesDeProduto = {
        ...hospedeiro({}, r).produto(cadeia([APARELHO_SISTEMA, SEM_MODELO])),
        motorPara: (id) => (id === APARELHO_SISTEMA ? naNuvem.motor : undefined),
      };
      const l = doPiso(await ler(descritor(), FATOS, o));
      assert.equal(l.causa, 'defeito');
      assert.match(l.trilha[0].detalhe ?? '', /a assinatura diz nuvem, e o motor pedido é aparelho/);
    });
  });

  it('campos a mais do motor não entram no resultado; o piso não sobrescreve o discriminante', async () => {
    const r = relogio();
    const comExtra = {
      ...resposta('Escrita com campos a mais.'),
      segredo: 'não devia vazar',
      assinatura: { tipo: 'nuvem', provedor: 'prov-a', modelo: 'modelo-1', chave: 'também não' },
    };
    const h = hospedeiro({ [NUVEM_PADRAO]: motorFalso(r, [{ foraDaPorta: comExtra }]).motor }, r);
    const l = doMotor(await ler(descritor(), FATOS, h.produto(DOIS())));
    assert.equal('segredo' in l.resposta, false);
    assert.equal('chave' in l.resposta.assinatura, false);

    // semModelo que devolve chaves do resultado junto da frase: o piso continua piso.
    const traiçoeiro = descritor({
      semModelo: () => ({ frase: 'Template.', origem: 'motor', causa: 'inventada', trilha: 7 }) as unknown as { frase: string },
    });
    const h2 = hospedeiro({});
    const p = doPiso(await ler(traiçoeiro, FATOS, h2.produto(cadeia([SEM_MODELO], SEM_MODELO))));
    assert.deepEqual(p, { frase: 'Template.', origem: 'piso', causa: 'preferencia', trilha: [] });
  });

  it('o relógio que anda para trás não dá duração negativa', async () => {
    const r = relogio();
    const h = hospedeiro({ [NUVEM_PADRAO]: motorFalso(r, [resposta('Escrita.')], -500).motor }, r);
    const l = doMotor(await ler(descritor(), FATOS, h.produto(DOIS())));
    assert.equal(l.trilha[0].ms, 0);
  });

  it('a trilha mede cada tentativa pelo relógio injetado', async () => {
    const r = relogio();
    const h = hospedeiro({
      'nuvem:prov-a/modelo-1': motorFalso(r, [{ classe: 'indisponivel' }], 40).motor,
      'aparelho:local/pesos-a': motorFalso(r, [{ classe: 'capacidade' }], 900).motor,
      [APARELHO_SISTEMA]: motorFalso(r, [resposta('Escrita no aparelho.')], 1_250).motor,
    }, r);
    const l = doMotor(await ler(descritor(), FATOS, h.produto(TRES())));
    assert.deepEqual(l.trilha.map((t) => t.ms), [40, 900, 1_250]);
    // O instante da resposta é o de quando ela chegou.
    assert.equal(l.resposta.assinatura.instante, new Date(INICIO + 40 + 900 + 1_250).toISOString());
  });
});

describe('o anel', () => {
  it('recebe uma chamada por execução, com a trilha, o hash e o início', async () => {
    const r = relogio();
    const nuvem = motorFalso(r, [{ classe: 'indisponivel' }]);
    const aparelho = motorFalso(r, [resposta('Escrita no aparelho.')]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor }, r);
    const l = doMotor(await ler(descritor(), FATOS, h.produto(DOIS())));

    assert.equal(h.eventos.length, 1);
    assert.deepEqual(h.eventos[0], {
      recurso: 'saude-do-sono',
      versaoDoDescritor: 3,
      modo: 'produto',
      instante: new Date(INICIO).toISOString(),
      trilha: l.trilha,
      hash: hashDoPedido(PEDIDO, 3),
    });
  });

  it('também no piso sem chamada — mudo e preferência', async () => {
    for (const [fatos, c, causa] of [
      [{ ...FATOS, mudo: true }, DOIS(), 'mudo'],
      [FATOS, cadeia([NUVEM_PADRAO, SEM_MODELO], SEM_MODELO), 'preferencia'],
    ] as const) {
      const h = hospedeiro({});
      await ler(descritor(), fatos, h.produto(c));
      assert.equal(h.eventos.length, 1);
      assert.equal(h.eventos[0].causa, causa);
      assert.deepEqual(h.eventos[0].trilha, []);
      assert.equal(h.eventos[0].pedido, undefined);
    }
  });

  it('uma exceção dentro do anel é engolida — o anel não derruba uma leitura', async () => {
    const quebrados: OpcoesDeProduto['registrar'][] = [
      () => {
        throw new Error('disco cheio');
      },
      () => Promise.reject(new Error('disco cheio, assíncrono')),
    ];
    for (const registrar of quebrados) {
      const r = relogio();
      const o: OpcoesDeProduto = {
        ...hospedeiro({ [NUVEM_PADRAO]: motorFalso(r, [resposta('Tudo certo.')]).motor }, r).produto(DOIS()),
        registrar,
      };
      doMotor(await ler(descritor(), FATOS, o));
      const piso = { ...o, cadeia: cadeia([SEM_MODELO], SEM_MODELO) };
      doPiso(await ler(descritor(), FATOS, piso));
    }
    // Uma volta no laço de eventos: a rejeição do anel assíncrono já teria vazado.
    await new Promise((resolve) => setImmediate(resolve));
  });
});

describe('exceção do descritor não vira piso: é bug, e sobe', () => {
  const bug = () => {
    throw new Error('bug no descritor');
  };
  const casos: [string, Partial<Descritor<Fatos, Lido>>, boolean][] = [
    ['montarPedido', { montarPedido: bug }, false],
    ['pedidoCurto', { pedidoCurto: bug }, false],
    ['interpretar', { interpretar: bug }, false],
    ['conferir', { conferir: bug }, false],
    ['montarFrase', { montarFrase: bug }, false],
    ['semModelo', { semModelo: bug }, true],
  ];
  for (const [nome, extra, noPiso] of casos) {
    it(nome, async () => {
      const r = relogio();
      const roteiro: Passo[] = nome === 'pedidoCurto' ? [{ classe: 'janela' }] : [resposta('Tudo certo.')];
      const h = hospedeiro({ [NUVEM_PADRAO]: motorFalso(r, roteiro).motor }, r);
      const c = noPiso ? cadeia([SEM_MODELO], SEM_MODELO) : DOIS();
      await assert.rejects(ler(descritor(extra), FATOS, h.produto(c)), /bug no descritor/);
      // P6: sobe, mas o anel sabe antes — em produção é o único diagnóstico.
      assert.equal(h.eventos.length, 1, nome);
      assert.equal(h.eventos[0].causa, 'defeito', nome);
      assert.match(h.eventos[0].pilha ?? '', /bug no descritor/, nome);
      const temPedido = nome !== 'montarPedido' && nome !== 'semModelo';
      assert.equal(h.eventos[0].pedido !== undefined, temPedido, nome);
      if (temPedido) assert.equal(h.eventos[0].hashDoAnexado, hashDoPedido(h.eventos[0].pedido!, 3), nome);
    });
  }

  it('também na medição: sobe, e o anel recebe o defeito', async () => {
    const r = relogio();
    const h = hospedeiro({ [NUVEM_PADRAO]: motorFalso(r, [resposta('Tudo certo.')]).motor }, r);
    await assert.rejects(ler(descritor({ conferir: bug }), FATOS, h.medicao(NUVEM_PADRAO)), /bug no descritor/);
    assert.equal(h.eventos.length, 1);
    assert.equal(h.eventos[0].modo, 'medicao');
    assert.equal(h.eventos[0].causa, 'defeito');
  });
});

describe('modo medicao', () => {
  it('roda só o motor pedido: sem recuo e sem piso', async () => {
    const r = relogio();
    let pisos = 0;
    const d = descritor({ semModelo: () => ((pisos += 1), { frase: 'nunca' }) });
    const nuvem = motorFalso(r, [{ classe: 'indisponivel', detalhe: 'sem crédito' }]);
    const aparelho = motorFalso(r, [resposta('nunca')]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor }, r);
    const m = tentativa(await ler(d, FATOS, h.medicao(NUVEM_PADRAO)));

    assert.equal(m.motor, NUVEM_PADRAO);
    assert.equal(m.desfecho, 'indisponivel');
    assert.deepEqual(m.trilha, [{ motor: NUVEM_PADRAO, desfecho: 'indisponivel', ms: 100, detalhe: 'sem crédito' }]);
    assert.equal(m.frase, undefined);
    assert.deepEqual(h.pedidosA, [NUVEM_PADRAO]);
    assert.deepEqual(aparelho.pedidos, []);
    assert.equal(pisos, 0);
  });

  it('se passou: a frase, a resposta crua e o hash do pedido', async () => {
    const r = relogio();
    const aparelho = motorFalso(r, [resposta('Escrita no aparelho.')]);
    const h = hospedeiro({ [APARELHO_SISTEMA]: aparelho.motor }, r);
    const m = tentativa(await ler(descritor(), FATOS, h.medicao(APARELHO_SISTEMA)));

    assert.equal(m.desfecho, 'ok');
    assert.equal(m.frase, 'Escrita no aparelho. (a noite)');
    assert.deepEqual(m.valor, { texto: 'Escrita no aparelho.' });
    assert.equal(m.resposta?.texto, 'Escrita no aparelho.');
    assert.equal(m.resposta?.assinatura.versaoDoDescritor, 3);
    assert.equal(m.hash, hashDoPedido(PEDIDO, 3));
    assert.equal(h.eventos.length, 1);
    assert.equal(h.eventos[0].modo, 'medicao');
  });

  it('reprovada: o valor e os problemas voltam, e frase não', async () => {
    const r = relogio();
    const h = hospedeiro({ [APARELHO_SISTEMA]: motorFalso(r, [resposta('Foram 7 horas.')]).motor }, r);
    const m = tentativa(await ler(descritor(), FATOS, h.medicao(APARELHO_SISTEMA)));
    assert.equal(m.desfecho, 'reprovada');
    assert.deepEqual(m.valor, { texto: 'Foram 7 horas.' });
    assert.equal(m.frase, undefined);
    assert.deepEqual(m.trilha[0].problemas, [{ regra: 'numero', detalhe: 'algarismo' }]);
    assert.equal(m.resposta?.texto, 'Foram 7 horas.');
  });

  it('sem-modelo devolve o template, sem chamar ninguém', async () => {
    const h = hospedeiro({});
    const m = await ler(descritor(), FATOS, h.medicao(SEM_MODELO));
    assert.deepEqual(m, { tipo: 'template', motor: SEM_MODELO, frase: 'Template sobre a noite.' });
    assert.deepEqual(h.pedidosA, []);
  });

  it('motor ausente: a tentativa sintética', async () => {
    const m = tentativa(await ler(descritor(), FATOS, hospedeiro({}).medicao('aparelho:local/pesos-a')));
    assert.equal(m.desfecho, 'indisponivel');
    assert.equal(m.trilha[0].sintetica, true);
  });

  it('o teto do recurso vale para medir: acima do regimeMaximo, nenhuma chamada sai', async () => {
    // P4: o dado de um recurso só-aparelho não vai à nuvem nem na bancada.
    const r = relogio();
    const nuvem = motorFalso(r, [resposta('nunca')]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, 'nuvem:prov-a/modelo-1': nuvem.motor }, r);
    const soAparelho = descritor({ regimeMaximo: 'aparelho' });
    for (const id of [NUVEM_PADRAO, 'nuvem:prov-a/modelo-1'] as const) {
      const m = tentativa(await ler(soAparelho, FATOS, h.medicao(id)));
      assert.equal(m.desfecho, 'indisponivel', id);
      assert.equal(m.trilha[0].sintetica, true, id);
      assert.match(m.trilha[0].detalhe ?? '', /regimeMaximo/, id);
      assert.equal(m.hash, hashDoPedido(PEDIDO, 3), id);
    }
    assert.deepEqual(nuvem.pedidos, []);
    assert.deepEqual(h.pedidosA, []);
    // O anel vê a mesma tentativa que o resultado.
    assert.deepEqual(h.eventos[0].trilha.map((t) => t.desfecho), ['indisponivel']);
    // Dentro do teto, mede normalmente.
    const h2 = hospedeiro({ [APARELHO_SISTEMA]: motorFalso(r, [resposta('No aparelho.')]).motor }, r);
    assert.equal(tentativa(await ler(soAparelho, FATOS, h2.medicao(APARELHO_SISTEMA))).desfecho, 'ok');
  });

  it('pedido mudo: nenhuma chamada', async () => {
    const h = hospedeiro({});
    const m = await ler(descritor(), { ...FATOS, mudo: true }, h.medicao(NUVEM_PADRAO));
    assert.deepEqual(m, { tipo: 'mudo', motor: NUVEM_PADRAO });
    assert.deepEqual(h.pedidosA, []);
  });

  it('janela repete com o pedido curto no mesmo motor, e o hash é o do pedido pleno', async () => {
    const r = relogio();
    const nuvem = motorFalso(r, [{ classe: 'janela' }, resposta('Coube no curto.')]);
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor }, r);
    const m = tentativa(await ler(descritor({ pedidoCurto: () => CURTO }), FATOS, h.medicao(NUVEM_PADRAO)));
    assert.equal(m.desfecho, 'ok');
    assert.deepEqual(m.trilha.map((t) => [t.desfecho, t.curto]), [['janela', undefined], ['ok', true]]);
    assert.deepEqual(nuvem.pedidos, [PEDIDO, CURTO]);
    assert.equal(m.hash, hashDoPedido(PEDIDO, 3));
  });

  it('defeito: a classe é defeito, e o anel recebe a pilha', async () => {
    const h = hospedeiro({ [NUVEM_PADRAO]: async () => { throw new Error('ponte caiu'); } });
    const m = tentativa(await ler(descritor(), FATOS, h.medicao(NUVEM_PADRAO)));
    assert.equal(m.desfecho, 'defeito');
    assert.match(h.eventos[0].pilha ?? '', /ponte caiu/);
    assert.deepEqual(h.eventos[0].pedido, PEDIDO);
  });
});

describe('os tipos', () => {
  it('o descritor sem regime de números ou sem piso não compila', () => {
    const { regimeDeNumeros: _r, ...semRegime } = descritor();
    const { semModelo: _s, ...semPiso } = descritor();
    // @ts-expect-error — regime não declarado não compila (AD-6).
    const a: Descritor<Fatos, Lido> = semRegime;
    // @ts-expect-error — o piso é obrigatório pelo tipo (AD-2).
    const b: Descritor<Fatos, Lido> = semPiso;
    // @ts-expect-error — a cadeia padrão só nomeia sem-modelo e as duas variantes simbólicas (AD-8).
    const c: Descritor<Fatos, Lido> = { ...descritor(), cadeiaPadrao: ['nuvem:prov-a/modelo-1', SEM_MODELO] };
    assert.ok(a && b && c);
  });

  it('o Problema da conferência de hoje cabe em ProblemaDaConferencia', () => {
    const p: Problema = { regra: 'causa', detalhe: 'porque' };
    const generalizado: ProblemaDaConferencia = p;
    assert.equal(generalizado.regra, 'causa');
  });

  it('o resultado é discriminado pela origem', async () => {
    const r = relogio();
    const h = hospedeiro({ [NUVEM_PADRAO]: motorFalso(r, [resposta('Tudo certo.')]).motor }, r);
    const l = await ler(descritor(), FATOS, h.produto(DOIS()));
    if (l.origem === 'piso') {
      // @ts-expect-error — o piso não tem resposta: só `origem: 'motor'` carrega uma.
      assert.fail(String(l.resposta));
    } else {
      assert.equal(l.resposta.assinatura.tipo, 'nuvem');
    }
  });
});
