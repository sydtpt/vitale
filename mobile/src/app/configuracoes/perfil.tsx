import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '../../store/settings.store';
import { colors, spacing, radii, useThemedStyles } from '../../theme';

export default function PerfilScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, preferences, loadSettings, updateProfile } = useSettingsStore();

  const [name, setName] = useState(profile?.displayName ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile && !preferences) loadSettings();
  }, []);

  useEffect(() => {
    setName(profile?.displayName ?? '');
  }, [profile?.displayName]);

  const save = async () => {
    setSaving(true);
    await updateProfile({ displayName: name.trim() || undefined });
    setSaving(false);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Perfil</Text>
          <Pressable onPress={save} hitSlop={12} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}>
            {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.saveTxt}>Salvar</Text>}
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>Nome de exibição</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Seu nome"
            placeholderTextColor={colors.ink3}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <Text style={styles.hint}>Aparece no app como identificação pessoal.</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.ink },
  saveBtn: { paddingHorizontal: spacing.sm },
  saveTxt: { fontSize: 15, fontWeight: '600', color: colors.primary },
  pressed: { opacity: 0.6 },
  content: { padding: spacing.lg, gap: spacing.sm },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink2, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hint: { fontSize: 13, color: colors.ink3 },
});
