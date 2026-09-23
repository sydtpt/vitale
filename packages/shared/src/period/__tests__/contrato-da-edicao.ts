/**
 * O contrato da edição — a fixture que o núcleo, o celular e o script imprimem, e o
 * gabarito que os três têm de bater (Story 2.2, AD-11).
 *
 * **Um gabarito só para os dois hospedeiros.** O valor dele não está nos números:
 * está em ser o MESMO. Ele foi fixado da primeira execução do núcleo, e mudá-lo é
 * ato deliberado, como o golden de `ia/pacote.test.ts` — muda quando o prompt, o
 * pacote, a conferência ou a versão da agregação mudam, e nesse commit o motivo tem
 * de estar escrito. Se o celular deixar de cortar a janela, ou o script esquecer as
 * atividades ocultas, a entrada dele deixa de ser a do núcleo e o teste daquele
 * lado fica vermelho.
 *
 * O que mora aqui:
 *
 * - **o acervo**: um mês fechado (maio/2026) e o que o cerca, **sintético** — nenhum
 *   número de saúde real. Tem dado antes da janela da edição (janeiro a março),
 *   para a janela larga ter o que mudar, e uma atividade **oculta** no mês, para o
 *   `hidden` ter o que tirar;
 * - **um banco falso** que responde as leituras de `data/` (as nove da
 *   Retrospectiva, as atividades, a edição), a sessão, e captura a carga do `rpc`
 *   — simulando a função `edicao_imprimir` para a releitura sair do que foi gravado;
 * - **um transporte falso** da nuvem, que responde por caderno: três textos que a
 *   conferência aprova e um que cita um número que não existe no pacote;
 * - **o gabarito**: o hash do pedido de cada caderno e a carga do `rpc`.
 *
 * **Robusto a `TZ`.** O relógio é dado em componentes locais, e todo instante do
 * acervo fica longe da meia-noite (11:00 UTC): o dia local de cada um é o mesmo de
 * UTC−11 a UTC+12. As noites carregam o próprio `tz_offset`, e o sono não lê o fuso
 * do processo. É o que deixa o gabarito valer no CI (UTC) e em Bruxelas.
 *
 * Fica em `__tests__/`: as barreiras não o varrem como código, e nenhum barril o
 * exporta. O celular e o script o importam por caminho relativo, só nos testes.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { NUVEM_PADRAO, type CorpoDoPedido, type MotorId } from '../../ia/fio';
import type { Motor } from '../../ia/motor';
import { criarMotorDeNuvem, type RespostaDoTransporte, type Transporte } from '../../ia/nuvem';
import type { EventoDoAnel } from '../../ia/orquestrar';
import type { CadernoId } from '../cadernos';

/* ── o período ───────────────────────────────────────────────────────────── */

export const USUARIO = '5a1e7c0e-0000-4000-8000-00000000c0de';

/**
 * Dez de junho de 2026, meio-dia **local**: maio fechou. Componentes locais, e não
 * um instante: o mês que o relógio fecha não pode depender do `TZ` de quem roda.
 */
export const AGORA = new Date(2026, 5, 10, 12, 0, 0);

export const TIPO = 'month' as const;
export const INICIO = '2026-05-01';
export const FIM = '2026-05-31';
/** O `offset` de maio visto de {@link AGORA}. */
export const OFFSET = -1;
/**
 * A janela da edição de maio: o menor entre o início do período anterior (1º de
 * abril) e `AGORA − 90 dias` (12 de março). O teste a confere contra `retroSince`.
 */
export const JANELA = '2026-03-12';
/** Uma janela mais larga — a do Ano, que o celular pode ter carregado antes. */
export const JANELA_LARGA = '2025-01-01';

/* ── o acervo ────────────────────────────────────────────────────────────── */

/** O primeiro e o último dia do acervo: janeiro a véspera de {@link AGORA}. */
const PRIMEIRO_DIA = '2026-01-05';
const ULTIMO_DIA = '2026-06-09';

/** Os dias de `de` a `ate`, inclusive — pela meia-noite UTC dos componentes, sem fuso. */
function dias(de: string, ate: string): string[] {
  const out: string[] = [];
  const [a, m, d] = de.split('-').map(Number);
  for (let t = Date.UTC(a, m - 1, d); ; t += 86_400_000) {
    const dia = new Date(t).toISOString().slice(0, 10);
    if (dia > ate) return out;
    out.push(dia);
  }
}

