import React, { createContext, useContext, useRef } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

/**
 * Coordena o "collapse" da tab bar com o scroll das telas.
 *
 * `collapsed`: 0 = tamanho original, 1 = reduzida.
 * As telas chamam `useTabBarScroll()` para obter um `onScroll` que atualiza
 * o valor conforme a direção do gesto; a tab bar lê `collapsed` para animar.
 *
 * Usa o `Animated` nativo do React Native (não Reanimated) para não depender
 * de setup nativo adicional.
 */
const TabBarScrollContext = createContext<Animated.Value | null>(null);

// Ignora micro-movimentos p/ não piscar entre estados.
const DIRECTION_THRESHOLD = 6;
// Só começa a reagir depois de sair do topo.
const TOP_OFFSET = 12;

export function TabBarScrollProvider({ children }: { children: React.ReactNode }) {
  const collapsed = useRef(new Animated.Value(0)).current;
  return (
    <TabBarScrollContext.Provider value={collapsed}>
      {children}
    </TabBarScrollContext.Provider>
  );
}

export function useTabBarCollapsed(): Animated.Value {
  const value = useContext(TabBarScrollContext);
  if (!value) {
    throw new Error('useTabBarCollapsed deve ser usado dentro de <TabBarScrollProvider>');
  }
  return value;
}

/**
 * Retorna props de scroll para telas dentro das tabs. Colapsa a tab bar ao
 * rolar para baixo e restaura ao rolar para cima.
 */
export function useTabBarScroll() {
  const collapsed = useTabBarCollapsed();
  const lastY = useRef(0);
  const target = useRef(0);

  const animateTo = (to: number) => {
    if (target.current === to) return;
    target.current = to;
    Animated.timing(collapsed, {
      toValue: to,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const delta = y - lastY.current;

    if (y <= TOP_OFFSET) {
      animateTo(0); // Sempre expandida perto do topo.
    } else if (delta > DIRECTION_THRESHOLD) {
      animateTo(1); // Rolando para baixo → reduz.
    } else if (delta < -DIRECTION_THRESHOLD) {
      animateTo(0); // Rolando para cima → tamanho original.
    }

    lastY.current = y;
  };

  return { onScroll, scrollEventThrottle: 16 as const };
}
