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
import type { Heatmap, HeatCell, HeatStep } from '@vitale/shared';
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

const DOW = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const DOW_FULL = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const STEPS: HeatStep[] = [-3, -2, -1, 0, 1, 2];
const GAP = 4;
const COLS = 7;

function fmt(v: number, decimals: number, unit: string): string {
  return `${v.toFixed(decimals).replace('.', ',')}${unit}`;
}

interface Props {
  data: Heatmap;
  /**
   * Linha mostrada enquanto nenhum dia está selecionado. O padrão fala em
   * "medidos", que é a leitura certa para métrica de saúde — uma noite sem dado
   * é dado faltando. Não serve para toda grade: na consistência de treino todo
   * dia foi medido, e um dia de descanso é um zero legítimo, não uma falta.
   */
  emptyHint?: string;
}

export function HeatmapGrid({ data, emptyHint }: Props) {
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
          <View style={styles.head}>
            {DOW.map((d, i) => (
              <Text key={i} style={[styles.headTxt, { width: side }]}>{d}</Text>
            ))}
          </View>

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
                    !empty && { backgroundColor: STEP_BG[c.step as HeatStep] },
                    on && styles.cellOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.cellTxt,
                      { color: empty ? colors.ink4 : STEP_FG[c.step as HeatStep] },
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
            ? `${Number(sel.day.slice(8))} · ${DOW_FULL[sel.weekday]}`
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
        <Text style={styles.legendTxt}>pior</Text>
        <View style={styles.swatches}>
          {STEPS.map((s) => (
            <View key={s} style={[styles.swatch, { backgroundColor: STEP_BG[s] }]} />
          ))}
        </View>
        <Text style={styles.legendTxt}>melhor</Text>
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
