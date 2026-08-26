import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, useThemedStyles } from '../../theme';

interface CheckButtonProps {
  checked: boolean;
  small?: boolean;
}

export function CheckButton({ checked, small = false }: CheckButtonProps) {
  const styles = useThemedStyles(createStyles);
  const size = small ? 22 : 30;
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        checked && styles.checked,
      ]}
    >
      {checked && (
        <Ionicons name="checkmark" size={small ? 13 : 18} color={colors.onPrimary} />
      )}
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  base: {
    borderWidth: 1.6,
    borderColor: colors.ink4,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: colors.primary,
    // As marcas fluorescentes trazem contorno preto; nas demais o token é
    // `transparent`, e aí a borda volta a ser a própria cor de marca.
    borderColor:
      colors.primaryOutline === 'transparent' ? colors.primary : colors.primaryOutline,
  },
});
