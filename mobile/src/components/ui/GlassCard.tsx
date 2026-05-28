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
export function GlassCard({ style, children, intensity = 40, ...rest }: Props) {
  const { glass, scheme, colors } = useTheme();

  if (!glass) {
    return (
      <View style={[{ backgroundColor: colors.surface }, style]} {...rest}>
        {children}
      </View>
    );
  }

  const overlay = scheme === 'dark' ? 'rgba(38,32,25,0.45)' : 'rgba(255,255,255,0.40)';

  return (
    <BlurView
      tint={scheme === 'dark' ? 'dark' : 'light'}
      intensity={intensity}
      style={[style, styles.glass]}
      {...rest}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  glass: { backgroundColor: 'transparent', overflow: 'hidden' },
});
