/**
 * O caminho de LEITURA da edição, no celular — o único que a Story 1.9 deixou
 * ligado.
 *
 * Escrito porque a camada de medição mostrou que ele não tinha teste nenhum:
 * inverter a guarda de período em curso, ou o `length > 0` da store, mantinha as
 * quatro suítes verdes. Os dois erros têm o mesmo sintoma em produção — a tela
 * anuncia coisa que não existe, ou esconde a que existe.
 *
 * O client do Supabase é mockado: o que se mede aqui é a decisão, não a rede.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * O mock guarda o que foi pedido ao banco. É por ele que o caso "período em
 * curso" prova o que interessa: **não consultou**. Um teste que só olhasse o
 * estado devolvido passaria igual com a consulta acontecendo à toa a cada
 * folheada do histórico.
 */
// O prefixo `mock` é exigido pelo jest: só variáveis com ele podem ser
// alcançadas de dentro da fábrica de `jest.mock`, que é içada para o topo.
const mockBanco: {
  pedidos: { tabela: string; filtros: Record<string, unknown> }[];
  linhas: Record<string, unknown>[];
  erro: Error | null;
} = { pedidos: [], linhas: [], erro: null };

jest.mock('../supabase', () => ({
  supabase: {
    from(tabela: string) {
      const filtros: Record<string, unknown> = {};
      mockBanco.pedidos.push({ tabela, filtros });
      const alvo = {
        select: () => alvo,
        eq: (c: string, v: unknown) => { filtros[c] = v; return alvo; },
        order: async () => ({
          data: mockBanco.erro ? null : mockBanco.linhas,
          error: mockBanco.erro,
        }),
      };
      return alvo;
    },
  },
}));

// O ponto de injeção constrói o motor de nuvem na carga; aqui ninguém chama nuvem.
jest.mock('../motores', () => ({ motorPara: () => undefined }));

import {
  APARELHO_SISTEMA,
  CLASSES_DE_FALHA,
  NUVEM_PADRAO,
  SEM_MODELO,
  type CadernoId,
  type Causa,
  type DesfechoDoCaderno,
  type Edicao,
  type EntradaPacote,
  type Impressao,
  type Motor,
  type MotorId,
  type PeriodoDaEdicao,
  type Resposta,
  type RetroSummary,
} from '@vitale/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  assinaturaDoCaderno,
  buscarEdicao,
  classeDoDesfecho,
  comDadoDaEntrada,
  hrefDaRevista,
  dataDaAssinatura,
  fraseDoNaoImpresso,
  imprimirEdicao,
  naoImpressoDe,
  problemasDoDesfecho,
  PROBLEMAS_NA_TELA,
  periodoDaRota,
  rotuloCurtoDaEdicao,
  rotuloDaEdicao,
  slugDoTipo,
  tipoDoSlug,
} from '../edicao-ia';
import { idsConhecidos } from '../motores/catalogo';
import { gravarPreferencia } from '../motores/preferencia';

/**
 * O relógio: 6 de setembro, 19h. Agosto fechou; setembro, não.
 *
 * **Componentes locais, e não string.** `periodoFechado` compara `diaLocal` —
 * `getFullYear/getMonth/getDate`, o calendário de quem roda — com o `fimISO`, e
 * este repositório já teve o CI vermelho por data de teste que muda de dia
 * conforme o `TZ` do processo. `new Date('…T19:00:00')` sem fuso hoje é lido
 * como local e daria o mesmo dia em toda parte, mas é uma regra de parsing que
 * ninguém lê ao escrever o próximo caso; com `Z` ou com deslocamento fixo, o
 * caso do último dia do período abaixo VIRA o dia seguinte em fuso a leste e a
 * suíte quebra onde o código está certo. O construtor por componentes prende a
 * hora de parede, que é exatamente o que a função lê. (Mês é base zero: 8 = setembro.)
 */
const AGORA = new Date(2026, 8, 6, 19, 0, 0);

