import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GEAR_STYLES, isGearOpen, type Gear, type GearInput, type GearStyle } from '@vitale/shared';
import { fmtGearDate, gearToday, parseGearDate } from '../../lib/gear-format';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';

const BIKE_ACTIVITY_ID = 13;

/**
 * Cadastro de bicicleta: dados básicos e nada mais — nome, estilo, desde
 * quando, uma nota.
 *
 * O interruptor "usar como padrão" é a peça que o modelo exige: quando uma
 * bicicleta entra, a anterior precisa fechar, senão as duas valem no mesmo dia
 * e a herança da pedalada fica ambígua. A pergunta aparece aqui, afirmativa,
 * em vez de virar um alerta depois de salvar.
 */
export function GearForm({
  gear,
  busy,
  onCancel,
  onSave,
}: {
  gear?: Gear;
  busy: boolean;
  onSave: (input: GearInput, asDefault: boolean, id?: string) => void;
  onCancel: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState(gear?.name ?? '');
  const [style, setStyle] = useState<GearStyle | undefined>(gear?.style);
  const [since, setSince] = useState(fmtGearDate(gear?.activeFrom ?? gearToday()));
  const [notes, setNotes] = useState(gear?.notes ?? '');
  const [asDefault, setAsDefault] = useState(gear ? isGearOpen(gear) : true);

  const activeFrom = parseGearDate(since);
  const valid = name.trim().length > 0 && !!activeFrom;

  return (
    <View style={styles.form}>
      <Text style={styles.title}>{gear ? 'Editar bicicleta' : 'Nova bicicleta'}</Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Cube Nuroad SLX"
        placeholderTextColor={colors.ink4}
        autoFocus={!gear}
      />

      <Text style={styles.label}>Estilo</Text>
      <View style={styles.chips}>
        {GEAR_STYLES.map((s) => {
          const on = style === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setStyle(on ? undefined : s.id)}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Em uso desde</Text>
      <TextInput
        style={styles.input}
        value={since}
        onChangeText={setSince}
        placeholder="dd/mm/aaaa"
        placeholderTextColor={colors.ink4}
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.label}>Notas</Text>
      <TextInput
        style={styles.input}
        value={notes}
        onChangeText={setNotes}
        placeholder="2026, tam. M · G-One R 45"
        placeholderTextColor={colors.ink4}
      />

      <Pressable
        onPress={() => setAsDefault((v) => !v)}
        style={({ pressed }) => [styles.switchRow, pressed && styles.pressed]}
        accessibilityRole="switch"
        accessibilityState={{ checked: asDefault }}
      >
        <Ionicons
          name={asDefault ? 'checkbox' : 'square-outline'}
          size={20}
          color={asDefault ? colors.primary : colors.ink3}
        />
        <View style={styles.flex}>
          <Text style={styles.switchTitle}>Usar como padrão</Text>
          <Text style={styles.switchSub}>
            As pedaladas a partir desta data passam a ser desta bicicleta, e a anterior é
            aposentada no dia anterior.
          </Text>
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Pressable onPress={onCancel} style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}>
          <Text style={styles.ghostText}>Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!valid || busy) return;
            onSave(
              { name, activeFrom: activeFrom!, style, notes, activityTypes: [BIKE_ACTIVITY_ID] },
              asDefault,
              gear?.id,
            );
          }}
          disabled={!valid || busy}
          style={({ pressed }) => [styles.cta, (!valid || busy) && styles.ctaOff, pressed && styles.pressed]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={styles.ctaText}>{gear ? 'Salvar' : 'Adicionar'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    pressed: { opacity: 0.7 },
    flex: { flex: 1 },
    form: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      ...shadows.card,
    },
    title: { fontSize: 16, fontFamily: fonts.sansBold, color: colors.ink, marginBottom: 2 },
    label: {
      fontSize: 10.5,
      fontFamily: fonts.sansSemiBold,
      color: colors.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginTop: spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: 14,
      fontFamily: fonts.sans,
      color: colors.ink,
      backgroundColor: colors.bg,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.bg,
    },
    chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    chipTextOn: { color: colors.bgPure },

    switchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.md },
    switchTitle: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink },
    switchSub: { fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: 2 },

    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    ghost: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 11,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.line,
    },
    ghostText: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    cta: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    ctaOff: { opacity: 0.45 },
    ctaText: { fontSize: 13.5, fontFamily: fonts.sansBold, color: colors.onPrimary },
  });
