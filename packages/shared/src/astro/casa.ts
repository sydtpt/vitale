/**
 * Onde a revista mede a luz do dia, e como ela a lê — AD-10 da espinha do épico.
 *
 * ## Por que a coordenada é constante, e não `deviceCoords()`
 *
 * `astro/timezone-coords.ts` já oferece `deviceCoords()`, e usá-lo aqui seria o
 * caminho natural e errado. A revista **congela**: uma edição fechada, reaberta
 * seis semanas depois, devolve o mesmo texto — e o script de backfill e o
 * iPhone, em hospedeiros e fusos diferentes, têm que produzir **a mesma edição**.
 * Luz que dependesse de quem apertou o botão faria o mesmo período ter dois
 * pacotes.
 *
 * Viagem não é modelada: um período passado fora do país recebe a luz de casa —
 * decisão declarada do dono (07/09/2026). Quem trouxer latitude por dia é o
 * épico 2, e só então isto muda.
 *
 * ## O que a constante precisa acertar é a LATITUDE
 *
 * A latitude decide **quanto** o dia dura; a longitude, sobretudo **quando** ele
 * acontece. Medido no 15 de agosto de 2026: levar a longitude até Nova York
 * muda a duração do dia em 45 s; subir a latitude três décimos de grau muda em
 * 1 min 40 s. O triângulo Bruxelas–Ittre–Leuven cabe nesses três décimos.
 *
 * ## O nome não é `CASA`, e é de propósito
 *
 * "Casa" já é módulo neste repositório (as tarefas da casa), e a Presença vai
 * precisar de uma coordenada de casa **de verdade**, por lugar cadastrado. Esta
 * aqui é outra coisa: um paralelo representativo para ler estação. Um `CASA`
 * exportado pelo barril compartilhado convidaria exatamente o uso errado.
 */
import type { Coords } from './sun';
import { meanDaylightHours } from './sun';

/**
 * O paralelo em que a revista lê a luz — ~50,8° N · 4,35° L, Bélgica.
 *
 * **Não troque isto por uma leitura de aparelho, de banco ou de ambiente.** É a
 * AD-10 inteira: dois hospedeiros, uma edição verificada.
 *
 * Congelada, e não só `const`: o barril compartilhado a exporta, e um objeto
 * mutável deixaria qualquer consumidor escrever `.lat = 44` e mudar a estação
 * de toda edição até o fim do processo — uma estação que passaria a depender de
 * algo além das datas. `sun.test.ts` cobra o valor literal e o congelamento.
 */
export const COORDENADA_DA_LUZ: Readonly<Coords> = Object.freeze({ lat: 50.8, lon: 4.35 });

/**
 * Os limiares das três estações de luz, em horas de luz por dia.
 *
 * ## A derivação, e não só o valor
 *
 * Medido com `daylightHours` sobre {@link COORDENADA_DA_LUZ} em 2025: o dia mais
 * curto tem **7,9454 h** (21/12) e o mais longo **16,5121 h** (21/06) — amplitude
 * de 8,5667 h. Os limiares são os **terços** dessa amplitude:
 *
 * - dias curtos abaixo de mínimo + terço = **10,80 h**
 * - dias longos acima de máximo − terço = **13,66 h**
 *
 * Terços porque é o que um leitor na Bélgica reconhece sem régua — o inverno
 * escuro, o verão claro, e as duas passagens —, e porque a divisão resultante é
 * **estável**: medido de 2023 a 2027, nenhum mês muda de estação de um ano para
 * o outro. Outubro a fevereiro são curtos, abril a agosto longos, março e
 * setembro de transição.
 *
 * Os valores estão fixos, e não recalculados no import, porque recalcular custa
 * 365 efemérides na abertura do app. `sun.test.ts` refaz a derivação e reprova
 * se a coordenada mudar sem que estes números mudem junto.
 */
export const LIMIAR_DIAS_CURTOS_H = 10.8;
export const LIMIAR_DIAS_LONGOS_H = 13.66;

export type EstacaoDaLuz = 'curtos' | 'transicao' | 'longos';

/**
 * A estação de luz de um intervalo, pela média das horas de luz por dia.
 *
 * `null` quando as datas não são datas — nunca uma estação chutada. Quem decide
 * que ano e histórico completo não têm estação é o pacote, não esta função:
 * aqui só se lê a média do que foi pedido.
 */
export function estacaoDaLuz(inicioISO: string, fimISO: string): EstacaoDaLuz | null {
  const h = meanDaylightHours(inicioISO, fimISO, COORDENADA_DA_LUZ);
  if (!Number.isFinite(h)) return null;
  if (h < LIMIAR_DIAS_CURTOS_H) return 'curtos';
  if (h > LIMIAR_DIAS_LONGOS_H) return 'longos';
  return 'transicao';
}
