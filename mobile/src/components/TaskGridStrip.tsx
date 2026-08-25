/**
 * Faixa de adesão das séries diárias — uma linha por tarefa, uma célula por dia.
 *
 * **Por que faixa e não a grade de 7 colunas do `HeatmapGrid`.** Ali o dado é uma
 * métrica contínua contra uma meta, e a forma de calendário ajuda a achar "as
 * terças". Aqui são várias tarefas ao mesmo tempo e o dado é sim/não: o que se
 * quer é comparar as linhas entre si — quem está falhando mais — e isso pede
 * faixas empilhadas, alinhadas no mesmo eixo de dias.
 *
 * **Largura medida, não percentual.** Mesma razão do `HeatmapGrid`: com 28–31
 * células por linha, arredondar a fração de pixel em cada uma desalinha as faixas
 * entre si e o olho perde a coluna. Mede-se no `onLayout` e deriva-se um lado
 * inteiro; a sobra vai para o fim da linha, não para dentro do desenho.
 *
 * **Respiro por semana.** Um vão maior a cada segunda-feira dá âncora visual —
 * sem ele, 31 quadradinhos iguais viram uma régua ilegível e só o toque informa.
 *
 * **Sem hover:** o dia toca e a leitura fixa abaixo permanece.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { MOD, type TaskGrid, type TaskGridRow, type TaskDayCell } from '@vitale/shared';
import { colors, spacing, radii, useThemedStyles } from '../theme';

const GAP = 2;
/** Vão extra antes de cada segunda-feira. */
const WEEK_GAP = 5;
const DOW_FULL = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Feito usa o verde do módulo Tarefas; esquecido é o laranja da marca, apagado. */
const DONE_BG = MOD.tarefa.accent;
const MISS_BG = '#F5C9B8';

type Sel = { row: TaskGridRow; cell: TaskDayCell };

function dataCurta(day: string): string {
  return `${Number(day.slice(8))} ${MESES[Number(day.slice(5, 7)) - 1]}`;
}

export function TaskGridStrip({ data }: { data: TaskGrid }) {
  const styles = useThemedStyles(createStyles);
  const [sel, setSel] = useState<Sel | null>(null);
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  };

  // Todas as linhas têm o mesmo eixo de dias (garantido por `buildTaskGrid`).
  const n = data.rows[0]?.cells.length ?? 0;
  const semanas = data.rows[0]?.cells.filter((c, i) => i > 0 && c.weekday === 0).length ?? 0;

  const lado = (weekGap: number) =>
    n > 0 ? Math.floor((width - (n > 1 ? GAP * (n - 1) + weekGap * semanas : 0)) / n) : 0;

  // O respiro semanal é um luxo: se apertar, ele sai antes da célula encolher a
  // ponto de sumir. Sem isso, num período longo o `side` iria a zero e a linha
  // transbordaria o card.
  let weekGap = WEEK_GAP;
  let side = width > 0 ? lado(weekGap) : 0;
  if (side < 5) { weekGap = 0; side = width > 0 ? lado(0) : 0; }
  if (side < 2) side = 0;

  return (
    <View onLayout={onLayout}>
      {data.rows.map((row) => (
        <View key={row.id} style={styles.row}>
          <View style={styles.rowHead}>
            <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
            <Text style={styles.count}>
              {row.done}<Text style={styles.countSub}> de {row.possible}</Text>
            </Text>
          </View>

          {side > 0 && (
            <View style={styles.strip}>
              {row.cells.map((c, i) => {
                const on = sel?.row.id === row.id && sel.cell.day === c.day;
                return (
                  <Pressable
                    key={c.day}
                    onPress={() => setSel(on ? null : { row, cell: c })}
                    style={[
                      styles.cell,
                      { width: side, height: side },
                      i > 0 && c.weekday === 0 && weekGap > 0 && { marginLeft: weekGap },
                      c.done === true && { backgroundColor: DONE_BG },
                      c.done === false && { backgroundColor: MISS_BG },
                      on && styles.cellOn,
                    ]}
                  />
                );
              })}
            </View>
          )}
        </View>
      ))}

      <View style={styles.readout}>
        <Text style={styles.readoutK} numberOfLines={1}>
          {sel
            ? `${sel.row.name} · ${dataCurta(sel.cell.day)}, ${DOW_FULL[sel.cell.weekday]}`
            : `toque num dia · ${data.done} de ${data.possible} no total`}
        </Text>
        {sel && (
          <Text style={styles.readoutV}>
            {sel.cell.done === true ? 'feito' : sel.cell.done === false ? 'esqueci' : '—'}
          </Text>
        )}
      </View>

      <View style={styles.legend}>
        <View style={[styles.swatch, { backgroundColor: DONE_BG }]} />
        <Text style={styles.legendTxt}>feito</Text>
        <View style={[styles.swatch, { backgroundColor: MISS_BG }]} />
        <Text style={styles.legendTxt}>esqueci</Text>
        <View style={[styles.swatch, styles.swatchOff]} />
        <Text style={styles.legendTxt}>fora da janela</Text>
      </View>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  row: { marginBottom: spacing.md },
  rowHead: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginBottom: 5, gap: spacing.sm,
  },
  name: { fontSize: 13, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  count: { fontSize: 13, fontWeight: '700', color: colors.ink },
  countSub: { fontSize: 11, fontWeight: '500', color: colors.ink3 },

  strip: { flexDirection: 'row', gap: GAP },
  cell: {
    borderRadius: 2,
    backgroundColor: colors.surfaceMute,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellOn: { borderColor: colors.ink },

  readout: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    backgroundColor: colors.surfaceMute, borderRadius: radii.sm,
    paddingHorizontal: 11, paddingVertical: 8, marginTop: spacing.xs, minHeight: 34, gap: spacing.sm,
  },
  readoutK: { fontSize: 11.5, color: colors.ink2, flexShrink: 1 },
  readoutV: { fontSize: 13, fontWeight: '700', color: colors.ink },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  legendTxt: { fontSize: 9.5, color: colors.ink3, marginRight: 5 },
  swatch: { width: 9, height: 9, borderRadius: 2 },
  swatchOff: { backgroundColor: colors.surfaceMute },
});
