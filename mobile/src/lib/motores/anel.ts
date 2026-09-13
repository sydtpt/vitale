/**
 * O anel: o registro local de cada leitura de motor.
 *
 * **Memória, e só memória.** É o que o orquestrador recebe como `registrar`, e é
 * o único diagnóstico que existe quando uma leitura cai no piso em produção — a
 * trilha diz qual motor foi tentado, com que desfecho, em quanto tempo, e, nas
 * falhas permanentes, carrega o próprio pedido.
 *
 * E é exatamente por carregar o pedido que ele **nunca sai do aparelho**: o
 * pedido traz o caso da noite do dono. Nada aqui é persistido, enviado, gravado
 * em banco ou escrito em log que saia do telefone — `AsyncStorage` inclusive
 * ficou de fora, porque um diagnóstico que sobrevive ao app é um diagnóstico que
 * alguém acaba exportando junto com os dados.
 *
 * O teto é baixo de propósito: isto é diagnóstico, não histórico. A leitura é
 * sob toque, então o dono faz poucas por sessão — e as últimas são as que
 * explicam o que ele acabou de ver na tela.
 */
import type { EventoDoAnel } from '@vitale/shared';

/** Quantos eventos o anel guarda. */
export const TETO_DO_ANEL = 40;

export interface Anel {
  /** O que o orquestrador chama. Nunca lança: o anel não derruba uma leitura. */
  readonly registrar: (evento: EventoDoAnel) => void;
  /** Do mais recente para o mais antigo — a ordem em que se lê um log de falha. */
  readonly ler: () => readonly EventoDoAnel[];
  readonly limpar: () => void;
}

/** Um anel novo, com o seu próprio teto — é o que o teste usa. */
export function criarAnel(teto: number = TETO_DO_ANEL): Anel {
  let eventos: EventoDoAnel[] = [];
  return {
    registrar: (evento) => {
      eventos = [...eventos, evento].slice(-teto);
    },
    ler: () => [...eventos].reverse(),
    limpar: () => {
      eventos = [];
    },
  };
}

/**
 * O anel do app. Um só, porque a tela de desenvolvimento tem de ver o que a
 * `/sono/saude` produziu — dois anéis dariam dois diagnósticos parciais da mesma
 * sessão.
 */
export const anel: Anel = criarAnel();
