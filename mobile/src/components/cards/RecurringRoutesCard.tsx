import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  groupRecurringRoutes,
  type Activity,
  type RecurringRoute,
  type RouteActivity,
} from '@vitale/shared';
import { useActivitiesStore } from '../../store/activities.store';
import { colors, fonts, radii, roleColors, shadows, spacing, useThemedStyles } from '../../theme';
import { formatPace, km, timesText } from '../../lib/route-view';

/**
 * Suas rotas — as voltas que este esporte repete, e o ritmo em cada uma.
 *
 * Fica na página do tipo, ao lado de `EffortTrendCard` e `RecordCurveCard`, e
 * responde a pergunta que eles não respondem: **os dois dez-quilômetros que
 * estou comparando são o mesmo percurso?** A mesma rota controla desnível,
 * curvas e semáforos, que a distância sozinha não controla.
 *
 * **Some sozinho quando não há rota recorrente**, e isso não é um caso de borda:
 * medido no histórico real, 55% das corridas repetem uma volta e **nenhuma** das
 * 135 pedaladas repetiu — pedalada é exploratória. O cartão sumir no ciclismo é
 * a resposta certa para o ciclismo, não uma falha.
 *
 * O traçado vem do `route_overview` (um ponto a cada 40), carregado em lote pelo
 * store. É a mesma leitura que o mapa por país usa; nada novo bate no banco.
 */

/** Quantas rotas o cartão lista antes de parar. */
const MAX_ROWS = 4;
/** Barras da faísca — as últimas passagens, da mais antiga à mais recente. */
const SPARK_MAX = 12;
const SPARK_H = 18;

interface Props {
  /** Atividades **deste esporte**, já filtradas pela tela. */
  activities: Activity[];
  /** Abre a atividade tocada. */
  onPick?: (id: string) => void;
}

export function RecurringRoutesCard({ activities, onPick }: Props) {
  const styles = useThemedStyles(createStyles);
  const loadOverviews = useActivitiesStore((s) => s.loadRouteOverviews);
  const overviews = useActivitiesStore((s) => s.overviews);
  const [ready, setReady] = useState(false);

  // Só as que têm rota: pedir traçado de quem não tem gasta uma ida ao banco
  // para receber vazio.
  const ids = useMemo(
    () => activities.filter((a) => a.hasRoute && a.distanceM && a.distanceM > 0).map((a) => a.id),
    [activities],
  );
  const idKey = ids.join(',');

  useEffect(() => {
    let alive = true;
    if (ids.length === 0) {
      setReady(true);
      return;
    }
    void loadOverviews(ids).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey, loadOverviews]);

  const routes = useMemo(() => {
    if (!ready) return [];
    const candidates: RouteActivity[] = [];
    for (const a of activities) {
      const pts = overviews[a.id];
      if (!pts || pts.length === 0 || !a.distanceM) continue;
      candidates.push({
        id: a.id,
        points: pts,
        distanceM: a.distanceM,
        movingTimeS: a.movingTimeS,
        startAt: a.startAt,
        elevationM: a.elevationM,
      });
    }
    return groupRecurringRoutes(candidates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, overviews, activities]);

  if (routes.length === 0) return null;

  const shown = routes.slice(0, MAX_ROWS);
  const rest = routes.length - shown.length;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>SUAS ROTAS</Text>
        <Text style={styles.hint}>
          {routes.length} recorrente{routes.length === 1 ? '' : 's'}
        </Text>
      </View>

      {shown.map((r, i) => (
        <RouteRow key={r.id} route={r} first={i === 0} styles={styles} onPick={onPick} />
      ))}

      {rest > 0 && <Text style={styles.more}>e mais {rest} com menos repetições</Text>}
    </View>
  );
}

interface RowProps {
  route: RecurringRoute;
  first: boolean;
  styles: ReturnType<typeof createStyles>;
  onPick?: (id: string) => void;
}

function RouteRow({ route, first, styles, onPick }: RowProps) {
  const green = roleColors('green');
  // A faísca mostra ritmo, e ritmo é melhor quando **menor** — a barra cresce
  // para baixo do pior, senão a corrida mais lenta viraria a mais alta.
  const paces = route.efforts
    .map((e) => e.paceSPerKm)
    .filter((p): p is number => typeof p === 'number')
    .slice(-SPARK_MAX);
  const lo = paces.length > 0 ? Math.min(...paces) : 0;
  const hi = paces.length > 0 ? Math.max(...paces) : 1;
  const span = hi - lo || 1;

  const last = route.efforts[route.efforts.length - 1];

  return (
    <Pressable
      accessibilityRole={onPick ? 'button' : undefined}
      accessibilityLabel={`Rota de ${km(route.distanceM)}, ${timesText(route.count)}. Melhor ritmo ${formatPace(route.best?.paceSPerKm)} por quilômetro.`}
      onPress={onPick && last ? () => onPick(last.id) : undefined}
      style={({ pressed }) => [styles.row, !first && styles.rowDivided, pressed && styles.pressed]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.dist}>{km(route.distanceM)}</Text>
        {route.elevationM !== null && (
          <Text style={styles.meta}>{Math.round(route.elevationM)} m de subida</Text>
        )}
        <Text style={styles.count}>{route.count}×</Text>
      </View>
      <View style={styles.rowBottom}>
        <Text style={styles.pace}>
          melhor <Text style={[styles.paceBest, { color: green.text }]}>{formatPace(route.best?.paceSPerKm)}</Text>
          {route.median ? ` · típico ${formatPace(route.median.paceSPerKm)}` : ''}
        </Text>
        <View style={styles.spark}>
          {paces.map((p, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: 4 + ((hi - p) / span) * (SPARK_H - 4),
                  backgroundColor: p === lo ? green.accent : i === paces.length - 1 ? colors.ink2 : colors.ink4,
                },
              ]}
            />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii['2xl'],
      padding: spacing.lg,
      marginTop: spacing.md,
      gap: 4,
      ...shadows.card,
    },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
    eyebrow: { fontSize: 12.5, letterSpacing: 0.6, fontFamily: fonts.sansBold, color: colors.ink2 },
    hint: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink3 },
    row: { paddingVertical: 10, gap: 3 },
    rowDivided: { borderTopWidth: 1, borderTopColor: colors.line },
    pressed: { opacity: 0.7 },
    rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    dist: { fontFamily: fonts.monoSemiBold, fontSize: 14, color: colors.ink },
    meta: { flex: 1, fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink3 },
    count: { fontSize: 12, fontFamily: fonts.sansBold, color: colors.ink2 },
    rowBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    pace: { flex: 1, fontFamily: fonts.mono, fontSize: 12, color: colors.ink2 },
    paceBest: { fontFamily: fonts.monoSemiBold },
    spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: SPARK_H },
    bar: { width: 5, borderRadius: 1 },
    more: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3, marginTop: 2 },
  });
