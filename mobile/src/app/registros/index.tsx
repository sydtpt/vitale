import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Registro, TodoModule } from '@vitale/shared';
import { useRegistrosStore } from '../../store/registros.store';
import { useAuthStore } from '../../store/auth.store';
import { habitIconToIonicon } from '../../lib/habit-icons';
import { colors, fonts, moduleColors, radii, shadows, spacing, useThemedStyles } from '../../theme';

const MODULE_LABEL: Record<TodoModule, string> = {
  geral: 'Geral',
  casa: 'Casa',
  financas: 'Finanças',
  compras: 'Compras',
  saude: 'Saúde',
};

export default function RegistrosScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const registros = useRegistrosStore((s) => s.registros);
  const todayMarks = useRegistrosStore((s) => s.todayMarks);
  const loading = useRegistrosStore((s) => s.loading);
  const load = useRegistrosStore((s) => s.load);
  const toggleToday = useRegistrosStore((s) => s.toggleToday);
  const archiveRegistro = useRegistrosStore((s) => s.archiveRegistro);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  const active = registros.filter((r) => r.active);
  const archived = registros.filter((r) => !r.active);

  const Row = ({ r, last }: { r: Registro; last?: boolean }) => {
    const mod = moduleColors(r.color, 'habito');
    const done = !!todayMarks[r.id];
    return (
      <View style={[styles.row, last && styles.noBorder]}>
        {/* Detalhe, não editor (SPEC-registros CAP-5): a leitura é o gesto
            principal; editar fica no lápis do header do detalhe. Arquivado
            também navega — o histórico preservado é promessa de CAP-3. */}
        <Pressable
          onPress={() => router.push({ pathname: '/registros/detalhe', params: { id: r.id } })}
          style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
        >
          <View style={[styles.iconBox, { backgroundColor: mod.tint }]}>
            <Ionicons name={habitIconToIonicon(r.icon)} size={20} color={mod.onTint} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.name, !r.active && styles.muted]}>{r.name}</Text>
            <Text style={styles.summary}>{MODULE_LABEL[r.module] ?? 'Geral'}</Text>
          </View>
        </Pressable>

        {r.active ? (
          <View style={styles.rowActions}>
            <Pressable
              onPress={() => toggleToday(r.id)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.markBtn,
                done ? { backgroundColor: mod.accent, borderColor: mod.accent } : { borderColor: mod.accent },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="checkmark" size={16} color={done ? '#fff' : mod.accent} />
              <Text style={[styles.markText, { color: done ? '#fff' : mod.accent }]}>{done ? 'Feito' : 'Marcar'}</Text>
            </Pressable>
            <Pressable
              onPress={() => archiveRegistro(r.id, false)}
              hitSlop={8}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Ionicons name="archive-outline" size={19} color={colors.ink3} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => archiveRegistro(r.id, true)}
            hitSlop={10}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-undo-outline" size={20} color={colors.ink3} />
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Registros</Text>
        <Pressable onPress={() => router.push('/registros/dia')} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="calendar-outline" size={20} color={colors.ink} />
        </Pressable>
        <Pressable onPress={() => router.push('/registros/editor')} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="add" size={24} color={colors.ink} />
        </Pressable>
      </View>

      {loading && registros.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : registros.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bookmark-outline" size={40} color={colors.ink4} />
          <Text style={styles.emptyTitle}>Nenhum registro ainda</Text>
          <Text style={styles.emptyText}>Crie itens livres (Pizza, Dentista…) e marque quando acontecerem.</Text>
          <Pressable onPress={() => router.push('/registros/editor')} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <Ionicons name="add" size={18} color={colors.onPrimary} />
            <Text style={styles.ctaText}>Novo registro</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {active.length > 0 && (
            <>
              <Text style={styles.section}>Ativos</Text>
              <View style={styles.card}>
                {active.map((r, i) => (
                  <Row key={r.id} r={r} last={i === active.length - 1} />
                ))}
              </View>
            </>
          )}
          {archived.length > 0 && (
            <>
              <Text style={styles.section}>Arquivados</Text>
              <View style={styles.card}>
                {archived.map((r, i) => (
                  <Row key={r.id} r={r} last={i === archived.length - 1} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  pressed: { opacity: 0.7 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: fonts.serif, color: colors.ink },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  section: {
    fontSize: 12.5,
    fontFamily: fonts.sansBold,
    color: colors.ink2,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  card: { backgroundColor: colors.surface, borderRadius: radii['2xl'], overflow: 'hidden', ...shadows.card },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  noBorder: { borderBottomWidth: 0 },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  name: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
  muted: { color: colors.ink3 },
  summary: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: 2 },

  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  markText: { fontSize: 13, fontFamily: fonts.sansBold },
  action: { width: 34, height: 34, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { fontSize: 16, fontFamily: fonts.sansBold, color: colors.ink, marginTop: spacing.sm },
  emptyText: { fontSize: 13.5, fontFamily: fonts.sans, color: colors.ink3, textAlign: 'center', lineHeight: 19 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: radii.pill, marginTop: spacing.md },
  ctaText: { color: colors.onPrimary, fontSize: 14.5, fontFamily: fonts.sansBold },
});
