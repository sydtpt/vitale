/**
 * Acesso à tabela `lua_execucoes` — dono único (AD-4) · AD-5 da espinha da revista.
 *
 * Quatro documentos imutáveis são a autoridade, e não este arquivo:
 * `pre-registro-lua.md` (07/09/2026), `correcao-pre-registro-lua.md` (08/09/2026),
 * `pre-registro-lua-outras-fases.md` (28/09/2026) e
 * `correcao-2-pre-registro-lua-outras-fases.md` (28/09/2026), todos em
 * `docs/specs/revista-retrospectiva/`. A cadeia deles vive em
 * `sleep/lua-carimbo.ts`, e cada execução a carrega gravada.
 *
 * ## O que esta porta existe para garantir
 *
 * A §7 de 07/09 não é sobre armazenamento: é **mecânica anti-gaveta**. O campo da
 * lua tem o problema da gaveta como risco dominante, e a resposta do protocolo não
 * é impedir o dono de rodar o teste de novo — é tornar cada tentativa **permanente
 * e contável**. Daí as quatro propriedades desta porta:
 *
 * 1. **Acumula, nunca substitui** — {@link gravarExecucaoLunar} é `insert`, e não há
 *    `upsert`, `update` nem `delete` aqui. A pilha de tentativas é o que dá sentido
 *    ao contador da §7.4 ({@link contarExecucoesLunares}).
 * 2. **As quatro fases numa escrita só** (§9 de 28/09). A porta recusa antes de
 *    tocar no banco, e o banco recusa no commit — ver o `constraint trigger` da
 *    migração. Escrita parcial não é proibida: é impossível.
 * 3. **Nulo é "não foi medido", nunca zero.** O tradutor não inventa zero para
 *    efeito, p, poder nem z quando um portão reprovou antes de medir.
 * 4. **A leitura entrega uma linha por noite** ({@link fetchNoitesLunares}), porque o
 *    motor **recusa** `wakeDay` repetido — duplicata infla poder.
 *
 * ## Nada aqui decide nada do teste
 *
 * α, lateralidade, direção e família saem de `PROTOCOLO_LUNAR`; o veredito sai de
 * `vereditoLunar()`. Esta porta **confere** que a execução que chegou bate com o
 * protocolo pré-registrado e a grava. Um α diferente do pré-registrado é recusado
 * aqui, com nome — é a única guarda deste arquivo que olha o conteúdo do resultado,
 * e ela existe porque gravar um α que ninguém pré-registrou é exatamente a mudança
 * silenciosa que a cadeia de documentos existe para impedir.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { COORDENADA_DA_LUZ } from '../astro/casa';
import { PHASE_ORDER, type LunarPhaseKind } from '../astro/moon';
import { daylightHours, type Coords } from '../astro/sun';
import {
  BORDAS_DA_JANELA,
  CADEIA_DO_PRE_REGISTRO,
  DIGEST_DA_CADEIA,
  operacionalizacaoLunar,
  type BordaDaJanela,
  type EloDaCadeia,
  type OperacionalizacaoLunar,
} from '../sleep/lua-carimbo';
import {
  PROTOCOLO_LUNAR,
  UNIDADE_DO_MOTIVO,
  type AcervoLunar,
  type FamiliaLunar,
  type Lateralidade,
  type LinhaDoProtocolo,
  type MotivoDoInconclusivo,
  type NoiteLunarMedida,
  type OQueFalta,
  type PortaoLunar,
  type QuatroResultados,
  type ResultadoDaFase,
  type UnidadeDoQueFalta,
  type VereditoLunar,
  type VereditoLunarCompleto,
} from '../sleep/lua-protocolo';
import type { SleepPeriod } from '../models';
import { fetchSleepPeriodsSince } from './sleep';

/** Quatro, e o número tem nome porque a §9 de 28/09 é sobre ele. */
export const FASES_POR_EXECUCAO = 4;

/* ─────────────────── O vocabulário fechado, e de onde ele sai ─────────────────── */

/**
 * Os três vereditos, como valor.
 *
 * É a única lista deste arquivo escrita à mão: todas as outras saem de
 * `PROTOCOLO_LUNAR` ou de `UNIDADE_DO_MOTIVO`, que são a autoridade. `VereditoLunar`
 * é união de tipo e não existe em runtime, e **"nenhum padrão" e "inconclusivo" não
 * são a mesma coisa** (§5 de 07/09) — confundi-los é o erro mais fácil do protocolo,
 * e por isso os três precisam ser valor que o CHECK do banco repita.
 */
