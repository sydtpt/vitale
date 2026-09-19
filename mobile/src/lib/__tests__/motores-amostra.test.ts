/**
 * A amostra no iPhone (story 5.13) — o portão das notas, a sequência com "parar", a
 * contagem do transporte do aparelho e a composição que a tela de desenvolvimento faz.
 *
 * A régua (a amostra, a linha, as medidas) é do núcleo e tem teste lá
 * (`packages/shared/src/bancada/`). O que se prova aqui é o que o app acrescenta: que a
 * medição não começa com a percepção faltando, que "parar" não abre a próxima janela, e
 * que o prazo do aparelho e a primeira chamada chegam às medidas como no Mac — fora da
 * medida e fora da mediana.
 *
 * Nenhum teste abre rede nem chama o módulo nativo: a ponte é falsa.
 */
import { describe, it, expect, jest } from '@jest/globals';

// O ponto de injeção constrói o client do Supabase no import; aqui ninguém o usa.
jest.mock('../supabase', () => ({ supabase: {} }));

import {
  APARELHO_SISTEMA,
  SEM_MODELO,
  amostraDaNuvem,
  descritorDaSaudeDoSono,
  entradaDaSaude,
  enumerarJanelas,
  hashDaMedicao,
  ler,
  linhaDaMedicao,
  marcasDoHospedeiro,
  medidasDoPortao,
  templateDaMedicao,
  templateDaSaude,
  type Falha,
  type JanelaClassificada,
  type LinhaDoRelatorio,
  type MotorId,
  type SleepPeriod,
} from '@vitale/shared';
import {
  criarMotorPara,
  criarTransporteDoAparelho,
  novoRegistroDoAparelho,
  type PonteDoAparelho,
  type RegistroDoAparelho,
} from '../motores';
import { foraEmTexto, medirEmSequencia, porcento, prontidaoDasNotas, segundos } from '../motores/amostra';

/* ── o portão das notas ── */

describe('as notas inteiras antes de enumerar', () => {
  it('pronta só quando cobrem desde a noite mais antiga, sem erro', () => {
    expect(prontidaoDasNotas({ ratingsSince: '2025-05-01' }, '2025-05-10')).toEqual({ pronta: true });
    expect(prontidaoDasNotas({ ratingsSince: '2025-05-10' }, '2025-05-10')).toEqual({ pronta: true });
  });

  it('as notas de 90 dias que a store traz sozinha não bastam — e o motivo diz até onde chegaram', () => {
    const r = prontidaoDasNotas({ ratingsSince: '2026-06-22' }, '2025-05-10');
    expect(r.pronta).toBe(false);
    expect(r.pronta ? '' : r.motivo).toContain('2026-06-22');
    expect(r.pronta ? '' : r.motivo).toContain('2025-05-10');
  });

  it('antes de carregar, ou com a carga quebrada, não mede — nunca com a percepção faltando', () => {
    expect(prontidaoDasNotas({ ratingsSince: null }, '2025-05-10').pronta).toBe(false);
    const quebrou = prontidaoDasNotas({ ratingsSince: '2025-01-01', notasError: 'JWT expired' }, '2025-05-10');
    expect(quebrou.pronta).toBe(false);
    expect(quebrou.pronta ? '' : quebrou.motivo).toContain('JWT expired');
  });
});

/* ── a sequência ── */

describe('uma janela por vez, e "parar" não abre a próxima', () => {
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
        if (j === 'b') parar = true; // o toque chega com "b" no aparelho
        await new Promise((ok) => setTimeout(ok, 2));
        return j;
      },
      parar: () => parar,
      aoAbrir: (j) => abertas.push(j),
    });
    expect(abertas).toEqual(['a', 'b']);
    expect(r).toEqual({ linhas: ['a', 'b'], parcial: true });
  });

  it('parar depois da última não é parcial: não sobrou janela', async () => {
    let parar = false;
    const r = await medirEmSequencia({
      janelas: ['a'],
      medir: async (j) => {
        parar = true;
        return j;
      },
      parar: () => parar,
    });
    expect(r).toEqual({ linhas: ['a'], parcial: false });
  });
});

/* ── os números como a tela os escreve ── */

describe('os números', () => {
  it('com vírgula, como o relatório do Mac', () => {
    expect(porcento(19, 22)).toBe('86,4%');
    expect(porcento(0, 0)).toBe('—');
    expect(segundos(13_600)).toBe('13,6 s');
    expect(segundos(null)).toBe('—');
    expect(foraEmTexto({ semChamada: 0, sintetica: 0, defeito: 1, indisponivel: 0, doHospedeiro: 2 })).toBe(
      '1 defeitos · 2 do hospedeiro',
    );
    expect(foraEmTexto({ semChamada: 0, sintetica: 0, defeito: 0, indisponivel: 0, doHospedeiro: 0 })).toBe('nenhuma');
  });
});

/* ── a contagem do transporte do aparelho ── */

