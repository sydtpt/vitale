import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

interface CheckButtonProps {
  checked: boolean;
  small?: boolean;
}

export function CheckButton({ checked, small = false }: CheckButtonProps) {
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
        <Ionicons name="checkmark" size={small ? 13 : 18} color="#fff" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.6,
    borderColor: colors.ink4,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
