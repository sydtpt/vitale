/**
 * A amostra no iPhone (story 5.13) — o preparo, a medição de uma janela, a sequência e as
 * marcas do hospedeiro.
 *
 * **A função medida aqui é a que a tela chama**: `medirJanela`, de
 * `lib/motores/amostra.ts`. Ela morava na tela, que o jest não importa, e era "provada"
 * por uma cópia à mão — uma cópia prova a cópia. A régua (a amostra, a linha, as medidas)
 * é do núcleo e tem teste lá (`packages/shared/src/bancada/`).
 *
 * Nenhum teste abre rede nem chama o módulo nativo: a ponte é falsa.
 */
import { describe, it, expect, jest } from '@jest/globals';

// O ponto de injeção constrói o client do Supabase no import; aqui ninguém o usa.
jest.mock('../supabase', () => ({ supabase: {} }));

import {
  APARELHO_SISTEMA,
  amostraDaNuvem,
  descritorDaSaudeDoSono,
  entradaDaSaude,
  enumerarJanelas,
  medidasDoPortao,
  templateDaSaude,
  type Falha,
  type JanelaClassificada,
  type LinhaDoRelatorio,
  type SleepPeriod,
} from '@vitale/shared';
import {
  criarMotorPara,
  criarTransporteDoAparelho,
  novoRegistroDoAparelho,
  registroDoAparelho,
  type PonteDoAparelho,
} from '../motores';
import { PESOS_ABERTOS } from '../motores/catalogo';
import {
  ETAPAS_DO_PREPARO,
  MARCAS_INDEFINIDAS,
  PARADO_ANTES_DA_VEZ,
  duracaoCurta,
  freioDoHospedeiro,
  medirCorridas,
  medirEmSequencia,
  medirJanela,
  prepararAmostra,
  previsaoDaAmostra,
  prontidaoDasNotas,
  relogioMonotonico,
  type AcervoDaStore,
  type DadosDaAmostra,
} from '../motores/amostra';
import type { ColunaDaCorrida } from '../motores/amostras-regras';

/* ── o acervo sintético ── */

const BXL = 120;

