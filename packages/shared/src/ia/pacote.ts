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
import { previousPeriodLabel, previousPeriodStartISO } from '../period/bounds';
import type { EstacaoDaLuz } from '../astro/casa';
import { estacaoDaLuz } from '../astro/casa';
import type { CadernoId, MetricaComLapide } from '../period/cadernos';
import {
  CADERNO_IDS, LAPIDES, METRICAS_COM_LAPIDE, cadernoDaMetricaDeSaude, isMetricaComLapide,
  rotuloDoCaderno,
} from '../period/cadernos';
import type {
  RetroSummary, RetroHabitRow, RetroRegistroRow, SportStats,
} from '../period/retro';
import type { RecapValue, MetricRecap } from '../week/recap';
import type { MetricImpact } from '../health/trigger-impact';
// O dono de "isto é um dia de calendário" é o das datas locais. Uma segunda
// regex aqui aceitaria o que aquele recusa no dia em que uma mudasse.
import { isValidDate } from '../date/local';

/**
 * Sobe quando a forma do pacote muda de um jeito que invalida edição gravada.
 *
 * 1 — o pacote único do período, com `anterior`/`delta` anônimos.
 * 2 — um pacote por caderno; `FatoNumero` com `bases[]` identificadas;
 *     `FatoTendencia` e `FatoTexto`.
 * 3 — `FatoNumero` ganha `amostra` e `comparavel`, que só o ranqueamento lê; a
 *     lápide vira `FatoLapide`, fato próprio do pacote, com a data da última
 *     medida; `semDado` passa a contar a lápide do período. E VO₂max e anéis
 *     passam a ir para Movimento também como NÚMERO, e não só como lápide: o
 *     mapa de saúde e o da lápide viraram uma rota só (hoje nenhuma linha de
 *     saúde da retro é VO₂max nem anéis, então nenhum pacote em produção muda).
 */
export const PACOTE_VERSAO = 3;

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
  /**
   * O **menor lado** da comparação com B1, em observações **que carregam a
   * medida**: a própria contagem (atividades, sessões, tarefas, compras, dias de
   * hábito e de registro); as atividades **com distância** para a distância, no
   * total e em cada esporte; as sessões do grupo para o tempo; as compras **com
   * preço** para o gasto; os dias com valor para saúde e notas. `null` quando não
   * se sabe — passos, andares, elevação, distância ou gasto sem a contagem de quem
   * os carrega, métrica de saúde sem `nAnterior`, período sem anterior.
   *
   * **Só o ranqueamento lê** (`ia/ranqueamento.ts`, o portão do passo 2): efeito
   * grande com amostra pequena é ruído com aparência de manchete. Fica **fora do
   * alfabeto e fora do prompt** — `procedenciaDoPacote` não o conhece, e um
   * número que o modelo não vê não pode ser citado nem pesar na conferência.
   *
   * Obrigatório de propósito: quem produz o fato é o único que sabe de onde o
   * número veio, e é ali que se decide quantas observações o sustentam.
   */
  amostra: number | null;
  /**
   * `false` quando o lado anterior da comparação está amputado por nascimento:
   * hábito ou registro criado **depois** do início do período anterior. Nenhum N
   * pega esse caso — junho/2026 teria 26 dias de café contra 11 de um maio em
   * que o hábito só existia desde o dia 20: não é amostra pequena, é caderno
   * novo. Também `false` quando a data de criação não é dia de calendário: não
   * se sabe, e não se sabe não passa. Mesma regra de leitura de {@link amostra}:
   * só o ranqueamento, fora do alfabeto e do prompt.
   */
  comparavel: boolean;
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
 * Um fato que não é número: cidades, piso das rotas.
 *
 * *"o período aconteceu em Ittre, Leuven e Bruxelles"*, *"72% pavimentado"*.
 * **Não entra no alfabeto numérico** — é justamente por isso que ele existe
 * como forma própria em vez de virar mais um `FatoNumero`.
 *
 * A lápide morou aqui na intenção e nunca na montagem; ela tem forma própria,
 * {@link FatoLapide}, porque o que a define é uma **data**, e `FatoTexto` não
 * tem data.
 */