function entrada(over: { kind?: string; startISO?: string; endISO?: string } = {}) {
  return {
    resumo: {
      kind: over.kind ?? 'month',
      startISO: over.startISO ?? '2026-08-01',
      endISO: over.endISO ?? '2026-08-31',
    },
    agora: AGORA,
  } as unknown as Parameters<typeof buscarEdicao>[1];
}

function linha(caderno: string, posicao: number): Record<string, unknown> {
  return {
    user_id: 'u-1',
    tipo_periodo: 'month',
    inicio: '2026-08-01',
    fim: '2026-08-31',
    caderno,
    posicao,
    texto: `texto de ${caderno}`,
    provedor: 'p',
    modelo: 'm',
    prompt_versao: 3,
    pacote_versao: 3,
    motivo_de_parada: 'STOP',
    tokens_entrada: 1,
    tokens_saida: 2,
    agg_version_no_momento: 9,
    metrica_lider: null,
    gerado_em: '2026-09-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  mockBanco.pedidos.length = 0;
  mockBanco.linhas = [];
  mockBanco.erro = null;
});

describe('buscarEdicao — ausência antes da consulta', () => {
  it('período em curso é ausência, e NÃO consulta o banco', async () => {
    const r = await buscarEdicao('u-1', entrada({ startISO: '2026-09-01', endISO: '2026-09-30' }));
    expect(r).toEqual({ estado: 'ausente' });
    // Folhear seis meses em curso não pode custar seis consultas.
    expect(mockBanco.pedidos).toHaveLength(0);
  });

  it("'all' nunca tem edição — ausência, e nenhuma consulta", async () => {
    const r = await buscarEdicao('u-1', entrada({ kind: 'all', endISO: '2026-08-31' }));
    expect(r).toEqual({ estado: 'ausente' });
    expect(mockBanco.pedidos).toHaveLength(0);
  });

  it('o último dia do período ainda é período em curso', async () => {
    const r = await buscarEdicao('u-1', {
      ...entrada(),
      // 31/08 às 23h59 — o caso que mais sente fuso, e por isso o que mais
      // precisa da hora de parede fixada por componentes. (7 = agosto.)
      agora: new Date(2026, 7, 31, 23, 59, 0),
    } as unknown as Parameters<typeof buscarEdicao>[1]);
    expect(r).toEqual({ estado: 'ausente' });
    expect(mockBanco.pedidos).toHaveLength(0);
  });
});

describe('buscarEdicao — o que o banco responde', () => {
  it('período fechado e sem linha devolve edição vazia', async () => {
    const r = await buscarEdicao('u-1', entrada());
    expect(r).toEqual({ estado: 'ok', edicao: [] });
    expect(mockBanco.pedidos).toHaveLength(1);
    expect(mockBanco.pedidos[0].tabela).toBe('edicoes_ia');
    expect(mockBanco.pedidos[0].filtros).toEqual({
      user_id: 'u-1',
      tipo_periodo: 'month',
      inicio: '2026-08-01',
      fim: '2026-08-31',
    });
  });

  it('devolve os cadernos na ordem que o banco entregou', async () => {
    mockBanco.linhas = [linha('movimento', 1), linha('sono', 2), linha('coracao', 3)];
    const r = await buscarEdicao('u-1', entrada());
    expect(r.estado).toBe('ok');
    if (r.estado !== 'ok') return;
    expect(r.edicao.map((c) => c.caderno)).toEqual(['movimento', 'sono', 'coracao']);
    expect(r.edicao.map((c) => c.posicao)).toEqual([1, 2, 3]);
  });

  it('propaga o erro do banco', async () => {
    mockBanco.erro = new Error('PGRST116');
    await expect(buscarEdicao('u-1', entrada())).rejects.toThrow('PGRST116');
  });
});


/* ── a impressão ─────────────────────────────────────────────────────────── */

/**
 * Um agosto sintético com Movimento e Rotina — o bastante para a sequência do
 * núcleo ter dois cadernos a ler. O que se mede aqui é a LIGAÇÃO: a cadeia saindo
 * da preferência, as portas injetadas chegando à sequência, e o motivo em palavras.
 * A matriz da sequência mora em `packages/shared/src/ia/imprimir.test.ts`.
 */
function recap(current: number, prior: number) {
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null };
}

