/**
 * O pacote de fatos — a entrada única da camada de IA analítica.
 * Spec: docs/specs/ia-analitica/spec.md · docs/specs/revista-retrospectiva/ ·
 * ADRs 0038 e 0040.
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
 *
 * ## Por que é um pacote POR CADERNO (versão 2)
 *
 * Cada número autorizado enfraquece a conferência de todos os outros. Medido no
 * pacote real de agosto/2026: 71 valores, dos quais **16 são inteiros entre 0 e
 * 100** — um inteiro alucinado nessa faixa passava a conferência 16% das vezes.
 * Com um pacote só para o período inteiro, qualquer dado novo engorda o alfabeto
 * de todo mundo ao mesmo tempo.
 *
 * Então o pacote passa a ser **um por caderno** (`period/cadernos.ts`), e o
 * caderno de Sono deixa de saber quantos quilômetros o dono pedalou: seis
 * pacotes de 40 são muito mais seguros que um de 240. A medição vive em
 * `pacote.test.ts` e é **entrega, não bônus** — um split malfeito (cada caderno
 * recebendo a união em vez da fatia) passa em toda asserção de conteúdo que se
 * possa escrever; só o tamanho o denuncia.
 *
 * ## Ausência é fato, não silêncio
 *
 * `null` continua sendo "não foi medido" e zero continua sendo uma medida. Uma
 * base que **não existe** entra no pacote dizendo que não existe
 * ({@link Base.existe}), porque o modelo não pode descobrir sozinho que não há
 * ano anterior — ele tem que ser informado de que não há.
 */
import type { PeriodKind } from '../period/bounds';
import { previousPeriodLabel } from '../period/bounds';
import type { CadernoId } from '../period/cadernos';
import { CADERNO_IDS, cadernoDaMetricaDeSaude, rotuloDoCaderno } from '../period/cadernos';
import type {
  RetroSummary, RetroHabitRow, RetroRegistroRow, SportStats,
} from '../period/retro';
import type { RecapValue, MetricRecap } from '../week/recap';
import type { MetricImpact } from '../health/trigger-impact';

/**
 * Sobe quando a forma do pacote muda de um jeito que invalida edição gravada.
 *
 * 1 — o pacote único do período, com `anterior`/`delta` anônimos.
 * 2 — um pacote por caderno; `FatoNumero` com `bases[]` identificadas;
 *     `FatoTendencia` e `FatoTexto`.
 */
export const PACOTE_VERSAO = 2;

// ── As bases nomeadas ──────────────────────────────────────

/**
 * As três bases de comparação, identificadas.
 *
 * Três bases **sem** nome seriam um alfabeto três vezes maior. Três bases **com**
 * nome são uma gramática: o número tem que bater e a preposição junto. Um texto
 * que escreve "435 km, contra 380 no ano passado" invertendo as bases passaria
 * hoje; com o id, a quinta regra (Story 1.4) o reprova.
 */
export type BaseId = 'B1' | 'B2' | 'B3';

export const BASE_ROTULO: Readonly<Record<BaseId, string>> = {
  B1: 'o período anterior',
  B2: 'o mesmo período do ano anterior',
  B3: 'a normal do período',
};

/**
 * Uma base de comparação de um {@link FatoNumero}.
 *
 * **`existe: false` não some do pacote** — é o fato de que não há. É a regra que
 * fecha o buraco de `bases-e-ranqueamento.md`: sem ela, a revista narra o
 * silêncio como estabilidade.
 *
 * `existe: true` com `valor: null` é outra coisa, e a distinção é o que a
 * gramática de ausência exige: a base existe (há um período anterior), mas a
 * métrica não foi medida nele.
 */
export interface Base {
  id: BaseId;
  /** Como o texto vai chamá-la — ver {@link BASE_ROTULO}. */
  rotulo: string;
  /** A base existe para esta métrica neste período? */
  existe: boolean;
  /** Já na unidade e nas casas do fato. `null` ⇒ não foi medido. */
  valor: number | null;
  delta: number | null;
  deltaPct: number | null;
  /** Só quando `existe` é false: por que não há. */
  motivo?: string;
}

/**
 * Um número que o modelo pode citar, já na unidade em que será escrito.
 * `atual` em `null` significa ausência de dado — nunca zero.
 */
