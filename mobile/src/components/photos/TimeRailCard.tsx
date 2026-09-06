/**
 * O trilho do tempo (ADR 0037, prancha C).
 *
 * Substitui o scrub de elevação **nesta tela** — e não por preferência: na
 * travessia de 29/08/2026 o perfil inteiro tem 20,4 m de amplitude em 67 km,
 * quase toda jitter de GPS. Ali o relevo não distingue nada. As 5h42 de relógio
 * contra 2h40 de movimento, sim.
 *
 * O vão claro entre dois trechos laranja **é** o dado: o tempo em que a
 * bicicleta não andou. Nenhum dos cinco apps pesquisados desenha isso.
 *
 * O dedo no trilho move o ponto no mapa — o mesmo gesto do `RouteProfileCard`,
 * e por isso emite **distância em metros**, que é o que o cursor já consome.
 */

import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, PanResponder, useWindowDimensions } from 'react-native';
import {
  type ActivityRoutePoint,
  detectStops,
  indexAtTimeFraction,
  routeDistances,
  timeRail,
} from '@vitale/shared';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function hm(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

interface Props {
  points: readonly ActivityRoutePoint[];
  totalDistanceM?: number;
  /** Fotos por parada, para marcar o trilho: fração do tempo → contagem. */
  marks?: { atMs: number; count: number }[];
  /** Distância acumulada (m) sob o dedo, ou `null` ao soltar. */
  onScrub?: (distanceM: number | null) => void;
}

export function TimeRailCard({ points, totalDistanceM, marks = [], onScrub }: Props) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  /** Padding do scroll dos dois lados, mais o do card. */
  const w = Math.max(0, width - spacing.lg * 2 - spacing.lg * 2);

  const rail = useMemo(() => {
    const stops = detectStops(points, { totalDistanceM });
    return timeRail(points, stops);
  }, [points, totalDistanceM]);

  /** A régua só muda quando a rota muda — o arrasto não pode recalculá-la. */
  const distances = useMemo(() => routeDistances(points), [points]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => emit(e.nativeEvent.locationX),
      onPanResponderMove: (e) => emit(e.nativeEvent.locationX),
      onPanResponderRelease: () => onScrub?.(null),
      onPanResponderTerminate: () => onScrub?.(null),
    }),
  ).current;

  function emit(x: number) {
    if (!onScrub || !rail || w <= 0) return;
    const f = Math.min(1, Math.max(0, x / w));
    const idx = indexAtTimeFraction(points, f);
    onScrub(distances[idx] ?? 0);
  }

  if (!rail) return null;

  const movingS = rail.moving.reduce((sum, s) => sum + (s.to - s.from), 0) * ((rail.endMs - rail.startMs) / 1000);
  const totalS = (rail.endMs - rail.startMs) / 1000;
  const fracOf = (ms: number) => (ms - rail.startMs) / (rail.endMs - rail.startMs);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>A pedalada no tempo</Text>
        <Text style={styles.meta}>
          {hm(totalS)} · {hm(movingS)} movendo
        </Text>
      </View>

      <View style={styles.rail} {...pan.panHandlers}>
        <View style={styles.track} />
        {rail.moving.map((s) => (
          <View
            key={`m${s.from}`}
            style={[styles.moving, { left: `${s.from * 100}%`, width: `${(s.to - s.from) * 100}%` }]}
          />
        ))}
        {marks.map((mk) => {
          const f = fracOf(mk.atMs);
          if (f < 0 || f > 1) return null;
          return (
            <React.Fragment key={mk.atMs}>
              <Text style={[styles.tickLabel, { left: `${f * 100}%` }]}>{hhmm(mk.atMs)}</Text>
              <View style={[styles.tick, { left: `${f * 100}%` }]}>
                <Text style={styles.tickText}>{mk.count}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      <View style={styles.ends}>
        <Text style={styles.end}>{hhmm(rail.startMs)}</Text>
        <Text style={styles.end}>{hhmm(rail.endMs)}</Text>
      </View>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii['2xl'],
      padding: spacing.lg,
      marginTop: spacing.sm,
      ...shadows.card,
    },
    head: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.sm },
    title: { fontSize: 13, fontFamily: fonts.sansBold, color: colors.ink },
    meta: { marginLeft: 'auto', fontSize: 11.5, fontFamily: fonts.mono, color: colors.ink3 },

    rail: { height: 34, justifyContent: 'center' },
    track: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 15,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.line,
    },
    moving: {
      position: 'absolute',
      top: 15,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.primary,
      opacity: 0.85,
    },
    /**
     * O marcador é **neutro**, como no mapa: a rota já gasta o papel `orange`.
     * Ver ADR 0018 e "marca não é cor de dado".
     */
    tick: {
      position: 'absolute',
      top: 6,
      width: 21,
      height: 21,
      borderRadius: 11,
      marginLeft: -10.5,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tickText: { fontSize: 10, fontFamily: fonts.monoSemiBold, color: colors.surface },
    tickLabel: {
      position: 'absolute',
      top: -4,
      marginLeft: -18,
      width: 36,
      textAlign: 'center',
      fontSize: 9.5,
      fontFamily: fonts.mono,
      color: colors.ink3,
    },

    ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
    end: { fontSize: 10, fontFamily: fonts.mono, color: colors.ink3 },
  });