function agostoSintetico(): EntradaPacote {
  const vazio = recap(0, 0);
  const resumo = {
    kind: 'month', offset: -1, label: 'Agosto 2026', startISO: '2026-08-01', endISO: '2026-08-31',
    tasks: { total: recap(40, 30), byModule: [] },
    habits: { good: [], bad: [] },
    registros: [],
    fitness: {
      count: recap(21, 17), countWithDistance: recap(18, 15),
      distanceM: recap(400_000, 300_000), durationS: recap(144_000, 108_000),
      calories: vazio, hardMin: vazio, floors: vazio, steps: vazio, byType: [],
    },
    sports: { cycling: null, running: null },
    health: [],
    ratings: { sleep: null, day: null },
    purchases: { count: vazio, spend: vazio, countWithPrice: vazio, byCat: [] },
    adherence: null, sleep: null, sleepTriggers: null,
  } as unknown as RetroSummary;
  return { resumo, agora: AGORA };
}

const TEXTOS: Record<string, string> = {
  Movimento: 'Foram 21 atividades, contra 17 em julho.',
  Rotina: 'Foram 40 tarefas concluídas, contra 30 em julho.',
};

function nuvemFalsa(textos: Record<string, string> = TEXTOS) {
  const pedidos: string[] = [];
  const motor: Motor = async (p) => {
    const rotulo = /Escreva o caderno (\S+)\./.exec(p.usuario)?.[1] ?? '?';
    pedidos.push(rotulo);
    const r: Resposta = {
      texto: textos[rotulo] ?? 'Foram 99 coisas.',
      assinatura: { tipo: 'nuvem', provedor: 'prov-a', modelo: 'modelo-1' },
      tokens: { entrada: 10, saida: 5 },
    };
    return r;
  };
  return { motor, pedidos };
}

function depsFalsas(
  o: { preferencia?: MotorId | null; nuvem?: ReturnType<typeof nuvemFalsa>; existentes?: CadernoId[] } = {},
) {
  const gravacoes: Impressao[] = [];
  const buscas: PeriodoDaEdicao[] = [];
  const nuvem = o.nuvem ?? nuvemFalsa();
  const pedidosA: MotorId[] = [];
  const deps = {
    portas: {
      buscar: async (p: PeriodoDaEdicao) => {
        buscas.push(p);
        return (o.existentes ?? []).map((caderno) => ({ caderno }));
      },
      gravar: async (i: Impressao): Promise<Edicao> => {
        gravacoes.push(i);
        return [];
      },
    },
    motorPara: (id: MotorId) => {
      pedidosA.push(id);
      return id.startsWith('nuvem') ? nuvem.motor : undefined;
    },
    registrar: () => undefined,
    agora: () => new Date(Date.UTC(2026, 8, 16, 9, 0, 0)),
    lerPreferencia: async () => o.preferencia ?? null,
    catalogo: idsConhecidos,
  };
  return { deps, gravacoes, buscas, nuvem, pedidosA };
}

