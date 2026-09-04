import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  buildFormCurve,
  buildTrainingLoad,
  localDateStr,
  readinessAdvice,
  type Activity,
  type AdviceTone,
  type ReadinessComponent,
  type ReadinessKey,
  type RoleKey,
} from '@vitale/shared';
import { useHealthStore } from '../../store/health.store';
import { useHealthDailyStore } from '../../store/health-daily.store';
import { usePlannedWorkoutsStore } from '../../store/planned-workouts.store';
import { readinessFromSummaries } from '../../lib/health-readiness';
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
import {
  NO_SCORE_TITLE,
  ageNote,
  bandText,
  canShowReadiness,
  coverageNote,
  noScoreNote,
  scoreLabel,
  scoreText,
  shortLabel,
} from '../../lib/readiness-slide';

/**
 * O corpo hoje: um carrossel de altura fixa com o saldo de forma, de onde ele
 * vem, e a prontidão do dia.
 *
 * Os dois assuntos moram no mesmo bloco porque são o mesmo corpo em duas
 * escalas: o saldo é carga acumulada em semanas, a prontidão é como a noite
 * passou. Juntos custam **um** bloco na Hoje; separados custavam dois, e a
 * prontidão sozinha gastava ~230 pt de coluna para um número que se lê em dois
 * segundos.
 *
 * O trilho mede sempre `RAIL_H`; os slides preenchem essa altura com
 * `space-between` em vez de empilhar conteúdo. Trocar de slide ou de estado
 * (fresco, enterrado, sem confiança, aquecendo) não move nada do que vem
 * depois na tela — é a razão de ser do carrossel. O alerta de sincronização
 * mora dentro do slide, no lugar dos rótulos do eixo, pelo mesmo motivo.
 *
 * **As páginas são dinâmicas.** Curva e prontidão têm fontes de dado
 * independentes: quem nunca sincronizou atividade ainda pode ter dormido, e
 * quem não deu permissão de saúde ainda tem treinos. Cada assunto entra se
 * tiver o que mostrar, o bloco some se nenhum tiver, e as pílulas só aparecem
 * com mais de uma página.
 *
 * **A casca de card viaja com o slide.** Cada página é um cartão inteiro —
 * superfície, raio e sombra ou contorno —, e entre dois cartões há um vinco de
 * `CARD_GAP` por onde se vê o fundo da tela. É o que faz o gesto ler como
 * cartas trocando de lugar, e não como texto correndo atrás de um vidro: com a
 * borda parada o olho fica procurando a moldura, e nenhuma dose de animação no
 * conteúdo resolve isso — a moldura é que precisa andar.
 *
 * Isso custa o recorte, e é por ele que a casca já morou no trilho: um
 * `ScrollView` corta os filhos nas próprias bordas, e a sombra do cartão
 * morreria ali. A saída é o trilho ser **maior** do que mostra e devolver a
 * diferença em margem negativa — `BLEED_V` em cima e embaixo, `CARD_GAP / 2`
 * dos lados. No fluxo ele continua ocupando exatamente `RAIL_H`.
 *
 * O `pagingEnabled` continua valendo porque a página é a **viewport**, não o
 * cartão: o cartão mede `CARD_GAP` a menos e fica centrado nela pela margem, de
 * modo que dois cartões consecutivos avançam exatos `width` — a conta do
 * `onMomentumScrollEnd` e as interpolações não mudam.
 *
 * Sobre isso, o movimento: o deslocamento vem todo do `scrollX`, que é a única
 * fonte de verdade. As camadas do cartão andam em velocidades diferentes
 * (paralaxe), o cartão que sai recua, e o cursor das pílulas escorre junto com
 * o dedo. O estado `page` continua existindo para o leitor de tela e para o
 * clamp de páginas que somem — ele só não manda no visual, e é por isso que
 * arrastar e tocar numa pílula produzem exatamente o mesmo movimento.
 *
 * Tudo isso é `translateX`, `scale` e `opacity` sobre um `Animated.Value`
 * alimentado por evento nativo: roda na thread de UI, sem depender do JS. Nada
 * aqui é animação autônoma — é resposta direta ao gesto —, então não há o que
 * desligar sob "reduzir movimento".
 *
 * Cor nasce do tema. Cansaço é o papel `rose` na variante de texto; Base é o
 * papel `blue` num passo mais fundo (`baseBarColor`), porque os dois `text`
 * têm a mesma luminância e só o matiz os separaria. Sobra e dívida são `green`
 * e `red`, semânticos. Nenhum hex aqui — e nenhum `primary`, que é cromo de
 * marca e não cor de dado.
 */