export const VEREDITOS_LUNARES: readonly VereditoLunar[] =
  Object.freeze<VereditoLunar[]>(['achado', 'nenhum_padrao', 'inconclusivo']);

/** Sem repetição e em ordem estável — a ordem não importa, a lista sim. */
function distintos<T extends string>(vs: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(vs)].sort() as T[]);
}

/** As quatro, como valor — `PHASE_ORDER` congelado uma vez, e não espalhado por linha lida. */
const FASES_LUNARES: readonly LunarPhaseKind[] = distintos([...PHASE_ORDER]);
const FAMILIAS_LUNARES: readonly FamiliaLunar[] =
  distintos(PROTOCOLO_LUNAR.map((l) => l.familia));
const LATERALIDADES_LUNARES: readonly Lateralidade[] =
  distintos(PROTOCOLO_LUNAR.map((l) => l.lateralidade));
/** As direções que **contam como achado**. `null` não é direção: é "as duas contam". */
const DIRECOES_LUNARES: readonly 'atraso'[] = distintos(
  PROTOCOLO_LUNAR.map((l) => l.direcao).filter((d): d is 'atraso' => d !== null),
);
const MOTIVOS_DO_INCONCLUSIVO: readonly MotivoDoInconclusivo[] =
  distintos(Object.keys(UNIDADE_DO_MOTIVO) as MotivoDoInconclusivo[]);
const UNIDADES_DO_QUE_FALTA: readonly UnidadeDoQueFalta[] =
  distintos(Object.values(UNIDADE_DO_MOTIVO));
/**
 * Os portões são os motivos menos `'poder'`, e isso é a definição do tipo:
 * `MotivoDoInconclusivo = PortaoLunar | 'poder'`. O inconclusivo por poder é o que
 * passa **pelos três portões** e cai depois deles.
 */
const PORTOES_LUNARES: readonly PortaoLunar[] = Object.freeze(
  MOTIVOS_DO_INCONCLUSIVO.filter((m): m is PortaoLunar => m !== 'poder'),
);

/**
 * Cada coluna de vocabulário fechado de `lua_execucoes` e a lista que o CHECK dela
 * repete.
 *
 * Existe para que "a mesma lista, letra por letra" não seja um comentário de SQL:
 * `lua-execucoes.test.ts` lê a migração em disco e compara entrada por entrada. É o
 * molde de `NATUREZAS_DA_CAPA`, com a diferença de que aqui **sete das oito listas
 * são derivadas do protocolo** em vez de reescritas — mover uma fase, um α ou uma
 * lateralidade em `PROTOCOLO_LUNAR` move o que o banco tem de aceitar.
 */
export const VOCABULARIO_DE_LUA_EXECUCOES: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    fase: FASES_LUNARES,
    familia: FAMILIAS_LUNARES,
    lateralidade: LATERALIDADES_LUNARES,
    direcao: DIRECOES_LUNARES,
    veredito: distintos([...VEREDITOS_LUNARES]),
    motivo: MOTIVOS_DO_INCONCLUSIVO,
    portao_reprovado: PORTOES_LUNARES,
    falta_unidade: UNIDADES_DO_QUE_FALTA,
    borda_direita: distintos([...BORDAS_DA_JANELA]),
  });

/* ─────────────────────────── A linha e a tradução ─────────────────────────── */

/**
 * Linha como o PostgREST a devolve (snake_case).
 *
 * **Os números chegam números, e não string**, porque as colunas contínuas são
 * `double precision` e não `numeric` — a escolha está na migração, e uma das razões
 * dela é justamente não precisar de um `Number()` em cada campo aqui. O α das três
 * é 5/3 %, que não tem representação decimal exata, e o `double` é o mesmo valor
 * que o motor usou.
 */
export interface LuaExecucaoRow {
  user_id: string;
  execucao_id: string;
  rodada_em: string;
  cadeia: EloDaCadeia[];
  cadeia_digest: string;
  janela_noites: number;
  hora_utc_do_fim_da_noite: number;
  borda_direita: string;
  acervo_noites: number;
  acervo_noites_distintas: number;
  acervo_de: string | null;
  acervo_ate: string | null;
  acervo_sd_min: number | null;
  acervo_origem_do_eixo_h: number;
  acervo_noites_sem_luz: number;
  acervo_primeira_noite_sem_luz: string | null;
  fase: string;
  familia: string;
  alfa: number;
  lateralidade: string;
  direcao: string | null;
  veredito: string;
  motivo: string | null;
  portao_reprovado: string | null;
  efeito_min: number | null;
  p: number | null;
  z_de_mann_whitney: number | null;
  poder: number | null;
  efeito_minimo_detectavel_min: number | null;
  noites_dentro: number;
  noites_fora: number;
  ciclos: number;
  falta_quanto: number | null;
  falta_unidade: string | null;
  noites_para_80: number | null;
}