describe('imprimirEdicao — a ligação do app à sequência do núcleo', () => {
  it('sem preferência: a cadeia padrão da revista (nuvem), as portas injetadas, uma gravação', async () => {
    const f = depsFalsas();
    const r = await imprimirEdicao('u-1', agostoSintetico(), {}, f.deps);
    expect(r.estado).toBe('gravada');
    expect(f.buscas).toEqual([{ tipoPeriodo: 'month', inicio: '2026-08-01', fim: '2026-08-31' }]);
    expect(f.nuvem.pedidos).toEqual(['Movimento', 'Rotina']);
    expect(f.gravacoes).toHaveLength(1);
    expect(f.gravacoes[0].ordem).toEqual(['movimento', 'rotina']);
    // A impressão não passa pelo banco do mock: nada de `.from` nesta ligação.
    expect(mockBanco.pedidos).toHaveLength(0);
  });

  it('preferência "Sem modelo": nenhum motor é pedido, nada é gravado', async () => {
    const f = depsFalsas({ preferencia: SEM_MODELO });
    const r = await imprimirEdicao('u-1', agostoSintetico(), {}, f.deps);
    expect(r.estado).toBe('nada-gravado');
    expect(f.pedidosA).toEqual([]);
    expect(f.gravacoes).toEqual([]);
    if (r.estado !== 'nada-gravado') return;
    for (const { desfecho } of r.desfechos) {
      expect(naoImpressoDe(desfecho)).toBe('a escolha de motor deste aparelho para a Retrospectiva não escreve a revista');
    }
  });

  it('preferência pelo aparelho: a revista não o admite, e nunca sobe para a nuvem', async () => {
    const f = depsFalsas({ preferencia: APARELHO_SISTEMA });
    const r = await imprimirEdicao('u-1', agostoSintetico(), {}, f.deps);
    expect(r.estado).toBe('nada-gravado');
    expect(f.nuvem.pedidos).toEqual([]);
  });

  it('os avisos chegam à sequência: aoComecar e aoLer por caderno', async () => {
    const f = depsFalsas();
    const avisos: string[] = [];
    await imprimirEdicao('u-1', agostoSintetico(), {
      aoComecar: (c, fila) => avisos.push(`comecar:${c}:${fila.join(',')}`),
      aoLer: (c, d) => avisos.push(`ler:${c}:${d.tipo}`),
    }, f.deps);
    expect(avisos).toEqual([
      'comecar:movimento:movimento,rotina', 'ler:movimento:escrito',
      'comecar:rotina:movimento,rotina', 'ler:rotina:escrito',
    ]);
  });

  it('período em curso: aberto, sem buscar e sem motor', async () => {
    const f = depsFalsas();
    const r = await imprimirEdicao('u-1', { ...agostoSintetico(), agora: new Date(2026, 7, 20, 12, 0, 0) }, {}, f.deps);
    expect(r).toEqual({ estado: 'aberto' });
    expect(f.buscas).toEqual([]);
    expect(f.pedidosA).toEqual([]);
  });
});

/**
 * **A preferência de verdade**, e não uma injetada. Todos os testes acima passam
 * `lerPreferencia` pronto, então a linha de `depsDoApp` que diz QUAL recurso é
 * lido nunca rodava — trocá-la pela da Saúde do sono ficava verde. Aqui só as
 * portas e o motor são falsos; a preferência sai do armazenamento (o mock do
 * AsyncStorage do `jest.setup.js`), com os dois recursos gravados em sentidos
 * opostos: se a impressão ler o recurso errado, a nuvem é pedida e o teste reprova.
 */
describe('imprimirEdicao — a preferência lida é a da Retrospectiva', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('Retrospectiva em sem-modelo e Saúde do sono na nuvem: nada-gravado, nenhum motor pedido', async () => {
    await gravarPreferencia('retrospectiva', SEM_MODELO);
    await gravarPreferencia('saude-do-sono', NUVEM_PADRAO);
    const f = depsFalsas();
    const r = await imprimirEdicao('u-1', agostoSintetico(), {}, { portas: f.deps.portas, motorPara: f.deps.motorPara });
    expect(r.estado).toBe('nada-gravado');
    expect(f.pedidosA).toEqual([]);
    expect(f.gravacoes).toEqual([]);
  });

  it('e o espelho: Retrospectiva na nuvem e Saúde do sono em sem-modelo — a nuvem é pedida', async () => {
    await gravarPreferencia('retrospectiva', NUVEM_PADRAO);
    await gravarPreferencia('saude-do-sono', SEM_MODELO);
    const f = depsFalsas();
    const r = await imprimirEdicao('u-1', agostoSintetico(), {}, { portas: f.deps.portas, motorPara: f.deps.motorPara });
    expect(r.estado).toBe('gravada');
    expect(f.nuvem.pedidos).toEqual(['Movimento', 'Rotina']);
  });
});

