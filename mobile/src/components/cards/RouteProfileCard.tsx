import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { ActivityRoutePoint } from '@vitale/shared';
import {
  METRIC_ROLE,
  elevationProfile,
  formatRate,
  indexAtDistance,
  speedSeries,
} from '@vitale/shared';
import { colors, fonts, radii, roleColors, shadows, spacing, useThemedStyles } from '../../theme';

const H = 100;
/**
 * O respiro de cima é maior que os outros porque **o rótulo do pico mora nele**.
 * O pico é o máximo da série por definição, então o marcador cai sempre exatamente
 * em `PAD_T`, e o rótulo, uma linha acima: com 12 o topo dos algarismos saía do
 * `Svg` e o número aparecia cortado. Precisa de `LABEL_DY` mais o ascendente da
 * fonte (~7 em 9px); 20 dá folga sem encostar.
 *
 * O `H` cresceu junto para a área de traçado continuar com os mesmos 72 — reduzir
 * o desenho para caber o rótulo achataria o relevo, que é o dado.
 */
const PAD_T = 20;
const PAD_B = 8;
/** Distância do rótulo ao centro do marcador. */
const LABEL_DY = 8;
/**
 * Margem em que o rótulo deixa de ser centrado no marcador e passa a ancorar
 * pela borda. Um pico no começo ou no fim do percurso é comum — a primeira
 * subida, a última rampa — e centrado ali o texto vazaria para fora do `Svg`
 * pelos lados, que é o mesmo defeito do corte de cima, só na horizontal.
 */
const LABEL_EDGE = 18;
/** Teto de vértices por traçado: mil pontos num `path` não desenham mais nada. */
const MAX_VERTS = 240;

interface Panel {
  title: string;
  /**
   * A **chave** da métrica, não a cor. O `useMemo` abaixo não depende do tema, e
   * uma cor congelada aqui sobreviveria à troca de esquema — guardar a chave faz
   * a cor ser relida a cada render, que é o contrato do `roleColors`.
   */
  metric: keyof typeof METRIC_ROLE;
  area: string;
  line: string;
  topLabel: string;
  botLabel: string;
  marker: { x: number; y: number; label: string } | null;
  /** Distâncias acumuladas da série — a régua para achar o ponto sob o dedo. */
  xs: number[];
  /** Valores da série, no mesmo índice de `xs`. */
  ys: number[];
  /** Extremos usados na escala vertical, para recalcular o y do cursor. */
  lo: number;
  hi: number;
  /** Como escrever o valor sob o dedo (com unidade). */
  fmt: (v: number) => string;
}

/**
 * Perfil de elevação e curva de ritmo, abaixo do mapa.
 *
 * **Dois gráficos empilhados, nunca um com dois eixos.** Altitude e velocidade
 * têm escalas sem relação nenhuma, e sobrepô-las num eixo duplo faz o leitor ver
 * cruzamentos que não significam nada. Empilhados, compartilham o eixo x
 * (distância percorrida), que é o que de fato liga os dois: dá para descer o
 * dedo de um pico de subida para o afundamento do ritmo embaixo dele.
 *
 * Cada painel some sozinho quando não há o que mostrar — percurso plano não tem
 * perfil, rota sem horário por ponto não tem ritmo. Com os dois ausentes, o card
 * inteiro não aparece, em vez de desenhar uma reta que parece dado.
 *
 * **A cor é da métrica, não da atividade.** Cada painel lê o seu papel em
 * `METRIC_ROLE`, e por isso o componente não recebe mais `color`: numa atividade
 * só, a atividade é constante e pintar os dois painéis com ela gastava cor sem
 * dizer nada — o mesmo perfil mudava de cor entre uma corrida e um pedal, o que
 * impedia comparar os dois de olho.
 *
 * **Arrastar o dedo percorre o percurso.** O toque vira uma distância no eixo x,
 * e daí saem três coisas ao mesmo tempo: a guia vertical nos **dois** painéis, o
 * valor de cada um no lugar da faixa, e — por `onScrub` — o ponto no mapa lá em
 * cima. Os dois painéis acendem juntos de propósito: é a pergunta que a pilha
 * existe para responder, "o que o ritmo fez naquela subida".
 *
 * O cursor **fica** ao soltar, como no Komoot. Some ao soltar seria pior no
 * telefone: o dedo tapa o gráfico enquanto arrasta, e é depois de levantá-lo que
 * se olha o mapa com calma.
 */
