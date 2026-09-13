/**
 * A leitura da Saúde do sono na tela: a máquina de quatro estados, e o hook.
 *
 * ## Por que existe uma máquina, e não um `useState` na tela
 *
 * A parte que erra fácil não é desenhar — é **o que fazer com a resposta que
 * chega depois**. A espera medida é de 13,6 s na mediana e 25,8 s no pior caso
 * (12/09), e nesse tempo o dono troca a janela. A frase que volta foi escrita
 * para a janela anterior: `montarFrase` já interpolou `{janela}` e `{quando}` com
 * as datas *daquela* janela, então mostrá-la sob a janela nova não é "um pouco
 * velha" — é uma frase que afirma datas erradas. Ela tem de ser **descartada**, e
 * a vaga volta ao repouso.
 *
 * A máquina guarda a janela do pedido em curso e compara na volta; a tela só
 * desenha estado.
 *
 * ## A janela é a identidade do pedido, e não dá para ser o hash
 *
 * A spec fala em comparar `hashDoPedido`. O app **não pode** calculá-lo: o hash
 * sai de `montarPedido`, que é do descritor, e chamá-lo daqui é a segunda
 * sequência que a AD-2 proíbe — a barreira que esta story acrescenta ao
 * `architecture.test.ts` é exatamente essa. O que o app tem é a **pré-imagem**: a
 * janela. Mesma janela, mesma entrada, mesmo pedido, mesmo hash.
 *
 * A diferença aparece num caso só: duas janelas diferentes *no mesmo caso* têm o
 * mesmo hash (é de propósito — "semanas no mesmo caso têm o mesmo pedido"), e
 * comparar por hash as trataria como intercambiáveis. Não são: a frase montada
 * carrega as datas da janela em que foi montada. Comparar por janela descarta uma
 * resposta que o hash aprovaria — e faz bem, porque essa resposta mostraria as
 * datas da janela de onde veio. O toque é barato de repetir; uma data errada na
 * manchete, não.
 *
 * O hash do pedido continua a aparecer: ele vem **do anel**, que o orquestrador
 * alimenta, e segue até a tela de desenvolvimento.
 *
 * ## O que a máquina não faz
 *
 * Não lê ao abrir a tela (só por toque), não grava nada em lugar nenhum
 * (`grava: false` no descritor), não monta pedido, não interpreta, não confere e
 * não escreve frase — tudo isso é do descritor, pelo `ler`. E não mostra barra de
 * progresso: o orquestrador não sabe quanto falta.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  SEM_MODELO,
  descritorDaSaudeDoSono,
  ler as lerRecurso,
  resolverCadeia,
  type Descritor,
  type EntradaDaSaude,
  type EventoDoAnel,
  type Leitura,
  type Motor,
  type MotorId,
  type Tentativa,
} from '@vitale/shared';
import { AUSENCIA_POR_DEFEITO, REPOUSO, type EstadoDaLeitura } from './assinatura';
import { anel } from './motores/anel';
import { idsConhecidos } from './motores/catalogo';
import { motorPara } from './motores';
import { lerPreferencia } from './motores/preferencia';

/* ── a identidade da janela ──────────────────────────────────────────────── */

/**
 * A entrada lida, como chave — a pré-imagem do pedido e da frase.
 *
 * Duas partes, e as duas são necessárias:
 *
 *  - **a janela** (`range`, o dia local, as bordas apuradas). Troca de passo dá
 *    outra chave, e é o que o descarte usa.
 *  - **a contagem** (o ponto e o fato de cada dimensão, e se ela pontuou). O caso
 *    que o pedido descreve sai do `score`, e os fatos que `montarFrase` interpola
 *    também — então uma contagem diferente é outro pedido e outra frase, na mesma
 *    janela. Isso acontece de verdade: a tela carrega as notas de 90 dias e depois
 *    estende a janela para `12m`, e a percepção muda **depois** de a frase já estar
 *    na tela. Sem a contagem na chave, a manchete ficaria dizendo um caso que as
 *    cinco linhas abaixo dela já não mostram.
 *
 * Os fatos entram formatados, como o `SleepScore` os traz: é o que a frase recebe.
 */
export function chaveDaJanela(e: EntradaDaSaude): string {
  const contagem = e.score.dimensions.map((d) => `${d.key}=${d.points ?? '-'}/${d.fact}`).join(';');
  const cobertura = e.score.coverage === null ? '-' : `${e.score.coverage.nights}/${e.score.coverage.expected}`;
  return [e.range, e.hoje, e.janela.since ?? '', e.janela.until ?? '', e.score.scored ? 's' : 'n', cobertura, contagem].join('|');
}

/* ── as dependências ─────────────────────────────────────────────────────── */

