import React, { useState, useMemo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from '../../theme';
import { CheckButton } from '../../components/ui/CheckButton';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { HOJE, COMPRAS_RECORR } from '../../services/mock-data';

export default function ComprasScreen() {
  const [compras, setCompras] = useState(HOJE.compras);
  const done = compras.filter(c => c.done).length;

  const toggle = (id: string) => setCompras(arr => arr.map(c => c.id === id ? { ...c, done: !c.done } : c));

  const groups = useMemo(() => {
    const buckets: Record<string, typeof compras> = {};
    for (const c of compras) (buckets[c.cat] ??= []).push(c);
    return Object.entries(buckets).map(([cat, items]) => ({ cat, items }));
  }, [compras]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.greet}>
        <Text style={styles.eyebrow}>LISTA DA SEMANA</Text>
        <Text style={styles.title}>Mercado</Text>
        <Text style={styles.sub}>{done} de {compras.length} comprados · R$ 89,40 estimados</Text>
      </View>

      {/* Recurring suggestions */}
      <View style={styles.recurr}>
        <View style={styles.recTop}>
          <Text style={styles.recLabel}>SUGESTÕES RECORRENTES</Text>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
        </View>
        <View style={styles.recChips}>
          {COMPRAS_RECORR.slice(0, 3).map(r => (
            <View key={r.name} style={styles.chip}>
              <Text style={styles.chipName}>{r.name}</Text>
              <Text style={[styles.chipDue, r.due === 'atrasado' && styles.chipLate]}>{r.due}</Text>
              <Ionicons name="add" size={13} color={colors.primary} />
            </View>
          ))}
        </View>
      </View>

      {/* Grouped shopping list */}
      {groups.map(g => (
        <View key={g.cat}>
          <SectionLabel>{g.cat}</SectionLabel>
          <View style={styles.card}>
            {g.items.map((c, i) => (
              <Pressable key={c.id} style={[styles.row, i === g.items.length - 1 && styles.noBorder]}
                onPress={() => toggle(c.id)}>
                <CheckButton checked={c.done} small />
                <View style={styles.flex}>
                  <Text style={[styles.itemName, c.done && styles.strike, c.done && styles.muted]}>{c.name}</Text>
                </View>
                <Text style={styles.qty}>{c.qty}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: 54 },
  greet: { paddingVertical: spacing.lg },
  eyebrow: { fontSize: 13, color: colors.ink3, letterSpacing: 0.4, fontWeight: '600' },
  title: { fontFamily: 'InstrumentSerif', fontSize: 32, marginTop: 4, color: colors.ink },
  sub: { fontSize: 14, color: colors.ink2, marginTop: 2 },

  recurr: { backgroundColor: colors.surfaceWarm, borderRadius: 16, padding: 14, marginBottom: 12 },
  recTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recLabel: { fontSize: 12.5, fontWeight: '600', color: colors.ink, letterSpacing: 0.3 },
  recChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.line },
  chipName: { fontSize: 12.5, color: colors.ink },
  chipDue: { fontSize: 11, fontWeight: '600', color: colors.ink3 },
  chipLate: { color: colors.primary },

  card: { backgroundColor: colors.surface, borderRadius: 18, marginTop: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  noBorder: { borderBottomWidth: 0 },
  flex: { flex: 1 },
  itemName: { fontSize: 14.5, fontWeight: '500', color: colors.ink },
  strike: { textDecorationLine: 'line-through' },
  muted: { color: colors.ink3 },
  qty: { fontSize: 12, color: colors.ink2, fontFamily: 'GeistMono' },
});