export interface FatoTexto {
  chave: string;
  rotulo: string;
  valor: string;
}

/**
 * Uma métrica que parou de chegar — a **lápide** (CAP-11).
 *
 * Sem ela, a revista narra o silêncio como melhora: *"sua respiração está
 * estável"* quando não há respiração há dois meses. O modelo não pode descobrir
 * sozinho que o sensor morreu; tem que ser informado.
 *
 * **Métrica e data, nada mais.** O nome em prosa, o verbo que concorda com ele
 * e o caderno moram no mapa do catálogo (`LAPIDES`, em `period/cadernos.ts`). A
 * data fica **fora do alfabeto**: ela vai ao prompt por extenso (*"14 de julho
 * de 2026"*), e a conferência já dispensa dia de mês seguido de "de" e ano de
 * quatro dígitos.
 *
 * Entra no pacote se a última medida é **até o fim** do período (uma morte
 * posterior ainda não aconteceu nele); é **do período** se também é **desde o
 * início** — ver {@link lapideDoPeriodo}. Só a do período lidera, e só ela vence
 * o vazio.
 */
export interface FatoLapide {
  metrica: MetricaComLapide;
  /** O dia da última medida, `YYYY-MM-DD`. */
  ultimaMedidaISO: string;
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
    /**
     * A estação de luz do período, em palavras — `"dias curtos"`, `"dias longos"`,
     * `"dias em transição"`. Ver {@link textoDaLuz}.
     *
     * **Texto, e de propósito sem número.** Duas tentativas puseram as horas de
     * luz no pacote como número e as duas foram revertidas: horas de luz são
     * redondas por natureza (julho dá 16, dezembro dá 8, todo ano), então a casa
     * decimal que devia compensar o custo no alfabeto não compensava, e o número
     * acrescentava inteiros pequenos a cadernos que não os tinham. Em palavras, a
     * luz custa zero no alfabeto e o modelo sabe a estação sem poder citar horas.
     *
     * Mora em `periodo`, e não em `textos` de caderno, porque é propriedade do
     * **período**: agosto é claro em Sono e em Movimento pelo mesmo motivo. Aqui
     * ela está nos quatro pacotes por construção — é o mesmo objeto —, o prompt
     * a escreve uma vez, e caderno vazio continua vazio.
     *
     * `null` para `year` e `all`: um período que cobre todas as estações não tem
     * estação a relatar.
     */
    luz: TextoDaLuz | null;
  };
  metricas: FatoNumero[];
  tendencias: FatoTendencia[];
  textos: FatoTexto[];
  /**
   * As métricas deste caderno que pararam de chegar até o fim do período —
   * as do período e as antigas. Ordenadas pela data da última medida.
   */
  lapides: FatoLapide[];
  cobertura: Cobertura | null;
  correlacoes: CorrelacaoFato[];
  eventos: EventoFato[];
  lacunas: LacunaFato[];
  /**
   * O caderno não teve nada no período. **Declarado, não omitido**: o pacote
   * existe e diz que está vazio.
   *
   * Conta como conteúdo a **lápide do período** — o mês em que o relógio para é
   * justamente o mês sem dado, e sem isso a lápide seria apagada exatamente
   * quando importa. A lápide **antiga** não conta: sensor morto não ressuscita
   * sozinho, e ela encheria o caderno para sempre.
   *
   * `semDado` não é o vazio inteiro — quem decide se o caderno vira seção é
   * {@link cadernoVazio}, que também olha cobertura, lacunas, eventos e
   * correlações.
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

/**
 * O texto de cada estação de luz — **sem dígito, sem vocabulário de base, sem
 * nome de mês**.
 *
 * As três restrições são da quinta regra da conferência, e cada uma já cobrou o
 * seu preço numa tentativa anterior: dígito vira número fora do alfabeto;
 * *"ano passado"*, *"período anterior"* ou *"normal"* são o que a regra procura
 * para decidir de que base é o número mais próximo, e capturavam números de
 * outra base mesmo com a nomeação certa na frase; nome de mês que não é o do
 * período nem o do anterior é acusado como nome errado. `verificar.test.ts`
 * varre estes textos contra o vocabulário inteiro.
 */
