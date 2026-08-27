import React from 'react';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { Bucket } from '../../lib/health-buckets';
import { colors } from '../../theme';

interface Props {
  buckets: Bucket[];
  width: number;
  height?: number;
  color: string;
  /**
   * Qual barra fica cheia; as outras ficam apagadas.
   *
   * `max` responde "qual foi a maior" e é o padrão histórico das telas de saúde.
   * `last` responde "e agora?", que é a pergunta de um painel de evolução — ali
   * a barra que interessa é a semana corrente, não o recorde.
   */
  emphasis?: 'max' | 'last';
  /** Linha pontilhada de referência (média da janela, meta…). */
  reference?: { value: number; label?: string };
}

const PAD_TOP = 18;
const PAD_BOTTOM = 18;

/** Gráfico de barras para métricas cumulativas (passos, kcal, sono…). */
export function BarChart({
  buckets,
  width,
  height = 180,
  color,
  emphasis = 'max',
  reference,
}: Props) {
  const n = buckets.length;
  if (n === 0 || width <= 0) return null;

  const innerH = height - PAD_TOP - PAD_BOTTOM;
  // A referência entra na escala: uma média acima de toda barra sairia da caixa.
  const maxV = Math.max(...buckets.map((b) => b.value), reference?.value ?? 0, 1);
  const slot = width / n;
  const barW = Math.max(2, Math.min(slot * 0.62, 22));

  // mostra rótulos do eixo X sem poluir (semana = todos; demais = espaçado)
  const labelStep = n <= 7 ? 1 : Math.ceil(n / 6);
  const maxIdx = buckets.reduce((mi, b, i) => (b.value > buckets[mi].value ? i : mi), 0);
  const onIdx = emphasis === 'last' ? n - 1 : maxIdx;
  const refY = reference && reference.value > 0
    ? PAD_TOP + innerH - (reference.value / maxV) * innerH
    : null;

  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={PAD_TOP + innerH} x2={width} y2={PAD_TOP + innerH} stroke={colors.line} strokeWidth={1} />
      {buckets.map((b, i) => {
        const h = b.value > 0 ? Math.max(2, (b.value / maxV) * innerH) : 0;
        const x = i * slot + (slot - barW) / 2;
        const y = PAD_TOP + innerH - h;
        const isMax = i === onIdx && b.value > 0;
        return (
          <React.Fragment key={b.date}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={Math.min(barW / 2, 5)}
              fill={isMax ? color : colors.lineDeep}
              opacity={isMax ? 1 : 0.55}
            />
            {i % labelStep === 0 && (
              <SvgText
                x={i * slot + slot / 2}
                y={height - 4}
                fontSize={9}
                fill={colors.ink3}
                textAnchor="middle"
              >
                {b.label}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
      {refY !== null && (
        <>
          {/* Pontilhada: no app a tracejada é a meta da OMS e a pontilhada é
              "você, na média". Trocar aqui confundiria as duas. */}
          <Line
            x1={0}
            y1={refY}
            x2={width}
            y2={refY}
            stroke={colors.ink3}
            strokeWidth={1}
            strokeDasharray="1 3"
          />
          {reference?.label && (
            <SvgText x={width} y={refY - 4} fontSize={9} fill={colors.ink3} textAnchor="end">
              {reference.label}
            </SvgText>
          )}
        </>
      )}
    </Svg>
  );
}