function noite(wakeDay: string, onsetH: number, durH: number): SleepPeriod {
  const ancora = new Date(`${wakeDay}T00:00:00Z`);
  if (onsetH >= 12) ancora.setUTCDate(ancora.getUTCDate() - 1);
  const onsetMs = ancora.getTime() + onsetH * 3_600_000 - BXL * 60_000;
  return {
    userId: 'u',
    onsetAt: new Date(onsetMs).toISOString(),
    wakeAt: new Date(onsetMs + durH * 3_600_000).toISOString(),
    inBedAt: null,
    inBedEnd: null,
    tzOffset: BXL,
    wakeDay,
    asleepH: durH,
    awakenings: [],
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
const PRIMEIRA = '2026-07-13';
const NOITES: SleepPeriod[] = [];
const NOTAS: Record<string, number> = {};
for (let i = 0; i < 60; i += 1) {
  const dia = mais(PRIMEIRA, i);
  if (i % 9 === 4) continue;
  NOITES.push(noite(dia, 22.6 + (i % 5) * 0.45, 5.6 + (i % 4) * 0.7));
  if (i % 3 !== 0) NOTAS[dia] = 1 + (i % 5);
}
const DADOS: DadosDaAmostra = { noites: NOITES, notas: NOTAS };
const JANELAS = amostraDaNuvem(enumerarJanelas(NOITES, NOTAS, HOJE), 1);
const entrada = (j: JanelaClassificada) => entradaDaSaude(NOITES, NOTAS, { range: j.range, offset: j.offset, hoje: HOJE });

const acervo = (p: Partial<AcervoDaStore> = {}): AcervoDaStore => ({
  loaded: true,
  periods: NOITES,
  sleepRatings: NOTAS,
  ratingsSince: PRIMEIRA,
  ...p,
});

/** Uma ponte falsa que copia o template do pedido — a linha passa na conferência. */
function ponteQueCopiaOTemplate(o: { readonly trava?: () => boolean; readonly atrasoMs?: number } = {}): PonteDoAparelho & {
  readonly chamadas: string[];
} {
  const chamadas: string[] = [];
  const porPedido = new Map<string, string>();
  for (const j of JANELAS) {
    const e = entrada(j);
    const pedido = descritorDaSaudeDoSono.montarPedido(e);
    if (pedido) porPedido.set(pedido.usuario, templateDaSaude(e));
  }
  const responder = (pedido: string): Promise<string> => {
    chamadas.push(pedido);
    const usuario = (JSON.parse(pedido) as { usuario: string }).usuario;
    const linha = JSON.stringify({
      texto: porPedido.get(usuario) ?? 'uma frase qualquer',
      provedor: 'prov-a',
      modelo: 'AFM 3 Core Advanced',
      plataforma: 'iOS 27.0',
      buildDoSistema: '27A1',
    });
    if (o.trava?.() === true) return new Promise<string>((r) => setTimeout(() => r(linha), o.atrasoMs ?? 70));
    return Promise.resolve(linha);
  };
  return {
    chamadas,
    diagnostico: async () => '{"disponivel":true}',
    diagnosticoDosPesos: async () => '{"disponivel":true}',
    compilacaoDosPesos: async () => '{"compilado":true,"componentes":1,"compilados":1}',
    // A amostra nunca compila — ela mede. A porta existe porque a ponte a declara.
    compilarPesos: async () => '{"compilado":true,"componentes":1,"compilados":1}',
    responderComPesos: (_pesos, pedido) => responder(pedido),
    responder,
  };
}

/* ── o portão das notas ── */

describe('as notas inteiras antes de enumerar', () => {
  it('pronta quando cobrem desde a noite mais antiga', () => {
    // E devolve o dia coberto: é ele que a tela mostra, em vez de um palpite.
    expect(prontidaoDasNotas({ ratingsSince: '2025-05-01' }, '2025-05-10')).toEqual({ pronta: true, desde: '2025-05-01' });
    expect(prontidaoDasNotas({ ratingsSince: '2025-05-10' }, '2025-05-10')).toEqual({ pronta: true, desde: '2025-05-10' });
  });

  it('as notas de 90 dias que a store traz sozinha não bastam — e o motivo diz até onde chegaram', () => {
    const r = prontidaoDasNotas({ ratingsSince: '2026-06-22' }, '2025-05-10');
    expect(r.pronta).toBe(false);
    expect(r.pronta ? '' : r.motivo).toContain('2026-06-22');
    expect(r.pronta ? '' : r.motivo).toContain('2025-05-10');
  });

  it('antes de carregar não mede; e o erro da carga que faltou explica o porquê', () => {
    expect(prontidaoDasNotas({ ratingsSince: null }, '2025-05-10').pronta).toBe(false);
    const quebrou = prontidaoDasNotas({ ratingsSince: '2026-01-01', notasError: 'JWT expired' }, '2025-05-10');
    expect(quebrou.pronta).toBe(false);
    expect(quebrou.pronta ? '' : quebrou.motivo).toContain('JWT expired');
  });

  it('erro VELHO com a cobertura já inteira não trava a sessão — quem decide é a cobertura', () => {
    // Uma carga anterior falhou, outra cobriu o acervo: não há percepção faltando.
    expect(prontidaoDasNotas({ ratingsSince: '2025-01-01', notasError: 'falhou antes' }, '2025-05-10')).toEqual({
      pronta: true,
      desde: '2025-01-01',
    });
    // `null` conta como ausência de erro, tanto quanto `undefined`.
    expect(prontidaoDasNotas({ ratingsSince: '2026-06-22', notasError: null }, '2025-05-10').pronta).toBe(false);
    expect(prontidaoDasNotas({ ratingsSince: '2025-01-01', notasError: null }, '2025-05-10')).toEqual({ pronta: true, desde: '2025-01-01' });
  });
});

/* ── o preparo ── */

/** A fila que o preparo recebe: um motor apto, que é o caso de sempre. */
const UM_MOTOR: readonly ColunaDaCorrida[] = [{ motor: APARELHO_SISTEMA }];

describe('o preparo da amostra', () => {
  const base = {
    hoje: HOJE,
    limite: 1,
    carregarNotasDesde: async () => undefined,
    motores: async () => UM_MOTOR,
  };

  it('enumera, amostra e diz o que usou — e devolve a fila que vai correr', async () => {
    const r = await prepararAmostra({ ...base, estado: () => acervo() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fila).toEqual(UM_MOTOR);
    expect(r.janelas.length).toBeGreaterThan(0);
    expect(r.contexto.janelas).toBe(r.janelas.length);
    expect(r.contexto.maisAntiga).toBe(PRIMEIRA);
    expect(r.contexto.notasDesde).toBe(PRIMEIRA);
    expect(r.contexto.enumeradas).toBeGreaterThan(r.janelas.length);
    expect(r.contexto.passos.reduce((n, p) => n + p.passos, 0)).toBe(r.contexto.enumeradas);
  });

  it('sem motor, sem sono e sem noite: recusa com o motivo, e nenhuma janela', async () => {
    // A fila só de recusas não chega a enumerar: 390 janelas para dizer o que já se sabia
    // no primeiro passo seriam segundos de tela gastos à toa.
    const perdeuOPe = await prepararAmostra({
      ...base,
      estado: () => acervo(),
      motores: async () => [{ motor: APARELHO_SISTEMA, recusa: 'a Apple Intelligence está desligada' }],
    });
    expect(perdeuOPe).toEqual({ ok: false, motivo: expect.stringContaining('desligada') as unknown as string });

    const semNinguem = await prepararAmostra({ ...base, estado: () => acervo(), motores: async () => [] });
    expect(semNinguem.ok ? '' : semNinguem.motivo).toContain('nenhum motor do aparelho marcado');

    const carregando = await prepararAmostra({ ...base, estado: () => acervo({ loaded: false }) });
    expect(carregando.ok).toBe(false);
    const comErro = await prepararAmostra({ ...base, estado: () => acervo({ loaded: false, error: 'sem rede' }) });
    expect(comErro.ok ? '' : comErro.motivo).toContain('sem rede');

    const semNoite = await prepararAmostra({ ...base, estado: () => acervo({ periods: [] }) });
    expect(semNoite.ok ? '' : semNoite.motivo).toContain('noite');
  });

  it('carrega as notas até a noite mais antiga, e recusa quando elas não chegam', async () => {
    const pedidos: string[] = [];
    const r = await prepararAmostra({
      ...base,
      // A janela curta que a store carrega sozinha: começa DEPOIS da noite mais antiga.
      estado: () => acervo({ ratingsSince: mais(PRIMEIRA, 10) }),
      carregarNotasDesde: async (dia) => {
        pedidos.push(dia);
      },
    });
    expect(pedidos).toEqual([PRIMEIRA]);
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.motivo).toContain('a percepção muda o caso');
  });

  it('o acervo que muda durante a carga não vira amostra errada: recusa e pede outro toque', async () => {
    let periods = NOITES;
    const r = await prepararAmostra({
      ...base,
      estado: () => acervo({ periods }),
      carregarNotasDesde: async () => {
        // Um sync trouxe uma noite mais antiga enquanto as notas carregavam.
        periods = [noite(mais(PRIMEIRA, -30), 23, 7), ...NOITES];
      },
    });
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.motivo).toContain('o acervo mudou');
    expect(r.ok ? '' : r.motivo).toContain('toque de novo');
  });

  it('amostra vazia é recusa com motivo — nunca "completa — 0 de 0"', async () => {
    const r = await prepararAmostra({ ...base, limite: 0, estado: () => acervo() });
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.motivo).toContain('vazia');
  });

  it('dá para cancelar entre as etapas, e o cancelado não tem motivo (ninguém pediu explicação)', async () => {
    for (const parar of ETAPAS_DO_PREPARO) {
      const vistas: string[] = [];
      let cancelar = false;
      const r = await prepararAmostra({
        ...base,
        estado: () => acervo(),
        cancelado: () => cancelar,
        aoAndar: (etapa) => {
          vistas.push(etapa);
          if (etapa === parar) cancelar = true;
        },
      });
      expect(r).toEqual({ ok: false, motivo: null });
      expect(vistas[vistas.length - 1]).toBe(parar);
    }
  });

  it('as etapas saem na ordem, e cada uma respira antes de rodar (a enumeração é longa)', async () => {
    const vistas: string[] = [];
    let respiros = 0;
    await prepararAmostra({
      ...base,
      estado: () => acervo(),
      aoAndar: (etapa) => vistas.push(etapa),
      respirar: async () => {
        respiros += 1;
      },
    });
    expect(vistas).toEqual([...ETAPAS_DO_PREPARO]);
    expect(respiros).toBe(ETAPAS_DO_PREPARO.length);
  });
});

