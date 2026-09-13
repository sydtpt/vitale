/**
 * A janela de notas do sono (story 5.5) — a linha "janela maior que 90 dias" da
 * matriz.
 *
 * **O defeito que este arquivo existe para impedir.** A store carrega os períodos
 * inteiros mas só **90 dias** de nota (`SONO_WINDOW_DAYS`), porque é a janela de
 * análise que todo o resto usa. A `/sono/saude`, porém, conta janelas de `12m` e de
 * `ano`. Contar a percepção de um ano com as notas de três meses não dá erro
 * nenhum: dá um número menor, com aparência de número certo — 89 notas onde há 365
 * noites. E o mapa de notas é parcial de propósito, então quem o lê não tem como
 * distinguir "não há nota nesse dia" de "não carreguei esse dia". Daí
 * `ratingsSince`.
 *
 * Os fakes são injetados: nenhuma rede, nenhum cliente Supabase de verdade, e as
 * noites e notas são sintéticas — nenhum dado de saúde real entra em arquivo
 * versionado.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Os três módulos de I/O que a store puxa. As fábricas são içadas pelo babel, por
// isso o estado controlável mora dentro delas e sai pelo próprio módulo.
jest.mock('../../lib/supabase', () => ({ supabase: {} }));

jest.mock('../auth.store', () => {
  const estado: { user: { id: string } | null } = { user: { id: 'u1' } };
  return { useAuthStore: { getState: () => ({ user: estado.user }), __estado: estado } };
});

jest.mock('@vitale/shared', () => {
  const real = jest.requireActual('@vitale/shared') as Record<string, unknown>;
  const estado = {
    /** Os `since` que a store pediu, na ordem. */
    pedidos: [] as string[],
    /** A próxima busca de notas falha. */
    falhar: false,
    /** O acervo de notas do "banco", por dia. */
    notas: {} as Record<string, number>,
    /** Atraso da busca do `load()`, para ele resolver DEPOIS da extensão. */
    lentidaoDoLoad: 0,
  };
  const notasDesde = (since: string) =>
    Object.entries(estado.notas)
      .filter(([dia]) => dia >= since)
      .map(([day, sleepQuality]) => ({ day, sleepQuality, dayQuality: null }));
  return {
    ...real,
    __fake: estado,
    fetchSleepPeriodsSince: async () => [],
    fetchDailyRatingsSince: async (_db: unknown, _u: string, since: string) => {
      estado.pedidos.push(`load:${since}`);
      if (estado.lentidaoDoLoad > 0) {
        await new Promise((r) => setTimeout(r, estado.lentidaoDoLoad));
      }
      return notasDesde(since);
    },
    fetchDailyRatingScores: async (_db: unknown, _u: string, since: string) => {
      estado.pedidos.push(since);
      if (estado.falhar) throw new Error('PostgREST caiu');
      return notasDesde(since);
    },
  };
});

import * as shared from '@vitale/shared';
import { entradaDaSaude, type SleepPeriod } from '@vitale/shared';
import { useAuthStore } from '../auth.store';
import { SONO_WINDOW_DAYS, useSonoStore } from '../sono.store';

const fake = (shared as unknown as {
  __fake: {
    pedidos: string[];
    falhar: boolean;
    notas: Record<string, number>;
    lentidaoDoLoad: number;
  };
}).__fake;

const auth = (useAuthStore as unknown as { __estado: { user: { id: string } | null } }).__estado;

/* ── o acervo sintético ── */

const BXL = 120;

