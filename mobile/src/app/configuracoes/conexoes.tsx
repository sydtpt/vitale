/**
 * Configurações → Conexões: vincular fontes de dados de treino.
 *  - Apple Health: permissão local do HealthKit (fitness.store).
 *  - intervals.icu: API key + Athlete ID (edge fn intervals-link) — ponte Garmin.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ConnectionProvider, LinkedAccount } from '@vitale/shared';
import { useConnectionsStore } from '../../store/connections.store';
import { useFitnessStore } from '../../store/fitness.store';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';

const RED = '#E05C5C';
const GREEN = '#6FA86A';

function formatSync(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function ConexoesScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ provider?: string; status?: string; reason?: string }>();

  const { accounts, loading, busy, load, linkIntervals, syncNow, disconnect } =
    useConnectionsStore();
  const permissionStatus = useFitnessStore((s) => s.permissionStatus);
  const requestPermission = useFitnessStore((s) => s.requestPermission);

  const [formKey, setFormKey] = useState('');
  const [formAthlete, setFormAthlete] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  // Retorno do OAuth (deep link): recarrega e mostra o resultado.
  useEffect(() => {
    if (!params.status) return;
    if (params.status === 'ok') setActionError(null);
    else if (params.reason) setActionError(`Conexão falhou: ${params.reason}`);
    load();
  }, [params.status, params.reason]);

  const byProvider = useMemo(() => {
    const map = new Map<ConnectionProvider, LinkedAccount>();
    for (const a of accounts) map.set(a.provider, a);
    return map;
  }, [accounts]);

  const run = async (fn: () => Promise<string | null>) => {
    setActionError(null);
    const err = await fn();
    if (err) setActionError(err);
  };

  const intervals = byProvider.get('intervals');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Conexões</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {actionError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={RED} />
            <Text style={styles.errorBannerText}>{actionError}</Text>
          </View>
        ) : null}

        <Text style={styles.intro}>
          Vincule suas contas para trazer treinos com rota GPS e frequência cardíaca. Os dados do
          Garmin chegam pelo intervals.icu — sem duplicar com o Apple Health.
        </Text>

        {/* ── Apple Health ─────────────────────────────── */}
        <View style={styles.card}>
          <CardHeader
            styles={styles}
            icon="heart-outline"
            title="Apple Health"
            connected={permissionStatus === 'authorized'}
          />
          {permissionStatus === 'authorized' ? (
            <Text style={styles.cardDesc}>Conectado — treinos e métricas lidos do HealthKit.</Text>
          ) : permissionStatus === 'denied' ? (
            <Text style={styles.cardDesc}>
              Acesso negado. Habilite em Ajustes → Privacidade → Saúde → Orbe.
            </Text>
          ) : permissionStatus === 'unavailable' ? (
            <Text style={styles.cardDesc}>Disponível apenas no iPhone.</Text>
          ) : (
            <>
              <Text style={styles.cardDesc}>Permita o acesso ao HealthKit para ler seus treinos.</Text>
              <PrimaryButton styles={styles} label="Permitir acesso" onPress={requestPermission} />
            </>
          )}
        </View>

        {/* ── intervals.icu ────────────────────────────── */}
        <View style={styles.card}>
          <CardHeader
            styles={styles}
            icon="pulse-outline"
            title="intervals.icu"
            connected={intervals?.status === 'connected'}
          />
          {intervals ? (
            <ConnectedBody
              styles={styles}
              account={intervals}
              busy={busy.intervals}
              onSync={() => run(() => syncNow('intervals'))}
              onDisconnect={() => run(() => disconnect('intervals'))}
            />
          ) : (
            <>
              <Text style={styles.cardDesc}>
                Ponte gratuita do Garmin: crie uma conta em intervals.icu, conecte-a ao Garmin e cole
                aqui a API key (Settings → Developer) e o Athlete ID.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="API key"
                placeholderTextColor={colors.ink3}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                value={formKey}
                onChangeText={setFormKey}
              />
              <TextInput
                style={styles.input}
                placeholder="Athlete ID (ex.: i123456)"
                placeholderTextColor={colors.ink3}
                autoCapitalize="none"
                autoCorrect={false}
                value={formAthlete}
                onChangeText={setFormAthlete}
              />
              <PrimaryButton
                styles={styles}
                label="Vincular"
                disabled={!formKey.trim() || !formAthlete.trim()}
                busy={busy.intervals === 'connecting'}
                onPress={() => run(() => linkIntervals(formKey.trim(), formAthlete.trim()))}
              />
            </>
          )}
        </View>

        {loading ? <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.ink3} /> : null}

        <Text style={styles.note}>
          Ao vincular o intervals.icu, os treinos que o Garmin Connect grava no Apple Health
          deixam de ser sincronizados — a versão completa (rota, FC) vem da conta vinculada.
        </Text>
      </ScrollView>
    </View>
  );
}

