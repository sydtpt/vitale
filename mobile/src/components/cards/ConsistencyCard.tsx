import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Activity, HeatCell, HeatStep, Heatmap } from '@vitale/shared';
import { buildActivityConsistency, contrast, mix } from '@vitale/shared';
import { HeatmapGrid, type HeatRamp } from '../HeatmapGrid';
import { colors, fonts, radii, roleColors, shadows, spacing, useTheme, useThemedStyles } from '../../theme';

/**
 * Um mês de treino em 28 células — apareci ou não, e quanto.
 *
 * ## Por que ao lado do gráfico de barras, e não no lugar dele
 *
 * As barras respondem "quanto, e de quê", que é o que elas fazem bem. Não
 * respondem "eu apareci?": num período curto, um dia sem treino vira espaço em
 * branco indistinguível da margem, e é justamente o buraco que interessa num
 * app de acompanhamento. As duas formas convivem porque as perguntas são
 * diferentes.
 *
 * ## O que a célula mede
 *
 * Minutos de **esforço** — a mesma grandeza que a linha da meta da OMS usa no
 * gráfico acima, e não tempo de relógio. Assim os dois painéis do card falam a
 * mesma língua: se a barra diz que a semana bateu a meta, a grade mostra em
 * quais dias isso aconteceu.
 */
/**
 * A escala: frio = parado, quente = intenso.
 *
 * A rampa padrão do `HeatmapGrid` é a do **sono**, onde quente marca a noite
 * ruim. Herdá-la aqui invertia a leitura: um dia de descanso saía vermelho e um
 * treino forte saía azul, brigando com a metáfora física de que calor é esforço.
 *
 * Duas coisas acontecem ao mesmo tempo na rampa, de propósito. A **intensidade**
 * da cor acompanha a magnitude — dia parado é o mais lavado, dia forte é o mais
 * saturado. O **matiz** diz de que lado da meta o dia caiu: frio abaixo, neutro
 * em cima, quente acima. Assim a grade se lê de longe pela intensidade e de
 * perto pelo matiz.
 *
 * Nenhuma cor é literal: tudo sai dos papéis da paleta ativa por `mix`, então a
 * grade acompanha as seis paletas e os dois esquemas sem uma linha de hex.
 */
function useConsistencyRamp(): HeatRamp {
  // Lido a cada render de propósito: `roleColors` e `colors` seguem o tema ativo,
  // e memoizar congelaria a grade na paleta em que ela montou.
  useTheme();
  const cold = roleColors('blue').accent;
  const hot = roleColors('orange').accent;
  const surface = colors.surface;

  const bg: Record<HeatStep, string> = {
    [-3]: mix(cold, surface, 0.74), //  0 min — o mais lavado, e frio
    [-2]: mix(cold, surface, 0.52),
    [-1]: mix(cold, surface, 0.26),
    0: colors.line, //                  em cima da meta — neutro
    1: mix(hot, surface, 0.26),
    2: hot, //                          o mais saturado, e quente
  };

  // Tinta por contraste medido, não por gosto: a mesma regra que a rampa do sono
  // seguia à mão. Escolhe entre a tinta do tema e a superfície, o que ganhar.
  const fg = Object.fromEntries(
    (Object.keys(bg) as unknown as HeatStep[]).map((k) => {
      const b = bg[k];
      return [k, contrast(colors.ink, b) >= contrast(colors.surface, b) ? colors.ink : colors.surface];
    }),
  ) as Record<HeatStep, string>;

  return { bg, fg, lowLabel: 'parado', highLabel: 'intenso' };
}

export function ConsistencyCard({
  activities,
  weeklyTargetMin,
  weeks = 5,
  now,
}: {
  activities: Activity[];
  weeklyTargetMin: number;
  /** Semanas exibidas, alinhadas em segunda-feira. 5 = 35 células, sem buraco à esquerda. */
  weeks?: number;
  now?: Date;
}) {
  const styles = useThemedStyles(createStyles);
  const ramp = useConsistencyRamp();

  const c = useMemo(
    () => buildActivityConsistency(activities, weeklyTargetMin, weeks, now),
    [activities, weeklyTargetMin, weeks, now],
  );

  // O `HeatmapGrid` é genérico sobre `Heatmap`; adaptar aqui evita uma segunda
  // grade que sairia divergindo desta na primeira mudança de estilo.
  const data: Heatmap = useMemo(() => {
    const cells: HeatCell[] = c.days.map((d) => ({
      day: d.day,
      value: Math.round(d.effectiveS / 60),
      step: d.step,
      weekday: d.weekday,
    }));
    return {
      metric: 'esforco',
      label: 'Esforço',
      unit: ' min',
      decimals: 0,
      higherIsWorse: false,
      target: Math.round(c.targetS / 60),
      cells,
      pad: c.pad,
      measured: c.activeDays,
    };
  }, [c]);

  if (c.activeDays === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Consistência · {weeks} semanas</Text>
      <Text style={styles.sub}>
        Minutos de esforço por dia, contra a meta de {Math.round(c.targetS / 60)} min/dia.
      </Text>

      <HeatmapGrid
        data={data}
        ramp={ramp}
        emptyHint={`toque num dia · ${c.activeDays} de ${c.days.length} dias com treino`}
      />

      <View style={styles.footer}>
        <Stat value={`${c.activeDays}/${c.days.length}`} label="dias com treino" />
        <Stat value={`${c.metDays}`} label="bateram a meta" />
        <Stat value={`${c.longestStreak}`} label="maior sequência" />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
      gap: spacing.sm,
      ...shadows.card,
    },
    title: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
    sub: { fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: -4 },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: spacing.sm,
    },
    stat: { alignItems: 'center', flex: 1, gap: 1 },
    statValue: { fontSize: 15, fontFamily: fonts.monoBold, color: colors.ink },
    statLabel: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3 },
  });
