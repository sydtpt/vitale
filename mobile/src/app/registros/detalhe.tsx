/**
 * Detalhe de um Registro — métricas por período (SPEC-registros CAP-5/6/7).
 *
 * Tocar num registro cai aqui, não mais no editor: o histórico deixou de ser
 * write-only no celular. A tela só renderiza — toda derivação vem de
 * `buildRegistroDetail`/`yearHeatmap` no shared, sobre o histórico completo já
 * em memória; alternar período não refaz fetch nenhum.
 *
 * Edição continua a um toque: o lápis do header abre o editor, e a correção
 * retroativa delega ao calendário `/registros/marcar` existente — o heatmap
 * anual é só-leitura (célula de ~4px não é alvo de toque) e qualquer toque
 * nele leva para lá. Ao voltar, o `useFocusEffect` refaz o fetch.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildRegistroDetail,
  yearHeatmap,
  yearHeatmapMonthStarts,
  DIAS_ABREV_SEG,
  MESES_ABREV,
  MESES_INICIAIS,
  type Period,
  type RegistroHeatCell,
} from '@vitale/shared';
import { useRegistrosStore } from '../../store/registros.store';
import { habitIconToIonicon } from '../../lib/habit-icons';
import { getJSON, setJSON } from '../../lib/local-store';
import { BarChart } from '../../components/charts/BarChart';
import { Segmented } from '../../components/ui/Segmented';
import { colors, fonts, moduleColors, radii, roleColors, shadows, spacing, themed, useTheme } from '../../theme';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'semana', label: '7d' },
  { key: 'mes', label: '4s' },
  { key: 'meses12', label: '12m' },
  { key: 'ano', label: 'Ano' },
  { key: 'sempre', label: 'Sempre' },
];

/**
 * Última escolha de período, por aparelho (mesmo padrão dos anos do histórico).
 * Default `meses12`, não `semana`: registro esparso abriria vazio em 7d.
 */
const PERIOD_KEY = 'vitale.registroDetailPeriod';
const DEFAULT_PERIOD: Period = 'meses12';