/** O dia seguinte/anterior, sem fuso. */
function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Um instante do dia, em UTC — 11:00 por padrão, longe da meia-noite de qualquer fuso comum. */
function as(dia: string, hhmm = '11:00'): string {
  return `${dia}T${hhmm}:00+00:00`;
}

/** Soma minutos a um instante ISO e devolve no mesmo formato do PostgREST. */
function mais(iso: string, minutos: number): string {
  return new Date(Date.parse(iso) + minutos * 60_000).toISOString().replace('.000Z', '+00:00');
}

type Linha = Record<string, unknown>;

const DIAS = dias(PRIMEIRO_DIA, ULTIMO_DIA);
/** O índice do dia no acervo — a semente de cada valor sintético. */
const I = new Map(DIAS.map((d, i) => [d, i]));
const i = (dia: string): number => I.get(dia)!;

function saudeDiaria(): Linha[] {
  const out: Linha[] = [];
  for (const d of DIAS) {
    const k = i(d);
    const emMaio = d >= '2026-05-01' && d <= '2026-05-31';
    const valores: Record<string, number> = {
      sono: Math.round((6.2 + ((k * 7) % 13) / 10 + (emMaio ? 0.3 : 0)) * 10) / 10,
      vfc: 38 + ((k * 5) % 17),
      fcRepouso: 49 + ((k * 3) % 7) - (emMaio ? 2 : 0),
      passos: 6000 + ((k * 733) % 5000),
      andares: 3 + (k % 11),
    };
    for (const [metric, value] of Object.entries(valores)) {
      // O PostgREST devolve `numeric` como texto: a leitura tem de converter.
      out.push({ user_id: USUARIO, day: d, metric, value: String(value), min_value: null, max_value: null, count: 1, extra: null });
    }
  }
  return out;
}

function notas(): Linha[] {
  return DIAS.filter((d) => i(d) % 3 !== 0).map((d) => ({
    user_id: USUARIO,
    day: d,
    sleep_quality: 1 + (i(d) % 5),
    day_quality: 1 + ((i(d) * 2) % 5),
    day_note: null,
  }));
}

/** O dia em que o hábito de alongar nasceu — **depois** do fim da edição de maio. */
export const NASCEU_DEPOIS_DE_MAIO = '2026-06-01';

const HABITOS: Linha[] = [
  { id: 'h-cerveja', user_id: USUARIO, name: 'Cerveja', bad: true, unit: 'L', created_at: as('2025-11-15'), unit_price: '11' },
  { id: 'h-leitura', user_id: USUARIO, name: 'Leitura', bad: false, unit: 'min', created_at: as('2025-12-01'), unit_price: null },
  // Nasceu depois do fim de maio, e é marcado desde então: em maio não houve "0
  // dias de alongamento" — não havia hábito. É o fato de contagem ANTERIOR AO
  // MARCO (Story 2.6), e o contrato prova o não medido de ponta a ponta com ele:
  // a linha do hábito chega ao resumo, vira fato sem número, some do prompt e não
  // entra no alfabeto da conferência.
  { id: 'h-alongar', user_id: USUARIO, name: 'Alongar', bad: false, unit: 'min', created_at: as(NASCEU_DEPOIS_DE_MAIO), unit_price: null },
];

function logsDeHabito(): Linha[] {
  const out: Linha[] = [];
  for (const d of DIAS) {
    const k = i(d);
    if (k % 4 === 0) out.push({ id: `hl-cerveja-${d}`, user_id: USUARIO, habit_id: 'h-cerveja', log_date: d, value: k % 8 === 0 ? '1' : '0.5' });
    if (k % 2 === 0) out.push({ id: `hl-leitura-${d}`, user_id: USUARIO, habit_id: 'h-leitura', log_date: d, value: String(20 + (k % 3) * 10) });
    if (d >= NASCEU_DEPOIS_DE_MAIO) out.push({ id: `hl-alongar-${d}`, user_id: USUARIO, habit_id: 'h-alongar', log_date: d, value: '10' });
  }
  return out;
}

const REGISTROS: Linha[] = [
  { id: 'r-dor', user_id: USUARIO, name: 'Dor de cabeça', created_at: as('2025-10-01') },
];

