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
  const overlayAlpha = 0.06 + (1 - resolvedIntensity / 100) * 0.80;
  const overlay = dark
    ? `rgba(20,16,12,${overlayAlpha.toFixed(2)})`
    : `rgba(255,252,248,${overlayAlpha.toFixed(2)})`;
  const hairline = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.60)';

  return (
    <BlurView
      tint={dark ? 'dark' : 'extraLight'}
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

const styles = StyleSheet.create({
  glass: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
