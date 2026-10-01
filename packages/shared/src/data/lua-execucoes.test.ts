/**
 * Testes da porta de `lua_execucoes` (story 4.2b). Rodar com:
 *   cd packages/shared && npx tsx src/data/lua-execucoes.test.ts
 *
 * **Nenhum dado lunar real entra aqui, e isso não é zelo:** os quatro documentos
 * proíbem olhar mediana por fase ou contagem por coluna antes da execução
 * autorizada. Os acervos são sintéticos e determinísticos, e o que se confere é a
 * **forma** — quantas linhas, com que identificador, com que nulos, com que unidade.
 *
 * O falso do banco guarda uma tabela em memória e **espelha o `constraint trigger`**
 * da migração: quatro linhas por `(user_id, execucao_id)`, uma por fase, ou nenhuma,
 * cobradas no `insert` **e** no `delete`, que são os dois verbos que a tabela
 * conhece. Ele não é o Postgres, e o que os casos daqui provam é que a porta não
 * depende do banco para a forma certa; a prova do gatilho é o cenário
 * `supabase/ensaio/cenarios/lua-execucoes.sql`, que roda na janela do dono.
 *
 * A comparação das listas com os CHECKs da migração **não mora aqui**: é barreira, e
 * vive em `architecture.test.ts` junto com `idsAceitosPeloCheck`, que lê todas as
 * migrations e as duas formas de CHECK.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { COORDENADA_DA_LUZ } from '../astro/casa';
import { PHASE_ORDER } from '../astro/moon';
import { daylightHours } from '../astro/sun';
import {
  CADEIA_DO_PRE_REGISTRO,
  CADEIA_MINIMA,
  DIGEST_DA_CADEIA,
  INICIO_DO_ACERVO_LUNAR,
  JANELA_LUNAR_VERSAO,
  MOTOR_LUNAR_VERSAO,
  operacionalizacaoLunar,
} from '../sleep/lua-carimbo';
import {
  PROTOCOLO_LUNAR,
  UNIDADE_DO_MOTIVO,
  vereditoLunar,
  type MotivoDoInconclusivo,
  type NoiteLunarMedida,
  type QuatroResultados,
  type VereditoLunarCompleto,
} from '../sleep/lua-protocolo';
import type { SleepPeriod } from '../models';
import {
  ExecucaoLunarGravadaSemLeitura,
  ExecucaoLunarRecusada,
  FASES_POR_EXECUCAO,
  LUA_EXECUCAO_COLUMNS,
  VEREDITOS_LUNARES,
  VOCABULARIO_DE_LUA_EXECUCOES,
  contarExecucoesLunares,
  fetchNoitesLunares,
  fetchUltimaExecucaoLunar,
  gravarExecucaoLunar,
  noitesColapsadasEm,
  noitesLunaresDe,
  toLuaExecucao,
  type LuaExecucaoRow,
  type PedidoDaExecucao,
} from './lua-execucoes';

const DIA_MS = 86_400_000;

/**
 * O pedido que acompanha toda escrita destes casos.
 *
 * `desde` é o do protocolo, e os acervos sintéticos começam **no mesmo dia** de
 * propósito: o CHECK `acervo_comeca_depois_do_pedido` exige que a primeira noite não
 * seja anterior ao que foi pedido, e uma fixture que o violasse passaria aqui (o
 * falso não tem CHECK) para morrer na janela do dono.
 */
const PEDIDO: Readonly<PedidoDaExecucao> = Object.freeze({
  desde: INICIO_DO_ACERVO_LUNAR,
  noitesColapsadas: 0,
});

/* ─────────────────────────── Os acervos sintéticos ─────────────────────────── */

/**
 * `quantas` noites a partir de `de`, com o `apagou` num padrão determinístico e a
 * luz do dia de verdade.
 *
 * A dispersão é regulável porque **ela é o que decide o motivo**: passos de 5 min em
 * 11 posições (~16 min de SD) passam o portão do poder com 400 noites; passos de 30
 * em 21 posições (~182 min de SD) o reprovam com as mesmas 400. Os dois lados
 * precisam existir — só o `luz` era exercitado ponta a ponta, e o `poder` é o
 * veredito que a própria aritmética do motor chama de provável.
 */
function acervo(
  de: string,
  quantas: number,
  opts: { semLuzNa?: number; passoMin?: number; posicoes?: number } = {},
): NoiteLunarMedida[] {
  const passo = opts.passoMin ?? 5;
  const posicoes = opts.posicoes ?? 11;
  const out: NoiteLunarMedida[] = [];
  let t = Date.parse(`${de}T00:00:00Z`);
  for (let i = 0; i < quantas; i += 1) {
    const wakeDay = new Date(t).toISOString().slice(0, 10);
    // Apagou na véspera, antes da meia-noite — longe da origem do eixo (18h) e sem
    // ninguém dar a volta no círculo.
    const onsetAt = new Date(t - 50 * 60_000 - (i % posicoes) * passo * 60_000).toISOString();
    out.push({
      wakeDay,
      onsetAt,
      tzOffset: 120,
      luzH: opts.semLuzNa === i ? null : daylightHours(wakeDay, COORDENADA_DA_LUZ),
    });
    t += DIA_MS;
  }
  return out;
}

/* ── Os cinco acervos, um por desfecho que a tabela precisa saber gravar ────── */

/** Portões abertos, poder de sobra: o caso em que a medida existe. */
const COM_PODER: VereditoLunarCompleto = vereditoLunar(acervo(INICIO_DO_ACERVO_LUNAR, 400));
/** Uma noite sem a covariável: o portão da luz fecha para as **quatro**. */
const SEM_LUZ: VereditoLunarCompleto =
  vereditoLunar(acervo(INICIO_DO_ACERVO_LUNAR, 400, { semLuzNa: 7 }));
/**
 * **Os três portões abertos e o poder reprovando** — `motivo = 'poder'`.
 *
 * É o único motivo em que efeito, p, z e poder **existem** num inconclusivo: o
 * portão do poder vem *depois* de medir, e por isso a linha dele não é nula como as
 * dos três portões. Sem este caso, `motivo` nunca via o valor `'poder'` em nenhuma
 * ponta — e trocar `MOTIVOS_DO_INCONCLUSIVO` por `PORTOES_LUNARES` no tradutor ficava
 * verde, para quebrar a página no desfecho que o motor chama de provável.
 */
const SEM_PODER: VereditoLunarCompleto =
  vereditoLunar(acervo(INICIO_DO_ACERVO_LUNAR, 400, { passoMin: 30, posicoes: 21 }));
/**
 * Doze noites: **dois motivos na mesma execução**, `ciclos` e `amostra`.
 *
 * As quatro fases não caem pelo mesmo motivo, e é exatamente isso que se quer: as
 * colunas `motivo`, `portao_reprovado` e `falta_unidade` variam **dentro** de uma
 * execução, e um caso em que as quatro concordam não prova que a linha carrega o
 * motivo dela em vez do motivo da execução.
 */
const CURTO: VereditoLunarCompleto = vereditoLunar(acervo(INICIO_DO_ACERVO_LUNAR, 12));
/** Acervo vazio: `de`, `ate` e `sdMin` nulos, e as contagens em zero. */
const VAZIO: VereditoLunarCompleto = vereditoLunar([]);

/* ─────────────────────────── O falso do banco ─────────────────────────── */

/** Projeta pelo que foi pedido, como o PostgREST — ver a nota em `edicoes-ia.test.ts`. */
function projetar(linha: LuaExecucaoRow, cols: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of cols.split(',').map((x) => x.trim())) {
    if (!(c in linha)) throw new Error(`coluna pedida que a tabela não tem: ${c}`);
    out[c] = (linha as unknown as Record<string, unknown>)[c];
  }
  return out;
}