export interface DepsDoLeitor {
  readonly motorPara: (id: MotorId) => Motor | undefined;
  readonly registrar: (evento: EventoDoAnel) => void;
  readonly agora: () => Date;
  /** A escolha do dono para este recurso, ou `null`. Nunca lança. */
  readonly lerPreferencia: () => Promise<MotorId | null>;
  /** Os ids que o hospedeiro conhece — disponíveis ou não. */
  readonly catalogo: readonly string[];
  /**
   * O recurso lido. O app não passa nada: é sempre a Saúde do sono.
   *
   * Existe para que o ramo do **pedido nulo** tenha teste. O descritor da Saúde
   * nunca devolve `null` em `montarPedido` — "todo caso gera pedido" é invariante
   * dele, cobrada no núcleo —, então esse ramo é inalcançável com o recurso real.
   * Um ramo sem teste é um ramo que ninguém sabe se funciona, e este decide se a
   * vaga volta ao convite ou mostra uma frase que não foi pedida a modelo nenhum.
   *
   * O tipo não abre a porta para qualquer recurso: só um cujos fatos sejam uma
   * `EntradaDaSaude`.
   */
  readonly descritor?: Descritor<EntradaDaSaude, string>;
}

export interface Leitor {
  /** O estado **desta** janela. Outra janela vê repouso — é o descarte. */
  readonly estadoDe: (chave: string) => EstadoDaLeitura;
  readonly assinar: (ouvinte: () => void) => () => void;
  /** A janela corrente mudou: o que chegar para a antiga é descartado. */
  readonly janela: (chave: string) => void;
  /** O toque. Um segundo toque durante a espera **se junta** ao primeiro. */
  readonly ler: (entrada: EntradaDaSaude) => Promise<void>;
}

/** A soma do tempo da trilha. Sem `pedidoCurto` no descritor, é sempre uma tentativa. */
function msDa(trilha: readonly Tentativa[]): number {
  return trilha.reduce((s, t) => s + t.ms, 0);
}

/**
 * Quem era o motor de que o piso fala: o último da trilha que não é o template.
 *
 * A trilha vazia (piso por preferência) cai no escolhido, que nesse caso é o
 * próprio `sem-modelo` — e `motivoDaFalha` sabe que aí não há o que explicar.
 */
function quemNaoEscreveu(trilha: readonly Tentativa[], escolhido: MotorId): MotorId {
  for (let i = trilha.length - 1; i >= 0; i -= 1) {
    if (trilha[i].motor !== SEM_MODELO) return trilha[i].motor;
  }
  return escolhido;
}

/* ── a máquina ───────────────────────────────────────────────────────────── */

