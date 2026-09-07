import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  AWAKE_COUNTED_MIN,
  NIGHT_REFERENCE_H,
  clockOfAxis,
  coverageNote,
  formatHm,
  signedMin,
  type PeriodKind,
  type SleepBand,
  type SleepBucket,
  type SleepRetro,
  type SleepTriggerBoard,
  type SleepWeekRegularity,
} from '@vitale/shared';
import { colors, fonts, radii, shadows, sleepColors, spacing, useThemedStyles } from '../theme';
import { CompositionBar } from './sono/BeforeAfter';
import { SleepScoreDims } from './sono/SleepScoreDims';
import { TypicalAwake } from './sono/TypicalAwake';
import { SleepTriggers } from './sono/SleepTriggers';

interface Props {
  retro: SleepRetro;
  kind: PeriodKind;
  /** 'Total' não tem período anterior — as variações somem. */
  noPrior: boolean;
  /**
   * O que precedeu a noite. Roda em todo o histórico, não no período — por isso
   * chega por fora de `retro`, que é do período. `null` esconde o bloco.
   */
  triggers?: SleepTriggerBoard | null;
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
export function SleepRetroCard({ retro, kind, noPrior, triggers }: Props) {
  const styles = useThemedStyles(createStyles);
  const sc = sleepColors();
  const {
    cur, prev, delta, ratings, weekend, weeks, sourceChange,
    score, medianH, meanMedianSplit, bands, awakeHours, awakeSpread, typical,
    regularityWeeks, extremes,
  } = retro;
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
  // A regularidade por semana precisa de duas semanas com índice: uma só é um
  // número solto, e o que a linha diz é a direção.
  const sriWeeks = regularityWeeks.filter((w) => w.sri !== null);
  const showSri = sriWeeks.length >= 2;
  // As faixas só falam quando há nota em duas delas — senão é contagem, não par.
  const ratedBands = bands.filter((b) => b.rating !== null && b.nights > 0);
  const showBands = ratedBands.length >= 2;
  const peakHour = awakeHours.length > 0 ? awakeHours.reduce((m, h) => (h.nights > m.nights ? h : m)) : null;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>
        Sono <Text style={styles.eyebrowN}>· {cur.nights} {days ? `de ${days} ` : ''}{cur.nights === 1 ? 'noite' : 'noites'}</Text>
      </Text>

      {/* O selo — o resumo em caixa da página, DEPOIS da tarja e ANTES do corpo.
          Ele não é a manchete: a chamada continua sendo `sleepHighlights`. */}
      {score && (
        <View style={styles.seal}>
          <Text style={styles.sealTitle}>Saúde do sono</Text>
          <SleepScoreDims score={score} palette={sc} note={coverageNote(score) ?? undefined} />
        </View>
      )}

      {/* A MEDIANA é o número grande. A média entra na linha de baixo quando as
          duas discordam — esconder uma delas seria publicar o número errado. */}
      <Text style={styles.big}>
        {formatHm(medianH)}
        {d && prev && (
          <Text style={[styles.bigDelta, { color: toneOf(d.asleepMin, false, 5) }]}>  {signedMin(d.asleepMin)} vs {noun} anterior</Text>
        )}
      </Text>
      <Text style={styles.lab}>
        dormindo numa noite típica · {cur.nightsAtReference} de {cur.nights} com {NIGHT_REFERENCE_H} h ou mais
      </Text>
      {meanMedianSplit && (
        <Text style={styles.labTight}>
          a média foi {formatHm(cur.asleepH)} — a noite de {dm(extremes.shortest.day)}, com{' '}
          {formatHm(extremes.shortest.h)}, puxa sozinha
        </Text>
      )}

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
          {awakeSpread && awakeSpread.total > 0 && (
            <View style={styles.row}>
              <Text style={styles.rowL}>De {AWAKE_COUNTED_MIN} min para cima</Text>
              <Text style={styles.rowR}>{awakeSpread.counted}<Text style={styles.rowDelta}>  de {awakeSpread.total}</Text></Text>
            </View>
          )}
          {typical && typical.medianMin !== null && (
            <>
              <TypicalAwake
                typical={typical}
                palette={sc}
                longestDay={typical.longest ? dm(typical.longest.day) : undefined}
              />
              {/* A única leitura de vigília que atravessa a troca de relógio: a
                  contagem por noite cai 4× entre Apple e Garmin, a duração não. */}
              <Text style={styles.labTight}>
                a duração de um despertar não muda de aparelho — a contagem, sim
              </Text>
            </>
          )}
          {peakHour !== null && awakeHours.length >= 3 && (
            <>
              <HoursStrip hours={awakeHours} color={sc.awake} peak={peakHour.nights} />
              <Text style={styles.labTight}>
                a noite quebrou mais entre {clockOfAxis(peakHour.from)} e {clockOfAxis(peakHour.from + 1)} — {peakHour.nights} noites
              </Text>
            </>
          )}
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
      {showSri && <RegularityStrip weeks={sriWeeks} color={sc.deep} />}

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
          {/* O corte ao contrário: parte da DURAÇÃO e mostra a nota. É o que
              responde "vale a pena dormir mais?", que o corte por nota não responde. */}
          {showBands && (
            <>
              <Text style={styles.labTight}>e por quanto você dormiu naquelas noites</Text>
              {ratedBands.map((b) => (
                <View key={b.label} style={styles.row}>
                  <Text style={styles.rowL}>Noites de {b.label} ({b.ratedNights})</Text>
                  <Text style={styles.rowR}>{b.rating!.toFixed(2).replace('.', ',')}</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}

      {/* As duas datas que fecham a página. Jornal nomeia — sem adjetivo. */}
      <Text style={styles.sub}>{noun.charAt(0).toUpperCase()}{noun.slice(1)} em duas datas</Text>
      <View style={styles.row}>
        <Text style={styles.rowL}>{dm(extremes.shortest.day)} — a mais curta</Text>
        <Text style={styles.rowR}>
          {formatHm(extremes.shortest.h)}
          {extremes.worst && extremes.worst.day === extremes.shortest.day && (
            <Text style={styles.rowDelta}>  {extremes.worst.points}/{extremes.worst.max}</Text>
          )}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowL}>{dm(extremes.longest.day)} — a mais longa</Text>
        <Text style={styles.rowR}>
          {formatHm(extremes.longest.h)}
          {extremes.best && extremes.best.day === extremes.longest.day && (
            <Text style={styles.rowDelta}>  {extremes.best.points}/{extremes.best.max}</Text>
          )}
        </Text>
      </View>
      {extremes.best && extremes.best.day !== extremes.longest.day && (
        <View style={styles.row}>
          <Text style={styles.rowL}>{dm(extremes.best.day)} — a de maior contagem</Text>
          <Text style={styles.rowR}>{extremes.best.points}/{extremes.best.max}</Text>
        </View>
      )}

      {triggers && (
        <View style={styles.standing}>
          <Text style={styles.standingTag}>todo o histórico · não é deste {noun}</Text>
          <Text style={styles.sub}>O que precedeu a noite</Text>
          <SleepTriggers board={triggers} palette={sc} />
        </View>
      )}

      <Text style={styles.note}>
        {prev ? `${noun.charAt(0).toUpperCase()}${noun.slice(1)} anterior: ${prev.nights} ${prev.nights === 1 ? 'noite' : 'noites'}. ` : noPrior ? '' : `Sem noites no ${noun} anterior. `}
        {st ? 'Fases são estimativa do relógio, comparáveis com você mesmo. ' : ''}
        {sourceChange ? `A comparação cruza a troca para ${sourceChange.label} (${dm(sourceChange.day)}): despertares não se comparam. ` : ''}
        {score && !score.scored && score.coverage
          ? `${score.coverage.nights} de ${score.coverage.expected} noites gravadas — abaixo do piso, as medidas aparecem e a contagem não.`
          : ''}
      </Text>
    </View>
  );
}

/**
 * A que horas a noite quebrou — conta **noites**, não eventos: uma noite com
 * cinco micro-despertares às 3h vale uma, senão a barra mede o relógio.
 */
function HoursStrip({ hours, color, peak }: { hours: SleepRetro['awakeHours']; color: string; peak: number }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.hours}>
      {hours.map((h) => (
        <View key={h.from} style={styles.hour}>
          <View style={styles.hourTrack}>
            <View
              style={[
                styles.hourBar,
                {
                  height: Math.max(2, (h.nights / peak) * 30),
                  backgroundColor: color,
                  // O pico fica cheio; o resto recua, para o horário aparecer.
                  opacity: h.nights === peak ? 1 : 0.42,
                },
              ]}
            />
          </View>
          <Text style={styles.hourLab}>{clockOfAxis(h.from).slice(0, 2)}</Text>
        </View>
      ))}
    </View>
  );
}

/** A regularidade de cada semana — a única medida com evidência de desfecho. */
function RegularityStrip({ weeks, color }: { weeks: SleepWeekRegularity[]; color: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <Text style={styles.sub}>Regularidade, semana a semana</Text>
      <View style={styles.weeks}>
        {weeks.map((w) => (
          <View key={w.key} style={styles.week}>
            <Text style={styles.weekVal}>{Math.round(w.sri!)}</Text>
            <View style={styles.weekTrack}>
              <View style={[styles.weekBar, { height: Math.max(3, (Math.max(0, w.sri!) / 100) * 40), backgroundColor: color }]} />
            </View>
            <Text style={styles.weekLab}>{weekRange(w.key)}</Text>
            <Text style={styles.weekN}>n{w.nights}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.labTight}>
        índice de 0 a 100 — a chance de você estar no mesmo estado 24 h depois. Abaixo de 72 fica o
        quintil de maior risco do UK Biobank.
      </Text>
    </>
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
    // Os gatilhos falam de outra janela. O vão e a tarja avisam antes do número.
    standing: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line },
    standingTag: {
      fontSize: 9.5, letterSpacing: 0.8, textTransform: 'uppercase',
      color: colors.ink4, fontFamily: fonts.sansSemiBold,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
    rowLWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    dot: { width: 9, height: 9, borderRadius: 2 },
    rowL: { fontSize: 13.5, color: colors.ink2, fontFamily: fonts.sans },
    rowR: { fontSize: 13.5, color: colors.ink, fontFamily: fonts.mono, textAlign: 'right' },
    rowDelta: { fontSize: 12, color: colors.ink3, fontFamily: fonts.sans },
    rowMono: { fontSize: 12, fontFamily: fonts.mono, color: colors.ink },
    note: { fontSize: 11.5, lineHeight: 16, color: colors.ink3, fontFamily: fonts.sans, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, borderStyle: 'dashed' },
    seal: {
      backgroundColor: colors.surfaceMute,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.md,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    sealTitle: { fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.ink3, fontFamily: fonts.sansBold },

    hours: { flexDirection: 'row', gap: 3, alignItems: 'flex-end', marginTop: spacing.sm },
    hour: { flex: 1, alignItems: 'center' },
    hourTrack: { height: 30, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    hourBar: { width: '68%', borderRadius: 2 },
    hourLab: { fontSize: 8, color: colors.ink4, fontFamily: fonts.mono, marginTop: 3 },

    weeks: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', marginTop: 4 },
    week: { flex: 1, alignItems: 'center' },
    weekVal: { fontSize: 10, fontFamily: fonts.mono, color: colors.ink2, marginBottom: 2 },
    weekTrack: { height: 40, width: '100%', justifyContent: 'flex-end', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
    weekBar: { width: '60%', borderRadius: 3 },
    weekLab: { fontSize: 9.5, color: colors.ink3, fontFamily: fonts.mono, marginTop: 4 },
    weekN: { fontSize: 9, color: colors.ink4, fontFamily: fonts.mono },
  });