function comparar(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

interface Consulta {
  tabela: string;
  colunas: string;
  filtros: Record<string, unknown>;
  ordens: { coluna: string; asc: boolean }[];
  limite: number | null;
  head: boolean;
}

function fakeBanco(opts: {
  erroNaLeitura?: Error; erroNaEscrita?: Error; escritaCega?: boolean;
} = {}) {
  const tabela: LuaExecucaoRow[] = [];
  const capturado = {
    consultas: [] as Consulta[], escritas: 0, cargas: [] as Record<string, unknown>[][],
    apagados: 0,
  };
  // O relógio da transação: um instante novo por `insert`, como `now()` faz.
  let transacao = 0;

  /**
   * O `constraint trigger`, espelhado: quatro por execução, uma por fase, ou nenhuma.
   *
   * **A chave é `(user_id, execucao_id)`, como no gatilho** — `lua_execucao_conferir`
   * recebe os dois e filtra pelos dois. Contar só pelo `execucao_id` é uma cobrança
   * mais frouxa que a do banco em teoria (dois donos com o mesmo id somariam oito) e
   * mais **apertada** em produção, onde o id sai de um `md5` que já tem o dono
   * dentro: o falso acusaria uma execução que o Postgres aceita. Um espelho que
   * diverge do original não é espelho.
   */
  function conferirNoCommit(chaves: readonly { user_id: string; execucao_id: string }[]): string | null {
    for (const k of chaves) {
      const daExecucao = tabela.filter(
        (r) => r.execucao_id === k.execucao_id && r.user_id === k.user_id,
      );
      if (daExecucao.length === 0) continue;
      const fases = new Set(daExecucao.map((r) => r.fase));
      if (daExecucao.length !== 4 || fases.size !== 4) {
        return `a execução ${k.execucao_id} ficou com ${daExecucao.length} linha(s) e `
          + `${fases.size} fase(s) distintas`;
      }
    }
    return null;
  }

  /** As chaves tocadas por um conjunto de linhas, sem repetição. */
  function chavesDe(linhas: readonly LuaExecucaoRow[]): { user_id: string; execucao_id: string }[] {
    const vistas = new Map<string, { user_id: string; execucao_id: string }>();
    for (const r of linhas) vistas.set(`${r.user_id}|${r.execucao_id}`, { user_id: r.user_id, execucao_id: r.execucao_id });
    return [...vistas.values()];
  }

  function construir(consulta: Consulta) {
    const alvo = {
      eq(coluna: string, valor: unknown) {
        consulta.filtros[coluna] = valor;
        return alvo;
      },
      order(coluna: string, o?: { ascending?: boolean }) {
        consulta.ordens.push({ coluna, asc: o?.ascending !== false });
        return alvo;
      },
      limit(n: number) {
        consulta.limite = n;
        return alvo;
      },
      then(resolve: (r: { data: unknown; error: unknown; count?: number | null }) => unknown) {
        if (opts.erroNaLeitura) return resolve({ data: null, error: opts.erroNaLeitura, count: null });
        let rs = tabela.filter((r) =>
          Object.entries(consulta.filtros).every(
            ([c, v]) => (r as unknown as Record<string, unknown>)[c] === v,
          ));
        // `sort` é estável, então aplicar as chaves de trás para frente dá a
        // ordenação composta — a mesma que o `order by` do Postgres.
        for (const o of [...consulta.ordens].reverse()) {
          rs = [...rs].sort((a, b) => comparar(
            (a as unknown as Record<string, unknown>)[o.coluna],
            (b as unknown as Record<string, unknown>)[o.coluna],
          ) * (o.asc ? 1 : -1));
        }
        const total = rs.length;
        if (consulta.limite !== null) rs = rs.slice(0, consulta.limite);
        return resolve({
          data: consulta.head ? null : rs.map((r) => projetar(r, consulta.colunas)),
          error: null,
          count: total,
        });
      },
    };
    return alvo;
  }

  const db = {
    from(nome: string) {
      return {
        select(cols: string, o?: { count?: string; head?: boolean }) {
          const consulta: Consulta = {
            tabela: nome, colunas: cols, filtros: {}, ordens: [], limite: null,
            head: o?.head === true,
          };
          capturado.consultas.push(consulta);
          return construir(consulta);
        },
        insert(novas: Record<string, unknown>[]) {
          capturado.escritas += 1;
          capturado.cargas.push(novas);
          transacao += 1;
          // `now()` é o `transaction_timestamp()`: um instante para as quatro linhas,
          // e o `execucao_id` sai dele — é o default da coluna, espelhado.
          const rodadaEm = new Date(Date.UTC(2026, 8, 28, 12, 0, transacao)).toISOString();
          const execucaoId = `00000000-0000-4000-8000-${String(transacao).padStart(12, '0')}`;
          const antes = [...tabela];
          const inseridas = novas.map((n) => ({
            execucao_id: execucaoId,
            rodada_em: rodadaEm,
            ...n,
          }) as unknown as LuaExecucaoRow);
          tabela.push(...inseridas);
          const queixa = conferirNoCommit(chavesDe(inseridas));
          if (queixa !== null || opts.erroNaEscrita) {
            tabela.length = 0;
            tabela.push(...antes);
            return {
              select: async () => ({
                data: null,
                error: opts.erroNaEscrita ?? new Error(queixa ?? 'erro'),
              }),
            };
          }
          return {
            select: async (cols: string) => ({
              // `escritaCega`: o `insert` comita e a projeção de volta não traz
              // linha nenhuma. É o caso que separa "nada foi gravado" de "foi
              // gravada, não regrave" — ver o PostgREST devolvendo `[]` quando a
              // RLS de leitura não bate com a de escrita.
              data: opts.escritaCega ? [] : inseridas.map((r) => projetar(r, cols)),
              error: null,
            }),
          };
        },
        /**
         * O `delete`, que o gatilho também cobre e o falso não tinha.
         *
         * `after insert or update or delete` está escrito na migração: apagar uma
         * execução INTEIRA é permitido, apagar três de quatro não. Sem este caminho,
         * a metade da regra que mais importa — a que diz o que é desfazer e o que é
         * mutilar — não era exercitada em lugar nenhum.
         */
        delete() {
          const filtros: Record<string, unknown> = {};
          const alvo = {
            eq(coluna: string, valor: unknown) { filtros[coluna] = valor; return alvo; },
            then(resolve: (r: { data: unknown; error: unknown }) => unknown) {
              const casam = tabela.filter((r) => Object.entries(filtros).every(
                ([c, v]) => (r as unknown as Record<string, unknown>)[c] === v,
              ));
              const antes = [...tabela];
              const chaves = chavesDe(casam);
              tabela.length = 0;
              tabela.push(...antes.filter((r) => !casam.includes(r)));
              const queixa = conferirNoCommit(chaves);
              if (queixa !== null) {
                tabela.length = 0;
                tabela.push(...antes);
                return resolve({ data: null, error: new Error(queixa) });
              }
              capturado.apagados += casam.length;
              return resolve({ data: null, error: null });
            },
          };
          return alvo;
        },
      };
    },
  };

  return { db: db as unknown as SupabaseClient, tabela, capturado };
}

/** O falso de `sleep_periods`, pela porta do módulo dono: termina em `.range()`. */
function fakeSono(periodos: SleepPeriod[]) {
  const capturado: { tabela?: string; colunas?: string; filtros: Record<string, unknown>; ordens: string[] } = {
    filtros: {}, ordens: [],
  };
  const alvo = {
    eq(coluna: string, valor: unknown) { capturado.filtros[coluna] = valor; return alvo; },
    gte(coluna: string, valor: unknown) { capturado.filtros[`gte:${coluna}`] = valor; return alvo; },
    order(coluna: string) { capturado.ordens.push(coluna); return alvo; },
    range(lo: number, hi: number) {
      const desde = String(capturado.filtros['gte:wake_day'] ?? '');
      const rs = periodos
        .filter((p) => p.wakeDay >= desde)
        .sort((a, b) => (a.onsetAt < b.onsetAt ? -1 : a.onsetAt > b.onsetAt ? 1 : 0))
        .slice(lo, hi + 1)
        .map((p) => ({
          user_id: p.userId, onset_at: p.onsetAt, wake_at: p.wakeAt, in_bed_at: p.inBedAt,
          in_bed_end: p.inBedEnd, tz_offset: p.tzOffset, wake_day: p.wakeDay, asleep_h: p.asleepH,
          awakenings: p.awakenings, stages: p.stages, stage_segments: p.stageSegments,
          source: p.source ?? null,
        }));
      return Promise.resolve({ data: rs, error: null });
    },
  };
  const db = {
    from(tabela: string) {
      capturado.tabela = tabela;
      return { select(cols: string) { capturado.colunas = cols; return alvo; } };
    },
  };
  return { db: db as unknown as SupabaseClient, capturado };
}

function periodo(wakeDay: string, onsetAt: string): SleepPeriod {
  return {
    userId: 'u-1', onsetAt, wakeAt: `${wakeDay}T06:30:00.000Z`, inBedAt: null, inBedEnd: null,
    tzOffset: 120, wakeDay, asleepH: 7.5, awakenings: null, stages: null, stageSegments: null,
  };
}

/* ─────────────────── A linha, a string e o banco ─────────────────── */

describe('LUA_EXECUCAO_COLUMNS', () => {
  it('pede exatamente as colunas que a linha lê', () => {
    const daLinha = Object.keys(projetarModelo()).sort();
    assert.deepEqual(LUA_EXECUCAO_COLUMNS.split(',').map((c) => c.trim()).sort(), daLinha);
  });

  it('não repete coluna — uma repetida passaria pelo `deepEqual` de conjuntos', () => {
    const pedidas = LUA_EXECUCAO_COLUMNS.split(',').map((c) => c.trim());
    assert.equal(new Set(pedidas).size, pedidas.length);
  });
});

/** Uma linha completa, para comparar com a string de colunas. */
function projetarModelo(): LuaExecucaoRow {
  const op = operacionalizacaoLunar();
  const f = COM_PODER.fases[2];
  const a = COM_PODER.acervo;
  return {
    user_id: 'u-1',
    execucao_id: '00000000-0000-4000-8000-000000000001',
    rodada_em: '2026-09-28T12:00:01.000Z',
    cadeia: [...CADEIA_DO_PRE_REGISTRO],
    cadeia_digest: DIGEST_DA_CADEIA,
    janela_noites: op.janelaNoites,
    hora_utc_do_fim_da_noite: op.horaUtcDoFimDaNoite,
    borda_direita: op.bordaDireita,
    motor_versao: MOTOR_LUNAR_VERSAO,
    janela_versao: JANELA_LUNAR_VERSAO,
    pedido_desde: PEDIDO.desde,
    acervo_noites: a.noites,
    acervo_noites_distintas: a.noitesDistintas,
    acervo_noites_colapsadas: PEDIDO.noitesColapsadas,
    acervo_de: a.de,
    acervo_ate: a.ate,
    acervo_sd_min: a.sdMin,
    acervo_origem_do_eixo_h: a.origemDoEixoH,
    acervo_noites_sem_luz: a.noitesSemLuz,
    acervo_primeira_noite_sem_luz: a.primeiraNoiteSemLuz,
    fase: f.fase,
    familia: f.familia,
    alfa: f.alfa,
    lateralidade: f.lateralidade,
    direcao: f.direcao,
    veredito: f.veredito,
    motivo: f.motivo,
    portao_reprovado: f.portaoReprovado,
    efeito_min: f.efeitoMin,
    p: f.p,
    z_de_mann_whitney: f.zDeMannWhitney,
    poder: f.poder,
    efeito_minimo_detectavel_min: f.efeitoMinimoDetectavelMin,
    noites_dentro: f.noitesDentro,
    noites_fora: f.noitesFora,
    ciclos: f.ciclos,
    falta_quanto: f.falta?.quanto ?? null,
    falta_unidade: f.falta?.unidade ?? null,
    noites_para_80: f.noitesPara80,
  };
}

/**
 * O vocabulário fechado, **do lado do TypeScript**.
 *
 * A comparação com os CHECKs da migração **não mora aqui**: ela é uma barreira, e as
 * barreiras vivem em `architecture.test.ts`, onde `idsAceitosPeloCheck` já lê as duas
 * formas que o Postgres aceita (`in (…)` e `= any (array[…])`), segue `drop
 * constraint` e `drop table`, e varre **todas** as migrations em vez de uma só. A
 * versão que morava aqui reinventava a regex, lia um arquivo e pinava o nome da
 * migração numa asserção — o que reprova no dia em que alguém renumerar num merge,
 * ou usar o `alter table … drop constraint / add constraint` que a própria barreira
 * existente prescreve.
 *
 * O que fica: que as listas do TS são o que o protocolo diz, e que sete das nove
 * saem de `PROTOCOLO_LUNAR` e de `UNIDADE_DO_MOTIVO` em vez de reescritas.
 */
describe('o vocabulário fechado sai do protocolo, e não de uma lista à mão', () => {
  it('as nove colunas de vocabulário estão no mapa, e nenhuma lista é vazia', () => {
    assert.deepEqual(Object.keys(VOCABULARIO_DE_LUA_EXECUCOES).sort(), [
      'borda_direita', 'direcao', 'falta_unidade', 'familia', 'fase', 'lateralidade',
      'motivo', 'portao_reprovado', 'veredito',
    ]);
    for (const [coluna, lista] of Object.entries(VOCABULARIO_DE_LUA_EXECUCOES)) {
      assert.ok(lista.length > 0, `${coluna}: lista vazia — a barreira do banco ficaria sem alvo`);
    }
  });

  it('os três vereditos são os do §5, e a lista é congelada', () => {
    assert.deepEqual([...VEREDITOS_LUNARES], ['achado', 'nenhum_padrao', 'inconclusivo']);
    assert.ok(Object.isFrozen(VEREDITOS_LUNARES));
  });

  it('as quatro unidades do que falta são as quatro do motor — uma por motivo', () => {
    assert.deepEqual(
      [...VOCABULARIO_DE_LUA_EXECUCOES.falta_unidade].sort(),
      [...new Set(Object.values(UNIDADE_DO_MOTIVO))].sort(),
    );
    assert.equal(VOCABULARIO_DE_LUA_EXECUCOES.motivo.length, 4);
    assert.equal(VOCABULARIO_DE_LUA_EXECUCOES.portao_reprovado.length, 3);
  });
});

/* ─────────────────────────── A escrita ─────────────────────────── */

describe('gravarExecucaoLunar — a porta única, e um insert', () => {
  it('grava QUATRO linhas, uma por fase, com o mesmo execucao_id, numa chamada só', async () => {
    const f = fakeBanco();
    const e = await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    assert.equal(f.capturado.escritas, 1, 'as quatro fases vão numa escrita só (§9)');
    assert.equal(f.tabela.length, FASES_POR_EXECUCAO);
    assert.deepEqual(f.tabela.map((r) => r.fase).sort(), [...PHASE_ORDER].sort());
    assert.equal(new Set(f.tabela.map((r) => r.execucao_id)).size, 1);
    assert.equal(new Set(f.tabela.map((r) => r.rodada_em)).size, 1);
    assert.equal(e.execucaoId, f.tabela[0].execucao_id);
    // A ordem de saída é a da lunação, não a do banco.
    assert.deepEqual(e.veredito.fases.map((x) => x.fase), [...PHASE_ORDER]);
  });

  /**
   * Os dois saem de `default` do banco, e do mesmo `transaction_timestamp()`. Mandar
   * `execucao_id` daqui exigiria gerar uuid no cliente — o Hermes não tem
   * `crypto.randomUUID`, e o repositório nunca gerou uuid fora do banco.
   */
  it('não manda execucao_id nem rodada_em: os dois são default do banco', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    for (const linha of f.capturado.cargas[0]) {
      assert.ok(!('execucao_id' in linha), 'a carga mandou execucao_id');
      assert.ok(!('rodada_em' in linha), 'a carga mandou rodada_em');
      assert.equal(linha.user_id, 'u-1');
    }
  });

  it('carimba a cadeia INTEIRA, o digest e a operacionalização em cada linha', async () => {
    const f = fakeBanco();
    const op = operacionalizacaoLunar();
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    for (const r of f.tabela) {
      assert.deepEqual(r.cadeia, CADEIA_DO_PRE_REGISTRO.map((x) => ({ arquivo: x.arquivo, sha256: x.sha256 })));
      assert.equal(r.cadeia_digest, DIGEST_DA_CADEIA);
      assert.equal(r.janela_noites, op.janelaNoites);
      assert.equal(r.hora_utc_do_fim_da_noite, op.horaUtcDoFimDaNoite);
      assert.equal(r.borda_direita, op.bordaDireita);
    }
  });

  /** Valor, não ponteiro: o que está gravado não pode mudar porque a memória mudou. */
  it('a cadeia gravada são objetos novos, não os congelados da constante', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    const gravado = (f.capturado.cargas[0][0].cadeia as unknown[])[0];
    assert.notEqual(gravado, CADEIA_DO_PRE_REGISTRO[0]);
    assert.deepEqual(gravado, { ...CADEIA_DO_PRE_REGISTRO[0] });
  });

  /** Segunda execução: **acumula**, jamais substitui (§7.2). É o contador que depende disso. */
  it('a segunda execução acumula — 8 linhas, 2 execucao_id distintos', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    await gravarExecucaoLunar(f.db, 'u-1', SEM_LUZ, PEDIDO);
    assert.equal(f.tabela.length, 8);
    assert.equal(new Set(f.tabela.map((r) => r.execucao_id)).size, 2);
    assert.equal(await contarExecucoesLunares(f.db, 'u-1'), 2);
  });

  it('propaga o erro do banco', async () => {
    const f = fakeBanco({ erroNaEscrita: new Error('lua_execucoes_pkey') });
    await assert.rejects(() => gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO), /lua_execucoes_pkey/);
  });
});