function logsDeRegistro(): Linha[] {
  return DIAS.filter((d) => i(d) % 9 === 0).map((d) => ({ id: `rl-dor-${d}`, user_id: USUARIO, registro_id: 'r-dor', log_date: d }));
}

const TODO_DIA = { kind: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] };

const SERIES: Linha[] = [
  { id: 't-louca', user_id: USUARIO, name: 'Lavar a louça', module: 'casa', meta: null, recurrence: TODO_DIA, created_at: as('2025-12-10'), active: true },
  { id: 't-aluguel', user_id: USUARIO, name: 'Pagar o aluguel', module: 'financas', meta: null, recurrence: { kind: 'monthly', day: 5 }, created_at: as('2025-12-10'), active: true },
  { id: 't-pao', user_id: USUARIO, name: 'Comprar pão', module: 'compras', meta: { cat: 'Padaria', price: 3 }, recurrence: { kind: 'weekly', weekdays: [1, 4] }, created_at: as('2025-12-10'), active: true },
  // Nasceu em abril: a faixa de adesão não cobra os dias de antes.
  { id: 't-vitamina', user_id: USUARIO, name: 'Tomar vitamina D', module: 'saude', meta: null, recurrence: TODO_DIA, created_at: as('2026-04-15'), active: true },
];

function ocorrencias(): Linha[] {
  const out: Linha[] = [];
  const feita = (serie: string, d: string): Linha => ({
    id: `o-${serie}-${d}`, user_id: USUARIO, template_id: serie, due_date: d, status: 'done',
    done_at: as(d), created_at: as(d, '06:00'), meta: null,
  });
  for (const d of DIAS) {
    const k = i(d);
    const semana = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (k % 3 !== 1) out.push(feita('t-louca', d));
    if (d.endsWith('-05')) out.push(feita('t-aluguel', d));
    if ((semana === 1 || semana === 4) && k % 2 === 0) out.push(feita('t-pao', d));
    if (d >= '2026-04-15' && k % 5 !== 0) out.push(feita('t-vitamina', d));
  }
  // Uma pendente, que a leitura das concluídas não pode trazer.
  out.push({ id: 'o-louca-pendente', user_id: USUARIO, template_id: 't-louca', due_date: ULTIMO_DIA, status: 'pending', done_at: null, created_at: as(ULTIMO_DIA, '06:00'), meta: null });
  return out;
}

/**
 * As noites. As de antes da janela são **mais curtas e mais tardias** — é o que faz
 * a janela larga mudar a linha de base e o quadro de gatilhos do Sono, que leem
 * todas as noites carregadas, se o corte não acontecer.
 */
function noites(): Linha[] {
  const out: Linha[] = [];
  for (const d of DIAS) {
    const k = i(d);
    if (k % 10 === 7) continue; // noite sem relógio
    const antiga = d < JANELA;
    const vespera = somarDias(d, -1);
    const onset = mais(as(vespera, antiga ? '23:40' : '21:30'), (k * 13) % 90);
    const wake = mais(as(d, antiga ? '04:10' : '05:00'), (k * 7) % 60);
    const acordado = k % 4 === 0 ? 12 : 0;
    const asleepH = Math.round(((Date.parse(wake) - Date.parse(onset)) / 3_600_000 - acordado / 60) * 100) / 100;
    out.push({
      user_id: USUARIO,
      onset_at: onset,
      wake_at: wake,
      in_bed_at: mais(onset, -10),
      in_bed_end: mais(wake, 5),
      tz_offset: 120,
      wake_day: d,
      asleep_h: String(asleepH),
      awakenings: acordado > 0 ? [{ from: mais(onset, 150), to: mais(onset, 150 + acordado) }] : [],
      stages: null,
      stage_segments: null,
      source: 'Relógio sintético',
    });
  }
  return out;
}