/* ── uma janela, pela função que a tela chama ── */

describe('medirJanela — a composição que produz os números', () => {
  it('a régua é o PISO: o template da linha é a frase sem modelo, e o aparelho é chamado uma vez só', async () => {
    const janela = JANELAS[0]!;
    const ponte = ponteQueCopiaOTemplate();
    const registro = novoRegistroDoAparelho();
    const motorPara = criarMotorPara(async () => ({ data: null, error: new Error('sem rede') }), 1_000, ponte, registro);
    const l = await medirJanela(janela, DADOS, HOJE, APARELHO_SISTEMA, { motorPara, registro });

    // As duas asserções que mordem se alguém trocar o SEM_MODELO da régua pelo aparelho:
    // o template deixaria de ser o piso, e o modelo seria chamado duas vezes na janela.
    expect(l.template).toBe(templateDaSaude(entrada(janela)));
    expect(ponte.chamadas).toHaveLength(1);

    expect(l.desfecho).toBe('ok');
    expect(l.hashDoPedido).toMatch(/^[0-9a-f]{64}$/);
    expect(l.frase).toBe(l.template);
    expect(l.assinatura?.modelo).toBe('AFM 3 Core Advanced');
    expect(l.frio).toBe(true);
    expect(l.ms).toBeGreaterThanOrEqual(0);
  });

  it('o hash da linha é o do pedido que o Mac monta — em toda janela da amostra', async () => {
    const ponte = ponteQueCopiaOTemplate();
    const registro = novoRegistroDoAparelho();
    const motorPara = criarMotorPara(async () => ({ data: null, error: new Error('sem rede') }), 1_000, ponte, registro);
    for (const j of JANELAS) {
      const l = await medirJanela(j, DADOS, HOJE, APARELHO_SISTEMA, { motorPara, registro });
      const pedido = descritorDaSaudeDoSono.montarPedido(entrada(j));
      if (pedido) expect(l.hashDoPedido).toMatch(/^[0-9a-f]{64}$/);
      expect(l.caso).toBe(j.caso);
      expect(l.alcance).toBe(j.alcance);
    }
  });

  it('sem motor (a ponte fora do build) a linha é sintética, sem marca nenhuma', async () => {
    const registro = novoRegistroDoAparelho();
    const l = await medirJanela(JANELAS[0]!, DADOS, HOJE, APARELHO_SISTEMA, { motorPara: () => undefined, registro });
    expect(l.desfecho).toBe('indisponivel');
    expect(l.sintetica).toBe(true);
    expect(l.frio).toBeUndefined();
    expect(l.doHospedeiro).toBeUndefined();
  });

  it('a exceção de função pura vira linha de defeito — a amostra não para', async () => {
    const registro = novoRegistroDoAparelho();
    const l = await medirJanela(JANELAS[0]!, { noites: NOITES, notas: NOTAS }, 'dia-invalido', APARELHO_SISTEMA, { registro });
    expect(l.desfecho).toBe('defeito');
    expect(l.detalhe).toContain('RangeError');
  });
});