export function RouteProfileCard({
  points,
  activityId,
  onScrub,
}: {
  points: ActivityRoutePoint[];
  activityId: number;
  /** Distância (m) sob o dedo, ou `null` quando o cursor é limpo. */
  onScrub?: (distanceM: number | null) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  // Padding do scroll dos dois lados, mais o do card.
  const w = Math.max(0, width - spacing.lg * 2 - spacing.lg * 2);

  const [cursorX, setCursorX] = useState<number | null>(null);

  const { panels, totalKm } = useMemo<{ panels: Panel[]; totalKm: number }>(() => {
    const prof = elevationProfile(points);
    const speed = speedSeries(points);
    const xMax = Math.max(
      prof ? prof.xs[prof.xs.length - 1] : 0,
      speed ? speed.xs[speed.xs.length - 1] : 0,
      1,
    );
    const rate = (mps: number) => {
      if (mps <= 0) return '—';
      const r = formatRate(activityId, 1000, 1000 / mps);
      return r ? `${r.value} ${r.caption === 'pace' ? 'min/km' : r.caption}` : '—';
    };

    const out: Panel[] = [];
    if (prof) {
      out.push({
        title: 'Elevação',
        metric: 'elevacao',
        ...geometry(prof.xs, prof.ys, xMax, prof.minAlt, prof.maxAlt, w),
        topLabel: `${Math.round(prof.maxAlt)} m`,
        botLabel: `${Math.round(prof.minAlt)} m`,
        marker: {
          x: xAt(prof.xs[prof.peakIdx], xMax, w),
          y: yAt(prof.ys[prof.peakIdx], prof.minAlt, prof.maxAlt),
          label: `${Math.round(prof.maxAlt)} m`,
        },
        xs: prof.xs,
        ys: prof.ys,
        lo: prof.minAlt,
        hi: prof.maxAlt,
        fmt: (v) => `${Math.round(v)} m`,
      });
    }
    if (speed) {
      const lo = Math.min(...speed.mps);
      const hi = Math.max(...speed.mps);
      out.push({
        // O eixo é velocidade (mais alto = mais rápido, sem inverter nada), mas
        // rotulado na unidade do esporte: corrida lê min/km, bicicleta lê km/h.
        title: activityId === 13 ? 'Velocidade' : 'Ritmo',
        metric: 'velocidade',
        ...geometry(speed.xs, speed.mps, xMax, lo, hi, w),
        topLabel: rate(hi),
        botLabel: rate(lo),
        marker: null,
        xs: speed.xs,
        ys: speed.mps,
        lo,
        hi,
        fmt: rate,
      });
    }
    return { panels: out, totalKm: xMax / 1000 };
  }, [points, activityId, w]);

  const xMax = Math.max(totalKm * 1000, 1);

  /**
   * Um toque ou arrasto vira distância.
   *
   * `onPanResponderTerminationRequest` devolve `true` de propósito: os painéis
   * ficam dentro do ScrollView da tela, e recusar a terminação prenderia a
   * rolagem vertical num retângulo de 200 px. Assim o toque parado e o arrasto
   * horizontal viram scrub, e o arrasto vertical vira rolagem — o ScrollView
   * pede a posse e a recebe.
   */
  const pan = useMemo(
    () => {
      const emit = (locationX: number) => {
        const x = Math.min(1, Math.max(0, locationX / (w || 1))) * xMax;
        setCursorX(x);
        onScrub?.(x);
      };
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => true,
        onPanResponderGrant: (e) => emit(e.nativeEvent.locationX),
        onPanResponderMove: (e) => emit(e.nativeEvent.locationX),
      });
    },
    [w, xMax, onScrub],
  );

  if (panels.length === 0 || w <= 0) return null;

  const cursorIdxOf = (p: Panel) => (cursorX === null ? -1 : indexAtDistance(p.xs, cursorX));

  return (
    <View style={styles.card}>
      <View {...pan.panHandlers}>
        {panels.map((p) => {
          const color = roleColors(METRIC_ROLE[p.metric]).accent;
          const ci = cursorIdxOf(p);
          const cx = ci >= 0 ? xAt(p.xs[ci], xMax, w) : 0;
          const cy = ci >= 0 ? yAt(p.ys[ci], p.lo, p.hi) : 0;
          return (
            <View key={p.title} style={styles.panel}>
              <View style={styles.head}>
                <Text style={styles.title}>{p.title}</Text>
                {ci >= 0 ? (
                  // Sob o dedo, a faixa dá lugar ao valor daquele ponto: é a
                  // mesma vaga, e o extremo do percurso interessa menos que o
                  // lugar que se está olhando.
                  <Text style={[styles.reading, { color }]}>{p.fmt(p.ys[ci])}</Text>
                ) : (
                  <Text style={styles.range}>
                    {p.botLabel} → {p.topLabel}
                  </Text>
                )}
              </View>
              <Svg width={w} height={H}>
                <Path d={p.area} fill={color} fillOpacity={0.14} />
                <Path
                  d={p.line}
                  stroke={color}
                  strokeWidth={2}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {p.marker && (
                  <>
                    <Circle
                      cx={p.marker.x}
                      cy={p.marker.y}
                      r={3}
                      fill={color}
                      stroke={colors.surface}
                      strokeWidth={2}
                    />
                    <SvgText
                      x={p.marker.x}
                      y={p.marker.y - LABEL_DY}
                      fontSize={9}
                      fill={colors.ink}
                      textAnchor={labelAnchor(p.marker.x, w)}
                    >
                      {p.marker.label}
                    </SvgText>
                  </>
                )}
                {ci >= 0 && (
                  <>
                    {/* A guia é cromo, não dado: fica em tinta neutra para não
                        competir com a cor da métrica no mesmo painel. */}
                    <Line
                      x1={cx}
                      y1={PAD_T - 6}
                      x2={cx}
                      y2={H - PAD_B}
                      stroke={colors.ink4}
                      strokeWidth={1}
                    />
                    <Circle cx={cx} cy={cy} r={4} fill={color} stroke={colors.surface} strokeWidth={2} />
                  </>
                )}
              </Svg>
            </View>
          );
        })}
      </View>

      {/* O eixo x é comum aos dois painéis; desenhá-lo dentro de um deles o
          prenderia àquele gráfico. */}
      {cursorX === null ? (
        <View style={styles.axis}>
          <Text style={styles.tick}>0 km</Text>
          <Text style={styles.tick}>{fmtKm(totalKm / 2)}</Text>
          <Text style={styles.tick}>{fmtKm(totalKm)}</Text>
        </View>
      ) : (
        // As três marcas dão lugar a uma só: com o cursor aceso, a pergunta
        // deixou de ser "onde é o meio" e passou a ser "em que quilômetro estou".
        <View style={styles.axis}>
          <Text style={styles.tickLive}>{fmtKm(cursorX / 1000)}</Text>
          <Text
            style={styles.tickClear}
            onPress={() => {
              setCursorX(null);
              onScrub?.(null);
            }}
            suppressHighlighting
          >
            limpar
          </Text>
        </View>
      )}
    </View>
  );
}

