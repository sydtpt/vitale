/**
 * De onde vem a entrada de cada leitura — a fonte de amostra por recurso (spike 22/09).
 *
 * O núcleo já é genérico sobre `Descritor<E, S>`: o `ler` percorre qualquer
 * recurso. O que não existia era **de onde tirar os fatos reais de cada leitura
 * dentro do app**, e por isso a bancada só media a Saúde do sono — a amostra dela
 * era a única que alguém tinha escrito. Enquanto foi assim, "comparar motores"
 * queria dizer "comparar motores numa frase de sono": o dono acabou de provar dois
 * pesos abertos no iPhone e não tinha como ver o que eles fazem com um caderno da
 * revista ou com o nome de uma pedalada.
 *
 * Cada fonte diz quatro coisas: **como se chama** na tela, **qual descritor**
 * percorrer, **quais casos** existem agora e **como virar texto** a saída daquele
 * descritor. A tela não sabe de nenhuma das quatro — ela escolhe uma fonte, um
 * caso, e recebe `Linha`s prontas. É isso que impede a bancada de voltar a ter um
 * ramo por leitura.
 *
 * **Nada aqui grava.** A bancada roda em modo `medicao` (AD-9): exatamente o motor
 * pedido, sem recuo, sem piso e sem escrita. Um caso do nome de rota medido aqui
 * não nomeia pedalada nenhuma.
 *
 * **O caso é opaco para a tela.** `CasoDaAmostra.entrada` é `unknown` de propósito:
 * quem a produziu é a fonte, e quem a lê de volta é a mesma fonte, num ponto só
 * ({@link fechar}). Tipar isso na tela exigiria um `switch` por recurso lá, que é
 * exatamente o que esta camada existe para não haver.
 */
import {
  RECURSOS,
  descritorDaRetrospectiva,
  descritorDaSaudeDoSono,
  descritorDoNomeDeRota,
  leituraDoNome,
  ler,
  montarNome,
  pacotesComDado,
  type Activity,
  type CityMark,
  type Descritor,
  type Desfecho,
  type EntradaDaSaude,
  type EntradaPacote,
  type FatosDoNome,
  type Medicao,
  type MotorId,
  type NomePreenchido,
  type PacoteDeFatos,
  type ProblemaDaConferencia,
  type RecursoId,
} from '@vitale/shared';
import { BIKE_ACTIVITY_ID, fatosDaPedalada, type PontaDaRota } from '../../services/route-name';
import { OFFSET_DA_SEMANA_FECHADA, rotaMedivel } from './amostras-regras';
import { motivoDaFalha } from '../assinatura';
import { chaveDaJanela } from '../leitura-da-saude';
import { anel } from './anel';
import { motorPara } from './index';

/* ── o que a tela entrega, e o que ela recebe ────────────────────────────── */

/**
 * O mundo de que as fontes precisam, montado pela tela.
 *
 * **Injetado, e não lido daqui**, pelo mesmo motivo do preparo da amostra
 * (`./amostra.ts`): as três entradas nascem de hooks que só uma tela pode chamar —
 * o `PeriodNav` da Saúde, o `useEntradaDaEdicao` da revista, a store das
 * atividades. A tela entrega o mundo; ela continua sem saber o que cada fonte faz
 * com ele.
 */
export interface ContextoDasAmostras {
  /** A janela que o `PeriodNav` escolheu — a entrada da Saúde do sono, já montada. */
  readonly saude: EntradaDaSaude;
  /**
   * A entrada da edição do período fechado anterior, ou `null` enquanto os dados
   * não chegaram. `null` não é erro: é a resposta honesta de "ainda não dá".
   */
  readonly edicao: EntradaPacote | null;
  /** O que o nome de rota precisa do mundo. */
  readonly pedaladas: {
    /** Sem sessão não há âncoras de casa, e sem âncoras não há fatos. */
    readonly userId: string | null;
    readonly atividades: readonly Activity[];
    /** O traçado de uma pedalada, carregando-o se preciso. */
    readonly pontosDe: (id: string) => Promise<readonly PontaDaRota[] | undefined>;
  };
}

/** Um caso da amostra: a identidade, o rótulo da tela e a entrada do descritor. */
export interface CasoDeAmostra<E> {
  /** Identidade dentro da fonte. Trocar de caso apaga as linhas medidas. */
  readonly chave: string;
  /** Como a tela o chama: "7d · esta janela", "caderno Sono", "pedalada de 14/09 · Ittre". */
  readonly rotulo: string;
  readonly entrada: E;
}