describe('imprimirEdicao — um caderno só (Story 1.11)', () => {
  it('`cadernos: [c]` chega à sequência: só aquele caderno é pedido', async () => {
    const f = depsFalsas();
    const r = await imprimirEdicao('u-1', agostoSintetico(), { cadernos: ['rotina'] }, f.deps);
    expect(r.estado).toBe('gravada');
    expect(f.nuvem.pedidos).toEqual(['Rotina']);
    expect(f.gravacoes[0].linhas.map((l) => l.caderno)).toEqual(['rotina']);
  });

  /**
   * Movimento já impresso, Rotina pedida: a ordem que vai ao banco tem os dois,
   * mas a linha é só da Rotina — Movimento não é regenerado nem reassinado.
   */
  it('os outros impressos ficam na ordem e sem linha nova', async () => {
    const f = depsFalsas({ existentes: ['movimento'] });
    await imprimirEdicao('u-1', agostoSintetico(), { cadernos: ['rotina'] }, f.deps);
    expect(f.nuvem.pedidos).toEqual(['Rotina']);
    expect(f.gravacoes[0].ordem).toEqual(['movimento', 'rotina']);
    expect(f.gravacoes[0].linhas.map((l) => l.caderno)).toEqual(['rotina']);
  });

  it('sem `cadernos`, a edição inteira', async () => {
    const f = depsFalsas();
    await imprimirEdicao('u-1', agostoSintetico(), {}, f.deps);
    expect(f.nuvem.pedidos).toEqual(['Movimento', 'Rotina']);
  });
});

describe('naoImpressoDe — por que um caderno não saiu, em palavras', () => {
  it('reprovada: o motivo, sem os problemas; os problemas saem à parte, no máximo três', async () => {
    const f = depsFalsas({ nuvem: nuvemFalsa({ Movimento: 'Foram 23 atividades, porque 7 dias e 9 treinos e 11 voltas.', Rotina: TEXTOS.Rotina }) });
    const r = await imprimirEdicao('u-1', agostoSintetico(), {}, f.deps);
    expect(r.estado).toBe('gravada');
    if (r.estado !== 'gravada') return;
    const mov = r.desfechos.find((d) => d.caderno === 'movimento')!.desfecho;
    expect(naoImpressoDe(mov)).toBe('a nuvem escreveu fora das regras');
    const problemas = problemasDoDesfecho(mov);
    expect(problemas.length).toBe(PROBLEMAS_NA_TELA);
    expect(problemas[0]).toBe('"23" não está no pacote');
    // A conferência de verdade, e a frase da rota.
    expect(classeDoDesfecho(mov)).toBe('reprovada');
    expect(fraseDoNaoImpresso(mov)).toBe('O texto não passou na conferência e foi descartado.');
    // O que saiu fica sem motivo, sem problemas e sem classe.
    const rotina = r.desfechos.find((d) => d.caderno === 'rotina')!.desfecho;
    expect(naoImpressoDe(rotina)).toBeNull();
    expect(problemasDoDesfecho(rotina)).toEqual([]);
    expect(classeDoDesfecho(rotina)).toBeNull();
    expect(fraseDoNaoImpresso(rotina)).toBeNull();
  });

  it('falha de motor: o motivo da assinatura, com o motor da trilha', () => {
    const motivo = naoImpressoDe({
      tipo: 'nao-escrito',
      leitura: {
        origem: 'piso', causa: 'transitoria', ausencia: 'a revista não imprime sem modelo',
        trilha: [{ motor: NUVEM_PADRAO, desfecho: 'transitoria', ms: 60_000 }],
      },
    });
    expect(motivo).toBe('a nuvem falhou por agora');
  });

  it('incompleto: frase própria — o texto não foi guardado', () => {
    const motivo = naoImpressoDe({
      tipo: 'incompleto',
      falta: 'tokens',
      leitura: {
        origem: 'motor', frase: 'x', valor: 'x', motor: NUVEM_PADRAO, trilha: [],
        resposta: {
          texto: 'x',
          assinatura: { tipo: 'nuvem', provedor: 'p', modelo: 'm', versaoDoDescritor: 5003, instante: '2026-09-16T09:00:00.000Z' },
        },
      },
    });
    expect(motivo).toBe('a nuvem escreveu, mas a resposta não disse quanto gastou, e o texto não foi guardado');
  });
});

/* ── a classe de cada causa, e a frase da rota (Story 1.11) ──────────────── */