/**
 * Os três textos possíveis da luz, como TIPO — e não `string`.
 *
 * É a guarda mais barata que existe contra a luz voltar a ter número: com o
 * campo tipado assim, `periodo.luz = '14,5 h de luz'` é erro de compilação, e não
 * uma asserção de teste que alguém pode esquecer de rodar.
 */
export type TextoDaLuz = 'dias curtos' | 'dias em transição' | 'dias longos';

export const TEXTO_DA_ESTACAO: Readonly<Record<EstacaoDaLuz, TextoDaLuz>> = Object.freeze({
  curtos: 'dias curtos',
  transicao: 'dias em transição',
  longos: 'dias longos',
});

/**
 * A luz de um período, em palavras — ou `null` quando ele não tem estação.
 *
 * `year` e `all` cobrem todas as estações: a média de um ano cai sempre no meio,
 * e dizer *"dias em transição"* sobre 2025 inteiro seria falso. A ausência é
 * declarada, não esquecida.
 */
export function textoDaLuz(tipo: PeriodKind, inicioISO: string, fimISO: string): TextoDaLuz | null {
  if (tipo === 'year' || tipo === 'all') return null;
  const e = estacaoDaLuz(inicioISO, fimISO);
  return e == null ? null : TEXTO_DA_ESTACAO[e];
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
  /** Primeiro dia do período anterior — a fronteira do portão de nascimento. */
  inicioAnterior: string | null;
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
  /**
   * O menor lado da comparação com B1, em observações — ver
   * {@link FatoNumero.amostra}. **Obrigatório**: sem default, cada chamada tem
   * que dizer de onde o seu número veio.
   */
  amostra: number | null;
  /** `false` só para o que nasceu depois do início do anterior. Padrão: `true`. */
  comparavel?: boolean;
}

/**
 * O menor lado de uma contagem — *"a própria contagem"*: 7 saídas contra 11 dão
 * amostra 7. Os valores são contagens cruas, antes de qualquer escala.
 */
function menorLado(r: RecapValue | undefined): number | null {
  return r == null ? null : Math.min(r.current, r.prior);
}

/**
 * O menor lado de uma média de saúde ou de nota: os dias com valor de cada lado.
 * Sem `nAnterior` o outro lado é desconhecido, e desconhecido não é pequeno nem
 * grande — é `null`, que o portão recusa.
 */
function diasDe(m: MetricRecap | null): number | null {
  return m == null || m.nAnterior == null ? null : Math.min(m.n, m.nAnterior);
}

/**
 * O portão de nascimento: nasceu até o primeiro dia do período anterior?
 *
 * Criado **no** primeiro dia ainda cobre o anterior inteiro; criado no dia
 * seguinte já não cobre. Sem data de criação, ou sem período anterior (`all`),
 * não há o que amputar.
 *
 * **Só `YYYY-MM-DD` de calendário é data de nascimento.** Qualquer outra forma é
 * "não se sabe", e não se sabe não passa. Cair em comparável seria o silêncio
 * decidindo a favor da manchete: `"20/05/2026"` comparado como texto contra
 * `"2026-05-01"` sai sempre maior ou sempre menor, nunca certo. E carimbo com
 * hora também não serve, nem cortado: `…T22:30:00Z` cortado é o dia **UTC**, e a
 * fronteira do anterior é o dia **local** — em Bruxelas, um hábito criado às
 * 00h30 de 1º de maio carimba 30 de abril.
 *
 * Pelo mesmo motivo, período com anterior cujo início não se conseguiu calcular
 * também não passa: há um lado a amputar, e não se sabe onde ele começa.
 */
function nascidoAntes(createdOn: string | undefined, ctx: Ctx): boolean {
  if (!createdOn) return true;
  if (!isValidDate(createdOn)) return false;
  if (!ctx.temB1) return true;
  if (ctx.inicioAnterior == null) return false;
  return createdOn <= ctx.inicioAnterior;
}

/**
 * Os dois campos que só o ranqueamento lê. Sem período anterior (`all`) não há
 * comparação com B1, e portanto não há lado menor: a amostra é `null`.
 */
