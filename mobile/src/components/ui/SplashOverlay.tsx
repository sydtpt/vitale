/**
 * SplashOverlay — tela de abertura da marca Orbe, cobrindo a tela inteira.
 *
 * Renderiza o creme da paleta em `absoluteFill` (full-bleed) com a marca
 * centralizada: o sol laranja no centro, uma órbita elíptica inclinada em volta
 * e alguns "planetas" coloridos pontuando a órbita; abaixo, o wordmark "Orbe"
 * em serifa. Fica por cima de toda a navegação até o app estar pronto e então
 * some com um fade suave.
 *
 * Uso: mantido montado desde o primeiro frame (para não haver flash ao esconder
 * o splash nativo). Quando `visible` vira `false`, faz fade-out e chama
 * `onHidden` ao terminar, quando o pai pode desmontá-lo.
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G } from 'react-native-svg';
import { surfaces, brand, accents, ink } from '@vitale/shared';

const FADE_MS = 420;

// Paleta dos planetas orbitando o sol (na órbita e ao redor dela).
const PLANETS: { cx: number; cy: number; r: number; fill: string }[] = [
  { cx: 118, cy: 32, r: 6, fill: brand.primaryDeep }, // vermelho topo
  { cx: 78, cy: 44, r: 5, fill: brand.primaryDeep }, // vermelho topo-esq
  { cx: 44, cy: 82, r: 6, fill: accents.green }, // verde-azulado esq
  { cx: 40, cy: 122, r: 5, fill: brand.primaryDeep }, // vermelho meio-esq
  { cx: 150, cy: 56, r: 7, fill: brand.primary }, // laranja (na órbita)
  { cx: 168, cy: 106, r: 6, fill: accents.yellow }, // amarelo dir
  { cx: 152, cy: 150, r: 5, fill: brand.primaryDeep }, // vermelho baixo-dir
  { cx: 72, cy: 150, r: 6, fill: '#2E4A6B' }, // azul-marinho baixo-esq
  { cx: 108, cy: 174, r: 5, fill: ink.ink }, // tinta base
];

/** Marca Orbe: sol central, órbita elíptica inclinada e planetas ao redor. */
function OrbeMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {/* Órbita inclinada — desenhada atrás do sol para dar profundidade. */}
      <G origin="100, 100" rotation={-22}>
        <Ellipse
          cx={100}
          cy={100}
          rx={80}
          ry={34}
          fill="none"
          stroke={brand.primary}
          strokeWidth={3.5}
        />
      </G>
      {/* Sol central sobre a órbita. */}
      <Circle cx={100} cy={100} r={34} fill={brand.primary} />
      {/* Planetas. */}
      {PLANETS.map((p, i) => (
        <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} />
      ))}
    </Svg>
  );
}

export function SplashOverlay({
  visible,
  onHidden,
}: {
  visible: boolean;
  onHidden?: () => void;
}) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onHidden?.();
    });
  }, [visible]);

  return (
    <Animated.View style={[styles.root, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
      <OrbeMark size={220} />
      <Text style={styles.word}>Orbe</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: surfaces.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: {
    fontFamily: 'InstrumentSerif',
    fontSize: 72,
    lineHeight: 80,
    color: ink.ink,
    marginTop: 8,
  },
});
