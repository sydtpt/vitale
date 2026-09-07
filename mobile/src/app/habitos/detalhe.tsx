/**
 * Detalhe de um Hábito contador — o irmão quantitativo do detalhe de Registros.
 *
 * Tocar num hábito cai aqui, não mais no editor (o lápis do cabeçalho leva a
 * ele), pela mesma razão que valeu em Registros: o histórico deixou de ser
 * write-only no celular. Mesmo eixo de período, mesmos gestos, mesma navegação
 * de ano — a tela só renderiza, e toda derivação vem de `buildHabitDetail` /
 * `habitYearHeat` no shared, sobre o histórico completo do hábito.
 *
 * O que esta tela tem e a de Registros não: **valor**. Daí as três leituras que
 * só existem aqui — o maior dia, a distribuição do valor por dia da semana (não
 * da contagem: 9 cervejas numa quinta contam 1 dia e pesam 9 L), e a faixa de
 * estimativa, onde gasto e caloria ficam juntos e **separados dos números
 * medidos por uma linha**, porque são outra coisa.
 *
 * Correção retroativa continua no calendário existente (`/habitos/dia`), que é
 * o destino do toque no heatmap — célula de ~4px não é alvo de toque.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  buildHabitDetail,
  habitCalories,
  habitCellLevel,
  habitCost,
  habitHeatMax,
  habitHeatMonthStarts,
  habitYearHeat,
  fmtMoneyAuto,
  mix,
  DIAS_ABREV_SEG,
  MESES_ABREV,
  MESES_INICIAIS,
  type CounterHabit,
  type HabitHeatCell,
  type HabitLog,
  type Period,
} from '@vitale/shared';
import { useHabitsStore } from '../../store/habits.store';
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
 * Última escolha de período, por aparelho — mesmo padrão de Registros. Default
 * `meses12` pela mesma razão: hábito esparso (26 dias em 108) abriria vazio em 7d.
 */
const PERIOD_KEY = 'vitale.habitDetailPeriod';
const DEFAULT_PERIOD: Period = 'meses12';

/** Quantidade: inteiro sem casas, fracionário com até 2 — nunca "2,30". */
function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/\.?0+$/, '');
  return s.replace('.', ',');
}

