import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  gearStyleLabel,
  isGearOpen,
  sumSurfaceMix,
  surfaceRamp,
  surfaceShares,
  type Activity,
  type Gear,
} from '@vitale/shared';
import { fmtGearDate, ridesOfGear, typicalKm, typicalSpeed } from '../../lib/gear-format';
import { colors, fonts, moduleColors, radii, shadows, spacing, useTheme, useThemedStyles } from '../../theme';

/**
 * Uma bicicleta como coisa, não como opção de filtro: quanto rodou, a saída
 * típica, a velocidade nas longas e a régua de piso dela.
 *
 * "Em uso" é a janela aberta — não há campo `padrão`. Por isso o botão de
 * promover só aparece na aposentada: na que já está em uso ele não teria o que
 * fazer.
 */
export function GearCard({
  gear,
  count,
  distanceM,
  rides,
  onEdit,
  onDefault,
  onRemove,
}: {
  gear: Gear;
  count: number;
  distanceM: number;
  rides: readonly Activity[];
  onEdit: () => void;
  onDefault: () => void;
  onRemove: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { scheme } = useTheme();
  const ramp = surfaceRamp(scheme, moduleColors('treino').accent, colors.surface, colors.ink, colors.ink4);
  const open = isGearOpen(gear);

  const mine = useMemo(() => ridesOfGear(rides, gear), [rides, gear]);
  const mix = useMemo(() => sumSurfaceMix(mine.map((a) => a.surfaceMix)), [mine]);
  const shares = surfaceShares(mix);
  const typical = useMemo(() => typicalKm(mine), [mine]);
  const speed = useMemo(() => typicalSpeed(mine), [mine]);
  const num = (v: number, d = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: d });

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>{gear.name}</Text>
        <View style={[styles.badge, open && styles.badgeLive]}>
          <Text style={[styles.badgeText, open && styles.badgeTextLive]}>
            {open ? 'Em uso' : 'Aposentada'}
          </Text>
        </View>
        <Text style={styles.period}>
          {open ? `desde ${fmtGearDate(gear.activeFrom)}` : `até ${fmtGearDate(gear.activeTo!)}`}
        </Text>
      </View>

      {gear.style || gear.notes ? (
        <Text style={styles.sub} numberOfLines={2}>
          {[gearStyleLabel(gear.style), gear.notes].filter(Boolean).join(' · ')}
        </Text>
      ) : null}

      <View style={styles.stats}>
        <Stat value={num(distanceM / 1000, 0)} unit="km" />
        <Stat value={String(count)} unit={count === 1 ? 'saída' : 'saídas'} />
        {typical > 0 && <Stat value={num(typical)} unit="km típicos" />}
        {speed > 0 && <Stat value={num(speed)} unit="km/h ≥40" />}
      </View>

      {mix.total > 0 && (
        <View style={styles.rampWrap}>
          <View style={styles.ramp}>
            {(['liso', 'blocos', 'cascalho', 'terra'] as const).map((k) => {
              const v = k === 'blocos' ? shares.blocos + shares.pave : shares[k];
              return v > 0 ? <View key={k} style={{ flex: v, backgroundColor: ramp[k] }} /> : null;
            })}
          </View>
          <Text style={styles.rampCap}>
            {Math.round((shares.cascalho + shares.terra) * 100)}% fora do asfalto
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        {!open && (
          <Pressable onPress={onDefault} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Ionicons name="checkmark-circle-outline" size={15} color={colors.primary} />
            <Text style={[styles.actionText, styles.actionPrimary]}>Usar esta</Text>
          </Pressable>
        )}
        <Pressable onPress={onEdit} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Ionicons name="create-outline" size={15} color={colors.ink2} />
          <Text style={styles.actionText}>Editar</Text>
        </Pressable>
        <Pressable onPress={onRemove} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Ionicons name="trash-outline" size={15} color={colors.ink3} />
          <Text style={[styles.actionText, styles.actionMuted]}>Apagar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ value, unit }: { value: string; unit: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    pressed: { opacity: 0.7 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      ...shadows.card,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    name: { fontSize: 16, fontFamily: fonts.sansBold, color: colors.ink, flexShrink: 1 },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMute,
    },
    badgeLive: { backgroundColor: colors.primary },
    badgeText: {
      fontSize: 10.5,
      fontFamily: fonts.sansSemiBold,
      color: colors.ink2,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    badgeTextLive: { color: colors.onPrimary },
    period: { marginLeft: 'auto', fontSize: 11.5, fontFamily: fonts.mono, color: colors.ink3 },
    sub: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink2 },

    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: 2 },
    stat: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    statValue: { fontSize: 15, fontFamily: fonts.mono, color: colors.ink },
    statUnit: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3 },

    rampWrap: { gap: 5, marginTop: 2 },
    ramp: {
      flexDirection: 'row',
      height: 7,
      borderRadius: 3,
      overflow: 'hidden',
      gap: 1.5,
      backgroundColor: colors.surfaceMute,
    },
    rampCap: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3 },

    actions: { flexDirection: 'row', gap: spacing.lg, marginTop: 4 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionText: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    // O ícone leva a marca; a letra fica na tinta (catraca da ADR 0024).
    actionPrimary: { color: colors.ink },
    actionMuted: { color: colors.ink3 },
  });
