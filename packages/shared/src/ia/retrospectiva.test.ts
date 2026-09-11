import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO, type MotorId } from './fio';
import {
  resolverCadeia, type Cadeia, type Falha, type Motor, type Pedido, type Resposta,
} from './motor';
import {
  ler, type EventoDoAnel, type Leitura, type LeituraDoMotor, type LeituraDoPiso, type OpcoesDeMedicao,
  type OpcoesDeProduto,
} from './orquestrar';
import { BASE_ROTULO, PACOTE_VERSAO, type FatoNumero, type PacoteDeFatos } from './pacote';
import { montarPrompt, PROMPT_VERSAO } from './prompt';
import { CATALOGO_DE_RECURSOS, validarDescritor } from './recursos';
import { descritorDaRetrospectiva as revista } from './retrospectiva';
import { verificarTexto } from './verificar';

/**
 * A matriz de I/O da story 5.2, linha a linha, com o descritor de verdade, o
 * orquestrador de verdade e motores falsos. O pacote é montado à mão, como em
 * `verificar.test.ts`: o que se mede aqui é o caminho, não a montagem.
 */

function fato(chave: string, rotulo: string, atual: number, anterior: number, unidade = '', casas = 0): FatoNumero {
  return {
    chave,
    rotulo,
    atual,
    bases: [
      {
        id: 'B1', rotulo: BASE_ROTULO.B1, existe: true, valor: anterior,
        delta: atual - anterior, deltaPct: Number((((atual - anterior) / anterior) * 100).toFixed(1)),
      },
      { id: 'B2', rotulo: BASE_ROTULO.B2, existe: false, valor: null, delta: null, deltaPct: null, motivo: 'sem ano anterior' },
      { id: 'B3', rotulo: BASE_ROTULO.B3, existe: false, valor: null, delta: null, deltaPct: null, motivo: 'sem dois anos' },
    ],
    unidade,
    casas,
    amostra: null,
    comparavel: true,
  };
}

const PERIODO: PacoteDeFatos['periodo'] = {
  tipo: 'month', rotulo: 'Agosto 2026', rotuloAnterior: 'Julho 2026',
  inicioISO: '2026-08-01', fimISO: '2026-08-31', fechado: true, diasNoPeriodo: 31, luz: null,
};

function caderno(extra: Partial<PacoteDeFatos> = {}): PacoteDeFatos {
  return {
    versao: PACOTE_VERSAO, caderno: 'movimento', rotulo: 'Movimento', periodo: PERIODO,
    metricas: [fato('atividades', 'Atividades', 21, 17), fato('distancia', 'Distância', 435, 862, 'km')],
    tendencias: [], textos: [], lapides: [], cobertura: null, correlacoes: [], eventos: [], lacunas: [], semDado: false,
    ...extra,
  };
}

const COM_FATO = caderno();
const MUDO = caderno({ metricas: [], semDado: true });
const EM_CURSO = caderno({ periodo: { ...PERIODO, fechado: false } });

const BOM = 'Foram 21 atividades, contra 17 em julho.';
const INVENTADO = 'Foram 23 atividades, porque choveu menos.';

const AUSENCIA = { ausencia: 'a revista não imprime sem modelo' };

const resposta = (texto: string, tipo: 'nuvem' | 'aparelho' = 'nuvem'): Resposta => ({
  texto, assinatura: { tipo, provedor: 'prov-a', modelo: 'modelo-1' }, tokens: { entrada: 10, saida: 5 },
});

/** Um motor que devolve sempre o mesmo, e guarda o que recebeu. */
function motorFalso(saida: Resposta | Falha) {
  const pedidos: Pedido[] = [];
  const motor: Motor = async (p) => {
    pedidos.push(p);
    return saida;
  };
  return { motor, pedidos };
}

function hospedeiro(motores: Readonly<Record<string, Motor | undefined>>) {
  const eventos: EventoDoAnel[] = [];
  const pedidosA: MotorId[] = [];
  const comuns = {
    motorPara: (id: MotorId) => {
      pedidosA.push(id);
      return motores[id];
    },
    registrar: (e: EventoDoAnel) => {
      eventos.push(e);
    },
    agora: () => new Date(Date.UTC(2026, 8, 11, 9, 0, 0)),
  };
  return {
    eventos,
    pedidosA,
    produto: (cadeia: Cadeia): OpcoesDeProduto => ({ modo: 'produto', cadeia, ...comuns }),
    medicao: (motor: MotorId): OpcoesDeMedicao => ({ modo: 'medicao', motor, ...comuns }),
  };
}

/** Os motores que o hospedeiro conhece. */
const CATALOGO: MotorId[] = [APARELHO_SISTEMA, NUVEM_PADRAO, 'nuvem:prov-a/modelo-1'];

/** A cadeia da revista, resolvida com o regime dela — como o hospedeiro fará. */
const cadeiaDaRevista = (preferencia?: string): Cadeia => resolverCadeia(revista, preferencia, CATALOGO);

function doMotor(l: Leitura<string>): LeituraDoMotor<string> {
  assert.equal(l.origem, 'motor', JSON.stringify(l));
  return l as LeituraDoMotor<string>;
}