/** Os casos que uma fonte tem agora — e, quando não tem nenhum, por quê. */
export interface CasosDeAmostra<E> {
  readonly casos: readonly CasoDeAmostra<E>[];
  /** Em palavras, só quando a lista está vazia. */
  readonly motivo?: string;
}

/** O caso como a tela o carrega: a entrada é opaca (ver o cabeçalho). */
export type CasoDaAmostra = CasoDeAmostra<unknown>;
export type CasosDaAmostra = CasosDeAmostra<unknown>;

/**
 * Como a tela escolhe o caso desta leitura.
 *
 * Dois valores, e não um `recurso === 'saude-do-sono'` na tela: a Saúde já tem um
 * seletor de janela pronto e inteiro (`PeriodNav`, com contagem de noites e
 * navegação por passo), e nenhuma faixa de chips o substitui. A tela sabe desenhar
 * **um tipo de seletor**, nunca de que leitura se trata.
 */
export type SeletorDeCaso = 'janela-de-sono' | 'chips';

/** Uma fonte, já fechada sobre os tipos do descritor dela. É o que a tela usa. */
export interface FonteDeAmostra {
  readonly recurso: RecursoId;
  /** O rótulo do chip de leitura. */
  readonly rotulo: string;
  readonly seletor: SeletorDeCaso;
  /** Os casos de agora. **Nunca rejeita**: sem caso, devolve a lista vazia com o motivo. */
  casos(ctx: ContextoDasAmostras): Promise<CasosDaAmostra>;
  /** Mede um caso num motor. **Nunca rejeita**: falha vira linha (ver {@link medirUm}). */
  medir(caso: CasoDaAmostra, motor: MotorId): Promise<Linha>;
}

/* ── a linha medida ──────────────────────────────────────────────────────── */

/**
 * Uma medição, já reduzida ao que a tela mostra.
 *
 * **Mora aqui, e não na tela** (spike 22/09): montá-la exige saber o descritor da
 * leitura e como virar texto a saída dele, e a tela não sabe nem pode saber de que
 * leitura se trata. Enquanto esteve lá, a montagem era `descritorDaSaudeDoSono`
 * escrito à mão no meio do componente.
 */
export interface Linha {
  readonly motor: MotorId;
  /**
   * O `Desfecho` do núcleo, mais os dois que só a medição produz. Tipado, e não
   * `string`: é exatamente aqui que um desfecho novo no orquestrador tem de quebrar
   * a compilação, em vez de aparecer como texto cru numa linha do relatório.
   */
  readonly desfecho: Desfecho | 'template' | 'mudo';
  readonly ms: number;
  readonly hash?: string;
  /** A frase montada — do template, na régua; do motor, nas outras colunas. */
  readonly frase?: string;
  /** O que o motor escreveu, antes da interpolação, pelo `emTexto` da fonte. */
  readonly cru?: string;
  readonly tokens?: { readonly entrada: number; readonly saida: number };
  /** Quem forneceu os pesos, como a resposta assinou. */
  readonly provedor?: string;
  /** O modelo que assinou esta medição — no aparelho, a variante ("AFM 3 Core"). */
  readonly modelo?: string;
  readonly problemas?: readonly ProblemaDaConferencia[];
  readonly detalhe?: string;
  /** O motivo em palavras, pela mesma função que a `/sono/saude` usa. */
  readonly motivo?: string | null;
}

/* ── a fonte, antes de fechar sobre os tipos ─────────────────────────────── */

/**
 * Uma fonte com os tipos do descritor à vista. É a forma em que se escreve; a
 * lista guarda o resultado de {@link fechar}.
 */
interface Fonte<E, S> {
  readonly recurso: RecursoId;
  readonly rotulo: string;
  readonly seletor: SeletorDeCaso;
  readonly descritor: Descritor<E, S>;
  /**
   * A saída do descritor em texto, para a tela.
   *
   * Nos dois recursos de texto ela é a identidade; no nome de rota o descritor
   * devolve **peças**, e é o molde que as vira nome. Sem esta função um objeto
   * cairia dentro de um `<Text>` e a tela quebraria — e converter com
   * `JSON.stringify` mostraria ao dono algo que nenhuma leitura de produção mostra.
   */
  emTexto(valor: S, entrada: E): string;
  casos(ctx: ContextoDasAmostras): Promise<CasosDeAmostra<E>>;
}

