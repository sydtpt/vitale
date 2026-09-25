import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RetroSummary } from '../period/retro';
import type { RecapValue, MetricRecap } from '../week/recap';
import type { CadernoId } from '../period/cadernos';
import { APARELHO_SISTEMA, NUVEM_PADRAO, SEM_MODELO, type MotorId } from './fio';
import {
  CONCLUSAO, resolverCadeia, type Cadeia, type Falha, type Motor, type Pedido, type Resposta,
} from './motor';
import type { Descritor, EventoDoAnel } from './orquestrar';
import { PACOTE_VERSAO, type EntradaPacote, type PacoteDeFatos } from './pacote';
import { PROMPT_VERSAO } from './prompt';
import {
  cadernosComDado, imprimir, lapidesDosCadernos, pacotesComDado, type DesfechoDoCaderno, type Impressao,
  type OpcoesDaImpressao, type PeriodoDaEdicao, type ResultadoDaImpressao,
} from './imprimir';
// A sequência com descritor injetável fica fora do barril — só os testes do núcleo a
// alcançam, por caminho relativo.
import { imprimirCom } from './imprimir-sequencia';
import { descritorDaRetrospectiva } from './retrospectiva';

/**
 * A sequência da impressão — a matriz da Story 1.10, linha a linha.
 *
 * **O descritor é o de verdade**, e o orquestrador também: o pacote sai de
 * `montarPacotes`, a ordem de `ordenarCadernos`, o pedido de `montarPrompt` e a
 * conferência de `verificarTexto`. Só as bordas são falsas — o motor, `buscar` e
 * `gravar` —, então montar → orquestrar → conferir → gravar roda inteiro, sem
 * rede. Os textos abaixo passam na conferência do caderno deles (e o inventado
 * reprova), o que é conferido no primeiro `describe` para o resto não passar por
 * acidente.
 */

/* ── o mês ───────────────────────────────────────────────────────────────── */

function recap(current: number, prior: number): RecapValue {
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null };
}

function metrica(current: number, prior: number, n: number, nAnterior: number): MetricRecap {
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null, n, nAnterior };
}

const VAZIO = recap(0, 0);

/**
 * Agosto/2026, sintético. Movimento, Rotina e Sono têm dado; o Coração, só com
 * `fc: true`. Afastamentos (todos por B1, peso ½): Movimento 16,65 (distância
 * +33%), Rotina 16,65 (tarefas +33%, empate que o catálogo desempata atrás de
 * Movimento), Sono 2,95, Coração 2,0. A ordem do ranqueamento não é a do catálogo
 * — é assim que "na ordem do ranqueamento" se prova.
 */
function agosto(o: { fc?: boolean; sono?: { cur: number; prev: number | null } | null } = {}): RetroSummary {
  const sono = o.sono === undefined ? { cur: 28, prev: 27 } : o.sono;
  return {
    kind: 'month', offset: -1, label: 'Agosto 2026', startISO: '2026-08-01', endISO: '2026-08-31',
    tasks: { total: recap(40, 30), byModule: [] },
    habits: { good: [], bad: [] },
    registros: [],
    fitness: {
      count: recap(21, 17), countWithDistance: recap(18, 15),
      distanceM: recap(400_000, 300_000), durationS: recap(144_000, 108_000),
      calories: VAZIO, hardMin: VAZIO, floors: VAZIO, steps: VAZIO, byType: [],
    },
    sports: { cycling: null, running: null },
    health: [
      {
        metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'sleep' as never,
        decimals: 1, unit: 'h', recap: metrica(7.2, 6.8, 28, 27), trend: 'flat',
      },
      ...(o.fc
        ? [{
          metric: 'fcRepouso', label: 'FC de repouso', higherIsWorse: true, icon: 'heart' as never,
          decimals: 0, unit: 'bpm', recap: metrica(48, 50, 29, 28), trend: 'flat',
        }]
        : []),
    ],
    ratings: { sleep: null, day: null },
    purchases: { count: VAZIO, spend: VAZIO, countWithPrice: VAZIO, byCat: [] },
    adherence: null,
    sleep: sono === null ? null : { cur: { nights: sono.cur }, prev: sono.prev === null ? null : { nights: sono.prev } },
    sleepTriggers: null,
  } as unknown as RetroSummary;
}

/** Seis de setembro: agosto fechou. Componentes locais — o dia não depende do `TZ`. */
const AGORA = new Date(2026, 8, 6, 12, 0, 0);

const entrada = (resumo: RetroSummary = agosto(), extra: Partial<EntradaPacote> = {}): EntradaPacote => ({
  resumo, agora: AGORA, ...extra,
});

/* ── os textos ───────────────────────────────────────────────────────────── */

const TEXTOS: Readonly<Record<string, string>> = {
  Movimento: 'Foram 21 atividades, contra 17 em julho.',
  Rotina: 'Foram 40 tarefas concluídas, contra 30 em julho.',
  Sono: 'O sono ficou em 7,2 h por noite, contra 6,8 h em julho.',
  'Coração': 'A FC de repouso ficou em 48 bpm, contra 50 bpm em julho.',
};

const INVENTADO = 'Foram 23 atividades, porque choveu menos.';

const ROTULO: Readonly<Record<CadernoId, string>> = {
  sono: 'Sono', movimento: 'Movimento', coracao: 'Coração', rotina: 'Rotina',
};

const resposta = (texto: string, extra: Partial<Resposta> = {}): Resposta => ({
  texto, assinatura: { tipo: 'nuvem', provedor: 'prov-a', modelo: 'modelo-1' }, tokens: { entrada: 900, saida: 120 },
  ...extra,
});

/* ── o hospedeiro falso ──────────────────────────────────────────────────── */

type Roteiro = Partial<Record<CadernoId, Resposta | Falha>>;

/**
 * Um hospedeiro inteiro: a nuvem (que responde por caderno), `buscar`, `gravar`,
 * o anel e um diário do que aconteceu, em ordem.
 *
 * **`gravar` reprova a segunda chamada ali mesmo.** Uma impressão que gravasse
 * caderno a caderno chamaria a porta mais de uma vez — e o teste explodiria na
 * chamada, não numa asserção que alguém pudesse esquecer de escrever.
 */
