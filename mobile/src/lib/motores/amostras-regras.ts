/**
 * As duas regras puras da amostra da bancada — separadas de `amostras.ts` para
 * poderem ser **testadas**.
 *
 * O `amostras.ts` alcança as stores, o `services/route-name` e, por tabela, o
 * cliente do supabase: importá-lo num teste de unidade morre em `supabaseUrl is
 * required` antes da primeira asserção. Estas duas decisões não precisam de nada
 * disso — uma é aritmética de calendário, a outra é a mesma leitura que o
 * descritor faz — e as duas erraram em 22/09 **sem levantar exceção**: a bancada
 * mostrou `mudo` em todos os motores, que é o pior sintoma possível, porque
 * parece defeito do modelo.
 */
import { leituraDoNome, type FatosDoNome } from '@vitale/shared';

/**
 * O deslocamento da semana que a Retrospectiva mede: **a anterior**.
 *
 * A convenção é do `period/bounds.ts` — 0 é o período corrente, −1 o anterior,
 * +1 o seguinte. Com `+1` a bancada pedia a semana que vem, que nunca está
 * fechada; e `descritorDaRetrospectiva.montarPedido` devolve nulo para período
 * aberto, porque um jornal não escreve a edição de uma semana que não acabou.
 */
export const OFFSET_DA_SEMANA_FECHADA = -1;

/**
 * Esta rota pode ser medida?
 *
 * O descritor recusa montar pedido para rota **degenerada** — sem cidade, curta
 * demais, ou uma cidade só com menos de 8 km —, e recusar é certo: uma rota de
 * 0 km não custa um token. O que não pode é a amostra oferecê-la assim mesmo,
 * porque aí o dono toca Medir e recebe linhas mudas sem explicação nenhuma.
 *
 * A pergunta é pura e de graça, então se faz antes.
 */
export function rotaMedivel(f: FatosDoNome): boolean {
  return leituraDoNome(f).forma !== 'degenerada';
}
