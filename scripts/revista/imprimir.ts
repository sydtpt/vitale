/**
 * Imprime a edição de um período fechado **fora do telefone** — e ela é a mesma que
 * o telefone imprimiria (Story 2.2).
 *
 *     pnpm --filter @vitale/scripts revista:imprimir --tipo month --inicio 2026-05-01 --sem-gravar
 *
 * ## O que este arquivo faz, e o que ele não faz
 *
 * **Não reimplementa nada.** A entrada sai de `entradaDaRetrospectiva` (a mesma conta
 * da store do celular, no núcleo), a sequência é `imprimir` (o orquestrador por
 * caderno, a conferência, a ordem e a gravação numa chamada), e a gravação é
 * `portasDaEdicao` — a única porta para a função do banco, com a guarda da conta e a
 * do conjunto de cadernos. Aqui só se injeta: a sessão (a da bancada, JWT de usuário
 * vindo do ambiente, nunca chave de serviço), o transporte da nuvem (o de
 * `bancada/motores.ts`, o único arquivo de `scripts/` que nomeia a function) e as
 * portas. Não há cliente da function, leitura de corpo de erro nem tradução de classe
 * neste arquivo — é o núcleo quem faz isso.
 *
 * **A cadeia é a padrão do descritor** — a do telefone sem preferência. Não há
 * `--motor` nem `--cadernos`: a edição que este script grava tem de ser a que o
 * iPhone gravaria, e uma escolha de motor ou de caderno aqui seria uma segunda
 * edição possível para o mesmo período.
 *
 * **A capa não é carimbada.** `edicoes_capa` não é tocada: o carimbo da impressão
 * em massa é da story 2.3. Uma edição impressa por aqui abre no iPhone sem capa, e a
 * primeira impressão parcial do telefone a carimba.
 *
 * ## O que sai no terminal
 *
 * Contagens, hashes e a forma — **nunca o texto**. O texto de um caderno é leitura de
 * saúde, e mora no banco (ou na tela do iPhone). O hash de cada caderno é o do pedido
 * (AD-11): o mesmo pedido no iPhone tem o mesmo hash, e é por ele que as duas
 * impressões se comparam. Ele sai do anel (`registrar`), pareado ao caderno pelo
 * aviso de início (`aoComecar`).
 *
 * ## O fuso
 *
 * O período e as datas locais saem do relógio desta máquina, como no iPhone saem do
 * dele. O cabeçalho diz qual fuso foi usado, com o deslocamento **de agora** (não o do
 * período: um mês de inverno impresso no verão mostra o do verão): rodar com
 * `TZ=Europe/Brussels` é o que garante que o dia de uma tarefa concluída às 00:30 caia
 * no mesmo dia dos dois lados. Um `TZ` com o nome errado não dá erro no Node — o
 * processo cai para UTC calado —, então o script o recusa antes de abrir rede.
 */
import {
  AGG_VERSION,
  CADERNO_IDS,
  descritorDaRetrospectiva,
  entradaDaRetrospectiva,
  fetchActivities,
  fetchDadosDaRetro,
  fetchEdicao,
  hashCurto,
  imprimir,
  localDateStr,
  offsetDoInicio,
  periodBounds,
  periodoFechado,
  portasDaEdicao,
  resolverCadeia,
  retroSince,
  type CadernoId,
  type CadernoImpresso,
  type DesfechoDoCaderno,
  type EventoDoAnel,
  type Impressao,
  type Motor,
  type MotorId,
  type PeriodoDaEdicao,
  type PortasDaImpressao,
  type ResultadoDaImpressao,
  type TipoComEdicao,
} from '@vitale/shared';
import { PRAZO_MS, motoresDaBancada, type Buscar } from '../bancada/motores.ts';
import {
  abrirSessao,
  avisoDeValidade,
  comoExportar,
  comoSeAutenticar,
  lerCredenciais,
  type Ambiente,
  type ClientDoNucleo,
  type Credenciais,
  type Sessao,
} from '../bancada/supabase.ts';

/* ── as bandeiras ────────────────────────────────────────────────────────── */

/** Os tipos de período com edição, como a tabela os grava e como a rota da revista os escreve. */
const TIPOS: Readonly<Record<string, TipoComEdicao>> = Object.freeze({
  week: 'week',
  semana: 'week',
  month: 'month',
  mes: 'month',
  season: 'season',
  estacao: 'season',
  year: 'year',
  ano: 'year',
});

const NOME_DO_TIPO: Readonly<Record<TipoComEdicao, string>> = { week: 'semana', month: 'mês', season: 'estação', year: 'ano' };
const UM_PERIODO: Readonly<Record<TipoComEdicao, string>> = {
  week: 'uma semana (ela começa na segunda-feira)',
  month: 'um mês',
  season: 'um trimestre (janeiro, abril, julho ou outubro)',
  year: 'um ano',
};

