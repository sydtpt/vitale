/**
 * **O que torna velho tudo que a Retrospectiva deriva** — a regra, fora do React
 * (Story 2.4a).
 *
 * Três telas derivam da mesma memória: o resumo da edição (`useEntradaDaEdicao`),
 * a grade da capa (`useGradeDaCapa`) e, amanhã, a parede (2.4b). Cada uma delas
 * memoiza a sua conta, e cada uma precisava listar **à mão** o que a invalida —
 * com `react-hooks/exhaustive-deps` desligado, porque a lista não é derivável do
 * corpo do `useMemo` (ele chama uma função da store, que lê o estado por fora).
 *
 * O modo de falha é o pior que existe: **tirar um item da lista congela a conta
 * sem nada reclamar**. `tsc` verde, suíte verde, e a grade da capa mostrando o mês
 * como ele era quando a tela montou. Foi assim que a lista virou regra: aqui ela é
 * uma função pura, com teste, e quem memoiza depende de **um** número.
 *
 * ## Por que identidade, e não contagem
 *
 * `_all.length` não serve como selo. Renomear uma atividade, escondê-la ou ligar
 * uma bicicleta troca a lista inteira por outra **do mesmo tamanho** — e esconder
 * é exatamente o que muda a grade, porque o que o dono escondeu não marca dia. A
 * store do Zustand devolve a mesma referência enquanto nada muda, então comparar
 * referências é a medida exata do que ela promete.
 */
import type { Activity, DadosDaRetro } from '@vitale/shared';

/** Uma leitura da memória de que a Retrospectiva deriva. */
export interface MemoriaDaRetro {
  /** A janela já carregou alguma vez. */
  readonly loaded: boolean;
  /** Há uma busca em voo — o que muda quando ela termina. */
  readonly loading: boolean;
  /** O `since` da janela carregada. Uma janela mais larga muda o que se pode cortar. */
  readonly loadedSince: string | null;
  /** Os nove resultados crus, como a store os guarda. */
  readonly dados: DadosDaRetro;
  /** O acervo de atividades, como a store dele o guarda — a lista inteira, com as ocultas. */
  readonly atividades: readonly Activity[];
}

/**
 * Duas leituras descrevem a **mesma** memória? — e portanto tudo que se derivou
 * dela continua valendo.
 *
 * Referência nos dois campos de dado, valor nos três de estado. Nenhum campo é
 * opcional de propósito: acrescentar um à interface quebra o `tsc` de quem monta a
 * leitura, que é justamente o aviso que a lista de dependências não dava.
 */
export function mesmaMemoria(a: MemoriaDaRetro, b: MemoriaDaRetro): boolean {
  return a.loaded === b.loaded
    && a.loading === b.loading
    && a.loadedSince === b.loadedSince
    && a.dados === b.dados
    && a.atividades === b.atividades;
}
