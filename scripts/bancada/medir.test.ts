/**
 * O laço da medição, linha por linha da matriz de I/O da story — com o
 * orquestrador de verdade e motores falsos, sem rede e sem disco.
 *
 * O acervo é sintético (AD-8: nenhum dado de produção no git). O motor "bom" é o
 * que devolve **a frase do template daquela janela**, com os marcadores: ela passa
 * na conferência por construção (a 5.3 fixa isso), e é o jeito de exercitar o
 * caminho aprovado sem escrever prosa à mão para cada um dos sete casos.
 *
 * Este é um arquivo de teste, e por isso pode importar as peças de `sleep/` que a
 * guarda (7) barra na bancada — é ela que prova que a bancada não precisa delas.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  APARELHO_SISTEMA,
  NUVEM_PADRAO,
  SEM_MODELO,
  casoDaSaude,
  entradaDaSaude,
  exemploDaSaude,
  templateDaSaude,
  type Falha,
  type Motor,
  type MotorId,
  type Pedido,
  type Resposta,
  type SleepPeriod,
} from '@vitale/shared';
import { chaveDaJanela, enumerarJanelas, type JanelaClassificada } from './janelas.ts';
import { SEM_PEDIDO, medir, type Dados } from './medir.ts';
import type { LinhaDoRelatorio } from './relatorio.ts';

/* ── o acervo sintético ── */

const BXL = 120;

function noite(wakeDay: string, onsetH = 23.5, durH = 7.5, awakeMin = 0): SleepPeriod {
  const ancora = new Date(`${wakeDay}T00:00:00Z`);
  if (onsetH >= 12) ancora.setUTCDate(ancora.getUTCDate() - 1);
  const onsetMs = ancora.getTime() + onsetH * 3_600_000 - BXL * 60_000;
  const wakeMs = onsetMs + (durH + awakeMin / 60) * 3_600_000;
  return {
    userId: 'u',
    onsetAt: new Date(onsetMs).toISOString(),
    wakeAt: new Date(wakeMs).toISOString(),
    inBedAt: null,
    inBedEnd: null,
    tzOffset: BXL,
    wakeDay,
    asleepH: durH,
    awakenings: awakeMin === 0 ? [] : [
      {
        from: new Date(onsetMs + 3_600_000).toISOString(),
        to: new Date(onsetMs + 3_600_000 + awakeMin * 60_000).toISOString(),
      },
    ],
    stages: null,
    stageSegments: null,
  };
}