describe('gravarExecucaoLunar — o que a porta recusa antes de tocar no banco', () => {
  /** A linha da matriz: payload incompleto ⇒ a escrita falha e NENHUMA linha entra. */
  it('três fases: recusa, e não chama o banco', async () => {
    const f = fakeBanco();
    const tres = {
      ...COM_PODER,
      fases: COM_PODER.fases.slice(0, 3) as unknown as QuatroResultados,
    };
    await assert.rejects(() => gravarExecucaoLunar(f.db, 'u-1', tres, PEDIDO), ExecucaoLunarRecusada);
    await assert.rejects(() => gravarExecucaoLunar(f.db, 'u-1', tres, PEDIDO), /chegaram 3 fase\(s\)/);
    assert.equal(f.capturado.escritas, 0, 'chamou o banco com três fases');
    assert.equal(f.tabela.length, 0);
  });

  it('fase repetida no lugar da que falta: recusa pelo nome da repetida', async () => {
    const f = fakeBanco();
    const [a, b, c] = COM_PODER.fases;
    const repetida = { ...COM_PODER, fases: [a, b, c, c] as unknown as QuatroResultados };
    await assert.rejects(() => gravarExecucaoLunar(f.db, 'u-1', repetida, PEDIDO), /a fase full chegou duas vezes/);
    assert.equal(f.capturado.escritas, 0);
  });

  /**
   * **A guarda que impede a mudança silenciosa de α.**
   *
   * O motor monta cada resultado a partir de `PROTOCOLO_LUNAR`, então o desvio não é
   * construível por ele — e é por isso que a guarda existe: quem gravar por outro
   * caminho (um script, um backfill, uma chamada à mão) não consegue gravar um α que
   * documento nenhum autorizou. O 1,67% que os documentos imprimem arredondado é
   * **mais frouxo** que 5/3 %, e é exatamente o tipo de diferença que passaria.
   */
  it('α fora do protocolo: recusa, nomeando o pré-registrado e o documento', async () => {
    const f = fakeBanco();
    const [nova, ...resto] = COM_PODER.fases;
    const frouxo = {
      ...COM_PODER,
      fases: [{ ...nova, alfa: 0.0167 }, ...resto] as unknown as QuatroResultados,
    };
    await assert.rejects(() => gravarExecucaoLunar(f.db, 'u-1', frouxo, PEDIDO), ExecucaoLunarRecusada);
    await assert.rejects(
      () => gravarExecucaoLunar(f.db, 'u-1', frouxo, PEDIDO),
      /α 0\.0167.*α 0\.016666.*pre-registro-lua-outras-fases\.md/s,
    );
    assert.equal(f.capturado.escritas, 0);
  });

  it('a cheia com a lateralidade das três: recusa', async () => {
    const f = fakeBanco();
    const fases = COM_PODER.fases.map((x) =>
      x.fase === 'full' ? { ...x, lateralidade: 'bilateral' as const } : x);
    await assert.rejects(
      () => gravarExecucaoLunar(f.db, 'u-1', { ...COM_PODER, fases: fases as unknown as QuatroResultados }, PEDIDO),
      /a fase full chegou com/,
    );
  });

  it('a direção emprestada da cheia para uma das três: recusa', async () => {
    const f = fakeBanco();
    const fases = COM_PODER.fases.map((x) =>
      x.fase === 'new' ? { ...x, direcao: 'atraso' as const } : x);
    await assert.rejects(
      () => gravarExecucaoLunar(f.db, 'u-1', { ...COM_PODER, fases: fases as unknown as QuatroResultados }, PEDIDO),
      /a fase new chegou com/,
    );
  });

  /**
   * O gatilho do banco, **espelhado no falso**. O que este caso prova é a forma da
   * regra, e que a porta não é a única linha de defesa; a prova do `constraint
   * trigger` é a migração, e ela só roda na janela do dono.
   */
  it('uma escrita parcial que chegasse ao banco seria recusada no commit, e nada ficaria', async () => {
    const f = fakeBanco();
    const parcial = COM_PODER.fases.slice(0, 3).map((x) => ({ user_id: 'u-1', fase: x.fase }));
    const { error } = await (f.db as unknown as {
      from: (t: string) => { insert: (r: unknown[]) => { select: (c: string) => Promise<{ error: unknown }> } };
    }).from('lua_execucoes').insert(parcial).select(LUA_EXECUCAO_COLUMNS);
    assert.match(String((error as Error).message), /3 linha\(s\) e 3 fase\(s\)/);
    assert.equal(f.tabela.length, 0, 'ficou linha de uma execução incompleta');
  });
});