export interface FatoNumero {
  /** Único dentro do caderno. É a chave que a impressão congela (AD-17). */
  chave: string;
  rotulo: string;
  /**
   * Subgrupo dentro do caderno — `'Ciclismo'`, `'Hábitos ruins'`. Existe porque
   * o caderno Movimento tem três `Distância` diferentes, e um rótulo repetido
   * três vezes numa lista é o modelo escolhendo o errado.
   */
  grupo?: string;
  atual: number | null;
  /** Sempre as três, na ordem B1 · B2 · B3. Base que não existe vem declarada. */
  bases: Base[];
  unidade: string;
  casas: number;
}

/**
 * A direção ao longo de vários períodos — **sem valor bruto**.
 *
 * Não é uma quarta base, e a razão é o custo: uma base nova põe N números no
 * alfabeto da verificação; a trajetória põe **um inteiro** (`periodos`) e por
 * ele entrega 3, 6 ou 12 períodos de direção. E é a única comparação que o
 * caderno Rotina consegue antes de mai/2027, porque só precisa de períodos
 * consecutivos.
 */
export interface FatoTendencia {
  /** A chave do {@link FatoNumero} de que ela fala. */
  chave: string;
  rotulo: string;
  direcao: 'sobe' | 'cai' | 'oscila';
  /** Quantos períodos consecutivos. É o único número que ela autoriza. */
  periodos: number;
  /** Desde quando, como rótulo — `'junho'`. Nunca um número. */
  desde: string;
}

/**
 * Um fato que não é número: cidades, piso das rotas, lápides.
 *
 * *"o período aconteceu em Ittre, Leuven e Bruxelles"*, *"72% pavimentado"*.
 * **Não entra no alfabeto numérico** — é justamente por isso que ele existe
 * como forma própria em vez de virar mais um `FatoNumero`.
 */
export interface FatoTexto {
  chave: string;
  rotulo: string;
  valor: string;
}

// ── Cobertura, correlação, evento, lacuna ──────────────────

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
  /** Ausente ⇒ `movimento`: recorde, maior e marco são vocabulário de atividade. */
  caderno?: CadernoId;
}

export interface LacunaFato {
  caderno: CadernoId;
  diasSemDado: number;
  motivo?: string;
}

// ── O pacote ───────────────────────────────────────────────

/**
 * O pacote de **um** caderno. `montarPacotes` devolve um destes por caderno, e
 * o de Sono não conhece uma única chave de ciclismo.
 */
export interface PacoteDeFatos {
  versao: number;
  caderno: CadernoId;
  /** O nome do caderno — `'Sono'`, `'Movimento'`. */
  rotulo: string;
  periodo: {
    tipo: PeriodKind;
    rotulo: string;
    /**
     * O nome **real** do período anterior — `"Julho 2026"`, `"2024"` —, não o
     * genérico `"período anterior"`.
     *
     * É **campo de texto**: zero números novos, zero custo de alfabeto. A versão
     * 1 tinha um `anterior: { rotulo: 'período anterior' }` que a Story 1.3
     * removeu por não ter leitor; a quinta regra da conferência é o leitor, e o
     * que ela precisa é do nome próprio, que aquele campo não tinha.
     *
     * `null` quando não há período anterior (`all`).
     */
    rotuloAnterior: string | null;
    inicioISO: string;
    /** Último dia INCLUSIVO, `YYYY-MM-DD` — mesma convenção do `RetroSummary`. */
    fimISO: string;
    /** Ver `periodoFechado`. Período aberto não ganha parágrafo de máquina. */
    fechado: boolean;
    diasNoPeriodo: number;
  };
  metricas: FatoNumero[];
  tendencias: FatoTendencia[];
  textos: FatoTexto[];
  cobertura: Cobertura | null;
  correlacoes: CorrelacaoFato[];
  eventos: EventoFato[];
  lacunas: LacunaFato[];
  /**
   * O caderno não teve nada no período. **Declarado, não omitido**: o pacote
   * existe e diz que está vazio; quem decide se ele vira seção é o ranqueamento
   * (Story 1.7), não a montagem.
   */
  semDado: boolean;
}

