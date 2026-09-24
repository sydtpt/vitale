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
 * `--motor`: a edição que este script grava tem de ser a que o iPhone gravaria, e
 * uma escolha de motor aqui seria uma segunda edição possível para o mesmo período.
 *
 * ## Um caderno só (`--caderno`, story 2.8)
 *
 * `--caderno <id>` reescreve **um** caderno e deixa os outros como estão — texto,
 * assinatura e posição de antes. Não é uma segunda edição possível: é o que o
 * telefone já faz desde a 1.11 (`imprimirCaderno` → `cadernos: [alvo]`), pela mesma
 * sequência do núcleo, que recalcula a ordem do conjunto na função do banco. O
 * texto de cada caderno continua sendo o que sairia numa impressão inteira.
 *
 * Ele existe porque a correção de uma palavra não pode custar a edição toda. A
 * conta da story 2.8, medida em produção em 24/09/2026: o defeito "1 dias"
 * aparece 68 vezes, em 37 linhas, de **35** períodos — e **sempre** no caderno
 * `rotina`. O que a corrida paga é uma chamada por caderno e por período, então
 * são **35** chamadas por `--caderno rotina` contra **140** (35 × 4) pelos quatro
 * cadernos. (68 e 37 contam ocorrências e linhas de texto, e não entram na conta
 * de chamadas: um período com três linhas erradas continua custando uma chamada.)
 *
 * **Com `--caderno` a impressão é parcial, e parcial nunca troca capa existente** —
 * a regra do telefone (`mobile/src/lib/edicao-ia.ts`): a foto e a legenda são do
 * período, não do caderno. Ela só carimba quando não há capa nenhuma.
 *
 * **A capa é carimbada pela impressão que grava** (story 2.3), e só por ela: as
 * três peças da escolha (`atividadesDoPeriodo`, `cidadesDoPeriodo` e o rótulo por
 * extenso) subiram para o núcleo, então a capa do Mac é a do iPhone. Falha de capa
 * **nunca** derruba a edição — vira aviso, e a próxima impressão inteira recarimba.
 * No modo de um período só, as portas da capa são injetadas pelo executável.
 *
 * ## O arquivo inteiro (`--massa`, story 2.3)
 *
 * O mesmo arquivo ganhou o modo em massa: enumera os períodos fechados desde
 * 22/05/2023 — mês, trimestre e ano, **nunca semana** —, cruza com o arquivo,
 * mostra o plano e **para**. Com o "sim" explícito, percorre a lista em ordem
 * cronológica chamando {@link imprimirPeriodo} uma vez por período. A retomada é o
 * próprio banco: cada período é uma transação, e rodar de novo pula o que ficou
 * pronto.
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
import { existsSync, writeFileSync } from 'node:fs';
import {
  AGG_VERSION,
  CADERNO_IDS,
  SEM_MODELO,
  TIPOS_EM_MASSA,
  atividadesDoPeriodo,
  cidadesDoPeriodo,
  descritorDaRetrospectiva,
  entradaDaRetrospectiva,
  escolherCapa,
  fetchActivities,
  fetchArquivoDeEdicoes,
  fetchCapa,
  fetchDadosDaRetro,
  fetchEdicao,
  fetchPhotosForActivities,
  gravarCapa,
  hashCurto,
  imprimir,
  isCadernoId,
  isTipoEmMassa,
  localDateStr,
  offsetDoInicio,
  periodBounds,
  periodoFechado,
  periodosFechadosDesde,
  portasDaEdicao,
  resolverCadeia,
  retroSince,
  rotuloDaEdicao,
  versoesDaRetrospectiva,
  type Activity,
  type ActivityPhoto,
  type CadernoId,
  type CadernoImpresso,
  type Capa,
  type CapaACarimbar,
  type DesfechoDoCaderno,
  type EdicaoNoArquivo,
  type EventoDoAnel,
  type Impressao,
  type Motor,
  type MotorId,
  type NaturezaDaCapa,
  type PeriodoDaEdicao,
  type PeriodoDaEntrada,
  type PeriodoFechado,
  type PortasDaImpressao,
  type ResultadoDaImpressao,
  type TipoComEdicao,
  type TipoEmMassa,
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

/** O "sim" do portão de gasto — o molde é o da bancada (`--sim-gastar-chamadas`). */
const SIM = '--sim-gastar-chamadas';

/**
 * A versão do prompt que uma impressão de hoje vai carimbar — o critério do
 * `--massa --caderno` (Story 2.8).
 *
 * **Sai do descritor, e não de `PROMPT_VERSAO`.** São o mesmo número, e a
 * diferença é de onde ele vem: `descritorDaRetrospectiva.versao` é o que este
 * script já entrega à sequência, e `versoesDaRetrospectiva` é a **mesma** decodificação
 * que a sequência usa para escrever a coluna `prompt_versao` de cada linha
 * (`ia/imprimir-sequencia.ts`). Comparar o arquivo com isto é comparar com o
 * número que a próxima gravação vai pôr lá; ler `PROMPT_VERSAO` direto seria um
 * segundo caminho até o mesmo fato — e a guarda (7) do `architecture.test.ts`
 * reprova a bancada que alcança peça de `ia/` por fora da porta (AD-2).
 */
const PROMPT_DE_HOJE = versoesDaRetrospectiva(descritorDaRetrospectiva.versao).prompt;

/** A fonte única das bandeiras: a leitura e o `--ajuda` saem desta lista. */
const BANDEIRAS = [
  { nome: '--tipo', arg: '<tipo>', ajuda: 'month, season, year ou week — ou mes, estacao, ano, semana, como na rota da revista' },
  { nome: '--inicio', arg: 'AAAA-MM-DD', ajuda: 'o primeiro dia do período (2026-05-01 é maio; 2026-04-01, o 2º trimestre)' },
  { nome: '--caderno', arg: '<id>', ajuda: `um caderno só (${CADERNO_IDS.join(', ')}); os outros ficam como estão, e a capa não é trocada` },
  { nome: '--sem-gravar', arg: null, ajuda: 'chama o modelo e confere, mas não grava nada: compara o que gravaria com o banco' },
  { nome: '--reimprimir', arg: null, ajuda: 'imprime de novo um período que já tem edição (os quatro cadernos; não vale com --caderno)' },
  { nome: '--massa', arg: null, ajuda: 'o arquivo inteiro: mostra o plano e para. Sem o "sim", nenhum modelo é chamado' },
  { nome: SIM, arg: null, ajuda: 'no --massa, confirma o gasto e roda a corrida, um período por vez' },
  { nome: '--limite', arg: '<n>', ajuda: 'no --massa, a corrida toca no máximo n períodos — o ensaio antes de soltar tudo' },
  { nome: '--exportar', arg: '<arquivo>', ajuda: 'no --massa, grava o texto atual das edições que serão substituídas, e sai' },
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
    'Um período: --tipo e --inicio, e rode antes com --sem-gravar. O arquivo inteiro: --massa,',
    'que mostra o plano e só gasta com ' + SIM + '.',
    '--caderno reescreve um caderno só, e vale nos dois modos: no --massa ele corrige as edições',
    'que já existem, só as que têm esse caderno abaixo do prompt de hoje.',
    'Cada caderno é uma chamada paga à nuvem, pela cadeia padrão da revista (a do iPhone sem',
    'preferência). O terminal mostra contagens e hashes, nunca o texto.',
    'O fuso é o desta máquina: use o do iPhone (TZ=Europe/Brussels).',
    'A impressão inteira que grava carimba a capa — e mantém a que você trocou à mão.',
    'A de um caderno não troca capa nenhuma: ela só carimba se ainda não houver uma.',
    'Não imprima o mesmo período pelo iPhone ao mesmo tempo.',
  ].join('\n');
}

export interface Bandeiras {
  readonly tipo: TipoComEdicao | null;
  readonly inicio: string | null;
  /** O `--caderno <id>`, já conferido por `isCadernoId`. `null`: os quatro. */
  readonly caderno: CadernoId | null;
  readonly semGravar: boolean;
  readonly reimprimir: boolean;
  readonly massa: boolean;
  readonly sim: boolean;
  readonly limite: number | null;
  readonly exportar: string | null;
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
  let caderno: CadernoId | null = null;
  let semGravar = false;
  let reimprimir = false;
  let massa = false;
  let sim = false;
  let limite: number | null = null;
  let exportar: string | null = null;
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
      case '--caderno': {
        umaVez(a);
        const cru = valorDe(argv, i, a);
        // Conferido aqui, **antes de qualquer rede**: `--caderno rotinas` que
        // atravessasse viraria uma lista de candidatos que a sequência do núcleo
        // esvazia, e o desfecho seria "nenhum caderno tem o que dizer" — a
        // mensagem errada para um erro de digitação.
        if (!isCadernoId(cru)) {
          throw new Error(`--caderno ${cru} não é caderno — os quatro são ${CADERNO_IDS.join(', ')}`);
        }
        caderno = cru;
        i += 1;
        break;
      }
      case '--sem-gravar':
        umaVez(a);
        semGravar = true;
        break;
      case '--reimprimir':
        umaVez(a);
        reimprimir = true;
        break;
      case '--massa':
        umaVez(a);
        massa = true;
        break;
      case SIM:
        umaVez(a);
        sim = true;
        break;
      case '--limite': {
        umaVez(a);
        const cru = valorDe(argv, i, a);
        const n = Number(cru);
        // Zero e negativo não são "um ensaio pequeno": são uma corrida que não
        // acontece, e o dono acharia que ela rodou.
        if (!Number.isInteger(n) || n < 1) throw new Error(`--limite ${cru} não é um inteiro maior que zero`);
        limite = n;
        i += 1;
        break;
      }
      case '--exportar':
        umaVez(a);
        exportar = valorDe(argv, i, a);
        i += 1;
        break;
      case '--ajuda':
      case '--help':
        pedeAjuda = true;
        break;
      default:
        throw new Error(`bandeira desconhecida: ${a}`);
    }
  }
  return { tipo, inicio, caderno, semGravar, reimprimir, massa, sim, limite, exportar, ajuda: pedeAjuda };
}