/* ──────────── O gatilho do outro lado: apagar inteira, ou não apagar ──────────── */

/**
 * **`after insert or update or delete`, e o `delete` é metade da regra.**
 *
 * A migração diz, com todas as letras, que apagar uma execução INTEIRA é permitido e
 * que deixá-la com três não é. O falso do banco só cobrava no `insert`, então a
 * metade que define *o que é desfazer e o que é mutilar* não era exercitada em lugar
 * nenhum — e é justamente a metade que sobra depois que a policy fechou o `delete` da
 * API: o caminho do superusuário.
 *
 * A porta em TS não tem `delete`, e não vai ter: estes casos falam com o falso
 * diretamente, como o da escrita parcial.
 */
type ApagadorFalso = {
  from: (t: string) => { delete: () => { eq: (c: string, v: unknown) => unknown } };
};

function apagar(db: SupabaseClient, filtros: Record<string, unknown>): Promise<{ error: unknown }> {
  let alvo = (db as unknown as ApagadorFalso).from('lua_execucoes').delete() as {
    eq: (c: string, v: unknown) => typeof alvo;
  };
  for (const [c, v] of Object.entries(filtros)) alvo = alvo.eq(c, v);
  return alvo as unknown as Promise<{ error: unknown }>;
}

describe('apagar: a execução inteira sai, três de quatro não', () => {
  it('o delete da execução INTEIRA passa, e o contador volta a zero', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    const id = f.tabela[0].execucao_id;
    const { error } = await apagar(f.db, { user_id: 'u-1', execucao_id: id });
    assert.equal(error, null, 'apagar uma execução inteira é o único desfazer que existe');
    assert.equal(f.tabela.length, 0);
    assert.equal(await contarExecucoesLunares(f.db, 'u-1'), 0);
  });

  it('o delete PARCIAL é recusado no commit, e as quatro linhas ficam', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    const id = f.tabela[0].execucao_id;
    const { error } = await apagar(f.db, { user_id: 'u-1', execucao_id: id, fase: PHASE_ORDER[0] });
    assert.match(String((error as Error).message), /3 linha\(s\) e 3 fase\(s\)/);
    assert.equal(f.tabela.length, 4, 'a execução ficou mutilada');
    assert.equal(await contarExecucoesLunares(f.db, 'u-1'), 1);
  });

  /**
   * **O gatilho filtra por `(user_id, execucao_id)`, e o falso tem de filtrar igual.**
   *
   * `lua_execucao_conferir(p_user, p_execucao)` recebe os dois e usa os dois. Contar só
   * pelo `execucao_id` faria duas execuções de **donos diferentes** com o mesmo id
   * somarem oito linhas, e o falso **acusaria uma escrita que o Postgres aceita** — um
   * espelho que diverge do original não é espelho.
   *
   * O caso monta exatamente o estado que separa as duas leituras: o dono 1 já tem
   * quatro linhas com o id que a próxima escrita vai gerar, e o dono 2 grava as dele.
   * Com a chave certa a escrita passa; com a chave errada ela é recusada por "ficou com
   * 8 linhas". Um caso que só apagasse uma das duas execuções **não** distingue as duas
   * implementações, porque as duas recusam — foi assim que esta linha do falso ficou
   * sem barreira até 29/09.
   */
  it('dois donos com o mesmo execucao_id não somam — o gatilho conta pelos dois campos', async () => {
    const f = fakeBanco();
    // O id que o primeiro `insert` deste falso vai gerar (o `default` do banco,
    // espelhado). O dono 1 já está lá com ele — é o que um `md5` sem `auth.uid()`
    // produziria para duas sessões sem JWT no mesmo instante.
    const id = '00000000-0000-4000-8000-000000000001';
    for (const fase of PHASE_ORDER) {
      f.tabela.push({ ...projetarModelo(), user_id: 'u-1', execucao_id: id, fase });
    }
    await gravarExecucaoLunar(f.db, 'u-2', COM_PODER, PEDIDO);
    assert.equal(f.tabela.length, 8, 'a escrita do dono 2 foi recusada por linhas que não são dela');
    assert.equal(new Set(f.tabela.map((r) => r.execucao_id)).size, 1, 'o caso só vale com o id repetido');
    assert.equal(await contarExecucoesLunares(f.db, 'u-1'), 1);
    assert.equal(await contarExecucoesLunares(f.db, 'u-2'), 1);

    // E o delete continua por dono: apagar a do 2 não toca na do 1.
    const { error } = await apagar(f.db, { user_id: 'u-2', execucao_id: id });
    assert.equal(error, null);
    assert.equal(f.tabela.length, 4);
    assert.equal(await contarExecucoesLunares(f.db, 'u-1'), 1);
  });
});

/* ─────────────────────── Os nulos, e a unidade do que falta ─────────────────────── */