/**
 * Ver a nota de `EDICAO_COLUMNS`: coluna esquecida aqui vira `undefined` na tela.
 *
 * A barreira do `architecture.test.ts` fecha o triângulo — esta string, a interface
 * acima e as colunas que a migração cria.
 */
export const LUA_EXECUCAO_COLUMNS =
  'user_id,execucao_id,rodada_em,cadeia,cadeia_digest,janela_noites,'
  + 'hora_utc_do_fim_da_noite,borda_direita,acervo_noites,acervo_noites_distintas,'
  + 'acervo_de,acervo_ate,acervo_sd_min,acervo_origem_do_eixo_h,acervo_noites_sem_luz,'
  + 'acervo_primeira_noite_sem_luz,fase,familia,alfa,lateralidade,direcao,veredito,'
  + 'motivo,portao_reprovado,efeito_min,p,z_de_mann_whitney,poder,'
  + 'efeito_minimo_detectavel_min,noites_dentro,noites_fora,ciclos,falta_quanto,'
  + 'falta_unidade,noites_para_80';

const COLUMNS = LUA_EXECUCAO_COLUMNS;

/**
 * Uma execução lida do banco: o carimbo dela, mais o veredito **na forma exata que
 * o motor produz**.
 *
 * `veredito` é um {@link VereditoLunarCompleto} de verdade, e não uma cópia
 * aproximada: quem lê uma execução gravada e quem acabou de rodar o teste têm o
 * mesmo objeto nas mãos, e o teste da ida e volta é um `deepEqual`. Sem isso, a
 * página precisaria de dois caminhos de renderização para a mesma coisa.
 */
export interface ExecucaoLunar {
  execucaoId: string;
  /** ISO do instante em que a execução rodou — do relógio do servidor. */
  rodadaEm: string;
  /** Os documentos que a autorizaram, na ordem append-only da cadeia. */
  cadeia: readonly EloDaCadeia[];
  cadeiaDigest: string;
  /** Com que janela, que hora da noite e que borda ela rodou. */
  operacionalizacao: OperacionalizacaoLunar;
  veredito: VereditoLunarCompleto;
}

/**
 * O valor é **conferido**, nunca convertido por `as`.
 *
 * O CHECK torna o valor desconhecido impossível — o que faz do cast a escrita mais
 * tentadora e a pior: no dia em que o CHECK for afrouxado, ou em que a linha vier de
 * outro lugar, o valor estranho atravessa até a página e o sintoma aparece longe
 * daqui, como um veredito que não desenha. Explodir alto na fronteira é o
 * comportamento certo para um estado que o banco afirma não existir.
 */
function um<T extends string>(valores: readonly T[], v: unknown, coluna: string): T {
  if (typeof v === 'string' && (valores as readonly string[]).includes(v)) return v as T;
  throw new Error(
    `lua_execucoes.${coluna} com valor desconhecido: ${JSON.stringify(v)} — os aceitos são `
    + `${valores.join(', ')}, e o CHECK da coluna deveria ter recusado este.`,
  );
}

/** O mesmo, aceitando nulo — e **só** nulo: `undefined` é coluna que ninguém pediu. */
function umOuNulo<T extends string>(valores: readonly T[], v: unknown, coluna: string): T | null {
  return v === null ? null : um(valores, v, coluna);
}

/**
 * Quanto falta, com a unidade colada — nunca um sem o outro.
 *
 * O CHECK `falta_tem_numero_e_unidade` torna a meia-falta impossível no banco; aqui
 * ela explode, pelo mesmo motivo do `um()`. O precedente é a story 2.8, o "1 dias":
 * número e unidade que discordam imprimem outra coisa com o nome de noite.
 */
