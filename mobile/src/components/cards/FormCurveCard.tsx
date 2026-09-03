import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { buildFormCurve, localDateStr, type Activity } from '@vitale/shared';
import { colors, fonts, radii, roleColors, shadows, spacing, useThemedStyles } from '../../theme';
import {
  BAR_LABELS,
  LEGEND_TEXT,
  barScale,
  baseBarColor,
  canShow,
  detailSentence,
  formState,
  sparkSegments,
  sparkValues,
  type FormTone,
} from '../../lib/form-curve-view';

/**
 * Curva de forma na Hoje: um carrossel de dois slides com altura fixa.
 *
 * O trilho mede sempre `RAIL_H`; os slides preenchem essa altura com
 * `space-between` em vez de empilhar conteúdo. Trocar de slide ou de estado
 * (fresco, enterrado, sem confiança, aquecendo) não move nada do que vem
 * depois na tela — é a razão de ser do carrossel. O alerta de sincronização
 * mora dentro do slide, no lugar dos rótulos do eixo, pelo mesmo motivo.
 *
 * A casca de card (superfície, raio, sombra ou contorno) fica no **trilho**, e
 * não nos slides: um `ScrollView` recorta os filhos, e a sombra de um slide
 * seria cortada na borda. Como o trilho tem exatamente o tamanho de um slide,
 * o resultado visual é o mesmo de qualquer outro card da tela.
 *
 * Cor nasce do tema. Cansaço é o papel `rose` na variante de texto; Base é o
 * papel `blue` num passo mais fundo (`baseBarColor`), porque os dois `text`
 * têm a mesma luminância e só o matiz os separaria. Sobra e dívida são `green`
 * e `red`, semânticos. Nenhum hex aqui.
 */

/** Altura do trilho: os dois slides preenchem isto, nunca mais nem menos. */
const RAIL_H = 206;
/** Respiro entre trilho e pílulas + altura da linha de pílulas. Bloco = 223. */
const GAP = 9;
const PILLS_H = 8;
const SLIDE_PAD = 18;
const SPARK_H = 44;
/** Folga à esquerda para o rótulo "0" e à direita para o marcador final. */
const SPARK_LEFT = 10;
const SPARK_RIGHT = 4;
const PAGES = 2;

interface Props {
  /** Dataset completo do store (`_all`); o núcleo já ignora as ocultas. */
  activities: Activity[];
  /** `false` até o primeiro load terminar — o cartão não aparece antes. */
  loaded: boolean;
}