function atividade(id: string, dia: string, tipo: number, distanciaM: number | null, duracaoS: number, extra: Linha = {}): Linha {
  const inicio = as(dia);
  return {
    id,
    user_id: USUARIO,
    activity_id: tipo,
    activity_name: null,
    calories: String(300 + (i(dia) * 17) % 400),
    start_at: inicio,
    end_at: mais(inicio, Math.round(duracaoS / 60)),
    duration_s: String(duracaoS),
    moving_time_s: String(duracaoS - 120),
    distance_m: distanciaM === null ? null : String(distanciaM),
    elevation_m: distanciaM === null ? null : String(Math.round(distanciaM / 250)),
    source_name: 'Relógio sintético',
    source_id: null,
    device: null,
    tracked: true,
    has_route: false,
    best_efforts: null,
    hr_zones: null,
    calories_estimated: false,
    hr_zones_estimated: false,
    cities: null,
    locally_edited: false,
    edited_at: null,
    hidden: false,
    gear_id: null,
    surface_mix: null,
    photos_checked_at: null,
    route_name: null,
    route_name_meta: null,
    name_edited: false,
    ...extra,
  };
}

/** HealthKit: 13 é ciclismo, 37 é corrida, 57 é ioga (sem distância). */
function atividades(): Linha[] {
  const out: Linha[] = [];
  for (const d of DIAS) {
    const k = i(d);
    if (k % 3 !== 0) continue;
    const tipo = [13, 37, 57][(k / 3) % 3];
    if (tipo === 13) out.push(atividade(`a-${d}`, d, 13, 25_000 + ((k * 997) % 20_000), 3600 + ((k * 61) % 1800)));
    else if (tipo === 37) out.push(atividade(`a-${d}`, d, 37, 5000 + ((k * 331) % 5000), 1800 + ((k * 29) % 900)));
    else out.push(atividade(`a-${d}`, d, 57, null, 2700));
  }
  // A oculta: uma pedalada de 180 km no meio de maio, que o dono tirou da análise.
  // Se entrar, o Movimento de maio muda — e é para isso que ela está aqui.
  out.push(atividade('a-oculta', '2026-05-20', 13, 180_000, 7 * 3600, { hidden: true }));
  return out;
}

/* ── o banco falso ───────────────────────────────────────────────────────── */

/** O `gerado_em` que a função falsa carimba — fixo, para a releitura ser determinística. */
export const GERADO_EM = '2026-06-10T10:00:00+00:00';

/** Compara um valor da tabela com o de um filtro, como o Postgres: instante com instante, texto com texto. */
function comparar(valor: unknown, filtro: unknown): number {
  if (typeof valor === 'string' && typeof filtro === 'string' && valor.includes('T') && filtro.includes('T')) {
    // O literal sem fuso é lido no fuso da sessão do PostgREST — UTC no Supabase.
    const comFuso = /(?:[zZ]|[+-]\d\d:?\d\d)$/.test(filtro) ? filtro : `${filtro}Z`;
    return Date.parse(valor) - Date.parse(comFuso);
  }
  if (typeof valor === 'number' && typeof filtro === 'number') return valor - filtro;
  const a = String(valor);
  const b = String(filtro);
  return a < b ? -1 : a > b ? 1 : 0;
}

type Resposta = { data: unknown; error: unknown };

/** Uma consulta encadeável — o subconjunto do PostgREST que `data/` usa nestas leituras. */
class Consulta implements PromiseLike<Resposta> {
  private colunas: string[] | null = null;
  private readonly filtros: ((l: Linha) => boolean)[] = [];
  private readonly ordens: [string, boolean][] = [];
  private faixa: [number, number] | null = null;

  /** `erro`: a consulta responde `{ data: null, error }`, como o PostgREST quando a leitura falha. */
  constructor(private readonly linhas: readonly Linha[], private readonly erro: Error | null = null) {}

  select(cols?: string): this {
    this.colunas = cols && cols.trim() !== '*' ? cols.split(',').map((c) => c.trim()).filter(Boolean) : null;
    return this;
  }
  eq(col: string, v: unknown): this {
    this.filtros.push((l) => l[col] === v);
    return this;
  }
  gte(col: string, v: unknown): this {
    this.filtros.push((l) => l[col] != null && comparar(l[col], v) >= 0);
    return this;
  }
  lte(col: string, v: unknown): this {
    this.filtros.push((l) => l[col] != null && comparar(l[col], v) <= 0);
    return this;
  }
  order(col: string, opcoes?: { ascending?: boolean }): this {
    this.ordens.push([col, opcoes?.ascending !== false]);
    return this;
  }
  range(de: number, ate: number): this {
    this.faixa = [de, ate];
    return this;
  }