function faltaDaLinha(r: LuaExecucaoRow): OQueFalta | null {
  const unidade = umOuNulo(UNIDADES_DO_QUE_FALTA, r.falta_unidade, 'falta_unidade');
  if (r.falta_quanto === null && unidade === null) return null;
  if (r.falta_quanto === null || unidade === null) {
    throw new Error(
      `lua_execucoes: meia falta na fase ${String(r.fase)} — quanto=${JSON.stringify(r.falta_quanto)}, `
      + `unidade=${JSON.stringify(r.falta_unidade)}. O número sozinho mente, e a unidade sozinha não conta nada.`,
    );
  }
  return { quanto: r.falta_quanto, unidade };
}

/** Uma linha → o resultado daquela fase, na forma exata de `ResultadoDaFase`. */
function toResultadoDaFase(r: LuaExecucaoRow): ResultadoDaFase {
  return {
    fase: um(FASES_LUNARES, r.fase, 'fase'),
    familia: um(FAMILIAS_LUNARES, r.familia, 'familia'),
    alfa: r.alfa,
    lateralidade: um(LATERALIDADES_LUNARES, r.lateralidade, 'lateralidade'),
    direcao: umOuNulo(DIRECOES_LUNARES, r.direcao, 'direcao'),
    veredito: um(VEREDITOS_LUNARES, r.veredito, 'veredito'),
    motivo: umOuNulo(MOTIVOS_DO_INCONCLUSIVO, r.motivo, 'motivo'),
    portaoReprovado: umOuNulo(PORTOES_LUNARES, r.portao_reprovado, 'portao_reprovado'),
    efeitoMin: r.efeito_min,
    p: r.p,
    zDeMannWhitney: r.z_de_mann_whitney,
    poder: r.poder,
    efeitoMinimoDetectavelMin: r.efeito_minimo_detectavel_min,
    noitesDentro: r.noites_dentro,
    noitesFora: r.noites_fora,
    ciclos: r.ciclos,
    falta: faltaDaLinha(r),
    noitesPara80: r.noites_para_80,
  };
}

/**
 * A cadeia gravada, **conferida na forma** — é `jsonb`, e o CHECK só cobra que seja
 * um array de quatro ou mais.
 *
 * O que a coluna guarda é a resposta à pergunta *quais documentos autorizaram isto*.
 * Uma entrada sem `arquivo`, ou com um `sha256` que não é um sha256, é uma resposta
 * que não responde nada — e ela chegaria até a página como um item de lista vazio, em
 * vez de explodir aqui.
 */
function cadeiaDaLinha(r: LuaExecucaoRow): readonly EloDaCadeia[] {
  const crua: unknown = r.cadeia;
  if (!Array.isArray(crua) || crua.length === 0) {
    throw new Error(
      `lua_execucoes.cadeia não é uma lista de documentos: ${JSON.stringify(crua)} — o CHECK da coluna `
      + 'deveria ter recusado esta.',
    );
  }
  return crua.map((e, i) => {
    const elo = e as Partial<EloDaCadeia> | null;
    if (
      elo === null || typeof elo !== 'object'
      || typeof elo.arquivo !== 'string' || elo.arquivo.length === 0
      || typeof elo.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(elo.sha256)
    ) {
      throw new Error(
        `lua_execucoes.cadeia tem elo torto na posição ${i}: ${JSON.stringify(e)} — cada elo é `
        + '{ arquivo, sha256 }, e o sha256 são 64 hexadecimais minúsculos.',
      );
    }
    return { arquivo: elo.arquivo, sha256: elo.sha256 };
  });
}

function acervoDaLinha(r: LuaExecucaoRow): AcervoLunar {
  return {
    noites: r.acervo_noites,
    noitesDistintas: r.acervo_noites_distintas,
    de: r.acervo_de,
    ate: r.acervo_ate,
    sdMin: r.acervo_sd_min,
    origemDoEixoH: r.acervo_origem_do_eixo_h,
    noitesSemLuz: r.acervo_noites_sem_luz,
    primeiraNoiteSemLuz: r.acervo_primeira_noite_sem_luz,
  };
}

/**
 * As colunas de **execução** de uma linha, como texto comparável.
 *
 * Elas repetem nas quatro linhas por desenho (o grão é por fase), e o banco **não**
 * cobra que concordem: cobrar exigiria um `having` sobre valores que podem ser nulos,
 * cuja semântica de `distinct` com nulo é uma armadilha, e um erro meu ali custaria
 * uma segunda janela de migração. A conferência mora aqui, na fronteira de leitura,
 * que é onde uma discordância produziria a mentira — uma execução que diz que rodou
 * sobre 290 noites em três linhas e 280 na quarta.
 */