/**
 * Um pacote ou o conjunto deles.
 *
 * A introspecção e a verificação aceitam os dois porque a mesma pergunta se faz
 * nos dois grãos: o alfabeto **de um caderno** é o que a conferência daquele
 * texto usa; o alfabeto **da união** é o "pacote único equivalente" contra o
 * qual a medição prova que o split não foi nominal.
 */
export type UmOuMaisPacotes = PacoteDeFatos | readonly PacoteDeFatos[];

function comoLista(p: UmOuMaisPacotes): readonly PacoteDeFatos[] {
  return Array.isArray(p) ? p : [p as PacoteDeFatos];
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
 * O valor de B2 ou B3 que o chamador conhece, ou o motivo de não haver.
 *
 * Vem de fora porque o `RetroSummary` só sabe do período anterior: quem tem o
 * ano anterior e a normal é a camada de dados, e o pacote **não recalcula nada**
 * — ter duas implementações da mesma conta é como a manchete passa a divergir da
 * tela que o usuário está olhando.
 */
export interface BaseExterna {
  /** Já na unidade final do fato. `null` ⇒ a base existe e não foi medida. */
  valor: number | null;
  /** Quando a base **não existe**: o porquê. Presença de `motivo` ⇒ não existe. */
  motivo?: string;
}

/** B2/B3 por `chave` de fato. Chave ausente ⇒ base declarada inexistente. */
export type BasesExternas = Readonly<Record<string, Partial<Record<'B2' | 'B3', BaseExterna>>>>;

interface Ctx {
  /** Há período anterior? `all` não tem — sempre cabe mais um dia. */
  temB1: boolean;
  externas: BasesExternas;
}

const SEM_B1 = 'o histórico completo não tem período anterior';
const SEM_B2 = 'esta fonte não tem o mesmo período do ano anterior';
const SEM_B3 = 'esta fonte não tem dois anos — não há normal para este período';

function base(
  id: BaseId, existe: boolean, atual: number | null, valor: number | null,
  casas: number, motivo?: string,
): Base {
  const v = existe ? arredondar(valor, casas) : null;
  return {
    id,
    rotulo: BASE_ROTULO[id],
    existe,
    valor: v,
    delta: atual != null && v != null ? arredondar(atual - v, casas) : null,
    deltaPct: pct(atual, v),
    ...(existe ? {} : { motivo }),
  };
}

/**
 * As três bases de um fato, **sempre as três**.
 *
 * B1 sai do `RetroSummary`; B2 e B3 saem do que o chamador informou. Nenhuma
 * delas some quando não existe: some seria o modelo tendo que descobrir a
 * ausência sozinho, que é justamente o que a v1 fazia errado.
 */
function basesDe(
  chave: string, atual: number | null, anterior: number | null, casas: number, ctx: Ctx,
): Base[] {
  const ext = ctx.externas[chave];
  const externa = (id: 'B2' | 'B3', semEla: string): Base => {
    const e = ext?.[id];
    if (!e || e.motivo != null) return base(id, false, atual, null, casas, e?.motivo ?? semEla);
    return base(id, true, atual, e.valor, casas);
  };
  return [
    ctx.temB1 ? base('B1', true, atual, anterior, casas) : base('B1', false, atual, null, casas, SEM_B1),
    externa('B2', SEM_B2),
    externa('B3', SEM_B3),
  ];
}

interface OpcoesFato {
  unidade?: string;
  casas?: number;
  /** O que converte metros em km e segundos em horas. */
  escala?: number;
  grupo?: string;
}

/**
 * `RecapValue` → `FatoNumero`, aplicando `escala` antes de arredondar.
 * A conversão de unidade mora aqui, não no prompt.
 */
function deRecap(
  chave: string, rotulo: string, r: RecapValue | undefined, ctx: Ctx, o: OpcoesFato = {},
): FatoNumero {
  const casas = o.casas ?? 0;
  const escala = o.escala ?? 1;
  const atual = arredondar((r?.current ?? 0) * escala, casas);
  const anterior = arredondar((r?.prior ?? 0) * escala, casas);
  return {
    chave,
    rotulo,
    ...(o.grupo ? { grupo: o.grupo } : {}),
    atual,
    bases: basesDe(chave, atual, anterior, casas, ctx),
    unidade: o.unidade ?? '',
    casas,
  };
}

/** `MetricRecap` → `FatoNumero`. Preserva `null` — ausência não vira zero. */
function deMetrica(
  chave: string, rotulo: string, m: MetricRecap | null, ctx: Ctx, o: OpcoesFato = {},
): FatoNumero {
  const casas = o.casas ?? 0;
  const atual = arredondar(m?.current ?? null, casas);
  const anterior = arredondar(m?.prior ?? null, casas);
  return {
    chave,
    rotulo,
    ...(o.grupo ? { grupo: o.grupo } : {}),
    atual,
    bases: basesDe(chave, atual, anterior, casas, ctx),
    unidade: o.unidade ?? '',
    casas,
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

function esporte(
  grupo: string, prefixo: string, s: SportStats | null, ctx: Ctx,
): FatoNumero[] {
  if (!s) return [];
  return [
    deRecap(`${prefixo}.sessoes`, 'Sessões', s.sessions, ctx, { grupo }),
    deRecap(`${prefixo}.distancia`, 'Distância', s.distanceM, ctx, { unidade: 'km', escala: 1 / 1000, grupo }),
    deRecap(`${prefixo}.tempo`, 'Tempo em movimento', s.movingS, ctx, { unidade: 'h', casas: 1, escala: 1 / 3600, grupo }),
    deRecap(`${prefixo}.elevacao`, 'Elevação', s.elevationM, ctx, { unidade: 'm', grupo }),
  ];
}

function habitos(
  grupo: string, linhas: readonly RetroHabitRow[], ctx: Ctx,
): FatoNumero[] {
  return linhas.map((h) => deRecap(`habito.${h.id}`, h.name, h.recap, ctx, { unidade: 'dias', grupo }));
}

function registros(linhas: readonly RetroRegistroRow[], ctx: Ctx): FatoNumero[] {
  return linhas.map((r) => deRecap(`registro.${r.id}`, r.name, r.recap, ctx, { unidade: 'dias', grupo: 'Registros' }));
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
  /**
   * B2 e B3 por `chave` de fato, quando o chamador as tem. O que não vier aqui
   * entra no pacote **como ausência declarada**, nunca como silêncio.
   */
  bases?: BasesExternas;
  /** Trajetórias já calculadas, por caderno. O pacote não deriva direção. */
  tendencias?: Partial<Record<CadernoId, readonly FatoTendencia[]>>;
  /** Cidades, piso, lápides — por caderno. */
  textos?: Partial<Record<CadernoId, readonly FatoTexto[]>>;
}

type PorCaderno<T> = Record<CadernoId, T[]>;

function vazioPorCaderno<T>(): PorCaderno<T> {
  return { sono: [], movimento: [], coracao: [], rotina: [] };
}

/**
 * Monta **um pacote por caderno** a partir do que o `retro.ts` já calculou.
 *
 * Não recalcula nada: se um número não está no `RetroSummary`, ele não entra —
 * ter duas implementações da mesma conta é como a manchete passa a divergir da
 * tela que o usuário está olhando.
 *
 * ## Reparticionamento, não renomeação
 *
 * Os cinco módulos da versão 1 **não** mapeiam um-para-um nos quatro cadernos:
 *
 * - `atividade`, `ciclismo` e `corrida` → **Movimento** (passos e andares
 *   incluídos: `cadernos.md` os declara subproduto dele)
 * - `saude` **se parte** — sono para **Sono**, FC e VFC para **Coração**
 * - `percepcao` **se parte** — a nota do sono para **Sono**, a do dia para
 *   **Rotina**
 * - hábitos, registros e `dia-a-dia` → **Rotina**
 *
 * Quem tratar isto como um `rename` produz um caderno de Sono com FC dentro, e
 * nenhum teste de tamanho pega isso — só o de isolamento pega.
 *
 * Devolve **sempre os quatro**, na ordem do catálogo. Caderno sem dado vem com
 * `semDado: true`: a ausência é declarada, não omitida — quem decide se ele vira
 * seção é o ranqueamento, não a montagem.
 */
export function montarPacotes(entrada: EntradaPacote): PacoteDeFatos[] {
  const { resumo, agora } = entrada;
  const diasNoPeriodo = diasEntre(resumo.startISO, resumo.endISO);
  const ctx: Ctx = { temB1: resumo.kind !== 'all', externas: entrada.bases ?? {} };

  const metricas = vazioPorCaderno<FatoNumero>();
  const cobertura: Record<CadernoId, Cobertura | null> = {
    sono: null, movimento: null, coracao: null, rotina: null,
  };

  // ── Movimento ──
  metricas.movimento.push(
    deRecap('atividades', 'Atividades', resumo.fitness.count, ctx),
    deRecap('distancia', 'Distância', resumo.fitness.distanceM, ctx, { unidade: 'km', escala: 1 / 1000 }),
    deRecap('tempo', 'Tempo', resumo.fitness.durationS, ctx, { unidade: 'h', casas: 1, escala: 1 / 3600 }),
    deRecap('passos_dia', 'Passos por dia', resumo.fitness.steps, ctx, {
      escala: diasNoPeriodo > 0 ? 1 / diasNoPeriodo : 1,
    }),
    deRecap('andares', 'Andares', resumo.fitness.floors, ctx),
    ...esporte('Ciclismo', 'ciclismo', resumo.sports.cycling, ctx),
    ...esporte('Corrida', 'corrida', resumo.sports.running, ctx),
  );

  // ── Saúde se parte: sono para Sono, o resto para Coração ──
  for (const l of resumo.health) {
    const alvo = cadernoDaMetricaDeSaude(l.metric);
    metricas[alvo].push(
      deMetrica(l.metric, l.label, l.recap, ctx, { unidade: l.unit, casas: l.decimals }),
    );
  }
  // `recap.n` é o nº de dias com valor no período — a cobertura real da métrica.
  // Na versão 1 esse `max` corria sobre TODAS as linhas de saúde; agora corre só
  // sobre as que ficaram no Coração, que é o reparticionamento fazendo efeito.
  const nCoracao = Math.max(
    ...resumo.health.filter((l) => cadernoDaMetricaDeSaude(l.metric) === 'coracao')
      .map((l) => l.recap.n ?? 0),
    0,
  );
  if (nCoracao > 0) cobertura.coracao = coberturaDe(nCoracao, diasNoPeriodo, nCoracao, diasNoPeriodo);

  // ── Percepção se parte: a nota do sono para Sono, a do dia para Rotina ──
  if (resumo.ratings.sleep) {
    metricas.sono.push(deMetrica('nota_sono', 'Nota de sono', resumo.ratings.sleep, ctx, { casas: 2 }));
  }
  if (resumo.ratings.day) {
    metricas.rotina.push(deMetrica('nota_dia', 'Nota do dia', resumo.ratings.day, ctx, { casas: 2 }));
  }

  // A cobertura de noites é do caderno Sono, não da "percepção": é ela que diz
  // se 27 noites contra 14 podem ser comparadas em silêncio (não podem).
  //
  // Sem `coberturaSono` ela fica **nula**, e não cai para o `recap.n` da métrica
  // de sono: o `n` compara o período consigo mesmo, e usá-lo aqui poria um
  // número novo no alfabeto — que é exatamente o que esta story existe para não
  // fazer de graça.
  const cs = entrada.coberturaSono;
  if (cs) cobertura.sono = coberturaDe(cs.noites, diasNoPeriodo, cs.noitesAnterior, diasNoPeriodo);

  // ── Rotina ──
  metricas.rotina.push(
    ...habitos('Hábitos bons', resumo.habits.good, ctx),
    ...habitos('Hábitos ruins', resumo.habits.bad, ctx),
    ...registros(resumo.registros, ctx),
    deRecap('tarefas', 'Tarefas concluídas', resumo.tasks.total, ctx, { grupo: 'Dia a dia' }),
    deRecap('compras', 'Compras', resumo.purchases.count, ctx, { grupo: 'Dia a dia' }),
    deRecap('gasto', 'Gasto', resumo.purchases.spend, ctx, { casas: 2, grupo: 'Dia a dia' }),
  );

  // ── O que vem de fora, repartido pelo mesmo critério ──
  const correlacoes = vazioPorCaderno<CorrelacaoFato>();
  for (const c of entrada.correlacoes ?? []) {
    correlacoes[cadernoDaMetricaDeSaude(c.impacto.metric)].push({
      gatilho: c.gatilho,
      metrica: c.impacto.metric,
      rotulo: c.rotulo,
      deltaPct: arredondar(c.impacto.deltaPct, 1),
      nCom: c.impacto.nWith,
      nSem: c.impacto.nWithout,
      dentroDoPortao: c.impacto.enough,
    });
  }

  const eventos = vazioPorCaderno<EventoFato>();
  for (const e of entrada.eventos ?? []) eventos[e.caderno ?? 'movimento'].push({ ...e });

  const lacunas = vazioPorCaderno<LacunaFato>();
  for (const l of entrada.lacunas ?? []) lacunas[l.caderno].push({ ...l });

  const periodo = {
    tipo: resumo.kind,
    rotulo: resumo.label,
    // Texto, não número: o alfabeto da verificação não muda de tamanho por causa
    // dele. É a condição que a regra do alfabeto impõe a qualquer campo novo.
    rotuloAnterior: previousPeriodLabel(resumo.kind, resumo.startISO),
    inicioISO: resumo.startISO,
    fimISO: resumo.endISO,
    fechado: periodoFechado(resumo.kind, resumo.endISO, agora),
    diasNoPeriodo,
  };

  return CADERNO_IDS.map((id) => {
    const tendencias = [...(entrada.tendencias?.[id] ?? [])];
    const textos = [...(entrada.textos?.[id] ?? [])];
    const m = metricas[id];
    return {
      versao: PACOTE_VERSAO,
      caderno: id,
      rotulo: rotuloDoCaderno(id),
      periodo,
      metricas: m,
      tendencias,
      textos,
      cobertura: cobertura[id],
      correlacoes: correlacoes[id],
      eventos: eventos[id],
      lacunas: lacunas[id],
      // `atual == null` é "não foi medido", e um caderno só de nulos não tem
      // dado — mas o fato fica no pacote, porque a base dele ainda é história
      // ("no mês passado eram 48 bpm") e some-la seria o silêncio de novo.
      semDado: m.every((f) => f.atual == null) && tendencias.length === 0 && textos.length === 0,
    };
  });
}

/** O pacote de **um** caderno. Atalho sobre {@link montarPacotes}. */
export function montarPacote(entrada: EntradaPacote, caderno: CadernoId): PacoteDeFatos {
  const p = montarPacotes(entrada).find((x) => x.caderno === caderno);
  if (!p) throw new Error(`caderno desconhecido: ${caderno}`);
  return p;
}

// ── Introspecção (a base da verificação da §5) ─────────────

/**
 * Todo número que o pacote autoriza a citar, como texto já formatado nas casas
 * decimais do próprio fato.
 *
 * É o alfabeto da verificação "todo número citado existe no pacote". Mora aqui,
 * e não no verificador, porque quem sabe quantas casas um fato tem é o fato.
 */
export function numerosDoPacote(p: UmOuMaisPacotes): ReadonlySet<string> {
  const out = new Set<string>();
  const add = (v: number | null, casas: number) => {
    if (v == null || !Number.isFinite(v)) return;
    out.add(v.toFixed(casas));
    if (casas > 0) out.add(String(v));           // 7.03 tanto quanto "7.03"
    out.add(String(Math.abs(v)));                // deltas citados sem o sinal
  };
  for (const pacote of comoLista(p)) {
    for (const f of pacote.metricas) {
      add(f.atual, f.casas);
      for (const b of f.bases) {
        add(b.valor, f.casas);
        add(b.delta, f.casas);
        add(b.deltaPct, 1);
      }
    }
    // A trajetória põe UM inteiro no alfabeto, e por ele entrega N períodos de
    // direção — o argumento inteiro de por que ela não é uma quarta base.
    for (const t of pacote.tendencias) add(t.periodos, 0);
    const c = pacote.cobertura;
    if (c) {
      add(c.diasComDado, 0);
      add(c.diasNoPeriodo, 0);
      add(c.diasComDadoAnterior, 0);
      add(c.diasNoPeriodoAnterior, 0);
    }
    for (const co of pacote.correlacoes) {
      add(co.deltaPct, 1);
      add(co.nCom, 0);
      add(co.nSem, 0);
    }
    add(pacote.periodo.diasNoPeriodo, 0);
  }
  return out;
}

/**
 * De onde um valor autorizado veio — a **procedência**.
 *
 * `valoresDoPacote` responde *"esse número existe?"* e não consegue responder
 * *"existe como quê?"*. A quinta regra da conferência (Story 1.4) faz a segunda
 * pergunta: um número que é valor de **base** obriga o texto a nomear a base
 * certa; um que é `atual` não obriga nada. Por isso a origem viaja junto.
 *
 * **Não acrescenta número nenhum ao alfabeto** — é exatamente o mesmo conjunto
 * de valores, com a etiqueta de onde cada um nasceu. `valoresDoPacote` é
 * derivado daqui justamente para que as duas leituras não possam divergir.
 */
export interface Procedencia {
  valor: number;
  /** A chave do fato de onde veio. `''` para o que não é fato: cobertura, período. */
  chave: string;
  /**
   * A base de que ele é o **valor**, ou `null` quando não é valor de base.
   *
   * `delta` e `deltaPct` saem com `null` de propósito: eles são a *relação* com
   * a base, não a base. Cobrar nomeação de "caiu 49,5%" reprovaria uma frase
   * bem-formada, e falso positivo na conferência custa uma edição inteira.
   */
  base: BaseId | null;
}

/**
 * Todo valor autorizado, com a procedência de cada um.
 *
 * O mesmo valor aparece mais de uma vez quando mais de um fato o produz — e é
 * essa multiplicidade que a quinta regra lê: um número que é base de um fato
 * **e** o `atual` de outro não é decidível, e a regra cala em vez de adivinhar.
 */
export function procedenciaDoPacote(p: UmOuMaisPacotes): readonly Procedencia[] {
  const out: Procedencia[] = [];
  const add = (v: number | null, chave: string, base: BaseId | null) => {
    if (v == null || !Number.isFinite(v)) return;
    out.push({ valor: v, chave, base });
    // O mesmo valor sem o sinal: deltas são citados sem o menos.
    if (Math.abs(v) !== v) out.push({ valor: Math.abs(v), chave, base });
  };
  for (const pacote of comoLista(p)) {
    for (const f of pacote.metricas) {
      add(f.atual, f.chave, null);
      for (const b of f.bases) {
        add(b.valor, f.chave, b.id);
        add(b.delta, f.chave, null);
        add(b.deltaPct, f.chave, null);
      }
    }
    for (const t of pacote.tendencias) add(t.periodos, t.chave, null);
    const c = pacote.cobertura;
    if (c) {
      add(c.diasComDado, '', null);
      add(c.diasNoPeriodo, '', null);
      add(c.diasComDadoAnterior, '', null);
      add(c.diasNoPeriodoAnterior, '', null);
    }
    for (const co of pacote.correlacoes) {
      add(co.deltaPct, co.metrica, null);
      add(co.nCom, co.metrica, null);
      add(co.nSem, co.metrica, null);
    }
    add(pacote.periodo.diasNoPeriodo, '', null);
  }
  return out;
}

/**
 * Os mesmos valores como números, para conferência exata.
 *
 * Existe separado do `numerosDoPacote` porque comparar por texto é armadilha:
 * arredondar "20,7" para "21" e achar 21 na lista aprovaria qualquer valor entre
 * 20,5 e 21,5 — inclusive uma média que o modelo fez de cabeça. Verificação é
 * numérica e exata; a lista de texto serve para o prompt e para depuração.
 *
 * **É a função que a medição do alfabeto usa** (`pacote.test.ts`): passe um
 * caderno para ter o alfabeto dele, ou os quatro para ter o do pacote único
 * equivalente.
 */
export function valoresDoPacote(p: UmOuMaisPacotes): ReadonlySet<number> {
  const out = new Set<number>();
  for (const x of procedenciaDoPacote(p)) out.add(x.valor);
  return out;
}

/** Todo caderno cuja cobertura obriga o texto a declarar ressalva. */
export function ressalvasObrigatorias(p: UmOuMaisPacotes): readonly string[] {
  return comoLista(p)
    .filter((x) => x.cobertura && !x.cobertura.comparavel)
    .map((x) => x.rotulo);
}
