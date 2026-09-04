import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Polyline, Rect } from 'react-native-svg';
import { elevationProfile, findClimbs, type ActivityRoutePoint } from '@vitale/shared';
import { colors, fonts, radii, roleColors, shadows, spacing, useThemedStyles } from '../../theme';
import { CLIMBS_FOOTNOTE, climbText, climbTone, climbsSummary, type ClimbTone } from '../../lib/route-view';

/**
 * Subidas — onde a atividade realmente escalou.
 *
 * Vive no detalhe, logo abaixo do perfil de elevação, e lê **o mesmo perfil**
 * que o `RouteProfileCard` desenha: as faixas destacadas caem exatamente sobre o
 * traço que o usuário já viu, e não sobre uma segunda versão dele.
 *
 * O que ele acrescenta ao número de elevação: o publicado é ganho **acumulado**,
 * e soma o sobe-e-desce que nunca virou subida. Medido no histórico real, um
 * passeio de 114 km com 1.225 m de ganho tem 395 m em subidas contínuas,
 * enquanto uma pedalada de 58 km com 832 m tem 531 m. A segunda escala mais que
 * a primeira, e a elevação sozinha diz o contrário.
 *
 * **O cartão não mostra fração.** O ganho do perfil desenhado e o `elevationM`
 * publicado usam janelas de suavização diferentes e divergem bastante — 1.378
 * contra 860 numa pedalada real. Ver `climbsSummary` em `route-view.ts`.
 */

const CHART_H = 76;
const BAR_H = 7;

interface Props {
  /** Track completo da atividade, como o detalhe já carregou. */
  points: readonly ActivityRoutePoint[];
}

export function ClimbsCard({ points }: Props) {
  const styles = useThemedStyles(createStyles);
  // Mede a própria largura, como o `RouteProfileCard` ao lado: a tela de detalhe
  // não distribui largura, e depender dela acoplaria os dois.
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const profile = useMemo(() => elevationProfile(points), [points]);
  const summary = useMemo(() => findClimbs(profile), [profile]);

  // Sem perfil o percurso é plano ou não tem amostra: a seção não existe.
  if (!profile || summary.climbs.length === 0) return null;

  const tone: Record<ClimbTone, string> = {
    easy: roleColors('blue').accent,
    medium: roleColors('yellow').accent,
    hard: roleColors('orange').accent,
  };
  const max = summary.climbs[0].score || 1;

  const { xs, ys } = profile;
  const spanX = xs[xs.length - 1] - xs[0] || 1;
  const spanY = profile.maxAlt - profile.minAlt || 1;
  const px = (v: number) => ((v - xs[0]) / spanX) * width;
  const py = (v: number) => 6 + (1 - (v - profile.minAlt) / spanY) * (CHART_H - 12);
  const pts = xs.map((x, i) => `${px(x).toFixed(1)},${py(ys[i]).toFixed(1)}`).join(' ');

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>SUBIDAS</Text>
        <Text style={styles.hint}>{climbsSummary(summary.climbs.length, summary.climbGainM)}</Text>
      </View>

      <View onLayout={onLayout} accessible={false} importantForAccessibility="no-hide-descendants">
        {width > 0 && (
        <Svg width={width} height={CHART_H}>
          {summary.climbs.map((c, i) => (
            <Rect
              key={i}
              x={px(c.startM)}
              y={0}
              width={Math.max(1, px(c.endM) - px(c.startM))}
              height={CHART_H}
              fill={tone[climbTone(c)]}
              opacity={0.16}
            />
          ))}
          <Path
            d={`M0,${CHART_H} L${pts} L${width},${CHART_H} Z`}
            fill={colors.ink4}
            opacity={0.45}
          />
          <Polyline points={pts} fill="none" stroke={colors.ink2} strokeWidth={1.4} />
        </Svg>
        )}
      </View>

      <View style={styles.list}>
        {summary.climbs.map((c, i) => (
          <View
            key={i}
            style={styles.row}
            accessible
            accessibilityLabel={`Subida no km ${(c.startM / 1000).toFixed(1)}: ${climbText(c)}, ganho de ${Math.round(c.gainM)} metros.`}
          >
            <Text style={styles.km}>km {(c.startM / 1000).toFixed(1).replace('.', ',')}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round((c.score / max) * 100)}%` as const, backgroundColor: tone[climbTone(c)] },
                ]}
              />
            </View>
            <Text style={styles.txt}>{climbText(c)}</Text>
            <Text style={styles.gain}>+{Math.round(c.gainM)} m</Text>
          </View>
        ))}
      </View>

      <Text style={styles.foot}>{CLIMBS_FOOTNOTE}</Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii['2xl'],
      padding: spacing.lg,
      marginTop: spacing.md,
      gap: 10,
      ...shadows.card,
    },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
    eyebrow: { fontSize: 12.5, letterSpacing: 0.6, fontFamily: fonts.sansBold, color: colors.ink2 },
    hint: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink3 },
    list: { gap: 7 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    km: { width: 52, fontFamily: fonts.mono, fontSize: 11, color: colors.ink3 },
    track: { flex: 1, height: BAR_H, borderRadius: BAR_H / 2, backgroundColor: colors.surfaceMute, overflow: 'hidden' },
    fill: { height: BAR_H, borderRadius: BAR_H / 2 },
    txt: { width: 92, textAlign: 'right', fontFamily: fonts.mono, fontSize: 11, color: colors.ink2 },
    gain: { width: 46, textAlign: 'right', fontFamily: fonts.monoSemiBold, fontSize: 11, color: colors.ink },
    foot: { fontSize: 11, lineHeight: 15, fontFamily: fonts.sans, color: colors.ink3 },
  });
