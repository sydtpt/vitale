import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Activity } from '@vitale/shared';
import { segmentsInside, type MedalRank } from '@vitale/shared';
import { formatClock, formatRate } from '../../lib/workout-format';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';

/**
 * As distâncias padrão que couberam dentro desta atividade — tempo, ritmo e,
 * quando houve disputa, a medalha.
 *
 * ## O número já estava gravado
 *
 * `bestEfforts` é calculado por treino, no sync, com janela deslizante sobre o
 * track: a linha de uma corrida de 20 km carrega o melhor 5 km que aconteceu
 * *dentro dela*. Até aqui nenhuma tela de detalhe lia isso — a tira de Recordes
 * mostra só o mínimo entre todas as corridas, e um 5 km forte que não bateu o
 * recorde de sempre não aparecia em lugar nenhum. É a pergunta que o Sydnei
 * trouxe: *"quando corro 20 km, quero saber se dentro disso fiz os 5 km mais
 * rápidos dos meus treinos"*.
 *
 * ## A medalha mora aqui, não no topo
 *
 * No topo da página do tipo só a melhor marca importa; três medalhas ali seriam
 * ruído disputando atenção. Na corrida específica, uma medalha é legenda — o app
 * dizendo *"aquele domingo foi o seu 2º melhor 5 km"* no momento em que você
 * está olhando aquele domingo. Foi ele quem reposicionou.
 *
 * Sem disputa (menos de três participantes na distância) o tempo continua
 * aparecendo — é real — e a medalha não. Sem `bestEfforts` (corrida sem GPS,
 * linha antiga) o card inteiro some, em vez de aparecer vazio.
 */
export function SegmentsCard({
  activities,
  activity,
}: {
  /** O histórico inteiro: a medalha é uma comparação, e cada esporte compete consigo mesmo. */
  activities: Activity[];
  activity: Activity;
}) {
  const styles = useThemedStyles(createStyles);
  const segments = useMemo(() => segmentsInside(activities, activity), [activities, activity]);

  if (segments.length === 0) return null;

  const noun = activity.activityId === 13 ? 'desta pedalada' : 'desta corrida';

  return (
    <>
      <Text style={styles.sectionTitle}>Dentro {noun}</Text>
      <View style={styles.card}>
        {segments.map((s, i) => {
          const rate = formatRate(activity.activityId, s.meters, s.secs);
          return (
            <View key={s.key} style={[styles.row, i < segments.length - 1 && styles.rowBorder]}>
              <Text style={styles.label}>{s.label}</Text>
              <Text style={styles.time}>{formatClock(s.secs)}</Text>
              {rate && (
                <Text style={styles.rate}>
                  {rate.value}
                  <Text style={styles.rateUnit}> {rate.caption === 'pace' ? '/km' : rate.caption}</Text>
                </Text>
              )}
              <View style={styles.flex} />
              {s.rank !== null && <Medal rank={s.rank} />}
            </View>
          );
        })}
      </View>
    </>
  );
}

/**
 * O emoji carrega a cor sozinho — ouro, prata e bronze não são papéis da paleta,
 * são a convenção que todo mundo lê sem legenda. O texto fica na tinta do tema.
 */
function Medal({ rank }: { rank: MedalRank }) {
  const styles = useThemedStyles(createStyles);
  const text = rank === 1 ? '🥇 melhor de sempre' : rank === 2 ? '🥈 2º melhor' : '🥉 3º melhor';
  return (
    <Text style={[styles.medal, rank === 1 && styles.medalGold]} numberOfLines={1}>
      {text}
    </Text>
  );
}

const createStyles = () =>
  StyleSheet.create({
    // O mesmo título de seção do detalhe: o card é uma seção dele, não um bloco à parte.
    sectionTitle: {
      fontSize: 13,
      fontFamily: fonts.sansSemiBold,
      color: colors.ink2,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
      marginLeft: 4,
      textTransform: 'uppercase',
      letterSpacing: 1.0,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii['2xl'],
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
      ...shadows.card,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
    label: { minWidth: 56, fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink },
    time: { minWidth: 62, fontSize: 14, fontFamily: fonts.monoBold, color: colors.ink },
    rate: { fontSize: 13, fontFamily: fonts.mono, color: colors.ink2 },
    rateUnit: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3 },
    flex: { flex: 1 },
    medal: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink2, flexShrink: 1 },
    medalGold: { fontFamily: fonts.sansSemiBold, color: colors.ink },
  });
