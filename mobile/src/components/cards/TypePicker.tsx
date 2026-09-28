import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { KNOWN_ACTIVITY_IDS, activityRole, activityTypeLabel } from '@vitale/shared';
import { getActivityMeta } from '../../lib/workout-types';
import { colors, fonts, radii, roleColors, shadows, spacing, useThemedStyles } from '../../theme';

/**
 * A lista inteira de tipos — o caminho "Outro…" do seletor do detalhe.
 *
 * Os irmãos de família ficam nos chips da tela, porque são o caso real (o Apple
 * Watch grava trilha como caminhada). Esta folha existe para o resto: são 17
 * tipos, e enfileirá-los como chip daria uma tela de chips em vez de um atalho.
 *
 * O tipo atual aparece aceso mesmo quando já está num chip — a folha precisa
 * dizer de onde a correção parte, ou a escolha vira adivinhação.
 */
export function TypePicker({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: number;
  onPick: (activityId: number) => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Tipo da atividade</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {KNOWN_ACTIVITY_IDS.map((id) => {
              const papel = activityRole(id);
              const cor = papel ? roleColors(papel).accent : colors.ink3;
              const ativo = id === current;
              return (
                <Pressable
                  key={id}
                  onPress={() => onPick(id)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <MaterialCommunityIcons name={getActivityMeta(id).icon} size={19} color={cor} />
                  <Text style={[styles.name, ativo && styles.nameAtivo]}>
                    {activityTypeLabel(id)}
                  </Text>
                  {ativo && <Ionicons name="checkmark" size={18} color={cor} />}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.foot}>
            A correção vale só para esta atividade, e o sync deixa de sobrescrevê-la.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = () =>
  StyleSheet.create({
    pressed: { opacity: 0.7 },
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
      ...shadows.card,
    },
    title: { fontSize: 15, fontFamily: fonts.sansBold, color: colors.ink, marginBottom: spacing.sm },
    // Teto para a folha não empurrar o rodapé para fora numa tela pequena: os
    // 17 tipos não cabem inteiros, e o corte precisa ser o da rolagem.
    list: { maxHeight: 340 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    name: { flex: 1, fontSize: 15, fontFamily: fonts.sans, color: colors.ink },
    nameAtivo: { fontFamily: fonts.sansSemiBold },
    foot: {
      fontSize: 12,
      fontFamily: fonts.sans,
      color: colors.ink3,
      marginTop: spacing.sm,
      lineHeight: 17,
    },
  });
