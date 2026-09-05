import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  NIGHT_REFERENCE_H,
  clockOfAxis,
  formatHm,
  signedMin,
  type PeriodKind,
  type SleepBucket,
  type SleepRetro,
} from '@vitale/shared';
import { colors, fonts, radii, shadows, sleepColors, spacing, useThemedStyles } from '../theme';
import { CompositionBar } from './sono/BeforeAfter';

interface Props {
  retro: SleepRetro;
  kind: PeriodKind;
  /** 'Total' não tem período anterior — as variações somem. */
  noPrior: boolean;
}

const NOUN: Record<PeriodKind, string> = {
  week: 'semana', month: 'mês', season: 'estação', year: 'ano', all: 'período',
};
/** Dias do período — o "de 31 noites" da linha de amostra. `null` = não se sabe de antemão. */
function daysIn(kind: PeriodKind): number | null {
  return kind === 'week' ? 7 : null;
}
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function dm(day: string): string {
  return `${Number(day.slice(8, 10))}/${day.slice(5, 7)}`;
}
function weekRange(key: string): string {
  const a = new Date(`${key}T12:00:00`);
  const b = new Date(a);
  b.setDate(a.getDate() + 6);
  return `${a.getDate()}–${b.getDate()} ${MES[b.getMonth()]}`;
}

/**
 * O bloco **Sono** da Retrospectiva — a noite típica do período, dita em fatos.
 *
 * Segue a diagramação dos blocos vizinhos: número grande, linhas de fato, caixa
 * de correções. Cada linha responde uma pergunta de domingo: quanto dormi,
 * quando, quanto fiquei acordado, de que o sono foi feito, como acordei. As
 * diferenças saem em minutos; só as duas de cabeçalho (dormido, acordado) têm
 * tom, e o saldo contra uma meta ficou fora por decisão (05/09/2026).
 *
 * Tudo vem pronto de `sleepRetro` (shared): a tela só escreve. As cores são as
 * de `sleepColors()` — azul dorme, rosa sonha, amarelo acorda.
 */