function portaoDo(o: OpcoesFato, ctx: Ctx): Pick<FatoNumero, 'amostra' | 'comparavel'> {
  return { amostra: ctx.temB1 ? o.amostra : null, comparavel: o.comparavel ?? true };
}

/**
 * `RecapValue` → `FatoNumero`, aplicando `escala` antes de arredondar.
 * A conversão de unidade mora aqui, não no prompt.
 */
function deRecap(
  chave: string, rotulo: string, r: RecapValue | undefined, ctx: Ctx, o: OpcoesFato,
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
    ...portaoDo(o, ctx),
  };
}

/** `MetricRecap` → `FatoNumero`. Preserva `null` — ausência não vira zero. */
function deMetrica(
  chave: string, rotulo: string, m: MetricRecap | null, ctx: Ctx, o: OpcoesFato,
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
    ...portaoDo(o, ctx),
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
  // A amostra conta observações QUE CARREGAM A MEDIDA. O tempo é soma de sessões
  // — toda sessão tem tempo. A distância é soma das sessões COM distância: 333 km
  // em 7 saídas é um fato sobre 7 observações, mas um rolo sem sensor é sessão
  // sem quilômetro. A elevação não se sabe: uma rota que não sincronizou vira
  // "−100%" com as sessões inteiras de amostra, e falha de sincronização não é
  // notícia — `null`, que não disputa.
  const sessoes = menorLado(s.sessions);
  return [
    deRecap(`${prefixo}.sessoes`, 'Sessões', s.sessions, ctx, { grupo, amostra: sessoes }),
    deRecap(`${prefixo}.distancia`, 'Distância', s.distanceM, ctx, {
      unidade: 'km', escala: 1 / 1000, grupo, amostra: menorLado(s.sessionsWithDistance),
    }),
    deRecap(`${prefixo}.tempo`, 'Tempo em movimento', s.movingS, ctx, {
      unidade: 'h', casas: 1, escala: 1 / 3600, grupo, amostra: sessoes,
    }),
    deRecap(`${prefixo}.elevacao`, 'Elevação', s.elevationM, ctx, { unidade: 'm', grupo, amostra: null }),
  ];
}

function habitos(
  grupo: string, linhas: readonly RetroHabitRow[], ctx: Ctx,
): FatoNumero[] {
  return linhas.map((h) => deRecap(`habito.${h.id}`, h.name, h.recap, ctx, {
    unidade: 'dias', grupo, amostra: menorLado(h.recap), comparavel: nascidoAntes(h.createdOn, ctx),
  }));
}

