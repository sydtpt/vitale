import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, shadows } from '../../theme';

type SheetKind = 'pick' | 'food' | 'gasto';

interface QuickAddSheetProps {
  visible: boolean;
  initial?: SheetKind;
  onClose: () => void;
}

const OPTIONS = [
  { k: 'food' as SheetKind, icon: 'restaurant-outline' as const, label: 'Refeição', sub: 'Logar comida e macros', color: colors.yellow },
  { k: 'gasto' as SheetKind, icon: 'wallet-outline' as const, label: 'Gasto', sub: 'Lançar despesa', color: colors.ink },
  { k: 'food' as SheetKind, icon: 'checkmark-circle-outline' as const, label: 'Hábito', sub: 'Marcar concluído', color: colors.green },
  { k: 'food' as SheetKind, icon: 'barbell-outline' as const, label: 'Treino', sub: 'Iniciar sessão', color: colors.primary },
];

export function QuickAddSheet({ visible, initial = 'pick', onClose }: QuickAddSheetProps) {
  const [kind, setKind] = useState<SheetKind>(initial);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          {kind === 'pick' && (
            <>
              <Text style={styles.title}>Registrar</Text>
              <Text style={styles.hint}>O que você quer marcar agora?</Text>
              <View style={styles.grid}>
                {OPTIONS.map((o, i) => (
                  <Pressable key={i} style={styles.opt} onPress={() => setKind(o.k)}>
                    <View style={[styles.ico, { backgroundColor: o.color + '22' }]}>
                      <Ionicons name={o.icon} size={18} color={o.color} />
                    </View>
                    <Text style={styles.optTitle}>{o.label}</Text>
                    <Text style={styles.optSub}>{o.sub}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {kind === 'food' && (
            <>
              <View style={styles.bar}>
                <Pressable onPress={onClose}>
                  <Text style={styles.ghost}>Cancelar</Text>
                </Pressable>
                <Text style={styles.barTitle}>Lanche da tarde</Text>
                <Pressable style={styles.saveBtn}>
                  <Text style={styles.saveTxt}>Salvar</Text>
                </Pressable>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>O QUE VOCÊ COMEU?</Text>
                <Text style={styles.fieldPlaceholder}>Digite ou use voz…</Text>
              </View>
              <View style={styles.suggestions}>
                {['Whey + banana', 'Castanhas (30g)', 'Pão integral + ovo'].map(s => (
                  <View key={s} style={styles.suggest}>
                    <Text style={styles.suggestTxt}>{s}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {kind === 'gasto' && (
            <>
              <View style={styles.bar}>
                <Pressable onPress={onClose}>
                  <Text style={styles.ghost}>Cancelar</Text>
                </Pressable>
                <Text style={styles.barTitle}>Novo gasto</Text>
                <Pressable style={styles.saveBtn}>
                  <Text style={styles.saveTxt}>Salvar</Text>
                </Pressable>
              </View>
              <Text style={styles.amount}>
                <Text style={styles.amountCur}>R$ </Text>0<Text style={styles.amountCents}>,00</Text>
              </Text>
              <View style={styles.fields}>
                <View style={styles.frow}>
                  <Text style={styles.frowLabel}>Descrição</Text>
                  <Text style={styles.frowValue}>Ex: Almoço, Uber…</Text>
                </View>
                <View style={styles.frow}>
                  <Text style={styles.frowLabel}>Categoria</Text>
                  <Text style={styles.frowValue}>Escolher</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(31,27,22,0.45)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 36,
    maxHeight: '78%',
  },
  grabber: {
    width: 40, height: 4, backgroundColor: colors.ink4,
    borderRadius: 2, alignSelf: 'center', marginBottom: 10,
  },
  title: { fontFamily: 'InstrumentSerif', fontSize: 28, color: colors.ink, marginVertical: 4 },
  hint: { fontSize: 13, color: colors.ink2, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  opt: {
    width: '48%', backgroundColor: colors.surface, borderRadius: 16,
    padding: 14, gap: 6, ...shadows.card,
  },
  ico: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  optTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  optSub: { fontSize: 11.5, color: colors.ink3 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ghost: { fontSize: 14, color: colors.ink2 },
  barTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  saveTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },
  field: {
    marginTop: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 14, ...shadows.card,
  },
  fieldLabel: {
    fontSize: 12, color: colors.ink3, letterSpacing: 0.3, fontWeight: '600',
  },
  fieldPlaceholder: {
    marginTop: 6, fontSize: 16, color: colors.ink3,
    borderBottomWidth: 1, borderBottomColor: colors.line,
    borderStyle: 'dashed', paddingBottom: 8,
  },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  suggest: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.surfaceWarm, borderRadius: 999,
  },
  suggestTxt: { fontSize: 13, fontWeight: '500', color: colors.ink },
  amount: {
    fontFamily: 'InstrumentSerif', fontSize: 56, textAlign: 'center',
    marginTop: 18, color: colors.ink,
  },
  amountCur: { fontSize: 22, color: colors.ink3 },
  amountCents: { color: colors.ink3 },
  fields: {
    marginTop: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 10, ...shadows.card,
  },
  frow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 8,
  },
  frowLabel: { fontSize: 12.5, color: colors.ink2, fontWeight: '500' },
  frowValue: { fontSize: 14, color: colors.ink3 },
});
