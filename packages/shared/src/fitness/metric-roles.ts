/**
 * Métrica de atividade → papel cromático.
 *
 * ## A regra: a cor codifica o que **varia**
 *
 * No detalhe de *uma* atividade a atividade é constante e as métricas é que
 * variam — então a cor pertence à métrica. Era o contrário até aqui: as cinco
 * estatísticas do topo compartilhavam a cor do tipo, que já estava dita pelo
 * título e pelo ícone do herói. Cinco ícones, cinco significados, uma cor só.
 *
 * O avesso continua valendo e não conflita: onde o gráfico mostra **vários
 * tipos numa métrica** — a pilha da semana, os cards por tipo — a métrica é
 * constante e a cor segue a entidade, como `chart/palettes.ts` sempre disse.
 *
 * ## Por que estes cinco papéis
 *
 * O orçamento é de onze. A rampa de zonas de FC, que aparece na mesma rolagem
 * logo abaixo destes gráficos, já gasta cinco — `blue` (recuperação), `green`
 * (leve), `yellow`, `orange` (limiar) e `deep` (máximo) — para desenhar
 * **intensidade**. Reaproveitar qualquer um deles aqui criaria uma rima falsa:
 * elevação em vermelho diria "esforço máximo" sobre o que é terreno, e
 * velocidade em azul diria "devagar" enquanto sobe. Os cinco abaixo são
 * exatamente os que a rampa não toca; sobra `rose` para a próxima métrica.
 *
 * Medido nas 60 combinações (5 métricas × 6 paletas × 2 esquemas): todas passam
 * o piso gráfico de 3,0 — ver `theme.test.ts`.
 */
import type { RoleKey } from '../theme/derive';

export const METRIC_ROLE = {
  /** O tempo é o eixo das outras quatro; o neutro aqui é escolha, não ausência. */
  movimento: 'ink',
  /** A chama — o único apelo semântico forte da lista. */
  kcal: 'red',
  /** Frio e livre: separa das outras quatro sem disputar com a rampa. */
  distancia: 'purple',
  /** Veloz sem ser o azul que, ali embaixo, significa recuperação. */
  velocidade: 'teal',
  /** Convenção cartográfica: mapa hipsométrico sobe do verde ao marrom. */
  elevacao: 'brown',
} as const satisfies Record<string, RoleKey>;

export type MetricKey = keyof typeof METRIC_ROLE;

export const METRIC_KEYS = Object.keys(METRIC_ROLE) as MetricKey[];
