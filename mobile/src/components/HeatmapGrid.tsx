/**
 * Grade divergente de N células — uma por dia do período exibido.
 *
 * **Genérico em N de propósito** (docs/specs/retrospectiva/v2-jornal.md §4): o
 * número de células vem do `Heatmap` que o shared monta, não de um "mês" codificado.
 * Semana ⇒ 7 células, mês ⇒ 28–31, estação ⇒ até ~92. É o que faz a faixa semanal
 * ser um parâmetro em vez de um componente novo.
 *
 * **Sem hover:** no celular o valor aparece numa leitura fixa abaixo da grade e
 * **fica lá** — nada some quando o dedo sai.
 *
 * **Por que o tamanho é medido, e não `aspectRatio`:** com largura percentual dentro
 * de um `flexWrap`, o Yoga não resolve a altura pelo `aspectRatio` — as células saíam
 * achatadas e o número encostava na base. Medir a largura no `onLayout` e derivar um
 * lado inteiro em pixels dá célula quadrada de verdade e texto centrado.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { DIAS_COMPLETOS_SEG, DIAS_LETRAS_SEG, type Heatmap, type HeatCell, type HeatStep } from '@vitale/shared';
import { colors, fonts, spacing, useThemedStyles } from '../theme';

/** Escala divergente: quente abaixo da meta, neutro em cima, frio acima. */
const STEP_BG: Record<HeatStep, string> = {
  [-3]: '#B83C12',
  [-2]: '#F25C2B',
  [-1]: '#FBAF8C',
  0: '#EFE6D8',
  1: '#AFC0E2',
  2: '#6E8CC9',
};

/** Tinta escolhida por contraste sobre cada fundo, não por gosto. */
const STEP_FG: Record<HeatStep, string> = {
  [-3]: '#FFF1EA',
  [-2]: '#4A1A08',
  [-1]: '#5A2612',
  0: '#6B6155',
  1: '#26364F',
  2: '#182338',
};

const STEPS: HeatStep[] = [-3, -2, -1, 0, 1, 2];
const GAP = 4;
const COLS = 7;

function fmt(v: number, decimals: number, unit: string): string {
  return `${v.toFixed(decimals).replace('.', ',')}${unit}`;
}

export interface HeatRamp {
  /** Fundo de cada passo, de -3 a 2. */
  bg: Record<HeatStep, string>;
  /** Tinta sobre cada fundo, escolhida por contraste. */
  fg: Record<HeatStep, string>;
  /** Extremos da legenda. Descreve o eixo, não julga: "parado"/"intenso". */
  lowLabel: string;
  highLabel: string;
}

/**
 * A escala padrão é a do **sono**, e a direção dela não é universal.
 *
 * Aqui quente = abaixo da meta e frio = acima, porque para sono a leitura é
 * "noite ruim é quente, noite calma é fria". Para **esforço** isso se inverte:
 * quente é intenso, frio é parado, e pintar um dia de descanso de vermelho
 * briga com a metáfora física. Por isso a rampa virou parâmetro — ver
 * `ConsistencyCard`, que passa a sua.
 */
const SLEEP_RAMP: HeatRamp = {
  bg: STEP_BG,
  fg: STEP_FG,
  lowLabel: 'pior',
  highLabel: 'melhor',
};

interface Props {
  data: Heatmap;
  /**
   * Linha mostrada enquanto nenhum dia está selecionado. O padrão fala em
   * "medidos", que é a leitura certa para métrica de saúde — uma noite sem dado
   * é dado faltando. Não serve para toda grade: na consistência de treino todo
   * dia foi medido, e um dia de descanso é um zero legítimo, não uma falta.
   */
  emptyHint?: string;
  /** Escala de cor. Padrão: a do sono (quente = abaixo da meta). */
  ramp?: HeatRamp;
  /**
   * Cabeçalho S T Q Q S S D. Só faz sentido quando a grade **é** um calendário —
   * quando a janela está ancorada num dia da semana e a coluna, portanto,
   * significa alguma coisa. Numa janela corrida o cabeçalho seria uma legenda
   * errada, e a leitura ao tocar a célula é que passa a dizer o dia.
   */
  showWeekdays?: boolean;
}