function fmtKm(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function xAt(x: number, xMax: number, w: number): number {
  return (x / xMax) * w;
}

/** Onde ancorar o rótulo do pico para ele não vazar pelas laterais. */
function labelAnchor(x: number, w: number): 'start' | 'middle' | 'end' {
  if (x < LABEL_EDGE) return 'start';
  if (x > w - LABEL_EDGE) return 'end';
  return 'middle';
}

function yAt(v: number, lo: number, hi: number): number {
  const span = hi - lo || 1;
  return PAD_T + (1 - (v - lo) / span) * (H - PAD_T - PAD_B);
}

/**
 * Traçado e área de uma série.
 *
 * Reamostra por índice até `MAX_VERTS`: uma rota longa chega com milhares de
 * pontos e, na largura de um celular, tudo acima de umas poucas centenas cai no
 * mesmo pixel — custa render e não desenha nada a mais. O último ponto entra
 * sempre, senão o traçado termina antes da linha de chegada.
 */
function geometry(
  xs: number[],
  ys: number[],
  xMax: number,
  lo: number,
  hi: number,
  w: number,
): { area: string; line: string } {
  const step = Math.max(1, Math.ceil(xs.length / MAX_VERTS));
  const idx: number[] = [];
  for (let i = 0; i < xs.length; i += step) idx.push(i);
  if (idx[idx.length - 1] !== xs.length - 1) idx.push(xs.length - 1);

  const pts = idx.map(
    (i) => `${xAt(xs[i], xMax, w).toFixed(1)},${yAt(ys[i], lo, hi).toFixed(1)}`,
  );
  const line = `M${pts.join(' L')}`;
  const base = (H - PAD_B).toFixed(1);
  const first = xAt(xs[idx[0]], xMax, w).toFixed(1);
  const last = xAt(xs[idx[idx.length - 1]], xMax, w).toFixed(1);
  return { line, area: `${line} L${last},${base} L${first},${base} Z` };
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii['2xl'],
      padding: spacing.lg,
      marginTop: spacing.sm,
      gap: spacing.sm,
      ...shadows.card,
    },
    panel: { gap: 2 },
    head: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    title: { fontSize: 11.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    range: { marginLeft: 'auto', fontSize: 10.5, fontFamily: fonts.mono, color: colors.ink3 },
    reading: { marginLeft: 'auto', fontSize: 11.5, fontFamily: fonts.mono },
    axis: { flexDirection: 'row', justifyContent: 'space-between' },
    tick: { fontSize: 10, fontFamily: fonts.mono, color: colors.ink4 },
    tickLive: { fontSize: 10, fontFamily: fonts.mono, color: colors.ink2 },
    tickClear: { fontSize: 10, fontFamily: fonts.sansSemiBold, color: colors.ink3 },
  });