/**
 * As bandeiras que só fazem sentido num dos dois modos — recusadas na leitura,
 * antes de qualquer rede.
 *
 * O modo em massa não aceita `--inicio` (a lista é o arquivo inteiro, e um
 * período só tem o seu próprio modo), nem `--reimprimir` (a lista de reimpressão
 * é **nomeada em código**, e uma bandeira aqui reimprimiria 53 períodos), nem
 * `--sem-gravar` (chamaria o modelo em todos eles para não gravar nada — o
 * ensaio da massa é o plano, que não chama ninguém). O modo de um período só não
 * aceita `--exportar` nem o "sim", que são do portão de gasto da corrida.
 *
 * **`--caderno` e `--reimprimir` não valem juntos** (Story 2.8), e a recusa vale
 * nos dois modos. As duas mandam imprimir por cima do que já está gravado, e
 * mandam coisas diferentes: `--reimprimir` são os quatro cadernos, `--caderno` é
 * um. Aceitar as duas faria uma delas ser descartada em silêncio — o mesmo
 * defeito que a regra de `--exportar` com o "sim" fecha.
 *
 * Devolve o motivo, ou `null`.
 */
export function bandeirasIncompativeis(b: Bandeiras): string | null {
  if (b.reimprimir && b.caderno !== null) {
    return `--reimprimir e --caderno não valem juntos: --reimprimir são os quatro cadernos, e --caderno ${b.caderno} `
      + 'é um só. Escolha qual das duas impressões você quer';
  }
  if (b.massa) {
    const proibidas = [
      b.inicio !== null ? '--inicio' : null,
      b.reimprimir ? '--reimprimir' : null,
      b.semGravar ? '--sem-gravar' : null,
    ].filter((x): x is string => x !== null);
    if (proibidas.length > 0) {
      return `${proibidas.join(' e ')} não ${proibidas.length === 1 ? 'vale' : 'valem'} com --massa — `
        + 'a lista é o arquivo inteiro, a reimpressão é nomeada em código, e o ensaio da massa é o próprio plano';
    }
    if (b.tipo !== null && !isTipoEmMassa(b.tipo)) {
      return `--tipo ${NOME_DO_TIPO[b.tipo]} não entra no modo em massa: semana não grava edição — `
        + `o postal da Retrospectiva a calcula na hora. Os três são ${TIPOS_EM_MASSA.join(', ')}`;
    }
    // O `--exportar` sai antes de imprimir qualquer coisa: com o "sim" junto, o
    // dono autorizaria o gasto e o script exportaria e sairia, **descartando o
    // sim em silêncio** — e ele iria conferir uma corrida que nunca aconteceu.
    if (b.exportar !== null && b.sim) {
      return `--exportar e ${SIM} não valem juntos: a exportação sai antes de imprimir, e o "sim" seria `
        + 'descartado. Exporte, commite o arquivo, e só então rode a corrida';
    }
    if (b.exportar !== null && b.limite !== null) {
      return '--exportar e --limite não valem juntos: a exportação não roda corrida nenhuma';
    }
    return null;
  }
  const soDaMassa = [
    b.sim ? SIM : null,
    b.limite !== null ? '--limite' : null,
    b.exportar !== null ? '--exportar' : null,
  ].filter((x): x is string => x !== null);
  if (soDaMassa.length > 0) {
    return `${soDaMassa.join(' e ')} só ${soDaMassa.length === 1 ? 'vale' : 'valem'} com --massa`;
  }
  return null;
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
  /**
   * O `--caderno <id>`: reescreve **um** caderno e deixa os outros como estão
   * (Story 2.8). `null`, ou ausente, são os quatro.
   *
   * Um caderno pedido é uma **impressão parcial**, e ela muda três coisas:
   *
   * 1. a sequência do núcleo recebe `cadernos: [alvo]`, e é ela quem mantém os
   *    outros com o texto, a assinatura e a `agg_version` de antes;
   * 2. a recusa do já impresso não vale — pedir um caderno de um período que já
   *    tem edição é exatamente o caso de uso, e não um descuido;
   * 3. a capa existente **nunca** é trocada (ver {@link carimbarACapa}).
   */
  readonly caderno?: CadernoId | null;
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
  /**
   * As portas da capa (Story 2.3). O executável as injeta **nos dois modos**
   * sempre que a impressão pode gravar — um período só e a corrida em massa —,
   * porque a capa é da edição, não do modo.
   *
   * Ausente, a capa não é tocada. É o que o `--sem-gravar` faz (não há edição a
   * carimbar) e o que um teste que só mede o texto pode fazer; a corrida em
   * massa **recusa** começar sem elas, para um erro de fiação não gravar ~48
   * edições sem capa com o relatório calado.
   */
  readonly capa?: PortasDaCapa | undefined;
  /**
   * Um caderno terminou, com quantas **chamadas pagas** ele custou.
   *
   * Vem do anel, e não do relatório: a impressão que rejeita na gravação já
   * pagou os cadernos, e um contador que lesse só o relatório perderia
   * exatamente as chamadas que doeram.
   *
   * A conta é sobre a **trilha** — toda tentativa que chegou a um motor de
   * verdade —, e não sobre "houve hash": a tentativa que estourou o prazo ou
   * voltou com erro foi paga do mesmo jeito, e um caderno pode tentar mais de
   * uma vez (a repetição com o pedido curto, depois de uma `janela`). Ficam de
   * fora a tentativa **sintética** (o hospedeiro não entregou o motor: nada
   * saiu) e o **`sem-modelo`**, que é o template e não custa nada.
   */
  readonly aoTentar?: (caderno: CadernoId, chamadas: number) => void;
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

/**
 * O que aconteceu com a capa nesta impressão (Story 2.3) — `null` quando ela não
 * foi tocada (sem as portas, ou nada foi gravado).
 *
 * **O aviso nunca é falha da edição.** Carimbar não é atômico com a impressão, e
 * a regra é a do telefone (`carimbarCapa`, em `mobile/src/lib/edicao-ia.ts`): se
 * o carimbo falha, a edição existe sem capa, o motivo sai no relatório e a
 * próxima impressão inteira recarimba. O que não pode acontecer é uma falha de
 * capa apagar o texto que o modelo acabou de escrever.
 */
export interface CapaNoRelatorio {
  /** A natureza carimbada (ou a mantida), ou `null` quando o carimbo falhou. */
  readonly natureza: NaturezaDaCapa | null;
  /**
   * Por que a capa de antes foi **mantida** — `null` quando ela foi carimbada
   * agora. São duas razões, e o relatório diz qual foi:
   *
   * - `trocada`: é uma escolha do dono (`motivo: 'trocada'`, Story 1.16), e a
   *   escolha automática por cima a desfaria em silêncio;
   * - `parcial`: a impressão foi de **um caderno** (`--caderno`, Story 2.8), e
   *   parcial não troca capa existente — a foto e a legenda são do período, não
   *   do caderno. Aqui nem o `motivo` da capa importa: a de `rajada` que o app
   *   escolheu também fica.
   */
  readonly mantida: 'trocada' | 'parcial' | null;
  /** O motivo da falha, quando houve. */
  readonly aviso: string | null;
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
  /** O carimbo da capa — só na impressão que gravou, e só com as portas. */
  readonly capa: CapaNoRelatorio | null;
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
 * Quantas chamadas **pagas** um caderno custou — a trilha do anel, menos o que
 * não custa (ver {@link DepsDaImpressao.aoTentar}).
 *
 * Exportada porque a regra é a conta, e a conta tem teste: contar "houve hash"
 * dava 1 para todo caderno, e zero para o que caiu antes de haver pedido — que
 * é o oposto do que a corrida precisa saber.
 */
export function chamadasPagas(evento: EventoDoAnel): number {
  return evento.trilha.filter((t) => t.sintetica !== true && t.motor !== SEM_MODELO).length;
}

/* ── o carimbo da capa (Story 2.3) ──────────────────────────────────────── */

/**
 * As portas do carimbo. Injetáveis, para o teste não abrir rede — e com os
 * **mesmos nomes** do telefone (`DepsDoCarimbo`, em `mobile/src/lib/edicao-ia.ts`).
 *
 * A gravação se chama `carimbar`, e **não `gravar`**: `.gravar` é a porta de
 * escrita da EDIÇÃO, e uma barreira do `architecture.test.ts` cobra que só a
 * sequência da impressão a leia. Reusar o nome aqui contaria como um segundo
 * caminho até o texto do jornal.
 */
export interface PortasDaCapa {
  /** A capa já carimbada deste período, ou `null` — a guarda da troca à mão. */
  readonly lerCapa: (periodo: PeriodoDaEdicao) => Promise<Capa | null>;
  readonly buscarFotos: (ids: readonly string[]) => Promise<ActivityPhoto[]>;
  readonly carimbar: (capa: CapaACarimbar) => Promise<unknown>;
}

/** As portas reais da capa, ligadas a um cliente — o que o executável injeta. */
export function portasDaCapa(db: ClientDoNucleo, userId: string): PortasDaCapa {
  return {
    lerCapa: (p) => fetchCapa(db, userId, p.tipoPeriodo, p.inicio, p.fim),
    buscarFotos: (ids) => fetchPhotosForActivities(db, userId, ids),
    carimbar: (capa) => gravarCapa(db, userId, capa),
  };
}

/**
 * Escolhe e carimba a capa da edição que acabou de ser gravada — a **mesma**
 * capa que o telefone carimbaria.
 *
 * Nada é reimplementado: a escolha é `escolherCapa` (núcleo), as atividades do
 * período saem de `atividadesDoPeriodo` e as cidades de `cidadesDoPeriodo` — as
 * três peças que a Story 2.3 subiu do celular para `revista/capa.ts` —, e a
 * legenda da natureza `grade` é o `rotuloDaEdicao` de lá.
 *
 * **As ocultas ficam de fora**, como no telefone: `d.atividades()` lá é
 * `activities()`, não `_all`. O dono esconde a pedalada, e o que ele escondeu
 * não escolhe a capa nem vira o traçado do período — aqui isso ficaria
 * *carimbado*, e desfazer exigiria reimprimir a edição inteira.
 *
 * **A capa que o dono trocou à mão é mantida.** A troca da Story 1.16 grava
 * `motivo: 'trocada'`, e ela é um **ato dele** sobre um período fechado — a
 * escolha automática por cima a desfaria em silêncio, e a reimpressão de
 * julho/2026 (uma das cinco nomeadas) faria exatamente isso. A leitura vem
 * antes do carimbo, e o relatório diz que a capa foi mantida.
 *
 * **A impressão PARCIAL não troca capa nenhuma** (`parcial`, Story 2.8). A regra
 * é a do telefone (`carimbarCapa`, em `mobile/src/lib/edicao-ia.ts`, renegociada
 * com o dono em 17/09): a inteira sempre recarimba, e a parcial só carimba
 * **quando não há capa** — a foto e a legenda são do período, não do caderno. Ela
 * carimba nesse caso porque uma edição que nunca teve capa ficaria em papel para
 * sempre, e não porque a parcial tenha voz sobre a capa.
 *
 * Aqui isso não é zelo: das quatro capas escolhidas à mão em produção em
 * 24/09/2026, três são `trocada` (Q1/2026, Q2/2026, julho) e **uma é `estrela`**
 * (agosto) — e `estrela` não passa pela guarda da troca, porque ela é a escolha
 * automática respondendo a uma estrela que o dono pôs na foto. Corrigir uma
 * palavra no caderno `rotina` e levar junto a capa de agosto seria trocar um
 * defeito por um dano.
 *
 * **Nunca rejeita** (a regra do telefone): a falha vira aviso, e a edição fica
 * sem capa até a próxima impressão inteira. A falha da **leitura** da capa
 * existente também é aviso — e, por não saber se havia uma troca, ela não
 * carimba: o risco de apagar a escolha do dono é pior que o de ficar sem capa,
 * que a impressão seguinte conserta.
 */
async function carimbarACapa(
  portas: PortasDaCapa,
  periodo: PeriodoPedido,
  entrada: PeriodoDaEntrada,
  acervo: readonly Activity[],
  parcial: boolean,
): Promise<CapaNoRelatorio> {
  const chave: PeriodoDaEdicao = { tipoPeriodo: periodo.tipo, inicio: periodo.inicio, fim: periodo.fim };
  let existente: Capa | null;
  try {
    existente = await portas.lerCapa(chave);
  } catch (e) {
    return {
      natureza: null,
      mantida: null,
      aviso: `a capa de antes não foi lida, e nada foi carimbado para não apagar uma troca sua: ${
        e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (existente !== null && parcial) {
    return { natureza: existente.natureza, mantida: 'parcial', aviso: null };
  }
  if (existente !== null && existente.motivo === 'trocada') {
    return { natureza: existente.natureza, mantida: 'trocada', aviso: null };
  }
  try {
    const atividades = atividadesDoPeriodo(acervo.filter((a) => !a.hidden), entrada);
    const fotos = atividades.length > 0 ? await portas.buscarFotos(atividades.map((a) => a.id)) : [];
    const capa = escolherCapa({
      fotos,
      atividades,
      cidades: cidadesDoPeriodo(atividades),
      periodo: { ...chave, rotulo: rotuloDaEdicao(periodo.tipo, periodo.inicio) },
    });
    await portas.carimbar(capa);
    return { natureza: capa.natureza, mantida: null, aviso: null };
  } catch (e) {
    return { natureza: null, mantida: null, aviso: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Imprime o período — ou, com `semGravar`, faz tudo menos gravar.
 *
 * Na ordem: lê a edição do banco (e recusa o período já impresso sem
 * `--reimprimir`/`--sem-gravar`, antes de ler o acervo e antes de chamar o modelo),
 * lê as leituras da Retrospectiva na janela `retroSince` e as atividades, monta a entrada pelo
 * núcleo e chama `imprimir` com as portas. Rejeita quando uma porta falha — inclusive
 * a guarda da impressão concorrente (`EdicaoMudouNaImpressao`) —, e nada foi gravado.
 *
 * **A recusa do já impresso é feita duas vezes, e a segunda é a que vale.** A
 * primeira, sobre a leitura do começo, só evita ler o acervo à toa. Entre ela e o
 * `buscar` da sequência há as leituras do acervo, e o telefone pode imprimir o mesmo
 * período nesse intervalo: por isso o `buscar` também recusa uma edição que não está
 * vazia — e ele roda antes do primeiro `ler`, então nada foi chamado. O mesmo `buscar`
 * é o que a comparação do `--sem-gravar` usa, e não a leitura do começo.
 *
 * **Com `pedido.caderno`, a impressão é parcial** (Story 2.8): a sequência recebe
 * a lista de um, a recusa do já impresso não se aplica, e a capa existente fica.
 * Nada disto é reimplementado aqui — `cadernos` é opção da sequência do núcleo, e
 * é ela quem mantém o texto e a assinatura dos outros três e recalcula a ordem do
 * conjunto na função do banco.
 */
export async function imprimirPeriodo(pedido: PedidoDeImpressao, deps: DepsDaImpressao): Promise<RelatorioDaImpressao> {
  const { periodo, semGravar, reimprimir } = pedido;
  const alvo = pedido.caderno ?? null;
  const { db, userId, agora, escrever, avisar } = deps;
  const since = localDateStr(retroSince(agora, periodo.tipo, periodo.offset));
  // Parcial imprime por cima do que está gravado por definição: recusar o já
  // impresso aqui seria recusar o único caso de uso da bandeira.
  const recusaOJaImpresso = !reimprimir && !semGravar && alvo === null;

  escrever(`imprimir — ${NOME_DO_TIPO[periodo.tipo]} ${periodo.inicio} a ${periodo.fim} (${periodo.rotulo})`);
  escrever(`  fuso: ${fusoDe(agora)} · agora: ${localDateStr(agora)} · janela: desde ${since}`);
  const daCapa = semGravar || deps.capa === undefined
    ? 'não é carimbada por aqui'
    : alvo === null
      ? 'carimbada na impressão que gravar'
      : 'a de antes fica — parcial não troca capa';
  escrever(
    `  modo: ${semGravar ? 'sem gravar — nada vai ao banco' : 'grava a edição'}`
      + ` · cadernos: ${alvo === null ? 'os quatro' : `só ${alvo}`} · capa: ${daCapa}`,
  );

  const noBanco = await fetchEdicao(db, userId, periodo.tipo, periodo.inicio, periodo.fim);
  escrever(`  no banco: ${noBanco.length} ${noBanco.length === 1 ? 'caderno impresso' : 'cadernos impressos'}${noBanco.length > 0 ? ` (${lista(noBanco.map((c) => c.caderno))})` : ''}`);
  // Um caderno só sobre um período SEM edição nasce uma edição de um caderno — e
  // ela passa a contar como "já impressa" no plano da massa, que nunca mais
  // oferece os outros três. Não é recusa, mas não pode acontecer calado.
  //
  // **E o aviso sai no `--sem-gravar` também**, no condicional: o README manda
  // ensaiar antes justamente para ver o que a impressão faria, e calar ali o
  // único efeito IRREVERSÍVEL da bandeira seria calar o que o ensaio existe para
  // mostrar. O dono descobriria depois de gravar.
  if (alvo !== null && noBanco.length === 0) {
    avisar(
      `${periodo.rotulo} não tem edição, e --caderno ${alvo} ${semGravar ? 'criaria' : 'vai criar'} `
        + 'uma com um caderno só.\n'
        + `  O arquivo ${semGravar ? 'passaria' : 'passa'} a contar esse período como impresso, e a corrida `
        + 'em massa não o oferece mais.\n'
        + '  Para a edição inteira, rode sem --caderno.',
    );
  }
  if (noBanco.length > 0 && recusaOJaImpresso) {
    const cadernos = noBanco.map((c) => c.caderno);
    avisar(recusaDoJaImpresso(periodo.rotulo, cadernos));
    return { codigo: 1, estado: 'ja-impresso', cadernos: [], ordem: cadernos, grupos: null, comparacao: null, capa: null };
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
      `(${contar(ocultas, 'oculta', 'ocultas')}, fora) · ` +
      // A décima leitura (story 2.7). Ela não recebe `userId` — filtra por
      // `auth.uid()` —, então SEM SESSÃO devolve zero linhas sem erro nenhum.
      // Um zero aqui é a única forma de o dono ver que os fatos não chegaram.
      `${contar(dados.silencios?.length ?? 0, 'métrica no acervo', 'métricas no acervo')}`,
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
    if (lendo === null) return;
    if (evento.hash !== undefined) hashes[lendo] = evento.hash;
    deps.aoTentar?.(lendo, chamadasPagas(evento));
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
      // A lista de um, quando há alvo — a mesma opção que o telefone passa em
      // `imprimirAlvo` (`mobile/src/store/edicao.store.ts`). Ausente são os
      // quatro; **vazia a sequência recusa**, e por isso nunca se passa `[]`.
      ...(alvo === null ? {} : { cadernos: [alvo] }),
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
    return { codigo: 1, estado: 'ja-impresso', cadernos: [], ordem: e.cadernos, grupos: null, comparacao: null, capa: null };
  }

  if (resultado.estado === 'aberto' || resultado.estado === 'sem-caderno') {
    avisar(
      resultado.estado === 'aberto'
        ? `${periodo.rotulo} não fechou para o núcleo — nada foi lido nem gravado.`
        : `nenhum caderno de ${periodo.rotulo} tem o que dizer — nada foi lido nem gravado.`,
    );
    return { codigo: 1, estado: resultado.estado, cadernos: [], ordem: [], grupos: null, comparacao: null, capa: null };
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
    return { codigo: 1, estado: resultado.estado, cadernos, ordem: lido.map((c) => c.caderno), grupos: null, comparacao: null, capa: null };
  }

  const ordem: CadernoId[] = semGravar ? [...(impressao?.ordem ?? [])] : gravadas.map((c) => c.caderno);
  const escritosAgora = resultado.desfechos.filter((d) => d.desfecho.tipo === 'escrito').map((d) => d.caderno);
  const grupos = gruposDaImpressao(ordem, escritosAgora, lido.map((c) => c.caderno));
  escrever(`  ordem da edição: ${lista(ordem)}`);
  escrever(linhaDosGrupos(grupos, !semGravar));

  if (!semGravar) {
    // A capa é carimbada **na impressão que grava**, nunca depois: as fotos, a
    // estrela e o vínculo mudam, e uma capa escolhida em outubro não é a do
    // período que fechou em agosto. A falha vira aviso e não derruba a edição.
    const capa = deps.capa === undefined
      ? null
      : await carimbarACapa(deps.capa, periodo, entrada, atividades, alvo !== null);
    if (capa !== null) {
      if (capa.aviso !== null) {
        avisar(`a capa de ${periodo.rotulo} não foi carimbada, e a edição fica sem capa: ${capa.aviso}`);
      } else if (capa.mantida === 'trocada') {
        escrever(`  capa: ${capa.natureza} — mantida, porque você a trocou à mão`);
      } else if (capa.mantida === 'parcial') {
        escrever(`  capa: ${capa.natureza} — mantida, porque esta impressão foi de um caderno só`);
      } else {
        escrever(`  capa: ${capa.natureza}`);
      }
    }
    return { codigo: 0, estado: 'gravada', cadernos, ordem, grupos, comparacao: null, capa };
  }

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
  return { codigo: 0, estado: 'ensaio', cadernos, ordem, grupos, comparacao, capa: null };
}

/* ── o modo em massa (Story 2.3) ─────────────────────────────────────────── */

/**
 * O começo do arquivo: **22 de maio de 2023**, o primeiro dia com registro.
 *
 * É constante, e não bandeira, de propósito: imprimir período anterior a ele é
 * *Ask First* na spec da story — a matéria não existe, e o texto sairia narrando
 * dias vazios como dias sem nada. Mudar esta data é decisão do dono.
 */
export const COMECO_DO_ARQUIVO = '2023-05-22';

/**
 * A versão do pacote com que as onze edições do arquivo foram escritas — o
 * retrato medido pelo dono em 23/09/2026, e o valor padrão de
 * {@link PeriodoNomeado.pacoteImpresso}.
 *
 * Ele não é uma constante global da corrida: é **por período nomeado**, porque é
 * uma afirmação sobre aquela linha do banco. Um período acrescentado à lista em
 * 2027 estará noutra versão, e um limiar único faria a corrida achar que ele já
 * foi renovado.
 */
const PACOTE_DAS_ANTIGAS = 3;

/**
 * A mediana medida por chamada de nuvem — 13,6 s.
 *
 * **Ela é emprestada, e a tela diz isso.** O número vem das 22 janelas da
 * primeira medição da bancada ([ADR 0050](../../docs/decisions/0050-o-limiar-do-portao-sai-de-medicao-e-tem-quatro-condicoes.md),
 * 12/09/2026), que mediu a **Saúde do sono**: um pedido de outro tamanho, com
 * outro descritor. O pedido da revista é maior (o pacote de fatos de um caderno
 * inteiro), então a estimativa é, se alguma coisa, otimista. A revista não tem
 * medição própria — quando tiver, este número muda com ela.
 *
 * Serve para uma coisa só: pôr a ordem de grandeza da corrida na tela antes do
 * "sim". Não é promessa nem prazo — o prazo é o `PRAZO_MS` do transporte, e o
 * pior caso é ele vezes o número de chamadas.
 */
const MEDIANA_POR_CHAMADA_S = 13.6;

/**
 * Quantas falhas **seguidas** param a corrida.
 *
 * Falha isolada não derruba nada — é o contrato da story, e um período ruim não
 * pode custar os outros cinquenta. Mas falha seguida não é período ruim: é
 * causa comum — o refresh revogado, um 429, a cota do provedor —, e sem freio
 * ela percorre os ~50 períodos um a um, pagando o que a nuvem cobrar por cada
 * tentativa antes de o dono ver o terminal.
 *
 * Três, e não dois: duas seguidas acontecem por acaso numa corrida longa, e
 * parar ali custaria uma corrida inteira por um susto.
 *
 * **O que NÃO entra na conta** (Story 2.8): período mudo e período em que nenhum
 * caderno passou. Os dois eram contados como falha, e os dois são corriqueiros —
 * o primeiro no começo do arquivo, onde não havia matéria, e ambos na campanha de
 * **um caderno**, em que basta aquele caderno estar calado. O mudo é o pior dos
 * dois: custa zero e nunca se resolve, então três deles em sequência parariam a
 * corrida **para sempre**, anunciando um token vencido que está perfeito.
 */
const FALHAS_SEGUIDAS_QUE_PARAM = 3;

/** Um período que o dono nomeou para reimpressão, com o motivo dele. */
export interface PeriodoNomeado {
  readonly tipo: TipoEmMassa;
  readonly inicio: string;
  /**
   * A `pacote_versao` com que a edição está gravada **hoje**. A reimpressão
   * conta como feita quando **todo** caderno dela está acima disto.
   *
   * É a memória da retomada, e ela mora no banco (ver as notas de desenho da
   * story): não há arquivo de progresso. O padrão é
   * {@link PACOTE_DAS_ANTIGAS}, que é onde as onze edições do arquivo estavam
   * em 23/09/2026.
   */
  readonly pacoteImpresso: number;
  readonly motivo: string;
}

/**
 * Os **cinco** períodos que o dono mandou reimprimir (decisão 1 de 23/09/2026).
 *
 * Nomeados em código, e não por bandeira: *"nada é reimpresso sem ser nomeado"*.
 * Uma bandeira `--reimprimir` no modo em massa reimprimiria 53 períodos por um
 * descuido de digitação, e cada um custa até quatro chamadas pagas.
 *
 * Duas causas, e as duas mudam o que está gravado:
 *
 * - **o zero falso** (Story 2.6): a ausência de registro virava zero, e as três
 *   edições de 2023 dizem *"água, café, cerveja e smoke somaram 0 dias"* sobre um
 *   período em que os hábitos nem existiam;
 * - **a lápide do período** (Story 2.7): respiração (10/07), VO₂max (14/07) e
 *   SpO₂ (16/07) morreram dentro de julho, e os anéis (17/08) dentro de agosto —
 *   e a lápide do período força o caderno dela à frente (passo 5 do
 *   ranqueamento), então a `posicao` gravada está errada nas duas.
 *
 * **Junho de 2026 fica**, por decisão do dono: nada nela muda. E o **ano de
 * 2023** está aqui mesmo começando antes de {@link COMECO_DO_ARQUIVO} — ele não
 * é enumerado (a enumeração é pelo começo do período), mas já existe no arquivo,
 * e reimprimir o que existe é o que o dono nomeou.
 */
export const A_REIMPRIMIR: readonly PeriodoNomeado[] = Object.freeze([
  { tipo: 'year', inicio: '2023-01-01', pacoteImpresso: PACOTE_DAS_ANTIGAS, motivo: 'zero falso: impressa antes da gramática da ausência (2.6)' },
  { tipo: 'month', inicio: '2023-09-01', pacoteImpresso: PACOTE_DAS_ANTIGAS, motivo: 'zero falso: impressa antes da gramática da ausência (2.6)' },
  { tipo: 'month', inicio: '2023-10-01', pacoteImpresso: PACOTE_DAS_ANTIGAS, motivo: 'zero falso: impressa antes da gramática da ausência (2.6)' },
  { tipo: 'month', inicio: '2026-07-01', pacoteImpresso: PACOTE_DAS_ANTIGAS, motivo: 'lápide do período: três mortes em julho mudam a ordem gravada (2.7)' },
  { tipo: 'month', inicio: '2026-08-01', pacoteImpresso: PACOTE_DAS_ANTIGAS, motivo: 'lápide do período: os anéis pararam em 17/08 (2.7)' },
] as const);

/** O que a corrida vai fazer com um período. */
export type AcaoNoPlano = 'imprimir' | 'reimprimir' | 'pular';

/** Uma linha do plano: um período do arquivo, classificado. */
export interface ItemDoPlano {
  readonly acao: AcaoNoPlano;
  readonly tipo: TipoComEdicao;
  readonly inicio: string;
  readonly fim: string;
  /** `null` quando o período do arquivo não se localiza no relógio de hoje. */
  readonly offset: number | null;
  readonly rotulo: string;
  /** Os cadernos já impressos. Vazio: o período ainda não tem edição. */
  readonly cadernos: readonly CadernoId[];
  /** Por que reimprimir, ou por que pular. `null` no que só falta imprimir. */
  readonly motivo: string | null;
}

/** A conta que vai para a tela antes do "sim". */
export interface ContasDoPlano {
  readonly imprimir: number;
  readonly reimprimir: number;
  readonly pular: number;
  /** Quantos períodos a corrida vai de fato tocar — `imprimir + reimprimir`, cortado pelo `--limite`. */
  readonly aFazer: number;
  /** O teto: uma chamada por caderno, em cada período que a corrida toca. */
  readonly chamadas: number;
  /** O teto em minutos de relógio, pela mediana medida. */
  readonly minutos: number;
}

/** A ordem dos tipos no desempate do plano — do mais curto ao mais longo. */
const DURACAO_DO_TIPO: Readonly<Record<TipoComEdicao, number>> = { week: 0, month: 1, season: 2, year: 3 };

/** A chave de um período — tipo e começo, que é como a edição se nomeia. */
const chaveDoPeriodo = (tipo: string, inicio: string): string => `${tipo}\u0000${inicio}`;

/**
 * Por que a semana nunca entra na corrida — a frase, uma vez só.
 *
 * Os dois critérios do plano (o nomeado da 2.3 e o de um caderno da 2.8) a
 * repetiam em literal, e uma delas ia ficar para trás na primeira vez que a
 * redação mudasse.
 */
const SEMANA_FORA = 'semana não grava edição em massa — o postal da Retrospectiva a calcula na hora';

/**
 * Esta edição já foi reimpressa? — **todo** caderno dela está acima da versão
 * com que ela foi gravada ({@link PeriodoNomeado.pacoteImpresso}).
 *
 * É a **retomada**: uma corrida interrompida deixou algumas das cinco nomeadas
 * já reimpressas, e a corrida seguinte não pode pagá-las de novo.
 *
 * **`every`, e não `some`** — e a diferença é um defeito real, não zelo. A
 * errata por caderno da Story 1.11 deixa o dono reescrever **um** caderno pelo
 * telefone, e ele nasce na versão corrente: com `some`, essa única linha faria a
 * edição inteira passar por renovada, e os outros três ficariam com o zero falso
 * para sempre, sem nada acusando.
 *
 * O preço declarado do `every`: uma reimpressão em que um caderno caiu no piso
 * mantém a linha antiga, e o período é tentado de novo na corrida seguinte.
 * **Isso é o certo** — a edição não foi renovada por inteiro —, e o custo é
 * limitado porque a lista nomeada tem cinco períodos, não cinquenta.
 */
function jaReimpressa(edicao: EdicaoNoArquivo, nomeado: PeriodoNomeado): boolean {
  return edicao.cadernos.every((c) => c.pacoteVersao > nomeado.pacoteImpresso);
}

/**
 * A classificação de **um caderno só** (`--massa --caderno`, Story 2.8): esta
 * edição tem o caderno pedido escrito com um prompt anterior ao de hoje?
 *
 * É outro critério, e não uma variação do de cima, porque a pergunta é outra. A
 * campanha da 2.3 é de **números** — `pacote_versao` mudou porque o pacote passou
 * a carregar outra coisa —, e ela vale para a edição inteira, por períodos que o
 * dono nomeou em código. A campanha de um caderno é de **palavras**: o prompt
 * mudou, o pacote não, e quem precisa ser reescrito é quem tem *aquele* caderno
 * abaixo do prompt de hoje — não há lista nomeada, porque a lista é derivável do
 * arquivo com exatidão.
 *
 * Devolve o motivo do `pular`, ou `null` quando é caso de reimprimir.
 *
 * **É a retomada, e ela mora no banco**: a segunda corrida encontra o caderno já
 * no prompt corrente e não gasta nada. O preço declarado é o mesmo do `every` de
 * {@link jaReimpressa} — um caderno que caiu no piso mantém a linha antiga, e a
 * corrida seguinte o tenta de novo, que é o certo: ele não foi renovado.
 */
function poupaOCaderno(edicao: EdicaoNoArquivo, caderno: CadernoId): string | null {
  const linha = edicao.cadernos.find((c) => c.caderno === caderno);
  if (linha === undefined) {
    return `a edição não tem o caderno ${caderno} (${lista(edicao.cadernos.map((c) => c.caderno))})`;
  }
  // **O número da mensagem é o DA LINHA**, e não o limiar. Com `>` — a linha
  // adiante do prompt de hoje, que é o que se vê ao rodar um binário antigo
  // depois de um mais novo ter gravado — dizer "já está no prompt 6" sobre uma
  // linha no 7 esconde a única coisa que importa ali: alguém mais novo passou por
  // aqui. Os dois casos são `pular`; só a frase muda.
  if (linha.promptVersao > PROMPT_DE_HOJE) {
    return `${caderno} está no prompt ${linha.promptVersao}, à frente do de hoje (${PROMPT_DE_HOJE})`;
  }
  if (linha.promptVersao === PROMPT_DE_HOJE) return `${caderno} já está no prompt ${PROMPT_DE_HOJE}`;
  return null;
}

/**
 * O plano: cada período do arquivo, classificado em imprimir, reimprimir ou
 * pular. Puro — recebe a enumeração e o inventário, e não abre rede.
 *
 * **O universo é a enumeração MAIS o que já está no arquivo**, e não só a
 * enumeração. Os dois lados têm o que o outro não tem: a enumeração traz os ~48
 * períodos que faltam imprimir; o arquivo traz o que já existe fora dela — as
 * cinco semanas que o piloto imprimiu (semana nunca entra na massa) e o ano de
 * 2023, que começa antes de {@link COMECO_DO_ARQUIVO} e que o dono nomeou para
 * reimpressão. Sem os dois, o plano mentiria por omissão sobre o próprio arquivo.
 *
 * **`soODoTipo` vale para os dois lados** (Story 2.3, revisão). A enumeração já
 * chega recortada, mas o arquivo não: sem esta guarda, `--tipo year` percorria o
 * arquivo inteiro e classificava os quatro meses nomeados como `reimprimir` —
 * dezesseis chamadas pagas de um tipo que a bandeira tinha excluído, com o
 * cabeçalho dizendo "do tipo ano". O que fica fora do recorte aparece no plano
 * como `pular`, e não some: o inventário continua sendo o do arquivo.
 *
 * **`soOCaderno` troca o critério inteiro** (`--caderno`, Story 2.8), e não é um
 * filtro sobre o de cima. Com ele a corrida corrige **palavras** no caderno
 * pedido: `reimprimir` é a edição que já existe e tem esse caderno abaixo do
 * prompt de hoje ({@link poupaOCaderno}), e todo o resto é `pular` — inclusive os
 * cinco períodos nomeados em {@link A_REIMPRIMIR}, que são de outra campanha, e
 * os períodos **sem edição**, porque um caderno só não é uma edição para nascer.
 */
export function montarPlano(
  fechados: readonly PeriodoFechado[],
  arquivo: readonly EdicaoNoArquivo[],
  agora: Date,
  nomeados: readonly PeriodoNomeado[] = A_REIMPRIMIR,
  soODoTipo: TipoEmMassa | null = null,
  soOCaderno: CadernoId | null = null,
): ItemDoPlano[] {
  const noArquivo = new Map(arquivo.map((e) => [chaveDoPeriodo(e.tipoPeriodo, e.inicio), e]));
  const nomeado = new Map(nomeados.map((n) => [chaveDoPeriodo(n.tipo, n.inicio), n]));
  const itens: ItemDoPlano[] = [];
  const vistos = new Set<string>();

  const classificar = (
    tipo: TipoComEdicao,
    inicio: string,
    fim: string,
    offset: number | null,
    rotulo: string,
  ): ItemDoPlano => {
    const chave = chaveDoPeriodo(tipo, inicio);
    const existe = noArquivo.get(chave);
    const pedido = nomeado.get(chave);
    const cadernos = existe?.cadernos.map((c) => c.caderno) ?? [];
    if (soODoTipo !== null && tipo !== soODoTipo) {
      return {
        acao: 'pular', tipo, inicio, fim, offset, rotulo, cadernos,
        motivo: `fora do --tipo ${NOME_DO_TIPO[soODoTipo]}`,
      };
    }
    if (soOCaderno !== null) {
      // O critério de um caderno só. Semana continua fora: ela não grava edição,
      // e as cinco do arquivo são do piloto.
      if (tipo === 'week') {
        return {
          acao: 'pular', tipo, inicio, fim, offset, rotulo, cadernos,
          motivo: SEMANA_FORA,
        };
      }
      if (existe === undefined) {
        return {
          acao: 'pular', tipo, inicio, fim, offset, rotulo, cadernos,
          motivo: `sem edição — --caderno ${soOCaderno} só corrige o que já está impresso`,
        };
      }
      const poupa = poupaOCaderno(existe, soOCaderno);
      return poupa === null
        ? {
            acao: 'reimprimir', tipo, inicio, fim, offset, rotulo, cadernos,
            motivo: `${soOCaderno} no prompt ${existe.cadernos.find((c) => c.caderno === soOCaderno)!.promptVersao}`
              + ` (hoje ${PROMPT_DE_HOJE})`,
          }
        : { acao: 'pular', tipo, inicio, fim, offset, rotulo, cadernos, motivo: poupa };
    }
    if (existe === undefined) {
      // Nomeado e sem edição é impressão normal: não há o que reimprimir.
      return { acao: 'imprimir', tipo, inicio, fim, offset, rotulo, cadernos, motivo: pedido?.motivo ?? null };
    }
    if (pedido === undefined) {
      const motivo = tipo === 'week'
        ? SEMANA_FORA
        : 'já impresso, e não está na lista de reimpressão';
      return { acao: 'pular', tipo, inicio, fim, offset, rotulo, cadernos, motivo };
    }
    if (jaReimpressa(existe, pedido)) {
      return { acao: 'pular', tipo, inicio, fim, offset, rotulo, cadernos, motivo: 'já reimpressa nesta campanha' };
    }
    return { acao: 'reimprimir', tipo, inicio, fim, offset, rotulo, cadernos, motivo: pedido.motivo };
  };

  for (const p of fechados) {
    vistos.add(chaveDoPeriodo(p.tipo, p.inicio));
    itens.push(classificar(p.tipo, p.inicio, p.fim, p.offset, p.rotulo));
  }
  for (const e of arquivo) {
    const chave = chaveDoPeriodo(e.tipoPeriodo, e.inicio);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    // Fora da enumeração: o `offset` e o rótulo saem do relógio de hoje, pela
    // mesma conta da rota da revista. Um começo que não abre período do tipo
    // (linha estragada, ou um tipo que mudou de régua) vira offset nulo — o
    // plano o mostra, e a corrida o recusa em vez de adivinhar.
    const offset = offsetDoInicio(agora, e.tipoPeriodo, e.inicio);
    const rotulo = offset === null ? `${e.tipoPeriodo} ${e.inicio}` : periodBounds(agora, e.tipoPeriodo, offset).label;
    itens.push(classificar(e.tipoPeriodo, e.inicio, e.fim, offset, rotulo));
  }

  // A ordem da corrida: pelo FIM do período, e o mais curto primeiro no empate —
  // a mesma régua de `periodosFechadosDesde`, estendida às semanas do arquivo.
  return itens.sort((a, b) =>
    a.fim !== b.fim ? (a.fim < b.fim ? -1 : 1) : DURACAO_DO_TIPO[a.tipo] - DURACAO_DO_TIPO[b.tipo],
  );
}

/**
 * Os períodos nomeados que **não apareceram** no plano — nem enumerados, nem no
 * arquivo (Story 2.3, revisão).
 *
 * Um erro de digitação em {@link A_REIMPRIMIR} — `2023-09-02` no lugar de
 * `2023-09-01` — some em silêncio: o período não é enumerado (não abre mês), não
 * está no arquivo, e o plano simplesmente não fala dele. O dono rodaria a
 * corrida achando que reimprimiu cinco e teria reimprimido quatro.
 *
 * `soODoTipo` tira da conta o que o recorte legitimamente excluiu.
 */
export function nomeadosForaDoPlano(
  itens: readonly ItemDoPlano[],
  nomeados: readonly PeriodoNomeado[] = A_REIMPRIMIR,
  soODoTipo: TipoEmMassa | null = null,
): PeriodoNomeado[] {
  const noPlano = new Set(itens.map((i) => chaveDoPeriodo(i.tipo, i.inicio)));
  return nomeados.filter(
    (n) => (soODoTipo === null || n.tipo === soODoTipo) && !noPlano.has(chaveDoPeriodo(n.tipo, n.inicio)),
  );
}

/**
 * As contas do plano — o gasto que vai para a tela antes do "sim".
 *
 * `limite` é o `--limite N`: ele **não muda a classificação**, só quantos
 * períodos a corrida vai tocar. O plano continua dizendo a verdade inteira sobre
 * o arquivo, e a conta de chamadas passa a ser a do recorte — que é o número que
 * o dono está prestes a autorizar.
 *
 * `porPeriodo` é quantos cadernos cada período custa: os quatro, ou **um** com
 * `--caderno` (Story 2.8). É o número inteiro da bandeira — a correção de `1
 * dias` nos 35 períodos medidos passa de 140 chamadas para 35 —, e ele tem de chegar à
 * tela antes do "sim", porque é isso que o dono autoriza.
 */
export function contasDoPlano(
  itens: readonly ItemDoPlano[],
  limite: number | null = null,
  porPeriodo: number = CADERNO_IDS.length,
): ContasDoPlano {
  const conta = (c: AcaoNoPlano) => itens.filter((i) => i.acao === c).length;
  const imprimir = conta('imprimir');
  const reimprimir = conta('reimprimir');
  const aFazer = limite === null ? imprimir + reimprimir : Math.min(imprimir + reimprimir, limite);
  const chamadas = aFazer * porPeriodo;
  return {
    imprimir,
    reimprimir,
    pular: conta('pular'),
    aFazer,
    chamadas,
    minutos: Math.round((chamadas * MEDIANA_POR_CHAMADA_S) / 60),
  };
}

/** O plano em tabela — uma linha por período, na ordem da corrida. */
function planoEmTexto(itens: readonly ItemDoPlano[]): string[] {
  return tabela([
    ['    o quê', 'período', 'de', 'a', 'cadernos', 'por quê'],
    ...itens.map((i) => [
      `    ${i.acao}`,
      i.rotulo,
      i.inicio,
      i.fim,
      i.cadernos.length === 0 ? '—' : lista(i.cadernos),
      i.motivo ?? '',
    ]),
  ]);
}

/** Um item que a corrida vai tocar — o plano menos os pulados. */
type ItemAFazer = Omit<ItemDoPlano, 'acao'> & { readonly acao: 'imprimir' | 'reimprimir' };

/** O que a corrida fez com um período. */
export interface PeriodoNaCorrida {
  readonly acao: 'imprimir' | 'reimprimir';
  readonly tipo: TipoComEdicao;
  readonly inicio: string;
  readonly rotulo: string;
  /**
   * `pulada` é o período que a corrida **não tinha por que gravar**, e são três
   * casos — nenhum deles é defeito:
   *
   * - **outro hospedeiro imprimiu** entre o plano e a corrida (`ja-impresso`): o
   *   trabalho está feito, e insistir sobrescreveria a edição do telefone;
   * - **não havia o que dizer** (`sem-caderno`, Story 2.8): zero chamadas, e o
   *   período é o mesmo amanhã;
   * - **nenhum caderno passou** na conferência (`nada-gravado`): custou as
   *   chamadas, a edição ficou como estava, e a corrida seguinte tenta de novo.
   *
   * Só `falhou` conta para o status de saída e para o freio das falhas seguidas.
   */
  readonly desfecho: 'gravada' | 'pulada' | 'falhou';
  /** Quantas chamadas **pagas** o período custou — tenham gravado ou não. */
  readonly chamadas: number;
  /** O motivo, quando falhou ou foi pulada. */
  readonly erro: string | null;
  /** O aviso da capa, quando a edição gravou e a capa não. */
  readonly avisoDaCapa: string | null;
}

export interface RelatorioDaMassa {
  readonly codigo: 0 | 1;
  readonly plano: readonly ItemDoPlano[];
  readonly contas: ContasDoPlano;
  /** `null` quando só o plano rodou — sem o "sim", e no `--exportar`. */
  readonly corrida: readonly PeriodoNaCorrida[] | null;
  /** A corrida parou pelo freio das falhas seguidas, e o que faltava não foi tentado. */
  readonly freada: boolean;
  /** O arquivo escrito pelo `--exportar`, ou `null`. */
  readonly exportado: string | null;
}

/** O que a corrida em massa precisa do mundo. */
export interface DepsDaMassa extends Omit<DepsDaImpressao, 'aoTentar'> {
  /** Grava o arquivo do `--exportar`. Injetável, para o teste não tocar disco. */
  readonly escreverArquivo?: (caminho: string, conteudo: string) => void;
  /** O arquivo já existe? — a guarda de sobrescrita do `--exportar`. */
  readonly arquivoExiste?: (caminho: string) => boolean;
  /**
   * A lista de períodos fechados. Padrão: a enumeração do núcleo desde
   * {@link COMECO_DO_ARQUIVO}.
   *
   * Injetável **para o teste**, que tem um acervo sintético de um mês e não
   * teria o que narrar nos 53 períodos reais. O executável nunca a passa — o
   * começo do arquivo é constante, e mudá-lo é decisão do dono (*Ask First*).
   */
  readonly enumerar?: (agora: Date) => readonly PeriodoFechado[];
  /**
   * A lista de reimpressão. Padrão: {@link A_REIMPRIMIR}, a do dono.
   *
   * Injetável **para o teste**, pelo mesmo motivo de `enumerar`: as cinco
   * nomeadas são períodos de 2023 e 2026 que a fixture sintética não tem. O
   * executável nunca a passa — não há bandeira que amplie a lista, e acrescentar
   * um período é editar o código e commitar.
   */
  readonly nomeados?: readonly PeriodoNomeado[];
}

export interface PedidoEmMassa {
  /** O "sim" explícito. Sem ele, o plano vai à tela e nada é chamado. */
  readonly sim: boolean;
  /** Restringe o recorte a um tipo — a enumeração **e** o arquivo. `null`: os três. */
  readonly tipo: TipoEmMassa | null;
  /**
   * Quantos períodos a corrida toca, no máximo — o `--limite N`.
   *
   * Existe para o ensaio: rodar um ou dois períodos de verdade, conferir a
   * edição e a capa no iPhone, e só então soltar as 212 chamadas. Sem ele o
   * menor recorte possível seria `--tipo year`, com dois.
   */
  readonly limite: number | null;
  /** O caminho do `--exportar`. Com ele, exporta e sai — não imprime nada. */
  readonly exportar: string | null;
  /**
   * O `--caderno <id>` (Story 2.8): a corrida corrige **um** caderno nas edições
   * que já existem, e o critério do plano passa a ser o `prompt_versao` dele.
   * `null`: a campanha da 2.3, pelos períodos nomeados em {@link A_REIMPRIMIR}.
   */
  readonly caderno: CadernoId | null;
}

/**
 * O texto do `--exportar`: as edições da lista de reimpressão como elas estão
 * **hoje**, para o dono commitar em `docs/specs/revista-retrospectiva/` antes de
 * substituí-las.
 *
 * É a pré-condição que a Story 2.6 registrou, no molde do que se fez com as sete
 * edições antigas na janela da 1.9: o texto de uma edição que vai ser
 * sobrescrita não tem outro lugar onde morar — a tabela guarda uma linha por
 * caderno, e a reimpressão a substitui.
 *
 * O texto **aparece aqui**, e só aqui: este arquivo é o destino dele. O terminal
 * continua sem mostrar texto nenhum.
 */
export function exportarEmTexto(
  edicoes: readonly { readonly item: ItemDoPlano; readonly cadernos: readonly CadernoImpresso[] }[],
  agora: Date,
  caderno: CadernoId | null = null,
): string {
  const linhas: string[] = [
    '# As edições que a impressão em massa vai substituir',
    '',
    `> Exportadas em ${localDateStr(agora)} por \`revista:imprimir --massa --exportar\` (Story 2.3),`,
    '> **antes** de a reimpressão sobrescrevê-las.',
    // A prosa segue a corrida que vai rodar: a da 2.3 troca a edição inteira; a
    // de um caderno (2.8) troca uma linha e deixa as outras. Dizer "sob o pacote
    // 3" sobre uma correção de prompt seria escrever no git um motivo falso.
    ...(caderno === null
      ? ['> Elas foram impressas sob o pacote 3 — anterior à gramática da ausência (2.6) e à lápide',
         '> (2.7) —, e é por isso que saem do ar.']
      : [`> A corrida que vem reescreve **só o caderno \`${caderno}\`** delas (prompt abaixo de ${PROMPT_DE_HOJE});`,
         '> os outros cadernos ficam com o texto e a assinatura que estão aqui.']),
    '>',
    '> Guardadas em git em vez de na tabela, como as sete primeiras edições: o git dá **diff**,',
    '> e a tabela fica sem linhas que nenhum caminho de leitura toca.',
    '',
  ];
  for (const { item, cadernos } of edicoes) {
    linhas.push('', '---', '', `## ${item.rotulo} · ${item.inicio} → ${item.fim}`, '');
    linhas.push(`_${item.motivo ?? 'nomeada para reimpressão'}_`, '');
    if (cadernos.length === 0) {
      linhas.push('Sem cadernos gravados no momento da exportação.', '');
      continue;
    }
    for (const c of cadernos) {
      linhas.push(`### ${c.posicao}. ${c.caderno}`, '');
      linhas.push('```');
      linhas.push(`provedor  ${c.provedor} · modelo ${c.modelo}`);
      linhas.push(`prompt_versao ${c.promptVersao} · pacote_versao ${c.pacoteVersao} · agg ${c.aggVersionNoMomento}`);
      linhas.push(`metrica_lider ${c.metricaLider ?? '—'}`);
      linhas.push(`gerado_em ${c.geradoEm}`);
      linhas.push('```', '');
      linhas.push(c.texto, '');
    }
  }
  return `${linhas.join('\n').trimEnd()}\n`;
}

/**
 * A impressão em massa: enumera, classifica, **mostra o plano e para** — e só
 * com o "sim" percorre a lista, um período por vez.
 *
 * Nada aqui reimplementa a impressão: cada período passa por
 * {@link imprimirPeriodo} inteiro, com as mesmas portas, a mesma sequência do
 * núcleo e o mesmo carimbo de capa. O que a massa acrescenta é a lista, a ordem,
 * o portão de gasto e o relatório do fim.
 *
 * **Falha de um período não derruba a corrida** (nem uma exceção, nem um código
 * ≠ 0): ela entra no relatório, a corrida segue, e rodar de novo a tenta outra
 * vez — porque o período que falhou continua sem edição no banco. O processo sai
 * com 1 quando algum falhou.
 */
export async function imprimirEmMassa(pedido: PedidoEmMassa, deps: DepsDaMassa): Promise<RelatorioDaMassa> {
  const { agora, escrever, avisar } = deps;
  const nomeados = deps.nomeados ?? A_REIMPRIMIR;
  const fechados = (deps.enumerar ?? ((d: Date) => periodosFechadosDesde(COMECO_DO_ARQUIVO, d)))(agora)
    .filter((p) => pedido.tipo === null || p.tipo === pedido.tipo);
  const arquivo = await fetchArquivoDeEdicoes(deps.db, deps.userId);
  const alvo = pedido.caderno;
  const plano = montarPlano(fechados, arquivo, agora, nomeados, pedido.tipo, alvo);
  const contas = contasDoPlano(plano, pedido.limite, alvo === null ? CADERNO_IDS.length : 1);
  const soPlano = (codigo: 0 | 1, exportado: string | null): RelatorioDaMassa =>
    ({ codigo, plano, contas, corrida: null, freada: false, exportado });

  escrever(`massa — o arquivo desde ${COMECO_DO_ARQUIVO}, visto de ${localDateStr(agora)}`);
  escrever(`  fuso: ${fusoDe(agora)}`);
  if (alvo !== null) {
    escrever(
      `  --caderno ${alvo}: a corrida reescreve só esse caderno, nas edições que já existem e o têm`
        + ` abaixo do prompt ${PROMPT_DE_HOJE}. Os outros cadernos ficam, e a capa não é trocada.`,
    );
  }
  escrever(
    `  ${contar(fechados.length, 'período fechado enumerado', 'períodos fechados enumerados')}`
      + `${pedido.tipo === null ? ' (mês, trimestre e ano; semana nunca)' : ` do tipo ${NOME_DO_TIPO[pedido.tipo]}`}`
      + ` · ${contar(arquivo.length, 'edição no arquivo', 'edições no arquivo')}`,
  );
  escrever(`  imprimir: ${contas.imprimir} · reimprimir: ${contas.reimprimir} · pular: ${contas.pular}`);
  if (pedido.limite !== null) {
    escrever(`  --limite ${pedido.limite}: a corrida toca só ${contar(contas.aFazer, 'período', 'períodos')}, na ordem do plano`);
  }
  escrever(
    // O "por quê" do número acompanha a campanha: os quatro cadernos custam uma
    // chamada cada; o `--caderno` custa uma por PERÍODO, e é esse o número que o
    // "sim" autoriza.
    `  até ${contar(contas.chamadas, 'chamada de nuvem', 'chamadas de nuvem')}, `
      + `${alvo === null ? 'uma por caderno' : `uma por período (só o caderno ${alvo})`} — `
      + `com a mediana medida de ${MEDIANA_POR_CHAMADA_S} s (a da Saúde do sono, ADR 0050: a revista `
      + `ainda não tem a sua), cerca de ${contar(contas.minutos, 'minuto', 'minutos')} de relógio`,
  );
  for (const l of planoEmTexto(plano)) escrever(l);

  /*
   * Um nomeado que não apareceu no plano é erro de digitação, e ele some calado.
   * Com `--caderno` a lista nomeada não é o critério de nada (ver `montarPlano`),
   * e o aviso diria que cinco períodos de outra campanha "não estão no plano".
   */
  const perdidos = alvo === null ? nomeadosForaDoPlano(plano, nomeados, pedido.tipo) : [];
  if (perdidos.length > 0) {
    avisar(
      `atenção: ${contar(perdidos.length, 'período nomeado para reimpressão não está no plano', 'períodos nomeados para reimpressão não estão no plano')} `
        + `— ${lista(perdidos.map((n) => `${n.tipo} ${n.inicio}`))}. Eles não são enumerados nem estão no arquivo: `
        + 'confira a grafia em A_REIMPRIMIR.',
    );
  }

  /* A exportação: lê o texto de agora das nomeadas, grava e sai. Não imprime nada. */
  if (pedido.exportar !== null) {
    const existe = deps.arquivoExiste ?? ((caminho: string) => existsSync(caminho));
    if (existe(pedido.exportar)) {
      avisar(
        `${pedido.exportar} já existe, e nada foi escrito: este arquivo é a ÚNICA cópia do texto que a\n`
          + '  reimpressão vai substituir. Escolha outro nome, ou apague o de lá depois de conferir que ele\n'
          + '  já está commitado.',
      );
      return soPlano(1, null);
    }
    const aExportar = plano.filter((i) => i.acao === 'reimprimir');
    if (aExportar.length === 0) {
      // O motivo segue o critério que montou o plano. Com `--caderno` não há
      // lista nomeada, e mandar o operador conferir `A_REIMPRIMIR` o poria a
      // procurar numa lista que ali não decide nada.
      avisar(
        `não há nada a exportar: nenhum período do plano ficou como \`reimprimir\`${alvo === null
          ? ' — confira a lista de reimpressão (A_REIMPRIMIR).'
          : `. Com --caderno ${alvo}, só entram as edições que já existem e têm esse caderno abaixo do `
            + `prompt ${PROMPT_DE_HOJE}; pelo visto todas já estão nele.`}\n`
          + '  Nada foi escrito — um arquivo só com cabeçalho pareceria uma exportação que deu certo.',
      );
      return soPlano(1, null);
    }
    const edicoes: { item: ItemDoPlano; cadernos: readonly CadernoImpresso[] }[] = [];
    for (const item of aExportar) {
      edicoes.push({ item, cadernos: await fetchEdicao(deps.db, deps.userId, item.tipo, item.inicio, item.fim) });
    }
    // Uma edição que volta sem caderno nenhum é a que o texto NÃO foi salvo —
    // e ela ainda seria reimpressa. O arquivo sai (o resto tem valor), e o
    // status diz que a exportação não está completa.
    const vazias = edicoes.filter((e) => e.cadernos.length === 0);
    const escreverArquivo = deps.escreverArquivo ?? ((caminho, conteudo) => writeFileSync(caminho, conteudo, 'utf8'));
    escreverArquivo(pedido.exportar, exportarEmTexto(edicoes, agora, alvo));
    escrever(
      `  exportadas ${contar(edicoes.length, 'edição', 'edições')} para ${pedido.exportar} — `
        + 'commite o arquivo antes de reimprimir. Nada foi chamado nem gravado.',
    );
    if (vazias.length > 0) {
      avisar(
        `${contar(vazias.length, 'edição da lista voltou sem caderno nenhum', 'edições da lista voltaram sem caderno nenhum')} `
          + `(${lista(vazias.map((e) => e.item.rotulo))}): o texto delas NÃO foi salvo, porque não há texto no banco. `
          + 'Confira antes de reimprimir.',
      );
      return soPlano(1, pedido.exportar);
    }
    return soPlano(0, pedido.exportar);
  }

  if (!pedido.sim) {
    escrever(
      `  nada foi chamado e nada foi gravado. Para gastar, rode de novo com ${SIM}.`,
    );
    return soPlano(0, null);
  }

  /* A corrida vai gravar: sem as portas da capa, ~48 edições nasceriam sem ela. */
  if (deps.capa === undefined) {
    avisar(
      'a corrida não começou: faltam as portas da capa. A impressão que grava carimba a capa, e sem elas\n'
        + '  as edições nasceriam sem capa com o relatório calado — que é justamente o que a 2.3 veio fechar.',
    );
    return soPlano(1, null);
  }

  /* A corrida. Um período por vez, em ordem cronológica. */
  const aFazer = plano
    .filter((i): i is ItemAFazer => i.acao !== 'pular')
    .slice(0, pedido.limite ?? undefined);
  const corrida: PeriodoNaCorrida[] = [];
  let seguidas = 0;
  let freada = false;
  for (const [k, item] of aFazer.entries()) {
    escrever('');
    escrever(`[${k + 1}/${aFazer.length}] ${item.acao} ${item.rotulo}`);
    let chamadas = 0;
    const base = {
      acao: item.acao,
      tipo: item.tipo,
      inicio: item.inicio,
      rotulo: item.rotulo,
    } as const;
    const registrar = (linha: PeriodoNaCorrida): void => {
      corrida.push(linha);
      seguidas = linha.desfecho === 'falhou' ? seguidas + 1 : 0;
    };
    const v = validarPeriodo(item.tipo, item.inicio, agora);
    if (!v.ok) {
      avisar(`${item.rotulo} não pôde ser impresso, e a corrida segue: ${v.motivo}`);
      registrar({ ...base, desfecho: 'falhou', chamadas: 0, erro: v.motivo, avisoDaCapa: null });
    } else {
      try {
        const r = await imprimirPeriodo(
          {
            periodo: v.periodo,
            semGravar: false,
            // `reimprimir` e `caderno` não andam juntos — é o que
            // `bandeirasIncompativeis` recusa na linha de comando, e o mesmo
            // invariante vale aqui: quem tira a recusa do já impresso na corrida
            // parcial é o próprio alvo.
            reimprimir: alvo === null && item.acao === 'reimprimir',
            caderno: alvo,
          },
          { ...deps, aoTentar: (_c, n) => { chamadas += n; } },
        );
        if (r.codigo === 0) {
          registrar({ ...base, desfecho: 'gravada', chamadas, erro: null, avisoDaCapa: r.capa?.aviso ?? null });
        } else if (r.estado === 'ja-impresso') {
          // Outro hospedeiro imprimiu entre o plano e agora. O trabalho está
          // feito: insistir sobrescreveria a edição do telefone.
          registrar({ ...base, desfecho: 'pulada', chamadas, erro: 'já impresso por outro hospedeiro', avisoDaCapa: null });
        } else if (r.estado === 'sem-caderno' || r.estado === 'nada-gravado') {
          /**
           * **Mudez não é falha, e com `--caderno` ela é corriqueira** (Story 2.8).
           *
           * Com os quatro cadernos, chegar aqui exigia o período inteiro calado — raro
           * o bastante para contar como sinal. Com **um** caderno pedido, basta que
           * aquele caderno não tenha o que dizer, e aí:
           *
           * - `sem-caderno` custa **zero** chamadas e **nunca** se resolve sozinho: o
           *   período é o mesmo na corrida seguinte. Contado como falha, três deles em
           *   sequência parariam a corrida **para sempre**, anunciando "o token que
           *   venceu, cota, ou a nuvem recusando" — que é falso, e manda o dono
           *   procurar um defeito que não existe;
           * - `nada-gravado` é o caderno que foi lido e caiu no piso. Custou chamada, e
           *   a linha antiga dele fica — a corrida seguinte o tenta de novo, que é o
           *   certo.
           *
           * Nenhum dos dois é causa comum, então nenhum alimenta o freio. O freio
           * continua inteiro para o que ele existe: exceção (rede, prazo, porta que
           * rejeitou) e período que nem se valida.
           */
          registrar({
            ...base,
            desfecho: 'pulada',
            chamadas,
            erro: r.estado === 'sem-caderno'
              ? `nada a dizer${alvo === null ? '' : ` no caderno ${alvo}`} — nada foi chamado nem gravado`
              : 'nenhum caderno passou na conferência — a edição ficou como estava',
            avisoDaCapa: null,
          });
        } else {
          registrar({ ...base, desfecho: 'falhou', chamadas, erro: r.estado, avisoDaCapa: null });
        }
      } catch (e) {
        // Rede, prazo, porta que rejeitou: a corrida segue. O período continua sem
        // edição no banco, e a próxima corrida o tenta de novo.
        const erro = e instanceof Error ? e.message : String(e);
        avisar(`${item.rotulo} falhou, e a corrida segue: ${erro}`);
        registrar({ ...base, desfecho: 'falhou', chamadas, erro, avisoDaCapa: null });
      }
    }
    // O freio: falha **seguida** é sinal de causa sistêmica — refresh revogado,
    // 429, cota —, e ela derrubaria os ~50 períodos um a um, pagando o que a
    // nuvem cobrar por cada tentativa. Falha isolada continua não derrubando nada.
    if (seguidas >= FALHAS_SEGUIDAS_QUE_PARAM && k < aFazer.length - 1) {
      freada = true;
      avisar(
        `a corrida parou depois de ${seguidas} falhas seguidas: isso é sinal de causa comum — o token que\n`
          + '  venceu, cota, ou a nuvem recusando —, e não de períodos ruins. Os que faltavam NÃO foram\n'
          + '  tentados; conserte a causa e rode de novo, que a corrida retoma de onde o banco parou.',
      );
      break;
    }
  }

  const conta = (d: PeriodoNaCorrida['desfecho']) => corrida.filter((c) => c.desfecho === d);
  const gravadas = conta('gravada');
  const falhadas = conta('falhou');
  const semCapa = gravadas.filter((c) => c.avisoDaCapa !== null);
  const naoTentados = aFazer.length - corrida.length;
  const pagas = corrida.reduce((s, c) => s + c.chamadas, 0);
  escrever('');
  escrever('a corrida terminou:');
  escrever(
    `  gravadas: ${gravadas.length} · puladas: ${contas.pular + conta('pulada').length} · `
      + `falhadas: ${falhadas.length}${naoTentados > 0 ? ` · não tentadas: ${naoTentados}` : ''} · `
      + `${contar(pagas, 'chamada de nuvem', 'chamadas de nuvem')}`,
  );
  if (semCapa.length > 0) {
    escrever(`  sem capa (a edição existe; a próxima impressão inteira recarimba): ${lista(semCapa.map((c) => c.rotulo))}`);
  }
  // As puladas **na corrida** (não as do plano) saem nomeadas, com o motivo. Sem
  // isto, reclassificar mudez como `pulada` (Story 2.8) a teria escondido: o
  // período não gravou nada, a corrida sai 0, e a tabela das falhas não o mostra.
  // O que muda é o status de saída, não a visibilidade.
  const puladas = conta('pulada');
  if (puladas.length > 0) {
    escrever('  as que a corrida pulou, e por quê (nenhuma é falha):');
    for (const l of tabela(puladas.map((c) => [`    ${c.rotulo}`, c.inicio, c.erro ?? '—']))) escrever(l);
  }
  if (falhadas.length > 0) {
    escrever('  as que falharam, e que rodar de novo tenta outra vez:');
    for (const l of tabela(falhadas.map((c) => [`    ${c.rotulo}`, c.inicio, c.erro ?? '—']))) escrever(l);
  }
  return { codigo: falhadas.length > 0 ? 1 : 0, plano, contas, corrida, freada, exportado: null };
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
  const incompativeis = bandeirasIncompativeis(b);
  if (incompativeis !== null) {
    p.avisar(`${incompativeis}\n  Nada foi aberto. (--ajuda lista as bandeiras)`);
    return 1;
  }
  if (!b.massa && (b.tipo === null || b.inicio === null)) {
    p.avisar(
      `faltam ${[b.tipo === null ? '--tipo' : null, b.inicio === null ? '--inicio' : null].filter(Boolean).join(' e ')}`
        + ' — ou --massa, para o arquivo inteiro\n  (--ajuda lista as bandeiras)',
    );
    return 1;
  }

  /* O fuso, antes do período: é dele que o período sai. */
  const resolvido = 'fusoResolvido' in p ? p.fusoResolvido : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const doFuso = problemaDoFuso(p.env, p.agora, resolvido);
  if (doFuso !== null) {
    p.avisar(`fuso inválido: ${doFuso}\n  Nada foi aberto. Sem TZ, vale o fuso do sistema.`);
    return 1;
  }

  /* O período, antes de qualquer rede. No modo em massa a lista sai da enumeração. */
  let periodo: PeriodoPedido | null = null;
  if (!b.massa) {
    const v = validarPeriodo(b.tipo!, b.inicio!, p.agora);
    if (!v.ok) {
      p.avisar(`período inválido: ${v.motivo}. Nada foi aberto.`);
      return 1;
    }
    periodo = v.periodo;
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
  //
  // **No modo em massa o refresh é obrigatório sempre**, inclusive no plano e na
  // exportação: a corrida dura perto de uma hora, o token de acesso vale uma, e
  // quem viu o plano vai rodar a corrida em seguida — descobrir a falta ali
  // custaria as chamadas já pagas.
  const precisaDeRefresh = b.massa || !b.semGravar;
  if (precisaDeRefresh && c.credenciais.via === 'token' && c.credenciais.refreshToken === null) {
    p.avisar(
      'o script não abriu rede:\n' +
        `  - falta ${comoExportar('refreshToken')} — ${b.massa
          ? 'a corrida em massa chega perto de uma hora pela mediana medida, e passa\n'
            + '    bem disso no pior caso; o token de acesso vence em uma.'
          : 'para gravar, a sessão tem de viver no client, e o token\n    de acesso sozinho não a instala. Com --sem-gravar, o token sozinho basta.'}\n`,
    );
    return 1;
  }
  for (const aviso of c.avisos) p.avisar(`aviso: ${aviso}`);

  const sessao = await (p.abrir ?? abrirSessao)(c.credenciais);
  try {
    const validade = avisoDeValidade({
      expiraEm: sessao.expiraEm,
      podeRenovar: sessao.podeRenovar,
      // Quantas chamadas a impressão de UM período faz: os quatro cadernos, ou
      // um com `--caderno` (Story 2.8).
      chamadas: b.caderno === null ? CADERNO_IDS.length : 1,
      prazoMs: PRAZO_MS,
      agora: p.agora,
    });
    if (validade !== null) p.avisar(`aviso: ${validade}`);
    const deps: DepsDaMassa = {
      db: sessao.db,
      userId: sessao.userId,
      motorPara: motoresDaBancada(sessao, p.buscar),
      agora: p.agora,
      escrever: p.escrever,
      avisar: p.avisar,
      // Sem gravar, não há edição a carimbar: as portas da capa só entram no
      // caminho que grava.
      capa: b.semGravar ? undefined : portasDaCapa(sessao.db, sessao.userId),
    };
    if (b.massa) {
      const r = await imprimirEmMassa(
        {
          sim: b.sim,
          tipo: b.tipo === null ? null : (b.tipo as TipoEmMassa),
          limite: b.limite,
          exportar: b.exportar,
          caderno: b.caderno,
        },
        deps,
      );
      return r.codigo;
    }
    const r = await imprimirPeriodo(
      { periodo: periodo!, semGravar: b.semGravar, reimprimir: b.reimprimir, caderno: b.caderno },
      deps,
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
