import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import {
  MEAL_TYPES, MEAL_TYPE_LABELS, FINANCA_CATS, type MealType,
} from '@vitale/shared';
import { colors, shadows } from '../../theme';
import { useMealsStore } from '../../store/meals.store';
import { useTransactionsStore } from '../../store/transactions.store';

type SheetKind = 'pick' | 'food' | 'gasto';

interface QuickAddSheetProps {
  visible: boolean;
  initial?: SheetKind;
  onClose: () => void;
}

type Option = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  color: string;
  kind?: SheetKind;   // alterna o formulário interno
  route?: Href;       // deep-link: fecha e navega
};

const OPTIONS: Option[] = [
  { kind: 'food',  icon: 'restaurant-outline',       label: 'Refeição', sub: 'Logar comida e macros', color: colors.yellow },
  { kind: 'gasto', icon: 'wallet-outline',           label: 'Gasto',    sub: 'Lançar despesa',        color: colors.ink },
  { route: '/tarefas',        icon: 'checkmark-done-outline', label: 'Tarefa', sub: 'Ver e concluir',   color: colors.teal },
  { route: '/treinos/editor', icon: 'barbell-outline',        label: 'Treino', sub: 'Planejar treino', color: colors.primary },
];

const FOOD_SUGGESTIONS = ['Whey + banana', 'Castanhas (30g)', 'Pão integral + ovo'];

/** Tipo de refeição sugerido pelo horário atual. */
function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'cafe';
  if (h < 15) return 'almoco';
  if (h < 18) return 'lanche';
  return 'jantar';
}

/** "12,50" / "12.50" / "1200" → número em reais (NaN se vazio/inválido). */
function parseAmount(raw: string): number {
  return Number(raw.replace(',', '.').replace(/[^\d.]/g, ''));
}