function hospedeiro(o: { existentes?: CadernoId[]; roteiro?: Roteiro; buscarLanca?: Error; gravarLanca?: Error } = {}) {
  const diario: string[] = [];
  const pedidos: Pedido[] = [];
  const gravacoes: Impressao[] = [];
  const buscas: PeriodoDaEdicao[] = [];
  const eventos: EventoDoAnel[] = [];

  const nuvem: Motor = async (p) => {
    pedidos.push(p);
    const rotulo = /Escreva o caderno (\S+)\./.exec(p.usuario)?.[1] ?? '?';
    diario.push(`motor:${rotulo}`);
    const caderno = (Object.keys(ROTULO) as CadernoId[]).find((c) => ROTULO[c] === rotulo);
    return (caderno && o.roteiro?.[caderno]) ?? resposta(TEXTOS[rotulo] ?? `sem texto para ${rotulo}`);
  };

  const portas = {
    buscar: async (p: PeriodoDaEdicao) => {
      buscas.push(p);
      diario.push('buscar');
      if (o.buscarLanca) throw o.buscarLanca;
      return (o.existentes ?? []).map((caderno) => ({ caderno }));
    },
    gravar: async (i: Impressao) => {
      gravacoes.push(i);
      diario.push('gravar');
      assert.equal(gravacoes.length, 1, 'gravar foi chamada mais de uma vez numa impressão');
      if (o.gravarLanca) throw o.gravarLanca;
      return { relida: i.ordem };
    },
  };

  const opcoes = (cadeia: Cadeia = cadeiaDaRevista(), extra: Partial<OpcoesDaImpressao> = {}): OpcoesDaImpressao => ({
    cadeia,
    motorPara: (id: MotorId) => (id.startsWith('nuvem') ? nuvem : undefined),
    registrar: (e) => {
      eventos.push(e);
    },
    agora: () => new Date(Date.UTC(2026, 8, 16, 9, 0, 0)),
    ...extra,
  });

  const rotulosPedidos = () => pedidos.map((p) => /Escreva o caderno (\S+)\./.exec(p.usuario)?.[1]);
  return { diario, pedidos, gravacoes, buscas, eventos, portas, opcoes, rotulosPedidos };
}

const CATALOGO: MotorId[] = [SEM_MODELO, APARELHO_SISTEMA, NUVEM_PADRAO];
const cadeiaDaRevista = (preferencia?: string): Cadeia => resolverCadeia(descritorDaRetrospectiva, preferencia, CATALOGO);

function gravada<E>(r: ResultadoDaImpressao<E>): Extract<ResultadoDaImpressao<E>, { estado: 'gravada' }> {
  assert.equal(r.estado, 'gravada', JSON.stringify(r));
  return r as Extract<ResultadoDaImpressao<E>, { estado: 'gravada' }>;
}

function nadaGravado<E>(r: ResultadoDaImpressao<E>): Extract<ResultadoDaImpressao<E>, { estado: 'nada-gravado' }> {
  assert.equal(r.estado, 'nada-gravado', JSON.stringify(r));
  return r as Extract<ResultadoDaImpressao<E>, { estado: 'nada-gravado' }>;
}

function desfechoDe(r: { desfechos: readonly { caderno: CadernoId; desfecho: DesfechoDoCaderno }[] }, c: CadernoId) {
  const d = r.desfechos.find((x) => x.caderno === c);
  assert.ok(d, `sem desfecho para ${c}`);
  return d.desfecho;
}

/* ── a matriz ────────────────────────────────────────────────────────────── */

describe('o fixture', () => {
  it('os textos passam na conferência de verdade, e o inventado reprova — senão a matriz mede nada', async () => {
    const h = hospedeiro({ roteiro: { movimento: resposta(INVENTADO) } });
    const r = gravada(await imprimir(entrada(agosto({ fc: true })), h.portas, h.opcoes()));
    assert.equal(desfechoDe(r, 'rotina').tipo, 'escrito');
    assert.equal(desfechoDe(r, 'sono').tipo, 'escrito');
    assert.equal(desfechoDe(r, 'coracao').tipo, 'escrito');
    const mov = desfechoDe(r, 'movimento');
    assert.ok(mov.tipo === 'nao-escrito' && mov.leitura.causa === 'reprovada', JSON.stringify(mov));
  });
});