export function HeatmapGrid({ data, emptyHint, ramp = SLEEP_RAMP, showWeekdays = true }: Props) {
  const styles = useThemedStyles(createStyles);
  const [sel, setSel] = useState<HeatCell | null>(null);
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  };

  // Lado inteiro: fração de pixel espalha o erro pelas 7 colunas e desalinha a grade.
  const side = width > 0 ? Math.floor((width - GAP * (COLS - 1)) / COLS) : 0;
  const cell = { width: side, height: side };
  const delta = sel?.value != null ? sel.value - data.target : null;

  return (
    <View onLayout={onLayout}>
      {side > 0 && (
        <>
          {showWeekdays && (
            <View style={styles.head}>
              {DIAS_LETRAS_SEG.map((d, i) => (
                <Text key={i} style={[styles.headTxt, { width: side }]}>{d}</Text>
              ))}
            </View>
          )}

          <View style={styles.grid}>
            {Array.from({ length: data.pad }, (_, i) => (
              <View key={`pad-${i}`} style={cell} />
            ))}
            {data.cells.map((c) => {
              const on = sel?.day === c.day;
              // Não medido ≠ neutro, mas também não precisa gritar: fundo vazado e
              // número apagado leem como "nada aqui" sem virar ruído visual.
              const empty = c.step == null;
              return (
                <Pressable
                  key={c.day}
                  onPress={() => setSel(on ? null : c)}
                  disabled={empty}
                  style={[
                    styles.cell,
                    cell,
                    !empty && { backgroundColor: ramp.bg[c.step as HeatStep] },
                    on && styles.cellOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.cellTxt,
                      { color: empty ? colors.ink4 : ramp.fg[c.step as HeatStep] },
                    ]}
                  >
                    {Number(c.day.slice(8))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.readout}>
        <Text style={styles.readoutK}>
          {sel
            ? `${Number(sel.day.slice(8))} · ${DIAS_COMPLETOS_SEG[sel.weekday]}`
            : emptyHint ?? `toque num dia · ${data.measured} de ${data.cells.length} medidos`}
        </Text>
        {sel?.value != null && (
          <Text style={styles.readoutV}>
            {fmt(sel.value, data.decimals, data.unit)}
            <Text style={styles.readoutSub}>
              {'  '}{delta! >= 0 ? '+' : '−'}{fmt(Math.abs(delta!), data.decimals, data.unit)} vs. meta
            </Text>
          </Text>
        )}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendTxt}>{ramp.lowLabel}</Text>
        <View style={styles.swatches}>
          {STEPS.map((s) => (
            <View key={s} style={[styles.swatch, { backgroundColor: ramp.bg[s] }]} />
          ))}
        </View>
        <Text style={styles.legendTxt}>{ramp.highLabel}</Text>
        <Text style={[styles.legendTxt, styles.legendTarget]}>
          meta {fmt(data.target, data.decimals, data.unit)}
        </Text>
      </View>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  head: { flexDirection: 'row', gap: GAP, marginBottom: 5 },
  headTxt: { textAlign: 'center', fontSize: 9, fontFamily: fonts.sans, color: colors.ink3, letterSpacing: 0.4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: {
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellOn: { borderColor: colors.ink },
  cellTxt: { fontSize: 11, fontFamily: fonts.sansSemiBold, textAlign: 'center' },

  readout: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    backgroundColor: colors.surfaceMute, borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 8, marginTop: spacing.md, minHeight: 34,
  },
  readoutK: { fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink2, flexShrink: 1 },
  readoutV: { fontSize: 13, fontFamily: fonts.sansBold, color: colors.ink },
  readoutSub: { fontSize: 11, fontFamily: fonts.sansMedium, color: colors.ink2 },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  legendTxt: { fontSize: 9.5, fontFamily: fonts.sans, color: colors.ink3 },
  legendTarget: { marginLeft: 'auto' },
  swatches: { flexDirection: 'row', gap: 2 },
  swatch: { width: 13, height: 9, borderRadius: 2 },
});