/**
 * Altura do cartão: os três slides preenchem isto, nunca mais nem menos. O
 * trilho mede `RAIL_H + 2 × BLEED_V` e devolve a diferença em margem negativa,
 * então é este o número que o resto da tela enxerga.
 *
 * Eram 206 com dois slides. A prontidão pediu 8 pt a mais — cabeçalho com nota,
 * barras e o bloco de conselho — e os outros dois absorvem a folga no
 * `space-between`, que só respira. Medido com os rótulos curtos de
 * `readiness-slide.ts`: com os rótulos do núcleo, dois deles quebram em duas
 * linhas e nem 260 bastariam.
 *
 * Foram 214 enquanto a prontidão tinha quatro sinais. A carga é o quinto, e a
 * conta não fecha em 214: com 18 pt de padding em cima e embaixo sobram 178, e o
 * conteúdo passa a medir 36 (cabeçalho) + 91 (cinco barras) + 49 (conselho) =
 * 176. Caber é diferente de respirar — sobrariam 2 pt para os dois vãos do
 * `space-between`, contra os 10 pt que os quatro slides têm hoje. 232 devolve
 * exatamente esses 10 pt, e é a razão de o cartão crescer 18 pt em vez de
 * espremer. As alturas de linha das barras deixaram de ser implícitas
 * (`barLabel`/`barValue`) para que essa conta continue verdadeira.
 */
const RAIL_H = 232;
/** Respiro entre trilho e pílulas + altura da linha de pílulas. Bloco = 231. */
const GAP = 9;
const PILLS_H = 8;
const SLIDE_PAD = 18;
const SPARK_H = 44;
/** Folga à esquerda para o rótulo "0" e à direita para o marcador final. */
const SPARK_LEFT = 10;
const SPARK_RIGHT = 4;

/**
 * Paralaxe entre as camadas do slide, em pontos no extremo da travessia.
 *
 * O slide inteiro anda 1× com o dedo; o cabeçalho fica `HEAD_LAG` atrás e o
 * rodapé chega `FOOT_LEAD` na frente. O miolo (o gráfico, as barras — o dado)
 * não recebe nada: é a âncora contra a qual o resto se move. No meio do gesto
 * a diferença é de ~7 pt, o bastante para o olho ler profundidade sem que
 * ninguém note o truque.
 *
 * Em pontos e não em fração da largura porque a dose certa não muda com o
 * tamanho da tela: 12% da largura num telefone é discreto, num iPad é solavanco.
 */
const HEAD_LAG = 14;
const FOOT_LEAD = 12;
/**
 * Vinco entre dois cartões — é ele que se vê no meio do arrasto, e é por ele
 * que o gesto lê como dois objetos e não como um só. Vale `spacing.lg`, o mesmo
 * gutter que o cartão já tem contra a borda da tela: o cartão que sai parece
 * deslizar para fora mantendo a folga que sempre teve.
 */
const CARD_GAP = spacing.lg;
/**
 * Folga vertical do trilho, para a sombra do cartão caber no recorte. A sombra
 * do tema Orbe desce `8 + 14` (deslocamento mais raio); 18 pega o corpo dela e
 * deixa de fora só a cauda, que é onde ela já é imperceptível. Devolvida em
 * margem negativa, não muda nada do que vem depois na tela.
 */
const BLEED_V = 18;
/**
 * O cartão que sai não some — cartão não é transparente. Ele só cede um pouco
 * de presença para o que entra, para o olho saber qual dos dois seguir no meio
 * da travessia. Fração da largura para o gatilho, opacidade no piso.
 */
const FADE_AT = 0.7;
const FADE_TO = 0.82;
/** E recua: com sombra viajando junto, é isto que vende a profundidade. */
const SLIDE_MIN_SCALE = 0.94;
/**
 * E gira. O cartão à esquerda mostra a face virada para o centro, o da direita
 * também — é a inclinação que transforma "dois retângulos deslizando" em "um
 * baralho sendo folheado". Graus no extremo da travessia: no meio do gesto,
 * onde o olho de fato está, dá metade disto.
 *
 * A perspectiva tem que vir primeira no `transform`, senão a rotação sai chapada.
 */
