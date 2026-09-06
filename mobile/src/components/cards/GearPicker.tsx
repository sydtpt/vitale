import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { gearStyleLabel, isGearOpen, type Gear } from '@vitale/shared';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';

/**
 * Escolher a bicicleta de UMA pedalada — a exceção da ADR 0033.
 *
 * "Pela data" é o normal e vem primeiro na lista: é para onde se volta quando a
 * correção foi um engano. As outras opções gravam `activities.gear_id`, que é o
 * único campo que sobrepõe a herança.
 */
export function GearPicker({
  visible,
  gears,
  current,
  inherited,
  onPick,
  onClose,
}: {
  visible: boolean;
  gears: readonly Gear[];
  /** O que está gravado como exceção; nulo = seguindo a data. */
  current: string | null;
  /** Qual bicicleta a data escolhe, para a opção "pela data" dizer qual é. */
  inherited?: Gear;
  onPick: (gearId: string | null) => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Bicicleta desta pedalada</Text>

          <Pressable
            onPress={() => onPick(null)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.flex}>
              <Text style={styles.name}>Pela data</Text>
              <Text style={styles.sub}>
                {inherited ? `A que estava em uso: ${inherited.name}` : 'Nenhuma bicicleta cobre este dia'}
              </Text>
            </View>
            {current === null && <Ionicons name="checkmark" size={18} color={colors.primary} />}
          </Pressable>

          {gears.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => onPick(g.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.flex}>
                <Text style={styles.name}>{g.name}</Text>
                <Text style={styles.sub}>
                  {[gearStyleLabel(g.style), isGearOpen(g) ? 'em uso' : 'aposentada']
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              {current === g.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </Pressable>
          ))}

          <Text style={styles.foot}>
            A escolha vale só para esta pedalada. As outras continuam seguindo a data.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = () =>
  StyleSheet.create({
    pressed: { opacity: 0.7 },
    flex: { flex: 1 },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'flex-end',
      padding: spacing.lg,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: 2,
      ...shadows.card,
    },
    title: { fontSize: 15, fontFamily: fonts.sansBold, color: colors.ink, marginBottom: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 11,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
    },
    name: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink },
    sub: { fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: 1 },
    foot: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3, marginTop: spacing.sm },
  });