describe('primeira impressão — três cadernos com dado e a nuvem aprovando', () => {
  it('buscar 1×, ler 3× na ordem do ranqueamento, gravar 1× com a ordem e as três linhas', async () => {
    const h = hospedeiro();
    const r = gravada(await imprimir(entrada(), h.portas, h.opcoes()));

    assert.deepEqual(h.diario, ['buscar', 'motor:Movimento', 'motor:Rotina', 'motor:Sono', 'gravar']);
    assert.deepEqual(h.buscas, [{ tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31' }]);
    assert.equal(h.gravacoes.length, 1);
    const [g] = h.gravacoes;
    assert.deepEqual([g.tipoPeriodo, g.inicio, g.fim], ['month', '2026-08-01', '2026-08-31']);
    assert.deepEqual(g.ordem, ['movimento', 'rotina', 'sono']);
    assert.deepEqual(g.linhas.map((l) => l.caderno), ['movimento', 'rotina', 'sono']);
    assert.deepEqual(r.edicao, { relida: ['movimento', 'rotina', 'sono'] });
    assert.deepEqual(r.desfechos.map((d) => [d.caderno, d.desfecho.tipo]), [
      ['movimento', 'escrito'], ['rotina', 'escrito'], ['sono', 'escrito'],
    ]);
  });

  it('a linha é a leitura do motor virada colunas: texto conferido, assinatura, versões, conclusão, tokens e líder', async () => {
    const h = hospedeiro();
    await imprimir(entrada(), h.portas, h.opcoes());
    assert.deepEqual(h.gravacoes[0].linhas[0], {
      caderno: 'movimento',
      texto: TEXTOS.Movimento,
      provedor: 'prov-a',
      modelo: 'modelo-1',
      promptVersao: PROMPT_VERSAO,
      pacoteVersao: PACOTE_VERSAO,
      motivoDeParada: CONCLUSAO,
      tokensEntrada: 900,
      tokensSaida: 120,
      metricaLider: 'distancia',
    });
    assert.deepEqual(h.gravacoes[0].linhas.map((l) => l.metricaLider), ['distancia', 'tarefas', 'sono']);
  });

  it('a carga não tem versão da agregação — quem carimba é a porta', async () => {
    const h = hospedeiro();
    await imprimir(entrada(), h.portas, h.opcoes());
    for (const l of h.gravacoes[0].linhas) {
      assert.deepEqual(Object.keys(l).filter((k) => /agg/i.test(k)), []);
    }
  });

  it('as versões saem da versão que o descritor carimbou, não das constantes de hoje', async () => {
    const h = hospedeiro();
    const outra: Descritor<PacoteDeFatos, string> = { ...descritorDaRetrospectiva, versao: 7042 };
    await imprimirCom(outra, entrada(), h.portas, h.opcoes());
    for (const l of h.gravacoes[0].linhas) assert.deepEqual([l.promptVersao, l.pacoteVersao], [7, 42]);
  });

  it('o motor recebe o pedido montado pelo descritor, caderno a caderno', async () => {
    const h = hospedeiro();
    await imprimir(entrada(), h.portas, h.opcoes());
    assert.deepEqual(h.rotulosPedidos(), ['Movimento', 'Rotina', 'Sono']);
    assert.ok(h.pedidos.every((p) => p.saida.tipo === 'texto'));
  });

  it('aoComecar e aoLer avisam caderno a caderno, na ordem, antes de gravar', async () => {
    const h = hospedeiro();
    const avisos: string[] = [];
    await imprimir(entrada(), h.portas, h.opcoes(undefined, {
      aoComecar: (c, fila) => {
        avisos.push(`comecar:${c}:${fila.join(',')}`);
        h.diario.push(`aoComecar:${c}`);
      },
      aoLer: (c, d) => {
        avisos.push(`ler:${c}:${d.tipo}:${d.tipo === 'escrito' ? d.leitura.frase : ''}`);
        h.diario.push(`aoLer:${c}`);
      },
    }));
    assert.deepEqual(avisos, [
      'comecar:movimento:movimento,rotina,sono', `ler:movimento:escrito:${TEXTOS.Movimento}`,
      'comecar:rotina:movimento,rotina,sono', `ler:rotina:escrito:${TEXTOS.Rotina}`,
      'comecar:sono:movimento,rotina,sono', `ler:sono:escrito:${TEXTOS.Sono}`,
    ]);
    assert.deepEqual(h.diario, [
      'buscar',
      'aoComecar:movimento', 'motor:Movimento', 'aoLer:movimento',
      'aoComecar:rotina', 'motor:Rotina', 'aoLer:rotina',
      'aoComecar:sono', 'motor:Sono', 'aoLer:sono',
      'gravar',
    ]);
  });
});

describe('um caderno cai no piso — os outros gravam', () => {
  const piso: readonly [string, Resposta | Falha, string][] = [
    ['reprovada', resposta(INVENTADO), 'reprovada'],
    ['transitoria', { classe: 'transitoria', detalhe: 'o prazo de 60 s estourou' }, 'transitoria'],
  ];
  for (const [nome, saida, causa] of piso) {
    it(`Sono ${nome}: gravar 1× só com os dois que escreveram, ordem contígua, e o desfecho traz causa e trilha`, async () => {
      const h = hospedeiro({ roteiro: { sono: saida } });
      const r = gravada(await imprimir(entrada(), h.portas, h.opcoes()));

      assert.equal(h.gravacoes.length, 1);
      assert.deepEqual(h.gravacoes[0].ordem, ['movimento', 'rotina']);
      assert.deepEqual(h.gravacoes[0].linhas.map((l) => l.caderno), ['movimento', 'rotina']);

      const d = desfechoDe(r, 'sono');
      assert.equal(d.tipo, 'nao-escrito');
      assert.ok(d.tipo === 'nao-escrito');
      assert.equal(d.leitura.causa, causa);
      assert.deepEqual(d.leitura.trilha.map((t) => [t.motor, t.desfecho]), [[NUVEM_PADRAO, causa]]);
    });
  }

  it('o texto reprovado não chega a gravar — nem como linha, nem em lugar nenhum da carga', async () => {
    const h = hospedeiro({ roteiro: { movimento: resposta(INVENTADO) } });
    const r = gravada(await imprimir(entrada(), h.portas, h.opcoes()));
    assert.equal(JSON.stringify(h.gravacoes[0]).includes(INVENTADO), false);
    const d = desfechoDe(r, 'movimento');
    assert.ok(d.tipo === 'nao-escrito' && d.leitura.causa === 'reprovada');
    // Os problemas da conferência vêm na trilha — é deles que a tela tira o motivo.
    assert.ok(d.leitura.trilha[0].problemas?.some((p) => p.regra === 'numero'));
  });
});

describe('caderno vazio ou mudo — nenhuma chamada paga, e fora da ordem', () => {
  it('o Coração vazio não é pedido a ninguém e não entra na ordem', async () => {
    const h = hospedeiro();
    await imprimir(entrada(agosto({ fc: false })), h.portas, h.opcoes());
    assert.equal(h.rotulosPedidos().includes('Coração'), false);
    assert.equal(h.gravacoes[0].ordem.includes('coracao'), false);
  });

  it('o caderno mudo (pedido nulo) não chama o motor e não entra na ordem', async () => {
    const h = hospedeiro();
    // Com o descritor de verdade, o mudo de um caderno fechado coincide com o vazio.
    // O descritor embrulhado faz a Rotina muda sem ser vazia — o caso que a
    // sequência tem de tratar como vazio, e só se alcança assim.
    const d = descritorDaRetrospectiva;
    const mudaRotina: Descritor<PacoteDeFatos, string> = {
      ...d,
      montarPedido: (p) => (p.caderno === 'rotina' ? null : d.montarPedido(p)),
    };
    const r = gravada(await imprimirCom(mudaRotina, entrada(), h.portas, h.opcoes()));
    assert.deepEqual(h.rotulosPedidos(), ['Movimento', 'Sono']);
    assert.deepEqual(h.gravacoes[0].ordem, ['movimento', 'sono']);
    const rotina = desfechoDe(r, 'rotina');
    assert.ok(rotina.tipo === 'nao-escrito' && rotina.leitura.causa === 'mudo');
  });

  it('o mudo já impresso também sai da ordem, quando há gravação', async () => {
    const h = hospedeiro({ existentes: ['rotina', 'movimento'] });
    const d = descritorDaRetrospectiva;
    const mudaRotina: Descritor<PacoteDeFatos, string> = {
      ...d,
      montarPedido: (p) => (p.caderno === 'rotina' ? null : d.montarPedido(p)),
    };
    await imprimirCom(mudaRotina, entrada(), h.portas, h.opcoes());
    assert.deepEqual(h.gravacoes[0].ordem, ['movimento', 'sono']);
  });

  it('nenhum caderno pedido tem dado: sem-caderno, sem buscar e sem motor', async () => {
    const h = hospedeiro();
    const r = await imprimir(entrada(agosto({ fc: false })), h.portas, h.opcoes(undefined, { cadernos: ['coracao'] }));
    assert.deepEqual(r, { estado: 'sem-caderno' });
    assert.deepEqual(h.diario, []);
  });

  it('lista de cadernos vazia é chamada errada, e não "nenhum caderno"', async () => {
    const h = hospedeiro();
    await assert.rejects(() => imprimir(entrada(), h.portas, h.opcoes(undefined, { cadernos: [] })), TypeError);
    assert.deepEqual(h.diario, []);
  });

  it('lista vazia lança a qualquer hora do relógio — inclusive com o período ainda aberto', async () => {
    // O mesmo argumento errado não pode dar `aberto` num dia e exceção no outro.
    const h = hospedeiro();
    const emCurso = entrada(agosto(), { agora: new Date(2026, 7, 20, 12, 0, 0) });
    await assert.rejects(() => imprimir(emCurso, h.portas, h.opcoes(undefined, { cadernos: [] })), TypeError);
    assert.deepEqual(h.diario, []);
  });
});

describe('período aberto ou Total — aberto, sem buscar e sem motor', () => {
  it('agosto olhado em 31/08 às 23h59 ainda está em curso', async () => {
    const h = hospedeiro();
    const r = await imprimir(entrada(agosto(), { agora: new Date(2026, 7, 31, 23, 59, 0) }), h.portas, h.opcoes());
    assert.deepEqual(r, { estado: 'aberto' });
    assert.deepEqual(h.diario, []);
  });

  it('o Total nunca fecha', async () => {
    const h = hospedeiro();
    const total = { ...agosto(), kind: 'all', label: 'Tudo', startISO: '2020-01-01' } as RetroSummary;
    const r = await imprimir(entrada(total), h.portas, h.opcoes());
    assert.deepEqual(r, { estado: 'aberto' });
    assert.deepEqual(h.diario, []);
  });
});

/* ── a semana não grava (Story 3.1) ──────────────────────────────────────── */

/**
 * A mesma matéria de agosto, chaveada como **semana** — 24 a 30 de agosto de
 * 2026, fechada para o `AGORA` de 06/09.
 *
 * Fechada de propósito: a recusa que interessa é a do **tipo**, e uma semana em
 * curso já cairia em `aberto` pela guarda de sempre. É exatamente esta semana —
 * fechada, com os quatro cadernos cheios de dado — que passava e gravava antes
 * desta story.
 */
function semanaFechada(): RetroSummary {
  return { ...agosto(), kind: 'week', label: 'Sem 24–30 ago', startISO: '2026-08-24', endISO: '2026-08-30' };
}

describe('a semana não grava edição — a recusa é do núcleo (Story 3.1)', () => {
  it('semana fechada e cheia de dado: estado semana, sem buscar, sem motor e sem gravar', async () => {
    const h = hospedeiro();
    const r = await imprimir(entrada(semanaFechada()), h.portas, h.opcoes());
    assert.deepEqual(r, { estado: 'semana' });
    // O diário é a prova de que nada foi pago: nenhuma busca, nenhum motor,
    // nenhuma gravação. `sem-caderno` também não gasta — a diferença é que este
    // período TEM o que dizer, e mesmo assim não escreve.
    assert.deepEqual(h.diario, []);
    assert.deepEqual(h.gravacoes, []);
    assert.deepEqual(h.buscas, []);
  });

  it('a recusa é do tipo e não do relógio: a semana em curso também dá semana, e nunca aberto', async () => {
    const h = hospedeiro();
    const emCurso = entrada(semanaFechada(), { agora: new Date(2026, 7, 26, 12, 0, 0) });
    assert.deepEqual(await imprimir(emCurso, h.portas, h.opcoes()), { estado: 'semana' });
    assert.deepEqual(h.diario, []);
  });

  it('pedir um caderno só de uma semana também é recusado', async () => {
    const h = hospedeiro();
    const r = await imprimir(entrada(semanaFechada()), h.portas, h.opcoes(cadeiaDaRevista(), { cadernos: ['sono'] }));
    assert.deepEqual(r, { estado: 'semana' });
    assert.deepEqual(h.diario, []);
  });

  it('a recusa não é da tela: `imprimirCom`, com qualquer descritor, recusa igual', async () => {
    const h = hospedeiro();
    const r = await imprimirCom(descritorDaRetrospectiva, entrada(semanaFechada()), h.portas, h.opcoes());
    assert.deepEqual(r, { estado: 'semana' });
    assert.deepEqual(h.diario, []);
  });

  it('a lista de cadernos vazia continua sendo chamada errada, e lança antes de olhar o tipo', async () => {
    const h = hospedeiro();
    await assert.rejects(
      () => imprimir(entrada(semanaFechada()), h.portas, h.opcoes(cadeiaDaRevista(), { cadernos: [] })),
      TypeError,
    );
    assert.deepEqual(h.diario, []);
  });

  it('o mês continua gravando — a guarda nova não pegou os outros tipos junto', async () => {
    const h = hospedeiro();
    assert.equal(gravada(await imprimir(entrada(), h.portas, h.opcoes())).estado, 'gravada');
  });
});

describe('ninguém escreve — nada-gravado, e gravar não é chamada', () => {
  it('todos no piso', async () => {
    const falha: Falha = { classe: 'indisponivel', detalhe: 'sem rede' };
    const h = hospedeiro({ roteiro: { movimento: falha, rotina: falha, sono: falha } });
    const r = nadaGravado(await imprimir(entrada(), h.portas, h.opcoes()));
    assert.deepEqual(h.gravacoes, []);
    assert.deepEqual(r.desfechos.map((d) => d.desfecho.tipo), ['nao-escrito', 'nao-escrito', 'nao-escrito']);
  });

  it('preferência sem-modelo: nenhum motor chamado, e a causa é a preferência', async () => {
    const h = hospedeiro();
    const r = nadaGravado(await imprimir(entrada(), h.portas, h.opcoes(cadeiaDaRevista(SEM_MODELO))));
    assert.deepEqual(h.pedidos, []);
    assert.deepEqual(h.diario, ['buscar']);
    assert.deepEqual(h.gravacoes, []);
    for (const { desfecho } of r.desfechos) {
      assert.ok(desfecho.tipo === 'nao-escrito' && desfecho.leitura.causa === 'preferencia', JSON.stringify(desfecho));
    }
  });

  it('preferência pelo aparelho: a revista não admite, fica no piso — nunca sobe para a nuvem', async () => {
    const h = hospedeiro();
    nadaGravado(await imprimir(entrada(), h.portas, h.opcoes(cadeiaDaRevista(APARELHO_SISTEMA))));
    assert.deepEqual(h.pedidos, []);
  });
});

describe('já impresso e cai no piso — imprimir nunca apaga texto publicado por falha de motor', () => {
  it('Sono impresso, a regeneração dá transitoria: Sono fica na ordem, sem linha nova', async () => {
    const h = hospedeiro({
      existentes: ['movimento', 'sono'],
      roteiro: { sono: { classe: 'transitoria', detalhe: 'o prazo estourou' } },
    });
    await imprimir(entrada(), h.portas, h.opcoes());
    assert.deepEqual(h.gravacoes[0].ordem, ['movimento', 'rotina', 'sono']);
    assert.deepEqual(h.gravacoes[0].linhas.map((l) => l.caderno), ['movimento', 'rotina']);
  });

  it('Sono impresso, a regeneração é reprovada: Sono fica na ordem, sem linha nova', async () => {
    const h = hospedeiro({ existentes: ['sono'], roteiro: { sono: resposta(INVENTADO) } });
    const r = gravada(await imprimir(entrada(), h.portas, h.opcoes()));
    const d = desfechoDe(r, 'sono');
    assert.ok(d.tipo === 'nao-escrito' && d.leitura.causa === 'reprovada', JSON.stringify(d));
    assert.deepEqual(h.gravacoes[0].ordem, ['movimento', 'rotina', 'sono']);
    assert.deepEqual(h.gravacoes[0].linhas.map((l) => l.caderno), ['movimento', 'rotina']);
  });

  it('impressos e a preferência sem-modelo: nada é gravado, então nada sai da ordem', async () => {
    // A preferência vale para a cadeia inteira: todo caderno cai no piso com a mesma
    // causa, e sem linha não há gravação — a função do banco nem é chamada, e o
    // que estava publicado continua como estava.
    const h = hospedeiro({ existentes: ['sono', 'movimento'] });
    const r = nadaGravado(await imprimir(entrada(), h.portas, h.opcoes(cadeiaDaRevista(SEM_MODELO))));
    assert.deepEqual(h.gravacoes, []);
    assert.deepEqual(h.pedidos, []);
    for (const { desfecho } of r.desfechos) {
      assert.ok(desfecho.tipo === 'nao-escrito' && desfecho.leitura.causa === 'preferencia');
    }
  });

  it('o incompleto já impresso também fica, sem linha nova', async () => {
    const h = hospedeiro({ existentes: ['sono'], roteiro: { sono: resposta(TEXTOS.Sono, { tokens: undefined }) } });
    await imprimir(entrada(), h.portas, h.opcoes());
    assert.deepEqual(h.gravacoes[0].ordem, ['movimento', 'rotina', 'sono']);
    assert.deepEqual(h.gravacoes[0].linhas.map((l) => l.caderno), ['movimento', 'rotina']);
  });
});

describe('reimpressão parcial — só o pedido é chamado, e a ordem é recalculada sobre todos os que ficam', () => {
  it("cadernos: ['rotina'] com três impressos: uma chamada, uma linha, a ordem dos três", async () => {
    const h = hospedeiro({ existentes: ['sono', 'movimento', 'rotina'] });
    const r = gravada(await imprimir(entrada(), h.portas, h.opcoes(undefined, { cadernos: ['rotina'] })));
    assert.deepEqual(h.rotulosPedidos(), ['Rotina']);
    assert.deepEqual(h.gravacoes[0].ordem, ['movimento', 'rotina', 'sono']);
    assert.deepEqual(h.gravacoes[0].linhas.map((l) => l.caderno), ['rotina']);
    assert.deepEqual(r.desfechos.map((d) => d.caderno), ['rotina']);
  });

  it('o impresso que não foi pedido e saiu do ranqueamento fica, atrás, pelo catálogo', async () => {
    const h = hospedeiro({ existentes: ['rotina', 'coracao', 'movimento'] });
    await imprimir(entrada(agosto({ fc: false })), h.portas, h.opcoes(undefined, { cadernos: ['rotina'] }));
    assert.deepEqual(h.gravacoes[0].ordem, ['movimento', 'rotina', 'coracao']);
  });
});

describe('pedido que ficou vazio — sai da ordem só quando há gravação', () => {
  it('Coração impresso e agora vazio, com gravação: sai da ordem (a função o apaga)', async () => {
    const h = hospedeiro({ existentes: ['coracao', 'movimento'] });
    await imprimir(entrada(agosto({ fc: false })), h.portas, h.opcoes());
    assert.deepEqual(h.gravacoes[0].ordem, ['movimento', 'rotina', 'sono']);
  });

  it('sem gravação, nada sai — gravar nem é chamada', async () => {
    const falha: Falha = { classe: 'transitoria' };
    const h = hospedeiro({ existentes: ['coracao', 'movimento'], roteiro: { movimento: falha, rotina: falha, sono: falha } });
    nadaGravado(await imprimir(entrada(agosto({ fc: false })), h.portas, h.opcoes()));
    assert.deepEqual(h.gravacoes, []);
  });
});

describe('sem tokens — zero é medida, e não se inventa', () => {
  it('leitura de motor sem tokens: incompleto, e não grava', async () => {
    const h = hospedeiro({ roteiro: { movimento: resposta(TEXTOS.Movimento, { tokens: undefined }) } });
    const r = gravada(await imprimir(entrada(), h.portas, h.opcoes()));
    const d = desfechoDe(r, 'movimento');
    assert.equal(d.tipo, 'incompleto');
    assert.ok(d.tipo === 'incompleto' && d.falta === 'tokens' && d.leitura.origem === 'motor');
    assert.deepEqual(h.gravacoes[0].ordem, ['rotina', 'sono']);
    assert.deepEqual(h.gravacoes[0].linhas.map((l) => l.caderno), ['rotina', 'sono']);
  });

  it('tokens que não são medida (negativo, fracionário) também não gravam', async () => {
    for (const tokens of [{ entrada: -1, saida: 5 }, { entrada: 10, saida: 2.5 }]) {
      const h = hospedeiro({ roteiro: { movimento: resposta(TEXTOS.Movimento, { tokens }) } });
      const r = gravada(await imprimir(entrada(), h.portas, h.opcoes()));
      assert.equal(desfechoDe(r, 'movimento').tipo, 'incompleto', JSON.stringify(tokens));
    }
  });

  it('zero tokens é medida: grava', async () => {
    const h = hospedeiro({ roteiro: { movimento: resposta(TEXTOS.Movimento, { tokens: { entrada: 0, saida: 0 } }) } });
    await imprimir(entrada(), h.portas, h.opcoes());
    assert.deepEqual(h.gravacoes[0].linhas[0].caderno, 'movimento');
    assert.deepEqual([h.gravacoes[0].linhas[0].tokensEntrada, h.gravacoes[0].linhas[0].tokensSaida], [0, 0]);
  });

  it('todos sem tokens: nada-gravado', async () => {
    const semTokens = (c: string) => resposta(TEXTOS[c], { tokens: undefined });
    const h = hospedeiro({ roteiro: { movimento: semTokens('Movimento'), rotina: semTokens('Rotina'), sono: semTokens('Sono') } });
    nadaGravado(await imprimir(entrada(), h.portas, h.opcoes()));
    assert.deepEqual(h.gravacoes, []);
  });
});

describe('gravar roda no máximo uma vez', () => {
  /**
   * A prova negativa desta story: mover `gravar` para dentro do laço faz o
   * `hospedeiro` explodir na segunda chamada — com a edição de quatro cadernos, na
   * segunda de quatro.
   */
  it('com os quatro cadernos escrevendo, uma chamada só, com a ordem e as linhas do conjunto inteiro', async () => {
    const h = hospedeiro();
    const r = gravada(await imprimir(entrada(agosto({ fc: true })), h.portas, h.opcoes()));
    assert.equal(h.diario.filter((x) => x === 'gravar').length, 1);
    assert.equal(h.diario[h.diario.length - 1], 'gravar', 'gravar tem de vir depois do último caderno');
    assert.deepEqual(h.gravacoes[0].ordem, ['movimento', 'rotina', 'sono', 'coracao']);
    assert.equal(h.gravacoes[0].linhas.length, 4);
    assert.equal(r.desfechos.length, 4);
  });
});

describe('a cobertura de noites do Sono', () => {
  const coberturaNoPedido = (h: ReturnType<typeof hospedeiro>) => {
    const sono = h.pedidos.find((p) => /Escreva o caderno Sono\./.test(p.usuario));
    assert.ok(sono, 'o Sono não foi pedido');
    return sono.usuario.split('\n').filter((l) => /^- Neste período: .* de .* dias\./.test(l));
  };

  it('sem coberturaSono na entrada, sai de resumo.sleep (noites dos dois lados)', async () => {
    const h = hospedeiro();
    await imprimir(entrada(agosto({ sono: { cur: 26, prev: 25 } })), h.portas, h.opcoes());
    assert.deepEqual(coberturaNoPedido(h), ['- Neste período: 26 de 31 dias. No período comparado: 25 de 31 dias.']);
  });

  it('sem período anterior, o outro lado é zero noites', async () => {
    const h = hospedeiro();
    await imprimir(entrada(agosto({ sono: { cur: 26, prev: null } })), h.portas, h.opcoes());
    assert.deepEqual(coberturaNoPedido(h), ['- Neste período: 26 de 31 dias. No período comparado: 0 de 31 dias.']);
  });

  it('a que a entrada traz vence a derivada', async () => {
    const h = hospedeiro();
    await imprimir(
      entrada(agosto({ sono: { cur: 26, prev: 25 } }), { coberturaSono: { noites: 30, noitesAnterior: 29 } }),
      h.portas, h.opcoes(),
    );
    assert.deepEqual(coberturaNoPedido(h), ['- Neste período: 30 de 31 dias. No período comparado: 29 de 31 dias.']);
  });

  it('sem resumo.sleep, nunca se inventa cobertura', async () => {
    const h = hospedeiro();
    await imprimir(entrada(agosto({ sono: null })), h.portas, h.opcoes());
    assert.deepEqual(coberturaNoPedido(h), []);
  });
});

describe('as portas falham', () => {
  it('buscar lança: a impressão rejeita antes de qualquer chamada paga', async () => {
    const h = hospedeiro({ buscarLanca: new Error('rls') });
    await assert.rejects(() => imprimir(entrada(), h.portas, h.opcoes()), /rls/);
    assert.deepEqual(h.pedidos, []);
    assert.deepEqual(h.gravacoes, []);
  });

  it('gravar lança: a impressão rejeita, depois de os textos terem sido mostrados', async () => {
    const h = hospedeiro({ gravarLanca: new Error('linha recusada') });
    const lidos: CadernoId[] = [];
    await assert.rejects(
      () => imprimir(entrada(), h.portas, h.opcoes(undefined, { aoLer: (c) => lidos.push(c) })),
      /linha recusada/,
    );
    assert.deepEqual(lidos, ['movimento', 'rotina', 'sono']);
    assert.equal(h.gravacoes.length, 1);
  });
});

describe('o aviso lança — a impressão segue', () => {
  it('aoComecar e aoLer que lançam são engolidos', async () => {
    const h = hospedeiro();
    const r = await imprimir(entrada(), h.portas, h.opcoes(undefined, {
      aoComecar: () => {
        throw new Error('a tela caiu');
      },
      aoLer: () => {
        throw new Error('a tela caiu de novo');
      },
    }));
    gravada(r);
    assert.equal(h.gravacoes[0].linhas.length, 3);
  });

  it('aviso assíncrono que rejeita também não derruba — nem vira rejeição solta', async () => {
    const soltas: unknown[] = [];
    const ouvir = (e: unknown) => soltas.push(e);
    process.on('unhandledRejection', ouvir);
    try {
      const h = hospedeiro();
      const aviso = (async () => {
        throw new Error('assíncrono');
      }) as unknown as (c: CadernoId, d: DesfechoDoCaderno) => void;
      const comecoAssincrono = (async () => {
        throw new Error('assíncrono no começo');
      }) as unknown as (c: CadernoId, fila: readonly CadernoId[]) => void;
      gravada(await imprimir(entrada(), h.portas, h.opcoes(undefined, { aoLer: aviso, aoComecar: comecoAssincrono })));
      assert.equal(h.gravacoes[0].linhas.length, 3);
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.deepEqual(soltas, []);
    } finally {
      process.off('unhandledRejection', ouvir);
    }
  });
});

/**
 * `cadernosComDado` — a pergunta da tela da revista (Story 1.11): quais seções
 * existem. Tem de ser a mesma resposta da impressão, em outra ordem.
 */
describe('cadernosComDado — quem tem o que dizer, pela régua da impressão', () => {
  it('em ordem de catálogo, e não na do ranqueamento', () => {
    // O ranqueamento de agosto lê Movimento, Rotina, Sono (o primeiro teste da
    // matriz); o catálogo é Sono, Movimento, Coração, Rotina.
    assert.deepEqual(cadernosComDado(entrada()), ['sono', 'movimento', 'rotina']);
    assert.deepEqual(cadernosComDado(entrada(agosto({ fc: true }))), ['sono', 'movimento', 'coracao', 'rotina']);
  });

  it('caderno sem dado não aparece — o Coração sem FC', () => {
    assert.equal(cadernosComDado(entrada()).includes('coracao'), false);
  });

  it('o mesmo conjunto que a impressão lê', async () => {
    for (const resumo of [agosto(), agosto({ fc: true }), agosto({ sono: null })]) {
      const h = hospedeiro();
      await imprimir(entrada(resumo), h.portas, h.opcoes());
      const lidos = h.rotulosPedidos().map((r) => (Object.keys(ROTULO) as CadernoId[]).find((c) => ROTULO[c] === r));
      assert.deepEqual([...lidos].sort(), [...cadernosComDado(entrada(resumo))].sort());
    }
  });

  /**
   * O Sono cuja única coisa a dizer é a cobertura de noites: sem métrica nenhuma,
   * mas com `resumo.sleep`. A impressão deriva a cobertura e o lê; uma tela que
   * montasse os pacotes sem ela o esconderia.
   */
  it('com a cobertura de noites do Sono que a impressão deriva', async () => {
    const semMetricaDeSono = { ...agosto({ sono: { cur: 26, prev: 25 } }), health: [] } as RetroSummary;
    assert.deepEqual(cadernosComDado(entrada(semMetricaDeSono)), ['sono', 'movimento', 'rotina']);
    const h = hospedeiro();
    await imprimir(entrada(semMetricaDeSono), h.portas, h.opcoes());
    assert.ok(h.rotulosPedidos().includes('Sono'), 'a impressão não leu o Sono — a régua mudou');
    // Sem `resumo.sleep`, não há cobertura a derivar, e o Sono sem métrica é vazio.
    const semNoites = { ...agosto({ sono: null }), health: [] } as RetroSummary;
    assert.deepEqual(cadernosComDado(entrada(semNoites)), ['movimento', 'rotina']);
  });

  it('não olha o relógio: período em curso também responde', () => {
    assert.deepEqual(
      cadernosComDado({ resumo: agosto(), agora: new Date(2026, 7, 20, 12, 0, 0) }),
      ['sono', 'movimento', 'rotina'],
    );
  });
});

/**
 * `pacotesComDado` — a mesma régua, com os **fatos** (spike 22/09).
 *
 * A bancada dos motores mede a Retrospectiva com um pacote por caderno, e o pacote
 * é a entrada do descritor. O que este bloco prende é que ela e a tela nunca
 * discordem: `cadernosComDado` é a projeção desta função, e o pacote entregue é o
 * daquele caderno — não o de outro, na mesma posição.
 */
describe('pacotesComDado — os fatos dos cadernos que têm o que dizer', () => {
  it('um pacote por caderno de cadernosComDado, na mesma ordem', () => {
    for (const resumo of [agosto(), agosto({ fc: true }), agosto({ sono: null })]) {
      const e = entrada(resumo);
      assert.deepEqual(pacotesComDado(e).map((p) => p.caderno), cadernosComDado(e));
    }
  });

  it('o pacote é o do caderno, e traz o rótulo e o período', () => {
    const pacotes = pacotesComDado(entrada(agosto({ fc: true })));
    const coracao = pacotes.find((p) => p.caderno === 'coracao');
    assert.ok(coracao, 'o Coração com FC não veio');
    assert.equal(coracao.rotulo, ROTULO.coracao);
    assert.equal(coracao.periodo.fechado, true);
  });
});

/**
 * `lapidesDosCadernos` — a segunda pergunta da tela (Story 1.12): quem morreu, em
 * que caderno, e em qual dos **dois** estados. A matriz da story, linha a linha.
 *
 * As quatro mortes são as reais de 2026 (respiração 10/07, VO₂max 14/07, SpO₂
 * 16/07, anéis 17/08) — as mesmas de `period/cadernos.test.ts`.
 */
describe('lapidesDosCadernos — os dois estados, pela régua da impressão', () => {
  const ANEIS = { metrica: 'aneis', ultimaMedidaISO: '2026-08-17' } as const;
  const VO2MAX = { metrica: 'vo2max', ultimaMedidaISO: '2026-07-14' } as const;
  const RESPIRACAO = { metrica: 'respiracao', ultimaMedidaISO: '2026-07-10' } as const;
  const SPO2 = { metrica: 'spo2', ultimaMedidaISO: '2026-07-16' } as const;

  /** O mesmo mês sintético, deslocado para julho: o que muda é a janela, não o dado. */
  const julho = () =>
    ({ ...agosto(), label: 'Julho 2026', startISO: '2026-07-01', endISO: '2026-07-31' }) as RetroSummary;

  it('agosto/2026: os anéis do período, o VO₂max antigo, os outros três vazios', () => {
    assert.deepEqual(lapidesDosCadernos(entrada(agosto(), { lapides: [ANEIS, VO2MAX] })), {
      sono: [],
      coracao: [],
      rotina: [],
      movimento: [
        { metrica: 'vo2max', ultimaMedidaISO: '2026-07-14', doPeriodo: false },
        { metrica: 'aneis', ultimaMedidaISO: '2026-08-17', doPeriodo: true },
      ],
    });
  });

  it('morte posterior ao fim fica de fora: em julho os anéis ainda estavam vivos', () => {
    const r = lapidesDosCadernos(entrada(julho(), { lapides: [ANEIS, VO2MAX] }));
    assert.deepEqual(r.movimento, [{ metrica: 'vo2max', ultimaMedidaISO: '2026-07-14', doPeriodo: true }]);
    // Os anéis não caem no caderno errado por terem sido descartados: eles somem.
    assert.deepEqual(r.coracao, []);
    assert.deepEqual(r.sono, []);
    assert.deepEqual(r.rotina, []);
  });

  /**
   * **Duas lápides do período no mesmo caderno** — e não é hipótese: em
   * julho/2026 a respiração parou em 10/07 e a SpO₂ em 16/07, as duas do Coração,
   * as duas dentro do mês. A tela põe as duas no topo, e nenhuma delas vira a
   * "segunda", que não existe.
   */
  it('duas mortes do mesmo período no mesmo caderno: as duas no topo, em ordem de data', () => {
    const r = lapidesDosCadernos(entrada(julho(), { lapides: [SPO2, RESPIRACAO] }));
    assert.deepEqual(r.coracao, [
      { metrica: 'respiracao', ultimaMedidaISO: '2026-07-10', doPeriodo: true },
      { metrica: 'spo2', ultimaMedidaISO: '2026-07-16', doPeriodo: true },
    ]);
    // E o VO₂max de 14/07 é do mesmo mês, mas de outro caderno: não se mistura.
    assert.deepEqual(lapidesDosCadernos(entrada(julho(), { lapides: [SPO2, RESPIRACAO, VO2MAX] })).movimento, [
      { metrica: 'vo2max', ultimaMedidaISO: '2026-07-14', doPeriodo: true },
    ]);
  });

  /**
   * **O desempate do mesmo dia é a ordem do catálogo** (`METRICAS_COM_LAPIDE`), e
   * é o caso provável: quando um sync para, as métricas param juntas — as quatro
   * mortes de 2026 vieram em julho e agosto do mesmo aparelho. Com datas iguais,
   * a ordem da entrada não pode decidir nada: a resposta é função do conjunto.
   */
  it('mesmo dia: desempata pela ordem do catálogo, e não pela de quem chamou', () => {
    for (const lapides of [
      [{ metrica: 'spo2', ultimaMedidaISO: '2026-07-16' }, { metrica: 'respiracao', ultimaMedidaISO: '2026-07-16' }],
      [{ metrica: 'respiracao', ultimaMedidaISO: '2026-07-16' }, { metrica: 'spo2', ultimaMedidaISO: '2026-07-16' }],
    ] as const) {
      const r = lapidesDosCadernos(entrada(julho(), { lapides }));
      assert.deepEqual(r.coracao.map((l) => l.metrica), ['respiracao', 'spo2']);
      assert.ok(r.coracao.every((l) => l.doPeriodo));
    }
    // Movimento tem a ordem inversa no catálogo (vo2max antes de aneis), e é
    // isso que prova que o desempate é o do mapa, e não o alfabético.
    for (const lapides of [
      [{ metrica: 'aneis', ultimaMedidaISO: '2026-08-17' }, { metrica: 'vo2max', ultimaMedidaISO: '2026-08-17' }],
      [{ metrica: 'vo2max', ultimaMedidaISO: '2026-08-17' }, { metrica: 'aneis', ultimaMedidaISO: '2026-08-17' }],
    ] as const) {
      const r = lapidesDosCadernos(entrada(agosto(), { lapides }));
      assert.deepEqual(r.movimento.map((l) => l.metrica), ['vo2max', 'aneis']);
      assert.ok(r.movimento.every((l) => l.doPeriodo));
    }
  });

  it('os dois estados convivem no mesmo caderno, em ordem de data', () => {
    const r = lapidesDosCadernos(entrada(agosto(), { lapides: [ANEIS, VO2MAX] }));
    assert.deepEqual(r.movimento.map((l) => [l.metrica, l.doPeriodo]), [['vo2max', false], ['aneis', true]]);
  });

  it('duas lápides antigas no Coração, em ordem de data — e a ordem não é a de quem chamou', () => {
    for (const lapides of [[RESPIRACAO, SPO2], [SPO2, RESPIRACAO]]) {
      const r = lapidesDosCadernos(entrada(agosto(), { lapides }));
      assert.deepEqual(r.coracao, [
        { metrica: 'respiracao', ultimaMedidaISO: '2026-07-10', doPeriodo: false },
        { metrica: 'spo2', ultimaMedidaISO: '2026-07-16', doPeriodo: false },
      ]);
      assert.deepEqual(r.movimento, []);
    }
  });

  it('cada métrica no caderno do mapa — VO₂max e anéis em Movimento, respiração e SpO₂ no Coração', () => {
    const r = lapidesDosCadernos(entrada(agosto(), { lapides: [ANEIS, VO2MAX, RESPIRACAO, SPO2] }));
    assert.deepEqual(r.movimento.map((l) => l.metrica), ['vo2max', 'aneis']);
    assert.deepEqual(r.coracao.map((l) => l.metrica), ['respiracao', 'spo2']);
    assert.deepEqual(r.sono, []);
    assert.deepEqual(r.rotina, []);
  });

  it('sem lápide na entrada: os quatro vazios, e nunca ausência', () => {
    assert.deepEqual(lapidesDosCadernos(entrada()), { sono: [], movimento: [], coracao: [], rotina: [] });
  });

  /**
   * A lápide é fato da **entrada**, não da edição: ela aparece num caderno que não
   * tem mais nada a dizer, e a tela a desenha em qualquer estado do caderno.
   */
  it('não depende de o caderno ter dado — o Coração sem FC ainda tem as lápides dele', () => {
    assert.equal(cadernosComDado(entrada()).includes('coracao'), false);
    const r = lapidesDosCadernos(entrada(agosto(), { lapides: [RESPIRACAO, SPO2] }));
    assert.equal(r.coracao.length, 2);
  });

  it('não olha o relógio: período em curso também responde', () => {
    const r = lapidesDosCadernos({
      resumo: agosto(), agora: new Date(2026, 7, 20, 12, 0, 0), lapides: [VO2MAX],
    });
    assert.deepEqual(r.movimento, [{ metrica: 'vo2max', ultimaMedidaISO: '2026-07-14', doPeriodo: false }]);
  });

  it('entrada recusada explode — e é a mesma recusa que a impressão daria', () => {
    const comLapides = (lapides: unknown) =>
      () => lapidesDosCadernos(entrada(agosto(), { lapides } as Partial<EntradaPacote>));
    assert.throws(comLapides([{ metrica: 'passos', ultimaMedidaISO: '2026-08-01' }]), /fora do catálogo/);
    assert.throws(comLapides([{ metrica: 'aneis', ultimaMedidaISO: '2026-02-30' }]), /data impossível/);
    assert.throws(comLapides([ANEIS, ANEIS]), /repetida/);
  });
});

describe('a sequência com descritor não sai pelo barril', () => {
  /**
   * `imprimirCom` aceita descritor — e um descritor com `conferir` trocado gravaria
   * texto não conferido. Pelo barril, o app só alcança `imprimir`, que o fixa.
   */
  it('o barril exporta imprimir e não imprimirCom, nem menciona ia/imprimir-sequencia', async () => {
    const barril: Record<string, unknown> = await import('../index');
    assert.equal(typeof barril.imprimir, 'function');
    assert.equal('imprimirCom' in barril, false);
    const src = readFileSync(join(import.meta.dirname, '..', 'index.ts'), 'utf8');
    assert.equal(/imprimir-sequencia/.test(src), false);
  });
});

describe('o que a sequência não faz', () => {
  it('a exceção do descritor não vira piso: a impressão rejeita', async () => {
    const h = hospedeiro();
    const quebrado: Descritor<PacoteDeFatos, string> = {
      ...descritorDaRetrospectiva,
      montarFrase: () => {
        throw new Error('bug do descritor');
      },
    };
    await assert.rejects(() => imprimirCom(quebrado, entrada(), h.portas, h.opcoes()), /bug do descritor/);
    assert.deepEqual(h.gravacoes, []);
  });

  it('versão do descritor que não se decodifica: rejeita antes de buscar e de qualquer chamada paga', async () => {
    for (const versao of [Number.NaN, -1, 4002.5]) {
      const h = hospedeiro();
      const torto: Descritor<PacoteDeFatos, string> = { ...descritorDaRetrospectiva, versao };
      await assert.rejects(() => imprimirCom(torto, entrada(), h.portas, h.opcoes()), RangeError, String(versao));
      assert.deepEqual(h.diario, [], `versão ${versao}: algo foi buscado ou chamado`);
    }
  });

  it('o anel recebe um evento por caderno lido', async () => {
    const h = hospedeiro();
    await imprimir(entrada(), h.portas, h.opcoes());
    assert.equal(h.eventos.length, 3);
    assert.ok(h.eventos.every((e) => e.recurso === 'retrospectiva' && e.modo === 'produto'));
  });
});
