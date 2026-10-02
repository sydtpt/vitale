/**
 * A correção manual, e as testemunhas que a convocam.
 *
 * ## Por que existe
 *
 * O sensor erra **uma vez a cada quatro dias** no aparelho dele — medido, não suposto
 * (ver `fixture-24-dias`). E a manchete escolhida é binária: perdida uma borda, o dia
 * inteiro troca de categoria. Sem uma forma de corrigir, a métrica carrega para sempre
 * um dia de reclusão que não houve.
 *
 * ## A correção é uma visita, não um remendo
 *
 * Ela entra como `source: 'manual'`, com `placeId: null` quando o que se corrige é
 * *"eu saí"* — e `null` já significa, neste modelo, **fora de qualquer lugar
 * conhecido**. Nenhuma tabela nova, nenhum campo paralelo.
 *
 * Mecanicamente ela é **subtração de intervalo**: o geofence continua afirmando
 * presença em casa o dia todo, e a correção corta esse pedaço fora. Por isso a
 * precedência precisa ser código e não convenção — sem ela o dia soma 26 horas.
 *
 * ```
 * geofence   [■■■■■■■■■■■■■■■■■■■■■■■■]  casa, o dia todo
 * manual              [░░░░░]            "saí 14:02, voltei 16:48"
 * resultado  [■■■■■■■■]     [■■■■■■■■■]  duas estadias + um vão
 * ```
 *
 * **A medição não é apagada.** Esta função é pura: recebe a lista medida e devolve
 * outra. Quem guarda as duas é o banco — e lá a lição é o `type_edited`, que nasceu
 * porque a correção **não durava**: o reescritor regravava por cima "sem erro, sem
 * aviso, sem marca". Aqui o reescritor é o rollup.
 *
 * ## As testemunhas não acusam, perguntam
 *
 * Três detectores, nenhum deles com poder de decidir:
 *
 * | Testemunha | Audita | O que ela sabe |
 * |---|---|---|
 * | a própria sequência | as duas bordas | `exit`→`exit` e `enter`→`enter` |
 * | `sleep_periods` | a **chegada** | dormiu, e não há presença em casa no dia |
 * | atividade com rota | a **saída** | o dia diz "não saiu" e há uma pedalada nele |
 *
 * Uma das seis anomalias do log real é **falso positivo** — dois `exit` separados por
 * 4 ms, com o estado da região velho. É por isso que a caixa precisa da resposta
 * *"está certo"* tanto quanto da *"saí"*: a máquina levanta a dúvida, ela não a
 * resolve.
 */

import type { Anomalia, FonteDaVisita, Noite, Visita } from './eventos';
import type { DiaDePresenca } from './dias';

export type { FonteDaVisita, Noite };

export interface Correcao {
  /** `null` = "eu estava fora". Com lugar, é "eu estava ali". */
  placeId: string | null;
  arrivedAt: string;
  departedAt: string;
}

/**
 * Precedência `manual > geofence > clvisit`, aplicada como subtração.
 *
 * Toda visita que cruza o intervalo corrigido é cortada por ele: fatiada em duas,
 * aparada numa ponta, ou removida quando o intervalo a engole inteira. Só depois a
 * correção com lugar é inserida.
 *
 * Visita em curso (`departedAt` nulo) também é cortada — ela só não é *fechada* pela
 * correção que termina depois dela, porque ainda está acontecendo.
 */
export function aplicarCorrecoes(
  visitas: readonly Visita[],
  correcoes: readonly Correcao[],
): Visita[] {
  let atual: Visita[] = visitas.map((v) => ({ ...v }));

  for (const c of correcoes) {
    const de = Date.parse(c.arrivedAt);
    const ate = Date.parse(c.departedAt);
    if (!(ate > de)) continue;

    const proximo: Visita[] = [];
    for (const v of atual) {
      if (v.source === 'manual') {
        proximo.push(v);
        continue;
      }
      const vDe = Date.parse(v.arrivedAt);
      const vAte = v.departedAt === null ? Number.POSITIVE_INFINITY : Date.parse(v.departedAt);
      if (vAte <= de || vDe >= ate) {
        proximo.push(v);
        continue;
      }
      // Pedaço antes do corte.
      if (vDe < de) {
        proximo.push({
          ...v,
          departedAt: new Date(de).toISOString(),
          departedSource: 'manual',
        });
      }
      // Pedaço depois do corte. Uma visita em curso continua em curso.
      if (vAte > ate) {
        proximo.push({
          ...v,
          arrivedAt: new Date(ate).toISOString(),
          departedAt: v.departedAt === null ? null : v.departedAt,
        });
      }
    }

    if (c.placeId !== null) {
      proximo.push({
        placeId: c.placeId,
        arrivedAt: c.arrivedAt,
        departedAt: c.departedAt,
        departedSource: 'manual',
        source: 'manual',
      });
    }
    atual = proximo.sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
  }

  return atual;
}

