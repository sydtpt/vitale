/**
 * O pacote de fatos — a entrada única da camada de IA analítica.
 * Spec: docs/specs/ia-analitica/spec.md · ADRs 0038 e 0040.
 *
 * Derivação 100% pura. **Este arquivo, e tudo em `ia/`, nunca importa SDK nem
 * faz rede** — barreira cobrada no `architecture.test.ts`. Se todo provedor de
 * modelo do mundo sumir amanhã, isto continua compilando e passando.
 *
 * A lei que ele materializa (intent de 21/08, §3): **estatística acha; LLM
 * prioriza e narra**. O núcleo monta o pacote; o modelo escolhe qual fato é a
 * manchete e escreve a frase. O modelo nunca calcula, nunca deriva um número
 * que não recebeu pronto, e nunca afirma causa.
 *
 * ## Por que os números vêm prontos para exibição
 *
 * A verificação mecânica da §5 do spec é "todo número citado existe no pacote".
 * Se o pacote guardasse 435000 (metros) e o modelo escrevesse "435 km", a
 * verificação reprovaria uma frase correta. Então a conversão de unidade
 * acontece **aqui, uma vez**: o pacote carrega 435 com `unidade: 'km'` e
 * `casas: 0`, e o modelo só vê a unidade em que vai escrever.
 */
import type { PeriodKind } from '../period/bounds';
import type {
  RetroSummary, RetroHabitRow, RetroRegistroRow, RetroHealthRow, SportStats,
} from '../period/retro';
import type { RecapValue, MetricRecap } from '../week/recap';
import type { MetricImpact } from '../health/trigger-impact';

/** Sobe quando a forma do pacote muda de um jeito que invalida edição gravada. */
export const PACOTE_VERSAO = 1;

/**
 * Um número que o modelo pode citar, já na unidade em que será escrito.
 * `atual`/`anterior` em `null` significam ausência de dado — nunca zero.
 */
export interface FatoNumero {
  chave: string;
  rotulo: string;
  atual: number | null;
  anterior: number | null;
  delta: number | null;
  deltaPct: number | null;
  unidade: string;
  casas: number;
}

/**
 * Quantos dias de cada lado realmente têm dado.
 *
 * Existe por erro conhecido: julho/2026 tem 14 noites no banco e agosto tem 27.
 * Comparar as medianas sem declarar isso é comparar meio mês com um mês inteiro
 * — e o modelo não teria como saber.
 */
export interface Cobertura {
  diasComDado: number;
  diasNoPeriodo: number;
  diasComDadoAnterior: number;
  diasNoPeriodoAnterior: number;
  /**
   * false quando a diferença de cobertura entre os dois lados é grande demais
   * para uma comparação silenciosa. O modelo é obrigado a declarar a ressalva.
   */
  comparavel: boolean;
}

export interface ModuloFatos {
  modulo: string;
  rotulo: string;
  metricas: FatoNumero[];
  cobertura: Cobertura | null;
}

/**
 * Uma correlação já calculada pelo `triggerImpact`, com o portão explícito.
 *
 * `dentroDoPortao` false não some do pacote — vai marcada. O modelo pode ver
 * que existe e **não pode** promovê-la a manchete; a verificação da §5 do spec
 * cobra isso.
 */
export interface CorrelacaoFato {
  gatilho: string;
  metrica: string;
  rotulo: string;
  deltaPct: number | null;
  nCom: number;
  nSem: number;
  dentroDoPortao: boolean;
}

/**
 * O que organiza o período e não aparece em métrica nenhuma.
 * Sem isto, uma meia maratona vira "corrida de 21 km" e o mês perde a forma.
 */
export interface EventoFato {
  dia: string;
  tipo: 'recorde' | 'maior' | 'marco' | 'atipico';
  rotulo: string;
}

export interface LacunaFato {
  modulo: string;
  diasSemDado: number;
  motivo?: string;
}

export interface PacoteDeFatos {
  versao: number;
  periodo: {
    tipo: PeriodKind;
    rotulo: string;
    inicioISO: string;
    /** Último dia INCLUSIVO, `YYYY-MM-DD` — mesma convenção do `RetroSummary`. */
    fimISO: string;
    /** Ver `periodoFechado`. Período aberto não ganha parágrafo de máquina. */
    fechado: boolean;
    diasNoPeriodo: number;
  };
  modulos: ModuloFatos[];
  correlacoes: CorrelacaoFato[];
  eventos: EventoFato[];
  lacunas: LacunaFato[];
  anterior: { rotulo: string } | null;
}

// ── Regra de edição ────────────────────────────────────────