export function SleepRetroCard({ retro, kind, noPrior }: Props) {
  const styles = useThemedStyles(createStyles);
  const sc = sleepColors();
  const { cur, prev, delta, ratings, weekend, weeks, sourceChange } = retro;
  const d = noPrior ? null : delta;
  const noun = NOUN[kind];
  const days = daysIn(kind);

  const toneOf = (min: number, higherIsWorse: boolean, flat: number) => {
    if (Math.abs(min) < flat) return colors.ink3;
    const worse = higherIsWorse ? min > 0 : min < 0;
    return worse ? colors.redText : colors.greenText;
  };

  const aw = cur.awake;
  const st = cur.stages;
  const stageRows: { label: string; color: string; value: string; d: number | null }[] = st
    ? [
        { label: 'REM', color: sc.rem, value: formatHm(st.rem), d: d?.remMin ?? null },
        { label: 'Leve', color: sc.light, value: formatHm(st.core), d: d?.coreMin ?? null },
        { label: 'Profundo', color: sc.deep, value: formatHm(st.deep), d: d?.deepMin ?? null },
        ...(aw ? [{ label: 'Acordado', color: sc.awake, value: `${Math.round(aw.minMean)} min`, d: d?.awakeMin ?? null }] : []),
      ]
    : [];

  const showWeeks = (kind === 'month' || kind === 'season') && weeks.filter((w) => w.nights >= 3).length >= 2;
  const showWeekend = kind !== 'week' && weekend !== null;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>
        Sono <Text style={styles.eyebrowN}>· {cur.nights} {days ? `de ${days} ` : ''}{cur.nights === 1 ? 'noite' : 'noites'}</Text>
      </Text>

      <Text style={styles.big}>
        {formatHm(cur.asleepH)}
        {d && prev && (
          <Text style={[styles.bigDelta, { color: toneOf(d.asleepMin, false, 5) }]}>  {signedMin(d.asleepMin)} vs {noun} anterior</Text>
        )}
      </Text>
      <Text style={styles.lab}>
        dormindo por noite · {cur.nightsAtReference} de {cur.nights} com {NIGHT_REFERENCE_H} h ou mais
      </Text>

      <View style={styles.row}>
        <Text style={styles.rowL}>Apagou · acordou</Text>
        <Text style={styles.rowR}>{clockOfAxis(cur.onset.median)} · {clockOfAxis(cur.wake.median)}</Text>
      </View>
      <Text style={styles.labTight}>
        medianas · miolo {clockOfAxis(cur.onset.p25)}–{clockOfAxis(cur.onset.p75)} e {clockOfAxis(cur.wake.p25)}–{clockOfAxis(cur.wake.p75)}
      </Text>

      <Text style={styles.sub}>Acordado por noite</Text>
      {aw ? (
        <>
          <Text style={styles.mid}>
            {Math.round(aw.minMean)}<Text style={styles.unit}> min</Text>
            {d && d.awakeMin !== null && (
              <Text style={[styles.bigDelta, { color: toneOf(d.awakeMin, true, 3) }]}>  {signedMin(d.awakeMin)}</Text>
            )}
          </Text>
          <Text style={styles.lab}>
            {aw.countMean.toFixed(1).replace('.', ',')} despertares por noite · {aw.nightsWith} de {aw.reporting} noites com despertar
            {aw.longest ? ` · o mais longo ${Math.round(aw.longest.min)} min (${dm(aw.longest.day)} às ${clockOfAxis(aw.longest.at)})` : ''}
          </Text>
        </>
      ) : (
        <Text style={styles.lab}>a fonte não reporta despertares neste período</Text>
      )}

      {st && (
        <>
          <Text style={styles.sub}>Por fase — a noite média</Text>
          <CompositionBar stages={st} awakeMin={aw?.minMean ?? null} palette={sc} />
          {stageRows.map((r) => (
            <View key={r.label} style={styles.row}>
              <View style={styles.rowLWrap}>
                <View style={[styles.dot, { backgroundColor: r.color }]} />
                <Text style={styles.rowL}>{r.label}</Text>
              </View>
              <Text style={styles.rowR}>
                {r.value}
                {r.d !== null && <Text style={styles.rowDelta}>  {signedMin(r.d)}</Text>}
              </Text>
            </View>
          ))}
        </>
      )}

      {showWeeks && <WeeksStrip weeks={weeks} color={sc.sleep} />}

      {showWeekend && weekend && (
        <>
          <Text style={styles.sub}>Fim de semana × semana</Text>
          <View style={styles.row}>
            <Text style={styles.rowL}>Meio do sono</Text>
            <Text style={styles.rowR}>{Math.abs(weekend.midpointLaterMin)} min mais {weekend.midpointLaterMin >= 0 ? 'tarde' : 'cedo'}</Text>
          </View>
          <Text style={styles.labTight}>
            {weekend.freeNights} noites livres · {weekend.workNights} de semana · acordar {signedMin(weekend.wakeLaterMin)} no fim de semana
          </Text>
        </>
      )}

      {ratings && (
        <>
          <Text style={styles.sub}>Como você acordou</Text>
          <View style={styles.row}>
            <Text style={styles.rowL}>
              <Text style={{ color: sc.sleep }}>{'●'.repeat(Math.round(ratings.mean))}</Text>
              <Text style={{ color: colors.ink4 }}>{'●'.repeat(5 - Math.round(ratings.mean))}</Text>
              <Text style={styles.rowMono}>  {ratings.mean.toFixed(1).replace('.', ',')}/5</Text>
            </Text>
            <Text style={styles.rowR}>{ratings.n} {ratings.n === 1 ? 'noite' : 'noites'} com nota</Text>
          </View>
          {ratings.hi && (
            <View style={styles.row}>
              <Text style={styles.rowL}>Nota 4–5 ({ratings.hi.n})</Text>
              <Text style={styles.rowR}>{formatHm(ratings.hi.asleepH)}{ratings.hi.awakeMin !== null ? ` · ${ratings.hi.awakeMin} min acordado` : ''}</Text>
            </View>
          )}
          {ratings.lo && (
            <View style={styles.row}>
              <Text style={styles.rowL}>Nota ≤3 ({ratings.lo.n})</Text>
              <Text style={styles.rowR}>{formatHm(ratings.lo.asleepH)}{ratings.lo.awakeMin !== null ? ` · ${ratings.lo.awakeMin} min acordado` : ''}</Text>
            </View>
          )}
        </>
      )}

      <Text style={styles.note}>
        {prev ? `${noun.charAt(0).toUpperCase()}${noun.slice(1)} anterior: ${prev.nights} ${prev.nights === 1 ? 'noite' : 'noites'}. ` : noPrior ? '' : `Sem noites no ${noun} anterior. `}
        {st ? 'Fases são estimativa do relógio, comparáveis com você mesmo. ' : ''}
        {sourceChange ? `A comparação cruza a troca para ${sourceChange.label} (${dm(sourceChange.day)}): despertares não se comparam.` : ''}
      </Text>
    </View>
  );
}