/* ── as marcas do hospedeiro ── */

describe('as marcas caem na janela certa (por chamada, não por contador)', () => {
  it('o prazo marca a janela que estourou, e não a seguinte', async () => {
    const registro = novoRegistroDoAparelho();
    let travar = true;
    const ponte = ponteQueCopiaOTemplate({ trava: () => travar, atrasoMs: 70 });
    const motorPara = criarMotorPara(async () => ({ data: null, error: new Error('sem rede') }), 50, ponte, registro);

    const presa = await medirJanela(JANELAS[0]!, DADOS, HOJE, APARELHO_SISTEMA, { motorPara, registro });
    expect(presa.desfecho).toBe('transitoria');
    expect(presa.doHospedeiro).toBe(true);
    expect(presa.frio).toBe(true);

    travar = false;
    const seguinte = await medirJanela(JANELAS[1]!, DADOS, HOJE, APARELHO_SISTEMA, { motorPara, registro });
    expect(seguinte.doHospedeiro).toBeUndefined();
    expect(seguinte.frio).toBeUndefined();
    expect(seguinte.desfecho).toBe('ok');
  });

  it('duas chamadas encerrando na mesma janela: a linha DIZ que não sabe, em vez de chutar', async () => {
    const registro = novoRegistroDoAparelho();
    const ponte = ponteQueCopiaOTemplate();
    const motorPara = criarMotorPara(async () => ({ data: null, error: new Error('sem rede') }), 1_000, ponte, registro);
    // Outra tela pede ao aparelho no meio da janela: o transporte carimba duas.
    const intruso = criarTransporteDoAparelho(async () => '{"texto":"de outra tela","provedor":"p","modelo":"m"}', 1_000, { registro });
    const medida = medirJanela(JANELAS[0]!, DADOS, HOJE, APARELHO_SISTEMA, { motorPara, registro });
    await intruso('{"usuario":"outro"}');
    const l = await medida;
    expect(l.frio).toBeUndefined();
    expect(l.doHospedeiro).toBeUndefined();
    expect(l.detalhe).toContain(MARCAS_INDEFINIDAS);
    expect(registro.marcas).toHaveLength(2);
  });

  it('o transporte do app é o que a amostra lê: o singleton mexe quando o motor do app roda', async () => {
    // `criarMotorPara` com TRÊS argumentos — como o app o constrói — carimba em
    // `registroDoAparelho`. Sem isto, a tela leria um registro que ninguém alimenta.
    const antes = registroDoAparelho.marcas.length;
    const ponte = ponteQueCopiaOTemplate();
    const motor = criarMotorPara(async () => ({ data: null, error: new Error('sem rede') }), 1_000, ponte)(APARELHO_SISTEMA)!;
    await motor({ sistema: 'as regras', usuario: 'o caso', amostragem: 'gulosa', saida: { tipo: 'texto' }, guardrails: 'padrao' });
    const novas = registroDoAparelho.marcas.slice(antes);
    expect(novas).toHaveLength(1);
    expect(novas[0]).toEqual({ frio: true, doHospedeiro: false });
  });

  it('a ponte que rejeita é do hospedeiro (o Engine.swift nunca lança)', async () => {
    const registro = novoRegistroDoAparelho();
    const transporte = criarTransporteDoAparelho(
      async () => {
        throw new Error('a cola quebrou');
      },
      1_000,
      { registro },
    );
    await expect(transporte('a')).rejects.toThrow('a cola quebrou');
    expect(registro.marcas).toEqual([{ frio: true, doHospedeiro: true }]);
  });

  it('o prazo esperando a vez é do hospedeiro, e não é fria: o pedido nem chegou ao aparelho', async () => {
    const registro = novoRegistroDoAparelho();
    let soltar: (l: string) => void = () => undefined;
    const transporte = criarTransporteDoAparelho(
      (p) => (p === 'lento' ? new Promise<string>((r) => (soltar = r)) : Promise.resolve(`linha ${p}`)),
      15,
      { tetoMs: 10_000, registro },
    );
    const lento = transporte('lento');
    const esperando = transporte('esperando');
    expect((JSON.parse(await lento) as Falha).classe).toBe('transitoria');
    expect((JSON.parse(await esperando) as Falha).classe).toBe('transitoria');
    expect(registro.marcas).toEqual([
      { frio: true, doHospedeiro: true },
      { frio: false, doHospedeiro: true },
    ]);
    soltar('tarde');
    await new Promise((r) => setTimeout(r, 5));
    expect(registro.marcas).toHaveLength(2);
  });
});