export function FormCurveCard({ activities, loaded }: Props) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  // `ComponentRef<typeof ScrollView>` em vez do genérico direto com o nome do
  // componente: a barreira de `architecture.test.ts` lê esse genérico (e até um
  // comentário com ele) como tag JSX e cobra a prop da barra de rolagem.
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Tamanho útil do trilho, medido no ScrollView (já descontado o contorno que
  // `shadows.card` acrescenta nos temas Clean).
  const [size, setSize] = useState({ width: 0, height: RAIL_H });
  const [page, setPage] = useState(0);
  const { width } = size;

  // Recalcula quando a lista muda ou o dia vira. O instante fica fora das deps
  // de propósito: é a chave do dia que importa, não o `new Date()`.
  const today = localDateStr();
  const curve = useMemo(
    () => buildFormCurve(activities, {}, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, today],
  );

  // Largura mudou (rotação, split view): reencaixa o slide ativo, senão o
  // deslocamento antigo deixa os dois slides pela metade.
  useEffect(() => {
    if (width > 0) scrollRef.current?.scrollTo({ x: page * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  if (!canShow(loaded, curve)) return null;

  const state = formState(curve);
  const green = roleColors('green');
  const red = roleColors('red');
  const toneText: Record<FormTone, string> = { fresh: green.text, buried: red.text, unsure: colors.ink3 };
  const toneMark: Record<FormTone, string> = { fresh: green.accent, buried: red.accent, unsure: colors.ink3 };
  const baseColor = baseBarColor(roleColors('blue').text, colors.ink);
  const fatigueColor = roleColors('rose').text;

  const innerW = Math.max(0, width - 2 * SLIDE_PAD);
  const plotW = Math.max(0, innerW - SPARK_LEFT - SPARK_RIGHT);
  const spark = sparkSegments(sparkValues(curve.series), {
    width: plotW,
    height: SPARK_H,
    pad: 4,
    offsetX: SPARK_LEFT,
  });
  const bars = barScale(curve);
  const detail = detailSentence(curve.series);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize({ width: Math.round(w), height: Math.round(h) });
  };
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) {
      const p = Math.round(e.nativeEvent.contentOffset.x / width);
      setPage(Math.min(PAGES - 1, Math.max(0, p)));
    }
  };
  const goTo = (p: number) => {
    setPage(p);
    scrollRef.current?.scrollTo({ x: p * width, animated: true });
  };

  const slideStyle = [styles.slide, { width, height: size.height }];

  return (
    <View style={styles.block}>
      <View style={styles.rail}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onLayout={onLayout}
          onMomentumScrollEnd={onMomentumEnd}
          style={styles.track}
        >
          {width > 0 && (
            <>
              {/* Slide 1 — Forma de hoje */}
              <View style={slideStyle}>
                <View style={styles.headRow}>
                  <View
                    style={styles.headText}
                    accessible
                    accessibilityLabel={`Forma de hoje: ${state.valueText} de saldo. ${state.phrase}`}
                  >
                    <Text style={styles.eyebrow}>FORMA DE HOJE</Text>
                    <View style={styles.numberRow}>
                      <Text style={[styles.number, { color: toneText[state.tone] }]}>{state.valueText}</Text>
                      <Text style={styles.numberUnit}>de saldo</Text>
                    </View>
                    <Text style={styles.phrase}>{state.phrase}</Text>
                  </View>
                  {state.badge && (
                    <View style={styles.badge} accessible accessibilityLabel={state.badge}>
                      <View style={styles.badgeDot} />
                      <Text style={styles.badgeText}>{state.badge}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.sparkBlock}>
                  {/* Decorativa: o leitor de tela já tem o número e a frase. */}
                  <View accessible={false} importantForAccessibility="no-hide-descendants">
                    <Svg width={innerW} height={SPARK_H}>
                      <Line
                        x1={SPARK_LEFT}
                        y1={spark.zeroY}
                        x2={SPARK_LEFT + plotW}
                        y2={spark.zeroY}
                        stroke={colors.line}
                        strokeWidth={0.8}
                        strokeDasharray="3 3"
                      />
                      <SvgText x={0} y={spark.zeroY} dy={3.2} fontFamily={fonts.mono} fontSize={8} fill={colors.ink3}>
                        0
                      </SvgText>
                      {spark.segments.map((s, i) => (
                        <Path
                          key={i}
                          d={s.d}
                          fill="none"
                          stroke={s.sign > 0 ? green.accent : red.accent}
                          strokeWidth={1.8}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      ))}
                      {spark.end && <Circle cx={spark.end.x} cy={spark.end.y} r={3} fill={toneMark[state.tone]} />}
                    </Svg>
                  </View>

                  {state.footer.kind === 'axis' && (
                    <View style={styles.footRow}>
                      <Text style={styles.axisText}>{state.footer.left}</Text>
                      <Text style={styles.axisText}>{state.footer.right}</Text>
                    </View>
                  )}
                  {state.footer.kind === 'warmup' && (
                    <View style={styles.footRow}>
                      <Text style={styles.noteText}>{state.footer.text}</Text>
                    </View>
                  )}
                  {state.footer.kind === 'alert' && (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                      onPress={() => router.push('/configuracoes/conexoes')}
                      style={({ pressed }) => [styles.footRow, styles.alertRow, pressed && styles.pressed]}
                    >
                      <Ionicons name="alert-circle-outline" size={14} color={colors.primaryDeep} />
                      <Text style={styles.alertText}>{state.footer.text}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Slide 2 — De onde vem */}
              <View style={slideStyle}>
                <View style={styles.headRowCenter}>
                  <Text style={styles.eyebrow}>DE ONDE VEM</Text>
                  <Text style={styles.headHint}>esforço por semana</Text>
                </View>

                <View style={styles.bars}>
                  <BarRow
                    label={BAR_LABELS.base}
                    fill={bars.base}
                    tick={bars.typicalBase}
                    color={baseColor}
                    value={Math.round(curve.base)}
                    styles={styles}
                  />
                  <BarRow
                    label={BAR_LABELS.fatigue}
                    fill={bars.fatigue}
                    tick={bars.typicalFatigue}
                    color={fatigueColor}
                    value={Math.round(curve.fatigue)}
                    styles={styles}
                  />
                  <View style={styles.legend}>
                    <View style={styles.legendTick} />
                    <Text style={styles.legendText}>{LEGEND_TEXT}</Text>
                  </View>
                </View>

                {/* Sem frase a série é curta; a altura é fixa, então nada se move. */}
                <Text style={styles.detail} numberOfLines={2}>
                  {detail ?? ''}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>

      <View style={styles.pills}>
        {['Ver a forma de hoje', 'Ver de onde vem'].map((label, i) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: page === i }}
            hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
            onPress={() => goTo(i)}
            style={[styles.pill, page === i ? styles.pillOn : styles.pillOff]}
          />
        ))}
      </View>
    </View>
  );
}

interface BarRowProps {
  label: string;
  /** Fração 0..1 do trilho. */
  fill: number;
  /** Posição do traço do típico, fração 0..1. */
  tick: number;
  color: string;
  value: number;
  styles: ReturnType<typeof createStyles>;
}

function BarRow({ label, fill, tick, color, value, styles }: BarRowProps) {
  return (
    <View style={styles.barRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${fill * 100}%` as const, backgroundColor: color }]} />
        <View style={[styles.barTick, { left: `${tick * 100}%` as const }]} />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    block: { marginTop: spacing.md },
    // A casca de card mora aqui — ver o cabeçalho do arquivo.
    rail: {
      height: RAIL_H,
      backgroundColor: colors.surface,
      borderRadius: radii['3xl'],
      ...shadows.card,
    },
    track: { flex: 1, borderRadius: radii['3xl'], overflow: 'hidden' },
    slide: {
      padding: SLIDE_PAD,
      justifyContent: 'space-between',
    },
    headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    headText: { flex: 1, minWidth: 0, gap: 2 },
    eyebrow: { fontSize: 12.5, letterSpacing: 0.6, fontFamily: fonts.sansBold, color: colors.ink2 },
    numberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
    number: { fontFamily: fonts.serif, fontSize: 42, lineHeight: 46 },
    numberUnit: { fontSize: 18, fontFamily: fonts.sans, color: colors.ink2 },
    phrase: { fontSize: 14, lineHeight: 19, fontFamily: fonts.sans, color: colors.ink, marginTop: 3 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 96 },
    badgeDot: { width: 6, height: 6, borderRadius: radii.pill, backgroundColor: colors.ink3 },
    badgeText: {
      fontSize: 9.5,
      lineHeight: 12,
      letterSpacing: 0.5,
      fontFamily: fonts.sansBold,
      color: colors.ink3,
      flexShrink: 1,
    },
    sparkBlock: { gap: 4 },
    // As três variantes do rodapé dividem esta altura: nada se move ao trocar.
    footRow: { height: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    axisText: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink3 },
    noteText: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.ink3 },
    alertRow: { gap: 7 },
    alertText: { flex: 1, fontFamily: fonts.sans, fontSize: 11.5, color: colors.ink2 },
    pressed: { opacity: 0.7 },
    headRowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headHint: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3 },
    bars: { gap: 9 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    barLabel: { width: 92, fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink2 },
    barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceMute },
    barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
    barTick: { position: 'absolute', top: -3, width: 2, height: 14, borderRadius: 1, backgroundColor: colors.ink2 },
    barValue: { width: 34, textAlign: 'right', fontFamily: fonts.monoSemiBold, fontSize: 12.5, color: colors.ink },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    legendTick: { width: 2, height: 11, borderRadius: 1, backgroundColor: colors.ink2 },
    legendText: { fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink3 },
    detail: { fontSize: 12.5, lineHeight: 17, fontFamily: fonts.sans, color: colors.ink2, minHeight: 34 },
    pills: {
      height: PILLS_H,
      marginTop: GAP,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    pill: { height: 6, borderRadius: radii.pill },
    pillOn: { width: 16, backgroundColor: colors.ink2 },
    pillOff: { width: 6, backgroundColor: colors.ink4 },
  });
