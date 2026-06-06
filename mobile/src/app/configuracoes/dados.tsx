import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radii, shadows, useThemedStyles } from '../../theme';

export default function DadosScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const exportData = () => {
    Alert.alert('Em breve', 'A exportação de dados estará disponível em uma próxima versão.');
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

      <View style={styles.content}>
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
      </View>
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
});