/* ── a sequência ── */

describe('uma janela por vez, com "parar" e freio', () => {
  it('mede na ordem, uma de cada vez, e publica o que já mediu', async () => {
    let dentro = 0;
    let maximo = 0;
    const publicadas: number[] = [];
    const r = await medirEmSequencia({
      janelas: ['a', 'b', 'c'],
      medir: async (j) => {
        dentro += 1;
        maximo = Math.max(maximo, dentro);
        await new Promise((ok) => setTimeout(ok, 2));
        dentro -= 1;
        return `linha ${j}`;
      },
      parar: () => false,
      aoMedir: (l) => publicadas.push(l.length),
    });
    expect(r).toEqual({ linhas: ['linha a', 'linha b', 'linha c'], parcial: false });
    expect(maximo).toBe(1);
    expect(publicadas).toEqual([1, 2, 3]);
  });

  it('parar no meio: a janela em voo termina e entra; a próxima não abre; o resultado é parcial', async () => {
    let parar = false;
    const abertas: string[] = [];
    const r = await medirEmSequencia({
      janelas: ['a', 'b', 'c', 'd'],
      medir: async (j) => {
        if (j === 'b') parar = true;
        await new Promise((ok) => setTimeout(ok, 2));
        return j;
      },
      parar: () => parar,
      aoAbrir: (j) => abertas.push(j),
    });
    expect(abertas).toEqual(['a', 'b']);
    expect(r).toEqual({ linhas: ['a', 'b'], parcial: true });
  });

  it('exceção no meio NÃO apaga o que já foi medido: vira parcial com o motivo', async () => {
    const r = await medirEmSequencia({
      janelas: ['a', 'b', 'c'],
      medir: async (j) => {
        if (j === 'b') throw new TypeError('quebrou no meio');
        return j;
      },
      parar: () => false,
    });
    expect(r.linhas).toEqual(['a']);
    expect(r.parcial).toBe(true);
    expect(r.motivo).toContain('TypeError: quebrou no meio');
  });

  it('o freio: três janelas seguidas do hospedeiro param a corrida, com o motivo', async () => {
    const doHospedeiro = { doHospedeiro: true as const };
    const freio = freioDoHospedeiro();
    expect(freio([doHospedeiro, doHospedeiro])).toBeNull();
    expect(freio([{}, doHospedeiro, doHospedeiro])).toBeNull();
    expect(freio([doHospedeiro, doHospedeiro, doHospedeiro])).toContain('não chegaram ao modelo');
    // A conta é de SEGUIDAS: uma medida no meio zera.
    expect(freio([doHospedeiro, doHospedeiro, {}])).toBeNull();

    const r = await medirEmSequencia({
      janelas: ['a', 'b', 'c', 'd', 'e'],
      medir: async () => doHospedeiro,
      parar: () => false,
      abortarSe: freioDoHospedeiro(),
    });
    expect(r.linhas).toHaveLength(3);
    expect(r.parcial).toBe(true);
    expect(r.motivo).toContain('3 janelas seguidas');
  });

  it('o freio não dispara na última janela — não há o que abortar', async () => {
    const r = await medirEmSequencia({
      janelas: ['a', 'b', 'c'],
      medir: async () => ({ doHospedeiro: true as const }),
      parar: () => false,
      abortarSe: freioDoHospedeiro(),
    });
    expect(r.parcial).toBe(false);
    expect(r.linhas).toHaveLength(3);
  });
});