describe('portão reprovado — nulo é "não foi medido", nunca zero', () => {
  it('o portão da luz fecha para as quatro, e efeito, p, poder e z saem nulos', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', SEM_LUZ, PEDIDO);
    assert.equal(f.tabela.length, 4);
    for (const r of f.tabela) {
      assert.equal(r.veredito, 'inconclusivo', r.fase);
      assert.equal(r.motivo, 'luz', r.fase);
      assert.equal(r.portao_reprovado, 'luz', r.fase);
      assert.equal(r.efeito_min, null, `${r.fase}: efeito`);
      assert.equal(r.p, null, `${r.fase}: p`);
      assert.equal(r.poder, null, `${r.fase}: poder`);
      assert.equal(r.z_de_mann_whitney, null, `${r.fase}: z`);
      assert.equal(r.efeito_minimo_detectavel_min, null, `${r.fase}: MDE`);
      assert.equal(r.noites_para_80, null, `${r.fase}: noites para 80`);
      // E o que falta vem com a unidade do motivo, que não é noite coletável.
      assert.equal(r.falta_unidade, 'noites-sem-luz', `${r.fase}: unidade`);
      assert.equal(r.falta_quanto, 1, `${r.fase}: quanto`);
      // As contagens valem SEMPRE — elas não são medida do desfecho.
      assert.equal(r.noites_dentro + r.noites_fora, 400, `${r.fase}: contagens`);
    }
    assert.equal(f.tabela[0].acervo_noites_sem_luz, 1);
    assert.equal(f.tabela[0].acervo_primeira_noite_sem_luz, '2025-04-30');
  });

  it('com poder, a medida existe e o que falta é nulo', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    for (const r of f.tabela) {
      assert.notEqual(r.veredito, 'inconclusivo', `${r.fase}: ${r.veredito}`);
      assert.ok(typeof r.efeito_min === 'number', `${r.fase}: efeito`);
      assert.ok(typeof r.p === 'number', `${r.fase}: p`);
      assert.ok(typeof r.poder === 'number' && r.poder >= 0.8, `${r.fase}: poder`);
      assert.equal(r.motivo, null, `${r.fase}: motivo`);
      assert.equal(r.portao_reprovado, null, `${r.fase}: portão`);
      assert.equal(r.falta_quanto, null, `${r.fase}: quanto`);
      assert.equal(r.falta_unidade, null, `${r.fase}: unidade`);
    }
  });

  /**
   * **O motivo que faltava, e que é o desfecho mais provável.**
   *
   * A aritmética do próprio motor põe o poder em 39% nas três fases novas a SD 45, e
   * até aqui `motivo = 'poder'` não era gravado nem lido por caso nenhum. A prova de
   * que o buraco era real: trocar `MOTIVOS_DO_INCONCLUSIVO` por `PORTOES_LUNARES` na
   * linha do `motivo` em `toResultadoDaFase` deixava a suíte verde — e em produção
   * faria a página explodir ao abrir, exatamente no caso mais esperado.
   *
   * É também o único inconclusivo em que a **medida existe**: o portão do poder vem
   * depois de medir, então efeito, p, z, poder e MDE não são nulos. Isso é o inverso
   * exato de `portao_reprovado_nao_mede`, e por isso `portao_reprovado` é nulo aqui.
   */
  it('inconclusivo por PODER: portão nulo, medida presente, unidade de noite coletável', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', SEM_PODER, PEDIDO);
    assert.equal(f.tabela.length, 4);
    for (const r of f.tabela) {
      assert.equal(r.veredito, 'inconclusivo', r.fase);
      assert.equal(r.motivo, 'poder', r.fase);
      assert.equal(r.portao_reprovado, null, `${r.fase}: o poder não é portão da §4, é o que vem depois`);
      assert.ok(typeof r.efeito_min === 'number', `${r.fase}: efeito foi medido`);
      assert.ok(typeof r.p === 'number', `${r.fase}: p foi medido`);
      assert.ok(typeof r.poder === 'number' && r.poder < 0.8, `${r.fase}: poder ${String(r.poder)}`);
      assert.ok(typeof r.efeito_minimo_detectavel_min === 'number', `${r.fase}: MDE`);
      assert.equal(r.falta_unidade, 'noites-coletaveis', `${r.fase}: unidade`);
      assert.ok((r.falta_quanto ?? 0) >= 1, `${r.fase}: quanto`);
      assert.ok(typeof r.noites_para_80 === 'number', `${r.fase}: noites para 80`);
    }
  });

  /**
   * **Dois motivos na mesma execução.** Doze noites bastam para duas fases caírem no
   * portão dos ciclos e duas no da amostra — com unidades diferentes na mesma
   * execução. Um caso em que as quatro fases concordam não prova que a linha carrega
   * o motivo *dela*.
   */
  it('inconclusivo por CICLOS e por AMOSTRA, lado a lado, com as unidades certas', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', CURTO, PEDIDO);
    const porMotivo = new Map<string, number>();
    for (const r of f.tabela) {
      assert.equal(r.veredito, 'inconclusivo', r.fase);
      assert.ok(r.motivo === 'ciclos' || r.motivo === 'amostra', `${r.fase}: motivo ${String(r.motivo)}`);
      // Portão fechado ⇒ nada foi medido. É o CHECK `portao_reprovado_nao_mede`.
      assert.equal(r.portao_reprovado, r.motivo, `${r.fase}: o portão É o motivo`);
      assert.equal(r.efeito_min, null, `${r.fase}: efeito`);
      assert.equal(r.poder, null, `${r.fase}: poder`);
      assert.equal(
        r.falta_unidade,
        UNIDADE_DO_MOTIVO[r.motivo as MotivoDoInconclusivo],
        `${r.fase}: a unidade sai do motivo, e de lugar nenhum mais`,
      );
      // `ciclos <= noites_dentro` — o CHECK novo, exercitado com número de verdade.
      assert.ok(r.ciclos <= r.noites_dentro, `${r.fase}: ${r.ciclos} ciclos em ${r.noites_dentro} noites`);
      porMotivo.set(String(r.motivo), (porMotivo.get(String(r.motivo)) ?? 0) + 1);
    }
    assert.deepEqual([...porMotivo.keys()].sort(), ['amostra', 'ciclos'], 'os dois motivos na mesma execução');
  });

  /**
   * **O acervo vazio grava**, e grava com os nulos que o dizem.
   *
   * `acervo_de`, `acervo_ate` e `acervo_sd_min` nulos, contagens em zero — é o que os
   * CHECKs `acervo_vazio_nao_tem_intervalo` e `colunas_cabem_no_acervo` cobram, e é
   * o estado em que o teste roda antes de existir noite nenhuma coletada no alcance
   * pedido. Uma execução que não conseguisse gravá-lo empurraria o dono a rodar de
   * novo para descobrir o mesmo nada.
   */
  it('acervo vazio: de, ate e sd nulos, contagens em zero, e a execução grava', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', VAZIO, PEDIDO);
    assert.equal(f.tabela.length, 4);
    for (const r of f.tabela) {
      assert.equal(r.acervo_noites, 0, r.fase);
      assert.equal(r.acervo_de, null, r.fase);
      assert.equal(r.acervo_ate, null, r.fase);
      assert.equal(r.acervo_sd_min, null, r.fase);
      assert.equal(r.noites_dentro, 0, r.fase);
      assert.equal(r.noites_fora, 0, r.fase);
      assert.equal(r.ciclos, 0, r.fase);
      assert.equal(r.motivo, 'amostra', r.fase);
      assert.equal(r.falta_unidade, 'noites-de-coluna', r.fase);
    }
  });

  /**
   * **As quatro unidades, e as quatro numa execução de verdade.**
   *
   * `UNIDADE_DO_MOTIVO` tem quatro entradas, e até aqui uma só delas chegava a virar
   * linha. Este caso soma os quatro acervos e cobra que o conjunto das unidades
   * gravadas seja **o conjunto inteiro** — o que faz o CHECK
   * `unidade_bate_com_o_motivo` ter os quatro ramos exercitados.
   */
  it('os quatro motivos e as quatro unidades chegam a virar linha', async () => {
    const f = fakeBanco();
    for (const v of [SEM_LUZ, SEM_PODER, CURTO, VAZIO]) {
      await gravarExecucaoLunar(f.db, 'u-1', v, PEDIDO);
    }
    const motivos = new Set(f.tabela.map((r) => String(r.motivo)));
    const unidades = new Set(f.tabela.map((r) => String(r.falta_unidade)));
    assert.deepEqual([...motivos].sort(), ['amostra', 'ciclos', 'luz', 'poder']);
    assert.deepEqual([...unidades].sort(), [...new Set(Object.values(UNIDADE_DO_MOTIVO))].sort());
  });
});

/* ──────────── O carimbo do pedido, o do motor e o da régua ──────────── */

