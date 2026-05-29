import React, { useEffect } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_STYLES, type MapStyle } from '@vitale/shared';
import { useSettingsStore } from '../../store/settings.store';
import { colors, spacing, radii, useThemedStyles } from '../../theme';

const MAP_STYLE_ORDER: MapStyle[] = ['voyager', 'positron', 'osm'];

export default function AppSettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preferences, loadSettings, updatePreferences } = useSettingsStore();

  useEffect(() => {
    if (!preferences) loadSettings();
  }, []);

  const theme = preferences?.theme ?? 'system';
  const glass = preferences?.glassEnabled ?? false;
  const notifs = preferences?.notificationsEnabled ?? true;
  const mapStyle = preferences?.mapStyle ?? 'voyager';
  const darkMode = theme === 'dark';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Aparência</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Appearance section */}
        <Text style={styles.sectionTitle}>Aparência</Text>
        <View style={styles.card}>
          {/* Dark Mode */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={[styles.iconWrap, { backgroundColor: '#6E6CE8' }]}>
              <Ionicons name="moon" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>Modo Escuro</Text>
            <Switch
              value={darkMode}
              onValueChange={(v) => updatePreferences({ theme: v ? 'dark' : 'light' })}
              trackColor={{ true: colors.primary, false: colors.line }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.line}
            />
          </View>

          {/* System theme */}
          <Pressable
            onPress={() => updatePreferences({ theme: 'system' })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#9B9B9B' }]}>
              <Ionicons name="phone-portrait-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>Usar tema do sistema</Text>
            <View style={styles.rowRight}>
              {theme === 'system' && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </View>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Visual</Text>
        <View style={styles.card}>
          {/* Glass effect */}
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: '#5BAFDA' }]}>
              <Ionicons name="partly-sunny-outline" size={15} color="#fff" />
            </View>
            <View style={styles.rowMeta}>
              <Text style={styles.rowLabel}>Glass</Text>
              <Text style={styles.rowSub}>Efeito translúcido nos cards</Text>
            </View>
            <Switch
              value={glass}
              onValueChange={(v) => updatePreferences({ glassEnabled: v })}
              trackColor={{ true: colors.primary, false: colors.line }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.line}
            />
          </View>
        </View>

        {/* Map style section */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Mapa</Text>
        <View style={styles.card}>
          {MAP_STYLE_ORDER.map((style, i) => (
            <Pressable
              key={style}
              onPress={() => updatePreferences({ mapStyle: style })}
              style={({ pressed }) => [
                styles.row,
                i < MAP_STYLE_ORDER.length - 1 && styles.rowBorder,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#6FA86A' }]}>
                <Ionicons name="map-outline" size={15} color="#fff" />
              </View>
              <Text style={styles.rowLabel}>{MAP_STYLES[style].label}</Text>
              <View style={styles.rowRight}>
                {mapStyle === style && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </View>
            </Pressable>
          ))}
        </View>

        {/* Notifications section */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Notificações</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: '#F25C2B' }]}>
              <Ionicons name="notifications-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>Ativar notificações</Text>
            <Switch
              value={notifs}
              onValueChange={(v) => updatePreferences({ notificationsEnabled: v })}
              trackColor={{ true: colors.primary, false: colors.line }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.line}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.ink },
  pressed: { opacity: 0.6 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['4xl'] },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    gap: 12,
    minHeight: 52,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowLabel: { flex: 1, fontSize: 15, color: colors.ink },
  rowMeta: { flex: 1, gap: 2 },
  rowSub: { fontSize: 12, color: colors.ink3 },
  rowRight: { width: 22, alignItems: 'center' },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