export function QuickAddSheet({ visible, initial = 'pick', onClose }: QuickAddSheetProps) {
  const router = useRouter();
  const createMeal = useMealsStore((s) => s.createMeal);
  const createTransaction = useTransactionsStore((s) => s.createTransaction);

  const [kind, setKind] = useState<SheetKind>(initial);
  const [saving, setSaving] = useState(false);

  // Refeição
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [foodName, setFoodName] = useState('');
  const [kcal, setKcal] = useState('');

  // Gasto
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('');

  // Reinicia os campos toda vez que o sheet abre (fica montado no layout).
  useEffect(() => {
    if (!visible) return;
    setKind(initial);
    setSaving(false);
    setMealType(defaultMealType());
    setFoodName('');
    setKcal('');
    setAmount('');
    setDesc('');
    setCat('');
  }, [visible, initial]);

  const onTile = (o: Option) => {
    if (o.route) { onClose(); router.push(o.route); return; }
    if (o.kind) setKind(o.kind);
  };

  const amountValue = parseAmount(amount);
  const canSaveFood = foodName.trim().length > 0;
  const canSaveGasto = amountValue > 0 && desc.trim().length > 0;

  const saveFood = async () => {
    if (!canSaveFood || saving) return;
    setSaving(true);
    const kcalNum = kcal.trim() ? Number(kcal.replace(',', '.')) : NaN;
    const ok = await createMeal({
      mealType,
      name: foodName,
      kcal: Number.isFinite(kcalNum) ? Math.round(kcalNum) : undefined,
    });
    setSaving(false);
    if (!ok) { Alert.alert('Erro', 'Não foi possível salvar a refeição.'); return; }
    onClose();
  };

  const saveGasto = async () => {
    if (!canSaveGasto || saving) return;
    setSaving(true);
    const ok = await createTransaction({
      amount: amountValue,
      description: desc,
      category: cat,
    });
    setSaving(false);
    if (!ok) { Alert.alert('Erro', 'Não foi possível salvar o gasto.'); return; }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          {kind === 'pick' && (
            <>
              <Text style={styles.title}>Registrar</Text>
              <Text style={styles.hint}>O que você quer marcar agora?</Text>
              <View style={styles.grid}>
                {OPTIONS.map((o) => (
                  <Pressable key={o.label} style={styles.opt} onPress={() => onTile(o)}>
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
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text style={styles.ghost}>Cancelar</Text>
                </Pressable>
                <Text style={styles.barTitle}>Nova refeição</Text>
                <Pressable
                  style={[styles.saveBtn, (!canSaveFood || saving) && styles.saveBtnOff]}
                  onPress={saveFood}
                  disabled={!canSaveFood || saving}
                >
                  <Text style={styles.saveTxt}>{saving ? '…' : 'Salvar'}</Text>
                </Pressable>
              </View>

              <View style={styles.chips}>
                {MEAL_TYPES.map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.chip, mealType === t && styles.chipOn]}
                    onPress={() => setMealType(t)}
                  >
                    <Text style={[styles.chipTxt, mealType === t && styles.chipTxtOn]}>
                      {MEAL_TYPE_LABELS[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>O QUE VOCÊ COMEU?</Text>
                <TextInput
                  style={styles.input}
                  value={foodName}
                  onChangeText={setFoodName}
                  placeholder="Digite aqui…"
                  placeholderTextColor={colors.ink3}
                  autoFocus
                  returnKeyType="done"
                />
              </View>

              <View style={styles.suggestions}>
                {FOOD_SUGGESTIONS.map((s) => (
                  <Pressable key={s} style={styles.suggest} onPress={() => setFoodName(s)}>
                    <Text style={styles.suggestTxt}>{s}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.field, styles.fieldRow]}>
                <Text style={styles.fieldLabel}>KCAL (OPCIONAL)</Text>
                <TextInput
                  style={styles.inputInline}
                  value={kcal}
                  onChangeText={setKcal}
                  placeholder="—"
                  placeholderTextColor={colors.ink3}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
            </>
          )}

          {kind === 'gasto' && (
            <>
              <View style={styles.bar}>
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text style={styles.ghost}>Cancelar</Text>
                </Pressable>
                <Text style={styles.barTitle}>Novo gasto</Text>
                <Pressable
                  style={[styles.saveBtn, (!canSaveGasto || saving) && styles.saveBtnOff]}
                  onPress={saveGasto}
                  disabled={!canSaveGasto || saving}
                >
                  <Text style={styles.saveTxt}>{saving ? '…' : 'Salvar'}</Text>
                </Pressable>
              </View>

              <View style={styles.amountWrap}>
                <Text style={styles.amountCur}>R$ </Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0,00"
                  placeholderTextColor={colors.ink4}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>

              <View style={styles.fields}>
                <View style={styles.frow}>
                  <Text style={styles.frowLabel}>Descrição</Text>
                  <TextInput
                    style={styles.frowInput}
                    value={desc}
                    onChangeText={setDesc}
                    placeholder="Ex: Almoço, Uber…"
                    placeholderTextColor={colors.ink3}
                    returnKeyType="done"
                  />
                </View>
              </View>

              <Text style={styles.catLabel}>Categoria</Text>
              <View style={styles.chips}>
                {FINANCA_CATS.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.chip, cat === c && styles.chipOn]}
                    onPress={() => setCat(c)}
                  >
                    <Text style={[styles.chipTxt, cat === c && styles.chipTxtOn]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(31,27,22,0.45)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 36,
    maxHeight: '82%',
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
  saveBtnOff: { opacity: 0.4 },
  saveTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: colors.surface, borderRadius: 999,
    borderWidth: 1, borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 13, fontWeight: '500', color: colors.ink2 },
  chipTxtOn: { color: '#fff' },

  field: {
    marginTop: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 14, ...shadows.card,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 12, color: colors.ink3, letterSpacing: 0.3, fontWeight: '600',
  },
  input: {
    marginTop: 6, fontSize: 16, color: colors.ink,
    borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 8,
  },
  inputInline: {
    fontSize: 16, color: colors.ink, minWidth: 80, textAlign: 'right',
  },

  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  suggest: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.surfaceWarm, borderRadius: 999,
  },
  suggestTxt: { fontSize: 13, fontWeight: '500', color: colors.ink },

  amountWrap: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center',
    marginTop: 18,
  },
  amountCur: { fontSize: 22, color: colors.ink3, fontFamily: 'InstrumentSerif' },
  amountInput: {
    fontFamily: 'InstrumentSerif', fontSize: 56, color: colors.ink,
    minWidth: 140, textAlign: 'center', padding: 0,
  },

  fields: {
    marginTop: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 10, ...shadows.card,
  },
  frow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  frowLabel: { fontSize: 12.5, color: colors.ink2, fontWeight: '500' },
  frowInput: { flex: 1, marginLeft: 12, fontSize: 14, color: colors.ink, textAlign: 'right' },

  catLabel: {
    fontSize: 12, color: colors.ink3, letterSpacing: 0.3, fontWeight: '600',
    marginTop: 18, marginLeft: 2,
  },
});
