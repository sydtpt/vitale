import React, { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { colors, radii, themed, useTheme } from '../../theme';

const THUMB = 22;

/**
 * Slider de um valor contínuo, com `PanResponder` e sem dependência externa.
 *
 * Generaliza o `BlurSlider` de Aparência (que continua com a cópia dele: trocá-lo
 * aqui obrigaria a reconferir uma tela que não tem nada a ver com esta mudança).
 * Se um terceiro slider aparecer, o de Aparência migra para cá.
 *
 * **Atenção ao swipe-back:** o polegar no valor mínimo fica encostado na borda
 * esquerda, dentro da faixa que o iOS reserva para o gesto de voltar, e os dois
 * disparam juntos. A guarda de borda de `lib/back-gesture.ts` não resolve aqui
 * (ela protegeria justamente o alvo útil) — a tela que usa este slider precisa
 * de `<Stack.Screen options={{ gestureEnabled: false }} />`.
 *
 * Nada de Reanimated — ADR 0010. O arrasto é síncrono e não precisa de worklet:
 * o valor sai direto do `locationX` do toque, sem animação intermediária.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  accent,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Cor do preenchimento e do polegar. Padrão: a marca. */
  accent?: string;
}) {
  useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  // Refs evitam closures obsoletas dentro do PanResponder, criado uma única vez.
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const rangeRef = useRef({ min, max, step });
  onChangeRef.current = onChange;
  rangeRef.current = { min, max, step };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => emit(e.nativeEvent.locationX),
      onPanResponderMove: (e) => emit(e.nativeEvent.locationX),
    }),
  ).current;

  function emit(locationX: number) {
    const w = widthRef.current;
    if (w <= 0) return;
    const { min: lo, max: hi, step: st } = rangeRef.current;
    const frac = Math.max(0, Math.min(1, locationX / w));
    const bruto = lo + frac * (hi - lo);
    const passo = Math.round(bruto / st) * st;
    onChangeRef.current(Math.max(lo, Math.min(hi, passo)));
  }

  const frac = max > min ? (value - min) / (max - min) : 0;
  const clamped = Math.max(0, Math.min(1, frac));
  const cor = accent ?? colors.primary;

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        widthRef.current = w;
        setTrackWidth(w);
      }}
      {...panResponder.panHandlers}
      style={sliderStyles.hit}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
    >
      <View style={sliderStyles.track}>
        <View style={[sliderStyles.fill, { width: `${clamped * 100}%`, backgroundColor: cor }]} />
      </View>
      <View
        style={[
          sliderStyles.thumb,
          { left: trackWidth > 0 ? clamped * (trackWidth - THUMB) : 0, borderColor: cor },
        ]}
      />
    </View>
  );
}

const sliderStyles = themed(() => ({
  hit: { height: 40, justifyContent: 'center' as const },
  track: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.line,
    overflow: 'hidden' as const,
  },
  fill: { height: 4, borderRadius: radii.pill },
  thumb: {
    position: 'absolute' as const,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.surface,
    borderWidth: 2,
  },
}));
