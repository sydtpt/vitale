import React from 'react';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import {
  SLEEP_AXIS_ORIGIN_H,
  axisRange,
  toTimingBar,
  type SleepPeriod,
  type StageKey,
  type TimingBar,
} from '@vitale/shared';
import { colors } from '../../theme';

interface Props {
  /** Dias de acordar a desenhar, em ordem, incluindo os sem noite (viram vazio). */
  days: string[];
  /** Períodos disponíveis; são casados com `days` pelo `wakeDay`. */
  periods: SleepPeriod[];
  width: number;
  height?: number;
  /** Cor do módulo (o azul da água, por decisão — ADR 0031). */
  accent: string;
  /**
   * `sleep` (padrão, a visão geral): o sono é a barra e a vigília fura.
   * `awake` (a subview Tempos): a cama é o fundo sem destaque, o sono fica mais
   * leve e cada despertar vira um traço **em destaque** — é o que o usuário pediu
   * ver: quando e por quanto tempo acordou.
   */
  emphasis?: 'sleep' | 'awake' | 'stages';
  /** Cor do traço de despertar e do seu contorno (amarelo 1,7:1 no claro pede contorno). */
  awakeColor?: string;
  awakeOutline?: string;
  /** Fundo da janela na cama em `emphasis='awake'`. */
  tint?: string;
  /**
   * `emphasis='stages'`: cor por estágio. Os segmentos vêm do núcleo na POSIÇÃO
   * real (`stage_segments`); noite sem segmentos cai na barra simples.
   */
  stageColors?: Record<StageKey, string>;
}

const PAD_TOP = 8;
const PAD_BOTTOM = 18;
const PAD_LEFT = 30;

/**
 * O sleep timing chart: cada noite é uma barra vertical na HORA DO DIA — apagar em
 * cima, acordar embaixo —, os despertares são buracos na barra, e a janela na cama
 * é o contorno tracejado. Noite sem dado é uma célula vazia com contorno, não uma
 * barra de altura zero: ausência não é "dormiu nada".
 *
 * Não há número aqui, e é de propósito: a regularidade aparece porque barras
 * alinhadas parecem alinhadas (spec §2). A janela é fixa — a rolagem é a forma do
 * gráfico, não um seletor.
 *
 * Toda posição vem do núcleo (`toTimingBar`/`axisRange`, com o `tzOffset` de cada
 * período); aqui só se desenha.
 */
export function SleepTimingChart({
  days, periods, width, height = 220, accent, emphasis = 'sleep', awakeColor, awakeOutline, tint, stageColors,
}: Props) {
  if (days.length === 0 || width <= 0) return null;
  const awakeMode = emphasis === 'awake';
  const stagesMode = emphasis === 'stages' && !!stageColors;

  const byDay = new Map<string, TimingBar>();
  for (const p of periods) byDay.set(p.wakeDay, toTimingBar(p));
  const bars = [...byDay.values()];
  const range = axisRange(bars);
  const span = Math.max(range.to - range.from, 1);

  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const innerW = width - PAD_LEFT;
  const slot = innerW / days.length;
  const barW = Math.max(4, Math.min(slot * 0.58, 18));
  const y = (pos: number) => PAD_TOP + ((pos - range.from) / span) * innerH;

  // Linhas de hora a cada 2 h, rotuladas na hora local do eixo (origem 18h).
  const gridStart = Math.ceil(range.from / 2) * 2;
  const grid: number[] = [];
  for (let h = gridStart; h <= range.to; h += 2) grid.push(h);

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

      {days.map((day, i) => {
        const x = PAD_LEFT + i * slot + (slot - barW) / 2;
        const bar = byDay.get(day);
        const label = day.slice(8); // 'DD'

        if (!bar || !bar.fitsAxis) {
          return (
            <React.Fragment key={day}>
              <Rect
                x={x}
                y={y(range.from + span * 0.25)}
                width={barW}
                height={innerH * 0.5}
                rx={3}
                fill="none"
                stroke={colors.line}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <SvgText x={x + barW / 2} y={height - 4} fontSize={9} fill={colors.ink4} textAnchor="middle">
                {label}
              </SvgText>
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={day}>
            {bar.bed && (awakeMode ? (
              <Rect
                x={x}
                y={y(bar.bed.from)}
                width={barW}
                height={Math.max(2, y(bar.bed.to) - y(bar.bed.from))}
                rx={3}
                fill={tint ?? colors.line}
              />
            ) : (
              <Rect
                x={x - 2}
                y={y(bar.bed.from)}
                width={barW + 4}
                height={Math.max(1, y(bar.bed.to) - y(bar.bed.from))}
                rx={4}
                fill="none"
                stroke={accent}
                strokeWidth={1}
                strokeDasharray="3 2"
                opacity={0.55}
              />
            ))}
            {stagesMode && bar.segments && bar.segments.length > 0 ? (
              // Os estágios na posição em que ocorreram — não em proporção.
              bar.segments.map((s, k) => (
                <Rect
                  key={`s${k}`}
                  x={x}
                  y={y(s.from)}
                  width={barW}
                  height={Math.max(1.5, y(s.to) - y(s.from))}
                  fill={stageColors![s.stage]}
                />
              ))
            ) : (
              <Rect
                x={x}
                y={y(bar.onset)}
                width={barW}
                height={Math.max(2, y(bar.wake) - y(bar.onset))}
                rx={3}
                fill={accent}
                opacity={awakeMode ? 0.7 : 1}
              />
            )}
            {/* Os buracos: a vigília fura a barra, não a encurta — e em `awake`
                ela vira o destaque, não o vazio. */}
            {(bar.holes ?? []).map((h, k) => (
              <Rect
                key={k}
                x={x}
                y={y(h.from)}
                width={barW}
                height={Math.max(awakeMode ? 2.5 : 1.5, y(h.to) - y(h.from))}
                rx={awakeMode ? 1.5 : 0}
                fill={awakeMode ? awakeColor ?? accent : colors.surface}
                stroke={awakeMode ? awakeOutline : undefined}
                strokeWidth={awakeMode ? 1 : 0}
              />
            ))}
            {(days.length <= 14 || i % 2 === 0) && (
              <SvgText x={x + barW / 2} y={height - 4} fontSize={9} fill={colors.ink3} textAnchor="middle">
                {label}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
