/**
 * O que a tela diz sobre **quem escreveu** — e, quando o escolhido não escreveu,
 * **por quê**, em palavras.
 *
 * As duas decisões do dono (artifact "O botão Ler", 12/09) que este arquivo
 * executa:
 *
 *  3. A autoria é uma linha discreta sob a frase, **com o tempo**:
 *     `escrito pela nuvem · 17 s`.
 *  5. Quando o escolhido não escreve, o motivo é **sempre visível**, em palavras,
 *     na assinatura.
 *
 * Por que em palavras e não em classe: `indisponivel` não quer dizer nada para
 * quem está lendo a Saúde do sono às sete da manhã. "A nuvem não atendeu" quer.
 * E por que sempre visível: sem isso, o template e a nuvem produzem telas
 * idênticas, e o dono não tem como saber que a chamada que ele pediu não saiu —
 * o recuo silencioso viraria o comportamento normal sem nunca ser notado.
 *
 * **Tudo aqui é puro.** Nenhuma leitura de relógio, de tema ou de armazenamento:
 * o estado entra, o texto sai. É o que deixa as sete classes serem cobertas por
 * teste sem nenhum motor.
 */
import { SEM_MODELO, type Causa, type MotorId, type Tentativa } from '@vitale/shared';
import { nomeDoMotor } from './motores/catalogo';

/* ── o estado da vaga ────────────────────────────────────────────────────── */

/**
 * As quatro fases da leitura, e o que cada uma põe na tela.
 *
 * `piso` carrega `frase` **ou** `ausencia`, como o `Piso` do núcleo: a Saúde
 * sempre tem frase, mas um recurso pode ter ausência com motivo, e a tela não
 * pode inventar texto para ela.
 */
export type EstadoDaLeitura =
  /** Nada foi pedido. A vaga mostra o convite, e o ícone está aceso. */
  | { readonly fase: 'repouso' }
  /**
   * Uma chamada está em curso. `motor` chega um instante depois do toque — a
   * preferência é lida do armazenamento —, e até lá a frase é sem sujeito.
   */
  | { readonly fase: 'escrevendo'; readonly motor?: MotorId }
  /** Um motor escreveu, e a conferência aprovou. */
  | {
      readonly fase: 'lida';
      readonly frase: string;
      readonly motor: MotorId;
      /** Do pedido à resposta, somando a trilha. */
      readonly ms: number;
      /** O hash do pedido, do anel. Só a tela de desenvolvimento o usa. */
      readonly hash?: string;
    }
  /** Ninguém escreveu: é o piso do recurso, com a causa. */
  | {
      readonly fase: 'piso';
      readonly frase?: string;
      readonly ausencia?: string;
      readonly causa: Causa;
      /** Quem era o escolhido — é dele que o motivo fala. */
      readonly motor: MotorId;
      readonly ms: number;
      readonly hash?: string;
    };

export const REPOUSO: EstadoDaLeitura = { fase: 'repouso' };

/**
 * O texto da vaga vazia. Aponta para o ícone, porque a decisão 7 do dono tirou a
 * palavra do cabeçalho: sem este texto, um ícone sozinho no canto não diz o que
 * faz. Some quando a frase nasce.
 */
export const CONVITE = 'Toque no ícone acima para ler esta janela em uma frase.';

/**
 * O que a vaga mostra quando um **defeito** impediu a leitura.
 *
 * Em palavras, e fixa: o que estava aqui antes era a mensagem da exceção, e a vaga
 * a desenhava — um "Cannot read property 'x' of undefined" sob a manchete, na tela
 * do dono. O limite da story é que o piso diga o motivo em palavras; o texto cru é
 * diagnóstico e fica no anel.
 */
export const AUSENCIA_POR_DEFEITO = 'Não foi possível escrever esta leitura.';

/** O que a vaga diz enquanto as notas da janela ainda não chegaram do banco. */
export const NOTAS_A_CAMINHO = 'As notas desta janela ainda estão chegando.';

/* ── as contrações ───────────────────────────────────────────────────────── */

/** "a nuvem" → "pela nuvem"; "o template" → "pelo template". */
function por(nome: string): string {
  if (nome.startsWith('a ')) return `pela ${nome.slice(2)}`;
  if (nome.startsWith('o ')) return `pelo ${nome.slice(2)}`;
  return `por ${nome}`;
}

/** "a nuvem" → "da nuvem"; "o template" → "do template". */
function de(nome: string): string {
  if (nome.startsWith('a ')) return `da ${nome.slice(2)}`;
  if (nome.startsWith('o ')) return `do ${nome.slice(2)}`;
  return `de ${nome}`;
}

/* ── o tempo ─────────────────────────────────────────────────────────────── */

/**
 * Quanto a leitura levou, em palavras.
 *
 * Abaixo de um segundo é **instantâneo**, não "0 s": o piso por escolha não
 * chamou ninguém, e "0 s" leria como uma chamada que voltou vazia. Acima, o
 * segundo inteiro — a espera medida é de 13,6 s na mediana e 25,8 s no pior caso,
 * e décimo de segundo nessa escala é ruído com aparência de precisão.
 *
 * É também o que prova que houve chamada **nova**: a decisão 7 do dono tirou o
 * "Reler" do cabeçalho, então quem diz que o botão foi apertado outra vez é a
 * assinatura trocando o tempo.
 *
 * Sem `formatarNumero`: ele mora em `ia/prompt`, que é **peça** do núcleo de IA —
 * importá-lo aqui subiria a catraca da guarda (7) por um separador de milhar que
 * nenhum tempo de chamada alcança. O teto é o `PRAZO_MS` de `motores/index.ts`, de
 * 60 s — um prazo que existe em código, não uma suposição sobre a rede.
 */