/**
 * Mede um motor, num caso.
 *
 * Nenhuma falha derruba a varredura: a porta nunca rejeita, e a exceção que
 * sobraria vem de função pura do descritor — defeito, que tem de virar linha em
 * vez de apagar as outras colunas.
 *
 * Modo `medicao`, sempre: exatamente o motor pedido, sem recuo e sem piso.
 */
async function medirUm<E, S>(fonte: Fonte<E, S>, entrada: E, motor: MotorId): Promise<Linha> {
  let m: Medicao<S>;
  try {
    m = await ler(fonte.descritor, entrada, {
      modo: 'medicao',
      motor,
      motorPara,
      registrar: anel.registrar,
      agora: () => new Date(),
    });
  } catch (e) {
    return {
      motor,
      desfecho: 'defeito',
      ms: 0,
      detalhe: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    };
  }

  if (m.tipo === 'template') {
    return {
      motor,
      desfecho: 'template',
      ms: 0,
      ...('frase' in m ? { frase: m.frase } : { detalhe: `sem frase: ${m.ausencia}` }),
    };
  }
  if (m.tipo === 'mudo') return { motor, desfecho: 'mudo', ms: 0 };

  const ms = m.trilha.reduce((soma, t) => soma + t.ms, 0);
  const problemas = m.trilha.flatMap((t) => t.problemas ?? []);
  const ultima = m.trilha[m.trilha.length - 1];
  const assinatura = m.resposta?.assinatura;
  const desfecho = m.desfecho;
  // O texto cru é o que a interpretação leu (`valor`), traduzido pelo `emTexto` da
  // fonte; o `resposta.texto` é o recuo para quando a conferência reprovou antes de
  // haver valor.
  const cru = m.valor !== undefined ? fonte.emTexto(m.valor, entrada) : m.resposta?.texto;
  return {
    motor,
    desfecho,
    ms,
    hash: m.hash,
    ...(m.frase !== undefined ? { frase: m.frase } : {}),
    ...(cru !== undefined ? { cru } : {}),
    ...(m.resposta?.tokens ? { tokens: m.resposta.tokens } : {}),
    ...(assinatura ? { provedor: assinatura.provedor, modelo: assinatura.modelo } : {}),
    ...(problemas.length > 0 ? { problemas } : {}),
    ...(ultima?.detalhe !== undefined ? { detalhe: ultima.detalhe } : {}),
    // A mesma tradução que a `/sono/saude` mostra — a tela de desenvolvimento não
    // tem um segundo vocabulário de falha.
    ...(desfecho === 'ok' ? {} : { motivo: motivoDaFalha(desfecho, motor) }),
  };
}

/**
 * Fecha uma fonte sobre os tipos dela.
 *
 * O `as E` é **a única** conversão do arquivo, e está aqui de propósito: é a volta
 * do caso que esta mesma fonte produziu e que a tela carregou opaco. Nenhum caso
 * troca de fonte no caminho — a tela recarrega os casos e apaga as linhas ao trocar
 * de leitura, e um caso de outra leitura não sobrevive à troca.
 */
function fechar<E, S>(f: Fonte<E, S>): FonteDeAmostra {
  return {
    recurso: f.recurso,
    rotulo: f.rotulo,
    seletor: f.seletor,
    casos: (ctx) => f.casos(ctx),
    medir: (caso, motor) => medirUm(f, caso.entrada as E, motor),
  };
}

/* ── as três leituras ────────────────────────────────────────────────────── */

/**
 * A Saúde do sono: a janela que o `PeriodNav` escolheu, e só ela.
 *
 * Um caso por vez, porque a janela **é** o seletor: a chave é a mesma
 * `chaveDaJanela` que a leitura de produção usa para descartar resposta de janela
 * vencida, então trocar o período troca o caso e apaga as linhas pelo mesmo
 * caminho de todas as outras leituras.
 */
const saudeDoSono: Fonte<EntradaDaSaude, string> = {
  recurso: descritorDaSaudeDoSono.recurso,
  rotulo: 'Saúde do sono',
  seletor: 'janela-de-sono',
  descritor: descritorDaSaudeDoSono,
  emTexto: (texto) => texto,
  casos: (ctx) =>
    Promise.resolve({
      casos: [{ chave: chaveDaJanela(ctx.saude), rotulo: `${ctx.saude.range} · esta janela`, entrada: ctx.saude }],
    }),
};