function fmtDay(s: string): string {
  return `${Number(s.slice(8, 10))} ${MESES_ABREV[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
}

function fmtLast(days: number | null): string {
  if (days === null) return 'nunca';
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `${days} dias`;
}

/** Frequência com 1 decimal e vírgula; barras e totais ficam inteiros. */
function fmtFreq(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** Dias inteiros ("43 dias") ou "—" — a métrica indisponível não some do layout. */
function fmtGap(days: number | null): string {
  return days === null ? '—' : `${Math.round(days)} dias`;
}

/**
 * Delta em contagem absoluta (+1/−2), nunca percentual — decisão de
 * metricas-do-detalhe.md. Três estados: `null` não renderiza nada (sem período
 * anterior comparável), zero mostra `=`, o resto mostra o sinal.
 */
function DeltaText({ delta }: { delta: number | null }) {
  if (delta === null) return <Text style={styles.deltaVoid}> </Text>;
  if (delta === 0) return <Text style={styles.deltaFlat}>=</Text>;
  return (
    <Text style={[styles.delta, delta > 0 ? styles.deltaUp : styles.deltaDown]}>
      {delta > 0 ? `+${delta}` : `−${-delta}`}
    </Text>
  );
}

function Tile({ value, label, delta }: { value: string; label: string; delta?: number | null }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
      <DeltaText delta={delta === undefined ? null : delta} />
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

/** Mini-barras da distribuição (dia da semana, sazonalidade) — contagens inteiras. */
function MiniBars({ values, labels, accent }: { values: number[]; labels: string[]; accent: string }) {
  const max = Math.max(...values, 1);
  return (
    <View style={styles.miniRow}>
      {values.map((v, i) => (
        <View key={i} style={styles.miniCol}>
          <Text style={styles.miniCount}>{v > 0 ? v : ' '}</Text>
          <View
            style={[
              styles.miniBar,
              { height: 3 + (v / max) * 36, backgroundColor: v > 0 ? accent : colors.line },
            ]}
          />
          <Text style={styles.miniLabel}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

const HEAT_GAP = 1;

/**
 * Heatmap anual binário (célula marcada = acento do módulo, vazia = linha) —
 * não é a escala divergente do `HeatmapGrid`, de propósito. Só-leitura: o
 * toque, em qualquer célula, abre o calendário mensal de `marcar`.
 *
 * Rótulos: iniciais de mês em cima (na coluna do dia 1º) e legenda embaixo.
 * Dia da semana na lateral NÃO cabe — a linha tem a altura da célula (~4px),
 * menor que qualquer texto legível; quem precisa do dia exato vai ao
 * calendário de `marcar`, que é o destino do toque mesmo.
 */
function YearHeatmapGrid({ weeks, accent, onPress }: {
  weeks: RegistroHeatCell[][];
  accent: string;
  onPress: () => void;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  };
  const n = weeks.length;
  // Lado inteiro, como no HeatmapGrid: fração de pixel desalinha as 53 colunas.
  const side = width > 0 && n > 0 ? Math.max(2, Math.floor((width - (n - 1) * HEAT_GAP) / n)) : 0;
  const monthStarts = useMemo(() => yearHeatmapMonthStarts(weeks), [weeks]);
  const pitch = side + HEAT_GAP;
  return (
    <Pressable
      onLayout={onLayout}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Editar dias no calendário"
      // Centraliza a grade: o `floor` do lado deixa sobra (até ~50px), que
      // toda à direita leria como desalinhamento. O Pressable continua na
      // largura cheia — o `onLayout` mede ele, não a grade.
      style={{ alignItems: 'center' }}
    >
      {side > 0 && (
        <View>
          <View style={{ height: 13, position: 'relative' }}>
            {monthStarts.map((m) => (
              <Text
                key={m.month}
                style={[styles.heatMonth, { left: m.week * pitch }]}
              >
                {MESES_INICIAIS[m.month]}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: HEAT_GAP }}>
            {weeks.map((week, wi) => (
              <View key={wi} style={{ gap: HEAT_GAP }}>
                {week.map((c) => (
                  <View
                    key={c.date}
                    style={{
                      width: side,
                      height: side,
                      borderRadius: 1.5,
                      backgroundColor: !c.inYear
                        ? 'transparent'
                        : c.marked
                          ? accent
                          : colors.line,
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
          <View style={styles.heatLegend}>
            <View style={[styles.heatSwatch, { backgroundColor: accent }]} />
            <Text style={styles.heatLegendText}>marcado</Text>
            <View style={[styles.heatSwatch, { backgroundColor: colors.line, marginLeft: 8 }]} />
            <Text style={styles.heatLegendText}>vazio</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function RegistroDetalheScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();

  const registros = useRegistrosStore((s) => s.registros);
  const storeLoaded = useRegistrosStore((s) => s.loaded);
  const load = useRegistrosStore((s) => s.load);
  const fetchRegistroLogs = useRegistrosStore((s) => s.fetchRegistroLogs);

  const registro = useMemo(() => registros.find((r) => r.id === id), [registros, id]);

  const [dates, setDates] = useState<string[] | null>(null);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [yearOffset, setYearOffset] = useState(0);
  // O usuário já mexeu no período nesta visita? Barra a corrida da hidratação.
  const touched = useRef(false);

  // Âncora do gráfico e da navegação por ano. É estado, não captura única:
  // com a tela montada através da meia-noite, "hoje" e as janelas ficariam
  // de ontem — o foco reavalia (junto com o refetch, logo abaixo).
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!storeLoaded) void load();
  }, [storeLoaded, load]);

  // Id que não existe no store: volta silencioso (matriz de edge cases).
  // Deep link sem histórico não tem para onde voltar — cai na lista.
  useEffect(() => {
    if (storeLoaded && !registro) {
      if (router.canGoBack()) router.back();
      else router.replace('/registros');
    }
  }, [storeLoaded, registro, router]);

  // Hidrata a última escolha de período do aparelho — a menos que o usuário
  // já tenha trocado antes de o AsyncStorage responder (a escolha viva ganha).
  useEffect(() => {
    void getJSON<{ period: Period }>(PERIOD_KEY).then((v) => {
      if (!touched.current && v && PERIODS.some((p) => p.key === v.period)) setPeriod(v.period);
    });
  }, []);

  const loadDates = useCallback(async () => {
    if (!id) return;
    try {
      setError(false);
      setDates(await fetchRegistroLogs(id));
    } catch {
      setError(true);
    }
  }, [id, fetchRegistroLogs]);

  // Cobre a primeira entrada E a volta do `marcar`/editor: dias editados no
  // calendário reaparecem aqui sem gesto nenhum. O `now` reavalia junto.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      void loadDates();
    }, [loadDates]),
  );

  const changePeriod = (p: Period) => {
    touched.current = true;
    setPeriod(p);
    setYearOffset(0); // volta ao ano corrente ao trocar de período
    void setJSON(PERIOD_KEY, { period: p });
  };

  const detail = useMemo(
    () => (dates ? buildRegistroDetail(dates, period, { now, yearOffset }) : null),
    [dates, period, now, yearOffset],
  );
  const shownYear = now.getFullYear() + yearOffset;
  const heat = useMemo(
    () => (dates ? yearHeatmap(dates, shownYear) : null),
    [dates, shownYear],
  );

  const mod = moduleColors(registro?.color ?? '', 'habito');
  const isYear = period === 'ano';
  const canPrev = detail?.canPrevYear ?? false;
  const canNext = detail?.canNextYear ?? false;

  const goMarcar = () => router.push({ pathname: '/registros/marcar', params: { id } });

  /** Chevrons de ano — um só controle, que governa o heatmap e (no período Ano) as barras. */
  const yearNav = (
    <View style={styles.yearNav}>
      <Pressable
        onPress={() => canPrev && setYearOffset((o) => o - 1)}
        disabled={!canPrev}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Ano anterior"
        style={styles.navBtn}
      >
        <Ionicons name="chevron-back" size={18} color={canPrev ? colors.ink : colors.ink4} />
      </Pressable>
      <Text style={styles.navLabel}>{shownYear}</Text>
      <Pressable
        onPress={() => canNext && setYearOffset((o) => o + 1)}
        disabled={!canNext}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Próximo ano"
        style={styles.navBtn}
      >
        <Ionicons name="chevron-forward" size={18} color={canNext ? colors.ink : colors.ink4} />
      </Pressable>
    </View>
  );

  // O `chartWrap` desloca −xs de cada lado; o width soma os 2×xs de volta,
  // senão o SVG encosta à esquerda de uma caixa mais larga que ele.
  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2 + spacing.xs * 2;
  const loading = dates === null && !error;
  // Falha de refetch com dados já em memória é silenciosa: detalhe de ontem
  // vale mais que a tela de erro (o próximo foco tenta de novo).
  const showError = error && dates === null;
  const empty = detail !== null && detail.allTimeTotal === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.headerMain}>
          {registro && (
            <>
              <View style={[styles.iconBox, { backgroundColor: mod.tint }]}>
                <Ionicons name={habitIconToIonicon(registro.icon)} size={17} color={mod.onTint} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle} numberOfLines={1}>{registro.name}</Text>
                {!registro.active && <Text style={styles.headerHint}>Arquivado</Text>}
              </View>
            </>
          )}
        </View>
        {/* Editor a um toque — o tap da lista agora abre o detalhe, não ele.
            Desabilitado enquanto o registro não chegou do store. */}
        <Pressable
          onPress={() => router.push({ pathname: '/registros/editor', params: { id } })}
          disabled={!registro}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Editar registro"
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.ink} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={mod.accent} />
        </View>
      ) : showError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.ink4} />
          <Text style={styles.emptyText}>Não deu para carregar.</Text>
          <Pressable onPress={() => void loadDates()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : empty ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: mod.tint }]}>
            <Ionicons name="bookmark-outline" size={28} color={mod.onTint} />
          </View>
          <Text style={styles.emptyTitle}>Nenhuma marca ainda</Text>
          <Text style={styles.emptyText}>
            Marque hoje na lista de registros, ou abra o calendário para marcar dias passados.
          </Text>
          {/* CTA no cromo da marca, não no acento do módulo: só o par
              primary/onPrimary tem contraste garantido nos quatro eixos. */}
          <Pressable onPress={goMarcar} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <Ionicons name="calendar-outline" size={16} color={colors.onPrimary} />
            <Text style={styles.ctaText}>Marcar dias</Text>
          </Pressable>
        </View>
      ) : detail ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Segmented options={PERIODS} value={period} onChange={changePeriod} />
            {isYear && yearNav}

            <View style={styles.tilesRow}>
              <Tile value={String(detail.total)} label="no período" delta={detail.delta} />
              <Tile value={fmtLast(detail.daysSinceLast)} label="última vez" />
              <Tile
                value={fmtFreq(detail.freq.value)}
                label={detail.freq.per === 'semana' ? '×/sem' : '×/mês'}
              />
            </View>
            {detail.delta !== null && (
              <Text style={styles.tilesCaption}>variação sobre o período anterior</Text>
            )}

            <View style={styles.chartWrap}>
              <BarChart buckets={detail.buckets} width={chartWidth} color={mod.accent} emphasis="last" />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ritmo</Text>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Intervalo médio</Text>
              <Text style={styles.metricValue}>{fmtGap(detail.avgGapDays)}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Maior jejum</Text>
              <Text style={styles.metricValue}>{fmtGap(detail.maxGapDays)}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Primeira vez</Text>
              <Text style={styles.metricValue}>
                {detail.firstDate ? fmtDay(detail.firstDate) : '—'}
              </Text>
            </View>
            <View style={[styles.metricRow, styles.metricRowLast]}>
              <Text style={styles.metricLabel}>Total histórico</Text>
              <Text style={styles.metricValue}>{detail.allTimeTotal}×</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dia da semana</Text>
            <MiniBars values={detail.weekdayCounts} labels={DIAS_ABREV_SEG} accent={mod.accent} />
          </View>

          {/* Só em janelas ≥ 12 meses: em 7d/4s a "sazonalidade" seria ruído.
              No período Ano também não: duplicaria exatamente as barras de
              cima, com meses futuros zerados de brinde. */}
          {detail.monthCounts && !isYear && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sazonalidade</Text>
              <MiniBars values={detail.monthCounts} labels={MESES_INICIAIS} accent={mod.accent} />
            </View>
          )}

          {heat && (
            <View style={styles.card}>
              <View style={styles.heatHeader}>
                <Text style={styles.cardTitle}>Dias do ano</Text>
                {!isYear && yearNav}
              </View>
              <YearHeatmapGrid weeks={heat} accent={mod.accent} onPress={goMarcar} />
              <Pressable
                onPress={goMarcar}
                hitSlop={6}
                accessibilityRole="button"
                style={({ pressed }) => [styles.editDays, pressed && styles.pressed]}
              >
                <Ionicons name="calendar-outline" size={14} color={colors.ink2} />
                <Text style={styles.editDaysText}>Editar dias</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
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
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  headerText: { flexShrink: 1 },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: fonts.serif, color: colors.ink },
  headerHint: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3 },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  cardTitle: {
    fontSize: 12,
    fontFamily: fonts.sansBold,
    color: colors.ink2,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },

  tilesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tile: { alignItems: 'center', flex: 1, gap: 1 },
  tileValue: { fontSize: 16, color: colors.ink, fontFamily: fonts.monoBold },
  tileLabel: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3 },
  delta: { fontSize: 10, fontFamily: fonts.monoBold },
  // `.text`, não `.accent`: acento promete 3,0 (objeto gráfico) e isto é letra (ADR 0024).
  deltaUp: { color: roleColors('green').text },
  deltaDown: { color: roleColors('red').text },
  // Reserva a linha mesmo sem variação, senão os tiles desalinham entre si.
  deltaVoid: { fontSize: 10, fontFamily: fonts.mono },
  deltaFlat: { fontSize: 10, fontFamily: fonts.mono, color: colors.ink4 },
  tilesCaption: { fontSize: 10, fontFamily: fonts.sans, color: colors.ink4, textAlign: 'center' },

  chartWrap: { marginHorizontal: -spacing.xs },

  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  metricRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  metricLabel: { fontSize: 13.5, fontFamily: fonts.sans, color: colors.ink2 },
  metricValue: { fontSize: 13.5, fontFamily: fonts.monoBold, color: colors.ink },

  miniRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  miniCol: { flex: 1, alignItems: 'center', gap: 3 },
  miniBar: { width: 12, borderRadius: 4 },
  miniCount: { fontSize: 9.5, fontFamily: fonts.mono, color: colors.ink3 },
  miniLabel: { fontSize: 9, fontFamily: fonts.sans, color: colors.ink3 },

  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  navBtn: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMute },
  navLabel: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink, minWidth: 48, textAlign: 'center' },

  heatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heatMonth: { position: 'absolute', top: 0, fontSize: 8.5, fontFamily: fonts.sans, color: colors.ink3 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, justifyContent: 'center' },
  heatSwatch: { width: 8, height: 8, borderRadius: 2 },
  heatLegendText: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3 },
  editDays: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  editDaysText: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMute,
  },
  retryText: { color: colors.ink, fontSize: 14, fontFamily: fonts.sansSemiBold },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { fontSize: 16, fontFamily: fonts.sansBold, color: colors.ink },
  emptyText: { fontSize: 13.5, fontFamily: fonts.sans, color: colors.ink3, textAlign: 'center', lineHeight: 19 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
  },
  ctaText: { color: colors.onPrimary, fontSize: 14, fontFamily: fonts.sansBold },
}));
