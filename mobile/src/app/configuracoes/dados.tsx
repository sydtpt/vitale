import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radii, shadows, useThemedStyles } from '../../theme';
import {
  clearBreadcrumbs,
  readBreadcrumbs,
  type Breadcrumb,
} from '../../lib/sync-breadcrumbs';

/** Dia + hora local. O dia importa: as migalhas atravessam o app fechado. */
function formatarMomento(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date().toDateString() === d.toDateString();
  const hora = d.toLocaleTimeString('pt-BR', { hour12: false });
  return hoje ? hora : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`;
}

export default function DadosScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [migalhas, setMigalhas] = useState<Breadcrumb[]>([]);

  const carregar = useCallback(() => {
    void readBreadcrumbs().then(setMigalhas);
  }, []);

  useEffect(carregar, [carregar]);

  const exportData = () => {
    Alert.alert('Em breve', 'A exportação de dados estará disponível em uma próxima versão.');
  };

  const limpar = () => {
    Alert.alert('Limpar diagnóstico', 'Apaga o log local de sincronização.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar',
        style: 'destructive',
        onPress: () => void clearBreadcrumbs().then(carregar),
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Dados</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Exportar</Text>
        <View style={styles.card}>
          <Pressable onPress={exportData} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Ionicons name="download-outline" size={20} color={colors.ink2} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Exportar todos os dados</Text>
              <Text style={styles.rowSub}>Gera um arquivo JSON com seus registros</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={colors.ink3} />
          </Pressable>
        </View>

        <View style={styles.diagHeader}>
          <Text style={styles.sectionTitle}>Diagnóstico de sync</Text>
          <View style={styles.diagActions}>
            <Pressable onPress={carregar} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
              <Ionicons name="refresh-outline" size={17} color={colors.ink3} />
            </Pressable>
            <Pressable onPress={limpar} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
              <Ionicons name="trash-outline" size={17} color={colors.ink3} />
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          {migalhas.length === 0 ? (
            <Text style={styles.vazio}>Nenhum registro ainda.</Text>
          ) : (
            migalhas.map((m, i) => (
              <View key={`${m.at}-${i}`} style={styles.migalha}>
                <Text style={styles.migalhaHora}>{formatarMomento(m.at)}</Text>
                <Text style={styles.migalhaEvento}>{m.event}</Text>
                {m.detail ? <Text style={styles.migalhaDetalhe}>{m.detail}</Text> : null}
              </View>
            ))
          )}
        </View>
        <Text style={styles.diagNota}>
          `app-launch` sem `sync-start` significa que o app acordou mas parou antes de
          sincronizar. Nenhuma migalha nova enquanto o app esteve fechado significa que o
          iOS nunca o acordou.
        </Text>
      </ScrollView>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.ink },
  pressed: { opacity: 0.6 },
  content: { padding: spacing.lg },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.ink2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, paddingHorizontal: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden', ...shadows.card },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, gap: 12 },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, color: colors.ink },
  rowSub: { fontSize: 13, color: colors.ink3 },

  diagHeader: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl },
  diagActions: { flexDirection: 'row', gap: spacing.md, marginLeft: 'auto', marginBottom: spacing.sm },
  vazio: { fontSize: 14, color: colors.ink3, padding: spacing.lg },
  migalha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
  },
  migalhaHora: { fontSize: 12, color: colors.ink3, fontFamily: 'GeistMono' },
  migalhaEvento: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  migalhaDetalhe: { fontSize: 12, color: colors.ink3, fontFamily: 'GeistMono', flexShrink: 1 },
  diagNota: {
    fontSize: 12,
    color: colors.ink3,
    lineHeight: 18,
    paddingHorizontal: 4,
    marginTop: spacing.sm,
  },
});
