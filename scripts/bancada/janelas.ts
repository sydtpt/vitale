/**
 * As janelas do acervo, e a amostra das colunas de modelo — **do núcleo**.
 *
 * Isto morava aqui até a story 5.13, quando o iPhone passou a medir o modelo dele com a
 * mesma amostra do Mac: a enumeração, a regra da amostra e o endereço do passo subiram
 * para `packages/shared/src/bancada/amostra.ts`, que é o dono agora. Duas cópias
 * divergiriam na primeira correção de uma delas, e o "mesmo número" dos dois hospedeiros
 * viraria coincidência.
 *
 * Este arquivo só dá à bancada os nomes pelos quais ela sempre leu a amostra. A regra, a
 * parada e o teto estão documentados lá.
 */
export {
  ALCANCES_MEDIDOS,
  LIMITE_DA_AMOSTRA,
  REGRA_DA_AMOSTRA,
  TETO_DE_PASSOS,
  amostraDaNuvem,
  chaveDoPasso,
  enumerarJanelas,
  passosPorAlcance,
  type Janela,
  type JanelaClassificada,
} from '@vitale/shared';
