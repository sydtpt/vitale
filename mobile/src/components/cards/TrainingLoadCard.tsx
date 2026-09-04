import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { buildFormCurve, buildTrainingLoad, localDateStr, type Activity } from '@vitale/shared';
import { colors, fonts, radii, roleColors, shadows, spacing, useThemedStyles } from '../../theme';
import {
  SCALE_MAX,
  canShowLoad,
  loadState,
  strainTrend,
  type LoadTone,
  type TextureTone,
} from '../../lib/training-load-view';

/**
 * Carga da semana — o terceiro cartão do Histórico.
 *
 * Fecha a sequência que já existe na aba: a Consistência pergunta "apareci?", a
 * Carga semanal pergunta "e a que custo?", e este pergunta **"e está subindo
 * rápido demais?"**. Mora aqui, e não na Hoje, porque a leitura é de escala
 * semanal: medido nos dados reais, o ACWR troca de faixa a cada três dias e se
 * move 0,24 por dia — quase metade da largura da faixa "dentro do costume".
 * Boa parte desse movimento é borda de janela, não treino. Num cartão diário
 * isso lê como defeito; aqui, ao lado das outras duas leituras da semana, é o
 * que se veio ver.
 *
 * Todo texto e todo tom saem de `training-load-view.ts`; aqui só se desenha.
 *
 * A escala tem as fronteiras **borradas de propósito**. Elas vêm de estudos
 * contestados e foram calibradas sobre o ACWR acoplado, enquanto o número
 * classificado é o desacoplado, mais sensível (ADR 0027). Uma linha dura em 0,8
 * e 1,5 daria a elas uma autoridade que não têm — o degradê diz que a transição
 * é gradual, porque o corpo não muda de regime em 1,4999.
 */

/** Altura da faixa da escala e do trilho dentro dela. */
const SCALE_H = 22;
const TRACK_Y = 7;
const TRACK_H = 8;
/** Meia-largura da caixa de cada rótulo de fronteira, para centrá-lo. */
const TICK_HALF = 14;
/** Geometria das barrinhas de esforço. */
const BAR_W = 7;
const BAR_GAP = 3;
const BAR_H = 20;
/** Altura da barra que representa semana sem leitura. */
const BAR_STUB = 2;

/** As fronteiras rotuladas sob a escala. */
const TICKS = [0.8, 1.3, 1.5];

/**
 * Paradas do degradê, em porcentagem da largura. As fronteiras caem em 40%, 65%
 * e 75% (domínio 0 a 2); cada parada passa **antes e depois** da sua fronteira,
 * então a troca de cor é um degradê e não uma linha.
 */
const STOPS: { offset: string; role: 'blue' | 'green' | 'yellow' | 'red' }[] = [
  { offset: '0%', role: 'blue' },
  { offset: '34%', role: 'blue' },
  { offset: '46%', role: 'green' },
  { offset: '59%', role: 'green' },
  { offset: '70%', role: 'yellow' },
  { offset: '73%', role: 'yellow' },
  { offset: '81%', role: 'red' },
  { offset: '100%', role: 'red' },
];

interface Props {
  /** Atividades já filtradas pela tela; o núcleo ignora as ocultas de todo jeito. */
  activities: Activity[];
  /** `false` até o primeiro load terminar — o cartão não aparece antes. */
  loaded: boolean;
}

