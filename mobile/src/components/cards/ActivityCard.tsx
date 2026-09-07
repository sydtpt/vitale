/**
 * O cartão de atividade do Histórico.
 *
 * Extraído de `historico/[label].tsx` para a busca poder mostrar o cartão de
 * VERDADE, e não uma cópia que divergiria dele em silêncio.
 *
 * A segunda linha é disputada por três inquilinas, nesta ordem (CAP-9 da spec
 * busca-textual). A data é sempre a manchete; a linha 2 muda de dono e o cartão
 * NÃO muda de altura:
 *
 *   1. nome próprio grifado — quando a busca casou num campo que já está à
 *      vista. Grifar o que se lê vence explicar o que não se vê.
 *   2. proveniência (`Leuven · cidade`) — quando a busca só casou em campo
 *      invisível. É a única forma de a linha não parecer um erro: buscar
 *      `louvain` traz a *Tour du Hageland*, que não tem nada de Louvain no
 *      nome e passa por Leuven.
 *   3. nome próprio, ou a hora — sem busca, exatamente como a proposta C
 *      (`18b260b`) deixou.
 *
 * A regra da hora é IMPESSOAL: quem quer que ocupe a linha 2 manda a hora para
 * a fileira de números. Antes ela dependia só de haver nome próprio, e com a
 * proveniência disputando a linha isso apagaria a hora numa corrida — que não
 * tem `route_name`.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { Activity, SearchHit } from '@vitale/shared';
import { nomeProprio, realcar } from '@vitale/shared';
import { colors, fonts, radii, roleColors, shadows, spacing, themed } from '../../theme/tokens';
import {
  formatDateLabel,
  formatDistance,
  formatDuration,
  formatTime,
} from '../../lib/workout-format';

export function MediaBadge({ photos, videos }: { photos: number; videos: number }) {
  if (photos === 0 && videos === 0) return null;
  return (
    <View style={styles.mediaBadge}>
      {photos > 0 && (
        <>
          <Ionicons name="images-outline" size={12} color={colors.ink2} />
          <Text style={styles.mediaCount}>{photos}</Text>
        </>
      )}
      {photos > 0 && videos > 0 && <View style={styles.mediaSep} />}
      {videos > 0 && (
        <>
          <Ionicons name="videocam-outline" size={12} color={colors.ink2} />
          <Text style={styles.mediaCount}>{videos}</Text>
        </>
      )}
    </View>
  );
}

/**
 * Texto com o trecho que casou grifado. Régua, não preenchimento — e a cor é o
 * papel `blue` da paleta, nunca `--primary`: marca é cromo, não cor de dado.
 */
function Grifado({ texto, consulta, style }: { texto: string; consulta: string; style: object }) {
  return (
    <Text style={style} numberOfLines={1}>
      {realcar(texto, consulta).map((t, i) =>
        t.hit ? (
          <Text key={i} style={styles.grifo}>
            {t.t}
          </Text>
        ) : (
          t.t
        ),
      )}
    </Text>
  );
}

export function ActivityCard({
  item,
  color,
  icon,
  media,
  hit,
  consulta,
  onPress,
}: {
  item: Activity;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  media?: { photos: number; videos: number };
  /** Resultado da busca que trouxe este cartão. Ausente = lista normal. */
  hit?: SearchHit;
  /** O que foi digitado, para grifar o trecho. Só usado com `hit`. */
  consulta?: string;
  onPress: () => void;
}) {
  const distance = formatDistance(item.distanceM);
  // Atividades com GPS exibem o tempo em movimento; as demais, a duração total.
  const isGps = item.hasRoute || (item.distanceM ?? 0) > 0;
  const timeS = isGps ? item.movingTimeS ?? item.durationS : item.durationS;
  const nome = nomeProprio(item);
  const q = consulta ?? '';

  // `label` ausente no casamento significa "este campo já está à vista no
  // cartão" — é o dado dizendo à tela para grifar em vez de explicar.
  const explicar = hit ? hit.match.label !== undefined : false;
  const linha2Ocupada = Boolean(nome) || explicar;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: `${color}22` }]}>
          <MaterialCommunityIcons name={icon} size={20} color={color} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.cardDate}>{formatDateLabel(item.startAt)}</Text>
          {hit && explicar ? (
            <View style={styles.provRow}>
              <Grifado texto={hit.match.text} consulta={q} style={styles.cardName} />
              <Text style={styles.provLabel}>{hit.match.label}</Text>
            </View>
          ) : nome ? (
            hit ? (
              <Grifado texto={nome} consulta={q} style={styles.cardName} />
            ) : (
              <Text style={styles.cardName} numberOfLines={1}>
                {nome}
              </Text>
            )
          ) : (
            <Text style={styles.cardTime}>
              {formatTime(item.startAt)} – {formatTime(item.endAt)}
            </Text>
          )}
        </View>
        {media && <MediaBadge photos={media.photos} videos={media.videos} />}
        {item.locallyEdited && (
          <View style={styles.editBadge}>
            <Ionicons name="create-outline" size={11} color={colors.ink2} />
            <Text style={styles.editBadgeText}>editado</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        {/* A hora desce para cá sempre que alguém toma a linha 2 dela. */}
        {linha2Ocupada && (
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={14} color={colors.ink3} />
            <Text style={styles.statValue}>{formatTime(item.startAt)}</Text>
          </View>
        )}
        <View style={styles.stat}>
          <Ionicons
            name={linha2Ocupada ? 'stopwatch-outline' : 'time-outline'}
            size={14}
            color={colors.ink3}
          />
          <Text style={styles.statValue}>{formatDuration(timeS)}</Text>
        </View>
        {item.calories > 0 && (
          <View style={styles.stat}>
            <Ionicons name="flame-outline" size={14} color={colors.ink3} />
            <Text style={styles.statValue}>{item.calories} kcal</Text>
          </View>
        )}
        {distance && (
          <View style={styles.stat}>
            <Ionicons name="map-outline" size={14} color={colors.ink3} />
            <Text style={styles.statValue}>{distance}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii['2xl'],
      padding: spacing.lg,
      gap: spacing.md,
      ...shadows.card,
    },
    pressed: { opacity: 0.85 },
    flex: { flex: 1, minWidth: 0 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardDate: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
    cardTime: { fontSize: 12.5, color: colors.ink3, fontFamily: fonts.mono, marginTop: 2 },
    cardName: { fontSize: 13, color: colors.ink2, fontFamily: fonts.sans, marginTop: 2 },
    // Régua, não preenchimento: bloco preenchido já foi reprovado como destaque.
    // `graphic` do papel `blue`: cor de DADO, empurrada até o piso de contraste.
    // Nunca a marca — `--primary` é cromo, e grifo é conteúdo.
    grifo: {
      color: colors.ink,
      textDecorationLine: 'underline',
      textDecorationColor: roleColors('blue').graphic,
    },
    provRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    provLabel: { fontSize: 10.5, fontFamily: fonts.mono, color: colors.ink3 },
    editBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMute,
    },
    editBadgeText: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink2 },
    mediaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMute,
    },
    mediaCount: { fontSize: 10.5, fontFamily: fonts.mono, color: colors.ink2 },
    mediaSep: { width: 1, height: 9, backgroundColor: colors.line },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statValue: { fontSize: 13, color: colors.ink2, fontFamily: fonts.mono },
  }),
);