export type MotivoDaDuvida = 'sequencia' | 'sono' | 'atividade';

export interface Contradicao {
  /**
   * Chave estável da dúvida. É por ela que o aparelho guarda **as duas** respostas —
   * "saí" e "está certo" —, senão a mesma pergunta volta toda semana.
   */
  chave: string;
  dia: string;
  motivo: MotivoDaDuvida;
  /** Instantes que delimitam a dúvida. */
  de: string;
  ate: string;
  /**
   * Preenchimento proposto para a folha de correção, quando a testemunha o conhece.
   *
   * É isto que derruba a objeção de que ninguém reconstitui horário três semanas
   * depois: quem acusou a contradição foi a atividade, e ela traz `start_at`/`end_at`.
   */
  sugestao?: Correcao;
}

export interface Atividade {
  /** Instante de início. */
  inicio: string;
  fim?: string;
  /** Só atividade com rota serve de testemunha: ela prova deslocamento. */
  temRota: boolean;
}

export interface EntradaDasDuvidas {
  dias: readonly DiaDePresenca[];
  anomalias: readonly Anomalia[];
  tz: string;
  casa: string;
  /** Presença medida em casa, por dia. Usada para auditar a chegada com o sono. */
  diasComCasa?: ReadonlySet<string>;
  noites?: readonly Noite[];
  atividades?: readonly Atividade[];
}

/**
 * Tudo que o app tem a perguntar, numa lista só, ordenada por dia.
 *
 * O núcleo **não escreve frase**: ele devolve o fato e o preenchimento proposto. Quem
 * escreve a pergunta é a tela — e é por isso que nada aqui carrega texto.
 */
export function contradicoes(e: EntradaDasDuvidas): Contradicao[] {
  const out: Contradicao[] = [];

  for (const a of e.anomalias) {
    out.push({
      chave: `seq:${a.kind}:${a.ate}`,
      dia: diaDe(a.ate, e.tz),
      motivo: 'sequencia',
      de: a.de,
      ate: a.ate,
    });
  }

  // A noite aconteceu e não há presença em casa no dia dela: ou dormiu fora — que é
  // uma métrica que ele quer — ou a chegada se perdeu. A testemunha não decide qual.
  for (const n of e.noites ?? []) {
    const dia = diaDe(n.inicio, e.tz);
    if (e.diasComCasa?.has(dia)) continue;
    out.push({ chave: `sono:${n.inicio}`, dia, motivo: 'sono', de: n.inicio, ate: n.fim });
  }

  // Dia que afirma reclusão com uma atividade de rota dentro. Aqui a dúvida já vem
  // com a resposta proposta: a própria atividade sabe quando começou e terminou.
  const semSair = new Set(e.dias.filter((d) => d.estado === 'nao-saiu').map((d) => d.dia));
  for (const a of e.atividades ?? []) {
    if (!a.temRota) continue;
    const dia = diaDe(a.inicio, e.tz);
    if (!semSair.has(dia)) continue;
    out.push({
      chave: `ativ:${a.inicio}`,
      dia,
      motivo: 'atividade',
      de: a.inicio,
      ate: a.fim ?? a.inicio,
      sugestao: a.fim
        ? { placeId: null, arrivedAt: a.inicio, departedAt: a.fim }
        : undefined,
    });
  }

  return out.sort((x, y) => x.dia.localeCompare(y.dia) || x.de.localeCompare(y.de));
}

function diaDe(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