/**
 * A Retrospectiva: **um caso por caderno** da semana fechada anterior.
 *
 * O grão é o caderno porque é assim que a impressão chama o orquestrador desde a
 * 1.10 — um pedido por caderno, conferido contra o pacote daquele caderno. Medir a
 * edição inteira numa chamada seria medir um caminho que não existe mais.
 *
 * Os pacotes vêm da **porta** (`pacotesComDado`), pela mesma régua do vazio e da
 * cobertura de noites que a impressão usa: um caderno que a bancada medisse e a
 * impressão pulasse seria uma medição sobre fatos que nunca viram modelo.
 */
const retrospectiva: Fonte<PacoteDeFatos, string> = {
  recurso: descritorDaRetrospectiva.recurso,
  rotulo: 'Retrospectiva',
  seletor: 'chips',
  descritor: descritorDaRetrospectiva,
  emTexto: (texto) => texto,
  casos: (ctx) => {
    const entrada = ctx.edicao;
    if (entrada === null) {
      return Promise.resolve({ casos: [], motivo: 'os dados da semana anterior ainda não chegaram' });
    }
    let pacotes: readonly PacoteDeFatos[];
    try {
      // A montagem recusa entrada malformada (lápide fora do catálogo, data que não
      // é dia). Na bancada isso é "não há caso", e não uma tela quebrada.
      pacotes = pacotesComDado(entrada);
    } catch (e) {
      return Promise.resolve({ casos: [], motivo: `o núcleo recusou a entrada da edição: ${mensagem(e)}` });
    }
    if (pacotes.length === 0) {
      return Promise.resolve({ casos: [], motivo: 'nenhum caderno da semana anterior tem o que dizer' });
    }
    return Promise.resolve({
      casos: pacotes.map((p) => ({ chave: p.caderno, rotulo: `caderno ${p.rotulo}`, entrada: p })),
    });
  },
};

/** Quantas pedaladas entram na amostra do nome de rota. */
export const PEDALADAS_NA_AMOSTRA = 5;

/**
 * Quantas pedaladas se tenta abrir para achar as cinco.
 *
 * Existe porque cada tentativa custa uma consulta do traçado: sem teto, um acervo
 * em que ninguém tem ponta gravada varreria o histórico inteiro antes de dizer
 * "não há caso".
 */
const TETO_DE_TENTATIVAS = 15;

/**
 * O nome de rota: as últimas pedaladas **que já têm cidades e traçado**.
 *
 * O crivo é o da produção (`BIKE_ACTIVITY_ID`, `hasRoute`, cidades gravadas), menos
 * a marca de já visitada: aqui não se nomeia nada, e a pedalada mais interessante
 * de medir costuma ser justamente uma que já foi nomeada — o dono compara o que o
 * motor novo escreveria com o nome que está lá.
 *
 * Pedalada sem ponta no traçado é **pulada**, não listada vazia: sem as duas pontas
 * não há forma, sem forma não há molde, e o caso não teria o que medir.
 */
const nomeDeRota: Fonte<FatosDoNome, NomePreenchido> = {
  recurso: descritorDoNomeDeRota.recurso,
  rotulo: 'Nome de rota',
  seletor: 'chips',
  descritor: descritorDoNomeDeRota,
  // O molde é o que transforma as peças em nome (ADR 0041) — contração é gramática,
  // e gramática mora em código. Quando ele não monta, a conferência já reprovou: a
  // linha diz isso em palavras em vez de mostrar um objeto.
  emTexto: (pecas, f) => montarNome(leituraDoNome(f), pecas, f.rota.distanceM) ?? SEM_MOLDE,
  casos: async (ctx) => {
    const { userId, atividades, pontosDe } = ctx.pedaladas;
    if (userId === null) return { casos: [], motivo: 'sem sessão: as âncoras de casa não se leem' };

    const candidatas = atividades
      .filter((a) => a.activityId === BIKE_ACTIVITY_ID && a.hasRoute && !a.hidden && cidadesDe(a).length > 0)
      .sort((a, b) => b.startAt.localeCompare(a.startAt));

    const casos: CasoDeAmostra<FatosDoNome>[] = [];
    let tentadas = 0;
    let degeneradas = 0;
    let ultimaFalha: string | null = null;
    for (const a of candidatas) {
      if (casos.length >= PEDALADAS_NA_AMOSTRA || tentadas >= TETO_DE_TENTATIVAS) break;
      tentadas += 1;
      try {
        const fatos = await fatosDaPedalada(a, await pontosDe(a.id), userId);
        if (fatos === null) continue;
        // **A rota degenerada não entra na amostra** (22/09). O descritor recusa montar
        // pedido para ela — uma rota de 0 km não custa um token —, e o orquestrador
        // devolve `mudo` para TODOS os motores. Na bancada isso aparecia como cinco
        // linhas mudas sem explicação, e foi o que o dono viu: a pedalada mais recente
        // do acervo tem 4,3 km e uma cidade só, que é exatamente o caso recusado.
        // A pergunta é pura e de graça, então é aqui que ela se faz — oferecer um caso
        // que não se pode medir é a tela prometendo o que o núcleo já negou.
        if (!rotaMedivel(fatos)) {
          degeneradas += 1;
          continue;
        }
        casos.push({ chave: a.id, rotulo: rotuloDaPedalada(a), entrada: fatos });
      } catch (e) {
        // O traçado ou as âncoras não vieram. Uma pedalada a menos na amostra não é
        // motivo para a leitura inteira ficar sem caso.
        ultimaFalha = mensagem(e);
      }
    }
    if (casos.length > 0) return { casos };
    return {
      casos,
      motivo:
        candidatas.length === 0
          ? 'nenhuma pedalada com cidades e traçado no acervo carregado'
          : degeneradas === tentadas
            ? `as ${tentadas} pedaladas mais recentes são curtas demais para ganhar nome (o descritor recusa rota de uma cidade com menos de 8 km)`
            : `nenhuma das ${tentadas} pedaladas mais recentes tem as duas pontas do traçado${
                ultimaFalha === null ? '' : ` (última falha: ${ultimaFalha})`
              }`,
    };
  },
};