export function TrainingLoadCard({ activities, loaded }: Props) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  // Largura útil, medida: a escala é desenhada em SVG e precisa de pixels.
  const [width, setWidth] = useState(0);

  // Recalcula quando a lista muda ou o dia vira, como o cartão da curva. O
  // instante fica fora das deps de propósito: é a chave do dia que importa.
  const today = localDateStr();
  const curve = useMemo(
    () => buildFormCurve(activities, {}, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, today],
  );
  const load = useMemo(() => buildTrainingLoad(curve.series), [curve.series]);
  const trend = useMemo(() => strainTrend(curve.series), [curve.series]);

  if (!canShowLoad(loaded, curve.series)) return null;

  const state = loadState(load, curve.trusted, curve.daysSinceLastActivity);

  const toneColor = (tone: LoadTone): string => {
    if (tone === 'mute') return colors.ink3;
    const role = tone === 'under' ? 'blue' : tone === 'optimal' ? 'green' : tone === 'caution' ? 'yellow' : 'red';
    return roleColors(role).text;
  };
  const toneDot = (tone: LoadTone): string => {
    if (tone === 'mute') return colors.ink4;
    const role = tone === 'under' ? 'blue' : tone === 'optimal' ? 'green' : tone === 'caution' ? 'yellow' : 'red';
    return roleColors(role).accent;
  };
  const textureColor = (tone: TextureTone): string =>
    tone === 'alert' ? roleColors('yellow').text : tone === 'mute' ? colors.ink3 : colors.ink;

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const markerX =
    state.body.kind === 'scale'
      ? Math.max(3.5, Math.min(width - 3.5, (Math.min(state.body.value, SCALE_MAX) / SCALE_MAX) * width))
      : 0;

  const trendMax = trend.reduce<number>((m, v) => (v !== null && v > m ? v : m), 0);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>CARGA DA SEMANA</Text>
        <Text style={styles.ratio}>{state.ratioText}</Text>
      </View>

      <View
        style={styles.heroRow}
        accessible
        accessibilityLabel={`Carga da semana: ${state.headline}${state.chip ? `, ${state.chip}` : ''}`}
      >
        <Text style={[styles.hero, { color: toneColor(state.tone) }]}>{state.headline}</Text>
        {state.chip && (
          <View style={styles.chip}>
            <View style={[styles.chipDot, { backgroundColor: toneDot(state.tone) }]} />
            <Text style={[styles.chipText, { color: toneColor(state.tone) }]}>{state.chip}</Text>
          </View>
        )}
      </View>

      {state.body.kind === 'scale' && (
        <View onLayout={onLayout} accessible={false} importantForAccessibility="no-hide-descendants">
          {width > 0 && (
            <>
              <Svg width={width} height={SCALE_H} opacity={state.body.muted ? 0.32 : 1}>
                <Defs>
                  <LinearGradient id="cargaFaixas" x1="0" y1="0" x2="1" y2="0">
                    {STOPS.map((s, i) => (
                      <Stop key={i} offset={s.offset} stopColor={roleColors(s.role).accent} />
                    ))}
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={TRACK_Y} width={width} height={TRACK_H} rx={4} fill="url(#cargaFaixas)" />
                {/* Halo da cor da superfície: o marcador precisa ler sobre
                    qualquer zona do degradê. */}
                <Rect x={markerX - 3.5} y={1} width={7} height={20} rx={3.5} fill={colors.surface} />
                <Rect x={markerX - 1.5} y={2.5} width={3} height={17} rx={1.5} fill={colors.ink} />
              </Svg>
              <View style={styles.ticks}>
                {TICKS.map((t) => (
                  <Text
                    key={t}
                    style={[styles.tick, { left: (t / SCALE_MAX) * width - TICK_HALF }]}
                  >
                    {t.toFixed(1).replace('.', ',')}
                  </Text>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {state.body.kind === 'void' && <Text style={styles.voidText}>{state.body.text}</Text>}

      {state.body.kind === 'alert' && (
        <Pressable
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => router.push('/configuracoes/conexoes')}
          style={({ pressed }) => [styles.alertRow, pressed && styles.pressed]}
        >
          <Ionicons name="alert-circle-outline" size={14} color={colors.primaryDeep} />
          <Text style={styles.alertText}>{state.body.text}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
        </Pressable>
      )}

      <View style={styles.sep} />

      <View style={styles.row} accessible accessibilityLabel={`Textura da semana: ${state.texture.note}`}>
        <Text style={styles.rowLabel}>Textura</Text>
        <Text style={[styles.rowValue, { color: textureColor(state.texture.tone) }]}>
          {state.texture.value}
        </Text>
        <Text style={styles.rowNote}>{state.texture.note}</Text>
      </View>

      <View style={styles.row} accessible accessibilityLabel="Esforço acumulado nas últimas oito semanas">
        <Text style={styles.rowLabel}>Esforço</Text>
        <View style={styles.bars}>
          {trend.map((v, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  // Semana sem leitura vira toco, não barra zerada: strain zero e
                  // strain indefinido são coisas diferentes.
                  height: v === null || trendMax <= 0 ? BAR_STUB : Math.max(BAR_STUB, (v / trendMax) * BAR_H),
                  backgroundColor: i === trend.length - 1 ? colors.ink2 : colors.ink4,
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.rowNote}>8 semanas</Text>
      </View>

      <Text style={styles.footer}>{state.footer}</Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii['2xl'],
      padding: spacing.lg,
      marginTop: spacing.md,
      gap: 10,
      ...shadows.card,
    },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
    eyebrow: { fontSize: 12.5, letterSpacing: 0.6, fontFamily: fonts.sansBold, color: colors.ink2 },
    ratio: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.ink3 },
    heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
    hero: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 42 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
    chipDot: { width: 7, height: 7, borderRadius: radii.pill },
    chipText: { fontSize: 12, fontFamily: fonts.sansSemiBold, flexShrink: 1 },
    ticks: { height: 12, marginTop: 1 },
    tick: { position: 'absolute', width: TICK_HALF * 2, textAlign: 'center', fontFamily: fonts.mono, fontSize: 8.5, color: colors.ink3 },
    voidText: { fontSize: 12.5, lineHeight: 17, fontFamily: fonts.sans, color: colors.ink2 },
    alertRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    alertText: { flex: 1, fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 15, color: colors.ink2 },
    pressed: { opacity: 0.7 },
    sep: { height: 1, backgroundColor: colors.line },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowLabel: { width: 62, fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink2 },
    rowValue: { fontFamily: fonts.monoSemiBold, fontSize: 12.5 },
    rowNote: { flex: 1, fontSize: 12, fontFamily: fonts.sans, color: colors.ink3 },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: BAR_GAP, height: BAR_H },
    bar: { width: BAR_W, borderRadius: 1.5 },
    footer: { fontSize: 11, lineHeight: 15, fontFamily: fonts.sans, color: colors.ink3 },
  });