/** A noite média de cada semana do mês — para ver o mês mover. */
function WeeksStrip({ weeks, color }: { weeks: SleepBucket[]; color: string }) {
  const styles = useThemedStyles(createStyles);
  const shown = weeks.filter((w) => w.nights >= 3);
  const max = Math.max(9, ...shown.map((w) => w.asleepH));
  return (
    <>
      <Text style={styles.sub}>Semana a semana</Text>
      <View style={styles.weeks}>
        {shown.map((w) => (
          <View key={w.key} style={styles.week}>
            <Text style={styles.weekVal}>{formatHm(w.asleepH)}</Text>
            <View style={styles.weekTrack}>
              <View style={[styles.weekBar, { height: Math.max(3, (w.asleepH / max) * 40), backgroundColor: color }]} />
            </View>
            <Text style={styles.weekLab}>{weekRange(w.key)}</Text>
            <Text style={styles.weekN}>n{w.nights}{w.awakeMin !== null ? ` · ${Math.round(w.awakeMin)} min` : ''}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

const createStyles = () =>
  StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: radii['2xl'], padding: spacing.lg, gap: 4, ...shadows.card },
    eyebrow: { fontSize: 11, fontFamily: fonts.sansBold, textTransform: 'uppercase', letterSpacing: 1.1, color: colors.ink3, marginBottom: 4 },
    eyebrowN: { textTransform: 'none', letterSpacing: 0, fontFamily: fonts.sansMedium },
    big: { fontSize: 28, fontFamily: fonts.mono, color: colors.ink, letterSpacing: -0.5 },
    mid: { fontSize: 22, fontFamily: fonts.mono, color: colors.ink, letterSpacing: -0.3 },
    unit: { fontSize: 13, color: colors.ink3, fontFamily: fonts.sans },
    bigDelta: { fontSize: 13, fontFamily: fonts.sansSemiBold, letterSpacing: 0 },
    lab: { fontSize: 12.5, color: colors.ink3, fontFamily: fonts.sans, lineHeight: 17 },
    labTight: { fontSize: 12, color: colors.ink3, fontFamily: fonts.sans, marginTop: -4 },
    sub: { fontSize: 12.5, fontFamily: fonts.sansBold, color: colors.ink2, marginTop: spacing.md, marginBottom: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
    rowLWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    dot: { width: 9, height: 9, borderRadius: 2 },
    rowL: { fontSize: 13.5, color: colors.ink2, fontFamily: fonts.sans },
    rowR: { fontSize: 13.5, color: colors.ink, fontFamily: fonts.mono, textAlign: 'right' },
    rowDelta: { fontSize: 12, color: colors.ink3, fontFamily: fonts.sans },
    rowMono: { fontSize: 12, fontFamily: fonts.mono, color: colors.ink },
    note: { fontSize: 11.5, lineHeight: 16, color: colors.ink3, fontFamily: fonts.sans, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: 'dashed' },
    weeks: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', marginTop: 4 },
    week: { flex: 1, alignItems: 'center' },
    weekVal: { fontSize: 10, fontFamily: fonts.mono, color: colors.ink2, marginBottom: 2 },
    weekTrack: { height: 40, width: '100%', justifyContent: 'flex-end', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
    weekBar: { width: '60%', borderRadius: 3 },
    weekLab: { fontSize: 9.5, color: colors.ink3, fontFamily: fonts.mono, marginTop: 4 },
    weekN: { fontSize: 9, color: colors.ink4, fontFamily: fonts.mono },
  });