describe('o pedido, o motor e a régua ficam gravados, porque nada mais os registram', () => {
  it('cada linha carimba pedido_desde, as noites colapsadas e as duas versões', async () => {
    const f = fakeBanco();
    const pedido = { desde: '2025-06-01', noitesColapsadas: 7 };
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, pedido);
    for (const r of f.tabela) {
      assert.equal(r.pedido_desde, '2025-06-01', r.fase);
      assert.equal(r.acervo_noites_colapsadas, 7, r.fase);
      assert.equal(r.motor_versao, MOTOR_LUNAR_VERSAO, r.fase);
      assert.equal(r.janela_versao, JANELA_LUNAR_VERSAO, r.fase);
    }
    const lida = await fetchUltimaExecucaoLunar(f.db, 'u-1');
    assert.deepEqual(lida!.pedido, pedido);
    assert.equal(lida!.motorVersao, MOTOR_LUNAR_VERSAO);
    assert.equal(lida!.janelaVersao, JANELA_LUNAR_VERSAO);
  });

  /**
   * As colunas de execução repetem nas quatro linhas, e a leitura cobra que
   * concordem. As quatro entram nessa assinatura — senão uma execução podia
   * dizer que pediu desde abril em três linhas e desde junho na quarta.
   */
  it('pedido, colapso, motor e régua entram na assinatura da execução', () => {
    for (const campo of [
      'pedido_desde', 'acervo_noites_colapsadas', 'motor_versao', 'janela_versao',
    ] as const) {
      const rs = COM_PODER.fases.map((fase) => ({
        ...projetarModelo(),
        fase: fase.fase,
        veredito: fase.veredito,
        motivo: fase.motivo,
        portao_reprovado: fase.portaoReprovado,
        falta_quanto: fase.falta?.quanto ?? null,
        falta_unidade: fase.falta?.unidade ?? null,
      }));
      rs[2] = { ...rs[2], [campo]: campo === 'pedido_desde' ? '2030-01-01' : 99 };
      assert.throws(
        () => toLuaExecucao(rs),
        /discordam sobre a própria execução/,
        `${campo} fora da assinatura: quatro linhas podem discordar sobre ele sem que nada acuse`,
      );
    }
  });

  it('noitesColapsadasEm conta as noites com mais de um período, e só elas', () => {
    assert.equal(noitesColapsadasEm([]), 0);
    assert.equal(
      noitesColapsadasEm([
        periodo('2026-03-10', '2026-03-09T23:40:00.000Z'),
        periodo('2026-03-11', '2026-03-10T23:10:00.000Z'),
      ]),
      0,
      'uma noite por período: nada a colapsar, e zero é resposta',
    );
    assert.equal(
      noitesColapsadasEm([
        periodo('2026-03-10', '2026-03-09T23:40:00.000Z'),
        periodo('2026-03-10', '2026-03-10T03:15:00.000Z'),
        periodo('2026-03-10', '2026-03-10T05:00:00.000Z'),
        periodo('2026-03-11', '2026-03-10T23:10:00.000Z'),
      ]),
      1,
      'três períodos numa noite são UMA noite colapsada, não duas',
    );
  });
});

/* ─────────────────────────── As leituras ─────────────────────────── */

describe('fetchUltimaExecucaoLunar e o contador', () => {
  it('tabela vazia: a leitura devolve null e o contador zero — "ainda não rodou"', async () => {
    const f = fakeBanco();
    assert.equal(await fetchUltimaExecucaoLunar(f.db, 'u-1'), null);
    assert.equal(await contarExecucoesLunares(f.db, 'u-1'), 0);
  });

  it('três execuções: devolve as quatro linhas da mais recente, e o contador diz 3', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    await gravarExecucaoLunar(f.db, 'u-1', SEM_LUZ, PEDIDO);
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    assert.equal(f.tabela.length, 12);
    assert.equal(await contarExecucoesLunares(f.db, 'u-1'), 3);
    const ultima = await fetchUltimaExecucaoLunar(f.db, 'u-1');
    assert.ok(ultima);
    assert.equal(ultima!.execucaoId, f.tabela[8].execucao_id);
    assert.equal(ultima!.veredito.acervo.noitesSemLuz, 0, 'leu a segunda, não a terceira');
  });

  it('pede exatamente LUA_EXECUCAO_COLUMNS, filtra pelo dono e limita a quatro', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    await fetchUltimaExecucaoLunar(f.db, 'u-1');
    const q = f.capturado.consultas.at(-1)!;
    assert.equal(q.tabela, 'lua_execucoes');
    assert.equal(q.colunas, LUA_EXECUCAO_COLUMNS);
    assert.deepEqual(q.filtros, { user_id: 'u-1' });
    assert.equal(q.limite, FASES_POR_EXECUCAO);
  });

  /**
   * A ordem tem **três** critérios, e o segundo não é enfeite: sem ele, duas
   * execuções empatadas no `rodada_em` se intercalariam e o `limit(4)` traria duas
   * linhas de cada — `toLuaExecucao` explodiria com "a fase veio duas vezes", que é
   * falha alta pelo motivo errado.
   */
  it('a ordenação é (rodada_em desc, execucao_id desc, fase asc) — total', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    await fetchUltimaExecucaoLunar(f.db, 'u-1');
    assert.deepEqual(f.capturado.consultas.at(-1)!.ordens, [
      { coluna: 'rodada_em', asc: false },
      { coluna: 'execucao_id', asc: false },
      { coluna: 'fase', asc: true },
    ]);
  });

  it('empate no rodada_em: o execucao_id desempata e as duas execuções não se misturam', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    await gravarExecucaoLunar(f.db, 'u-1', SEM_LUZ, PEDIDO);
    // O empate que o banco pode produzir: duas transações no mesmo instante.
    for (const r of f.tabela) r.rodada_em = '2026-09-28T12:00:00.000Z';
    const ultima = await fetchUltimaExecucaoLunar(f.db, 'u-1');
    assert.ok(ultima);
    assert.equal(ultima!.execucaoId, f.tabela[4].execucao_id, 'o maior execucao_id vence o empate');
    assert.equal(ultima!.veredito.acervo.noitesSemLuz, 1);
  });

  /** O contador conta as linhas de UMA fase, porque a chave dá exatamente uma por execução. */
  it('o contador filtra por uma fase só, e pede a contagem sem trazer linha', async () => {
    const f = fakeBanco();
    await gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO);
    await contarExecucoesLunares(f.db, 'u-1');
    const q = f.capturado.consultas.at(-1)!;
    assert.equal(q.head, true);
    assert.deepEqual(q.filtros, { user_id: 'u-1', fase: PHASE_ORDER[0] });
  });

  it('propaga o erro do banco nas duas leituras', async () => {
    const f = fakeBanco({ erroNaLeitura: new Error('rls') });
    await assert.rejects(() => fetchUltimaExecucaoLunar(f.db, 'u-1'), /rls/);
    await assert.rejects(() => contarExecucoesLunares(f.db, 'u-1'), /rls/);
  });
});

/**
 * **A ida e volta.** É o teste que faz `ExecucaoLunar.veredito` valer a pena: quem lê
 * uma execução gravada e quem acabou de rodar o teste têm o mesmo objeto nas mãos, e
 * a página não precisa de dois caminhos de renderização para a mesma coisa.
 */
describe('a ida e volta pelo banco', () => {
  const casos = [
    ['com poder', COM_PODER], ['sem luz', SEM_LUZ], ['sem poder', SEM_PODER],
    ['curto (ciclos e amostra)', CURTO], ['acervo vazio', VAZIO],
  ] as const;
  for (const [nome, v] of casos) {
    it(`o veredito ${nome} volta idêntico ao que o motor produziu`, async () => {
      const f = fakeBanco();
      await gravarExecucaoLunar(f.db, 'u-1', v, PEDIDO);
      const lida = await fetchUltimaExecucaoLunar(f.db, 'u-1');
      assert.ok(lida);
      assert.deepEqual(lida!.veredito, v);
      assert.deepEqual([...lida!.cadeia], CADEIA_DO_PRE_REGISTRO.map((e) => ({ ...e })));
      assert.deepEqual(lida!.operacionalizacao, { ...operacionalizacaoLunar() });
      assert.deepEqual(lida!.pedido, { ...PEDIDO });
    });
  }
});

/* ──────── A escrita que aconteceu e a leitura que não veio (D1/D2/D3) ──────── */

