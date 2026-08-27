import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import type { ActivityRoutePoint } from '@vitale/shared';
import { elevationProfile, formatRate, speedSeries } from '@vitale/shared';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';

const H = 92;
const PAD_T = 12;
const PAD_B = 8;
/** Teto de vértices por traçado: mil pontos num `path` não desenham mais nada. */
const MAX_VERTS = 240;

interface Panel {
  title: string;
  area: string;
  line: string;
  topLabel: string;
  botLabel: string;
  marker: { x: number; y: number; label: string } | null;
}

/**
 * Perfil de elevação e curva de ritmo, abaixo do mapa.
 *
 * **Dois gráficos empilhados, nunca um com dois eixos.** Altitude e velocidade
 * têm escalas sem relação nenhuma, e sobrepô-las num eixo duplo faz o leitor ver
 * cruzamentos que não significam nada. Empilhados, compartilham o eixo x
 * (distância percorrida), que é o que de fato liga os dois: dá para descer o
 * dedo de um pico de subida para o afundamento do ritmo embaixo dele.
 *
 * Cada painel some sozinho quando não há o que mostrar — percurso plano não tem
 * perfil, rota sem horário por ponto não tem ritmo. Com os dois ausentes, o card
 * inteiro não aparece, em vez de desenhar uma reta que parece dado.
 */
export function RouteProfileCard({
  points,
  activityId,
  color,
}: {
  points: ActivityRoutePoint[];
  activityId: number;
  color: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  // Padding do scroll dos dois lados, mais o do card.
  const w = Math.max(0, width - spacing.lg * 2 - spacing.lg * 2);

  const { panels, totalKm } = useMemo<{ panels: Panel[]; totalKm: number }>(() => {
    const prof = elevationProfile(points);
    const speed = speedSeries(points);
    const xMax = Math.max(
      prof ? prof.xs[prof.xs.length - 1] : 0,
      speed ? speed.xs[speed.xs.length - 1] : 0,
      1,
    );
    const rate = (mps: number) => {
      if (mps <= 0) return '—';
      const r = formatRate(activityId, 1000, 1000 / mps);
      return r ? `${r.value} ${r.caption === 'pace' ? 'min/km' : r.caption}` : '—';
    };

    const out: Panel[] = [];
    if (prof) {
      out.push({
        title: 'Elevação',
        ...geometry(prof.xs, prof.ys, xMax, prof.minAlt, prof.maxAlt, w),
        topLabel: `${Math.round(prof.maxAlt)} m`,
        botLabel: `${Math.round(prof.minAlt)} m`,
        marker: {
          x: xAt(prof.xs[prof.peakIdx], xMax, w),
          y: yAt(prof.ys[prof.peakIdx], prof.minAlt, prof.maxAlt),
          label: `${Math.round(prof.maxAlt)} m`,
        },
      });
    }
    if (speed) {
      const lo = Math.min(...speed.mps);
      const hi = Math.max(...speed.mps);
      out.push({
        // O eixo é velocidade (mais alto = mais rápido, sem inverter nada), mas
        // rotulado na unidade do esporte: corrida lê min/km, bicicleta lê km/h.
        title: activityId === 13 ? 'Velocidade' : 'Ritmo',
        ...geometry(speed.xs, speed.mps, xMax, lo, hi, w),
        topLabel: rate(hi),
        botLabel: rate(lo),
        marker: null,
      });
    }
    return { panels: out, totalKm: xMax / 1000 };
  }, [points, activityId, w]);

  if (panels.length === 0 || w <= 0) return null;

  return (
    <View style={styles.card}>
      {panels.map((p) => (
        <View key={p.title} style={styles.panel}>
          <View style={styles.head}>
            <Text style={styles.title}>{p.title}</Text>
            <Text style={styles.range}>
              {p.botLabel} → {p.topLabel}
            </Text>
          </View>
          <Svg width={w} height={H}>
            <Path d={p.area} fill={color} fillOpacity={0.14} />
            <Path
              d={p.line}
              stroke={color}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {p.marker && (
              <>
                <Circle
                  cx={p.marker.x}
                  cy={p.marker.y}
                  r={3}
                  fill={color}
                  stroke={colors.surface}
                  strokeWidth={2}
                />
                <SvgText
                  x={p.marker.x}
                  y={p.marker.y - 7}
                  fontSize={9}
                  fill={colors.ink}
                  textAnchor={p.marker.x > w * 0.7 ? 'end' : 'middle'}
                >
                  {p.marker.label}
                </SvgText>
              </>
            )}
          </Svg>
        </View>
      ))}

      {/* O eixo x é comum aos dois painéis; desenhá-lo dentro de um deles o
          prenderia àquele gráfico. */}
      <View style={styles.axis}>
        <Text style={styles.tick}>0 km</Text>
        <Text style={styles.tick}>{fmtKm(totalKm / 2)}</Text>
        <Text style={styles.tick}>{fmtKm(totalKm)}</Text>
      </View>
    </View>
  );
}

function fmtKm(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function xAt(x: number, xMax: number, w: number): number {
  return (x / xMax) * w;
}

function yAt(v: number, lo: number, hi: number): number {
  const span = hi - lo || 1;
  return PAD_T + (1 - (v - lo) / span) * (H - PAD_T - PAD_B);
}

/**
 * Traçado e área de uma série.
 *
 * Reamostra por índice até `MAX_VERTS`: uma rota longa chega com milhares de
 * pontos e, na largura de um celular, tudo acima de umas poucas centenas cai no
 * mesmo pixel — custa render e não desenha nada a mais. O último ponto entra
 * sempre, senão o traçado termina antes da linha de chegada.
 */
function geometry(
  xs: number[],
  ys: number[],
  xMax: number,
  lo: number,
  hi: number,
  w: number,
): { area: string; line: string } {
  const step = Math.max(1, Math.ceil(xs.length / MAX_VERTS));
  const idx: number[] = [];
  for (let i = 0; i < xs.length; i += step) idx.push(i);
  if (idx[idx.length - 1] !== xs.length - 1) idx.push(xs.length - 1);

  const pts = idx.map(
    (i) => `${xAt(xs[i], xMax, w).toFixed(1)},${yAt(ys[i], lo, hi).toFixed(1)}`,
  );
  const line = `M${pts.join(' L')}`;
  const base = (H - PAD_B).toFixed(1);
  const first = xAt(xs[idx[0]], xMax, w).toFixed(1);
  const last = xAt(xs[idx[idx.length - 1]], xMax, w).toFixed(1);
  return { line, area: `${line} L${last},${base} L${first},${base} Z` };
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii['2xl'],
      padding: spacing.lg,
      marginTop: spacing.sm,
      gap: spacing.sm,
      ...shadows.card,
    },
    panel: { gap: 2 },
    head: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    title: { fontSize: 11.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    range: { marginLeft: 'auto', fontSize: 10.5, fontFamily: fonts.mono, color: colors.ink3 },
    axis: { flexDirection: 'row', justifyContent: 'space-between' },
    tick: { fontSize: 10, fontFamily: fonts.mono, color: colors.ink4 },
  });
