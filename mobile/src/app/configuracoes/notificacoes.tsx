import React, { useEffect } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
  type RetroSchedule,
} from '@vitale/shared';
import { useSettingsStore } from '../../store/settings.store';
import { enableNotifications } from '../../services/notifications';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';

const REMINDER_TIMES = ['07:00', '08:00', '09:00', '20:00', '21:00'];
const RETRO_TIMES = ['07:00', '08:00', '09:00', '10:00', '20:00', '21:00'];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_DAYS = [1, 5, 10, 15, 20, 25, 28];

const fmt = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const parse = (s: string): { hour: number; minute: number } => {
  const [h, m] = s.split(':').map(Number);
  return { hour: h, minute: m };
};

type RetroKey = 'weeklyRetro' | 'monthlyRetro' | 'yearlyRetro';

export default function NotificacoesScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preferences, loadSettings, updatePreferences } = useSettingsStore();

  useEffect(() => {
    if (!preferences) loadSettings();
  }, []);

  const master = preferences?.notificationsEnabled ?? true;
  const reminderTime = preferences?.dailyReminderTime ?? '08:00';
  const notif = preferences?.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS;

  // Salvar já reagenda: o serviço observa as prefs e refaz os agendamentos.
  const setNotif = (patch: Partial<NotificationPrefs>) =>
    updatePreferences({ notificationPrefs: { ...notif, ...patch } });
  const setSchedule = (key: RetroKey, patch: Partial<RetroSchedule>) =>
    setNotif({ [key]: { ...notif[key], ...patch } } as Partial<NotificationPrefs>);

  const toggleMaster = async (v: boolean) => {
    await updatePreferences({ notificationsEnabled: v });
    if (!v) return;
    // Já negado no sistema: o iOS não reexibe o prompt, então o único caminho
    // são os Ajustes — sem isso o switch fica ligado e nada chega.
    const granted = await enableNotifications();
    if (granted) return;
    Alert.alert(
      'Notificações bloqueadas',
      'O Orbe não tem permissão para enviar notificações. Ative-as nos Ajustes do sistema.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Abrir Ajustes', onPress: () => void Linking.openSettings() },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Notificações</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Master */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: '#F25C2B' }]}>
              <Ionicons name="notifications-outline" size={15} color="#fff" />
            </View>
            <View style={styles.rowMeta}>
              <Text style={styles.rowLabel}>Notificações</Text>
              <Text style={styles.rowSub}>Ativa os lembretes locais do app</Text>
            </View>
            <Switch
              value={master}
              onValueChange={toggleMaster}
              trackColor={{ true: colors.primary, false: colors.line }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.line}
            />
          </View>
        </View>

        {master && (
          <>
            {/* Diárias / eventos */}
            <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>No dia a dia</Text>
            <View style={styles.card}>
              {/* Digest diário */}
              <View style={[styles.row, styles.rowBorder]}>
                <View style={[styles.iconWrap, { backgroundColor: '#6E8CC9' }]}>
                  <Ionicons name="sunny-outline" size={15} color="#fff" />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowLabel}>Digest diário</Text>
                  <Text style={styles.rowSub}>Prontidão, treino, tarefas e hábitos num lembrete só</Text>
                </View>
                <Switch
                  value={notif.dailyDigest}
                  onValueChange={(v) => setNotif({ dailyDigest: v })}
                  trackColor={{ true: colors.primary, false: colors.line }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.line}
                />
              </View>
              {notif.dailyDigest && (
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>Horário</Text>
                  <View style={styles.timeChips}>
                    {REMINDER_TIMES.map((t) => {
                      const on = reminderTime === t;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => void updatePreferences({ dailyReminderTime: t })}
                          style={[styles.timeChip, on && styles.timeChipOn]}
                        >
                          <Text style={[styles.timeChipTxt, on && styles.timeChipTxtOn]}>{t}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Tarefas com hora */}
              <View style={[styles.row, styles.rowBorder]}>
                <View style={[styles.iconWrap, { backgroundColor: '#E26A8A' }]}>
                  <Ionicons name="alarm-outline" size={15} color="#fff" />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowLabel}>Tarefas com hora</Text>
                  <Text style={styles.rowSub}>Um lembrete na hora marcada de cada tarefa</Text>
                </View>
                <Switch
                  value={notif.taskReminders}
                  onValueChange={(v) => setNotif({ taskReminders: v })}
                  trackColor={{ true: colors.primary, false: colors.line }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.line}
                />
              </View>

              {/* Atividades sincronizadas */}
              <View style={[styles.row, styles.rowBorder]}>
                <View style={[styles.iconWrap, { backgroundColor: '#6FA86A' }]}>
                  <Ionicons name="sync-outline" size={15} color="#fff" />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowLabel}>Atividades sincronizadas</Text>
                  <Text style={styles.rowSub}>Avisa quando novos treinos entram</Text>
                </View>
                <Switch
                  value={notif.activitySync}
                  onValueChange={(v) => setNotif({ activitySync: v })}
                  trackColor={{ true: colors.primary, false: colors.line }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.line}
                />
              </View>

              {/* Tarefas automáticas */}
              <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: '#B4825B' }]}>
                  <Ionicons name="checkmark-done-outline" size={15} color="#fff" />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowLabel}>Tarefas automáticas</Text>
                  <Text style={styles.rowSub}>Avisa quando tarefas são criadas por você/sync</Text>
                </View>
                <Switch
                  value={notif.autoTasks}
                  onValueChange={(v) => setNotif({ autoTasks: v })}
                  trackColor={{ true: colors.primary, false: colors.line }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.line}
                />
              </View>
            </View>

            {/* Retrospectivas */}
            <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Retrospectiva</Text>
            <View style={styles.card}>
              {/* Semanal */}
              <View style={[styles.row, styles.rowBorder]}>
                <View style={[styles.iconWrap, { backgroundColor: '#6FA86A' }]}>
                  <Ionicons name="albums-outline" size={15} color="#fff" />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowLabel}>Semanal</Text>
                  <Text style={styles.rowSub}>Quando a semana fecha</Text>
                </View>
                <Switch
                  value={notif.weeklyRetro.enabled}
                  onValueChange={(v) => setSchedule('weeklyRetro', { enabled: v })}
                  trackColor={{ true: colors.primary, false: colors.line }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.line}
                />
              </View>
              {notif.weeklyRetro.enabled && (
                <>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Dia</Text>
                    <View style={styles.timeChips}>
                      {WEEKDAYS.map((d, i) => {
                        const on = (notif.weeklyRetro.weekday ?? 1) === i;
                        return (
                          <Pressable
                            key={d}
                            onPress={() => setSchedule('weeklyRetro', { weekday: i })}
                            style={[styles.timeChip, on && styles.timeChipOn]}
                          >
                            <Text style={[styles.timeChipTxt, on && styles.timeChipTxtOn]}>{d}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Horário</Text>
                    <View style={styles.timeChips}>
                      {RETRO_TIMES.map((t) => {
                        const on = fmt(notif.weeklyRetro.hour, notif.weeklyRetro.minute) === t;
                        return (
                          <Pressable
                            key={t}
                            onPress={() => setSchedule('weeklyRetro', parse(t))}
                            style={[styles.timeChip, on && styles.timeChipOn]}
                          >
                            <Text style={[styles.timeChipTxt, on && styles.timeChipTxtOn]}>{t}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              {/* Mensal */}
              <View style={[styles.row, styles.rowBorder]}>
                <View style={[styles.iconWrap, { backgroundColor: '#F5B946' }]}>
                  <Ionicons name="calendar-outline" size={15} color="#fff" />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowLabel}>Mensal</Text>
                  <Text style={styles.rowSub}>No início do mês seguinte</Text>
                </View>
                <Switch
                  value={notif.monthlyRetro.enabled}
                  onValueChange={(v) => setSchedule('monthlyRetro', { enabled: v })}
                  trackColor={{ true: colors.primary, false: colors.line }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.line}
                />
              </View>
              {notif.monthlyRetro.enabled && (
                <>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Dia do mês</Text>
                    <View style={styles.timeChips}>
                      {MONTH_DAYS.map((d) => {
                        const on = (notif.monthlyRetro.day ?? 1) === d;
                        return (
                          <Pressable
                            key={d}
                            onPress={() => setSchedule('monthlyRetro', { day: d })}
                            style={[styles.timeChip, on && styles.timeChipOn]}
                          >
                            <Text style={[styles.timeChipTxt, on && styles.timeChipTxtOn]}>{d}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeLabel}>Horário</Text>
                    <View style={styles.timeChips}>
                      {RETRO_TIMES.map((t) => {
                        const on = fmt(notif.monthlyRetro.hour, notif.monthlyRetro.minute) === t;
                        return (
                          <Pressable
                            key={t}
                            onPress={() => setSchedule('monthlyRetro', parse(t))}
                            style={[styles.timeChip, on && styles.timeChipOn]}
                          >
                            <Text style={[styles.timeChipTxt, on && styles.timeChipTxtOn]}>{t}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              {/* Anual */}
              <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: '#E26A8A' }]}>
                  <Ionicons name="sparkles-outline" size={15} color="#fff" />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowLabel}>Anual</Text>
                  <Text style={styles.rowSub}>Em 1º de janeiro</Text>
                </View>
                <Switch
                  value={notif.yearlyRetro.enabled}
                  onValueChange={(v) => setSchedule('yearlyRetro', { enabled: v })}
                  trackColor={{ true: colors.primary, false: colors.line }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.line}
                />
              </View>
              {notif.yearlyRetro.enabled && (
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>Horário</Text>
                  <View style={styles.timeChips}>
                    {RETRO_TIMES.map((t) => {
                      const on = fmt(notif.yearlyRetro.hour, notif.yearlyRetro.minute) === t;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => setSchedule('yearlyRetro', parse(t))}
                          style={[styles.timeChip, on && styles.timeChipOn]}
                        >
                          <Text style={[styles.timeChipTxt, on && styles.timeChipTxtOn]}>{t}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
            <Text style={styles.hint}>
              As notificações são geradas pelo próprio app, sem servidor — elas usam o conteúdo da última vez que o app
              esteve aberto.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: fonts.sansSemiBold, color: colors.ink },
    pressed: { opacity: 0.6 },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['4xl'] },
    sectionTitle: {
      fontSize: 13,
      fontFamily: fonts.sansSemiBold,
      color: colors.ink2,
      textTransform: 'uppercase',
      letterSpacing: 1.0,
      marginBottom: spacing.sm,
      paddingHorizontal: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      overflow: 'hidden',
      ...shadows.card,
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
    rowLabel: { fontSize: 15, fontFamily: fonts.sans, color: colors.ink },
    rowMeta: { flex: 1, gap: 2 },
    rowSub: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3 },
    iconWrap: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeRow: {
      paddingHorizontal: spacing.lg,
      paddingBottom: 13,
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      paddingTop: 12,
    },
    timeLabel: { fontSize: 13, color: colors.ink2, fontFamily: fonts.sansSemiBold },
    timeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    timeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.surfaceMute },
    timeChipOn: { backgroundColor: colors.primary },
    timeChipTxt: { fontSize: 13, color: colors.ink2, fontFamily: fonts.monoSemiBold },
    timeChipTxtOn: { color: colors.onPrimary },
    hint: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3, marginTop: spacing.sm, marginHorizontal: 4, lineHeight: 17 },
  });