function doPiso(l: Leitura<string>): LeituraDoPiso {
  assert.equal(l.origem, 'piso', JSON.stringify(l));
  return l as LeituraDoPiso;
}

describe('o descritor', () => {
  it('é válido e está no catálogo', () => {
    assert.deepEqual(validarDescritor(revista), []);
    assert.ok(CATALOGO_DE_RECURSOS.includes(revista));
  });

  it('declara o que a espinha fixa: copiado e conferido, só nuvem, recusa não é resultado', () => {
    assert.equal(revista.recurso, 'retrospectiva');
    assert.equal(revista.regimeDeNumeros, 'copiado-e-conferido');
    assert.equal(revista.regimeMaximo, 'nuvem');
    assert.deepEqual([...revista.cadeiaPadrao], [NUVEM_PADRAO, SEM_MODELO]);
    assert.deepEqual(revista.grava, { admite: ['nuvem'], recusaEResultado: false });
    assert.deepEqual(revista.semModelo(COM_FATO), AUSENCIA);
  });

  it('a versão é o par que edicoes_ia já grava, num número só — e o par se recupera', () => {
    assert.equal(revista.versao, PROMPT_VERSAO * 1000 + PACOTE_VERSAO);
    // Sem isto, o pacote 1000 colidiria com o prompt seguinte.
    assert.ok(PACOTE_VERSAO < 1000, `PACOTE_VERSAO ${PACOTE_VERSAO} não cabe em três dígitos`);
    assert.equal(Math.floor(revista.versao / 1000), PROMPT_VERSAO);
    assert.equal(revista.versao % 1000, PACOTE_VERSAO);
  });

  it('sem preferência, a cadeia é o padrão dela', () => {
    assert.deepEqual([...cadeiaDaRevista()], [NUVEM_PADRAO, SEM_MODELO]);
  });
});

describe('montarPedido', () => {
  it('caderno com fato: o montarPrompt de hoje, com amostragem padrão, texto e guardrail padrão', () => {
    const { sistema, usuario } = montarPrompt(COM_FATO);
    assert.notEqual(usuario, '');
    assert.deepEqual(revista.montarPedido(COM_FATO), {
      sistema, usuario, amostragem: 'padrao', saida: { tipo: 'texto' }, guardrails: 'padrao',
    });
  });

  it('caderno mudo: nulo — o prompt vazio não vira chamada', () => {
    assert.equal(montarPrompt(MUDO).usuario, '');
    assert.equal(revista.montarPedido(MUDO), null);
  });

  it('período em curso: nulo, mesmo com fato — recurso que grava não narra período aberto', () => {
    assert.notEqual(montarPrompt(EM_CURSO).usuario, '');
    assert.equal(revista.montarPedido(EM_CURSO), null);
  });
});