describe('o erro da escrita e o erro da leitura de volta não são o mesmo erro', () => {
  /**
   * **A distinção que decide se o contador infla.**
   *
   * O `insert(...).select(...)` é uma chamada do PostgREST e dois atos. Se o `select`
   * volta vazio depois de a escrita comitar, a mensagem antiga era a de
   * `toLuaExecucao` — "uma execução tem 4 linhas e chegaram 0" —, e o módulo reserva
   * a frase "nada foi gravado" para a recusa. Quem lesse isso rodaria de novo, e a
   * segunda execução é real: ela entra na pilha e move o contador da §7.4, que é a
   * peça anti-gaveta inteira.
   */
  it('escrita comitada com projeção vazia: diz FOI GRAVADA, não regrave', async () => {
    const f = fakeBanco({ escritaCega: true });
    await assert.rejects(
      () => gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO),
      ExecucaoLunarGravadaSemLeitura,
    );
    await assert.rejects(
      () => gravarExecucaoLunar(f.db, 'u-1', COM_PODER, PEDIDO),
      /FOI GRAVADA — NÃO a regrave/,
    );
    // E a escrita aconteceu mesmo: as linhas estão lá, nas duas tentativas.
    assert.equal(f.tabela.length, 8);
  });

  it('e a recusa continua dizendo que NADA foi gravado', async () => {
    const f = fakeBanco();
    const tres = { ...COM_PODER, fases: COM_PODER.fases.slice(0, 3) as unknown as QuatroResultados };
    await assert.rejects(() => gravarExecucaoLunar(f.db, 'u-1', tres, PEDIDO), /nada foi gravado/);
    assert.equal(f.tabela.length, 0);
  });

  /**
   * **`count ?? 0` transformava "não sei" em "nunca rodou"** — no arquivo cujo lema é
   * o contrário (a lição da story 2.6). O PostgREST devolve `count: null` quando a
   * contagem não veio no cabeçalho, e um zero ali imprime "ainda não rodou" sobre uma
   * pilha de tentativas.
   */
  it('contagem nula do banco: explode, em vez de dizer zero', async () => {
    const semContagem = {
      from: () => ({
        select: () => {
          const alvo = {
            eq: () => alvo,
            then: (resolve: (r: { data: unknown; error: unknown; count: number | null }) => unknown) =>
              resolve({ data: null, error: null, count: null }),
          };
          return alvo;
        },
      }),
    } as unknown as SupabaseClient;
    await assert.rejects(
      () => contarExecucoesLunares(semContagem, 'u-1'),
      /não devolveu a contagem/,
    );
  });
});

/* ─────────────────────────── toLuaExecucao ─────────────────────────── */

describe('toLuaExecucao — a linha é conferida, nunca convertida por `as`', () => {
  const quatro = (): LuaExecucaoRow[] => COM_PODER.fases.map((f) => ({
    ...projetarModelo(),
    fase: f.fase,
    familia: f.familia,
    alfa: f.alfa,
    lateralidade: f.lateralidade,
    direcao: f.direcao,
    veredito: f.veredito,
    motivo: f.motivo,
    portao_reprovado: f.portaoReprovado,
    efeito_min: f.efeitoMin,
    p: f.p,
    z_de_mann_whitney: f.zDeMannWhitney,
    poder: f.poder,
    efeito_minimo_detectavel_min: f.efeitoMinimoDetectavelMin,
    noites_dentro: f.noitesDentro,
    noites_fora: f.noitesFora,
    ciclos: f.ciclos,
    falta_quanto: f.falta?.quanto ?? null,
    falta_unidade: f.falta?.unidade ?? null,
    noites_para_80: f.noitesPara80,
  }));

  it('as quatro em qualquer ordem saem na ordem da lunação', () => {
    const e = toLuaExecucao([...quatro()].reverse());
    assert.deepEqual(e.veredito.fases.map((f) => f.fase), [...PHASE_ORDER]);
  });

  /**
   * **A mensagem diz o que fazer, não em que parágrafo a regra mora.**
   *
   * Quem a lê está diante de uma tela que não abriu. Citar a §9 não adianta o
   * primeiro passo — e o primeiro passo existe e é concreto: como a escrita parcial é
   * impossível (porta e gatilho), 1 a 3 linhas só podem ser **leitura truncada**, e o
   * lugar de olhar é a ordenação e o `limit` da consulta.
   */
  it('três linhas: explode dizendo COMO consertar, e não citando a §9', () => {
    assert.throws(() => toLuaExecucao(quatro().slice(0, 3)), /uma execução tem 4 linhas.*chegaram 3/s);
    assert.throws(() => toLuaExecucao(quatro().slice(0, 3)), /leitura truncada/);
    assert.throws(() => toLuaExecucao(quatro().slice(0, 3)), /limit\(4\)/);
    assert.throws(() => toLuaExecucao(quatro().slice(0, 3)), /rodada_em desc, execucao_id desc, fase asc/);
  });

  it('cinco linhas também explodem — e o conselho é o outro', () => {
    const cinco = quatro();
    assert.throws(() => toLuaExecucao([...cinco, cinco[0]]), /chegaram 5/);
    assert.throws(() => toLuaExecucao([...cinco, cinco[0]]), /duas execuções juntas/);
  });

  it('fase repetida: explode pelo nome da fase', () => {
    const rs = quatro();
    rs[3] = { ...rs[3], fase: rs[0].fase };
    assert.throws(() => toLuaExecucao(rs), /a fase "new" veio duas vezes/);
  });

  /**
   * O banco não cobra que as colunas de execução concordem entre as quatro linhas —
   * cobrar exigiria um `having` sobre valores nulos, cuja semântica de `distinct` é
   * uma armadilha, e um erro ali custaria uma segunda janela de migração. A
   * conferência mora aqui, que é onde a discordância produziria a mentira.
   */
  it('linhas que discordam sobre o próprio acervo: explode', () => {
    const rs = quatro();
    rs[2] = { ...rs[2], acervo_noites: 280 };
    assert.throws(() => toLuaExecucao(rs), /discordam sobre a própria execução/);
  });

  it('veredito que o CHECK afirma impossível: explode na fronteira, sem cast', () => {
    const rs = quatro();
    rs[0] = { ...rs[0], veredito: 'talvez' };
    assert.throws(() => toLuaExecucao(rs), /lua_execucoes\.veredito com valor desconhecido/);
  });

  it('unidade do que falta fora da lista: explode', () => {
    const rs = quatro();
    rs[0] = { ...rs[0], falta_quanto: 3, falta_unidade: 'noites' };
    assert.throws(() => toLuaExecucao(rs), /lua_execucoes\.falta_unidade com valor desconhecido/);
  });

  /** O "1 dias" da story 2.8, do outro lado: número sem unidade não se imprime. */
  it('meia falta — número sem unidade, ou unidade sem número: explode', () => {
    const semUnidade = quatro();
    semUnidade[0] = { ...semUnidade[0], falta_quanto: 7, falta_unidade: null };
    assert.throws(() => toLuaExecucao(semUnidade), /meia falta/);

    const semNumero = quatro();
    semNumero[0] = { ...semNumero[0], falta_quanto: null, falta_unidade: 'ciclos' };
    assert.throws(() => toLuaExecucao(semNumero), /meia falta/);
  });

  /**
   * O CHECK da coluna só cobra "array com ao menos `CADEIA_MINIMA` elos": a **forma**
   * de cada elo é conferida aqui. Um elo sem arquivo chegaria à página como um item
   * de lista vazio, e a página existe justamente para dizer quais documentos
   * autorizaram a execução.
   *
   * As listas têm quatro elos porque o piso é quatro: com uma lista de um, o erro que
   * dispara é o do piso, e este caso deixaria de medir a forma do elo.
   */
  it('elo torto na cadeia: explode nomeando a posição', () => {
    const bons = CADEIA_DO_PRE_REGISTRO.map((e) => ({ ...e }));
    for (const torto of [
      { arquivo: '', sha256: 'a'.repeat(64) },
      { arquivo: 'x.md', sha256: 'curto' },
      { arquivo: 'x.md', sha256: 'A'.repeat(64) },
      { arquivo: 'x.md' },
      'x.md',
      null,
    ]) {
      const cadeia = [torto, ...bons.slice(1)];
      const rs = quatro().map((r) => ({ ...r, cadeia: cadeia as never }));
      assert.throws(
        () => toLuaExecucao(rs),
        /cadeia tem elo torto na posição 0/,
        `passou com ${JSON.stringify(torto)}`,
      );
    }
  });

  /**
   * **O piso é o do CHECK, e não "lista não vazia".**
   *
   * `lua_execucoes.cadeia` exige `CADEIA_MINIMA` elos. Um tradutor que aceitasse uma
   * lista de um estaria aceitando uma linha que o banco afirma não existir — e ela só
   * pode ter vindo de um caminho que não é esta porta, que é exatamente quando a
   * conferência serve para alguma coisa.
   */
  it(`cadeia com menos de ${CADEIA_MINIMA} elos: explode, porque o CHECK exige ${CADEIA_MINIMA}`, () => {
    for (let n = 0; n < CADEIA_MINIMA; n += 1) {
      const curta = CADEIA_DO_PRE_REGISTRO.slice(0, n).map((e) => ({ ...e }));
      const rs = quatro().map((r) => ({ ...r, cadeia: curta as never }));
      assert.throws(
        () => toLuaExecucao(rs),
        new RegExp(`cadeia não é uma lista de ao menos ${CADEIA_MINIMA} documentos`),
        `passou com ${n} elo(s)`,
      );
    }
  });

  it('cadeia que não é lista: explode', () => {
    const rs = quatro().map((r) => ({ ...r, cadeia: {} as never }));
    assert.throws(() => toLuaExecucao(rs), /cadeia não é uma lista de ao menos/);
  });

  /**
   * **`cadeia` e `cadeia_digest` são a mesma afirmação em duas formas, e ninguém as
   * confrontava.**
   *
   * A lista é a resposta longa — *quais documentos autorizaram isto* — e o digest é a
   * curta, a que se compara entre duas execuções. Uma cadeia alterada depois do fato
   * ficava ao lado do digest da cadeia original, e o digest dizia que estava tudo
   * igual: a forma curta afirmando o contrário da longa, sem que nada acusasse.
   */
  it('digest que não é o da cadeia gravada ao lado: explode', () => {
    const outra = CADEIA_DO_PRE_REGISTRO.map((e) => ({ ...e }));
    outra[2] = { ...outra[2], sha256: 'b'.repeat(64) };
    const rs = quatro().map((r) => ({ ...r, cadeia: outra as never }));
    assert.throws(() => toLuaExecucao(rs), /não é o da cadeia gravada ao lado/);

    // E o caminho feliz: a cadeia de verdade bate com o digest de verdade.
    assert.equal(toLuaExecucao(quatro()).cadeiaDigest, DIGEST_DA_CADEIA);
  });

  it('coluna nullable que chegou undefined (ninguém a pediu): explode em vez de virar nulo', () => {
    const rs = quatro();
    rs[0] = { ...rs[0], direcao: undefined as unknown as null };
    assert.throws(() => toLuaExecucao(rs), /lua_execucoes\.direcao com valor desconhecido/);
  });
});

