import React, { useMemo } from 'react';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { margemDoDesenho, projetarTracado, type ParDaRota } from '@vitale/shared';
import { roleColors, themedCacheKey, useTheme } from '../../theme';
import { MUDO, PAPEL_DA_CAPA } from './constantes-da-capa';

/**
 * A capa **com traçado** — a rota do próprio período, em SVG (Story 2.4a).
 *
 * Componente burro por contrato: ele **não escolhe a capa, não busca a rota e não
 * calcula geometria**. A projeção e a margem são do núcleo (`projetarTracado`,
 * `margemDoDesenho`), memoizadas aqui — a parede da 2.4b desenha ~40 destes numa
 * lista rolante, e geometria dentro do render rodaria a cada quadro de rolagem.
 * O que fica é a **espessura do traço**, que é estilo e não forma.
 *
 * SVG, e nunca `WorkoutMap`/WebView: um processo de conteúdo por capa é
 * exatamente o que a 1.13 tirou da árvore, e numa parede seriam quarenta.
 *
 * O tamanho vem por prop porque a mesma rota tem de sair com a mesma forma a 173
 * px e na capa inteira — é o critério de aceitação da parede, e quem o garante é a
 * projeção, que não depende da caixa.
 *
 * **`React.memo`, e por isso `useTheme()`.** O pai remede a capa a cada passo de
 * layout, e sem a memo cada passo remontaria a polilinha inteira. Com ela, o
 * componente deixa de re-renderizar por causa do pai — inclusive quando o que
 * mudou foi o **tema**, que não passa por props. Assinar o tema é o que devolve
 * essa dependência, e sem ela o traço congelaria na paleta em que nasceu.
 */
export interface CapaTracadoProps {
  /** O `route_overview` da rota carimbada, como `fetchRouteSurface` o devolve. */
  overview: readonly ParDaRota[];
  largura: number;
  altura: number;
}

/**
 * A espessura do traço na parede — o `stroke-width: 2.4` do mockup aprovado, no
 * tile de 173 px em que ele foi julgado.
 */
const ESPESSURA_NA_PAREDE = 2.4;
const LARGURA_DA_PAREDE = 173;

/**
 * A espessura cresce com a **raiz** da caixa, não com ela.
 *
 * Linear, a capa inteira (390 px) levaria um traço de 5,4 — a rota vira mancha e
 * as voltas fechadas se emendam. Pela raiz, a mesma capa sai com 3,6: mais
 * presente que na parede, ainda um traço. O piso de 1,2 é para o dia em que a
 * parede ficar menor do que é hoje.
 *
 * **Pendente do veredito em tela** — ver a entrada da 2.4a em `deferred-work.md`.
 */
function espessuraDoTraco(largura: number): number {
  return Math.max(1.2, ESPESSURA_NA_PAREDE * Math.sqrt(Math.max(1, largura) / LARGURA_DA_PAREDE));
}

export const CapaTracado = React.memo(function CapaTracado(
  { overview, largura, altura }: CapaTracadoProps,
) {
  // Assina o tema: é o que faz o `React.memo` acima continuar respondendo à troca
  // de paleta, de esquema e de tema. A chave é o que o `useMemo` da cor observa.
  useTheme();
  const chaveDoTema = themedCacheKey();

  const espessura = espessuraDoTraco(largura);
  const margem = margemDoDesenho(largura, altura, espessura);
  // A string do `points` sai do mesmo `useMemo` da projeção, e não do render: são
  // até 135 pares, e remontá-la a cada quadro de rolagem na parede seria o mesmo
  // desperdício que a projeção veio evitar. Duas casas bastam — a tela não desenha
  // milésimo de pixel, e a string encolhe à metade.
  const tracado = useMemo(() => {
    const t = projetarTracado(overview, { largura, altura, margem });
    if (!t) return null;
    const dois = (v: number): string => (Math.round(v * 100) / 100).toString();
    return {
      centro: t.pontos[0],
      degenerado: t.degenerado,
      points: t.pontos.map((p) => `${dois(p.x)},${dois(p.y)}`).join(' '),
    };
  }, [overview, largura, altura, margem]);

  // Cor no render, nunca na folha: `roleColors` lê os eixos ativos no momento da
  // chamada, e no escopo do módulo isso seria o import — o traço congelaria na
  // paleta clara. `chaveDoTema` é dependência de verdade e a regra não a enxerga,
  // justamente porque a leitura acontece fora do React.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cor = useMemo(() => roleColors(PAPEL_DA_CAPA).graphic, [chaveDoTema]);

  const l = Math.max(0, largura);
  const a = Math.max(0, altura);
  // Sem rota que sirva não há o que desenhar — e quem decide a queda para a grade
  // é a rota da edição, antes de montar este componente. O SVG vazio é o molde da
  // `Sparkline`: o quadro ocupa o mesmo lugar, e nada pisca.
  if (!tracado || l <= 0 || a <= 0) return <Svg width={l} height={a} {...MUDO} />;

  return (
    // O desenho é o fundo da capa, e fundo não fala: quem descreve o período é a
    // legenda carimbada, escrita por cima em texto de verdade. `accessible={false}`
    // sozinho **não esconde a subárvore** — só diz que este nó não é um elemento;
    // quem some com os filhos são as duas props por plataforma.
    <Svg width={l} height={a} {...MUDO}>
      {tracado.degenerado ? (
        <Circle cx={tracado.centro.x} cy={tracado.centro.y} r={espessura} fill={cor} />
      ) : (
        <Polyline
          points={tracado.points}
          fill="none"
          stroke={cor}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
});