function assinaturaDaExecucao(r: LuaExecucaoRow): string {
  return JSON.stringify([
    r.execucao_id, r.rodada_em, r.cadeia, r.cadeia_digest, r.janela_noites,
    r.hora_utc_do_fim_da_noite, r.borda_direita, r.acervo_noites,
    r.acervo_noites_distintas, r.acervo_de, r.acervo_ate, r.acervo_sd_min,
    r.acervo_origem_do_eixo_h, r.acervo_noites_sem_luz, r.acervo_primeira_noite_sem_luz,
  ]);
}

/**
 * As quatro linhas de uma execução → a execução.
 *
 * **Quatro, e uma por fase.** O `constraint trigger` da migração já o garante no
 * banco; aqui a conferência é o que transforma a garantia em tipo — sem ela, a tupla
 * de quatro sairia por `as` e uma leitura de três linhas viraria uma página com uma
 * fase `undefined`.
 *
 * A ordem de saída é a de `PHASE_ORDER` — a lunação, não a importância, e não a
 * ordem em que o banco devolveu.
 */
export function toLuaExecucao(linhas: readonly LuaExecucaoRow[]): ExecucaoLunar {
  if (linhas.length !== FASES_POR_EXECUCAO) {
    throw new Error(
      `lua_execucoes: uma execução tem ${FASES_POR_EXECUCAO} linhas, uma por fase, e chegaram `
      + `${linhas.length} — as quatro fases rodam juntas ou nenhuma roda (§9 do pré-registro de 28/09/2026).`,
    );
  }
  const assinaturas = new Set(linhas.map(assinaturaDaExecucao));
  if (assinaturas.size !== 1) {
    throw new Error(
      `lua_execucoes: as ${linhas.length} linhas desta execução discordam sobre a própria execução `
      + `(${assinaturas.size} assinaturas distintas) — identificador, hora, cadeia, operacionalização e `
      + `acervo são da execução, não da fase, e uma discordância aqui faria a página afirmar duas coisas.`,
    );
  }
  const porFase = new Map<string, LuaExecucaoRow>();
  for (const r of linhas) {
    if (porFase.has(r.fase)) {
      throw new Error(`lua_execucoes: a fase ${JSON.stringify(r.fase)} veio duas vezes na mesma execução.`);
    }
    porFase.set(r.fase, r);
  }
  const naOrdem = PHASE_ORDER.map((fase) => {
    const r = porFase.get(fase);
    if (r === undefined) {
      throw new Error(
        `lua_execucoes: a execução não tem a fase ${fase} — as quatro são ${PHASE_ORDER.join(', ')}.`,
      );
    }
    return r;
  });
  const primeira = naOrdem[0];
  const fases = [
    toResultadoDaFase(naOrdem[0]),
    toResultadoDaFase(naOrdem[1]),
    toResultadoDaFase(naOrdem[2]),
    toResultadoDaFase(naOrdem[3]),
  ] as const satisfies QuatroResultados;
  return {
    execucaoId: primeira.execucao_id,
    rodadaEm: primeira.rodada_em,
    cadeia: cadeiaDaLinha(primeira),
    cadeiaDigest: primeira.cadeia_digest,
    operacionalizacao: {
      janelaNoites: primeira.janela_noites,
      horaUtcDoFimDaNoite: primeira.hora_utc_do_fim_da_noite,
      bordaDireita: um(BORDAS_DA_JANELA, primeira.borda_direita, 'borda_direita'),
    },
    veredito: { fases, acervo: acervoDaLinha(primeira) },
  };
}

/* ─────────────────────────── As leituras ─────────────────────────── */

/**
 * A fase pela qual o contador conta. Qualquer uma serve; esta é a primeira da
 * lunação.
 *
 * **Por que contar por uma fase, e não dividir o total por quatro.** A chave primária
 * é `(user_id, execucao_id, fase)`, então cada execução tem **exatamente uma** linha
 * desta fase: contá-las é contar execuções, exatamente, numa ida ao banco. Dividir o
 * total por quatro daria o mesmo número enquanto a invariante valesse, e um número
 * fracionário sem sentido no dia em que não valesse — o contador passaria a **depender**
 * da invariante em vez de ler o que existe.
 */
const FASE_DO_CONTADOR: LunarPhaseKind = PHASE_ORDER[0];