/* ─────────────────── As noites que alimentam o motor ─────────────────── */

describe('noitesLunaresDe — uma linha por noite, pela regra declarada', () => {
  /** A linha da matriz, e a decisão que vai escrita na correção de 28/09. */
  it('dois períodos no mesmo wakeDay: uma noite, pelo onset_at MAIS CEDO', () => {
    const ns = noitesLunaresDe([
      periodo('2026-03-10', '2026-03-09T23:40:00.000Z'),
      periodo('2026-03-10', '2026-03-10T03:15:00.000Z'),
    ]);
    assert.equal(ns.length, 1);
    assert.equal(ns[0].wakeDay, '2026-03-10');
    assert.equal(ns[0].onsetAt, '2026-03-09T23:40:00.000Z');
  });

  it('a ordem da entrada não muda a escolha — o mais cedo vence em qualquer ordem', () => {
    const tarde = periodo('2026-03-10', '2026-03-10T03:15:00.000Z');
    const cedo = periodo('2026-03-10', '2026-03-09T23:40:00.000Z');
    assert.equal(noitesLunaresDe([tarde, cedo])[0].onsetAt, cedo.onsetAt);
    assert.equal(noitesLunaresDe([cedo, tarde])[0].onsetAt, cedo.onsetAt);
  });

  it('sai ordenado por wakeDay, mesmo com a entrada embaralhada', () => {
    const ns = noitesLunaresDe([
      periodo('2026-03-12', '2026-03-11T23:00:00.000Z'),
      periodo('2026-03-10', '2026-03-09T23:00:00.000Z'),
      periodo('2026-03-11', '2026-03-10T23:00:00.000Z'),
    ]);
    assert.deepEqual(ns.map((n) => n.wakeDay), ['2026-03-10', '2026-03-11', '2026-03-12']);
  });

  it('a luz é a do wakeDay, na coordenada da revista, e o fuso atravessa', () => {
    const ns = noitesLunaresDe([periodo('2026-06-21', '2026-06-20T23:00:00.000Z')]);
    assert.equal(ns[0].luzH, daylightHours('2026-06-21', COORDENADA_DA_LUZ));
    assert.equal(ns[0].tzOffset, 120);
  });

  it('coordenada fora do globo: a luz sai nula, e o motor trata isso como portão fechado', () => {
    const ns = noitesLunaresDe([periodo('2026-06-21', '2026-06-20T23:00:00.000Z')], { lat: 200, lon: 0 });
    assert.equal(ns[0].luzH, null);
  });

  it('onsetAt que não é instante: explode aqui, porque sem ele não há "mais cedo"', () => {
    assert.throws(
      () => noitesLunaresDe([periodo('2026-03-10', 'ontem à noite')]),
      /onsetAt não é um instante/,
    );
  });

  it('acervo vazio é lista vazia, não erro', () => {
    assert.deepEqual(noitesLunaresDe([]), []);
  });

  /**
   * O motor **recusa** `wakeDay` repetido, e é por isso que o colapso não é
   * opcional: sem ele, a duplicata entraria nas duas colunas contando como
   * informação nova e **inflaria o poder**.
   */
  it('o que a leitura entrega é aceito pelo motor — nenhum wakeDay repetido', () => {
    const ns = noitesLunaresDe([
      periodo('2026-03-10', '2026-03-09T23:40:00.000Z'),
      periodo('2026-03-10', '2026-03-10T03:15:00.000Z'),
      periodo('2026-03-11', '2026-03-10T23:10:00.000Z'),
    ]);
    const v = vereditoLunar(ns);
    assert.equal(v.acervo.noites, 2);
    assert.equal(v.acervo.noitesDistintas, 2);
  });
});

describe('fetchNoitesLunares', () => {
  it('lê pelo módulo dono de sleep_periods, com o dono e o desde no filtro', async () => {
    const f = fakeSono([periodo('2026-03-10', '2026-03-09T23:40:00.000Z')]);
    const ns = await fetchNoitesLunares(f.db, 'u-1', '2025-04-23');
    assert.equal(f.capturado.tabela, 'sleep_periods');
    assert.equal(f.capturado.filtros.user_id, 'u-1');
    assert.equal(f.capturado.filtros['gte:wake_day'], '2025-04-23');
    assert.deepEqual(f.capturado.ordens, ['onset_at']);
    assert.equal(ns.length, 1);
  });

  it('colapsa a noite de dois períodos que vem do banco', async () => {
    const f = fakeSono([
      periodo('2026-03-10', '2026-03-10T03:15:00.000Z'),
      periodo('2026-03-10', '2026-03-09T23:40:00.000Z'),
      periodo('2026-03-11', '2026-03-10T23:10:00.000Z'),
    ]);
    const ns = await fetchNoitesLunares(f.db, 'u-1', '2025-04-23');
    assert.deepEqual(ns.map((n) => n.wakeDay), ['2026-03-10', '2026-03-11']);
    assert.equal(ns[0].onsetAt, '2026-03-09T23:40:00.000Z');
  });

  it('o desde recorta: noite anterior a ele não entra', async () => {
    const f = fakeSono([
      periodo('2025-01-01', '2024-12-31T23:00:00.000Z'),
      periodo('2026-03-10', '2026-03-09T23:40:00.000Z'),
    ]);
    const ns = await fetchNoitesLunares(f.db, 'u-1', '2025-04-23');
    assert.deepEqual(ns.map((n) => n.wakeDay), ['2026-03-10']);
  });
});

/* ─────────────────── O protocolo, como ele chega aqui ─────────────────── */

describe('o protocolo é dado, e esta porta não o decide', () => {
  it('as quatro fases do protocolo são as quatro da efeméride, na ordem da lunação', () => {
    assert.deepEqual(PROTOCOLO_LUNAR.map((l) => l.fase), [...PHASE_ORDER]);
  });

  it('a cheia é família própria a 5%, e as três dividem 5%/3 — e as listas saem disso', () => {
    const cheia = PROTOCOLO_LUNAR.find((l) => l.fase === 'full')!;
    assert.equal(cheia.familia, 'cheia');
    assert.equal(cheia.alfa, 0.05);
    assert.equal(cheia.lateralidade, 'unilateral');
    for (const l of PROTOCOLO_LUNAR.filter((x) => x.fase !== 'full')) {
      assert.equal(l.familia, 'as-tres');
      assert.equal(l.alfa, 0.05 / 3);
      assert.equal(l.lateralidade, 'bilateral');
      assert.equal(l.direcao, null);
    }
    assert.deepEqual([...VOCABULARIO_DE_LUA_EXECUCOES.familia], ['as-tres', 'cheia']);
    assert.deepEqual([...VOCABULARIO_DE_LUA_EXECUCOES.lateralidade], ['bilateral', 'unilateral']);
    assert.deepEqual([...VOCABULARIO_DE_LUA_EXECUCOES.direcao], ['atraso']);
  });
});
