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
 * **Atenção ao swipe-back.** O polegar no valor mínimo fica encostado na borda
 * esquerda, dentro da faixa que o iOS reserva para o gesto de voltar, e os dois
 * disparam juntos — o `PanResponder` do JS não cancela reconhecedor nativo do
 * `react-native-screens`. Por isso `onDragging` existe: a tela desliga
 * `gestureEnabled` só enquanto o dedo está no slider. Funciona porque o
 * reconhecedor de borda só *começa* com movimento, e desabilitá-lo no toque
 * cancela o rastreio. Ignorar `onDragging` traz o bug de volta.
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
  onDragging,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Cor do preenchimento e do polegar. Padrão: a marca. */
  accent?: string;
  /** `true` enquanto o dedo está no controle. Ver a nota do swipe-back acima. */
  onDragging?: (ativo: boolean) => void;
}) {
  useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  // Refs evitam closures obsoletas dentro do PanResponder, criado uma única vez.
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const onDraggingRef = useRef(onDragging);
  const rangeRef = useRef({ min, max, step });
  onChangeRef.current = onChange;
  onDraggingRef.current = onDragging;
  rangeRef.current = { min, max, step };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        onDraggingRef.current?.(true);
        emit(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => emit(e.nativeEvent.locationX),
      onPanResponderRelease: () => onDraggingRef.current?.(false),
      onPanResponderTerminate: () => onDraggingRef.current?.(false),
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
