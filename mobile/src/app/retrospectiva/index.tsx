import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  latestAvailableOffset,
  habitCalories,
  buildRetroLede,
  visibleBlocks,
  resolveRetroPrefs,
  type RetroBlockId,
  type RetroPrefs,
  layoutEditable,
  toggleBlock,
  moveBlock,
  RETRO_BLOCKS,
  DEATH_DAYS,
  localDateStr as localDayStr,
  YEAR_SERIES,
  MONTH_FULL_PT,
  type YearSerieKey,
  type PeriodKind,
  type RecapValue,
  type HighlightIcon,
  type RetroHabitRow,
  type RetroHealthRow,
  type RetroRegistroRow,
  type SportStats,
  type SportBestEffort,
} from '@vitale/shared';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { formatClock } from '../../lib/workout-format';
import { useRetroStore, retroSince } from '../../store/retro.store';
import { useActivitiesStore } from '../../store/activities.store';
import { useSettingsStore } from '../../store/settings.store';
import { HeatmapGrid } from '../../components/HeatmapGrid';
import { TaskGridStrip } from '../../components/TaskGridStrip';
import { SleepRetroCard } from '../../components/SleepRetroCard';

const KINDS: PeriodKind[] = ['week', 'month', 'season', 'year', 'all'];
const KIND_LABEL: Record<PeriodKind, string> = {
  week: 'Semana', month: 'Mês', season: 'Estação', year: 'Ano', all: 'Total',
};

/** Cabeçalho da manchete — nomeia o período contado, como a chamada de um jornal. */
const LEDE_EYEBROW: Record<PeriodKind, string> = {
  week: 'A semana em poucas frases',
  month: 'O mês em poucas frases',
  season: 'A estação em poucas frases',
  year: 'O ano em poucas frases',
  all: 'Tudo até aqui, em poucas frases',
};

const ICON_MAP: Record<HighlightIcon, keyof typeof Ionicons.glyphMap> = {
  workout: 'barbell-outline', distance: 'walk-outline', sleep: 'moon-outline', heart: 'heart-outline',
  hrv: 'pulse-outline', habit: 'checkmark-circle-outline', warning: 'warning-outline', money: 'wallet-outline',
};
const TONE_COLOR: Record<string, string> = { good: '#6FA86A', bad: '#D9491B', neutral: colors.ink3 };

function num(n: number, d = 0): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function km(m: number): string { return `${num(m / 1000, 1)} km`; }
function brl(v: number): string { return `R$ ${num(v)}`; }
function dur(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}
function deltaVM(r: RecapValue, higherIsWorse: boolean, noPrior = false): { text: string; tone: string } {
  // 'Total' não tem período anterior: prev degenerado faz delta === current.
  if (noPrior) return { text: '', tone: 'neutral' };
  if (r.delta === 0) return { text: '—', tone: 'neutral' };
  const worse = higherIsWorse ? r.delta > 0 : r.delta < 0;
  const sign = r.delta > 0 ? '+' : '−';
  const text = r.deltaPct != null ? `${sign}${num(Math.abs(r.deltaPct))}%` : `${sign}${num(Math.abs(r.delta))}`;
  return { text, tone: worse ? 'bad' : 'good' };
}

/** Quantidade de hábito: inteiro sem casas, fracionário com 1. */
function qty(n: number, unit: string): string {
  const v = Number.isInteger(n) ? num(n) : num(n, 1);
  return unit ? `${v} ${unit}` : v;
}
/** Linha de apoio do hábito: média diária + dias com registro (+ kcal estimadas). */
function habitSub(h: RetroHabitRow): string {
  const dias = `${h.recap.current} ${h.recap.current === 1 ? 'dia' : 'dias'}`;
  const kcal = habitCalories(h.name, h.unit, h.total.current);
  const extra = kcal == null ? '' : ` · ≈${num(kcal)} kcal`;
  const base = h.perDayDays === 0 ? dias : `${qty(h.perDay, h.unit)}/dia · ${dias}`;
  return `${base}${extra}`;
}
/** Linha de apoio do registro: frequência das marcações no período. */
function registroSub(r: RetroRegistroRow): string {
  if (r.recap.current === 0) return 'sem marcações neste período';
  if (r.everyDays <= 1) return 'todo dia';
  return `1× a cada ${qty(r.everyDays, '')} dias`;
}