  private resolver(): Resposta {
    if (this.erro !== null) return { data: null, error: this.erro };
    let out = this.linhas.filter((l) => this.filtros.every((f) => f(l)));
    if (this.ordens.length > 0) {
      out = [...out].sort((a, b) => {
        for (const [col, asc] of this.ordens) {
          const c = comparar(a[col], b[col]);
          if (c !== 0) return asc ? c : -c;
        }
        return 0;
      });
    }
    if (this.faixa) out = out.slice(this.faixa[0], this.faixa[1] + 1);
    const cols = this.colunas;
    // O PostgREST devolve só o que foi pedido; coluna pedida e ausente na linha é nula.
    const data = cols === null ? out.map((l) => ({ ...l })) : out.map((l) => Object.fromEntries(cols.map((c) => [c, l[c] ?? null])));
    return { data, error: null };
  }

  then<A = Resposta, B = never>(
    ok?: ((r: Resposta) => A | PromiseLike<A>) | null,
    falha?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.resolver()).then(ok, falha);
  }
}

/** O que o `rpc('edicao_imprimir', …)` recebeu — a carga que o gabarito fixa. */
export interface CargaDoRpc {
  readonly p_tipo_periodo: string;
  readonly p_inicio: string;
  readonly p_fim: string;
  readonly p_ordem: readonly string[];
  readonly p_linhas: readonly Record<string, unknown>[];
}

/** As tabelas que a fixture tem — as nove leituras, as atividades e a edição. `edicoes_capa` não: o script não a toca. */
export type TabelaDaFixture =
  | 'health_daily' | 'daily_ratings' | 'habits' | 'habit_logs' | 'registros' | 'registro_logs'
  | 'todo_templates' | 'todo_occurrences' | 'sleep_periods' | 'activities' | 'edicoes_ia';

export interface BancoFalso {
  /** O client, para as leituras de `data/` e para `portasDaEdicao`. */
  readonly db: SupabaseClient;
  /** As tabelas, mutáveis — `edicoes_ia` é o que um teste mexe para simular outro hospedeiro. */
  readonly tabelas: Readonly<Record<TabelaDaFixture, Linha[]>>;
  /** Cada chamada ao `rpc`, na ordem. */
  readonly rpcs: { readonly fn: string; readonly args: CargaDoRpc }[];
  /** Quantas vezes cada tabela foi lida. */
  readonly leituras: Record<string, number>;
}

/** As opções do banco falso. */
export interface OpcoesDoBanco {
  /** A edição de maio que já está impressa. Ausente: nenhuma. */
  readonly edicao?: Linha[];
  /** De quem é a sessão do client. Ausente: {@link USUARIO}; `null`: ninguém. */
  readonly dono?: string | null;
  /** As tabelas cuja leitura falha — o `select` delas responde `{ data: null, error }`. */
  readonly falhar?: Partial<Record<TabelaDaFixture, Error>>;
  /**
   * Chamado a cada `select`, com a tabela e quantas vezes ela já foi lida (contando
   * esta). É por ele que um teste faz outro hospedeiro gravar **entre** duas leituras.
   */
  readonly aoLer?: (tabela: TabelaDaFixture, vez: number, tabelas: Readonly<Record<TabelaDaFixture, Linha[]>>) => void;
}

/**
 * O banco da fixture: o acervo inteiro, a edição de maio (vazia, ou a dada), e a
 * sessão de `dono`.
 *
 * `rpc('edicao_imprimir')` faz o que a função faz com a tabela — grava o texto dos
 * regenerados, mantém o dos outros cadernos da ordem, ajusta `posicao` e apaga quem
 * saiu — e devolve a edição relida. Escrever na tabela por outro caminho explode.
 */
