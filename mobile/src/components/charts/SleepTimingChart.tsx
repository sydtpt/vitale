import React, { useId } from 'react';
import Svg, { Defs, Line, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import {
  SLEEP_AXIS_ORIGIN_H,
  axisRange,
  toTimingBar,
  type SleepColors,
  type SleepPeriod,
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
  /** A gramática de cor do sono — `sleepColors()` do tema. Nenhuma cor nasce aqui. */
  palette: SleepColors;
  /**
   * `sleep` (padrão, a visão geral): o sono é a barra, a vigília é o vão, a cama
   * é o contorno tracejado. `awake` (a subview Tempos): a cama é a lavagem de
   * fundo, o sono a barra, e cada despertar é o vão **com a marca amarela ao
   * lado** — quando e por quanto tempo. `stages`: cada estágio na posição real
   * (`stage_segments`); noite sem hipnograma vira hachura; a vigília, idem.
   */
  emphasis?: 'sleep' | 'awake' | 'stages';
}

const PAD_TOP = 8;
const PAD_BOTTOM = 18;
const PAD_LEFT = 30;
/** A marca amarela ao lado da barra: largura, e o vão até a barra. */
const TICK_W = 3;
const TICK_GAP = 2;

/**
 * O sleep timing chart: cada noite é uma barra vertical na HORA DO DIA — apagar em
 * cima, acordar embaixo —, os despertares furam a barra, e a janela na cama é o
 * contorno tracejado. Noite sem dado é uma célula vazia com contorno, não uma
 * barra de altura zero: ausência não é "dormiu nada".
 *
 * Não há número aqui, e é de propósito: a regularidade aparece porque barras
 * alinhadas parecem alinhadas (spec §2). A janela é fixa — a rolagem é a forma do
 * gráfico, não um seletor.
 *
 * Toda posição vem do núcleo (`toTimingBar`/`axisRange`, com o `tzOffset` de cada
 * período) e toda cor vem de `sleepColors()`; aqui só se desenha.
 */
export function SleepTimingChart({ days, periods, width, height = 220, palette, emphasis = 'sleep' }: Props) {
  const hatchId = `sleep-hatch-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (days.length === 0 || width <= 0) return null;
  const overview = emphasis === 'sleep';
  const stagesMode = emphasis === 'stages';

  const byDay = new Map<string, TimingBar>();
  for (const p of periods) byDay.set(p.wakeDay, toTimingBar(p));
  const bars = [...byDay.values()];
  const range = axisRange(bars);
  const span = Math.max(range.to - range.from, 1);

  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const innerW = width - PAD_LEFT;
  const slot = innerW / days.length;
  // Nas subviews a marca ao lado precisa caber no slot junto com a barra.
  const tickRoom = overview ? 0 : TICK_W + TICK_GAP;
  const barW = Math.max(4, Math.min(slot * 0.58, 18, overview ? Infinity : slot - tickRoom - 1));
  const groupW = barW + tickRoom;
  const y = (pos: number) => PAD_TOP + ((pos - range.from) / span) * innerH;

  // Linhas de hora a cada 2 h, rotuladas na hora local do eixo (origem 18h).
  const gridStart = Math.ceil(range.from / 2) * 2;
  const grid: number[] = [];
  for (let h = gridStart; h <= range.to; h += 2) grid.push(h);

  const stageFill = (stage: string): string => {
    if (stage === 'deep') return palette.deep;
    if (stage === 'rem') return palette.rem;
    if (stage === 'core') return palette.light;
    return `url(#${hatchId})`;
  };

  return (
    <Svg width={width} height={height}>
      <Defs>
        <Pattern id={hatchId} patternUnits="userSpaceOnUse" width={5} height={5} patternTransform="rotate(45)">
          <Line x1={0} y1={0} x2={0} y2={5} stroke={palette.unknown} strokeWidth={1.3} />
        </Pattern>
      </Defs>
      {grid.map((h) => (
        <React.Fragment key={h}>
          <Line x1={PAD_LEFT} y1={y(h)} x2={width} y2={y(h)} stroke={colors.line} strokeWidth={1} />
          <SvgText x={0} y={y(h) + 3} fontSize={9} fill={colors.ink4}>
            {`${String((SLEEP_AXIS_ORIGIN_H + h) % 24).padStart(2, '0')}h`}
          </SvgText>
        </React.Fragment>
      ))}

      {days.map((day, i) => {
        const x = PAD_LEFT + i * slot + (slot - groupW) / 2;
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
            {/* A cama: contorno na visão geral, lavagem de fundo nas subviews. */}
            {bar.bed && (overview ? (
              <Rect
                x={x - 2}
                y={y(bar.bed.from)}
                width={barW + 4}
                height={Math.max(1, y(bar.bed.to) - y(bar.bed.from))}
                rx={4}
                fill="none"
                stroke={palette.sleep}
                strokeWidth={1}
                strokeDasharray="3 2"
                opacity={0.55}
              />
            ) : (
              <Rect
                x={x}
                y={y(bar.bed.from)}
                width={barW}
                height={Math.max(2, y(bar.bed.to) - y(bar.bed.from))}
                rx={3}
                fill={palette.bed}
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
                  fill={stageFill(s.stage)}
                />
              ))
            ) : (
              <Rect
                x={x}
                y={y(bar.onset)}
                width={barW}
                height={Math.max(2, y(bar.wake) - y(bar.onset))}
                rx={3}
                // Sem hipnograma, o Estágios mostra sono sem o detalhe: a hachura.
                fill={stagesMode ? `url(#${hatchId})` : palette.sleep}
              />
            )}
            {/* Os buracos: a vigília fura a barra, não a encurta. Nas subviews o
                vão ganha a marca amarela ao lado — quando e por quanto tempo. */}
            {(bar.holes ?? []).map((h, k) => (
              <React.Fragment key={k}>
                <Rect x={x} y={y(h.from)} width={barW} height={Math.max(1.5, y(h.to) - y(h.from))} fill={colors.surface} />
                {!overview && (
                  <Rect
                    x={x + barW + TICK_GAP}
                    y={y(h.from)}
                    width={TICK_W}
                    height={Math.max(2.5, y(h.to) - y(h.from))}
                    rx={1}
                    fill={palette.awake}
                  />
                )}
              </React.Fragment>
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