export function criarLeitor(deps: DepsDoLeitor): Leitor {
  const descritor = deps.descritor ?? descritorDaSaudeDoSono;
  let chaveCorrente = '';
  /** O estado, e a janela a que ele pertence. */
  let atual: { readonly chave: string; readonly estado: EstadoDaLeitura } = { chave: '', estado: REPOUSO };
  /** A leitura em voo, **com a janela dela** — é a chave que decide quem se junta. */
  let emCurso: { readonly chave: string; readonly promessa: Promise<void> } | null = null;
  const ouvintes = new Set<() => void>();

  const publicar = (chave: string, estado: EstadoDaLeitura): void => {
    atual = { chave, estado };
    // Cópia: um ouvinte que se desinscreve durante a notificação não pode mexer
    // no conjunto que está sendo percorrido.
    for (const o of [...ouvintes]) o();
  };

  async function executar(entrada: EntradaDaSaude, chave: string): Promise<void> {
    // O sujeito da frase ainda não se sabe — a preferência mora no
    // armazenamento. A vaga já entra em espera: é o toque do dono.
    publicar(chave, { fase: 'escrevendo' });

    const preferencia = await deps.lerPreferencia();
    const cadeia = resolverCadeia(descritor, preferencia, deps.catalogo);
    // Quem o dono escolheu (ou o padrão do recurso). `sem-modelo` quando a cadeia
    // só tem o piso — e aí a assinatura diz "escrito sem modelo", sem motivo.
    const escolhido: MotorId = cadeia.find((id) => id !== SEM_MODELO) ?? SEM_MODELO;
    if (chave === chaveCorrente) publicar(chave, { fase: 'escrevendo', motor: escolhido });

    // O hash sai do anel: é o orquestrador que monta o pedido, e é ele que o
    // carimba no evento. O app não o calcula (ver o cabeçalho).
    let hash: string | undefined;
    const registrar = (evento: EventoDoAnel): void => {
      hash = evento.hash ?? hash;
      deps.registrar(evento);
    };

    let leitura: Leitura<string>;
    try {
      leitura = await lerRecurso(descritor, entrada, {
        modo: 'produto',
        cadeia,
        motorPara: deps.motorPara,
        registrar,
        agora: deps.agora,
      });
    } catch {
      // O orquestrador só rejeita quando uma função **pura** do descritor lança —
      // isto é bug do núcleo, não falha de motor. A tela não pode ficar pendurada
      // em "escrevendo" por causa dele: vira piso com causa `defeito`, que a
      // assinatura diz em palavras.
      //
      // A mensagem da exceção **não entra aqui**. Ela ia para `ausencia`, e a vaga
      // a desenhava: um "Cannot read property 'x' of undefined" sob a manchete, na
      // tela do dono. O limite da story é que o piso diga o motivo *em palavras*; o
      // texto cru é diagnóstico, e o anel já o recebeu com a pilha (o orquestrador
      // registra antes de relançar).
      if (chave === chaveCorrente) {
        publicar(chave, {
          fase: 'piso',
          ausencia: AUSENCIA_POR_DEFEITO,
          causa: 'defeito',
          motor: escolhido,
          ms: 0,
          ...(hash !== undefined ? { hash } : {}),
        });
      }
      return;
    }

    // A janela mudou durante a espera: a resposta é descartada em silêncio, e a
    // vaga da janela antiga volta ao repouso (a da nova já estava).
    if (chave !== chaveCorrente) {
      publicar(chave, REPOUSO);
      return;
    }

    const ms = msDa(leitura.trilha);
    if (leitura.origem === 'motor') {
      publicar(chave, {
        fase: 'lida',
        frase: leitura.frase,
        motor: leitura.motor,
        ms,
        ...(hash !== undefined ? { hash } : {}),
      });
      return;
    }

    // `mudo` quer dizer que não há o que um modelo acrescente: nenhuma chamada
    // saiu e não há nada novo para mostrar, então a vaga volta ao convite em vez
    // de repetir o que a tela já conta em cinco linhas.
    if (leitura.causa === 'mudo') {
      publicar(chave, REPOUSO);
      return;
    }

    publicar(chave, {
      fase: 'piso',
      ...('frase' in leitura ? { frase: leitura.frase } : { ausencia: leitura.ausencia }),
      causa: leitura.causa,
      motor: quemNaoEscreveu(leitura.trilha, escolhido),
      ms,
      ...(hash !== undefined ? { hash } : {}),
    });
  }

  return {
    estadoDe: (chave) => (atual.chave === chave ? atual.estado : REPOUSO),
    assinar: (ouvinte) => {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    janela: (chave) => {
      chaveCorrente = chave;
    },
    ler: (entrada) => {
      const chave = chaveDaJanela(entrada);
      // Junta-se **só ao toque da mesma janela** — é o "mesmo hash" que a matriz
      // licencia. Uma segunda chamada paga para a mesma frase não se justifica.
      //
      // Juntar qualquer chamada em curso, como estava, engolia o toque numa janela
      // nova: o dono trocava o período durante a espera, tocava o ícone (que está
      // aceso, porque a vaga da janela nova está em repouso) e nada acontecia — nem
      // chamada, nem esqueleto, nem assinatura, e nem retomada depois. A resposta
      // da janela velha continua sendo descartada pela regra da chave; quem paga a
      // ordem entre as duas chamadas é a fila do motor, não esta função.
      if (emCurso && emCurso.chave === chave) return emCurso.promessa;
      chaveCorrente = chave;
      const promessa = executar(entrada, chave).finally(() => {
        // Só limpa se ainda for esta a leitura em voo: com duas sobrepostas, a que
        // termina primeiro não pode apagar o registro da outra.
        if (emCurso?.promessa === promessa) emCurso = null;
      });
      emCurso = { chave, promessa };
      return promessa;
    },
  };
}

/* ── o hook ──────────────────────────────────────────────────────────────── */

/** As dependências do app: o motor de nuvem, o anel em memória e o relógio real. */
function depsDoApp(): DepsDoLeitor {
  return {
    motorPara,
    registrar: anel.registrar,
    agora: () => new Date(),
    lerPreferencia: () => lerPreferencia(descritorDaSaudeDoSono.recurso),
    catalogo: idsConhecidos,
  };
}

export interface LeituraDaSaude {
  readonly estado: EstadoDaLeitura;
  /** O toque do cabeçalho. Não faz nada sem entrada. */
  readonly ler: () => void;
  readonly escrevendo: boolean;
}

/**
 * A leitura desta janela — efêmera, e só por toque.
 *
 * O estado é lido pela **chave da janela corrente**, e não pelo último estado
 * publicado: é o que faz a troca de janela limpar a vaga no mesmo render, sem
 * esperar um efeito. O `janela()` do efeito é a outra metade — ele diz à máquina
 * o que descartar quando a resposta voltar.
 */
export function useLeituraDaSaude(entrada: EntradaDaSaude | null): LeituraDaSaude {
  const ref = useRef<Leitor | null>(null);
  if (ref.current === null) ref.current = criarLeitor(depsDoApp());
  const leitor = ref.current;

  const chave = entrada === null ? '' : chaveDaJanela(entrada);
  useEffect(() => {
    leitor.janela(chave);
  }, [leitor, chave]);

  const estado = useSyncExternalStore(
    leitor.assinar,
    useCallback(() => leitor.estadoDe(chave), [leitor, chave]),
  );

  const ler = useCallback(() => {
    if (entrada !== null) void leitor.ler(entrada);
  }, [leitor, entrada]);

  return { estado, ler, escrevendo: estado.fase === 'escrevendo' };
}
