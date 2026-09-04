import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';
import {
  clearBreadcrumbs,
  readBreadcrumbs,
  type Breadcrumb,
} from '../../lib/sync-breadcrumbs';
import { type SleepDiagSummary, type SleepVerdict } from '../../lib/sleep-diagnostics';
import { diagnosticarSonoNoAparelho } from '../../services/sleep-diagnostics';

/** Rótulo e cor por veredito. Perda nossa é laranja; ausência real é neutra. */
const VEREDITO: Record<SleepVerdict, { texto: string; cor: string }> = {
  ok: { texto: 'registrada', cor: '#6FA86A' },
  'sem-estagio': { texto: 'perdida — só INBED', cor: '#D9491B' },
  anulada: { texto: 'perdida — AWAKE cobriu tudo', cor: '#D9491B' },
  degenerada: { texto: 'amostra sem duração na origem', cor: '#C08A2E' },
  'sem-amostra': { texto: 'sem amostra no aparelho', cor: colors.ink3 },
};

/** Dia + hora local. O dia importa: as migalhas atravessam o app fechado. */
function formatarMomento(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date().toDateString() === d.toDateString();
  const hora = d.toLocaleTimeString('pt-BR', { hour12: false });
  return hoje ? hora : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`;
}

/** Um número do resumo do diagnóstico de sono. */
function Resumo({ n, label, cor, styles }: {
  n: number; label: string; cor: string; styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.resumoBloco}>
      <Text style={[styles.resumoN, { color: cor }]}>{n}</Text>
      <Text style={styles.resumoLabel}>{label}</Text>
    </View>
  );
}

export default function DadosScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [migalhas, setMigalhas] = useState<Breadcrumb[]>([]);
  const [sono, setSono] = useState<(SleepDiagSummary & { amostrasLidas: number }) | null>(null);
  const [rodando, setRodando] = useState(false);

  const carregar = useCallback(() => {
    void readBreadcrumbs().then(setMigalhas);
  }, []);

  useEffect(carregar, [carregar]);

  const exportData = () => {
    Alert.alert('Em breve', 'A exportação de dados estará disponível em uma próxima versão.');
  };

  const rodarDiagSono = () => {
    setRodando(true);
    diagnosticarSonoNoAparelho(60)
      .then(setSono)
      .catch((e: unknown) => Alert.alert('Falhou', String(e)))
      .finally(() => setRodando(false));
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        {/* Diagnóstico de sono — separa "o relógio não gravou" de "o app perdeu".
            Lê as amostras cruas do HealthKit e compara com o que a agregação produz. */}
        <View style={styles.diagHeader}>
          <Text style={styles.sectionTitle}>Noites de sono</Text>
          <Pressable onPress={rodarDiagSono} disabled={rodando} hitSlop={10}
            style={({ pressed }) => [styles.diagPlay, pressed && styles.pressed]}>
            <Ionicons name={rodando ? 'hourglass-outline' : 'play-outline'} size={17} color={colors.ink3} />
          </Pressable>
        </View>

        <View style={styles.card}>
          {sono == null ? (
            <Text style={styles.vazio}>
              {rodando ? 'Lendo o HealthKit…' : 'Toque em ▶ para analisar os últimos 60 dias.'}
            </Text>
          ) : (
            <>
              <View style={styles.resumo}>
                <Resumo n={sono.ok} label="registradas" cor="#6FA86A" styles={styles} />
                <Resumo n={sono.perdidas} label="perdidas" cor="#D9491B" styles={styles} />
                <Resumo n={sono.degeneradas} label="quebradas" cor="#C08A2E" styles={styles} />
                <Resumo n={sono.semAmostra} label="sem amostra" cor={colors.ink3} styles={styles} />
              </View>
              <Text style={styles.diagNota}>
                {sono.amostrasLidas} amostras cruas lidas. “Perdidas” são noites em que o
                HealthKit tem dado e a agregação não produziu linha — perda nossa.
                {sono.amostrasLidas === 0
                  ? ' Zero amostras em 60 dias é sinal de consulta falhando, não de ausência.'
                  : ''}
              </Text>
              {sono.nights
                .filter((n) => n.verdict !== 'ok')
                .slice(0, 40)
                .map((n) => (
                  <View key={n.day} style={styles.migalha}>
                    <Text style={styles.migalhaHora}>{n.day}</Text>
                    <Text style={[styles.migalhaEvento, { color: VEREDITO[n.verdict].cor }]}>
                      {VEREDITO[n.verdict].texto}
                    </Text>
                    {n.samples > 0 ? (
                      <Text style={styles.migalhaDetalhe}>
                        {Object.entries(n.labels).map(([l, c]) => `${l}×${c}`).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                ))}

              {/* Vigília: a pergunta que o veredito não responde. Numa noite `ok`,
                  não haver despertar pode ser da fonte OU nosso — a agregação só
                  credita AWAKE que se sobrepõe ao sono, e fonte que escreve
                  segmentos encostados perde tudo. Ver `auditAwake`. */}
              <View style={styles.diagDivisor} />
              <Text style={styles.diagSubtitulo}>Despertares</Text>
              <View style={styles.resumo}>
                <Resumo n={sono.awakeComAmostra} label="noites com AWAKE" cor="#6FA86A" styles={styles} />
                <Resumo
                  n={sono.awakeDescartado}
                  label="descartados"
                  cor={sono.awakeDescartado > 0 ? '#D9491B' : colors.ink3}
                  styles={styles}
                />
              </View>
              <Text style={styles.diagNota}>
                {sono.awakeComAmostra === 0
                  ? 'Nenhuma amostra AWAKE no período: a fonte não reporta despertar. O dado não existe — não é perda nossa.'
                  : sono.awakeDescartado > 0
                    ? 'O HealthKit TEM despertares que a agregação credita como zero: a fonte escreve segmentos encostados e a regra de sobreposição os descarta. É perda nossa, e é corrigível.'
                    : 'Todos os despertares do período foram creditados. A regra de sobreposição está funcionando para esta fonte.'}
              </Text>
              {sono.nights
                .filter((n) => n.awake.samples > 0)
                .slice(0, 20)
                .map((n) => (
                  <View key={`awake-${n.day}`} style={styles.migalha}>
                    <Text style={styles.migalhaHora}>{n.day}</Text>
                    <Text
                      style={[
                        styles.migalhaEvento,
                        { color: n.awake.keptMin === 0 ? '#D9491B' : colors.ink },
                      ]}
                    >
                      AWAKE×{n.awake.samples} · {Math.round(n.awake.totalMin)} min no HealthKit
                    </Text>
                    <Text style={styles.migalhaDetalhe}>
                      {Math.round(n.awake.keptMin)} min creditados pela agregação
                    </Text>
                  </View>
                ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: fonts.sansSemiBold, color: colors.ink },
  pressed: { opacity: 0.6 },
  content: { padding: spacing.lg },
  sectionTitle: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.ink2, textTransform: 'uppercase', letterSpacing: 1.0, marginBottom: spacing.sm, paddingHorizontal: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden', ...shadows.card },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, gap: 12 },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontFamily: fonts.sans, color: colors.ink },
  rowSub: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink3 },

  diagHeader: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl },
  diagActions: { flexDirection: 'row', gap: spacing.md, marginLeft: 'auto', marginBottom: spacing.sm },
  diagPlay: { marginLeft: 'auto', marginBottom: spacing.sm },
  resumo: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  resumoBloco: { alignItems: 'flex-start' },
  resumoN: { fontSize: 22, fontFamily: fonts.sansBold },
  resumoLabel: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3 },
  vazio: { fontSize: 14, fontFamily: fonts.sans, color: colors.ink3, padding: spacing.lg },
  migalha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
  },
  migalhaHora: { fontSize: 12, color: colors.ink3, fontFamily: fonts.mono },
  migalhaEvento: { fontSize: 13, color: colors.ink, fontFamily: fonts.sansSemiBold },
  migalhaDetalhe: { fontSize: 12, color: colors.ink3, fontFamily: fonts.mono, flexShrink: 1 },
  diagNota: {
    fontSize: 12, fontFamily: fonts.sans,
    color: colors.ink3,
    lineHeight: 18,
    paddingHorizontal: 4,
    marginTop: spacing.sm,
  },
  diagDivisor: {
    height: 1,
    backgroundColor: colors.line,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
  },
  diagSubtitulo: {
    fontSize: 13,
    fontFamily: fonts.sansBold,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