export function bancoFalso(o: OpcoesDoBanco = {}): BancoFalso {
  const tabelas: Record<TabelaDaFixture, Linha[]> = {
    health_daily: saudeDiaria(),
    daily_ratings: notas(),
    habits: HABITOS.map((h) => ({ ...h })),
    habit_logs: logsDeHabito(),
    registros: REGISTROS.map((r) => ({ ...r })),
    registro_logs: logsDeRegistro(),
    todo_templates: SERIES.map((s) => ({ ...s })),
    todo_occurrences: ocorrencias(),
    sleep_periods: noites(),
    activities: atividades(),
    edicoes_ia: [...(o.edicao ?? [])],
  };
  const rpcs: { fn: string; args: CargaDoRpc }[] = [];
  const leituras: Record<string, number> = {};
  const dono = o.dono === undefined ? USUARIO : o.dono;
  const escritaDireta = (tabela: string) => () => {
    throw new Error(`o teste escreveu em ${tabela} direto — a edição se grava pela função, e o acervo não se grava daqui`);
  };

  const db = {
    auth: {
      getSession: async () => ({ data: { session: dono === null ? null : { user: { id: dono } } }, error: null }),
    },
    from(tabela: string) {
      const linhas = Object.prototype.hasOwnProperty.call(tabelas, tabela) ? tabelas[tabela as TabelaDaFixture] : undefined;
      if (!linhas) throw new Error(`tabela que a fixture não tem: ${tabela}`);
      return {
        select: (cols?: string) => {
          const vez = (leituras[tabela] ?? 0) + 1;
          leituras[tabela] = vez;
          o.aoLer?.(tabela as TabelaDaFixture, vez, tabelas);
          return new Consulta(linhas, o.falhar?.[tabela as TabelaDaFixture] ?? null).select(cols);
        },
        upsert: escritaDireta(tabela),
        insert: escritaDireta(tabela),
        update: escritaDireta(tabela),
        delete: escritaDireta(tabela),
      };
    },
    async rpc(fn: string, args: CargaDoRpc) {
      rpcs.push({ fn, args: JSON.parse(JSON.stringify(args)) as CargaDoRpc });
      if (fn !== 'edicao_imprimir') throw new Error(`rpc que a fixture não conhece: ${fn}`);
      const doPeriodo = (l: Linha) =>
        l['user_id'] === dono && l['tipo_periodo'] === args.p_tipo_periodo && l['inicio'] === args.p_inicio && l['fim'] === args.p_fim;
      const antes = tabelas.edicoes_ia.filter(doPeriodo);
      const novas = new Map(args.p_linhas.map((l) => [l['caderno'] as string, l]));
      const depois = args.p_ordem.map((caderno, k): Linha => {
        const nova = novas.get(caderno);
        if (nova) {
          return {
            ...nova, user_id: dono, tipo_periodo: args.p_tipo_periodo, inicio: args.p_inicio, fim: args.p_fim,
            posicao: k + 1, gerado_em: GERADO_EM,
          };
        }
        const antiga = antes.find((l) => l['caderno'] === caderno);
        if (!antiga) return { erro: `caderno ${caderno} na ordem sem linha nem texto de antes` };
        return { ...antiga, posicao: k + 1 };
      });
      const recusada = depois.find((l) => 'erro' in l);
      if (recusada) return { data: null, error: new Error(String(recusada['erro'])) };
      // No lugar: quem guardou a referência da tabela continua vendo a tabela.
      const fica = tabelas.edicoes_ia.filter((l) => !doPeriodo(l));
      tabelas.edicoes_ia.splice(0, tabelas.edicoes_ia.length, ...fica, ...depois);
      return { data: depois.map((l) => ({ ...l })), error: null };
    },
  };
  return { db: db as unknown as SupabaseClient, tabelas, rpcs, leituras };
}

/** Uma linha de `edicoes_ia` de maio — para montar "o período já impresso". */
export function cadernoImpressoDeMaio(caderno: CadernoId, posicao: number, extra: Linha = {}): Linha {
  return {
    user_id: USUARIO, tipo_periodo: TIPO, inicio: INICIO, fim: FIM, caderno, posicao,
    texto: `texto antigo de ${caderno}`, provedor: 'provedor-de-antes', modelo: 'modelo-de-antes',
    prompt_versao: 1, pacote_versao: 1, motivo_de_parada: 'STOP', tokens_entrada: 10, tokens_saida: 5,
    agg_version_no_momento: 1, metrica_lider: null, gerado_em: '2026-06-02T08:00:00+00:00',
    ...extra,
  };
}

/* ── a nuvem falsa ───────────────────────────────────────────────────────── */

export const PROVEDOR = 'provedor-sintetico';
export const MODELO = 'modelo-sintetico-1';