/* ── o tempo e os números da tela ── */

describe('o tempo da corrida', () => {
  it('a previsão é a mediana das medidas não frias vezes o que falta', () => {
    const l = (ms: number, frio?: true): Pick<LinhaDoRelatorio, 'ms' | 'frio'> => ({ ms, ...(frio ? { frio } : {}) });
    expect(previsaoDaAmostra([l(9000, true), l(2000), l(4000), l(6000)], 10)).toEqual({ medianaMs: 4000, restanteMs: 40_000 });
    // Só a fria medida ainda dá previsão — melhor grosseira que nenhuma.
    expect(previsaoDaAmostra([l(9000, true)], 2)).toEqual({ medianaMs: 9000, restanteMs: 18_000 });
    expect(previsaoDaAmostra([], 5)).toEqual({ medianaMs: null, restanteMs: null });
  });

  it('a duração se lê de relance', () => {
    expect(duracaoCurta(48_000)).toBe('48s');
    expect(duracaoCurta(192_000)).toBe('3m12s');
    expect(duracaoCurta(3_720_000)).toBe('1h02m');
    expect(duracaoCurta(-5)).toBe('0s');
  });

  it('o relógio da medição não anda para trás', () => {
    const agora = relogioMonotonico();
    let anterior = agora().getTime();
    for (let i = 0; i < 2_000; i += 1) {
      const t = agora().getTime();
      expect(t).toBeGreaterThanOrEqual(anterior);
      anterior = t;
    }
  });
});

/* ── a amostra inteira, como a tela a roda ── */