/** A fonte única das bandeiras: a leitura e o `--ajuda` saem desta lista. */
const BANDEIRAS = [
  { nome: '--tipo', arg: '<tipo>', ajuda: 'month, season, year ou week — ou mes, estacao, ano, semana, como na rota da revista' },
  { nome: '--inicio', arg: 'AAAA-MM-DD', ajuda: 'o primeiro dia do período (2026-05-01 é maio; 2026-04-01, o 2º trimestre)' },
  { nome: '--sem-gravar', arg: null, ajuda: 'chama o modelo e confere, mas não grava nada: compara o que gravaria com o banco' },
  { nome: '--reimprimir', arg: null, ajuda: 'imprime de novo um período que já tem edição (os quatro cadernos)' },
  { nome: '--ajuda', arg: null, ajuda: 'mostra isto (também --help)' },
] as const;

export function ajuda(): string {
  const rotulo = (b: (typeof BANDEIRAS)[number]): string => (b.arg ? `${b.nome} ${b.arg}` : b.nome);
  const largura = Math.max(...BANDEIRAS.map((b) => rotulo(b).length));
  return [
    'revista:imprimir — imprime a edição de um período fechado, a mesma que o iPhone imprimiria.',
    '',
    ...BANDEIRAS.map((b) => `  ${rotulo(b).padEnd(largura)}  ${b.ajuda}`),
    '',
    'Rode antes com --sem-gravar. Cada caderno é uma chamada paga à nuvem, pela cadeia padrão',
    'da revista (a do iPhone sem preferência). O terminal mostra contagens e hashes, nunca o texto.',
    'O fuso é o desta máquina: use o do iPhone (TZ=Europe/Brussels). A capa não é carimbada.',
    'Não imprima o mesmo período pelo iPhone ao mesmo tempo.',
  ].join('\n');
}

export interface Bandeiras {
  readonly tipo: TipoComEdicao | null;
  readonly inicio: string | null;
  readonly semGravar: boolean;
  readonly reimprimir: boolean;
  readonly ajuda: boolean;
}

/** O valor de uma bandeira. Vazio é recusado junto com o ausente — `--inicio "$X"` sem `X`. */
function valorDe(argv: readonly string[], i: number, bandeira: string): string {
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--') || v.trim() === '') throw new Error(`${bandeira} precisa de um valor`);
  return v;
}

/** Lê as bandeiras, ou lança dizendo qual está errada. Não confere o período — isso é de {@link validarPeriodo}. */
export function lerBandeiras(argv: readonly string[]): Bandeiras {
  let tipo: TipoComEdicao | null = null;
  let inicio: string | null = null;
  let semGravar = false;
  let reimprimir = false;
  let pedeAjuda = false;
  // Repetida é recusada: "a última ganha" imprimiria um período que ninguém pediu.
  const vistas = new Set<string>();
  const umaVez = (nome: string): void => {
    if (vistas.has(nome)) throw new Error(`${nome} aparece mais de uma vez`);
    vistas.add(nome);
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === undefined) continue;
    switch (a) {
      case '--tipo': {
        umaVez(a);
        const cru = valorDe(argv, i, a);
        const lido = Object.prototype.hasOwnProperty.call(TIPOS, cru) ? TIPOS[cru] : undefined;
        if (lido === undefined) {
          throw new Error(
            cru === 'all' || cru === 'total'
              ? `--tipo ${cru}: o Total nunca fecha, e período que não fecha não tem edição`
              : `--tipo ${cru} não é tipo de período com edição (${Object.keys(TIPOS).join(', ')})`,
          );
        }
        tipo = lido;
        i += 1;
        break;
      }
      case '--inicio':
        umaVez(a);
        inicio = valorDe(argv, i, a);
        i += 1;
        break;
      case '--sem-gravar':
        umaVez(a);
        semGravar = true;
        break;
      case '--reimprimir':
        umaVez(a);
        reimprimir = true;
        break;
      case '--ajuda':
      case '--help':
        pedeAjuda = true;
        break;
      default:
        throw new Error(`bandeira desconhecida: ${a}`);
    }
  }
  return { tipo, inicio, semGravar, reimprimir, ajuda: pedeAjuda };
}

/* ── o período ───────────────────────────────────────────────────────────── */

export interface PeriodoPedido {
  readonly tipo: TipoComEdicao;
  readonly inicio: string;
  readonly fim: string;
  readonly offset: number;
  readonly rotulo: string;
}

/**
 * O período pedido, se ele pode ter edição **agora** — ou por que não pode. Puro, e
 * roda antes de qualquer rede: pelo mesmo `offsetDoInicio` e `periodoFechado` que a
 * rota da revista usa.
 */