/** Um piso com a causa dada — com a trilha da nuvem, exceto onde nenhum motor foi chamado. */
function piso(causa: Causa, problemas: string[] = []): DesfechoDoCaderno {
  const semMotor = causa === 'mudo' || causa === 'preferencia';
  return {
    tipo: 'nao-escrito',
    leitura: {
      origem: 'piso', causa, ausencia: 'a revista não imprime sem modelo',
      trilha: semMotor ? [] : [{
        motor: NUVEM_PADRAO,
        desfecho: causa,
        ms: 1_000,
        ...(problemas.length > 0 ? { problemas: problemas.map((detalhe) => ({ regra: 'numero', detalhe })) } : {}),
      }],
    },
  } as unknown as DesfechoDoCaderno;
}

const INCOMPLETO = {
  tipo: 'incompleto',
  falta: 'tokens',
  leitura: {
    origem: 'motor', frase: 'x', valor: 'x', motor: NUVEM_PADRAO, trilha: [],
    resposta: {
      texto: 'x',
      assinatura: { tipo: 'nuvem', provedor: 'p', modelo: 'm', versaoDoDescritor: 5003, instante: '2026-09-16T09:00:00.000Z' },
    },
  },
} as DesfechoDoCaderno;

describe('classeDoDesfecho — a tabela das causas (decisão 3-b, 16/09/2026)', () => {
  /** As onze causas, uma a uma. Uma causa nova no núcleo tem de entrar aqui. */
  const TABELA: Readonly<Record<Causa, 'reprovada' | 'erro' | null>> = {
    reprovada: 'reprovada',
    'recusa-do-modelo': 'reprovada',
    guarda: 'reprovada',
    'saida-invalida': 'reprovada',
    capacidade: 'reprovada',
    janela: 'reprovada',
    indisponivel: 'erro',
    transitoria: 'erro',
    defeito: 'erro',
    preferencia: 'erro',
    mudo: null,
  };

  it('cada causa na sua classe', () => {
    for (const [causa, classe] of Object.entries(TABELA) as [Causa, 'reprovada' | 'erro' | null][]) {
      expect({ causa, classe: classeDoDesfecho(piso(causa)) }).toEqual({ causa, classe });
    }
  });

  it('a tabela cobre todas as classes de falha do núcleo', () => {
    for (const classe of CLASSES_DE_FALHA) expect(Object.keys(TABELA)).toContain(classe);
  });

  it('capacidade e janela são permanentes: reprovadas, não erro', () => {
    expect(classeDoDesfecho(piso('capacidade'))).toBe('reprovada');
    expect(classeDoDesfecho(piso('janela'))).toBe('reprovada');
  });

  it('o desfecho incompleto é erro — não é culpa do texto', () => {
    expect(classeDoDesfecho(INCOMPLETO)).toBe('erro');
  });
});

