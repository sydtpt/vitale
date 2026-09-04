import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Activity, ActivityConsistency, HeatCell, HeatStep, Heatmap } from '@vitale/shared';
import { buildActivityConsistency, consistencyStep, contrast, mix, totalsDelta } from '@vitale/shared';
import { HeatmapGrid, type HeatRamp } from '../HeatmapGrid';
import { colors, fonts, radii, roleColors, shadows, spacing, useTheme, useThemedStyles } from '../../theme';

/**
 * Um mês de treino em 28 células — apareci ou não, e quanto.
 *
 * ## Por que a grade não é um calendário
 *
 * A coluna não significa dia da semana e a janela não começa numa segunda: são
 * os 28 dias fechados mais recentes, terminando em **ontem**. Em troca de perder
 * o eixo de dia da semana — que a leitura ao tocar a célula devolve — a grade
 * fica sempre com quatro linhas cheias, sem buraco no começo nem na ponta.
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
 * A escala: um matiz só — o laranja do treino — e a meta como salto.
 *
 * A rampa padrão do `HeatmapGrid` é a do **sono**, onde quente marca a noite
 * ruim. Herdá-la aqui invertia a leitura: um dia de descanso saía vermelho e um
 * treino forte saía azul, brigando com a metáfora física de que calor é esforço.
 *
 * A primeira rampa própria usava dois matizes — azul abaixo da meta, laranja
 * acima. Não sobreviveu ao uso: dois matizes em volta de um neutro têm cara de
 * escala divergente, e nessa gramática um azul forte lê "muito abaixo da meta"
 * — o contrário do que ele significava aqui (quase na meta). No claro a
 * leitura invertia de verdade.
 *
 * Com um matiz, a ordem vive só na luminância — imune a daltonismo, idêntica
 * nos dois esquemas: neutro é o dia parado, e o laranja engrossa com os
 * minutos. Abaixo da meta tudo fica pálido e parecido, e a saturação **salta**
 * no primeiro degrau que bate: o salto é a linha da meta, sem segundo matiz
 * nem marcador. A granularidade do lado de cá importa menos, de propósito — o
 * toque na célula devolve o número.
 *
 * Nenhuma cor é literal: tudo sai dos papéis da paleta ativa por `mix`, então a
 * grade acompanha as seis paletas e os dois esquemas sem uma linha de hex.
 */
function useConsistencyRamp(): HeatRamp {
  // Lido a cada render de propósito: `roleColors` e `colors` seguem o tema ativo,
  // e memoizar congelaria a grade na paleta em que ela montou.
  useTheme();
  const hot = roleColors('orange').accent;
  const surface = colors.surface;

  const bg: Record<HeatStep, string> = {
    [-3]: colors.line, //              0 min — neutro, fora da rampa
    [-2]: mix(hot, surface, 0.86), //  pálidos e parecidos: não bateu
    [-1]: mix(hot, surface, 0.72),
    0: mix(hot, surface, 0.42), //     bateu — a saturação salta aqui
    1: mix(hot, surface, 0.22),
    2: hot, //                         o mais saturado
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
  weeks = 4,
  now,
}: {
  activities: Activity[];
  weeklyTargetMin: number;
  /** Linhas da grade. 4 = 28 células, quatro linhas de sete, sempre cheias. */
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
      // A janela é corrida: a primeira célula é a primeira coluna, sempre.
      pad: 0,
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
        showWeekdays={false}
        emptyHint={`toque num dia · ${c.activeDays} de ${c.days.length} dias com treino`}
      />

      <Score c={c} weeks={weeks} ramp={ramp} />

      <View style={styles.footer}>
        <Stat value={`${c.activeDays}/${c.days.length}`} label="dias com treino" />
        <Stat value={`${c.metDays}`} label="bateram a meta" />
        <Stat value={`${c.longestStreak}`} label="maior sequência" />
      </View>
    </View>
  );
}

/** Altura útil do gráfico das barrinhas, em pixels. */
const BAR_H = 34;

/**
 * O score das quatro semanas.
 *
 * É uma divisão, não uma nota: esforço acumulado ÷ meta do período — a mesma
 * grandeza da linha da OMS no gráfico de barras logo acima do card. Um índice
 * composto (0–100 misturando volume, aderência e regularidade) lê mais fácil e
 * não sobrevive à pergunta "de onde saiu esse 78"; esta conta qualquer um refaz.
 *
 * As quatro barrinhas são a **derivação** do número grande, uma por linha da
 * grade e na mesma ordem. Sem elas, 112% feito de uma semana enorme e três
 * paradas passaria como período bom — exatamente o padrão que um painel de
 * consistência existe para denunciar, não para esconder. Elas se pintam com a
 * mesma rampa das células, então a barra de uma semana forte é a mesma cor dos
 * dias fortes que a formaram.
 */
