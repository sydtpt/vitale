/**
 * As três regras que transformam visitas cruas em visitas que significam algo —
 * e os dois limiares que **não são o mesmo número**.
 *
 * ## Colagem (20 min) e saída (45 min) fazem coisas diferentes
 *
 * | | Valor | O que faz | De onde veio |
 * |---|---|---|---|
 * | **Colagem** | 20 min | a ausência **some**: duas estadias viram uma | medido na Fase 0 — 4 colagens em 23 dias |
 * | **Saída** | 45 min | a ausência **existe e conta em horas**, mas o dia segue "não saí" | escolhido pelo dono, conferido contra o log real |
 *
 * Disso decorre um fato que precisa estar escrito antes de alguém vê-lo na tela:
 * **um dia pode ter 40 minutos fora de casa e ainda contar como "não saí".**
 *
 * ## Por que 45 é seguro, e por que o botão existe mesmo assim
 *
 * Nas 24 diárias reais, as quatro menores ausências de casa são de **5, 5, 10 e 25
 * minutos** — e a seguinte é de **65**. Não existe nenhuma entre 26 e 64 minutos.
 * Qualquer limiar nessa faixa devolve **o mesmo resultado** (21 dias com saída, 4
 * sem, em 25). O botão só começa a mexer em alguma coisa acima de ~90 min.
 *
 * O limiar é **configurável e derivado na leitura — nunca gravado**. É o precedente
 * do `habits.unit_price`: mudar o número vale retroativo, sem backfill, porque o
 * banco guarda segundos e chegadas e o binário nasce na hora de ler. Gravar o
 * binário congelaria a resposta e obrigaria backfill a cada ajuste.
 */

import { duracaoMin, type Visita } from './eventos';

/** Vão abaixo do qual duas estadias no mesmo lugar são **a mesma**. Medido, não chutado. */
export const COLAGEM_MIN = 20;

/** Abaixo disto a estadia é passagem: nasce `provisional` e não entra em agregado. */
export const PASSAGEM_MIN = 8;

/** Padrão do limiar de saída. Configurável pelo dono — ver o cabeçalho. */
export const SAIDA_MIN_PADRAO = 45;

/**
 * Funde estadias consecutivas no mesmo lugar separadas por menos de {@link COLAGEM_MIN}.
 *
 * A causa real é descer para jogar o lixo. A filha não é destruída — ela é absorvida,
 * e o vão continua consultável por quem comparar o resultado com a entrada.
 *
 * Visita em curso (`departedAt` nulo) nunca é fundida para trás: não se conhece o fim
 * dela, e inventar um para poder colar seria fabricar permanência.
 */
export function colar(visitas: readonly Visita[], limiarMin = COLAGEM_MIN): Visita[] {
  const out: Visita[] = [];
  for (const v of visitas) {
    const anterior = out[out.length - 1];
    if (
      anterior &&
      anterior.placeId === v.placeId &&
      anterior.departedAt !== null &&
      (Date.parse(v.arrivedAt) - Date.parse(anterior.departedAt)) / 60_000 < limiarMin
    ) {
      anterior.departedAt = v.departedAt;
      anterior.departedSource = v.departedSource;
      continue;
    }
    out.push({ ...v });
  }
  return out;
}

/** Estadia curta demais para ser visita. Em curso **não** é passagem — ainda está acontecendo. */
export function ehPassagem(v: Visita, limiarMin = PASSAGEM_MIN): boolean {
  const d = duracaoMin(v);
  return d !== null && d < limiarMin;
}

/**
 * Tira as passagens da lista, que é o que "não entra em agregado nenhum" quer dizer
 * na prática.
 *
 * **Isto não é higiene opcional.** No log real, o escritório aparecia com **7 dias** —
 * e o sétimo era um domingo com **1 min 48 s**: ele passou a menos de 220 m da porta.
 * Sem este filtro, "dias de escritório" conta quem passa de carro, a taxa semanal sai
 * inflada, e a frase "seu escritório é terça e quinta" nasce falsa.
 *
 * A visita descartada não some do mundo: no aparelho ela nasce `provisional` e vai
 * para a caixa de entrada. Aqui ela só deixa de pesar no agregado — e o tempo dela
 * volta a contar como **fora de qualquer lugar conhecido**, que é onde ele estava:
 * passando.
 *
 * A ordem do pipeline importa e é esta: `parear` → `colar` → `descartarPassagens` →
 * `rollup`. Colar antes é obrigatório — duas passagens coladas podem formar uma
 * estadia de verdade, e descartá-las antes apagaria uma visita que existe.
 */
export function descartarPassagens(
  visitas: readonly Visita[],
  limiarMin = PASSAGEM_MIN,
): Visita[] {
  return visitas.filter((v) => !ehPassagem(v, limiarMin));
}

/** Uma ausência: o intervalo entre sair de um lugar e voltar a ele. */
export interface Ausencia {
  placeId: string;
  saiuEm: string;
  voltouEm: string;
  minutos: number;
}

/**
 * Os intervalos **fora** de um lugar, entre duas estadias conhecidas nele.
 *
 * Só conta ausência com as duas pontas conhecidas. O período depois da última
 * estadia não entra: ele pode ser uma ausência em curso ou uma chegada que o sensor
 * perdeu, e as duas coisas são indistinguíveis daqui — quem as distingue é a
 * anomalia que o pareamento já devolveu.
 */
export function ausencias(visitas: readonly Visita[], placeId: string): Ausencia[] {
  const doLugar = visitas.filter((v) => v.placeId === placeId);
  const out: Ausencia[] = [];
  for (let i = 0; i + 1 < doLugar.length; i += 1) {
    const saiu = doLugar[i]!.departedAt;
    const voltou = doLugar[i + 1]!.arrivedAt;
    if (!saiu) continue;
    out.push({
      placeId,
      saiuEm: saiu,
      voltouEm: voltou,
      minutos: (Date.parse(voltou) - Date.parse(saiu)) / 60_000,
    });
  }
  return out;
}

/** A ausência conta como ter saído de casa? É só isto que o limiar de saída decide. */
export function contaComoSaida(a: Ausencia, limiarMin = SAIDA_MIN_PADRAO): boolean {
  return a.minutos >= limiarMin;
}