describe('fraseDoNaoImpresso — o que a rota diz no lugar do texto', () => {
  it('a reprovação da conferência diz que o texto foi descartado; os problemas vêm à parte', () => {
    const d = piso('reprovada', ['"186" não está no pacote', 'base citada sem nome: "contra o ano passado"']);
    expect(fraseDoNaoImpresso(d)).toBe('O texto não passou na conferência e foi descartado.');
    expect(problemasDoDesfecho(d)).toEqual(['"186" não está no pacote', 'base citada sem nome: "contra o ano passado"']);
  });

  it('as outras causas dizem que o caderno não foi escrito, e por quê — as frases da proposta', () => {
    expect(fraseDoNaoImpresso(piso('transitoria'))).toBe('O caderno não foi escrito: a nuvem falhou por agora.');
    expect(fraseDoNaoImpresso(piso('indisponivel'))).toBe('O caderno não foi escrito: a nuvem não atendeu.');
    expect(fraseDoNaoImpresso(piso('recusa-do-modelo'))).toBe('O caderno não foi escrito: a nuvem recusou.');
    expect(fraseDoNaoImpresso(piso('guarda'))).toBe('O caderno não foi escrito: a proteção da nuvem bloqueou o pedido.');
    expect(fraseDoNaoImpresso(piso('saida-invalida'))).toBe('O caderno não foi escrito: a nuvem respondeu o que não se lê.');
    expect(fraseDoNaoImpresso(piso('capacidade'))).toBe('O caderno não foi escrito: a nuvem não aceitou este pedido.');
    expect(fraseDoNaoImpresso(piso('janela'))).toBe('O caderno não foi escrito: o pedido não cabe na janela da nuvem.');
    expect(fraseDoNaoImpresso(piso('defeito'))).toBe('O caderno não foi escrito: houve um defeito ao chamar a nuvem.');
    expect(fraseDoNaoImpresso(piso('preferencia'))).toBe(
      'O caderno não foi escrito: a escolha de motor deste aparelho para a Retrospectiva não escreve a revista.',
    );
    expect(fraseDoNaoImpresso(INCOMPLETO)).toBe(
      'O caderno não foi escrito: a nuvem escreveu, mas a resposta não disse quanto gastou, e o texto não foi guardado.',
    );
  });

  it('o mudo não tem frase: o caderno some', () => {
    expect(fraseDoNaoImpresso(piso('mudo'))).toBeNull();
  });

  /** O texto cru do fornecedor mora no `detalhe` da tentativa, e fica no anel. */
  it('nenhuma frase carrega o detalhe cru da trilha', () => {
    const cru = {
      tipo: 'nao-escrito',
      leitura: {
        origem: 'piso', causa: 'transitoria', ausencia: 'x',
        trilha: [{ motor: NUVEM_PADRAO, desfecho: 'transitoria', ms: 1, detalhe: 'HTTP 503 upstream_overloaded' }],
      },
    } as DesfechoDoCaderno;
    expect(fraseDoNaoImpresso(cru)).not.toMatch(/503|upstream/);
    expect(problemasDoDesfecho(cru)).toEqual([]);
  });
});

describe('slugDoTipo / tipoDoSlug — o tipo na rota', () => {
  it('ida e volta nos quatro tipos com edição', () => {
    expect(slugDoTipo('week')).toBe('semana');
    expect(slugDoTipo('month')).toBe('mes');
    expect(slugDoTipo('season')).toBe('estacao');
    expect(slugDoTipo('year')).toBe('ano');
    for (const tipo of ['week', 'month', 'season', 'year'] as const) expect(tipoDoSlug(slugDoTipo(tipo))).toBe(tipo);
  });

  it('o que não é tipo com edição é nulo — nunca um palpite', () => {
    for (const slug of ['total', 'all', 'month', 'Mes', 'mês', '', 'constructor', '__proto__', undefined, null]) {
      expect({ slug, tipo: tipoDoSlug(slug) }).toEqual({ slug, tipo: null });
    }
  });
});

describe('periodoDaRota — o endereço da rota, e a rota inválida (matriz: "Rota inválida")', () => {
  // Componentes locais: `periodoFechado` e `offsetDoInicio` leem o calendário de quem roda.
  const HOJE = new Date(2026, 8, 17, 10, 0, 0); // 17/09/2026

  it('agosto fechado: o período, o rótulo e fechado', () => {
    const p = periodoDaRota('mes', '2026-08-01', HOJE);
    expect(p).toEqual({ tipo: 'month', inicio: '2026-08-01', offset: -1, rotulo: 'Agosto de 2026', fechado: true });
  });

  it('tipo que não é da revista: nulo — o Total não tem rota', () => {
    expect(periodoDaRota('total', '2026-08-01', HOJE)).toBeNull();
    expect(periodoDaRota('all', '2026-08-01', HOJE)).toBeNull();
    expect(periodoDaRota(undefined, '2026-08-01', HOJE)).toBeNull();
  });

  it('início que não é início de período, ou que não existe: nulo — nunca adivinha', () => {
    expect(periodoDaRota('mes', '2026-08-02', HOJE)).toBeNull();
    expect(periodoDaRota('mes', '2026-02-30', HOJE)).toBeNull();
    expect(periodoDaRota('mes', 'agosto', HOJE)).toBeNull();
    expect(periodoDaRota('mes', undefined, HOJE)).toBeNull();
  });

  it('período em curso: o cabeçalho sabe dizer qual é, e fechado é falso', () => {
    const p = periodoDaRota('mes', '2026-09-01', HOJE);
    expect(p?.rotulo).toBe('Setembro de 2026');
    expect(p?.fechado).toBe(false);
  });
});