/**
 * Quantas execuções já foram gravadas — o contador da §7.4.
 *
 * *"A página mostra o contador de execuções. Se foram seis, a página diz sexta
 * execução."* Zero é resposta, não erro: é "ainda não rodou".
 */
export async function contarExecucoesLunares(db: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await db
    .from('lua_execucoes')
    .select('execucao_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('fase', FASE_DO_CONTADOR);
  if (error) throw error;
  return count ?? 0;
}

/**
 * A execução mais recente, ou `null` se nenhuma foi gravada.
 *
 * *"A página lê a última linha gravada e nunca calcula um veredito ao abrir"* — uma
 * execução é uma decisão, não um render.
 *
 * ## Por que `limit(4)` basta, e por que a ordem tem três critérios
 *
 * A ordenação `(rodada_em desc, execucao_id desc, fase asc)` é **total**, e como toda
 * execução tem exatamente quatro linhas (o `constraint trigger`), as quatro primeiras
 * são as quatro da execução mais recente — inclusive se duas execuções empatarem no
 * `rodada_em`, caso em que o `execucao_id` desempata e as linhas de uma não se
 * intercalam com as da outra. Sem o segundo critério, um empate misturaria duas
 * execuções e `toLuaExecucao` explodiria com "a fase veio duas vezes", que é falha
 * alta mas pelo motivo errado.
 *
 * **Não pagina, e isso não contradiz `paginate.ts`:** a regra de lá é para consulta
 * por intervalo que cresce com o tempo. Esta pede quatro linhas e recebe quatro.
 */
export async function fetchUltimaExecucaoLunar(
  db: SupabaseClient,
  userId: string,
): Promise<ExecucaoLunar | null> {
  const { data, error } = await db
    .from('lua_execucoes')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('rodada_em', { ascending: false })
    .order('execucao_id', { ascending: false })
    .order('fase', { ascending: true })
    .limit(FASES_POR_EXECUCAO);
  if (error) throw error;
  const linhas = (data ?? []) as unknown as LuaExecucaoRow[];
  return linhas.length === 0 ? null : toLuaExecucao(linhas);
}

/* ─────────────────── As noites que alimentam o motor ─────────────────── */

/**
 * As noites do acervo, **uma por `wakeDay`**, com as horas de luz já resolvidas.
 *
 * ## A noite com dois períodos de sono: colapsa pelo `onset_at` mais cedo
 *
 * `sleep_periods` tem chave `(user_id, onset_at)`, então um `wakeDay` pode ter dois
 * períodos — e `vereditoLunar()` **recusa** `wakeDay` repetido em vez de deduplicar,
 * porque escolher em silêncio é escolher um desfecho e uma duplicata que passasse
 * entraria nas duas colunas contando como informação nova, inflando o poder.
 *
 * A regra é o **`onset_at` mais cedo da noite**. O argumento: o desfecho do §3 é *a
 * hora de apagar*, e apagar é quando o sono começou; um período posterior na mesma
 * noite é um despertar, que `awakenings` já modela. Isso é operacionalização, como a
 * escolha das 08:00 UTC foi — não muda o desfecho —, mas é **escolha**, e por isso
 * está declarada aqui, no comentário da coluna `acervo_de` da migração e na segunda
 * correção de 28/09.
 *
 * ## A luz é a do `wakeDay`, e por que esse dia
 *
 * A covariável do §3 é obrigatória e não é refinamento: as noites cobrem 502 dias de
 * calendário com cobertura sazonal desigual, e sem ela um achado lunar é um achado
 * sazonal com outro nome. Ela é lida no `wakeDay` — a **mesma chave** que identifica
 * a noite em todo o protocolo —, e não no dia local do `onsetAt`, que é a véspera na
 * maioria das noites. As duas escolhas diferem por **um dia de luz**: medido em
 * `COORDENADA_DA_LUZ` ao longo de 2025, no máximo **3,9 min** (18/03, perto do
 * equinócio) e **0,01 min** no solstício. Uma chave só para a noite vale mais que
 * quatro minutos de luz — e quem auditar recalcula a covariável a partir do
 * `wakeDay` gravado, sem precisar do fuso da noite.
 *
 * `luzH` sai `null` quando a conta não existe (data torta, coordenada fora do globo).
 * O motor trata isso como o portão da luz reprovando, para as quatro fases.
 */
export function noitesLunaresDe(
  periodos: readonly SleepPeriod[],
  coords: Readonly<Coords> = COORDENADA_DA_LUZ,
): NoiteLunarMedida[] {
  const porNoite = new Map<string, { periodo: SleepPeriod; em: number }>();
  for (const p of periodos) {
    const em = Date.parse(p.onsetAt);
    if (!Number.isFinite(em)) {
      throw new RangeError(
        `sleep_periods: onsetAt não é um instante ('${String(p.onsetAt)}', noite de `
        + `'${String(p.wakeDay)}') — sem ele não há como saber qual dos períodos da noite é o mais cedo.`,
      );
    }
    const atual = porNoite.get(p.wakeDay);
    if (atual === undefined || em < atual.em) porNoite.set(p.wakeDay, { periodo: p, em });
  }
  // Ordenado por `wakeDay`: a lista que o motor recebe não precisa de ordem por
  // contrato, mas duas execuções sobre o mesmo acervo têm de produzir a mesma coisa,
  // e a ordem da leitura do banco não é promessa que valha carregar até aqui.
  return [...porNoite.keys()].sort().map((wakeDay) => {
    const { periodo } = porNoite.get(wakeDay)!;
    const luz = daylightHours(wakeDay, coords);
    return {
      wakeDay,
      onsetAt: periodo.onsetAt,
      tzOffset: periodo.tzOffset,
      luzH: Number.isFinite(luz) ? luz : null,
    };
  });
}

/**
 * As noites do acervo a partir de `desde`, prontas para `vereditoLunar()`.
 *
 * `desde` é explícito e não tem padrão: o intervalo do §3 começa em 23/04/2025, e
 * quem decide o alcance de uma execução é quem a autoriza — um padrão escondido aqui
 * seria uma decisão de protocolo tomada por um valor omitido.
 *
 * A tabela é lida pelo módulo dono dela (`data/sleep.ts`, que pagina), e não por um
 * `.from('sleep_periods')` novo: é a AD-4, e uma segunda consulta à mesma tabela é
 * uma segunda chance de esquecer a paginação.
 */
export async function fetchNoitesLunares(
  db: SupabaseClient,
  userId: string,
  desde: string,
  coords: Readonly<Coords> = COORDENADA_DA_LUZ,
): Promise<NoiteLunarMedida[]> {
  return noitesLunaresDe(await fetchSleepPeriodsSince(db, userId, desde), coords);
}

/* ─────────────────────────── A escrita ─────────────────────────── */

/**
 * A execução não foi gravada, e o motivo está na mensagem.
 *
 * Duas causas, e as duas são "isto não é uma execução autorizada": faltou fase (ou
 * veio fase repetida), ou uma fase chegou com α, lateralidade, direção ou família
 * que `PROTOCOLO_LUNAR` não pré-registrou. **Nada foi gravado** em nenhum dos casos —
 * a porta erra antes de tocar no banco.
 */
export class ExecucaoLunarRecusada extends Error {
  constructor(motivo: string) {
    super(`a execução lunar foi recusada e nada foi gravado — ${motivo}`);
    this.name = 'ExecucaoLunarRecusada';
  }
}

function linhaDoProtocolo(fase: LunarPhaseKind): LinhaDoProtocolo | undefined {
  return PROTOCOLO_LUNAR.find((l) => l.fase === fase);
}

/**
 * As quatro chegaram, e cada uma bate com o que foi pré-registrado para ela.
 *
 * A primeira metade é a §9 de 28/09: *"uma execução autorizada calcula as quatro
 * fases, grava as quatro e publica as quatro"*. Rodar uma, ver o resultado e decidir
 * se roda as outras é o jardim dos caminhos que se bifurcam com quatro portas.
 *
 * A segunda metade é o que impede a mudança silenciosa de α. O motor monta cada
 * resultado a partir de `PROTOCOLO_LUNAR`, então o desvio não é construível por ele
 * — e é exatamente por isso que a guarda existe: quem gravar por outro caminho (um
 * script, um backfill, uma chamada à mão) não consegue gravar um α que documento
 * nenhum autorizou. O α arredondado que os documentos imprimem (1,67%) é **mais
 * frouxo** que 5/3 %, e é o tipo de diferença que passaria sem isto.
 */
function conferirContraOProtocolo(fases: QuatroResultados): void {
  if (fases.length !== FASES_POR_EXECUCAO) {
    throw new ExecucaoLunarRecusada(
      `chegaram ${fases.length} fase(s) e uma execução grava as ${FASES_POR_EXECUCAO}, ou nenhuma `
      + '(§9 do pré-registro de 28/09/2026)',
    );
  }
  const vistas = new Set<string>();
  for (const f of fases) {
    if (vistas.has(f.fase)) {
      throw new ExecucaoLunarRecusada(`a fase ${f.fase} chegou duas vezes`);
    }
    vistas.add(f.fase);
    const linha = linhaDoProtocolo(f.fase);
    if (linha === undefined) {
      throw new ExecucaoLunarRecusada(
        `a fase ${JSON.stringify(f.fase)} não está no protocolo — as quatro são ${PHASE_ORDER.join(', ')}`,
      );
    }
    if (
      f.familia !== linha.familia
      || f.alfa !== linha.alfa
      || f.lateralidade !== linha.lateralidade
      || f.direcao !== linha.direcao
    ) {
      throw new ExecucaoLunarRecusada(
        `a fase ${f.fase} chegou com família ${f.familia}, α ${f.alfa}, ${f.lateralidade} e direção `
        + `${String(f.direcao)}, e o protocolo pré-registrou família ${linha.familia}, α ${linha.alfa}, `
        + `${linha.lateralidade} e direção ${String(linha.direcao)} (${linha.documento})`,
      );
    }
  }
  for (const l of PROTOCOLO_LUNAR) {
    if (!vistas.has(l.fase)) throw new ExecucaoLunarRecusada(`faltou a fase ${l.fase}`);
  }
}

/**
 * Grava uma execução — a **única** escrita em `lua_execucoes`, e um `insert`.
 *
 * ## `insert`, jamais `upsert`
 *
 * A §7.2 é literal: *"nunca substitui — **acumula**"*. Um `upsert` aqui apagaria a
 * primeira execução na segunda e tiraria o sentido do contador da §7.4, que é a peça
 * anti-gaveta inteira. Não existe caminho de `update` nem de `delete` neste módulo.
 *
 * ## `execucao_id` e `rodada_em` não são enviados
 *
 * Os dois saem de `default` do banco, e os dois saem do **mesmo**
 * `transaction_timestamp()`: `now()` é constante dentro da transação, então as quatro
 * linhas de um `insert` (uma statement, uma transação) recebem o mesmo identificador
 * sem que ninguém precise combinar nada. Gerar o uuid aqui não era opção — o Hermes
 * não tem `crypto.randomUUID` e o repositório nunca gerou uuid fora do banco. Ver o
 * comentário da coluna na migração.
 *
 * ## Sem guarda de conta trocada, ao contrário de `gravarCapa`
 *
 * Lá a guarda existe porque a impressão leva um minuto ou mais entre ler os dados de
 * um dono e gravar para `auth.uid()`. Aqui a escrita é um ato só, e o `with check` da
 * RLS já recusa gravar para outro dono — inventar a conferência custaria uma ida a
 * `auth.getSession()` para cobrir uma janela de milissegundos que a política fecha.
 *
 * ## A cadeia vai gravada, inteira
 *
 * Não só o digest: a pergunta que um leitor futuro faz é *quais documentos
 * autorizaram isto*. O digest vai ao lado, como forma curta.
 */
export async function gravarExecucaoLunar(
  db: SupabaseClient,
  userId: string,
  veredito: VereditoLunarCompleto,
): Promise<ExecucaoLunar> {
  conferirContraOProtocolo(veredito.fases);
  const op = operacionalizacaoLunar();
  const a = veredito.acervo;
  const linhas = veredito.fases.map((f) => ({
    user_id: userId,
    // Objetos novos, e não os congelados da constante: o que vai para o banco é
    // valor, e serializar a constante criaria um laço entre o que está gravado e o
    // que o módulo guarda em memória.
    cadeia: CADEIA_DO_PRE_REGISTRO.map((e) => ({ arquivo: e.arquivo, sha256: e.sha256 })),
    cadeia_digest: DIGEST_DA_CADEIA,
    janela_noites: op.janelaNoites,
    hora_utc_do_fim_da_noite: op.horaUtcDoFimDaNoite,
    borda_direita: op.bordaDireita,
    acervo_noites: a.noites,
    acervo_noites_distintas: a.noitesDistintas,
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
  }));

  const { data, error } = await db
    .from('lua_execucoes')
    .insert(linhas)
    .select(COLUMNS);
  if (error) throw error;
  return toLuaExecucao((data ?? []) as unknown as LuaExecucaoRow[]);
}