/* ───────────────────────── componentes ───────────────────────── */

type Styles = ReturnType<typeof createStyles>;

function CardHeader({ styles, icon, title, connected }: {
  styles: Styles;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  connected?: boolean;
}) {
  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardIcon}>
        <Ionicons name={icon} size={18} color={colors.ink2} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      {connected ? (
        <View style={styles.badge}>
          <Ionicons name="checkmark-circle" size={14} color={GREEN} />
          <Text style={styles.badgeText}>Conectado</Text>
        </View>
      ) : null}
    </View>
  );
}

function ConnectedBody({ styles, account, busy, onSync, onDisconnect }: {
  styles: Styles;
  account: LinkedAccount;
  busy?: string;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const sync = formatSync(account.lastSyncAt);
  const statusLine =
    account.status === 'error'
      ? `Erro: ${account.lastError ?? 'falha na sincronização'}`
      : !account.backfillDone
        ? 'Importando histórico…'
        : sync
          ? `Última sincronização: ${sync}`
          : 'Aguardando primeira sincronização.';
  return (
    <>
      {account.athleteName ? <Text style={styles.cardDesc}>{account.athleteName}</Text> : null}
      <Text style={[styles.cardStatus, account.status === 'error' && styles.cardStatusError]}>
        {statusLine}
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onSync}
          disabled={!!busy}
          style={({ pressed }) => [styles.secondaryBtn, (pressed || busy === 'syncing') && styles.pressed]}
        >
          {busy === 'syncing' ? (
            <ActivityIndicator size="small" color={colors.ink2} />
          ) : (
            <Ionicons name="sync-outline" size={15} color={colors.ink2} />
          )}
          <Text style={styles.secondaryBtnText}>Sincronizar agora</Text>
        </Pressable>
        <Pressable
          onPress={onDisconnect}
          disabled={!!busy}
          style={({ pressed }) => [styles.secondaryBtn, (pressed || busy === 'disconnecting') && styles.pressed]}
        >
          <Ionicons name="unlink-outline" size={15} color={RED} />
          <Text style={[styles.secondaryBtnText, { color: RED }]}>Desvincular</Text>
        </Pressable>
      </View>
    </>
  );
}

function PrimaryButton({ styles, label, onPress, disabled, busy }: {
  styles: Styles;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.primaryBtn, (disabled || pressed) && styles.pressed]}
    >
      {busy ? <ActivityIndicator size="small" color="#FFF" /> : null}
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

/* ───────────────────────── estilos ───────────────────────── */

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
    iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: fonts.sansSemiBold, color: colors.ink },
    pressed: { opacity: 0.6 },
    content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
    intro: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink2, marginBottom: spacing.lg, lineHeight: 19 },
    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: RED },
    errorBannerText: { flex: 1, fontSize: 13, fontFamily: fonts.sans, color: RED },
    card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.card },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
    cardIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMute, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { flex: 1, fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    badgeText: { fontSize: 12, fontFamily: fonts.sansSemiBold, color: GREEN },
    cardDesc: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink2, lineHeight: 19, marginBottom: spacing.sm },
    cardStatus: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3, marginBottom: spacing.sm },
    cardStatusError: { color: RED },
    input: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, fontFamily: fonts.sans, color: colors.ink, marginBottom: spacing.sm, backgroundColor: colors.bg },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radii.pill, paddingVertical: 12, marginTop: 2 },
    primaryBtnText: { color: colors.onPrimary, fontSize: 14, fontFamily: fonts.sansSemiBold },
    actions: { flexDirection: 'row', gap: spacing.sm },
    secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
    secondaryBtnText: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    note: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3, lineHeight: 18, marginTop: spacing.md },
  });