describe('a corrida inteira: o prazo fica fora da medida e a fria fora da mediana', () => {
  it('com a ponte que copia o template e passa do prazo numa janela', async () => {
    const registro = novoRegistroDoAparelho();
    let travar = false;
    const ponte = ponteQueCopiaOTemplate({ trava: () => travar, atrasoMs: 70 });
    const motorPara = criarMotorPara(async () => ({ data: null, error: new Error('sem rede') }), 50, ponte, registro);
    const preparo = await prepararAmostra({
      hoje: HOJE,
      limite: 1,
      estado: () => acervo(),
      carregarNotasDesde: async () => undefined,
      motores: async () => UM_MOTOR,
    });
    expect(preparo.ok).toBe(true);
    if (!preparo.ok) return;
    const travada = preparo.janelas[1]!;

    const { linhas, parcial } = await medirEmSequencia({
      janelas: preparo.janelas,
      medir: (j) => {
        travar = j === travada;
        return medirJanela(j, preparo.dados, HOJE, APARELHO_SISTEMA, { motorPara, registro });
      },
      parar: () => false,
      abortarSe: freioDoHospedeiro(),
    });
    expect(parcial).toBe(false);
    expect(linhas[0]!.frio).toBe(true);
    expect(linhas[1]!.doHospedeiro).toBe(true);

    const m = medidasDoPortao(linhas);
    expect(m.foraDaMedida.doHospedeiro).toBe(1);
    expect(m.frias).toBe(1);
    expect(m.naMediana).toBe(m.medidas - 1);
    expect(m.aprovadas).toBeGreaterThan(0);
    expect(m.identicasAoTemplate).toBe(m.aprovadas);
  });

  it('o motor pedido é o que corre — a amostra não tem mais um motor cravado', async () => {
    // A asserção que morde se alguém puser um padrão de volta em `medirJanela`: o pedido
    // vai ao peso aberto, e é `responderComPesos` (com a pasta certa) que recebe.
    const registro = novoRegistroDoAparelho();
    const ponte = ponteQueCopiaOTemplate();
    const pesos: string[] = [];
    const motorPara = criarMotorPara(
      async () => ({ data: null, error: new Error('sem rede') }),
      1_000,
      {
        ...ponte,
        responderComPesos: (quais, pedido) => {
          pesos.push(quais);
          return ponte.responderComPesos(quais, pedido);
        },
      },
      registro,
    );
    const l = await medirJanela(JANELAS[0]!, DADOS, HOJE, QWEN, { motorPara, registro });
    expect(pesos).toEqual(['qwen3-1.7b']);
    expect(l.desfecho).toBe('ok');
  });
});

/* ── uma corrida por motor, em sequência (fatia 5) ── */

const QWEN = PESOS_ABERTOS[0]!.id;
const TUCANO = PESOS_ABERTOS[1]!.id;

/** Uma linha qualquer da janela `j` — o conteúdo não importa, o motor e a ordem sim. */
function linhaFalsa(j: JanelaClassificada, extra: Partial<LinhaDoRelatorio> = {}): LinhaDoRelatorio {
  return {
    range: j.range,
    offset: j.offset,
    alcance: j.alcance,
    caso: j.caso,
    hashDoPedido: 'a'.repeat(64),
    desfecho: 'ok',
    ms: 9_800,
    template: 'o template',
    frase: 'a frase do motor',
    ...extra,
  };
}