describe('os rótulos da revista', () => {
  it('o período por extenso: o mês com "de"; os outros, o rótulo da Retrospectiva', () => {
    expect(rotuloDaEdicao('month', '2026-08-01')).toBe('Agosto de 2026');
    expect(rotuloDaEdicao('month', '2026-03-01')).toBe('Março de 2026');
    expect(rotuloDaEdicao('year', '2025-01-01')).toBe('2025');
    expect(rotuloDaEdicao('season', '2026-04-01')).toBe('Q2 2026');
    expect(rotuloDaEdicao('week', '2026-09-07')).toBe('07/09 – 13/09');
  });

  it('o período curto da miniatura', () => {
    expect(rotuloCurtoDaEdicao('month', '2026-08-01')).toBe('ago 2026');
    expect(rotuloCurtoDaEdicao('year', '2025-01-01')).toBe('2025');
    expect(rotuloCurtoDaEdicao('season', '2026-04-01')).toBe('Q2 2026');
  });

  it('a data da assinatura, no formato da proposta', () => {
    // Meio-dia UTC: o mesmo dia de parede de UTC−11 a UTC+11.
    expect(dataDaAssinatura('2026-09-07T12:00:00.000Z')).toBe('07 set 2026');
    expect(dataDaAssinatura('não é data')).toBe('');
  });
});

/* ── os remendos da revisão da 1.11 ──────────────────────────────────────── */

describe('hrefDaRevista — o endereço que a porta abre', () => {
  it('o formato /revista/<slug>/<início>, nos quatro tipos com edição', () => {
    expect(hrefDaRevista('month', '2026-08-01')).toBe('/revista/mes/2026-08-01');
    expect(hrefDaRevista('week', '2026-09-07')).toBe('/revista/semana/2026-09-07');
    expect(hrefDaRevista('season', '2026-04-01')).toBe('/revista/estacao/2026-04-01');
    expect(hrefDaRevista('year', '2025-01-01')).toBe('/revista/ano/2025-01-01');
  });

  it('o Total não tem rota', () => {
    expect(hrefDaRevista('all', '2000-01-01')).toBeNull();
  });

  it('ida e volta com periodoDaRota', () => {
    const hoje = new Date(2026, 8, 17, 10, 0, 0);
    const [, , slug, inicio] = hrefDaRevista('month', '2026-08-01')!.split('/');
    expect(periodoDaRota(slug, inicio, hoje)).toMatchObject({ tipo: 'month', inicio: '2026-08-01', offset: -1, fechado: true });
  });
});

describe('assinaturaDoCaderno', () => {
  it('modelo · data', () => {
    expect(assinaturaDoCaderno('modelo-1', '2026-09-07T12:00:00.000Z')).toBe('modelo-1 · 07 set 2026');
  });

  it('sem data que se leia, só o modelo — nunca o ponto pendurado', () => {
    expect(assinaturaDoCaderno('modelo-1', 'não é data')).toBe('modelo-1');
    expect(assinaturaDoCaderno('modelo-1', '')).toBe('modelo-1');
  });
});

describe('comDadoDaEntrada — a resposta que a tela e as ações dividem', () => {
  it('dados prontos: os cadernos com dado, na ordem do catálogo', () => {
    expect(comDadoDaEntrada(agostoSintetico(), true)).toEqual(['movimento', 'rotina']);
  });

  it('dados não prontos: sem resposta', () => {
    expect(comDadoDaEntrada(agostoSintetico(), false)).toBeNull();
  });

  it('entrada que o núcleo recusa: sem resposta, e o motivo no log', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const recusada = {
      ...agostoSintetico(),
      lapides: [{ metrica: 'nao-existe', ultimaMedidaISO: '2026-08-10' }],
    } as unknown as EntradaPacote;
    expect(comDadoDaEntrada(recusada, true)).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