function Score({ c, weeks, ramp }: { c: ActivityConsistency; weeks: number; ramp: HeatRamp }) {
  const styles = useThemedStyles(createStyles);
  if (c.targetTotalS <= 0) return null;

  const pct = Math.round((c.totalS / c.targetTotalS) * 100);
  const delta = totalsDelta(c.totalS, c.previousTotalS);

  const blockTargetS = c.targetS * 7;
  const ratios = c.blocks.map((b) => (blockTargetS > 0 ? b.effectiveS / blockTargetS : 0));
  // A meta fica no topo enquanto ninguém a ultrapassa; quando alguém passa, o
  // eixo cresce e a linha desce. Assim uma semana de 250% não achata as outras
  // três contra o chão, e a referência continua visível.
  const scale = Math.max(1, ...ratios);

  return (
    <View style={styles.score}>
      <View style={styles.scoreHead}>
        <Text style={styles.scoreValue}>{pct}%</Text>
        <Text style={styles.scoreLabel}>da meta de {weeks} semanas</Text>
        {delta !== null && (
          <View style={styles.scoreDeltaBox}>
            <Text
              style={[
                styles.scoreDelta,
                delta > 0 ? styles.scoreDeltaUp : delta < 0 ? styles.scoreDeltaDown : styles.scoreDeltaFlat,
              ]}
            >
              {delta === 0 ? '=' : `${delta > 0 ? '↑' : '↓'}${Math.abs(delta)}%`}
            </Text>
            <Text style={styles.scoreDeltaSub}>vs. {weeks * 7} dias antes</Text>
          </View>
        )}
      </View>

      <View style={styles.plot}>
        {c.blocks.map((b, i) => {
          const r = ratios[i];
          return (
            <View key={b.start} style={styles.slot}>
              {r > 0 && (
                <View
                  style={[
                    styles.bar,
                    {
                      // Mínimo de 3 px: uma semana de 4% existe e some se a
                      // altura for só proporcional.
                      height: Math.max(3, (r / scale) * BAR_H),
                      backgroundColor: ramp.bg[consistencyStep(b.effectiveS, blockTargetS)],
                    },
                  ]}
                />
              )}
            </View>
          );
        })}
        <View style={styles.baseline} />
        {/* Com `scale` em 1 a meta é o teto do gráfico; sem o clamp a linha cai
            fora da caixa e some. */}
        <View style={[styles.metaLine, { bottom: Math.min(BAR_H - 1, BAR_H / scale) }]} />
      </View>

      <View style={styles.plotLabels}>
        {ratios.map((r, i) => (
          <Text key={c.blocks[i].start} style={styles.barTxt}>
            {Math.round(r * 100)}%
          </Text>
        ))}
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
    score: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: spacing.sm,
      marginTop: spacing.xs,
      gap: 6,
    },
    scoreHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    scoreValue: { fontSize: 22, fontFamily: fonts.monoBold, color: colors.ink },
    scoreLabel: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3, flexShrink: 1 },
    scoreDeltaBox: { marginLeft: 'auto', alignItems: 'flex-end' },
    scoreDelta: { fontSize: 12, fontFamily: fonts.monoBold },
    // `.text` e não `.accent`: o acento promete 3,0 (piso de objeto gráfico) e
    // isto é letra, que quer 4,5. Ver ADR 0024.
    scoreDeltaUp: { color: roleColors('green').text },
    scoreDeltaDown: { color: roleColors('red').text },
    scoreDeltaFlat: { color: colors.ink4 },
    scoreDeltaSub: { fontSize: 9.5, fontFamily: fonts.sans, color: colors.ink4 },

    plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: BAR_H },
    slot: { flex: 1, justifyContent: 'flex-end' },
    bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    baseline: {
      position: 'absolute', left: 0, right: 0, bottom: 0, height: 1,
      backgroundColor: colors.line,
    },
    metaLine: {
      position: 'absolute', left: 0, right: 0, height: 1,
      backgroundColor: colors.ink4,
    },
    plotLabels: { flexDirection: 'row', gap: 6 },
    barTxt: {
      flex: 1, textAlign: 'center', fontSize: 9.5,
      fontFamily: fonts.mono, color: colors.ink3,
    },

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