/** O que a linha mostra quando as peças não montam nome. */
const SEM_MOLDE = '(as peças são válidas e o molde não monta nome com elas)';

function mensagem(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

/** As cidades da pedalada, como o ingest as gravou. */
function cidadesDe(a: Activity): readonly CityMark[] {
  return a.cities ?? [];
}

/** `pedalada de 14/09 · Ittre` — a data local e a primeira cidade do percurso. */
function rotuloDaPedalada(a: Activity): string {
  const d = new Date(a.startAt);
  const dia = Number.isNaN(d.getTime())
    ? a.startAt.slice(0, 10)
    : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const cidade = cidadesDe(a)[0]?.name;
  return cidade === undefined ? `pedalada de ${dia}` : `pedalada de ${dia} · ${cidade}`;
}

/* ── o registro ──────────────────────────────────────────────────────────── */

/**
 * Uma fonte por recurso. **Fechado sobre `RecursoId`**: um recurso novo no núcleo
 * não compila até alguém dizer de onde sai a amostra dele — que é exatamente a
 * lacuna que este arquivo veio fechar.
 */
const POR_RECURSO: Readonly<Record<RecursoId, FonteDeAmostra>> = {
  'saude-do-sono': fechar(saudeDoSono),
  retrospectiva: fechar(retrospectiva),
  'nome-de-rota': fechar(nomeDeRota),
};

/**
 * A ordem dos chips de leitura: a Saúde primeiro, porque é a única que a bancada
 * mediu até hoje e é a leitura cujo pedido o dono conhece de cor — a régua de
 * comparação dele começa ali.
 */
const ORDEM = ['saude-do-sono', 'retrospectiva', 'nome-de-rota'] as const satisfies readonly RecursoId[];

/**
 * A ordem é escrita à mão, e o tipo não a obriga a ser completa: um recurso novo
 * entraria em `POR_RECURSO` (o tipo cobra) e ficaria **invisível** na tela, sem
 * nada quebrar. Morre no carregamento do módulo, antes de qualquer tela.
 */
{
  const fora = RECURSOS.filter((r) => !(ORDEM as readonly RecursoId[]).includes(r));
  if (fora.length > 0) {
    throw new Error(`a bancada não listaria ${fora.join(', ')}: o recurso tem fonte e ficou fora da ordem dos chips`);
  }
}

/** As fontes, na ordem em que a bancada as mostra. */
export const FONTES: readonly FonteDeAmostra[] = ORDEM.map((r) => POR_RECURSO[r]);

/** A fonte deste recurso. */
export function fonteDe(recurso: RecursoId): FonteDeAmostra {
  return POR_RECURSO[recurso];
}

/** Com que leitura a bancada abre. */
export const RECURSO_INICIAL: RecursoId = ORDEM[0];

/** Reexportadas para quem já as importa daqui — a definição mora em `amostras-regras.ts`. */
export { OFFSET_DA_SEMANA_FECHADA, rotaMedivel };