function registros(linhas: readonly RetroRegistroRow[], ctx: Ctx): FatoNumero[] {
  return linhas.map((r) => deRecap(`registro.${r.id}`, r.name, r.recap, ctx, {
    unidade: 'dias', grupo: 'Registros', amostra: menorLado(r.recap), comparavel: nascidoAntes(r.createdOn, ctx),
  }));
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
  /** Cidades, piso — por caderno. */
  textos?: Partial<Record<CadernoId, readonly FatoTexto[]>>;
  /**
   * As métricas que pararam de chegar, **prontas**: métrica e data da última
   * medida. Quem morreu não é decidido aqui — o pacote não consulta banco nem
   * fixa limiar de silêncio. Não vem por caderno: o caderno de cada uma é do
   * mapa do catálogo (`LAPIDES`), e não de quem chama.
   *
   * Ausente — o que o celular manda hoje — é nenhuma lápide. O que fica
   * **invariante** sem lápide é o `usuario` da edição de agosto, byte a byte (o
   * golden de `pacote.test.ts`, capturado antes da Story 1.7). O que mudou para
   * **todos**, com ou sem lápide: o `sistema` ganhou a linha da FORMA sobre a
   * lápide (`PROMPT_VERSAO` 5), e o caderno de borda — só lacuna, evento ou
   * correlação, sem seção própria — passou a ter o cabeçalho `### Nome` na
   * edição. O pacote em si também não é o mesmo: todo fato ganhou `amostra` e
   * `comparavel`, que o prompt não lê.
   */
  lapides?: readonly FatoLapide[];
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
 * seção é {@link cadernoVazio}, que o ranqueamento e o prompt leem, não a
 * montagem.
 */
export function montarPacotes(entrada: EntradaPacote): PacoteDeFatos[] {
  const { resumo, agora } = entrada;
  const diasNoPeriodo = diasEntre(resumo.startISO, resumo.endISO);
  const ctx: Ctx = {
    temB1: resumo.kind !== 'all',
    externas: entrada.bases ?? {},
    inicioAnterior: previousPeriodStartISO(resumo.kind, resumo.startISO),
  };

  const metricas = vazioPorCaderno<FatoNumero>();
  const cobertura: Record<CadernoId, Cobertura | null> = {
    sono: null, movimento: null, coracao: null, rotina: null,
  };

  // ── Movimento ──
  // O tempo do caderno é soma de ATIVIDADES — toda atividade tem tempo, e a
  // amostra dele é a contagem. A distância é soma só das atividades COM
  // distância: ioga e força não têm, e fevereiro/2026 teve 8 atividades e 2 com
  // distância — o "+971%" de março se apoiava em 2, não em 8. Passos e andares
  // são somas diárias do relógio, e ninguém sabe quantos dias de cada lado os
  // produziram: `null`, que não disputa.
  const atividades = menorLado(resumo.fitness.count);
  metricas.movimento.push(
    deRecap('atividades', 'Atividades', resumo.fitness.count, ctx, { amostra: atividades }),
    deRecap('distancia', 'Distância', resumo.fitness.distanceM, ctx, {
      unidade: 'km', escala: 1 / 1000, amostra: menorLado(resumo.fitness.countWithDistance),
    }),
    deRecap('tempo', 'Tempo', resumo.fitness.durationS, ctx, {
      unidade: 'h', casas: 1, escala: 1 / 3600, amostra: atividades,
    }),
    deRecap('passos_dia', 'Passos por dia', resumo.fitness.steps, ctx, {
      escala: diasNoPeriodo > 0 ? 1 / diasNoPeriodo : 1, amostra: null,
    }),
    deRecap('andares', 'Andares', resumo.fitness.floors, ctx, { amostra: null }),
    ...esporte('Ciclismo', 'ciclismo', resumo.sports.cycling, ctx),
    ...esporte('Corrida', 'corrida', resumo.sports.running, ctx),
  );

  // ── Saúde se parte: sono para Sono, o resto para Coração ──
  for (const l of resumo.health) {
    const alvo = cadernoDaMetricaDeSaude(l.metric);
    metricas[alvo].push(
      deMetrica(l.metric, l.label, l.recap, ctx, {
        unidade: l.unit, casas: l.decimals, amostra: diasDe(l.recap),
      }),
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
    metricas.sono.push(deMetrica('nota_sono', 'Nota de sono', resumo.ratings.sleep, ctx, {
      casas: 2, amostra: diasDe(resumo.ratings.sleep),
    }));
  }
  if (resumo.ratings.day) {
    metricas.rotina.push(deMetrica('nota_dia', 'Nota do dia', resumo.ratings.day, ctx, {
      casas: 2, amostra: diasDe(resumo.ratings.day),
    }));
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
  // As compras têm a amostra da própria contagem. O gasto é soma só das compras
  // COM PREÇO — a mesma regra da distância: compra sem preço não carrega gasto,
  // e 8 compras com 1 preço não sustentam "gasto +1780%" com amostra 8.
  metricas.rotina.push(
    ...habitos('Hábitos bons', resumo.habits.good, ctx),
    ...habitos('Hábitos ruins', resumo.habits.bad, ctx),
    ...registros(resumo.registros, ctx),
    deRecap('tarefas', 'Tarefas concluídas', resumo.tasks.total, ctx, {
      grupo: 'Dia a dia', amostra: menorLado(resumo.tasks.total),
    }),
    deRecap('compras', 'Compras', resumo.purchases.count, ctx, {
      grupo: 'Dia a dia', amostra: menorLado(resumo.purchases.count),
    }),
    deRecap('gasto', 'Gasto', resumo.purchases.spend, ctx, {
      casas: 2, grupo: 'Dia a dia', amostra: menorLado(resumo.purchases.countWithPrice),
    }),
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

  const lapides = lapidesPorCaderno(entrada.lapides ?? [], resumo.endISO);

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
    // Texto também — e pelo mesmo motivo. Ver `PacoteDeFatos.periodo.luz`.
    luz: textoDaLuz(resumo.kind, resumo.startISO, resumo.endISO),
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
      lapides: lapides[id],
      cobertura: cobertura[id],
      correlacoes: correlacoes[id],
      eventos: eventos[id],
      lacunas: lacunas[id],
      // `atual == null` é "não foi medido", e um caderno só de nulos não tem
      // dado — mas o fato fica no pacote, porque a base dele ainda é história
      // ("no mês passado eram 48 bpm") e some-la seria o silêncio de novo.
      //
      // A lápide DO PERÍODO é conteúdo; a antiga não é. Ver `semDado`.
      semDado: m.every((f) => f.atual == null) && tendencias.length === 0 && textos.length === 0
        && !temLapideDoPeriodo(lapides[id], periodo),
    };
  });
}

/**
 * As lápides da entrada, cada uma no caderno do mapa (`LAPIDES`) — que é também o
 * de `cadernoDaMetricaDeSaude`: VO₂max e anéis são de Movimento pelas duas
 * rotas, e `cadernos.test.ts` cobra que elas não se separem.
 *
 * Fica de fora a morte **posterior** ao fim do período: em julho, os anéis de
 * 17/08 ainda estavam vivos. A do último dia fica. Ordena pela data e, no mesmo
 * dia, pela ordem do mapa — o pacote é função do conjunto de lápides, não da
 * ordem em que o chamador as listou.
 *
 * Entrada malformada **explode**: uma data que não é dia de calendário viraria
 * texto sem sentido no prompt ("30 de fevereiro", ou um erro de tipo no décimo
 * terceiro mês), e uma métrica repetida poria duas lápides da mesma morte no
 * mesmo caderno. Nenhuma das duas é coisa para calar.
 */
function lapidesPorCaderno(entrada: readonly FatoLapide[], fimISO: string): PorCaderno<FatoLapide> {
  const out = vazioPorCaderno<FatoLapide>();
  const vistas = new Set<MetricaComLapide>();
  for (const l of entrada) {
    conferirLapide(l);
    if (vistas.has(l.metrica)) throw new Error(`lápide repetida: ${l.metrica}`);
    vistas.add(l.metrica);
    if (l.ultimaMedidaISO > fimISO) continue;
    out[LAPIDES[l.metrica].caderno].push({ metrica: l.metrica, ultimaMedidaISO: l.ultimaMedidaISO });
  }
  const ordem = (m: MetricaComLapide) => METRICAS_COM_LAPIDE.indexOf(m);
  for (const id of CADERNO_IDS) {
    out[id].sort((a, b) => a.ultimaMedidaISO.localeCompare(b.ultimaMedidaISO) || ordem(a.metrica) - ordem(b.metrica));
  }
  return out;
}

/**
 * A lápide em si: métrica do catálogo e data de calendário — o que vale para
 * toda lápide, esteja ela na entrada ou num pacote.
 */
function conferirLapide(l: FatoLapide): void {
  if (!isMetricaComLapide(l.metrica)) throw new Error(`lápide de métrica fora do catálogo: ${String(l.metrica)}`);
  if (!isValidDate(l.ultimaMedidaISO)) {
    throw new Error(`lápide de ${l.metrica} com data impossível: "${l.ultimaMedidaISO}" não é um dia YYYY-MM-DD do calendário`);
  }
}

/**
 * As lápides de um pacote estão certas — **dono único** da validação, para todo
 * pacote, montado aqui ou à mão.
 *
 * `montarPacotes` só produz lápide válida, mas o prompt e o ranqueamento recebem
 * pacote de qualquer origem, e cada defeito aqui falhava longe da causa: métrica
 * fora do catálogo virava erro de tipo opaco no prompt; lápide posterior ao fim
 * saía como "antes deste período" — uma morte que ainda não aconteceu, narrada
 * como antiga —; lápide de outro caderno punha na frente da edição o caderno
 * errado. Confere, lápide a lápide: métrica do catálogo, data de calendário,
 * última medida até o fim do período, e o caderno dela. Explode com mensagem que
 * diz qual e por quê.
 *
 * Chamada em `montar()` (a porta dos dois grãos do prompt) e no `validar` de
 * `ordenarCadernos`; `lapidesPorCaderno` reusa a parte que cabe à entrada.
 */
export function validarLapides(p: PacoteDeFatos): void {
  const vistas = new Set<MetricaComLapide>();
  for (const l of p.lapides) {
    conferirLapide(l);
    if (l.ultimaMedidaISO > p.periodo.fimISO) {
      throw new Error(
        `lápide de ${l.metrica} posterior ao fim do período: ${l.ultimaMedidaISO} é depois de ${p.periodo.fimISO} `
        + '— a métrica ainda não tinha parado neste período',
      );
    }
    const dono = LAPIDES[l.metrica].caderno;
    if (dono !== p.caderno) {
      throw new Error(`lápide de ${l.metrica} no caderno ${p.caderno}, mas ela é do caderno ${dono}`);
    }
    if (vistas.has(l.metrica)) throw new Error(`lápide repetida no caderno ${p.caderno}: ${l.metrica}`);
    vistas.add(l.metrica);
  }
}

/**
 * A lápide é **do período**: a última medida cai dentro dele, com os dois
 * extremos inclusivos.
 *
 * É a condição testável de quando a lápide lidera: nas edições do período em
 * que a métrica parou — o mês, e o trimestre e o ano que o contêm — e nunca
 * mais. Agosto/2026 é o mês em que os anéis pararam, setembro não é. Sem ela a
 * lápide lideraria toda edição para sempre — e depois da terceira o leitor para
 * de ver.
 */
export function lapideDoPeriodo(
  l: FatoLapide, periodo: Pick<PacoteDeFatos['periodo'], 'inicioISO' | 'fimISO'>,
): boolean {
  return l.ultimaMedidaISO >= periodo.inicioISO && l.ultimaMedidaISO <= periodo.fimISO;
}

/**
 * Alguma destas lápides é do período? — o passo 5, com **dono único**.
 *
 * Três leitores fazem esta pergunta: `semDado` na montagem, {@link cadernoVazio}
 * (a lápide vence o vazio) e o ranqueamento (a lápide vai para a frente). Três
 * cópias do mesmo `some(…)` são três chances de um deles passar a contar a
 * lápide antiga.
 */
export function temLapideDoPeriodo(
  lapides: readonly FatoLapide[], periodo: Pick<PacoteDeFatos['periodo'], 'inicioISO' | 'fimISO'>,
): boolean {
  return lapides.some((l) => lapideDoPeriodo(l, periodo));
}

/**
 * O caderno não tem nada a dizer — e por isso **não entra na edição**.
 *
 * ## Dono único do vazio
 *
 * A mesma função decide o passo 6 do ranqueamento (`ia/ranqueamento.ts`, o
 * caderno sai da lista) e o prompt mudo (`ia/prompt.ts`, nos dois grãos). Duas
 * definições de vazio produziriam o pior dos casos: um caderno na ordem da
 * edição sem texto para ocupar a posição, ou um texto pago para um caderno que a
 * edição não mostra.
 *
 * ## O que é vazio
 *
 * `semDado`, e também nada que a regra obrigue a dizer: cobertura (a regra 8
 * pode exigir ressalva de um caderno sem uma métrica), lacunas, eventos e
 * correlações. Um caderno de Sono com 31 dias de lacuna não é vazio — é cego, e
 * cego se diz.
 *
 * ## A lápide vence o vazio (passo 5 sobre o passo 6)
 *
 * A lápide **do período** faz o caderno existir, mesmo sendo o único conteúdo
 * dele: a alternativa é a revista ficar cega sobre a própria cegueira. A
 * condição está em `semDado` e é repetida aqui de propósito — é a regra que esta
 * função possui, e um pacote montado à mão com `semDado` errado não pode calar a
 * lápide do mês em que ela morreu. A lápide **antiga** não ressuscita nada.
 */
export function cadernoVazio(p: PacoteDeFatos): boolean {
  return p.semDado
    && !temLapideDoPeriodo(p.lapides, p.periodo)
    && p.cobertura == null
    && p.lacunas.length === 0 && p.eventos.length === 0 && p.correlacoes.length === 0;
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