function mais(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const HOJE = '2026-09-10';

function arquivo(): Dados {
  const noites: SleepPeriod[] = [];
  const notas: Record<string, number> = {};
  for (let i = 0; i < 80; i += 1) {
    const dia = mais('2026-06-23', i);
    if (i % 9 === 4 || (i > 30 && i < 38)) continue;
    noites.push(noite(dia, 22.6 + (i % 5) * 0.45, 5.6 + (i % 4) * 0.7, (i * 7) % 41));
    if (i % 3 !== 0) notas[dia] = 1 + (i % 5);
  }
  return { noites, notas };
}

const DADOS = arquivo();
const JANELAS = enumerarJanelas(DADOS.noites, DADOS.notas, HOJE);

const entrada = (j: JanelaClassificada) =>
  entradaDaSaude(DADOS.noites, DADOS.notas, { range: j.range, offset: j.offset, hoje: HOJE });

/** A frase do template daquela janela, **com** os marcadores — o que um motor bom escreveria. */
const comoOTemplate = (j: JanelaClassificada): string => templateDaSaude(entrada(j));

/** Uma janela de um caso, no alcance pedido. Lança se o acervo não tiver — teste cego é pior. */
function doCaso(caso: string, alcance: 'noite' | 'periodo' = 'periodo'): JanelaClassificada {
  const j = JANELAS.find((x) => x.caso === caso && x.alcance === alcance);
  assert.ok(j, `o acervo sintético não tem janela ${caso}/${alcance} — ajuste o arquivo()`);
  return j;
}

/* ── o hospedeiro falso ── */

const resposta = (texto: string, tipo: 'aparelho' | 'nuvem' = 'nuvem'): Resposta => ({
  texto,
  assinatura: { tipo, provedor: 'prov-a', modelo: 'modelo-1' },
  tokens: { entrada: 310, saida: 24 },
});

type SaidaFalsa = Resposta | Falha | { readonly lanca: unknown } | ((p: Pedido) => Resposta | Falha);

function motorFalso(saida: SaidaFalsa) {
  const pedidos: Pedido[] = [];
  const motor: Motor = async (p) => {
    pedidos.push(p);
    if (typeof saida === 'function') return saida(p);
    if ('lanca' in saida) throw saida.lanca;
    return saida;
  };
  return { motor, pedidos };
}

/** O relógio anda `PASSO` ms a cada leitura: é dele que sai o `ms` de cada tentativa. */
const PASSO = 120;

function hospedeiro(motores: Readonly<Record<string, Motor | undefined>>) {
  const pedidosDeMotor: MotorId[] = [];
  let t = Date.UTC(2026, 8, 12, 9, 0, 0);
  return {
    pedidosDeMotor,
    hospedeiro: {
      motorPara: (id: MotorId): Motor | undefined => {
        pedidosDeMotor.push(id);
        return motores[id];
      },
      agora: (): Date => {
        const d = new Date(t);
        t += PASSO;
        return d;
      },
    },
  };
}

const avisos: string[] = [];
const avisar = (m: string): void => {
  avisos.push(m);
};

/** Mede uma coluna de modelo sobre as janelas dadas, com um motor falso. */
async function medirMotor(
  janelas: readonly JanelaClassificada[],
  motor: MotorId,
  saida: SaidaFalsa,
): Promise<{ linhas: readonly LinhaDoRelatorio[]; pedidos: Pedido[]; pedidosDeMotor: MotorId[] }> {
  const falso = motorFalso(saida);
  const h = hospedeiro({ [motor]: falso.motor });
  const medido = await medir({
    dados: DADOS,
    hoje: HOJE,
    janelas,
    colunas: [{ motor, janelas }],
    hospedeiro: h.hospedeiro,
    avisar,
  });
  const coluna = medido.colunas.find((c) => c.motor === motor);
  assert.ok(coluna, `a coluna de ${motor} não saiu`);
  return { linhas: coluna.linhas, pedidos: falso.pedidos, pedidosDeMotor: h.pedidosDeMotor };
}

const SEM_MARCADOR = (s: string): boolean => !/[{}]/.test(s);

/** O item `i` de uma lista, provando que ele existe — o `assert` estreita o tipo. */
function um<T>(xs: readonly T[], i = 0): T {
  const x = xs[i];
  assert.ok(x !== undefined, `a lista não tem item ${i} (tem ${xs.length})`);
  return x;
}


/* ── a coluna sem modelo ── */

describe('a coluna sem modelo', () => {
  it('dá uma linha por janela, com o pedido, o hash e a frase — e não pede motor nenhum', async () => {
    const h = hospedeiro({});
    const medido = await medir({ dados: DADOS, hoje: HOJE, janelas: JANELAS, colunas: [], hospedeiro: h.hospedeiro, avisar });
    assert.equal(medido.colunas.length, 1);
    const coluna = um(medido.colunas);
    assert.equal(coluna.motor, SEM_MODELO);
    assert.equal(coluna.linhas.length, JANELAS.length);
    assert.deepEqual(h.pedidosDeMotor, [], 'a coluna sem modelo pediu motor ao hospedeiro');

    for (const [k, l] of coluna.linhas.entries()) {
      const j = um(JANELAS, k);
      assert.equal(chaveDaJanela(l), chaveDaJanela(j));
      assert.equal(l.caso, j.caso);
      assert.equal(l.alcance, j.alcance);
      assert.equal(l.desfecho, 'template');
      assert.equal(l.ms, 0);
      // A Saúde monta pedido em TODO caso, então nenhuma linha dela é `mudo` — e é
      // por isso que o hash é sempre um digest aqui. O caminho do sentinela é
      // exercitado no teste de `SEM_PEDIDO`, abaixo.
      assert.match(l.hashDoPedido, /^[0-9a-f]{64}$/);
      assert.ok(l.frase && l.frase.length > 0, chaveDaJanela(j));
      assert.equal(l.frase, l.template);
      assert.ok(SEM_MARCADOR(l.frase), `a frase do piso saiu com marcador: ${l.frase}`);
      assert.equal(l.problemas, undefined);
      assert.equal(l.tokens, undefined);
    }
    // O pedido existe para toda janela, e é função do caso — não da janela.
    assert.ok(Object.keys(medido.pedidos).length > 0);
    assert.ok(
      Object.keys(medido.pedidos).length < JANELAS.length,
      'cada janela deu um pedido próprio — o pedido virou função do passo',
    );
  });

  it('mesma janela, mesmo caso: duas execuções dão o mesmo hash em toda linha', async () => {
    const uma = async () => {
      const h = hospedeiro({});
      const m = await medir({ dados: DADOS, hoje: HOJE, janelas: JANELAS, colunas: [], hospedeiro: h.hospedeiro, avisar });
      return m.colunas[0].linhas.map((l) => `${chaveDaJanela(l)} ${l.hashDoPedido} ${l.frase}`);
    };
    assert.deepEqual(await uma(), await uma());
  });

  it('não mexe no acervo', async () => {
    const antes = JSON.stringify(DADOS);
    const h = hospedeiro({});
    await medir({ dados: DADOS, hoje: HOJE, janelas: JANELAS, colunas: [], hospedeiro: h.hospedeiro, avisar });
    assert.equal(JSON.stringify(DADOS), antes);
  });
});

/* ── a coluna de um motor ── */

describe('a coluna de um motor', () => {
  it('motor bom: aprovada, com ms, tokens, a frase interpolada e o texto cru', async () => {
    const j = doCaso('duas');
    const cru = comoOTemplate(j);
    const { linhas, pedidos } = await medirMotor([j], NUVEM_PADRAO, resposta(cru));
    assert.equal(linhas.length, 1);
    const l = um(linhas);
    assert.equal(l.desfecho, 'ok', JSON.stringify(l.problemas));
    assert.equal(l.ms, PASSO);
    assert.deepEqual(l.tokens, { entrada: 310, saida: 24 });
    assert.equal(l.textoDoMotor, cru);
    assert.ok(l.frase && SEM_MARCADOR(l.frase), l.frase);
    assert.equal(l.problemas, undefined);
    // O pedido que chegou ao motor é o do descritor, não um montado aqui.
    assert.equal(pedidos.length, 1);
    assert.equal(pedidos[0].amostragem, 'gulosa');
    assert.equal(pedidos[0].saida.tipo, 'texto');
  });

  it('a régua vem junto: a linha do motor carrega o template daquela janela', async () => {
    const j = doCaso('duas');
    const { linhas } = await medirMotor([j], NUVEM_PADRAO, resposta(comoOTemplate(j)));
    const h = hospedeiro({});
    const semModelo = await medir({ dados: DADOS, hoje: HOJE, janelas: [j], colunas: [], hospedeiro: h.hospedeiro, avisar });
    assert.equal(um(linhas).template, um(um(semModelo.colunas).linhas).frase);
  });

  it('motor que calcula: reprovada, com os problemas regra por regra', async () => {
    const j = doCaso('duas');
    const { linhas } = await medirMotor([j], NUVEM_PADRAO, resposta('A duração e a regularidade somam 4 pontos.'));
    const l = um(linhas);
    assert.equal(l.desfecho, 'reprovada');
    assert.ok((l.problemas ?? []).length > 0);
    assert.ok((l.problemas ?? []).some((p) => p.regra === 'algarismo'), JSON.stringify(l.problemas));
    assert.equal(l.frase, undefined, 'a frase saiu de uma resposta reprovada');
    assert.ok(l.textoDoMotor, 'o texto cru não foi guardado — o dono não tem o que julgar');
  });

  it('motor que recusa em texto livre: recusa-do-modelo', async () => {
    const j = doCaso('duas');
    const { linhas } = await medirMotor([j], NUVEM_PADRAO, resposta('Desculpe, não posso ajudar com isso.'));
    assert.equal(um(linhas).desfecho, 'recusa-do-modelo');
    assert.ok((um(linhas).problemas ?? []).some((p) => p.regra === 'recusa'));
  });

  it('nuvem fora do ar: a classe entra na linha e a medição continua nas outras janelas', async () => {
    const janelas = JANELAS.filter((j) => j.range === '7d').slice(0, 4);
    for (const classe of ['indisponivel', 'transitoria'] as const) {
      const { linhas } = await medirMotor(janelas, NUVEM_PADRAO, { classe, detalhe: 'HTTP 502' });
      assert.equal(linhas.length, janelas.length, `${classe} interrompeu a medição`);
      for (const l of linhas) {
        assert.equal(l.desfecho, classe);
        assert.equal(l.detalhe, 'HTTP 502');
        assert.equal(l.frase, undefined);
        assert.ok(l.template.length > 0, 'a régua sumiu numa linha que falhou');
      }
    }
  });

  it('motor não injetado: tentativa sintética indisponivel, sem chamada nenhuma', async () => {
    const j = doCaso('duas');
    const falso = motorFalso(resposta('nunca chamado'));
    const h = hospedeiro({}); // nenhum motor entregue
    const medido = await medir({
      dados: DADOS,
      hoje: HOJE,
      janelas: [j],
      colunas: [{ motor: 'aparelho:sistema', janelas: [j] }],
      hospedeiro: h.hospedeiro,
      avisar,
    });
    const coluna = medido.colunas.find((c) => c.motor === 'aparelho:sistema');
    assert.ok(coluna);
    const l = um(coluna.linhas);
    assert.equal(l.desfecho, 'indisponivel');
    assert.equal(l.sintetica, true);
    assert.equal(l.ms, 0);
    assert.deepEqual(falso.pedidos, [], 'um motor foi chamado mesmo sem ser entregue');
    assert.ok(h.pedidosDeMotor.includes('aparelho:sistema'));
  });

  it('motor que lança: defeito, com a pilha que o anel recolheu', async () => {
    const j = doCaso('duas');
    const { linhas } = await medirMotor([j], NUVEM_PADRAO, { lanca: new Error('o SDK explodiu') });
    const l = um(linhas);
    assert.equal(l.desfecho, 'defeito');
    assert.ok(l.detalhe?.includes('o SDK explodiu'));
    assert.ok(l.pilha?.includes('o SDK explodiu'), 'a pilha do anel não chegou à linha');
  });

  it('mede só a amostra da coluna, não todas as janelas', async () => {
    const amostra = JANELAS.slice(0, 3);
    // O motor recusa quando recebe o pedido da Saúde — reconhecido pelo exemplo que o
    // pedido traz. Até a 5.11 ele decidia por `'Caso:'`, que a v2 não escreve: o ramo da
    // recusa morreu calado, e o teste seguia verde. Agora a recusa é afirmada.
    const exemplos = new Set(amostra.map((j) => exemploDaSaude(entrada(j))));
    assert.ok(exemplos.size > 0);
    const falso = motorFalso((p) =>
      resposta([...exemplos].some((x) => p.usuario.includes(x)) ? 'Desculpe, não posso.' : 'x'),
    );
    const h = hospedeiro({ [NUVEM_PADRAO]: falso.motor });
    const medido = await medir({
      dados: DADOS,
      hoje: HOJE,
      janelas: JANELAS,
      colunas: [{ motor: NUVEM_PADRAO, janelas: amostra }],
      hospedeiro: h.hospedeiro,
      avisar,
    });
    assert.equal(um(medido.colunas, 0).linhas.length, JANELAS.length); // sem-modelo: todas
    assert.equal(um(medido.colunas, 1).linhas.length, amostra.length); // a nuvem: a amostra
    assert.equal(falso.pedidos.length, amostra.length);
    for (const l of um(medido.colunas, 1).linhas) assert.equal(l.desfecho, 'recusa-do-modelo', `${l.range}@${l.offset}`);
  });

  it('a linha da coluna de modelo leva o exemplo do pedido; a régua, não', async () => {
    const amostra = [doCaso('uma'), doCaso('duas', 'noite'), doCaso('sem-contagem')];
    const falso = motorFalso((p) => resposta(p.usuario));
    const h = hospedeiro({ [NUVEM_PADRAO]: falso.motor });
    const medido = await medir({
      dados: DADOS,
      hoje: HOJE,
      janelas: amostra,
      colunas: [{ motor: NUVEM_PADRAO, janelas: amostra }],
      hospedeiro: h.hospedeiro,
      avisar,
    });
    for (const l of um(medido.colunas, 0).linhas) assert.equal(l.exemplo, undefined, 'a régua não tem pedido de modelo');
    const daNuvem = um(medido.colunas, 1).linhas;
    assert.equal(daNuvem.length, amostra.length);
    for (const [i, l] of daNuvem.entries()) {
      const exemplo = exemploDaSaude(entrada(amostra[i]!));
      assert.equal(l.exemplo, exemplo, `${l.range}@${l.offset}`);
      // E é o exemplo que o motor recebeu, dentro do pedido.
      assert.ok(falso.pedidos[i]?.usuario.includes(exemplo), `${l.range}@${l.offset}`);
    }
  });

  it('sem-modelo pedido como coluna de modelo não é medido duas vezes', async () => {
    const h = hospedeiro({});
    const medido = await medir({
      dados: DADOS,
      hoje: HOJE,
      janelas: [doCaso('duas')],
      colunas: [{ motor: SEM_MODELO, janelas: [doCaso('duas')] }],
      hospedeiro: h.hospedeiro,
      avisar,
    });
    assert.deepEqual(medido.colunas.map((c) => c.motor), [SEM_MODELO]);
  });

  it('o hash do pedido é o mesmo nas duas colunas da mesma janela', async () => {
    const j = doCaso('duas');
    const falso = motorFalso(resposta(comoOTemplate(j)));
    const h = hospedeiro({ [NUVEM_PADRAO]: falso.motor });
    const medido = await medir({
      dados: DADOS,
      hoje: HOJE,
      janelas: [j],
      colunas: [{ motor: NUVEM_PADRAO, janelas: [j] }],
      hospedeiro: h.hospedeiro,
      avisar,
    });
    assert.equal(um(um(medido.colunas, 0).linhas).hashDoPedido, um(um(medido.colunas, 1).linhas).hashDoPedido);
  });
});

/* ── os casos do acervo, cobertos de ponta a ponta ── */

/** O que o acervo sintético cobre, **fixado**: uma combinação que suma é regressão. */
const COMBOS_DO_ACERVO = [
  'duas|noite', 'duas|periodo',
  'fora-do-empate|noite', 'fora-do-empate|periodo',
  'medidas-insuficientes|noite',
  'sem-contagem|periodo',
  'todas-iguais|noite',
  'tudo-no-maximo|noite',
  'uma|noite', 'uma|periodo',
];

describe('a cobertura do acervo sintético', () => {
  it('cobre as dez combinações de caso × alcance que ele alcança, nomeadas', () => {
    const combos = [...new Set(JANELAS.map((j) => `${j.caso}|${j.alcance}`))].sort();
    assert.deepEqual(combos, [...COMBOS_DO_ACERVO].sort());
  });

  it('cobre os motivos de `sem-contagem` que o núcleo produz — e `sem-medida` não é um deles', () => {
    const motivos = [...new Set(JANELAS.filter((j) => j.caso === 'sem-contagem').map((j) => j.motivo))].sort();
    assert.deepEqual(motivos, ['cobertura', 'sem-noite']);
    // `sem-medida` está no tipo e não sai de dado: `nightScore` sempre mede a duração,
    // e `periodScore` com noite também — a 5.3 registrou isso como decisão, e a frase
    // existe para o piso nunca chamar cobertura cheia de "poucas para contar".
    assert.equal(JANELAS.some((j) => j.motivo === 'sem-medida'), false);
  });
});

describe('todo caso que o acervo tem passa pela medição', () => {
  it('o motor que escreve o template é aprovado em cada caso x alcance', async () => {
    const vistos = new Map<string, JanelaClassificada>();
    for (const j of JANELAS) vistos.set(`${j.caso}|${j.alcance}`, vistos.get(`${j.caso}|${j.alcance}`) ?? j);
    assert.equal(vistos.size, COMBOS_DO_ACERVO.length, `o acervo cobriu ${vistos.size} combinações`);
    for (const j of vistos.values()) {
      const { linhas } = await medirMotor([j], NUVEM_PADRAO, resposta(comoOTemplate(j)));
      const l = um(linhas);
      assert.equal(
        l.desfecho,
        'ok',
        `${j.caso}/${j.alcance}: ${JSON.stringify(l.problemas)} — template ${JSON.stringify(l.template)}`,
      );
    }
  });
});

/* ── a coluna do aparelho e a sonda (story 5.10) ── */

/** Uma resposta do aparelho como a ponte a assina: com a plataforma e o build do sistema. */
const doAparelho = (texto: string): Resposta => ({
  texto,
  assinatura: { tipo: 'aparelho', provedor: 'prov-a', modelo: 'modelo-do-sistema', plataforma: 'macOS 27.0', buildDoSistema: '26A428' },
  tokens: { entrada: 71, saida: 5 },
});

/** As dimensões que o código nomeia numa janela — a resposta certa da sonda. */
const nomeadas = (j: JanelaClassificada): readonly string[] => casoDaSaude(entrada(j).score).nomear;

/**
 * Um motor que responde aos dois pedidos: à leitura, com um texto qualquer (o que a
 * conferência diz dele não importa aqui); à sonda, com a escolha que `escolher` der
 * para as opções do esquema.
 */
function motorDasDuas(escolher: (opcoes: readonly string[]) => string) {
  return motorFalso((p) => {
    if (p.saida.tipo !== 'esquema') return doAparelho('Uma frase qualquer.');
    const dim = p.saida.esquema.type === 'object' ? p.saida.esquema.properties['dimensao'] : undefined;
    const opcoes = dim && dim.type === 'string' ? dim.enum ?? [] : [];
    return doAparelho(JSON.stringify({ dimensao: escolher(opcoes) }));
  });
}

describe('a coluna do aparelho', () => {
  it('a linha carrega quem assinou — a plataforma e o build do sistema que a ponte leu', async () => {
    const j = doCaso('duas');
    const { linhas } = await medirMotor([j], APARELHO_SISTEMA, doAparelho(comoOTemplate(j)));
    const l = um(linhas);
    assert.equal(l.desfecho, 'ok', JSON.stringify(l.problemas));
    assert.deepEqual(l.assinatura, {
      tipo: 'aparelho',
      provedor: 'prov-a',
      modelo: 'modelo-do-sistema',
      plataforma: 'macOS 27.0',
      buildDoSistema: '26A428',
    });
    assert.deepEqual(l.tokens, { entrada: 71, saida: 5 });
  });

  it('o aparelho fora é indisponivel com o motivo na linha — e a medição continua', async () => {
    const janelas = JANELAS.filter((j) => j.range === 'ultima').slice(0, 3);
    const { linhas } = await medirMotor(janelas, APARELHO_SISTEMA, { classe: 'indisponivel', detalhe: 'modelo do sistema indisponível: appleIntelligenceNotEnabled' });
    assert.equal(linhas.length, janelas.length);
    for (const l of linhas) {
      assert.equal(l.desfecho, 'indisponivel');
      assert.match(l.detalhe ?? '', /appleIntelligenceNotEnabled/);
      assert.equal(l.sintetica, undefined, 'a falha veio da ponte: não é sintética');
    }
  });
});

describe('o que só o hospedeiro sabe chega à linha', () => {
  it('frio e doHospedeiro saem da diferença do registro antes e depois da linha', async () => {
    const janelas = JANELAS.filter((j) => j.range === '7d').slice(0, 3);
    const registro = { frias: 0, doHospedeiro: 0 };
    let n = 0;
    const falso = motorFalso(() => {
      n += 1;
      // A primeira é fria (processo novo); a segunda, o hospedeiro fabricou (prazo).
      if (n === 1) registro.frias += 1;
      if (n === 2) {
        registro.doHospedeiro += 1;
        return { classe: 'transitoria', detalhe: 'o prazo de 60 s estourou' };
      }
      return doAparelho('Uma frase.');
    });
    const h = hospedeiro({ [APARELHO_SISTEMA]: falso.motor });
    const medido = await medir({
      dados: DADOS,
      hoje: HOJE,
      janelas,
      colunas: [{ motor: APARELHO_SISTEMA, janelas }],
      hospedeiro: { ...h.hospedeiro, registro },
      avisar,
    });
    const linhas = medido.colunas.find((c) => c.motor === APARELHO_SISTEMA)?.linhas ?? [];
    assert.deepEqual(linhas.map((l) => [l.frio ?? false, l.doHospedeiro ?? false]), [[true, false], [false, true], [false, false]]);
  });
});

describe('a sonda de fidelidade', () => {
  /** Uma janela de cada combinação de caso × alcance do acervo. */
  const UMA_DE_CADA = [...new Map(JANELAS.map((j) => [`${j.caso}|${j.alcance}`, j] as const)).values()];

  async function comSonda(janelas: readonly JanelaClassificada[], escolher: Parameters<typeof motorDasDuas>[0], sonda = true) {
    const falso = motorDasDuas(escolher);
    const h = hospedeiro({ [APARELHO_SISTEMA]: falso.motor });
    const medido = await medir({
      dados: DADOS,
      hoje: HOJE,
      janelas,
      colunas: [{ motor: APARELHO_SISTEMA, janelas }],
      hospedeiro: h.hospedeiro,
      sonda,
      avisar,
    });
    return { medido, pedidos: falso.pedidos };
  }

  it('sem --sonda, nenhuma coluna tem sonda e nenhum pedido guiado sai', async () => {
    const { medido, pedidos } = await comSonda(UMA_DE_CADA, (o) => o[0] ?? '', false);
    for (const c of medido.colunas) assert.equal(c.sonda, undefined, c.motor);
    assert.equal(pedidos.some((p) => p.saida.tipo === 'esquema'), false);
  });

  it('pergunta só onde o caso nomeia; o resto é mudo, sem chamada', async () => {
    const { medido, pedidos } = await comSonda(UMA_DE_CADA, (o) => o[0] ?? '');
    const coluna = medido.colunas.find((c) => c.motor === APARELHO_SISTEMA);
    assert.ok(coluna?.sonda, 'a coluna do aparelho não teve sonda');
    assert.equal(coluna.sonda.length, UMA_DE_CADA.length, 'a sonda não rodou sobre as mesmas janelas da coluna');
    // A régua não é motor: a coluna sem modelo nunca tem sonda.
    assert.equal(medido.colunas.find((c) => c.motor === SEM_MODELO)?.sonda, undefined);
    const perguntadas = coluna.sonda.filter((l) => l.desfecho !== 'mudo');
    for (const l of coluna.sonda) {
      const nomeia = ['uma', 'duas', 'fora-do-empate'].includes(l.caso);
      assert.equal(l.desfecho !== 'mudo', nomeia, `${l.caso}/${l.alcance}: ${l.desfecho}`);
      if (!nomeia) {
        assert.equal(l.hashDoPedido, SEM_PEDIDO);
        assert.deepEqual(l.esperado, []);
      }
    }
    assert.equal(pedidos.filter((p) => p.saida.tipo === 'esquema').length, perguntadas.length);
  });

  it('a escolha no que o código nomeia é ok; fora dele é reprovada, com a escolha e o esperado', async () => {
    const perguntaveis = UMA_DE_CADA.filter((j) => nomeadas(j).length > 0);
    assert.ok(perguntaveis.length >= 4, `o acervo tem ${perguntaveis.length} janelas que nomeiam`);

    // A sonda pergunta na ordem das janelas, e toda janela perguntável gera um pedido:
    // a i-ésima pergunta é a da i-ésima janela.
    let i = 0;
    const certa = await comSonda(perguntaveis, () => nomeadas(um(perguntaveis, i++))[0] ?? '');
    const linhasCertas = certa.medido.colunas.find((c) => c.motor === APARELHO_SISTEMA)?.sonda ?? [];
    for (const l of linhasCertas) {
      assert.equal(l.desfecho, 'ok', `${l.caso}/${l.alcance}: ${JSON.stringify(l.problemas)}`);
      assert.ok(l.escolha && l.esperado.includes(l.escolha), `${l.escolha} não está em ${l.esperado.join(', ')}`);
      assert.match(l.hashDoPedido, /^[0-9a-f]{64}$/);
      assert.equal(l.assinatura?.buildDoSistema, '26A428');
    }

    // Uma opção medida que o código não nomeia: todo caso que nomeia tem uma.
    let k = 0;
    const errada = await comSonda(perguntaveis, (opcoes) => {
      const certas = nomeadas(um(perguntaveis, k++));
      return opcoes.find((o) => !certas.includes(o)) ?? '';
    });
    const linhasErradas = (errada.medido.colunas.find((c) => c.motor === APARELHO_SISTEMA)?.sonda ?? []).filter(
      (l) => l.desfecho !== 'mudo',
    );
    assert.equal(linhasErradas.length, perguntaveis.length);
    for (const l of linhasErradas) {
      assert.equal(l.desfecho, 'reprovada');
      const p = l.problemas?.[0];
      assert.equal(p?.regra, 'escolha');
      assert.ok(p?.detalhe.includes(`escolheu ${l.escolha}`), p?.detalhe);
    }
  });

  it('a linha da sonda leva as opções que o motor recebeu — as dimensões medidas', async () => {
    const j = UMA_DE_CADA.find((x) => x.caso === 'duas');
    assert.ok(j);
    const { medido } = await comSonda([j], (o) => o[0] ?? '');
    const l = medido.colunas.find((c) => c.motor === APARELHO_SISTEMA)?.sonda?.[0];
    assert.ok(l);
    assert.deepEqual([...l.opcoes].sort(), [...casoDaSaude(entrada(j).score).dimensoes].sort());
    assert.ok(l.esperado.every((k) => l.opcoes.includes(k)));
  });

  it('o pedido da sonda entra nos pedidos do relatório, com hash próprio', async () => {
    const j = UMA_DE_CADA.find((x) => x.caso === 'uma');
    assert.ok(j);
    const { medido } = await comSonda([j], (o) => o[0] ?? '');
    const coluna = medido.colunas.find((c) => c.motor === APARELHO_SISTEMA);
    const hashDaSonda = coluna?.sonda?.[0]?.hashDoPedido ?? '';
    const hashDaLeitura = coluna?.linhas[0]?.hashDoPedido ?? '';
    assert.notEqual(hashDaSonda, hashDaLeitura);
    assert.ok(medido.pedidos[hashDaSonda], 'o corpo do pedido da sonda não chegou ao relatório');
    assert.match(medido.pedidos[hashDaSonda]?.usuario ?? '', /Pergunta:/);
  });
});

/* ── o defeito, e o sentinela de "nenhum pedido" ── */

describe('o defeito de uma janela não derruba a corrida', () => {
  /** Um acervo sabotado: ler `wakeDay` da segunda noite lança. */
  function comNoiteEnvenenada(): Dados {
    const noites = DADOS.noites.slice(0, 3).map((p, i) => {
      if (i !== 1) return p;
      return Object.defineProperty({ ...p }, 'wakeDay', {
        get(): string {
          throw new Error('o acervo está podre nesta noite');
        },
      }) as SleepPeriod;
    });
    return { noites, notas: DADOS.notas };
  }

  it('recolhe o defeito como linha, com a pilha e o aviso — e mede as outras', async () => {
    const recolhidos: string[] = [];
    const h = hospedeiro({});
    const tres = JANELAS.filter((j) => j.range === 'ultima').slice(0, 3);
    const medido = await medir({
      dados: comNoiteEnvenenada(),
      hoje: HOJE,
      janelas: tres,
      colunas: [],
      hospedeiro: h.hospedeiro,
      avisar: (m) => recolhidos.push(m),
    });
    const linhas = um(medido.colunas).linhas;
    assert.equal(linhas.length, tres.length, 'o defeito interrompeu a medição');
    const comDefeito = linhas.filter((l) => l.desfecho === 'defeito');
    assert.ok(comDefeito.length > 0, 'o acervo sabotado não produziu defeito — o teste ficou vácuo');
    for (const l of comDefeito) {
      assert.ok(l.pilha?.includes('o acervo está podre'), 'a pilha não chegou à linha');
      assert.ok(l.detalhe?.includes('o acervo está podre'));
      assert.equal(l.hashDoPedido, SEM_PEDIDO, 'um defeito antes do pedido não tem hash de pedido');
    }
    // O aviso é o que aparece no `stderr` de quem está rodando.
    assert.equal(recolhidos.length, comDefeito.length, JSON.stringify(recolhidos));
    for (const m of recolhidos) assert.match(m, /^defeito em /);
  });

  it('a sonda sobre o acervo envenenado: defeito com a pilha na janela podre, e as outras seguem', async () => {
    const recolhidos: string[] = [];
    const tres = JANELAS.filter((j) => j.range === 'ultima').slice(0, 3);
    const falso = motorFalso(resposta('{"dimensao":"duracao"}', 'aparelho'));
    const h = hospedeiro({ [APARELHO_SISTEMA]: falso.motor });
    const medido = await medir({
      dados: comNoiteEnvenenada(),
      hoje: HOJE,
      janelas: tres,
      colunas: [{ motor: APARELHO_SISTEMA, janelas: tres }],
      hospedeiro: h.hospedeiro,
      sonda: true,
      avisar: (m) => recolhidos.push(m),
    });
    const sonda = medido.colunas.find((c) => c.motor === APARELHO_SISTEMA)?.sonda ?? [];
    assert.equal(sonda.length, tres.length, 'o defeito interrompeu a sonda');
    const comDefeito = sonda.filter((l) => l.desfecho === 'defeito');
    assert.ok(comDefeito.length > 0, 'o acervo sabotado não produziu defeito na sonda — o teste ficou vácuo');
    for (const l of comDefeito) {
      assert.ok(l.pilha?.includes('o acervo está podre'), 'a pilha não chegou à linha da sonda');
      assert.equal(l.hashDoPedido, SEM_PEDIDO);
    }
    // Toda janela virou linha — o defeito de uma não parou o laço —, e cada defeito foi avisado.
    assert.deepEqual(sonda.map((l) => `${l.range}@${l.offset}`), tres.map((j) => `${j.range}@${j.offset}`));
    const daSonda = recolhidos.filter((m) => /^defeito na sonda de aparelho:sistema /.test(m));
    assert.equal(daSonda.length, comDefeito.length, JSON.stringify(recolhidos));
  });

  it('o sentinela de "nenhum pedido" não se confunde com um digest', () => {
    assert.doesNotMatch(SEM_PEDIDO, /^[0-9a-f]{64}$/);
    assert.notEqual(SEM_PEDIDO, '');
  });
});