/**
 * O que a nuvem escreve para cada caderno. Três passam na conferência do pacote
 * deles; o Coração cita 47 ms de VFC, que não é número nenhum do pacote de maio —
 * e é reprovado, não entra nas linhas, e não ganha posição.
 */
export const TEXTOS: Readonly<Record<CadernoId, string>> = {
  movimento: 'Foram 164 km em maio, contra 132 km em abril.',
  rotina: 'Foram 51 tarefas concluídas, contra 37 em abril.',
  sono: 'O sono ficou em 7,1 h, contra 6,8 h em abril.',
  coracao: 'A VFC ficou em 47 ms, contra 46 ms em abril.',
};

const TOKENS: Readonly<Record<CadernoId, { entrada: number; saida: number }>> = {
  sono: { entrada: 1101, saida: 101 },
  movimento: { entrada: 1202, saida: 102 },
  coracao: { entrada: 1303, saida: 103 },
  rotina: { entrada: 1404, saida: 104 },
};

const ROTULO: Readonly<Record<string, CadernoId>> = {
  Sono: 'sono', Movimento: 'movimento', 'Coração': 'coracao', Rotina: 'rotina',
};

/** O caderno de um pedido — o prompt diz qual está escrevendo. */
export function cadernoDoCorpo(corpo: Pick<CorpoDoPedido, 'usuario'>): CadernoId | null {
  const rotulo = /Escreva o caderno (\S+)\./.exec(corpo.usuario)?.[1];
  return rotulo === undefined ? null : ROTULO[rotulo] ?? null;
}

/**
 * O transporte da nuvem da fixture: um 200 da `ia-narrar` por caderno, no formato
 * do fio (`CorpoDaResposta`). `aoPedir` é chamado antes de responder — é por ele que
 * um teste faz outro hospedeiro gravar no meio da impressão.
 */
export function transporteDaFixture(o: { aoPedir?: (caderno: CadernoId | null) => void } = {}): Transporte {
  return async (corpo: CorpoDoPedido): Promise<RespostaDoTransporte> => {
    const caderno = cadernoDoCorpo(corpo);
    o.aoPedir?.(caderno);
    if (caderno === null) return { status: 400, corpo: { classe: 'capacidade', detalhe: 'pedido sem caderno' } };
    return {
      status: 200,
      corpo: { texto: TEXTOS[caderno], provedor: PROVEDOR, modelo: MODELO, motivoDeParada: 'STOP', tokens: TOKENS[caderno] },
    };
  };
}

/** O `motorPara` da fixture: a nuvem padrão, e mais nada — como o celular sem preferência. */
export function motorParaDaFixture(transporte: Transporte = transporteDaFixture()): (id: MotorId) => Motor | undefined {
  const nuvem = criarMotorDeNuvem(transporte);
  return (id) => (id === NUVEM_PADRAO ? nuvem : undefined);
}

/* ── os hashes ───────────────────────────────────────────────────────────── */

/**
 * O hash do pedido de cada caderno, como os hospedeiros o veem: o anel recebe um
 * evento por leitura, e o `aoComecar` da sequência diz de que caderno ele é.
 */
export function coletorDeHashes(): {
  readonly aoComecar: (caderno: CadernoId) => void;
  readonly registrar: (evento: EventoDoAnel) => void;
  readonly hashes: Partial<Record<CadernoId, string>>;
} {
  const hashes: Partial<Record<CadernoId, string>> = {};
  let atual: CadernoId | null = null;
  return {
    aoComecar: (caderno) => {
      atual = caderno;
    },
    registrar: (evento) => {
      if (atual !== null && evento.hash !== undefined) hashes[atual] = evento.hash;
    },
    hashes,
  };
}

/* ── o gabarito ──────────────────────────────────────────────────────────── */

/** Uma linha da carga, como a fixture a espera — a assinatura inteira, e o texto. */
function linhaDaCarga(caderno: CadernoId, metricaLider: string | null): Record<string, unknown> {
  return {
    caderno,
    texto: TEXTOS[caderno],
    provedor: PROVEDOR,
    modelo: MODELO,
    prompt_versao: 5,
    pacote_versao: 4,
    motivo_de_parada: 'STOP',
    tokens_entrada: TOKENS[caderno].entrada,
    tokens_saida: TOKENS[caderno].saida,
    agg_version_no_momento: 9,
    metrica_lider: metricaLider,
  };
}

