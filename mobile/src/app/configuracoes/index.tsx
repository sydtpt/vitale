import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/auth.store';
import { useSettingsStore } from '../../store/settings.store';
import { useChartPaletteStore } from '../../store/chart-palette.store';
import { getChartPalette } from '../../lib/chart-palettes';
import { colors, spacing, radii, shadows, useThemedStyles } from '../../theme';

const RED = '#E05C5C';

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  route?: string;
  onPress?: () => void;
  destructive?: boolean;
};

type Section = { title: string; rows: Row[] };

export default function ConfiguracoesScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuthStore();
  const profile = useSettingsStore((s) => s.profile);
  const preferences = useSettingsStore((s) => s.preferences);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const chartPaletteId = useChartPaletteStore((s) => s.paletteId);

  useEffect(() => {
    if (!profile) loadSettings();
  }, []);

  const themeLabel = preferences?.theme === 'dark' ? 'Escuro' : preferences?.theme === 'light' ? 'Claro' : 'Sistema';
  const glassLabel = preferences?.glassEnabled ? ' · Glass' : '';
  const appearanceSub = themeLabel + glassLabel;
  const notifSub = (preferences?.notificationsEnabled ?? true) ? 'Ativas' : 'Desativadas';

  const sections: Section[] = [
    {
      title: 'Conta',
      rows: [
        { icon: 'person-outline', label: 'Perfil', sub: profile?.displayName ?? 'Definir nome', route: '/configuracoes/perfil' },
        { icon: 'log-out-outline', label: 'Sair', destructive: true, onPress: signOut },
      ],
    },
    {
      title: 'App',
      rows: [
        { icon: 'color-palette-outline', label: 'Aparência', sub: appearanceSub, route: '/configuracoes/app' },
        { icon: 'notifications-outline', label: 'Notificações', sub: notifSub, route: '/configuracoes/notificacoes' },
        { icon: 'color-filter-outline', label: 'Cores dos gráficos', sub: getChartPalette(chartPaletteId).name, route: '/configuracoes/paleta' },
        { icon: 'trophy-outline', label: 'Objetivos', sub: 'Macros e treino', route: '/configuracoes/objetivos' },
      ],
    },
    {
      title: 'Dados',
      rows: [
        { icon: 'link-outline', label: 'Conexões', sub: 'Strava · intervals.icu · Apple Health', route: '/configuracoes/conexoes' },
        { icon: 'download-outline', label: 'Exportar dados', route: '/configuracoes/dados' },
      ],
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Configurações</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.rows.map((row, i) => (
                <Pressable
                  key={row.label}
                  onPress={row.route ? () => router.push(row.route as never) : row.onPress}
                  style={({ pressed }) => [
                    styles.row,
                    i < section.rows.length - 1 && styles.rowBorder,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.rowIcon}>
                    <Ionicons name={row.icon} size={18} color={row.destructive ? RED : colors.ink2} />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowLabel, row.destructive && styles.destructive]}>{row.label}</Text>
                    {row.sub ? <Text style={styles.rowSub}>{row.sub}</Text> : null}
                  </View>
                  {row.route ? <Ionicons name="chevron-forward" size={15} color={colors.ink3} /> : null}
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.version}>Orbe</Text>
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
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.ink2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, paddingHorizontal: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden', ...shadows.card },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowIcon: { width: 28, alignItems: 'center' },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, color: colors.ink },
  rowSub: { fontSize: 13, color: colors.ink3 },
  destructive: { color: RED },
  version: { textAlign: 'center', fontSize: 13, color: colors.ink3, marginTop: spacing.xl },
});
