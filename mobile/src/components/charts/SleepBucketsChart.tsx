import React from 'react';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { SLEEP_AXIS_ORIGIN_H, type SleepBucket, type SleepColors, type SleepMarker } from '@vitale/shared';
import { colors } from '../../theme';

interface Props {
  buckets: SleepBucket[];
  markers?: readonly SleepMarker[];
  width: number;
  height?: number;
  palette: SleepColors;
}

const PAD_TOP = 8;
const PAD_BOTTOM = 18;
const PAD_LEFT = 30;
/** Altura máxima do traço amarelo de tempo acordado, no rodapé. */
const AWAKE_MAX_H = 10;

/**
 * Os períodos longos: uma coluna por semana, e a coluna é uma **noite típica** —
 * mediana de apagar e acordar como barra, o miolo p25–p75 como faixa em volta.
 * A dispersão vira largura da faixa: a regularidade continua sendo forma.
 *
 * A faixa é a lavagem do azul (existe sem destacar), a barra é o sono, e o traço
 * no rodapé é a vigília — amarelo, como em toda tela de sono. Onde o período
 * cruza a troca de relógio, a linha tracejada avisa que o amarelo à esquerda e à
 * direita não se compara — a contagem de despertares muda de instrumento.
 */
export function SleepBucketsChart({ buckets, markers = [], width, height = 232, palette }: Props) {
  if (buckets.length === 0 || width <= 0) return null;

  const from = Math.max(0, Math.min(...buckets.map((b) => b.onset.p25)) - 0.5);
  const to = Math.min(24, Math.max(...buckets.map((b) => b.wake.p75)) + 0.5);
  const span = Math.max(to - from, 1);
  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const slot = (width - PAD_LEFT) / buckets.length;
  const bw = Math.max(3, Math.min(slot * 0.7, 26));
  const y = (pos: number) => PAD_TOP + ((pos - from) / span) * innerH;
  const maxAwake = Math.max(1, ...buckets.map((b) => b.awakeMin ?? 0));
  const labelStep = buckets.length <= 14 ? 1 : Math.ceil(buckets.length / 6);

  const grid: number[] = [];
  for (let h = Math.ceil(from / 2) * 2; h <= to; h += 2) grid.push(h);

  return (
    <Svg width={width} height={height}>
      {grid.map((h) => (
        <React.Fragment key={h}>
          <Line x1={PAD_LEFT} y1={y(h)} x2={width} y2={y(h)} stroke={colors.line} strokeWidth={1} />
          <SvgText x={0} y={y(h) + 3} fontSize={9} fill={colors.ink4}>
            {`${String((SLEEP_AXIS_ORIGIN_H + h) % 24).padStart(2, '0')}h`}
          </SvgText>
        </React.Fragment>
      ))}
      {buckets.map((b, i) => {
        const x = PAD_LEFT + i * slot + (slot - bw) / 2;
        const marker = markers.find((m) => {
          const next = buckets[i + 1];
          return b.key <= m.day && (!next || next.key > m.day) && i < buckets.length - 1;
        });
        const awakeH = b.awakeMin == null ? 0 : Math.max(1.5, (b.awakeMin / maxAwake) * AWAKE_MAX_H);
        return (
          <React.Fragment key={b.key}>
            <Rect x={x} y={y(b.onset.p25)} width={bw} height={Math.max(2, y(b.wake.p75) - y(b.onset.p25))} rx={3} fill={palette.bed} />
            <Rect x={x + bw * 0.25} y={y(b.onset.median)} width={bw * 0.5} height={Math.max(2, y(b.wake.median) - y(b.onset.median))} rx={2} fill={palette.sleep} />
            {awakeH > 0 && (
              <Rect x={x} y={height - PAD_BOTTOM - awakeH} width={bw} height={awakeH} fill={palette.awake} />
            )}
            {i % labelStep === 0 && (
              <SvgText x={x + bw / 2} y={height - 4} fontSize={8.5} fill={colors.ink4} textAnchor="middle">
                {`${b.key.slice(8)}/${b.key.slice(5, 7)}`}
              </SvgText>
            )}
            {marker && (
              <>
                <Line x1={x + slot} y1={PAD_TOP} x2={x + slot} y2={height - PAD_BOTTOM} stroke={colors.ink3} strokeWidth={1} strokeDasharray="3 3" />
                <SvgText x={x + slot + 3} y={PAD_TOP + 9} fontSize={8.5} fill={colors.ink3}>
                  {marker.label}
                </SvgText>
              </>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