/**
 * O que a impressão de maio tem de dar, em qualquer hospedeiro. Fixado da primeira
 * execução do núcleo (22/09/2026, `period/retro-dados.test.ts`) e **refixado em
 * 23/09/2026** pela Story 2.6; ver o cabeçalho antes de mudar.
 *
 * - **Os hashes** são do pedido pleno de cada caderno (AD-11), os quatro — o
 *   Coração também, porque o pedido dele saiu e foi pago; só o texto reprovou.
 * - **A carga** é o que chega à função `edicao_imprimir`: a ordem do ranqueamento
 *   sem o Coração (reprovado não tem linha nem posição), e as três linhas com a
 *   assinatura inteira — provedor, modelo, `prompt_versao` 5, `pacote_versao` 4 e
 *   a `agg_version_no_momento` 9, carimbada pela porta.
 *
 * - **Os textos** são o sha256 do `usuario` de cada caderno — o **texto** do
 *   pedido, sozinho. Ele existe porque `hashes` mistura duas coisas: o texto e a
 *   versão do descritor. Quem subir a versão e mudar o texto no mesmo commit
 *   acerta o `hashes` novo e não é acusado de nada; com `textos` ao lado, a
 *   mudança de texto aparece sozinha. Um caderno mudo (nenhum aqui) não teria
 *   texto — por isso o campo cobre os quatro e a asserção cobra os quatro.
 *
 * **Por que mudou em 23/09** (Story 2.6): `PACOTE_VERSAO` foi de 3 para 4, e a
 * versão do descritor (`PROMPT_VERSAO × 1000 + PACOTE_VERSAO`) entra no hash do
 * pedido. O **texto** do prompt de maio não mudou um byte: todo marco da fixture
 * é anterior a maio, e o hábito que nasceu depois dele (`h-alongar`) entra no
 * pacote sem número e por isso não aparece no prompt. Isso deixou de ser prosa
 * medida à mão — é o que `textos` prende: os quatro sha256 abaixo foram
 * **medidos no commit base** (`448c642`, com a fixture e o `pacote.ts` de antes
 * da 2.6) e são os mesmos de hoje, byte a byte.
 *
 * Os números são **consequência**: mudam quando o prompt (`PROMPT_VERSAO`), o
 * pacote (`PACOTE_VERSAO`), a agregação (`AGG_VERSION`) ou o ranqueamento mudam, e
 * então este gabarito muda junto, no mesmo commit, com o motivo escrito nele.
 */
export const GABARITO: {
  readonly estado: 'gravada';
  readonly hashes: Readonly<Record<CadernoId, string>>;
  readonly textos: Readonly<Record<CadernoId, string>>;
  readonly carga: CargaDoRpc;
} = {
  estado: 'gravada',
  hashes: {
    rotina: '2f534e41d1043aa468c66a5dcb7d0a12e8b80ee7fd472dca95b67eac30e8334c',
    movimento: 'eaae79309aae17fc51c2aa965df82480287ecd0d04ed05d08ca86b637e74b862',
    sono: '13682b176790ef5c2924dfd443522fc5dda3bb76d50f46d96c5eb41d63393ed1',
    coracao: '8b020f6f7218c3adcf9f39b96c3eb5b983e9d892a1b707f59d67d8314830023b',
  },
  textos: {
    rotina: '4955d2b8836ce40c014a8f8473fd0ec46e0a4f504805da4a25eb4590d9963e79',
    movimento: 'cc47adbe687611fb8d8f53e4f34a22a6d795c01f3ed92e05e5c6052baf7b0354',
    sono: '78596e9ea3900f38401a9467455961b3e435cde6ff3268e8d3fc5ea7d651614c',
    coracao: 'a00f5f9d3663f97c8a6202649f016785ce1532d094ed174d919908d574893e13',
  },
  carga: {
    p_tipo_periodo: TIPO,
    p_inicio: INICIO,
    p_fim: FIM,
    p_ordem: ['rotina', 'movimento', 'sono'],
    p_linhas: [
      linhaDaCarga('rotina', 'tarefas'),
      linhaDaCarga('movimento', 'tempo'),
      linhaDaCarga('sono', 'sono'),
    ],
  },
};