/** `YYYY-MM-DD` local — mesma convenção do `retro.ts`. */
function diaLocal(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Um período está **fechado** quando o último dia dele já passou.
 *
 * É a regra de edição da §3 do spec, e não é otimização: um jornal não reescreve
 * a edição de terça. Período fechado congela; período em curso não ganha
 * parágrafo, porque consultar "setembro" no dia 6 guardaria uma análise de seis
 * dias sob um rótulo de trinta.
 *
 * `all` nunca fecha, por definição — sempre cabe mais um dia.
 */
export function periodoFechado(tipo: PeriodKind, fimISO: string, agora: Date): boolean {
  if (tipo === 'all') return false;
  return diaLocal(agora) > fimISO;
}

/** Dias entre `inicioISO` e `fimISO`, ambos inclusivos. */
function diasEntre(inicioISO: string, fimISO: string): number {
  const a = new Date(`${inicioISO}T00:00:00`).getTime();
  const b = new Date(`${fimISO}T00:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  // round absorve o ±1 h do horário de verão.
  return Math.round((b - a) / 86_400_000) + 1;
}

// ── Conversão para fato ────────────────────────────────────

function arredondar(v: number | null, casas: number): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

function pct(atual: number | null, anterior: number | null): number | null {
  if (atual == null || anterior == null || anterior === 0) return null;
  return arredondar(((atual - anterior) / anterior) * 100, 1);
}

/**
 * `RecapValue` → `FatoNumero`, aplicando `escala` antes de arredondar.
 * `escala` é o que converte metros em km e segundos em horas — a conversão
 * mora aqui, não no prompt.
 */
function deRecap(
  chave: string, rotulo: string, r: RecapValue | undefined,
  unidade = '', casas = 0, escala = 1,
): FatoNumero {
  const atual = arredondar((r?.current ?? 0) * escala, casas);
  const anterior = arredondar((r?.prior ?? 0) * escala, casas);
  return {
    chave, rotulo, atual, anterior,
    delta: arredondar((atual ?? 0) - (anterior ?? 0), casas),
    deltaPct: pct(atual, anterior),
    unidade, casas,
  };
}

/** `MetricRecap` → `FatoNumero`. Preserva `null` — ausência não vira zero. */
function deMetrica(
  chave: string, rotulo: string, m: MetricRecap | null,
  unidade = '', casas = 0,
): FatoNumero {
  const atual = arredondar(m?.current ?? null, casas);
  const anterior = arredondar(m?.prior ?? null, casas);
  return {
    chave, rotulo, atual, anterior,
    delta: atual != null && anterior != null ? arredondar(atual - anterior, casas) : null,
    deltaPct: pct(atual, anterior),
    unidade, casas,
  };
}

/**
 * Cobertura é `comparavel` quando nenhum dos lados tem menos de 60% dos dias do
 * período **e** a razão entre os dois lados fica dentro de 1,5×.
 *
 * O caso que fixou o limiar: 14 noites em julho contra 27 em agosto — razão de
 * 1,93×, reprovada. É onde a comparação silenciosa mente.
 */
const COBERTURA_MIN = 0.6;
const COBERTURA_RAZAO_MAX = 1.5;

export function coberturaDe(
  diasComDado: number, diasNoPeriodo: number,
  diasComDadoAnterior: number, diasNoPeriodoAnterior: number,
): Cobertura {
  const fracAtual = diasNoPeriodo > 0 ? diasComDado / diasNoPeriodo : 0;
  const fracAnt = diasNoPeriodoAnterior > 0 ? diasComDadoAnterior / diasNoPeriodoAnterior : 0;
  const menor = Math.min(diasComDado, diasComDadoAnterior);
  const maior = Math.max(diasComDado, diasComDadoAnterior);
  const razao = menor > 0 ? maior / menor : Infinity;
  const comparavel = diasComDadoAnterior > 0
    && fracAtual >= COBERTURA_MIN && fracAnt >= COBERTURA_MIN
    && razao <= COBERTURA_RAZAO_MAX;
  return { diasComDado, diasNoPeriodo, diasComDadoAnterior, diasNoPeriodoAnterior, comparavel };
}

// ── Montagem ───────────────────────────────────────────────

function esporte(rotulo: string, s: SportStats | null): ModuloFatos | null {
  if (!s) return null;
  return {
    modulo: rotulo.toLowerCase(),
    rotulo,
    metricas: [
      deRecap('sessoes', 'Sessões', s.sessions),
      deRecap('distancia', 'Distância', s.distanceM, 'km', 0, 1 / 1000),
      deRecap('tempo', 'Tempo em movimento', s.movingS, 'h', 1, 1 / 3600),
      deRecap('elevacao', 'Elevação', s.elevationM, 'm', 0),
    ],
    cobertura: null,
  };
}

function habitos(rotulo: string, linhas: readonly RetroHabitRow[]): ModuloFatos | null {
  if (linhas.length === 0) return null;
  return {
    modulo: rotulo.toLowerCase().replace(/\s/g, '-'),
    rotulo,
    metricas: linhas.map((h) => deRecap(h.id, h.name, h.recap, 'dias', 0)),
    cobertura: null,
  };
}

function registros(linhas: readonly RetroRegistroRow[]): ModuloFatos | null {
  if (linhas.length === 0) return null;
  return {
    modulo: 'registros',
    rotulo: 'Registros',
    metricas: linhas.map((r) => deRecap(r.id, r.name, r.recap, 'dias', 0)),
    cobertura: null,
  };
}

function saude(linhas: readonly RetroHealthRow[], diasNoPeriodo: number): ModuloFatos | null {
  if (linhas.length === 0) return null;
  // `recap.n` é o nº de dias com valor no período — a cobertura real da métrica.
  const n = Math.max(...linhas.map((l) => l.recap.n ?? 0), 0);
  return {
    modulo: 'saude',
    rotulo: 'Saúde',
    metricas: linhas.map((l) => deMetrica(l.metric, l.label, l.recap, l.unit, l.decimals)),
    cobertura: coberturaDe(n, diasNoPeriodo, n, diasNoPeriodo),
  };
}

export interface EntradaPacote {
  resumo: RetroSummary;
  agora: Date;
  /** Correlações já calculadas pelo `triggerImpact` — o pacote não recalcula. */
  correlacoes?: readonly { gatilho: string; rotulo: string; impacto: MetricImpact }[];
  eventos?: readonly EventoFato[];
  lacunas?: readonly LacunaFato[];
  /**
   * Cobertura de sono, quando conhecida. Fica de fora do `RetroSummary`, que
   * não conta noites — e é justamente o caso que motivou o campo.
   */
  coberturaSono?: { noites: number; noitesAnterior: number };
}

/**
 * Monta o pacote a partir do que o `retro.ts` já calculou.
 *
 * Não recalcula nada: se um número não está no `RetroSummary`, ele não entra —
 * ter duas implementações da mesma conta é como a manchete passa a divergir da
 * tela que o usuário está olhando.
 */
export function montarPacote(entrada: EntradaPacote): PacoteDeFatos {
  const { resumo, agora } = entrada;
  const diasNoPeriodo = diasEntre(resumo.startISO, resumo.endISO);

  const modulos: ModuloFatos[] = [];

  modulos.push({
    modulo: 'atividade',
    rotulo: 'Atividade',
    metricas: [
      deRecap('atividades', 'Atividades', resumo.fitness.count),
      deRecap('distancia', 'Distância', resumo.fitness.distanceM, 'km', 0, 1 / 1000),
      deRecap('tempo', 'Tempo', resumo.fitness.durationS, 'h', 1, 1 / 3600),
      deRecap('passos_dia', 'Passos por dia', resumo.fitness.steps, '', 0,
        diasNoPeriodo > 0 ? 1 / diasNoPeriodo : 1),
      deRecap('andares', 'Andares', resumo.fitness.floors),
    ],
    cobertura: null,
  });

  const ciclismo = esporte('Ciclismo', resumo.sports.cycling);
  if (ciclismo) modulos.push(ciclismo);
  const corrida = esporte('Corrida', resumo.sports.running);
  if (corrida) modulos.push(corrida);

  const s = saude(resumo.health, diasNoPeriodo);
  if (s) modulos.push(s);

  if (resumo.ratings.sleep || resumo.ratings.day) {
    const cs = entrada.coberturaSono;
    modulos.push({
      modulo: 'percepcao',
      rotulo: 'Percepção',
      metricas: [
        deMetrica('nota_sono', 'Nota de sono', resumo.ratings.sleep, '', 2),
        deMetrica('nota_dia', 'Nota do dia', resumo.ratings.day, '', 2),
      ],
      cobertura: cs
        ? coberturaDe(cs.noites, diasNoPeriodo, cs.noitesAnterior, diasNoPeriodo)
        : null,
    });
  }

  const bons = habitos('Hábitos bons', resumo.habits.good);
  if (bons) modulos.push(bons);
  const ruins = habitos('Hábitos ruins', resumo.habits.bad);
  if (ruins) modulos.push(ruins);
  const regs = registros(resumo.registros);
  if (regs) modulos.push(regs);

  modulos.push({
    modulo: 'dia-a-dia',
    rotulo: 'Dia a dia',
    metricas: [
      deRecap('tarefas', 'Tarefas concluídas', resumo.tasks.total),
      deRecap('compras', 'Compras', resumo.purchases.count),
      deRecap('gasto', 'Gasto', resumo.purchases.spend, '', 2),
    ],
    cobertura: null,
  });

  const correlacoes: CorrelacaoFato[] = (entrada.correlacoes ?? []).map((c) => ({
    gatilho: c.gatilho,
    metrica: c.impacto.metric,
    rotulo: c.rotulo,
    deltaPct: arredondar(c.impacto.deltaPct, 1),
    nCom: c.impacto.nWith,
    nSem: c.impacto.nWithout,
    dentroDoPortao: c.impacto.enough,
  }));

  return {
    versao: PACOTE_VERSAO,
    periodo: {
      tipo: resumo.kind,
      rotulo: resumo.label,
      inicioISO: resumo.startISO,
      fimISO: resumo.endISO,
      fechado: periodoFechado(resumo.kind, resumo.endISO, agora),
      diasNoPeriodo,
    },
    modulos,
    correlacoes,
    eventos: [...(entrada.eventos ?? [])],
    lacunas: [...(entrada.lacunas ?? [])],
    anterior: resumo.kind === 'all' ? null : { rotulo: 'período anterior' },
  };
}

// ── Introspecção (a base da verificação da §5) ─────────────

/**
 * Todo número que o pacote autoriza a citar, como texto já formatado nas casas
 * decimais do próprio fato.
 *
 * É o alfabeto da verificação "todo número citado existe no pacote". Mora aqui,
 * e não no verificador, porque quem sabe quantas casas um fato tem é o fato.
 */
export function numerosDoPacote(p: PacoteDeFatos): ReadonlySet<string> {
  const out = new Set<string>();
  const add = (v: number | null, casas: number) => {
    if (v == null || !Number.isFinite(v)) return;
    out.add(v.toFixed(casas));
    if (casas > 0) out.add(String(v));           // 7.03 tanto quanto "7.03"
    out.add(String(Math.abs(v)));                // deltas citados sem o sinal
  };
  for (const m of p.modulos) {
    for (const f of m.metricas) {
      add(f.atual, f.casas);
      add(f.anterior, f.casas);
      add(f.delta, f.casas);
      add(f.deltaPct, 1);
    }
    if (m.cobertura) {
      add(m.cobertura.diasComDado, 0);
      add(m.cobertura.diasNoPeriodo, 0);
      add(m.cobertura.diasComDadoAnterior, 0);
      add(m.cobertura.diasNoPeriodoAnterior, 0);
    }
  }
  for (const c of p.correlacoes) {
    add(c.deltaPct, 1);
    add(c.nCom, 0);
    add(c.nSem, 0);
  }
  add(p.periodo.diasNoPeriodo, 0);
  return out;
}

/**
 * Os mesmos valores como números, para conferência exata.
 *
 * Existe separado do `numerosDoPacote` porque comparar por texto é armadilha:
 * arredondar "20,7" para "21" e achar 21 na lista aprovaria qualquer valor entre
 * 20,5 e 21,5 — inclusive uma média que o modelo fez de cabeça. Verificação é
 * numérica e exata; a lista de texto serve para o prompt e para depuração.
 */
export function valoresDoPacote(p: PacoteDeFatos): ReadonlySet<number> {
  const out = new Set<number>();
  const add = (v: number | null) => {
    if (v == null || !Number.isFinite(v)) return;
    out.add(v);
    out.add(Math.abs(v));
  };
  for (const m of p.modulos) {
    for (const f of m.metricas) {
      add(f.atual); add(f.anterior); add(f.delta); add(f.deltaPct);
    }
    if (m.cobertura) {
      add(m.cobertura.diasComDado);
      add(m.cobertura.diasNoPeriodo);
      add(m.cobertura.diasComDadoAnterior);
      add(m.cobertura.diasNoPeriodoAnterior);
    }
  }
  for (const c of p.correlacoes) { add(c.deltaPct); add(c.nCom); add(c.nSem); }
  add(p.periodo.diasNoPeriodo);
  return out;
}

/** Todo módulo cuja cobertura obriga o texto a declarar ressalva. */
export function ressalvasObrigatorias(p: PacoteDeFatos): readonly string[] {
  return p.modulos
    .filter((m) => m.cobertura && !m.cobertura.comparavel)
    .map((m) => m.rotulo);
}