function mais(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function noite(wakeDay: string, onsetH = 23.5, durH = 7.5): SleepPeriod {
  const ancora = new Date(`${wakeDay}T00:00:00Z`);
  if (onsetH >= 12) ancora.setUTCDate(ancora.getUTCDate() - 1);
  const onsetMs = ancora.getTime() + onsetH * 3_600_000 - BXL * 60_000;
  return {
    userId: 'u1',
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

/**
 * O "hoje" das asserções **puras** (as que passam `hoje` a `entradaDaSaude`).
 * Nada que dependa do relógio o usa.
 */
const HOJE = '2026-09-10';

/**
 * O dia de hoje de verdade. A store lê o relógio para calcular os 90 dias, então
 * as notas "recentes" dos testes têm de ser recentes **agora** — fixá-las contra
 * `HOJE` faria a suíte apodrecer sozinha em três meses.
 */
const HOJE_REAL = shared.localDateStr();
/** Um dia bem antes dos 90: é o que uma janela de `12m` pede. */
const INICIO_DOS_12M = mais(HOJE_REAL, -400);

/** Até onde a store diz ter carregado as notas. */
const cobertura = (): string | null => useSonoStore.getState().ratingsSince;

function limpar(): void {
  fake.pedidos = [];
  fake.falhar = false;
  fake.notas = {};
  fake.lentidaoDoLoad = 0;
  useSonoStore.setState({
    periods: [],
    sleepRatings: {},
    ratingsSince: null,
    loading: false,
    loaded: false,
    error: undefined,
    notasError: undefined,
  });
  auth.user = { id: 'u1' };
}

describe('a janela de notas do sono', () => {
  beforeEach(limpar);

  it('load() registra até onde as notas foram carregadas', async () => {
    fake.notas = { [mais(HOJE_REAL, -1)]: 4 };
    await useSonoStore.getState().load();

    const { ratingsSince, sleepRatings } = useSonoStore.getState();
    // O `since` declarado é exatamente o que a store pediu ao banco — sem isto,
    // quem lê o mapa não sabe o que é ausência e o que é lacuna.
    expect(fake.pedidos).toEqual([`load:${ratingsSince}`]);
    expect(ratingsSince).not.toBeNull();
    // E é a janela de 90 dias, não o acervo inteiro.
    expect(ratingsSince).toBe(mais(HOJE_REAL, -(SONO_WINDOW_DAYS - 1)));
    expect(sleepRatings).toEqual({ [mais(HOJE_REAL, -1)]: 4 });
  });

  it('12m: as notas da janela inteira são carregadas, e as dos 90 dias não se perdem', async () => {
    fake.notas = { [INICIO_DOS_12M]: 2, [mais(INICIO_DOS_12M, 120)]: 3, [mais(HOJE_REAL, -2)]: 5 };
    await useSonoStore.getState().load();
    // Depois do load só há a nota recente: as duas antigas estão fora dos 90 dias.
    expect(Object.keys(useSonoStore.getState().sleepRatings)).toEqual([mais(HOJE_REAL, -2)]);

    await useSonoStore.getState().carregarNotasDesde(INICIO_DOS_12M);

    expect(fake.pedidos).toContain(INICIO_DOS_12M);
    expect(useSonoStore.getState().sleepRatings).toEqual({
      [INICIO_DOS_12M]: 2,
      [mais(INICIO_DOS_12M, 120)]: 3,
      [mais(HOJE_REAL, -2)]: 5,
    });
    expect(cobertura()).toBe(INICIO_DOS_12M);
  });

  it('load() que resolve DEPOIS da extensão não joga fora as notas estendidas', async () => {
    // Os dois efeitos disparam no mesmo commit da tela, e o `load()` é o mais lento
    // (ele também traz o histórico inteiro de períodos). Substituir o mapa aqui
    // apagava as notas de 400 dias que a extensão já trouxe — e a tela **não se
    // recuperava**: o `desde` da janela sai de `rangeBounds`, que não depende de
    // `periods`, então o efeito não roda de novo e `12m` fica contando 90 dias.
    fake.notas = { [INICIO_DOS_12M]: 2, [mais(HOJE_REAL, -2)]: 5 };
    fake.lentidaoDoLoad = 10;

    const emVoo = useSonoStore.getState().load();
    await useSonoStore.getState().carregarNotasDesde(INICIO_DOS_12M);
    // Antes de o load resolver, a extensão já está em memória.
    expect(useSonoStore.getState().sleepRatings[INICIO_DOS_12M]).toBe(2);
    await emVoo;

    // E sobrevive a ele: a nota antiga e a janela maior continuam lá.
    expect(useSonoStore.getState().sleepRatings[INICIO_DOS_12M]).toBe(2);
    expect(useSonoStore.getState().sleepRatings[mais(HOJE_REAL, -2)]).toBe(5);
    expect(cobertura()).toBe(INICIO_DOS_12M);
    expect(useSonoStore.getState().loaded).toBe(true);
  });

  it('dia já coberto é no-op: nenhuma busca nova sai', async () => {
    await useSonoStore.getState().load();
    const depoisDoLoad = [...fake.pedidos];

    const dentro = cobertura()!;
    await useSonoStore.getState().carregarNotasDesde(dentro);
    await useSonoStore.getState().carregarNotasDesde(mais(dentro, 5));

    // A tela chama isto a cada troca de janela: cobrar uma consulta por troca
    // seria uma consulta por toque no ◀.
    expect(fake.pedidos).toEqual(depoisDoLoad);
  });

  it('a janela só cresce: um pedido mais recente não encolhe o que já está coberto', async () => {
    await useSonoStore.getState().load();
    const dosNoventa = cobertura()!;
    await useSonoStore.getState().carregarNotasDesde(INICIO_DOS_12M);
    expect(cobertura()).toBe(INICIO_DOS_12M);

    // Voltar para `7d` depois de visitar `12m` não pode fazer a cobertura mentir
    // para baixo — as notas antigas continuam em memória.
    await useSonoStore.getState().carregarNotasDesde(dosNoventa);
    expect(cobertura()).toBe(INICIO_DOS_12M);
  });

  it('busca que falha não derruba a contagem: não lança, e o que havia fica', async () => {
    fake.notas = { [INICIO_DOS_12M]: 2, [mais(HOJE_REAL, -2)]: 5 };
    await useSonoStore.getState().load();
    const antes = cobertura();
    fake.falhar = true;

    await expect(useSonoStore.getState().carregarNotasDesde(INICIO_DOS_12M)).resolves.toBeUndefined();

    // "conta com o que há": as notas dos 90 dias seguem em memória…
    expect(useSonoStore.getState().sleepRatings).toEqual({ [mais(HOJE_REAL, -2)]: 5 });
    // …e a janela declarada NÃO cresce, senão o mapa parcial passaria por completo.
    expect(cobertura()).toBe(antes);
    // E a falha fica registrada: sem isto, "a consulta quebrou" e "você não deu
    // nota" seriam a mesma tela.
    expect(useSonoStore.getState().notasError).toBeDefined();
  });

  it('a busca que dá certo limpa o registro da falha anterior', async () => {
    await useSonoStore.getState().load();
    fake.falhar = true;
    await useSonoStore.getState().carregarNotasDesde(INICIO_DOS_12M);
    expect(useSonoStore.getState().notasError).toBeDefined();

    fake.falhar = false;
    await useSonoStore.getState().carregarNotasDesde(INICIO_DOS_12M);
    expect(useSonoStore.getState().notasError).toBeUndefined();
  });

  it('sem sessão, nada é buscado', async () => {
    auth.user = null;
    await useSonoStore.getState().carregarNotasDesde(INICIO_DOS_12M);
    expect(fake.pedidos).toEqual([]);
    expect(cobertura()).toBeNull();
  });

  it('contar antes de carregar reporta menos percepção do que contar depois', () => {
    // Esta é a consequência que a linha da matriz existe para evitar, medida na
    // função de verdade do núcleo. Um ano de noites, com nota em todas elas.
    const noites = Array.from({ length: 200 }, (_, i) => noite(mais(HOJE, -i)));
    const todas: Record<string, number> = {};
    for (const p of noites) todas[p.wakeDay] = 4;
    // O recorte que a store teria em memória: os 90 dias mais recentes da janela.
    const soOs90 = Object.fromEntries(
      Object.entries(todas).filter(([dia]) => dia >= mais(HOJE, -(SONO_WINDOW_DAYS - 1))),
    );

    const opcoes = { range: '12m' as const, offset: 0, hoje: HOJE };
    const parcial = entradaDaSaude(noites, soOs90, opcoes);
    const completa = entradaDaSaude(noites, todas, opcoes);

    const percepcao = (e: typeof parcial) => e.score.dimensions.find((d) => d.key === 'percepcao')!;
    // O fato traz o `n` de notas: é onde a diferença aparece na tela.
    expect(percepcao(parcial).fact).not.toBe(percepcao(completa).fact);
    expect(percepcao(parcial).fact).toContain(`${Object.keys(soOs90).length} notas`);
    expect(percepcao(completa).fact).toContain(`${Object.keys(todas).length} notas`);

    // E a cobertura de NOITES é a mesma nas duas: ela não depende de nota nenhuma.
    // Ver o relatório desta story — é o único ponto em que a matriz e o código não
    // falam da mesma grandeza.
    expect(parcial.score.coverage).toEqual(completa.score.coverage);
  });

  it('sem nota nenhuma na janela, a percepção fica ausente e a contagem encolhe', () => {
    const noites = Array.from({ length: 200 }, (_, i) => noite(mais(HOJE, -i)));
    const todas: Record<string, number> = {};
    for (const p of noites) todas[p.wakeDay] = 4;

    const opcoes = { range: '12m' as const, offset: 0, hoje: HOJE };
    const semNota = entradaDaSaude(noites, {}, opcoes);
    const comNota = entradaDaSaude(noites, todas, opcoes);

    const percepcao = semNota.score.dimensions.find((d) => d.key === 'percepcao')!;
    expect(percepcao.points).toBeNull();
    expect(percepcao.absent).toBeDefined();
    // O denominador encolhe — é a dimensão que sai da conta, não um zero.
    expect(semNota.score.max).toBeLessThan(comNota.score.max);
  });
});