describe('uma corrida por motor', () => {
  const tres = JANELAS.slice(0, 3);
  const base = {
    janelas: tres,
    aindaDePe: async () => null,
    parar: () => false,
  };

  it('corre um motor de cada vez, e cada um mede a amostra inteira', async () => {
    const ordem: string[] = [];
    let dentro = 0;
    let juntos = 0;
    const corridas = await medirCorridas({
      ...base,
      fila: [{ motor: QWEN }, { motor: TUCANO }],
      medir: async (j, motor) => {
        dentro += 1;
        juntos = Math.max(juntos, dentro);
        ordem.push(`${motor}@${j.offset}`);
        await new Promise((r) => setTimeout(r, 1));
        dentro -= 1;
        return linhaFalsa(j);
      },
    });
    // Nunca dois motores ao mesmo tempo: eles disputam a memória e o Neural Engine.
    expect(juntos).toBe(1);
    expect(ordem.slice(0, 3).every((x) => x.startsWith(QWEN))).toBe(true);
    expect(ordem.slice(3).every((x) => x.startsWith(TUCANO))).toBe(true);
    expect(corridas.map((c) => [c.motor, c.linhas.length, c.parcial])).toEqual([
      [QWEN, 3, false],
      [TUCANO, 3, false],
    ]);
  });

  it('relê antes de CADA corrida: quem perdeu o compilado no meio não chama o modelo', async () => {
    // A guarda mais cara da tela: a primeira chamada de um peso aberto não compilado É a
    // compilação dele, 11 a 15 min. A fila foi decidida minutos antes.
    const consultados: string[] = [];
    const chamados: string[] = [];
    const corridas = await medirCorridas({
      ...base,
      fila: [{ motor: QWEN }, { motor: TUCANO }],
      aindaDePe: async (motor) => {
        consultados.push(motor);
        return motor === TUCANO ? 'o compilado deste modelo não está mais no aparelho' : null;
      },
      medir: async (j, motor) => {
        chamados.push(motor);
        return linhaFalsa(j);
      },
    });
    expect(consultados).toEqual([QWEN, TUCANO]);
    expect(chamados.every((m) => m === QWEN)).toBe(true);
    expect(corridas[1]).toMatchObject({ motor: TUCANO, linhas: [], recusa: 'o compilado deste modelo não está mais no aparelho' });
  });

  it('a recusa que já veio do preparo não gasta releitura nem chamada', async () => {
    let consultas = 0;
    const corridas = await medirCorridas({
      ...base,
      fila: [{ motor: QWEN, recusa: 'não compilado' }],
      aindaDePe: async () => {
        consultas += 1;
        return null;
      },
      medir: async (j) => linhaFalsa(j),
    });
    expect(consultas).toBe(0);
    expect(corridas).toEqual([expect.objectContaining({ motor: QWEN, recusa: 'não compilado', linhas: [] })]);
  });

  it('parar no meio: a corrida em voo fica parcial e a seguinte diz que nem chegou a começar', async () => {
    let parar = false;
    const corridas = await medirCorridas({
      ...base,
      fila: [{ motor: QWEN }, { motor: TUCANO }],
      parar: () => parar,
      medir: async (j) => {
        parar = true;
        return linhaFalsa(j);
      },
    });
    expect(corridas[0]).toMatchObject({ motor: QWEN, parcial: true });
    expect(corridas[0]!.linhas).toHaveLength(1);
    // O motor que não correu **não some** do resultado: some seria o dono comparando dois
    // números e achando que pediu três.
    expect(corridas[1]).toMatchObject({ motor: TUCANO, linhas: [], recusa: PARADO_ANTES_DA_VEZ });
  });

  it('o freio é POR motor: a corrida travada para, e a seguinte ainda tenta', async () => {
    const corridas = await medirCorridas({
      ...base,
      janelas: JANELAS.slice(0, 5),
      fila: [{ motor: QWEN }, { motor: TUCANO }],
      medir: async (j, motor) =>
        motor === QWEN
          ? linhaFalsa(j, { desfecho: 'transitoria', doHospedeiro: true, frase: undefined })
          : linhaFalsa(j),
    });
    expect(corridas[0]).toMatchObject({ motor: QWEN, parcial: true });
    expect(corridas[0]!.linhas).toHaveLength(3);
    expect(corridas[0]!.motivo).toContain('3 janelas seguidas');
    expect(corridas[1]).toMatchObject({ motor: TUCANO, parcial: false });
    expect(corridas[1]!.linhas).toHaveLength(5);
  });

  it('publica corrida a corrida — a segunda leva minutos, e a primeira não espera por ela', async () => {
    const publicadas: string[] = [];
    const abertas: string[] = [];
    await medirCorridas({
      ...base,
      fila: [{ motor: QWEN }, { motor: TUCANO }],
      medir: async (j) => linhaFalsa(j),
      aoAbrirCorrida: (motor) => abertas.push(motor),
      aoFechar: (c) => publicadas.push(c.motor),
    });
    expect(abertas).toEqual([QWEN, TUCANO]);
    expect(publicadas).toEqual([QWEN, TUCANO]);
  });
});