const CARD_TILT = 14;
const PERSPECTIVE = 900;

/**
 * Pílulas: pontos inertes por baixo — eles dizem quantas páginas existem — e um
 * cursor por cima que translada com o `scrollX`.
 *
 * Largura fixa e só `translateX`/`scaleX` para o cursor caber inteiro no driver
 * nativo; interpolar `width` e `backgroundColor` de cada pílula daria o mesmo
 * desenho pela thread do JS. Como todos os pontos medem igual, a fileira também
 * parou de se remontar a cada troca de página.
 *
 * O cursor **estica no meio do caminho** e volta ao pousar: em `CURSOR_STRETCH`
 * ele fica largo o bastante para cobrir os dois pontos ao mesmo tempo, e a
 * leitura é de uma gota que se estende de um para o outro em vez de um bloco
 * que se teleporta. É o que dá vida à fileira sem inventar um elemento novo.
 */
const DOT = 6;
const DOT_GAP = 6;
const CURSOR_W = 12;
const CURSOR_STRETCH = 1.8;

/**
 * Papel cromático de cada sinal da prontidão. Preenchimento de barra usa
 * `accent`. A carga fica com `purple` porque os quatro vizinhos já ocupam os
 * matizes quentes e frios óbvios, e ela é o único sinal que não mede o corpo —
 * separá-la à vista é coerente com pesar menos.
 */
const COMP_ROLE: Record<ReadinessKey, RoleKey> = {
  sono: 'blue',
  fcRepouso: 'rose',
  vfc: 'green',
  aneis: 'orange',
  carga: 'purple',
};

/** Opacidade de um sinal fora do peso: visível, mas claramente sem voto. */
const STALE_DIM = 0.4;

/**
 * Papel do tom da recomendação. `neutral` não tem papel: é ausência de
 * orientação, e pintá-la de qualquer cor faria parecer que há uma.
 */
const TONE_ROLE: Record<AdviceTone, RoleKey | null> = {
  go: 'green',
  caution: 'orange',
  rest: 'blue',
  neutral: null,
};

interface Props {
  /** Dataset completo do store (`_all`); o núcleo já ignora as ocultas. */
  activities: Activity[];
  /** `false` até o primeiro load terminar — a curva não aparece antes. */
  loaded: boolean;
}