describe('o registro do transporte do aparelho: fria e fabricada pelo hospedeiro', () => {
  it('a primeira chamada que chega ao aparelho é fria; as seguintes, não; a resposta boa não é do hospedeiro', async () => {
    const registro = novoRegistroDoAparelho();
    const transporte = criarTransporteDoAparelho(async (p) => `linha ${p}`, 1_000, { registro });
    await transporte('a');
    expect(registro).toEqual({ frias: 1, doHospedeiro: 0 });
    await transporte('b');
    expect(registro).toEqual({ frias: 1, doHospedeiro: 0 });
  });

  it('o prazo estourado é do hospedeiro — no aparelho e esperando a vez; quem não chegou ao aparelho não é fria', async () => {
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
    expect(registro).toEqual({ frias: 1, doHospedeiro: 2 });
    // O aparelho termina o lento tarde: a resposta atrasada não conta de novo.
    soltar('tarde');
    await new Promise((r) => setTimeout(r, 5));
    expect(registro).toEqual({ frias: 1, doHospedeiro: 2 });
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
    expect(registro).toEqual({ frias: 1, doHospedeiro: 1 });
  });
});

/* ── a composição da tela, com a régua do núcleo ── */

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
const NOITES: SleepPeriod[] = [];
const NOTAS: Record<string, number> = {};
for (let i = 0; i < 60; i += 1) {
  const dia = mais('2026-07-13', i);
  if (i % 9 === 4) continue;
  NOITES.push(noite(dia, 22.6 + (i % 5) * 0.45, 5.6 + (i % 4) * 0.7));
  if (i % 3 !== 0) NOTAS[dia] = 1 + (i % 5);
}

/**
 * A janela como a tela a mede (`medirJanelaNoAparelho`, em `bancada.tsx`): a régua pelo
 * piso, o aparelho em `medicao`, a linha pela tradução do núcleo e as marcas pela contagem
 * do transporte. Repetida aqui porque a tela não é importável no jest; o que o teste prova
 * é que as peças, compostas assim, dão às medidas o que o Mac daria.
 */
async function comoATela(
  j: JanelaClassificada,
  motorPara: (id: MotorId) => ReturnType<ReturnType<typeof criarMotorPara>>,
  registro: RegistroDoAparelho,
): Promise<LinhaDoRelatorio> {
  const antes = { ...registro };
  const e = entradaDaSaude(NOITES, NOTAS, { range: j.range, offset: j.offset, hoje: HOJE });
  const agora = () => new Date();
  const regua = await ler(descritorDaSaudeDoSono, e, { modo: 'medicao', motor: SEM_MODELO, motorPara, registrar: () => undefined, agora });
  const m = await ler(descritorDaSaudeDoSono, e, { modo: 'medicao', motor: APARELHO_SISTEMA, motorPara, registrar: () => undefined, agora });
  return { ...linhaDaMedicao(j, hashDaMedicao(m), templateDaMedicao(regua), m, null), ...marcasDoHospedeiro(registro, antes) };
}

describe('a composição da tela: o prazo fica fora da medida, e a fria fora da mediana', () => {
  // O aparelho responde **tarde** numa janela: passa do prazo (a linha é do hospedeiro) e
  // termina depois, soltando a vez para a seguinte. Uma chamada que nunca voltasse
  // prenderia a vez até o teto (três prazos), e as janelas que esperassem atrás dela
  // estourariam o prazo na fila — também do hospedeiro, também fora da medida: nenhuma
  // chegou ao modelo.
  it('com a ponte que copia o template e passa do prazo numa janela', async () => {
    const janelas = amostraDaNuvem(enumerarJanelas(NOITES, NOTAS, HOJE), 1);
    expect(janelas.length).toBeGreaterThan(2);
    const travada = janelas[1]!;
    const templatePorPedido = new Map<string, string>();
    for (const j of janelas) {
      const e = entradaDaSaude(NOITES, NOTAS, { range: j.range, offset: j.offset, hoje: HOJE });
      templatePorPedido.set(descritorDaSaudeDoSono.montarPedido(e)?.usuario ?? '', templateDaSaude(e));
    }
    let atual: JanelaClassificada | null = null;
    const ponte: PonteDoAparelho = {
      diagnostico: async () => '{"disponivel":true}',
      responder: (pedido) => {
        const usuario = (JSON.parse(pedido) as { usuario: string }).usuario;
        const linha = JSON.stringify({
          texto: templatePorPedido.get(usuario) ?? 'x',
          provedor: 'prov-a',
          modelo: 'AFM 3 Core Advanced',
          plataforma: 'iOS 27.0',
          buildDoSistema: '27A1',
        });
        // Tarde: depois do prazo de 50 ms, antes do prazo da janela seguinte na fila.
        if (atual === travada) return new Promise<string>((r) => setTimeout(() => r(linha), 70));
        return Promise.resolve(linha);
      },
    };
    const registro = novoRegistroDoAparelho();
    const motorPara = criarMotorPara(async () => ({ data: null, error: new Error('sem rede') }), 50, ponte, registro);

    const linhas: LinhaDoRelatorio[] = [];
    for (const j of janelas) {
      atual = j;
      linhas.push(await comoATela(j, motorPara, registro));
    }

    const primeira = linhas[0]!;
    expect(primeira.frio).toBe(true);
    const presa = linhas[1]!;
    expect(presa.desfecho).toBe('transitoria');
    expect(presa.doHospedeiro).toBe(true);
    expect(presa.hashDoPedido).toMatch(/^[0-9a-f]{64}$/);

    const m = medidasDoPortao(linhas);
    expect(m.foraDaMedida.doHospedeiro).toBe(1);
    expect(m.medidas).toBe(linhas.filter((l) => l.desfecho !== 'mudo').length - 1);
    expect(m.frias).toBe(1);
    expect(m.naMediana).toBe(m.medidas - 1);
    expect(m.aprovadas).toBe(linhas.filter((l) => l.desfecho === 'ok').length);
    expect(m.aprovadas).toBeGreaterThan(0);
  });
});