function fmtDay(s: string): string {
  return `${Number(s.slice(8, 10))} ${MESES_ABREV[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
}

function fmtLast(days: number | null): string {
  if (days === null) return 'nunca';
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `${days} dias`;
}

/**
 * Delta **na unidade** (+11,5 L / −6 L), não em contagem. Três estados: `null`
 * não renderiza nada (sem período anterior comparável), zero mostra `=`, o
 * resto mostra o sinal.
 *
 * Sem cor de julgamento: subir 6 L de cerveja e subir 6 L de água não são a
 * mesma notícia, e o hábito ruim já inverte a leitura. Quem julga é o `bad`.
 */
function DeltaText({ delta, bad }: { delta: number | null; bad: boolean }) {
  if (delta === null) return <Text style={styles.deltaVoid}> </Text>;
  if (delta === 0) return <Text style={styles.deltaFlat}>=</Text>;
  const pior = bad ? delta > 0 : delta < 0;
  return (
    <Text style={[styles.delta, pior ? styles.deltaDown : styles.deltaUp]}>
      {delta > 0 ? `+${fmt(delta)}` : `−${fmt(-delta)}`}
    </Text>
  );
}

function Tile({ value, label, delta, bad }: {
  value: string;
  label: string;
  delta?: number | null;
  bad?: boolean;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
      <DeltaText delta={delta === undefined ? null : delta} bad={bad ?? false} />
      <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

/** Mini-barras de valor somado (dia da semana, sazonalidade). */
function MiniBars({ values, labels, accent, unit }: {
  values: number[];
  labels: string[];
  accent: string;
  unit: string;
}) {
  const max = Math.max(...values, 0);
  return (
    <View style={styles.miniRow}>
      {values.map((v, i) => (
        <View key={i} style={styles.miniCol}>
          <Text style={styles.miniCount} numberOfLines={1}>{v > 0 ? fmt(v) : ' '}</Text>
          <View
            style={[
              styles.miniBar,
              {
                height: 3 + (max > 0 ? v / max : 0) * 36,
                backgroundColor: v > 0 ? accent : colors.line,
              },
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
 * Heatmap anual com **intensidade** — a diferença para o de Registros, que é
 * binário. A regra do tom é do núcleo (`habitCellLevel`); aqui só se resolve a
 * cor, misturando o acento na superfície do tema (nunca no branco: no escuro,
 * clarear em direção ao branco deixa a célula fraca mais visível que a forte).
 */
function YearHeatGrid({ weeks, habit, accent, onPress }: {
  weeks: HabitHeatCell[][];
  habit: CounterHabit;
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
  const monthStarts = useMemo(() => habitHeatMonthStarts(weeks), [weeks]);
  const scaleMax = useMemo(() => habitHeatMax(weeks), [weeks]);
  const pitch = side + HEAT_GAP;

  const colorOf = (value: number): string => {
    const level = habitCellLevel(habit, value, { scaleMax });
    if (level.kind === 'empty') return colors.line;
    if (level.kind === 'over') return colors.primaryDeep;
    return mix(colors.surface, accent, level.pct / 100);
  };

  return (
    <Pressable
      onLayout={onLayout}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Editar valores no calendário"
      // Centraliza a grade: o `floor` do lado deixa sobra, que toda à direita
      // leria como desalinhamento. O Pressable fica na largura cheia.
      style={styles.heatPress}
    >
      {side > 0 && (
        <View>
          <View style={styles.heatMonthRow}>
            {monthStarts.map((m) => (
              <Text key={m.month} style={[styles.heatMonth, { left: m.week * pitch }]}>
                {MESES_INICIAIS[m.month]}
              </Text>
            ))}
          </View>
          <View style={styles.heatCols}>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.heatCol}>
                {week.map((c) => (
                  <View
                    key={c.date}
                    style={{
                      width: side,
                      height: side,
                      borderRadius: 1.5,
                      backgroundColor: c.inYear ? colorOf(c.value) : 'transparent',
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
          <View style={styles.heatLegend}>
            <View style={[styles.heatSwatch, { backgroundColor: colors.line }]} />
            <Text style={styles.heatLegendText}>vazio</Text>
            <View
              style={[styles.heatSwatch, { backgroundColor: colorOf(scaleMax), marginLeft: 8 }]}
            />
            <Text style={styles.heatLegendText}>
              {scaleMax > 0 ? `${fmt(scaleMax)} ${habit.unit}` : 'sem registro'}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Quantos dias com registro a frase do dia da semana exige para existir.
 *
 * Com dois dias na janela, "sáb e dom concentram 100%" é aritmética, não
 * leitura: os dois únicos dias sempre concentram tudo. Cinco é onde a
 * concentração começa a poder ser desmentida pelos próprios dados.
 */
const MIN_DIAS_LEITURA = 5;

/**
 * A frase do painel de dia da semana. Só existe quando há concentração de
 * verdade: com o valor espalhado por igual, "seg e ter são 30%" não é leitura,
 * é ruído — e some, em vez de mentir uma tendência.
 */
function weekdayReading(
  totals: number[],
  total: number,
  days: number,
  unit: string,
  unitPrice: number | undefined,
): string | null {
  if (total <= 0 || days < MIN_DIAS_LEITURA) return null;
  const ranked = totals
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .filter((x) => x.v > 0);
  if (ranked.length === 0) return null;

  // Escolhe os dois maiores pelo valor, mas nomeia na ordem da semana: "sex e
  // sáb" é como se fala; "sáb e sex" faz o leitor reordenar de graça.
  const dois = ranked.slice(0, 2).sort((a, b) => a.i - b.i);
  const soma = dois.reduce((s, x) => s + x.v, 0);
  const pct = Math.round((soma / total) * 100);
  const nomes = dois.map((x) => DIAS_ABREV_SEG[x.i]);
  const vazios = totals
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v === 0)
    .map((x) => DIAS_ABREV_SEG[x.i]);

  const cost = habitCost(unitPrice, soma);
  const dinheiro = cost === null ? '' : ` (≈${fmtMoneyAuto(cost)})`;
  const parte =
    dois.length === 2
      ? `${nomes[0]} e ${nomes[1]} concentram ${pct}%`
      : `${nomes[0]} concentra ${pct}%`;
  const nada = vazios.length > 0 && vazios.length <= 3
    ? ` Nenhum registro ${vazios.length === 1 ? 'na' : 'em'} ${vazios.join(', ')}.`
    : '';
  return `${parte} do total${dinheiro} — ${fmt(soma)} ${unit}.${nada}`;
}

export default function HabitoDetalheScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();

  const allHabits = useHabitsStore((s) => s.allHabits);
  const loadAll = useHabitsStore((s) => s.loadAll);
  const fetchHistory = useHabitsStore((s) => s.fetchHistory);

  const habit = useMemo(() => allHabits.find((h) => h.id === id), [allHabits, id]);

  const [logs, setLogs] = useState<HabitLog[] | null>(null);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [yearOffset, setYearOffset] = useState(0);
  // O usuário já mexeu no período nesta visita? Barra a corrida da hidratação.
  const touched = useRef(false);

  // Âncora do gráfico e da navegação por ano. É estado, não captura única: com
  // a tela montada através da meia-noite, "hoje" e as janelas ficariam de ontem.
  const [now, setNow] = useState(() => new Date());

  // Hidrata a última escolha de período — a menos que o usuário já tenha
  // trocado antes de o AsyncStorage responder (a escolha viva ganha).
  React.useEffect(() => {
    void getJSON<{ period: Period }>(PERIOD_KEY).then((v) => {
      if (!touched.current && v && PERIODS.some((p) => p.key === v.period)) setPeriod(v.period);
    });
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(false);
      setLogs(await fetchHistory(id));
    } catch {
      setError(true);
    }
  }, [id, fetchHistory]);

  // Cobre a primeira entrada E a volta do calendário/editor: dias corrigidos
  // reaparecem aqui sem gesto nenhum. O `now` reavalia junto.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      if (allHabits.length === 0) void loadAll();
      void load();
    }, [load, loadAll, allHabits.length]),
  );

  const changePeriod = (p: Period) => {
    touched.current = true;
    setPeriod(p);
    setYearOffset(0); // volta ao ano corrente ao trocar de período
    void setJSON(PERIOD_KEY, { period: p });
  };

  const detail = useMemo(
    () => (logs ? buildHabitDetail(logs, period, { now, yearOffset }) : null),
    [logs, period, now, yearOffset],
  );
  const shownYear = now.getFullYear() + yearOffset;
  const heat = useMemo(
    () => (logs ? habitYearHeat(logs, shownYear) : null),
    [logs, shownYear],
  );

  const mod = moduleColors(habit?.color ?? '', 'habito');
  const unit = habit?.unit ?? '';
  const isYear = period === 'ano';
  const canPrev = detail?.canPrevYear ?? false;
  const canNext = detail?.canNextYear ?? false;

  const goCalendario = () => router.push('/habitos/dia');

  /** Chevrons de ano — governa o heatmap e (no período Ano) as barras. */
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

  // O `chartWrap` desloca −xs de cada lado; o width soma os 2×xs de volta.
  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2 + spacing.xs * 2;
  const loading = logs === null && !error;
  // Falha de refetch com dados em memória é silenciosa: detalhe de ontem vale
  // mais que a tela de erro (o próximo foco tenta de novo).
  const showError = error && logs === null;
  const empty = detail !== null && detail.allTimeTotal === 0;

  const cost = detail && habit ? habitCost(habit.unitPrice, detail.total) : null;
  const kcal = detail && habit ? habitCalories(habit.name, unit, detail.total) : null;
  const allTimeCost = detail && habit ? habitCost(habit.unitPrice, detail.allTimeTotal) : null;
  const reading = detail
    ? weekdayReading(detail.weekdayTotals, detail.total, detail.days, unit, habit?.unitPrice)
    : null;

  /** A barra que a leitura do gráfico descreve — a maior do período. */
  const topBucket = useMemo(() => {
    if (!detail || detail.total <= 0) return null;
    return [...detail.buckets].sort((a, b) => b.value - a.value)[0] ?? null;
  }, [detail]);

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
          {habit && (
            <>
              <View style={[styles.iconBox, { backgroundColor: mod.tint }]}>
                <Ionicons name={habitIconToIonicon(habit.icon)} size={17} color={mod.onTint} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle} numberOfLines={1}>{habit.name}</Text>
                {!habit.active && <Text style={styles.headerHint}>Arquivado</Text>}
              </View>
            </>
          )}
        </View>
        {/* Editor a um toque — o tap da lista agora abre o detalhe, não ele. */}
        <Pressable
          onPress={() => router.push({ pathname: '/habitos/editor', params: { id } })}
          disabled={!habit}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Editar hábito"
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
          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : empty ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: mod.tint }]}>
            <Ionicons name={habitIconToIonicon(habit?.icon ?? '')} size={28} color={mod.onTint} />
          </View>
          <Text style={styles.emptyTitle}>Nenhum registro ainda</Text>
          <Text style={styles.emptyText}>
            Some no contador da tela Hoje, ou abra o calendário para preencher dias passados.
          </Text>
          {/* CTA no cromo da marca, não no acento do módulo: só o par
              primary/onPrimary tem contraste garantido nos quatro eixos. */}
          <Pressable onPress={goCalendario} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <Ionicons name="calendar-outline" size={16} color={colors.onPrimary} />
            <Text style={styles.ctaText}>Editar dias</Text>
          </Pressable>
        </View>
      ) : detail && habit ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Segmented options={PERIODS} value={period} onChange={changePeriod} />
            {isYear && yearNav}

            <View style={styles.tilesRow}>
              <Tile
                value={fmt(detail.total)}
                label={unit || 'no período'}
                delta={detail.delta}
                bad={habit.bad}
              />
              <Tile value={fmt(detail.perLoggedDay)} label={`${unit} por dia\ncom registro`} />
              <Tile value={String(detail.days)} label="dias" delta={detail.daysDelta} bad={habit.bad} />
              <Tile
                value={detail.best ? fmt(detail.best.value) : '—'}
                label={detail.best ? `maior dia\n${fmtDay(detail.best.date).slice(0, -5)}` : 'maior dia'}
              />
            </View>
            {detail.delta !== null && (
              <Text style={styles.tilesCaption}>variação sobre o período anterior</Text>
            )}

            {/* Estimativas — separadas dos números medidos por uma linha, e
                sempre com a premissa por extenso: são ordem de grandeza. */}
            {(cost !== null || kcal !== null) && (
              <View style={styles.derived}>
                <View style={styles.derivedRow}>
                  {cost !== null && (
                    <Text style={styles.derivedBig}>≈{fmtMoneyAuto(cost)}</Text>
                  )}
                  {kcal !== null && (
                    <Text style={styles.derivedSide}>≈{kcal.toLocaleString('pt-BR')} kcal</Text>
                  )}
                </View>
                <Text style={styles.derivedWhy}>
                  {habit.unitPrice != null
                    ? `estimado a ${fmt(habit.unitPrice)} €/${unit || 'un'}${kcal !== null ? ' e pela densidade da bebida' : ''} · ±15%`
                    : 'estimativa pela densidade da bebida · ±15%'}
                </Text>
              </View>
            )}

            <View style={styles.chartWrap}>
              <BarChart buckets={detail.buckets} width={chartWidth} color={mod.accent} emphasis="max" />
            </View>
            {topBucket && topBucket.value > 0 && (
              <Text style={styles.reading}>
                {`Maior: ${topBucket.label} com ${fmt(topBucket.value)} ${unit}`}
                {habitCost(habit.unitPrice, topBucket.value) !== null
                  ? ` (≈${fmtMoneyAuto(habitCost(habit.unitPrice, topBucket.value)!)})`
                  : ''}
                {topBucket.count > 0 ? `, em ${topBucket.count} ${topBucket.count === 1 ? 'dia' : 'dias'}.` : '.'}
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dia da semana</Text>
            <MiniBars values={detail.weekdayTotals} labels={DIAS_ABREV_SEG} accent={mod.accent} unit={unit} />
            {reading && <Text style={styles.reading}>{reading}</Text>}
          </View>

          {/* Só no período 'sempre': em 12m e Ano os baldes já SÃO meses, e a
              sazonalidade repetiria as barras de cima com outro rótulo. */}
          {detail.monthTotals && period === 'sempre' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sazonalidade</Text>
              <MiniBars values={detail.monthTotals} labels={MESES_INICIAIS} accent={mod.accent} unit={unit} />
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Histórico</Text>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Último registro</Text>
              <Text style={styles.metricValue}>{fmtLast(detail.daysSinceLast)}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Primeira vez</Text>
              <Text style={styles.metricValue}>
                {detail.firstDate ? fmtDay(detail.firstDate) : '—'}
              </Text>
            </View>
            <View style={[styles.metricRow, allTimeCost === null && styles.metricRowLast]}>
              <Text style={styles.metricLabel}>Total histórico</Text>
              <Text style={styles.metricValue}>{`${fmt(detail.allTimeTotal)} ${unit}`}</Text>
            </View>
            {allTimeCost !== null && (
              <View style={[styles.metricRow, styles.metricRowLast]}>
                <Text style={styles.metricLabel}>Gasto histórico</Text>
                <Text style={styles.metricValue}>≈{fmtMoneyAuto(allTimeCost)}</Text>
              </View>
            )}
          </View>

          {heat && (
            <View style={styles.card}>
              <View style={styles.heatHeader}>
                <Text style={styles.cardTitle}>Dias do ano</Text>
                {!isYear && yearNav}
              </View>
              <YearHeatGrid weeks={heat} habit={habit} accent={mod.accent} onPress={goCalendario} />
              <Pressable
                onPress={goCalendario}
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

  tilesRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  tile: { alignItems: 'center', flex: 1, gap: 1 },
  tileValue: { fontSize: 16, color: colors.ink, fontFamily: fonts.monoBold },
  tileLabel: { fontSize: 10, fontFamily: fonts.sans, color: colors.ink3, textAlign: 'center' },
  delta: { fontSize: 10, fontFamily: fonts.monoBold },
  // `.text`, não `.accent`: acento promete 3,0 (objeto gráfico) e isto é letra (ADR 0024).
  deltaUp: { color: roleColors('green').text },
  deltaDown: { color: roleColors('red').text },
  // Reserva a linha mesmo sem variação, senão os tiles desalinham entre si.
  deltaVoid: { fontSize: 10, fontFamily: fonts.mono },
  deltaFlat: { fontSize: 10, fontFamily: fonts.mono, color: colors.ink4 },
  tilesCaption: { fontSize: 10, fontFamily: fonts.sans, color: colors.ink4, textAlign: 'center' },

  derived: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
    gap: 2,
  },
  derivedRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  derivedBig: { fontSize: 21, fontFamily: fonts.monoBold, color: colors.ink },
  derivedSide: { fontSize: 13, fontFamily: fonts.mono, color: colors.ink2 },
  derivedWhy: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3 },

  chartWrap: { marginHorizontal: -spacing.xs },
  reading: { fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink2, lineHeight: 16 },

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
  miniCount: { fontSize: 9, fontFamily: fonts.mono, color: colors.ink3 },
  miniLabel: { fontSize: 9, fontFamily: fonts.sans, color: colors.ink3 },

  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  navBtn: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMute },
  navLabel: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink, minWidth: 48, textAlign: 'center' },

  heatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heatPress: { alignItems: 'center' },
  heatMonthRow: { height: 13, position: 'relative' },
  heatMonth: { position: 'absolute', top: 0, fontSize: 8.5, fontFamily: fonts.sans, color: colors.ink3 },
  heatCols: { flexDirection: 'row', gap: HEAT_GAP },
  heatCol: { gap: HEAT_GAP },
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