export function TodayBodyCard({ activities, loaded }: Props) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  // `ComponentRef<typeof ScrollView>` em vez do genérico direto com o nome do
  // componente: a barreira de `architecture.test.ts` lê esse genérico (e até um
  // comentário com ele) como tag JSX e cobra a prop da barra de rolagem.
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Tamanho do trilho, medido no ScrollView. É a **página**, não o cartão: o
  // cartão é isto menos o vinco e menos a folga da sombra.
  const [size, setSize] = useState({ width: 0, height: RAIL_H + 2 * BLEED_V });
  const [page, setPage] = useState(0);
  const { width } = size;

  // A posição do trilho, em pontos. Tudo que se mexe pendura aqui.
  const scrollX = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }),
    [scrollX],
  );

  const summaries = useHealthStore((s) => s.summaries);
  // Assina `rows` (e não `seriesFor`, que é estável): é a chegada da tabela que
  // precisa acordar o componente. O recorte da métrica sai do `useMemo` abaixo,
  // porque `rows` cobre um ano de todas as métricas.
  const dailyRows = useHealthDailyStore((s) => s.rows);
  const loadDaily = useHealthDailyStore((s) => s.load);
  const planned = usePlannedWorkoutsStore((s) => s.planned);
  const loadPlanner = usePlannedWorkoutsStore((s) => s.load);

  useEffect(() => {
    loadPlanner();
    // VFC do intervals.icu mora em `health_daily`, não no HealthKit (ADR 0026).
    void loadDaily();
  }, [loadPlanner, loadDaily]);

  // Recalcula quando a lista muda ou o dia vira. O instante fica fora das deps
  // de propósito: é a chave do dia que importa, não o `new Date()`.
  const today = localDateStr();
  const curve = useMemo(
    () => buildFormCurve(activities, {}, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, today],
  );

  // A carga da prontidão é o mesmo ACWR do cartão de carga: a curva já está
  // montada aqui, e recalcular carga do zero deixaria os dois números divergirem.
  const load = useMemo(() => buildTrainingLoad(curve.series), [curve]);

  // As três séries que a prontidão usa. As summaries do HealthKit cobrem 7 dias;
  // a baseline de 90 que o núcleo pede só existe nestas linhas.
  const readinessRows = useMemo(
    () => ({
      vfc: dailyRows.filter((r) => r.metric === 'vfc'),
      fcRepouso: dailyRows.filter((r) => r.metric === 'fcRepouso'),
      sono: dailyRows.filter((r) => r.metric === 'sono'),
    }),
    [dailyRows],
  );
  const score = useMemo(
    () =>
      readinessFromSummaries(summaries, {
        ...readinessRows,
        acwr: load.acwr,
        // Sync de atividades parado vira zeros na janela aguda, o ACWR desce, e
        // "abaixo do costume" vale 100 — a carga sustentaria a nota justamente
        // quando não há dado. A idade é o silêncio, não o fim da série.
        acwrAgeDays: curve.daysSinceLastActivity,
      }),
    [summaries, readinessRows, load, curve],
  );

  // Largura mudou (rotação, split view): reencaixa o slide ativo, senão o
  // deslocamento antigo deixa os dois slides pela metade.
  useEffect(() => {
    if (width > 0) scrollRef.current?.scrollTo({ x: page * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const hasCurve = canShow(loaded, curve);
  const hasReady = canShowReadiness(score);
  if (!hasCurve && !hasReady) return null;

  const green = roleColors('green');
  const red = roleColors('red');
  const toneText: Record<FormTone, string> = { fresh: green.text, buried: red.text, unsure: colors.ink3 };
  const toneMark: Record<FormTone, string> = { fresh: green.accent, buried: red.accent, unsure: colors.ink3 };
  const baseColor = baseBarColor(roleColors('blue').text, colors.ink);
  const fatigueColor = roleColors('rose').text;

  // O cartão é a viewport menos o vinco; a medição do `onLayout` é do trilho,
  // que agora é maior do que mostra. O contorno dos temas Clean entra na conta
  // porque o `shadows.card` deles é uma borda de 1 pt, e ela come largura útil —
  // sem isto a faísca do SVG passaria 2 pt por baixo do padding no Clean.
  const cardBorder = (shadows.card.borderWidth as number | undefined) ?? 0;
  const cardW = Math.max(0, width - CARD_GAP);
  const cardH = Math.max(0, size.height - 2 * BLEED_V);
  const innerW = Math.max(0, cardW - 2 * (SLIDE_PAD + cardBorder));
  const plotW = Math.max(0, innerW - SPARK_LEFT - SPARK_RIGHT);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize({ width: Math.round(w), height: Math.round(h) });
  };

  // Largura útil para interpolar. Os slides só entram na árvore depois da
  // medição, mas os elementos são construídos antes dela — e uma faixa de
  // entrada degenerada (`[0, 0, 0]`) divide por zero no primeiro render.
  const W = width || 1;
  /** Quanto o slide `i` está fora de posição: −W à esquerda, 0 ativo, +W à direita. */
  const localOf = (i: number) => Animated.subtract(scrollX, i * W);
  /** Camada do slide `i`: `px` positivo fica para trás, negativo vai na frente. */
  const layer = (i: number, px: number) => ({
    transform: [
      { translateX: localOf(i).interpolate({ inputRange: [-W, 0, W], outputRange: [-px, 0, px] }) },
    ],
  });
  /** O slide como um todo: desbota e recua conforme sai de cena. */
  const motion = (i: number) => {
    const local = localOf(i);
    return {
      opacity: local.interpolate({
        inputRange: [-W * FADE_AT, 0, W * FADE_AT],
        outputRange: [FADE_TO, 1, FADE_TO],
        extrapolate: 'clamp' as const,
      }),
      transform: [
        { perspective: PERSPECTIVE },
        {
          // Sinal: rotação positiva empurra a borda direita para o fundo. O
          // cartão que ficou à direita (local negativo) leva o positivo, e é
          // assim que os dois ficam virados para o centro da tela.
          rotateY: local.interpolate({
            inputRange: [-W, 0, W],
            outputRange: [`${CARD_TILT}deg`, '0deg', `${-CARD_TILT}deg`],
            extrapolate: 'clamp' as const,
          }),
        },
        {
          scale: local.interpolate({
            inputRange: [-W, 0, W],
            outputRange: [SLIDE_MIN_SCALE, 1, SLIDE_MIN_SCALE],
            extrapolate: 'clamp' as const,
          }),
        },
      ],
    };
  };
  const slideStyle = (i: number) => [styles.slide, { width: cardW, height: cardH }, motion(i)];
  const labels: string[] = [];
  const slides: React.ReactNode[] = [];

  if (hasCurve) {
    const state = formState(curve);
    const spark = sparkSegments(sparkValues(curve.series), {
      width: plotW,
      height: SPARK_H,
      pad: 4,
      offsetX: SPARK_LEFT,
    });
    const bars = barScale(curve);
    const detail = detailSentence(curve.series);

    labels.push('Ver o saldo de hoje', 'Ver de onde vem');
    slides.push(
      // Slide — Saldo de hoje
      <Animated.View key="saldo" style={slideStyle(0)}>
        <Animated.View style={[styles.headRow, layer(0, HEAD_LAG)]}>
          <View
            style={styles.headText}
            accessible
            accessibilityLabel={`Saldo de hoje: ${state.valueText} ${state.unitText}. ${state.phrase}`}
          >
            <Text style={styles.eyebrow}>SALDO DE HOJE</Text>
            <View style={styles.numberRow}>
              <Text style={[styles.number, { color: toneText[state.tone] }]}>{state.valueText}</Text>
              <Text style={styles.numberUnit}>{state.unitText}</Text>
            </View>
            <Text style={styles.phrase}>{state.phrase}</Text>
          </View>
          {state.badge && (
            <View style={styles.badge} accessible accessibilityLabel={state.badge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>{state.badge}</Text>
            </View>
          )}
        </Animated.View>

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

          {/* As três variantes dividem a mesma altura e a mesma camada. */}
          <Animated.View style={layer(0, -FOOT_LEAD)}>
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
          </Animated.View>
        </View>
      </Animated.View>,

      // Slide — De onde vem
      <Animated.View key="origem" style={slideStyle(1)}>
        <Animated.View style={[styles.headRowCenter, layer(1, HEAD_LAG)]}>
          <Text style={styles.eyebrow}>DE ONDE VEM</Text>
          <Text style={styles.headHint}>esforço por semana</Text>
        </Animated.View>

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
        <Animated.Text style={[styles.detail, layer(1, -FOOT_LEAD)]} numberOfLines={2}>
          {detail ?? ''}
        </Animated.Text>
      </Animated.View>,
    );
  }

  if (hasReady) {
    // Recomendação: prontidão × intensidade do treino planejado de hoje (real).
    // Com `total` nulo o conselho já devolve a orientação neutra — o rodapé então
    // troca o texto pela razão de não haver nota, que é mais específica.
    const todayPlan = planned.find((p) => p.date === today);
    const advice = readinessAdvice(score.total, true, todayPlan?.kind ?? 'none', todayPlan?.type ?? '');
    const semNota = noScoreNote(score);
    const role = TONE_ROLE[advice.tone];
    const tone = role ? roleColors(role) : null;
    // Régua é objeto gráfico (piso 3,0) e o título é letra (piso 4,5): `accent`
    // numa, `text` na outra. Ver ADR 0024.
    const ruleColor = tone?.accent ?? colors.ink4;
    const titleColor = tone?.text ?? colors.ink2;

    // Índice real: sem a curva, a prontidão é a primeira (e única) página.
    const i = slides.length;

    labels.push('Ver a prontidão');
    slides.push(
      <Animated.View key="prontidao" style={slideStyle(i)}>
        <Animated.View style={[styles.headRowCenter, layer(i, HEAD_LAG)]}>
          <View>
            <Text style={styles.eyebrow}>PRONTIDÃO</Text>
            <Text style={styles.headHint}>{coverageNote(score)}</Text>
          </View>
          {/* Número e faixa numa coluna só: a palavra alinha à direita, sob a
              nota, para não empurrar o serif do lugar quando ela muda. */}
          <View style={styles.scoreBox} accessible accessibilityLabel={scoreLabel(score)}>
            <Text style={styles.score}>{scoreText(score)}</Text>
            <Text style={styles.scoreBand}>{bandText(score)}</Text>
          </View>
        </Animated.View>

        <View style={styles.barsTight}>
          {score.components.map((c) => {
            const age = ageNote(c);
            return (
              <View
                key={c.key}
                style={[styles.barRow, c.stale && { opacity: STALE_DIM }]}
                accessible
                accessibilityLabel={
                  c.stale
                    ? `${c.label}: ${Math.round(c.score)}, leitura de ${age}, fora da nota`
                    : `${c.label}: ${Math.round(c.score)}`
                }
              >
                {/* Uma linha, sempre: um rótulo que quebra estoura o trilho. */}
                <Text style={styles.barLabel} numberOfLines={1}>
                  {shortLabel(c)}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.round(c.score)}%` as const,
                        // Sinal novo no núcleo cai no neutro em vez de quebrar o
                        // `roleColors`, como `shortLabel` cai no rótulo longo.
                        backgroundColor: COMP_ROLE[c.key] ? roleColors(COMP_ROLE[c.key]).accent : colors.ink3,
                      },
                    ]}
                  />
                </View>
                {/* A idade toma o lugar do número quando existe: o sub-score de
                    um sinal que não vota importa menos que a data dele. */}
                <Text style={[styles.barValue, age !== '' && styles.barAge]}>
                  {age !== '' ? age : Math.round(c.score)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Sem preenchimento, só a régua: o `surfaceMute` que ficava aqui é o
            token dos trilhos inertes, e como destaque ele mede 1,05 de contraste
            contra o cartão no Clean elevado e no Orbe escuro — some — e 1,10 no
            Clean branco, onde vira a única mancha cinza de um cartão limpo. */}
        <Animated.View style={[styles.advice, { borderLeftColor: ruleColor }, layer(i, -FOOT_LEAD)]}>
          <Text style={[styles.adviceTitle, { color: titleColor }]}>
            {semNota !== '' ? NO_SCORE_TITLE : advice.title}
          </Text>
          <Text style={styles.adviceText} numberOfLines={2}>
            {semNota !== '' ? semNota : advice.text}
          </Text>
        </Animated.View>
      </Animated.View>,
    );
  }

  // O dado pode encolher entre renders (logout, permissão revogada): o slide
  // ativo é clampado aqui, senão o trilho fica rolado para uma página que sumiu.
  const active = Math.min(page, slides.length - 1);
  /** A virada de página é a única coisa que vibra: olho, dedo e tato no mesmo instante. */
  const settle = (p: number) => {
    if (p !== page) Haptics.selectionAsync().catch(() => {});
    setPage(p);
  };
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) {
      const p = Math.round(e.nativeEvent.contentOffset.x / width);
      settle(Math.min(slides.length - 1, Math.max(0, p)));
    }
  };
  // Dente de serra do estiramento: 1 sobre cada ponto, `CURSOR_STRETCH` no meio
  // do caminho entre dois. Construído em laço porque o número de páginas é
  // dinâmico — com duas ou três páginas a faixa tem tamanhos diferentes.
  const stretchIn: number[] = [];
  const stretchOut: number[] = [];
  for (let p = 0; p < slides.length; p++) {
    if (p > 0) {
      stretchIn.push((p - 0.5) * W);
      stretchOut.push(CURSOR_STRETCH);
    }
    stretchIn.push(p * W);
    stretchOut.push(1);
  }

  const goTo = (p: number) => {
    settle(p);
    // O cursor não é avisado: ele lê o `scrollX`, e este `scrollTo` o move
    // exatamente como o dedo moveria. É o que faz tocar e arrastar coincidirem.
    scrollRef.current?.scrollTo({ x: p * width, animated: true });
  };

  return (
    <View style={styles.block}>
      <View style={styles.rail}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onLayout={onLayout}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumEnd}
          scrollEnabled={slides.length > 1}
          style={styles.track}
        >
          {width > 0 && slides}
        </Animated.ScrollView>
      </View>

      {slides.length > 1 && (
        <View style={styles.pills}>
          <View style={styles.dotRow}>
            {labels.map((label, i) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: active === i }}
                // 6 pt de alvo com 12 de folga dava ~30×18 — abaixo dos 44 da HIG.
                hitSlop={{ top: 18, bottom: 18, left: 10, right: 10 }}
                onPress={() => goTo(i)}
                style={styles.dot}
              />
            ))}
            {width > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.cursor,
                  {
                    // `translateX` primeiro: o `scaleX` estica em torno do
                    // próprio centro e não multiplica o deslocamento.
                    transform: [
                      {
                        translateX: scrollX.interpolate({
                          // Sem `extrapolate`: a reta continua sozinha para a
                          // terceira página e para as que vierem depois.
                          inputRange: [0, W],
                          outputRange: [0, DOT + DOT_GAP],
                        }),
                      },
                      {
                        scaleX: scrollX.interpolate({
                          inputRange: stretchIn,
                          outputRange: stretchOut,
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}
          </View>
        </View>
      )}
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
    // O trilho enxerga um retângulo maior do que mostra, para a sombra do
    // cartão não morrer no recorte do ScrollView; a margem negativa devolve a
    // folga, e no fluxo ele ocupa RAIL_H como sempre ocupou.
    rail: {
      height: RAIL_H + 2 * BLEED_V,
      marginVertical: -BLEED_V,
      marginHorizontal: -CARD_GAP / 2,
    },
    // Sem `overflow: 'hidden'`: quem arredonda agora é o cartão, e recortar
    // aqui cortaria justamente a sombra que o trilho ganhou folga para mostrar.
    track: { flex: 1 },
    // A casca de card mora aqui — ver o cabeçalho do arquivo. A margem centra o
    // cartão na página e abre o vinco: dois cartões avançam exatos `width`.
    slide: {
      marginHorizontal: CARD_GAP / 2,
      marginVertical: BLEED_V,
      padding: SLIDE_PAD,
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: radii['3xl'],
      ...shadows.card,
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
    // A faixa fica ao LADO da nota, na mesma linha de base: embaixo ela somaria
    // uma linha ao cabeçalho e empurraria as barras, e a palavra muda mais vezes
    // que o número — nada pode se mover quando ela troca.
    scoreBox: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    score: { fontSize: 32, lineHeight: 36, fontFamily: fonts.serif, color: colors.ink },
    scoreBand: {
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      fontFamily: fonts.sansBold,
      color: colors.ink3,
    },
    bars: { gap: 9 },
    // Cinco barras em vez de duas: o mesmo respiro não caberia.
    barsTight: { gap: 4 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    // `lineHeight` explícito nos dois textos da linha: sem ele a altura da barra
    // depende da métrica da fonte, e a conta de `RAIL_H` deixaria de fechar no
    // dia em que a família mudasse — calada, como já aconteceu com os rótulos.
    barLabel: { width: 92, fontSize: 12.5, lineHeight: 15, fontFamily: fonts.sans, color: colors.ink2 },
    barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceMute },
    barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
    barTick: { position: 'absolute', top: -3, width: 2, height: 14, borderRadius: 1, backgroundColor: colors.ink2 },
    barValue: {
      width: 34,
      textAlign: 'right',
      fontFamily: fonts.monoSemiBold,
      fontSize: 12.5,
      lineHeight: 15,
      color: colors.ink,
    },
    // A idade é palavra, não número: sai do mono tabular e perde o peso — ela
    // explica a barra apagada, não compete com os valores que ainda votam.
    barAge: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.ink3 },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    legendTick: { width: 2, height: 11, borderRadius: 1, backgroundColor: colors.ink2 },
    legendText: { fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink3 },
    detail: { fontSize: 12.5, lineHeight: 17, fontFamily: fonts.sans, color: colors.ink2, minHeight: 34 },
    advice: { borderLeftWidth: 3, paddingLeft: 10, gap: 1 },
    adviceTitle: { fontSize: 12.5, lineHeight: 16, fontFamily: fonts.sansBold },
    adviceText: { fontSize: 12, lineHeight: 16, fontFamily: fonts.sans, color: colors.ink2 },
    pills: {
      height: PILLS_H,
      marginTop: GAP,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    // A fileira é a referência do cursor absoluto — e, como todos os pontos
    // medem igual, ela não se remonta mais quando a página muda.
    dotRow: { flexDirection: 'row', alignItems: 'center', gap: DOT_GAP },
    dot: { width: DOT, height: DOT, borderRadius: radii.pill, backgroundColor: colors.ink4 },
    cursor: {
      position: 'absolute',
      top: 0,
      // Centrado no primeiro ponto: a sobra de 5 pt invade a folga dos dois
      // lados, que é o que dá a leitura de "cápsula por cima da fileira".
      left: -(CURSOR_W - DOT) / 2,
      width: CURSOR_W,
      height: DOT,
      borderRadius: radii.pill,
      backgroundColor: colors.ink2,
    },
  });
