import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme';

interface Props extends ViewProps {
  /** Blur strength when glass is enabled (0–100). */
  intensity?: number;
}

/**
 * Surface that becomes a translucent iOS-style glass panel when the user
 * enables Glass in Appearance; otherwise a plain solid surface. Pass card
 * styles (padding, radius, etc.) via `style` as usual.
 */
export function GlassCard({ style, children, intensity, ...rest }: Props) {
  const { glass, scheme, blurIntensity, colors } = useTheme();
  const resolvedIntensity = intensity ?? blurIntensity;

  if (!glass) {
    return (
      <View style={[{ backgroundColor: colors.surface }, style]} {...rest}>
        {children}
      </View>
    );
  }

  const dark = scheme === 'dark';
  // Overlay: quanto maior blurIntensity, mais transparente (menor alpha).
  const overlayAlpha = 0.06 + (1 - resolvedIntensity / 100) * 0.8;
  // O véu é a SUPERFÍCIE do tema com alfa, não um creme fixo. Antes era
  // `rgba(255,252,248,…)` cravado, que punha um branco quente por cima de
  // qualquer tema — inclusive do Clean, cuja superfície é branco puro.
  const overlay = withAlpha(colors.surface, overlayAlpha);
  const hairline = dark ? 'rgba(255,255,255,0.14)' : withAlpha(colors.hairline, 0.9);

  return (
    <BlurView
      tint={dark ? 'dark' : 'default'}
      intensity={resolvedIntensity}
      experimentalBlurMethod="dimezisBlurView"
      style={[style, styles.glass, { borderColor: hairline }]}
      {...rest}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
      {children}
    </BlurView>
  );
}

/** `#RRGGBB` + alfa → `rgba(...)`. O RN não aceita hex de 8 dígitos em todas as props. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(2)})`;
}

const styles = StyleSheet.create({
  glass: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