function speedKmh(mps: number | null): string {
  return mps == null ? '—' : `${num(mps * 3.6, 1)} km/h`;
}
function paceStr(mps: number | null): string {
  if (mps == null || mps <= 0) return '—';
  return `${formatClock(1000 / mps)} /km`;
}
/** Delta de velocidade/pace — maior m/s é melhor nos dois esportes. */
function speedDeltaVM(sp: SportStats, asPace: boolean, noPrior: boolean): { text: string; tone: string } {
  const { current, prior } = sp.speedMps;
  if (noPrior || current == null || prior == null) return { text: '', tone: 'neutral' };
  const tone = current === prior ? 'neutral' : current > prior ? 'good' : 'bad';
  if (asPace) {
    const diff = 1000 / current - 1000 / prior; // s/km; negativo = mais rápido
    if (Math.abs(diff) < 1) return { text: '—', tone: 'neutral' };
    return { text: `${diff > 0 ? '+' : '−'}${formatClock(Math.abs(diff))}/km`, tone };
  }
  const diff = (current - prior) * 3.6;
  if (Math.abs(diff) < 0.05) return { text: '—', tone: 'neutral' };
  return { text: `${diff > 0 ? '+' : '−'}${num(Math.abs(diff), 1)} km/h`, tone };
}
/** Delta de um recorde vs melhor do período anterior (menos tempo = melhor). */
function bestDeltaVM(b: SportBestEffort, noPrior: boolean): { text: string; tone: string } {
  if (noPrior || b.priorSeconds == null) return { text: '', tone: 'neutral' };
  const diff = b.seconds - b.priorSeconds;
  if (diff === 0) return { text: '—', tone: 'neutral' };
  return { text: `${diff > 0 ? '+' : '−'}${formatClock(Math.abs(diff))}`, tone: diff < 0 ? 'good' : 'bad' };
}
/** Data curta dd/mm/aa — 'Total' atravessa anos. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

export default function RetrospectivaScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), []);

  const [kind, setKind] = useState<PeriodKind>('week');
  const [offset, setOffset] = useState<number>(() => latestAvailableOffset(now, 'week'));

  const ensure = useRetroStore((s) => s.ensure);
  const loaded = useRetroStore((s) => s.loaded);
  const summaryFn = useRetroStore((s) => s.summary);
  const highlightsFn = useRetroStore((s) => s.highlights);
  const yearFn = useRetroStore((s) => s.yearByMonth);
  const heatmapFn = useRetroStore((s) => s.heatmap);
  const taskGridFn = useRetroStore((s) => s.taskGrid);
  const allActs = useActivitiesStore((s) => s._all);

  useFocusEffect(useCallback(() => {
    void ensure(retroSince(now, kind, offset));
  }, [ensure, now, kind, offset]));
  useEffect(() => { void ensure(retroSince(now, kind, offset)); }, [ensure, now, kind, offset]);

  const summary = useMemo(() => summaryFn(now, kind, offset), [summaryFn, now, kind, offset, loaded, allActs]);
  // A manchete sai da lista **completa** de destaques; a lista exibida é a fatiada.
  // Derivar aqui evita recalcular buildRetrospective só para o lede.
  const allHighlights = useMemo(() => highlightsFn(now, kind, offset), [highlightsFn, now, kind, offset, loaded, allActs]);
  const highlights = useMemo(() => allHighlights.slice(0, 6), [allHighlights]);
  const lede = useMemo(() => buildRetroLede(allHighlights), [allHighlights]);
  const buckets = useMemo(() => kind === 'year' ? yearFn(now, offset) : [], [yearFn, now, kind, offset, loaded, allActs]);

  // Forma 02 — o heatmap. Só nos períodos em que uma célula por dia ainda é legível;
  // um ano inteiro em células diárias vira ruído, e o modo Ano já tem as barras.
  const heat = useMemo(
    () => (kind === 'week' || kind === 'month' || kind === 'season')
      ? heatmapFn(now, kind, offset, 'sono')
      : null,
    [heatmapFn, now, kind, offset, loaded],
  );

  // Faixa das diárias. Semana e mês só: a faixa é UMA linha por tarefa, então N
  // vira largura — 31 células já ficam com ~7px num telefone, e uma estação (92)
  // não caberia de jeito nenhum. É também o recorte que a pergunta pede: "quantos
  // dias por mês eu lembrei".
  const taskGrid = useMemo(
    () => (kind === 'week' || kind === 'month') ? taskGridFn(now, kind, offset) : null,
    [taskGridFn, now, kind, offset, loaded],
  );

  // Forma 03 — qual das seis séries está desenhada, e qual mês está tocado.
  const [serie, setSerie] = useState<YearSerieKey>('workouts');
  const [mes, setMes] = useState<number | null>(null);
  const serieDef = YEAR_SERIES.find((s) => s.key === serie) ?? YEAR_SERIES[0];
  const serieMax = Math.max(1, ...buckets.map(serieDef.pick));

  const canNext = offset < latestAvailableOffset(now, kind);
  const changeKind = (k: PeriodKind) => { setKind(k); setOffset(latestAvailableOffset(now, k)); };
  /** 'Total' não tem período anterior nem navegação ‹ ›. */
  const noPrior = kind === 'all';

  const kpis = [
    { icon: 'barbell-outline' as const, label: 'Treinos', value: `${summary.fitness.count.current}`, d: deltaVM(summary.fitness.count, false, noPrior) },
    { icon: 'checkmark-done-outline' as const, label: 'Tarefas', value: `${summary.tasks.total.current}`, d: deltaVM(summary.tasks.total, false, noPrior) },
    // Passos, não distância: a distância já aparece no card de treinos e só conta
    // o que virou atividade — os passos medem o movimento do dia inteiro.
    { icon: 'footsteps-outline' as const, label: 'Passos', value: num(summary.fitness.steps.current), d: deltaVM(summary.fitness.steps, false, noPrior) },
    { icon: 'wallet-outline' as const, label: 'Compras', value: brl(summary.purchases.spend.current), d: deltaVM(summary.purchases.spend, true, noPrior) },
  ];

  const healthValue = (h: RetroHealthRow) => h.recap.current == null ? '—' : `${num(h.recap.current, h.decimals)}${h.unit}`;
  const healthDelta = (h: RetroHealthRow) => {
    if (h.recap.current == null || h.recap.delta == null) return { text: '', tone: 'neutral' };
    const worse = h.higherIsWorse ? h.recap.delta > 0 : h.recap.delta < 0;
    const sign = h.recap.delta >= 0 ? '+' : '−';
    return { text: `${sign}${num(Math.abs(h.recap.delta), h.decimals)}${h.unit}`, tone: h.recap.delta === 0 ? 'neutral' : worse ? 'bad' : 'good' };
  };

  // Ordem e visibilidade vêm das preferências; `visibleBlocks` já filtra o que
  // não faz sentido no período (heatmap fora do ano, séries só no ano).
  const retroPrefs = useSettingsStore((st) => st.preferences?.retroPrefs);
  const updatePreferences = useSettingsStore((st) => st.updatePreferences);
  const [editando, setEditando] = useState(false);
  const hojeStr = useMemo(() => localDayStr(now), [now]);
  const prefs = useMemo(() => resolveRetroPrefs(retroPrefs ?? null), [retroPrefs]);
  const editavel = layoutEditable(prefs, hojeStr);

  /** Grava e carimba o início da prova de gráfica na primeira edição. */
  const salvarPrefs = useCallback((next: RetroPrefs) => {
    void updatePreferences({
      retroPrefs: next.proofStartedOn ? next : { ...next, proofStartedOn: hojeStr },
    });
  }, [updatePreferences, hojeStr]);

  const blocosVisiveis = useMemo(
    () => visibleBlocks(prefs, kind),
    [prefs, kind],
  );

  // Cada seção é um bloco com id — é o que torna esconder e reordenar barato o
  // bastante para o "incluo, testo e removo" do usuário funcionar (spec v2 §6).
  const BLOCOS: Partial<Record<RetroBlockId, React.ReactNode>> = {
    lede: (
      <>
    {/* A manchete — antes de qualquer número (spec v2 §3). Um jornal abre
                contando o que aconteceu, não com a tabela. */}
            {!lede.thin && (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>{LEDE_EYEBROW[kind]}</Text>
                {lede.sentences.map((s, i) => (
                  <Text key={i} style={styles.lede}>{s}</Text>
                ))}
                {lede.support ? <Text style={styles.ledeSupport}>{lede.support}</Text> : null}
              </View>
            )}
      </>
    ),
    kpis: (
      <>
    {/* KPIs */}
            <View style={styles.kpis}>
              {kpis.map((k) => (
                <View key={k.label} style={styles.kpi}>
                  <Ionicons name={k.icon} size={18} color={colors.primary} />
                  <Text style={styles.kpiValue}>{k.value}</Text>
                  <Text style={styles.kpiLabel}>{k.label}</Text>
                  <Text style={[styles.kpiDelta, { color: TONE_COLOR[k.d.tone] }]}>{k.d.text}</Text>
                </View>
              ))}
            </View>
      </>
    ),
    highlights: (
      <>
    {/* Destaques */}
            <View style={styles.card}>
              <Text style={styles.eyebrow}>Destaques do período</Text>
              {highlights.length > 0 ? highlights.map((h) => (
                <View key={h.id} style={styles.hl}>
                  <View style={[styles.hlIco, { backgroundColor: TONE_COLOR[h.tone] + '22' }]}>
                    <Ionicons name={ICON_MAP[h.icon]} size={15} color={TONE_COLOR[h.tone]} />
                  </View>
                  {/* `support` carrega a amostra do insight cruzado. Fica visível, não em
                      tooltip: no celular não existe hover. Ver v2-jornal.md §2.3. */}
                  <View style={styles.hlBody}>
                    <Text style={styles.hlText}>{h.text}</Text>
                    {h.support ? <Text style={styles.hlSupport}>{h.support}</Text> : null}
                  </View>
                </View>
              )) : <Text style={styles.empty}>Sem dados suficientes neste período ainda.</Text>}
            </View>
      </>
    ),
    tasks: (
      <>
    {/* Tarefas */}
            <View style={styles.card}>
              <Text style={styles.eyebrow}>Tarefas feitas</Text>
              <Text style={styles.big}>{summary.tasks.total.current}
                <Text style={[styles.bigDelta, { color: TONE_COLOR[deltaVM(summary.tasks.total, false, noPrior).tone] }]}>  {deltaVM(summary.tasks.total, false, noPrior).text}</Text>
              </Text>
              <View style={styles.chips}>
                {summary.tasks.byModule.map((m) => (
                  <Text key={m.key} style={styles.chip}>{m.label} · {m.count}</Text>
                ))}
              </View>
            </View>
      </>
    ),
    dailyTasks: (
      <>
    {/* Séries diárias: quantos dias lembrei, quantos esqueci, e quais. A eleição
                é automática — vale toda tarefa que existe nos sete dias da semana. */}
            {taskGrid && (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>Tarefas — todo dia</Text>
                <Text style={styles.big}>{Math.round(taskGrid.rate * 100)}%
                  <Text style={[styles.bigDelta, { color: colors.ink3 }]}>  {taskGrid.done} de {taskGrid.possible} dias</Text>
                </Text>
                <TaskGridStrip data={taskGrid} />
              </View>
            )}
      </>
    ),
    fitness: (
      <>
    {/* Treinos */}
            <View style={styles.card}>
              <Text style={styles.eyebrow}>Treinos & atividade</Text>
              <View style={styles.miniGrid}>
                <Mini value={`${summary.fitness.count.current}`} label="sessões" />
                <Mini value={km(summary.fitness.distanceM.current)} label="distância" />
                <Mini value={dur(summary.fitness.durationS.current)} label="tempo" />
                <Mini value={`${num(summary.fitness.hardMin.current)}min`} label="carga dura" />
                <Mini value={`${num(summary.fitness.floors.current)}`} label="andares" />
                <Mini value={`${num(summary.fitness.calories.current)}`} label="kcal gastas" />
              </View>
              {summary.fitness.byType.map((t) => (
                <Row key={t.key} l={t.label} r={`${t.count}× · ${km(t.sum || 0)}`} />
              ))}
            </View>
      </>
    ),
    sports: (
      <>
    {/* Ciclismo */}
            {summary.sports.cycling && (
              <SportCard
                title="Ciclismo"
                sp={summary.sports.cycling}
                asPace={false}
                noPrior={noPrior}
                longestLabel="Maior pedalada"
              />
            )}

            {/* Corrida */}
            {summary.sports.running && (
              <SportCard
                title="Corrida"
                sp={summary.sports.running}
                asPace
                noPrior={noPrior}
                longestLabel="Maior corrida"
              />
            )}
      </>
    ),
    health: (
      <>
    {/* Saúde */}
            <View style={styles.card}>
              <Text style={styles.eyebrow}>Saúde & bem-estar</Text>
              {/* Com o bloco Sono existindo, a linha "Sono" (soma por dia) e a nota
                  percebida saem daqui — dois lugares dizendo horas dormidas é o que a
                  v1 fazia com volume. Ver sleep/retro.ts. */}
              {summary.health.filter((h) => !(h.metric === 'sono' && summary.sleep)).map((h) => (
                <View key={h.metric} style={styles.row}>
                  <Text style={styles.rowL}>{h.label}</Text>
                  <Text style={styles.rowR}>{healthValue(h)}  <Text style={{ color: TONE_COLOR[healthDelta(h).tone], fontSize: 12, fontFamily: fonts.sans }}>{healthDelta(h).text}</Text></Text>
                </View>
              ))}
              {summary.ratings.sleep?.current != null && !summary.sleep && <Row l="Sono percebido" r={`${num(summary.ratings.sleep.current, 1)}/5`} />}
              {summary.ratings.day?.current != null && <Row l="Dia percebido" r={`${num(summary.ratings.day.current, 1)}/5`} />}
            </View>
      </>
    ),
    sleep: (
      <>
    {/* Sono — a noite típica do período contra a anterior (sleep/retro.ts).
                Só existe com noites gravadas em `sleep_periods`; sem elas, nada aparece
                e a linha "Sono" do card Saúde volta a valer. */}
            {summary.sleep && <SleepRetroCard retro={summary.sleep} kind={kind} noPrior={noPrior} />}
      </>
    ),
    purchases: (
      <>
    {/* Compras */}
            <View style={styles.card}>
              <Text style={styles.eyebrow}>Compras & gastos</Text>
              <Text style={styles.big}>{brl(summary.purchases.spend.current)}
                <Text style={[styles.bigDelta, { color: TONE_COLOR[deltaVM(summary.purchases.spend, true, noPrior).tone] }]}>  {deltaVM(summary.purchases.spend, true, noPrior).text}</Text>
              </Text>
              <Text style={styles.muted}>{summary.purchases.count.current} itens comprados</Text>
              {summary.purchases.byCat.map((c) => (
                <Row key={c.key} l={c.label} r={`${brl(c.sum || 0)} · ${c.count}`} />
              ))}
              <Text style={styles.note}>Gasto estimado a partir de Compras (sem módulo de transações).</Text>
            </View>
      </>
    ),
    habits: (
      <>
    {/* Hábitos */}
            <View style={styles.card}>
              <Text style={styles.eyebrow}>Hábitos & registros</Text>
              {summary.habits.good.length === 0 && summary.habits.bad.length === 0 && summary.registros.length === 0 && <Text style={styles.empty}>Nenhum hábito registrado.</Text>}
              {summary.habits.good.map((h) => (
                <View key={h.id} style={styles.row}>
                  <View style={styles.habitL}>
                    <Text style={styles.rowL}>{h.name}</Text>
                    <Text style={styles.habitSub}>{habitSub(h)}</Text>
                  </View>
                  <Text style={styles.rowR}>{qty(h.total.current, h.unit)}  <Text style={{ color: TONE_COLOR[deltaVM(h.total, false, noPrior).tone], fontSize: 12, fontFamily: fonts.sans }}>{deltaVM(h.total, false, noPrior).text}</Text></Text>
                </View>
              ))}
              {summary.habits.bad.map((h) => (
                <View key={h.id} style={styles.row}>
                  <View style={styles.habitL}>
                    <Text style={styles.rowL}>{h.name}</Text>
                    <Text style={styles.habitSub}>{habitSub(h)}</Text>
                  </View>
                  <Text style={styles.rowR}>{qty(h.total.current, h.unit)}  <Text style={{ color: TONE_COLOR[deltaVM(h.total, true, noPrior).tone], fontSize: 12, fontFamily: fonts.sans }}>{deltaVM(h.total, true, noPrior).text}</Text></Text>
                </View>
              ))}
              {summary.registros.length > 0 && <Text style={styles.sub}>Registros</Text>}
              {summary.registros.map((r) => (
                <View key={r.id} style={styles.row}>
                  <View style={styles.habitL}>
                    <Text style={styles.rowL}>{r.name}</Text>
                    <Text style={styles.habitSub}>{registroSub(r)}</Text>
                  </View>
                  <Text style={styles.rowR}>{r.recap.current}×  <Text style={{ color: colors.ink3, fontSize: 12, fontFamily: fonts.sans }}>{deltaVM(r.recap, false, noPrior).text}</Text></Text>
                </View>
              ))}
            </View>
      </>
    ),
    heatmap: (
      <>
    {/* Heatmap — genérico em N: as células saem do período exibido. Hoje aparece
                no mês (28–31 células); com N=7 é a faixa semanal. Ver v2-jornal.md §4. */}
            {heat && (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>{heat.label} por dia</Text>
                <HeatmapGrid data={heat} />
              </View>
            )}
      </>
    ),
    yearSeries: (
      <>
    {/* Ano: barras por mês. As seis séries do MonthBucket já eram calculadas;
                até aqui só `workouts` era desenhada. Rótulo por barra não cabe em 12
                barras num telefone — o valor vai para a leitura fixa. Ver v2-jornal.md §5. */}
            {kind === 'year' && (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>Por mês — {summary.label}</Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {YEAR_SERIES.map((s) => {
                    const on = s.key === serie;
                    return (
                      <Pressable
                        key={s.key}
                        onPress={() => { setSerie(s.key); setMes(null); }}
                        hitSlop={6}
                        style={[styles.serieChip, on && { backgroundColor: colors.surface, borderColor: s.color }]}
                      >
                        <View style={[styles.serieDot, { backgroundColor: s.color }]} />
                        <Text style={[styles.serieTxt, on && styles.serieTxtOn]}>{s.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.readout}>
                  <Text style={styles.readoutK}>{mes == null ? 'toque num mês' : MONTH_FULL_PT[mes]}</Text>
                  <Text style={styles.readoutV}>
                    {mes == null ? '' : serieDef.fmt(serieDef.pick(buckets[mes]))}
                  </Text>
                </View>

                <View style={styles.yearGrid}>
                  {buckets.map((b, i) => {
                    const v = serieDef.pick(b);
                    return (
                      <Pressable key={b.month} onPress={() => setMes(i)} hitSlop={4} style={styles.ybar}>
                        <View style={[styles.ybarTrack, i === mes && { borderWidth: 2, borderColor: colors.ink }]}>
                          <View style={[
                            styles.ybarFill,
                            { height: `${Math.round((v / serieMax) * 100)}%`, backgroundColor: serieDef.color },
                          ]} />
                        </View>
                        <Text style={[styles.ybarLabel, i === mes && styles.ybarLabelOn]}>{b.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
      </>
    ),
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Retrospectiva</Text>
        {/* A prova de gráfica é reordenável; depois dela a diagramação congela e
            este botão some — um jornal é igual toda edição (spec v2 §6.1). */}
        {editavel ? (
          <Pressable onPress={() => setEditando((v) => !v)} hitSlop={12}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <Ionicons name={editando ? 'checkmark' : 'options-outline'} size={20} color={colors.ink} />
          </Pressable>
        ) : <View style={styles.iconBtn} />}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]} showsVerticalScrollIndicator={false}>
        {/* Controles */}
        <View style={styles.seg}>
          {KINDS.map((k) => (
            <Pressable key={k} onPress={() => changeKind(k)} style={[styles.segBtn, kind === k && styles.segOn]}>
              <Text style={[styles.segTxt, kind === k && styles.segTxtOn]}>{KIND_LABEL[k]}</Text>
            </Pressable>
          ))}
        </View>
        {kind !== 'all' && (
          <View style={styles.nav}>
            <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={10} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={18} color={colors.ink} />
            </Pressable>
            <Text style={styles.navLabel}>{summary.label}</Text>
            <Pressable onPress={() => canNext && setOffset((o) => o + 1)} disabled={!canNext} hitSlop={10} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={18} color={canNext ? colors.ink : colors.ink3} />
            </Pressable>
          </View>
        )}

                {editando && (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>Diagramação</Text>
            <Text style={styles.editNota}>
              Esconda o que não usa e mova o que usa para cima. Bloco escondido por
              {' '}{DEATH_DAYS} dias sai do app.
            </Text>
            {prefs.order.map((id, i) => {
              const def = RETRO_BLOCKS.find((b) => b.id === id)!;
              const oculto = !!prefs.hidden[id];
              return (
                <View key={id} style={styles.editRow}>
                  <Pressable onPress={() => salvarPrefs(toggleBlock(prefs, id, hojeStr))}
                    disabled={def.fixed} hitSlop={8}>
                    <Ionicons
                      name={def.fixed ? 'lock-closed-outline' : oculto ? 'eye-off-outline' : 'eye-outline'}
                      size={18} color={def.fixed ? colors.ink4 : oculto ? colors.ink3 : colors.primary} />
                  </Pressable>
                  <Text style={[styles.editLbl, oculto && styles.editLblOff]}>{def.label}</Text>
                  <Pressable onPress={() => salvarPrefs(moveBlock(prefs, id, -1))}
                    disabled={i === 0} hitSlop={8}>
                    <Ionicons name="chevron-up" size={18} color={i === 0 ? colors.ink4 : colors.ink2} />
                  </Pressable>
                  <Pressable onPress={() => salvarPrefs(moveBlock(prefs, id, 1))}
                    disabled={i === prefs.order.length - 1} hitSlop={8}>
                    <Ionicons name="chevron-down" size={18}
                      color={i === prefs.order.length - 1 ? colors.ink4 : colors.ink2} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {blocosVisiveis.map((b) => (
          <React.Fragment key={b.id}>{BLOCOS[b.id]}</React.Fragment>
        ))}

      </ScrollView>
    </View>
  );
}

function Mini({ value, label, delta }: { value: string; label: string; delta?: { text: string; tone: string } }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>
        {label}
        {delta && delta.text !== '' && (
          <Text style={{ color: TONE_COLOR[delta.tone], fontFamily: fonts.sansSemiBold }}>  {delta.text}</Text>
        )}
      </Text>
    </View>
  );
}

/** Card de esporte (Ciclismo/Corrida): minis + maior atividade + recordes. */
function SportCard({ title, sp, asPace, noPrior, longestLabel }: {
  title: string;
  sp: SportStats;
  asPace: boolean;
  noPrior: boolean;
  longestLabel: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{title}</Text>
      <View style={styles.miniGrid}>
        <Mini value={`${sp.sessions.current}`} label="sessões" delta={deltaVM(sp.sessions, false, noPrior)} />
        <Mini value={km(sp.distanceM.current)} label="distância" delta={deltaVM(sp.distanceM, false, noPrior)} />
        <Mini value={dur(sp.movingS.current)} label="em movimento" delta={deltaVM(sp.movingS, false, noPrior)} />
        <Mini value={`${num(sp.elevationM.current)} m`} label={asPace ? 'subida' : 'elevação'} delta={deltaVM(sp.elevationM, false, noPrior)} />
        <Mini
          value={asPace ? paceStr(sp.speedMps.current) : speedKmh(sp.speedMps.current)}
          label={asPace ? 'pace médio' : 'vel. média'}
          delta={speedDeltaVM(sp, asPace, noPrior)}
        />
        <Mini value={num(sp.calories.current)} label="kcal" delta={deltaVM(sp.calories, false, noPrior)} />
      </View>
      {sp.longest && (
        <Row l={longestLabel} r={`${km(sp.longest.distanceM)} · ${shortDate(sp.longest.date)}`} />
      )}
      {sp.bestEfforts.length > 0 && (
        <>
          <Text style={styles.sub}>Recordes do período</Text>
          {sp.bestEfforts.map((b) => {
            const d = bestDeltaVM(b, noPrior);
            return (
              <View key={b.key} style={styles.row}>
                <Text style={styles.rowL}>{b.label}</Text>
                <Text style={styles.rowR}>
                  {formatClock(b.seconds)}
                  {d.text !== '' && <Text style={{ color: TONE_COLOR[d.tone], fontSize: 12, fontFamily: fonts.sans }}>  {d.text}</Text>}
                </Text>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}
function Row({ l, r }: { l: string; r: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowL}>{l}</Text>
      <Text style={styles.rowR}>{r}</Text>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: fonts.serif, color: colors.ink },
  content: { padding: spacing.lg, gap: spacing.md },

  seg: { flexDirection: 'row', backgroundColor: colors.surfaceMute, borderRadius: 12, padding: 3, gap: 2 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: colors.surface, ...shadows.card },
  segTxt: { fontSize: 12, fontFamily: fonts.sansSemiBold, color: colors.ink2 }, // 12: "Estação" cabe com 5 abas
  segTxtOn: { color: colors.ink },

  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  navBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, ...shadows.card },
  navLabel: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink, minWidth: 130, textAlign: 'center' },

  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: '48%', backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 2, ...shadows.card },
  kpiValue: { fontSize: 22, fontFamily: fonts.sansBold, color: colors.ink, marginTop: 4 },
  kpiLabel: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3 },
  kpiDelta: { fontSize: 12, fontFamily: fonts.sansSemiBold },

  card: { backgroundColor: colors.surface, borderRadius: radii['2xl'], padding: spacing.lg, gap: spacing.sm, ...shadows.card },
  eyebrow: { fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase', letterSpacing: 1.1, color: colors.ink3, marginBottom: 4 },
  big: { fontSize: 28, fontFamily: fonts.sansBold, color: colors.ink },
  bigDelta: { fontSize: 13, fontFamily: fonts.sansSemiBold },
  muted: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink3 },
  note: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3, fontStyle: 'italic', marginTop: 6 },
  sub: { fontSize: 11, fontFamily: fonts.sansSemiBold, textTransform: 'uppercase', letterSpacing: 1.0, color: colors.ink3, marginTop: 8 },
  empty: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink3 },

  hl: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5 },
  hlIco: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  editNota: { fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink3, lineHeight: 16, marginBottom: 6 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 7 },
  editLbl: { flex: 1, fontSize: 14, fontFamily: fonts.sans, color: colors.ink },
  editLblOff: { color: colors.ink3, textDecorationLine: 'line-through' },
  lede: { fontSize: 15, fontFamily: fonts.sans, lineHeight: 22, color: colors.ink },
  ledeSupport: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3, marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  hlBody: { flex: 1, gap: 2 },
  hlText: { fontSize: 14, fontFamily: fonts.sansMedium, color: colors.ink },
  hlSupport: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { fontSize: 12, fontFamily: fonts.sansSemiBold, color: colors.ink2, backgroundColor: colors.surfaceMute, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowL: { fontSize: 14, fontFamily: fonts.sans, color: colors.ink },
  rowR: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink },
  habitL: { flex: 1, gap: 1 },
  habitSub: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3 },

  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 },
  mini: { width: '46%' },
  miniValue: { fontSize: 18, fontFamily: fonts.sansBold, color: colors.ink },
  miniLabel: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3 },

  yearGrid: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 6 },
  ybar: { flex: 1, alignItems: 'center', gap: 4 },
  ybarTrack: { width: '100%', height: 90, backgroundColor: colors.surfaceMute, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  ybarFill: { width: '100%', backgroundColor: colors.primary, borderRadius: 6, minHeight: 2 },
  ybarLabel: { fontSize: 9, fontFamily: fonts.sans, color: colors.ink3 },
  ybarLabelOn: { color: colors.ink, fontFamily: fonts.sansBold },

  // Forma 03 — seletor de série e leitura por toque (não há hover no celular).
  chipRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  serieChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceMute, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  serieDot: { width: 7, height: 7, borderRadius: 4 },
  serieTxt: { fontSize: 12, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
  serieTxtOn: { color: colors.ink },
  readout: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    backgroundColor: colors.surfaceMute, borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 8, marginTop: 8, minHeight: 34,
  },
  readoutK: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink2 },
  readoutV: { fontSize: 13, fontFamily: fonts.sansBold, color: colors.ink },
});
