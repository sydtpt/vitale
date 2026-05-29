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
export function GlassCard({ style, children, intensity = 60, ...rest }: Props) {
  const { glass, scheme, colors } = useTheme();

  if (!glass) {
    return (
      <View style={[{ backgroundColor: colors.surface }, style]} {...rest}>
        {children}
      </View>
    );
  }

  const dark = scheme === 'dark';
  // Tint leve sobre o blur — quanto menor o alpha, mais translúcido (look iOS nativo).
  const overlay = dark ? 'rgba(30,26,21,0.30)' : 'rgba(255,255,255,0.18)';
  // Borda highlight fina para o acabamento de vidro nativo.
  const hairline = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.25)';

  return (
    <BlurView
      tint={dark ? 'dark' : 'light'}
      intensity={intensity}
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
