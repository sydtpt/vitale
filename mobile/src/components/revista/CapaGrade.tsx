import React, { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { layoutDaGrade, posicaoNaGrade, type GradeDaCapa } from '@vitale/shared';
import { roleColors, themedCacheKey, useTheme } from '../../theme';
import { MUDO, PAPEL_DA_CAPA } from './constantes-da-capa';

/**
 * A capa **com grade** — um quadradinho por dia do período, marcado quando houve
 * atividade ou registro (Story 2.4a).
 *
 * É a terceira natureza da capa, e **não é sobra**: as fotos só existem a partir
 * de 2026 e as rotas nem todo mês tem, então sem ela 2023 não teria capa nenhuma.
 * O que ela mostra é a **textura** do período — 21 marcas em 30 dias e 1 marca em
 * 31 não se confundem de relance, e é essa diferença que distingue um mês do
 * vizinho na parede da 2.4b.
 *
 * Componente burro: a contagem **e a geometria** vêm prontas do núcleo
 * (`gradeDoPeriodo`, `layoutDaGrade`, `posicaoNaGrade`), que já decidiram quantas
 * células existem, quais estão marcadas — inclusive o período em curso, que para
 * em hoje —, em que eixo a semana deita e onde cada célula cai. Aqui sobra a cor e
 * o `<Rect>`.
 *
 * **`React.memo` + `<Rect>`s memoizados.** O pai remede a capa a cada passo de
 * layout, e um ano são 366 retângulos: sem as duas memos, cada medição remontaria
 * a grade inteira. A memo do componente, por sua vez, o desliga do re-render do
 * pai — inclusive na troca de **tema**, que não passa por props; daí o
 * `useTheme()`, que devolve essa dependência.
 */
export interface CapaGradeProps {
  grade: GradeDaCapa;
  largura: number;
  altura: number;
}

export const CapaGrade = React.memo(function CapaGrade(
  { grade, largura, altura }: CapaGradeProps,
) {
  useTheme();
  const chaveDoTema = themedCacheKey();

  const celulas = useMemo(() => {
    const layout = layoutDaGrade(grade, largura, altura);
    if (!layout) return null;
    // Cor no render, nunca na folha: `roleColors` lê os eixos ativos no momento da
    // chamada, e no escopo do módulo isso seria o import — a grade congelaria na
    // paleta clara.
    const papel = roleColors(PAPEL_DA_CAPA);
    const { lado, vao, esquerda, topo } = layout;
    // O canto mal arredondado é de propósito: quadrado puro lê como pixel de
    // tabela, e raio grande lê como bolinha de checklist. Um quinto do lado é o
    // degrau em que a célula continua sendo um dia.
    const raio = lado / 5;
    return grade.celulas.map((marcado, i) => {
      const { coluna, linha } = posicaoNaGrade(grade, i);
      return (
        <Rect
          key={i}
          x={esquerda + coluna * (lado + vao)}
          y={topo + linha * (lado + vao)}
          width={lado}
          height={lado}
          rx={raio}
          ry={raio}
          // Marcada é **dado** (`graphic`, o piso de 3,0 de objeto gráfico); vazia
          // é o fundo que existe sem destacar (`wash`, ≈1,6). O dia sem marca
          // continua desenhado: vazio é resposta, e sumir seria encurtar o mês.
          fill={marcado ? papel.graphic : papel.wash}
        />
      );
    });
    // `chaveDoTema` é dependência de verdade e a regra não a enxerga: `roleColors`
    // lê os eixos ativos por fora do React, então nada no corpo acima a delata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, largura, altura, chaveDoTema]);

  const l = Math.max(0, largura);
  const a = Math.max(0, altura);

  // Fundo da capa: a leitura em palavras é a legenda carimbada, por cima.
  return <Svg width={l} height={a} {...MUDO}>{celulas}</Svg>;
});
