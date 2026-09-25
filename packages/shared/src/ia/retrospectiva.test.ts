import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HEALTH_METRICS } from '../health/metric-catalog';
import { HEALTH_SPECS } from '../period/retro-dados';
import { APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO, type MotorId } from './fio';
import {
  resolverCadeia, type Cadeia, type Falha, type Motor, type Pedido, type Resposta,
} from './motor';
import {
  ler, type EventoDoAnel, type Leitura, type LeituraDoMotor, type LeituraDoPiso, type OpcoesDeMedicao,
  type OpcoesDeProduto,
} from './orquestrar';
import { BASE_ROTULO, PACOTE_VERSAO, UNIDADE_NO_SINGULAR, type FatoNumero, type PacoteDeFatos } from './pacote';
import { montarPrompt, PROMPT_VERSAO } from './prompt';
import { CATALOGO_DE_RECURSOS, validarDescritor } from './recursos';
import { descritorDaRetrospectiva as revista, versoesDaRetrospectiva } from './retrospectiva';
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

  it('versoesDaRetrospectiva: ida e volta — a versão carimbada devolve o par que edicoes_ia grava', () => {
    assert.deepEqual(versoesDaRetrospectiva(revista.versao), { prompt: PROMPT_VERSAO, pacote: PACOTE_VERSAO });
    // A ida e volta vale para qualquer par que caiba, e não só para o de hoje.
    for (const [prompt, pacote] of [[0, 0], [1, 999], [7, 3], [42, 0], [5, 12]] as const) {
      assert.deepEqual(versoesDaRetrospectiva(prompt * 1000 + pacote), { prompt, pacote });
    }
  });

  it('versoesDaRetrospectiva recusa o que não se decodifica, em vez de gravar NaN', () => {
    for (const v of [Number.NaN, -1, 4002.5, Number.POSITIVE_INFINITY]) {
      assert.throws(() => versoesDaRetrospectiva(v), RangeError, String(v));
    }
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

/* ── a concordância do número com a unidade (Story 2.8) ──────────────────── */

/**
 * A matriz de I/O da Story 2.8, sobre o prompt montado de verdade.
 *
 * O defeito que ela fecha esteve em produção: *"A refeição foi realizada em 1
 * dias ao longo do mês"* — 68 ocorrências em 37 linhas de 35 períodos, sempre no
 * caderno `rotina`. Pela [ADR 0049] o número e a unidade são do **código**; o
 * modelo copiava a palavra errada porque era a palavra errada que ele recebia.
 *
 * Mede-se aqui, e não no gabarito da fixture, porque a fixture de maio não tem
 * hábito nem registro de **um dia só** — e por isso o texto dela não mudou um
 * byte com esta story (ver o docblock de `GABARITO`). O caso precisa ser montado.
 */
describe('a concordância do número com a unidade', () => {
  /** A linha de um fato, isolada do resto do prompt. */
  const linhaDe = (f: FatoNumero): string => {
    const linha = montarPrompt(caderno({ metricas: [f] })).usuario
      .split('\n')
      .find((l) => l.startsWith(`- ${f.rotulo}: `));
    assert.ok(linha, `a linha de ${f.rotulo} não saiu no prompt`);
    return linha;
  };

  it('o defeito: valor 1 em unidade de palavra sai no SINGULAR', () => {
    assert.equal(linhaDe(fato('cerveja', 'Cerveja', 1, 4, 'dias')), '- Cerveja: 1 dia (contra julho: 4 dias, −75,0%)');
  });

  /**
   * O critério de aceitação da story, escrito como ele está lá: *"nenhuma linha
   * contém `1 dias`, e a de valor 1 contém `1 dia`"* — sobre um caderno com a
   * vizinhança inteira do caso, e não sobre a linha isolada.
   */
  it('num caderno com 0, 1, 2 e 31 dias, `1 dias` não aparece em lugar nenhum do prompt', () => {
    const pacote = caderno({
      metricas: [
        fato('agua', 'Água', 0, 1, 'dias'),
        fato('cerveja', 'Cerveja', 1, 1, 'dias'),
        fato('cafe', 'Café', 2, 1, 'dias'),
        fato('leitura', 'Leitura', 31, 1, 'dias'),
      ],
      // **A varredura só vale se as seções que colam "dias" estiverem no prompt.**
      // Com `lacunas: []` — como este teste nascia — a linha das Lacunas nem era
      // montada, e o `doesNotMatch` dava verde sobre um prompt em que ela não
      // existia. É a segunda (e última) linha do arquivo que cola número em
      // palavra, e era a que ainda escrevia "1 dias sem dado".
      lacunas: [
        { caderno: 'movimento', diasSemDado: 1, motivo: 'relógio sem carga' },
        { caderno: 'sono', diasSemDado: 12 },
      ],
    });
    const usuario = montarPrompt(pacote).usuario;
    assert.doesNotMatch(usuario, /\b1 dias\b/, `"1 dias" saiu no prompt:\n${usuario}`);
    assert.match(usuario, /- Cerveja: 1 dia \(/);
    assert.match(usuario, /- Movimento: 1 dia sem dado \(relógio sem carga\)/);
    // E o plural continua inteiro onde ele é o certo — a régua não virou "sempre singular".
    for (const esperado of ['0 dias', '2 dias', '31 dias', '12 dias sem dado']) {
      assert.ok(usuario.includes(esperado), esperado);
    }
  });

  it('a unidade concorda com o número DE CADA BASE, e não com o do fato', () => {
    // O espelho do caso de cima: aqui é a base que vale um. Um `u` calculado uma
    // vez por linha — como era até esta story — colaria a mesma palavra nos dois.
    assert.equal(linhaDe(fato('cerveja', 'Cerveja', 4, 1, 'dias')), '- Cerveja: 4 dias (contra julho: 1 dia, 300,0%)');
  });

  it('plural normal: 0, 2 e 31 ficam no plural — o singular é só o 1', () => {
    for (const [v, esperado] of [[0, '0 dias'], [2, '2 dias'], [31, '31 dias']] as const) {
      assert.ok(linhaDe(fato('registro', 'Registro', v, 9, 'dias')).startsWith(`- Registro: ${esperado} `), esperado);
    }
  });

  /**
   * **As unidades são as que a produção emite, e não as que se esperaria.**
   * `pacote.ts` escreve `'km'`, `'h'` e `'m'` à mão; as de saúde vêm de
   * `HEALTH_SPECS`, que declara `' ms'` e `' bpm'` **com espaço à esquerda** (lá
   * elas são sufixo de tela). Um teste escrito com `'bpm'` limpo afirmaria cobrir
   * a saúde e não cobriria nenhuma das três que chegam ao pacote.
   *
   * O espaço duplo que daí resulta (`48  bpm`) está medido e **diferido**: ver o
   * `deferred-work` da 2.8. Aqui ele é registrado como o comportamento de hoje,
   * para que consertá-lo quebre este teste em vez de passar despercebido.
   */
  it('unidade invariável: `1 km`, nunca `1 k` — símbolo não tem plural', () => {
    const daMao = ['km', 'h', 'm'];
    const daSaude = HEALTH_SPECS.map((s) => s.unit ?? '');
    assert.deepEqual(daSaude, ['h', ' ms', ' bpm'], 'HEALTH_SPECS mudou — confira o espaço à esquerda');
    for (const u of [...daMao, ...daSaude]) {
      assert.equal(linhaDe(fato('d', 'Distância', 1, 2, u)), `- Distância: 1 ${u} (contra julho: 2 ${u}, −50,0%)`);
    }
    // O que a linha de fato REALMENTE produz para a VFC de valor 1, espaço duplo e tudo.
    assert.equal(linhaDe(fato('vfc', 'VFC', 1, 2, ' ms')), '- VFC: 1  ms (contra julho: 2  ms, −50,0%)');
  });

  it('sem unidade: o número sai sozinho, com 1 como com 2', () => {
    assert.equal(linhaDe(fato('atividades', 'Atividades', 1, 2)), '- Atividades: 1 (contra julho: 2, −50,0%)');
  });

  it('o delta é porcentagem, e porcentagem não é contagem: `1,0%` fica como está', () => {
    // 101 contra 100 dá +1,0%: o delta escreve `1,0`, que não é o `1` da régua,
    // e `%` não está na tabela do singular de todo jeito.
    assert.equal(
      linhaDe(fato('passos', 'Passos', 101, 100, 'dias')),
      '- Passos: 101 dias (contra julho: 100 dias, 1,0%)',
    );
  });

  it('a régua é o número COMO SAI ESCRITO: 1,0 é plural, porque é assim que se lê', () => {
    // Nenhuma unidade de palavra tem casa decimal hoje; a régua existe para o dia
    // em que uma tiver, e para não precisar de uma segunda regra sobre `casas`.
    assert.equal(linhaDe(fato('x', 'Litros', 1, 2, 'dias', 1)), '- Litros: 1,0 dias (contra julho: 2,0 dias, −50,0%)');
  });

  /**
   * A guarda que amarra a tabela do singular às fontes do plural — **as duas**.
   *
   * `UNIDADE_NO_SINGULAR` só pode estar certa em relação ao que chega ao campo
   * `unidade` de um `FatoNumero`, e nada obriga os dois a andarem juntos. Há dois
   * fornecedores, e eles são de naturezas diferentes:
   *
   * 1. os literais escritos à mão em `pacote.ts` (`unidade: 'dias'`, `'km'`…);
   * 2. **`HEALTH_SPECS`** (`period/retro-dados.ts`), que `pacote.ts` repassa cru
   *    em `unidade: l.unit`.
   *
   * O segundo é o que a primeira versão desta guarda não via, e ele é o mais
   * perigoso: o catálogo de onde as `HEALTH_SPECS` saem **tem unidades em
   * palavra** — `unit: 'passos'` e `unit: 'andares'` em `health/metric-catalog.ts`.
   * Hoje as três especificadas são `h`, ` ms` e ` bpm`, todas símbolos, então é
   * latente; no dia em que `passos` entrar, sairia *"1 passos"* com a suíte verde.
   *
   * A régua é uma só, e vale para os dois: **toda** unidade que alcança o prompt
   * é palavra (e então tem singular na tabela) ou é símbolo conhecido. Nada de
   * heurística de comprimento — ` bpm` tem quatro caracteres e é símbolo, e
   * `'dia'` tem três e é palavra.
   */
  it('a tabela do singular cobre as duas fontes de unidade, e o resto são símbolos conhecidos', () => {
    assert.deepEqual(UNIDADE_NO_SINGULAR, { dias: 'dia' });

    /** Os símbolos que o prompt pode colar sem variar. Lista, nunca heurística. */
    const SIMBOLOS = new Set(['km', 'h', 'm', ' ms', ' bpm', '%']);

    // Comentário fora antes de varrer: o docblock de `UNIDADE_NO_SINGULAR` e o
    // cabeçalho do arquivo citam `unidade: 'dias'` em prosa, e sem isto a
    // varredura casava com a explicação em vez de com o código. Mesma forma do
    // `semComentario` de `architecture.test.ts`.
    const semComentario = (src: string): string =>
      src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
    const naFonte = semComentario(readFileSync(new URL('./pacote.ts', import.meta.url), 'utf8'));
    const aMao = [...new Set([...naFonte.matchAll(/\bunidade: '([^']*)'/g)].map((m) => m[1]!))].sort();
    assert.deepEqual(
      aMao, ['dias', 'h', 'km', 'm'],
      'as unidades escritas à mão em pacote.ts mudaram. Se a nova é uma PALAVRA (tem plural), '
      + 'ponha o singular em UNIDADE_NO_SINGULAR e suba PROMPT_VERSAO; se é símbolo, acrescente-a a SIMBOLOS.',
    );
    // Não-vácua: sem tirar comentário, a varredura pegava a prosa também.
    assert.ok(/unidade: 'dias'/.test(naFonte), 'a varredura deixou de ver o código de pacote.ts');

    // `?? ''` é o que `deMetrica` faz com a unidade ausente, e `''` sai sem
    // unidade nenhuma: a régua não se aplica a ela.
    const daSaude = HEALTH_SPECS.map((s) => s.unit ?? '').filter((u) => u !== '');
    for (const u of [...aMao, ...daSaude]) {
      assert.ok(
        u in UNIDADE_NO_SINGULAR || SIMBOLOS.has(u),
        `a unidade ${JSON.stringify(u)} chega ao prompt e não é palavra com singular nem símbolo conhecido. `
        + 'Se tem plural, ponha o singular em UNIDADE_NO_SINGULAR e suba PROMPT_VERSAO; se é símbolo, acrescente-a a SIMBOLOS.',
      );
    }

    // E a prova de que a regra morde a fonte 2: o catálogo de onde as
    // `HEALTH_SPECS` saem tem unidade em PALAVRA, e ela reprovaria aqui.
    const emPalavraNoCatalogo = HEALTH_METRICS.filter((m) => m.unit === 'passos' || m.unit === 'andares');
    assert.equal(emPalavraNoCatalogo.length, 2, 'passos/andares saíram do catálogo — a não-vácua ficou sem alvo');
    for (const m of emPalavraNoCatalogo) {
      assert.ok(!(m.unit in UNIDADE_NO_SINGULAR) && !SIMBOLOS.has(m.unit), m.unit);
      assert.ok(!daSaude.includes(m.unit), `${m.unit} entrou em HEALTH_SPECS — ponha o singular na tabela`);
    }
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
    // Com o pedido, que é o que a conferência do descritor passa desde 25/09 —
    // a sexta regra (o eco) só existe contra ele.
    const esperados = verificarTexto(INVENTADO, COM_FATO, montarPrompt(COM_FATO).usuario).problemas;
    assert.ok(esperados.some((p) => p.regra === 'numero') && esperados.some((p) => p.regra === 'causa'));
    const h = hospedeiro({ [NUVEM_PADRAO]: motorFalso(resposta(INVENTADO)).motor });
    const l = doPiso(await ler(revista, COM_FATO, h.produto(cadeiaDaRevista())));

    assert.deepEqual(l, {
      ...AUSENCIA, origem: 'piso', causa: 'reprovada', trilha: [
        { motor: NUVEM_PADRAO, desfecho: 'reprovada', ms: 0, problemas: esperados },
      ],
    });
  });

  it('a conferência é a de hoje, contra o pacote do caderno e o pedido dele, e não marca recusa', () => {
    assert.deepEqual(revista.conferir(BOM, COM_FATO), { ok: true });
    assert.deepEqual(revista.conferir(INVENTADO, COM_FATO), {
      ok: false, problemas: verificarTexto(INVENTADO, COM_FATO, montarPrompt(COM_FATO).usuario).problemas,
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