describe('a matriz, pelo orquestrador', () => {
  it('texto bom: origem motor, e a frase é o texto', async () => {
    assert.equal(verificarTexto(BOM, COM_FATO).ok, true, 'o texto do teste tem de passar na conferência');
    const nuvem = motorFalso(resposta(BOM));
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor });
    const l = doMotor(await ler(revista, COM_FATO, h.produto(cadeiaDaRevista())));

    assert.equal(l.frase, BOM);
    assert.equal(l.valor, BOM);
    assert.equal(l.motor, NUVEM_PADRAO);
    assert.equal(l.resposta.assinatura.versaoDoDescritor, revista.versao);
    assert.deepEqual(nuvem.pedidos, [revista.montarPedido(COM_FATO)]);
  });

  it('texto reprovado: os problemas são os de verificarTexto; piso ausência, causa reprovada', async () => {
    const esperados = verificarTexto(INVENTADO, COM_FATO).problemas;
    assert.ok(esperados.some((p) => p.regra === 'numero') && esperados.some((p) => p.regra === 'causa'));
    const h = hospedeiro({ [NUVEM_PADRAO]: motorFalso(resposta(INVENTADO)).motor });
    const l = doPiso(await ler(revista, COM_FATO, h.produto(cadeiaDaRevista())));

    assert.deepEqual(l, {
      ...AUSENCIA, origem: 'piso', causa: 'reprovada', trilha: [
        { motor: NUVEM_PADRAO, desfecho: 'reprovada', ms: 0, problemas: esperados },
      ],
    });
  });

  it('a conferência é a de hoje, contra o pacote do caderno, e não marca recusa', () => {
    assert.deepEqual(revista.conferir(BOM, COM_FATO), { ok: true });
    assert.deepEqual(revista.conferir(INVENTADO, COM_FATO), {
      ok: false, problemas: verificarTexto(INVENTADO, COM_FATO).problemas,
    });
  });

  it('por caderno é mais estrito que a edição de hoje: número de outro caderno reprova', () => {
    // O recorte da 1.10. A impressão de hoje confere contra os quatro pacotes
    // juntos, e ali o 3,72 do Sono autoriza o texto do Movimento.
    const sono = caderno({
      caderno: 'sono', rotulo: 'Sono', metricas: [fato('nota_sono', 'Nota de sono', 3.72, 3.39, '', 2)],
    });
    const texto = 'Foram 21 atividades, contra 17 em julho. A nota de sono foi 3,72.';
    const naEdicao = verificarTexto(texto, [COM_FATO, sono]);
    assert.deepEqual(naEdicao.problemas.filter((p) => p.regra === 'numero'), []);

    const c = revista.conferir(texto, COM_FATO);
    assert.equal(c.ok, false);
    assert.deepEqual(!c.ok && c.problemas, [{ regra: 'numero', detalhe: '"3,72" não está no pacote' }]);
  });

  for (const [nome, fatos] of [['caderno mudo', MUDO], ['período em curso', EM_CURSO]] as const) {
    it(`${nome}: nenhuma chamada; piso ausência, causa mudo`, async () => {
      const nuvem = motorFalso(resposta(BOM));
      const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor });
      const l = doPiso(await ler(revista, fatos, h.produto(cadeiaDaRevista())));
      assert.deepEqual(l, { ...AUSENCIA, origem: 'piso', causa: 'mudo', trilha: [] });
      assert.deepEqual(nuvem.pedidos, []);
      assert.deepEqual(h.pedidosA, []);
    });
  }

  it('preferência não admitida: a revista com o aparelho fica em [sem-modelo] — nunca sobe para a nuvem', async () => {
    const c = cadeiaDaRevista(APARELHO_SISTEMA);
    assert.deepEqual([...c], [SEM_MODELO]);
    const nuvem = motorFalso(resposta(BOM));
    const aparelho = motorFalso(resposta(BOM, 'aparelho'));
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor });
    const l = doPiso(await ler(revista, COM_FATO, h.produto(c)));

    assert.deepEqual(l, { ...AUSENCIA, origem: 'piso', causa: 'preferencia', trilha: [] });
    assert.deepEqual(nuvem.pedidos, []);
    assert.deepEqual(aparelho.pedidos, []);
  });

  it('elo fora do recurso: a cadeia de quem não grava, no ler da revista — o aparelho vira sintética, sem chamada', async () => {
    // Resolvida para um recurso sem `grava`: o aparelho entra no recuo.
    const alheia = resolverCadeia(
      { cadeiaPadrao: [NUVEM_PADRAO, APARELHO_SISTEMA, SEM_MODELO], regimeMaximo: 'nuvem' }, undefined, CATALOGO,
    );
    assert.deepEqual([...alheia], [NUVEM_PADRAO, APARELHO_SISTEMA, SEM_MODELO]);

    const nuvem = motorFalso({ classe: 'indisponivel', detalhe: 'sem crédito' });
    const aparelho = motorFalso(resposta(BOM, 'aparelho'));
    const h = hospedeiro({ [NUVEM_PADRAO]: nuvem.motor, [APARELHO_SISTEMA]: aparelho.motor });
    const l = doPiso(await ler(revista, COM_FATO, h.produto(alheia)));

    assert.equal(l.causa, 'indisponivel');
    assert.equal('ausencia' in l && l.ausencia, AUSENCIA.ausencia);
    assert.deepEqual(l.trilha.map((t) => [t.motor, t.desfecho, t.sintetica]), [
      [NUVEM_PADRAO, 'indisponivel', undefined],
      [APARELHO_SISTEMA, 'indisponivel', true],
    ]);
    assert.deepEqual(aparelho.pedidos, []);
    assert.deepEqual(h.pedidosA, [NUVEM_PADRAO]);
  });

  it('elo fora do recurso: a cadeia de um recurso só-aparelho recua direto ao piso', async () => {
    const alheia = resolverCadeia({ cadeiaPadrao: [APARELHO_SISTEMA, SEM_MODELO], regimeMaximo: 'aparelho' }, undefined, CATALOGO);
    const aparelho = motorFalso(resposta(BOM, 'aparelho'));
    const h = hospedeiro({ [APARELHO_SISTEMA]: aparelho.motor });
    const l = doPiso(await ler(revista, COM_FATO, h.produto(alheia)));

    assert.equal(l.causa, 'indisponivel');
    assert.deepEqual(l.trilha.map((t) => [t.motor, t.desfecho, t.sintetica]), [[APARELHO_SISTEMA, 'indisponivel', true]]);
    assert.deepEqual(aparelho.pedidos, []);
    assert.deepEqual(h.pedidosA, []);
  });

  it('medição fora do admite: mede o aparelho normalmente — é a bancada que abre o admite', async () => {
    const aparelho = motorFalso(resposta(BOM, 'aparelho'));
    const h = hospedeiro({ [APARELHO_SISTEMA]: aparelho.motor });
    const m = await ler(revista, COM_FATO, h.medicao(APARELHO_SISTEMA));

    assert.equal(m.tipo, 'tentativa');
    assert.ok(m.tipo === 'tentativa');
    assert.equal(m.desfecho, 'ok');
    assert.equal(m.frase, BOM);
    assert.deepEqual(aparelho.pedidos, [revista.montarPedido(COM_FATO)]);
  });
});
