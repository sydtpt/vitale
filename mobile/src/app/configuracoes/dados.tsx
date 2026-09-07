import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, moduleColors, radii, shadows, spacing, useThemedStyles } from '../../theme';
import {
  clearBreadcrumbs,
  readBreadcrumbs,
  type Breadcrumb,
} from '../../lib/sync-breadcrumbs';
import { type SleepDiagSummary, type SleepVerdict } from '../../lib/sleep-diagnostics';
import { diagnosticarSonoNoAparelho } from '../../services/sleep-diagnostics';
import { type BackfillProgress, backfillCorridor } from '../../services/activity-photos';
import { useActivitiesStore } from '../../store/activities.store';
import { useAuthStore } from '../../store/auth.store';

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

  // ── o lote de fotos (ADR 0037) ────────────────────────────────────
  const userId = useAuthStore((s) => s.user?.id);
  const todas = useActivitiesStore((s) => s._all);
  const carregarAtividades = useActivitiesStore((s) => s.load);
  useEffect(() => {
    carregarAtividades();
  }, [carregarAtividades]);

  /**
   * As pendentes, **da mais nova para a mais velha**.
   *
   * A ordem é a decisão: se ele parar na metade, ficou com a metade que vai
   * abrir. As de 2023 são as que menos importam.
   */
  const pendentes = useMemo(
    () =>
      todas
        .filter((a) => !a.photosCheckedAt && a.hasRoute && !a.hidden)
        .sort((x, y) => Date.parse(y.startAt) - Date.parse(x.startAt))
        .map((a) => ({
          id: a.id,
          startAtMs: Date.parse(a.startAt),
          endAtMs: Date.parse(a.endAt ?? a.startAt),
          distanceM: a.distanceM,
        })),
    [todas],
  );

  /**
   * As sem traçado aparecem como **puladas**, não somem.
   *
   * São 280 hoje, e 185 delas são Yoga. Se o botão disser "222" quando há 502
   * pendentes, o número parece errado — e a explicação (sem rota não há
   * corredor) é justamente o que dá sentido ao resto da tela.
   */
  const semRota = useMemo(
    () => todas.filter((a) => !a.photosCheckedAt && !a.hasRoute && !a.hidden).length,
    [todas],
  );

  const [lote, setLote] = useState<{
    rodando: boolean;
    p: BackfillProgress;
    fim: BackfillProgress | null;
  }>({
    rodando: false,
    p: { done: 0, total: 0, linked: 0, withRest: 0, rest: 0, skipped: 0 },
    fim: null,
  });
  /** Ref, não estado: o laço lê isto a cada volta e não pode esperar render. */
  const pararRef = useRef(false);

  const rodarLote = useCallback(async () => {
    if (!userId || pendentes.length === 0) return;
    pararRef.current = false;
    setLote({
      rodando: true,
      p: { done: 0, total: pendentes.length, linked: 0, withRest: 0, rest: 0, skipped: 0 },
      fim: null,
    });
    try {
      const fim = await backfillCorridor(
        pendentes,
        userId,
        (p) => setLote((s) => ({ ...s, p })),
        () => pararRef.current,
      );
      setLote({ rodando: false, p: fim, fim });
      // A lista de atividades carrega `photos_checked_at`: sem recarregar, o
      // botão continuaria oferecendo as pedaladas que ele acabou de varrer.
      await carregarAtividades();
    } catch (e) {
      setLote((s) => ({ ...s, rodando: false }));
      Alert.alert('Não consegui procurar', e instanceof Error ? e.message : String(e));
    }
  }, [userId, pendentes, carregarAtividades]);
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

        <Text style={[styles.sectionTitle, styles.blocoTitulo]}>Fotos nas pedaladas</Text>
        <View style={styles.card}>
          <Pressable
            onPress={rodarLote}
            disabled={lote.rodando || pendentes.length === 0}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons name="images-outline" size={20} color={colors.ink2} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>
                {lote.rodando ? 'Procurando…' : 'Procurar em todas as pedaladas'}
              </Text>
              <Text style={styles.rowSub}>
                {lote.rodando
                  ? `${lote.p.done} de ${lote.p.total} · ${lote.p.linked} ${lote.p.linked === 1 ? 'foto ligada' : 'fotos ligadas'}`
                  : pendentes.length === 0
                    ? 'Nada pendente — todas já foram procuradas'
                    : `${pendentes.length} com traçado${semRota > 0 ? ` · ${semRota} sem rota ficam de fora` : ''}`}
              </Text>
            </View>
            {lote.rodando ? (
              <Pressable onPress={() => (pararRef.current = true)} hitSlop={12}>
                <Text style={styles.parar}>Parar</Text>
              </Pressable>
            ) : (
              <Ionicons name="chevron-forward" size={15} color={colors.ink3} />
            )}
          </Pressable>

          {lote.rodando && (
            <View style={styles.barraTrilho}>
              <View
                style={[
                  styles.barraCheia,
                  { width: `${lote.p.total === 0 ? 0 : (lote.p.done / lote.p.total) * 100}%` },
                ]}
              />
            </View>
          )}

          {!lote.rodando && lote.fim && (
            <View style={styles.relatorio}>
              <Text style={styles.relatorioTexto}>
                {lote.fim.linked === 0
                  ? 'Nenhuma foto nova no corredor das rotas.'
                  : `${lote.fim.linked} ${lote.fim.linked === 1 ? 'foto ligada' : 'fotos ligadas'} em ${lote.fim.done - lote.fim.skipped} ${lote.fim.done - lote.fim.skipped === 1 ? 'pedalada' : 'pedaladas'}.`}
              </Text>
              {lote.fim.rest > 0 && (
                <Text style={styles.relatorioSub}>
                  Outras {lote.fim.rest} ficaram fora do corredor, em {lote.fim.withRest}{' '}
                  {lote.fim.withRest === 1 ? 'pedalada' : 'pedaladas'} — elas aparecem ao abrir
                  cada uma e tocar &ldquo;Procurar fotos de novo&rdquo;.
                </Text>
              )}
            </View>
          )}

          <Text style={styles.aviso}>
            Deixe o app aberto: o iOS suspende o que roda em segundo plano. Pode parar quando
            quiser — o que já foi procurado não se perde, e continuar recomeça de onde parou.
          </Text>
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
                <Resumo n={sono.awakeComAmostra} label="noites com AWAKE" cor={moduleColors('habito').accent} styles={styles} />
                <Resumo
                  n={sono.awakeDescartado}
                  label="descartados"
                  cor={sono.awakeDescartado > 0 ? moduleColors('treino').accent : colors.ink3}
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
                        { color: n.awake.keptMin === 0 ? moduleColors('treino').accent : colors.ink },
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

  blocoTitulo: { marginTop: spacing.xl },
  /**
   * Tinta, não marca. O acento garante 3,0 — o piso do traço, não o da letra —
   * e a barreira mantém um teto de quantas vezes ele vira texto. Aqui não vale
   * gastar: o peso já diz que é ação, e a ênfase da linha é o progresso.
   * Mesma decisão do cabeçalho da galeria.
   */
  parar: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink },
  barraTrilho: { height: 3, backgroundColor: colors.surfaceMute, marginHorizontal: spacing.lg },
  barraCheia: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  relatorio: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: 4,
  },
  relatorioTexto: { fontSize: 13.5, fontFamily: fonts.sansMedium, color: colors.ink },
  relatorioSub: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink3, lineHeight: 17 },
  aviso: {
    fontSize: 11.5,
    fontFamily: fonts.sans,
    color: colors.ink4,
    lineHeight: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },

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