export function validarPeriodo(
  tipo: TipoComEdicao,
  inicio: string,
  agora: Date,
): { readonly ok: true; readonly periodo: PeriodoPedido } | { readonly ok: false; readonly motivo: string } {
  // A forma primeiro: `2026-5-1`, `2026-05` e `05/2026` não são um dia, e a mensagem
  // de "não abre período" seria a errada para eles.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) {
    return { ok: false, motivo: `--inicio ${inicio} não é uma data AAAA-MM-DD` };
  }
  const offset = offsetDoInicio(agora, tipo, inicio);
  if (offset === null) {
    return { ok: false, motivo: `${inicio} não abre ${UM_PERIODO[tipo]} — o início tem de ser o primeiro dia do período` };
  }
  const b = periodBounds(agora, tipo, offset);
  const fim = localDateStr(new Date(b.end.getFullYear(), b.end.getMonth(), b.end.getDate() - 1));
  if (!periodoFechado(tipo, fim, agora)) {
    return {
      ok: false,
      motivo: `${b.label} (${inicio} a ${fim}) ainda não fechou em ${localDateStr(agora)} — período em curso não tem edição`,
    };
  }
  return { ok: true, periodo: { tipo, inicio, fim, offset, rotulo: b.label } };
}

/* ── a impressão ─────────────────────────────────────────────────────────── */

export interface PedidoDeImpressao {
  readonly periodo: PeriodoPedido;
  readonly semGravar: boolean;
  readonly reimprimir: boolean;
}

/** O que a impressão precisa do mundo — injetável, para o teste rodar sem rede. */
export interface DepsDaImpressao {
  readonly db: ClientDoNucleo;
  readonly userId: string;
  readonly motorPara: (id: MotorId) => Motor | undefined;
  /** O relógio do período e da janela — lido uma vez, no começo. */
  readonly agora: Date;
  /** O relógio das tentativas (o tempo de cada chamada, no anel). */
  readonly relogio?: () => Date;
  readonly escrever: (linha: string) => void;
  readonly avisar: (linha: string) => void;
}

/** Um caderno da impressão, como o terminal o mostra. */
export interface CadernoNoTerminal {
  readonly caderno: CadernoId;
  /** `escrito`, `incompleto`, ou a causa do piso (`reprovada`, `transitoria`, `mudo`…). */
  readonly desfecho: string;
  /** O hash do pedido — `null` quando nenhum pedido saiu. */
  readonly hash: string | null;
  /** A métrica que liderou, se o caderno tem linha nesta impressão. */
  readonly metricaLider: string | null;
  readonly caracteres: number | null;
}

/** Uma linha da comparação do `--sem-gravar`: o que seria gravado contra o que está no banco. */
export interface LinhaDaComparacao {
  readonly caderno: CadernoId;
  readonly campo: string;
  readonly novo: string;
  readonly banco: string;
  readonly igual: boolean;
}

/**
 * Os três destinos dos cadernos de uma impressão que grava (ou gravaria).
 *
 * - `escritos`: um motor escreveu agora, a conferência aprovou, e o texto novo vai
 *   à função;
 * - `mantidos`: já estavam impressos, e caíram no piso nesta impressão — ficam na
 *   ordem com o texto e a assinatura **de antes**, e com a `agg_version` de antes;
 * - `sairam`: estavam impressos e não estão na ordem nova — a função os apaga.
 */
export interface GruposDaImpressao {
  readonly escritos: readonly CadernoId[];
  readonly mantidos: readonly CadernoId[];
  readonly sairam: readonly CadernoId[];
}

export interface RelatorioDaImpressao {
  readonly codigo: 0 | 1;
  /**
   * O desfecho. `ensaio` é o `--sem-gravar` que **teria** gravado: a sequência chegou
   * à porta de gravação, e ela guardou a impressão em vez de chamar a função.
   */
  readonly estado: ResultadoDaImpressao<unknown>['estado'] | 'ensaio' | 'ja-impresso';
  readonly cadernos: readonly CadernoNoTerminal[];
  /** A ordem que a edição tem (gravada) ou teria (`--sem-gravar`). */
  readonly ordem: readonly CadernoId[];
  /** Só quando gravou, ou gravaria. */
  readonly grupos: GruposDaImpressao | null;
  /** Só no `--sem-gravar`. */
  readonly comparacao: readonly LinhaDaComparacao[] | null;
}

/** "rotina, movimento" — ou "nenhum". */
const lista = (cs: readonly string[]): string => (cs.length === 0 ? 'nenhum' : cs.join(', '));

/** "1 noite", "0 noites", "2 noites". */
const contar = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

function desfechoEmPalavra(d: DesfechoDoCaderno): string {
  if (d.tipo === 'nao-escrito') return d.leitura.causa;
  return d.tipo;
}

/** As regras que a conferência reprovou, contadas — o detalhe fica fora: ele pode citar o texto. */
function regrasReprovadas(d: DesfechoDoCaderno): string {
  if (d.tipo !== 'nao-escrito') return '';
  const regras = new Map<string, number>();
  for (const t of d.leitura.trilha) for (const p of t.problemas ?? []) regras.set(p.regra, (regras.get(p.regra) ?? 0) + 1);
  return [...regras].map(([r, n]) => `${r} ×${n}`).join(', ');
}