export function tempoDaLeitura(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) return 'instantâneo';
  return `${Math.round(ms / 1000)} s`;
}

/* ── o motivo ────────────────────────────────────────────────────────────── */

/**
 * Por que o escolhido não escreveu, em palavras — ou `null` quando não há o que
 * explicar.
 *
 * O `switch` é **exaustivo sobre `Causa`**, que é o superconjunto das sete
 * classes de falha com as quatro causas que o orquestrador acrescenta
 * (`reprovada`, `defeito`, `mudo`, `preferencia`). Exaustivo e sem `default`: uma
 * classe nova no núcleo para de compilar aqui, em vez de virar piso sem motivo na
 * tela — que é exatamente a falha que a decisão 5 do dono existe para impedir.
 *
 * `preferencia` devolve `null` porque nada falhou: o escolhido **era** o template,
 * e a assinatura dele é "escrito sem modelo · instantâneo". Um motivo ali
 * inventaria um problema que não houve.
 */
export function motivoDaFalha(causa: Causa, motor: MotorId): string | null {
  const nome = nomeDoMotor(motor);
  switch (causa) {
    case 'indisponivel':
      return `${nome} não atendeu`;
    case 'capacidade':
      return `${nome} não aceitou este pedido`;
    case 'janela':
      return `o pedido não cabe na janela ${de(nome)}`;
    case 'guarda':
      return `a proteção ${de(nome)} bloqueou o pedido`;
    case 'recusa-do-modelo':
      return `${nome} recusou`;
    case 'saida-invalida':
      return `${nome} respondeu o que não se lê`;
    case 'transitoria':
      return `${nome} falhou por agora`;
    case 'reprovada':
      return `${nome} escreveu fora das regras`;
    case 'defeito':
      return `houve um defeito ao chamar ${nome}`;
    case 'mudo':
      return 'não há o que um modelo acrescente aqui';
    case 'preferencia':
      return null;
  }
}

/**
 * Quem era o motor de que o piso fala: o último da trilha que não é o template.
 *
 * A trilha vazia (piso por preferência, ou pedido mudo) cai em `escolhido` — e
 * `motivoDaFalha` sabe que aí não há o que explicar. Mora aqui, e não num dos
 * dois hospedeiros que o usam (a leitura da Saúde e a impressão da revista),
 * porque é leitura da trilha, pura, e os dois têm de concordar.
 */
export function quemNaoEscreveu(trilha: readonly Tentativa[], escolhido: MotorId): MotorId {
  for (let i = trilha.length - 1; i >= 0; i -= 1) {
    if (trilha[i].motor !== SEM_MODELO) return trilha[i].motor;
  }
  return escolhido;
}

/* ── a assinatura ────────────────────────────────────────────────────────── */

/**
 * Quem escreveu, por quê, e em quanto tempo — ou `null` em repouso (a vaga não tem
 * assinatura, tem convite).
 *
 * **O tempo aparece em toda leitura que aconteceu**, inclusive no piso por falha.
 * Ele é o que prova que houve chamada nova: a decisão 7 do dono tirou o "Reler" do
 * cabeçalho, e sem o tempo duas tentativas seguidas produziriam texto idêntico —
 * justamente no caso em que ele mais vai tentar de novo. O texto que a matriz cita
 * ("a nuvem recusou · escrito sem modelo") é preservado **à letra** como começo da
 * assinatura; o tempo é o terceiro segmento, no mesmo formato das outras duas
 * linhas da matriz.
 *
 * **"escrito sem modelo" só aparece quando alguém escreveu algo.** O piso pode ser
 * ausência com motivo — sem frase nenhuma —, e aí afirmar que o template escreveu é
 * falso. Nesse ramo a assinatura diz o motivo e o tempo, e nada mais.
 */
export function textoDaAssinatura(estado: EstadoDaLeitura): string | null {
  switch (estado.fase) {
    case 'repouso':
      return null;
    case 'escrevendo':
      // Sem o motor ainda: a preferência está sendo lida, e "está escrevendo…" é
      // verdade sem dizer quem. Com ele, a decisão 4 do dono pede o nome.
      return estado.motor === undefined
        ? 'está escrevendo…'
        : `${nomeDoMotor(estado.motor)} está escrevendo…`;
    case 'lida':
      return `escrito ${por(nomeDoMotor(estado.motor))} · ${tempoDaLeitura(estado.ms)}`;
    case 'piso': {
      const motivo = motivoDaFalha(estado.causa, estado.motor);
      const tempo = tempoDaLeitura(estado.ms);
      const houveTexto = estado.frase !== undefined;
      // Piso por escolha: nada falhou, e o tempo prova que nenhuma chamada saiu.
      if (motivo === null) {
        return houveTexto
          ? `escrito sem modelo · ${tempo}`
          : `sem texto para esta janela · ${tempo}`;
      }
      // Piso por falha: o motivo vem primeiro, porque é a informação nova.
      return houveTexto ? `${motivo} · escrito sem modelo · ${tempo}` : `${motivo} · ${tempo}`;
    }
  }
}

/** A frase que a vaga mostra, ou `null` — ausência com motivo também é piso válido. */
export function fraseDoEstado(estado: EstadoDaLeitura): string | null {
  if (estado.fase === 'lida') return estado.frase;
  if (estado.fase === 'piso') return estado.frase ?? null;
  return null;
}