/** `+02:00`, `−03:00` — minutos a leste de UTC, como deslocamento. */
function emHoras(min: number): string {
  const abs = Math.abs(min);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${min < 0 ? '−' : '+'}${p(Math.floor(abs / 60))}:${p(abs % 60)}`;
}

/**
 * O fuso desta máquina, com o deslocamento **de agora** — o do instante em que o
 * script roda, e não o do período: maio impresso em dezembro mostra o de dezembro.
 */
export function fusoDe(agora: Date): string {
  const nome = Intl.DateTimeFormat().resolvedOptions().timeZone || 'desconhecido';
  return `${nome} (UTC${emHoras(-agora.getTimezoneOffset())} agora)`;
}

/**
 * O deslocamento (minutos a leste de UTC) de um fuso nomeado num instante. Lança se
 * o nome não é de um fuso que o sistema conhece — é a mesma recusa do `Intl`.
 */
function deslocamentoEm(fuso: string, instante: Date): number {
  const parte = new Intl.DateTimeFormat('en-US', { timeZone: fuso, timeZoneName: 'longOffset' })
    .formatToParts(instante)
    .find((x) => x.type === 'timeZoneName')?.value ?? '';
  // `GMT` sozinho é zero; senão, `GMT+02:00`, `GMT-03:30`.
  const m = /^GMT(?:([+\-−])(\d{1,2})(?::?(\d{2}))?)?$/.exec(parte);
  if (!m) throw new RangeError(`deslocamento ilegível para ${fuso}: ${parte}`);
  if (m[1] === undefined) return 0;
  const min = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === '+' ? min : -min;
}

/**
 * O `TZ` do ambiente, quando existe, é o fuso em que o processo de fato está? Ou por
 * que não.
 *
 * **O Node não recusa um `TZ` com o nome errado**: com `TZ=Europe/Bruxelas` o
 * processo roda em UTC, calado, e o período, o dia de cada tarefa e o de cada
 * atividade sairiam de outro relógio que o do iPhone — a edição deixaria de ser a
 * dele sem nada avisar. Então o nome tem de ser de um fuso que o `Intl` conhece, e o
 * deslocamento dele agora tem de ser o do processo. `TZ` ausente é aceito: vale o
 * fuso do sistema, e o cabeçalho diz qual é.
 *
 * `resolvido` é o fuso que o processo resolveu (`Intl…resolvedOptions().timeZone`,
 * que é `undefined` quando o `TZ` não se aplicou).
 */
export function problemaDoFuso(env: Ambiente, agora: Date, resolvido: string | undefined): string | null {
  const tz = env['TZ'];
  if (tz === undefined || tz.trim() === '') return null;
  // O `:` inicial é a grafia POSIX de "arquivo de fuso", e o Node a aceita.
  const nome = tz.replace(/^:/, '');
  const caiu = `o processo caiu para ${resolvido || 'UTC'} sem avisar`;
  let pedido: number;
  try {
    pedido = deslocamentoEm(nome, agora);
  } catch {
    return `TZ=${tz} não é um fuso que o sistema conheça, e ${caiu}. Confira o nome (Europe/Brussels, por exemplo).`;
  }
  if (!resolvido) return `TZ=${tz} não foi aplicado ao processo, e ${caiu}.`;
  const doProcesso = -agora.getTimezoneOffset();
  if (pedido !== doProcesso) {
    return `TZ=${tz} está em UTC${emHoras(pedido)} agora, e o processo está em UTC${emHoras(doProcesso)} (${resolvido}).`;
  }
  return null;
}

function tabela(linhas: readonly (readonly string[])[]): string[] {
  const larguras = linhas[0]?.map((_, c) => Math.max(...linhas.map((l) => (l[c] ?? '').length))) ?? [];
  return linhas.map((l) => l.map((x, c) => (c === l.length - 1 ? x : x.padEnd(larguras[c] ?? 0))).join('  ').trimEnd());
}

/** A comparação do `--sem-gravar`: o que a impressão gravaria, caderno a caderno, contra o banco. */
function comparar(impressao: Impressao | null, noBanco: readonly CadernoImpresso[]): LinhaDaComparacao[] {
  const ordem = impressao?.ordem ?? [];
  const linhaDe = new Map((impressao?.linhas ?? []).map((l) => [l.caderno, l]));
  const bancoDe = new Map(noBanco.map((c) => [c.caderno, c]));
  const out: LinhaDaComparacao[] = [];
  // Na ordem que a edição teria; depois, os que só o banco tem, na ordem gravada.
  const cadernos = [...ordem, ...noBanco.map((c) => c.caderno).filter((c) => !ordem.includes(c))];
  for (const caderno of cadernos) {
    const nova = linhaDe.get(caderno);
    const antiga = bancoDe.get(caderno);
    const naOrdem = ordem.indexOf(caderno);
    // Um caderno que fica na ordem sem ter sido regenerado — o motor caiu no piso —
    // mantém a linha do banco: a assinatura dele não muda, só a posição pode mudar.
    const mantido = naOrdem >= 0 && !nova && antiga !== undefined;
    const doBanco = (f: (c: CadernoImpresso) => string | number | null) => (antiga ? String(f(antiga) ?? 'nula') : '—');
    const daNova = (f: () => string | number | null) => (mantido ? 'mantida' : nova ? String(f() ?? 'nula') : '—');
    const campo = (nome: string, novo: string, banco: string) =>
      out.push({ caderno, campo: nome, novo, banco, igual: novo === banco || (novo === 'mantida' && banco !== '—') });
    campo('posição', naOrdem >= 0 ? String(naOrdem + 1) : '—', doBanco((c) => c.posicao));
    campo('provedor', daNova(() => nova!.provedor), doBanco((c) => c.provedor));
    campo('modelo', daNova(() => nova!.modelo), doBanco((c) => c.modelo));
    campo('prompt_versao', daNova(() => nova!.promptVersao), doBanco((c) => c.promptVersao));
    campo('pacote_versao', daNova(() => nova!.pacoteVersao), doBanco((c) => c.pacoteVersao));
    // A porta carimba a versão vigente da agregação em toda linha que grava.
    campo('agg_version', daNova(() => AGG_VERSION), doBanco((c) => c.aggVersionNoMomento));
    campo('métrica líder', daNova(() => nova!.metricaLider), doBanco((c) => c.metricaLider));
  }
  return out;
}

/**
 * O período já tinha edição quando a impressão o leu, e nenhuma bandeira mandou
 * imprimir por cima. Lançada **pelo `buscar`**, que a sequência chama antes do
 * primeiro `ler`: nada foi chamado, nada foi gravado.
 */
class JaImpresso extends Error {
  readonly cadernos: readonly CadernoId[];
  constructor(cadernos: readonly CadernoId[]) {
    super(`o período já tem edição (${cadernos.join(', ')})`);
    this.name = 'JaImpresso';
    this.cadernos = cadernos;
  }
}

function recusaDoJaImpresso(rotulo: string, cadernos: readonly CadernoId[]): string {
  return (
    `${rotulo} já tem edição (${lista(cadernos)}), e nada foi chamado.\n` +
    '  Para comparar o que sairia agora com o que está gravado, sem gravar: --sem-gravar.\n' +
    '  Para imprimir de novo, os quatro cadernos: --reimprimir.'
  );
}

/**
 * Os três destinos dos cadernos (ver {@link GruposDaImpressao}): os escritos agora, na
 * ordem da edição; os mantidos, que estão na ordem sem ter sido escritos; e os que
 * estavam impressos e ficaram fora dela.
 */
export function gruposDaImpressao(
  ordem: readonly CadernoId[],
  escritosAgora: readonly CadernoId[],
  impressosAntes: readonly CadernoId[],
): GruposDaImpressao {
  const escritos = ordem.filter((c) => escritosAgora.includes(c));
  return {
    escritos,
    mantidos: ordem.filter((c) => !escritos.includes(c)),
    sairam: impressosAntes.filter((c) => !ordem.includes(c)),
  };
}

/** A linha final: os três grupos, no tempo do verbo de quem gravou ou gravaria. */
function linhaDosGrupos(g: GruposDaImpressao, gravou: boolean): string {
  const [escreve, mantem, sai] = gravou ? ['gravou', 'manteve', 'saíram'] : ['gravaria', 'manteria', 'sairiam'];
  const mantidos = g.mantidos.length === 0
    ? 'nenhum'
    : `${lista(g.mantidos)} (com o texto e a assinatura de antes — a agg_version deles é a antiga)`;
  return `  ${escreve}: ${lista(g.escritos)} / ${mantem}: ${mantidos} / ${sai}: ${lista(g.sairam)}`
    + (gravou ? '' : ' — nada foi gravado');
}

/**
 * Imprime o período — ou, com `semGravar`, faz tudo menos gravar.
 *
 * Na ordem: lê a edição do banco (e recusa o período já impresso sem
 * `--reimprimir`/`--sem-gravar`, antes de ler o acervo e antes de chamar o modelo),
 * lê as nove leituras na janela `retroSince` e as atividades, monta a entrada pelo
 * núcleo e chama `imprimir` com as portas. Rejeita quando uma porta falha — inclusive
 * a guarda da impressão concorrente (`EdicaoMudouNaImpressao`) —, e nada foi gravado.
 *
 * **A recusa do já impresso é feita duas vezes, e a segunda é a que vale.** A
 * primeira, sobre a leitura do começo, só evita ler o acervo à toa. Entre ela e o
 * `buscar` da sequência há as leituras do acervo, e o telefone pode imprimir o mesmo
 * período nesse intervalo: por isso o `buscar` também recusa uma edição que não está
 * vazia — e ele roda antes do primeiro `ler`, então nada foi chamado. O mesmo `buscar`
 * é o que a comparação do `--sem-gravar` usa, e não a leitura do começo.
 */
export async function imprimirPeriodo(pedido: PedidoDeImpressao, deps: DepsDaImpressao): Promise<RelatorioDaImpressao> {
  const { periodo, semGravar, reimprimir } = pedido;
  const { db, userId, agora, escrever, avisar } = deps;
  const since = localDateStr(retroSince(agora, periodo.tipo, periodo.offset));
  const recusaOJaImpresso = !reimprimir && !semGravar;

  escrever(`imprimir — ${NOME_DO_TIPO[periodo.tipo]} ${periodo.inicio} a ${periodo.fim} (${periodo.rotulo})`);
  escrever(`  fuso: ${fusoDe(agora)} · agora: ${localDateStr(agora)} · janela: desde ${since}`);
  escrever(`  modo: ${semGravar ? 'sem gravar — nada vai ao banco' : 'grava a edição'} · capa: não é carimbada por aqui`);

  const noBanco = await fetchEdicao(db, userId, periodo.tipo, periodo.inicio, periodo.fim);
  escrever(`  no banco: ${noBanco.length} ${noBanco.length === 1 ? 'caderno impresso' : 'cadernos impressos'}${noBanco.length > 0 ? ` (${lista(noBanco.map((c) => c.caderno))})` : ''}`);
  if (noBanco.length > 0 && recusaOJaImpresso) {
    const cadernos = noBanco.map((c) => c.caderno);
    avisar(recusaDoJaImpresso(periodo.rotulo, cadernos));
    return { codigo: 1, estado: 'ja-impresso', cadernos: [], ordem: cadernos, grupos: null, comparacao: null };
  }

  const [dados, atividades] = await Promise.all([
    fetchDadosDaRetro(db, userId, since),
    fetchActivities(db, userId),
  ]);
  const ocultas = atividades.filter((a) => a.hidden).length;
  escrever(
    `  leitura: ${contar(dados.health.length, 'linha de saúde', 'linhas de saúde')} · ${contar(dados.ratings.length, 'nota', 'notas')} · ` +
      `${contar(dados.habits.length, 'hábito', 'hábitos')} (${contar(dados.habitLogs.length, 'marca', 'marcas')}) · ` +
      `${contar(dados.registros.length, 'registro', 'registros')} (${contar(dados.registroLogs.length, 'marca', 'marcas')}) · ` +
      `${contar(dados.templates.length, 'série', 'séries')} (${contar(dados.occurrences.length, 'concluída', 'concluídas')}) · ` +
      `${contar(dados.sleepPeriods.length, 'noite', 'noites')} · ${contar(atividades.length, 'atividade', 'atividades')} ` +
      `(${contar(ocultas, 'oculta', 'ocultas')}, fora)`,
  );

  const entrada = entradaDaRetrospectiva(dados, atividades, agora, periodo.tipo, periodo.offset);
  if (entrada.resumo.startISO !== periodo.inicio || entrada.resumo.endISO !== periodo.fim) {
    // O resumo e o período pedido saem da mesma conta; divergirem é defeito, não entrada.
    throw new Error(
      `o resumo montado é de ${entrada.resumo.startISO} a ${entrada.resumo.endISO}, e o pedido era ${periodo.inicio} a ${periodo.fim}`,
    );
  }

  // O hash de cada caderno: o anel recebe um evento por leitura, e o aviso de início diz de quem é.
  const hashes: Partial<Record<CadernoId, string>> = {};
  let lendo: CadernoId | null = null;
  const registrar = (evento: EventoDoAnel): void => {
    if (lendo !== null && evento.hash !== undefined) hashes[lendo] = evento.hash;
  };

  // As portas: as reais, com o `buscar` embrulhado. Ele passa pelas reais — é o que a
  // guarda de `portasDaEdicao` registra —, guarda o que leu, e recusa o já impresso.
  const reais = portasDaEdicao(db, userId);
  let lidoNoBuscar: CadernoImpresso[] | null = null;
  const buscar = async (p: PeriodoDaEdicao): Promise<CadernoImpresso[]> => {
    const edicao = await reais.buscar(p);
    lidoNoBuscar = edicao;
    if (edicao.length > 0 && recusaOJaImpresso) throw new JaImpresso(edicao.map((c) => c.caderno));
    return edicao;
  };
  let aGravar: Impressao | null = null;
  const portas: PortasDaImpressao<CadernoImpresso[]> = semGravar
    ? {
        buscar,
        // Sem gravar: a impressão que iria à função fica aqui, para a comparação.
        gravar: async (i) => {
          aGravar = i;
          return [];
        },
      }
    : { ...reais, buscar };

  let resultado: ResultadoDaImpressao<CadernoImpresso[]>;
  try {
    resultado = await imprimir(entrada, portas, {
      cadeia: resolverCadeia(descritorDaRetrospectiva, null, []),
      motorPara: deps.motorPara,
      registrar,
      agora: deps.relogio ?? (() => new Date()),
      aoComecar: (caderno, fila) => {
        lendo = caderno;
        escrever(`  lendo ${caderno} (${fila.indexOf(caderno) + 1} de ${fila.length})…`);
      },
    });
  } catch (e) {
    if (!(e instanceof JaImpresso)) throw e;
    // Impresso por outro hospedeiro enquanto o acervo era lido.
    avisar(recusaDoJaImpresso(periodo.rotulo, e.cadernos));
    return { codigo: 1, estado: 'ja-impresso', cadernos: [], ordem: e.cadernos, grupos: null, comparacao: null };
  }

  if (resultado.estado === 'aberto' || resultado.estado === 'sem-caderno') {
    avisar(
      resultado.estado === 'aberto'
        ? `${periodo.rotulo} não fechou para o núcleo — nada foi lido nem gravado.`
        : `nenhum caderno de ${periodo.rotulo} tem o que dizer — nada foi lido nem gravado.`,
    );
    return { codigo: 1, estado: resultado.estado, cadernos: [], ordem: [], grupos: null, comparacao: null };
  }

  const gravadas = resultado.estado === 'gravada' && !semGravar ? resultado.edicao : [];
  const impressao = aGravar as Impressao | null;
  const linhaDe = new Map((impressao?.linhas ?? []).map((l) => [l.caderno, l]));
  const cadernos: CadernoNoTerminal[] = resultado.desfechos.map(({ caderno, desfecho }) => {
    const gravado = gravadas.find((c) => c.caderno === caderno);
    const escrito = desfecho.tipo === 'escrito';
    return {
      caderno,
      desfecho: desfechoEmPalavra(desfecho),
      hash: hashes[caderno] ?? null,
      metricaLider: escrito ? (gravado?.metricaLider ?? linhaDe.get(caderno)?.metricaLider ?? null) : null,
      caracteres: escrito ? desfecho.leitura.frase.length : null,
    };
  });

  escrever('  cadernos, na ordem de leitura:');
  for (const l of tabela(
    resultado.desfechos.map(({ caderno, desfecho }, k) => {
      const c = cadernos[k]!;
      const regras = regrasReprovadas(desfecho);
      return [
        `    ${caderno}`,
        c.desfecho,
        c.hash === null ? '—' : hashCurto(c.hash),
        c.metricaLider === null ? 'líder —' : `líder ${c.metricaLider}`,
        c.caracteres === null ? (regras ? `(${regras})` : '') : `${c.caracteres} caracteres`,
      ];
    }),
  )) escrever(l);

  const lido: readonly CadernoImpresso[] = lidoNoBuscar ?? [];
  if (resultado.estado === 'nada-gravado') {
    avisar(`nenhum caderno de ${periodo.rotulo} passou — nada ${semGravar ? 'seria' : 'foi'} gravado, e nada foi apagado.`);
    return { codigo: 1, estado: resultado.estado, cadernos, ordem: lido.map((c) => c.caderno), grupos: null, comparacao: null };
  }

  const ordem: CadernoId[] = semGravar ? [...(impressao?.ordem ?? [])] : gravadas.map((c) => c.caderno);
  const escritosAgora = resultado.desfechos.filter((d) => d.desfecho.tipo === 'escrito').map((d) => d.caderno);
  const grupos = gruposDaImpressao(ordem, escritosAgora, lido.map((c) => c.caderno));
  escrever(`  ordem da edição: ${lista(ordem)}`);
  escrever(linhaDosGrupos(grupos, !semGravar));

  if (!semGravar) return { codigo: 0, estado: 'gravada', cadernos, ordem, grupos, comparacao: null };

  const comparacao = comparar(impressao, lido);
  if (lido.length === 0) {
    escrever('  comparação com o banco: o período não tem edição gravada, e não há com o que comparar.');
  } else {
    escrever('  comparação com o banco (o que gravaria | o que está gravado):');
    for (const l of tabela([
      ['    caderno', 'campo', 'novo', 'banco', ''],
      ...comparacao.map((c) => [`    ${c.caderno}`, c.campo, c.novo, c.banco, c.igual ? '' : '≠']),
    ])) escrever(l);
  }
  return { codigo: 0, estado: 'ensaio', cadernos, ordem, grupos, comparacao };
}

/* ── o executável ────────────────────────────────────────────────────────── */

/** O que o executável precisa do processo — injetável, para o teste percorrer as recusas. */
export interface Processo {
  readonly env: Ambiente;
  readonly agora: Date;
  readonly escrever: (linha: string) => void;
  readonly avisar: (linha: string) => void;
  /** Abre a sessão. Padrão: a da bancada. É o primeiro passo que abre rede. */
  readonly abrir?: (c: Credenciais) => Promise<Sessao>;
  /** A chamada HTTP da nuvem. Padrão: o `fetch` do Node. */
  readonly buscar?: Buscar;
  /** O fuso que o processo resolveu. Padrão: o do `Intl` — parâmetro só para o teste. */
  readonly fusoResolvido?: string | undefined;
}

export async function principal(argv: readonly string[], p: Processo): Promise<number> {
  let b: Bandeiras;
  try {
    b = lerBandeiras(argv);
  } catch (e) {
    p.avisar(`${e instanceof Error ? e.message : String(e)}\n  (--ajuda lista as bandeiras)`);
    return 1;
  }
  if (b.ajuda) {
    p.escrever(ajuda());
    return 0;
  }
  if (b.tipo === null || b.inicio === null) {
    p.avisar(`faltam ${[b.tipo === null ? '--tipo' : null, b.inicio === null ? '--inicio' : null].filter(Boolean).join(' e ')}\n  (--ajuda lista as bandeiras)`);
    return 1;
  }

  /* O fuso, antes do período: é dele que o período sai. */
  const resolvido = 'fusoResolvido' in p ? p.fusoResolvido : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const doFuso = problemaDoFuso(p.env, p.agora, resolvido);
  if (doFuso !== null) {
    p.avisar(`fuso inválido: ${doFuso}\n  Nada foi aberto. Sem TZ, vale o fuso do sistema.`);
    return 1;
  }

  /* O período, antes de qualquer rede. */
  const v = validarPeriodo(b.tipo, b.inicio, p.agora);
  if (!v.ok) {
    p.avisar(`período inválido: ${v.motivo}. Nada foi aberto.`);
    return 1;
  }

  /* A credencial, antes de qualquer rede — e só o NOME da variável, nunca o valor. */
  const c = lerCredenciais(p.env);
  if (!c.ok) {
    p.avisar(
      'o script não abriu rede:\n' +
        c.faltam.map((x) => `  - falta ${x}\n`).join('') +
        c.problemas.map((x) => `  - ${x}\n`).join('') +
        (c.semCaminho ? `\n${comoSeAutenticar()}\n` : ''),
    );
    return 1;
  }
  // Gravar confere a conta pela SESSÃO do client (a porta da edição), e o token avulso
  // não instala sessão nenhuma: sem o refresh token, a gravação recusaria no fim, depois
  // de pagar os quatro cadernos. Então se diz isso antes.
  if (!b.semGravar && c.credenciais.via === 'token' && c.credenciais.refreshToken === null) {
    p.avisar(
      'o script não abriu rede:\n' +
        `  - falta ${comoExportar('refreshToken')} — para gravar, a sessão tem de viver no client, e o token\n` +
        '    de acesso sozinho não a instala. Com --sem-gravar, o token sozinho basta.\n',
    );
    return 1;
  }
  for (const aviso of c.avisos) p.avisar(`aviso: ${aviso}`);

  const sessao = await (p.abrir ?? abrirSessao)(c.credenciais);
  try {
    const validade = avisoDeValidade({
      expiraEm: sessao.expiraEm,
      podeRenovar: sessao.podeRenovar,
      chamadas: CADERNO_IDS.length,
      prazoMs: PRAZO_MS,
      agora: p.agora,
    });
    if (validade !== null) p.avisar(`aviso: ${validade}`);
    const r = await imprimirPeriodo(
      { periodo: v.periodo, semGravar: b.semGravar, reimprimir: b.reimprimir },
      {
        db: sessao.db,
        userId: sessao.userId,
        motorPara: motoresDaBancada(sessao, p.buscar),
        agora: p.agora,
        escrever: p.escrever,
        avisar: p.avisar,
      },
    );
    return r.codigo;
  } finally {
    // Para o relógio de renovação do JWT, senão o processo não termina.
    sessao.fechar();
  }
}

// Só roda quando este arquivo É o executável — o teste importa as funções sem imprimir nada.
// `require.main`, e não `import.meta`: sob `nodenext` sem `"type": "module"` isto é CJS.
if (require.main === module) {
  principal(process.argv.slice(2), {
    env: process.env,
    agora: new Date(),
    escrever: (l) => process.stdout.write(`${l}\n`),
    avisar: (l) => process.stderr.write(`${l}\n`),
  }).then(
    // `exitCode`, não `exit()`: `process.exit` corta a escrita pendente do stdout num pipe.
    (codigo) => {
      process.exitCode = codigo;
    },
    (e: unknown) => {
      process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
      process.exitCode = 1;
    },
  );
}
